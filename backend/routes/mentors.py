from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import time as _time
from models import (
    Mentor, MentorAvailability, SessionBooking, BookingStatus,
    User, PlanType
)
from routes.auth import get_current_user, get_db
from services.wati_service import wati_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mentors", tags=["mentors"])

# ── Simple in-memory response cache ─────────────────────────────────────
# Mentor listings rarely change but are hit by EVERY visitor. Caching the
# fully-built response for 60 seconds avoids 3 DB queries + per-mentor
# processing on every single page load.
_mentor_list_cache = {}  # key -> {"ts": float, "data": list}
_MENTOR_CACHE_TTL = 60  # seconds


def _cache_get(key: str):
    entry = _mentor_list_cache.get(key)
    if entry and (_time.time() - entry["ts"]) < _MENTOR_CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _mentor_list_cache[key] = {"ts": _time.time(), "data": data}


def invalidate_mentor_cache():
    """Call this after admin edits a mentor to force fresh data."""
    _mentor_list_cache.clear()


# Number of most-recent feedback records used for the published mentor rating.
RECENT_RATING_WINDOW = 10
# Historical (Excel-imported) rating is treated as if it were based on this many reviews.
HISTORICAL_RATING_WEIGHT = 3


def _sort_key_created_at(f: dict):
    """Sort feedbacks newest-first; missing created_at goes to the bottom."""
    return f.get("created_at") or ""


def compute_recent_mentor_rating(stored_rating, mentor_feedbacks: list, recent_n: int = RECENT_RATING_WINDOW):
    """
    Return (rating, total_reviews) using only the most-recent `recent_n` real
    feedbacks blended with any historical (Excel) baseline rating.

    - real_feedbacks  = feedbacks not flagged as historical, sorted newest-first
                        and trimmed to `recent_n`
    - stored_rating   = baseline imported rating from Excel (may be None)
    - total_reviews   = full count of feedbacks (display-only, not windowed)
    """
    real_feedbacks = [f for f in mentor_feedbacks if not f.get("is_historical", False)]
    real_feedbacks.sort(key=_sort_key_created_at, reverse=True)
    recent_feedbacks = real_feedbacks[:recent_n]

    total_reviews = len(mentor_feedbacks)

    if stored_rating is not None and recent_feedbacks:
        new_ratings_sum = sum(f.get("rating_overall", 5) for f in recent_feedbacks)
        new_ratings_count = len(recent_feedbacks)
        blended = (stored_rating * HISTORICAL_RATING_WEIGHT + new_ratings_sum) / (HISTORICAL_RATING_WEIGHT + new_ratings_count)
        return round(blended, 1), total_reviews
    if stored_rating is not None:
        return round(float(stored_rating), 1), total_reviews
    if recent_feedbacks:
        avg = sum(f.get("rating_overall", 5) for f in recent_feedbacks) / len(recent_feedbacks)
        return round(avg, 1), total_reviews
    return None, 0


# Pydantic models for request bodies
class BookSessionRequest(BaseModel):
    date: str
    time_slot: str
    session_type: str  # Case session, FIIT session, PEI session, CV review session, General discussion
    case_type: Optional[str] = None  # Only for Case sessions
    candidate_notes: Optional[str] = None


@router.get("")
async def get_mentors(request: Request, slim: bool = False):
    """Get all mentors with their availability (excludes hidden and deleted mentors).

    Pass `?slim=true` to drop heavy/private fields (availability, bio, email,
    phone, linkedin, expertise, embedded logo blobs) — used by public list
    surfaces (home carousel, /mentors directory) where these aren't displayed.
    Significantly reduces payload size on production where pictures are
    base64-encoded and availability arrays can be hundreds of KB per mentor.
    """
    db = get_db(request)
    return await _get_mentors_listing(db, featured_only=False, slim=slim)


@router.get("/featured")
async def get_featured_mentors(request: Request, slim: bool = False):
    """Public endpoint — returns ONLY mentors that the admin has flagged as
    `is_landing_featured = true`. Used by the landing-page + public coaching
    page mentor carousel. Supports `?slim=true` for a smaller payload."""
    db = get_db(request)
    return await _get_mentors_listing(db, featured_only=True, slim=slim)


# Fields excluded from the slim listing response. These are large/private and
# never displayed on public mentor cards.
_SLIM_EXCLUDE_FIELDS = {
    # Heavy blobs
    "availability": 0,
    "bio": 0,
    "consulting_firm_logo": 0,
    "current_company_logo": 0,
    "blocked_days": 0,
    # Private / sensitive — NEVER expose to frontend listing
    "email": 0,
    "phone": 0,
    "linkedin": 0,
    "expertise": 0,
    "google_calendar_credentials": 0,   # OAuth tokens!
    "google_calendar_email": 0,
    "google_calendar_last_synced": 0,
    "google_calendar_connected": 0,
    "oauth_state": 0,
    "oauth_state_created": 0,
    "user_id": 0,
    # Internal admin fields not needed on cards
    "strategy_call_approval_pending": 0,
    "strategy_call_requested_at": 0,
    "rating_updated_at": 0,
    "created_at": 0,
    "updated_at": 0,
    "status": 0,
}


async def _get_mentors_listing(db, featured_only: bool = False, slim: bool = False):
    """Shared core for the public mentor list endpoints."""
    # Check in-memory cache first (60s TTL)
    cache_key = f"mentors_{'featured' if featured_only else 'all'}_{'slim' if slim else 'full'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    query = {
        "is_hidden": {"$ne": True},
        "is_deleted": {"$ne": True},
    }
    if featured_only:
        query["is_landing_featured"] = True

    projection = {"_id": 0, "profile_picture": 0}
    if slim:
        projection.update(_SLIM_EXCLUDE_FIELDS)

    mentors_cursor = db.mentors.find(
        query,
        projection,
    ).sort("display_order", 1)
    mentors = await mentors_cursor.to_list(100)
    
    # If no mentors, return empty list
    if not mentors:
        return []
    
    # Get all mentor IDs for batched queries
    mentor_ids = [m.get("id") for m in mentors if m.get("id")]
    
    # Batch query 1: Get all feedbacks for all mentors at once
    all_feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": {"$in": mentor_ids}},
        {"mentor_id": 1, "rating_overall": 1, "is_historical": 1, "created_at": 1}
    ).to_list(5000)
    
    # Group feedbacks by mentor_id
    feedbacks_by_mentor = {}
    for f in all_feedbacks:
        mid = f.get("mentor_id")
        if mid not in feedbacks_by_mentor:
            feedbacks_by_mentor[mid] = []
        feedbacks_by_mentor[mid].append(f)
    
    # Batch query 2: Get all bookings for all mentors at once
    all_bookings = await db.bookings.find(
        {"mentor_id": {"$in": mentor_ids}, "status": {"$in": ["confirmed", "completed"]}},
        {"mentor_id": 1, "date": 1, "time_slot": 1, "status": 1, "completion_status": 1}
    ).to_list(5000)
    
    # Group bookings by mentor_id
    bookings_by_mentor = {}
    for b in all_bookings:
        mid = b.get("mentor_id")
        if mid not in bookings_by_mentor:
            bookings_by_mentor[mid] = []
        bookings_by_mentor[mid].append(b)
    
    # Get current time for completed session calculation
    from datetime import timezone
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Process each mentor with pre-fetched data
    result = []
    for m in mentors:
        mentor_id = m.get("id")
        
        # Use thumbnail for list view, fallback to full picture or avatar
        picture = m.get("picture_thumbnail") or m.get("picture")
        if not picture:
            picture = f"https://ui-avatars.com/api/?name={m.get('name', 'Mentor')}&background=0D8ABC&color=fff&size=100"
        # In slim mode or for large base64 images, use avatar as fallback
        elif slim and picture.startswith("data:"):
            picture = f"https://ui-avatars.com/api/?name={m.get('name', 'Mentor')}&background=0D8ABC&color=fff&size=100"
        elif picture.startswith("data:") and len(picture) > 50000 and not m.get("picture_thumbnail"):
            picture = f"https://ui-avatars.com/api/?name={m.get('name', 'Mentor')}&background=0D8ABC&color=fff&size=100"
        m["picture"] = picture
        
        # Get rating - average of last RECENT_RATING_WINDOW (10) real feedbacks,
        # blended with historical (Excel) baseline if present.
        mentor_feedbacks = feedbacks_by_mentor.get(mentor_id, [])
        stored_rating = m.get("rating")  # Rating from historical import (Excel)

        rating_value, total_reviews = compute_recent_mentor_rating(stored_rating, mentor_feedbacks)
        m["rating"] = rating_value
        m["total_reviews"] = total_reviews
        
        # Count completed sessions from pre-fetched bookings
        mentor_bookings = bookings_by_mentor.get(mentor_id, [])
        completed_count = 0
        for booking in mentor_bookings:
            booking_date = booking.get("date", "")
            booking_time = booking.get("time_slot", "00:00")
            
            # Count as completed if:
            # 1. Status or completion_status is 'completed', OR
            # 2. Date is in the past, OR
            # 3. Date is today AND session time has passed
            if booking.get("status") == "completed" or booking.get("completion_status") == "completed":
                completed_count += 1
            elif booking_date < today:
                completed_count += 1
            elif booking_date == today:
                try:
                    session_hour, session_min = map(int, booking_time.split(":"))
                    session_minutes = session_hour * 60 + session_min
                    current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                    if current_minutes >= session_minutes:
                        completed_count += 1
                except:
                    pass
        
        # Use the maximum of stored sessions (historical data) and calculated sessions (from bookings)
        stored_sessions = m.get("sessions_conducted", 0) or 0
        m["sessions_conducted"] = max(stored_sessions, completed_count)
        
        m.setdefault("hourly_rate", 12000)
        m.setdefault("specialization", "General")
        if not slim:
            m.setdefault("availability", [])
        m.setdefault("is_active", True)
        
        result.append(m)
    
    # Cache the result for 60 seconds
    _cache_set(cache_key, result)
    return result


