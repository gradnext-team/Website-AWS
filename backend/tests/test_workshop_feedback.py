"""
Tests for workshop feedback collection (in-app + WATI inbound webhook + sheet).

Run: cd /app/backend && python -m pytest tests/test_workshop_feedback.py -v
"""
import os
import asyncio
import re
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

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

WS_ID = "test-workshop-feedback-ws"
USER_ID = "test-workshop-feedback-user"
USER_PHONE = "+919999000111"


# ─── Pure parsing tests ──────────────────────────────────────


def test_parse_feedback_extracts_rating_and_comment():
    from routes.workshop_feedback import _parse_feedback_message
    rating, comments = _parse_feedback_message("4 great session, learned a lot!")
    assert rating == 4
    assert "great session" in comments


def test_parse_feedback_only_rating():
    from routes.workshop_feedback import _parse_feedback_message
    rating, comments = _parse_feedback_message("5")
    assert rating == 5
    assert comments == ""


def test_parse_feedback_only_comment_no_rating():
    from routes.workshop_feedback import _parse_feedback_message
    rating, comments = _parse_feedback_message("Loved it!")
    assert rating is None
    assert comments == "Loved it!"


def test_parse_feedback_rating_above_5_ignored():
    from routes.workshop_feedback import _parse_feedback_message
    rating, comments = _parse_feedback_message("9 amazing")
    assert rating is None
    assert "9 amazing" in comments


def test_normalize_phone():
    from routes.workshop_feedback import _normalize_phone
    assert _normalize_phone("+919999000111") == "919999000111"
    assert _normalize_phone("919999000111") == "919999000111"
    assert _normalize_phone(" +919999000111 ") == "919999000111"
    assert _normalize_phone("") == ""


def test_workshop_feedback_row_builder_columns():
    from services.google_sheets_service import (
        _build_workshop_feedback_row,
        WORKSHOP_FEEDBACK_HEADERS,
    )
    row = _build_workshop_feedback_row({
        "workshop_title": "Case Cracking 101",
        "workshop_date": "2026-04-26",
        "name": "Aman",
        "email": "aman@example.com",
        "phone": "+919999000111",
        "rating": 4,
        "comments": "Great!",
        "submitted_at": "2026-04-26T10:00:00+00:00",
        "source": "wati_whatsapp",
    })
    assert len(row) == len(WORKSHOP_FEEDBACK_HEADERS) == 9
    mapped = dict(zip(WORKSHOP_FEEDBACK_HEADERS, row))
    assert mapped["Workshop Title"] == "Case Cracking 101"
    assert mapped["Rating"] == "4"
    assert mapped["Source"] == "wati_whatsapp"
    # IST: 2026-04-26 10:00 UTC → 15:30 IST
    assert mapped["Submitted At"] == "2026-04-26 15:30:00 IST"


def test_workshop_feedback_row_builder_missing_rating():
    """Comment-only WATI replies don't have a rating — ensure no crash."""
    from services.google_sheets_service import _build_workshop_feedback_row
    row = _build_workshop_feedback_row({
        "workshop_title": "X",
        "workshop_date": "2026-04-26",
        "name": "Y",
        "email": "y@y.com",
        "rating": None,
        "comments": "ok",
        "source": "wati_whatsapp",
    })
    # Rating cell should be empty string, not "None"
    assert row[6] == ""


# ─── Live API: in-app feedback endpoint ──────────────────────


