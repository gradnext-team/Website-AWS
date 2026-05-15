"""
Comprehensive Sales Admin API Routes
Provides detailed sales tracking, GST breakdown, user purchase history, and export functionality
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import csv
import io
import logging

logger = logging.getLogger(__name__)

from routes.auth import get_current_user, get_db
from services.google_sheets_service import update_user_upgrade_in_sheet

router = APIRouter(prefix="/admin/sales", tags=["admin-sales"])

# GST Rate (18% for digital services in India)
GST_RATE = 0.18


# ---- Amount normalization helpers ----
# The codebase has historical inconsistency: some payment records store
# `amount` in rupees (recent), others in paisa (legacy / direct Razorpay
# webhook records). The same applies to `gst` and `base_amount`. We must
# normalize ALL three together — never one in isolation, or sums will be
# off by 100× (which is exactly what was happening on the production
# Sales Dashboard: GST showed ~₹18 Cr against ₹1.22 Cr revenue).
def _normalize_money_field(raw, paise_hint: bool = False) -> float:
    """Convert a possibly-paisa amount to rupees.
    
    Heuristic order (most reliable first):
      1. `paise_hint=True` from caller (e.g. `amount == amount_in_paise`)
         → it's definitely paisa, divide by 100.
      2. `raw > 50000` → too high for any legit single-tx rupee amount
         (max plan ₹44,999; max single session ~₹4999) → paisa.
      3. Otherwise treat as rupees.
    
    Note: we deliberately do NOT use a "divisible by 100" fingerprint
    here — legitimate rupee amounts like ₹5,000 (a flat coaching plan)
    or ₹2,500 (a single session) are also divisible by 100, and false-
    flagging them caused the production "Coaching Plan = ₹59" bug. The
    smarter paisa healing now happens at the migration level, where we
    cross-check each record against its plan's expected price — a
    deterministic check rather than a guess.
    """
    try:
        raw = float(raw or 0)
    except (TypeError, ValueError):
        return 0.0
    if raw <= 0:
        return 0.0
    if paise_hint:
        return raw / 100.0
    if raw > 50000:  # higher than any legit single-tx rupee amount
        return raw / 100.0
    return raw


def _normalize_order_money(order: dict) -> None:
    """Normalize amount/base_amount/gst on an order dict in-place.
    
    If `amount_in_paise` exists and equals `amount`, the record was stored
    in paisa: divide all three money fields by 100 consistently.
    Otherwise, apply the >₹1L heuristic per-field.
    """
    raw_amount = order.get("amount") or 0
    paise_field = order.get("amount_in_paise")
    paise_hint = bool(paise_field) and float(paise_field or 0) == float(raw_amount or 0)
    
    order["amount"] = round(_normalize_money_field(raw_amount, paise_hint), 2)
    if order.get("base_amount") is not None:
        order["base_amount"] = round(_normalize_money_field(order.get("base_amount"), paise_hint), 2)
    if order.get("gst") is not None:
        order["gst"] = round(_normalize_money_field(order.get("gst"), paise_hint), 2)
    if order.get("gst_amount") is not None:
        order["gst_amount"] = round(_normalize_money_field(order.get("gst_amount"), paise_hint), 2)


# ---- Dedup helpers (single source of truth used by /summary and /transactions) ----

def _to_datetime(v):
    """Best-effort coerce a paid_at/created_at value to a tz-aware datetime
    or return None. Production stores a mix of datetime, ISO strings, and
    sometimes garbage; never raise."""
    if not v:
        return None
    if hasattr(v, "isoformat"):  # already datetime
        try:
            return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        except Exception:  # noqa: BLE001
            return None
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:  # noqa: BLE001
            return None
    return None


def _fuzzy_composite_key(rec: dict):
    """Build a (user_id, rounded_amount_int, day_bucket_iso) tuple for
    fuzzy matching legacy records that lack Razorpay IDs on one side.
    Returns None if any required field is missing — never matches by
    accident."""
    uid = rec.get("user_id")
    if not uid:
        return None
    try:
        amt = float(rec.get("amount") or 0)
    except (TypeError, ValueError):
        return 0
    if amt <= 0:
        return None
    when = _to_datetime(rec.get("paid_at") or rec.get("captured_at") or rec.get("created_at"))
    if not when:
        return None
    # Round amount to nearest rupee, bucket by calendar date in UTC.
    return (str(uid), int(round(amt)), when.date().isoformat())


def _build_order_dedup_index(orders):
    """From the canonical (payment_orders) side, build three lookup sets:
      - razorpay_order_ids
      - razorpay_payment_ids
      - fuzzy composite keys (user_id, rounded_amount, day)
    Each set excludes empty / falsy values so legacy nulls don't false-match.
    """
    by_order_id = set()
    by_payment_id = set()
    by_fuzzy = set()
    for o in orders:
        roid = (o.get("razorpay_order_id") or "").strip()
        rpid = (o.get("razorpay_payment_id") or "").strip()
        if roid:
            by_order_id.add(roid)
        if rpid:
            by_payment_id.add(rpid)
        fk = _fuzzy_composite_key(o)
        if fk:
            by_fuzzy.add(fk)
    return by_order_id, by_payment_id, by_fuzzy


def _is_payment_duplicate_of_orders(payment, by_order_id, by_payment_id, by_fuzzy):
    """A captured `payments` row is a duplicate of a `payment_orders` row if:
      1. razorpay_order_id matches one in by_order_id, OR
      2. razorpay_payment_id matches one in by_payment_id, OR
      3. (user_id, rounded_amount, day) tuple matches by_fuzzy
         AND the payment lacks razorpay IDs that would have caught it
         (this last guard prevents collapsing two genuine same-day
         purchases of the same plan by the same user — but those
         legitimately have distinct Razorpay IDs that already de-dup).
    """
    roid = (payment.get("razorpay_order_id") or "").strip()
    rpid = (payment.get("razorpay_payment_id") or "").strip()
    if roid and roid in by_order_id:
        return True
    if rpid and rpid in by_payment_id:
        return True
    # Fuzzy: only when both ID fields are present in BOTH sides we trust
    # the strict checks above. If either side is missing IDs, fall back
    # to fuzzy match — which is exactly the legacy production state.
    fk = _fuzzy_composite_key(payment)
    if fk and fk in by_fuzzy:
        return True
    return False


def _merge_orders_and_payments(orders, payments):
    """Single source of truth for combining payment_orders + captured payments.
    Keeps every order; drops any payment that maps to an existing order via
    razorpay_order_id, razorpay_payment_id, or fuzzy (user, amount, day).
    Returns: (merged_list, dedup_stats_dict)
    """
    by_order_id, by_payment_id, by_fuzzy = _build_order_dedup_index(orders)
    kept = []
    dropped_by_order_id = 0
    dropped_by_payment_id = 0
    dropped_by_fuzzy = 0
    for p in payments:
        roid = (p.get("razorpay_order_id") or "").strip()
        rpid = (p.get("razorpay_payment_id") or "").strip()
        if roid and roid in by_order_id:
            dropped_by_order_id += 1
            continue
        if rpid and rpid in by_payment_id:
            dropped_by_payment_id += 1
            continue
        fk = _fuzzy_composite_key(p)
        if fk and fk in by_fuzzy:
            dropped_by_fuzzy += 1
            continue
        kept.append(p)
    stats = {
        "orders_count": len(orders),
        "payments_count": len(payments),
        "payments_kept": len(kept),
        "dropped_by_razorpay_order_id": dropped_by_order_id,
        "dropped_by_razorpay_payment_id": dropped_by_payment_id,
        "dropped_by_fuzzy_user_amount_day": dropped_by_fuzzy,
        "merged_total": len(orders) + len(kept),
    }
    return orders + kept, stats


# ============ DEBUG ENDPOINT (Temporary) ============

@router.get("/debug-summary")
async def debug_sales_summary(request: Request):
    """
    DEBUG ENDPOINT: shows what's actually being counted, after
    normalization, and broken down by purchase-type classification.
    Use this to audit production data when the dashboard numbers look
    off.
    """
    await verify_admin(request)
    db = get_db(request)
    
    paid_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},
        {"_id": 0}
    ).to_list(10000)
    
    captured_payments = await db.payments.find(
        {"status": "captured"},
        {"_id": 0}
    ).to_list(10000)
    
    # Normalize copies (don't mutate originals so the diff is visible)
    raw_payment_orders_sum = sum(o.get("amount", 0) or 0 for o in paid_orders)
    raw_payments_sum = sum(p.get("amount", 0) or 0 for p in captured_payments)
    
    # Apply normalization the same way `summary` does, then bucket.
    by_type: dict = {}
    by_type_count: dict = {}
    samples_by_type: dict = {}
    suspicious: list = []  # records whose normalized amount > ₹1L (likely paisa-survivors)
    
    all_records = []
    for o in paid_orders:
        o_copy = dict(o)
        _normalize_order_money(o_copy)
        all_records.append(o_copy)
    for p in captured_payments:
        p_copy = dict(p)
        p_copy["plan_key"] = p_copy.get("plan_key") or p_copy.get("type", "unknown")
        _normalize_order_money(p_copy)
        all_records.append(p_copy)
    
    for r in all_records:
        amt = r.get("amount", 0) or 0
        ptype = classify_purchase_type(r)
        by_type[ptype] = by_type.get(ptype, 0) + amt
        by_type_count[ptype] = by_type_count.get(ptype, 0) + 1
        if ptype not in samples_by_type:
            samples_by_type[ptype] = []
        if len(samples_by_type[ptype]) < 3:
            samples_by_type[ptype].append({
                "id": r.get("id"),
                "plan_key": r.get("plan_key"),
                "type_field": r.get("type"),
                "plan_name": r.get("plan_name"),
                "raw_amount": r.get("amount"),
                "normalized_amount": amt,
            })
        if amt > 100000:
            suspicious.append({
                "id": r.get("id"),
                "plan_key": r.get("plan_key"),
                "amount_after_normalize": amt,
                "raw_amount_field": r.get("amount"),
                "amount_in_paise_field": r.get("amount_in_paise"),
            })
    
    return {
        "raw_sums_before_normalization": {
            "payment_orders": raw_payment_orders_sum,
            "payments": raw_payments_sum,
            "total": raw_payment_orders_sum + raw_payments_sum,
        },
        "normalized_total_count": len(all_records),
        "by_purchase_type_after_normalize": {
            ptype: {
                "count": by_type_count[ptype],
                "sum": round(by_type[ptype], 2),
                "sum_formatted": f"₹{by_type[ptype]:,.2f}",
                "samples": samples_by_type[ptype],
            }
            for ptype in by_type
        },
        "suspicious_records_above_1L": suspicious[:20],
        "suspicious_count": len(suspicious),
        "hint": (
            "If `Other` bucket is large, many records have plan_key=None / unrecognized. "
            "If `suspicious_count` is high, the paisa heuristic is missing those records."
        ),
    }


# ============ Admin Verification ============

async def verify_admin(request: Request):
    """Verify the current user is an admin"""
    user = await get_current_user(request)
    user_dict = user if isinstance(user, dict) else user.dict() if hasattr(user, 'dict') else user
    if not user_dict.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_dict


# ============ Purchase Type Classification ============

def classify_purchase_type(order: dict) -> str:
    """Classify the type of purchase based on order data.
    
    Bug-history note: the prior implementation used "Subscription Plan"
    as the catch-all fallback. Records with `plan_key=None`, weird legacy
    plan_keys, single-session bookings without a `type` field, etc. all
    fell into Subscription Plan and dramatically inflated that bucket
    (e.g. production showed ₹1.28 Cr for Subscription Plan when the
    actual subscription revenue was ~₹1 lakh). Fallback is now "Other".
    """
    # Defensive: any of these can be None on legacy records, which would
    # blow up `.lower()` and 500 the entire endpoint.
    order_type = (order.get("type") or "").lower()
    plan_key = (order.get("plan_key") or "").lower()
    plan_name = (order.get("plan_name") or "").lower()
    
    # 1. Explicit type field — most reliable signal.
    if order_type in ("single_coaching_session", "single_session_with_slot", "coaching_session"):
        return "Single Session"
    if order_type == "session_topup":
        return "Top-Up"
    if order_type == "strategy_call":
        return "Strategy Call"
    
    # 2. Plan-key/name based detection.
    if "cohort" in plan_key or "cohort" in plan_name:
        return "Cohort Plan"
    if any(x in plan_key for x in ["coaching", "last_mile", "mid_mile", "full_prep", "go_out", "go-out"]):
        return "Coaching Plan"
    # Strict subscription match — only the actual subscription plan_keys
    # we ship: basic_plan / pro_plan / pro_plus / *_subscription. Avoid
    # broad substring matches that swallow unrelated plan_keys.
    if any(x in plan_key for x in ["basic_plan", "pro_plan", "pro_plus", "subscription"]):
        return "Subscription Plan"
    if "addon" in plan_key or "add_on" in plan_key:
        return "Add-On"
    
    # 3. Fallback bucket — DO NOT default to "Subscription Plan".
    return "Other"


def format_purchase_details(order: dict) -> dict:
    """Format purchase details for display"""
    purchase_type = classify_purchase_type(order)
    
    # `type` may be None on legacy records — `.replace` would crash.
    fallback_name = (order.get("type") or "").replace("_", " ").title()
    details = {
        "type": purchase_type,
        "name": order.get("plan_name") or fallback_name,
    }
    
    if purchase_type == "Single Session":
        details["name"] = f"Single Session with {order.get('mentor_name', 'Mentor')}"
    elif purchase_type == "Top-Up":
        session_count = order.get("session_count", 1)
        details["name"] = f"{session_count} Session{'s' if session_count > 1 else ''} Top-Up"
        details["session_count"] = session_count
        details["discount_percent"] = order.get("discount_percent", 0)
    
    return details


# ============ Sales Dashboard Summary ============

@router.get("/summary")
async def get_sales_summary(request: Request):
    """
    Get comprehensive sales dashboard summary with revenue breakdown.
    
    **IMPORTANT**: Only counts COMPLETED/SUCCESSFUL payments:
    - payment_orders: status = "paid" or "completed"
    - payments: status = "captured" (Razorpay successful payment)
    
    Excludes: "pending", "created", "failed", "refunded" payments
    """
    await verify_admin(request)
    db = get_db(request)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # DEBUG: Log the query we're about to run
    import logging
    logger = logging.getLogger(__name__)
    
    # Get all COMPLETED/CAPTURED payments only (exclude pending, created, failed)
    # From payment_orders collection: only "paid" and "completed" status
    paid_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},  # Only successful payments
        {"_id": 0}
    ).to_list(10000)
    
    logger.info(f"DEBUG: Found {len(paid_orders)} paid_orders with status paid/completed")
    
    # Normalize money fields on EVERY payment_order (paisa→rupees if needed).
    # Critical: keep amount, base_amount AND gst in sync — historically only
    # `amount` was being normalized, which made GST/Base totals 100× larger
    # than revenue on the dashboard.
    for order in paid_orders:
        _normalize_order_money(order)
    
    # From payments collection: ONLY "captured" status (Razorpay successful payment)
    # This excludes: "created" / "pending" / "failed" / "refunded"
    captured_payments = await db.payments.find(
        {"status": "captured"},  # Only captured/successful payments
        {"_id": 0}
    ).to_list(10000)
    
    logger.info(f"DEBUG: Found {len(captured_payments)} payments with status captured")
    
    # Normalize captured payments: same money-field handling as orders.
    for payment in captured_payments:
        payment["status"] = "paid"  # Normalize status
        payment["plan_key"] = payment.get("plan_key") or payment.get("type", "unknown")
        payment["plan_name"] = payment.get("plan_name", payment.get("type", "Payment"))
        _normalize_order_money(payment)
        # If GST still missing, derive from normalized amount
        if not payment.get("gst") and payment.get("amount"):
            payment["base_amount"] = round(payment["amount"] / (1 + GST_RATE), 2)
            payment["gst"] = round(payment["amount"] - payment["base_amount"], 2)
        payment["paid_at"] = payment.get("captured_at") or payment.get("paid_at") or payment.get("created_at")
    
    # Deduplicate using the shared helper (single source of truth for both
    # /summary and /transactions). Handles exact razorpay_order_id /
    # razorpay_payment_id matches AND a fuzzy (user_id, amount, day)
    # fallback for legacy records where Razorpay IDs are missing/mismatched
    # between the two collections.
    paid_orders, dedup_stats = _merge_orders_and_payments(paid_orders, captured_payments)
    logger.info(f"DEBUG: /summary dedup stats: {dedup_stats}")
    
    # Calculate totals — ALWAYS recompute base/gst from the normalized
    # `amount` so all three numbers stay in the same unit. We do not trust
    # the stored `gst`/`base_amount` to be in rupees because legacy records
    # store them in paisa.
    total_revenue = 0
    total_gst = 0
    total_base_amount = 0
    today_revenue = 0
    week_revenue = 0
    month_revenue = 0
    today_count = 0
    revenue_by_type = {}
    transaction_count = len(paid_orders)
    
    for order in paid_orders:
        amount = order.get("amount", 0) or 0
        # Recompute base + gst from normalized amount — single source of truth.
        base_amount = round(amount / (1 + GST_RATE), 2)
        gst = round(amount - base_amount, 2)
        order["base_amount"] = base_amount
        order["gst"] = gst
        
        total_revenue += amount
        total_gst += gst
        total_base_amount += base_amount
        
        purchase_type = classify_purchase_type(order)
        revenue_by_type[purchase_type] = revenue_by_type.get(purchase_type, 0) + amount
        
        paid_at = order.get("paid_at") or order.get("created_at")
        if paid_at:
            try:
                if isinstance(paid_at, str):
                    paid_at = datetime.fromisoformat(paid_at.replace('Z', '+00:00'))
                if paid_at.tzinfo is None:
                    paid_at = paid_at.replace(tzinfo=timezone.utc)
                if paid_at >= today_start:
                    today_revenue += amount
                    today_count += 1
                if paid_at >= week_start:
                    week_revenue += amount
                if paid_at >= month_start:
                    month_revenue += amount
            except Exception:
                pass
    
    # Previous-month revenue for the growth pill
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
    prev_month_revenue = 0
    for order in paid_orders:
        paid_at = order.get("paid_at") or order.get("created_at")
        if paid_at:
            try:
                if isinstance(paid_at, str):
                    paid_at = datetime.fromisoformat(paid_at.replace('Z', '+00:00'))
                if paid_at.tzinfo is None:
                    paid_at = paid_at.replace(tzinfo=timezone.utc)
                if prev_month_start <= paid_at < month_start:
                    prev_month_revenue += order.get("amount", 0) or 0
            except Exception:
                pass
    
    growth_percentage = 0
    if prev_month_revenue > 0:
        growth_percentage = ((month_revenue - prev_month_revenue) / prev_month_revenue) * 100
    
    logger.info(
        f"Sales summary: revenue=₹{total_revenue:,.2f}, gst=₹{total_gst:,.2f}, "
        f"base=₹{total_base_amount:,.2f}, txns={transaction_count}"
    )
    
    return {
        "total_revenue": round(total_revenue, 2),
        "total_base_amount": round(total_base_amount, 2),
        "total_gst": round(total_gst, 2),
        "today_revenue": round(today_revenue, 2),
        "today": {"count": today_count, "revenue": round(today_revenue, 2)},
        "week_revenue": round(week_revenue, 2),
        "month_revenue": round(month_revenue, 2),
        "prev_month_revenue": round(prev_month_revenue, 2),
        "growth_percentage": round(growth_percentage, 1),
        "transaction_count": transaction_count,
        "average_order_value": round(total_revenue / max(transaction_count, 1), 2),
        "revenue_by_type": revenue_by_type,
        "gst_rate": GST_RATE * 100
    }


# ============ Get All Sales Transactions ============

@router.get("/transactions/_diagnose")
async def diagnose_sales_transactions(request: Request):
    """Production diagnostic: returns raw counts from both collections
    so we can see exactly why the Sales table might appear empty.
    Surfaces all status values present, sample documents, and the
    overall query-to-result mapping. NEVER trust this in code — admin
    debugging only."""
    await verify_admin(request)
    db = get_db(request)

    # Distinct status values
    orders_statuses = await db.payment_orders.distinct("status")
    payments_statuses = await db.payments.distinct("status")

    # Counts by status
    orders_by_status: dict = {}
    for s in orders_statuses:
        orders_by_status[s or "(null)"] = await db.payment_orders.count_documents({"status": s})
    payments_by_status: dict = {}
    for s in payments_statuses:
        payments_by_status[s or "(null)"] = await db.payments.count_documents({"status": s})

    # What the /transactions endpoint actually queries
    paid_count_orders = await db.payment_orders.count_documents({"status": {"$in": ["paid", "completed"]}})
    captured_count_payments = await db.payments.count_documents({"status": "captured"})

    # Sample 3 records from each side to see field shape
    sample_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},
        {"_id": 0, "id": 1, "status": 1, "razorpay_order_id": 1, "razorpay_payment_id": 1, "amount": 1, "user_id": 1, "plan_key": 1, "type": 1, "created_at": 1},
    ).limit(3).to_list(3)
    sample_payments = await db.payments.find(
        {"status": "captured"},
        {"_id": 0, "id": 1, "status": 1, "razorpay_order_id": 1, "razorpay_payment_id": 1, "amount": 1, "user_id": 1, "plan_key": 1, "type": 1, "created_at": 1},
    ).limit(3).to_list(3)

    # Run the EXACT /transactions pipeline inline and report at each stage.
    # This is the killer diagnostic: if `expected_transactions_min` > 0
    # but `pipeline.merged_count` == 0, we know precisely which step
    # the data evaporated at.
    pipeline_diag: Dict[str, Any] = {}
    try:
        query = {"status": {"$in": ["paid", "completed"]}}
        sub_query = {"status": "captured"}
        try:
            orders_full = await db.payment_orders.find(query, {"_id": 0}).to_list(10000)
            pipeline_diag["orders_fetched"] = len(orders_full)
        except Exception as e:  # noqa: BLE001
            orders_full = []
            pipeline_diag["orders_fetch_error"] = repr(e)
        try:
            payments_full = await db.payments.find(sub_query, {"_id": 0}).to_list(10000)
            pipeline_diag["payments_fetched"] = len(payments_full)
        except Exception as e:  # noqa: BLE001
            payments_full = []
            pipeline_diag["payments_fetch_error"] = repr(e)

        # Try the dedup using the SAME helper as the live pipeline
        try:
            merged, dedup_stats = _merge_orders_and_payments(orders_full, payments_full)
            pipeline_diag.update(dedup_stats)
            pipeline_diag["merged_count"] = len(merged)
        except Exception as e:  # noqa: BLE001
            pipeline_diag["dedup_error"] = repr(e)

        # Try _normalize_order_money on the first record from each side
        try:
            if orders_full:
                cp = dict(orders_full[0])
                _normalize_order_money(cp)
                pipeline_diag["normalize_order_sample_ok"] = True
        except Exception as e:  # noqa: BLE001
            pipeline_diag["normalize_order_error"] = repr(e)
        try:
            if payments_full:
                cp = dict(payments_full[0])
                _normalize_order_money(cp)
                pipeline_diag["normalize_payment_sample_ok"] = True
        except Exception as e:  # noqa: BLE001
            pipeline_diag["normalize_payment_error"] = repr(e)

    except Exception as e:  # noqa: BLE001
        pipeline_diag["pipeline_error"] = repr(e)

    return {
        "payment_orders": {
            "total": await db.payment_orders.count_documents({}),
            "by_status": orders_by_status,
            "matching_paid_or_completed": paid_count_orders,
            "sample_paid": sample_orders,
        },
        "payments": {
            "total": await db.payments.count_documents({}),
            "by_status": payments_by_status,
            "matching_captured": captured_count_payments,
            "sample_captured": sample_payments,
        },
        "expected_transactions_min": paid_count_orders + captured_count_payments,
        "pipeline": pipeline_diag,
        "note": (
            "If `expected_transactions_min` > 0 but `pipeline.merged_count` == 0, "
            "the find()/sort() is silently failing — check pipeline.*_error. "
            "If `merged_count` > 0 but the Sales table still shows 0, the row "
            "builder is silently skipping rows — check the API response for "
            "`skipped_count` and `skipped_samples`."
        ),
    }


@router.get("/transactions")
async def get_sales_transactions(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    purchase_type: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    user_id: Optional[str] = None
):
    """Get paginated list of all sales transactions with filters.

    Top-level try/except added so any uncaught exception inside the
    pipeline surfaces as a `pipeline_error` field on a 200 response
    rather than a 500 + empty UI. This was added after the production
    "0 transactions" symptom where the cause wasn't visible.
    """
    await verify_admin(request)
    db = get_db(request)
    
    try:
        return await _build_sales_transactions_response(
            db, page, limit, purchase_type, status, date_from, date_to, search, user_id
        )
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Sales /transactions pipeline crashed: {e!r}")
        # Return a structured error so the UI can render a banner
        # instead of just "No transactions found".
        return {
            "transactions": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "total_pages": 0,
            "pipeline_error": repr(e),
        }


async def _build_sales_transactions_response(
    db,
    page: int,
    limit: int,
    purchase_type: Optional[str],
    status: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    search: Optional[str],
    user_id: Optional[str],
):
    # Build query
    query = {}
    
    if status:
        if status == "paid":
            # Include both "paid" and "completed" statuses
            query["status"] = {"$in": ["paid", "completed"]}
        else:
            query["status"] = status
    else:
        # Default to paid orders only (including "completed")
        query["status"] = {"$in": ["paid", "completed"]}
    
    if user_id:
        query["user_id"] = user_id
    
    # Date filtering
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                from_date = datetime.fromisoformat(date_from)
                date_query["$gte"] = from_date.isoformat()
            except Exception:
                pass
        if date_to:
            try:
                to_date = datetime.fromisoformat(date_to) + timedelta(days=1)
                date_query["$lt"] = to_date.isoformat()
            except Exception:
                pass
        if date_query:
            query["$or"] = [
                {"paid_at": date_query},
                {"created_at": date_query}
            ]
    
    # Get total count from both collections
    sub_query = dict(query)
    # For payments collection, convert status to "captured"
    if "status" in sub_query:
        if sub_query["status"] == "paid" or (isinstance(sub_query["status"], dict) and "$in" in sub_query["status"]):
            sub_query["status"] = "captured"
    total_orders = await db.payment_orders.count_documents(query)
    total_subs = await db.payments.count_documents(sub_query)
    total = total_orders + total_subs
    
    # Get orders with pagination - fetch from both collections and merge
    skip = (page - 1) * limit
    orders = await db.payment_orders.find(
        query,
        {"_id": 0}
    ).sort([("paid_at", -1), ("created_at", -1)]).to_list(10000)
    
    # Also get ALL captured payments from payments collection (not just subscriptions)
    # This includes: subscriptions, top-ups, addons, etc.
    captured_payments = await db.payments.find(
        sub_query,
        {"_id": 0}
    ).sort([("captured_at", -1), ("created_at", -1)]).to_list(10000)
    
    # Normalize captured payments to match payment_orders format
    for payment in captured_payments:
        payment["status"] = "paid"  # Normalize status
        payment["plan_key"] = payment.get("plan_key") or payment.get("type", "unknown")
        payment["plan_name"] = payment.get("plan_name", payment.get("type", "Payment"))
        payment["razorpay_order_id"] = payment.get("razorpay_order_id", "")
        payment["razorpay_payment_id"] = payment.get("razorpay_payment_id", "")
        # Single source of truth: normalize amount/base/gst together.
        _normalize_order_money(payment)
        # If GST still missing, derive from normalized amount.
        if not payment.get("gst") and payment.get("amount"):
            payment["base_amount"] = round(payment["amount"] / (1 + GST_RATE), 2)
            payment["gst"] = round(payment["amount"] - payment["base_amount"], 2)
        payment["paid_at"] = payment.get("captured_at") or payment.get("paid_at") or payment.get("created_at")
    
    # Also normalize money fields on payment_orders so the table totals
    # match the summary cards exactly.
    for order in orders:
        _normalize_order_money(order)
    
    # Dedup using the shared helper (same logic as /summary so the
    # transactions table count matches the summary card "transactions"
    # number exactly). Drops any captured payment that maps to an existing
    # payment_orders row via razorpay_order_id, razorpay_payment_id, or a
    # fuzzy (user_id, amount, day) fallback for legacy records where the
    # Razorpay IDs are missing/mismatched between the two collections.
    all_orders, dedup_stats = _merge_orders_and_payments(orders, captured_payments)
    logger.info(f"Sales /transactions dedup stats: {dedup_stats}")

    # Sort by paid/created date — defensively coerce to a sortable string
    # because production has a mix of datetime objects and ISO strings
    # across these collections, and Python 3 raises TypeError when
    # comparing datetime to str. ISO strings are lexically sortable so
    # `isoformat()` keeps the order correct.
    def _sort_key(rec):
        v = rec.get("paid_at") or rec.get("created_at") or ""
        if hasattr(v, "isoformat"):
            try:
                return v.isoformat()
            except Exception:  # noqa: BLE001
                return ""
        return str(v) if v else ""
    try:
        all_orders.sort(key=_sort_key, reverse=True)
    except Exception as sort_err:  # noqa: BLE001
        # Worst case — keep unsorted rather than losing the whole list.
        logger.warning(f"Sales transactions: sort failed, returning unsorted: {sort_err!r}")
    
    # Apply pagination on merged list
    total = len(all_orders)
    paginated_orders = all_orders[skip:skip + limit]
    
    # Enrich with user data and format. Bulletproof construction: the
    # discount/coupon back-calculation block is wrapped in its own
    # try/except so a single bad coupon record / weird stored value /
    # math error can't hide the whole row. Earlier production bug:
    # because the entire row builder was inside ONE try/except, every
    # row that hit the discount calc throwing → silently dropped → user
    # saw "No transactions" on a fully-populated DB.
    transactions = []
    skipped_count = 0
    skipped_samples: list = []
    for order in paginated_orders:
        try:
            user = await db.users.find_one(
                {"id": order.get("user_id")},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1}
            )
            
            purchase_details = format_purchase_details(order)
            
            if purchase_type and purchase_details["type"] != purchase_type:
                continue
            
            if search:
                search_lower = search.lower()
                user_name = (user.get("name") or "" if user else "").lower()
                user_email = (user.get("email") or "" if user else "").lower()
                order_email = (order.get("user_email") or "").lower()
                if search_lower not in user_name and search_lower not in user_email and search_lower not in order_email:
                    continue
            
            # Default money values (always safe — uses the normalized
            # `amount` field we set above and computes base/gst from it).
            try:
                amount = float(order.get("amount") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            base_amount = round(amount / (1 + GST_RATE), 2) if amount > 0 else 0
            gst = round(amount - base_amount, 2) if amount > 0 else 0
            total_discount = 0
            discounted_base = base_amount
            stored_discount_type = order.get("discount_type")
            stored_discount_value = order.get("discount_value", 0) or 0
            coupon_code = order.get("coupon_code")
            
            # Best-effort discount/coupon back-calculation. Any failure
            # here uses the simple defaults above and emits the row.
            try:
                # 1. Try to get original base from stored data or plan pricing
                original_base = order.get("original_base_amount", 0) or 0
                if not original_base:
                    plan_key_for_calc = order.get("plan_key")
                    billing_for_calc = order.get("billing_cycle") or ""
                    if plan_key_for_calc and isinstance(plan_key_for_calc, str):
                        plan_for_calc = await db.plans.find_one({"plan_key": plan_key_for_calc}, {"_id": 0, "pricing": 1})
                        if plan_for_calc:
                            p = plan_for_calc.get("pricing", {}) or {}
                            if billing_for_calc in ("monthly", "1_month"):
                                original_base = p.get("one_month") or p.get("monthly", 0) or 0
                            elif billing_for_calc in ("6_month", "half_yearly", "semi_annual"):
                                per_m = p.get("six_month") or p.get("6_month") or p.get("one_month", 0) or 0
                                original_base = (per_m or 0) * 6
                            elif billing_for_calc == "one_time":
                                original_base = p.get("one_time", 0) or 0
                
                # 2. Coupon resolution
                discount_amount_raw = order.get("discount_amount", 0) or 0
                try:
                    discount_amount = float(discount_amount_raw)
                except (TypeError, ValueError):
                    discount_amount = 0
                
                if coupon_code and isinstance(coupon_code, str) and not stored_discount_type:
                    coupon_record = await db.discounts.find_one(
                        {"code": coupon_code.upper()},
                        {"_id": 0, "discount_type": 1, "subscription_discount_value": 1}
                    )
                    if coupon_record:
                        stored_discount_type = coupon_record.get("discount_type", "percentage")
                        stored_discount_value = coupon_record.get("subscription_discount_value", 0) or 0
                
                if not stored_discount_type:
                    applied_discounts = order.get("applied_discounts", []) or []
                    for disc in applied_discounts:
                        if isinstance(disc, dict) and (disc.get("discount_type") == "coupon" or disc.get("code")):
                            if not coupon_code:
                                coupon_code = disc.get("code") or disc.get("discount_code") or disc.get("discount_name")
                            break
                    fpc = order.get("first_payment_coupon") or {}
                    if isinstance(fpc, dict) and fpc:
                        stored_discount_type = stored_discount_type or fpc.get("discount_type")
                        stored_discount_value = stored_discount_value or fpc.get("discount_value", 0) or 0
                        if not coupon_code:
                            coupon_code = fpc.get("code")
                
                # 3. Re-calculate breakdown using Option A only when we have a plan match
                try:
                    original_base = float(original_base or 0)
                except (TypeError, ValueError):
                    original_base = 0
                
                if original_base and original_base > 0:
                    if stored_discount_value and stored_discount_type:
                        try:
                            sdv = float(stored_discount_value)
                        except (TypeError, ValueError):
                            sdv = 0
                        if stored_discount_type == "percentage":
                            discount_amount = round(original_base * (sdv / 100), 2)
                        else:
                            discount_amount = min(sdv, original_base)
                        discounted_base = original_base - discount_amount
                    elif discount_amount and discount_amount > 0:
                        discounted_base = original_base - discount_amount
                    else:
                        discount_amount = 0
                        discounted_base = original_base
                    gst = round(discounted_base * GST_RATE, 2)
                    base_amount = original_base
                    total_discount = discount_amount
            except Exception as inner_e:
                # Discount calc failed — use the simple defaults set
                # above. NEVER let this hide the whole row.
                logger.warning(
                    f"Sales transactions: discount calc failed for {order.get('id')}: {inner_e!r}"
                )
            
            transaction = {
                "id": order.get("id"),
                "razorpay_order_id": order.get("razorpay_order_id"),
                "razorpay_payment_id": order.get("razorpay_payment_id"),
                "user": user,
                "user_id": order.get("user_id"),
                "user_email": order.get("user_email"),
                "user_name": order.get("user_name"),
                "purchase_type": purchase_details["type"],
                "purchase_name": purchase_details["name"],
                "plan_key": order.get("plan_key"),
                "plan_name": order.get("plan_name"),
                "mentor_id": order.get("mentor_id"),
                "mentor_name": order.get("mentor_name"),
                "session_count": order.get("session_count"),
                "discount_percent": stored_discount_value if stored_discount_type == "percentage" else (order.get("discount_percent") or order.get("volume_discount_percent", 0)),
                "discount_amount": total_discount,
                "discounted_price": discounted_base,
                "coupon_code": coupon_code,
                "applied_discounts": order.get("applied_discounts", []),
                "base_amount": base_amount,
                "gst": gst,
                "total_amount": amount,
                "currency": order.get("currency", "INR"),
                "status": order.get("status"),
                "paid_at": order.get("paid_at"),
                "created_at": order.get("created_at"),
            }
            transactions.append(transaction)
        except Exception as e:
            # Last-resort guard — log details so we can debug, never
            # silently swallow without a count + sample.
            skipped_count += 1
            if len(skipped_samples) < 5:
                skipped_samples.append({"id": order.get("id"), "error": repr(e)})
            logger.exception(
                f"Sales transactions: skipping order {order.get('id')}: {e!r}"
            )
            continue
    
    # If we filtered in Python, adjust the count
    if purchase_type or search:
        # Recount based on all matching documents
        all_orders_for_count = await db.payment_orders.find(query, {"_id": 0}).to_list(10000)
        filtered_count = 0
        for order in all_orders_for_count:
            try:
                pd = format_purchase_details(order)
                if purchase_type and pd["type"] != purchase_type:
                    continue
                if search:
                    user_lookup = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
                    search_lower = search.lower()
                    user_name_l = (user_lookup.get("name") or "" if user_lookup else "").lower()
                    user_email_l = (user_lookup.get("email") or "" if user_lookup else "").lower()
                    order_email_l = (order.get("user_email") or "").lower()
                    if not any([search_lower in user_name_l, search_lower in user_email_l, search_lower in order_email_l]):
                        continue
                filtered_count += 1
            except Exception:  # noqa: BLE001
                continue
        total = filtered_count
    
    response = {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }
    # Surface skipped records so admin can see if anything is being
    # silently dropped (this was the root cause of the production
    # "0 transactions" symptom — every row was throwing in the
    # discount/coupon block).
    if skipped_count:
        response["skipped_count"] = skipped_count
        response["skipped_samples"] = skipped_samples
    # Surface dedup stats so admin can verify production merge counts
    # match expectations from the diagnose endpoint.
    response["dedup_stats"] = dedup_stats
    return response


# ============ Get Single Transaction Details ============

@router.get("/transactions/{transaction_id}")
async def get_transaction_details(transaction_id: str, request: Request):
    """Get detailed information about a single transaction"""
    await verify_admin(request)
    db = get_db(request)
    
    # Try to find by id or razorpay_order_id
    order = await db.payment_orders.find_one(
        {"$or": [{"id": transaction_id}, {"razorpay_order_id": transaction_id}]},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get user details
    user = await db.users.find_one(
        {"id": order.get("user_id")},
        {"_id": 0}
    )
    
    # Get payment record if exists
    payment = await db.payments.find_one(
        {"razorpay_order_id": order.get("razorpay_order_id")},
        {"_id": 0}
    )
    
    # Calculate GST breakdown
    amount = order.get("amount", 0)
    base_amount = order.get("base_amount", 0)
    gst = order.get("gst", 0)
    
    if not gst and amount > 0:
        base_amount = round(amount / (1 + GST_RATE), 2)
        gst = round(amount - base_amount, 2)
    
    purchase_details = format_purchase_details(order)
    
    return {
        "transaction": {
            **order,
            "base_amount": base_amount,
            "gst": gst,
            "purchase_type": purchase_details["type"],
            "purchase_name": purchase_details["name"],
        },
        "user": user,
        "payment": payment
    }


# ============ Get User Purchase History ============

@router.get("/users/{user_id}/purchases")
async def get_user_purchase_history(user_id: str, request: Request):
    """Get complete purchase history for a specific user"""
    await verify_admin(request)
    db = get_db(request)
    
    # Get user details
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all orders for this user
    orders = await db.payment_orders.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Calculate summary statistics
    total_spent = 0
    total_gst_paid = 0
    purchase_count = 0
    purchases_by_type = {}
    
    purchases = []
    for order in orders:
        amount = order.get("amount", 0)
        base_amount = order.get("base_amount", 0)
        gst = order.get("gst", 0)
        
        if not gst and amount > 0:
            base_amount = round(amount / (1 + GST_RATE), 2)
            gst = round(amount - base_amount, 2)
        
        purchase_details = format_purchase_details(order)
        
        if order.get("status") == "paid":
            total_spent += amount
            total_gst_paid += gst
            purchase_count += 1
            purchases_by_type[purchase_details["type"]] = purchases_by_type.get(purchase_details["type"], 0) + 1
        
        purchases.append({
            "id": order.get("id"),
            "razorpay_order_id": order.get("razorpay_order_id"),
            "razorpay_payment_id": order.get("razorpay_payment_id"),
            "purchase_type": purchase_details["type"],
            "purchase_name": purchase_details["name"],
            "plan_key": order.get("plan_key"),
            "mentor_name": order.get("mentor_name"),
            "session_count": order.get("session_count"),
            "discount_percent": order.get("discount_percent", 0),
            "base_amount": base_amount,
            "gst": gst,
            "total_amount": amount,
            "currency": order.get("currency", "INR"),
            "status": order.get("status"),
            "paid_at": order.get("paid_at"),
            "created_at": order.get("created_at"),
        })
    
    # Get user's current plan and session info
    return {
        "user": {
            "id": user.get("id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "picture": user.get("picture"),
            "plan": user.get("plan"),
            "plan_name": user.get("plan_name"),
            "coaching_sessions_total": user.get("coaching_sessions_total", 0),
            "coaching_sessions_used": user.get("coaching_sessions_used", 0),
            "coaching_sessions_remaining": user.get("coaching_sessions_remaining", 0),
            "subscription_date": user.get("subscription_date"),
            "subscription_end": user.get("subscription_end") or user.get("plan_end_date"),
            "created_at": user.get("created_at"),
        },
        "summary": {
            "total_spent": round(total_spent, 2),
            "total_gst_paid": round(total_gst_paid, 2),
            "purchase_count": purchase_count,
            "purchases_by_type": purchases_by_type,
            "average_purchase_value": round(total_spent / max(purchase_count, 1), 2),
            "first_purchase": purchases[-1]["created_at"] if purchases else None,
            "last_purchase": purchases[0]["created_at"] if purchases else None,
        },
        "purchases": purchases
    }


# ============ Export Sales Data ============

@router.get("/export")
async def export_sales_data(
    request: Request,
    format: str = Query("csv", regex="^(csv|json)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    purchase_type: Optional[str] = None,
    status: str = "paid"
):
    """Export sales data as CSV or JSON"""
    await verify_admin(request)
    db = get_db(request)
    
    # Build query
    query = {"status": status}
    
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                from_date = datetime.fromisoformat(date_from)
                date_query["$gte"] = from_date.isoformat()
            except Exception:
                pass
        if date_to:
            try:
                to_date = datetime.fromisoformat(date_to) + timedelta(days=1)
                date_query["$lt"] = to_date.isoformat()
            except Exception:
                pass
        if date_query:
            query["$or"] = [{"paid_at": date_query}, {"created_at": date_query}]
    
    # Get all matching orders
    orders = await db.payment_orders.find(query, {"_id": 0}).sort("paid_at", -1).to_list(50000)
    
    # Build export data
    export_data = []
    for order in orders:
        # Get user info
        user = await db.users.find_one(
            {"id": order.get("user_id")},
            {"_id": 0, "name": 1, "email": 1}
        )
        
        purchase_details = format_purchase_details(order)
        
        # Filter by purchase type if specified
        if purchase_type and purchase_details["type"] != purchase_type:
            continue
        
        # Calculate GST
        amount = order.get("amount", 0)
        base_amount = order.get("base_amount", 0)
        gst = order.get("gst", 0)
        
        if not gst and amount > 0:
            base_amount = round(amount / (1 + GST_RATE), 2)
            gst = round(amount - base_amount, 2)
        
        row = {
            "Transaction ID": order.get("id", ""),
            "Razorpay Order ID": order.get("razorpay_order_id", ""),
            "Razorpay Payment ID": order.get("razorpay_payment_id", ""),
            "Customer Name": user.get("name", "") if user else order.get("user_name", ""),
            "Customer Email": user.get("email", "") if user else order.get("user_email", ""),
            "User ID": order.get("user_id", ""),
            "Purchase Type": purchase_details["type"],
            "Product/Plan Name": purchase_details["name"],
            "Plan Key": order.get("plan_key", ""),
            "Mentor Name": order.get("mentor_name", ""),
            "Session Count": order.get("session_count", ""),
            "Discount %": order.get("discount_percent", 0),
            "Base Amount (INR)": base_amount,
            "GST (18%)": gst,
            "Total Amount (INR)": amount,
            "Currency": order.get("currency", "INR"),
            "Status": order.get("status", ""),
            "Payment Date": order.get("paid_at", ""),
            "Order Created": order.get("created_at", ""),
        }
        export_data.append(row)
    
    if format == "json":
        return {"data": export_data, "count": len(export_data)}
    
    # Generate CSV
    if not export_data:
        export_data = [{"Message": "No data found for the specified filters"}]
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
    writer.writeheader()
    writer.writerows(export_data)
    
    output.seek(0)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"sales_export_{timestamp}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============ Get Purchase Types for Filter Dropdown ============

@router.get("/purchase-types")
async def get_purchase_types(request: Request):
    """Get list of purchase types for filter dropdown"""
    await verify_admin(request)
    
    return {
        "purchase_types": [
            "Subscription Plan",
            "Coaching Plan",
            "Go-Out Plan",
            "Cohort Plan",
            "Single Session",
            "Top-Up",
            "Add-On"
        ]
    }


class ManualSaleRequest(BaseModel):
    user_email: str
    category: str  # "subscription" or "coaching"
    plan_key: str
    billing_cycle: Optional[str] = "monthly"  # monthly, 6_month, one_time
    amount: float  # Total amount including GST
    payment_method: str = "manual"  # manual, bank_transfer, cash, upi, other
    activation_status: str = "active"  # active, pending
    coupon_code: Optional[str] = None
    discount_amount: Optional[float] = 0
    notes: Optional[str] = None
    purchase_date: Optional[str] = None  # ISO date string, defaults to now if not provided


@router.post("/manual")
async def create_manual_sale(sale: ManualSaleRequest, request: Request):
    """Create a manual sale entry — for offline/bank transfer payments"""
    await verify_admin(request)
    db = get_db(request)

    # Find the user
    user = await db.users.find_one({"email": sale.user_email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"User with email {sale.user_email} not found")

    # Find the plan
    plan = await db.plans.find_one({"plan_key": sale.plan_key}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {sale.plan_key} not found")

    # Use provided purchase_date or default to now
    if sale.purchase_date:
        try:
            purchase_datetime = datetime.fromisoformat(sale.purchase_date.replace('Z', '+00:00'))
            # If only date provided (no time), set to start of day
            if 'T' not in sale.purchase_date:
                purchase_datetime = datetime.strptime(sale.purchase_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            purchase_datetime = datetime.now(timezone.utc)
    else:
        purchase_datetime = datetime.now(timezone.utc)
    
    now = datetime.now(timezone.utc)
    
    # Option A: If there's a discount, apply on base first, then GST on discounted base
    # sale.amount is the TOTAL paid amount (inclusive of GST)
    # Back-calculate: paid = discounted_base × 1.18
    discount_on_base = sale.discount_amount or 0
    
    # Get original base from plan pricing
    plan_pricing = plan.get("pricing", {})
    if sale.billing_cycle == "6_month":
        per_month = plan_pricing.get("six_month") or plan_pricing.get("6_month") or plan_pricing.get("one_month", 0)
        original_base = per_month * 6
    elif sale.billing_cycle == "1_month":
        original_base = plan_pricing.get("one_month") or plan_pricing.get("monthly", 0)
    else:
        original_base = round(sale.amount / (1 + GST_RATE), 2)
    
    discounted_base = original_base - discount_on_base
    gst = round(discounted_base * GST_RATE, 2)
    total_paid = round(discounted_base + gst, 2)
    
    # Look up coupon details if coupon_code provided
    stored_discount_type = None
    stored_discount_value = 0
    if sale.coupon_code:
        coupon = await db.discounts.find_one({"code": sale.coupon_code.upper()}, {"_id": 0})
        if coupon:
            stored_discount_type = coupon.get("discount_type", "percentage")
            stored_discount_value = coupon.get("subscription_discount_value", 0)

    # Create payment order record
    order_id = f"manual-{uuid.uuid4().hex[:12]}"
    order_doc = {
        "id": order_id,
        "razorpay_order_id": f"manual_{order_id}",
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "plan_key": sale.plan_key,
        "plan_name": plan.get("name", sale.plan_key),
        "billing_cycle": sale.billing_cycle,
        "original_base_amount": original_base,
        "base_amount": discounted_base,
        "discount_amount": discount_on_base,
        "discount_type": stored_discount_type,
        "discount_value": stored_discount_value,
        "discounted_price": discounted_base,
        "gst": gst,
        "amount": total_paid,
        "currency": "INR",
        "status": "paid",
        "payment_method": sale.payment_method,
        "is_manual": True,
        "coupon_code": sale.coupon_code,
        "notes": sale.notes,
        "created_at": purchase_datetime.isoformat(),
        "paid_at": purchase_datetime.isoformat(),
        "updated_at": now.isoformat()
    }

    if sale.coupon_code:
        order_doc["applied_discounts"] = [{
            "discount_code": sale.coupon_code,
            "discount_type": "coupon",
            "amount": sale.discount_amount or 0
        }]

    await db.payment_orders.insert_one(order_doc)

    # If activation_status is active, activate the plan for the user
    if sale.activation_status == "active":
        features = plan.get("features", {})
        plan_category = plan.get("category", sale.category)
        update_data = {
            "plan": sale.plan_key,
            "plan_name": plan.get("name"),
            "is_manual_upgrade": True,
            "updated_at": now.isoformat()
        }

        if plan_category == "subscription":
            from dateutil.relativedelta import relativedelta
            if sale.billing_cycle == "6_month":
                end_date = purchase_datetime + relativedelta(months=6)
            else:
                end_date = purchase_datetime + relativedelta(months=1)
            update_data["subscription_start_date"] = purchase_datetime.isoformat()
            update_data["subscription_end_date"] = end_date.isoformat()
        elif plan_category == "coaching":
            from dateutil.relativedelta import relativedelta
            end_date = purchase_datetime + relativedelta(months=6)
            update_data["coaching_program_start_date"] = purchase_datetime.isoformat()
            update_data["coaching_program_end_date"] = end_date.isoformat()
            update_data["coaching_sessions_total"] = features.get("coaching_sessions", 0)
            update_data["coaching_sessions_used"] = 0
            update_data["strategy_calls_total"] = features.get("strategy_calls", 0)
            update_data["strategy_calls_used"] = 0

        await db.users.update_one({"id": user.get("id")}, {"$set": update_data})
        
        # Update Google Sheet with upgrade info
        try:
            import asyncio as _asyncio
            _asyncio.create_task(update_user_upgrade_in_sheet(user.get('email', ''), sale.plan_key, sale.billing_cycle, user))
        except Exception as e:
            import logging as _logging
            _logging.error(f"Failed to trigger Google Sheet upgrade update for manual sale: {e}")

    return {
        "success": True,
        "order_id": order_id,
        "message": f"Manual sale recorded for {user.get('name')} — {plan.get('name')} ({sale.payment_method})",
        "activated": sale.activation_status == "active"
    }



# ============ Sales Diagnostic Endpoint ============

@router.get("/diagnostic")
async def run_sales_diagnostic(request: Request):
    """
    Run a diagnostic to check why sales might not be showing.
    Access this at: /api/admin/sales/diagnostic
    """
    await verify_admin(request)
    db = get_db(request)
    
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sections": {}
    }
    
    # 1. Check payments collection
    payments_total = await db.payments.count_documents({})
    payments_captured = await db.payments.count_documents({"status": "captured"})
    payments_subscription = await db.payments.count_documents({"status": "captured", "type": "subscription"})
    
    sample_payments = []
    if payments_total > 0:
        samples = await db.payments.find({}, {"_id": 0}).limit(3).to_list(3)
        sample_payments = [{"id": s.get("id"), "email": s.get("user_email"), "amount": s.get("amount"), "status": s.get("status"), "type": s.get("type")} for s in samples]
    
    report["sections"]["payments_collection"] = {
        "total_records": payments_total,
        "captured_payments": payments_captured,
        "subscription_payments": payments_subscription,
        "samples": sample_payments
    }
    
    # 2. Check payment_orders collection
    orders_total = await db.payment_orders.count_documents({})
    orders_paid = await db.payment_orders.count_documents({"status": {"$in": ["paid", "completed"]}})
    
    report["sections"]["payment_orders_collection"] = {
        "total_records": orders_total,
        "paid_completed": orders_paid
    }
    
    # 3. Check webhook_logs
    webhook_total = await db.webhook_logs.count_documents({})
    webhook_activated = await db.webhook_logs.count_documents({"event": "subscription.activated"})
    webhook_charged = await db.webhook_logs.count_documents({"event": "subscription.charged"})
    
    recent_webhooks = []
    if webhook_total > 0:
        recent = await db.webhook_logs.find({}, {"_id": 0, "payload": 0}).sort("received_at", -1).limit(5).to_list(5)
        recent_webhooks = [{"event": w.get("event"), "user_id": w.get("user_id"), "received_at": w.get("received_at")} for w in recent]
    
    report["sections"]["webhook_logs"] = {
        "total_events": webhook_total,
        "subscription_activated": webhook_activated,
        "subscription_charged": webhook_charged,
        "recent_events": recent_webhooks
    }
    
    # 4. Check users with paid subscriptions
    paid_plans = ["basic", "pro", "pro_monthly", "pro_yearly", "basic_monthly", "basic_yearly"]
    users_paid = await db.users.find({
        "$or": [
            {"plan": {"$in": paid_plans}},
            {"subscription.status": "active"},
            {"razorpay_subscription_id": {"$exists": True, "$ne": None}}
        ]
    }, {"_id": 0, "password": 0}).to_list(100)
    
    users_summary = []
    for u in users_paid[:20]:
        sub = u.get("subscription", {})
        users_summary.append({
            "email": u.get("email"),
            "plan": u.get("plan"),
            "plan_name": u.get("plan_name"),
            "subscription_status": sub.get("status"),
            "razorpay_sub_id": sub.get("razorpay_subscription_id") or u.get("razorpay_subscription_id"),
            "activated_at": sub.get("activated_at"),
            "locked_price": sub.get("locked_price")
        })
    
    report["sections"]["users_with_subscriptions"] = {
        "count": len(users_paid),
        "users": users_summary
    }
    
    # 5. Diagnosis
    issues = []
    recommendations = []
    
    if len(users_paid) > 0 and payments_subscription == 0:
        issues.append("Users have paid subscriptions but NO payment records exist!")
        recommendations.append("Run the backfill endpoint: GET /api/admin/sales/backfill?dry_run=true")
        recommendations.append("Then run: GET /api/admin/sales/backfill?dry_run=false")
    
    if webhook_total == 0 and len(users_paid) > 0:
        issues.append("No webhook logs found - webhooks may not be configured correctly")
        recommendations.append("Check Razorpay Dashboard > Settings > Webhooks")
    
    if webhook_activated > payments_subscription:
        issues.append(f"Mismatch: {webhook_activated} activation webhooks but only {payments_subscription} payment records")
        recommendations.append("Payment recording may have failed - check backend logs")
    
    if not issues:
        if len(users_paid) == 0:
            issues.append("No users with paid subscriptions found")
        else:
            issues.append("No issues detected - sales should be showing correctly")
    
    report["diagnosis"] = {
        "issues": issues,
        "recommendations": recommendations
    }
    
    return report


@router.get("/backfill")
async def backfill_payment_records(request: Request, dry_run: bool = True, batch_size: int = 10, offset: int = 0):
    """
    Backfill payment records for subscriptions that don't have them.
    
    Usage:
    - First run with dry_run=true to see what would be created
    - Then run with dry_run=false to actually create records
    - Use batch_size and offset to process in smaller chunks if needed
    
    Access:
    - Dry run: /api/admin/sales/backfill?dry_run=true
    - Create records (first 10): /api/admin/sales/backfill?dry_run=false&batch_size=10&offset=0
    - Create records (next 10): /api/admin/sales/backfill?dry_run=false&batch_size=10&offset=10
    """
    await verify_admin(request)
    db = get_db(request)
    
    results = {
        "mode": "DRY RUN" if dry_run else "LIVE",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "batch_size": batch_size,
        "offset": offset,
        "records_processed": [],
        "errors": [],
        "created_count": 0,
        "skipped_count": 0,
        "error_count": 0
    }
    
    try:
        # Get all users with active/paid subscriptions - expanded query
        users = await db.users.find({
            "$or": [
                {"subscription.status": "active"},
                {"subscription.status": "authenticated"},
                {"subscription.razorpay_subscription_id": {"$exists": True, "$ne": None}},
                {"razorpay_subscription_id": {"$exists": True, "$ne": None}},
                {"plan": {"$nin": ["free", "free_trial", None, ""]}},
                {"plan_name": {"$exists": True, "$ne": None}},
                {"subscription.plan_key": {"$exists": True, "$ne": None}}
            ]
        }).to_list(1000)
        
        results["total_users_found"] = len(users)
        
        # Process only the batch
        users_batch = users[offset:offset + batch_size] if not dry_run else users
        results["processing_count"] = len(users_batch)
        
        for user in users_batch:
            try:
                user_id = user.get("id")
                email = user.get("email")
                subscription = user.get("subscription", {})
                
                # More lenient check - user has SOME subscription info
                razorpay_sub_id = subscription.get("razorpay_subscription_id") or user.get("razorpay_subscription_id")
                plan_key = subscription.get("plan_key") or user.get("plan")
                
                if not razorpay_sub_id and not plan_key:
                    results["records_processed"].append({"email": email, "status": "SKIPPED", "reason": "No subscription/plan data"})
                    results["skipped_count"] += 1
                    continue
                
                # Skip free plans
                if plan_key in ["free", "free_trial"]:
                    results["records_processed"].append({"email": email, "status": "SKIPPED", "reason": "Free plan"})
                    results["skipped_count"] += 1
                    continue
                
                # Check if payment record already exists
                existing = await db.payments.find_one({
                    "$or": [
                        {"user_id": user_id, "type": "subscription"},
                        {"razorpay_subscription_id": razorpay_sub_id}
                    ]
                })
                
                if existing:
                    results["records_processed"].append({"email": email, "status": "SKIPPED", "reason": "Payment record already exists"})
                    results["skipped_count"] += 1
                    continue
                
                # Get the ORIGINAL plan price from plans collection (base_amount = price before discount)
                billing_cycle = subscription.get("billing_cycle", "monthly")
                base_amount = 0
                plan = await db.plans.find_one({"plan_key": plan_key})
                if plan:
                    if billing_cycle == "yearly":
                        base_amount = plan.get("yearly_price", 0)
                    else:
                        base_amount = plan.get("monthly_price", 0)
                
                if not base_amount:
                    # Fallback to subscription data if plan not found
                    base_amount = subscription.get("base_price", 0) or subscription.get("locked_price", 0)
                
                if not base_amount:
                    results["records_processed"].append({"email": email, "status": "SKIPPED", "reason": "No base amount found"})
                    results["skipped_count"] += 1
                    continue
                
                # Check for discount/coupon
                discount_amount = 0
                discount_percent = 0
                coupon_code = None
                
                # Check first_payment_coupon in subscription - ONLY get coupon code and percent, NOT amount
                if subscription.get("first_payment_coupon"):
                    coupon_info = subscription.get("first_payment_coupon", {})
                    coupon_code = coupon_info.get("code")
                    discount_percent = coupon_info.get("discount_percent", 0)
                    # DO NOT use stored discount_amount - it may be incorrect
                
                # Check discount_usage collection - ONLY get coupon code and percent
                discount_record = await db.discount_usage.find_one({"user_id": user_id, "order_type": "subscription"})
                if discount_record:
                    if discount_record.get("discount_percent"):
                        discount_percent = discount_record.get("discount_percent")
                    if discount_record.get("coupon_code") or discount_record.get("code"):
                        coupon_code = discount_record.get("coupon_code") or discount_record.get("code")
                
                # If we have coupon code but no discount percent, look up the coupon
                if coupon_code and not discount_percent:
                    coupon = await db.coupons.find_one({"code": coupon_code})
                    if coupon:
                        discount_percent = coupon.get("discount_percent", 0)
                
                # ALWAYS calculate discount from percentage
                if discount_percent:
                    discount_amount = round(base_amount * discount_percent / 100, 2)
                
                # Calculate final amounts
                # Price after discount (before GST)
                price_after_discount = base_amount - discount_amount
                
                # GST on the discounted price (18%)
                gst_amount = round(price_after_discount * 0.18, 2)
                
                # Total amount paid
                total_amount = round(price_after_discount + gst_amount, 2)
                
                activated_at = subscription.get("activated_at") or user.get("created_at") or datetime.now(timezone.utc).isoformat()
                
                payment_record = {
                    "id": f"backfill-{uuid.uuid4().hex[:12]}",
                    "order_id": f"order_backfill_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
                    "user_id": user_id,
                    "user_email": email,
                    "user_name": user.get("name"),
                    "razorpay_subscription_id": razorpay_sub_id,
                    "type": "subscription",
                    "payment_type": "first_payment",
                    "plan_key": plan_key,
                    "plan_name": subscription.get("plan_name") or user.get("plan_name"),
                    "billing_cycle": billing_cycle,
                    "amount": total_amount,
                    "base_amount": base_amount,  # Original price BEFORE discount
                    "gst_amount": gst_amount,
                    "discount_amount": discount_amount,  # base_amount - price_after_discount
                    "discounted_price": price_after_discount,  # Price after discount, before GST
                    "coupon_code": coupon_code,
                    "currency": "INR",
                    "status": "captured",
                    "created_at": activated_at,
                    "captured_at": activated_at,
                    "backfilled": True,
                    "backfilled_at": datetime.now(timezone.utc).isoformat()
                }
                
                if not dry_run:
                    await db.payments.insert_one(payment_record)
                    results["records_processed"].append({
                        "email": email, 
                        "plan": payment_record["plan_key"],
                        "amount": total_amount,
                        "status": "CREATED"
                    })
                else:
                    results["records_processed"].append({
                        "email": email, 
                        "plan": payment_record["plan_key"],
                        "amount": total_amount,
                        "status": "WOULD CREATE"
                    })
                
                results["created_count"] += 1
                
            except Exception as e:
                results["errors"].append({"email": user.get("email"), "error": str(e)})
                results["error_count"] += 1
        
        # Add next batch info
        if not dry_run:
            next_offset = offset + batch_size
            if next_offset < len(users):
                results["next_batch"] = f"/api/admin/sales/backfill?dry_run=false&batch_size={batch_size}&offset={next_offset}"
                results["remaining_users"] = len(users) - next_offset
            else:
                results["message"] = "All records processed!"
        
    except Exception as e:
        results["error"] = str(e)
        import traceback
        results["traceback"] = traceback.format_exc()
    
    return results


@router.get("/debug-user-subscription/{email}")
async def debug_user_subscription(email: str, request: Request):
    """
    Debug endpoint to see the full user subscription data structure.
    This helps identify where discount information is stored.
    
    Usage: /api/admin/sales/debug-user-subscription/user@email.com
    """
    await verify_admin(request)
    db = get_db(request)
    
    user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail=f"User {email} not found")
    
    # Also check discount_usage collection
    discount_usages = await db.discount_usage.find({"user_id": user.get("id")}).to_list(100)
    
    # Check pending_subscriptions
    pending_subs = await db.pending_subscriptions.find({"user_id": user.get("id")}).to_list(100)
    
    return {
        "user_data": user,
        "subscription_fields": {
            "subscription": user.get("subscription"),
            "plan": user.get("plan"),
            "plan_name": user.get("plan_name"),
            "razorpay_subscription_id": user.get("razorpay_subscription_id"),
        },
        "discount_usages": discount_usages,
        "pending_subscriptions": pending_subs
    }


@router.get("/debug-payment/{email}")
async def debug_payment_record(email: str, request: Request):
    """
    Debug endpoint to see the actual payment record for a user.
    This shows exactly what's stored and how it will be displayed.
    
    Usage: /api/admin/sales/debug-payment/user@email.com
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Find all payment records for this user
    payments = await db.payments.find({"user_email": email}, {"_id": 0}).to_list(100)
    payment_orders = await db.payment_orders.find({"user_email": email}, {"_id": 0}).to_list(100)
    
    return {
        "email": email,
        "payments_collection": payments,
        "payment_orders_collection": payment_orders,
        "total_payments": len(payments),
        "total_payment_orders": len(payment_orders)
    }



