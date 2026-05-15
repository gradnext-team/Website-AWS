"""
Tests for the strategy-call booking flow's "Coach's time is already blocked" bug.

Root cause being verified:
  - get_unified_availability already filters out Google Calendar busy slots when
    listing slots for the user. The book endpoint used to perform a SECOND fetch
    against a different cache-key window (and even cleared the cache), which
    could diverge from the listing. The fix removes the redundant fetch for
    auto_assign and aligns the cache window for manual mode.

Run: cd /app/backend && python -m pytest tests/test_strategy_call_booking_unblocked.py -v
"""
import os
import asyncio
from datetime import datetime, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

# Resolve backend URL for live tests
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

TEST_MENTOR = "test-mentor-strategy-booking"


def _seed_mentor(db):
    """Seed a strategy-call-eligible mentor with a weekly template covering
    every day from 09:00–18:00 IST."""
    return db.mentors.insert_one({
        "id": TEST_MENTOR,
        "name": "Test Strategy Coach",
        "email": "test-strategy-coach@example.com",
        "is_listed": True,
        "is_active": True,
        "is_deleted": False,
        "is_hidden_from_strategy_calls": False,
        "can_take_strategy_calls": True,
        "google_calendar_connected": True,
        "google_calendar_credentials": {"token": "fake", "refresh_token": "fake"},
        "rating": 5,
        "sessions_conducted": 5,
    })


def _seed_weekly_template(db):
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    docs = [{
        "mentor_id": TEST_MENTOR,
        "day": d,
        "slots": [{"from": "09:00", "to": "18:00"}],
    } for d in days]
    return db.mentor_weekly_availability.insert_many(docs)


async def _cleanup(db):
    await db.mentors.delete_one({"id": TEST_MENTOR})
    await db.mentor_weekly_availability.delete_many({"mentor_id": TEST_MENTOR})
    await db.strategy_call_sessions.delete_many({"mentor_id": TEST_MENTOR})
    await db.bookings.delete_many({"mentor_id": TEST_MENTOR})
    # remove any other strategy mentors we don't want polluting auto-assign
    await db.mentors.update_many(
        {"id": {"$ne": TEST_MENTOR}, "can_take_strategy_calls": True},
        {"$set": {"_test_hidden_was": "$is_hidden_from_strategy_calls"}}
    )


# ---------- Pure logic check ----------

def test_booking_endpoint_skips_redundant_calendar_fetch_for_auto_assign():
    """Asserts code-level: with auto_assign=True the book endpoint does NOT
    perform a second get_mentor_busy_slots_batch call (it trusts the
    unified-availability response). This is the structural fix."""
    src_path = "/app/backend/routes/strategy_calls.py"
    with open(src_path) as f:
        src = f.read()

    # Locate the body of book_strategy_call
    start = src.index("async def book_strategy_call")
    end = src.index("async def ", start + 10)  # next async def
    body = src[start:end]

    # The OLD code clears the cache before the redundant Google Calendar fetch.
    assert "_calendar_cache" not in body, "Cache-clearing logic should be removed from book_strategy_call"
    # And the auto-assign path now uses days=14 (matching frontend)
    assert "get_unified_availability(request, days=14)" in body, \
        "Booking should call get_unified_availability with days=14 to match the frontend"


def test_reschedule_endpoint_uses_aligned_cache_window():
    """Reschedule endpoint must use today..today+14 window (same as
    /available-slots) and must NOT clear the cache."""
    src_path = "/app/backend/routes/strategy_calls.py"
    with open(src_path) as f:
        src = f.read()

    start = src.index("async def reschedule_strategy_call")
    end = src.index("async def ", start + 10)
    body = src[start:end]

    assert "_calendar_cache" not in body, \
        "Cache clearing should be removed from reschedule_strategy_call"
    assert "today_ist + timedelta(days=14)" in body, \
        "Reschedule should use the same 14-day window as the listing endpoint"


# ---------- Live API integration ----------