def test_in_app_feedback_persists_and_returns_200():
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        # Seed workshop + user
        await db.workshops.delete_one({"id": WS_ID})
        await db.workshops.insert_one({
            "id": WS_ID,
            "title": "Test Workshop",
            "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
            "is_active": True,
        })
        await db.workshop_feedback.delete_many({"workshop_id": WS_ID})

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            cookies = r.cookies

            with patch(
                "services.google_sheets_service.append_workshop_feedback_to_sheet"
            ) as fake_sheet:
                # Sheet write is mocked in this process — real backend will still
                # try to write (since patch only applies to test process), but
                # for endpoint correctness we only care about persistence + 200.
                _ = fake_sheet  # noqa: F841

                r = await client.post(
                    f"{BASE}/workshops/{WS_ID}/feedback",
                    json={"rating": 5, "comments": "Excellent!"},
                    cookies=cookies,
                )
                assert r.status_code == 200, r.text
                assert r.json().get("success") is True

            # Verify DB row
            stored = await db.workshop_feedback.find_one(
                {"workshop_id": WS_ID}, {"_id": 0}
            )
            assert stored is not None
            assert stored["rating"] == 5
            assert stored["comments"] == "Excellent!"
            assert stored["source"] == "in_app"

        await db.workshops.delete_one({"id": WS_ID})
        await db.workshop_feedback.delete_many({"workshop_id": WS_ID})

    asyncio.run(run())


def test_in_app_feedback_rejects_bad_rating():
    async def run():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            cookies = r.cookies
            r = await client.post(
                f"{BASE}/workshops/no-such-ws/feedback",
                json={"rating": 7},  # out of range
                cookies=cookies,
            )
            assert r.status_code == 422
    asyncio.run(run())


def test_in_app_feedback_404_for_unknown_workshop():
    async def run():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            cookies = r.cookies
            r = await client.post(
                f"{BASE}/workshops/totally-bogus-ws-id/feedback",
                json={"rating": 4, "comments": "ok"},
                cookies=cookies,
            )
            assert r.status_code == 404
    asyncio.run(run())


# ─── Live API: WATI inbound webhook ──────────────────────────


def test_wati_webhook_records_feedback_for_recent_workshop():
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        await db.workshops.delete_one({"id": WS_ID})
        today = datetime.now().strftime("%Y-%m-%d")
        await db.workshops.insert_one({
            "id": WS_ID,
            "title": "Webhook Test Workshop",
            "date": today,
            "is_active": True,
        })

        # Register the user's mock-login user against this workshop
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            user_resp = r.json()
            uid = user_resp.get("id")

            # Set the user's phone & seed registration
            await db.users.update_one(
                {"id": uid}, {"$set": {"phone_number": USER_PHONE}}
            )
            await db.workshop_registrations.delete_many({"user_id": uid})
            await db.workshop_feedback.delete_many({"workshop_id": WS_ID})
            await db.workshop_registrations.insert_one({
                "user_id": uid,
                "workshop_id": WS_ID,
                "registered_at": datetime.now(timezone.utc).isoformat(),
            })

            # Now POST a WATI webhook payload
            r = await client.post(
                f"{BASE}/webhooks/wati",
                json={
                    "waId": "919999000111",
                    "messageBody": "5 absolutely loved the session",
                },
            )
            assert r.status_code == 200
            data = r.json()
            assert data.get("ok") is True
            assert data.get("feedback_recorded") is True

            # Verify DB
            stored = await db.workshop_feedback.find_one(
                {"workshop_id": WS_ID, "user_id": uid}, {"_id": 0}
            )
            assert stored is not None
            assert stored["rating"] == 5
            assert "absolutely loved" in stored["comments"]
            assert stored["source"] == "wati_whatsapp"

            # Cleanup
            await db.workshop_registrations.delete_many({"user_id": uid})
            await db.workshop_feedback.delete_many({"workshop_id": WS_ID})

        await db.workshops.delete_one({"id": WS_ID})

    asyncio.run(run())


def test_wati_webhook_ignores_status_only_events():
    """Delivery-receipt / status-update events have no text — must 200 OK silently."""
    async def run():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{BASE}/webhooks/wati",
                json={"waId": "919999000111", "eventType": "delivered"},
            )
            assert r.status_code == 200
            assert r.json().get("ignored") is True
    asyncio.run(run())


def test_wati_webhook_no_match_when_unknown_phone():
    async def run():
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{BASE}/webhooks/wati",
                json={"waId": "910000000000", "messageBody": "5 great"},
            )
            assert r.status_code == 200
            assert r.json().get("matched") is False
    asyncio.run(run())
