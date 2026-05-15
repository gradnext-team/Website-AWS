"""
Razorpay Subscriptions Management
Handles recurring subscriptions with auto-renewal, plan changes, and cancellations.

Key Concepts:
- Razorpay Plans: Define billing amount and cycle (created per unique price point)
- Razorpay Subscriptions: Links a user to a plan with auto-renewal
- Grandfathering: Users keep their subscribed price even if plan price changes
- Proration: Upgrade immediately, pay difference. Downgrade at period end.
"""

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
import razorpay
import hmac
import hashlib
import os
import uuid
import json
import logging

from routes.auth import get_current_user, get_db
from services import meta_pixel_service
from services import mixpanel_service
from services.google_sheets_service import update_user_upgrade_in_sheet

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Razorpay client initialization
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# ============== Pydantic Models ==============

class CreateSubscriptionRequest(BaseModel):
    plan_key: str  # e.g., "pro_plan"
    billing_cycle: Literal["monthly", "6_month"]
    coupon_code: Optional[str] = None  # Optional coupon for first payment discount
    offer_id: Optional[str] = None  # Razorpay offer ID for subscription discounts (created in Razorpay Dashboard)


class ChangePlanRequest(BaseModel):
    new_plan_key: str
    new_billing_cycle: Literal["monthly", "6_month"]


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = None


# ============== Helper Functions ==============

def get_razorpay_client():
    """Get Razorpay client or raise error if not configured"""
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    return razorpay_client