@router.get("/debug-coupon/{coupon_code}")
async def debug_coupon(coupon_code: str, request: Request):
    """
    Debug endpoint to see coupon data.
    
    Usage: /api/admin/sales/debug-coupon/WELCOME50
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Find coupon in coupons collection
    coupon = await db.coupons.find_one({"code": coupon_code}, {"_id": 0})
    
    # Also try case-insensitive search
    if not coupon:
        coupon = await db.coupons.find_one({"code": {"$regex": f"^{coupon_code}$", "$options": "i"}}, {"_id": 0})
    
    # List all coupons to see available ones
    all_coupons = await db.coupons.find({}, {"_id": 0, "code": 1, "discount_percent": 1, "discount": 1, "percentage": 1}).to_list(50)
    
    return {
        "searched_code": coupon_code,
        "coupon_found": coupon,
        "all_coupons": all_coupons
    }



@router.get("/fix-null-orders")
async def fix_null_order_ids(request: Request, dry_run: bool = True):
    """
    Fix payment records that have null order_id (from previous failed backfills).
    
    Usage:
    - Dry run: /api/admin/sales/fix-null-orders?dry_run=true
    - Fix records: /api/admin/sales/fix-null-orders?dry_run=false
    """
    await verify_admin(request)
    db = get_db(request)
    
    results = {
        "mode": "DRY RUN" if dry_run else "LIVE",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "records_found": [],
        "fixed_count": 0,
        "error_count": 0
    }
    
    try:
        # Find all records with null order_id
        null_order_records = await db.payments.find({"order_id": None}).to_list(1000)
        results["total_null_records"] = len(null_order_records)
        
        for record in null_order_records:
            try:
                record_info = {
                    "id": record.get("id"),
                    "user_email": record.get("user_email"),
                    "amount": record.get("amount"),
                    "created_at": record.get("created_at")
                }
                
                if not dry_run:
                    # Generate a unique order_id and update the record
                    new_order_id = f"order_fix_{uuid.uuid4().hex[:16]}"
                    await db.payments.update_one(
                        {"_id": record["_id"]},
                        {"$set": {"order_id": new_order_id}}
                    )
                    record_info["new_order_id"] = new_order_id
                    record_info["status"] = "FIXED"
                else:
                    record_info["status"] = "WOULD FIX"
                
                results["records_found"].append(record_info)
                results["fixed_count"] += 1
                
            except Exception as e:
                results["records_found"].append({
                    "id": record.get("id"),
                    "error": str(e),
                    "status": "ERROR"
                })
                results["error_count"] += 1
        
        if not dry_run:
            results["message"] = f"Fixed {results['fixed_count']} records. Sales tab should now work!"
        else:
            results["next_step"] = "Run /api/admin/sales/fix-null-orders?dry_run=false to fix these records"
            
    except Exception as e:
        results["error"] = str(e)
    
    return results


@router.get("/check-payments")
async def check_payments_collection(request: Request):
    """
    Check what's in the payments collection.
    
    Access: /api/admin/sales/check-payments
    """
    await verify_admin(request)
    db = get_db(request)
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    try:
        # Count all payments
        total = await db.payments.count_documents({})
        captured = await db.payments.count_documents({"status": "captured"})
        subscriptions = await db.payments.count_documents({"type": "subscription"})
        null_orders = await db.payments.count_documents({"order_id": None})
        backfilled = await db.payments.count_documents({"backfilled": True})
        
        results["counts"] = {
            "total": total,
            "captured": captured,
            "subscriptions": subscriptions,
            "null_order_ids": null_orders,
            "backfilled": backfilled
        }
        
        # Get sample records
        samples = await db.payments.find({}, {"_id": 0}).limit(10).to_list(10)
        results["sample_records"] = samples
        
        # Diagnosis
        if null_orders > 0:
            results["issue"] = f"Found {null_orders} records with null order_id - run /api/admin/sales/fix-null-orders?dry_run=false to fix"
        elif total == 0:
            results["issue"] = "No payment records found - run backfill first"
        else:
            results["status"] = f"OK - {total} payment records found"
            
    except Exception as e:
        results["error"] = str(e)
    
    return results



@router.delete("/payment/{payment_id}")
async def delete_payment(payment_id: str, request: Request):
    """
    Delete a payment/transaction record from the sales data.
    Checks both payments and payment_orders collections.
    
    Usage: DELETE /api/admin/sales/payment/{payment_id}
    """
    await verify_admin(request)
    db = get_db(request)
    
    try:
        deleted_record = None
        
        # First, try to find and delete from payments collection
        payment = await db.payments.find_one({"id": payment_id})
        if payment:
            await db.payments.delete_one({"id": payment_id})
            deleted_record = payment
        
        # If not found in payments, try payment_orders collection
        if not deleted_record:
            payment = await db.payment_orders.find_one({"id": payment_id})
            if payment:
                await db.payment_orders.delete_one({"id": payment_id})
                deleted_record = payment
        
        # If still not found, try by razorpay_order_id
        if not deleted_record:
            payment = await db.payments.find_one({"razorpay_order_id": payment_id})
            if payment:
                await db.payments.delete_one({"razorpay_order_id": payment_id})
                deleted_record = payment
        
        if not deleted_record:
            payment = await db.payment_orders.find_one({"razorpay_order_id": payment_id})
            if payment:
                await db.payment_orders.delete_one({"razorpay_order_id": payment_id})
                deleted_record = payment
        
        if not deleted_record:
            raise HTTPException(status_code=404, detail=f"Transaction with id {payment_id} not found in payments or payment_orders")
        
        return {
            "success": True,
            "message": f"Transaction {payment_id} deleted successfully",
            "deleted_record": {
                "id": deleted_record.get("id"),
                "user_email": deleted_record.get("user_email"),
                "amount": deleted_record.get("amount"),
                "plan_key": deleted_record.get("plan_key")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
