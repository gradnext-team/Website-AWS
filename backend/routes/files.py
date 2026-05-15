"""
Files API Route
Serves files from cloud storage with authentication
Supports video streaming with range requests
"""

from fastapi import APIRouter, HTTPException, Request, Response, Header, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import os
import logging
import threading
import asyncio
from collections import OrderedDict

from routes.auth import get_current_user, get_db
from services import cloud_storage_service

router = APIRouter()
logger = logging.getLogger(__name__)


# In-memory LRU cache for hot files (thumbnails / small images especially).
# Avoids hitting cloud storage on every request — same path = same content because
# uploads use UUID-based filenames, so cached entries never go stale.
_FILE_CACHE_MAX_ENTRIES = 200
_FILE_CACHE_MAX_BYTES_PER_ENTRY = 10 * 1024 * 1024  # 10MB — only cache reasonably small files
_file_cache: "OrderedDict[str, tuple[bytes, str]]" = OrderedDict()
_file_cache_lock = threading.Lock()


# ── Disk-backed video cache ──
# Cloud storage backend does NOT support Range requests, so every video scrub
# would otherwise re-download the entire video. We cache videos to disk on
# first request and serve Range slices from the local file (kernel page cache
# does the heavy lifting from there).
_VIDEO_CACHE_DIR = "/tmp/gradnext_video_cache"
_VIDEO_CACHE_MAX_BYTES = 5 * 1024 * 1024 * 1024  # 5 GB
_video_locks: "dict[str, threading.Lock]" = {}
_video_locks_master = threading.Lock()
os.makedirs(_VIDEO_CACHE_DIR, exist_ok=True)


def _video_cache_path(storage_path: str) -> str:
    """Map a cloud storage path to a flat filename inside the cache dir."""
    safe = storage_path.replace("/", "__")
    return os.path.join(_VIDEO_CACHE_DIR, safe)


def _video_cache_lock_for(path: str) -> threading.Lock:
    with _video_locks_master:
        lock = _video_locks.get(path)
        if lock is None:
            lock = threading.Lock()
            _video_locks[path] = lock
        return lock


def _video_cache_total_bytes() -> int:
    total = 0
    try:
        for f in os.listdir(_VIDEO_CACHE_DIR):
            try:
                total += os.path.getsize(os.path.join(_VIDEO_CACHE_DIR, f))
            except OSError:
                continue
    except FileNotFoundError:
        pass
    return total


def _video_cache_evict_if_needed():
    """LRU-by-atime eviction when disk usage exceeds the cap."""
    try:
        total = _video_cache_total_bytes()
        if total <= _VIDEO_CACHE_MAX_BYTES:
            return
        files = []
        for f in os.listdir(_VIDEO_CACHE_DIR):
            full = os.path.join(_VIDEO_CACHE_DIR, f)
            try:
                files.append((os.path.getatime(full), os.path.getsize(full), full))
            except OSError:
                continue
        files.sort()  # oldest atime first
        for atime, size, full in files:
            if total <= _VIDEO_CACHE_MAX_BYTES:
                break
            try:
                os.remove(full)
                total -= size
                logger.info(f"[video-cache] evicted {full} ({size} bytes)")
            except OSError:
                continue
    except Exception as e:
        logger.warning(f"[video-cache] eviction error: {e}")


def _ensure_video_cached(storage_path: str) -> tuple[str, str]:
    """Download the video to local disk if not already cached.
    Returns (local_path, content_type)."""
    local = _video_cache_path(storage_path)
    meta_path = local + ".ct"

    if os.path.exists(local) and os.path.exists(meta_path):
        # Refresh atime so eviction sorts correctly
        try:
            os.utime(local, None)
        except OSError:
            pass
        with open(meta_path, "r") as f:
            content_type = f.read().strip() or "application/octet-stream"
        return local, content_type

    lock = _video_cache_lock_for(storage_path)
    with lock:
        # Re-check inside the lock
        if os.path.exists(local) and os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                content_type = f.read().strip() or "application/octet-stream"
            return local, content_type

        logger.info(f"[video-cache] miss — downloading {storage_path}")
        info = cloud_storage_service.stream_file(storage_path, range_header=None)
        resp = info["response"]
        content_type = info["content_type"]
        tmp_path = local + ".part"
        try:
            with open(tmp_path, "wb") as out:
                for chunk in resp.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        out.write(chunk)
            os.replace(tmp_path, local)
            with open(meta_path, "w") as f:
                f.write(content_type)
        finally:
            try:
                resp.close()
            except Exception:
                pass
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
        _video_cache_evict_if_needed()
        return local, content_type


def _open_range_iter(local_path: str, start: int, end: int, chunk_size: int = 512 * 1024):
    """Generator yielding bytes [start, end] from local_path."""
    remaining = end - start + 1
    with open(local_path, "rb") as f:
        f.seek(start)
        while remaining > 0:
            data = f.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def _cache_get(path: str):
    with _file_cache_lock:
        if path in _file_cache:
            _file_cache.move_to_end(path)
            return _file_cache[path]
    return None


