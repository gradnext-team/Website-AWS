"""
Regression tests for the production "duplicate transactions" bug where
the Sales Panel `/api/admin/sales/transactions` endpoint was returning
~2× the real number of transactions because the dedup between
`payment_orders` and `payments` collections relied solely on exact
Razorpay ID matches — and production has legacy records where those
IDs are missing or mismatched between the two collections.

Fix: `_merge_orders_and_payments` now drops captured payments that
match an order via:
  1. razorpay_order_id (exact)
  2. razorpay_payment_id (exact)
  3. fuzzy (user_id, rounded_amount, day) tuple — for legacy records
     that lack Razorpay IDs on one side.

These tests construct the exact production shapes seen in the field
and assert no duplicates survive, while subscription-only payments
(which have no payment_orders counterpart) are correctly preserved.
"""
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes.sales_admin import (  # noqa: E402
    _merge_orders_and_payments,
    _fuzzy_composite_key,
    _build_order_dedup_index,
)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def test_strict_match_by_razorpay_order_id():
    """payment_orders has razorpay_order_id, payments has the same →
    payment is the duplicate, must be dropped."""
    now = _now_iso()
    orders = [{
        "id": "po_1", "user_id": "u1", "amount": 5000,
        "razorpay_order_id": "order_AAA", "razorpay_payment_id": "pay_AAA",
        "paid_at": now,
    }]
    payments = [{
        "id": "p_1", "user_id": "u1", "amount": 5000,
        "razorpay_order_id": "order_AAA", "razorpay_payment_id": "pay_AAA",
        "captured_at": now,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 1
    assert stats["dropped_by_razorpay_order_id"] == 1
    assert stats["payments_kept"] == 0


def test_strict_match_by_razorpay_payment_id_when_order_id_missing():
    """payment_orders has razorpay_payment_id but no order_id; payments
    has only razorpay_payment_id → still dedups."""
    now = _now_iso()
    orders = [{
        "id": "po_2", "user_id": "u2", "amount": 1180,
        "razorpay_order_id": "", "razorpay_payment_id": "pay_BBB",
        "paid_at": now,
    }]
    payments = [{
        "id": "p_2", "user_id": "u2", "amount": 1180,
        "razorpay_order_id": "", "razorpay_payment_id": "pay_BBB",
        "captured_at": now,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 1
    assert stats["dropped_by_razorpay_payment_id"] == 1


def test_fuzzy_match_when_no_razorpay_ids_on_either_side():
    """Legacy records: payment_orders has no Razorpay IDs (manual sale or
    legacy import), and the corresponding payments row is the same user
    + same amount + same day. Fuzzy match catches it."""
    when = datetime.now(timezone.utc).isoformat()
    orders = [{
        "id": "po_3", "user_id": "u3", "amount": 4999,
        "razorpay_order_id": None, "razorpay_payment_id": None,
        "paid_at": when,
    }]
    payments = [{
        "id": "p_3", "user_id": "u3", "amount": 4999,
        "razorpay_order_id": "", "razorpay_payment_id": "",
        "captured_at": when,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 1
    assert stats["dropped_by_fuzzy_user_amount_day"] == 1


def test_subscription_payment_with_no_corresponding_order_is_kept():
    """Subscription charges insert ONLY into payments (no payment_orders
    counterpart). They must NOT be dropped — they are real revenue."""
    now = _now_iso()
    orders = []  # No payment_orders for subscriptions
    payments = [{
        "id": "sub-pay-1", "user_id": "u4", "amount": 999,
        "razorpay_subscription_id": "sub_xxx",
        "razorpay_order_id": "", "razorpay_payment_id": "",
        "type": "subscription",
        "captured_at": now,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 1
    assert stats["payments_kept"] == 1


def test_two_distinct_purchases_same_day_are_both_kept():
    """A user buying TWO different things on the same day at different
    amounts must NOT collapse — fuzzy key uses rounded amount, so they
    are distinct."""
    now = _now_iso()
    orders = [
        {"id": "po_a", "user_id": "u5", "amount": 999,
         "razorpay_order_id": "order_X", "paid_at": now},
        {"id": "po_b", "user_id": "u5", "amount": 5000,
         "razorpay_order_id": "order_Y", "paid_at": now},
    ]
    payments = []
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 2


def test_two_genuine_same_amount_purchases_NOT_collapsed_by_fuzzy_when_ids_present():
    """Edge case: a user could legitimately buy the same plan twice in
    one day (e.g. two top-ups). When BOTH sides have distinct Razorpay
    IDs, exact-match fails, and fuzzy would over-collapse — so we
    accept this as a known limitation and rely on Razorpay IDs to
    differentiate. Production reality: payment_orders + payments for
    the SAME purchase share a razorpay_order_id, so fuzzy is only a
    fallback for legacy records without IDs.
    
    Here we simulate two GENUINE separate purchases each with its own
    payment_orders + matching payments record. Each should dedupe its
    own payments side, leaving 2 rows total — not 4 and not 1.
    """
    now = _now_iso()
    orders = [
        {"id": "po_x", "user_id": "u6", "amount": 2950,
         "razorpay_order_id": "order_X1", "razorpay_payment_id": "pay_X1",
         "paid_at": now},
        {"id": "po_y", "user_id": "u6", "amount": 2950,
         "razorpay_order_id": "order_X2", "razorpay_payment_id": "pay_X2",
         "paid_at": now},
    ]
    payments = [
        {"id": "p_x", "user_id": "u6", "amount": 2950,
         "razorpay_order_id": "order_X1", "razorpay_payment_id": "pay_X1",
         "captured_at": now},
        {"id": "p_y", "user_id": "u6", "amount": 2950,
         "razorpay_order_id": "order_X2", "razorpay_payment_id": "pay_X2",
         "captured_at": now},
    ]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 2
    assert stats["dropped_by_razorpay_order_id"] == 2


def test_legacy_mismatch_order_has_id_payment_lacks_id():
    """payment_orders has razorpay_order_id "order_Z", but the matching
    payments row has empty razorpay_order_id (legacy import / data
    corruption). With the SAME user_id + amount + day, fuzzy still
    catches this and deduplicates."""
    when = datetime.now(timezone.utc).isoformat()
    orders = [{
        "id": "po_z", "user_id": "u7", "amount": 5899,
        "razorpay_order_id": "order_Z", "razorpay_payment_id": "pay_Z",
        "paid_at": when,
    }]
    payments = [{
        "id": "p_z", "user_id": "u7", "amount": 5899,
        "razorpay_order_id": None, "razorpay_payment_id": None,
        "captured_at": when,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 1
    assert stats["dropped_by_fuzzy_user_amount_day"] == 1


def test_no_match_different_users_same_amount():
    """Different users, same amount, same day → NOT a duplicate."""
    when = _now_iso()
    orders = [{
        "id": "po_q", "user_id": "alice", "amount": 999,
        "razorpay_order_id": "order_Q", "paid_at": when,
    }]
    payments = [{
        "id": "p_q", "user_id": "bob", "amount": 999,
        "razorpay_order_id": "", "captured_at": when,
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 2
    assert stats["payments_kept"] == 1


def test_no_match_different_days():
    """Same user + amount but different days → NOT a duplicate."""
    today = datetime.now(timezone.utc)
    yesterday = today - timedelta(days=2)
    orders = [{
        "id": "po_d", "user_id": "u8", "amount": 1180,
        "razorpay_order_id": "order_D", "paid_at": today.isoformat(),
    }]
    payments = [{
        "id": "p_d", "user_id": "u8", "amount": 1180,
        "razorpay_order_id": "", "captured_at": yesterday.isoformat(),
    }]
    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 2


def test_fuzzy_key_returns_none_for_missing_fields():
    """Fuzzy key must return None on missing user_id, missing amount, or
    missing date — never accidentally false-match."""
    assert _fuzzy_composite_key({"amount": 100, "paid_at": _now_iso()}) is None
    assert _fuzzy_composite_key({"user_id": "u", "paid_at": _now_iso()}) is None
    assert _fuzzy_composite_key({"user_id": "u", "amount": 100}) is None
    assert _fuzzy_composite_key({"user_id": "u", "amount": 0, "paid_at": _now_iso()}) is None


def test_dedup_index_excludes_empty_strings():
    """An order with razorpay_order_id="" must not poison the lookup
    set (otherwise every payment with an empty razorpay_order_id would
    match)."""
    by_oid, by_pid, by_fuzzy = _build_order_dedup_index([
        {"id": "po_e", "user_id": "u9", "amount": 100,
         "razorpay_order_id": "", "razorpay_payment_id": "",
         "paid_at": _now_iso()},
    ])
    assert "" not in by_oid
    assert "" not in by_pid


def test_production_scenario_127_real_vs_255_observed():
    """Simulate the production scenario the user reported: ~127 real
    transactions but the endpoint returned ~255 because the dedup
    failed. After the fix, merged_total must equal the real count."""
    today = datetime.now(timezone.utc).isoformat()
    # 100 normal Razorpay-flow purchases (both sides have IDs)
    orders = []
    payments = []
    for i in range(100):
        oid = f"order_{i}"
        pid = f"pay_{i}"
        orders.append({
            "id": f"po_{i}", "user_id": f"user_{i}", "amount": 1000 + i,
            "razorpay_order_id": oid, "razorpay_payment_id": pid,
            "paid_at": today,
        })
        payments.append({
            "id": f"p_{i}", "user_id": f"user_{i}", "amount": 1000 + i,
            "razorpay_order_id": oid, "razorpay_payment_id": pid,
            "captured_at": today,
        })
    # 27 legacy records where payment_orders has no Razorpay IDs but
    # payments side does (or vice versa) — only fuzzy catches these.
    for i in range(100, 127):
        orders.append({
            "id": f"po_{i}", "user_id": f"user_{i}", "amount": 2000 + i,
            "razorpay_order_id": None, "razorpay_payment_id": None,
            "paid_at": today,
        })
        payments.append({
            "id": f"p_{i}", "user_id": f"user_{i}", "amount": 2000 + i,
            "razorpay_order_id": None, "razorpay_payment_id": None,
            "captured_at": today,
        })

    merged, stats = _merge_orders_and_payments(orders, payments)
    assert len(merged) == 127, (
        f"Expected 127 merged transactions, got {len(merged)}. Stats={stats}"
    )
    assert stats["dropped_by_razorpay_order_id"] == 100
    assert stats["dropped_by_fuzzy_user_amount_day"] == 27