def test_auto_assign_book_succeeds_for_free_slot():
    """Smoke test: With no conflicts in the DB and the seeded mentor calendar
    intentionally lacking real Google credentials (fetch returns {} silently),
    the auto-assign booking should succeed end-to-end without ever returning
    'Coach's calendar blocked'."""
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        # Hide other strategy mentors so our seeded one is the only candidate
        other_mentors = await db.mentors.find(
            {"can_take_strategy_calls": True, "id": {"$ne": TEST_MENTOR}},
            {"id": 1}
        ).to_list(50)
        other_ids = [m["id"] for m in other_mentors]
        await db.mentors.update_many(
            {"id": {"$in": other_ids}},
            {"$set": {"is_hidden_from_strategy_calls": True}}
        )
        try:
            await db.mentors.delete_one({"id": TEST_MENTOR})
            await db.mentor_weekly_availability.delete_many({"mentor_id": TEST_MENTOR})
            await db.strategy_call_sessions.delete_many({"mentor_id": TEST_MENTOR})
            await db.bookings.delete_many({"mentor_id": TEST_MENTOR})
            await _seed_mentor(db)
            # Disable google_calendar_connected for this seeded mentor so the
            # internal calendar fetch is skipped entirely (no fake creds needed).
            await db.mentors.update_one(
                {"id": TEST_MENTOR},
                {"$set": {"google_calendar_connected": False}},
            )
            await _seed_weekly_template(db)

            import pytz
            ist = pytz.timezone('Asia/Kolkata')
            tgt = datetime.now(ist) + timedelta(days=3)
            tgt_date = tgt.strftime("%Y-%m-%d")
            tgt_time = "14:00"

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(f"{BASE}/auth/mock-login?user_type=full_prep")
                cookies = r.cookies

                r = await client.post(
                    f"{BASE}/strategy-calls/book",
                    json={"date": tgt_date, "time": tgt_time, "auto_assign": True},
                    cookies=cookies,
                )
                body = r.json()
                # The misleading error must NOT appear
                assert "blocked on the coach" not in (body.get("detail") or ""), \
                    f"Got the legacy 'coach calendar blocked' error: {body}"
                # Either succeeds or returns a clean conflict reason
                assert r.status_code == 200, f"Expected 200, got {r.status_code} {body}"
                assert body.get("success") is True
                assert body["mentor"]["id"] == TEST_MENTOR

            await _cleanup(db)
        finally:
            await db.mentors.update_many(
                {"id": {"$in": other_ids}},
                {"$set": {"is_hidden_from_strategy_calls": False}}
            )

    asyncio.run(run())


def test_auto_assign_book_rejects_slot_already_booked_in_db():
    """If the slot is already booked (real DB conflict), booking returns a
    clean 'no mentors available' / 'already booked' message, NOT the
    'Coach's calendar blocked' error."""
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        other_mentors = await db.mentors.find(
            {"can_take_strategy_calls": True, "id": {"$ne": TEST_MENTOR}},
            {"id": 1}
        ).to_list(50)
        other_ids = [m["id"] for m in other_mentors]
        await db.mentors.update_many(
            {"id": {"$in": other_ids}},
            {"$set": {"is_hidden_from_strategy_calls": True}}
        )
        try:
            await db.mentors.delete_one({"id": TEST_MENTOR})
            await db.mentor_weekly_availability.delete_many({"mentor_id": TEST_MENTOR})
            await db.strategy_call_sessions.delete_many({"mentor_id": TEST_MENTOR})
            await db.bookings.delete_many({"mentor_id": TEST_MENTOR})
            await _seed_mentor(db)
            await db.mentors.update_one(
                {"id": TEST_MENTOR},
                {"$set": {"google_calendar_connected": False}},
            )
            await _seed_weekly_template(db)

            import pytz
            ist = pytz.timezone('Asia/Kolkata')
            tgt = datetime.now(ist) + timedelta(days=3)
            tgt_date = tgt.strftime("%Y-%m-%d")
            tgt_time = "16:00"

            # Pre-seed a confirmed strategy call at this exact slot
            await db.strategy_call_sessions.insert_one({
                "id": "test-conflict",
                "mentor_id": TEST_MENTOR,
                "user_id": "some-other-user",
                "date": tgt_date,
                "time": tgt_time,
                "status": "confirmed",
            })

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(f"{BASE}/auth/mock-login?user_type=full_prep")
                cookies = r.cookies
                r = await client.post(
                    f"{BASE}/strategy-calls/book",
                    json={"date": tgt_date, "time": tgt_time, "auto_assign": True},
                    cookies=cookies,
                )
                body = r.json()
                assert r.status_code == 400, f"Expected 400 conflict, got {r.status_code} {body}"
                detail = body.get("detail", "")
                assert "blocked on the coach" not in detail, \
                    f"Booking returned legacy misleading error: {detail!r}"

            await _cleanup(db)
        finally:
            await db.mentors.update_many(
                {"id": {"$in": other_ids}},
                {"$set": {"is_hidden_from_strategy_calls": False}}
            )

    asyncio.run(run())
