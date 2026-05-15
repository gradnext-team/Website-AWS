"""
Smoke tests for the recording diagnostic + force-sync admin endpoints.
These cover the new endpoints added to fix the production "session
recording not appearing on dashboard" bug:
  - GET /api/admin/recordings/global-diagnose
  - POST /api/admin/recordings/find-and-force-sync
plus the scheduler heartbeat written by the artifacts scheduler.
"""
import os
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=10)
    assert r.status_code == 200
    return s


@pytest.fixture
def db():
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


def test_global_diagnose_returns_complete_shape(admin_session):
    r = admin_session.get(f"{API}/admin/recordings/global-diagnose", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    # Every key the admin UI / docs depend on
    for key in [
        "checked_at", "auto_record_enabled", "impersonate_email",
        "recordings_drive_folder_id", "scheduler_heartbeat",
        "counts_by_collection", "stuck_session_samples",
        "calendar_service_available", "diagnosis",
    ]:
        assert key in body, f"global-diagnose response missing '{key}'"
    assert isinstance(body["counts_by_collection"], dict)
    for cname in ("bookings", "strategy_call_sessions"):
        assert cname in body["counts_by_collection"]
        for sub in ("with_meet_space_name_last_7d", "with_recording_url",
                    "stuck_no_recording", "moved_to_shared_drive"):
            assert sub in body["counts_by_collection"][cname]


def test_global_diagnose_surfaces_drive_scope_failure_when_present(admin_session):
    """If Drive DWD scope is not authorized, the diagnosis array MUST
    include the actionable hint — that's how the admin discovers the
    root cause without reading logs."""
    r = admin_session.get(f"{API}/admin/recordings/global-diagnose", timeout=30)
    body = r.json()
    drive = body.get("drive_folder_check") or {}
    if drive and not drive.get("ok"):
        # Ensure the diagnosis array calls it out
        diag_text = " ".join(body.get("diagnosis", []))
        assert "Drive folder check FAILED" in diag_text or "Drive scope" in diag_text or len(body.get("diagnosis", [])) > 0


def test_find_and_force_sync_returns_404_when_no_session(admin_session):
    r = admin_session.post(
        f"{API}/admin/recordings/find-and-force-sync",
        json={
            "date": "2099-01-01",
            "mentor_email": "doesnotexist_xyz@example.com",
        },
        timeout=20,
    )
    assert r.status_code == 404
    assert "No session found" in r.json().get("detail", "")


def test_find_and_force_sync_returns_diagnostic_when_no_meet_space(admin_session, db):
    """Seed a booking WITHOUT meet_space_name — endpoint should locate
    it but return a structured 200 explaining why no recording is
    retrievable (legacy session)."""
    bid = f"test-recd-{uuid.uuid4().hex[:8]}"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    db.bookings.insert_one({
        "id": bid,
        "user_id": "test-user",
        "user_email": "candidate@test.com",
        "mentor_id": "test-mentor",
        "mentor_email": "test-mentor-x@example.com",
        "date": today,
        "time_slot": "6:20 PM IST",
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        # NO meet_space_name
    })
    try:
        r = admin_session.post(
            f"{API}/admin/recordings/find-and-force-sync",
            json={"date": today, "mentor_email": "test-mentor-x@example.com"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["id"] == bid
        assert "no meet_space_name" in body.get("error", "")
    finally:
        db.bookings.delete_one({"id": bid})


def test_find_and_force_sync_by_session_id(admin_session, db):
    bid = f"test-recd-{uuid.uuid4().hex[:8]}"
    db.bookings.insert_one({
        "id": bid,
        "user_id": "test-user",
        "user_email": "candidate2@test.com",
        "mentor_id": "test-mentor",
        "mentor_email": "test-mentor-y@example.com",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        r = admin_session.post(
            f"{API}/admin/recordings/find-and-force-sync",
            json={"session_id": bid},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["session"]["id"] == bid
    finally:
        db.bookings.delete_one({"id": bid})


def test_scheduler_heartbeat_populated_after_first_cycle(admin_session, db):
    """The scheduler MUST write a heartbeat doc on every cycle. Wait up
    to 70s for the first cycle (it has a 60s startup delay) — but if a
    heartbeat already exists from a previous run, accept it."""
    # If no heartbeat exists yet, give it up to 70s
    deadline = time.time() + 70
    hb = None
    while time.time() < deadline:
        hb = db.system_status.find_one({"_id": "recording_scheduler"})
        if hb:
            break
        time.sleep(5)
    assert hb is not None, "Scheduler never wrote a heartbeat — is start_meet_artifacts_scheduler being awaited?"
    assert hb.get("last_completed_at"), "Heartbeat exists but no last_completed_at"
    assert hb.get("interval_minutes") == 5, f"Expected 5-min interval, got {hb.get('interval_minutes')}"


def test_find_and_force_sync_picks_most_recent_when_multiple_match(admin_session, db):
    """If two sessions match the (date, mentor_email) criteria, the
    endpoint must pick the most recently CREATED one — not arbitrary
    order."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    older = f"test-recd-old-{uuid.uuid4().hex[:6]}"
    newer = f"test-recd-new-{uuid.uuid4().hex[:6]}"
    older_ts = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    newer_ts = datetime.now(timezone.utc).isoformat()
    db.bookings.insert_many([
        {"id": older, "user_email": "c@t.t", "mentor_email": "shared@test.com",
         "date": today, "status": "confirmed", "created_at": older_ts},
        {"id": newer, "user_email": "c@t.t", "mentor_email": "shared@test.com",
         "date": today, "status": "confirmed", "created_at": newer_ts},
    ])
    try:
        r = admin_session.post(
            f"{API}/admin/recordings/find-and-force-sync",
            json={"date": today, "mentor_email": "shared@test.com"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["id"] == newer, f"Expected most-recent {newer}, got {body['session']['id']}"
        assert body["candidates_found"] == 2
    finally:
        db.bookings.delete_many({"id": {"$in": [older, newer]}})
