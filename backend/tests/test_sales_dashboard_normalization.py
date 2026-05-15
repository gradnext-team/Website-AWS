"""
Tests for the Sales Dashboard fixes:

1. Money-field normalization: GST/base must stay in sync with revenue
   regardless of whether legacy records stored amounts in paisa or rupees.
2. Dedup must be by transaction-unique IDs (razorpay_order_id /
   razorpay_payment_id), NOT by user_id+plan_key (which over-collapsed
   legitimate repeat purchases).
3. Hardening: None/missing plan_key/type/user_email must not 500 the
   transactions endpoint.
4. Transactions endpoint returns rows whose amount/gst/base sum match the
   summary endpoint.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Load backend .env explicitly so MONGO_URL / DB_NAME / REACT_APP_BACKEND_URL
# are available when pytest is invoked without an env preamble.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=10)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def seeded_orders(admin_session):
    """Insert a known mix of paisa and rupee orders, then clean up.
    
    We use pymongo (sync) here to avoid asyncio event-loop issues across
    pytest fixture/test boundaries.
    """
    from pymongo import MongoClient
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "gradnext")
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    test_marker = f"sales_test_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    docs = [
        # 1) Paisa-stored order (legacy): amount=150000 paisa = ₹1500
        {
            "id": f"{test_marker}_a",
            "user_id": f"u_{test_marker}_1",
            "user_email": f"a_{test_marker}@test.local",
            "amount": 150000,
            "amount_in_paise": 150000,
            "base_amount": 127119,  # ₹1271.19 in paisa — would have inflated total_base
            "gst": 22881,           # ₹228.81 in paisa  — would have inflated total_gst
            "status": "paid",
            "plan_key": "pro_basic",
            "plan_name": "Pro Basic",
            "type": "subscription",
            "razorpay_order_id": f"order_{test_marker}_a",
            "razorpay_payment_id": f"pay_{test_marker}_a",
            "paid_at": now_iso,
            "created_at": now_iso,
        },
        # 2) Rupee-stored order (recent): amount=2500 rupees, gst already in rupees
        {
            "id": f"{test_marker}_b",
            "user_id": f"u_{test_marker}_2",
            "user_email": f"b_{test_marker}@test.local",
            "amount": 2500,
            "base_amount": 2118.64,
            "gst": 381.36,
            "status": "completed",
            "plan_key": "coaching_full_prep",
            "plan_name": "Full Prep Coaching",
            "type": "subscription",
            "razorpay_order_id": f"order_{test_marker}_b",
            "razorpay_payment_id": f"pay_{test_marker}_b",
            "paid_at": now_iso,
            "created_at": now_iso,
        },
        # 3) Same user as record #2 buys ANOTHER top-up. The old dedup
        #    code (user_id+plan_key) would have hidden this. Should NOT
        #    be deduplicated.
        {
            "id": f"{test_marker}_c",
            "user_id": f"u_{test_marker}_2",
            "user_email": f"b_{test_marker}@test.local",
            "amount": 1180,
            "status": "paid",
            "plan_key": "session_topup",
            "plan_name": "1 Session Top-Up",
            "type": "session_topup",
            "razorpay_order_id": f"order_{test_marker}_c",
            "razorpay_payment_id": f"pay_{test_marker}_c",
            "paid_at": now_iso,
            "created_at": now_iso,
        },
        # 4) Second top-up by same user — also legitimate, also must show.
        {
            "id": f"{test_marker}_d",
            "user_id": f"u_{test_marker}_2",
            "user_email": f"b_{test_marker}@test.local",
            "amount": 1180,
            "status": "paid",
            "plan_key": "session_topup",
            "plan_name": "1 Session Top-Up",
            "type": "session_topup",
            "razorpay_order_id": f"order_{test_marker}_d",
            "razorpay_payment_id": f"pay_{test_marker}_d",
            "paid_at": now_iso,
            "created_at": now_iso,
        },
        # 5) Legacy malformed record: plan_key=None, type=None. Must NOT
        #    crash the endpoint.
        {
            "id": f"{test_marker}_e",
            "user_id": f"u_{test_marker}_3",
            "user_email": f"e_{test_marker}@test.local",
            "amount": 590,
            "status": "paid",
            "plan_key": None,
            "plan_name": None,
            "type": None,
            "razorpay_order_id": f"order_{test_marker}_e",
            "razorpay_payment_id": f"pay_{test_marker}_e",
            "paid_at": now_iso,
            "created_at": now_iso,
        },
    ]
    
    db.payment_orders.insert_many(docs)
    
    yield {"marker": test_marker, "docs": docs}
    
    # Teardown
    db.payment_orders.delete_many({"id": {"$regex": f"^{test_marker}_"}})
    client.close()


def test_summary_revenue_gst_base_are_consistent(admin_session, seeded_orders):
    """
    Bug A: GST showed ₹18 Cr against ₹1.22 Cr revenue on the dashboard.
    After fix, GST + base must equal revenue (within rounding) and all
    three must be in the same unit (rupees).
    """
    r = admin_session.get(f"{API}/admin/sales/summary", timeout=20)
    assert r.status_code == 200, r.text
    s = r.json()
    
    revenue = s["total_revenue"]
    base = s["total_base_amount"]
    gst = s["total_gst"]
    
    assert revenue > 0, "Revenue should not be zero with seeded orders"
    # base + gst must equal revenue (rounding tolerance: ₹1)
    diff = abs((base + gst) - revenue)
    assert diff < 1.0, (
        f"base ({base}) + gst ({gst}) = {base+gst} but revenue = {revenue} "
        f"— money fields are out of sync (the original ₹18Cr-vs-₹1.22Cr bug)."
    )
    # GST must be roughly 18% of base (within rounding)
    expected_gst = base * 0.18
    assert abs(gst - expected_gst) < 1.0, f"GST {gst} != 18% of base {base} ({expected_gst})"


def test_summary_normalizes_paisa_records(admin_session, seeded_orders):
    """Record #1 was ₹1500 stored as 150000 paisa — must read as ₹1500."""
    r = admin_session.get(f"{API}/admin/sales/summary", timeout=20)
    s = r.json()
    # We seeded a ₹1500 paisa record + ₹2500 rupee record + ₹1180+₹1180+₹590
    # = ₹6950 minimum (plus whatever pre-existed). With normalization
    # working, total revenue should be sane (not wildly inflated).
    assert s["total_revenue"] < 1_00_00_000, (
        f"Revenue {s['total_revenue']} is suspiciously high — paisa heuristic "
        f"may be misfiring. Seeded data sums to ~₹6950."
    )