@router.get("/earliest-slots")
async def get_all_mentors_earliest_slots(request: Request):
    """Get earliest available slot for all mentors in a single call - optimized for card display"""
    db = get_db(request)
    
    # Get all non-hidden and non-deleted mentors
    mentors = await db.mentors.find(
        {
            "is_hidden": {"$ne": True},
            "is_deleted": {"$ne": True}
        }, 
        {"_id": 1, "id": 1}
    ).to_list(100)
    
    if not mentors:
        return {"slots": {}}
    
    from datetime import timedelta
    import pytz
    
    # Use IST timezone for proper time calculations
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    today = now_ist.date()
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Extract mentor IDs
    mentor_ids = [m.get("id") for m in mentors if m.get("id")]
    
    # Get mentor details including minimum_booking_hours
    mentor_details = await db.mentors.find(
        {"id": {"$in": mentor_ids}},
        {"_id": 0, "id": 1, "minimum_booking_hours": 1, "blocked_days": 1, "max_sessions_per_day": 1}
    ).to_list(100)
    
    # Create mentor settings map
    mentor_settings = {}
    for m in mentor_details:
        mentor_settings[m.get("id")] = {
            "minimum_booking_hours": m.get("minimum_booking_hours", 12),
            "blocked_days": m.get("blocked_days", []),
            "max_sessions_per_day": m.get("max_sessions_per_day", 5)
        }
    
    # Get all weekly availability templates in one query
    all_templates = await db.mentor_weekly_availability.find(
        {"mentor_id": {"$in": mentor_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Group templates by mentor_id
    templates_by_mentor = {}
    for t in all_templates:
        mid = t.get("mentor_id")
        if mid not in templates_by_mentor:
            templates_by_mentor[mid] = []
        templates_by_mentor[mid].append(t)
    
    # Get all bookings for the next 14 days (include duration for proper blocking)
    dates_to_check = []
    for i in range(14):
        date = today + timedelta(days=i)
        dates_to_check.append(date.strftime("%Y-%m-%d"))
    
    all_bookings = await db.bookings.find(
        {
            "date": {"$in": dates_to_check},
            "status": {"$in": ["confirmed", "pending", "reschedule_pending"]}
        },
        {"_id": 0, "mentor_id": 1, "date": 1, "time_slot": 1, "duration": 1}
    ).to_list(5000)
    
    # ALSO get booked_slots from mentor_availability collection
    # This ensures consistency with the booking modal
    all_availability = await db.mentor_availability.find(
        {
            "mentor_id": {"$in": mentor_ids},
            "date": {"$in": dates_to_check}
        },
        {"_id": 0, "mentor_id": 1, "date": 1, "booked_slots": 1}
    ).to_list(5000)
    
    # Group availability booked_slots by mentor_id and date
    availability_booked = {}
    for avail in all_availability:
        mid = avail.get("mentor_id")
        date = avail.get("date")
        booked_slots = avail.get("booked_slots", [])
        if mid and date and booked_slots:
            if mid not in availability_booked:
                availability_booked[mid] = {}
            if date not in availability_booked[mid]:
                availability_booked[mid][date] = []
            availability_booked[mid][date].extend(booked_slots)
    
    # Group bookings by mentor_id and date, with proper duration-based blocking
    # Default session duration is 60 minutes
    DEFAULT_SESSION_DURATION = 60
    bookings_by_mentor = {}
    
    for b in all_bookings:
        mid = b.get("mentor_id")
        date = b.get("date")
        time_slot = b.get("time_slot")
        duration = b.get("duration", DEFAULT_SESSION_DURATION)
        
        if mid not in bookings_by_mentor:
            bookings_by_mentor[mid] = {}
        if date not in bookings_by_mentor[mid]:
            bookings_by_mentor[mid][date] = []
        
        # Parse the booked time slot and block all overlapping slots
        try:
            hour, minute = map(int, time_slot.split(':'))
            start_minutes = hour * 60 + minute
            
            # FORWARD BLOCKING: Block all slots within the session duration
            blocked_minutes = start_minutes
            while blocked_minutes < start_minutes + duration:
                blocked_hour = blocked_minutes // 60
                blocked_minute = blocked_minutes % 60
                blocked_slot = f"{blocked_hour:02d}:{blocked_minute:02d}"
                if blocked_slot not in bookings_by_mentor[mid][date]:
                    bookings_by_mentor[mid][date].append(blocked_slot)
                blocked_minutes += 30
            
            # BACKWARD BLOCKING: Block slots that would overlap with this booking
            # If 9:30 is booked, 9:00 should be blocked (since 9:00 + 60 mins overlaps)
            backward_minutes = start_minutes - 30
            while backward_minutes >= start_minutes - duration + 30 and backward_minutes >= 0:
                backward_hour = backward_minutes // 60
                backward_minute = backward_minutes % 60
                backward_slot = f"{backward_hour:02d}:{backward_minute:02d}"
                if backward_slot not in bookings_by_mentor[mid][date]:
                    bookings_by_mentor[mid][date].append(backward_slot)
                backward_minutes -= 30
                
        except (ValueError, AttributeError):
            # If parsing fails, just block the single slot
            if time_slot not in bookings_by_mentor[mid][date]:
                bookings_by_mentor[mid][date].append(time_slot)
    
    # Calculate earliest slot for each mentor
    slots = {}
    
    for mentor in mentors:
        mentor_id = mentor.get("id")
        if not mentor_id:
            continue
        
        # Get this mentor's templates
        weekly_template = templates_by_mentor.get(mentor_id, [])
        
        # Build day-to-slots map
        day_to_slots = {}
        for entry in weekly_template:
            day_name = entry.get("day")
            template_slots = entry.get("slots", [])
            if day_name and template_slots:
                expanded_slots = []
                for slot_range in template_slots:
                    from_time = slot_range.get("from", "09:00")
                    to_time = slot_range.get("to", "17:00")
                    from_parts = from_time.split(":")
                    to_parts = to_time.split(":")
                    from_minutes = int(from_parts[0]) * 60 + int(from_parts[1])
                    to_minutes = int(to_parts[0]) * 60 + int(to_parts[1])
                    
                    current = from_minutes
                    while current < to_minutes:
                        hour = current // 60
                        minute = current % 60
                        expanded_slots.append(f"{hour:02d}:{minute:02d}")
                        current += 30
                day_to_slots[day_name] = expanded_slots
        
        # Merge booking data from both sources:
        # 1. bookings_by_mentor (from db.bookings with duration-based blocking)
        # 2. availability_booked (from db.mentor_availability.booked_slots)
        mentor_bookings = bookings_by_mentor.get(mentor_id, {})
        mentor_avail_booked = availability_booked.get(mentor_id, {})
        
        # Merge the two dictionaries
        combined_booked = {}
        for date_str in set(list(mentor_bookings.keys()) + list(mentor_avail_booked.keys())):
            combined_booked[date_str] = list(set(
                mentor_bookings.get(date_str, []) + 
                mentor_avail_booked.get(date_str, [])
            ))
        
        # Get mentor-specific settings
        settings = mentor_settings.get(mentor_id, {})
        minimum_booking_hours = settings.get("minimum_booking_hours", 12)
        blocked_days = settings.get("blocked_days", [])
        
        # Calculate minimum booking time for this mentor
        min_booking_time = now_ist + timedelta(hours=minimum_booking_hours)
        
        for i in range(14):
            date = today + timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            day_name = day_names[date.weekday()]
            
            # Skip blocked days
            if date_str in blocked_days:
                continue
            
            # Get slots for this day
            day_slots = day_to_slots.get(day_name, [])
            if not day_slots:
                continue
            
            # Get booked slots for this date (from combined sources)
            booked = combined_booked.get(date_str, [])
            
            # Filter available slots - must be at least minimum_booking_hours in the future
            for slot in day_slots:
                slot_h, slot_m = map(int, slot.split(':'))
                # Create datetime for this slot in IST
                slot_datetime = ist.localize(datetime(date.year, date.month, date.day, slot_h, slot_m))
                
                # Skip slots that are less than minimum_booking_hours in the future
                if slot_datetime < min_booking_time:
                    continue
                
                # Check if not booked
                if slot not in booked:
                    slots[mentor_id] = {
                        "date": date_str,
                        "time": slot,
                        "day": day_name
                    }
                    break  # Found earliest slot for this mentor
            
            # If found a slot, stop checking more days
            if mentor_id in slots:
                break
    
    return {"slots": slots}



@router.get("/debug/earliest-slot/{mentor_id}")
async def debug_earliest_slot(mentor_id: str, request: Request):
    """Debug: Check why a mentor may not appear in earliest-slots"""
    db = get_db(request)
    
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0, "id": 1, "name": 1, "is_hidden": 1, "is_deleted": 1, "minimum_booking_hours": 1, "blocked_days": 1})
    if not mentor:
        return {"error": "Mentor not found in DB", "mentor_id": mentor_id}
    
    templates = await db.mentor_weekly_availability.find({"mentor_id": mentor_id}, {"_id": 0}).to_list(20)
    
    cached = await db.mentor_availability.find({"mentor_id": mentor_id}, {"_id": 0}).to_list(20)
    
    import pytz
    from datetime import timedelta
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    today = now_ist.date()
    min_hours = mentor.get("minimum_booking_hours", 12)
    min_booking_time = now_ist + timedelta(hours=min_hours)
    blocked = mentor.get("blocked_days", [])
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Expand templates
    day_to_slots = {}
    for entry in templates:
        day_name = entry.get("day")
        slots = entry.get("slots", [])
        if day_name and slots:
            expanded = []
            for sr in slots:
                f, t = sr.get("from", ""), sr.get("to", "")
                if f and t:
                    fm = int(f.split(":")[0]) * 60 + int(f.split(":")[1])
                    tm = int(t.split(":")[0]) * 60 + int(t.split(":")[1])
                    c = fm
                    while c < tm:
                        expanded.append(f"{c//60:02d}:{c%60:02d}")
                        c += 30
            day_to_slots[day_name] = expanded
    
    # Check next 7 days
    day_results = []
    for i in range(7):
        date = today + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        day_name = day_names[date.weekday()]
        day_slots = day_to_slots.get(day_name, [])
        is_blocked = date_str in blocked
        
        available_after_filter = []
        for slot in day_slots:
            sh, sm = map(int, slot.split(':'))
            slot_dt = ist.localize(datetime(date.year, date.month, date.day, sh, sm))
            if slot_dt >= min_booking_time:
                available_after_filter.append(slot)
        
        day_results.append({
            "date": date_str, "day": day_name, "blocked": is_blocked,
            "template_slots": len(day_slots), "after_min_hours_filter": len(available_after_filter),
            "sample_slots": available_after_filter[:3]
        })
    
    return {
        "mentor": mentor,
        "now_ist": now_ist.isoformat(),
        "minimum_booking_hours": min_hours,
        "min_booking_time": min_booking_time.isoformat(),
        "weekly_templates": len(templates),
        "templates_detail": [{"day": t.get("day"), "slots": t.get("slots")} for t in templates],
        "cached_availability_entries": len(cached),
        "day_to_slots_keys": list(day_to_slots.keys()),
        "next_7_days": day_results
    }


@router.get("/logos")
async def get_public_logos(request: Request):
    """Get all logos from the repository (public endpoint for coach cards)"""
    cached = _cache_get("mentor_logos")
    if cached is not None:
        return cached

    db = get_db(request)
    
    logos = await db.logo_repository.find({}, {"_id": 0}).to_list(200)
    
    # Create a lookup dict by company name (case-insensitive)
    logo_map = {}
    for logo in logos:
        if logo.get("name"):
            logo_map[logo["name"].lower()] = logo.get("logo_url")
    
    result = {"logos": logos, "logo_map": logo_map}
    _cache_set("mentor_logos", result)
    return result


@router.get("/{mentor_id}")
async def get_mentor(mentor_id: str, request: Request):
    """Get mentor by ID"""
    db = get_db(request)
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")

    # Add defaults
    if not mentor.get("picture"):
        mentor["picture"] = f"https://ui-avatars.com/api/?name={mentor.get('name', 'Mentor')}&background=0D8ABC&color=fff"

    # Recompute rating from the most recent 10 real candidate feedbacks so the
    # detail view stays in sync with the list view.
    recent_feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": mentor_id, "is_historical": {"$ne": True}},
        {"_id": 0, "rating_overall": 1, "is_historical": 1, "created_at": 1}
    ).sort("created_at", -1).limit(RECENT_RATING_WINDOW).to_list(RECENT_RATING_WINDOW)

    total_count = await db.candidate_feedbacks.count_documents(
        {"mentor_id": mentor_id, "is_historical": {"$ne": True}}
    )

    if recent_feedbacks:
        avg = sum(f.get("rating_overall", 5) for f in recent_feedbacks) / len(recent_feedbacks)
        mentor["rating"] = round(avg, 1)
    mentor["total_reviews"] = total_count

    return mentor


