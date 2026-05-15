"""
One-time migration: Backfill subscription payments from webhook_logs.
Reads historical subscription.activated and subscription.charged webhook events
and creates payment records in the payments collection.

Run via: POST /api/admin/migrations/backfill-subscription-payments
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/migrations", tags=["migrations"])


async def verify_admin(request: Request):
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/webhook-diagnostics")
async def webhook_diagnostics(request: Request):
    """Diagnose webhook logs to understand their structure"""
    await verify_admin(request)
    db = request.app.state.db
    
    # Get total count
    total_logs = await db.webhook_logs.count_documents({})
    
    # Get all unique event types
    all_events = await db.webhook_logs.find({}, {"_id": 0}).limit(100).to_list(100)
    
    # Analyze event field names and values
    event_field_analysis = {}
    for e in all_events:
        # Check various possible event field names
        for field in ["event", "event_type", "type", "eventType"]:
            if field in e:
                val = e[field]
                if field not in event_field_analysis:
                    event_field_analysis[field] = set()
                event_field_analysis[field].add(str(val))
    
    # Convert sets to lists for JSON
    event_field_analysis = {k: list(v) for k, v in event_field_analysis.items()}
    
    # Get sample webhooks
    sample_activated = await db.webhook_logs.find_one({"event": "subscription.activated"})
    sample_charged = await db.webhook_logs.find_one({"event": "subscription.charged"})
    
    # Also try with event_type field
    sample_activated_alt = await db.webhook_logs.find_one({"event_type": "subscription.activated"})
    sample_charged_alt = await db.webhook_logs.find_one({"event_type": "subscription.charged"})
    
    # Get a random sample to inspect structure
    sample_any = all_events[0] if all_events else None
    if sample_any and "_id" in sample_any:
        del sample_any["_id"]
    
    return {
        "total_webhook_logs": total_logs,
        "event_field_analysis": event_field_analysis,
        "samples": {
            "subscription_activated_found": sample_activated is not None,
            "subscription_charged_found": sample_charged is not None,
            "subscription_activated_alt_found": sample_activated_alt is not None,
            "subscription_charged_alt_found": sample_charged_alt is not None,
        },
        "sample_webhook_structure": sample_any
    }


@router.post("/backfill-subscription-payments")
async def backfill_subscription_payments(request: Request):
    """Backfill subscription payments from webhook_logs into the payments collection."""
    await verify_admin(request)
    db = request.app.state.db

    # Try multiple event field names and event values
    event_queries = [
        {"event": {"$in": ["subscription.activated", "subscription.charged"]}},
        {"event_type": {"$in": ["subscription.activated", "subscription.charged"]}},
        {"event": {"$regex": "subscription\\.(activated|charged)", "$options": "i"}},
        {"event_type": {"$regex": "subscription\\.(activated|charged)", "$options": "i"}},
    ]
    
    webhook_events = []
    query_used = None
    
    for query in event_queries:
        events = await db.webhook_logs.find(query, {"_id": 0}).sort("received_at", 1).to_list(10000)
        if events:
            webhook_events = events
            query_used = str(query)
            break
    
    # Count total webhooks for stats
    total_webhooks = await db.webhook_logs.count_documents({})
    
    stats = {
        "total_webhooks_in_db": total_webhooks,
        "matching_subscription_webhooks": len(webhook_events),
        "query_used": query_used,
        "created": 0,
        "skipped_duplicate": 0,
        "skipped_no_user": 0,
        "skipped_no_amount": 0,
        "errors": 0
    }

    if not webhook_events:
        # Debug: check what events exist in webhook_logs
        all_events = await db.webhook_logs.find({}, {"_id": 0}).limit(50).to_list(50)
        event_types = []
        for e in all_events:
            evt = e.get("event") or e.get("event_type") or "unknown"
            if evt not in event_types:
                event_types.append(evt)
        
        return {
            "success": False,
            "stats": stats,
            "debug": {
                "event_types_found": event_types[:20],
                "sample_log_keys": list(all_events[0].keys()) if all_events else [],
                "hint": "No subscription.activated or subscription.charged events found. Check event_types_found for actual event names."
            }
        }


    for wh in webhook_events:
        try:
            event = wh.get("event") or wh.get("event_type")
            payload = wh.get("payload", {})
            received_at = wh.get("received_at")

            # Extract subscription entity from various possible payload structures
            sub_entity = None
            
            # Structure 1: payload.payload.subscription.entity (Razorpay standard)
            if payload.get("payload", {}).get("subscription", {}).get("entity"):
                sub_entity = payload["payload"]["subscription"]["entity"]
            # Structure 2: payload.subscription.entity
            elif payload.get("subscription", {}).get("entity"):
                sub_entity = payload["subscription"]["entity"]
            # Structure 3: payload.subscription (direct)
            elif payload.get("subscription") and isinstance(payload.get("subscription"), dict):
                sub_entity = payload["subscription"]
            # Structure 4: Direct entity in payload
            elif payload.get("entity"):
                sub_entity = payload["entity"]
            # Structure 5: The payload itself might be the entity
            elif payload.get("id") and payload.get("notes"):
                sub_entity = payload
            
            if not sub_entity:
                stats["errors"] += 1
                continue
            
            notes = sub_entity.get("notes", {})
            
            # Extract user_id from multiple possible locations
            user_id = (
                wh.get("user_id") or  # Direct on webhook
                notes.get("user_id") or  # In subscription notes
                sub_entity.get("customer_id") or  # Razorpay customer ID
                notes.get("customer_id")
            )
            
            subscription_id = wh.get("subscription_id") or sub_entity.get("id")
            payment_id = sub_entity.get("payment_id") or sub_entity.get("id")

            if not user_id:
                stats["skipped_no_user"] += 1
                continue

            # Check if payment already exists (avoid duplicates)
            existing = await db.payments.find_one({
                "type": "subscription",
                "razorpay_subscription_id": subscription_id or sub_entity.get("id"),
                "created_at": received_at
            })
            if existing:
                stats["skipped_duplicate"] += 1
                continue

            # Also check by a broader match
            existing2 = await db.payments.find_one({
                "type": "subscription",
                "user_id": user_id,
                "razorpay_subscription_id": subscription_id or sub_entity.get("id"),
                "payment_type": "first_payment" if event == "subscription.activated" else "recurring"
            })
            if existing2:
                stats["skipped_duplicate"] += 1
                continue

            # Get user info
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1, "plan": 1, "subscription": 1})
            if not user:
                stats["skipped_no_user"] += 1
                continue

            # Determine amounts from multiple possible sources
            total_amount = 0
            base_amount = 0
            gst_amount = 0

            # Source 1: Notes in subscription
            if notes.get("total_amount"):
                total_amount = float(notes.get("total_amount", 0))
                base_amount = float(notes.get("base_amount", 0))
                gst_amount = float(notes.get("gst_amount", 0))
            elif notes.get("locked_price"):
                total_amount = float(notes.get("locked_price", 0))
                base_amount = round(total_amount / 1.18, 2)
                gst_amount = total_amount - base_amount
            # Source 2: Subscription entity fields (Razorpay)
            elif sub_entity.get("current_start_amount"):
                # Razorpay stores amount in paise
                total_amount = sub_entity.get("current_start_amount", 0) / 100
                base_amount = round(total_amount / 1.18, 2)
                gst_amount = total_amount - base_amount
            elif sub_entity.get("charge_at"):
                # Check if there's an amount in the subscription
                total_amount = sub_entity.get("amount", 0) / 100 if sub_entity.get("amount") else 0
                base_amount = round(total_amount / 1.18, 2) if total_amount else 0
                gst_amount = total_amount - base_amount if total_amount else 0
            # Source 3: User's subscription data (fallback)
            else:
                subscription = user.get("subscription", {})
                total_amount = subscription.get("locked_price", 0) or subscription.get("amount", 0) or 0
                if total_amount:
                    base_amount = round(total_amount / 1.18, 2)
                    gst_amount = total_amount - base_amount

            plan_key = notes.get("plan_key") or user.get("plan") or user.get("subscription", {}).get("plan_key", "") or sub_entity.get("plan_id", "")
            billing_cycle = notes.get("billing_cycle") or user.get("subscription", {}).get("billing_cycle", "monthly")
            plan_name = notes.get("plan_name") or plan_key

            payment_record = {
                "id": f"sub-pay-backfill-{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "user_email": user.get("email"),
                "user_name": user.get("name"),
                "razorpay_subscription_id": subscription_id or sub_entity.get("id"),
                "razorpay_payment_id": payment_id,
                "type": "subscription",
                "payment_type": "first_payment" if event == "subscription.activated" else "recurring",
                "plan_key": plan_key,
                "plan_name": plan_name,
                "billing_cycle": billing_cycle,
                "amount": total_amount,
                "base_amount": base_amount,
                "gst_amount": gst_amount,
                "currency": "INR",
                "status": "captured",
                "created_at": received_at or datetime.now(timezone.utc).isoformat(),
                "captured_at": received_at or datetime.now(timezone.utc).isoformat(),
                "backfilled": True,
                "source_webhook_event": event
            }

            await db.payments.insert_one(payment_record)
            stats["created"] += 1

        except Exception as e:
            logger.error(f"Error backfilling webhook: {e}")
            stats["errors"] += 1

    return {"success": True, "stats": stats}



@router.post("/backfill-booking-phones")
async def backfill_booking_phones(request: Request):
    """Backfill missing phone numbers in bookings from user/mentor records"""
    await verify_admin(request)
    db = request.app.state.db
    
    stats = {
        "total_bookings": 0,
        "candidate_phones_added": 0,
        "mentor_phones_added": 0,
        "candidate_phones_missing": 0,
        "mentor_phones_missing": 0,
        "errors": 0
    }
    
    # Get all bookings with missing phone numbers
    bookings = await db.bookings.find({
        "$or": [
            {"candidate_phone": {"$exists": False}},
            {"candidate_phone": None},
            {"candidate_phone": ""},
            {"mentor_phone": {"$exists": False}},
            {"mentor_phone": None},
            {"mentor_phone": ""}
        ]
    }).to_list(10000)
    
    stats["total_bookings"] = len(bookings)
    
    for booking in bookings:
        try:
            update_fields = {}
            
            # Check candidate phone
            if not booking.get("candidate_phone"):
                user = await db.users.find_one({"id": booking.get("user_id")})
                if user:
                    phone = user.get("phone_number") or user.get("phone")
                    if phone:
                        update_fields["candidate_phone"] = phone
                        update_fields["candidate_country_code"] = user.get("phone_country_code", "+91")
                        update_fields["candidate_name"] = user.get("name", booking.get("candidate_name"))
                        stats["candidate_phones_added"] += 1
                    else:
                        stats["candidate_phones_missing"] += 1
                else:
                    stats["candidate_phones_missing"] += 1
            
            # Check mentor phone
            if not booking.get("mentor_phone"):
                mentor = await db.mentors.find_one({"id": booking.get("mentor_id")})
                if mentor:
                    phone = mentor.get("phone_number") or mentor.get("phone")
                    if phone:
                        update_fields["mentor_phone"] = phone
                        update_fields["mentor_country_code"] = mentor.get("phone_country_code", "+91")
                        update_fields["mentor_name"] = mentor.get("name", booking.get("mentor_name"))
                        stats["mentor_phones_added"] += 1
                    else:
                        stats["mentor_phones_missing"] += 1
                else:
                    stats["mentor_phones_missing"] += 1
            
            # Update booking if we found any phone numbers
            if update_fields:
                await db.bookings.update_one(
                    {"id": booking.get("id")},
                    {"$set": update_fields}
                )
                
        except Exception as e:
            logger.error(f"Error backfilling booking {booking.get('id')}: {e}")
            stats["errors"] += 1
    
    return {"success": True, "stats": stats}


@router.get("/phone-stats")
async def get_phone_stats(request: Request):
    """Get statistics about phone numbers in users, mentors, and bookings"""
    await verify_admin(request)
    db = request.app.state.db
    
    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "with_phone": await db.users.count_documents({
                "$or": [
                    {"phone_number": {"$exists": True, "$ne": None, "$ne": ""}},
                    {"phone": {"$exists": True, "$ne": None, "$ne": ""}}
                ]
            }),
            "without_phone": 0
        },
        "mentors": {
            "total": await db.mentors.count_documents({}),
            "with_phone": await db.mentors.count_documents({
                "$or": [
                    {"phone_number": {"$exists": True, "$ne": None, "$ne": ""}},
                    {"phone": {"$exists": True, "$ne": None, "$ne": ""}}
                ]
            }),
            "without_phone": 0
        },
        "bookings": {
            "total": await db.bookings.count_documents({}),
            "active": await db.bookings.count_documents({"status": {"$in": ["confirmed", "pending"]}}),
            "with_candidate_phone": await db.bookings.count_documents({
                "candidate_phone": {"$exists": True, "$ne": None, "$ne": ""}
            }),
            "with_mentor_phone": await db.bookings.count_documents({
                "mentor_phone": {"$exists": True, "$ne": None, "$ne": ""}
            }),
            "missing_candidate_phone": 0,
            "missing_mentor_phone": 0
        },
        "sample_users_without_phone": [],
        "sample_mentors_without_phone": []
    }
    
    stats["users"]["without_phone"] = stats["users"]["total"] - stats["users"]["with_phone"]
    stats["mentors"]["without_phone"] = stats["mentors"]["total"] - stats["mentors"]["with_phone"]
    stats["bookings"]["missing_candidate_phone"] = stats["bookings"]["total"] - stats["bookings"]["with_candidate_phone"]
    stats["bookings"]["missing_mentor_phone"] = stats["bookings"]["total"] - stats["bookings"]["with_mentor_phone"]
    
    # Get sample users without phone
    users_without_phone = await db.users.find({
        "$and": [
            {"$or": [{"phone_number": {"$exists": False}}, {"phone_number": None}, {"phone_number": ""}]},
            {"$or": [{"phone": {"$exists": False}}, {"phone": None}, {"phone": ""}]}
        ]
    }, {"id": 1, "email": 1, "name": 1}).limit(5).to_list(5)
    stats["sample_users_without_phone"] = [
        {"id": u.get("id"), "email": u.get("email"), "name": u.get("name")}
        for u in users_without_phone
    ]
    
    # Get sample mentors without phone
    mentors_without_phone = await db.mentors.find({
        "$and": [
            {"$or": [{"phone_number": {"$exists": False}}, {"phone_number": None}, {"phone_number": ""}]},
            {"$or": [{"phone": {"$exists": False}}, {"phone": None}, {"phone": ""}]}
        ]
    }, {"id": 1, "email": 1, "name": 1}).limit(5).to_list(5)
    stats["sample_mentors_without_phone"] = [
        {"id": m.get("id"), "email": m.get("email"), "name": m.get("name")}
        for m in mentors_without_phone
    ]
    
    return stats
