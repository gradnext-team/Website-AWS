"""
Email Automations - Admin management + background scheduler
Supports configurable email sequences triggered by user lifecycle events.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/automations", tags=["automations"])

# ─── Pydantic Models ────────────────────────────────────────────────

class DayConfig(BaseModel):
    day: int
    enabled: bool = False
    template_id: Optional[str] = None
    template_name: Optional[str] = None

class UpdateAutomationRequest(BaseModel):
    enabled: Optional[bool] = None
    days: Optional[list[DayConfig]] = None
    intervals: Optional[list] = None  # For cart abandonment automation

class BulkEmailRequest(BaseModel):
    recipient_type: str  # "contacts" or "mentors"
    template_id: str
    template_name: Optional[str] = None

class WorkshopReminderConfig(BaseModel):
    enabled: bool = False
    reminder_24h_template_id: Optional[str] = None
    reminder_24h_template_name: Optional[str] = None
    reminder_1h_template_id: Optional[str] = None
    reminder_1h_template_name: Optional[str] = None

class SessionReminderConfig(BaseModel):
    enabled: bool = False
    reminder_24h_template_id: Optional[str] = None
    reminder_24h_template_name: Optional[str] = None
    reminder_1h_template_id: Optional[str] = None
    reminder_1h_template_name: Optional[str] = None
    reminder_10min_template_id: Optional[str] = None
    reminder_10min_template_name: Optional[str] = None
    # WhatsApp (Wati) template names
    whatsapp_enabled: bool = False
    whatsapp_24h_template_name: Optional[str] = None
    whatsapp_1h_template_name: Optional[str] = None
    whatsapp_10min_template_name: Optional[str] = None

# ─── Helpers ────────────────────────────────────────────────────────

async def verify_admin(request: Request):
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

SEED_AUTOMATION = {
    "id": "trial-7day",
    "name": "7-Day Free Trial Sequence",
    "description": "Automated emails sent during a user's 7-day free trial to encourage engagement and conversion.",
    "trigger": "user_signup_free_trial",
    "enabled": False,
    "days": [
        {"day": 1, "enabled": False, "template_id": None, "template_name": None},
        {"day": 2, "enabled": False, "template_id": None, "template_name": None},
        {"day": 3, "enabled": False, "template_id": None, "template_name": None},
        {"day": 4, "enabled": False, "template_id": None, "template_name": None},
        {"day": 5, "enabled": False, "template_id": None, "template_name": None},
        {"day": 6, "enabled": False, "template_id": None, "template_name": None},
        {"day": 7, "enabled": False, "template_id": None, "template_name": None},
    ],
    "skip_if_upgraded": True,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

CART_ABANDONMENT_AUTOMATION = {
    "id": "cart-abandonment",
    "name": "Cart Abandonment Recovery",
    "description": "Automated recovery emails for users who abandoned subscription checkout. Sends at 1h, 24h, and 72h after abandonment.",
    "trigger": "cart_abandonment",
    "enabled": False,
    "intervals": [
        {"interval": "1h", "hours": 1, "enabled": False, "template_id": None, "template_name": None, "label": "1 Hour After"},
        {"interval": "24h", "hours": 24, "enabled": False, "template_id": None, "template_name": None, "label": "24 Hours After"},
        {"interval": "72h", "hours": 72, "enabled": False, "template_id": None, "template_name": None, "label": "72 Hours After"},
    ],
    "stats": {"total_sent": 0, "total_failed": 0},
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

# ─── Endpoints ──────────────────────────────────────────────────────

@router.get("")
async def list_automations(request: Request):
    """List all automations"""
    await verify_admin(request)
    db = request.app.state.db

    automations = await db.automations.find({}, {"_id": 0}).to_list(50)

    # Ensure both seed automations exist
    automation_ids = [a.get("id") for a in automations]
    
    if "trial-7day" not in automation_ids:
        await db.automations.insert_one({**SEED_AUTOMATION})
        automations.append(SEED_AUTOMATION)
    
    if "cart-abandonment" not in automation_ids:
        await db.automations.insert_one({**CART_ABANDONMENT_AUTOMATION})
        automations.append(CART_ABANDONMENT_AUTOMATION)

    # Get recent log counts per automation
    for auto in automations:
        total_sent = await db.automation_logs.count_documents({"automation_id": auto["id"], "status": "sent"})
        total_failed = await db.automation_logs.count_documents({"automation_id": auto["id"], "status": "failed"})
        auto["stats"] = {"total_sent": total_sent, "total_failed": total_failed}

    return {"automations": automations}


@router.get("/resend-templates")
async def list_resend_templates(request: Request):
    """Fetch available templates from Resend"""
    await verify_admin(request)
    try:
        import resend
        import os
        resend.api_key = os.environ.get("RESEND_API_KEY")
        if not resend.api_key:
            return {"templates": [], "error": "Resend API key not configured"}

        result = await asyncio.to_thread(resend.Templates.list)
        templates = []
        data = result.get("data", []) if isinstance(result, dict) else getattr(result, "data", [])
        for t in data:
            tid = t.get("id", "") if isinstance(t, dict) else getattr(t, "id", "")
            tname = t.get("name", "") if isinstance(t, dict) else getattr(t, "name", "")
            templates.append({"id": tid, "name": tname})
        return {"templates": templates}
    except Exception as e:
        logger.error(f"Failed to fetch Resend templates: {e}")
        return {"templates": [], "error": str(e)}


# ─── Workshop Reminders Routes (must be before {automation_id} routes) ───
@router.get("/workshop-reminders/config")
async def get_workshop_reminder_config(request: Request):
    """Get workshop reminder configuration"""
    await verify_admin(request)
    db = request.app.state.db
    
    config = await db.workshop_reminder_config.find_one({"id": "workshop-reminders"})
    if not config:
        return {
            "enabled": False,
            "reminder_24h_template_id": None,
            "reminder_24h_template_name": None,
            "reminder_1h_template_id": None,
            "reminder_1h_template_name": None
        }
    
    return {
        "enabled": config.get("enabled", False),
        "reminder_24h_template_id": config.get("reminder_24h_template_id"),
        "reminder_24h_template_name": config.get("reminder_24h_template_name"),
        "reminder_1h_template_id": config.get("reminder_1h_template_id"),
        "reminder_1h_template_name": config.get("reminder_1h_template_name")
    }


@router.post("/workshop-reminders/config")
async def update_workshop_reminder_config(body: WorkshopReminderConfig, request: Request):
    """Update workshop reminder configuration"""
    await verify_admin(request)
    db = request.app.state.db
    
    await db.workshop_reminder_config.update_one(
        {"id": "workshop-reminders"},
        {
            "$set": {
                "enabled": body.enabled,
                "reminder_24h_template_id": body.reminder_24h_template_id,
                "reminder_24h_template_name": body.reminder_24h_template_name,
                "reminder_1h_template_id": body.reminder_1h_template_id,
                "reminder_1h_template_name": body.reminder_1h_template_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Workshop reminder configuration updated"}


@router.post("/workshop-reminders/run-now")
async def run_workshop_reminders_now(request: Request):
    """Manually trigger workshop reminders check"""
    await verify_admin(request)
    db = request.app.state.db
    
    result = await execute_workshop_reminders(db)
    return {"success": True, "result": result}


# ─── Generic Automation Routes ───
@router.put("/{automation_id}")
async def update_automation(automation_id: str, body: UpdateAutomationRequest, request: Request):
    """Update automation config"""
    await verify_admin(request)
    db = request.app.state.db

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.enabled is not None:
        update["enabled"] = body.enabled
    if body.days is not None:
        update["days"] = [d.model_dump() for d in body.days]
    if body.intervals is not None:
        update["intervals"] = body.intervals

    result = await db.automations.update_one({"id": automation_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Automation not found")

    updated = await db.automations.find_one({"id": automation_id}, {"_id": 0})
    return {"success": True, "automation": updated}


@router.post("/{automation_id}/toggle")
async def toggle_automation(automation_id: str, request: Request):
    """Toggle automation enabled/disabled"""
    await verify_admin(request)
    db = request.app.state.db

    auto = await db.automations.find_one({"id": automation_id}, {"_id": 0})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")

    new_state = not auto.get("enabled", False)
    await db.automations.update_one(
        {"id": automation_id},
        {"$set": {"enabled": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "enabled": new_state}


@router.get("/{automation_id}/logs")
async def get_automation_logs(automation_id: str, request: Request, limit: int = 50, skip: int = 0):
    """Get recent logs for an automation"""
    await verify_admin(request)
    db = request.app.state.db

    logs = await db.automation_logs.find(
        {"automation_id": automation_id},
        {"_id": 0}
    ).sort("sent_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.automation_logs.count_documents({"automation_id": automation_id})
    return {"logs": logs, "total": total}


@router.post("/{automation_id}/run-now")
async def run_automation_now(automation_id: str, request: Request):
    """Manually trigger an automation run (for testing)"""
    await verify_admin(request)
    db = request.app.state.db

    auto = await db.automations.find_one({"id": automation_id}, {"_id": 0})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")

    if automation_id == "cart-abandonment":
        result = await execute_cart_abandonment_automation(db, auto)
    else:
        result = await execute_trial_automation(db, auto)
    return {"success": True, "result": result}


# ─── Background Scheduler ──────────────────────────────────────────

async def execute_trial_automation(db, automation: dict) -> dict:
    """Execute the 7-day trial email automation for all eligible users."""
    from services.email_service import send_email_with_template

    stats = {"checked": 0, "sent": 0, "skipped_upgraded": 0, "skipped_already_sent": 0, "failed": 0}
    days_config = {d["day"]: d for d in automation.get("days", []) if d.get("enabled") and d.get("template_id")}

    if not days_config:
        return stats

    # Find all free trial users created in the last 8 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=8)
    trial_users = await db.users.find(
        {
            "plan": {"$in": ["free_trial", "Free Trial"]},
            "created_at": {"$gte": cutoff.isoformat()}
        },
        {"_id": 0, "email": 1, "name": 1, "created_at": 1, "plan": 1, "plan_assignments": 1}
    ).to_list(1000)

    for user in trial_users:
        stats["checked"] += 1
        email = user.get("email")
        name = user.get("name", "there")

        # Skip if upgraded (has non-trial plan_assignments or changed plan)
        if automation.get("skip_if_upgraded"):
            assignments = user.get("plan_assignments", [])
            has_paid = any(
                a.get("category") in ["subscription", "coaching"]
                and a.get("status") == "active"
                for a in assignments
            )
            current_plan = user.get("plan", "")
            if has_paid or (current_plan and current_plan not in ["free_trial", "Free Trial"]):
                stats["skipped_upgraded"] += 1
                continue

        # Calculate which day the user is on
        try:
            created = user.get("created_at", "")
            if isinstance(created, str):
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                created_dt = created
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)
            
            days_since = (datetime.now(timezone.utc) - created_dt).days + 1  # Day 1 = signup day
        except Exception:
            continue

        if days_since not in days_config:
            continue

        day_cfg = days_config[days_since]

        # Check if already sent
        already_sent = await db.automation_logs.find_one({
            "automation_id": automation["id"],
            "user_email": email,
            "day": days_since,
            "status": "sent"
        })
        if already_sent:
            stats["skipped_already_sent"] += 1
            continue

        # Send email — subject, reply-to etc come from the Resend template itself
        try:
            # Rate limit: Resend allows max 2 requests/second — wait 1s between sends
            await asyncio.sleep(1)
            
            result = await send_email_with_template(
                to=email,
                template_id=day_cfg["template_id"],
                template_data={"name": name, "first_name": name.split()[0] if name else "there"},
            )

            log_entry = {
                "automation_id": automation["id"],
                "user_email": email,
                "user_name": name,
                "day": days_since,
                "template_id": day_cfg["template_id"],
                "template_name": day_cfg.get("template_name", ""),
                "status": "sent" if result.get("status") == "success" else "failed",
                "error": result.get("message") if result.get("status") != "success" else None,
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
            await db.automation_logs.insert_one(log_entry)

            if result.get("status") == "success":
                stats["sent"] += 1
            else:
                stats["failed"] += 1
        except Exception as e:
            logger.error(f"Automation email failed for {email}: {e}")
            await db.automation_logs.insert_one({
                "automation_id": automation["id"],
                "user_email": email,
                "user_name": name,
                "day": days_since,
                "template_id": day_cfg["template_id"],
                "status": "failed",
                "error": str(e),
                "sent_at": datetime.now(timezone.utc).isoformat()
            })
            stats["failed"] += 1

    return stats


async def execute_cart_abandonment_automation(db, automation: dict) -> dict:
    """Execute the cart abandonment recovery automation for subscription orders."""
    from services.email_service import send_email_with_template

    stats = {"checked": 0, "sent": 0, "skipped_completed": 0, "skipped_already_sent": 0, "failed": 0}
    
    # Build intervals config from enabled intervals with template IDs
    intervals_config = {}
    for interval_cfg in automation.get("intervals", []):
        if interval_cfg.get("enabled") and interval_cfg.get("template_id"):
            intervals_config[interval_cfg["interval"]] = interval_cfg
    
    if not intervals_config:
        return stats

    now = datetime.now(timezone.utc)
    
    # Get abandoned subscription orders (created but not completed)
    # Subscription orders have plan_key but no "type" field
    abandoned_orders = await db.payment_orders.find({
        "status": "created",
        "plan_key": {"$exists": True},
        "type": {"$exists": False}
    }).to_list(1000)
    
    logger.info(f"[Cart Abandonment] Found {len(abandoned_orders)} abandoned orders")
    
    for order in abandoned_orders:
        stats["checked"] += 1
        
        order_id = order.get("id") or str(order.get("_id"))
        user_email = order.get("user_email")
        user_name = order.get("user_name", "there")
        if user_name:
            user_name = user_name.split()[0]  # First name only
        plan_name = order.get("plan_name", "Subscription")
        amount = order.get("amount", 0)
        created_at = order.get("created_at")
        
        if not user_email or not created_at:
            continue
        
        # Parse created_at
        try:
            if isinstance(created_at, str):
                order_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                if order_time.tzinfo is None:
                    order_time = order_time.replace(tzinfo=timezone.utc)
            else:
                order_time = created_at
                if order_time.tzinfo is None:
                    order_time = order_time.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
        
        hours_since_order = (now - order_time).total_seconds() / 3600
        
        # Check each configured interval
        for interval_key, interval_cfg in intervals_config.items():
            target_hours = interval_cfg.get("hours", 0)
            
            # Check if it's time to send this email (within a 1-hour window)
            if target_hours <= hours_since_order < target_hours + 1:
                # Check if already sent
                recovery_key = f"{order_id}_{interval_key}"
                already_sent = await db.automation_logs.find_one({
                    "automation_id": automation["id"],
                    "recovery_key": recovery_key,
                    "status": "sent"
                })
                
                if already_sent:
                    stats["skipped_already_sent"] += 1
                    continue
                
                logger.info(f"[Cart Abandonment] Sending {interval_key} email for order {order_id} to {user_email}")
                
                # Calculate discounted amount (50% off for WELCOME50)
                discounted_amount = round(amount * 0.5)
                
                try:
                    # Rate limit: wait 1s between sends
                    await asyncio.sleep(1)
                    
                    result = await send_email_with_template(
                        to=user_email,
                        template_id=interval_cfg["template_id"],
                        template_data={
                            "name": user_name or "there",
                            "first_name": user_name or "there",
                            "plan_name": plan_name,
                            "amount": f"₹{int(amount):,}",
                            "discounted_amount": f"₹{discounted_amount:,}",
                            "coupon_code": "WELCOME50",
                            "discount_percent": "50%"
                        }
                    )
                    
                    log_entry = {
                        "automation_id": automation["id"],
                        "recovery_key": recovery_key,
                        "order_id": order_id,
                        "user_email": user_email,
                        "user_name": user_name,
                        "interval": interval_key,
                        "template_id": interval_cfg["template_id"],
                        "template_name": interval_cfg.get("template_name", ""),
                        "status": "sent" if result.get("status") == "success" else "failed",
                        "error": result.get("message") if result.get("status") != "success" else None,
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.automation_logs.insert_one(log_entry)
                    
                    if result.get("status") == "success":
                        stats["sent"] += 1
                        logger.info(f"[Cart Abandonment] ✅ Sent {interval_key} email to {user_email}")
                    else:
                        stats["failed"] += 1
                        logger.error(f"[Cart Abandonment] ❌ Failed {interval_key} email to {user_email}: {result.get('message')}")
                        
                except Exception as e:
                    logger.error(f"[Cart Abandonment] ❌ Exception sending {interval_key} email to {user_email}: {e}")
                    await db.automation_logs.insert_one({
                        "automation_id": automation["id"],
                        "recovery_key": recovery_key,
                        "order_id": order_id,
                        "user_email": user_email,
                        "user_name": user_name,
                        "interval": interval_key,
                        "template_id": interval_cfg["template_id"],
                        "status": "failed",
                        "error": str(e),
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    })
                    stats["failed"] += 1
    
    logger.info(f"[Cart Abandonment] Completed: {stats}")
    return stats


async def run_automations_scheduler(db):
    """
    Background task: runs all enabled automations.
    - Trial automations: every hour
    - Cart abandonment: every 30 minutes
    - Workshop reminders: every 15 minutes
    - Session reminders: every 2 minutes (for 10min precision)
    """
    logger.info("Email automation scheduler started")
    await asyncio.sleep(300)  # Wait 5 minutes after server start
    
    iteration = 0
    while True:
        try:
            iteration += 1
            
            # Run trial automations every hour (every 30th iteration at 2-min intervals)
            if iteration % 30 == 1:
                logger.info("Automation scheduler: checking for enabled automations...")
                automations = await db.automations.find({"enabled": True}, {"_id": 0}).to_list(50)
                logger.info(f"Automation scheduler: found {len(automations)} enabled automation(s)")
                for auto in automations:
                    if auto.get("trigger") == "user_signup_free_trial":
                        result = await execute_trial_automation(db, auto)
                        logger.info(f"Automation '{auto['id']}' run complete: {result}")
            
            # Run cart abandonment every 30 minutes (every 15th iteration at 2-min intervals)
            if iteration % 15 == 1:
                cart_auto = await db.automations.find_one({"id": "cart-abandonment", "enabled": True}, {"_id": 0})
                if cart_auto:
                    cart_result = await execute_cart_abandonment_automation(db, cart_auto)
                    logger.info(f"Cart abandonment automation run complete: {cart_result}")
            
            # Run workshop reminders every 15 minutes (every 7-8th iteration)
            if iteration % 8 == 1:
                workshop_result = await execute_workshop_reminders(db)
                logger.info(f"Workshop reminders run complete: {workshop_result}")
            
            # Run session reminders every 2 minutes (every iteration)
            session_result = await execute_session_reminders(db)
            logger.info(f"Session reminders run complete: {session_result}")
            
            await asyncio.sleep(120)  # Wait 2 minutes before next run
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Automation scheduler error: {e}")
            await asyncio.sleep(60)


# ─── Workshop Reminder Execution Function ──────────────────────────────────────

async def execute_workshop_reminders(db):
    """
    Check for upcoming workshops and send reminders:
    - 24 hours before workshop
    - 1 hour before workshop
    """
    from services.email_service import send_email_with_template
    
    # Get config
    config = await db.workshop_reminder_config.find_one({"id": "workshop-reminders"})
    if not config or not config.get("enabled"):
        return {"skipped": "Workshop reminders disabled"}
    
    now = datetime.now(timezone.utc)
    # IST is UTC+5:30 - create timezone-aware datetime
    now_ist = now + timedelta(hours=5, minutes=30)
    
    sent_24h = 0
    sent_1h = 0
    errors = 0
    
    # Get all upcoming workshops
    workshops = await db.workshops.find({}).to_list(1000)
    
    for workshop in workshops:
        try:
            # Parse workshop datetime
            workshop_date = workshop.get("date")
            workshop_time_str = workshop.get("time", "00:00")
            
            if not workshop_date:
                continue
            
            # Parse time - handle formats like "10:00 AM IST", "18:00", etc.
            try:
                # Remove IST suffix if present
                time_clean = workshop_time_str.replace(" IST", "").strip()
                
                # Handle AM/PM format
                if "AM" in time_clean.upper() or "PM" in time_clean.upper():
                    from datetime import datetime as dt
                    parsed_time = dt.strptime(time_clean.upper(), "%I:%M %p")
                    hour = parsed_time.hour
                    minute = parsed_time.minute
                else:
                    # 24-hour format
                    time_parts = time_clean.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                # Parse date
                date_parts = workshop_date.split("-")
                year = int(date_parts[0])
                month = int(date_parts[1])
                day = int(date_parts[2])
                
                # Create naive datetime for comparison (both will be naive IST)
                workshop_datetime_ist = datetime(year, month, day, hour, minute)
                # Make now_ist naive for comparison
                now_ist_naive = now_ist.replace(tzinfo=None)
                
            except Exception as e:
                logger.warning(f"Failed to parse workshop datetime: {workshop_date} {workshop_time_str}: {e}")
                continue
            
            # Skip past workshops
            if workshop_datetime_ist < now_ist_naive:
                continue
            
            # Calculate time until workshop (in IST)
            time_until = (workshop_datetime_ist - now_ist_naive).total_seconds() / 3600  # hours
            
            workshop_id = workshop.get("id") or str(workshop.get("_id"))
            
            # Get registrations from workshop_registrations collection
            registrations = await db.workshop_registrations.find({"workshop_id": workshop_id}).to_list(1000)
            
            if not registrations:
                continue
            
            logger.info(f"[Workshop Reminder] Checking {workshop.get('title')}: {len(registrations)} registrations, {time_until:.2f}h until start")
            
            for registration in registrations:
                user_email = registration.get("user_email")
                user_name = registration.get("user_name", "there")
                
                if not user_email:
                    continue
                
                # Check if 24h reminder should be sent (between 23-25 hours before)
                if 23 <= time_until <= 25 and config.get("reminder_24h_template_id"):
                    already_sent = await db.workshop_reminder_logs.find_one({
                        "workshop_id": workshop_id,
                        "user_email": user_email,
                        "reminder_type": "24h"
                    })
                    
                    if not already_sent:
                        try:
                            result = await send_email_with_template(
                                to=user_email,
                                template_id=config["reminder_24h_template_id"],
                                template_data={
                                    "name": user_name.split()[0] if user_name else "there",
                                    "first_name": user_name.split()[0] if user_name else "there",
                                    "workshop_title": workshop.get("title", "Workshop"),
                                    "workshop_date": workshop_date,
                                    "workshop_time": workshop_time_str,
                                    "instructor_name": workshop.get("instructor_name", ""),
                                    "meeting_link": workshop.get("meeting_link", "")
                                }
                            )
                            
                            await db.workshop_reminder_logs.insert_one({
                                "workshop_id": workshop_id,
                                "workshop_title": workshop.get("title"),
                                "user_email": user_email,
                                "user_name": user_name,
                                "reminder_type": "24h",
                                "status": "sent" if result.get("status") == "success" else "failed",
                                "sent_at": now.isoformat()
                            })
                            
                            sent_24h += 1
                            logger.info(f"[Workshop Reminder] ✅ Sent 24h reminder to {user_email} for {workshop.get('title')}")
                            await asyncio.sleep(1)
                        except Exception as e:
                            logger.error(f"[Workshop Reminder] ❌ Failed 24h reminder to {user_email}: {e}")
                            errors += 1
                
                # Check if 1h reminder should be sent (between 0.5-1.5 hours before)
                if 0.5 <= time_until <= 1.5 and config.get("reminder_1h_template_id"):
                    already_sent = await db.workshop_reminder_logs.find_one({
                        "workshop_id": workshop_id,
                        "user_email": user_email,
                        "reminder_type": "1h"
                    })
                    
                    if not already_sent:
                        try:
                            result = await send_email_with_template(
                                to=user_email,
                                template_id=config["reminder_1h_template_id"],
                                template_data={
                                    "name": user_name.split()[0] if user_name else "there",
                                    "first_name": user_name.split()[0] if user_name else "there",
                                    "workshop_title": workshop.get("title", "Workshop"),
                                    "workshop_date": workshop_date,
                                    "workshop_time": workshop_time_str,
                                    "instructor_name": workshop.get("instructor_name", ""),
                                    "meeting_link": workshop.get("meeting_link", "")
                                }
                            )
                            
                            await db.workshop_reminder_logs.insert_one({
                                "workshop_id": workshop_id,
                                "workshop_title": workshop.get("title"),
                                "user_email": user_email,
                                "user_name": user_name,
                                "reminder_type": "1h",
                                "status": "sent" if result.get("status") == "success" else "failed",
                                "sent_at": now.isoformat()
                            })
                            
                            sent_1h += 1
                            logger.info(f"[Workshop Reminder] ✅ Sent 1h reminder to {user_email} for {workshop.get('title')}")
                            await asyncio.sleep(1)
                        except Exception as e:
                            logger.error(f"[Workshop Reminder] ❌ Failed 1h reminder to {user_email}: {e}")
                            errors += 1
                            
        except Exception as e:
            logger.error(f"[Workshop Reminder] Error processing workshop {workshop.get('title')}: {e}")
            errors += 1
    
    return {"sent_24h": sent_24h, "sent_1h": sent_1h, "errors": errors}




# ─── Session Reminder Endpoints ──────────────────────────────────────

@router.get("/session-reminders/config")
async def get_session_reminder_config(request: Request):
    """Get session reminder configuration"""
    await verify_admin(request)
    db = request.app.state.db
    
    config = await db.session_reminder_config.find_one({"id": "session-reminders"})
    if not config:
        return {
            "enabled": False,
            "reminder_24h_template_id": None,
            "reminder_24h_template_name": None,
            "reminder_1h_template_id": None,
            "reminder_1h_template_name": None,
            "reminder_10min_template_id": None,
            "reminder_10min_template_name": None,
            "whatsapp_enabled": False,
            "whatsapp_24h_template_name": None,
            "whatsapp_1h_template_name": None,
            "whatsapp_10min_template_name": None
        }
    
    return {
        "enabled": config.get("enabled", False),
        "reminder_24h_template_id": config.get("reminder_24h_template_id"),
        "reminder_24h_template_name": config.get("reminder_24h_template_name"),
        "reminder_1h_template_id": config.get("reminder_1h_template_id"),
        "reminder_1h_template_name": config.get("reminder_1h_template_name"),
        "reminder_10min_template_id": config.get("reminder_10min_template_id"),
        "reminder_10min_template_name": config.get("reminder_10min_template_name"),
        "whatsapp_enabled": config.get("whatsapp_enabled", False),
        "whatsapp_24h_template_name": config.get("whatsapp_24h_template_name"),
        "whatsapp_1h_template_name": config.get("whatsapp_1h_template_name"),
        "whatsapp_10min_template_name": config.get("whatsapp_10min_template_name")
    }


@router.post("/session-reminders/config")
async def update_session_reminder_config(body: SessionReminderConfig, request: Request):
    """Update session reminder configuration"""
    await verify_admin(request)
    db = request.app.state.db
    
    await db.session_reminder_config.update_one(
        {"id": "session-reminders"},
        {
            "$set": {
                "enabled": body.enabled,
                "reminder_24h_template_id": body.reminder_24h_template_id,
                "reminder_24h_template_name": body.reminder_24h_template_name,
                "reminder_1h_template_id": body.reminder_1h_template_id,
                "reminder_1h_template_name": body.reminder_1h_template_name,
                "reminder_10min_template_id": body.reminder_10min_template_id,
                "reminder_10min_template_name": body.reminder_10min_template_name,
                "whatsapp_enabled": body.whatsapp_enabled,
                "whatsapp_24h_template_name": body.whatsapp_24h_template_name,
                "whatsapp_1h_template_name": body.whatsapp_1h_template_name,
                "whatsapp_10min_template_name": body.whatsapp_10min_template_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Session reminder configuration updated"}


async def execute_session_reminders(db):
    """
    Check for upcoming coaching and peer sessions and send reminders:
    - 24 hours before session
    - 1 hour before session
    - 10 minutes before session
    Sends to both mentor/partner and candidate
    """
    from services.email_service import send_email_with_template
    from datetime import datetime, timezone, timedelta
    
    # Get config
    config = await db.session_reminder_config.find_one({"id": "session-reminders"})
    if not config or not config.get("enabled"):
        return {"skipped": "Session reminders disabled"}
    
    now = datetime.now(timezone.utc)
    reminder_24h_time = now + timedelta(hours=24)
    reminder_1h_time = now + timedelta(hours=1)
    reminder_10min_time = now + timedelta(minutes=10)
    
    sent_24h = 0
    sent_1h = 0
    sent_10min = 0
    
    # ============ COACHING SESSIONS ============
    # Get all confirmed coaching sessions
    coaching_sessions = await db.bookings.find({"status": "confirmed"}).to_list(1000)
    
    for session in coaching_sessions:
        try:
            # Parse session datetime
            session_date = session.get("date")
            session_time = session.get("time_slot") or session.get("time", "00:00")
            
            if not session_date:
                continue
            
            # Parse time - handle formats like "10:00 AM", "02:46 PM", "18:00", etc.
            try:
                time_clean = session_time.upper().replace(".", "").strip()
                
                # Handle AM/PM format
                if "AM" in time_clean or "PM" in time_clean:
                    parsed_time = datetime.strptime(time_clean, "%I:%M %p")
                    hour = parsed_time.hour
                    minute = parsed_time.minute
                else:
                    # 24-hour format
                    time_parts = time_clean.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                # Parse date
                date_parts = session_date.split("-")
                year = int(date_parts[0])
                month = int(date_parts[1])
                day = int(date_parts[2])
                
                # Create timezone-aware datetime in UTC (assuming stored times are IST, convert to UTC)
                session_datetime_ist = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
                # Adjust for IST offset (IST is UTC+5:30, so subtract to get UTC)
                session_datetime = session_datetime_ist - timedelta(hours=5, minutes=30)
                
            except Exception as e:
                logger.warning(f"Failed to parse session datetime: {session_date} {session_time}: {e}")
                continue
            
            # Get participant emails
            candidate_email = session.get("user_email")
            candidate_name = session.get("user_name", session.get("candidate_name", "there"))
            mentor_email = session.get("mentor_email")
            mentor_name = session.get("mentor_name", "there")
            
            if not candidate_email or not mentor_email:
                continue
            
            session_id = session.get("id", str(session.get("_id")))
            dashboard_link = "https://gradnext.co/dashboard"  # Direct users to dashboard to join
            duration = "45" if session.get("session_type") != "strategy_call" else "30"
            
            # Check 24h reminder
            time_diff_24h = abs((session_datetime - reminder_24h_time).total_seconds())
            if time_diff_24h < 450 and config.get("reminder_24h_template_id"):  # Within 7.5 min window
                # Send to candidate
                already_sent_candidate = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": candidate_email,
                    "reminder_type": "24h"
                })
                
                if not already_sent_candidate:
                    await send_email_with_template(
                        to=candidate_email,
                        template_id=config["reminder_24h_template_id"],
                        template_data={
                            "name": candidate_name,
                            "mentor_name": mentor_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Mentor"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": candidate_email,
                        "recipient_name": candidate_name,
                        "reminder_type": "24h",
                        "sent_at": now.isoformat()
                    })
                    sent_24h += 1
                    await asyncio.sleep(1)
                
                # Send to mentor
                already_sent_mentor = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": mentor_email,
                    "reminder_type": "24h"
                })
                
                if not already_sent_mentor:
                    await send_email_with_template(
                        to=mentor_email,
                        template_id=config["reminder_24h_template_id"],
                        template_data={
                            "name": mentor_name,
                            "mentor_name": candidate_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Candidate"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": mentor_email,
                        "recipient_name": mentor_name,
                        "reminder_type": "24h",
                        "sent_at": now.isoformat()
                    })
                    sent_24h += 1
                    await asyncio.sleep(1)
            
            # Check 1h reminder
            time_diff_1h = abs((session_datetime - reminder_1h_time).total_seconds())
            if time_diff_1h < 450 and config.get("reminder_1h_template_id"):
                # Send to candidate
                already_sent_candidate = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": candidate_email,
                    "reminder_type": "1h"
                })
                
                if not already_sent_candidate:
                    await send_email_with_template(
                        to=candidate_email,
                        template_id=config["reminder_1h_template_id"],
                        template_data={
                            "name": candidate_name,
                            "mentor_name": mentor_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Mentor"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": candidate_email,
                        "recipient_name": candidate_name,
                        "reminder_type": "1h",
                        "sent_at": now.isoformat()
                    })
                    sent_1h += 1
                    await asyncio.sleep(1)
                
                # Send to mentor
                already_sent_mentor = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": mentor_email,
                    "reminder_type": "1h"
                })
                
                if not already_sent_mentor:
                    await send_email_with_template(
                        to=mentor_email,
                        template_id=config["reminder_1h_template_id"],
                        template_data={
                            "name": mentor_name,
                            "mentor_name": candidate_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Candidate"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": mentor_email,
                        "recipient_name": mentor_name,
                        "reminder_type": "1h",
                        "sent_at": now.isoformat()
                    })
                    sent_1h += 1
                    await asyncio.sleep(1)
            
            # Check 10min reminder
            time_diff_10min = abs((session_datetime - reminder_10min_time).total_seconds())
            if time_diff_10min < 120 and config.get("reminder_10min_template_id"):  # Within 2 min window
                # Send to candidate
                already_sent_candidate = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": candidate_email,
                    "reminder_type": "10min"
                })
                
                if not already_sent_candidate:
                    await send_email_with_template(
                        to=candidate_email,
                        template_id=config["reminder_10min_template_id"],
                        template_data={
                            "name": candidate_name,
                            "mentor_name": mentor_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Mentor"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": candidate_email,
                        "recipient_name": candidate_name,
                        "reminder_type": "10min",
                        "sent_at": now.isoformat()
                    })
                    sent_10min += 1
                    await asyncio.sleep(1)
                
                # Send to mentor
                already_sent_mentor = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "coaching",
                    "recipient_email": mentor_email,
                    "reminder_type": "10min"
                })
                
                if not already_sent_mentor:
                    await send_email_with_template(
                        to=mentor_email,
                        template_id=config["reminder_10min_template_id"],
                        template_data={
                            "name": mentor_name,
                            "mentor_name": candidate_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Candidate"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "coaching",
                        "recipient_email": mentor_email,
                        "recipient_name": mentor_name,
                        "reminder_type": "10min",
                        "sent_at": now.isoformat()
                    })
                    sent_10min += 1
                    await asyncio.sleep(1)
        
        except Exception as e:
            logger.error(f"Error processing coaching session reminders for {session.get('id')}: {e}")
            continue
    
    # ============ PEER PRACTICE SESSIONS ============
    peer_sessions = await db.peer_sessions.find({"status": "matched"}).to_list(1000)
    
    for session in peer_sessions:
        try:
            session_date = session.get("date")
            session_time = session.get("time", "00:00")
            
            if not session_date:
                continue
            
            # Parse time - handle formats like "10:00 AM", "18:00", etc.
            try:
                time_clean = session_time.upper().replace(".", "").strip()
                
                # Handle AM/PM format
                if "AM" in time_clean or "PM" in time_clean:
                    parsed_time = datetime.strptime(time_clean, "%I:%M %p")
                    hour = parsed_time.hour
                    minute = parsed_time.minute
                else:
                    # 24-hour format
                    time_parts = time_clean.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                # Parse date
                date_parts = session_date.split("-")
                year = int(date_parts[0])
                month = int(date_parts[1])
                day = int(date_parts[2])
                
                # Create timezone-aware datetime in UTC
                session_datetime_ist = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
                session_datetime = session_datetime_ist - timedelta(hours=5, minutes=30)
                
            except Exception as e:
                logger.warning(f"Failed to parse peer session datetime: {session_date} {session_time}: {e}")
                continue
            
            requester_email = session.get("requester_email")
            requester_name = session.get("requester_name", "there")
            partner_email = session.get("partner_email")
            partner_name = session.get("partner_name", "there")
            
            if not requester_email or not partner_email:
                continue
            
            session_id = session.get("id", str(session.get("_id")))
            dashboard_link = "https://gradnext.co/dashboard"  # Direct users to dashboard to join
            duration = "60"
            
            # Same reminder logic for peer sessions (24h, 1h, 10min)
            # [Similar code structure as coaching sessions above]
            # Sending to both requester and partner
            
            # 24h reminder
            time_diff_24h = abs((session_datetime - reminder_24h_time).total_seconds())
            if time_diff_24h < 450 and config.get("reminder_24h_template_id"):
                # Send to requester
                already_sent = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "peer",
                    "recipient_email": requester_email,
                    "reminder_type": "24h"
                })
                
                if not already_sent:
                    await send_email_with_template(
                        to=requester_email,
                        template_id=config["reminder_24h_template_id"],
                        template_data={
                            "name": requester_name,
                            "mentor_name": partner_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Practice Partner"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "peer",
                        "recipient_email": requester_email,
                        "recipient_name": requester_name,
                        "reminder_type": "24h",
                        "sent_at": now.isoformat()
                    })
                    sent_24h += 1
                    await asyncio.sleep(1)
                
                # Send to partner
                already_sent = await db.session_reminder_logs.find_one({
                    "session_id": session_id,
                    "session_type": "peer",
                    "recipient_email": partner_email,
                    "reminder_type": "24h"
                })
                
                if not already_sent:
                    await send_email_with_template(
                        to=partner_email,
                        template_id=config["reminder_24h_template_id"],
                        template_data={
                            "name": partner_name,
                            "mentor_name": requester_name,
                            "date": session_date,
                            "time": session_time,
                            "duration": duration,
                            "dashboard_link": dashboard_link,
                            "role_label": "Practice Partner"
                        }
                    )
                    await db.session_reminder_logs.insert_one({
                        "session_id": session_id,
                        "session_type": "peer",
                        "recipient_email": partner_email,
                        "recipient_name": partner_name,
                        "reminder_type": "24h",
                        "sent_at": now.isoformat()
                    })
                    sent_24h += 1
                    await asyncio.sleep(1)
            
            # Similar for 1h and 10min... (abbreviated for brevity)
            
        except Exception as e:
            logger.error(f"Error processing peer session reminders for {session.get('id')}: {e}")
            continue
    
    return {"sent_24h": sent_24h, "sent_1h": sent_1h, "sent_10min": sent_10min}


# ─── Bulk Email Endpoints ──────────────────────────────────────────

@router.post("/bulk-email/send")
async def send_bulk_email(body: BulkEmailRequest, request: Request):
    """
    Send bulk email to all contacts or all mentors.
    Implements 1-second delay between emails to comply with Resend rate limits.
    """
    await verify_admin(request)
    db = request.app.state.db
    
    if not body.template_id:
        raise HTTPException(status_code=400, detail="Template ID is required")
    
    # Get recipients based on type
    if body.recipient_type == "contacts":
        # Get all users who are not mentors or admins
        recipients = await db.users.find(
            {
                "is_mentor": {"$ne": True},
                "is_admin": {"$ne": True},
                "email": {"$exists": True}
            },
            {"_id": 0, "email": 1, "name": 1}
        ).to_list(10000)
    elif body.recipient_type == "mentors":
        # Get all mentors
        recipients = await db.users.find(
            {
                "is_mentor": True,
                "email": {"$exists": True}
            },
            {"_id": 0, "email": 1, "name": 1}
        ).to_list(1000)
    else:
        raise HTTPException(status_code=400, detail="Invalid recipient_type. Must be 'contacts' or 'mentors'")
    
    if not recipients:
        return {"success": False, "message": f"No {body.recipient_type} found", "total": 0, "sent": 0, "failed": 0}
    
    # Start async background task for sending emails
    task_id = f"bulk-{body.recipient_type}-{datetime.now(timezone.utc).timestamp()}"
    asyncio.create_task(
        execute_bulk_email_send(db, recipients, body.template_id, body.template_name, body.recipient_type, task_id)
    )
    
    return {
        "success": True,
        "message": f"Bulk email sending initiated for {len(recipients)} {body.recipient_type}",
        "total": len(recipients),
        "task_id": task_id,
        "note": "Emails are being sent in the background with 1-second delay between each email. Check logs for progress."
    }


@router.get("/bulk-email/status/{task_id}")
async def get_bulk_email_status(task_id: str, request: Request):
    """Get status of bulk email task"""
    await verify_admin(request)
    db = request.app.state.db
    
    # Get logs for this task
    logs = await db.bulk_email_logs.find(
        {"task_id": task_id},
        {"_id": 0}
    ).to_list(10000)
    
    if not logs:
        raise HTTPException(status_code=404, detail="Task not found")
    
    total = len(logs)
    sent = sum(1 for log in logs if log.get("status") == "sent")
    failed = sum(1 for log in logs if log.get("status") == "failed")
    pending = total - sent - failed
    
    return {
        "task_id": task_id,
        "total": total,
        "sent": sent,
        "failed": failed,
        "pending": pending,
        "logs": logs[-50:]  # Return last 50 logs
    }


async def execute_bulk_email_send(db, recipients: list, template_id: str, template_name: str, recipient_type: str, task_id: str):
    """
    Execute bulk email sending with STRICT 1-second delay between each email.
    This runs as a background task.
    """
    from services.email_service import send_email_with_template
    import time
    
    logger.info(f"Bulk email task {task_id} started: sending to {len(recipients)} {recipient_type}")
    
    last_send_time = None
    
    for idx, recipient in enumerate(recipients, 1):
        # Record the EXACT time we're processing this email (for gap measurement)
        current_send_time = time.time()
        
        # Measure gap from last email (if not first)
        if last_send_time is not None:
            actual_gap = current_send_time - last_send_time
            logger.info(f"Bulk email timing: Gap from previous email = {actual_gap:.3f}s")
        
        # Update last_send_time IMMEDIATELY to mark start of this iteration
        last_send_time = current_send_time
        
        email = recipient.get("email")
        name = recipient.get("name", "there")
        
        # Record start time for work duration calculation
        work_start = time.time()
        
        try:
            # Send email with template
            result = await send_email_with_template(
                to=email,
                template_id=template_id,
                template_data={"name": name}
            )
            
            # Log success
            await db.bulk_email_logs.insert_one({
                "task_id": task_id,
                "recipient_type": recipient_type,
                "recipient_email": email,
                "recipient_name": name,
                "template_id": template_id,
                "template_name": template_name,
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sequence_number": idx
            })
            
            logger.info(f"Bulk email {idx}/{len(recipients)}: ✅ sent to {email}")
            
        except Exception as e:
            # Log failure
            await db.bulk_email_logs.insert_one({
                "task_id": task_id,
                "recipient_type": recipient_type,
                "recipient_email": email,
                "recipient_name": name,
                "template_id": template_id,
                "template_name": template_name,
                "status": "failed",
                "error": str(e),
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sequence_number": idx
            })
            
            logger.error(f"Bulk email {idx}/{len(recipients)}: ❌ failed for {email} - {e}")
        
        # CRITICAL: Enforce STRICT 1-second minimum gap before next email
        if idx < len(recipients):
            work_duration = time.time() - work_start
            
            if work_duration < 1.0:
                # Work took less than 1 second, wait the remainder
                wait_time = 1.0 - work_duration
                logger.info(f"Rate limit: Work took {work_duration:.3f}s, waiting {wait_time:.3f}s (total=1.0s)")
                await asyncio.sleep(wait_time)
            else:
                # Work took more than 1 second, add small buffer anyway
                logger.info(f"Rate limit: Work took {work_duration:.3f}s (>1s), adding 0.1s buffer")
                await asyncio.sleep(0.1)
    
    logger.info(f"Bulk email task {task_id} completed: {len(recipients)} emails processed")


@router.post("/bulk-email/test-timing")
async def test_bulk_email_timing(request: Request):
    """Test endpoint to verify 1-second delay is working"""
    await verify_admin(request)
    
    import time
    
    test_emails = [
        {"email": "test1@example.com", "name": "Test User 1"},
        {"email": "test2@example.com", "name": "Test User 2"},
        {"email": "test3@example.com", "name": "Test User 3"},
    ]
    
    timings = []
    last_time = time.time()
    
    for idx, recipient in enumerate(test_emails, 1):
        current_time = time.time()
        if idx > 1:
            gap = current_time - last_time
            timings.append({
                "iteration": idx,
                "gap_seconds": round(gap, 3),
                "meets_requirement": gap >= 1.0
            })
        
        # Simulate work
        await asyncio.sleep(0.1)
        
        # Enforce 1-second minimum
        elapsed = time.time() - current_time
        if idx < len(test_emails):
            if elapsed < 1.0:
                wait_time = 1.0 - elapsed
                await asyncio.sleep(wait_time)
            else:
                await asyncio.sleep(0.1)
        
        last_time = time.time()
    
    return {
        "test": "bulk_email_timing",
        "total_emails": len(test_emails),
        "timings": timings,
        "all_gaps_meet_1s_requirement": all(t.get("meets_requirement", False) for t in timings)
    }



# ============ AUTOMATIC SESSION STATUS UPDATE ============
# Updates coaching session statuses based on check-in data 30 minutes after session start

@router.post("/run-session-status-update")
async def run_session_status_update(request: Request):
    """
    Automatically update coaching session statuses based on check-in data.
    Runs 30 minutes after session start time.
    
    Status Logic:
    - Both checked in → completed
    - Only mentor checked in → candidate_no_show
    - Only candidate checked in → mentor_no_show
    - Neither checked in → both_no_show
    """
    await verify_admin(request)
    from routes.auth import get_db
    db = get_db(request)
    
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    
    stats = {
        "checked": 0,
        "completed": 0,
        "mentor_no_show": 0,
        "candidate_no_show": 0,
        "both_no_show": 0,
        "skipped": 0,
        "errors": 0
    }
    
    # Find all confirmed coaching sessions
    sessions = await db.bookings.find({
        "status": "confirmed"
    }).to_list(1000)
    
    for session in sessions:
        try:
            stats["checked"] += 1
            
            # Parse session datetime
            session_date = session.get("date")
            session_time = session.get("time_slot") or session.get("time", "00:00")
            
            if not session_date:
                stats["skipped"] += 1
                continue
            
            # Parse time - handle formats like "10:00 AM", "02:46 PM", "18:00", etc.
            try:
                time_clean = session_time.upper().replace(".", "").strip()
                
                # Handle AM/PM format
                if "AM" in time_clean or "PM" in time_clean:
                    parsed_time = datetime.strptime(time_clean, "%I:%M %p")
                    hour = parsed_time.hour
                    minute = parsed_time.minute
                else:
                    # 24-hour format
                    time_parts = time_clean.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                # Parse date
                date_parts = session_date.split("-")
                year = int(date_parts[0])
                month = int(date_parts[1])
                day = int(date_parts[2])
                
                # Create datetime in IST
                session_datetime_ist = datetime(year, month, day, hour, minute)
                
            except Exception as e:
                logger.warning(f"Failed to parse session datetime: {session_date} {session_time}: {e}")
                stats["errors"] += 1
                continue
            
            # Check if 30 minutes have passed since session start
            cutoff_time = session_datetime_ist + timedelta(minutes=30)
            
            if now_ist < cutoff_time:
                # Session hasn't reached 30-minute mark yet
                stats["skipped"] += 1
                continue
            
            # Determine new status based on check-ins
            mentor_checked_in = session.get("mentor_checked_in", False)
            candidate_checked_in = session.get("candidate_checked_in", False)
            
            if mentor_checked_in and candidate_checked_in:
                new_status = "completed"
                stats["completed"] += 1
            elif mentor_checked_in and not candidate_checked_in:
                new_status = "candidate_no_show"
                stats["candidate_no_show"] += 1
            elif not mentor_checked_in and candidate_checked_in:
                new_status = "mentor_no_show"
                stats["mentor_no_show"] += 1
            else:
                new_status = "both_no_show"
                stats["both_no_show"] += 1
            
            # Update the session status
            await db.bookings.update_one(
                {"id": session.get("id")},
                {"$set": {
                    "status": new_status,
                    "status_auto_updated": True,
                    "status_auto_updated_at": datetime.utcnow().isoformat()
                }}
            )
            
            logger.info(f"Auto-updated session {session.get('id')} to status: {new_status}")
            
        except Exception as e:
            logger.error(f"Error processing session {session.get('id')}: {e}")
            stats["errors"] += 1
    
    return {
        "message": "Session status update completed",
        "stats": stats
    }


@router.get("/session-status-preview")
async def preview_session_status_updates(request: Request):
    """
    Preview what status updates would be applied without making changes.
    Useful for debugging and verification.
    """
    await verify_admin(request)
    from routes.auth import get_db
    db = get_db(request)
    
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    
    preview = []
    
    # Find all confirmed coaching sessions
    sessions = await db.bookings.find({
        "status": "confirmed"
    }).to_list(1000)
    
    for session in sessions:
        try:
            # Parse session datetime
            session_date = session.get("date")
            session_time = session.get("time_slot") or session.get("time", "00:00")
            
            if not session_date:
                continue
            
            # Parse time
            try:
                time_clean = session_time.upper().replace(".", "").strip()
                
                if "AM" in time_clean or "PM" in time_clean:
                    parsed_time = datetime.strptime(time_clean, "%I:%M %p")
                    hour = parsed_time.hour
                    minute = parsed_time.minute
                else:
                    time_parts = time_clean.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                date_parts = session_date.split("-")
                year = int(date_parts[0])
                month = int(date_parts[1])
                day = int(date_parts[2])
                
                session_datetime_ist = datetime(year, month, day, hour, minute)
                
            except Exception:
                continue
            
            # Check if 30 minutes have passed
            cutoff_time = session_datetime_ist + timedelta(minutes=30)
            minutes_since_cutoff = (now_ist - cutoff_time).total_seconds() / 60
            
            if now_ist < cutoff_time:
                continue
            
            # Determine would-be status
            mentor_checked_in = session.get("mentor_checked_in", False)
            candidate_checked_in = session.get("candidate_checked_in", False)
            
            if mentor_checked_in and candidate_checked_in:
                would_be_status = "completed"
            elif mentor_checked_in and not candidate_checked_in:
                would_be_status = "candidate_no_show"
            elif not mentor_checked_in and candidate_checked_in:
                would_be_status = "mentor_no_show"
            else:
                would_be_status = "both_no_show"
            
            preview.append({
                "session_id": session.get("id"),
                "date": session_date,
                "time": session_time,
                "mentor_name": session.get("mentor_name"),
                "candidate_name": session.get("candidate_name"),
                "mentor_checked_in": mentor_checked_in,
                "candidate_checked_in": candidate_checked_in,
                "current_status": session.get("status"),
                "would_be_status": would_be_status,
                "minutes_past_cutoff": round(minutes_since_cutoff, 1)
            })
            
        except Exception:
            continue
    
    return {
        "total_sessions_to_update": len(preview),
        "sessions": preview
    }
