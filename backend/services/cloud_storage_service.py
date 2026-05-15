"""
Cloud Storage Service
Uses Emergent Object Storage for file uploads (images, videos, documents)
Replaces local file storage with cloud storage
"""

import os
import uuid
import logging
import requests
from typing import Optional, Tuple, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Storage configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "gradnext"  # Prefix all paths to avoid bucket collisions

# Module-level storage key - set once and reused globally
storage_key: Optional[str] = None

# MIME type mapping
MIME_TYPES = {
    # Images
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    
    # Documents
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    
    # Text
    "txt": "text/plain",
    "csv": "text/csv",
    "json": "application/json",
    "xml": "application/xml",
    "md": "text/markdown",
    
    # Video
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mov": "video/quicktime",
    "avi": "video/x-msvideo",
    "mkv": "video/x-matroska",
    
    # Audio
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    
    # Archives
    "zip": "application/zip",
    "rar": "application/x-rar-compressed",
}


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename extension"""
    ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    return MIME_TYPES.get(ext, "application/octet-stream")


def is_enabled() -> bool:
    """Check if cloud storage is configured"""
    return bool(EMERGENT_KEY)


def init_storage() -> Optional[str]:
    """
    Initialize storage and get a reusable storage key.
    Call ONCE at startup. Returns a session-scoped, reusable storage_key.
    """
    global storage_key
    
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set. Cloud storage disabled.")
        return None
    
    if storage_key:
        return storage_key
    
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30
        )
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Cloud storage initialized successfully")
        return storage_key
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to initialize cloud storage: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    """
    Upload file to cloud storage.
    
    Args:
        path: Storage path (without leading slash)
        data: File content as bytes
        content_type: MIME type of the file
    
    Returns:
        dict with {"path": "...", "size": 123, "etag": "..."}
    
    Raises:
        Exception if upload fails
    """
    key = init_storage()
    if not key:
        raise Exception("Cloud storage not initialized")
    
    # Scale timeout with size: minimum 120s, plus ~5s per MB. A 1GB upload on
    # a 50Mbps link takes ~3 minutes – we give it up to ~85 minutes before
    # we give up.
    size_mb = max(1, len(data) // (1024 * 1024))
    timeout = max(120, size_mb * 5)
    
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={
                "X-Storage-Key": key,
                "Content-Type": content_type
            },
            data=data,
            timeout=timeout
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info(f"Uploaded file to cloud storage: {path} ({result.get('size', 0)} bytes)")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to upload file to cloud storage: {e}")
        raise Exception(f"Upload failed: {str(e)}")


def put_object_stream(path: str, file_path: str, content_type: str) -> Dict[str, Any]:
    """
    Stream-upload a file from disk to cloud storage. Avoids holding the full
    file in memory — required for large videos (>500MB) where the in-memory
    `put_object` would OOM the backend pod.
    
    Args:
        path: Storage path (without leading slash)
        file_path: Absolute path to the file on local disk
        content_type: MIME type of the file
    
    Returns:
        dict with {"path": "...", "size": 123, "etag": "..."}
    """
    key = init_storage()
    if not key:
        raise Exception("Cloud storage not initialized")
    
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    size_mb = max(1, file_size // (1024 * 1024))
    timeout = max(120, size_mb * 5)
    
    try:
        with open(file_path, "rb") as fh:
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={
                    "X-Storage-Key": key,
                    "Content-Type": content_type,
                    "Content-Length": str(file_size),
                },
                data=fh,  # requests will stream the file handle
                timeout=timeout,
            )
        resp.raise_for_status()
        result = resp.json()
        logger.info(f"Streamed file to cloud storage: {path} ({result.get('size', 0)} bytes)")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to stream-upload file to cloud storage: {e}")
        raise Exception(f"Upload failed: {str(e)}")


def get_object(path: str) -> Tuple[bytes, str]:
    """
    Download file from cloud storage.
    
    Args:
        path: Storage path
    
    Returns:
        Tuple of (content_bytes, content_type)
    
    Raises:
        Exception if download fails
    """
    key = init_storage()
    if not key:
        raise Exception("Cloud storage not initialized")
    
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60
        )
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        return resp.content, content_type
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download file from cloud storage: {e}")
        raise Exception(f"Download failed: {str(e)}")


def stream_object_range(
    path: str,
    range_header: Optional[str] = None,
):
    """Open a streaming GET against the storage backend, optionally forwarding
    a Range header. Returns a tuple of (response_object, content_type,
    content_length, accept_ranges, content_range_header, status_code).

    Caller is responsible for iterating `response.iter_content(...)` and
    closing the response when finished. Use this for video/large-file
    streaming to avoid pulling the full payload into backend RAM on every
    Range scrub.
    """
    key = init_storage()
    if not key:
        raise Exception("Cloud storage not initialized")

    headers = {"X-Storage-Key": key}
    if range_header:
        headers["Range"] = range_header

    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers=headers,
            stream=True,
            timeout=(15, 600),  # 15s connect, 10m read for big videos
        )
        resp.raise_for_status()
        return {
            "response": resp,
            "content_type": resp.headers.get("Content-Type", "application/octet-stream"),
            "content_length": resp.headers.get("Content-Length"),
            "accept_ranges": resp.headers.get("Accept-Ranges", "bytes"),
            "content_range": resp.headers.get("Content-Range"),
            "status_code": resp.status_code,  # 200 (full) or 206 (partial)
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to stream file from cloud storage: {e}")
        raise Exception(f"Stream failed: {str(e)}")


def upload_file(
    data: bytes,
    filename: str,
    folder: str = "uploads",
    user_id: Optional[str] = None,
    content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    High-level function to upload a file to cloud storage.
    
    Args:
        data: File content as bytes
        filename: Original filename
        folder: Subfolder (e.g., 'profile_pictures', 'materials', 'logos')
        user_id: Optional user ID for organizing files
        content_type: Optional MIME type (auto-detected if not provided)
    
    Returns:
        dict with storage info including the path to use for retrieval
    """
    # Generate unique filename
    ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    
    # Build path
    if user_id:
        path = f"{APP_NAME}/{folder}/{user_id}/{unique_filename}"
    else:
        path = f"{APP_NAME}/{folder}/{unique_filename}"
    
    # Determine content type
    if not content_type:
        content_type = get_mime_type(filename)
    
    # Upload
    result = put_object(path, data, content_type)
    
    return {
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "etag": result.get("etag"),
    }