@router.get("/{mentor_id}/availability")
async def get_mentor_availability(mentor_id: str, request: Request):
    """Get mentor availability - returns daily slots for next 14 days with Google Calendar conflicts filtered out"""
    db = get_db(request)
    
    mentor = await db.mentors.find_one({"id": mentor_id})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Get weekly availability template
    weekly_template = await db.mentor_weekly_availability.find(
        {"mentor_id": mentor_id},
        {"_id": 0}
    ).to_list(10)
    
    # Create a map of day name to slots
    day_to_slots = {}
    for entry in weekly_template:
        day_name = entry.get("day")
        slots = entry.get("slots", [])
        if day_name and slots:
            # Convert [{from: "09:00", to: "17:00"}] to ["09:00", "09:30", "10:00", ...]
            expanded_slots = []
            for slot_range in slots:
                from_time = slot_range.get("from", "09:00")
                to_time = slot_range.get("to", "17:00")
                # Generate 30-minute slots between from and to
                from_parts = from_time.split(":")
                to_parts = to_time.split(":")
                from_minutes = int(from_parts[0]) * 60 + int(from_parts[1])
                to_minutes = int(to_parts[0]) * 60 + int(to_parts[1])
                
                current = from_minutes
                while current < to_minutes:
                    hour = current // 60
                    minute = current % 60
                    expanded_slots.append(f"{hour:02d}:{minute:02d}")
                    current += 30  # 30-minute intervals
            day_to_slots[day_name] = expanded_slots
    
    # Get mentor's blocked days, max sessions, and minimum booking hours settings
    blocked_days = mentor.get("blocked_days", [])
    max_sessions_per_day = mentor.get("max_sessions_per_day", 5)
    minimum_booking_hours = mentor.get("minimum_booking_hours", 12)  # Default 12 hours
    
    # Day name mapping
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Generate availability for next 14 days
    from datetime import timedelta
    import pytz
    
    # Use IST timezone for proper time calculations
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    today = now_ist.date()
    
    # Use mentor-specific minimum advance booking time
    min_booking_time = now_ist + timedelta(hours=minimum_booking_hours)
    
    # Determine if mentor has ANY configured availability
    availability = []
    
    for i in range(14):
        date = today + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        day_name = day_names[date.weekday()]
        
        # Skip blocked days
        if date_str in blocked_days:
            continue
        
        # Only show slots from configured weekly template — no defaults
        slots = day_to_slots.get(day_name, [])
        
        # Filter out slots that are less than 12 hours in the future
        if slots:
            filtered_slots = []
            for slot in slots:
                slot_h, slot_m = map(int, slot.split(':'))
                # Create datetime for this slot in IST
                slot_datetime = ist.localize(datetime(date.year, date.month, date.day, slot_h, slot_m))
                
                # Only include slots that are at least 12 hours in the future
                if slot_datetime >= min_booking_time:
                    filtered_slots.append(slot)
            slots = filtered_slots
        
        if slots:
            availability.append({
                "mentor_id": mentor_id,
                "date": date_str,
                "day": day_name,
                "slots": slots,
                "booked_slots": [],
                "max_sessions": max_sessions_per_day
            })
    
    # Get all booking counts and individual booked slots in queries
    dates = [day.get("date") for day in availability]
    
    # Get booking counts for max sessions check
    pipeline = [
        {
            "$match": {
                "mentor_id": mentor_id,
                "date": {"$in": dates},
                "status": {"$in": ["confirmed", "pending", "reschedule_pending"]}
            }
        },
        {
            "$group": {
                "_id": "$date",
                "count": {"$sum": 1}
            }
        }
    ]
    booking_counts = await db.bookings.aggregate(pipeline).to_list(100)
    booking_count_map = {item["_id"]: item["count"] for item in booking_counts}
    
    # Get all individual booked slots with duration consideration
    all_bookings = await db.bookings.find(
        {
            "mentor_id": mentor_id,
            "date": {"$in": dates},
            "status": {"$in": ["confirmed", "pending", "reschedule_pending"]}
        },
        {"_id": 0, "date": 1, "time_slot": 1, "duration": 1}
    ).to_list(1000)
    
    # Create a map of date to ALL blocked time slots (including duration)
    # Default session duration is 60 minutes (2 slots of 30 minutes)
    DEFAULT_SESSION_DURATION_MINUTES = 60
    booked_slots_map = {}
    
    for booking in all_bookings:
        date_str = booking.get("date")
        time_slot = booking.get("time_slot")
        duration = booking.get("duration", DEFAULT_SESSION_DURATION_MINUTES)  # Default 60 minutes
        
        if date_str and time_slot:
            if date_str not in booked_slots_map:
                booked_slots_map[date_str] = []
            
            # Parse the time slot
            try:
                hour, minute = map(int, time_slot.split(':'))
                start_minutes = hour * 60 + minute
                
                # FORWARD BLOCKING: Block all 30-minute slots within the session duration
                # e.g., if 9:00 is booked for 60 mins, block 9:00 and 9:30
                blocked_minutes = start_minutes
                while blocked_minutes < start_minutes + duration:
                    blocked_hour = blocked_minutes // 60
                    blocked_minute = blocked_minutes % 60
                    blocked_slot = f"{blocked_hour:02d}:{blocked_minute:02d}"
                    if blocked_slot not in booked_slots_map[date_str]:
                        booked_slots_map[date_str].append(blocked_slot)
                    blocked_minutes += 30  # Move to next 30-minute slot
                
                # BACKWARD BLOCKING: Block slots that would overlap with this booking
                # e.g., if 9:30 is booked, block 9:00 as well (since 9:00 + 60 mins overlaps with 9:30)
                # We need to block any slot where (slot_start + session_duration > booked_start)
                backward_minutes = start_minutes - 30  # Start checking from 30 mins before
                while backward_minutes >= start_minutes - duration + 30 and backward_minutes >= 0:
                    backward_hour = backward_minutes // 60
                    backward_minute = backward_minutes % 60
                    backward_slot = f"{backward_hour:02d}:{backward_minute:02d}"
                    if backward_slot not in booked_slots_map[date_str]:
                        booked_slots_map[date_str].append(backward_slot)
                    backward_minutes -= 30
                    
            except (ValueError, AttributeError):
                # If parsing fails, just block the single slot
                booked_slots_map[date_str].append(time_slot)
    
    # Check existing bookings and max sessions limit, and filter out booked slots
    for day in availability:
        date_str = day.get("date")
        booking_count = booking_count_map.get(date_str, 0)
        
        # If max sessions reached, mark all slots as booked
        if booking_count >= max_sessions_per_day:
            day["booked_slots"] = day["slots"].copy()
            day["max_reached"] = True
        else:
            # Filter out already-booked individual slots
            booked_times = booked_slots_map.get(date_str, [])
            if booked_times:
                # Remove booked slots from available slots
                available_slots = [slot for slot in day["slots"] if slot not in booked_times]
                day["slots"] = available_slots
                day["booked_slots"] = booked_times
    
    # === SESSION DURATION FILTERING ===
    # A 60-minute session starting at slot X needs BOTH X and X+30 to be free.
    # Remove slots where the full session would overlap with blocked slots.
    SESSION_DURATION_MINUTES = 60
    for day in availability:
        if day.get("max_reached"):
            continue
        
        date_str = day.get("date")
        booked_times_set = set(booked_slots_map.get(date_str, []))
        fully_available_slots = []
        
        for slot in day["slots"]:
            try:
                hour, minute = map(int, slot.split(':'))
                start_minutes = hour * 60 + minute
                
                # Check all 30-minute intervals within the session duration
                all_clear = True
                check_minutes = start_minutes
                while check_minutes < start_minutes + SESSION_DURATION_MINUTES:
                    check_slot = f"{check_minutes // 60:02d}:{check_minutes % 60:02d}"
                    if check_slot in booked_times_set:
                        all_clear = False
                        break
                    check_minutes += 30
                
                if all_clear:
                    fully_available_slots.append(slot)
                else:
                    # Add to booked_slots for frontend reference
                    if slot not in day.get("booked_slots", []):
                        day.setdefault("booked_slots", []).append(slot)
            except (ValueError, AttributeError):
                fully_available_slots.append(slot)
        
        day["slots"] = fully_available_slots
    
    # Check if mentor has Google Calendar connected and filter out busy slots
    if mentor.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch
            
            # Get start and end dates for the batch query
            if availability:
                start_date = availability[0].get("date")
                end_date = availability[-1].get("date")
                
                # Fetch all busy slots in one API call
                busy_slots_by_date = await get_mentor_busy_slots_batch(db, mentor_id, start_date, end_date)
                
                # Apply busy slots to each day — REMOVE from slots AND add to booked_slots
                for day in availability:
                    date_str = day.get("date")
                    if date_str and not day.get("max_reached"):
                        busy_slots = busy_slots_by_date.get(date_str, [])
                        if busy_slots:
                            busy_set = set(busy_slots)
                            booked_slots = day.get("booked_slots", [])
                            combined_booked = list(set(booked_slots + busy_slots))
                            day["booked_slots"] = combined_booked
                            day["google_calendar_conflicts"] = busy_slots
                            
                            # Remove Google Calendar busy slots from available slots
                            day["slots"] = [s for s in day["slots"] if s not in busy_set]
                            
                            # Also remove slots where full session would overlap with busy slots
                            all_blocked = set(combined_booked)
                            fully_available = []
                            for slot in day["slots"]:
                                try:
                                    h, m = map(int, slot.split(':'))
                                    start_min = h * 60 + m
                                    clear = True
                                    check = start_min
                                    while check < start_min + SESSION_DURATION_MINUTES:
                                        cs = f"{check // 60:02d}:{check % 60:02d}"
                                        if cs in all_blocked:
                                            clear = False
                                            break
                                        check += 30
                                    if clear:
                                        fully_available.append(slot)
                                except (ValueError, AttributeError):
                                    fully_available.append(slot)
                            day["slots"] = fully_available
        except Exception as e:
            # Log but don't fail - calendar sync is optional
            print(f"Error fetching Google Calendar busy slots: {e}")
    
    # Remove days with no available slots
    availability = [day for day in availability if day.get("slots")]
    
    return availability


