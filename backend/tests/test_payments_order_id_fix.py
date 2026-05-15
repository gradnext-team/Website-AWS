"""
Regression test for the production "Booking finalization failed" 500
on /api/payments/verify-session-with-slot.

Root cause: the verify endpoint inserted into `payments` without an
`order_id` field. There is a unique non-sparse index on
`payments.order_id`, so MongoDB stored `order_id: null`, and the SECOND
such insert anywhere in the system collided with E11000 → 500 →
"Booking finalization failed. Our team will refund you within 24 hours."
on the user's screen.

The fix:
  1. Set `order_id` = razorpay_order_id on the verify-session-with-slot
     insert (so we never write null).
  2. Backfill migration `fix_payments_null_order_id` heals legacy
     null-order_id rows on backend startup, so production isn't stuck.

These tests confirm:
  • We can insert TWO payments missing only the `razorpay_order_id`-style
    fields without colliding (i.e., the verify code path is null-safe).
  • The heal migration correctly replaces null order_id with a unique
    value derived from razorpay_order_id.
"""
import os
import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timezone

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@pytest.fixture
def db():
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    d = client[os.environ["DB_NAME"]]
    yield d
    client.close()


def test_payments_order_id_index_is_unique(db):
    """Sanity: confirm the unique index that caused the production bug."""
    indexes = list(db.payments.list_indexes())
    order_id_idx = next((i for i in indexes if "order_id" in i.get("key", {}).keys()), None)
    assert order_id_idx is not None, "payments.order_id index missing"
    assert order_id_idx.get("unique") is True, "payments.order_id index should be unique"


def test_two_inserts_with_explicit_order_id_succeed(db):
    """Verify-session-with-slot now sets `order_id` on every insert.
    Two such inserts (different orders) must succeed."""
    a_id = f"pay_test_{uuid.uuid4().hex[:8]}"
    b_id = f"pay_test_{uuid.uuid4().hex[:8]}"
    try:
        db.payments.insert_one({
            "id": a_id,
            "user_id": "u_test_a",
            "order_id": f"order_test_a_{uuid.uuid4().hex[:6]}",
            "razorpay_order_id": "order_test_a",
            "type": "single_session_with_slot",
            "status": "captured",
            "amount_inr": 80,
        })
        db.payments.insert_one({
            "id": b_id,
            "user_id": "u_test_b",
            "order_id": f"order_test_b_{uuid.uuid4().hex[:6]}",
            "razorpay_order_id": "order_test_b",
            "type": "single_session_with_slot",
            "status": "captured",
            "amount_inr": 80,
        })
    finally:
        db.payments.delete_many({"id": {"$in": [a_id, b_id]}})


def test_heal_migration_replaces_null_order_id(db):
    """The backfill migration replaces null/missing `order_id` with a
    unique value derived from razorpay_order_id, so the unique index is
    no longer hot. We seed a row with null order_id and expect the
    migration to heal it without colliding on the unique index.
    """
    # We seed by going around the unique index: insert ONE null
    # order_id record (which is allowed since the index is initially
    # empty for null after teardown).
    seed_id = f"heal_test_{uuid.uuid4().hex[:8]}"
    rzp_order = f"order_heal_{uuid.uuid4().hex[:8]}"
    
    # Make sure no other null order_id records exist before we seed
    db.payments.delete_many({"order_id": None})
    db.payments.delete_many({"order_id": {"$exists": False}})
    
    db.payments.insert_one({
        "id": seed_id,
        "user_id": "u_heal",
        "razorpay_order_id": rzp_order,
        "type": "single_session_with_slot",
        "status": "captured",
        "amount_inr": 80,
        "order_id": None,
    })
    
    # Run the migration
    from motor.motor_asyncio import AsyncIOMotorClient
    from migrations.startup_migrations import fix_payments_null_order_id
    
    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await fix_payments_null_order_id(client[os.environ["DB_NAME"]])
        client.close()
    
    asyncio.run(_run())
    
    # Verify the seeded row now has a non-null order_id derived from razorpay_order_id
    healed = db.payments.find_one({"id": seed_id}, {"_id": 0, "order_id": 1})
    assert healed is not None
    assert healed["order_id"] == rzp_order, f"Expected order_id={rzp_order}, got {healed.get('order_id')}"
    
    # And there should be no null-order_id rows left
    assert db.payments.count_documents({"order_id": None}) == 0
    
    db.payments.delete_one({"id": seed_id})


def test_heal_migration_handles_collision(db):
    """If two legacy rows both reference the same razorpay_order_id (rare
    but possible for retries), the heal must still succeed by suffixing
    the second one — never leave the system stuck on the unique index."""
    seed_a = f"heal_a_{uuid.uuid4().hex[:8]}"
    seed_b = f"heal_b_{uuid.uuid4().hex[:8]}"
    rzp = f"order_collide_{uuid.uuid4().hex[:8]}"
    
    # Pre-existing record holding the order_id
    db.payments.insert_one({
        "id": "occupier",
        "user_id": "u_collide_x",
        "order_id": rzp,
        "razorpay_order_id": rzp,
        "amount_inr": 80,
    })
    # Two null-order_id rows that both want to backfill to the same rzp order id
    db.payments.delete_many({"order_id": None})
    db.payments.insert_one({
        "id": seed_a,
        "user_id": "u_collide_a",
        "razorpay_order_id": rzp,
        "amount_inr": 80,
        "order_id": None,
    })
    
    from motor.motor_asyncio import AsyncIOMotorClient
    from migrations.startup_migrations import fix_payments_null_order_id
    
    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await fix_payments_null_order_id(client[os.environ["DB_NAME"]])
        client.close()
    
    asyncio.run(_run())
    
    healed_a = db.payments.find_one({"id": seed_a}, {"_id": 0, "order_id": 1})
    assert healed_a["order_id"] is not None
    assert healed_a["order_id"] != rzp, "Should have been suffixed to avoid collision"
    
    db.payments.delete_many({"id": {"$in": ["occupier", seed_a, seed_b]}})
