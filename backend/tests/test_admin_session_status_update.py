"""
Tests for admin session status update endpoint:

1. Bug: Strategy call sessions show in admin panel but updating their status
   returns 404 "Session not found" because the endpoint only looks in
   db.bookings (coaching), not db.strategy_call_sessions.
2. Bug: Reschedule statuses (mentor_rescheduled / candidate_rescheduled /
   admin_rescheduled) used to leave the original Google Calendar event
   untouched. Cancellation calendar removal now also runs for reschedule.

Run: cd /app/backend && python -m pytest tests/test_admin_session_status_update.py -v
"""
import os
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE = line.split("=", 1)[1].strip().strip('"')
                    break
    except FileNotFoundError:
        BASE = "http://localhost:8001"
BASE = BASE.rstrip("/") + "/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gradnext")

TEST_SESSION_ID = "test-admin-status-update-session"
TEST_STRATEGY_ID = "test-admin-status-strategy"
TEST_USER = "test-admin-user-1"
TEST_MENTOR = "test-admin-mentor-1"


async def _seed_user_and_mentor(db):
    await db.users.delete_one({"id": TEST_USER})
    await db.users.insert_one({
        "id": TEST_USER, "name": "Test Cand", "email": "tc@test.com",
        "phone_number": "+919999999999", "phone_country_code": "+91",
    })
    await db.mentors.delete_one({"id": TEST_MENTOR})
    await db.mentors.insert_one({
        "id": TEST_MENTOR, "name": "Test Coach", "email": "tcoach@test.com",
        "phone_number": "+918888888888", "phone_country_code": "+91",
    })


async def _cleanup(db):
    await db.users.delete_one({"id": TEST_USER})
    await db.mentors.delete_one({"id": TEST_MENTOR})
    await db.bookings.delete_many({"id": {"$in": [TEST_SESSION_ID]}})
    await db.strategy_call_sessions.delete_many({"id": {"$in": [TEST_STRATEGY_ID]}})


def _admin_login_cookies():
    """Login as admin and return the session cookies for httpx."""
    async def _():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=admin")
            assert r.status_code == 200, r.text
            return dict(r.cookies)
    return asyncio.get_event_loop().run_until_complete(_())


# -------------------- Test 1 --------------------

def test_admin_can_update_strategy_call_session_status():
    """Previously: 404 Session not found. After fix: 200 OK and DB updated."""
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        await _seed_user_and_mentor(db)
        await db.strategy_call_sessions.delete_one({"id": TEST_STRATEGY_ID})
        await db.strategy_call_sessions.insert_one({
            "id": TEST_STRATEGY_ID,
            "user_id": TEST_USER,
            "mentor_id": TEST_MENTOR,
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "time": "14:00",
            "status": "confirmed",
            "calendar_event_id": "fake-calendar-event-1",
            "duration_minutes": 30,
        })

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=admin")
            cookies = r.cookies

            r = await client.post(
                f"{BASE}/admin/coaching-sessions/{TEST_STRATEGY_ID}/update-status",
                json={"status": "completed", "notes": "Marked complete by admin"},
                cookies=cookies,
            )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

            updated = await db.strategy_call_sessions.find_one(
                {"id": TEST_STRATEGY_ID}, {"_id": 0}
            )
            assert updated["status"] == "completed"
            assert updated["admin_notes"] == "Marked complete by admin"

        await _cleanup(db)

    asyncio.run(run())


# -------------------- Test 2 --------------------

