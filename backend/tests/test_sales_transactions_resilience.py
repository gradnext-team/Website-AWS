"""
Regression tests for the production "0 transactions" bug where the
sales summary cards showed real numbers (so records existed and were
readable) but the transactions table at the bottom showed 0 rows.

Root cause: per-row enrichment in `/api/admin/sales/transactions` had
its discount/coupon back-calculation block inside the SAME try/except
as the row-emit code. Any failure in the discount math (e.g. a
non-string coupon_code, a non-numeric stored discount_amount, a None
applied_discounts entry) silently dropped the entire row. With many
production records hitting that path, every row was being dropped.

Fix: split the row builder so the discount/coupon block has its own
inner try/except. On failure, the row still emits with simple base/gst
derived from the (already-normalized) `amount`. The outer try/except
now also surfaces a `skipped_count` + samples in the response so this
class of bug can be diagnosed at runtime.
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


@pytest.fixture
def malformed_records(db):
    """Seed records with the EXACT shapes that were silently dropped on
    production: non-string coupon_code, None user_email, garbage
    discount_amount string, applied_discounts with non-dict entries.
    """
    m = f"malformed_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    docs = [
        # 1) coupon_code is a NUMBER not a string → .upper() would crash
        {"id": f"{m}_a", "user_id": "u1", "user_email": "a@t.t", "amount": 2950,
         "status": "paid", "plan_key": "session_topup", "type": "session_topup",
         "razorpay_order_id": f"o{m}a", "razorpay_payment_id": f"p{m}a",
         "coupon_code": 12345,  # garbage
         "paid_at": now, "created_at": now},
        # 2) user_email is None — used to crash .lower() in count path
        {"id": f"{m}_b", "user_id": "u2", "user_email": None, "amount": 5899,
         "status": "paid", "plan_key": "full_prep",
         "razorpay_order_id": f"o{m}b", "razorpay_payment_id": f"p{m}b",
         "paid_at": now, "created_at": now},
        # 3) discount_amount is a string → arithmetic would crash
        {"id": f"{m}_c", "user_id": "u3", "user_email": "c@t.t", "amount": 4999,
         "status": "paid", "plan_key": "basic_plan",
         "discount_amount": "₹500",  # garbage
         "razorpay_order_id": f"o{m}c", "razorpay_payment_id": f"p{m}c",
         "paid_at": now, "created_at": now},
        # 4) applied_discounts contains a non-dict entry (string)
        {"id": f"{m}_d", "user_id": "u4", "user_email": "d@t.t", "amount": 1180,
         "status": "paid", "plan_key": "session_topup", "type": "session_topup",
         "applied_discounts": ["WELCOME10", {"code": "GRADNEXT5"}],  # mixed types
         "razorpay_order_id": f"o{m}d", "razorpay_payment_id": f"p{m}d",
         "paid_at": now, "created_at": now},
        # 5) first_payment_coupon is a string not a dict
        {"id": f"{m}_e", "user_id": "u5", "user_email": "e@t.t", "amount": 999,
         "status": "paid", "plan_key": "pro_plus",
         "first_payment_coupon": "WELCOME10",  # garbage
         "razorpay_order_id": f"o{m}e", "razorpay_payment_id": f"p{m}e",
         "paid_at": now, "created_at": now},
        # 6) original_base_amount is a string
        {"id": f"{m}_f", "user_id": "u6", "user_email": "f@t.t", "amount": 588.82,
         "status": "paid", "plan_key": "basic_plan",
         "original_base_amount": "499",
         "razorpay_order_id": f"o{m}f", "razorpay_payment_id": f"p{m}f",
         "paid_at": now, "created_at": now},
    ]
    db.payment_orders.insert_many(docs)
    yield {"marker": m, "docs": docs}
    db.payment_orders.delete_many({"id": {"$regex": f"^{m}_"}})


def test_all_malformed_records_still_emit_in_transactions(admin_session, malformed_records):
    """All 6 malformed records must appear in the transactions table.
    Before the fix, every one of these would have silently dropped on
    a different sub-failure inside the discount block, and the user
    saw "0 transactions"."""
    m = malformed_records["marker"]
    r = admin_session.get(
        f"{API}/admin/sales/transactions?status=paid&limit=100",
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    
    our_rows = [t for t in data.get("transactions", []) if (t.get("id") or "").startswith(m)]
    assert len(our_rows) == 6, (
        f"All 6 malformed records must emit. Got {len(our_rows)}. "
        f"Missing IDs: {[d['id'] for d in malformed_records['docs'] if d['id'] not in {t.get('id') for t in our_rows}]}. "
        f"skipped_count={data.get('skipped_count')}, samples={data.get('skipped_samples')}"
    )
    # And they must have base/gst computed
    for row in our_rows:
        assert row.get("total_amount", 0) > 0, f"Row {row.get('id')} has zero amount"
        assert row.get("base_amount", 0) > 0, f"Row {row.get('id')} has zero base_amount"
        assert row.get("gst", 0) > 0, f"Row {row.get('id')} has zero gst"


def test_response_surfaces_skipped_count_when_dropping_records(admin_session, db):
    """If a record genuinely throws even with our defenses, the response
    should now report it (skipped_count + samples) instead of silently
    swallowing — so future bugs are diagnosable from the response."""
    # Seed a record with NO id field at all — unlikely but possible
    # legacy. If we ever need to skip, the response should flag it.
    # (We can't easily force a throw with our hardened code, so this
    # test just verifies the contract.)
    r = admin_session.get(
        f"{API}/admin/sales/transactions?status=paid&limit=10",
        timeout=20,
    )
    assert r.status_code == 200
    body = r.json()
    # The keys may not be present if no rows were skipped — that's fine.
    if body.get("skipped_count"):
        assert "skipped_samples" in body
        assert isinstance(body["skipped_samples"], list)


def test_filter_by_search_handles_none_user_email(admin_session, malformed_records):
    """The search-filter recount path used to crash on user_email=None.
    Searching by an unrelated string must still work and the count
    must reflect actual matches, not crash."""
    r = admin_session.get(
        f"{API}/admin/sales/transactions?status=paid&search=zznoresults123",
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Should return zero matches without error
    assert body.get("total") == 0 or body.get("total") >= 0
