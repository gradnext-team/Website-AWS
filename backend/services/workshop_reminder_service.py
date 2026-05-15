"""
Workshop Reminder Service
Sends WhatsApp reminders to registered users:
  - 24 hours before the workshop
  - 1 hour before the workshop
  - 2 hours after the workshop (thank you message)
Runs on a scheduler (every 15 minutes).
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))


def parse_workshop_datetime(date_str: str, time_str: str):
    """Parse workshop date + time (e.g., '2025-01-10' + '10:00 AM IST') into a timezone-aware datetime."""
    if not date_str or not time_str:
        return None
    
    import re
    # Remove timezone abbreviation
    clean_time = re.sub(r'\s*(IST|GMT|UTC|EST|PST|CST|MST)\s*', '', time_str, flags=re.IGNORECASE).strip()
    
    # Parse 12h format
    match = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM)?$', clean_time, re.IGNORECASE)
    if not match:
        # Try 24h format
        try:
            dt = datetime.strptime(f"{date_str} {clean_time}", "%Y-%m-%d %H:%M")
            return dt.replace(tzinfo=IST)
        except Exception:
            return None
    
    hours = int(match.group(1))
    minutes = int(match.group(2))
    period = (match.group(3) or '').upper()
    
    if period == 'PM' and hours != 12:
        hours += 12
    if period == 'AM' and hours == 12:
        hours = 0
    
    try:
        dt = datetime.strptime(f"{date_str} {hours:02d}:{minutes:02d}", "%Y-%m-%d %H:%M")
        return dt.replace(tzinfo=IST)
    except Exception:
        return None


async def send_workshop_reminders(db):
    """Check upcoming workshops and send 24h and 1h reminders to registered users."""
    from services.wati_service import wati_service
    
    now = datetime.now(IST)
    logger.info(f"[Workshop Reminders] Checking at IST: {now.strftime('%Y-%m-%d %H:%M')}")
    
    # Get all upcoming workshops
    workshops = await db.workshops.find(
        {"is_past": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    total_sent_24h = 0
    total_sent_1h = 0
    
    for workshop in workshops:
        workshop_id = workshop.get("id")
        workshop_dt = parse_workshop_datetime(workshop.get("date"), workshop.get("time"))
        
        if not workshop_dt:
            continue
        
        diff_minutes = (workshop_dt - now).total_seconds() / 60
        
        # 24h reminder: send if workshop is 23-25 hours away (to catch within a 15-min scheduler window)
        if 23 * 60 <= diff_minutes <= 25 * 60:
            sent = await _send_reminder_batch(
                db, wati_service, workshop, workshop_id,
                template_name="workshop_reminder_24h_vf",
                reminder_type="24h",
                param_count=5
            )
            total_sent_24h += sent
        
        # 1h reminder: send if workshop is 45-75 minutes away
        if 45 <= diff_minutes <= 75:
            sent = await _send_reminder_batch(
                db, wati_service, workshop, workshop_id,
                template_name="workshop_reminder_1h_vf",
                reminder_type="1h",
                param_count=5  # Fixed: template needs 5 params (name, title, instructor, date, time)
            )
            total_sent_1h += sent
        
        # Post-workshop thank you: send 2 hours after workshop ends
        # Check if workshop ended 2-2.5 hours ago (within scheduler window)
        if -150 <= diff_minutes <= -120:  # Negative means past
            sent = await _send_reminder_batch(
                db, wati_service, workshop, workshop_id,
                template_name="workshop_thankyou1",
                reminder_type="post_workshop",
                param_count=2  # Only 2 params: name and workshop title
            )
            total_sent_24h += sent  # Add to counter for logging
    
    logger.info(f"[Workshop Reminders] Completed. 24h reminders: {total_sent_24h}, 1h reminders: {total_sent_1h}")


async def _send_reminder_batch(db, wati_service, workshop, workshop_id, template_name, reminder_type, param_count):
    """Send reminder to all registered users for a workshop, avoiding duplicates."""
    
    # Check if we already sent this reminder for this workshop
    reminder_key = f"{workshop_id}_{reminder_type}"
    existing = await db.workshop_reminders_sent.find_one({"reminder_key": reminder_key})
    if existing:
        logger.info(f"[Workshop Reminders] {reminder_type} already sent for {workshop.get('title')}, skipping")
        return 0
    
    # Get registered users
    registrations = await db.workshop_registrations.find(
        {"workshop_id": workshop_id},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    
    if not registrations:
        return 0
    
    registered_user_ids = [r.get("user_id") for r in registrations]
    
    # Get user phone numbers
    users = await db.users.find(
        {"id": {"$in": registered_user_ids}, "phone_number": {"$exists": True, "$nin": ["", None]}},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "phone_number": 1}
    ).to_list(10000)
    
    sent = 0
    failed = 0
    
    for user in users:
        phone = user.get("phone_number", "")
        if not phone:
            continue
        
        name = user.get("first_name") or (user.get("name", "").split()[0] if user.get("name") else "there")
        
        if param_count == 5:
            parameters = [
                {"name": "1", "value": name},
                {"name": "2", "value": workshop.get("title", "")},
                {"name": "3", "value": workshop.get("instructor", workshop.get("host", ""))},
                {"name": "4", "value": workshop.get("date", "")},
                {"name": "5", "value": workshop.get("time", "")}
            ]
        elif param_count == 2:  # Post-workshop thank you
            parameters = [
                {"name": "first_name", "value": name},
                {"name": "workshop_name", "value": workshop.get("title", "")}
            ]
        else:  # 4 params for 1h reminder
            parameters = [
                {"name": "1", "value": name},
                {"name": "2", "value": workshop.get("title", "")},
                {"name": "3", "value": workshop.get("instructor", workshop.get("host", ""))},
                {"name": "4", "value": workshop.get("time", "")}
            ]
        
        try:
            await wati_service.send_template_message(
                recipient_number=phone,
                template_name=template_name,
                parameters=parameters
            )
            sent += 1
            # NOTE: For post-workshop messages, the `workshop_name` WATI
            # attribute is intentionally NOT updated here. We only mark a user
            # as "engaged with workshop X" when they actually reply — see
            # routes/workshop_feedback.py::wati_inbound_webhook.

        except Exception as e:
            failed += 1
            logger.error(f"[Workshop Reminders] Failed to send {reminder_type} to {phone}: {e}")
    
    # Mark this reminder as sent to avoid duplicates
    await db.workshop_reminders_sent.insert_one({
        "reminder_key": reminder_key,
        "workshop_id": workshop_id,
        "reminder_type": reminder_type,
        "sent_count": sent,
        "failed_count": failed,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"[Workshop Reminders] {reminder_type} for '{workshop.get('title')}': sent={sent}, failed={failed}")
    return sent


async def start_workshop_reminder_scheduler(interval_minutes: int = 15):
    """Run workshop reminder checks on a schedule."""
    from server import app
    
    while True:
        try:
            db = app.state.db
            await send_workshop_reminders(db)
        except Exception as e:
            logger.error(f"[Workshop Reminder Scheduler] Error: {e}")
        
        await asyncio.sleep(interval_minutes * 60)
