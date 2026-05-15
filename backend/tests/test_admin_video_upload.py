"""
Regression tests for admin video upload endpoints.

Covers:
 - POST /api/admin/upload (direct small-file upload)
 - POST /api/admin/upload/init
 - POST /api/admin/upload/chunk
 - POST /api/admin/upload/finalize
 - POST /api/admin/workshops (create with uploaded video_url)
 - PUT  /api/admin/workshops/{id} (update with uploaded video_url)
 - GET  /api/files/{path} (file serving incl. Range streaming)

Goal: ensure NO 500 errors occur. All validation failures must return 4xx.
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://consultant-gateway.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def admin_session():
    """Admin session cookie via mock-login."""
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=30)
    assert r.status_code == 200, f"mock-login failed: {r.status_code} {r.text}"
    assert r.json().get("is_admin") is True
    return s


@pytest.fixture(scope="module")
def small_mp4_bytes():
    """~2MB pseudo-mp4 with a minimal ftyp header so content sniffers do not explode."""
    header = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    body = os.urandom(2 * 1024 * 1024 - len(header))
    return header + body


@pytest.fixture(scope="module")
def large_mp4_bytes():
    """~10MB pseudo-mp4 -> 1 chunk @ 10MB chunk size, but we'll force smaller chunks to exercise multi-chunk path."""
    header = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    body = os.urandom(10 * 1024 * 1024 - len(header))
    return header + body


@pytest.fixture(scope="module")
def created_workshops():
    """Track workshop ids created during tests for cleanup."""
    ids = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session, created_workshops):
    yield
    for wid in created_workshops:
        try:
            admin_session.delete(f"{API}/admin/workshops/{wid}", timeout=15)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _assert_no_500(resp, ctx=""):
    assert resp.status_code < 500, f"[{ctx}] Unexpected 5xx: {resp.status_code} {resp.text[:400]}"


# ---------------------------------------------------------------------------
# Tests – direct small upload
# ---------------------------------------------------------------------------


class TestDirectUpload:
    def test_small_mp4_upload_returns_cloud_url(self, admin_session, small_mp4_bytes):
        files = {"file": ("TEST_small.mp4", small_mp4_bytes, "video/mp4")}
        data = {"category": "recordings", "use_cloud": "true"}
        r = admin_session.post(f"{API}/admin/upload", files=files, data=data, timeout=120)
        _assert_no_500(r, "direct upload")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("cloud_stored") is True, f"Expected cloud_stored=True, got: {j}"
        assert j.get("is_video") is True
        assert j.get("url", "").startswith("/api/files/"), f"Bad url: {j.get('url')}"
        assert j.get("size") == len(small_mp4_bytes)
        # store for re-use
        pytest.small_upload_url = j["url"]
        pytest.small_upload_storage_path = j["storage_path"]

    def test_unauthorized_upload_rejected(self, small_mp4_bytes):
        files = {"file": ("TEST_small.mp4", small_mp4_bytes, "video/mp4")}
        data = {"category": "recordings"}
        r = requests.post(f"{API}/admin/upload", files=files, data=data, timeout=60)
        _assert_no_500(r, "unauth upload")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"


# ---------------------------------------------------------------------------
# Tests – chunked upload flow
# ---------------------------------------------------------------------------