def _cache_put(path: str, data: bytes, content_type: str):
    if len(data) > _FILE_CACHE_MAX_BYTES_PER_ENTRY:
        return
    with _file_cache_lock:
        _file_cache[path] = (data, content_type)
        _file_cache.move_to_end(path)
        while len(_file_cache) > _FILE_CACHE_MAX_ENTRIES:
            _file_cache.popitem(last=False)


@router.get("/{path:path}")
async def get_file(
    request: Request,
    path: str,
    auth: Optional[str] = Query(None, description="Auth token for img src tags"),
    range: Optional[str] = Header(None, alias="Range")
):
    """
    Serve a file from cloud storage.
    
    Supports:
    - Cookie-based auth (normal API calls)
    - Query param auth (?auth=token) for <img src="..."> tags
    - Range requests for video streaming
    
    Args:
        path: The storage path of the file
        auth: Optional auth token for img src tags
        range: Optional Range header for video streaming
    """
    try:
        # Check if cloud storage is enabled
        if not cloud_storage_service.is_enabled():
            raise HTTPException(status_code=503, detail="Cloud storage not configured")
        
        # For public files (like logos), allow unauthenticated access
        # For private files, require authentication
        is_public = path.startswith("gradnext/logos/") or path.startswith("gradnext/public/")
        
        if not is_public:
            # Try to authenticate
            try:
                user = await get_current_user(request)  # noqa: F841
            except Exception:
                # If cookie auth fails and no query auth, deny access
                if not auth:
                    raise HTTPException(status_code=401, detail="Authentication required")

        # ── Video path: cache on local disk on first hit, slice Range from disk ──
        ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        is_video_path = ext in {"mp4", "webm", "mov", "avi", "mkv", "m4v", "mpeg", "mpg", "flv"}
        if is_video_path:
            try:
                local_path, content_type = await asyncio.to_thread(_ensure_video_cached, path)
            except Exception as e:
                logger.error(f"[video-cache] failed to fetch {path}: {e}")
                raise HTTPException(status_code=404, detail="Video not found")

            file_size = os.path.getsize(local_path)
            if range:
                # Parse "bytes=START-END" (END optional)
                try:
                    range_match = range.replace("bytes=", "").split("-")
                    start = int(range_match[0]) if range_match[0] else 0
                    end = int(range_match[1]) if range_match[1] else file_size - 1
                    start = max(0, min(start, file_size - 1))
                    end = max(start, min(end, file_size - 1))
                except Exception:
                    start, end = 0, file_size - 1
                chunk_size = end - start + 1
                return StreamingResponse(
                    _open_range_iter(local_path, start, end),
                    status_code=206,
                    media_type=content_type,
                    headers={
                        "Content-Range": f"bytes {start}-{end}/{file_size}",
                        "Accept-Ranges": "bytes",
                        "Content-Length": str(chunk_size),
                        "Cache-Control": "private, max-age=3600",
                        "Content-Disposition": "inline",
                        "X-Cache": "DISK",
                    },
                )
            # No Range header — return full file streamed from disk
            return StreamingResponse(
                _open_range_iter(local_path, 0, file_size - 1, chunk_size=1024 * 1024),
                media_type=content_type,
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(file_size),
                    "Cache-Control": "private, max-age=3600",
                    "Content-Disposition": "inline",
                    "X-Cache": "DISK",
                },
            )

        # ── Buffered path for images / small static files (cached in-process) ──
        cached = _cache_get(path)
        if cached is not None:
            data, content_type = cached
            cache_hit = True
        else:
            cache_hit = False
            try:
                data, content_type = await asyncio.to_thread(
                    cloud_storage_service.download_file, path
                )
            except Exception as e:
                logger.error(f"Failed to download file {path}: {e}")
                raise HTTPException(status_code=404, detail="File not found")
            _cache_put(path, data, content_type)

        file_size = len(data)
        is_image = (content_type or "").startswith("image/")

        if is_image:
            cache_control = "public, max-age=31536000, immutable"
        elif is_public:
            cache_control = "public, max-age=31536000"
        else:
            cache_control = "private, max-age=3600"

        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": cache_control,
                "Content-Disposition": "inline",
                "X-Cache": "HIT" if cache_hit else "MISS",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving file {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve file")


@router.get("/download/{path:path}")
async def download_file_attachment(
    request: Request,
    path: str,
    filename: Optional[str] = Query(None, description="Filename for download")
):
    """
    Download a file as an attachment (forces download instead of inline display)
    """
    try:
        user = await get_current_user(request)
        
        if not cloud_storage_service.is_enabled():
            raise HTTPException(status_code=503, detail="Cloud storage not configured")
        
        try:
            data, content_type = await asyncio.to_thread(
                cloud_storage_service.download_file, path
            )
        except Exception as e:
            logger.error(f"Failed to download file {path}: {e}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Use provided filename or extract from path
        if not filename:
            filename = path.split("/")[-1]
        
        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download file")
