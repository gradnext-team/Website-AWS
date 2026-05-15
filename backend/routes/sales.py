"""
Sales & Analytics API Routes
Handles sales data, invoices, and P&L metrics
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
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
    
    # ========== INVOICES (Manual/Admin Created) ==========
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(10000)
    
    invoice_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
    paid_invoices = len([inv for inv in invoices if inv.get("status") == "paid"])
    pending_invoices = len([inv for inv in invoices if inv.get("status") == "pending"])
    refunded_invoices = len([inv for inv in invoices if inv.get("status") == "refunded"])
    
    # ========== SUBSCRIPTION PAYMENTS (Razorpay) ==========
    payments = await db.payments.find({"status": "captured"}, {"_id": 0}).to_list(10000)
    
    subscription_revenue = sum(p.get("amount", 0) for p in payments)
    total_subscriptions = len(payments)
    
    # ========== COMBINED METRICS ==========
    total_revenue = invoice_revenue + subscription_revenue
    total_transactions = paid_invoices + total_subscriptions
    
    # This month's revenue (combined)
    this_month_invoice_revenue = sum(
        inv.get("amount", 0) for inv in invoices 
        if inv.get("status") == "paid" and parse_datetime_safe(inv.get("created_at")) and 
        parse_datetime_safe(inv.get("created_at")) >= first_of_month
    )
    
    this_month_subscription_revenue = sum(
        p.get("amount", 0) for p in payments 
        if parse_datetime_safe(p.get("created_at")) and 
        parse_datetime_safe(p.get("created_at")) >= first_of_month
    )
    
    this_month_revenue = this_month_invoice_revenue + this_month_subscription_revenue
    
    # Last month's revenue (combined)
    last_month_invoice_revenue = sum(
        inv.get("amount", 0) for inv in invoices 
        if inv.get("status") == "paid" and parse_datetime_safe(inv.get("created_at")) and 
        last_month_start <= parse_datetime_safe(inv.get("created_at")) < first_of_month
    )
    
    last_month_subscription_revenue = sum(
        p.get("amount", 0) for p in payments 
        if parse_datetime_safe(p.get("created_at")) and 
        last_month_start <= parse_datetime_safe(p.get("created_at")) < first_of_month
    )
    
    last_month_revenue = last_month_invoice_revenue + last_month_subscription_revenue
    
    # Revenue by plan (combined)
    revenue_by_plan = {}
    
    # From invoices
    for inv in invoices:
        if inv.get("status") == "paid":
            plan = inv.get("plan", "unknown")
            revenue_by_plan[plan] = revenue_by_plan.get(plan, 0) + inv.get("amount", 0)
    
    # From subscription payments
    for p in payments:
        plan = p.get("plan_key") or p.get("plan_name", "unknown")
        revenue_by_plan[plan] = revenue_by_plan.get(plan, 0) + p.get("amount", 0)
    
    # Revenue by source
    revenue_by_source = {
        "invoices": invoice_revenue,
        "subscriptions": subscription_revenue
    }
    
    # Get user count by plan
    users = await db.users.find({}, {"_id": 0, "plan": 1}).to_list(10000)
    users_by_plan = {}
    for user in users:
        plan = user.get("plan", "free_trial")
        users_by_plan[plan] = users_by_plan.get(plan, 0) + 1
    
    # Monthly revenue trend (last 6 months) - combined
    monthly_trend = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        
        # Invoice revenue for this month
        month_invoice_rev = sum(
            inv.get("amount", 0) for inv in invoices 
            if inv.get("status") == "paid" and parse_datetime_safe(inv.get("created_at")) and 
            month_start <= parse_datetime_safe(inv.get("created_at")) < month_end
        )
        
        # Subscription revenue for this month
        month_sub_rev = sum(
            p.get("amount", 0) for p in payments 
            if parse_datetime_safe(p.get("created_at")) and 
            month_start <= parse_datetime_safe(p.get("created_at")) < month_end
        )
        
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "revenue": month_invoice_rev + month_sub_rev,
            "invoices": month_invoice_rev,
            "subscriptions": month_sub_rev
        })
    
    return {
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "last_month_revenue": last_month_revenue,
        "growth_percentage": round(((this_month_revenue - last_month_revenue) / max(last_month_revenue, 1)) * 100, 1) if last_month_revenue > 0 else 0,
        "total_transactions": total_transactions,
        "total_invoices": len(invoices),
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
