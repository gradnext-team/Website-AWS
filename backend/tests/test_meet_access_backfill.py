"""Regression tests for the Meet "Wait for the host" backfill.

The fix targets two scenarios on legacy production bookings created
before the OPEN-access fix shipped:

  1. Booking has `meet_space_name` → migration patches the existing
     space's `accessType` to OPEN (existing meet_link stays valid).
  2. Booking only has `meet_link` (no space name) → migration regenerates
     a fresh OPEN Meet space and overwrites both `meet_link` and
     `meet_space_name`.

Each booking is stamped with `meet_access_backfilled_at` so subsequent
deploys don't re-process the same docs.
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from types import SimpleNamespace

import pytest
import mongomock_motor

sys.path.insert(0, '/app/backend')

from migrations.startup_migrations import backfill_old_meet_access_to_open  # noqa: E402


def _future_date(days_ahead=2):
    return (datetime.now(timezone.utc) + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


def _past_date(days_ago=2):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")


@pytest.fixture
def mock_db():
    return mongomock_motor.AsyncMongoMockClient()["test"]


@pytest.mark.asyncio
async def test_patches_when_space_name_present(mock_db):
    """Upcoming booking with meet_space_name → patch path."""
    booking_id = "bk_with_space"
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _future_date(),
        "meet_link": "https://meet.google.com/legacy-abc-def",
        "meet_space_name": "spaces/legacy123",
        "status": "confirmed",
    })

    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=lambda name: True,
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    after = await mock_db.bookings.find_one({"id": booking_id}, {"_id": 0})
    assert after["meet_access_backfill_method"] == "patched"
    assert "meet_access_backfilled_at" in after
    # Patch path keeps the original link intact
    assert after["meet_link"] == "https://meet.google.com/legacy-abc-def"
    assert after["meet_space_name"] == "spaces/legacy123"


@pytest.mark.asyncio
async def test_regenerates_when_space_name_missing(mock_db):
    """Old booking with only meet_link → regenerate path."""
    booking_id = "bk_no_space"
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _future_date(),
        "meet_link": "https://meet.google.com/legacy-no-space",
        "status": "confirmed",
    })

    new_space = {
        "meeting_uri": "https://meet.google.com/new-open-link",
        "meeting_code": "new-open",
        "space_name": "spaces/newopen456",
    }
    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=lambda name: True,
        _create_meet_space_with_recording=lambda: new_space,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    after = await mock_db.bookings.find_one({"id": booking_id}, {"_id": 0})
    assert after["meet_access_backfill_method"] == "regenerated"
    assert after["meet_link"] == new_space["meeting_uri"]
    assert after["meet_space_name"] == new_space["space_name"]


@pytest.mark.asyncio
async def test_skips_past_sessions(mock_db):
    """Sessions in the past should never be touched."""
    booking_id = "bk_past"
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _past_date(),
        "meet_link": "https://meet.google.com/old",
        "meet_space_name": "spaces/old",
        "status": "confirmed",
    })

    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=lambda name: True,
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    after = await mock_db.bookings.find_one({"id": booking_id}, {"_id": 0})
    assert "meet_access_backfilled_at" not in after


@pytest.mark.asyncio
async def test_skips_cancelled_and_completed(mock_db):
    """Don't waste API calls on cancelled / completed sessions."""
    for sid, status in [
        ("bk_cancelled", "candidate_cancelled"),
        ("bk_done", "completed"),
    ]:
        await mock_db.bookings.insert_one({
            "id": sid,
            "date": _future_date(),
            "meet_link": "https://meet.google.com/x",
            "meet_space_name": "spaces/x",
            "status": status,
        })

    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=lambda name: True,
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    for sid in ("bk_cancelled", "bk_done"):
        doc = await mock_db.bookings.find_one({"id": sid}, {"_id": 0})
        assert "meet_access_backfilled_at" not in doc


@pytest.mark.asyncio
async def test_idempotent_does_not_reprocess(mock_db):
    """Already-stamped docs must be skipped on subsequent runs."""
    booking_id = "bk_already_done"
    earlier = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _future_date(),
        "meet_link": "https://meet.google.com/old",
        "meet_space_name": "spaces/old",
        "status": "confirmed",
        "meet_access_backfilled_at": earlier,
        "meet_access_backfill_method": "patched",
    })

    call_count = {"n": 0}

    def patch_fn(name):
        call_count["n"] += 1
        return True

    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=patch_fn,
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    assert call_count["n"] == 0  # never re-patched


@pytest.mark.asyncio
async def test_handles_calendar_unavailable_gracefully(mock_db):
    """If the calendar service is down, migration must no-op cleanly."""
    booking_id = "bk_cal_down"
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _future_date(),
        "meet_link": "https://meet.google.com/x",
        "meet_space_name": "spaces/x",
        "status": "confirmed",
    })

    fake_cal = SimpleNamespace(
        is_available=lambda: False,
        update_meet_space_access_open=lambda name: True,
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    after = await mock_db.bookings.find_one({"id": booking_id}, {"_id": 0})
    assert "meet_access_backfilled_at" not in after


@pytest.mark.asyncio
async def test_marks_failed_so_we_dont_retry_forever(mock_db):
    """If the patch path fails, stamp 'failed' so we don't hammer the API."""
    booking_id = "bk_will_fail"
    await mock_db.bookings.insert_one({
        "id": booking_id,
        "date": _future_date(),
        "meet_link": "https://meet.google.com/x",
        "meet_space_name": "spaces/x",
        "status": "confirmed",
    })

    fake_cal = SimpleNamespace(
        is_available=lambda: True,
        update_meet_space_access_open=lambda name: False,  # API fails
        _create_meet_space_with_recording=lambda: None,
    )

    with patch("services.calendar_service.get_calendar_service", return_value=fake_cal):
        await backfill_old_meet_access_to_open(mock_db)

    after = await mock_db.bookings.find_one({"id": booking_id}, {"_id": 0})
    assert after["meet_access_backfill_method"] == "failed"
    assert "meet_access_backfilled_at" in after


if __name__ == "__main__":
    asyncio.run(asyncio.gather(
        test_patches_when_space_name_present(mongomock_motor.AsyncMongoMockClient()["t"]),
    ))
