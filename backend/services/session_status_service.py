"""
Session Status Auto-Update Service
Automatically updates coaching session statuses based on check-in data
30 minutes after session start time.

Status Logic:
- Both checked in → completed
- Only mentor checked in → candidate_no_show
- Only candidate checked in → mentor_no_show
- Neither checked in → both_no_show
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Buffer time after session start before auto-updating status (in minutes)
STATUS_UPDATE_BUFFER_MINUTES = 30


async def get_db():
    """Get database connection"""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    return client.gradnext


async def auto_update_session_statuses():
    """
    Automatically update coaching session statuses based on check-in data.
    Only updates sessions that are 30+ minutes past their start time.
    """
    try:
        db = await get_db()
        
        now = datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = (now + ist_offset).replace(tzinfo=None)  # Make naive for comparison
        
        logger.info(f"[Session Status] Starting auto-update check at IST: {now_ist.strftime('%Y-%m-%d %H:%M')}")
        
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
                    logger.warning(f"[Session Status] Failed to parse datetime: {session_date} {session_time}: {e}")
                    stats["errors"] += 1
                    continue
                
                # Check if 30 minutes have passed since session start
                cutoff_time = session_datetime_ist + timedelta(minutes=STATUS_UPDATE_BUFFER_MINUTES)
                
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
                
                logger.info(f"[Session Status] Auto-updated session {session.get('id')} to: {new_status} "
                           f"(mentor_checked_in={mentor_checked_in}, candidate_checked_in={candidate_checked_in})")
                
            except Exception as e:
                logger.error(f"[Session Status] Error processing session {session.get('id')}: {e}")
                stats["errors"] += 1
        
        total_updated = stats["completed"] + stats["mentor_no_show"] + stats["candidate_no_show"] + stats["both_no_show"]
        logger.info(f"[Session Status] Completed. Checked: {stats['checked']}, Updated: {total_updated}, "
                   f"Skipped: {stats['skipped']}, Errors: {stats['errors']}")
        
        return stats
        
    except Exception as e:
        logger.error(f"[Session Status] Error in auto_update_session_statuses: {e}")
        return {"error": str(e)}


async def start_status_update_scheduler(interval_minutes: int = 15):
    """Start the background status update scheduler"""
    logger.info(f"[Session Status Scheduler] Starting with {interval_minutes} minute interval")
    
    while True:
        try:
            await auto_update_session_statuses()
        except Exception as e:
            logger.error(f"[Session Status Scheduler] Error in scheduler loop: {e}")
        
        # Wait for next check
        await asyncio.sleep(interval_minutes * 60)


def run_status_update_scheduler_background():
    """Run the status update scheduler in a background task"""
    loop = asyncio.get_event_loop()
    loop.create_task(start_status_update_scheduler(interval_minutes=15))
    logger.info("[Session Status Scheduler] Background task created")
