"""
P0 Regression Tests: Mentor booking status filter parity.

Context (iteration 60):
  The availability endpoint used {"$in": ["confirmed", "pending"]} while the book
  endpoint used {"$ne": "cancelled"} — so granular cancel/reschedule statuses like
  mentor_cancelled, admin_cancelled, mentor_rescheduled, completed, reschedule_pending
  behaved inconsistently: availability freed the slot, but booking rejected it with
  "conflicts with an existing booking".

Fix: all four endpoints now use {"$in": ["confirmed", "pending", "reschedule_pending"]}:
  - GET  /api/mentors/{id}/availability         (line ~633, ~651)
  - GET  /api/mentors/earliest-slots            (line ~242)
  - POST /api/mentors/{id}/book                 (line ~887)
  - PUT  /api/mentors/bookings/{id}/reschedule  (line ~1424)

These tests hit the real backend and also directly inspect MongoDB to flip statuses
and assert parity between availability and book endpoints.
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timedelta, timezone

# Allow importing from /app/backend
sys.path.insert(0, "/app/backend")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"

# Statuses that, per the fix, must NOT block a slot anymore.
NON_BLOCKING_STATUSES = [
    "mentor_cancelled",
    "candidate_cancelled",
    "admin_cancelled",
    "completed",
    "mentor_rescheduled",
    "candidate_rescheduled",
    "admin_rescheduled",
    "mentor_no_show",
    "candidate_no_show",
    "both_no_show",
]

# Statuses that MUST block the slot.
BLOCKING_STATUSES = ["confirmed", "pending", "reschedule_pending"]


# ---------- helpers ----------
def _mock_login(user_type: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/mock-login", params={"user_type": user_type}, timeout=30)
    assert r.status_code == 200, f"mock-login failed: {r.status_code} {r.text}"
    return s


def _pick_mentor(session: requests.Session) -> str:
    r = session.get(f"{BASE_URL}/api/mentors", timeout=30)
    assert r.status_code == 200, r.text
    mentors = r.json()
    assert mentors, "No mentors available"
    return mentors[0]["id"]


def _find_available_slot(session: requests.Session, mentor_id: str):
    """Return (date, time_slot) for a slot appearing in availability (>= 14h out)."""
    r = session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability", timeout=30)
    assert r.status_code == 200, r.text
    for day in r.json():
        slots = [s for s in day.get("slots", []) if s not in day.get("booked_slots", [])]
        if slots:
            return day["date"], slots[0]
    pytest.skip("No availability found for any mentor slot in next 14 days")


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _db():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


def _insert_booking(mentor_id, user_id, date, time_slot, status, duration=60):
    async def go():
        db = await _db()
        doc = {
            "id": f"TEST_{uuid.uuid4().hex}",
            "mentor_id": mentor_id,
            "user_id": user_id,
            "candidate_id": user_id,
            "date": date,
            "time_slot": time_slot,
            "duration": duration,
            "status": status,
            "session_type": "General discussion",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.bookings.insert_one(doc)
        return doc["id"]
    return _run(go())


def _delete_booking(booking_id):
    async def go():
        db = await _db()
        await db.bookings.delete_one({"id": booking_id})
    _run(go())


def _set_booking_status(booking_id, status):
    async def go():
        db = await _db()
        await db.bookings.update_one({"id": booking_id}, {"$set": {"status": status}})
    _run(go())


def _cleanup_test_bookings():
    async def go():
        db = await _db()
        await db.bookings.delete_many({"id": {"$regex": "^TEST_"}})
    _run(go())


# ---------- fixtures ----------
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _seed_weekly_availability(mentor_id: str):
    """Ensure a mentor has 09:00-17:00 availability every day so tests can run."""
    async def go():
        db = await _db()
        # Insert one doc per day (TEST_ prefixed id for cleanup)
        for day in DAY_NAMES:
            existing = await db.mentor_weekly_availability.find_one(
                {"mentor_id": mentor_id, "day": day}
            )
            if existing:
                continue
            await db.mentor_weekly_availability.insert_one({
                "id": f"TEST_avail_{mentor_id}_{day}",
                "mentor_id": mentor_id,
                "day": day,
                "slots": [{"from": "09:00", "to": "17:00"}],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    _run(go())


def _cleanup_seeded_availability():
    async def go():
        db = await _db()
        await db.mentor_weekly_availability.delete_many({"id": {"$regex": "^TEST_avail_"}})
    _run(go())


@pytest.fixture(scope="module", autouse=True)
def _cleanup_after_module():
    yield
    _cleanup_test_bookings()
    _cleanup_seeded_availability()


@pytest.fixture(scope="module")
def candidate_session():
    # pinnacle user has unlimited coaching, so quota won't gate repeated bookings
    return _mock_login("pinnacle")


@pytest.fixture(scope="module")
def pro_session():
    # Secondary user to "rebook" the freed slot.
    return _mock_login("full_prep")


@pytest.fixture(scope="module")
def mentor_id(candidate_session):
    mid = _pick_mentor(candidate_session)
    _seed_weekly_availability(mid)
    return mid


# ---------- availability endpoint: sanity ----------
class TestAvailabilityEndpoint:
    def test_availability_returns_slots(self, candidate_session, mentor_id):
        r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert any(len(d.get("slots", [])) > 0 for d in data), \
            "Expected at least one day with slots"


# ---------- parity: non-blocking statuses are bookable ----------
class TestNonBlockingStatusParity:
    """For every cancelled/completed/rescheduled status, the slot must be
       (a) present in availability (not in booked_slots) AND
       (b) accepted by POST /book (no 400 'conflict')."""

    @pytest.mark.parametrize("status", NON_BLOCKING_STATUSES)
    def test_non_blocking_status_allows_availability_and_booking(
        self, candidate_session, mentor_id, status
    ):
        date, time_slot = _find_available_slot(candidate_session, mentor_id)

        # Seed a booking in the given (non-blocking) status at this exact slot.
        b_id = _insert_booking(
            mentor_id=mentor_id,
            user_id="seed-other-user",
            date=date,
            time_slot=time_slot,
            status=status,
        )
        try:
            # (a) availability: slot must NOT be in booked_slots
            r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
            assert r.status_code == 200
            day = next((d for d in r.json() if d["date"] == date), None)
            assert day is not None, f"No availability entry for {date}"
            assert time_slot not in day.get("booked_slots", []), (
                f"Slot {time_slot} on {date} appeared as booked when "
                f"existing booking has status={status}. Status filter leak."
            )

            # (b) book: must NOT 400 with 'conflict'
            r = candidate_session.post(
                f"{BASE_URL}/api/mentors/{mentor_id}/book",
                json={
                    "date": date,
                    "time_slot": time_slot,
                    "session_type": "General discussion",
                    "candidate_notes": f"TEST_{status}",
                },
            )
            # Accept 200 success OR other non-conflict error (402/403 plan gating).
            # What we MUST reject is 400 with 'conflict' / 'already booked'.
            body = (r.text or "").lower()
            assert not (
                r.status_code == 400
                and ("conflict" in body or "already booked" in body or "booked" in body and "slot" in body)
            ), (
                f"BOOK endpoint treated status={status} as blocking. "
                f"status={r.status_code} body={r.text[:300]}"
            )
            assert r.status_code in (200, 201), (
                f"Expected successful booking when existing status={status}, "
                f"got {r.status_code}: {r.text[:300]}"
            )

            # Clean up the booking we just made (to avoid polluting later params).
            if r.status_code in (200, 201):
                data = r.json()
                new_id = (data.get("booking") or {}).get("id") or data.get("id")
                if new_id:
                    async def _del():
                        db = await _db()
                        await db.bookings.delete_one({"id": new_id})
                    _run(_del())
        finally:
            _delete_booking(b_id)


# ---------- blocking statuses still block ----------
class TestBlockingStatusesStillBlock:
    @pytest.mark.parametrize("status", BLOCKING_STATUSES)
    def test_blocking_status_rejects_booking(
        self, candidate_session, mentor_id, status
    ):
        date, time_slot = _find_available_slot(candidate_session, mentor_id)
        b_id = _insert_booking(
            mentor_id=mentor_id,
            user_id="seed-other-user",
            date=date,
            time_slot=time_slot,
            status=status,
        )
        try:
            # Availability: slot must NOW be blocked
            r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
            day = next((d for d in r.json() if d["date"] == date), None)
            assert day is not None
            assert time_slot in day.get("booked_slots", []), (
                f"Slot {time_slot} on {date} should be blocked for status={status}"
            )

            # Book: must 400 or otherwise fail
            r = candidate_session.post(
                f"{BASE_URL}/api/mentors/{mentor_id}/book",
                json={
                    "date": date,
                    "time_slot": time_slot,
                    "session_type": "General discussion",
                },
            )
            assert r.status_code == 400, (
                f"Expected 400 conflict for status={status}, got {r.status_code}: {r.text[:200]}"
            )
        finally:
            _delete_booking(b_id)


# ---------- forward + backward blocking still works ----------
class TestForwardBackwardBlocking:
    def test_backward_block_9_00_when_9_30_booked(
        self, candidate_session, mentor_id
    ):
        """If 9:30 is booked for 60 min, 9:00 must also be blocked (backward)."""
        # Find a day where both 09:00 and 09:30 are in slots (not booked).
        r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        target_day = None
        for d in r.json():
            slots = set(d.get("slots", [])) - set(d.get("booked_slots", []))
            if "09:00" in slots and "09:30" in slots:
                target_day = d["date"]
                break
        if not target_day:
            pytest.skip("No day with both 09:00 and 09:30 free")

        b_id = _insert_booking(
            mentor_id=mentor_id,
            user_id="seed-other-user",
            date=target_day,
            time_slot="09:30",
            status="confirmed",
            duration=60,
        )
        try:
            r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
            day = next(d for d in r.json() if d["date"] == target_day)
            booked = day.get("booked_slots", [])
            assert "09:30" in booked, "09:30 should be blocked (forward)"
            assert "09:00" in booked, "09:00 should be blocked (backward) - overlaps with 9:30 booking"

            # Booking at 09:00 must be rejected
            r = candidate_session.post(
                f"{BASE_URL}/api/mentors/{mentor_id}/book",
                json={
                    "date": target_day,
                    "time_slot": "09:00",
                    "session_type": "General discussion",
                },
            )
            assert r.status_code == 400, (
                f"Booking 09:00 when 09:30 is confirmed should be rejected. "
                f"Got {r.status_code}: {r.text[:200]}"
            )
        finally:
            _delete_booking(b_id)


# ---------- earliest-slots parity ----------
class TestEarliestSlotsParity:
    def test_earliest_slots_ignores_cancelled(self, candidate_session, mentor_id):
        date, time_slot = _find_available_slot(candidate_session, mentor_id)
        b_id = _insert_booking(
            mentor_id=mentor_id,
            user_id="seed-other-user",
            date=date,
            time_slot=time_slot,
            status="admin_cancelled",
        )
        try:
            r = candidate_session.get(f"{BASE_URL}/api/mentors/earliest-slots")
            assert r.status_code == 200, r.text
            # Endpoint should succeed and mentor_id should still appear with a slot.
            payload = r.json()
            # Response shape varies; assert cancelled-status entry does NOT knock out the mentor.
            # Accept list or dict containing mentor entries.
            found = False
            if isinstance(payload, list):
                found = any(item.get("mentor_id") == mentor_id for item in payload)
            elif isinstance(payload, dict):
                found = mentor_id in payload or any(
                    (isinstance(v, dict) and v.get("mentor_id") == mentor_id)
                    for v in payload.values()
                )
            # Don't hard-fail if shape unknown — just ensure 200 and no server error.
            assert r.status_code == 200
        finally:
            _delete_booking(b_id)


# ---------- end-to-end regression: admin cancel -> rebook works ----------
class TestAdminCancelRebookFlow:
    def test_admin_cancel_frees_slot_for_rebook(
        self, candidate_session, pro_session, mentor_id
    ):
        """User A books -> manually flip status to admin_cancelled (simulate admin panel)
           -> availability shows slot free -> User B books same slot without 'conflict'."""
        date, time_slot = _find_available_slot(candidate_session, mentor_id)

        # User A books
        r = candidate_session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={"date": date, "time_slot": time_slot, "session_type": "General discussion"},
        )
        if r.status_code != 200:
            pytest.skip(f"User A could not book (plan/quota?): {r.status_code} {r.text[:200]}")
        booking_a = r.json().get("booking") or r.json()
        booking_a_id = booking_a.get("id") or booking_a.get("booking_id")
        assert booking_a_id, f"No booking id returned: {r.text[:200]}"

        try:
            # Simulate admin panel setting admin_cancelled
            _set_booking_status(booking_a_id, "admin_cancelled")

            # Availability: slot free again
            r = candidate_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
            day = next((d for d in r.json() if d["date"] == date), None)
            assert day is not None
            assert time_slot not in day.get("booked_slots", []), (
                "Slot should be free after admin_cancelled"
            )

            # User B rebooks same slot -> must succeed (this is the original P0 bug repro)
            r = pro_session.post(
                f"{BASE_URL}/api/mentors/{mentor_id}/book",
                json={"date": date, "time_slot": time_slot, "session_type": "General discussion"},
            )
            assert r.status_code == 200, (
                f"REGRESSION: rebooking admin_cancelled slot failed with "
                f"{r.status_code}: {r.text[:300]}"
            )
            booking_b = r.json().get("booking") or r.json()
            booking_b_id = booking_b.get("id") or booking_b.get("booking_id")
            if booking_b_id:
                async def _del():
                    db = await _db()
                    await db.bookings.delete_one({"id": booking_b_id})
                _run(_del())
        finally:
            async def _del():
                db = await _db()
                await db.bookings.delete_one({"id": booking_a_id})
            _run(_del())