class TestChunkedUpload:
    CHUNK_SIZE = 3 * 1024 * 1024  # 3MB chunks -> ~4 chunks for 10MB (multi-chunk path)

    def test_full_chunked_flow_async_finalize_with_polling(self, admin_session, large_mp4_bytes):
        """End-to-end test of the new async finalize + status polling flow.

        Steps: init -> chunks -> finalize (returns IMMEDIATELY) -> poll status
        until state==done. Verifies finalize response time is <5s regardless
        of file size (Cloudflare 100s 520 fix).
        """
        import time

        filename = "TEST_chunked_async.mp4"
        upload_id = f"test-upload-{uuid.uuid4().hex[:12]}"
        total = (len(large_mp4_bytes) + self.CHUNK_SIZE - 1) // self.CHUNK_SIZE

        # init
        init = admin_session.post(
            f"{API}/admin/upload/init",
            json={
                "filename": filename,
                "filesize": len(large_mp4_bytes),
                "filetype": "video/mp4",
                "total_chunks": total,
                "upload_id": upload_id,
                "category": "recordings",
            },
            timeout=30,
        )
        _assert_no_500(init, "init")
        assert init.status_code == 200, init.text

        # upload chunks
        for i in range(total):
            start = i * self.CHUNK_SIZE
            end = min(start + self.CHUNK_SIZE, len(large_mp4_bytes))
            chunk_bytes = large_mp4_bytes[start:end]
            files = {"chunk": (f"chunk_{i}", chunk_bytes, "application/octet-stream")}
            data = {"upload_id": upload_id, "chunk_index": str(i), "total_chunks": str(total)}
            rc = admin_session.post(f"{API}/admin/upload/chunk", files=files, data=data, timeout=120)
            _assert_no_500(rc, f"chunk {i}")
            assert rc.status_code == 200, rc.text
            cj = rc.json()
            assert cj["received"] == i + 1
            assert cj["chunk_index"] == i

        # finalize -- new async behaviour: must return < 5s with state=processing
        t0 = time.time()
        fin = admin_session.post(
            f"{API}/admin/upload/finalize",
            json={
                "upload_id": upload_id,
                "filename": filename,
                "total_chunks": total,
                "category": "recordings",
            },
            timeout=15,
        )
        elapsed = time.time() - t0
        _assert_no_500(fin, "finalize")
        assert fin.status_code == 200, fin.text
        assert elapsed < 5.0, f"Finalize took {elapsed:.2f}s — must be <5s to dodge Cloudflare 100s timeout"
        fj = fin.json()
        assert fj.get("success") is True, fj
        assert fj.get("status") == "processing", f"Expected status=processing, got: {fj}"
        assert fj.get("upload_id") == upload_id
        assert "message" in fj
        # The synchronous response should NOT contain final url/cloud_stored anymore
        assert fj.get("url") is None or fj.get("url") == "", f"finalize must not return url synchronously: {fj}"

        # Poll status until done (or timeout). Cloud upload of ~60MB should complete
        # within ~60s under normal conditions.
        deadline = time.time() + 180  # 3 min ceiling
        final_status = None
        attempts = 0
        while time.time() < deadline:
            attempts += 1
            sr = admin_session.get(f"{API}/admin/upload/status/{upload_id}", timeout=15)
            _assert_no_500(sr, "status poll")
            assert sr.status_code == 200, f"status poll failed: {sr.status_code} {sr.text[:200]}"
            sj = sr.json()
            state = sj.get("state")
            if state == "done":
                final_status = sj
                break
            if state == "failed":
                pytest.fail(f"Upload finalization failed: {sj}")
            assert state == "processing", f"Unknown state: {sj}"
            assert "phase" in sj, f"processing status must include phase: {sj}"
            time.sleep(2.0)

        assert final_status is not None, f"Status never reached 'done' after {attempts} polls"
        assert final_status.get("success") is True
        # cloud_stored should be True normally; accept False (local fallback) only if cloud SSL flake.
        assert final_status.get("is_video") is True
        url = final_status.get("url", "")
        assert url.startswith("/api/files/") or url.startswith("/api/uploads/"), final_status
        # When cloud-stored, size is reported in result; when local-fallback, final_size matches input.
        assert final_status.get("size") == len(large_mp4_bytes)
        assert final_status.get("filename") == filename

        pytest.chunked_upload_url = final_status["url"]
        pytest.chunked_storage_path = final_status.get("storage_path") or final_status["url"].replace("/api/files/", "")

        # Verify upload_sessions/chunks cleanup via MongoDB (background task should clean up)
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if mongo_url and db_name:
            client = MongoClient(mongo_url)
            db = client[db_name]
            sess = db.upload_sessions.find_one({"upload_id": upload_id})
            chunks = db.upload_chunks.count_documents({"upload_id": upload_id})
            assert sess is None, f"upload_sessions not cleaned: {sess}"
            assert chunks == 0, f"upload_chunks not cleaned: {chunks} remaining"
            client.close()

    def test_status_endpoint_unknown_upload_id_returns_404(self, admin_session):
        r = admin_session.get(f"{API}/admin/upload/status/no-such-upload-{uuid.uuid4().hex[:8]}", timeout=15)
        _assert_no_500(r, "status unknown id")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"

    def test_status_endpoint_unauthorized(self):
        r = requests.get(f"{API}/admin/upload/status/anything", timeout=15)
        _assert_no_500(r, "status unauth")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_finalize_missing_chunks_returns_400(self, admin_session):
        """Init 3 chunks, upload none -> finalize must 400, not 500."""
        upload_id = f"test-missing-{uuid.uuid4().hex[:8]}"
        init = admin_session.post(
            f"{API}/admin/upload/init",
            json={
                "filename": "TEST_missing.mp4",
                "filesize": 1000,
                "filetype": "video/mp4",
                "total_chunks": 3,
                "upload_id": upload_id,
                "category": "recordings",
            },
            timeout=30,
        )
        assert init.status_code == 200

        fin = admin_session.post(
            f"{API}/admin/upload/finalize",
            json={
                "upload_id": upload_id,
                "filename": "TEST_missing.mp4",
                "total_chunks": 3,
                "category": "recordings",
            },
            timeout=30,
        )
        _assert_no_500(fin, "finalize missing chunks")
        assert fin.status_code == 400, f"Expected 400, got {fin.status_code}: {fin.text[:200]}"

        # Cleanup the dangling session
        try:
            from pymongo import MongoClient
            client = MongoClient(os.environ.get("MONGO_URL"))
            client[os.environ.get("DB_NAME")].upload_sessions.delete_one({"upload_id": upload_id})
            client.close()
        except Exception:
            pass

    def test_chunk_recovers_missing_session(self, admin_session):
        """A chunk arriving for a session that was lost (e.g. transient DB
        deletion) is auto-recovered instead of failing 400. This protects
        against spurious 500-style upload failures on the user side when the
        upload session record disappeared between init and chunk."""
        upload_id = f"recover-{int(__import__('time').time())}"
        files = {"chunk": ("c0", b"hello", "application/octet-stream")}
        data = {"upload_id": upload_id, "chunk_index": "0", "total_chunks": "1"}
        r = admin_session.post(f"{API}/admin/upload/chunk", files=files, data=data, timeout=30)
        _assert_no_500(r, "missing upload_id auto-recover")
        assert r.status_code == 200, f"Expected 200 (recovered), got {r.status_code}: {r.text[:200]}"
        # Cleanup
        try:
            from pymongo import MongoClient
            client = MongoClient(os.environ.get("MONGO_URL"))
            db = client[os.environ.get("DB_NAME")]
            db.upload_sessions.delete_one({"upload_id": upload_id})
            db.upload_chunks.delete_many({"upload_id": upload_id})
            client.close()
        except Exception:
            pass

    def test_finalize_invalid_upload_id_returns_400(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/upload/finalize",
            json={"upload_id": "nope-xyz", "filename": "x.mp4", "total_chunks": 1, "category": "recordings"},
            timeout=30,
        )
        _assert_no_500(r, "finalize invalid upload_id")
        assert r.status_code == 400

    def test_chunk_endpoint_unauthorized(self):
        files = {"chunk": ("c0", b"hello", "application/octet-stream")}
        data = {"upload_id": "x", "chunk_index": "0", "total_chunks": "1"}
        r = requests.post(f"{API}/admin/upload/chunk", files=files, data=data, timeout=30)
        _assert_no_500(r, "chunk unauth")
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Tests – workshop create/update with uploaded video_url
# ---------------------------------------------------------------------------


