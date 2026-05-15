"""
Session Reminder Scheduler
Sends WhatsApp reminders at 24h, 4h, and 15min before coaching sessions

Templates required in WATI:
- candidate_session_reminder_24h
- mentor_session_reminder_24h
- candidate_session_reminder_4h
- mentor_session_reminder_4h
- candidate_session_reminder_15min
- mentor_session_reminder_15min
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os
import pytz

from services.wati_service import wati_service

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

# IST timezone (sessions are stored in IST)
IST = pytz.timezone('Asia/Kolkata')

# Reminder intervals in hours
REMINDER_INTERVALS = {
    '24h': 24,
    '4h': 4,
    '15min': 0.25  # 15 minutes = 0.25 hours
}


def format_phone(phone: str, country_code: str) -> Optional[str]:
    """Format phone number for WhatsApp"""
    if not phone:
        return None
    phone = str(phone).replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        country_code = country_code if country_code else "+91"
        phone = f"{country_code}{phone}"
    return phone


async def send_reminder(
    recipient_phone: str,
    template_name: str,
    recipient_name: str,
    session_type: str,
    other_person_name: str,
    session_date: str = None,
    session_time: str = None
) -> bool:
    """Send a reminder via WhatsApp"""
    if not recipient_phone:
        return False
    
    try:
        # All templates use 5 parameters:
        # {{1}} - Name, {{2}} - Session type, {{3}} - Other person name, {{4}} - Date, {{5}} - Time
        parameters = [
            {"name": "1", "value": recipient_name},
            {"name": "2", "value": session_type},
            {"name": "3", "value": other_person_name},
            {"name": "4", "value": session_date or ""},
            {"name": "5", "value": session_time or ""}
        ]
        
        await wati_service.send_template_message(
            recipient_number=recipient_phone,
            template_name=template_name,
            parameters=parameters
        )
        logger.info(f"[Reminder] ✅ Sent {template_name} to {recipient_phone}")
        return True
    except Exception as e:
        logger.warning(f"[Reminder] ❌ Failed to send {template_name} to {recipient_phone}: {e}")
        return False


async def process_reminders():
    """Main function to process and send session reminders"""
    logger.info("[Reminder Scheduler] Starting reminder check...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.gradnext
        
        # Use IST timezone since sessions are stored in IST
        now = datetime.now(IST)
        logger.info(f"[Reminder Scheduler] Current IST time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Get all confirmed bookings
        bookings = await db.bookings.find({
            "status": {"$in": ["confirmed", "pending"]}
        }).to_list(1000)
        
        logger.info(f"[Reminder Scheduler] Found {len(bookings)} active bookings to check")
        
        reminders_sent = 0
        
        for booking in bookings:
            booking_id = booking.get("id")
            session_date_str = booking.get("date")  # Format: "2026-03-10"
            session_time_str = booking.get("time_slot") or booking.get("time")  # Format: "10:00 AM"
            
            if not session_date_str or not session_time_str:
                continue
            
            # Parse session datetime (in IST since that's how they're stored)
            try:
                # Handle various time formats
                time_str = session_time_str.upper().replace(".", "").strip()
                
                # Try parsing with AM/PM
                try:
                    session_datetime_naive = datetime.strptime(
                        f"{session_date_str} {time_str}", 
                        "%Y-%m-%d %I:%M %p"
                    )
                except ValueError:
                    # Try 24-hour format
                    session_datetime_naive = datetime.strptime(
                        f"{session_date_str} {time_str}", 
                        "%Y-%m-%d %H:%M"
                    )
                
                # Make timezone-aware (IST)
                session_datetime = IST.localize(session_datetime_naive)
                
            except Exception as e:
                logger.warning(f"[Reminder] Could not parse datetime for booking {booking_id}: {session_date_str} {session_time_str} - {e}")
                continue
            
            # Calculate time until session (both are now in IST)
            time_until_session = (session_datetime - now).total_seconds() / 3600  # in hours
            
            # Skip if session is in the past
            if time_until_session < 0:
                continue
            
            # ALWAYS fetch phone data fresh from user/mentor records (same as booking notifications)
            # This ensures we use the same source that works for booking WhatsApp messages
            candidate = await db.users.find_one({"id": booking.get("user_id")})
            mentor = await db.mentors.find_one({"id": booking.get("mentor_id")})
            
            # Get candidate phone - prioritize fresh lookup, fallback to booking
            candidate_phone = None
            candidate_country_code = "+91"
            candidate_name = booking.get("candidate_name", "Candidate")
            
            if candidate:
                candidate_phone = candidate.get("phone_number") or candidate.get("phone")
                candidate_country_code = candidate.get("phone_country_code", "+91")
                candidate_name = candidate.get("name", candidate_name)
            
            # Fallback to booking if user lookup failed
            if not candidate_phone:
                candidate_phone = booking.get("candidate_phone")
                candidate_country_code = booking.get("candidate_country_code", "+91")
            
            # Get mentor phone - prioritize fresh lookup, fallback to booking
            mentor_phone = None
            mentor_country_code = "+91"
            mentor_name = booking.get("mentor_name", "Mentor")
            
            if mentor:
                mentor_phone = mentor.get("phone_number") or mentor.get("phone")
                mentor_country_code = mentor.get("phone_country_code", "+91")
                mentor_name = mentor.get("name", mentor_name)
            
            # Fallback to booking if mentor lookup failed
            if not mentor_phone:
                mentor_phone = booking.get("mentor_phone")
                mentor_country_code = booking.get("mentor_country_code", "+91")
            
            # Format phone numbers
            candidate_phone_formatted = format_phone(candidate_phone, candidate_country_code)
            mentor_phone_formatted = format_phone(mentor_phone, mentor_country_code)
            
            # Log if phone numbers are missing
            if not candidate_phone_formatted:
                logger.warning(f"[Reminder] Skipping booking {booking_id}: candidate has no phone number")
                continue
            if not mentor_phone_formatted:
                logger.warning(f"[Reminder] Skipping booking {booking_id}: mentor has no phone number")
                continue
            
            session_type = booking.get("session_type", "Coaching session")
            
            # Check each reminder interval
            for reminder_type, hours_before in REMINDER_INTERVALS.items():
                # Check if it's time to send this reminder
                # Different windows for different reminder types:
                # - 24h/4h: ±30 minutes window (23.5-24.5h or 3.5-4.5h)
                # - 15min: 10-20 minutes before (more precise)
                if reminder_type == '15min':
                    min_hours = 10 / 60  # 10 minutes
                    max_hours = 20 / 60  # 20 minutes
                else:
                    min_hours = hours_before - 0.5
                    max_hours = hours_before + 0.5
                
                if min_hours <= time_until_session <= max_hours:
                    # Check if reminder already sent
                    reminder_key = f"{booking_id}_{reminder_type}"
                    existing_reminder = await db.session_reminders.find_one({
                        "reminder_key": reminder_key
                    })
                    
                    if existing_reminder:
                        continue  # Already sent
                    
                    logger.info(f"[Reminder] Sending {reminder_type} reminder for booking {booking_id}")
                    
                    # Send to candidate
                    candidate_sent = await send_reminder(
                        recipient_phone=candidate_phone_formatted,
                        template_name=f"candidate_session_reminder_{reminder_type}",
                        recipient_name=candidate_name,
                        session_type=session_type,
                        other_person_name=mentor_name,
                        session_date=session_date_str,
                        session_time=session_time_str
                    )
                    
                    # Send to mentor
                    mentor_sent = await send_reminder(
                        recipient_phone=mentor_phone_formatted,
                        template_name=f"mentor_session_reminder_{reminder_type}",
                        recipient_name=mentor_name,
                        session_type=session_type,
                        other_person_name=candidate_name,
                        session_date=session_date_str,
                        session_time=session_time_str
                    )
                    
                    # Mark reminder as sent
                    if candidate_sent or mentor_sent:
                        await db.session_reminders.insert_one({
                            "reminder_key": reminder_key,
                            "booking_id": booking_id,
                            "reminder_type": reminder_type,
                            "candidate_sent": candidate_sent,
                            "mentor_sent": mentor_sent,
                            "sent_at": datetime.utcnow()
                        })
                        reminders_sent += 1
        
        logger.info(f"[Reminder Scheduler] Completed. Sent {reminders_sent} reminders.")
        client.close()
        
    except Exception as e:
        logger.error(f"[Reminder Scheduler] Error: {e}")


async def start_reminder_scheduler(interval_minutes: int = 15):
    """Start the background reminder scheduler"""
    logger.info(f"[Reminder Scheduler] Starting with {interval_minutes} minute interval")
    
    while True:
        try:
            await process_reminders()
        except Exception as e:
            logger.error(f"[Reminder Scheduler] Error in scheduler loop: {e}")
        
        # Wait for next check
        await asyncio.sleep(interval_minutes * 60)


# Function to run scheduler in background
def run_reminder_scheduler_background():
    """Run the reminder scheduler in a background task"""
    loop = asyncio.get_event_loop()
    loop.create_task(start_reminder_scheduler(interval_minutes=15))
    logger.info("[Reminder Scheduler] Background task created")