@router.post("/{mentor_id}/book")
async def book_session(
    mentor_id: str,
    request: Request,
    booking_data: BookSessionRequest = None,
    # Keep query params for backward compatibility
    date: str = None,
    time_slot: str = None,
    notes: str = None
):
    """Book a session with mentor"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get data from body or query params (prefer body)
    if booking_data:
        date = booking_data.date
        time_slot = booking_data.time_slot
        session_type = booking_data.session_type
        case_type = booking_data.case_type
        candidate_notes = booking_data.candidate_notes
    else:
        # Legacy query param support
        session_type = "General discussion"
        case_type = None
        candidate_notes = notes
    
    # Validate session type
    valid_session_types = ["Case session", "Fit Interview", "PEI session", "CV review session", "General discussion"]
    if session_type not in valid_session_types:
        raise HTTPException(status_code=400, detail=f"Invalid session type. Must be one of: {valid_session_types}")
    
    # Validate case type if session type is Case session
    if session_type == "Case session":
        valid_case_types = ["Profitability", "Market Entry", "Guesstimate", "Pricing", "Growth", "M&A", "Unconventional", "Random"]
        if case_type and case_type not in valid_case_types:
            raise HTTPException(status_code=400, detail=f"Invalid case type. Must be one of: {valid_case_types}")
    
    # Check if user has coaching plan or sessions
    coaching_plans = [PlanType.LAST_MILE, PlanType.MID_MILE, PlanType.FULL_PREP]
    cohort_plans = [PlanType.COHORT_PREMIUM, PlanType.COHORT_ELITE]
    
    user_plan = user.get("plan", "")
    coaching_plans = [PlanType.LAST_MILE, PlanType.MID_MILE, PlanType.FULL_PREP, PlanType.PINNACLE]
    cohort_plans = [PlanType.COHORT_PREMIUM, PlanType.COHORT_ELITE]
    
    has_coaching = user_plan in [p.value for p in coaching_plans]
    has_cohort = user_plan in [p.value for p in cohort_plans]
    
    # Check if user has unlimited coaching (Pinnacle plan or coaching_sessions_total = -1)
    is_unlimited_coaching = (
        user_plan.lower() == "pinnacle" or 
        user.get("coaching_sessions_total") == -1 or
        user.get("is_unlimited_coaching", False)
    )
    
    # Also check if user has purchased single sessions (coaching_sessions_remaining > 0)
    has_purchased_sessions = (user.get("coaching_sessions_remaining") or 0) > 0
    
    # Allow booking if:
    # 1. User has unlimited coaching (Pinnacle)
    # 2. User has a coaching plan with remaining sessions
    # 3. User has a cohort plan
    # 4. User has purchased single sessions
    if is_unlimited_coaching or has_purchased_sessions:
        # User can book - has unlimited or purchased sessions
        pass
    elif has_coaching:
        # Check remaining sessions
        sessions_used = user.get("coaching_sessions_used", 0)
        sessions_total = user.get("coaching_sessions_total", 0)
        if sessions_total > 0 and sessions_used >= sessions_total:
            raise HTTPException(
                status_code=403,
                detail="No coaching sessions remaining. Please upgrade your plan."
            )
    elif has_cohort:
        # Cohort users can book
        pass
    else:
        raise HTTPException(
            status_code=403,
            detail="Please purchase a coaching plan to book sessions."
        )
    
    # Check availability - always read fresh from weekly template (no stale cache)
    from datetime import datetime as dt
    try:
        booking_date = dt.strptime(date, "%Y-%m-%d")
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_name = day_names[booking_date.weekday()]
        
        weekly_availability = await db.mentor_weekly_availability.find(
            {"mentor_id": mentor_id, "day": day_name}
        ).to_list(10)
        
        if weekly_availability:
            expanded_slots = []
            for entry in weekly_availability:
                slots = entry.get("slots", [])
                for slot_range in slots:
                    from_time = slot_range.get("from", "09:00")
                    to_time = slot_range.get("to", "17:00")
                    from_parts = from_time.split(":")
                    to_parts = to_time.split(":")
                    from_minutes = int(from_parts[0]) * 60 + int(from_parts[1])
                    to_minutes = int(to_parts[0]) * 60 + int(to_parts[1])
                    current = from_minutes
                    while current < to_minutes:
                        hour = current // 60
                        minute = current % 60
                        expanded_slots.append(f"{hour:02d}:{minute:02d}")
                        current += 30
            
            if not expanded_slots:
                raise HTTPException(status_code=400, detail="No available slots for this day")
            
            availability = {
                "mentor_id": mentor_id,
                "date": date,
                "slots": expanded_slots,
                "booked_slots": []
            }
        else:
            raise HTTPException(status_code=400, detail="Mentor is not available on this day")
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Also check for already booked sessions in the bookings collection
    # Include duration to properly check for overlapping sessions
    # IMPORTANT: Must match availability endpoint filter - only active statuses block slots.
    # Cancelled/completed/no-show/rescheduled statuses should NOT block the slot.
    existing_bookings = await db.bookings.find({
        "mentor_id": mentor_id,
        "date": date,
        "status": {"$in": ["confirmed", "pending", "reschedule_pending"]}
    }, {"time_slot": 1, "duration": 1}).to_list(100)
    
    # Build a comprehensive list of all blocked slots considering duration
    # This includes BOTH forward and backward blocking
    DEFAULT_SESSION_DURATION = 60  # 60 minutes default
    existing_booked_slots = []
    for booking in existing_bookings:
        booked_time = booking.get("time_slot")
        duration = booking.get("duration", DEFAULT_SESSION_DURATION)
        if booked_time:
            try:
                # Parse the booked time and block all slots within duration
                if " AM" in booked_time or " PM" in booked_time:
                    from datetime import datetime as dt
                    parsed = dt.strptime(booked_time, "%I:%M %p")
                    booked_time = parsed.strftime("%H:%M")
                
                hour, minute = map(int, booked_time.split(':'))
                start_minutes = hour * 60 + minute
                
                # FORWARD BLOCKING: Block all 30-minute slots within the session duration
                current = start_minutes
                while current < start_minutes + duration:
                    blocked_hour = current // 60
                    blocked_minute = current % 60
                    blocked_slot = f"{blocked_hour:02d}:{blocked_minute:02d}"
                    if blocked_slot not in existing_booked_slots:
                        existing_booked_slots.append(blocked_slot)
                    current += 30
                
                # BACKWARD BLOCKING: Block slots that would overlap with this booking
                # e.g., if 9:30 is booked, block 9:00 as well (since 9:00 + 60 mins overlaps with 9:30)
                backward_minutes = start_minutes - 30
                while backward_minutes >= start_minutes - duration + 30 and backward_minutes >= 0:
                    backward_hour = backward_minutes // 60
                    backward_minute = backward_minutes % 60
                    backward_slot = f"{backward_hour:02d}:{backward_minute:02d}"
                    if backward_slot not in existing_booked_slots:
                        existing_booked_slots.append(backward_slot)
                    backward_minutes -= 30
                    
            except (ValueError, AttributeError):
                existing_booked_slots.append(booked_time)
    
    # Support both 'slots' and 'time_slots' field names
    time_slots = availability.get("slots", availability.get("time_slots", []))
    booked_slots = availability.get("booked_slots", [])
    
    # Combine booked_slots from availability with existing bookings
    all_booked_slots = list(set(booked_slots + existing_booked_slots))
    
    # Normalize time slot format (handle "10:00 AM" -> "10:00" conversion)
    normalized_time_slot = time_slot
    if " AM" in time_slot or " PM" in time_slot:
        # Convert 12-hour format to 24-hour format
        try:
            from datetime import datetime as dt
            parsed_time = dt.strptime(time_slot, "%I:%M %p")
            normalized_time_slot = parsed_time.strftime("%H:%M")
        except ValueError:
            pass
    
    # Also normalize slots in availability for comparison
    normalized_time_slots = []
    for slot in time_slots:
        if " AM" in slot or " PM" in slot:
            try:
                from datetime import datetime as dt
                parsed = dt.strptime(slot, "%I:%M %p")
                normalized_time_slots.append(parsed.strftime("%H:%M"))
            except ValueError:
                normalized_time_slots.append(slot)
        else:
            normalized_time_slots.append(slot)
    
    if normalized_time_slot not in normalized_time_slots and time_slot not in time_slots:
        raise HTTPException(status_code=400, detail=f"Time slot {time_slot} not available. Available slots: {time_slots}")
    
    # Check booked slots with normalization too
    normalized_booked_slots = []
    for slot in all_booked_slots:
        if " AM" in slot or " PM" in slot:
            try:
                from datetime import datetime as dt
                parsed = dt.strptime(slot, "%I:%M %p")
                normalized_booked_slots.append(parsed.strftime("%H:%M"))
            except ValueError:
                normalized_booked_slots.append(slot)
        else:
            normalized_booked_slots.append(slot)
    
    # Check if ANY of the slots needed for this session (considering duration) are already booked
    # This includes both forward slots AND backward check for overlapping bookings
    SESSION_DURATION_MINUTES = 60
    slots_needed_for_booking = []
    try:
        hour, minute = map(int, normalized_time_slot.split(':'))
        start_minutes = hour * 60 + minute
        
        # FORWARD: All slots this booking will occupy
        current = start_minutes
        while current < start_minutes + SESSION_DURATION_MINUTES:
            needed_hour = current // 60
            needed_minute = current % 60
            slots_needed_for_booking.append(f"{needed_hour:02d}:{needed_minute:02d}")
            current += 30
            
    except (ValueError, AttributeError):
        slots_needed_for_booking = [normalized_time_slot]
    
    # Check if any of the slots we need are already booked
    for needed_slot in slots_needed_for_booking:
        if needed_slot in normalized_booked_slots or needed_slot in all_booked_slots:
            raise HTTPException(status_code=400, detail=f"Time slot {time_slot} conflicts with an existing booking. The slot or a portion of the session duration is already booked.")
    
    # Get mentor details for calendar invite
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Check Google Calendar for conflicts (same method as availability endpoint)
    if mentor.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch, _calendar_cache
            # Clear cache for fresh data at booking time
            keys_to_clear = [k for k in _calendar_cache if k.startswith(f"{mentor_id}:")]
            for k in keys_to_clear:
                del _calendar_cache[k]
            
            busy_slots_by_date = await get_mentor_busy_slots_batch(db, mentor_id, date, date)
            busy_times = set(busy_slots_by_date.get(date, []))
            
            for needed_slot in slots_needed_for_booking:
                if needed_slot in busy_times:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Time slot {time_slot} is blocked on the mentor's calendar. Please select a different time."
                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"Google Calendar check during booking failed: {e}")
    
    # Validate minimum booking window
    import pytz
    minimum_booking_hours = mentor.get("minimum_booking_hours", 12)  # Default 12 hours
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    
    # Parse the booking date and time
    try:
        booking_datetime_naive = datetime.strptime(f"{date} {time_slot}", "%Y-%m-%d %H:%M")
        booking_datetime_ist = ist.localize(booking_datetime_naive)
        
        # Calculate time difference
        time_until_booking = booking_datetime_ist - now_ist
        hours_until_booking = time_until_booking.total_seconds() / 3600
        
        if hours_until_booking < minimum_booking_hours:
            raise HTTPException(
                status_code=400, 
                detail=f"This mentor requires at least {minimum_booking_hours} hours advance notice. Please book a session that is at least {minimum_booking_hours} hours in the future."
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date or time format: {str(e)}")
    
    # Build session notes for calendar including session type
    calendar_notes = f"Session Type: {session_type}"
    if session_type == "Case session" and case_type:
        calendar_notes += f"\nCase Type: {case_type}"
    if candidate_notes:
        calendar_notes += f"\n\nCandidate Notes:\n{candidate_notes}"
    
    # Create calendar event with Google Meet link
    from services.calendar_service import create_coaching_session_event
    calendar_result = create_coaching_session_event(
        mentor_name=mentor.get("name", "Mentor"),
        mentor_email=mentor.get("email", ""),
        candidate_name=user.get("name", "Candidate"),
        candidate_email=user.get("email", ""),
        session_date=date,
        session_time=time_slot,
        duration_minutes=45,
        session_notes=calendar_notes
    )
    
    # Create booking
    booking = SessionBooking(
        user_id=user.get("id"),
        mentor_id=mentor_id,
        date=date,
        time_slot=time_slot,
        status=BookingStatus.CONFIRMED,
        notes=candidate_notes
    )
    
    booking_dict = booking.dict()
    
    # Add session duration (60 minutes = 1 hour sessions)
    SESSION_DURATION_MINUTES = 60
    booking_dict["duration"] = SESSION_DURATION_MINUTES
    
    # Add session type and case type to booking
    booking_dict["session_type"] = session_type
    if session_type == "Case session" and case_type:
        booking_dict["case_type"] = case_type
    booking_dict["candidate_notes"] = candidate_notes
    booking_dict["candidate_name"] = user.get("name", "Candidate")
    booking_dict["candidate_email"] = user.get("email")
    
    # Store phone data for reminders (so reminder service doesn't need to look up user)
    booking_dict["candidate_phone"] = user.get("phone_number") or user.get("phone")
    booking_dict["candidate_country_code"] = user.get("phone_country_code", "+91")
    booking_dict["mentor_name"] = mentor.get("name", "Mentor")
    booking_dict["mentor_email"] = mentor.get("email")
    booking_dict["mentor_phone"] = mentor.get("phone_number") or mentor.get("phone")
    booking_dict["mentor_country_code"] = mentor.get("phone_country_code", "+91")
    
    # Add calendar event details if created successfully
    if calendar_result:
        booking_dict["calendar_event_id"] = calendar_result.get("event_id")
        booking_dict["hidden_event_id"] = calendar_result.get("hidden_event_id")  # Hidden event holds the Meet link
        booking_dict["meet_link"] = calendar_result.get("meet_link")
        # CRITICAL: persist meet_space_name so the post-session artifact-
        # fetcher can pull recording + transcript via the Meet REST API.
        # Without this field saved on the booking, the scheduler can't
        # locate the recording for this session even though Google has it.
        booking_dict["meet_space_name"] = calendar_result.get("meet_space_name")
        booking_dict["calendar_html_link"] = calendar_result.get("html_link")
    
    await db.bookings.insert_one(booking_dict)
    
    # Remove MongoDB _id from response
    booking_dict.pop("_id", None)
    
    # Update availability - block ALL slots within the session duration
    # For a 60-minute session starting at 18:00, we need to block both 18:00 and 18:30
    slots_to_block = []
    try:
        hour, minute = map(int, normalized_time_slot.split(':'))
        start_minutes = hour * 60 + minute
        
        # Block all 30-minute slots within the session duration
        current_minutes = start_minutes
        while current_minutes < start_minutes + SESSION_DURATION_MINUTES:
            blocked_hour = current_minutes // 60
            blocked_minute = current_minutes % 60
            slots_to_block.append(f"{blocked_hour:02d}:{blocked_minute:02d}")
            current_minutes += 30  # Move to next 30-minute slot
    except (ValueError, AttributeError):
        # If parsing fails, just block the single slot
        slots_to_block = [time_slot]
    
    # Update mentor_availability with all blocked slots
    await db.mentor_availability.update_one(
        {"mentor_id": mentor_id, "date": date},
        {"$addToSet": {"booked_slots": {"$each": slots_to_block}}},
        upsert=True
    )
    
    # Deduct coaching session credit based on user's access type
    user_id = user.get("id")
    
    if is_unlimited_coaching:
        # Unlimited users: just track usage, don't deduct
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"coaching_sessions_used": 1}}
        )
    elif has_purchased_sessions:
        # Users who purchased sessions: deduct from coaching_sessions_remaining
        await db.users.update_one(
            {"id": user_id},
            {
                "$inc": {
                    "coaching_sessions_remaining": -1,
                    "coaching_sessions_used": 1
                }
            }
        )
    elif has_coaching:
        # Users with coaching plans: track usage against their total
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"coaching_sessions_used": 1}}
        )
    elif has_cohort:
        # Cohort users: track usage
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"coaching_sessions_used": 1}}
        )
    
    response = {
        "message": "Session booked successfully", 
        "booking": booking_dict,
        "join_instructions": "Log in to your dashboard and click 'Join Now' when it's time for your session."
    }
    
    if calendar_result:
        # Don't expose meet_link in response - users must join via dashboard
        response["calendar_invite_sent"] = True
    else:
        response["calendar_invite_sent"] = False
        response["calendar_note"] = "Calendar invite could not be sent. Please check mentor email configuration."
    
    # Send WhatsApp notifications to both candidate and mentor (fire and forget)
    try:
        await send_booking_whatsapp_notifications(
            candidate_name=user.get("name", "Candidate"),
            candidate_phone=user.get("phone_number"),
            candidate_country_code=user.get("phone_country_code", "+91"),
            mentor_name=mentor.get("name", "Mentor"),
            mentor_phone=mentor.get("phone_number") or mentor.get("phone"),  # Try both field names
            mentor_country_code=mentor.get("phone_country_code", "+91"),
            session_date=date,
            session_time=time_slot,
            session_type=session_type
        )
    except Exception as wa_error:
        logger.warning(f"WhatsApp notification failed (non-critical): {wa_error}")
    
    return response


async def send_booking_whatsapp_notifications(
    candidate_name: str,
    candidate_phone: str,
    candidate_country_code: str,
    mentor_name: str,
    mentor_phone: str,
    mentor_country_code: str,
    session_date: str,
    session_time: str,
    session_type: str
):
    """Send WhatsApp notifications to candidate and mentor when a session is booked"""
    
    # Format phone numbers
    def format_phone(phone: str, country_code: str) -> str:
        if not phone:
            return None
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            country_code = country_code if country_code else "+91"
            phone = f"{country_code}{phone}"
        return phone
    
    candidate_full_phone = format_phone(candidate_phone, candidate_country_code)
    mentor_full_phone = format_phone(mentor_phone, mentor_country_code)
    
    # Send to candidate
    # Template params: {{1}}=candidate_name, {{2}}=session_type, {{3}}=mentor_name, {{4}}=date, {{5}}=time
    if candidate_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=candidate_full_phone,
                template_name="candidate_coaching_session_booking",
                parameters=[
                    {"name": "1", "value": candidate_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": mentor_name},
                    {"name": "4", "value": session_date},
                    {"name": "5", "value": session_time}
                ]
            )
            logger.info(f"WhatsApp sent to candidate: {candidate_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp to candidate: {e}")
    
    # Send to mentor
    # Template params: {{1}}=mentor_name, {{2}}=session_type, {{3}}=candidate_name, {{4}}=date, {{5}}=time
    if mentor_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=mentor_full_phone,
                template_name="mentor_coaching_session_booking",
                parameters=[
                    {"name": "1", "value": mentor_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": candidate_name},
                    {"name": "4", "value": session_date},
                    {"name": "5", "value": session_time}
                ]
            )
            logger.info(f"WhatsApp sent to mentor: {mentor_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp to mentor: {e}")


@router.get("/bookings/my")
async def get_my_bookings(request: Request):
    """Get current user's bookings"""
    user = await get_current_user(request)
    db = get_db(request)
    
    bookings = await db.bookings.find({"user_id": user.get("id")}, {"_id": 0}).to_list(500)
    
    # Enrich with mentor info and feedback status
    result = []
    for booking in bookings:
        mentor = await db.mentors.find_one({"id": booking["mentor_id"]})
        booking["mentor_name"] = mentor["name"] if mentor else "Unknown"
        booking["mentor_picture"] = mentor.get("picture") if mentor else None
        booking["mentor_company"] = mentor.get("company") if mentor else None
        
        # Add feedback status
        candidate_feedback = await db.candidate_feedbacks.find_one({"booking_id": booking["id"]})
        booking["candidate_feedback_submitted"] = candidate_feedback is not None
        
        # Add mentor feedback status (so candidate can see if mentor has provided feedback)
        mentor_feedback = await db.mentor_feedbacks.find_one({"booking_id": booking["id"]})
        booking["mentor_feedback_submitted"] = mentor_feedback is not None
        
        # Ensure check-in fields exist with defaults
        booking.setdefault("candidate_checked_in", False)
        booking.setdefault("mentor_checked_in", False)
        
        result.append(booking)
    
    return result