async def get_or_create_razorpay_plan(db, plan_key: str, billing_cycle: str, amount: int, plan_name: str):
    """
    Get existing Razorpay plan or create new one for the given price point.
    Each unique (plan_key, billing_cycle, amount) combination = separate Razorpay plan.
    This enables grandfathering - old subscribers stay on old price plans.
    """
    client = get_razorpay_client()
    
    # Create a unique identifier for this price point
    plan_identifier = f"{plan_key}_{billing_cycle}_{amount}"
    
    # Check if we already have a Razorpay plan for this price
    existing = await db.razorpay_plans.find_one({"plan_identifier": plan_identifier})
    if existing:
        return existing["razorpay_plan_id"]
    
    # Create new Razorpay plan
    period = "monthly" if billing_cycle == "monthly" else "monthly"
    interval = 1 if billing_cycle == "monthly" else 6
    
    try:
        razorpay_plan = client.plan.create({
            "period": period,
            "interval": interval,
            "item": {
                "name": f"{plan_name} ({billing_cycle.replace('_', ' ').title()})",
                "amount": amount * 100,  # Razorpay uses paise
                "currency": "INR",
                "description": f"{plan_name} - {billing_cycle.replace('_', ' ')} billing"
            }
        })
        
        # Store mapping in database
        await db.razorpay_plans.insert_one({
            "plan_identifier": plan_identifier,
            "razorpay_plan_id": razorpay_plan["id"],
            "plan_key": plan_key,
            "billing_cycle": billing_cycle,
            "amount": amount,
            "plan_name": plan_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Created Razorpay plan: {razorpay_plan['id']} for {plan_identifier}")
        return razorpay_plan["id"]
        
    except Exception as e:
        logger.error(f"Failed to create Razorpay plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create subscription plan: {str(e)}")


def calculate_period_end(billing_cycle: str, start_date: datetime = None) -> datetime:
    """Calculate subscription period end date"""
    start = start_date or datetime.now(timezone.utc)
    if billing_cycle == "monthly":
        return start + relativedelta(months=1)
    else:  # 6_month
        return start + relativedelta(months=6)


def calculate_proration(current_price: int, new_price: int, days_remaining: int, days_in_period: int) -> dict:
    """
    Calculate prorated charge for plan upgrades.
    
    Args:
        current_price: Current plan price (full period)
        new_price: New plan price (full period)
        days_remaining: Days left in current period
        days_in_period: Total days in current period
    
    Returns:
        dict with unused_credit, new_cost, charge_amount
    """
    # Credit for unused portion of current plan
    unused_credit = (days_remaining / days_in_period) * current_price
    
    # Cost for remaining days at new plan rate (normalized to same period)
    new_cost_for_remaining = (days_remaining / days_in_period) * new_price
    
    # If upgrading to longer cycle (e.g., monthly to 6-month), charge full new price minus credit
    charge_amount = new_price - unused_credit
    
    return {
        "unused_credit": round(unused_credit, 2),
        "new_cost": round(new_cost_for_remaining, 2),
        "charge_amount": round(max(0, charge_amount), 2)
    }


def calculate_anniversary_proration(
    current_price: int, 
    new_price: int, 
    period_start: datetime, 
    period_end: datetime,
    current_billing_cycle: str,
    new_billing_cycle: str,
    is_manual_upgrade: bool = False
) -> dict:
    """
    Calculate prorated charge for IMMEDIATE upgrades with anniversary-aligned end dates.
    
    Key Logic:
    - User gets IMMEDIATE access to new plan
    - End date = Original subscription start + new plan period
    - Credit = (Unused days / Old plan period) × Old plan price
    - Cost = (Remaining days / New plan period) × New plan price
    - User pays = Cost - Credit
    
    Example: Basic Monthly (₹499) → Pro 6-Month (₹3,294)
    - Original Start (Anniversary): Jan 15
    - Upgrade Date: Jan 25 (10 days used, 20 days unused in monthly)
    - New End Date: July 15 (Jan 15 + 6 months)
    - Days remaining to new end: 171 days (Jan 25 → July 15)
    
    Calculation:
    - Credit from monthly: (20/30) × ₹499 = ₹332.67
    - Prorated 6-month cost: (171/180) × ₹3,294 = ₹3,129.30
    - User pays: ₹3,129.30 - ₹332.67 = ₹2,796.63
    
    Args:
        current_price: Current plan price for full billing period
        new_price: New plan price for full billing period  
        period_start: Start of current billing period (original subscription date)
        period_end: End of current billing period
        current_billing_cycle: Current billing cycle ('monthly' or '6_month')
        new_billing_cycle: New billing cycle ('monthly' or '6_month')
        is_manual_upgrade: If True, no credit given (goodwill upgrade)
    
    Returns:
        dict with proration details including new_plan_end_date for immediate activation
    """
    now = datetime.now(timezone.utc)
    
    # Current period length for credit calculation
    current_period_days = (period_end - period_start).days or 30
    days_remaining_current = max(0, (period_end - now).days)
    
    # Credit for unused portion of current plan
    # Manual upgrades get ZERO credit (assumed goodwill/free upgrade)
    if is_manual_upgrade:
        daily_rate_current = 0
        unused_credit = 0
    else:
        daily_rate_current = current_price / current_period_days
        unused_credit = days_remaining_current * daily_rate_current
    
    # Calculate NEW plan end date based on original anniversary + new plan period
    # This preserves the anniversary date for future renewals
    if new_billing_cycle == "6_month":
        new_plan_end_date = period_start + relativedelta(months=6)
        new_period_days = 180  # 6 months
    else:
        new_plan_end_date = period_start + relativedelta(months=1)
        new_period_days = 30  # 1 month
    
    # If new end date is somehow in the past (shouldn't happen), adjust
    if new_plan_end_date <= now:
        if new_billing_cycle == "6_month":
            new_plan_end_date = now + relativedelta(months=6)
        else:
            new_plan_end_date = now + relativedelta(months=1)
    
    # Calculate days from NOW to new plan end date (this is what user is paying for)
    days_until_new_end = max(1, (new_plan_end_date - now).days)
    
    # Calculate new plan cost for days until new end date (prorated)
    daily_rate_new = new_price / new_period_days
    new_cost_for_remaining = days_until_new_end * daily_rate_new
    
    # Prorated charge = new plan cost for remaining days - credit from old plan
    prorated_charge = max(0, new_cost_for_remaining - unused_credit)
    
    # Calculate days used in current period (for logging)
    days_used = max(0, (now - period_start).days)
    
    logger.info(f"Proration calculation: "
                f"current_price={current_price}, new_price={new_price}, "
                f"days_remaining_current={days_remaining_current}, days_until_new_end={days_until_new_end}, "
                f"unused_credit={unused_credit:.2f}, new_cost={new_cost_for_remaining:.2f}, "
                f"prorated_charge={prorated_charge:.2f}")
    
    return {
        "days_used": days_used,
        "days_remaining_current_period": days_remaining_current,
        "days_until_new_end": days_until_new_end,
        "current_period_days": current_period_days,
        "new_period_days": new_period_days,
        "daily_rate_current": round(daily_rate_current, 2),
        "daily_rate_new": round(daily_rate_new, 2),
        "unused_credit": round(unused_credit, 2),
        "new_cost_for_remaining": round(new_cost_for_remaining, 2),
        "prorated_charge": round(prorated_charge, 2),
        "new_plan_start_date": now.isoformat(),  # IMMEDIATE start
        "new_plan_end_date": new_plan_end_date.isoformat(),  # Anniversary-aligned end
        "new_full_price": new_price,
        "is_manual_upgrade": is_manual_upgrade,
        # Keep these for backward compatibility
        "anniversary_date": new_plan_end_date.isoformat(),
        "new_period_start": now.isoformat(),
        "new_period_end": new_plan_end_date.isoformat()
    }


def is_upgrade(current_tier: str, current_cycle: str, new_tier: str, new_cycle: str) -> bool:
    """
    Determine if a plan change is an upgrade (immediate) or downgrade (scheduled).
    
    Upgrade = Higher tier OR longer billing cycle (with same/higher tier)
    Downgrade = Lower tier OR shorter billing cycle
    """
    tier_order = {"basic_plan": 1, "pro_plan": 2, "pro_plus": 3}
    cycle_order = {"monthly": 1, "6_month": 2, "6-month": 2, "six_month": 2}  # Handle variations
    
    current_tier_rank = tier_order.get(current_tier, 0)
    new_tier_rank = tier_order.get(new_tier, 0)
    current_cycle_rank = cycle_order.get(current_cycle, 0)
    new_cycle_rank = cycle_order.get(new_cycle, 0)
    
    # Log for debugging
    logger.info(f"is_upgrade check: current_tier={current_tier}(rank={current_tier_rank}), "
                f"current_cycle={current_cycle}(rank={current_cycle_rank}), "
                f"new_tier={new_tier}(rank={new_tier_rank}), "
                f"new_cycle={new_cycle}(rank={new_cycle_rank})")
    
    # Tier upgrade
    if new_tier_rank > current_tier_rank:
        logger.info(f"is_upgrade=True (tier upgrade: {current_tier_rank} -> {new_tier_rank})")
        return True
    
    # Cycle upgrade (longer billing) with same or higher tier
    if new_cycle_rank > current_cycle_rank and new_tier_rank >= current_tier_rank:
        logger.info(f"is_upgrade=True (cycle upgrade with same/higher tier)")
        return True
    
    logger.info(f"is_upgrade=False (not an upgrade)")
    return False


# ============== API Endpoints ==============

@router.get("/status")
async def get_subscription_status(request: Request):
    """Get current user's subscription status"""
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    
    # For manually upgraded users, create a virtual subscription object from plan fields
    # This handles users upgraded via admin panel without full subscription structure
    if not subscription and user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"]:
        # Only create virtual subscription if we have date data
        start_date = user.get("plan_start_date")
        end_date = user.get("plan_end_date") or user.get("subscription_end_date")
        
        if start_date and end_date:
            subscription = {
                "status": "active",
                "plan_key": user.get("plan"),
                "billing_cycle": "monthly",  # Default assumption for manual upgrades
                "locked_price": get_plan_price(user.get("plan"), "monthly"),
                "current_period_start": start_date,
                "current_period_end": end_date,
                "auto_renew": False,
                "is_manual_upgrade": True
            }
        else:
            # User has plan but no dates - treat as legacy/incomplete data
            subscription = {
                "status": "active",
                "plan_key": user.get("plan"),
                "billing_cycle": "monthly",
                "locked_price": get_plan_price(user.get("plan"), "monthly"),
                "auto_renew": False,
                "is_manual_upgrade": True,
                "is_legacy_data": True
            }
    
    # Check if subscription is active
    is_active = subscription.get("status") in ["active", "authenticated"]
    has_access = False
    
    # Get period end - check both subscription object and fallback fields
    period_end = (
        subscription.get("current_period_end") or 
        user.get("plan_end_date") or 
        user.get("subscription_end_date")
    )
    
    if is_active and period_end:
        try:
            end_date = parse_datetime_safe(period_end)
            if end_date:
                has_access = datetime.now(timezone.utc) < end_date
            else:
                has_access = True
        except Exception:
            has_access = True  # If date parsing fails, assume access
    
    # Also check for cancelled but still in period
    if subscription.get("status") == "cancelled" and period_end:
        try:
            end_date = parse_datetime_safe(period_end)
            if end_date:
                has_access = datetime.now(timezone.utc) < end_date
        except Exception:
            pass
    
    # Get period start - check both subscription object and fallback fields
    period_start = (
        subscription.get("current_period_start") or 
        user.get("plan_start_date")
    )
    
    return {
        "has_subscription": bool(subscription.get("razorpay_subscription_id")) or bool(subscription.get("is_manual_upgrade")),
        "status": subscription.get("status", "none"),
        "plan_key": subscription.get("plan_key") or user.get("plan"),
        "billing_cycle": subscription.get("billing_cycle"),
        "locked_price": subscription.get("locked_price"),
        "current_period_start": period_start,
        "current_period_end": period_end,
        "auto_renew": subscription.get("auto_renew", False),
        "pending_change": subscription.get("pending_change"),
        "has_access": has_access,
        "is_subscription_plan": user.get("plan_category") == "subscription" or user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"],
        "is_manual_upgrade": subscription.get("is_manual_upgrade", False)
    }


def parse_datetime_safe(date_str) -> datetime:
    """Parse datetime string safely, ensuring timezone awareness"""
    if not date_str:
        return None
    try:
        # Handle Z suffix
        if isinstance(date_str, str):
            date_str = date_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(date_str)
        else:
            dt = date_str
        
        # Ensure timezone awareness
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def get_plan_price(plan_key: str, billing_cycle: str) -> int:
    """Get default price for a plan - used for manual upgrades without price data"""
    prices = {
        "basic_plan": {"monthly": 499, "6_month": 2394},
        "pro_plan": {"monthly": 699, "6_month": 3294},
        "pro_plus": {"monthly": 1299, "6_month": 6234},
    }
    return prices.get(plan_key, {}).get(billing_cycle, 0)


@router.post("/create")
async def create_subscription(data: CreateSubscriptionRequest, request: Request):
    """
    Create a new subscription for the user.
    Returns Razorpay subscription details for checkout.
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # DEBUG: Log incoming request
    logger.info(f"🔵 [SUBSCRIPTION CREATE] User: {user.get('id')}")
    logger.info(f"🔵 [SUBSCRIPTION CREATE] Plan: {data.plan_key}, Billing: {data.billing_cycle}")
    logger.info(f"🔵 [SUBSCRIPTION CREATE] Coupon code: {data.coupon_code if data.coupon_code else 'None'}")
    
    # Check if user already has active subscription
    existing_sub = user.get("subscription", {})
    pending_sub = user.get("pending_subscription", {})
    
    # Block if user has an ACTIVE subscription
    if existing_sub.get("status") == "active":
        raise HTTPException(
            status_code=400, 
            detail="You already have an active subscription. Please cancel or change your current plan."
        )
    
    # Handle stuck subscriptions - allow retry for failed/pending payments
    # Cases: 
    # 1. Subscription with status "created" or "authenticated" (payment not completed)
    # 2. Pending subscription exists (user closed payment modal)
    # 3. Subscription with status "halted" (payment failed after retries)
    should_clear_stuck = False
    
    if existing_sub.get("status") in ["authenticated", "created", "halted"]:
        logger.info(f"User {user.get('id')} has stuck subscription with status '{existing_sub.get('status')}', allowing retry")
        should_clear_stuck = True
    elif pending_sub:
        logger.info(f"User {user.get('id')} has pending subscription, allowing retry")
        should_clear_stuck = True
    
    # Clear stuck/pending subscriptions to allow fresh start
    if should_clear_stuck:
        await db.users.update_one(
            {"id": user.get("id")},
            {"$unset": {"subscription": "", "pending_subscription": ""}}
        )
        logger.info(f"Cleared stuck subscription data for user {user.get('id')}")
    
    # Get plan from database
    plan = await db.plans.find_one({"plan_key": data.plan_key, "category": "subscription"})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get pricing for the billing cycle
    # Note: six_month in pricing is the discounted per-month rate, not total
    pricing = plan.get("pricing", {})
    if data.billing_cycle == "monthly":
        amount = pricing.get("one_month") or pricing.get("monthly") or plan.get("price", 0)
    else:
        # six_month is per-month rate, multiply by 6 for total
        per_month = pricing.get("six_month") or pricing.get("6_month") or pricing.get("one_month") or plan.get("price", 0)
        amount = per_month * 6
    
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Plan pricing not configured. Please contact support.")
    
    # Store original base amount
    original_base_amount = amount
    
    # Validate coupon (for tracking only — Razorpay offer_id handles the actual discount)
    coupon_discount = 0
    coupon_details = None
    discount_type = None
    discount_value = 0
    
    if data.coupon_code:
        logger.info(f"Looking up coupon: {data.coupon_code.upper()}")
        coupon = await db.discounts.find_one({
            "code": data.coupon_code.upper(),
            "is_active": True
        })
        
        if coupon:
            logger.info(f"Found coupon: {coupon.get('code')}, type: {coupon.get('type')}")
            
            applies_to = coupon.get("applies_to", [])
            if "subscription" in applies_to or not applies_to:
                applicable_plans = coupon.get("applicable_plans", [])
                if not applicable_plans or data.plan_key in applicable_plans:
                    current_total_uses = coupon.get("current_total_uses", 0)
                    max_total_uses = coupon.get("max_total_uses")
                    
                    if max_total_uses is None or current_total_uses < max_total_uses:
                        discount_type = coupon.get("discount_type", "percentage")
                        discount_value = coupon.get("subscription_discount_value", 0)
                        
                        if discount_value:
                            # Calculate expected discount for tracking/display (NOT applied to Razorpay amount)
                            if discount_type == "percentage":
                                coupon_discount = round(original_base_amount * (discount_value / 100), 2)
                            else:
                                coupon_discount = min(discount_value, original_base_amount)
                            
                            coupon_details = {
                                "code": coupon.get("code"),
                                "discount_id": coupon.get("id"),
                                "discount_type": discount_type,
                                "discount_value": discount_value,
                                "discount_amount": coupon_discount,
                                "original_base_amount": original_base_amount,
                                "discounted_base_amount": original_base_amount - coupon_discount
                            }
                            logger.info(f"✅ Coupon {data.coupon_code} validated: ₹{coupon_discount} off (Razorpay offer handles actual discount)")
                        else:
                            logger.warning(f"Coupon has no subscription_discount_value!")
                    else:
                        logger.warning(f"Coupon usage limit exceeded: {current_total_uses}/{max_total_uses}")
                else:
                    logger.warning(f"Coupon not applicable to plan {data.plan_key}")
            else:
                logger.warning(f"Coupon not applicable to subscriptions")
        else:
            logger.warning(f"Coupon not found or not active: {data.coupon_code}")
    else:
        logger.info("No coupon code provided")
    
    # GST calculated on FULL base amount (Razorpay offer handles discount separately)
    gst_amount = round(original_base_amount * 0.18, 2)
    total_amount_with_gst = round(original_base_amount + gst_amount, 2)
    original_total_with_gst = total_amount_with_gst
    
    # First payment amount (for tracking) — Razorpay offer will apply the actual discount
    if coupon_discount > 0:
        discounted_base = original_base_amount - coupon_discount
        first_payment_gst = round(discounted_base * 0.18, 2)
        first_payment_amount = round(discounted_base + first_payment_gst, 2)
    else:
        first_payment_amount = total_amount_with_gst
    
    logger.info(f"=== SUBSCRIPTION CREATE ===")
    logger.info(f"Plan: {data.plan_key}, Billing: {data.billing_cycle}")
    logger.info(f"Base: {original_base_amount}, GST: {gst_amount}, Total to Razorpay: {total_amount_with_gst}")
    logger.info(f"Coupon discount (tracked): {coupon_discount}, Expected first payment: {first_payment_amount}")
    logger.info(f"Coupon code received: {data.coupon_code}")
    
    # Get or create Razorpay plan for this price point (FULL amount with GST, no discount)
    razorpay_plan_id = await get_or_create_razorpay_plan(
        db, 
        data.plan_key, 
        data.billing_cycle, 
        total_amount_with_gst,  # Full price — Razorpay offer handles discount
        plan.get("name", data.plan_key)
    )
    
    # Create Razorpay subscription
    try:
        # Total count calculation to stay within Razorpay's UPI limit (max 30 years)
        # Razorpay calculates end_time = start_time + (total_count × interval)
        # UPI has a stricter limit than other payment methods (30 years vs 100 years)
        # Monthly: 200 cycles × 1 month = ~16 years → OK for UPI
        # 6-month: Need to limit to 60 cycles × 6 months = 30 years exactly
        if data.billing_cycle == "monthly":
            total_count = 200  # ~16 years, within UPI limit
        else:
            total_count = 60  # 6-month: 60 × 6 = 30 years, stays within UPI 30-year limit
        
        # ============== SUBSCRIPTION WITH OFFER (Discounted First Payment) ==============
        # Razorpay Subscription Offers allow discounted first payment while collecting authorization
        # Offers must be created in Razorpay Dashboard: Subscriptions → Offers
        # Then pass offer_id when creating subscription
        
        # Check if we have an offer_id (either passed directly or mapped from coupon code)
        razorpay_offer_id = data.offer_id
        
        # If coupon code provided but no offer_id, try to find mapped offer_id from database
        if coupon_details and not razorpay_offer_id:
            # Look up Razorpay offer_id mapped to this coupon
            # Prefer "upi" payment method offer as it's more common in India
            coupon_offer_mapping = await db.discount_offer_mappings.find_one({
                "discount_id": coupon_details.get("discount_id"),
                "payment_method": "upi"
            })
            
            # If no UPI mapping, try Cards
            if not coupon_offer_mapping:
                coupon_offer_mapping = await db.discount_offer_mappings.find_one({
                    "discount_id": coupon_details.get("discount_id"),
                    "payment_method": "cards"
                })
            
            # Fallback to any available mapping
            if not coupon_offer_mapping:
                coupon_offer_mapping = await db.discount_offer_mappings.find_one({
                    "discount_id": coupon_details.get("discount_id")
                })
            
            if coupon_offer_mapping:
                razorpay_offer_id = coupon_offer_mapping.get("razorpay_offer_id")
                payment_method = coupon_offer_mapping.get("payment_method", "all")
                logger.info(f"Found Razorpay offer_id {razorpay_offer_id} for coupon {coupon_details['code']} (payment method: {payment_method})")
            else:
                logger.warning(f"No Razorpay offer mapping found for coupon {coupon_details['code']}. "
                              f"Create an offer in Razorpay Dashboard and map it to this coupon.")
        
        # Build subscription data
        subscription_data = {
            "plan_id": razorpay_plan_id,
            "total_count": total_count,
            "customer_notify": 1,  # Razorpay sends payment reminders
            "notes": {
                "user_id": user.get("id"),
                "user_email": user.get("email"),
                "plan_key": data.plan_key,
                "billing_cycle": data.billing_cycle,
                "base_amount": original_base_amount,
                "gst_amount": gst_amount,
                "total_amount": total_amount_with_gst
            }
        }
        
        # Add offer_id if available (for discounted first payment)
        if razorpay_offer_id:
            subscription_data["offer_id"] = razorpay_offer_id
            logger.info(f"Creating subscription with offer_id: {razorpay_offer_id}")
        
        razorpay_subscription = client.subscription.create(subscription_data)
        logger.info(f"Created Razorpay subscription: {razorpay_subscription['id']}")
        
        # Store subscription info (pending activation)
        subscription_info = {
            "razorpay_subscription_id": razorpay_subscription["id"],
            "razorpay_plan_id": razorpay_plan_id,
            "status": "created",
            "plan_key": data.plan_key,
            "billing_cycle": data.billing_cycle,
            "locked_price": original_total_with_gst,  # Regular price for renewals (no discount)
            "base_price": original_base_amount,
            "gst_amount": gst_amount,
            "auto_renew": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add coupon/offer details if applicable
        if coupon_details:
            subscription_info["first_payment_discounted"] = True
            subscription_info["first_payment_coupon"] = coupon_details
            subscription_info["first_payment_amount"] = first_payment_amount
            subscription_info["razorpay_offer_id"] = razorpay_offer_id
            
            # Record coupon usage intent
            await db.discount_usage_intents.insert_one({
                "discount_id": coupon_details["discount_id"],
                "user_id": user.get("id"),
                "subscription_id": razorpay_subscription["id"],
                "discount_amount": coupon_discount,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Update user with pending subscription
        await db.users.update_one(
            {"id": user.get("id")},
            {"$set": {"pending_subscription": subscription_info}}
        )
        
        # Track this subscription attempt as an Abandoned Cart entry. The row
        # is removed automatically once the matching subscription is activated
        # (via /activate, /activate-discounted, or webhook).
        try:
            from services.google_sheets_service import append_abandoned_cart_to_sheet
            user_for_sheet = await db.users.find_one(
                {"id": user.get("id")}, {"_id": 0}
            ) or {}
            await append_abandoned_cart_to_sheet(
                user_for_sheet,
                {
                    "plan_attempted_key": data.plan_key,
                    "plan_attempted_name": plan.get("name"),
                    "plan_attempted_type": "Subscription",
                    "attempted_at": subscription_info["created_at"],
                },
            )
        except Exception as cart_error:
            logger.warning(f"Abandoned cart tracking error (non-critical): {cart_error}")
        
        # Build response
        response_data = {
            "success": True,
            "payment_type": "subscription",
            "subscription_id": razorpay_subscription["id"],
            "razorpay_key": RAZORPAY_KEY_ID,
            "amount": total_amount_with_gst,  # Full amount — Razorpay offer handles discount
            "original_amount": total_amount_with_gst,
            "base_amount": original_base_amount,
            "discounted_base": original_base_amount - coupon_discount if coupon_discount else original_base_amount,
            "gst_amount": gst_amount,
            "expected_first_payment": first_payment_amount,
            "coupon_discount": coupon_discount,
            "currency": "INR",
            "plan_name": plan.get("name"),
            "billing_cycle": data.billing_cycle,
            "short_url": razorpay_subscription.get("short_url")
        }
        
        # Add discount info if applicable
        if coupon_details and razorpay_offer_id:
            response_data["coupon_applied"] = True
            response_data["coupon_code"] = coupon_details["code"]
            response_data["coupon_discount"] = coupon_discount
            response_data["first_payment_amount"] = first_payment_amount
            response_data["offer_id"] = razorpay_offer_id
            response_data["message"] = f"First payment: ₹{first_payment_amount:.0f} (discounted), then ₹{total_amount_with_gst:.0f}/{data.billing_cycle}"
        elif coupon_details and not razorpay_offer_id:
            # Coupon provided but no Razorpay offer mapped - inform user
            response_data["coupon_warning"] = f"Coupon '{coupon_details['code']}' is not configured for subscription discounts. Please contact support."
            response_data["message"] = f"₹{total_amount_with_gst:.0f}/{data.billing_cycle} (coupon not applied - no offer mapping)"
        
        return response_data
        
    except Exception as e:
        logger.error(f"Failed to create subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create subscription: {str(e)}")


class ActivateDiscountedRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/activate-discounted")
async def activate_discounted_subscription(data: ActivateDiscountedRequest, request: Request):
    """
    Activate subscription after discounted first payment.
    This is called when a coupon was applied and we used a one-time order for the first payment.
    After verification, we create the actual subscription starting from the next billing cycle.
    """
    db = get_db(request)
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user.get("id")
    logger.info(f"=== ACTIVATE DISCOUNTED SUBSCRIPTION ===")
    logger.info(f"User: {user.get('email')}, Order: {data.razorpay_order_id}")
    
    pending = user.get("pending_subscription")
    
    if not pending or pending.get("razorpay_order_id") != data.razorpay_order_id:
        logger.error(f"No matching pending subscription found for order {data.razorpay_order_id}")
        raise HTTPException(status_code=400, detail="No pending subscription found for this payment")
    
    # Verify the payment signature
    try:
        message = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != data.razorpay_signature:
            # Fallback: Check payment status directly from Razorpay
            payment = razorpay_client.payment.fetch(data.razorpay_payment_id)
            if payment.get("status") != "captured":
                raise HTTPException(status_code=400, detail="Payment verification failed")
            logger.info("Signature mismatch but payment is captured - proceeding")
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")
    
    logger.info("Payment verified successfully")
    
    # Get plan details
    plan_key = pending.get("plan_key")
    billing_cycle = pending.get("billing_cycle", "monthly")
    
    plan = await db.plans.find_one({"plan_key": plan_key})
    if not plan:
        raise HTTPException(status_code=400, detail=f"Plan not found: {plan_key}")
    
    now = datetime.now(timezone.utc)
    
    # Calculate subscription period
    if billing_cycle == "monthly":
        period_end = now + relativedelta(months=1)
    else:
        period_end = now + relativedelta(months=6)
    
    # Create the subscription for future renewals (starts after first period)
    try:
        razorpay_plan_id = pending.get("razorpay_plan_id")
        
        # Calculate total_count based on billing cycle to stay within Razorpay's 2121 limit
        # One less since first payment already done
        renewal_total_count = 199 if billing_cycle == "monthly" else 189
        
        # Create subscription starting from next billing cycle
        subscription_data = {
            "plan_id": razorpay_plan_id,
            "total_count": renewal_total_count,
            "customer_notify": 1,
            "start_at": int(period_end.timestamp()),  # Start after first period
            "notes": {
                "user_id": user_id,
                "user_email": user.get("email"),
                "plan_key": plan_key,
                "billing_cycle": billing_cycle,
                "first_payment_discounted": True,
                "coupon_code": pending.get("first_payment_coupon", {}).get("code")
            }
        }
        
        razorpay_subscription = razorpay_client.subscription.create(subscription_data)
        logger.info(f"Created subscription for future renewals: {razorpay_subscription['id']}")
        
    except Exception as e:
        logger.error(f"Failed to create renewal subscription: {e}")
        # Continue anyway - at least give them the first period
        razorpay_subscription = {"id": None}
    
    # Build subscription data
    subscription_data = {
        "razorpay_subscription_id": razorpay_subscription.get("id"),
        "razorpay_plan_id": pending.get("razorpay_plan_id"),
        "status": "active",
        "plan_key": plan_key,
        "billing_cycle": billing_cycle,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
        "locked_price": pending.get("locked_price"),
        "first_payment_discounted": True,
        "first_payment_coupon": pending.get("first_payment_coupon"),
        "first_payment_amount": pending.get("first_payment_amount"),
        "auto_renew": razorpay_subscription.get("id") is not None,
        "activated_at": now.isoformat()
    }
    
    # Update user with active subscription
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "subscription": subscription_data,
                "plan": plan_key,
                "plan_name": plan.get("name"),
                "plan_category": "subscription",
                "plan_start_date": now.isoformat(),
                "plan_end_date": period_end.isoformat(),
                "subscription_end_date": period_end.isoformat(),
                "is_subscribed": True,
                "plan_features": plan.get("features", {}),
                "features": plan.get("features", {}),
                "updated_at": now.isoformat()
            },
            "$unset": {"pending_subscription": ""}
        }
    )
    
    # Subscription activated via discounted first payment — remove from Abandoned Cart sheet
    try:
        from services.google_sheets_service import remove_abandoned_cart_from_sheet
        if user.get("email"):
            await remove_abandoned_cart_from_sheet(user.get("email"), "Subscription")
    except Exception as cart_error:
        logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
    
    # Record the discounted payment
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": data.razorpay_order_id or f"order_disc_{uuid.uuid4().hex[:16]}",  # Use razorpay order or generate unique
        "user_id": user_id,
        "user_email": user.get("email"),
        "razorpay_order_id": data.razorpay_order_id,
        "razorpay_payment_id": data.razorpay_payment_id,
        "type": "subscription",
        "payment_type": "first_payment_discounted",
        "plan_key": plan_key,
        "amount": pending.get("first_payment_amount"),
        "original_amount": pending.get("locked_price"),
        "coupon_discount": pending.get("first_payment_coupon", {}).get("discount_amount"),
        "coupon_code": pending.get("first_payment_coupon", {}).get("code"),
        "currency": "INR",
        "status": "captured",
        "created_at": now.isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Finalize coupon usage
    coupon_details = pending.get("first_payment_coupon")
    if coupon_details:
        await db.discount_usage.insert_one({
            "id": str(uuid.uuid4()),
            "discount_id": coupon_details.get("discount_id"),
            "user_id": user_id,
            "order_type": "subscription",
            "original_amount": pending.get("locked_price"),
            "discount_applied": coupon_details.get("discount_amount"),
            "final_amount": pending.get("first_payment_amount"),
            "used_at": now
        })
        
        # Increment usage count
        await db.discounts.update_one(
            {"id": coupon_details.get("discount_id")},
            {"$inc": {"current_usage": 1}}
        )
    
    logger.info(f"✅ Activated discounted subscription for {user.get('email')}: {plan_key}")
    
    # Update Google Sheet with upgrade info
    try:
        import asyncio as _asyncio
        _asyncio.create_task(update_user_upgrade_in_sheet(user.get('email', ''), plan_key, billing_cycle, user))
    except Exception as e:
        logger.error(f"Failed to trigger Google Sheet upgrade update: {e}")
    
    # Track Purchase event with Meta Conversion API
    try:
        client_ip = request.client.host if request.client else None
        client_user_agent = request.headers.get('user-agent')
        meta_cookies = meta_pixel_service.extract_meta_cookies(request)
        # Get first payment amount from pending subscription data
        payment_amount = pending.get("first_payment_amount", 0)
        await meta_pixel_service.track_purchase(
            user_email=user.get("email"),
            value=payment_amount / 100 if payment_amount else 0,  # Convert paise to rupees
            currency="INR",
            content_name=plan.get("name"),
            content_ids=[plan_key],
            content_type="subscription",
            user_name=user.get("name"),
            user_id=user.get("id"),
            client_ip=client_ip,
            client_user_agent=client_user_agent,
            fbp=meta_cookies.get('fbp'),
            fbc=meta_cookies.get('fbc'),
        )
    except Exception as track_error:
        logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
    
    # Track with Mixpanel
    try:
        old_plan = user.get("plan", "free_trial")
        mixpanel_service.track_subscription_upgraded(
            user_id=user.get("id"),
            old_plan=old_plan,
            new_plan=plan_key,
            billing_cycle=billing_cycle,
            amount=pending.get("first_payment_amount", 0) / 100 if pending.get("first_payment_amount") else 0,
            coupon_code=pending.get("coupon_code"),
            upgrade_source="coupon_activation"
        )
    except Exception as track_error:
        logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
    
    return {
        "success": True,
        "message": f"Subscription activated: {plan.get('name')}",
        "plan": plan_key,
        "plan_name": plan.get("name"),
        "period_start": now.isoformat(),
        "period_end": period_end.isoformat(),
        "first_payment_discounted": True,
        "auto_renew": razorpay_subscription.get("id") is not None
    }


@router.post("/activate")
async def activate_subscription(request: Request):
    """
    Called after successful payment to activate subscription.
    This is a backup - webhook should handle this automatically.
    """
    logger.info("=== ACTIVATE SUBSCRIPTION ENDPOINT CALLED ===")
    
    db = get_db(request)
    user = await get_current_user(request)
    
    if not user:
        logger.error("Activation failed: Not authenticated")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    logger.info(f"User: {user.get('email')}, current plan: {user.get('plan')}")
    
    pending = user.get("pending_subscription")
    existing_sub = user.get("subscription", {})
    
    logger.info(f"Pending subscription: {pending}")
    logger.info(f"Existing subscription: {existing_sub}")
    
    # If no pending subscription, check if we can activate from existing subscription data
    if not pending:
        logger.warning("No pending_subscription found - webhook may have already processed!")
        
        # Check if user was already upgraded by webhook
        if user.get("plan") and user.get("plan") != "free_trial":
            logger.info(f"User already has plan: {user.get('plan')} - returning success")
            return {
                "success": True,
                "message": "Subscription already activated",
                "plan": user.get("plan"),
                "already_activated": True
            }
        
        # Check if there's a subscription with authenticated status that needs activation
        if existing_sub.get("status") in ["authenticated", "created"] and existing_sub.get("plan_key"):
            # Use existing subscription data as pending
            pending = existing_sub
            logger.info(f"Using existing authenticated subscription for activation: {existing_sub.get('razorpay_subscription_id')}")
        elif existing_sub.get("razorpay_subscription_id"):
            # We have a subscription ID but no plan_key - try to get from Razorpay
            pending = existing_sub
            logger.info(f"Will try to get plan_key from Razorpay notes for: {existing_sub.get('razorpay_subscription_id')}")
        else:
            raise HTTPException(status_code=400, detail="No pending subscription found")
    
    client = get_razorpay_client()
    
    # Fetch subscription status from Razorpay
    try:
        razorpay_sub = client.subscription.fetch(pending.get("razorpay_subscription_id"))
        
        if razorpay_sub["status"] not in ["active", "authenticated"]:
            logger.warning(f"Razorpay subscription status is {razorpay_sub['status']}, not active/authenticated")
            return {
                "success": False,
                "message": "Subscription not yet active. Please complete payment.",
                "status": razorpay_sub["status"]
            }
        
        logger.info(f"Razorpay subscription status: {razorpay_sub['status']}")
        
        # Get plan_key from Razorpay notes if not in pending
        plan_key = pending.get("plan_key")
        billing_cycle = pending.get("billing_cycle", "monthly")
        
        if not plan_key:
            notes = razorpay_sub.get("notes", {})
            plan_key = notes.get("plan_key")
            billing_cycle = notes.get("billing_cycle", "monthly")
            logger.info(f"Got plan_key from Razorpay notes: {plan_key}")
        
        if not plan_key:
            raise HTTPException(status_code=400, detail="Could not determine plan. Please contact support.")
        
        logger.info(f"Activating subscription for user {user.get('id')}, plan_key: {plan_key}")
        
        # Activate the subscription
        now = datetime.now(timezone.utc)
        period_end = calculate_period_end(billing_cycle, now)
        
        # Build subscription data, ensuring plan_key is set
        subscription_data = {
            **pending,
            "plan_key": plan_key,
            "billing_cycle": billing_cycle,
            "status": razorpay_sub["status"],
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "activated_at": now.isoformat()
        }
        
        # Get plan details
        plan = await db.plans.find_one({"plan_key": plan_key})
        
        # Update user
        await db.users.update_one(
            {"id": user.get("id")},
            {
                "$set": {
                    "subscription": subscription_data,
                    "plan": plan_key,
                    "plan_name": plan.get("name") if plan else plan_key,
                    "plan_category": "subscription",
                    "plan_start_date": now.isoformat(),
                    "plan_end_date": period_end.isoformat(),
                    "subscription_end_date": period_end.isoformat(),
                    "is_subscribed": True,
                    "plan_features": plan.get("features", {}) if plan else {},
                    "features": plan.get("features", {}) if plan else {},  # Also set features for access control
                    "updated_at": now.isoformat()
                },
                "$unset": {"pending_subscription": ""}
            }
        )
        
        logger.info(f"✅ Activated subscription for {user.get('email')}: plan={plan_key}, period_end={period_end.isoformat()}")
        
        # Subscription activated — remove from Abandoned Cart sheet
        try:
            from services.google_sheets_service import remove_abandoned_cart_from_sheet
            if user.get("email"):
                await remove_abandoned_cart_from_sheet(user.get("email"), "Subscription")
        except Exception as cart_error:
            logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
        
        # Update Google Sheet with upgrade info
        try:
            import asyncio as _asyncio
            _asyncio.create_task(update_user_upgrade_in_sheet(user.get('email', ''), plan_key, billing_cycle, user))
        except Exception as e:
            logger.error(f"Failed to trigger Google Sheet upgrade update: {e}")
        
        # Record the payment to payments collection for sales tracking
        try:
            plan_data = await db.plans.find_one({"plan_key": plan_key})
            pricing = plan_data.get("pricing", {}) if plan_data else {}
            
            if billing_cycle == "monthly":
                original_base = pricing.get("one_month", 0)
            else:
                per_month = pricing.get("six_month") or pricing.get("6_month") or pricing.get("one_month", 0)
                original_base = per_month * 6
            
            # Check if coupon was applied (from pending subscription)
            coupon_info = pending.get("first_payment_coupon", {})
            stored_discount_type = coupon_info.get("discount_type")
            stored_discount_value = coupon_info.get("discount_value", 0)
            stored_coupon_code = coupon_info.get("code", "")
            coupon_discount_on_base = coupon_info.get("discount_amount", 0)
            
            # Option A: discount on base first, then GST on discounted base
            if coupon_discount_on_base and stored_discount_value:
                discounted_base = original_base - coupon_discount_on_base
            else:
                discounted_base = original_base
                coupon_discount_on_base = 0
            
            gst_amount = round(discounted_base * 0.18, 2)
            total_amount = round(discounted_base + gst_amount, 2)
            
            payment_record = {
                "id": f"sub-pay-{uuid.uuid4().hex[:12]}",
                "order_id": f"order_pending_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
                "user_id": user.get("id"),
                "user_email": user.get("email"),
                "user_name": user.get("name"),
                "razorpay_subscription_id": pending.get("razorpay_subscription_id"),
                "razorpay_payment_id": razorpay_sub.get("payment_id"),
                "type": "subscription",
                "payment_type": "first_payment",
                "plan_key": plan_key,
                "plan_name": plan.get("name") if plan else plan_key,
                "billing_cycle": billing_cycle,
                "amount": total_amount,  # What user actually paid
                "original_base_amount": original_base,  # Full base before discount
                "base_amount": discounted_base,  # Base after discount (before GST)
                "discount_amount": coupon_discount_on_base,
                "discount_type": stored_discount_type,
                "discount_value": stored_discount_value,
                "coupon_code": stored_coupon_code,
                "gst_amount": gst_amount,
                "currency": "INR",
                "status": "captured",
                "created_at": now.isoformat(),
                "captured_at": now.isoformat()
            }
            
            await db.payments.insert_one(payment_record)
            logger.info(f"✅ Recorded subscription payment for sales tracking: ₹{total_amount} (base: ₹{original_base}, discount: ₹{coupon_discount_on_base}, GST: ₹{gst_amount})")
        except Exception as e:
            logger.error(f"Failed to record payment for sales tracking: {e}")
        
        # Track Purchase event with Meta Conversion API
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            # Get plan price for tracking
            plan_data = await db.plans.find_one({"plan_key": plan_key})
            price = 0
            if plan_data and plan_data.get("pricing"):
                pricing = plan_data.get("pricing", {})
                if billing_cycle == "monthly":
                    price = pricing.get("one_month", 0)
                else:
                    price = (pricing.get("six_month", 0) or pricing.get("one_month", 0)) * 6
            
            await meta_pixel_service.track_purchase(
                user_email=user.get("email"),
                value=price,
                currency="INR",
                content_name=plan_data.get("name") if plan_data else plan_key,
                content_ids=[plan_key],
                content_type="subscription",
                user_name=user.get("name"),
                user_id=user.get("id"),
                client_ip=client_ip,
                client_user_agent=client_user_agent,
                fbp=meta_cookies.get('fbp'),
                fbc=meta_cookies.get('fbc'),
            )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        # Track with Mixpanel
        try:
            old_plan = user.get("plan", "free_trial")
            plan_data = await db.plans.find_one({"plan_key": plan_key})
            price = 0
            if plan_data and plan_data.get("pricing"):
                pricing = plan_data.get("pricing", {})
                if billing_cycle == "monthly":
                    price = pricing.get("one_month", 0)
                else:
                    price = (pricing.get("six_month", 0) or pricing.get("one_month", 0)) * 6
            
            mixpanel_service.track_subscription_upgraded(
                user_id=user.get("id"),
                old_plan=old_plan,
                new_plan=plan_key,
                billing_cycle=billing_cycle,
                amount=price,
                coupon_code=pending.get("first_payment_coupon", {}).get("code"),
                upgrade_source="razorpay"
            )
        except Exception as track_error:
            logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
        
        return {
            "success": True,
            "message": "Subscription activated successfully",
            "plan": plan_key,
            "billing_cycle": billing_cycle,
            "period_end": period_end.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to activate subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to activate subscription: {str(e)}")


@router.post("/cancel")
async def cancel_subscription(data: CancelSubscriptionRequest, request: Request):
    """
    Cancel subscription at cycle end.
    User keeps access until current period ends, then subscription stops.
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    if not subscription.get("razorpay_subscription_id"):
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    if subscription.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Subscription is already cancelled")
    
    razorpay_sub_id = subscription["razorpay_subscription_id"]
    
    try:
        # First, try to get actual status from Razorpay
        try:
            razorpay_sub = client.subscription.fetch(razorpay_sub_id)
            actual_status = razorpay_sub.get("status", "").lower()
            logger.info(f"Razorpay subscription {razorpay_sub_id} actual status: {actual_status}")
        except Exception as e:
            logger.warning(f"Could not fetch Razorpay subscription status: {e}")
            actual_status = subscription.get("status", "").lower()
        
        # For subscriptions that haven't started billing yet (created/authenticated/pending),
        # we need to cancel immediately (can't use cancel_at_cycle_end)
        if actual_status in ["created", "authenticated", "pending"]:
            logger.info(f"Subscription {razorpay_sub_id} is in '{actual_status}' state - cancelling immediately")
            client.subscription.cancel(razorpay_sub_id)
        else:
            # For active subscriptions, try cancel at cycle end first
            try:
                client.subscription.cancel(razorpay_sub_id, {"cancel_at_cycle_end": 1})
            except Exception as e:
                error_msg = str(e).lower()
                # If Razorpay says no billing cycle, cancel immediately instead
                if "no billing cycle" in error_msg or "cannot be cancelled" in error_msg:
                    logger.info(f"cancel_at_cycle_end failed, trying immediate cancel: {e}")
                    client.subscription.cancel(razorpay_sub_id)
                else:
                    raise
        
        now = datetime.now(timezone.utc)
        
        # Update subscription status
        await db.users.update_one(
            {"id": user.get("id")},
            {
                "$set": {
                    "subscription.status": "cancelled",
                    "subscription.auto_renew": False,
                    "subscription.cancellation_date": now.isoformat(),
                    "subscription.cancelled_at": now.isoformat(),  # For analytics tracking
                    "subscription.cancellation_reason": data.reason,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Subscription cancelled. You'll have access until your current period ends.",
            "access_until": subscription.get("current_period_end") or user.get("plan_end_date")
        }
        
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")


@router.post("/reactivate")
async def reactivate_subscription(request: Request):
    """
    Reactivate a cancelled subscription.
    
    If still within paid period: Simply resumes without payment (removes cancellation)
    If period has ended: Creates new subscription with payment required
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    if subscription.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail="Subscription is not in cancelled state")
    
    razorpay_sub_id = subscription.get("razorpay_subscription_id")
    if not razorpay_sub_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    
    # Check if still within paid period
    current_period_end = subscription.get("current_period_end")
    now = datetime.now(timezone.utc)
    is_within_period = False
    
    if current_period_end:
        try:
            end_date = datetime.fromisoformat(current_period_end.replace("Z", "+00:00"))
            is_within_period = now < end_date
            logger.info(f"Reactivation check: now={now}, period_end={end_date}, within_period={is_within_period}")
        except Exception as e:
            logger.warning(f"Could not parse period end date: {e}")
    
    # OPTION A: If within paid period, just resume without payment
    if is_within_period:
        try:
            # Check Razorpay subscription status
            razorpay_sub = client.subscription.fetch(razorpay_sub_id)
            razorpay_status = razorpay_sub.get("status")
            logger.info(f"Razorpay subscription {razorpay_sub_id} status: {razorpay_status}")
            
            # If Razorpay subscription is still active (just pending cancellation), we can resume
            if razorpay_status == "active":
                # Remove the scheduled cancellation
                try:
                    client.subscription.update(razorpay_sub_id, {"cancel_at_cycle_end": 0})
                    logger.info(f"Successfully removed cancellation for subscription {razorpay_sub_id}")
                except Exception as e:
                    logger.warning(f"Could not update subscription, trying resume: {e}")
                    # Try resume as fallback
                    try:
                        client.subscription.resume(razorpay_sub_id)
                        logger.info(f"Resumed subscription via resume() method")
                    except Exception as e2:
                        logger.error(f"Resume also failed: {e2}")
                        raise HTTPException(
                            status_code=400,
                            detail="Could not resume subscription in payment system. Please try again or contact support."
                        )
                
                # Update our database - subscription is active again
                await db.users.update_one(
                    {"id": user.get("id")},
                    {
                        "$set": {
                            "subscription.status": "active",
                            "subscription.auto_renew": True,
                            "subscription.reactivated_at": now.isoformat(),
                            "updated_at": now.isoformat()
                        },
                        "$unset": {
                            "subscription.cancellation_date": "",
                            "subscription.cancelled_at": "",
                            "subscription.cancellation_reason": ""
                        }
                    }
                )
                
                return {
                    "success": True,
                    "requires_payment": False,
                    "message": "Subscription reactivated successfully! Your subscription will continue as normal.",
                    "access_until": current_period_end
                }
            
            # If Razorpay status is cancelled/completed, we need new subscription
            logger.info(f"Razorpay subscription status is {razorpay_status}, needs new subscription")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check/resume Razorpay subscription: {e}")
            # Fall through to create new subscription
    
    # OPTION B: Period ended or Razorpay subscription fully cancelled - need new subscription with payment
    logger.info(f"Creating new subscription for reactivation (period ended or Razorpay cancelled)")
    
    # Get current plan details
    plan_key = subscription.get("plan_key")
    billing_cycle = subscription.get("billing_cycle", "monthly")
    
    if not plan_key:
        raise HTTPException(status_code=400, detail="No plan information found")
    
    # Get plan from database
    plan = await db.plans.find_one({"plan_key": plan_key, "category": "subscription"})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get pricing for the billing cycle
    pricing = plan.get("pricing", {})
    if billing_cycle == "monthly":
        amount = pricing.get("one_month") or pricing.get("monthly") or plan.get("price", 0)
    else:
        # six_month is per-month rate, multiply by 6 for total
        per_month = pricing.get("six_month") or pricing.get("6_month") or pricing.get("one_month") or plan.get("price", 0)
        amount = per_month * 6
    
    if not amount or amount <= 0:
        # Fallback to stored locked price
        amount = subscription.get("locked_price") or subscription.get("base_price")
        if not amount:
            raise HTTPException(status_code=400, detail="Plan pricing not found. Please contact support.")
    
    # Add GST (18%)
    gst_amount = round(amount * 0.18)
    total_amount_with_gst = amount + gst_amount
    
    # Get or create Razorpay plan for this price point (with GST)
    razorpay_plan_id = await get_or_create_razorpay_plan(
        db, 
        plan_key, 
        billing_cycle, 
        total_amount_with_gst,
        plan.get("name", plan_key)
    )
    
    # Calculate total_count based on billing cycle to stay within Razorpay's UPI limit (30 years)
    reactivation_total_count = 200 if billing_cycle == "monthly" else 60
    
    # Create NEW Razorpay subscription (starts immediately since period ended)
    try:
        subscription_data = {
            "plan_id": razorpay_plan_id,
            "total_count": reactivation_total_count,
            "customer_notify": 1,
            "notes": {
                "user_id": user.get("id"),
                "user_email": user.get("email"),
                "plan_key": plan_key,
                "billing_cycle": billing_cycle,
                "base_amount": amount,
                "gst_amount": gst_amount,
                "total_amount": total_amount_with_gst,
                "reactivation": "true",
                "previous_subscription": razorpay_sub_id
            }
        }
        
        razorpay_subscription = client.subscription.create(subscription_data)
        
        logger.info(f"Created reactivation subscription {razorpay_subscription['id']} for user {user.get('id')}")
        
        # Store as pending reactivation
        reactivation_info = {
            "razorpay_subscription_id": razorpay_subscription["id"],
            "razorpay_plan_id": razorpay_plan_id,
            "status": "created",
            "plan_key": plan_key,
            "billing_cycle": billing_cycle,
            "locked_price": total_amount_with_gst,
            "base_price": amount,
            "gst_amount": gst_amount,
            "auto_renew": True,
            "is_reactivation": True,
            "previous_subscription_id": razorpay_sub_id,
            "created_at": now.isoformat()
        }
        
        # Store as pending subscription (will be activated by webhook after payment)
        await db.users.update_one(
            {"id": user.get("id")},
            {"$set": {"pending_subscription": reactivation_info}}
        )
        
        return {
            "success": True,
            "requires_payment": True,
            "subscription_id": razorpay_subscription["id"],
            "razorpay_key": RAZORPAY_KEY_ID,
            "amount": total_amount_with_gst,
            "base_amount": amount,
            "gst_amount": gst_amount,
            "currency": "INR",
            "plan_name": plan.get("name"),
            "billing_cycle": billing_cycle,
            "short_url": razorpay_subscription.get("short_url"),
            "message": "Your previous billing period has ended. Payment required for new subscription."
        }
        
    except Exception as e:
        logger.error(f"Failed to create reactivation subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create subscription: {str(e)}")


@router.post("/change-plan")
async def change_plan(data: ChangePlanRequest, request: Request):
    """
    Change subscription plan (upgrade or downgrade).
    
    Upgrades: Immediate, user pays prorated difference
    Downgrades: Scheduled for period end, no immediate charge
    
    Handles both:
    - Razorpay subscription users
    - Manually upgraded users (by admin)
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    is_manual_upgrade = False
    
    # Check for active subscription OR manual upgrade with plan dates
    if not subscription.get("razorpay_subscription_id"):
        # Check if this is a manually upgraded user with plan data
        if user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"] and user.get("plan_start_date"):
            is_manual_upgrade = True
            # Create virtual subscription from plan fields for processing
            subscription = {
                "status": "active",
                "plan_key": user.get("plan"),
                "billing_cycle": "monthly",  # Default assumption for manual upgrades
                "locked_price": get_plan_price(user.get("plan"), "monthly"),
                "current_period_start": user.get("plan_start_date"),
                "current_period_end": user.get("plan_end_date") or user.get("subscription_end_date"),
                "razorpay_subscription_id": None,  # Mark as no Razorpay sub
                "is_manual_upgrade": True
            }
            logger.info(f"Processing change-plan for manually upgraded user: {user.get('id')}")
        else:
            raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Log current subscription status for debugging
    logger.info(f"Subscription status check: user={user.get('id')}, status={subscription.get('status')}, plan_key={subscription.get('plan_key')}")
    
    # Allow various active-like statuses
    allowed_statuses = ["active", "authenticated", "cancelled", "created", "pending", "halted"]
    sub_status = subscription.get("status", "").lower() if subscription.get("status") else ""
    
    # If no status but has valid subscription data, treat as active
    if not sub_status and subscription.get("razorpay_subscription_id"):
        logger.info(f"No status but has razorpay_subscription_id, treating as active")
        sub_status = "active"
    
    if sub_status not in allowed_statuses:
        logger.warning(f"Subscription status '{sub_status}' not in allowed list for user {user.get('id')}")
        raise HTTPException(status_code=400, detail=f"Subscription is not active (status: {sub_status})")
    
    # If subscription is cancelled but still within period, allow upgrade
    if subscription.get("status") == "cancelled":
        period_end = subscription.get("current_period_end")
        if period_end:
            try:
                end_date = datetime.fromisoformat(period_end.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) >= end_date:
                    raise HTTPException(status_code=400, detail="Subscription has expired. Please create a new subscription.")
            except Exception as e:
                logger.warning(f"Could not parse period end date: {e}")
    
    current_plan_key = subscription.get("plan_key") or user.get("plan")
    current_cycle = subscription.get("billing_cycle") or "monthly"
    
    # Debug logging for upgrade decision
    logger.info(f"Change plan request: user={user.get('id')}, "
                f"subscription.plan_key={subscription.get('plan_key')}, "
                f"user.plan={user.get('plan')}, "
                f"current_plan_key={current_plan_key}, "
                f"current_cycle={current_cycle}, "
                f"new_plan_key={data.new_plan_key}, "
                f"new_billing_cycle={data.new_billing_cycle}")
    
    # Check if same plan
    if current_plan_key == data.new_plan_key and current_cycle == data.new_billing_cycle:
        raise HTTPException(status_code=400, detail="You're already on this plan")
    
    # Check if 6-month to monthly (not allowed)
    if current_cycle == "6_month" and data.new_billing_cycle == "monthly":
        if current_plan_key == data.new_plan_key:
            # Same tier, shorter cycle - schedule for period end
            return await schedule_plan_change(db, user, data, subscription)
    
    # Get new plan details
    new_plan = await db.plans.find_one({"plan_key": data.new_plan_key, "category": "subscription"})
    if not new_plan:
        raise HTTPException(status_code=404, detail="New plan not found")
    
    # Get new plan pricing
    # Note: six_month in pricing is the discounted per-month rate, not total
    new_pricing = new_plan.get("pricing", {})
    if data.new_billing_cycle == "monthly":
        new_amount = new_pricing.get("one_month") or new_pricing.get("monthly") or new_plan.get("price", 0)
    else:
        per_month = new_pricing.get("six_month") or new_pricing.get("6_month") or new_pricing.get("one_month") or new_plan.get("price", 0)
        new_amount = per_month * 6
    
    if not new_amount or new_amount <= 0:
        raise HTTPException(status_code=400, detail="New plan pricing not configured")
    
    # Determine if upgrade or downgrade
    is_plan_upgrade = is_upgrade(current_plan_key, current_cycle, data.new_plan_key, data.new_billing_cycle)
    
    logger.info(f"is_plan_upgrade result: {is_plan_upgrade}")
    
    if is_plan_upgrade:
        # Immediate upgrade with proration
        try:
            return await process_immediate_upgrade(db, user, data, subscription, new_plan, new_amount, client)
        except Exception as e:
            logger.error(f"process_immediate_upgrade failed: {e}, falling back to schedule")
            # DON'T fall back to schedule - raise the error
            raise
    else:
        # Schedule downgrade for period end
        return await schedule_plan_change(db, user, data, subscription)


async def process_immediate_upgrade(db, user, data, subscription, new_plan, new_amount, client):
    """
    Process an immediate plan upgrade with anniversary-based proration.
    
    Handles both:
    - Razorpay subscription users (cancel old sub, create new one)
    - Manually upgraded users (just create new subscription)
    
    Anniversary Billing Logic:
    1. User keeps their original billing anniversary date
    2. A prorated charge is calculated for the remaining days until anniversary
    3. User pays the prorated amount via one-time order
    4. New subscription is scheduled to start on the anniversary date
    
    Example: User on Basic Monthly (₹499) started Jan 4th, upgrades to Pro (₹699) on Jan 15th
    - Anniversary date: Feb 4th (20 days away)
    - Credit from Basic: (20/30) * 499 = ₹332.67
    - Pro cost for 20 days: (20/30) * 699 = ₹466
    - Prorated charge: ₹466 - ₹332.67 = ₹133.33
    - User pays ₹133.33 now
    - New Pro subscription starts Feb 4th at ₹699/month
    """
    
    is_manual_upgrade = subscription.get("is_manual_upgrade", False)
    current_price = subscription.get("locked_price", 0)
    
    # Handle date parsing - ensure we have valid dates
    period_start_str = subscription.get("current_period_start")
    period_end_str = subscription.get("current_period_end")
    
    if not period_start_str or not period_end_str:
        raise HTTPException(status_code=400, detail="Subscription period dates not found")
    
    try:
        period_start = datetime.fromisoformat(period_start_str.replace("Z", "+00:00"))
        if period_start.tzinfo is None:
            period_start = period_start.replace(tzinfo=timezone.utc)
        
        period_end = datetime.fromisoformat(period_end_str.replace("Z", "+00:00"))
        if period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid subscription dates: {str(e)}")
    
    now = datetime.now(timezone.utc)
    current_billing_cycle = subscription.get("billing_cycle", "monthly")
    
    # Calculate anniversary-based proration
    # Manual upgrades get ZERO credit (assumed goodwill/free upgrade)
    proration = calculate_anniversary_proration(
        current_price=current_price,
        new_price=new_amount,
        period_start=period_start,
        period_end=period_end,
        current_billing_cycle=current_billing_cycle,
        new_billing_cycle=data.new_billing_cycle,
        is_manual_upgrade=is_manual_upgrade
    )
    
    # NOTE: Old subscription will NOT be cancelled here - we wait for payment confirmation
    # Cancellation happens in confirm-proration-payment endpoint after user successfully pays
    # This prevents issues if user abandons the payment - their old subscription continues normally
    logger.info(f"Preparing upgrade for user {user.get('id')} - old subscription will be cancelled after payment")
    
    # Get or create new Razorpay plan for the new price point
    razorpay_plan_id = await get_or_create_razorpay_plan(
        db,
        data.new_plan_key,
        data.new_billing_cycle,
        new_amount,
        new_plan.get("name", data.new_plan_key)
    )
    
    # New plan end date (anniversary-aligned) for IMMEDIATE access
    new_plan_end_date = datetime.fromisoformat(proration["new_plan_end_date"].replace("Z", "+00:00"))
    
    try:
        # Create prorated one-time order for the difference
        prorated_amount = int(proration["prorated_charge"])
        
        # Add GST (18%)
        gst_amount = round(prorated_amount * 0.18)
        total_amount_with_gst = prorated_amount + gst_amount
        
        order_id = None
        
        if total_amount_with_gst > 0:
            # Create a one-time order for the prorated charge + GST
            order = client.order.create({
                "amount": total_amount_with_gst * 100,  # Razorpay uses paise
                "currency": "INR",
                "receipt": f"upgrade_{user.get('id')}_{now.strftime('%Y%m%d%H%M%S')}",
                "notes": {
                    "user_id": user.get("id"),
                    "user_email": user.get("email"),
                    "type": "upgrade_proration",
                    "old_plan": subscription.get("plan_key"),
                    "new_plan": data.new_plan_key,
                    "new_billing_cycle": data.new_billing_cycle,
                    "new_plan_end_date": new_plan_end_date.isoformat(),
                    "base_amount": prorated_amount,
                    "gst_amount": gst_amount,
                    "total_amount": total_amount_with_gst,
                    "immediate_upgrade": "true"
                }
            })
            order_id = order["id"]
            logger.info(f"Created prorated order {order_id} for ₹{prorated_amount} + GST ₹{gst_amount} = ₹{total_amount_with_gst}")
        
        # Create new subscription scheduled to start at new plan end date (for auto-renewal)
        # This subscription will handle future renewals after the immediate upgrade period
        start_at_timestamp = int(new_plan_end_date.timestamp())
        
        # Calculate total_count based on billing cycle to stay within Razorpay's UPI 30-year limit
        upgrade_total_count = 200 if data.new_billing_cycle == "monthly" else 60
        
        subscription_data = {
            "plan_id": razorpay_plan_id,
            "total_count": upgrade_total_count,
            "customer_notify": 1,
            "start_at": start_at_timestamp,  # Schedule for end of immediate upgrade period
            "notes": {
                "user_id": user.get("id"),
                "user_email": user.get("email"),
                "plan_key": data.new_plan_key,
                "billing_cycle": data.new_billing_cycle,
                "upgrade_from": subscription.get("plan_key"),
                "proration_order_id": order_id,
                "is_immediate_upgrade": "true"
            }
        }
        
        new_sub = client.subscription.create(subscription_data)
        
        # IMPORTANT: Old subscription is NOT cancelled here
        # Cancellation happens ONLY in confirm-proration-payment endpoint after successful payment
        # This ensures if user abandons payment, their old subscription continues normally
        # Old subscription will be cancelled in confirm-proration-payment endpoint
        # after user successfully pays
        
        # Store pending upgrade info - will be activated after proration payment
        pending_upgrade = {
            "razorpay_subscription_id": new_sub["id"],
            "razorpay_plan_id": razorpay_plan_id,
            "proration_order_id": order_id,
            "prorated_amount": prorated_amount,
            "gst_amount": gst_amount,
            "total_amount": total_amount_with_gst,
            "status": "pending_proration_payment" if total_amount_with_gst > 0 else "ready_to_activate",
            "plan_key": data.new_plan_key,
            "billing_cycle": data.new_billing_cycle,
            "locked_price": new_amount,
            "auto_renew": True,
            "new_plan_start_date": now.isoformat(),  # IMMEDIATE start
            "new_plan_end_date": new_plan_end_date.isoformat(),  # Anniversary-aligned end
            "old_subscription_id": subscription.get("razorpay_subscription_id"),  # Store for cancellation after payment
            "upgraded_from": {
                "plan_key": subscription.get("plan_key"),
                "billing_cycle": subscription.get("billing_cycle"),
                "price": current_price,
                "credit_applied": proration["unused_credit"]
            },
            "created_at": now.isoformat(),
            "immediate_upgrade": True
        }
        
        # If no payment required (prorated charge is 0 or negative), activate immediately
        if total_amount_with_gst <= 0:
            # Cancel old subscription immediately since no payment gateway involved
            old_subscription_id = subscription.get("razorpay_subscription_id")
            if old_subscription_id and not is_manual_upgrade:
                try:
                    client.subscription.cancel(old_subscription_id, {"cancel_at_cycle_end": 0})
                    logger.info(f"Cancelled old subscription {old_subscription_id} for zero-charge upgrade")
                except Exception as e:
                    logger.warning(f"Could not cancel old subscription {old_subscription_id}: {e}")
            
            # Activate immediately - update user's plan now
            await db.users.update_one(
                {"id": user.get("id")},
                {
                    "$set": {
                        "plan": data.new_plan_key,
                        "plan_name": new_plan.get("name"),
                        "plan_category": "subscription",
                        "plan_start_date": now.isoformat(),
                        "plan_end_date": new_plan_end_date.isoformat(),
                        "subscription_end_date": new_plan_end_date.isoformat(),
                        "is_subscribed": True,
                        "plan_features": new_plan.get("features", {}),
                        "subscription": {
                            "razorpay_subscription_id": new_sub["id"],
                            "razorpay_plan_id": razorpay_plan_id,
                            "status": "active",
                            "plan_key": data.new_plan_key,
                            "billing_cycle": data.new_billing_cycle,
                            "locked_price": new_amount,
                            "auto_renew": True,
                            "current_period_start": now.isoformat(),
                            "current_period_end": new_plan_end_date.isoformat(),
                            "activated_at": now.isoformat(),
                            "upgraded_from": subscription.get("plan_key")
                        },
                        "updated_at": now.isoformat()
                    },
                    "$unset": {
                        "pending_upgrade": ""
                    }
                }
            )
            
            return {
                "success": True,
                "type": "immediate_upgrade",
                "immediate": True,
                "requires_proration_payment": False,
                "message": f"Congratulations! You've been upgraded to {PLAN_NAMES.get(data.new_plan_key, data.new_plan_key)} immediately!",
                "new_plan": data.new_plan_key,
                "new_billing_cycle": data.new_billing_cycle,
                "new_plan_start_date": now.isoformat(),
                "new_plan_end_date": new_plan_end_date.isoformat()
            }
        
        # Payment required - store pending upgrade and return payment details
        await db.users.update_one(
            {"id": user.get("id")},
            {
                "$set": {
                    "pending_upgrade": pending_upgrade,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "type": "immediate_upgrade",
            "immediate": True,  # User gets immediate access after payment
            "requires_proration_payment": True,
            "proration_order_id": order_id,
            "subscription_id": new_sub["id"],
            "charge_amount": total_amount_with_gst,  # Total with GST
            "base_amount": prorated_amount,  # Pre-GST amount
            "gst_amount": gst_amount,  # GST amount
            "razorpay_key": RAZORPAY_KEY_ID,
            "proration": {
                "days_remaining_current": proration["days_remaining_current_period"],
                "days_until_new_end": proration["days_until_new_end"],
                "unused_credit": proration["unused_credit"],
                "new_cost_for_remaining": proration["new_cost_for_remaining"],
                "prorated_charge": proration["prorated_charge"],
                "new_full_price": proration["new_full_price"]
            },
            "new_plan": data.new_plan_key,
            "new_billing_cycle": data.new_billing_cycle,
            "new_plan_start_date": now.isoformat(),  # IMMEDIATE start after payment
            "new_plan_end_date": new_plan_end_date.isoformat(),  # Anniversary-aligned end
            "short_url": new_sub.get("short_url"),
            "message": f"Pay ₹{total_amount_with_gst} now to upgrade immediately to {PLAN_NAMES.get(data.new_plan_key, data.new_plan_key)}. Your subscription will be valid until {new_plan_end_date.strftime('%b %d, %Y')}."
        }
        
    except Exception as e:
        logger.error(f"Failed to create immediate upgrade: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upgrade: {str(e)}")


# Plan display names for messages
PLAN_NAMES = {
    'basic_plan': 'Basic Plan',
    'pro_plan': 'Pro Plan',
    'pro_plus': 'Pro+ Plan',
}


async def schedule_plan_change(db, user, data, subscription):
    """Schedule a plan change for the end of current period"""
    
    now = datetime.now(timezone.utc)
    period_end = subscription.get("current_period_end")
    
    # Get new plan pricing
    new_plan = await db.plans.find_one({"plan_key": data.new_plan_key, "category": "subscription"})
    if not new_plan:
        raise HTTPException(status_code=404, detail="New plan not found")
    
    # Note: six_month in pricing is the discounted per-month rate, not total
    new_pricing = new_plan.get("pricing", {})
    if data.new_billing_cycle == "monthly":
        new_amount = new_pricing.get("one_month") or new_pricing.get("monthly") or new_plan.get("price", 0)
    else:
        per_month = new_pricing.get("six_month") or new_pricing.get("6_month") or new_pricing.get("one_month") or new_plan.get("price", 0)
        new_amount = per_month * 6
    
    pending_change = {
        "type": "plan_change",
        "new_plan_key": data.new_plan_key,
        "new_billing_cycle": data.new_billing_cycle,
        "new_amount": new_amount,
        "effective_date": period_end,
        "scheduled_on": now.isoformat(),
        "scheduled_by": "user"
    }
    
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$set": {
                "subscription.pending_change": pending_change,
                "updated_at": now.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "type": "downgrade",
        "immediate": False,
        "scheduled": True,
        "effective_date": period_end,
        "new_plan": data.new_plan_key,
        "new_billing_cycle": data.new_billing_cycle,
        "new_amount": new_amount,
        "message": f"Your plan will change on {period_end}. You'll keep your current access until then."
    }


@router.post("/cancel-scheduled-change")
async def cancel_scheduled_change(request: Request):
    """Cancel a scheduled plan change"""
    db = get_db(request)
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    if not subscription.get("pending_change"):
        raise HTTPException(status_code=400, detail="No scheduled change found")
    
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$unset": {"subscription.pending_change": ""},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "message": "Scheduled change cancelled. Your current plan will continue."
    }


class UpgradePreviewRequest(BaseModel):
    new_plan_key: str
    new_billing_cycle: Literal["monthly", "6_month"]


@router.post("/upgrade-preview")
async def get_upgrade_preview(data: UpgradePreviewRequest, request: Request):
    """
    Preview upgrade details without committing.
    Returns proration calculation with anniversary billing preserved.
    Handles both Razorpay subscriptions and manually upgraded users.
    """
    db = get_db(request)
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    subscription = user.get("subscription", {})
    
    # Check for active subscription OR manual upgrade with plan dates
    is_manual_upgrade = False
    if not subscription.get("razorpay_subscription_id"):
        # Check if this is a manually upgraded user with plan data
        if user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"] and user.get("plan_start_date"):
            is_manual_upgrade = True
            # Create virtual subscription from plan fields
            subscription = {
                "status": "active",
                "plan_key": user.get("plan"),
                "billing_cycle": "monthly",
                "locked_price": get_plan_price(user.get("plan"), "monthly"),
                "current_period_start": user.get("plan_start_date"),
                "current_period_end": user.get("plan_end_date") or user.get("subscription_end_date"),
            }
        else:
            raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Log current subscription status for debugging
    logger.info(f"Upgrade preview status check: user={user.get('id')}, status={subscription.get('status')}, plan_key={subscription.get('plan_key')}")
    
    # Allow various active-like statuses
    allowed_statuses = ["active", "authenticated", "cancelled", "created", "pending", "halted"]
    sub_status = subscription.get("status", "").lower() if subscription.get("status") else ""
    
    # If no status but has valid subscription data, treat as active
    if not sub_status and subscription.get("razorpay_subscription_id"):
        logger.info(f"No status but has razorpay_subscription_id, treating as active")
        sub_status = "active"
    
    if sub_status not in allowed_statuses:
        logger.warning(f"Subscription status '{sub_status}' not in allowed list for user {user.get('id')}")
        raise HTTPException(status_code=400, detail=f"Subscription is not active (status: {sub_status})")
    
    # If subscription is cancelled but still within period, allow upgrade
    if subscription.get("status") == "cancelled":
        period_end = subscription.get("current_period_end")
        if period_end:
            try:
                end_date = datetime.fromisoformat(period_end.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) >= end_date:
                    raise HTTPException(status_code=400, detail="Subscription has expired. Please create a new subscription.")
            except Exception as e:
                logger.warning(f"Could not parse period end date: {e}")
    
    current_plan_key = subscription.get("plan_key") or user.get("plan")
    current_cycle = subscription.get("billing_cycle") or "monthly"
    current_price = subscription.get("locked_price") or get_plan_price(current_plan_key, current_cycle)
    
    # Check if same plan
    if current_plan_key == data.new_plan_key and current_cycle == data.new_billing_cycle:
        raise HTTPException(status_code=400, detail="You're already on this plan")
    
    # Get new plan details
    new_plan = await db.plans.find_one({"plan_key": data.new_plan_key, "category": "subscription"})
    if not new_plan:
        raise HTTPException(status_code=404, detail="New plan not found")
    
    # Get new plan pricing
    new_pricing = new_plan.get("pricing", {})
    if data.new_billing_cycle == "monthly":
        new_amount = new_pricing.get("one_month") or new_pricing.get("monthly") or new_plan.get("price", 0)
    else:
        per_month = new_pricing.get("six_month") or new_pricing.get("6_month") or new_pricing.get("one_month") or new_plan.get("price", 0)
        new_amount = per_month * 6
    
    # Parse dates - handle both subscription object and fallback fields
    period_start_str = subscription.get("current_period_start") or user.get("plan_start_date")
    period_end_str = subscription.get("current_period_end") or user.get("plan_end_date") or user.get("subscription_end_date")
    
    if not period_start_str or not period_end_str:
        raise HTTPException(status_code=400, detail="Subscription period dates not found")
    
    try:
        # Parse start date and ensure timezone awareness
        period_start = datetime.fromisoformat(period_start_str.replace("Z", "+00:00"))
        if period_start.tzinfo is None:
            period_start = period_start.replace(tzinfo=timezone.utc)
        
        # Parse end date and ensure timezone awareness
        period_end = datetime.fromisoformat(period_end_str.replace("Z", "+00:00"))
        if period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid subscription dates: {str(e)}")
    
    # Calculate proration with anniversary billing
    # Manual upgrades get ZERO credit (assumed goodwill)
    proration = calculate_anniversary_proration(
        current_price=current_price,
        new_price=new_amount,
        period_start=period_start,
        period_end=period_end,
        current_billing_cycle=current_cycle,
        new_billing_cycle=data.new_billing_cycle,
        is_manual_upgrade=is_manual_upgrade
    )
    
    # Add GST calculation (18%)
    prorated_charge_before_gst = proration["prorated_charge"]
    gst_amount = round(prorated_charge_before_gst * 0.18)
    prorated_charge_with_gst = prorated_charge_before_gst + gst_amount
    
    # Determine if upgrade or downgrade
    is_plan_upgrade = is_upgrade(current_plan_key, current_cycle, data.new_plan_key, data.new_billing_cycle)
    
    return {
        "success": True,
        "is_upgrade": is_plan_upgrade,
        "is_manual_upgrade": is_manual_upgrade,
        "current_plan": {
            "plan_key": current_plan_key,
            "billing_cycle": current_cycle,
            "price": current_price
        },
        "new_plan": {
            "plan_key": data.new_plan_key,
            "name": new_plan.get("name"),
            "billing_cycle": data.new_billing_cycle,
            "price": new_amount
        },
        "proration": {
            "days_used": proration["days_used"],
            "days_remaining_current_period": proration["days_remaining_current_period"],
            "days_until_new_anniversary": proration["days_until_new_anniversary"],
            "daily_rate_current": proration["daily_rate_current"],
            "daily_rate_new": proration["daily_rate_new"],
            "unused_credit": proration["unused_credit"],
            "new_cost_for_remaining": proration["new_cost_for_remaining"],
            "prorated_charge": prorated_charge_before_gst,  # Pre-GST amount
            "prorated_charge_gst": gst_amount,  # GST amount
            "prorated_charge_total": prorated_charge_with_gst,  # Total with GST
            "anniversary_date": proration["anniversary_date"],
            "new_period_start": proration["new_period_start"],
            "new_period_end": proration["new_period_end"],
            "new_full_price": proration["new_full_price"]
        },
        "message": f"Pay ₹{int(proration['prorated_charge'])} now. New plan active immediately, renews {proration['anniversary_date'][:10]}."
    }


@router.post("/confirm-proration-payment")
async def confirm_proration_payment(request: Request):
    """
    Called after user completes the prorated payment via Razorpay.
    Confirms the pending upgrade and IMMEDIATELY upgrades the user's plan.
    The scheduled subscription will handle future billing from the plan end date.
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    pending_upgrade = user.get("pending_upgrade")
    if not pending_upgrade:
        raise HTTPException(status_code=400, detail="No pending upgrade found")
    
    order_id = pending_upgrade.get("proration_order_id")
    
    # If there was a prorated charge, verify payment
    if order_id:
        try:
            order = client.order.fetch(order_id)
            if order.get("status") != "paid":
                return {
                    "success": False,
                    "message": "Proration payment not completed. Please complete payment to proceed.",
                    "order_status": order.get("status")
                }
        except Exception as e:
            logger.error(f"Failed to verify proration order: {e}")
            raise HTTPException(status_code=500, detail="Failed to verify payment")
    
    now = datetime.now(timezone.utc)
    
    # Get the new plan details for immediate access
    new_plan_key = pending_upgrade.get("plan_key")
    new_billing_cycle = pending_upgrade.get("billing_cycle")
    new_plan = await db.plans.find_one({"plan_key": new_plan_key, "category": "subscription"})
    
    # Get the new plan dates - use new_plan_end_date for immediate upgrades
    new_plan_start_date = pending_upgrade.get("new_plan_start_date", now.isoformat())
    new_plan_end_date = pending_upgrade.get("new_plan_end_date") or pending_upgrade.get("anniversary_date")
    
    # Cancel OLD subscription ONLY AFTER payment is confirmed
    old_subscription_id = pending_upgrade.get("old_subscription_id")
    if old_subscription_id:
        try:
            client.subscription.cancel(old_subscription_id, {"cancel_at_cycle_end": 0})
            logger.info(f"Cancelled old subscription {old_subscription_id} after upgrade payment confirmed")
        except Exception as e:
            logger.warning(f"Could not cancel old subscription {old_subscription_id}: {e}")
    
    # IMMEDIATELY upgrade the user's plan and access
    # The scheduled Razorpay subscription will handle billing from plan end date
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$set": {
                # Immediate plan upgrade - user gets new plan features NOW
                "plan": new_plan_key,
                "plan_name": new_plan.get("name") if new_plan else new_plan_key,
                "plan_category": "subscription",
                "plan_features": new_plan.get("features", {}) if new_plan else {},
                "is_subscribed": True,
                "plan_start_date": new_plan_start_date,
                "plan_end_date": new_plan_end_date,
                "subscription_end_date": new_plan_end_date,
                
                # Update subscription object with new plan info
                "subscription": {
                    "razorpay_subscription_id": pending_upgrade.get("razorpay_subscription_id"),
                    "razorpay_plan_id": pending_upgrade.get("razorpay_plan_id"),
                    "status": "active",
                    "plan_key": new_plan_key,
                    "billing_cycle": new_billing_cycle,
                    "locked_price": pending_upgrade.get("locked_price"),
                    "auto_renew": True,
                    "current_period_start": new_plan_start_date,
                    "current_period_end": new_plan_end_date,
                    "activated_at": now.isoformat(),
                    "upgraded_at": now.isoformat(),
                    "upgraded_from": pending_upgrade.get("upgraded_from")
                },
                
                "updated_at": now.isoformat()
            },
            "$unset": {
                "pending_upgrade": ""
            }
        }
    )
    
    # Record the payment for analytics
    try:
        payment_record = {
            "id": f"upgrade-pay-{uuid.uuid4().hex[:12]}",
            "order_id": order_id or f"order_upgrade_{uuid.uuid4().hex[:16]}",  # Use order_id or generate unique
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "user_name": user.get("name"),
            "razorpay_order_id": order_id,
            "type": "upgrade_proration",
            "payment_type": "immediate_upgrade",
            "plan_key": new_plan_key,
            "plan_name": new_plan.get("name") if new_plan else new_plan_key,
            "billing_cycle": new_billing_cycle,
            "amount": pending_upgrade.get("total_amount", 0),
            "base_amount": pending_upgrade.get("prorated_amount", 0),
            "gst_amount": pending_upgrade.get("gst_amount", 0),
            "currency": "INR",
            "status": "captured",
            "created_at": now.isoformat(),
            "captured_at": now.isoformat(),
            "upgraded_from": pending_upgrade.get("upgraded_from", {}).get("plan_key")
        }
        await db.payments.insert_one(payment_record)
        logger.info(f"Recorded upgrade payment for user {user.get('id')}")
    except Exception as e:
        logger.warning(f"Failed to record upgrade payment: {e}")
    
    logger.info(f"User {user.get('id')} immediately upgraded to {new_plan_key}. Plan valid until {new_plan_end_date}")
    
    return {
        "success": True,
        "message": f"Upgrade successful! You now have {new_plan.get('name') if new_plan else new_plan_key} access until {new_plan_end_date}.",
        "immediate_access": True,
        "new_plan": new_plan_key,
        "plan_name": new_plan.get("name") if new_plan else new_plan_key,
        "new_plan_start_date": new_plan_start_date,
        "new_plan_end_date": new_plan_end_date,
        "new_billing_cycle": new_billing_cycle
    }


@router.post("/cancel-pending-upgrade")
async def cancel_pending_upgrade(request: Request):
    """Cancel a pending anniversary upgrade before it takes effect."""
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    pending_upgrade = user.get("pending_upgrade")
    if not pending_upgrade:
        raise HTTPException(status_code=400, detail="No pending upgrade found")
    
    # Cancel the scheduled subscription in Razorpay
    scheduled_sub_id = pending_upgrade.get("razorpay_subscription_id")
    if scheduled_sub_id:
        try:
            client.subscription.cancel(scheduled_sub_id)
        except Exception as e:
            logger.warning(f"Error cancelling scheduled subscription: {e}")
    
    now = datetime.now(timezone.utc)
    
    # Remove pending upgrade and restore subscription to normal state
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$unset": {
                "pending_upgrade": "",
                "subscription.pending_change": ""
            },
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {
        "success": True,
        "message": "Pending upgrade cancelled. Your current plan remains active."
    }


@router.get("/plans")
async def get_subscription_plans(request: Request):
    """Get all available subscription plans with pricing"""
    db = get_db(request)
    
    plans = await db.plans.find(
        {"category": "subscription", "plan_key": {"$ne": "free_trial"}},
        {"_id": 0}
    ).to_list(100)
    
    result = []
    for plan in plans:
        pricing = plan.get("pricing", {})
        monthly = pricing.get("one_month") or pricing.get("monthly") or 0
        six_month_per_mo = pricing.get("six_month") or pricing.get("6_month") or monthly
        six_month_total = six_month_per_mo * 6 if six_month_per_mo else 0
        result.append({
            "plan_key": plan.get("plan_key"),
            "name": plan.get("name"),
            "description": plan.get("description", ""),
            "features": plan.get("features", {}),
            "display_features": plan.get("display_features", []),
            "pricing": {
                "monthly": monthly,
                "6_month_total": six_month_total,
                "6_month_per_month": six_month_per_mo,
                "monthly_savings": monthly - six_month_per_mo if monthly and six_month_per_mo else 0
            }
        })
    
    return {"plans": result}


# ============== Webhook Handler ==============

@router.post("/webhook")
async def handle_razorpay_webhook(request: Request):
    """
    Handle Razorpay subscription webhooks.
    
    Events handled:
    - subscription.authenticated: User authorized the subscription
    - subscription.activated: First payment successful
    - subscription.charged: Recurring payment successful
    - subscription.pending: Payment pending
    - subscription.halted: Payment failed after retries
    - subscription.cancelled: Subscription cancelled
    - subscription.completed: Subscription ended (all cycles completed)
    """
    db = get_db(request)
    
    # Get raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Verify webhook signature
    if RAZORPAY_WEBHOOK_SECRET:
        try:
            razorpay_client.utility.verify_webhook_signature(
                body.decode(),
                signature,
                RAZORPAY_WEBHOOK_SECRET
            )
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse webhook payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    event = payload.get("event")
    subscription_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    
    if not subscription_entity:
        return {"status": "ignored", "reason": "No subscription entity"}
    
    subscription_id = subscription_entity.get("id")
    notes = subscription_entity.get("notes", {})
    user_id = notes.get("user_id")
    
    logger.info(f"Received webhook: {event} for subscription {subscription_id}")
    
    # Log webhook event
    await db.webhook_logs.insert_one({
        "event": event,
        "subscription_id": subscription_id,
        "user_id": user_id,
        "payload": payload,
        "received_at": datetime.now(timezone.utc).isoformat()
    })
    
    if not user_id:
        logger.warning(f"No user_id in webhook for subscription {subscription_id}")
        return {"status": "ignored", "reason": "No user_id in notes"}
    
    # Handle different events
    now = datetime.now(timezone.utc)
    
    if event == "subscription.authenticated":
        # User authorized subscription, waiting for first payment
        # Copy pending subscription data to subscription object to preserve plan info
        user = await db.users.find_one({"id": user_id})
        pending = user.get("pending_subscription", {}) if user else {}
        
        # Get plan_key from pending or notes
        plan_key = pending.get("plan_key") or notes.get("plan_key")
        billing_cycle = pending.get("billing_cycle") or notes.get("billing_cycle", "monthly")
        
        logger.info(f"subscription.authenticated for user {user_id}, plan_key={plan_key}")
        
        update_data = {
            "subscription.status": "authenticated",
            "subscription.authenticated_at": now.isoformat()
        }
        
        # Copy key fields from pending subscription if available
        if pending.get("plan_key"):
            update_data["subscription.plan_key"] = pending["plan_key"]
        if pending.get("billing_cycle"):
            update_data["subscription.billing_cycle"] = pending["billing_cycle"]
        if pending.get("razorpay_subscription_id"):
            update_data["subscription.razorpay_subscription_id"] = pending["razorpay_subscription_id"]
        if pending.get("razorpay_plan_id"):
            update_data["subscription.razorpay_plan_id"] = pending["razorpay_plan_id"]
        if pending.get("locked_price"):
            update_data["subscription.locked_price"] = pending["locked_price"]
        if pending.get("base_price"):
            update_data["subscription.base_price"] = pending["base_price"]
        if pending.get("gst_amount"):
            update_data["subscription.gst_amount"] = pending["gst_amount"]
        if pending.get("created_at"):
            update_data["subscription.created_at"] = pending["created_at"]
        
        # Also try to get from notes if pending doesn't have it
        if not update_data.get("subscription.plan_key") and notes.get("plan_key"):
            update_data["subscription.plan_key"] = notes["plan_key"]
        if not update_data.get("subscription.billing_cycle") and notes.get("billing_cycle"):
            update_data["subscription.billing_cycle"] = notes["billing_cycle"]
        
        # IMPORTANT: Also set the top-level plan field so user gets access immediately
        if plan_key:
            # Get plan details for name and features
            plan = await db.plans.find_one({"plan_key": plan_key})
            
            # Calculate period end
            if billing_cycle == "monthly":
                period_end = now + relativedelta(months=1)
            else:
                period_end = now + relativedelta(months=6)
            
            update_data["plan"] = plan_key
            update_data["plan_name"] = plan.get("name") if plan else plan_key
            update_data["plan_category"] = "subscription"
            update_data["plan_start_date"] = now.isoformat()
            update_data["plan_end_date"] = period_end.isoformat()
            update_data["subscription_end_date"] = period_end.isoformat()
            update_data["is_subscribed"] = True
            
            if plan:
                update_data["plan_features"] = plan.get("features", {})
                update_data["features"] = plan.get("features", {})
            
            logger.info(f"Setting top-level plan={plan_key} for user {user_id}")
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        logger.info(f"Authenticated subscription for user {user_id}, plan_key: {plan_key}")
        
    elif event == "subscription.activated":
        # First payment successful - activate subscription
        await activate_subscription_from_webhook(db, user_id, subscription_entity, now)
        # Record the payment
        await record_subscription_payment(db, user_id, subscription_entity, now, "first_payment")
        
    elif event == "subscription.charged":
        # Recurring payment successful - extend period
        await extend_subscription_period(db, user_id, subscription_entity, now)
        # Record the payment
        await record_subscription_payment(db, user_id, subscription_entity, now, "recurring")
        
        # Track recurring Purchase event with Meta Conversion API
        try:
            user = await db.users.find_one({"id": user_id})
            if user:
                # Get payment amount from subscription
                amount = subscription_entity.get("current_start_amount", 0) / 100  # paise to rupees
                plan_key = subscription_entity.get("notes", {}).get("plan_key", "")
                plan_name = subscription_entity.get("notes", {}).get("plan_name", "")
                
                await meta_pixel_service.track_purchase(
                    user_email=user.get("email"),
                    value=amount,
                    currency="INR",
                    content_name=plan_name or plan_key,
                    content_ids=[plan_key] if plan_key else [],
                    content_type="subscription_renewal",
                    user_name=user.get("name"),
                    user_id=user_id,
                )
                logger.info(f"Tracked recurring purchase for {user.get('email')}: ₹{amount}")
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
    elif event == "subscription.pending":
        # Payment pending
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"subscription.status": "pending"}}
        )
        
    elif event == "subscription.halted":
        # Payment failed after retries
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription.status": "halted",
                    "subscription.auto_renew": False,
                    "subscription.halted_at": now.isoformat()
                }
            }
        )
        
    elif event == "subscription.cancelled":
        # Subscription cancelled - but ONLY update if this is the user's current subscription
        # This prevents an old cancelled subscription (from upgrade) from overwriting the new active subscription
        user = await db.users.find_one({"id": user_id})
        if user:
            current_subscription_id = user.get("subscription", {}).get("razorpay_subscription_id")
            
            # Only update status if the cancelled subscription matches the user's current subscription
            # OR if the user has no current subscription (edge case)
            if not current_subscription_id or current_subscription_id == subscription_id:
                logger.info(f"Updating subscription status to cancelled for user {user_id} (subscription {subscription_id})")
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "subscription.status": "cancelled",
                            "subscription.auto_renew": False,
                            "subscription.cancelled_at": now.isoformat()
                        }
                    }
                )
            else:
                # This is an old subscription being cancelled (e.g., after upgrade)
                # Don't update the user's current subscription status
                logger.info(f"Ignoring subscription.cancelled webhook for old subscription {subscription_id} "
                           f"(user {user_id} has current subscription {current_subscription_id})")
        
    elif event == "subscription.completed":
        # All billing cycles completed or subscription ended
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription.status": "expired",
                    "subscription.auto_renew": False,
                    "subscription.completed_at": now.isoformat(),
                    "is_subscribed": False
                }
            }
        )
    
    return {"status": "processed", "event": event}


async def activate_subscription_from_webhook(db, user_id: str, subscription_entity: dict, now: datetime):
    """
    Activate subscription after first payment.
    Handles both new subscriptions and anniversary upgrades.
    """
    
    # ENHANCED DEBUG LOGGING
    logger.info(f"=== WEBHOOK ACTIVATION START ===")
    logger.info(f"User ID: {user_id}")
    logger.info(f"Subscription ID: {subscription_entity.get('id')}")
    
    notes = subscription_entity.get("notes", {})
    logger.info(f"Notes received: {notes}")
    
    plan_key = notes.get("plan_key")
    billing_cycle = notes.get("billing_cycle", "monthly")
    is_anniversary_upgrade = notes.get("is_anniversary_upgrade") == "true"
    
    logger.info(f"Extracted - plan_key: {plan_key}, billing_cycle: {billing_cycle}")
    
    # Get user data first - we need it for fallback plan_key lookup
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        logger.error(f"❌ CRITICAL: User {user_id} not found!")
        return
    
    # If plan_key not in notes, try to get from user's pending_subscription or subscription
    if not plan_key:
        logger.warning(f"⚠️ plan_key missing from notes, checking user's pending_subscription...")
        pending = user.get("pending_subscription", {})
        plan_key = pending.get("plan_key")
        billing_cycle = pending.get("billing_cycle", billing_cycle)
        logger.info(f"From pending_subscription: plan_key={plan_key}, billing_cycle={billing_cycle}")
        
    if not plan_key:
        logger.warning(f"⚠️ plan_key still missing, checking user's subscription...")
        subscription = user.get("subscription", {})
        plan_key = subscription.get("plan_key")
        billing_cycle = subscription.get("billing_cycle", billing_cycle)
        logger.info(f"From subscription: plan_key={plan_key}, billing_cycle={billing_cycle}")
    
    if not plan_key:
        logger.error(f"❌ CRITICAL: plan_key is missing from notes AND user data!")
        logger.error(f"Full notes: {notes}")
        logger.error(f"User pending_subscription: {user.get('pending_subscription')}")
        logger.error(f"User subscription: {user.get('subscription')}")
        return
    
    # Get plan details
    logger.info(f"Looking up plan with plan_key: {plan_key}")
    plan = await db.plans.find_one({"plan_key": plan_key})
    
    if not plan:
        logger.error(f"❌ CRITICAL: No plan found for plan_key: {plan_key}")
        logger.error(f"Queried: {{'plan_key': '{plan_key}'}}")
        return
    
    logger.info(f"✅ Plan found: {plan.get('name')} (id: {plan.get('id')})")
    
    if is_anniversary_upgrade:
        # This is an anniversary upgrade - scheduled subscription is now activating
        pending_upgrade = user.get("pending_upgrade", {})
        
        # Calculate period based on the new billing cycle from the anniversary date
        period_end = calculate_period_end(billing_cycle, now)
        
        subscription_data = {
            "razorpay_subscription_id": subscription_entity.get("id"),
            "razorpay_plan_id": subscription_entity.get("plan_id"),
            "status": "active",
            "plan_key": plan_key,
            "billing_cycle": billing_cycle,
            "locked_price": pending_upgrade.get("locked_price", 0),
            "auto_renew": True,
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "activated_at": now.isoformat(),
            "created_at": pending_upgrade.get("created_at", now.isoformat()),
            "upgraded_from": pending_upgrade.get("upgraded_from")
        }
        
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription": subscription_data,
                    "plan": plan_key,
                    "plan_name": plan.get("name") if plan else plan_key,
                    "plan_category": "subscription",
                    "plan_start_date": now.isoformat(),
                    "plan_end_date": period_end.isoformat(),
                    "subscription_end_date": period_end.isoformat(),
                    "is_subscribed": True,
                    "plan_features": plan.get("features", {}) if plan else {},
                    "features": plan.get("features", {}) if plan else {},  # Also set features for access control
                    "updated_at": now.isoformat()
                },
                "$unset": {
                    "pending_upgrade": "",
                    "pending_subscription": ""
                }
            }
        )
        
        logger.info(f"Activated anniversary upgrade for user {user_id}: {plan_key}")
        
        # Subscription activated via webhook (anniversary upgrade) — remove from Abandoned Cart
        try:
            from services.google_sheets_service import remove_abandoned_cart_from_sheet
            if user.get("email"):
                await remove_abandoned_cart_from_sheet(user.get("email"), "Subscription")
        except Exception as cart_error:
            logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
        
        # Update Google Sheet with upgrade info
        try:
            import asyncio as _asyncio
            _asyncio.create_task(update_user_upgrade_in_sheet(user.get('email', ''), plan_key, billing_cycle, user))
        except Exception as e:
            logger.error(f"Failed to trigger Google Sheet upgrade update: {e}")
    else:
        # Standard new subscription activation
        pending = user.get("pending_subscription", {})
        
        logger.info(f"Processing standard subscription activation")
        logger.info(f"Pending subscription data: {pending}")
        
        # Calculate period end
        period_end = calculate_period_end(billing_cycle, now)
        logger.info(f"Calculated period_end: {period_end.isoformat()}")
        
        subscription_data = {
            "razorpay_subscription_id": subscription_entity.get("id"),
            "razorpay_plan_id": subscription_entity.get("plan_id"),
            "status": "active",
            "plan_key": plan_key,
            "billing_cycle": billing_cycle,
            "locked_price": pending.get("locked_price", 0),
            "auto_renew": True,
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "activated_at": now.isoformat(),
            "created_at": pending.get("created_at", now.isoformat())
        }
        
        logger.info(f"Created subscription_data: {subscription_data}")
        
        # Preserve upgrade info if present
        if pending.get("upgraded_from"):
            subscription_data["upgraded_from"] = pending["upgraded_from"]
        
        # Create plan assignment (like admin panel does) for proper access control
        plan_assignment = {
            "id": f"assign-{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "plan_key": plan_key,
            "plan_name": plan.get("name") if plan else plan_key,
            "category": "subscription",
            "start_date": now.isoformat(),
            "end_date": period_end.isoformat(),
            "is_trial": False,
            "is_active": True,
            "assigned_by": "system_webhook",
            "assigned_at": now.isoformat(),
            "razorpay_subscription_id": subscription_data.get("razorpay_subscription_id"),
            "billing_cycle": billing_cycle
        }
        
        logger.info(f"Created plan_assignment: {plan_assignment}")
        
        try:
            # First, deactivate any existing plan assignments
            logger.info(f"Deactivating existing plan assignments...")
            deactivate_result = await db.users.update_one(
                {"id": user_id},
                {"$set": {"plan_assignments.$[].is_active": False}}
            )
            logger.info(f"Deactivate result: matched={deactivate_result.matched_count}, modified={deactivate_result.modified_count}")
            
            # Update user with subscription data AND create active plan assignment
            logger.info(f"Updating user document with plan={plan_key} and creating plan_assignment...")
            update_result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "subscription": subscription_data,
                        "plan": plan_key,
                        "plan_name": plan.get("name") if plan else plan_key,
                        "plan_category": "subscription",
                        "plan_start_date": now.isoformat(),
                        "plan_end_date": period_end.isoformat(),
                        "subscription_end_date": period_end.isoformat(),
                        "is_subscribed": True,
                        "plan_features": plan.get("features", {}) if plan else {},
                        "features": plan.get("features", {}) if plan else {},  # Also set features for access control
                        "updated_at": now.isoformat()
                    },
                    "$push": {"plan_assignments": plan_assignment},
                    "$unset": {"pending_subscription": ""}
                }
            )
            
            logger.info(f"✅ Update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
            
            if update_result.matched_count == 0:
                logger.error(f"❌ CRITICAL: No user found with id={user_id}")
            elif update_result.modified_count == 0:
                logger.warning(f"⚠️  User found but document not modified - data might be same")
            else:
                logger.info(f"✅ SUCCESS: User plan updated to {plan_key}")
                
            logger.info(f"Activated subscription for user {user_id} with plan assignment")
            logger.info(f"=== WEBHOOK ACTIVATION COMPLETE ===")
            
            # Subscription activated via webhook — remove from Abandoned Cart sheet
            try:
                from services.google_sheets_service import remove_abandoned_cart_from_sheet
                if user.get("email"):
                    await remove_abandoned_cart_from_sheet(user.get("email"), "Subscription")
            except Exception as cart_error:
                logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
            
            # Update Google Sheet with upgrade info
            try:
                import asyncio as _asyncio
                _asyncio.create_task(update_user_upgrade_in_sheet(user.get('email', ''), plan_key, billing_cycle, user))
            except Exception as e:
                logger.error(f"Failed to trigger Google Sheet upgrade update: {e}")
            
        except Exception as e:
            logger.error(f"❌ EXCEPTION during user update: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise


async def extend_subscription_period(db, user_id: str, subscription_entity: dict, now: datetime):
    """Extend subscription period after successful renewal"""
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    subscription = user.get("subscription", {})
    billing_cycle = subscription.get("billing_cycle", "monthly")
    
    # Calculate new period
    new_period_start = now
    new_period_end = calculate_period_end(billing_cycle, now)
    
    # Check for pending plan change
    pending_change = subscription.get("pending_change")
    
    if pending_change:
        # Apply the scheduled change
        new_plan_key = pending_change.get("new_plan_key")
        new_billing_cycle = pending_change.get("new_billing_cycle")
        new_amount = pending_change.get("new_amount")
        
        # Get new plan
        new_plan = await db.plans.find_one({"plan_key": new_plan_key})
        new_period_end = calculate_period_end(new_billing_cycle, now)
        
        # We need to create a new subscription for the new plan
        # For now, just update the local data - actual Razorpay subscription change
        # would need to be handled separately
        
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription.plan_key": new_plan_key,
                    "subscription.billing_cycle": new_billing_cycle,
                    "subscription.locked_price": new_amount,
                    "subscription.current_period_start": new_period_start.isoformat(),
                    "subscription.current_period_end": new_period_end.isoformat(),
                    "plan": new_plan_key,
                    "plan_name": new_plan.get("name") if new_plan else new_plan_key,
                    "plan_end_date": new_period_end.isoformat(),
                    "subscription_end_date": new_period_end.isoformat(),
                    "plan_features": new_plan.get("features", {}) if new_plan else {},
                    "updated_at": now.isoformat()
                },
                "$unset": {"subscription.pending_change": ""}
            }
        )
        
        logger.info(f"Applied scheduled plan change for user {user_id}: {new_plan_key}")
    else:
        # Just extend the current period
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription.current_period_start": new_period_start.isoformat(),
                    "subscription.current_period_end": new_period_end.isoformat(),
                    "subscription.last_charged_at": now.isoformat(),
                    "plan_end_date": new_period_end.isoformat(),
                    "subscription_end_date": new_period_end.isoformat(),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        logger.info(f"Extended subscription period for user {user_id} to {new_period_end}")


async def record_subscription_payment(db, user_id: str, subscription_entity: dict, now: datetime, payment_type: str = "recurring"):
    """
    Record a subscription payment in the payments collection for analytics.
    This is called when subscription.activated or subscription.charged webhook fires.
    """
    logger.info(f"📝 Starting to record subscription payment for user {user_id}, type: {payment_type}")
    try:
        notes = subscription_entity.get("notes", {})
        logger.info(f"   Notes from subscription: {notes}")
        logger.info(f"   Subscription entity keys: {subscription_entity.keys()}")
        
        user = await db.users.find_one({"id": user_id})
        
        if not user:
            logger.warning(f"Cannot record payment - user {user_id} not found")
            return
        
        # Get amount - try multiple sources
        total_amount = 0
        base_amount = 0
        gst_amount = 0
        discount_amount = 0
        original_amount = 0
        coupon_code = None
        
        # Source 1: Razorpay subscription entity (current_start for amount in paise)
        if subscription_entity.get("current_start"):
            # Amount is in paise, convert to rupees
            total_amount = subscription_entity.get("current_start", 0) / 100
            logger.info(f"   Amount from current_start: {total_amount}")
        
        # Source 2: Notes from subscription
        if not total_amount and notes.get("total_amount"):
            total_amount = float(notes.get("total_amount", 0))
            base_amount = float(notes.get("base_amount", 0))
            gst_amount = float(notes.get("gst_amount", 0))
            logger.info(f"   Amount from notes.total_amount: {total_amount}")
        
        # Source 3: Locked price from notes
        if not total_amount and notes.get("locked_price"):
            total_amount = float(notes.get("locked_price", 0))
            logger.info(f"   Amount from notes.locked_price: {total_amount}")
        
        # Source 4: User's subscription data
        if not total_amount:
            subscription = user.get("subscription", {})
            total_amount = subscription.get("locked_price", 0) or subscription.get("base_price", 0) or 0
            logger.info(f"   Amount from user subscription: {total_amount}")
            
            # Check for discount info in user subscription
            if subscription.get("first_payment_coupon"):
                coupon_info = subscription.get("first_payment_coupon", {})
                discount_amount = coupon_info.get("discount_amount", 0)
                coupon_code = coupon_info.get("code")
                original_amount = subscription.get("base_price", 0) or subscription.get("locked_price", 0)
        
        # Source 5: Get from plans collection if still no amount
        if not total_amount:
            plan_key = notes.get("plan_key") or user.get("plan")
            billing_cycle = notes.get("billing_cycle") or user.get("subscription", {}).get("billing_cycle", "monthly")
            if plan_key:
                plan = await db.plans.find_one({"plan_key": plan_key})
                if plan:
                    if billing_cycle == "yearly":
                        total_amount = plan.get("yearly_price", 0)
                    else:
                        total_amount = plan.get("monthly_price", 0)
                    logger.info(f"   Amount from plans collection: {total_amount}")
        
        # Calculate base and GST if not already set
        if total_amount and not base_amount:
            base_amount = round(total_amount / 1.18, 2)
            gst_amount = round(total_amount - base_amount, 2)
        
        # Get plan info
        plan_key = notes.get("plan_key") or user.get("plan") or user.get("subscription", {}).get("plan_key")
        billing_cycle = notes.get("billing_cycle") or user.get("subscription", {}).get("billing_cycle", "monthly")
        
        logger.info(f"   Final amounts - Total: {total_amount}, Base: {base_amount}, GST: {gst_amount}, Discount: {discount_amount}")
        
        # Create payment record
        payment_record = {
            "id": f"sub-pay-{uuid.uuid4().hex[:12]}",
            "order_id": f"order_sub_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
            "user_id": user_id,
            "user_email": user.get("email"),
            "user_name": user.get("name"),
            "razorpay_subscription_id": subscription_entity.get("id"),
            "razorpay_payment_id": subscription_entity.get("payment_id"),  # May be None
            "type": "subscription",
            "payment_type": payment_type,  # "first_payment" or "recurring"
            "plan_key": plan_key,
            "plan_name": notes.get("plan_name") or user.get("plan_name", plan_key),
            "billing_cycle": billing_cycle,
            "amount": total_amount,
            "base_amount": base_amount,
            "gst_amount": gst_amount,
            "original_amount": original_amount if original_amount else total_amount,
            "discount_amount": discount_amount,
            "coupon_code": coupon_code,
            "currency": "INR",
            "status": "captured",
            "created_at": now.isoformat(),
            "captured_at": now.isoformat(),
            "notes": notes
        }
        
        await db.payments.insert_one(payment_record)
        logger.info(f"✅ Recorded subscription payment for user {user_id}: ₹{total_amount} ({payment_type})")
        logger.info(f"   Payment ID: {payment_record['id']}, Plan: {plan_key}")
        
    except Exception as e:
        logger.error(f"❌ Failed to record subscription payment for user {user_id}: {e}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        # Don't raise - this is non-critical for subscription activation


# ============== Admin Endpoints ==============

@router.get("/admin/user/{user_id}")
async def admin_get_user_subscription(user_id: str, request: Request):
    """Admin: Get detailed subscription info for a user"""
    db = get_db(request)
    current_user = await get_current_user(request)
    
    # Check for admin access - use is_admin field (stored in DB) or role field (computed)
    if not current_user or (not current_user.get("is_admin") and current_user.get("role") != "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription = user.get("subscription", {})
    
    # Get billing history
    history = await db.webhook_logs.find(
        {"user_id": user_id, "event": {"$regex": "subscription"}},
        {"_id": 0}
    ).sort("received_at", -1).limit(20).to_list(20)
    
    return {
        "user_id": user_id,
        "email": user.get("email"),
        "plan": user.get("plan"),
        "subscription": subscription,
        "billing_history": history
    }


@router.post("/admin/extend/{user_id}")
async def admin_extend_subscription(user_id: str, days: int, request: Request):
    """Admin: Extend a user's subscription period (free extension)"""
    db = get_db(request)
    current_user = await get_current_user(request)
    
    # Check for admin access - use is_admin field (stored in DB) or role field (computed)
    if not current_user or (not current_user.get("is_admin") and current_user.get("role") != "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription = user.get("subscription", {})
    current_end = subscription.get("current_period_end")
    
    if not current_end:
        raise HTTPException(status_code=400, detail="User has no subscription period to extend")
    
    current_end_date = datetime.fromisoformat(current_end.replace("Z", "+00:00"))
    new_end_date = current_end_date + timedelta(days=days)
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "subscription.current_period_end": new_end_date.isoformat(),
                "plan_end_date": new_end_date.isoformat(),
                "subscription_end_date": new_end_date.isoformat(),
                "subscription.admin_extension": {
                    "days": days,
                    "extended_by": current_user.get("id"),
                    "extended_at": datetime.now(timezone.utc).isoformat()
                },
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Extended subscription by {days} days",
        "new_period_end": new_end_date.isoformat()
    }



@router.post("/fix-stuck-subscription")
async def fix_stuck_subscription(request: Request):
    """
    Fix subscriptions that are stuck in 'authenticated' state but never activated.
    This handles cases where the webhook didn't fire properly.
    """
    db = get_db(request)
    user = await get_current_user(request)
    client = get_razorpay_client()
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get pending_subscription or subscription with authenticated status
    pending = user.get("pending_subscription")
    subscription = user.get("subscription", {})
    
    # Determine which data to use
    if pending and pending.get("plan_key"):
        plan_key = pending.get("plan_key")
        billing_cycle = pending.get("billing_cycle", "monthly")
        razorpay_subscription_id = pending.get("razorpay_subscription_id")
        source = "pending_subscription"
    elif subscription.get("plan_key") and subscription.get("status") in ["authenticated", "created"]:
        plan_key = subscription.get("plan_key")
        billing_cycle = subscription.get("billing_cycle", "monthly")
        razorpay_subscription_id = subscription.get("razorpay_subscription_id")
        source = "subscription"
    else:
        raise HTTPException(
            status_code=400, 
            detail="No stuck subscription found. User may already be activated or has no pending subscription."
        )
    
    logger.info(f"Fixing stuck subscription for user {user.get('id')}, source: {source}, plan_key: {plan_key}")
    
    # Verify with Razorpay that the subscription is valid
    try:
        if razorpay_subscription_id:
            razorpay_sub = client.subscription.fetch(razorpay_subscription_id)
            logger.info(f"Razorpay status: {razorpay_sub.get('status')}")
            
            if razorpay_sub.get("status") not in ["active", "authenticated"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Subscription not in valid state. Razorpay status: {razorpay_sub.get('status')}"
                )
    except razorpay.errors.BadRequestError as e:
        logger.warning(f"Could not verify with Razorpay: {e}")
        # Continue anyway if we have the data
    
    # Get plan details
    plan = await db.plans.find_one({"plan_key": plan_key})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan not found: {plan_key}")
    
    # Activate the subscription
    now = datetime.now(timezone.utc)
    period_end = calculate_period_end(billing_cycle, now)
    
    subscription_data = {
        "razorpay_subscription_id": razorpay_subscription_id,
        "status": "active",
        "plan_key": plan_key,
        "billing_cycle": billing_cycle,
        "locked_price": pending.get("locked_price", 0) if pending else subscription.get("locked_price", 0),
        "auto_renew": True,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
        "activated_at": now.isoformat(),
        "fixed_at": now.isoformat(),
        "fix_reason": "Manual fix for stuck subscription"
    }
    
    # Update user
    update_result = await db.users.update_one(
        {"id": user.get("id")},
        {
            "$set": {
                "subscription": subscription_data,
                "plan": plan_key,
                "plan_name": plan.get("name"),
                "plan_category": "subscription",
                "plan_start_date": now.isoformat(),
                "plan_end_date": period_end.isoformat(),
                "subscription_end_date": period_end.isoformat(),
                "is_subscribed": True,
                "plan_features": plan.get("features", {}),
                "updated_at": now.isoformat()
            },
            "$unset": {"pending_subscription": ""}
        }
    )
    
    logger.info(f"Fix result: matched={update_result.matched_count}, modified={update_result.modified_count}")
    
    return {
        "success": True,
        "message": f"Subscription fixed and activated successfully",
        "plan": plan_key,
        "plan_name": plan.get("name"),
        "billing_cycle": billing_cycle,
        "period_end": period_end.isoformat()
    }
