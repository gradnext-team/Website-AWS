"""
Sales & Analytics API Routes
Handles sales data, invoices, and P&L metrics
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncio
import uuid

from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/sales", tags=["sales"])


# ============ Pydantic Models ============

class InvoiceCreate(BaseModel):
    user_id: str
    plan: str
    amount: float
    payment_method: str = "razorpay"
    status: str = "paid"
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


# ============ Admin Verification ============

async def verify_admin(request: Request):
    """Verify the current user is an admin"""
    user = await get_current_user(request)
    # Handle both dict and object user types
    if isinstance(user, dict):
        is_admin = user.get('is_admin', False)
    else:
        is_admin = getattr(user, 'is_admin', False)
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============ Dashboard Metrics ============

def parse_datetime_safe(dt_value):
    """Safely parse datetime from various formats"""
    if not dt_value:
        return None
    if isinstance(dt_value, datetime):
        return dt_value
    try:
        dt_str = str(dt_value).replace('Z', '+00:00')
        if '+00:00' in dt_str:
            dt_str = dt_str.replace('+00:00', '')
        return datetime.fromisoformat(dt_str)
    except:
        return None


@router.get("/metrics")
async def get_sales_metrics(request: Request):
    """Get sales dashboard metrics - combines invoices and subscription payments"""
    await verify_admin(request)
    db = get_db(request)
    
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (first_of_month - timedelta(days=1)).replace(day=1)
    this_month_iso = first_of_month.isoformat()
    last_month_iso = last_month_start.isoformat()

    # ========== INVOICES — aggregate in DB instead of loading all records ==========
    invoice_agg, payment_agg, users_by_plan_agg = await asyncio.gather(
        db.invoices.aggregate([{"$facet": {
            "all_paid":       [{"$match": {"status": "paid"}},    {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}],
            "pending":        [{"$match": {"status": "pending"}}, {"$count": "n"}],
            "refunded":       [{"$match": {"status": "refunded"}},{"$count": "n"}],
            "this_month":     [{"$match": {"status": "paid", "created_at": {"$gte": this_month_iso}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}],
            "last_month":     [{"$match": {"status": "paid", "created_at": {"$gte": last_month_iso, "$lt": this_month_iso}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}],
            "by_plan":        [{"$match": {"status": "paid"}}, {"$group": {"_id": "$plan", "total": {"$sum": "$amount"}}}],
        }}]).to_list(1),
        db.payments.aggregate([{"$facet": {
            "all_captured":   [{"$match": {"status": "captured"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}],
            "this_month":     [{"$match": {"status": "captured", "created_at": {"$gte": this_month_iso}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}],
            "last_month":     [{"$match": {"status": "captured", "created_at": {"$gte": last_month_iso, "$lt": this_month_iso}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}],
            "by_plan":        [{"$match": {"status": "captured"}}, {"$group": {"_id": {"$ifNull": ["$plan_key", "$plan_name"]}, "total": {"$sum": "$amount"}}}],
        }}]).to_list(1),
        db.users.aggregate([{"$group": {"_id": "$plan", "count": {"$sum": 1}}}]).to_list(50),
    )

    ia = invoice_agg[0] if invoice_agg else {}
    pa = payment_agg[0] if payment_agg else {}

    invoice_revenue       = (ia.get("all_paid")   or [{}])[0].get("total", 0)
    paid_invoices         = (ia.get("all_paid")   or [{}])[0].get("count", 0)
    pending_invoices      = (ia.get("pending")    or [{}])[0].get("n", 0)
    refunded_invoices     = (ia.get("refunded")   or [{}])[0].get("n", 0)
    this_month_invoice_revenue  = (ia.get("this_month") or [{}])[0].get("total", 0)
    last_month_invoice_revenue  = (ia.get("last_month") or [{}])[0].get("total", 0)

    subscription_revenue        = (pa.get("all_captured") or [{}])[0].get("total", 0)
    total_subscriptions         = (pa.get("all_captured") or [{}])[0].get("count", 0)
    this_month_subscription_revenue = (pa.get("this_month") or [{}])[0].get("total", 0)
    last_month_subscription_revenue = (pa.get("last_month") or [{}])[0].get("total", 0)

    total_revenue       = invoice_revenue + subscription_revenue
    total_transactions  = paid_invoices + total_subscriptions
    this_month_revenue  = this_month_invoice_revenue + this_month_subscription_revenue
    last_month_revenue  = last_month_invoice_revenue + last_month_subscription_revenue

    revenue_by_plan: dict = {}
    for row in ia.get("by_plan", []):
        revenue_by_plan[row["_id"] or "unknown"] = row["total"]
    for row in pa.get("by_plan", []):
        key = row["_id"] or "unknown"
        revenue_by_plan[key] = revenue_by_plan.get(key, 0) + row["total"]

    revenue_by_source = {"invoices": invoice_revenue, "subscriptions": subscription_revenue}

    users_by_plan = {row["_id"] or "free_trial": row["count"] for row in users_by_plan_agg}
    
    # Monthly revenue trend (last 6 months) — single aggregation instead of Python loops
    monthly_trend = []
    month_bounds = []
    for i in range(5, -1, -1):
        ms = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        me = (ms + timedelta(days=32)).replace(day=1)
        month_bounds.append((ms, me))

    monthly_invoice_agg, monthly_payment_agg = await asyncio.gather(
        db.invoices.aggregate([
            {"$match": {"status": "paid", "created_at": {"$gte": month_bounds[0][0].isoformat()}}},
            {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "total": {"$sum": "$amount"}}}
        ]).to_list(12),
        db.payments.aggregate([
            {"$match": {"status": "captured", "created_at": {"$gte": month_bounds[0][0].isoformat()}}},
            {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "total": {"$sum": "$amount"}}}
        ]).to_list(12),
    )
    inv_by_month = {r["_id"]: r["total"] for r in monthly_invoice_agg}
    pay_by_month = {r["_id"]: r["total"] for r in monthly_payment_agg}

    for ms, _ in month_bounds:
        key = ms.strftime("%Y-%m")
        mi = inv_by_month.get(key, 0)
        ms_rev = pay_by_month.get(key, 0)
        monthly_trend.append({
            "month": ms.strftime("%b %Y"),
            "revenue": mi + ms_rev,
            "invoices": mi,
            "subscriptions": ms_rev,
        })
    
    return {
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "last_month_revenue": last_month_revenue,
        "growth_percentage": round(((this_month_revenue - last_month_revenue) / max(last_month_revenue, 1)) * 100, 1) if last_month_revenue > 0 else 0,
        "total_transactions": total_transactions,
        "total_invoices": paid_invoices + pending_invoices + refunded_invoices,
        "paid_invoices": paid_invoices,
        "pending_invoices": pending_invoices,
        "refunded_invoices": refunded_invoices,
        "total_subscriptions": total_subscriptions,
        "revenue_by_plan": revenue_by_plan,
        "revenue_by_source": revenue_by_source,
        "users_by_plan": users_by_plan,
        "monthly_trend": monthly_trend,
        "average_order_value": round(total_revenue / max(total_transactions, 1), 2)
    }


@router.get("/invoices")
async def get_all_invoices(request: Request, status: str = None, source: str = None, limit: int = 100, skip: int = 0):
    """Get all invoices/payments with optional filtering.
    
    Query params:
    - status: Filter by status (paid, pending, refunded, captured)
    - source: Filter by source (invoice, payment_order, subscription)
    - limit: Max results (default 100)
    - skip: Pagination offset
    """
    await verify_admin(request)
    db = get_db(request)
    
    invoices_list = []
    
    # ========== 1. INVOICES (Manual/Admin Created) ==========
    if not source or source == "invoice":
        query = {}
        if status:
            query["status"] = status
        
        invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        for inv in invoices:
            user = await db.users.find_one({"id": inv.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
            inv["user"] = user
            inv["source"] = "invoice"
            inv["source_label"] = "Manual Invoice"
            if "base_amount" not in inv:
                inv["base_amount"] = inv.get("amount", 0)
            if "discount_amount" not in inv:
                inv["discount_amount"] = 0
            if "gst" not in inv:
                inv["gst"] = 0
            if "coupon_code" not in inv:
                inv["coupon_code"] = None
            invoices_list.append(inv)
    
    # ========== 2. PAYMENT ORDERS (Checkout completions) ==========
    if not source or source == "payment_order":
        payment_query = {}
        if status:
            if status == "paid":
                payment_query["status"] = {"$in": ["completed", "paid"]}
            else:
                payment_query["status"] = status
        else:
            payment_query["status"] = {"$in": ["completed", "paid"]}
        
        payment_orders = await db.payment_orders.find(payment_query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        for order in payment_orders:
            user = await db.users.find_one({"id": order.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
            
            coupon_code = None
            applied_discounts = order.get("applied_discounts", [])
            for discount in applied_discounts:
                if discount.get("discount_type") == "coupon" or discount.get("code"):
                    coupon_code = discount.get("code") or discount.get("discount_name")
                    break
            
            invoice_entry = {
                "id": order.get("id"),
                "user_id": order.get("user_id"),
                "user": user,
                "plan": order.get("plan_key") or order.get("plan_name"),
                "plan_name": order.get("plan_name"),
                "base_amount": order.get("base_amount", order.get("amount", 0)),
                "discount_amount": order.get("discount_amount", 0),
                "discounted_price": order.get("discounted_price", order.get("amount", 0)),
                "gst": order.get("gst", 0),
                "amount": order.get("amount", 0),
                "coupon_code": coupon_code,
                "applied_discounts": applied_discounts,
                "status": "paid" if order.get("status") in ["completed", "paid"] else order.get("status"),
                "payment_method": "razorpay",
                "razorpay_order_id": order.get("razorpay_order_id"),
                "razorpay_payment_id": order.get("razorpay_payment_id"),
                "created_at": order.get("created_at"),
                "source": "payment_order",
                "source_label": "Checkout Payment"
            }
            invoices_list.append(invoice_entry)
    
    # ========== 3. SUBSCRIPTION PAYMENTS (Razorpay Subscriptions) ==========
    if not source or source == "subscription":
        sub_query = {}
        if status:
            if status == "paid":
                sub_query["status"] = "captured"
            else:
                sub_query["status"] = status
        else:
            sub_query["status"] = "captured"
        
        payments = await db.payments.find(sub_query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        for payment in payments:
            user = await db.users.find_one({"id": payment.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
            
            invoice_entry = {
                "id": payment.get("id"),
                "user_id": payment.get("user_id"),
                "user_email": payment.get("user_email"),
                "user": user,
                "plan": payment.get("plan_key"),
                "plan_name": payment.get("plan_name"),
                "plan_category": payment.get("plan_category"),
                "base_amount": payment.get("amount", 0),
                "discount_amount": 0,
                "amount": payment.get("amount", 0),
                "currency": payment.get("currency", "INR"),
                "status": "paid" if payment.get("status") == "captured" else payment.get("status"),
                "payment_method": "razorpay",
                "razorpay_order_id": payment.get("razorpay_order_id"),
                "razorpay_payment_id": payment.get("razorpay_payment_id"),
                "subscription_start": payment.get("subscription_start"),
                "subscription_end": payment.get("subscription_end"),
                "coaching_sessions": payment.get("coaching_sessions", 0),
                "strategy_calls": payment.get("strategy_calls", 0),
                "created_at": payment.get("created_at"),
                "source": "subscription",
                "source_label": "Subscription Payment"
            }
            invoices_list.append(invoice_entry)
    
    # Sort by created_at descending
    invoices_list.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    
    # Apply pagination
    total = len(invoices_list)
    invoices_list = invoices_list[skip:skip + limit]
    
    return {"invoices": invoices_list, "total": total}


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, request: Request):
    """Get single invoice details"""
    await verify_admin(request)
    db = get_db(request)
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get user details
    user = await db.users.find_one({"id": invoice.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "picture": 1, "plan": 1})
    invoice["user"] = user
    
    return invoice


@router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate, request: Request):
    """Create a new invoice (manual entry)"""
    await verify_admin(request)
    db = get_db(request)
    
    invoice_id = f"INV-{str(uuid.uuid4())[:8].upper()}"
    
    invoice = {
        "id": invoice_id,
        "user_id": invoice_data.user_id,
        "plan": invoice_data.plan,
        "amount": invoice_data.amount,
        "payment_method": invoice_data.payment_method,
        "status": invoice_data.status,
        "notes": invoice_data.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.invoices.insert_one(invoice)
    
    return {"message": "Invoice created successfully", "invoice_id": invoice_id}


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, invoice_data: InvoiceUpdate, request: Request):
    """Update invoice status or notes"""
    await verify_admin(request)
    db = get_db(request)
    
    update_data = {k: v for k, v in invoice_data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice updated successfully"}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, request: Request):
    """Delete an invoice"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice deleted successfully"}