@router.get("/bookings/{booking_id}/recording")
async def get_booking_recording(booking_id: str, request: Request):
    """Return the Drive view URL for the recording / transcript of a
    completed coaching session.
    
    Authorization: only the candidate (booking.user_id) or the mentor
    (booking.mentor_id matches their mentor_id) of the session can read
    it. Admins are also allowed (via is_admin). Per current product
    decision, the candidate dashboard does NOT yet surface a button
    for this — but this endpoint is here so mentors / candidates with
    a direct link can view their own session's recording.
    """
    user = await get_current_user(request)
    db = get_db(request)

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Session not found")

    # Authorization
    is_admin = bool(user.get("is_admin"))
    is_candidate = booking.get("user_id") == user.get("id")
    is_mentor = False
    mentor_id = booking.get("mentor_id")
    if mentor_id and not is_admin and not is_candidate:
        # Match mentor_id either via user.mentor_id (legacy) or via the
        # users-collection mentor_id field — covers both shapes.
        if user.get("mentor_id") == mentor_id:
            is_mentor = True
        else:
            mentor_doc = await db.mentors.find_one({"id": mentor_id, "user_id": user.get("id")}, {"_id": 0, "id": 1})
            is_mentor = mentor_doc is not None
    if not (is_admin or is_candidate or is_mentor):
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    # Lazy refresh — if no URL yet but we do have a meet_space_name,
    # try a one-shot sync. Saves a 30-min wait when the user is curious.
    if booking.get("meet_space_name") and not booking.get("recording_url"):
        try:
            from services.meet_artifacts_service import sync_artifacts_for_booking
            await sync_artifacts_for_booking(db, booking)
            # Re-read fresh values
            booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0}) or booking
        except Exception:  # noqa: BLE001
            pass

    return {
        "booking_id": booking_id,
        "recording_url": booking.get("recording_url"),
        "transcript_url": booking.get("transcript_url"),
        "checked_at": booking.get("meet_artifacts_checked_at"),
        "available": bool(booking.get("recording_url") or booking.get("transcript_url")),
    }