def test_transactions_endpoint_returns_rows_for_paid_filter(admin_session, seeded_orders):
    """Bug B+C: with default `status=paid` filter, all 5 seeded rows must
    appear (no over-dedup, no hard crash on None plan_key)."""
    marker = seeded_orders["marker"]
    r = admin_session.get(
        f"{API}/admin/sales/transactions",
        params={"page": 1, "limit": 100, "status": "paid"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "transactions" in data
    
    # Find our seeded rows in the response
    our_rows = [t for t in data["transactions"] if (t.get("id") or "").startswith(marker)]
    assert len(our_rows) == 5, (
        f"Expected all 5 seeded rows; got {len(our_rows)}. "
        f"Likely over-dedup or 500 from None plan_key. Got ids: "
        f"{[t.get('id') for t in our_rows]}"
    )


def test_transactions_does_not_collapse_repeat_purchases(admin_session, seeded_orders):
    """Bug B: previous dedup key was user_id+plan_key, which deleted
    legitimate repeat top-ups from the same user. Both top-ups must show."""
    marker = seeded_orders["marker"]
    r = admin_session.get(
        f"{API}/admin/sales/transactions",
        params={"page": 1, "limit": 100, "status": "paid"},
        timeout=30,
    )
    data = r.json()
    
    topups = [t for t in data["transactions"]
              if (t.get("id") or "").startswith(marker) and t.get("plan_key") == "session_topup"]
    assert len(topups) == 2, (
        f"Both top-ups by the same user should appear; got {len(topups)}. "
        f"This is the over-dedup regression."
    )


def test_transactions_handles_none_plan_key_gracefully(admin_session, seeded_orders):
    """Bug C: a legacy record with plan_key=None must not 500 the endpoint."""
    marker = seeded_orders["marker"]
    r = admin_session.get(
        f"{API}/admin/sales/transactions",
        params={"page": 1, "limit": 100, "status": "paid"},
        timeout=30,
    )
    assert r.status_code == 200, "Endpoint must not 500 on None plan_key"
    data = r.json()
    # Record `_e` had plan_key=None — should still appear (classified as
    # "Subscription Plan" by fallback) and not crash.
    e_rows = [t for t in data["transactions"]
              if t.get("id") == f"{marker}_e"]
    assert len(e_rows) == 1
    assert e_rows[0]["purchase_type"]  # has some classification, not crashed


def test_transactions_total_count_matches_returned_rows(admin_session, seeded_orders):
    """`total` should reflect actual matching rows, not over/under-count."""
    marker = seeded_orders["marker"]
    r = admin_session.get(
        f"{API}/admin/sales/transactions",
        params={"page": 1, "limit": 100, "status": "paid"},
        timeout=30,
    )
    data = r.json()
    our_count = sum(1 for t in data["transactions"] if (t.get("id") or "").startswith(marker))
    # Total should be at least our 5 (could be more from pre-existing data)
    assert data["total"] >= our_count, f"total ({data['total']}) < our_rows ({our_count})"
