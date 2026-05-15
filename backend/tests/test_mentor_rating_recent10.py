"""
Tests for mentor "average of last 10 sessions" rating logic.

Exercises:
- compute_recent_mentor_rating helper (pure function)
- update_mentor_average_rating persistence (DB)
- GET /api/mentors and GET /api/mentors/{id} (via REST)

Run: cd /app/backend && python -m pytest tests/test_mentor_rating_recent10.py -v
"""
import os
import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

API_URL = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
if not API_URL.endswith("/api"):
    BASE = API_URL.rstrip("/") + "/api"
else:
    BASE = API_URL

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gradnext")

# Allow running without REACT_APP_BACKEND_URL by reading from frontend/.env
if "REACT_APP_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/") + "/api"
                    break
    except FileNotFoundError:
        pass


TEST_MENTOR_ID = "test-mentor-rating-window"


# -------------------- Pure helper tests --------------------

from routes.mentors import compute_recent_mentor_rating, RECENT_RATING_WINDOW


def _fb(rating, days_ago=0, historical=False):
    ts = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return {"rating_overall": rating, "is_historical": historical, "created_at": ts}


def test_helper_no_feedback_no_baseline_returns_none():
    rating, total = compute_recent_mentor_rating(None, [])
    assert rating is None and total == 0


def test_helper_only_historical_baseline_returns_baseline():
    rating, total = compute_recent_mentor_rating(4.5, [])
    assert rating == 4.5 and total == 0


def test_helper_picks_last_10_only_ignoring_older():
    # 12 feedbacks: oldest 2 are 1-star, newest 10 are 5-star
    feedbacks = [_fb(1, days_ago=20)] + [_fb(1, days_ago=19)] + [_fb(5, days_ago=i) for i in range(10)]
    rating, total = compute_recent_mentor_rating(None, feedbacks)
    assert rating == 5.0  # only last 10 used
    assert total == 12  # but total_reviews shows full count


def test_helper_excludes_historical_from_window():
    # 5 historical 5-star + 3 real 2-star → should use only 3 real ones, no baseline
    feedbacks = [_fb(5, days_ago=i, historical=True) for i in range(5)] + \
                [_fb(2, days_ago=i) for i in range(3)]
    rating, total = compute_recent_mentor_rating(None, feedbacks)
    assert rating == 2.0
    assert total == 8


def test_helper_blends_with_baseline_when_under_10():
    # Excel baseline 5.0 + 2 real 3-star feedbacks
    # Expected: (5.0*3 + 3+3) / (3+2) = (15 + 6) / 5 = 4.2
    feedbacks = [_fb(3, days_ago=0), _fb(3, days_ago=1)]
    rating, total = compute_recent_mentor_rating(5.0, feedbacks)
    assert rating == 4.2
    assert total == 2


def test_helper_blends_uses_window_not_all_real_feedbacks():
    # Excel baseline 5.0 + 12 real 1-star feedbacks
    # Old logic would average across all 12 → ((5*3) + 12) / (3+12) = 1.8
    # New logic uses only last 10 → ((5*3) + 10) / (3+10) = 25/13 = 1.923 ≈ 1.9
    feedbacks = [_fb(1, days_ago=i) for i in range(12)]
    rating, total = compute_recent_mentor_rating(5.0, feedbacks)
    assert rating == 1.9
    assert total == 12


def test_helper_handles_missing_created_at_gracefully():
    feedbacks = [_fb(5)] + [{"rating_overall": 3, "is_historical": False}]  # no created_at
    rating, total = compute_recent_mentor_rating(None, feedbacks)
    # Either ordering should yield avg of [5, 3] = 4.0 since both fit in window
    assert rating == 4.0
    assert total == 2


# -------------------- DB-level persistence test --------------------

def test_update_mentor_average_rating_uses_last_10():
    async def run():
        from routes.feedback import update_mentor_average_rating

        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        # Seed mentor
        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

        await db.mentors.insert_one({
            "id": TEST_MENTOR_ID,
            "name": "Test Coach Rating",
            "is_listed": True,
        })

        # Insert 12 feedbacks: oldest 2 are 1-star, newest 10 are 5-star
        docs = []
        for i in range(12):
            rating = 1 if i < 2 else 5
            docs.append({
                "id": f"fb-{TEST_MENTOR_ID}-{i}",
                "mentor_id": TEST_MENTOR_ID,
                "rating_overall": rating,
                "is_historical": False,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=20 - i)).isoformat(),
            })
        await db.candidate_feedbacks.insert_many(docs)

        await update_mentor_average_rating(db, TEST_MENTOR_ID)

        mentor = await db.mentors.find_one({"id": TEST_MENTOR_ID}, {"_id": 0})
        assert mentor["rating"] == 5.0
        assert mentor["feedback_count"] == 12

        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

    asyncio.run(run())


# -------------------- API integration test --------------------

def test_get_mentor_endpoint_uses_recent_window():
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

        await db.mentors.insert_one({
            "id": TEST_MENTOR_ID,
            "name": "Test Coach Rating API",
            "rating": 1.0,  # stale persisted value
            "is_listed": True,
        })

        # Insert 12 feedbacks, oldest 2 are 1-star, last 10 are 4-star
        docs = []
        for i in range(12):
            rating = 1 if i < 2 else 4
            docs.append({
                "id": f"fb-{TEST_MENTOR_ID}-{i}",
                "mentor_id": TEST_MENTOR_ID,
                "rating_overall": rating,
                "is_historical": False,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=20 - i)).isoformat(),
            })
        await db.candidate_feedbacks.insert_many(docs)

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            cookies = r.cookies

            r = await client.get(f"{BASE}/mentors/{TEST_MENTOR_ID}", cookies=cookies)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["rating"] == 4.0, f"Expected 4.0, got {data['rating']}"
            assert data["total_reviews"] == 12

        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

    asyncio.run(run())


def test_get_mentors_list_endpoint_uses_recent_window():
    async def run():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]

        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

        await db.mentors.insert_one({
            "id": TEST_MENTOR_ID,
            "name": "Test Coach List",
            "is_listed": True,
            "display_order": 9999,
        })

        # 15 feedbacks: oldest 5 are 1-star, last 10 are 5-star
        docs = []
        for i in range(15):
            rating = 1 if i < 5 else 5
            docs.append({
                "id": f"fb-{TEST_MENTOR_ID}-list-{i}",
                "mentor_id": TEST_MENTOR_ID,
                "rating_overall": rating,
                "is_historical": False,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=30 - i)).isoformat(),
            })
        await db.candidate_feedbacks.insert_many(docs)

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BASE}/auth/mock-login?user_type=free")
            cookies = r.cookies

            r = await client.get(f"{BASE}/mentors", cookies=cookies)
            assert r.status_code == 200
            mentors = r.json()
            ours = next((m for m in mentors if m.get("id") == TEST_MENTOR_ID), None)
            assert ours is not None, "test mentor not found in list"
            assert ours["rating"] == 5.0, f"Expected 5.0, got {ours['rating']}"
            assert ours["total_reviews"] == 15

        await db.mentors.delete_one({"id": TEST_MENTOR_ID})
        await db.candidate_feedbacks.delete_many({"mentor_id": TEST_MENTOR_ID})

    asyncio.run(run())