@router.put("/bookings/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: str,
    request: Request,
    new_date: str = None,
    new_time_slot: str = None
):
    """Reschedule a coaching session to a new date/time"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Try to get data from query params first, then from JSON body
    if not new_date or not new_time_slot:
        try:
            data = await request.json()
            new_date = new_date or data.get("date") or data.get("new_date")
            new_time_slot = new_time_slot or data.get("time_slot") or data.get("new_time_slot")
        except:
            pass
    
    if not new_date or not new_time_slot:
        raise HTTPException(status_code=400, detail="new_date and new_time_slot are required")
    
    # Get the existing booking - check both coaching bookings and strategy call sessions
    booking = await db.bookings.find_one({"id": booking_id})
    is_strategy_call = False
    
    if not booking:
        # Check strategy call sessions collection
        booking = await db.strategy_call_sessions.find_one({"id": booking_id})
        if booking:
            is_strategy_call = True
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user owns this booking or is the mentor
    user_id = user.get("id")
    mentor_id_from_user = user.get("mentor_id")
    
    is_owner = booking.get("user_id") == user_id
    is_mentor = user.get("is_mentor") and mentor_id_from_user == booking.get("mentor_id")
    
    if not is_owner and not is_mentor:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this booking")
    
    # Check reschedule policy (same as cancellation policy)
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    
    # Parse original session datetime
    # Parse original session datetime - strategy calls use 'time', coaching uses 'time_slot'
    try:
        session_date = datetime.strptime(booking['date'], '%Y-%m-%d').date()
        time_field = booking.get('time') if is_strategy_call else booking.get('time_slot')
        session_time = datetime.strptime(time_field, '%H:%M').time()
        session_datetime_naive = datetime.combine(session_date, session_time)
        session_datetime_ist = ist.localize(session_datetime_naive)
        
        # Calculate hours until original session
        time_delta = session_datetime_ist - now_ist
        hours_until = time_delta.total_seconds() / 3600
        
        # Get policy settings
        policy = await db.bookings.database.platform_settings.find_one({"type": "cancellation_policy"})
        policy_hours = 4  # Default
        if policy:
            policy_hours = policy.get('mentor_hours', 4) if is_mentor else policy.get('candidate_hours', 4)
        
        # Check if within policy window
        if hours_until < policy_hours:
            role = "Mentors" if is_mentor else "Candidates"
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot reschedule. {role} must reschedule at least {policy_hours} hours before the session. You have {hours_until:.1f} hours remaining."
            )
    except ValueError as e:
        # If date parsing fails, allow rescheduling (backward compatibility)
        pass
    
    # Determine which mentor to use
    mentor_id = booking.get("mentor_id")
    
    # Check new slot availability
    from datetime import datetime as dt
    try:
        booking_date = dt.strptime(new_date, "%Y-%m-%d")
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_name = day_names[booking_date.weekday()]
        
        # First check mentor_availability collection (populated by availability API)
        availability_record = await db.mentor_availability.find_one({
            "mentor_id": mentor_id,
            "date": new_date
        })
        
        available_slots = []
        if availability_record:
            # Use slots from the availability record
            available_slots = availability_record.get("slots", availability_record.get("time_slots", []))
            booked_in_availability = availability_record.get("booked_slots", [])
            # Remove already booked slots
            available_slots = [s for s in available_slots if s not in booked_in_availability]
        else:
            # Fall back to weekly template
            weekly_availability = await db.mentor_weekly_availability.find(
                {"mentor_id": mentor_id, "day": day_name}
            ).to_list(10)
            
            if weekly_availability:
                for entry in weekly_availability:
                    slots = entry.get("slots", [])
                    for slot_range in slots:
                        from_time = slot_range.get("from", "09:00")
                        to_time = slot_range.get("to", "17:00")
                        from_parts = from_time.split(":")
                        to_parts = to_time.split(":")
                        from_minutes = int(from_parts[0]) * 60 + int(from_parts[1])
                        to_minutes = int(to_parts[0]) * 60 + int(to_parts[1])
                        current = from_minutes
                        while current < to_minutes:
                            hour = current // 60
                            minute = current % 60
                            available_slots.append(f"{hour:02d}:{minute:02d}")
                            current += 30
            else:
                raise HTTPException(status_code=400, detail="Mentor is not available on this day")
        
        # Check if slot is available
        if new_time_slot not in available_slots:
            raise HTTPException(status_code=400, detail=f"Time slot {new_time_slot} not available. Available: {available_slots[:10]}")
        
        # Check for existing bookings at this time
        # IMPORTANT: Only active statuses block the slot (must match availability endpoint filter)
        existing = await db.bookings.find_one({
            "mentor_id": mentor_id,
            "date": new_date,
            "time_slot": new_time_slot,
            "status": {"$in": ["confirmed", "pending", "reschedule_pending"]},
            "id": {"$ne": booking_id}  # Exclude current booking
        })
        # Also check strategy call sessions
        existing_strategy = await db.strategy_call_sessions.find_one({
            "mentor_id": mentor_id,
            "date": new_date,
            "time": new_time_slot,
            "status": {"$nin": ["cancelled", "completed"]},
            "id": {"$ne": booking_id}
        })
        if existing or existing_strategy:
            raise HTTPException(status_code=400, detail="Time slot already booked")
        
        # Check full session duration (60 min) doesn't overlap with existing bookings
        SESSION_DURATION = 60
        h, m = map(int, new_time_slot.split(':'))
        start_min = h * 60 + m
        check_min = start_min
        while check_min < start_min + SESSION_DURATION:
            cs = f"{check_min // 60:02d}:{check_min % 60:02d}"
            if cs != new_time_slot:
                overlap_booking = await db.bookings.find_one({
                    "mentor_id": mentor_id, "date": new_date, "time_slot": cs,
                    "status": {"$in": ["confirmed", "pending", "reschedule_pending"]},
                    "id": {"$ne": booking_id}
                })
                overlap_strategy = await db.strategy_call_sessions.find_one({
                    "mentor_id": mentor_id, "date": new_date, "time": cs,
                    "status": {"$nin": ["cancelled", "completed"]},
                    "id": {"$ne": booking_id}
                })
                if overlap_booking or overlap_strategy:
                    raise HTTPException(status_code=400, detail=f"Session duration from {new_time_slot} would overlap with an existing booking at {cs}")
            check_min += 30
        
        # Check Google Calendar for conflicts
        mentor_doc = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
        if mentor_doc and mentor_doc.get("google_calendar_connected"):
            try:
                from routes.mentor_calendar import get_mentor_busy_slots_batch, _calendar_cache
                keys_to_clear = [k for k in _calendar_cache if k.startswith(f"{mentor_id}:")]
                for k in keys_to_clear:
                    del _calendar_cache[k]
                busy_by_date = await get_mentor_busy_slots_batch(db, mentor_id, new_date, new_date)
                busy_times = set(busy_by_date.get(new_date, []))
                check_min = start_min
                while check_min < start_min + SESSION_DURATION:
                    cs = f"{check_min // 60:02d}:{check_min % 60:02d}"
                    if cs in busy_times:
                        raise HTTPException(status_code=400, detail=f"Time slot {new_time_slot} is blocked on the mentor's calendar. Please select a different time.")
                    check_min += 30
            except HTTPException:
                raise
            except Exception as e:
                print(f"Google Calendar check during reschedule failed: {e}")
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get candidate info for notifications
    candidate = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0})
    candidate_name = candidate.get("name", "Candidate") if candidate else "Candidate"
    candidate_email = candidate.get("email", "") if candidate else ""
    
    # Get mentor info
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    mentor_name = mentor.get("name", "Mentor") if mentor else "Mentor"
    mentor_email = mentor.get("email", "") if mentor else ""
    
    # Cancel old calendar events if exist (both visible and hidden)
    from services.calendar_service import get_calendar_service
    service = get_calendar_service()
    if service.is_available():
        old_event_id = booking.get("calendar_event_id")
        if old_event_id:
            service.cancel_event(old_event_id, notify_attendees=True)
        
        # Also cancel the hidden event that holds the Meet link
        old_hidden_event_id = booking.get("hidden_event_id")
        if old_hidden_event_id:
            service.cancel_event(old_hidden_event_id, notify_attendees=False)
    
    # Create new calendar event with updated time
    calendar_result = None
    if mentor_email:
        if is_strategy_call:
            from services.calendar_service import create_strategy_call_event
            import pytz
            ist = pytz.timezone('Asia/Kolkata')
            reschedule_dt = ist.localize(datetime.strptime(f"{new_date} {new_time_slot}", "%Y-%m-%d %H:%M"))
            calendar_result = create_strategy_call_event(
                user_name=candidate_name,
                user_email=candidate_email,
                mentor_name=mentor_name,
                mentor_email=mentor_email,
                start_datetime_ist=reschedule_dt,
                duration_minutes=30,
                notes=f"RESCHEDULED: Originally {booking.get('date')} at {booking.get('time')}"
            )
        else:
            from services.calendar_service import create_coaching_session_event
            calendar_result = create_coaching_session_event(
                mentor_name=mentor_name,
                mentor_email=mentor_email,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                session_date=new_date,
                session_time=new_time_slot,
                duration_minutes=45,
                session_notes=f"RESCHEDULED: Originally {booking.get('date')} at {booking.get('time_slot') or booking.get('time')}"
            )
    
    # Determine who rescheduled
    rescheduled_by = "mentor" if is_mentor else "candidate"
    rescheduled_by_name = user.get("name", "Unknown")
    
    # Generate new booking ID
    import uuid
    new_booking_id = f"reschedule-{uuid.uuid4().hex[:12]}"
    
    # Create NEW booking with the new date/time
    new_booking = {
        "id": new_booking_id,
        "user_id": booking.get("user_id"),
        "mentor_id": booking.get("mentor_id"),
        "date": new_date,
        "session_type": booking.get("session_type"),
        "case_type": booking.get("case_type"),
        "status": "confirmed",
        "booking_type": booking.get("booking_type", "coaching"),
        "created_at": datetime.utcnow().isoformat(),
        "candidate_name": booking.get("candidate_name") or candidate_name,
        "candidate_email": booking.get("candidate_email") or candidate_email,
        "mentor_name": booking.get("mentor_name") or mentor_name,
        "mentor_email": booking.get("mentor_email") or mentor_email,
        "duration_minutes": booking.get("duration_minutes", 45 if not is_strategy_call else 30),
        # Link to original booking
        "rescheduled_from_id": booking_id,
        "rescheduled_from_date": booking.get("date"),
        "rescheduled_from_time": booking.get("time") if is_strategy_call else booking.get("time_slot"),
    }
    
    if is_strategy_call:
        new_booking["time"] = new_time_slot
    else:
        new_booking["time_slot"] = new_time_slot
    
    # Add calendar event details to new booking
    if calendar_result:
        new_booking["calendar_event_id"] = calendar_result.get("event_id")
        new_booking["hidden_event_id"] = calendar_result.get("hidden_event_id")
        new_booking["meet_link"] = calendar_result.get("meet_link")
        # Persist meet_space_name so the rescheduled session's recording
        # can be fetched after it ends.
        new_booking["meet_space_name"] = calendar_result.get("meet_space_name")
        new_booking["calendar_html_link"] = calendar_result.get("html_link")
    
    # Update ORIGINAL booking to rescheduled status based on who rescheduled
    rescheduled_status = "mentor_rescheduled" if is_mentor else "candidate_rescheduled"
    original_update = {
        "status": rescheduled_status,
        "rescheduled_by": rescheduled_by,
        "rescheduled_by_name": rescheduled_by_name,
        "rescheduled_at": datetime.utcnow().isoformat(),
        "rescheduled_to_id": new_booking_id,
        "rescheduled_to_date": new_date,
        "rescheduled_to_time": new_time_slot,
    }
    
    # Update the correct collection for original booking
    collection = db.strategy_call_sessions if is_strategy_call else db.bookings
    await collection.update_one(
        {"id": booking_id},
        {"$set": original_update}
    )
    
    # Insert new booking
    await collection.insert_one(new_booking)
    
    # Dashboard URL for joining sessions
    dashboard_url = "https://consultant-gateway.preview.emergentagent.com/dashboard"
    mentor_dashboard_url = "https://consultant-gateway.preview.emergentagent.com/mentor-dashboard"
    
    # Send email notifications to both parties
    from routes.auth import send_email_via_gmail
    from routes.strategy_calls import format_session_for_user_tz

    # Resolve recipient timezones (fall back to IST)
    candidate_user = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0, "timezone": 1})
    mentor_user = await db.mentors.find_one({"id": booking.get("mentor_id")}, {"_id": 0, "timezone": 1})
    candidate_tz_name = (candidate_user or {}).get("timezone") or "Asia/Kolkata"
    mentor_tz_name = (mentor_user or {}).get("timezone") or "Asia/Kolkata"

    prev_time = booking.get('time_slot') or booking.get('time') or ""
    prev_date = booking.get('date') or ""

    cand_old = format_session_for_user_tz(prev_date, prev_time, candidate_tz_name)
    cand_new = format_session_for_user_tz(new_date, new_time_slot, candidate_tz_name)
    ment_old = format_session_for_user_tz(prev_date, prev_time, mentor_tz_name)
    ment_new = format_session_for_user_tz(new_date, new_time_slot, mentor_tz_name)

    # Email to candidate
    if candidate_email:
        candidate_subject = f"Session Rescheduled - gradnext"
        candidate_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0ea5e9; margin: 0;">gradnext</h1>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
                <p style="color: #92400e; margin: 0; font-weight: bold;">⚠️ Your session has been rescheduled</p>
            </div>
            
            <p>Hi {candidate_name},</p>
            
            <p>Your coaching session with <strong>{mentor_name}</strong> has been rescheduled by {rescheduled_by_name}.</p>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Previous Time:</strong></p>
                <p style="margin: 0 0 15px 0; text-decoration: line-through; color: #94a3b8;">
                    {cand_old['user_date']} at {cand_old['user_time']} {cand_old['user_tz_abbr']}{'' if cand_old['is_ist_viewer'] else f" ({cand_old['ist_time']} IST)"}
                </p>
                
                <p style="margin: 0 0 10px 0;"><strong>New Time:</strong></p>
                <p style="margin: 0; color: #059669; font-weight: bold;">
                    {cand_new['user_date']} at {cand_new['user_time']} {cand_new['user_tz_abbr']}{'' if cand_new['is_ist_viewer'] else f" ({cand_new['ist_time']} IST)"}
                </p>
            </div>
            
            <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: bold;">📹 How to Join Your Session</p>
                <p style="margin: 0; color: #1e3a8a;">
                    Log in to your dashboard 5 minutes before your session and click the <strong>"Join Now"</strong> button.
                </p>
                <p style="margin: 10px 0 0 0;">
                    <a href="{dashboard_url}" style="color: #2563eb; text-decoration: underline;">Go to Dashboard →</a>
                </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                A calendar reminder has been sent to your email with the updated time.
            </p>
        </body>
        </html>
        """
        await send_email_via_gmail(db, candidate_email, candidate_subject, candidate_html)

    # Email to mentor
    if mentor_email:
        mentor_subject = f"Session Rescheduled - gradnext"
        mentor_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0ea5e9; margin: 0;">gradnext</h1>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
                <p style="color: #92400e; margin: 0; font-weight: bold;">⚠️ Session has been rescheduled</p>
            </div>

            <p>Hi {mentor_name},</p>

            <p>Your coaching session with <strong>{candidate_name}</strong> has been rescheduled by {rescheduled_by_name}.</p>

            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Previous Time:</strong></p>
                <p style="margin: 0 0 15px 0; text-decoration: line-through; color: #94a3b8;">
                    {ment_old['user_date']} at {ment_old['user_time']} {ment_old['user_tz_abbr']}{'' if ment_old['is_ist_viewer'] else f" ({ment_old['ist_time']} IST)"}
                </p>

                <p style="margin: 0 0 10px 0;"><strong>New Time:</strong></p>
                <p style="margin: 0; color: #059669; font-weight: bold;">
                    {ment_new['user_date']} at {ment_new['user_time']} {ment_new['user_tz_abbr']}{'' if ment_new['is_ist_viewer'] else f" ({ment_new['ist_time']} IST)"}
                </p>
            </div>

            <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: bold;">📹 How to Join Your Session</p>
                <p style="margin: 0; color: #1e3a8a;">
                    Log in to your mentor dashboard 5 minutes before the session and click the <strong>"Join Now"</strong> button.
                </p>
                <p style="margin: 10px 0 0 0;">
                    <a href="{mentor_dashboard_url}" style="color: #2563eb; text-decoration: underline;">Go to Mentor Dashboard →</a>
                </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                A calendar reminder has been sent to your email with the updated time.
            </p>
        </body>
        </html>
        """
        await send_email_via_gmail(db, mentor_email, mentor_subject, mentor_html)
    
    # Send WhatsApp notifications to both candidate and mentor (fire and forget)
    try:
        candidate = await db.users.find_one({"id": booking.get("user_id")})
        mentor = await db.mentors.find_one({"id": booking.get("mentor_id")})
        if candidate and mentor:
            await send_reschedule_whatsapp_notifications(
                candidate_name=candidate.get("name", "Candidate"),
                candidate_phone=candidate.get("phone_number"),
                candidate_country_code=candidate.get("phone_country_code", "+91"),
                mentor_name=mentor.get("name", "Mentor"),
                mentor_phone=mentor.get("phone_number") or mentor.get("phone"),  # Try both field names
                mentor_country_code=mentor.get("phone_country_code", "+91"),
                new_date=new_date,
                new_time=new_time_slot,
                session_type=booking.get("session_type", "Coaching session")
            )
    except Exception as wa_error:
        logger.warning(f"WhatsApp reschedule notification failed (non-critical): {wa_error}")
    
    return {
        "message": "Booking rescheduled successfully",
        "new_booking_id": new_booking_id,
        "new_date": new_date,
        "new_time_slot": new_time_slot,
        "original_booking_id": booking_id,
        "original_date": booking.get("date"),
        "original_time_slot": booking.get("time_slot") or booking.get("time"),
        "notifications_sent": True,
        "join_instructions": "Log in to your dashboard and click 'Join Now' when it's time for your session."
    }


@router.delete("/bookings/{booking_id}")
@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, request: Request):
    """Cancel a coaching session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the booking - check both coaching bookings and strategy call sessions
    booking = await db.bookings.find_one({"id": booking_id})
    is_strategy_call = False
    
    if not booking:
        booking = await db.strategy_call_sessions.find_one({"id": booking_id})
        if booking:
            is_strategy_call = True
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user owns this booking or is the mentor
    is_candidate = booking.get("user_id") == user.get("id")
    is_mentor = user.get("is_mentor") and user.get("mentor_id") == booking.get("mentor_id")
    
    if not is_candidate and not is_mentor:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    
    # Check cancellation policy
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    
    # Parse session datetime
    try:
        session_date = datetime.strptime(booking['date'], '%Y-%m-%d').date()
        time_field = booking.get('time') if is_strategy_call else booking.get('time_slot')
        session_time = datetime.strptime(time_field, '%H:%M').time()
        session_datetime_naive = datetime.combine(session_date, session_time)
        session_datetime_ist = ist.localize(session_datetime_naive)
        
        # Calculate hours until session
        time_delta = session_datetime_ist - now_ist
        hours_until = time_delta.total_seconds() / 3600
        
        # Get policy settings
        policy = await db.platform_settings.find_one({"type": "cancellation_policy"})
        policy_hours = 4  # Default
        if policy:
            policy_hours = policy.get('mentor_hours', 4) if is_mentor else policy.get('candidate_hours', 4)
        
        # Check if within policy window
        if hours_until < policy_hours:
            role = "Mentors" if is_mentor else "Candidates"
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot cancel. {role} must cancel at least {policy_hours} hours before the session. You have {hours_until:.1f} hours remaining."
            )
    except ValueError as e:
        # If date parsing fails, allow cancellation (backward compatibility)
        pass
    
    # Free up the slot
    slot_field = "time" if is_strategy_call else "time_slot"
    slot_value = booking.get(slot_field)
    await db.mentor_availability.update_one(
        {"mentor_id": booking.get("mentor_id"), "date": booking.get("date")},
        {"$pull": {"booked_slots": slot_value}}
    )
    
    # Cancel calendar events if exist (both visible and hidden)
    from services.calendar_service import get_calendar_service
    service = get_calendar_service()
    if service.is_available():
        event_id = booking.get("calendar_event_id")
        if event_id:
            try:
                service.cancel_event(event_id, notify_attendees=True)
                logger.info(f"Cancelled calendar event {event_id} for booking {booking_id}")
            except Exception as cal_err:
                logger.warning(f"Failed to cancel calendar event {event_id}: {cal_err}")
        
        # Also cancel the hidden event that holds the Meet link
        hidden_event_id = booking.get("hidden_event_id")
        if hidden_event_id:
            try:
                service.cancel_event(hidden_event_id, notify_attendees=False)
                logger.info(f"Cancelled hidden calendar event {hidden_event_id} for booking {booking_id}")
            except Exception as cal_err:
                logger.warning(f"Failed to cancel hidden calendar event {hidden_event_id}: {cal_err}")
    
    # Refund session to user (regardless of who cancels)
    # This allows candidates to rebook the session
    candidate = await db.users.find_one({"id": booking["user_id"]})
    if candidate:
        candidate_plan = candidate.get("plan", "").lower()
        is_candidate_unlimited = (
            candidate_plan == "pinnacle" or
            candidate.get("is_unlimited_coaching", False) or
            candidate.get("coaching_sessions_total") == -1
        )
        
        if is_candidate_unlimited:
            # Unlimited users: just decrement usage counter
            if candidate.get("coaching_sessions_used", 0) > 0:
                await db.users.update_one(
                    {"id": booking["user_id"]},
                    {"$inc": {"coaching_sessions_used": -1}}
                )
        else:
            # For users with limited sessions: restore the credit
            # Check if they had purchased sessions (coaching_sessions_remaining was used)
            # or if they have a coaching plan (coaching_sessions_used was tracked)
            update_ops = {}
            
            if candidate.get("coaching_sessions_used", 0) > 0:
                update_ops["$inc"] = {"coaching_sessions_used": -1}
            
            # Also restore coaching_sessions_remaining if it was deducted
            # (for users who purchased single sessions)
            coaching_plans = ["last_mile", "mid_mile", "full_prep"]
            if candidate_plan not in coaching_plans:
                # This user likely purchased sessions, restore the credit
                if "$inc" not in update_ops:
                    update_ops["$inc"] = {}
                update_ops["$inc"]["coaching_sessions_remaining"] = 1
            
            if update_ops:
                await db.users.update_one(
                    {"id": booking["user_id"]},
                    update_ops
                )
    
    # Update booking status in the correct collection
    collection = db.strategy_call_sessions if is_strategy_call else db.bookings
    
    # Set specific cancellation status based on who cancelled
    cancellation_status = "mentor_cancelled" if is_mentor else "candidate_cancelled"
    
    logger.info(f"Cancelling booking {booking_id}: is_mentor={is_mentor}, new_status={cancellation_status}")
    
    result = await collection.update_one(
        {"id": booking_id},
        {"$set": {
            "status": cancellation_status,  # Specific cancellation type
            "cancelled_at": datetime.utcnow(),
            "cancelled_by": "mentor" if is_mentor else "candidate"
        }}
    )
    
    logger.info(f"Cancellation update result: matched={result.matched_count}, modified={result.modified_count}")
    
    # For strategy calls, also refund the strategy call credit
    if is_strategy_call and candidate:
        if candidate.get("strategy_calls_used", 0) > 0:
            await db.users.update_one(
                {"id": booking.get("user_id")},
                {"$inc": {"strategy_calls_used": -1}}
            )
    
    # Send WhatsApp notifications to both candidate and mentor (fire and forget)
    try:
        mentor = await db.mentors.find_one({"id": booking.get("mentor_id")})
        if candidate and mentor:
            await send_cancellation_whatsapp_notifications(
                candidate_name=candidate.get("name", "Candidate"),
                candidate_phone=candidate.get("phone_number"),
                candidate_country_code=candidate.get("phone_country_code", "+91"),
                mentor_name=mentor.get("name", "Mentor"),
                mentor_phone=mentor.get("phone_number") or mentor.get("phone"),  # Try both field names
                mentor_country_code=mentor.get("phone_country_code", "+91"),
                session_date=booking.get("date"),
                session_time=booking.get("time_slot") or booking.get("time"),
                session_type=booking.get("session_type", "Coaching session")
            )
    except Exception as wa_error:
        logger.warning(f"WhatsApp cancellation notification failed (non-critical): {wa_error}")
    
    return {"message": "Booking cancelled successfully. Session credit has been restored."}


