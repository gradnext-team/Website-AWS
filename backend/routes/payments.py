"""
Razorpay Payment Integration Routes
Handles order creation, payment verification, and subscription management
Uses dynamic plans from database instead of hardcoded configurations
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import razorpay
import hmac
import hashlib
import os
import uuid
import logging
import asyncio

from routes.auth import get_current_user, get_db
from services import meta_pixel_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

# Razorpay client initialization
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

# Initialize client only if keys are available
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


async def _create_calendar_event_for_booking(
    db,
    booking_id: str,
    mentor_name: str,
    mentor_email: str,
    candidate_name: str,
    candidate_email: str,
    session_date: str,
    session_time: str,
    session_type: str,
    case_type: Optional[str],
    candidate_notes: Optional[str],
):
    """Background task: build the Google Calendar event + Meet link and
    attach the result to the booking. Runs AFTER the verify response has
    been returned to the client, so a slow Google API call never delays
    the user's checkout.
    """
    try:
        from services.calendar_service import create_coaching_session_event
        notes = f"Session Type: {session_type}"
        if case_type:
            notes += f"\nCase Type: {case_type}"
        if candidate_notes:
            notes += f"\n\nCandidate Notes:\n{candidate_notes}"
        # The Google Calendar SDK is synchronous; run it in a thread pool
        # so it doesn't starve the event loop while the background task
        # executes alongside other live requests.
        calendar_result = await asyncio.to_thread(
            create_coaching_session_event,
            mentor_name=mentor_name,
            mentor_email=mentor_email,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            session_date=session_date,
            session_time=session_time,
            duration_minutes=45,
            session_notes=notes,
        )
        if calendar_result and calendar_result.get("meet_link"):
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "meet_link": calendar_result["meet_link"],
                    "calendar_event_id": calendar_result.get("event_id"),
                    # Persist the Meet space name (e.g. "spaces/abc123")
                    # so the post-meeting artifact-fetcher can query the
                    # Meet REST conferenceRecords API for recordings +
                    # transcripts produced by Google after the call ends.
                    "meet_space_name": calendar_result.get("meet_space_name"),
                }},
            )
            logger.info(f"[bg] Meet link attached to booking {booking_id}")
        else:
            logger.warning(f"[bg] Calendar event created but no meet_link for booking {booking_id}")
    except Exception as e:
        logger.warning(f"[bg] Calendar/Meet link generation failed for booking {booking_id} (non-fatal): {e}")


class CreateOrderRequest(BaseModel):
    plan_key: str
    billing_cycle: str = "6-month"  # "monthly" or "6-month"
    coupon_discount_id: Optional[str] = None
    automatic_discount_id: Optional[str] = None
    meta_event_id: Optional[str] = None  # For Meta Pixel/CAPI deduplication


class CreateSingleSessionOrderRequest(BaseModel):
    mentor_id: str


class CreateSessionOrderWithSlotRequest(BaseModel):
    mentor_id: str
    date: str  # YYYY-MM-DD (in mentor's IST timezone, server-side canonical)
    time_slot: str  # HH:MM (24h)
    session_type: str = "General discussion"
    case_type: Optional[str] = None
    candidate_notes: Optional[str] = None
    coupon_discount_id: Optional[str] = None  # Optional discount applied at checkout


class VerifySessionWithSlotRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    mentor_id: str
    # Slot is also stored in the order metadata, but the FE includes it
    # for safety / idempotency.
    date: str
    time_slot: str
    session_type: str = "General discussion"
    case_type: Optional[str] = None
    candidate_notes: Optional[str] = None
    coupon_discount_id: Optional[str] = None  # Optional discount applied at checkout


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_key: str
    meta_event_id: Optional[str] = None  # For Meta Pixel/CAPI deduplication


class VerifySingleSessionPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    mentor_id: str


class CreateTopUpOrderRequest(BaseModel):
    session_count: int
    coupon_discount_id: Optional[str] = None


class VerifyTopUpPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    session_count: int


@router.get("/config")
async def get_razorpay_config():
    """Get Razorpay configuration for frontend"""
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    return {
        "key_id": RAZORPAY_KEY_ID,
        "currency": "INR",
        "company_name": "gradnext"
    }


@router.get("/debug/check")
async def debug_check():
    """Debug endpoint to check payments module is working"""
    return {
        "status": "ok",
        "razorpay_configured": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET),
        "razorpay_client_initialized": razorpay_client is not None
    }


@router.post("/create-order")
async def create_order(order_data: CreateOrderRequest, request: Request):
    """Create a Razorpay order for a plan (uses dynamic plans from DB)"""
    if not razorpay_client:
        raise HTTPException(
            status_code=503, 
            detail="Payment service not configured. Please add Razorpay API keys."
        )
    
    user = await get_current_user(request)
    db = get_db(request)
    
    # Convert Pydantic model to dict if needed
    user_dict = user.dict() if hasattr(user, 'dict') else user
    
    # Get plan from database (dynamic plans)
    plan = await db.plans.find_one({"plan_key": order_data.plan_key}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan not found: {order_data.plan_key}")
    
    # Log plan details for debugging
    logger.info(f"Creating order for plan: {order_data.plan_key}, billing_cycle: {order_data.billing_cycle}, plan data: {plan.get('name')}, pricing: {plan.get('pricing')}")
    
    # Get price from new pricing structure based on billing cycle
    pricing = plan.get("pricing", {})
    price = 0
    
    if isinstance(pricing, dict):
        # New schema: pricing has one_month, six_month, one_time
        # IMPORTANT: six_month is the per-month rate for 6-month commitment, NOT the total
        # For 6-month billing, total = six_month * 6
        if pricing.get("one_time"):
            # Coaching plans use one_time pricing
            price = pricing.get("one_time")
        elif order_data.billing_cycle == "monthly":
            # Monthly billing - use one_month price (single month)
            price = pricing.get("one_month") or 0
        else:
            # 6-month billing (default)
            # six_month is the per-month rate, multiply by 6 for total
            per_month_rate = pricing.get("six_month") or pricing.get("one_month") or 0
            price = per_month_rate * 6  # Total for 6 months
        logger.info(f"Pricing dict: one_time={pricing.get('one_time')}, one_month={pricing.get('one_month')}, six_month={pricing.get('six_month')}, billing_cycle={order_data.billing_cycle}, resolved price={price}")
    else:
        # Old schema: direct price field
        price = plan.get("price", 0)
        logger.info(f"Old pricing schema, price={price}")
    
    if price == 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot create order for free plan. Plan: {order_data.plan_key}, Pricing: {pricing}"
        )
    
    # Determine order type for discount validation
    order_type = "coaching" if pricing.get("one_time") else "subscription"
    
    # Apply discounts if provided
    total_discount = 0
    applied_discounts = []
    
    # Apply automatic discount
    if order_data.automatic_discount_id:
        auto_discount = await db.discounts.find_one({"id": order_data.automatic_discount_id})
        if auto_discount and auto_discount.get("is_active"):
            # Re-validate server-side (date window, billing cycle, plan key, etc.)
            from routes.discounts import validate_discount_applicability
            auto_validation = validate_discount_applicability(
                discount=auto_discount,
                order_type=order_type,
                plan_key=order_data.plan_key,
                order_amount=price,
                billing_cycle=order_data.billing_cycle,
            )
            if not auto_validation["valid"]:
                logger.info(f"Automatic discount {order_data.automatic_discount_id} skipped: {auto_validation['error']}")
            else:
                auto_discount_amount = auto_validation["discount_amount"]
                total_discount += auto_discount_amount
                applied_discounts.append({
                    "discount_id": order_data.automatic_discount_id,
                    "discount_name": auto_discount.get("name"),
                    "discount_type": "automatic",
                    "amount": auto_discount_amount
                })
                logger.info(f"Applied automatic discount: {auto_discount.get('name')}, amount: {auto_discount_amount}")
    
    # Apply coupon discount
    if order_data.coupon_discount_id:
        coupon_discount = await db.discounts.find_one({"id": order_data.coupon_discount_id})
        if coupon_discount and coupon_discount.get("is_active"):
            # Check if coupon can stack or if we should use only coupon
            can_stack = coupon_discount.get("can_stack_with_automatic", False)
            if not can_stack:
                # Remove automatic discount
                total_discount = 0
                applied_discounts = []
            
            discount_value = coupon_discount.get("subscription_discount_value") if order_type == "subscription" else coupon_discount.get("coaching_discount_value")
            if discount_value:
                if coupon_discount.get("discount_type") == "percentage":
                    coupon_discount_amount = price * (discount_value / 100)
                else:
                    coupon_discount_amount = min(discount_value, price)
                total_discount += coupon_discount_amount
                applied_discounts.append({
                    "discount_id": order_data.coupon_discount_id,
                    "discount_code": coupon_discount.get("code"),
                    "discount_name": coupon_discount.get("name"),
                    "discount_type": "coupon",
                    "amount": coupon_discount_amount
                })
                logger.info(f"Applied coupon discount: {coupon_discount.get('code')}, amount: {coupon_discount_amount}")
    
    # Calculate discounted price
    discounted_price = price - total_discount
    
    # Add 18% GST
    gst = discounted_price * 0.18
    total_amount = discounted_price + gst
    
    # Amount in paise (multiply by 100)
    amount_in_paise = int(total_amount * 100)
    
    try:
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": plan.get("currency", "INR"),
            "payment_capture": 1,
            "notes": {
                "user_id": user_dict.get("id", ""),
                "plan_key": order_data.plan_key,
                "plan_name": plan.get("name", ""),
                "billing_cycle": order_data.billing_cycle,
                "user_email": user_dict.get("email", ""),
                "base_amount": price,
                "discount_amount": total_discount,
                "discounted_price": discounted_price,
                "gst": gst,
                "total_amount": total_amount
            }
        })
        
        # Store order in database
        order_doc = {
            "id": str(uuid.uuid4()),
            "razorpay_order_id": razorpay_order["id"],
            "user_id": user_dict.get("id"),
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name"),
            "plan_key": order_data.plan_key,
            "plan_name": plan.get("name"),
            "base_amount": price,
            "discount_amount": total_discount,
            "applied_discounts": applied_discounts,
            "discounted_price": discounted_price,
            "gst": gst,
            "amount": total_amount,
            "amount_in_paise": amount_in_paise,
            "currency": plan.get("currency", "INR"),
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_orders.insert_one(order_doc)
        
        # Track this attempt as an Abandoned Cart entry. Will be removed
        # automatically when the matching payment is verified successfully.
        # We `await` here (rather than fire-and-forget with create_task) because
        # uvicorn / Python can garbage-collect orphaned tasks before they finish,
        # which would silently swallow the sheet write. The added ~1s latency
        # is acceptable for an order creation call.
        try:
            from services.google_sheets_service import append_abandoned_cart_to_sheet
            user_for_sheet = await db.users.find_one(
                {"id": user_dict.get("id")}, {"_id": 0}
            ) or {}
            await append_abandoned_cart_to_sheet(
                user_for_sheet,
                {
                    "plan_attempted_key": order_data.plan_key,
                    "plan_attempted_name": plan.get("name"),
                    "plan_attempted_type": "Subscription",
                    "attempted_at": order_doc["created_at"],
                },
            )
        except Exception as cart_error:
            logger.warning(f"Abandoned cart tracking error (non-critical): {cart_error}")
        
        # Track InitiateCheckout with Meta Conversion API
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            await meta_pixel_service.track_initiate_checkout(
                user_email=user_dict.get("email"),
                value=total_amount,
                currency="INR",
                content_name=plan.get("name"),
                content_ids=[order_data.plan_key],
                content_type=order_type,
                user_name=user_dict.get("name"),
                user_id=user_dict.get("id"),
                event_id=order_data.meta_event_id,  # For deduplication with browser pixel
                client_ip=client_ip,
                client_user_agent=client_user_agent,
                fbp=meta_cookies.get('fbp'),
                fbc=meta_cookies.get('fbc'),
            )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        # Record discount usage when order is created (will be finalized after payment verification)
        # This is just to track the intent - actual usage increment happens after successful payment
        
        return {
            "success": True,
            "order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": plan.get("currency", "INR"),
            "key_id": RAZORPAY_KEY_ID,
            "plan_name": plan.get("name"),
            "plan_key": order_data.plan_key,
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name"),
            "base_amount": price,
            "discount_amount": total_discount,
            "discounted_price": discounted_price,
            "gst": gst,
            "total_amount": total_amount
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Razorpay error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.post("/verify")
async def verify_payment(payment_data: VerifyPaymentRequest, request: Request):
    """Verify Razorpay payment signature and activate subscription"""
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    user = await get_current_user(request)
    db = get_db(request)
    
    # Convert Pydantic model to dict if needed
    user_dict = user.dict() if hasattr(user, 'dict') else user
    
    # Verify signature using HMAC SHA256
    try:
        message = f"{payment_data.razorpay_order_id}|{payment_data.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != payment_data.razorpay_signature:
            # Update order status to failed
            await db.payment_orders.update_one(
                {"razorpay_order_id": payment_data.razorpay_order_id},
                {"$set": {
                    "status": "signature_failed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            raise HTTPException(status_code=400, detail="Invalid payment signature")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {str(e)}")
    
    # Get plan from database
    plan = await db.plans.find_one({"plan_key": payment_data.plan_key}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get the order
    order = await db.payment_orders.find_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"_id": 0}
    )
    
    now = datetime.now(timezone.utc)
    
    # Calculate subscription end date based on plan duration
    duration_months = plan.get("duration_months")
    duration_days = plan.get("duration_days")
    
    subscription_end = None
    if duration_months:
        from dateutil.relativedelta import relativedelta
        subscription_end = now + relativedelta(months=duration_months)
    elif duration_days:
        from dateutil.relativedelta import relativedelta
        subscription_end = now + relativedelta(days=duration_days)
    
    # Update order status to paid
    await db.payment_orders.update_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature,
            "paid_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # User completed checkout — clear the matching Subscription row from sheet.
    try:
        from services.google_sheets_service import remove_abandoned_cart_from_sheet
        if user_dict.get("email"):
            await remove_abandoned_cart_from_sheet(user_dict.get("email"), "Subscription")
    except Exception as cart_error:
        logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
    
    # Create payment record
    features = plan.get("features", {})
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": payment_data.razorpay_order_id or f"order_pay_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
        "user_id": user_dict.get("id"),
        "user_email": user_dict.get("email"),
        "razorpay_order_id": payment_data.razorpay_order_id,
        "razorpay_payment_id": payment_data.razorpay_payment_id,
        "plan_key": payment_data.plan_key,
        "plan_name": plan.get("name"),
        "plan_category": plan.get("category", "coaching"),
        "amount": order.get("amount") if order else plan.get("price"),
        "currency": plan.get("currency", "INR"),
        "status": "captured",
        "subscription_start": now.isoformat(),
        "subscription_end": subscription_end.isoformat() if subscription_end else None,
        "coaching_sessions": features.get("coaching_sessions", 0),
        "strategy_calls": features.get("strategy_calls", 0),
        "created_at": now.isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Update user subscription
    features = plan.get("features", {})
    subscription_end_str = subscription_end.isoformat() if subscription_end else None
    plan_category = plan.get("category", "coaching")
    
    # Record discount usage if any discounts were applied
    if order and order.get("applied_discounts"):
        for discount_info in order.get("applied_discounts", []):
            discount_id = discount_info.get("discount_id")
            if discount_id:
                # Record usage
                usage_doc = {
                    "id": str(uuid.uuid4()),
                    "discount_id": discount_id,
                    "discount_code": discount_info.get("discount_code"),
                    "discount_name": discount_info.get("discount_name"),
                    "user_id": user_dict.get("id"),
                    "user_email": user_dict.get("email"),
                    "order_type": "coaching" if plan_category == "coaching" else "subscription",
                    "plan_key": payment_data.plan_key,
                    "original_amount": order.get("base_amount", 0),
                    "discount_applied": discount_info.get("amount", 0),
                    "final_amount": order.get("discounted_price", 0),
                    "used_at": now.isoformat()
                }
                await db.discount_usage.insert_one(usage_doc)
                
                # Increment discount usage count
                await db.discounts.update_one(
                    {"id": discount_id},
                    {"$inc": {"current_total_uses": 1}}
                )
    
    user_update = {
        "plan": payment_data.plan_key,
        "plan_name": plan.get("name"),
        "plan_category": plan_category,
        "subscription_date": now.isoformat(),
        "plan_start_date": now.isoformat(),
        "subscription_end": subscription_end_str,
        "plan_end_date": subscription_end_str,
        # Set category-specific end dates for consistency
        "subscription_end_date": subscription_end_str if plan_category == "subscription" else None,
        "coaching_program_end_date": subscription_end_str if plan_category == "coaching" else None,
        "coaching_sessions_total": features.get("coaching_sessions", 0),
        "coaching_sessions_used": 0,
        "strategy_calls_total": features.get("strategy_calls", 0),
        "strategy_calls_used": 0,
        "plan_features": features,
        "last_payment_id": payment_data.razorpay_payment_id,
        "updated_at": now.isoformat()
    }
    
    # For subscription plans, sync all date fields for consistency
    if subscription_end_str:
        user_update["subscription_end_date"] = subscription_end_str
        user_update["coaching_program_end_date"] = subscription_end_str
    
    # Try updating in users collection first, then mock_users
    result = await db.users.update_one(
        {"id": user_dict.get("id")},
        {"$set": user_update}
    )
    if result.modified_count == 0:
        await db.mock_users.update_one(
            {"id": user_dict.get("id")},
            {"$set": user_update}
        )
    
    # Track purchase with Meta Conversion API (fire and forget)
    try:
        client_ip = request.client.host if request.client else None
        client_user_agent = request.headers.get('user-agent')
        meta_cookies = meta_pixel_service.extract_meta_cookies(request)
        amount_in_rupees = (order.get("amount", 0) if order else plan.get("price", 0)) / 100  # Convert paise to rupees
        await meta_pixel_service.track_purchase(
            user_email=user_dict.get("email"),
            value=amount_in_rupees,
            currency="INR",
            content_name=plan.get("name"),
            content_ids=[payment_data.plan_key],
            content_type=plan_category,
            user_name=user_dict.get("name"),
            user_id=user_dict.get("id"),
            event_id=payment_data.meta_event_id,  # For deduplication with browser pixel
            client_ip=client_ip,
            client_user_agent=client_user_agent,
            fbp=meta_cookies.get('fbp'),
            fbc=meta_cookies.get('fbc'),
        )
    except Exception as track_error:
        logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
    
    return {
        "success": True,
        "message": f"Successfully upgraded to {plan.get('name')}",
        "plan_key": payment_data.plan_key,
        "plan_name": plan.get("name"),
        "subscription_end": subscription_end.isoformat() if subscription_end else "Unlimited",
        "coaching_sessions": plan.get("coaching_sessions", 0)
    }


@router.post("/webhook")
async def handle_webhook(request: Request):
    """Handle Razorpay webhooks for payment events"""
    db = get_db(request)
    
    try:
        payload = await request.body()
        
        import json
        event_data = json.loads(payload.decode())
        event_type = event_data.get("event")
        
        # Log webhook event
        webhook_log = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "payload": event_data,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        await db.webhook_logs.insert_one(webhook_log)
        
        # Handle payment.captured event
        if event_type == "payment.captured":
            payment = event_data.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            
            if order_id:
                await db.payment_orders.update_one(
                    {"razorpay_order_id": order_id},
                    {"$set": {
                        "status": "captured",
                        "webhook_received": True,
                        "webhook_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        # Handle payment.failed event
        elif event_type == "payment.failed":
            payment = event_data.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            error_reason = payment.get("error_reason", "Unknown")
            
            if order_id:
                await db.payment_orders.update_one(
                    {"razorpay_order_id": order_id},
                    {"$set": {
                        "status": "failed",
                        "error_reason": error_reason,
                        "webhook_received": True,
                        "webhook_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"Webhook processing error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.get("/history")
async def get_payment_history(request: Request):
    """Get user's payment history"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Convert Pydantic model to dict if needed
    user_dict = user.dict() if hasattr(user, 'dict') else user
    
    payments = await db.payments.find(
        {"user_id": user_dict.get("id")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"payments": payments}


@router.get("/orders")
async def get_orders(request: Request):
    """Get user's order history"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Convert Pydantic model to dict if needed
    user_dict = user.dict() if hasattr(user, 'dict') else user
    
    orders = await db.payment_orders.find(
        {"user_id": user_dict.get("id")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"orders": orders}


@router.get("/subscription")
async def get_subscription_status(request: Request):
    """Get current user's subscription status"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Convert Pydantic model to dict if needed
    user_dict = user.dict() if hasattr(user, 'dict') else user
    
    # Get the latest payment for this user
    latest_payment = await db.payments.find_one(
        {"user_id": user_dict.get("id"), "status": "captured"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not latest_payment:
        return {
            "has_subscription": False,
            "plan_key": user_dict.get("plan", "free_trial"),
            "plan_name": "Free Trial"
        }
    
    # Check if subscription is still active
    subscription_end = latest_payment.get("subscription_end")
    is_active = True
    
    if subscription_end:
        end_date = datetime.fromisoformat(subscription_end.replace("Z", "+00:00"))
        is_active = end_date > datetime.now(timezone.utc)
    
    return {
        "has_subscription": True,
        "is_active": is_active,
        "plan_key": latest_payment.get("plan_key"),
        "plan_name": latest_payment.get("plan_name"),
        "subscription_start": latest_payment.get("subscription_start"),
        "subscription_end": subscription_end,
        "coaching_sessions": latest_payment.get("coaching_sessions", 0)
    }


# ============ Single Coaching Session Purchase ============

@router.post("/create-session-order")
async def create_single_session_order(order_data: CreateSingleSessionOrderRequest, request: Request):
    """Create a Razorpay order for a single coaching session with a specific mentor"""
    if not razorpay_client:
        raise HTTPException(
            status_code=503, 
            detail="Payment service not configured. Please add Razorpay API keys."
        )
    
    user = await get_current_user(request)
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    
    # Get mentor details including price_per_session
    mentor = await db.mentors.find_one({"id": order_data.mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Get session price (default to 2999 if not set)
    price = mentor.get("price_per_session", 2999)
    
    if price <= 0:
        raise HTTPException(status_code=400, detail="Invalid session price")
    
    # Add 18% GST
    gst = price * 0.18
    total_amount = price + gst
    
    # Amount in paise (multiply by 100)
    amount_in_paise = int(total_amount * 100)
    
    try:
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "user_id": user_dict.get("id", ""),
                "mentor_id": order_data.mentor_id,
                "mentor_name": mentor.get("name", ""),
                "user_email": user_dict.get("email", ""),
                "type": "single_coaching_session",
                "base_amount": price,
                "gst": gst,
                "total_amount": total_amount
            }
        })
        
        # Store order in database
        order_doc = {
            "id": str(uuid.uuid4()),
            "razorpay_order_id": razorpay_order["id"],
            "user_id": user_dict.get("id"),
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name"),
            "type": "single_coaching_session",
            "mentor_id": order_data.mentor_id,
            "mentor_name": mentor.get("name"),
            "base_amount": price,
            "gst": gst,
            "amount": total_amount,
            "amount_in_paise": amount_in_paise,
            "currency": "INR",
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_orders.insert_one(order_doc)
        
        # Track this coaching-session purchase attempt as an Abandoned Cart
        # entry. Removed automatically on successful /verify-session.
        try:
            from services.google_sheets_service import append_abandoned_cart_to_sheet
            user_for_sheet = await db.users.find_one(
                {"id": user_dict.get("id")}, {"_id": 0}
            ) or {}
            await append_abandoned_cart_to_sheet(
                user_for_sheet,
                {
                    "plan_attempted_key": "single_coaching_session",
                    "plan_attempted_name": f"Coaching Session with {mentor.get('name', 'Mentor')}",
                    "plan_attempted_type": "Coaching",
                    "attempted_at": order_doc["created_at"],
                },
            )
        except Exception as cart_error:
            logger.warning(f"Abandoned cart tracking error (non-critical): {cart_error}")
        
        return {
            "success": True,
            "order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "mentor_name": mentor.get("name"),
            "mentor_id": order_data.mentor_id,
            "base_price": price,
            "gst": gst,
            "total_price": total_amount,
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name")
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Razorpay error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.post("/verify-session")
async def verify_single_session_payment(payment_data: VerifySingleSessionPaymentRequest, request: Request):
    """Verify Razorpay payment for single coaching session and add 1 session credit"""
    logger.info(f"Verifying session payment: order_id={payment_data.razorpay_order_id}, payment_id={payment_data.razorpay_payment_id}")
    
    if not razorpay_client:
        logger.error("Payment service not configured - missing Razorpay keys")
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    user = await get_current_user(request)
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    user_id = user_dict.get("id")
    user_email = user_dict.get("email")
    
    logger.info(f"Payment verification for user: {user_email} (id: {user_id})")
    
    signature_valid = False
    payment_captured = False
    fallback_used = False
    
    # Step 1: Try signature verification
    try:
        message = f"{payment_data.razorpay_order_id}|{payment_data.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        logger.info(f"Signature verification: generated={generated_signature[:20]}..., received={payment_data.razorpay_signature[:20] if payment_data.razorpay_signature else 'None'}...")
        
        if generated_signature == payment_data.razorpay_signature:
            signature_valid = True
            logger.info("Signature verification successful")
        else:
            logger.warning(f"Signature mismatch for order {payment_data.razorpay_order_id}")
    except Exception as e:
        logger.error(f"Signature verification error: {str(e)}")
    
    # Step 2: If signature failed, check Razorpay directly as fallback
    if not signature_valid:
        logger.info("Signature verification failed, checking Razorpay payment status as fallback...")
        try:
            # Fetch payment from Razorpay to verify it was captured
            payment = razorpay_client.payment.fetch(payment_data.razorpay_payment_id)
            payment_status = payment.get("status", "").lower()
            payment_order_id = payment.get("order_id")
            
            logger.info(f"Razorpay payment status: {payment_status}, order_id: {payment_order_id}, expected_order: {payment_data.razorpay_order_id}")
            
            # Verify the payment is captured/authorized and matches our order
            # Accept both "captured" and "authorized" as valid payment states
            valid_statuses = ["captured", "authorized"]
            if payment_status in valid_statuses and payment_order_id == payment_data.razorpay_order_id:
                payment_captured = True
                fallback_used = True
                logger.info(f"Fallback verification successful - payment status: {payment_status}")
            else:
                logger.error(f"Fallback verification failed: status={payment_status} (valid: {valid_statuses}), order_match={payment_order_id == payment_data.razorpay_order_id}")
        except Exception as e:
            logger.error(f"Razorpay fallback check failed: {str(e)}")
    
    # If neither signature nor fallback worked, reject
    if not signature_valid and not payment_captured:
        await db.payment_orders.update_one(
            {"razorpay_order_id": payment_data.razorpay_order_id},
            {"$set": {
                "status": "verification_failed",
                "verification_error": "Signature invalid and Razorpay fallback failed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=400, detail="Payment verification failed. Please contact support with your payment ID.")
    
    # Get the order
    order = await db.payment_orders.find_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"_id": 0}
    )
    
    if not order:
        logger.error(f"Order not found: {payment_data.razorpay_order_id}")
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get mentor details
    mentor = await db.mentors.find_one({"id": payment_data.mentor_id}, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    
    # Update order status
    update_result = await db.payment_orders.update_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature,
            "paid_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "fallback_verification_used": fallback_used
        }}
    )
    logger.info(f"Order status updated to 'paid': modified={update_result.modified_count}, fallback={fallback_used}")
    
    # Create payment record
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": payment_data.razorpay_order_id or f"order_session_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
        "user_id": user_id,
        "user_email": user_email,
        "razorpay_order_id": payment_data.razorpay_order_id,
        "razorpay_payment_id": payment_data.razorpay_payment_id,
        "type": "single_coaching_session",
        "mentor_id": payment_data.mentor_id,
        "mentor_name": mentor.get("name") if mentor else "Unknown",
        "amount": order.get("amount"),
        "currency": "INR",
        "status": "captured",
        "coaching_sessions": 1,
        "fallback_verification_used": fallback_used,
        "created_at": now.isoformat()
    }
    await db.payments.insert_one(payment_record)
    logger.info(f"Payment record created: {payment_record['id']}")
    
    # Add 1 coaching session to user using atomic $inc operation
    # This avoids race conditions and doesn't depend on potentially stale session data
    user_update_result = await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {"coaching_sessions_remaining": 1},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # If coaching_sessions_remaining field didn't exist, $inc creates it starting from 0 + 1 = 1
    # Fetch the updated value for logging and response
    updated_user = await db.users.find_one({"id": user_id}, {"coaching_sessions_remaining": 1, "_id": 0})
    new_sessions = (updated_user or {}).get("coaching_sessions_remaining", 1)
    logger.info(f"User sessions updated: user_id={user_id}, new_total={new_sessions}, modified={user_update_result.modified_count}")
    
    if user_update_result.modified_count == 0:
        logger.warning(f"User update did not modify any document. User ID might not match: {user_id}")
    
    # Coaching-session payment succeeded — clear matching Coaching row from sheet.
    try:
        from services.google_sheets_service import remove_abandoned_cart_from_sheet
        if user_email:
            await remove_abandoned_cart_from_sheet(user_email, "Coaching")
    except Exception as cart_error:
        logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
    
    return {
        "success": True,
        "message": "Payment verified! 1 coaching session has been added to your account.",
        "sessions_added": 1,
        "new_total_sessions": new_sessions
    }


@router.get("/debug/user-sessions")
async def debug_user_sessions(request: Request):
    """Debug endpoint to check user's coaching session credits"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    user_id = user_dict.get("id")
    user_email = user_dict.get("email")
    
    # Get fresh user data from database
    db_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "email": 1, "plan": 1, 
                                                        "coaching_sessions_remaining": 1, 
                                                        "coaching_sessions_total": 1,
                                                        "coaching_sessions_used": 1,
                                                        "is_unlimited_coaching": 1})
    
    # Get payment orders for this user
    orders = await db.payment_orders.find(
        {"user_id": user_id, "type": "single_coaching_session"}
    ).sort("created_at", -1).to_list(10)
    
    # Get payments for this user
    payments = await db.payments.find(
        {"user_id": user_id, "type": "single_coaching_session"}
    ).sort("created_at", -1).to_list(10)
    
    return {
        "session_user": {
            "id": user_id,
            "email": user_email,
            "plan": user_dict.get("plan"),
            "coaching_sessions_remaining": user_dict.get("coaching_sessions_remaining")
        },
        "database_user": db_user,
        "recent_orders": [
            {
                "razorpay_order_id": o.get("razorpay_order_id"),
                "status": o.get("status"),
                "amount": o.get("amount"),
                "created_at": o.get("created_at")
            } for o in orders
        ],
        "recent_payments": [
            {
                "id": p.get("id"),
                "status": p.get("status"),
                "amount": p.get("amount"),
                "coaching_sessions": p.get("coaching_sessions"),
                "created_at": p.get("created_at")
            } for p in payments
        ]
    }



@router.post("/create-session-order-with-slot")
async def create_session_order_with_slot(
    body: CreateSessionOrderWithSlotRequest,
    request: Request,
):
    """Create a Razorpay order for a single mentor session AND temporarily
    reserve the chosen slot for 15 minutes. The reservation auto-expires via
    a TTL index, so abandoned checkouts release the slot.

    Combined endpoint used by the public `/book/<mentorId>` flow."""
    db = get_db(request)
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    mentor = await db.mentors.find_one({"id": body.mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")

    # Validate slot is currently free (no confirmed booking + no other live
    # reservation by another user)
    existing_booking = await db.bookings.find_one({
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
        "status": {"$in": ["confirmed", "pending"]},
    }, {"_id": 0, "id": 1})
    if existing_booking:
        raise HTTPException(status_code=409, detail="This slot was just taken. Please pick another.")

    other_reservation = await db.slot_reservations.find_one({
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
        "user_id": {"$ne": user["id"]},
    })
    if other_reservation:
        raise HTTPException(status_code=409, detail="Another candidate is checking out this slot. Please try a different time.")

    # Resolve session price
    price_inr = mentor.get("price_per_session")
    if price_inr is None or price_inr <= 0:
        # Fallback to platform default
        settings = await db.platform_settings.find_one({"_id": "settings"}) or {}
        price_inr = settings.get("default_single_session_price", 2999)
    price_inr = int(price_inr)
    original_price_inr = price_inr

    # Apply coupon discount if provided (treats single sessions under the
    # "coaching" discount scope so admin-defined coaching coupons work here too)
    discount_amount_inr = 0
    discount_doc = None
    if body.coupon_discount_id:
        discount_doc = await db.discounts.find_one({"id": body.coupon_discount_id})
        if not discount_doc:
            raise HTTPException(status_code=400, detail="Invalid coupon")
        from routes.discounts import validate_discount_applicability
        user_usage_count = await db.discount_usage.count_documents({
            "discount_id": body.coupon_discount_id,
            "user_id": user["id"],
        })
        validation = validate_discount_applicability(
            discount=discount_doc,
            order_type="coaching",
            plan_key="single_session",
            order_amount=float(price_inr),
            user_id=user["id"],
            user_usage_count=user_usage_count,
        )
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=validation.get("error") or "Coupon cannot be applied")
        discount_amount_inr = int(round(float(validation["discount_amount"])))
        if discount_amount_inr < 0:
            discount_amount_inr = 0
        if discount_amount_inr > price_inr:
            discount_amount_inr = price_inr
        price_inr = price_inr - discount_amount_inr
        # Razorpay does not allow zero-amount orders; ensure at least ₹1
        if price_inr < 1:
            price_inr = 1
            discount_amount_inr = original_price_inr - 1

    # Add 18% GST on the discounted price
    gst_amount = round(price_inr * 0.18)
    total_with_gst = price_inr + gst_amount
    amount_paise = total_with_gst * 100

    # Create Razorpay order
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    try:
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"sess_{user['id'][:8]}_{datetime.now(timezone.utc).strftime('%H%M%S')}",
            "notes": {
                "user_id": user["id"],
                "mentor_id": body.mentor_id,
                "date": body.date,
                "time_slot": body.time_slot,
                "purpose": "single_session_with_slot",
            },
        })
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not create payment order. Please try again.")

    # Reserve the slot for 15 minutes (TTL index auto-expires it)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.slot_reservations.replace_one(
        {
            "mentor_id": body.mentor_id,
            "date": body.date,
            "time_slot": body.time_slot,
            "user_id": user["id"],
        },
        {
            "user_id": user["id"],
            "mentor_id": body.mentor_id,
            "date": body.date,
            "time_slot": body.time_slot,
            "razorpay_order_id": order["id"],
            "session_type": body.session_type,
            "case_type": body.case_type,
            "candidate_notes": body.candidate_notes,
            "original_price_inr": original_price_inr,
            "final_price_inr": price_inr,
            "gst_amount_inr": gst_amount,
            "total_with_gst_inr": total_with_gst,
            "coupon_discount_id": body.coupon_discount_id,
            "discount_amount_inr": discount_amount_inr,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
        },
        upsert=True,
    )

    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "razorpay_key": os.environ.get("RAZORPAY_KEY_ID"),
        "mentor_name": mentor.get("name"),
        "base_price_inr": price_inr,
        "gst_amount_inr": gst_amount,
        "total_with_gst_inr": total_with_gst,
        "price_inr": price_inr,
        "original_price_inr": original_price_inr,
        "discount_amount_inr": discount_amount_inr,
        "coupon_code": (discount_doc.get("code") if discount_doc else None),
        "reservation_expires_at": expires_at.isoformat(),
    }


@router.post("/verify-session-with-slot")
async def verify_session_with_slot(
    body: VerifySessionWithSlotRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Verify Razorpay payment, then book the reserved slot. Idempotent."""
    db = get_db(request)
    
    # Try to get user from auth cookie, but don't fail if missing
    user = None
    try:
        user = await get_current_user(request)
    except HTTPException:
        # Auth cookie missing - will try fallback below
        pass

    # Defensive auth fallback ─────────────────────────────────────────────
    # On some browsers (notably mobile Safari / in-app webviews) the auth
    # cookie occasionally fails to round-trip across the Razorpay checkout
    # redirect. Without this fallback the user pays successfully and is
    # then greeted with a 401 — terrible UX. Recover the user_id from the
    # slot_reservations doc that was created at order time (keyed by the
    # razorpay_order_id, which the FE always passes back).
    if not user:
        reservation_for_user = await db.slot_reservations.find_one(
            {"razorpay_order_id": body.razorpay_order_id},
            {"_id": 0, "user_id": 1},
        )
        if reservation_for_user and reservation_for_user.get("user_id"):
            recovered_uid = reservation_for_user["user_id"]
            recovered_user = await db.users.find_one({"id": recovered_uid}, {"_id": 0})
            if recovered_user:
                user = recovered_user
                logger.warning(
                    f"[verify-session-with-slot] Auth cookie missing — recovered "
                    f"user {recovered_uid} from slot_reservations via order "
                    f"{body.razorpay_order_id}."
                )

    if not user:
        logger.error(
            f"[verify-session-with-slot] Authentication required and no "
            f"reservation found for order {body.razorpay_order_id}. "
            f"Mentor={body.mentor_id} slot={body.date} {body.time_slot}."
        )
        raise HTTPException(status_code=401, detail="Authentication required")

    # Verify Razorpay signature
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception as e:
        logger.error(f"Razorpay signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Idempotency
    existing = await db.bookings.find_one(
        {"razorpay_payment_id": body.razorpay_payment_id},
        {"_id": 0},
    )
    if existing:
        return {"success": True, "booking_id": existing.get("id"), "already_booked": True}

    mentor = await db.mentors.find_one({"id": body.mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")

    # Final slot-availability check (race protection)
    conflict = await db.bookings.find_one({
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
        "status": {"$in": ["confirmed", "pending"]},
    }, {"_id": 0, "id": 1})
    if conflict:
        logger.error(
            f"Slot taken after payment! payment_id={body.razorpay_payment_id} "
            f"user={user['id']} slot={body.date} {body.time_slot}. "
            f"Manual refund required."
        )
        raise HTTPException(
            status_code=409,
            detail="This slot was booked moments before your payment completed. "
                   "Our team will refund you within 24 hours.",
        )

    # Pull pricing/discount details captured during order creation.
    # Look up by user_id first, but fall back to razorpay_order_id so we
    # still recover the original pricing even when the auth fallback above
    # kicked in (cookie was missing).
    reservation = await db.slot_reservations.find_one({
        "user_id": user["id"],
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
    }, {"_id": 0})
    if not reservation:
        reservation = await db.slot_reservations.find_one(
            {"razorpay_order_id": body.razorpay_order_id},
            {"_id": 0},
        ) or {}
    original_price_inr = int(reservation.get("original_price_inr") or mentor.get("price_per_session") or 2999)
    final_price_inr = int(reservation.get("final_price_inr") or original_price_inr)
    discount_amount_inr = int(reservation.get("discount_amount_inr") or 0)
    coupon_discount_id = body.coupon_discount_id or reservation.get("coupon_discount_id")
    gst_amount_inr = int(reservation.get("gst_amount_inr") or round(final_price_inr * 0.18))
    total_with_gst_inr = final_price_inr + gst_amount_inr

    # Persist payment record. NOTE: `order_id` MUST be set — there's a
    # **unique non-sparse** index on `payments.order_id`. If we omit it,
    # MongoDB writes `order_id: null` and the second such insert fails
    # with a DuplicateKeyError → 500. This was the production bug that
    # produced "Booking finalization failed" for fresh-signup users.
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_id": body.razorpay_order_id,
        "razorpay_order_id": body.razorpay_order_id,
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_signature": body.razorpay_signature,
        "type": "single_session_with_slot",
        "status": "captured",
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
        "amount_inr": total_with_gst_inr,
        "base_amount_inr": final_price_inr,
        "gst_amount_inr": gst_amount_inr,
        "original_amount_inr": original_price_inr,
        "discount_amount_inr": discount_amount_inr,
        "coupon_discount_id": coupon_discount_id,
        "created_at": datetime.now(timezone.utc),
    })

    # Record discount usage (best-effort) so that per-user / total caps update correctly
    if coupon_discount_id and discount_amount_inr > 0:
        try:
            discount_doc = await db.discounts.find_one({"id": coupon_discount_id})
            if discount_doc:
                await db.discount_usage.insert_one({
                    "id": str(uuid.uuid4()),
                    "discount_id": coupon_discount_id,
                    "discount_code": discount_doc.get("code"),
                    "discount_name": discount_doc.get("name"),
                    "user_id": user["id"],
                    "user_email": user.get("email"),
                    "order_type": "coaching",
                    "plan_key": "single_session",
                    "original_amount": float(original_price_inr),
                    "discount_applied": float(discount_amount_inr),
                    "final_amount": float(final_price_inr),
                    "razorpay_payment_id": body.razorpay_payment_id,
                    "used_at": datetime.now(timezone.utc).isoformat(),
                })
                await db.discounts.update_one(
                    {"id": coupon_discount_id},
                    {"$inc": {"current_total_uses": 1}},
                )
        except Exception as e:
            logger.warning(f"Failed to record discount usage for single session: {e}")

    # Create booking
    booking_id = str(uuid.uuid4())
    booking_doc = {
        "id": booking_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "mentor_id": body.mentor_id,
        "mentor_name": mentor.get("name"),
        "date": body.date,
        "time_slot": body.time_slot,
        "session_type": body.session_type or "General discussion",
        "case_type": body.case_type,
        "candidate_notes": body.candidate_notes,
        "status": "confirmed",
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_order_id": body.razorpay_order_id,
        "purchase_type": "single_session_with_slot",
        "amount_inr": total_with_gst_inr,
        "base_amount_inr": final_price_inr,
        "gst_amount_inr": gst_amount_inr,
        "original_amount_inr": original_price_inr,
        "discount_amount_inr": discount_amount_inr,
        "coupon_discount_id": coupon_discount_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.bookings.insert_one(booking_doc)

    # Release the slot reservation
    await db.slot_reservations.delete_one({
        "user_id": user["id"],
        "mentor_id": body.mentor_id,
        "date": body.date,
        "time_slot": body.time_slot,
    })

    # Create calendar event with Meet link in the BACKGROUND. The Google
    # Calendar SDK call is synchronous and on production frequently takes
    # 10–30 s (cold-start auth, network round trips). Doing it inline
    # blocks the async event loop and pushes the verify response past
    # Cloudflare's / the browser's tolerance, which is what was producing
    # the misleading "Booking finalization failed. Our team will refund
    # you within 24 hours." error even when the booking itself was saved
    # successfully. By scheduling it as a BackgroundTask we:
    #   1. Return the success response to the client immediately, so the
    #      frontend can navigate to /dashboard and trigger onboarding.
    #   2. Still attach the meet_link to the booking once the calendar
    #      call resolves, asynchronously.
    background_tasks.add_task(
        _create_calendar_event_for_booking,
        db=db,
        booking_id=booking_id,
        mentor_name=mentor.get("name", "Mentor"),
        mentor_email=mentor.get("email", ""),
        candidate_name=user.get("name", "Candidate"),
        candidate_email=user.get("email", ""),
        session_date=body.date,
        session_time=body.time_slot,
        session_type=body.session_type or "General discussion",
        case_type=body.case_type,
        candidate_notes=body.candidate_notes,
    )

    logger.info(f"✅ Single-session-with-slot booked: {booking_id} for {user['id']}")

    return {
        "success": True,
        "booking_id": booking_id,
        "mentor_name": mentor.get("name"),
        "date": body.date,
        "time_slot": body.time_slot,
        "redirect_to": "/dashboard",
    }



@router.post("/debug/manually-credit-session")
async def manually_credit_session(request: Request):
    """Manually credit a coaching session to the current user (for debugging payment issues)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    user_id = user_dict.get("id")
    user_email = user_dict.get("email")
    
    # Get current sessions from database
    db_user = await db.users.find_one({"id": user_id}, {"_id": 0, "coaching_sessions_remaining": 1})
    current_sessions = db_user.get("coaching_sessions_remaining", 0) if db_user else 0
    
    # Handle None or -1 (unlimited)
    if current_sessions is None:
        current_sessions = 0
    elif current_sessions == -1:
        return {"error": "User already has unlimited sessions", "current_sessions": -1}
    
    new_sessions = current_sessions + 1
    
    # Update user
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "coaching_sessions_remaining": new_sessions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Manual session credit: user={user_email}, old={current_sessions}, new={new_sessions}, modified={result.modified_count}")
    
    return {
        "success": True,
        "user_email": user_email,
        "previous_sessions": current_sessions,
        "new_sessions": new_sessions,
        "modified_count": result.modified_count
    }


@router.post("/debug/verify-topup-order")
async def debug_verify_topup_order(request: Request):
    """Debug endpoint to manually verify a top-up payment by order ID"""
    from routes.admin import verify_admin
    await verify_admin(request)
    
    db = get_db(request)
    body = await request.json()
    order_id = body.get("razorpay_order_id")
    payment_id = body.get("razorpay_payment_id")
    
    if not order_id or not payment_id:
        return {"error": "razorpay_order_id and razorpay_payment_id required"}
    
    result = {
        "order_id": order_id,
        "payment_id": payment_id,
        "razorpay_key_id_length": len(RAZORPAY_KEY_ID) if RAZORPAY_KEY_ID else 0,
        "razorpay_key_secret_length": len(RAZORPAY_KEY_SECRET) if RAZORPAY_KEY_SECRET else 0,
    }
    
    # Check our database for the order
    order = await db.payment_orders.find_one({"razorpay_order_id": order_id}, {"_id": 0})
    result["db_order"] = order if order else "NOT FOUND"
    
    # Try to fetch payment from Razorpay
    try:
        payment = razorpay_client.payment.fetch(payment_id)
        result["razorpay_payment"] = {
            "status": payment.get("status"),
            "order_id": payment.get("order_id"),
            "amount": payment.get("amount"),
            "captured": payment.get("captured"),
        }
    except Exception as e:
        result["razorpay_payment_error"] = str(e)
    
    return result


@router.get("/mentor/{mentor_id}/session-price")
async def get_mentor_session_price(mentor_id: str, request: Request):
    """Get the single session price for a specific mentor"""
    db = get_db(request)
    
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0, "id": 1, "name": 1, "price_per_session": 1})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    price = mentor.get("price_per_session", 2999)
    gst = price * 0.18
    
    return {
        "mentor_id": mentor_id,
        "mentor_name": mentor.get("name"),
        "base_price": price,
        "gst": round(gst, 2),
        "total_price": round(price + gst, 2)
    }



# ============ Session Top-Up (Bulk Purchase) ============

def get_topup_discount_from_tiers(session_count: int, discount_tiers: list) -> float:
    """Get discount percentage based on session count and configured tiers"""
    for tier in sorted(discount_tiers, key=lambda x: x.get("min_sessions", 0), reverse=True):
        if session_count >= tier.get("min_sessions", 0):
            return tier.get("discount", 0) / 100  # Convert percentage to decimal
    return 0  # No discount


# Default discount tiers (used when no custom tiers configured)
DEFAULT_DISCOUNT_TIERS = [
    {"min_sessions": 5, "discount": 5},
    {"min_sessions": 10, "discount": 10},
    {"min_sessions": 15, "discount": 15},
    {"min_sessions": 20, "discount": 20}
]


@router.get("/topup/pricing")
async def get_topup_pricing(request: Request, session_count: int = None):
    """Get pricing for session top-up with volume discounts"""
    db = get_db(request)
    
    # Get topup settings from database
    topup_settings = await db.app_settings.find_one({"key": "topup_settings"})
    
    if topup_settings and topup_settings.get("value"):
        base_price = topup_settings["value"].get("base_price", 2999)
        discount_tiers = topup_settings["value"].get("discount_tiers", DEFAULT_DISCOUNT_TIERS)
    else:
        base_price = 2999
        discount_tiers = DEFAULT_DISCOUNT_TIERS
    
    # If specific session count requested, return just that pricing
    if session_count and 1 <= session_count <= 30:
        discount = get_topup_discount_from_tiers(session_count, discount_tiers)
        subtotal = base_price * session_count
        discount_amount = subtotal * discount
        total_before_gst = subtotal - discount_amount
        gst = total_before_gst * 0.18
        total = total_before_gst + gst
        per_session = total / session_count
        
        return {
            "base_price": base_price,
            "sessions": session_count,
            "subtotal": round(subtotal, 2),
            "discount_percent": int(discount * 100),
            "discount_amount": round(discount_amount, 2),
            "total_before_gst": round(total_before_gst, 2),
            "gst": round(gst, 2),
            "total": round(total, 2),
            "effective_per_session": round(per_session, 2),
            "discount_tiers": discount_tiers
        }
    
    # Return base price and discount tiers for the slider UI
    return {
        "base_price": base_price,
        "min_sessions": 1,
        "max_sessions": 30,
        "discount_tiers": discount_tiers
    }


@router.post("/topup/create-order")
async def create_topup_order(order_data: CreateTopUpOrderRequest, request: Request):
    """Create a Razorpay order for session top-up"""
    if not razorpay_client:
        raise HTTPException(
            status_code=503, 
            detail="Payment service not configured. Please add Razorpay API keys."
        )
    
    user = await get_current_user(request)
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    
    # Validate session count (1-30)
    if not (1 <= order_data.session_count <= 30):
        raise HTTPException(status_code=400, detail="Session count must be between 1 and 30")
    
    # Get topup settings from database
    topup_settings = await db.app_settings.find_one({"key": "topup_settings"})
    
    if topup_settings and topup_settings.get("value"):
        base_price = topup_settings["value"].get("base_price", 2999)
        discount_tiers = topup_settings["value"].get("discount_tiers", DEFAULT_DISCOUNT_TIERS)
    else:
        base_price = 2999
        discount_tiers = DEFAULT_DISCOUNT_TIERS
    
    # Calculate pricing with volume discount
    session_count = order_data.session_count
    discount = get_topup_discount_from_tiers(session_count, discount_tiers)
    subtotal = base_price * session_count
    volume_discount_amount = subtotal * discount
    total_after_volume_discount = subtotal - volume_discount_amount
    
    # Apply coupon discount if provided
    coupon_discount_amount = 0
    coupon_discount_id = None
    coupon_code = None
    
    if order_data.coupon_discount_id:
        logger.info(f"Looking up coupon with id: {order_data.coupon_discount_id}")
        
        # First try with type filter, then without (some coupons may not have type field)
        coupon = await db.discounts.find_one({
            "id": order_data.coupon_discount_id,
            "is_active": True,
            "type": "coupon"
        })
        
        if not coupon:
            # Try without type filter
            coupon = await db.discounts.find_one({
                "id": order_data.coupon_discount_id,
                "is_active": True
            })
            if coupon:
                logger.info(f"Found coupon without type filter: {coupon.get('code')}, type={coupon.get('type')}")
        
        if coupon:
            logger.info(f"Found coupon: {coupon.get('code')}, discount_type={coupon.get('discount_type')}, coaching_discount_value={coupon.get('coaching_discount_value')}")
            # Validate the coupon
            now = datetime.now(timezone.utc)
            
            # Helper to parse date strings
            def parse_date(d):
                if d is None:
                    return None
                if isinstance(d, datetime):
                    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
                if isinstance(d, str):
                    try:
                        return datetime.fromisoformat(d.replace('Z', '+00:00'))
                    except ValueError:
                        return None
                return None
            
            # Check date validity
            start_date = parse_date(coupon.get("start_date"))
            end_date = parse_date(coupon.get("end_date"))
            
            if start_date and now < start_date:
                raise HTTPException(status_code=400, detail="Coupon is not yet active")
            if end_date and now > end_date:
                raise HTTPException(status_code=400, detail="Coupon has expired")
            
            # Check usage limits
            if coupon.get("max_total_uses"):
                total_uses = await db.discount_usage.count_documents({"discount_id": coupon["id"]})
                if total_uses >= coupon["max_total_uses"]:
                    raise HTTPException(status_code=400, detail="Coupon usage limit exceeded")
            
            if coupon.get("max_uses_per_user"):
                user_id = user_dict.get("id")
                user_uses = await db.discount_usage.count_documents({
                    "discount_id": coupon["id"],
                    "user_id": user_id
                })
                if user_uses >= coupon["max_uses_per_user"]:
                    raise HTTPException(status_code=400, detail="You have already used this coupon")
            
            # Calculate coupon discount based on coaching_discount_value
            discount_value = coupon.get("coaching_discount_value", coupon.get("subscription_discount_value", 0))
            discount_type = coupon.get("discount_type", "percentage")
            
            logger.info(f"Calculating coupon discount: discount_value={discount_value}, discount_type={discount_type}, total_after_volume_discount={total_after_volume_discount}")
            
            if discount_type == "percentage":
                coupon_discount_amount = total_after_volume_discount * (discount_value / 100)
            else:
                coupon_discount_amount = min(discount_value, total_after_volume_discount)
            
            logger.info(f"Coupon discount amount calculated: {coupon_discount_amount}")
            
            coupon_discount_id = coupon["id"]
            coupon_code = coupon.get("code")
    
    # Calculate final totals
    logger.info(f"Final calculation: total_after_volume_discount={total_after_volume_discount}, coupon_discount_amount={coupon_discount_amount}")
    total_before_gst = total_after_volume_discount - coupon_discount_amount
    gst = total_before_gst * 0.18
    total_amount = total_before_gst + gst
    logger.info(f"total_before_gst={total_before_gst}, gst={gst}, total_amount={total_amount}")
    
    # Amount in paise
    amount_in_paise = int(total_amount * 100)
    logger.info(f"Creating Razorpay order with amount_in_paise={amount_in_paise}")
    
    try:
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "user_id": user_dict.get("id", ""),
                "user_email": user_dict.get("email", ""),
                "type": "session_topup",
                "session_count": session_count,
                "base_price": base_price,
                "volume_discount_percent": int(discount * 100),
                "volume_discount_amount": volume_discount_amount,
                "coupon_discount_id": coupon_discount_id or "",
                "coupon_code": coupon_code or "",
                "coupon_discount_amount": coupon_discount_amount,
                "gst": gst,
                "total_amount": total_amount
            }
        })
        
        # Store order in database
        order_doc = {
            "id": str(uuid.uuid4()),
            "razorpay_order_id": razorpay_order["id"],
            "user_id": user_dict.get("id"),
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name"),
            "type": "session_topup",
            "session_count": session_count,
            "base_price": base_price,
            "subtotal": subtotal,
            "volume_discount_percent": int(discount * 100),
            "volume_discount_amount": volume_discount_amount,
            "coupon_discount_id": coupon_discount_id,
            "coupon_code": coupon_code,
            "coupon_discount_amount": coupon_discount_amount,
            "total_before_gst": total_before_gst,
            "gst": gst,
            "amount": total_amount,
            "amount_in_paise": amount_in_paise,
            "currency": "INR",
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_orders.insert_one(order_doc)
        
        # Track this top-up purchase attempt as an Abandoned Cart entry.
        # Removed automatically on successful /topup/verify.
        try:
            from services.google_sheets_service import append_abandoned_cart_to_sheet
            user_for_sheet = await db.users.find_one(
                {"id": user_dict.get("id")}, {"_id": 0}
            ) or {}
            await append_abandoned_cart_to_sheet(
                user_for_sheet,
                {
                    "plan_attempted_key": "session_topup",
                    "plan_attempted_name": f"{session_count} Session Top-up",
                    "plan_attempted_type": "Top-up",
                    "attempted_at": order_doc["created_at"],
                },
            )
        except Exception as cart_error:
            logger.warning(f"Abandoned cart tracking error (non-critical): {cart_error}")
        
        return {
            "success": True,
            "order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "session_count": session_count,
            "base_price": base_price,
            "subtotal": subtotal,
            "volume_discount_percent": int(discount * 100),
            "volume_discount_amount": round(volume_discount_amount, 2),
            "coupon_discount_amount": round(coupon_discount_amount, 2),
            "total_before_gst": round(total_before_gst, 2),
            "gst": round(gst, 2),
            "total_price": round(total_amount, 2),
            "user_email": user_dict.get("email"),
            "user_name": user_dict.get("name")
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Razorpay error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.post("/topup/verify")
async def verify_topup_payment(payment_data: VerifyTopUpPaymentRequest, request: Request):
    """Verify Razorpay payment for session top-up and add sessions to user account"""
    logger.info("=" * 50)
    logger.info("TOP-UP VERIFY ENDPOINT CALLED")
    logger.info(f"Input data: order_id={payment_data.razorpay_order_id}, payment_id={payment_data.razorpay_payment_id}, session_count={payment_data.session_count}")
    logger.info(f"Signature received (first 50 chars): {payment_data.razorpay_signature[:50] if payment_data.razorpay_signature else 'NONE'}")
    
    if not razorpay_client:
        logger.error("Razorpay client not configured")
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    try:
        user = await get_current_user(request)
    except Exception as e:
        logger.error(f"Failed to get current user: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed. Please log in again.")
    
    db = get_db(request)
    
    user_dict = user.dict() if hasattr(user, "dict") else user
    
    logger.info(f"Top-up verify request: order_id={payment_data.razorpay_order_id}, payment_id={payment_data.razorpay_payment_id}, user={user_dict.get('email')}")
    
    signature_valid = False
    payment_captured = False
    fallback_used = False
    
    # Step 1 (TOP-UP): Try signature verification
    try:
        message = f"{payment_data.razorpay_order_id}|{payment_data.razorpay_payment_id}"
        logger.info(f"HMAC message: {message}")
        
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        logger.info(f"Generated signature: {generated_signature}")
        logger.info(f"Received signature:  {payment_data.razorpay_signature}")
        logger.info(f"Signatures match: {generated_signature == payment_data.razorpay_signature}")
        
        if generated_signature == payment_data.razorpay_signature:
            signature_valid = True
            logger.info("Signature verification successful")
        else:
            logger.warning(f"Signature mismatch for order {payment_data.razorpay_order_id}")
    except Exception as e:
        logger.error(f"Signature verification error: {str(e)}")
    
    # Step 2: If signature failed, check Razorpay directly as fallback with retry
    if not signature_valid:
        logger.info("Signature verification failed, checking Razorpay payment status as fallback...")
        
        # Retry up to 3 times with delays to handle payment processing lag
        valid_statuses = ["captured", "authorized"]
        for attempt in range(3):
            try:
                # Fetch payment from Razorpay to verify it was captured
                payment = razorpay_client.payment.fetch(payment_data.razorpay_payment_id)
                payment_status = payment.get("status", "").lower()
                payment_order_id = payment.get("order_id")
                
                logger.info(f"Razorpay payment status (attempt {attempt+1}): status={payment_status}, order_id={payment_order_id}, expected_order={payment_data.razorpay_order_id}")
                
                # Verify the payment is captured/authorized and matches our order
                if payment_status in valid_statuses and payment_order_id == payment_data.razorpay_order_id:
                    payment_captured = True
                    fallback_used = True
                    logger.info(f"Fallback verification successful - payment status: {payment_status}")
                    break
                elif payment_status == "created" and attempt < 2:
                    # Payment still processing, wait and retry
                    logger.info(f"Payment still processing (status: {payment_status}), waiting 2 seconds before retry...")
                    import asyncio
                    await asyncio.sleep(2)
                    continue
                else:
                    logger.error(f"Fallback verification failed: status={payment_status} (valid: {valid_statuses}), order_match={payment_order_id == payment_data.razorpay_order_id}")
            except Exception as e:
                logger.error(f"Razorpay fallback check failed (attempt {attempt+1}): {str(e)}")
                import traceback
                logger.error(f"TOP-UP Fallback traceback: {traceback.format_exc()}")
                if attempt < 2:
                    import asyncio
                    await asyncio.sleep(2)
    
    # If neither signature nor fallback worked, reject
    if not signature_valid and not payment_captured:
        await db.payment_orders.update_one(
            {"razorpay_order_id": payment_data.razorpay_order_id},
            {"$set": {
                "status": "verification_failed",
                "verification_error": "Signature invalid and Razorpay fallback failed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=400, detail="Payment verification failed. Please contact support with your payment ID.")
    
    # Get the order
    order = await db.payment_orders.find_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"_id": 0}
    )
    
    if not order:
        logger.error(f"Order not found: {payment_data.razorpay_order_id}")
        raise HTTPException(status_code=404, detail="Order not found")
    
    logger.info(f"Found order: {order.get('id')}, session_count={order.get('session_count')}, status={order.get('status')}")
    
    # Check if this order was already processed
    if order.get("status") == "paid":
        logger.warning(f"Order {payment_data.razorpay_order_id} already marked as paid - checking if sessions were credited")
        
        # Check if a payment record exists for this order
        existing_payment = await db.payments.find_one(
            {"razorpay_order_id": payment_data.razorpay_order_id},
            {"_id": 0}
        )
        
        if existing_payment:
            # Payment was already processed, just return current session count
            db_user = await db.users.find_one({"id": user_dict.get("id")}, {"_id": 0, "coaching_sessions_remaining": 1})
            current_sessions = db_user.get("coaching_sessions_remaining", 0) if db_user else 0
            logger.info(f"Payment record exists, user has {current_sessions} sessions")
            return {
                "success": True,
                "message": "Payment already verified! Sessions were added to your account.",
                "sessions_added": existing_payment.get("session_count", order.get("session_count")),
                "new_total_sessions": current_sessions,
                "already_processed": True
            }
        else:
            # Order marked paid but no payment record - need to credit sessions
            logger.warning("Order marked paid but no payment record found - crediting sessions now")
            # Continue with normal processing to credit sessions
    
    now = datetime.now(timezone.utc)
    session_count = order.get("session_count") or payment_data.session_count
    
    # Update order status
    await db.payment_orders.update_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature,
            "paid_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "fallback_verification_used": fallback_used
        }}
    )
    
    # Check if payment record already exists (avoid duplicates)
    existing_payment = await db.payments.find_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"_id": 0}
    )
    
    if not existing_payment:
        # Create payment record
        payment_record = {
            "id": str(uuid.uuid4()),
            "order_id": payment_data.razorpay_order_id or f"order_topup_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
            "user_id": user_dict.get("id"),
            "user_email": user_dict.get("email"),
            "razorpay_order_id": payment_data.razorpay_order_id,
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "type": "session_topup",
            "session_count": session_count,
            "amount": order.get("amount"),
            "discount_percent": order.get("discount_percent", 0),
            "currency": "INR",
            "status": "captured",
            "fallback_verification_used": fallback_used,
            "created_at": now.isoformat()
        }
        await db.payments.insert_one(payment_record)
        logger.info(f"Created payment record for order {payment_data.razorpay_order_id}")
        
        # Record coupon usage if a coupon was applied
        if order.get("coupon_discount_id"):
            usage_record = {
                "id": str(uuid.uuid4()),
                "discount_id": order["coupon_discount_id"],
                "user_id": user_dict.get("id"),
                "order_type": "coaching_topup",
                "original_amount": order.get("subtotal", 0) - order.get("volume_discount_amount", 0),
                "discount_applied": order.get("coupon_discount_amount", 0),
                "final_amount": order.get("amount", 0),
                "used_at": now
            }
            await db.discount_usage.insert_one(usage_record)
            logger.info(f"Recorded coupon usage for discount {order['coupon_discount_id']}")
    else:
        logger.info(f"Payment record already exists for order {payment_data.razorpay_order_id}, skipping creation")
    
    # Get fresh user data to check current sessions
    db_user = await db.users.find_one({"id": user_dict.get("id")}, {"_id": 0, "coaching_sessions_remaining": 1})
    current_sessions = db_user.get("coaching_sessions_remaining", 0) if db_user else 0
    
    # Handle None
    if current_sessions is None:
        current_sessions = 0
    
    # Check if sessions were already added for this order by looking at payment record
    if existing_payment and existing_payment.get("sessions_credited"):
        logger.info(f"Sessions already credited for this order, returning current count: {current_sessions}")
        return {
            "success": True,
            "message": f"Sessions already added. You have {current_sessions} sessions.",
            "sessions_added": session_count,
            "new_total_sessions": current_sessions,
            "already_processed": True
        }
    
    # Add sessions to user using atomic $inc to avoid race conditions
    # If user has unlimited sessions (-1), still add to the purchased pool
    # but don't break their unlimited status
    if current_sessions == -1:
        # Unlimited user - track purchased sessions separately but keep unlimited status
        # Use a separate field for this edge case
        logger.info(f"User has unlimited sessions, adding {session_count} as bonus but keeping -1 status")
        await db.users.update_one(
            {"id": user_dict.get("id")},
            {
                "$inc": {"coaching_sessions_purchased_extra": session_count},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        new_total = -1  # Keep unlimited
    else:
        # Normal case: add sessions atomically
        await db.users.update_one(
            {"id": user_dict.get("id")},
            {
                "$inc": {"coaching_sessions_remaining": session_count},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        # Fetch updated value
        updated_user = await db.users.find_one({"id": user_dict.get("id")}, {"_id": 0, "coaching_sessions_remaining": 1})
        new_total = (updated_user or {}).get("coaching_sessions_remaining", current_sessions + session_count)
    
    logger.info(f"Added {session_count} sessions to user {user_dict.get('email')}: result = {new_total} (fallback={fallback_used})")
    
    # Mark that sessions were credited in the payment record
    await db.payments.update_one(
        {"razorpay_order_id": payment_data.razorpay_order_id},
        {"$set": {"sessions_credited": True, "sessions_credited_at": now.isoformat()}}
    )
    
    logger.info(f"Top-up successful for user {user_dict.get('email')}: {session_count} sessions added")
    
    # Top-up payment succeeded — clear matching Top-up row from sheet.
    try:
        from services.google_sheets_service import remove_abandoned_cart_from_sheet
        if user_dict.get("email"):
            await remove_abandoned_cart_from_sheet(user_dict.get("email"), "Top-up")
    except Exception as cart_error:
        logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
    
    response_data = {
        "success": True,
        "message": f"Payment verified! {session_count} coaching session{'s' if session_count > 1 else ''} added to your account.",
        "sessions_added": session_count,
        "new_total_sessions": new_total
    }
    logger.info(f"Returning response: {response_data}")
    return response_data


@router.post("/admin/manual-topup-credit")
async def admin_manual_topup_credit(request: Request):
    """
    Admin endpoint to manually credit sessions for a top-up order that failed verification
    but was captured in Razorpay.
    """
    from routes.admin import verify_admin
    await verify_admin(request)
    
    db = get_db(request)
    body = await request.json()
    order_id = body.get("razorpay_order_id")
    
    if not order_id:
        return {"error": "razorpay_order_id required"}
    
    # Find the order
    order = await db.payment_orders.find_one({"razorpay_order_id": order_id}, {"_id": 0})
    if not order:
        return {"error": "Order not found"}
    
    if order.get("type") != "session_topup":
        return {"error": f"Order is not a session top-up, type: {order.get('type')}"}
    
    # Check if already processed
    if order.get("status") == "paid":
        return {"error": "Order already processed", "order": order}
    
    user_id = order.get("user_id")
    session_count = order.get("session_count")
    
    if not user_id or not session_count:
        return {"error": "Order missing user_id or session_count"}
    
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"error": "User not found"}
    
    # Update order status
    now = datetime.now(timezone.utc)
    await db.payment_orders.update_one(
        {"razorpay_order_id": order_id},
        {"$set": {
            "status": "paid",
            "manual_credit": True,
            "manual_credit_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Create payment record
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": order_id or f"order_manual_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
        "user_id": user_id,
        "user_email": user.get("email"),
        "razorpay_order_id": order_id,
        "razorpay_payment_id": order.get("razorpay_payment_id", "MANUAL"),
        "type": "session_topup",
        "session_count": session_count,
        "amount": order.get("amount"),
        "currency": "INR",
        "status": "captured",
        "manual_credit": True,
        "created_at": now.isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Add sessions to user
    current_sessions = user.get("coaching_sessions_remaining", 0) or 0
    new_total = current_sessions + session_count
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "coaching_sessions_remaining": new_total,
            "updated_at": now.isoformat()
        }}
    )
    
    logger.info(f"Manual top-up credit: user={user.get('email')}, sessions={session_count}, new_total={new_total}")
    
    return {
        "success": True,
        "message": f"Manually credited {session_count} sessions to {user.get('email')}",
        "user_email": user.get("email"),
        "sessions_added": session_count,
        "new_total": new_total,
        "order_id": order_id
    }