def download_file(path: str) -> Tuple[bytes, str]:
    """
    Download a file from cloud storage.
    
    Args:
        path: The storage path returned from upload
    
    Returns:
        Tuple of (file_bytes, content_type)
    """
    return get_object(path)


def stream_file(path: str, range_header: Optional[str] = None):
    """Public wrapper around stream_object_range — see that fn for return shape."""
    return stream_object_range(path, range_header=range_header)


def upload_file_stream(
    file_path: str,
    filename: str,
    folder: str = "uploads",
    user_id: Optional[str] = None,
    content_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Stream-upload a file from local disk. Use this for large files (>100MB)
    instead of `upload_file(data=...)` to avoid loading the whole file into
    RAM in the backend pod.
    """
    ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{ext}"

    if user_id:
        path = f"{APP_NAME}/{folder}/{user_id}/{unique_filename}"
    else:
        path = f"{APP_NAME}/{folder}/{unique_filename}"

    if not content_type:
        content_type = get_mime_type(filename)

    result = put_object_stream(path, file_path, content_type)

    return {
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": content_type,
        "size": result.get("size", os.path.getsize(file_path) if os.path.exists(file_path) else 0),
        "etag": result.get("etag"),
    }


# Convenience functions for specific use cases

def upload_profile_picture(data: bytes, filename: str, user_id: str) -> Dict[str, Any]:
    """Upload a profile picture"""
    return upload_file(data, filename, folder="profile_pictures", user_id=user_id)


def upload_logo(data: bytes, filename: str) -> Dict[str, Any]:
    """Upload a company logo"""
    return upload_file(data, filename, folder="logos")


def upload_material(data: bytes, filename: str) -> Dict[str, Any]:
    """Upload a learning material (PDF, document, etc.)"""
    return upload_file(data, filename, folder="materials")


def upload_video(data: bytes, filename: str) -> Dict[str, Any]:
    """Upload a video file"""
    return upload_file(data, filename, folder="videos")


def upload_cv(data: bytes, filename: str, user_id: str) -> Dict[str, Any]:
    """Upload a CV/resume"""
    return upload_file(data, filename, folder="cvs", user_id=user_id)


def upload_support_attachment(data: bytes, filename: str, user_id: str) -> Dict[str, Any]:
    """Upload a support ticket attachment"""
    return upload_file(data, filename, folder="support_attachments", user_id=user_id)


def upload_cohort_resource(data: bytes, filename: str, cohort_id: str) -> Dict[str, Any]:
    """Upload a cohort resource"""
    return upload_file(data, filename, folder=f"cohort_resources/{cohort_id}")


# URL generation for frontend

def get_file_url(storage_path: str, base_url: str = "/api/files") -> str:
    """
    Generate a URL for accessing a file through the backend API.
    
    Args:
        storage_path: The storage path from upload
        base_url: The base URL for the files endpoint
    
    Returns:
        URL string for accessing the file
    """
    # URL encode the path
    from urllib.parse import quote
    encoded_path = quote(storage_path, safe='/')
    return f"{base_url}/{encoded_path}"