async def send_cancellation_whatsapp_notifications(
    candidate_name: str,
    candidate_phone: str,
    candidate_country_code: str,
    mentor_name: str,
    mentor_phone: str,
    mentor_country_code: str,
    session_date: str,
    session_time: str,
    session_type: str
):
    """Send WhatsApp notifications to both candidate and mentor when a session is cancelled"""
    
    def format_phone(phone: str, country_code: str) -> str:
        if not phone:
            return None
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            country_code = country_code if country_code else "+91"
            phone = f"{country_code}{phone}"
        return phone
    
    candidate_full_phone = format_phone(candidate_phone, candidate_country_code)
    mentor_full_phone = format_phone(mentor_phone, mentor_country_code)
    
    # Send to candidate
    if candidate_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=candidate_full_phone,
                template_name="candidate_coaching_session_cancellation",
                parameters=[
                    {"name": "1", "value": candidate_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": mentor_name},
                    {"name": "4", "value": session_date},
                    {"name": "5", "value": session_time}
                ]
            )
            logger.info(f"WhatsApp cancellation sent to candidate: {candidate_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp cancellation to candidate: {e}")
    
    # Send to mentor
    if mentor_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=mentor_full_phone,
                template_name="mentor_session_cancellation",
                parameters=[
                    {"name": "1", "value": mentor_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": candidate_name},
                    {"name": "4", "value": session_date},
                    {"name": "5", "value": session_time}
                ]
            )
            logger.info(f"WhatsApp cancellation sent to mentor: {mentor_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp cancellation to mentor: {e}")