@router.post("/invoices/{invoice_id}/refund")
async def refund_invoice(invoice_id: str, request: Request):
    """Mark invoice as refunded"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "refunded", "refunded_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice refunded successfully"}


# ============ P&L Report ============

@router.get("/pnl")
async def get_pnl_report(request: Request, period: str = "monthly"):
    """Get P&L report"""
    await verify_admin(request)
    db = get_db(request)
    
    invoices = await db.invoices.find({"status": "paid"}, {"_id": 0}).to_list(1000)
    
    # Revenue
    total_revenue = sum(inv.get("amount", 0) for inv in invoices)
    
    # Simulated costs (in production, these would come from actual data)
    platform_costs = total_revenue * 0.03  # 3% payment gateway fees
    mentor_payouts = total_revenue * 0.40  # 40% to mentors
    operational_costs = 50000  # Fixed monthly costs
    marketing_costs = total_revenue * 0.15  # 15% marketing spend
    
    gross_profit = total_revenue - platform_costs
    operating_expenses = mentor_payouts + operational_costs + marketing_costs
    net_profit = gross_profit - operating_expenses
    
    return {
        "period": period,
        "revenue": {
            "total": total_revenue,
            "subscription": total_revenue * 0.4,
            "coaching": total_revenue * 0.45,
            "cohort": total_revenue * 0.15
        },
        "costs": {
            "platform_fees": platform_costs,
            "mentor_payouts": mentor_payouts,
            "operational": operational_costs,
            "marketing": marketing_costs
        },
        "gross_profit": gross_profit,
        "gross_margin": (gross_profit / max(total_revenue, 1)) * 100,
        "operating_expenses": operating_expenses,
        "net_profit": net_profit,
        "net_margin": (net_profit / max(total_revenue, 1)) * 100
    }