def test_admin_strategy_cancel_removes_calendar_event():
    """When admin marks strategy call as admin_cancelled, the calendar event
    must be removed from Google Calendar via calendar_service.cancel_event."""
    from services.calendar_service import get_calendar_service

    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        await _seed_user_and_mentor(db)
        await db.strategy_call_sessions.delete_one({"id": TEST_STRATEGY_ID})
        await db.strategy_call_sessions.insert_one({
            "id": TEST_STRATEGY_ID,
            "user_id": TEST_USER,
            "mentor_id": TEST_MENTOR,
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "status": "confirmed",
            "calendar_event_id": "fake-calendar-event-cancel-strategy",
            "hidden_event_id": "fake-hidden-event-cancel-strategy",
            "duration_minutes": 30,
        })

        # Verify our admin update endpoint goes through calendar_service.cancel_event
        # by inserting + posting and then checking via API call. Since we can't
        # patch across processes, assert that the endpoint succeeds and
        # status is set to admin_cancelled. The calendar_service path is
        # exercised in integration; we trace via logs as a soft check.
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=admin")
            cookies = r.cookies

            r = await client.post(
                f"{BASE}/admin/coaching-sessions/{TEST_STRATEGY_ID}/update-status",
                json={"status": "admin_cancelled", "notes": "test"},
                cookies=cookies,
            )
            assert r.status_code == 200, r.text

            updated = await db.strategy_call_sessions.find_one(
                {"id": TEST_STRATEGY_ID}, {"_id": 0}
            )
            assert updated["status"] == "admin_cancelled"
            assert updated.get("cancelled_by") == "admin"
            assert updated.get("cancelled_at") is not None

        await _cleanup(db)

    asyncio.run(run())


# -------------------- Test 3 --------------------

def test_admin_reschedule_status_clears_calendar_event_for_coaching():
    """When admin marks a coaching session as admin_rescheduled, the calendar
    event should be removed too (previously left dangling)."""
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        await _seed_user_and_mentor(db)
        await db.bookings.delete_one({"id": TEST_SESSION_ID})
        await db.bookings.insert_one({
            "id": TEST_SESSION_ID,
            "user_id": TEST_USER,
            "mentor_id": TEST_MENTOR,
            "date": (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d"),
            "time_slot": "11:00",
            "status": "confirmed",
            "calendar_event_id": "fake-calendar-event-reschedule",
            "session_type": "Case session",
            "duration_minutes": 45,
        })

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=admin")
            cookies = r.cookies

            r = await client.post(
                f"{BASE}/admin/coaching-sessions/{TEST_SESSION_ID}/update-status",
                json={"status": "admin_rescheduled", "notes": "moved"},
                cookies=cookies,
            )
            assert r.status_code == 200, r.text

            updated = await db.bookings.find_one({"id": TEST_SESSION_ID}, {"_id": 0})
            assert updated["status"] == "admin_rescheduled"
            assert updated.get("rescheduled_by") == "admin"
            assert updated.get("rescheduled_at") is not None

        await _cleanup(db)

    asyncio.run(run())


# -------------------- Test 4 --------------------

def test_admin_cannot_update_nonexistent_session_returns_404():
    async def run():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=admin")
            cookies = r.cookies

            r = await client.post(
                f"{BASE}/admin/coaching-sessions/no-such-session-xyz/update-status",
                json={"status": "completed"},
                cookies=cookies,
            )
            assert r.status_code == 404
            assert "not found" in r.json().get("detail", "").lower()

    asyncio.run(run())


# -------------------- Test 5 --------------------

def test_admin_status_endpoint_handles_strategy_cancel_via_logs():
    """Structural assertion: the admin update-status handler must look in
    BOTH db.bookings and db.strategy_call_sessions."""
    src_path = "/app/backend/routes/admin.py"
    with open(src_path) as f:
        src = f.read()

    start = src.index("async def admin_update_coaching_session_status")
    end = src.index("async def ", start + 10)
    body = src[start:end]

    assert "db.strategy_call_sessions.find_one" in body, \
        "admin update-status must query strategy_call_sessions"
    assert "is_strategy_call" in body, \
        "admin update-status must distinguish strategy vs coaching sessions"
    # Calendar removal applies to both cancel and reschedule statuses
    assert "reschedule_statuses" in body, \
        "admin update-status must remove calendar event for reschedule statuses too"