async def send_reschedule_whatsapp_notifications(
    candidate_name: str,
    candidate_phone: str,
    candidate_country_code: str,
    mentor_name: str,
    mentor_phone: str,
    mentor_country_code: str,
    new_date: str,
    new_time: str,
    session_type: str
):
    """Send WhatsApp notifications to both candidate and mentor when a session is rescheduled"""
    
    def format_phone(phone: str, country_code: str) -> str:
        if not phone:
            return None
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            country_code = country_code if country_code else "+91"
            phone = f"{country_code}{phone}"
        return phone
    
    candidate_full_phone = format_phone(candidate_phone, candidate_country_code)
    mentor_full_phone = format_phone(mentor_phone, mentor_country_code)
    
    # Send to candidate
    if candidate_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=candidate_full_phone,
                template_name="candidate_coaching_session_reschedule",
                parameters=[
                    {"name": "1", "value": candidate_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": mentor_name},
                    {"name": "4", "value": new_date},
                    {"name": "5", "value": new_time}
                ]
            )
            logger.info(f"WhatsApp reschedule sent to candidate: {candidate_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp reschedule to candidate: {e}")
    
    # Send to mentor
    if mentor_full_phone:
        try:
            await wati_service.send_template_message(
                recipient_number=mentor_full_phone,
                template_name="mentor_coaching_session_reschedule_v2",
                parameters=[
                    {"name": "1", "value": mentor_name},
                    {"name": "2", "value": session_type},
                    {"name": "3", "value": candidate_name},
                    {"name": "4", "value": new_date},
                    {"name": "5", "value": new_time}
                ]
            )
            logger.info(f"WhatsApp reschedule sent to mentor: {mentor_full_phone}")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp reschedule to mentor: {e}")


async def set_mentor_availability(
    mentor_id: str,
    request: Request
):
    """Set mentor availability - called by mentor"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Verify user is this mentor
    if not user.get("is_mentor") or user.get("mentor_id") != mentor_id:
        raise HTTPException(status_code=403, detail="Not authorized to set this mentor's availability")
    
    # Get request body
    body = await request.json()
    availability_data = body.get("availability", [])
    
    # Clear existing availability
    await db.mentor_availability.delete_many({"mentor_id": mentor_id})
    
    # Insert new availability
    for slot in availability_data:
        await db.mentor_availability.insert_one({
            "mentor_id": mentor_id,
            "date": slot["date"],
            "slots": slot["slots"],
            "booked_slots": [],
            "updated_at": datetime.utcnow()
        })
    
    return {"message": "Availability updated successfully"}


# ============ Mentor Profile Management (with Approval Workflow) ============

from pydantic import BaseModel
from typing import Optional, List

class MentorProfileUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    bio: Optional[str] = None
    expertise: Optional[List[str]] = None
    picture: Optional[str] = None
    linkedin: Optional[str] = None
    specialization: Optional[str] = None
    hourly_rate: Optional[int] = None


@router.get("/me/profile")
async def get_my_mentor_profile(request: Request):
    """Get current mentor's profile (for mentor dashboard)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Not a mentor")
    
    mentor = None
    mentor_id = user.get("mentor_id")
    
    # First try by mentor_id
    if mentor_id:
        mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    
    # Fallback to email lookup if mentor_id doesn't work
    if not mentor:
        mentor = await db.mentors.find_one({"email": user.get("email")}, {"_id": 0})
        
        # If found by email, update user's mentor_id for future lookups
        if mentor and mentor.get("id") != mentor_id:
            await db.users.update_one(
                {"id": user.get("id")},
                {"$set": {"mentor_id": mentor.get("id")}}
            )
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    return mentor


@router.put("/me/profile")
async def update_my_mentor_profile(profile_data: MentorProfileUpdate, request: Request):
    """
    Submit profile changes for approval.
    Changes will be stored as pending_changes and require admin approval.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Not a mentor")
    
    mentor = None
    mentor_id = user.get("mentor_id")
    
    # First try by mentor_id
    if mentor_id:
        mentor = await db.mentors.find_one({"id": mentor_id})
    
    # Fallback to email lookup
    if not mentor:
        mentor = await db.mentors.find_one({"email": user.get("email")})
        
        # Update user's mentor_id for future lookups
        if mentor and mentor.get("id") != mentor_id:
            await db.users.update_one(
                {"id": user.get("id")},
                {"$set": {"mentor_id": mentor.get("id")}}
            )
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    # Prepare pending changes
    changes = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")
    
    # Add submission timestamp
    changes["submitted_at"] = datetime.utcnow().isoformat()
    
    # Store as pending_changes (requires admin approval)
    await db.mentors.update_one(
        {"id": mentor.get("id")},
        {"$set": {"pending_changes": changes}}
    )
    
    return {
        "message": "Profile changes submitted for admin approval",
        "pending_changes": changes
    }


@router.get("/me/pending-changes")
async def get_my_pending_changes(request: Request):
    """Check if there are pending profile changes awaiting approval"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Not a mentor")
    
    mentor_id = user.get("mentor_id")
    mentor = None
    
    if mentor_id:
        mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0, "pending_changes": 1})
    
    if not mentor:
        mentor = await db.mentors.find_one({"email": user.get("email")}, {"_id": 0, "pending_changes": 1})
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    pending = mentor.get("pending_changes")
    
    return {
        "has_pending_changes": pending is not None,
        "pending_changes": pending
    }





@router.get("/debug/booking-eligibility")
async def debug_booking_eligibility(request: Request):
    """
    Debug endpoint to check why a user might not be able to book coaching sessions.
    Returns detailed info about user's coaching access.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id")
    user_email = user.get("email")
    user_plan = user.get("plan", "")
    
    # Get fresh user data from DB
    fresh_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    coaching_plans = [PlanType.LAST_MILE, PlanType.MID_MILE, PlanType.FULL_PREP, PlanType.PINNACLE]
    cohort_plans = [PlanType.COHORT_PREMIUM, PlanType.COHORT_ELITE]
    
    has_coaching = user_plan in [p.value for p in coaching_plans]
    has_cohort = user_plan in [p.value for p in cohort_plans]
    
    is_unlimited_coaching = (
        user_plan.lower() == "pinnacle" or 
        user.get("coaching_sessions_total") == -1 or
        user.get("is_unlimited_coaching", False)
    )
    
    has_purchased_sessions = (user.get("coaching_sessions_remaining") or 0) > 0
    
    # Get values from fresh user too
    fresh_plan = fresh_user.get("plan", "") if fresh_user else ""
    fresh_coaching_remaining = fresh_user.get("coaching_sessions_remaining", 0) if fresh_user else 0
    fresh_coaching_total = fresh_user.get("coaching_sessions_total", 0) if fresh_user else 0
    fresh_coaching_used = fresh_user.get("coaching_sessions_used", 0) if fresh_user else 0
    
    can_book = False
    reason = ""
    
    if is_unlimited_coaching:
        can_book = True
        reason = "User has unlimited coaching (Pinnacle or coaching_sessions_total=-1)"
    elif has_purchased_sessions:
        can_book = True
        reason = f"User has purchased sessions (coaching_sessions_remaining={user.get('coaching_sessions_remaining')})"
    elif has_coaching:
        sessions_used = user.get("coaching_sessions_used", 0)
        sessions_total = user.get("coaching_sessions_total", 0)
        if sessions_total > 0 and sessions_used < sessions_total:
            can_book = True
            reason = f"User has coaching plan with remaining sessions (used={sessions_used}, total={sessions_total})"
        else:
            reason = f"User has coaching plan but no remaining sessions (used={sessions_used}, total={sessions_total})"
    elif has_cohort:
        can_book = True
        reason = "User has cohort plan"
    else:
        reason = f"User does not have any coaching access. Plan: {user_plan}"
    
    return {
        "user_email": user_email,
        "can_book": can_book,
        "reason": reason,
        "debug_info": {
            "from_session_user": {
                "plan": user_plan,
                "coaching_sessions_remaining": user.get("coaching_sessions_remaining"),
                "coaching_sessions_total": user.get("coaching_sessions_total"),
                "coaching_sessions_used": user.get("coaching_sessions_used"),
                "is_unlimited_coaching": user.get("is_unlimited_coaching"),
            },
            "from_fresh_db_query": {
                "plan": fresh_plan,
                "coaching_sessions_remaining": fresh_coaching_remaining,
                "coaching_sessions_total": fresh_coaching_total,
                "coaching_sessions_used": fresh_coaching_used,
            },
            "checks": {
                "has_coaching_plan": has_coaching,
                "has_cohort_plan": has_cohort,
                "is_unlimited_coaching": is_unlimited_coaching,
                "has_purchased_sessions": has_purchased_sessions,
            }
        }
    }