class TestWorkshopWithUploadedVideo:
    def test_create_workshop_with_uploaded_video(self, admin_session, created_workshops):
        video_url = getattr(pytest, "small_upload_url", None) or getattr(pytest, "chunked_upload_url", None)
        assert video_url, "Expected an uploaded video URL from previous tests"

        payload = {
            "title": "TEST_Workshop_Upload",
            "description": "Regression test workshop",
            "instructor": "Test Instructor",
            "instructor_title": "QA Lead",
            "date": "2026-01-30",
            "time": "10:00 AM",
            "duration": "60 min",
            "topics": ["testing"],
            "video_url": video_url,
            "status": "completed",
            "is_past": True,
            "is_free": True,
            "max_participants": 50,
        }
        r = admin_session.post(f"{API}/admin/workshops", json=payload, timeout=30)
        _assert_no_500(r, "workshop create")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "workshop_id" in j
        created_workshops.append(j["workshop_id"])
        pytest.workshop_id = j["workshop_id"]

    def test_update_workshop_with_uploaded_video(self, admin_session):
        wid = getattr(pytest, "workshop_id", None)
        assert wid, "workshop_id not set from previous test"
        new_url = getattr(pytest, "chunked_upload_url", None) or getattr(pytest, "small_upload_url")
        r = admin_session.put(
            f"{API}/admin/workshops/{wid}",
            json={"video_url": new_url, "status": "completed"},
            timeout=30,
        )
        _assert_no_500(r, "workshop update")
        assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# Tests – file serving
# ---------------------------------------------------------------------------


class TestFileServing:
    def test_get_file_full(self, admin_session):
        path = getattr(pytest, "small_upload_storage_path", None)
        assert path, "Need uploaded storage path"
        r = admin_session.get(f"{API}/files/{path}", timeout=60)
        _assert_no_500(r, "file GET")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("video/")
        assert len(r.content) > 0

    def test_get_file_with_range(self, admin_session):
        path = getattr(pytest, "chunked_storage_path", None) or getattr(pytest, "small_upload_storage_path", None)
        assert path
        headers = {"Range": "bytes=0-1023"}
        r = admin_session.get(f"{API}/files/{path}", headers=headers, timeout=60)
        _assert_no_500(r, "file GET range")
        assert r.status_code == 206, f"Expected 206, got {r.status_code}"
        assert r.headers.get("content-range", "").startswith("bytes 0-1023/")
        assert len(r.content) == 1024

    def test_get_file_unauthenticated_returns_401(self):
        path = getattr(pytest, "small_upload_storage_path", None)
        assert path
        r = requests.get(f"{API}/files/{path}", timeout=30)
        _assert_no_500(r, "file GET unauth")
        assert r.status_code in (401, 403)
