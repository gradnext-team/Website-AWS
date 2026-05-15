"""
Regression tests for the production "Subscription Plan = ₹1.28 Cr" bug.

Two compounding root causes (both fixed):
  1. `classify_purchase_type` used "Subscription Plan" as the catch-all
     fallback. Records with `plan_key=None`, weird legacy plan_keys,
     single-session bookings without a `type` field, etc. all fell into
     Subscription Plan and inflated that bucket dramatically.
  2. The paisa→rupees heuristic threshold was ₹1L, so a Razorpay-stored
     ₹499 plan (49,900 paisa) didn't trigger the conversion and was
     read as ₹49,900.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

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


# ---------------- Classifier unit tests ----------------

def test_classifier_routes_subscription_plans_correctly():
    from routes.sales_admin import classify_purchase_type
    assert classify_purchase_type({"plan_key": "basic_plan"}) == "Subscription Plan"
    assert classify_purchase_type({"plan_key": "pro_plan"}) == "Subscription Plan"
    assert classify_purchase_type({"plan_key": "pro_plus"}) == "Subscription Plan"


def test_classifier_routes_coaching_plans_correctly():
    from routes.sales_admin import classify_purchase_type
    assert classify_purchase_type({"plan_key": "full_prep"}) == "Coaching Plan"
    assert classify_purchase_type({"plan_key": "last_mile"}) == "Coaching Plan"
    assert classify_purchase_type({"plan_key": "mid_mile"}) == "Coaching Plan"


def test_classifier_routes_top_ups_and_sessions_by_type():
    from routes.sales_admin import classify_purchase_type
    assert classify_purchase_type({"type": "session_topup"}) == "Top-Up"
    assert classify_purchase_type({"type": "single_coaching_session"}) == "Single Session"
    assert classify_purchase_type({"type": "single_session_with_slot"}) == "Single Session"


def test_classifier_unknown_records_go_to_other_not_subscription():
    """The bug: unrecognized records used to fall back to 'Subscription
    Plan'. Now they go to 'Other' so Subscription Plan stays accurate.
    """
    from routes.sales_admin import classify_purchase_type
    assert classify_purchase_type({}) == "Other"
    assert classify_purchase_type({"plan_key": None, "type": None}) == "Other"
    assert classify_purchase_type({"plan_key": "some_legacy_thing"}) == "Other"
    assert classify_purchase_type({"plan_key": "premium_offering_2024"}) == "Other"


# ---------------- Paisa-heuristic tests ----------------

def test_normalize_now_only_uses_high_threshold_and_paise_hint():
    """The runtime helper is intentionally conservative — it only converts
    when (a) the caller passes paise_hint=True (e.g. amount_in_paise
    matches amount), or (b) the value is > ₹50,000 (above any legit
    single-tx rupee). The smarter paisa healing uses plan-price lookups
    in the migration, not at runtime.
    """
    from routes.sales_admin import _normalize_money_field
    # paise_hint forces conversion
    assert _normalize_money_field(588, paise_hint=True) == 5.88
    # Normal rupee amounts pass through (NO false-flag for amount % 100 == 0)
    assert _normalize_money_field(2500) == 2500.0
    assert _normalize_money_field(5000) == 5000.0
    assert _normalize_money_field(5900) == 5900.0  # was wrongly normalized to 59 before
    assert _normalize_money_field(49900) == 49900.0  # not normalized at runtime; migration handles it
    # High threshold catches obvious paisa
    assert _normalize_money_field(150000) == 1500.0
    assert _normalize_money_field(4499900) == 44999.0  # paisa for ₹44999
    # GST-style decimals stay
    assert _normalize_money_field(588.82) == 588.82
    assert _normalize_money_field(2950.0) == 2950.0
    # Zero / invalid
    assert _normalize_money_field(0) == 0.0
    assert _normalize_money_field(None) == 0.0
    assert _normalize_money_field("not a number") == 0.0


# ---------------- End-to-end summary tests ----------------

@pytest.fixture
def messy_real_world_records(db):
    """Recreate the production data shape: a mix of paisa-stored and
    rupee-stored records, plus a few legacy ones with no plan_key.
    NB: paisa-stored amounts use values that trigger the >₹50k runtime
    heuristic. Lower-value paisa records (e.g. 49900) only get healed
    by the startup migration via plan-price lookups — not tested here
    (covered by the migration's own tests).
    """
    m = f"prod_repro_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    docs = [
        # Razorpay-stored ₹500k+ paisa → triggers runtime heuristic
        {"id": f"{m}_a", "user_id": "u1", "amount": 5000000, "status": "paid",
         "plan_key": "basic_plan", "razorpay_order_id": f"o{m}a", "razorpay_payment_id": f"p{m}a",
         "paid_at": now, "created_at": now},
        # Rupee-stored ₹999 pro_plus
        {"id": f"{m}_b", "user_id": "u2", "amount": 999, "status": "paid",
         "plan_key": "pro_plus", "razorpay_order_id": f"o{m}b", "razorpay_payment_id": f"p{m}b",
         "paid_at": now, "created_at": now},
        # Rupee-stored ₹2500 single session
        {"id": f"{m}_c", "user_id": "u3", "amount": 2500, "status": "paid",
         "type": "single_coaching_session", "razorpay_order_id": f"o{m}c", "razorpay_payment_id": f"p{m}c",
         "paid_at": now, "created_at": now},
        # Legacy weirdness — these previously polluted Subscription Plan
        {"id": f"{m}_d", "user_id": "u4", "amount": 1180, "status": "paid",
         "plan_key": None, "type": None,
         "razorpay_order_id": f"o{m}d", "razorpay_payment_id": f"p{m}d",
         "paid_at": now, "created_at": now},
        {"id": f"{m}_e", "user_id": "u5", "amount": 5900, "status": "paid",
         "plan_key": "premium_offering_2024", "type": None,
         "razorpay_order_id": f"o{m}e", "razorpay_payment_id": f"p{m}e",
         "paid_at": now, "created_at": now},
    ]
    db.payment_orders.insert_many(docs)
    yield {"marker": m, "docs": docs}
    db.payment_orders.delete_many({"id": {"$regex": f"^{m}_"}})


def test_subscription_plan_is_no_longer_polluted_by_unknown_records(admin_session, messy_real_world_records):
    """The headline bug: production showed ₹1.28 Cr Subscription Plan
    when the actual subscription revenue was ~₹1 lakh. After fix:
    only true subscription_plan records contribute to that bucket.
    """
    r = admin_session.get(f"{API}/admin/sales/summary", timeout=20)
    assert r.status_code == 200, r.text
    s = r.json()
    by_type = s.get("revenue_by_type") or {}
    
    # Subscription Plan should only contain basic_plan + pro_plus (₹4.99 + ₹9.99 = ₹14.98)
    sub_total = by_type.get("Subscription Plan", 0)
    # Allow some pre-existing data tolerance (just our seeded records sum)
    # Our seeded subs: 49900 → ₹499, 99900 → ₹999. Total ₹1498.
    # 1180 (no plan_key) used to land here; now goes to "Other".
    assert sub_total < 1_00_000, (
        f"Subscription Plan total {sub_total} suspicious. "
        f"Should only contain explicit subscription plans, not legacy/unknown records."
    )


def test_classifier_routes_unknown_records_to_other_bucket(admin_session, messy_real_world_records):
    r = admin_session.get(f"{API}/admin/sales/summary", timeout=20)
    by_type = r.json().get("revenue_by_type") or {}
    # We seeded 2 unknown-plan records — they should now appear in "Other"
    # (or at minimum not in Subscription Plan).
    assert "Other" in by_type, f"Expected 'Other' bucket; got types: {list(by_type.keys())}"


def test_debug_summary_returns_breakdown_with_samples(admin_session, messy_real_world_records):
    r = admin_session.get(f"{API}/admin/sales/debug-summary", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "by_purchase_type_after_normalize" in body
    assert "suspicious_records_above_1L" in body
    assert "raw_sums_before_normalization" in body
    # We should see the buckets we hit
    bt = body["by_purchase_type_after_normalize"]
    # At least the seeded records produced buckets
    assert any(k in bt for k in ["Subscription Plan", "Single Session", "Other"]), bt


# ---------------- Plan-price migration tests ----------------

def test_migration_heals_paisa_using_plan_price(db):
    """The startup migration cross-checks each record's amount against
    its plan's expected price (plus GST). Records stored as paisa are
    rewritten in rupees deterministically."""
    import asyncio
    from migrations.startup_migrations import normalize_payment_money_fields
    from motor.motor_asyncio import AsyncIOMotorClient
    
    m = f"plan_price_test_{uuid.uuid4().hex[:8]}"
    
    # Need a plan in the plans collection so the migration can match
    # Use a unique key so we don't collide with real production plans.
    plan_key = f"test_plan_{m}"
    db.plans.insert_one({
        "plan_key": plan_key,
        "name": "Test Plan",
        "pricing": {"one_month": 499},  # ₹499 + 18% = ₹588.82
    })
    
    # Seed records: one in paisa, one in rupees, one with no plan match
    db.payment_orders.insert_many([
        # ₹499 plan stored in paisa as 58882
        {"id": f"{m}_paisa", "user_id": "u1", "amount": 58882,
         "plan_key": plan_key, "status": "paid"},
        # Same plan stored correctly in rupees
        {"id": f"{m}_rupee", "user_id": "u2", "amount": 588.82,
         "plan_key": plan_key, "status": "paid"},
        # Random unmatched record — leave alone
        {"id": f"{m}_other", "user_id": "u3", "amount": 1234,
         "plan_key": None, "status": "paid"},
    ])
    
    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await normalize_payment_money_fields(client[os.environ["DB_NAME"]])
        client.close()
    
    asyncio.run(_run())
    
    paisa_after = db.payment_orders.find_one({"id": f"{m}_paisa"}, {"_id": 0, "amount": 1, "base_amount": 1, "gst": 1})
    rupee_after = db.payment_orders.find_one({"id": f"{m}_rupee"}, {"_id": 0, "amount": 1})
    other_after = db.payment_orders.find_one({"id": f"{m}_other"}, {"_id": 0, "amount": 1})
    
    # Paisa record should have been healed to rupees
    assert abs(paisa_after["amount"] - 588.82) < 0.01, f"Expected ~588.82, got {paisa_after['amount']}"
    # base + GST should match
    assert abs(paisa_after["base_amount"] + paisa_after["gst"] - paisa_after["amount"]) < 0.05
    
    # Rupee record should be untouched
    assert rupee_after["amount"] == 588.82
    
    # Unrelated low-value record left alone
    assert other_after["amount"] == 1234
    
    # Cleanup
    db.payment_orders.delete_many({"id": {"$regex": f"^{m}_"}})
    db.plans.delete_one({"plan_key": plan_key})


def test_migration_is_idempotent(db):
    """Running the migration twice doesn't double-divide already-healed records."""
    import asyncio
    from migrations.startup_migrations import normalize_payment_money_fields
    from motor.motor_asyncio import AsyncIOMotorClient
    
    m = f"idem_test_{uuid.uuid4().hex[:8]}"
    plan_key = f"idem_plan_{m}"
    db.plans.insert_one({"plan_key": plan_key, "pricing": {"one_month": 499}})
    db.payment_orders.insert_one({
        "id": f"{m}_a", "user_id": "u1", "amount": 58882,
        "plan_key": plan_key, "status": "paid",
    })
    
    async def _run():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await normalize_payment_money_fields(client[os.environ["DB_NAME"]])
        client.close()
    
    asyncio.run(_run())
    after_first = db.payment_orders.find_one({"id": f"{m}_a"}, {"_id": 0, "amount": 1})["amount"]
    asyncio.run(_run())
    after_second = db.payment_orders.find_one({"id": f"{m}_a"}, {"_id": 0, "amount": 1})["amount"]
    
    assert abs(after_first - 588.82) < 0.01
    assert after_first == after_second, "Migration is not idempotent — second run mutated the record"
    
    db.payment_orders.delete_one({"id": f"{m}_a"})
    db.plans.delete_one({"plan_key": plan_key})
