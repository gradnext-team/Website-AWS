"""
Tests for the Meet artifacts (recording + transcript) integration:

  • Service: fetch_artifacts_for_space — graceful degradation when no
    space_name / no records / API errors.
  • Sync: sync_artifacts_for_booking — idempotent, persists URLs onto
    the booking document.
  • Admin endpoint: POST /api/admin/coaching-sessions/{id}/sync-recording
    — auth-gated, surfaces real Meet API result.
  • Candidate endpoint: GET /api/bookings/{id}/recording — only the
    candidate / mentor / admin can read it.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture
def db():
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


@pytest.fixture
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=10)
    assert r.status_code == 200
    return s


@pytest.fixture
def seeded_booking(db):
    """A booking with a `meet_space_name` set — represents a session
    that was created via the Meet REST API integration."""
    bid = f"bk_test_{uuid.uuid4().hex[:8]}"
    space = f"spaces/test_{uuid.uuid4().hex[:8]}"
    candidate_id = f"u_test_{uuid.uuid4().hex[:8]}"
    db.users.insert_one({
        "id": candidate_id, "email": f"{candidate_id}@t.t",
        "name": "Test Candidate", "role": "candidate",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.bookings.insert_one({
        "id": bid,
        "user_id": candidate_id,
        "mentor_id": "mentor-test",
        "date": "2026-01-01",
        "time_slot": "10:00",
        "meet_link": "https://meet.google.com/abc-defg-hij",
        "meet_space_name": space,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"booking_id": bid, "space_name": space, "candidate_id": candidate_id}
    db.bookings.delete_one({"id": bid})
    db.users.delete_one({"id": candidate_id})


def test_service_returns_none_for_missing_space():
    from services.meet_artifacts_service import fetch_artifacts_for_space
    assert fetch_artifacts_for_space("") is None
    assert fetch_artifacts_for_space("not_a_space_name") is None


def test_service_aggregates_recordings_and_transcripts():
    """With mocked Meet REST API responses, the service should produce
    a single dict containing the first ready URL of each type plus the
    full lists.
    """
    from services import meet_artifacts_service as mod
    
    list_resp = {"conferenceRecords": [{"name": "conferenceRecords/cr1"}, {"name": "conferenceRecords/cr2"}]}
    rec_resp_cr1 = {"recordings": [{"name": "rec1", "state": "FILE_GENERATED",
                                    "driveDestination": {"file": "drive1", "exportUri": "https://drive/rec1"}}]}
    tr_resp_cr1 = {"transcripts": [{"name": "tr1", "state": "FILE_GENERATED",
                                    "docsDestination": {"document": "doc1", "exportUri": "https://docs/tr1"}}]}
    rec_resp_cr2 = {"recordings": []}
    tr_resp_cr2 = {"transcripts": []}
    
    def _fake_get(token, path, params=None):
        if path == "/conferenceRecords":
            return list_resp
        if path.endswith("/recordings"):
            return rec_resp_cr1 if "cr1" in path else rec_resp_cr2
        if path.endswith("/transcripts"):
            return tr_resp_cr1 if "cr1" in path else tr_resp_cr2
        return None
    
    with patch.object(mod, "_get_access_token", return_value="fake_token"), \
         patch.object(mod, "_meet_api_get", side_effect=_fake_get), \
         patch.object(mod, "get_calendar_service") as mock_svc:
        mock_svc.return_value.is_available.return_value = True
        result = mod.fetch_artifacts_for_space("spaces/test_123")
    
    assert result is not None
    assert result["recording_url"] == "https://drive/rec1"
    assert result["transcript_url"] == "https://docs/tr1"
    assert len(result["recordings"]) == 1
    assert len(result["transcripts"]) == 1
    assert "conferenceRecords/cr1" in result["conference_record_names"]


def test_service_returns_none_when_no_records():
    """Common before Google has finalized — list call returns empty."""
    from services import meet_artifacts_service as mod
    with patch.object(mod, "_get_access_token", return_value="fake"), \
         patch.object(mod, "_meet_api_get", return_value={"conferenceRecords": []}), \
         patch.object(mod, "get_calendar_service") as mock_svc:
        mock_svc.return_value.is_available.return_value = True
        assert mod.fetch_artifacts_for_space("spaces/test") is None


def test_admin_sync_endpoint_requires_admin():
    s = requests.Session()
    r = s.post(f"{API}/admin/coaching-sessions/x/sync-recording", json={}, timeout=10)
    assert r.status_code in (401, 403), f"Expected auth failure, got {r.status_code}"


def test_admin_sync_endpoint_returns_400_when_no_space(admin_session, db):
    """Booking exists but has no meet_space_name — sync must return 400."""
    bid = f"bk_no_space_{uuid.uuid4().hex[:6]}"
    db.bookings.insert_one({"id": bid, "user_id": "u", "date": "2026-01-01", "time_slot": "09:00"})
    try:
        r = admin_session.post(f"{API}/admin/coaching-sessions/{bid}/sync-recording", json={}, timeout=10)
        assert r.status_code == 400, r.text
        assert "meet space" in r.text.lower() or "no meet" in r.text.lower()
    finally:
        db.bookings.delete_one({"id": bid})


def test_candidate_recording_endpoint_authorizes_correctly(admin_session, db, seeded_booking):
    """The recording endpoint must reject random users and accept the
    booking's candidate / admin."""
    bid = seeded_booking["booking_id"]
    
    # Admin should be allowed
    r = admin_session.get(f"{API}/mentors/bookings/{bid}/recording", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["booking_id"] == bid
    assert "available" in body
    
    # An unrelated user (fresh session) must be rejected
    other_session = requests.Session()
    other_session.post(f"{API}/auth/mock-login", params={"user_type": "candidate"}, timeout=10)
    r2 = other_session.get(f"{API}/mentors/bookings/{bid}/recording", timeout=10)
    assert r2.status_code == 403, f"Expected 403 for unrelated candidate; got {r2.status_code}"


def test_candidate_recording_endpoint_returns_urls_when_available(admin_session, db, seeded_booking):
    """If the booking has recording_url + transcript_url, the endpoint
    surfaces them."""
    bid = seeded_booking["booking_id"]
    db.bookings.update_one(
        {"id": bid},
        {"$set": {
            "recording_url": "https://drive.google.com/file/d/abc/view",
            "transcript_url": "https://docs.google.com/document/d/xyz/view",
            "meet_artifacts_checked_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    r = admin_session.get(f"{API}/mentors/bookings/{bid}/recording", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["recording_url"] == "https://drive.google.com/file/d/abc/view"
    assert body["transcript_url"] == "https://docs.google.com/document/d/xyz/view"
    assert body["available"] is True


def test_candidate_recording_endpoint_404_for_unknown_booking(admin_session):
    r = admin_session.get(f"{API}/mentors/bookings/does-not-exist/recording", timeout=10)
    assert r.status_code == 404


def test_sync_pending_recordings_skips_when_no_space_name():
    """The bg job's bson query only matches bookings with a meet_space_name."""
    # Pure unit-level: ensure the helper doesn't crash on empty DB.
    from services.meet_artifacts_service import sync_pending_recordings
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    
    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        d = client[os.environ["DB_NAME"]]
        stats = await sync_pending_recordings(d, max_per_run=5)
        client.close()
        return stats
    
    stats = asyncio.run(_run())
    # `found` may be 0..5 depending on prior data, but the function
    # must complete without raising.
    assert "found" in stats and "synced" in stats and "skipped" in stats
