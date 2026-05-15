"""
Partner API Routes
External API for partner institutes to access mentor availability and create bookings.
Authentication is via API key in X-Partner-API-Key header.
"""

import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel, EmailStr
import pytz

from routes.auth import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/partner", tags=["Partner API"])


# ============== Pydantic Models ==============

class CreateBookingRequest(BaseModel):
    mentor_id: str
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM
    candidate_name: str
    candidate_email: EmailStr
    session_type: str  # case_interview, fit_interview, resume_review
    duration_minutes: int = 45
    notes: Optional[str] = None


class BookingResponse(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    date: str
    time_slot: str
    duration_minutes: int
    session_type: str
    candidate_name: str
    candidate_email: str
    status: str
    created_at: str


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = None


# ============== API Key Authentication ==============

def hash_api_key(api_key: str) -> str:
    """Hash API key using SHA-256"""
    return hashlib.sha256(api_key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns: (full_key, key_hash, key_prefix)
    """
    # Generate a random key with prefix
    random_part = secrets.token_urlsafe(32)
    full_key = f"pk_live_{random_part}"
    key_hash = hash_api_key(full_key)
    key_prefix = full_key[:16]  # "pk_live_XXXXXXXX"
    return full_key, key_hash, key_prefix


async def get_partner_from_api_key(request: Request, x_partner_api_key: str = Header(...)) -> dict:
    """
    Dependency to authenticate partner via API key.
    Returns the partner document if valid, raises 401 if invalid.
    """
    db = get_db(request)
    
    if not x_partner_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    # Hash the provided key and look it up
    key_hash = hash_api_key(x_partner_api_key)
    
    partner = await db.partners.find_one({
        "api_key_hash": key_hash,
        "is_active": True
    })
    
    if not partner:
        logger.warning(f"Invalid API key attempt: {x_partner_api_key[:16]}...")
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    return partner


# ============== Helper Functions ==============

async def get_mentor_availability_for_partner(db, mentor_id: str, start_date: str, end_date: str) -> list:
    """
    Get mentor availability for a date range.
    Filters out blocked days, booked slots, and Google Calendar conflicts.
    Also considers partner_bookings collection.
    """
    mentor = await db.mentors.find_one({"id": mentor_id})
    if not mentor:
        return []
    
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
    
    # Get mentor's blocked days and settings
    blocked_days = mentor.get("blocked_days", [])
    max_sessions_per_day = mentor.get("max_sessions_per_day", 5)
    minimum_booking_hours = mentor.get("minimum_booking_hours", 12)
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Parse date range
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    # Ensure we don't show past dates
    today = now_ist.date()
    if start < today:
        start = today
    
    min_booking_time = now_ist + timedelta(hours=minimum_booking_hours)
    
    availability = []
    current_date = start
    
    while current_date <= end:
        date_str = current_date.strftime("%Y-%m-%d")
        day_name = day_names[current_date.weekday()]
        
        # Skip blocked days
        if date_str in blocked_days:
            current_date += timedelta(days=1)
            continue
        
        # Get slots from weekly template
        slots = day_to_slots.get(day_name, [])
        
        # Filter out slots that are less than minimum_booking_hours in the future
        if slots:
            filtered_slots = []
            for slot in slots:
                slot_h, slot_m = map(int, slot.split(':'))
                slot_datetime = ist.localize(datetime(
                    current_date.year, current_date.month, current_date.day, slot_h, slot_m
                ))
                if slot_datetime >= min_booking_time:
                    filtered_slots.append(slot)
            slots = filtered_slots
        
        if slots:
            availability.append({
                "date": date_str,
                "day": day_name,
                "slots": slots,
                "booked_slots": []
            })
        
        current_date += timedelta(days=1)
    
    if not availability:
        return []
    
    # Get all dates we need to check
    dates = [day.get("date") for day in availability]
    
    # Get regular bookings
    regular_bookings = await db.bookings.find(
        {
            "mentor_id": mentor_id,
            "date": {"$in": dates},
            "status": {"$in": ["confirmed", "pending"]}
        },
        {"_id": 0, "date": 1, "time_slot": 1, "duration": 1}
    ).to_list(1000)
    
    # Get partner bookings
    partner_bookings = await db.partner_bookings.find(
        {
            "mentor_id": mentor_id,
            "date": {"$in": dates},
            "status": "scheduled"
        },
        {"_id": 0, "date": 1, "time_slot": 1, "duration_minutes": 1}
    ).to_list(1000)
    
    # Combine all bookings
    all_bookings = []
    for b in regular_bookings:
        all_bookings.append({
            "date": b.get("date"),
            "time_slot": b.get("time_slot"),
            "duration": b.get("duration", 60)
        })
    for b in partner_bookings:
        all_bookings.append({
            "date": b.get("date"),
            "time_slot": b.get("time_slot"),
            "duration": b.get("duration_minutes", 45)
        })
    
    # Create booked slots map (with duration consideration)
    booked_slots_map = {}
    booking_count_map = {}
    
    for booking in all_bookings:
        date_str = booking.get("date")
        time_slot = booking.get("time_slot")
        duration = booking.get("duration", 45)
        
        if date_str and time_slot:
            # Count bookings per date
            booking_count_map[date_str] = booking_count_map.get(date_str, 0) + 1
            
            if date_str not in booked_slots_map:
                booked_slots_map[date_str] = []
            
            try:
                hour, minute = map(int, time_slot.split(':'))
                start_minutes = hour * 60 + minute
                
                # Block all 30-minute slots within the session duration
                blocked_minutes = start_minutes
                while blocked_minutes < start_minutes + duration:
                    blocked_hour = blocked_minutes // 60
                    blocked_minute = blocked_minutes % 60
                    blocked_slot = f"{blocked_hour:02d}:{blocked_minute:02d}"
                    if blocked_slot not in booked_slots_map[date_str]:
                        booked_slots_map[date_str].append(blocked_slot)
                    blocked_minutes += 30
            except (ValueError, AttributeError):
                booked_slots_map[date_str].append(time_slot)
    
    # Apply booked slots and max sessions check
    for day in availability:
        date_str = day.get("date")
        booking_count = booking_count_map.get(date_str, 0)
        
        if booking_count >= max_sessions_per_day:
            day["slots"] = []
            day["booked_slots"] = day.get("slots", [])
            day["max_reached"] = True
        else:
            booked_times = booked_slots_map.get(date_str, [])
            if booked_times:
                available_slots = [slot for slot in day["slots"] if slot not in booked_times]
                day["slots"] = available_slots
                day["booked_slots"] = booked_times
    
    # Check Google Calendar conflicts
    if mentor.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch
            
            start_date_str = availability[0].get("date")
            end_date_str = availability[-1].get("date")
            
            busy_slots_by_date = await get_mentor_busy_slots_batch(db, mentor_id, start_date_str, end_date_str)
            
            for day in availability:
                date_str = day.get("date")
                if date_str and not day.get("max_reached"):
                    busy_slots = busy_slots_by_date.get(date_str, [])
                    if busy_slots:
                        # Remove busy slots from available
                        day["slots"] = [s for s in day["slots"] if s not in busy_slots]
                        booked = day.get("booked_slots", [])
                        day["booked_slots"] = list(set(booked + busy_slots))
        except Exception as e:
            logger.warning(f"Error fetching Google Calendar busy slots for mentor {mentor_id}: {e}")
    
    # Filter out days with no available slots
    availability = [day for day in availability if day.get("slots")]
    
    return availability


# ============== API Endpoints ==============

@router.get("/mentors")
async def list_mentors(
    request: Request,
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    List all mentors assigned to this partner.
    Returns mentor profiles without sensitive data.
    Note: Hidden mentors that are explicitly assigned to this partner will be included.
    """
    db = get_db(request)
    
    assigned_mentor_ids = partner.get("assigned_mentor_ids", [])
    
    if not assigned_mentor_ids:
        return {"mentors": [], "count": 0}
    
    # Fetch assigned mentors - include hidden mentors if they're explicitly assigned
    # Only exclude deleted and inactive mentors
    # Note: is_hidden should NOT affect partner API visibility - if a mentor is assigned,
    # they should be visible to that partner regardless of is_hidden status
    mentors = await db.mentors.find(
        {
            "id": {"$in": assigned_mentor_ids},
            "is_active": {"$ne": False},  # Include if is_active is True or not set
            "is_deleted": {"$ne": True}
            # Explicitly NOT filtering by is_hidden - assigned mentors should always be visible to partners
        },
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "title": 1,
            "company": 1,
            "consulting_firm": 1,
            "picture": 1,
            "bio": 1,
            "expertise": 1,
            "specialization": 1,
            "years_experience": 1,
            "rating": 1,
            "sessions_conducted": 1,
            "is_hidden": 1  # Include this so partner knows the mentor's public visibility status
        }
    ).to_list(100)
    
    return {
        "mentors": mentors,
        "count": len(mentors)
    }


@router.get("/mentors/{mentor_id}")
async def get_mentor(
    mentor_id: str,
    request: Request,
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    Get details of a specific mentor.
    Only returns mentor if assigned to this partner.
    Note: Hidden mentors that are explicitly assigned to this partner can be accessed.
    """
    db = get_db(request)
    
    assigned_mentor_ids = partner.get("assigned_mentor_ids", [])
    
    if mentor_id not in assigned_mentor_ids:
        raise HTTPException(status_code=403, detail="Mentor not assigned to this partner")
    
    # Allow hidden mentors if they're explicitly assigned
    # Use $ne: False to include mentors where is_active is True or not set
    mentor = await db.mentors.find_one(
        {
            "id": mentor_id,
            "is_active": {"$ne": False},  # Include if is_active is True or not set
            "is_deleted": {"$ne": True}
            # Explicitly NOT filtering by is_hidden
        },
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "title": 1,
            "company": 1,
            "consulting_firm": 1,
            "picture": 1,
            "bio": 1,
            "expertise": 1,
            "specialization": 1,
            "years_experience": 1,
            "rating": 1,
            "sessions_conducted": 1,
            "headline": 1,
            "is_hidden": 1  # Include so partner knows public visibility status
        }
    )
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    return mentor


@router.get("/mentors/{mentor_id}/availability")
async def get_mentor_availability(
    mentor_id: str,
    request: Request,
    start_date: str,  # Required: YYYY-MM-DD
    end_date: str,    # Required: YYYY-MM-DD
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    Get real-time availability for a mentor.
    Returns available time slots filtered by:
    - Weekly recurring availability
    - Blocked days
    - Existing bookings (both regular and partner bookings)
    - Google Calendar conflicts (if connected)
    
    Query params:
    - start_date: Start of date range (YYYY-MM-DD)
    - end_date: End of date range (YYYY-MM-DD)
    """
    db = get_db(request)
    
    # Verify mentor is assigned to this partner
    assigned_mentor_ids = partner.get("assigned_mentor_ids", [])
    if mentor_id not in assigned_mentor_ids:
        raise HTTPException(status_code=403, detail="Mentor not assigned to this partner")
    
    # Validate date format
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Limit date range to 30 days
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    if (end - start).days > 30:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 30 days")
    
    availability = await get_mentor_availability_for_partner(db, mentor_id, start_date, end_date)
    
    return {
        "mentor_id": mentor_id,
        "start_date": start_date,
        "end_date": end_date,
        "availability": availability
    }


@router.post("/bookings")
async def create_booking(
    request: Request,
    booking_data: CreateBookingRequest,
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    Create a new booking for a candidate.
    
    The booking will:
    - Block the time slot for the mentor
    - Appear on the mentor's dashboard
    - NOT send calendar invites (partner handles their own invites)
    """
    db = get_db(request)
    
    mentor_id = booking_data.mentor_id
    
    # Verify mentor is assigned to this partner
    assigned_mentor_ids = partner.get("assigned_mentor_ids", [])
    if mentor_id not in assigned_mentor_ids:
        raise HTTPException(status_code=403, detail="Mentor not assigned to this partner")
    
    # Verify mentor exists and is active (but allow hidden mentors if assigned)
    mentor = await db.mentors.find_one({
        "id": mentor_id,
        "is_active": {"$ne": False},  # Include if is_active is True or not set
        "is_deleted": {"$ne": True}
        # Explicitly NOT filtering by is_hidden - assigned mentors can be booked
    })
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Validate session type
    valid_session_types = ["case_interview", "fit_interview", "resume_review"]
    if booking_data.session_type not in valid_session_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid session_type. Must be one of: {', '.join(valid_session_types)}"
        )
    
    # Validate date format and ensure it's not in the past
    try:
        booking_date = datetime.strptime(booking_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    today = now_ist.date()
    
    if booking_date < today:
        raise HTTPException(status_code=400, detail="Cannot book sessions in the past")
    
    # Validate time slot format
    try:
        slot_h, slot_m = map(int, booking_data.time_slot.split(':'))
        if not (0 <= slot_h <= 23 and slot_m in [0, 30]):
            raise ValueError()
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid time_slot format. Use HH:MM (30-min intervals)")
    
    # Check if slot is available
    availability = await get_mentor_availability_for_partner(
        db, mentor_id, booking_data.date, booking_data.date
    )
    
    slot_available = False
    for day in availability:
        if day.get("date") == booking_data.date:
            if booking_data.time_slot in day.get("slots", []):
                slot_available = True
            break
    
    if not slot_available:
        raise HTTPException(
            status_code=409, 
            detail="Time slot is not available. It may be booked, blocked, or outside availability."
        )
    
    # Create the booking
    import uuid
    booking_id = str(uuid.uuid4())
    
    booking_doc = {
        "id": booking_id,
        "partner_id": partner.get("id"),
        "mentor_id": mentor_id,
        "date": booking_data.date,
        "time_slot": booking_data.time_slot,
        "duration_minutes": booking_data.duration_minutes,
        "session_type": booking_data.session_type,
        "candidate_name": booking_data.candidate_name,
        "candidate_email": booking_data.candidate_email,
        "status": "scheduled",
        "notes": booking_data.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.partner_bookings.insert_one(booking_doc)
    
    logger.info(f"Partner booking created: {booking_id} by partner {partner.get('name')} for mentor {mentor_id}")
    
    return {
        "success": True,
        "booking": {
            "id": booking_id,
            "mentor_id": mentor_id,
            "mentor_name": mentor.get("name"),
            "date": booking_data.date,
            "time_slot": booking_data.time_slot,
            "duration_minutes": booking_data.duration_minutes,
            "session_type": booking_data.session_type,
            "candidate_name": booking_data.candidate_name,
            "candidate_email": booking_data.candidate_email,
            "status": "scheduled",
            "created_at": booking_doc["created_at"].isoformat()
        }
    }


@router.get("/bookings")
async def list_bookings(
    request: Request,
    partner: dict = Depends(get_partner_from_api_key),
    status: Optional[str] = None,
    mentor_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """
    List all bookings made by this partner.
    
    Optional filters:
    - status: scheduled, completed, cancelled, no_show
    - mentor_id: Filter by specific mentor
    - start_date: Filter bookings from this date (YYYY-MM-DD)
    - end_date: Filter bookings until this date (YYYY-MM-DD)
    - limit: Max results (default 50, max 100)
    - skip: Pagination offset
    """
    db = get_db(request)
    
    # Build query
    query = {"partner_id": partner.get("id")}
    
    if status:
        valid_statuses = ["scheduled", "completed", "cancelled", "no_show"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        query["status"] = status
    
    if mentor_id:
        # Verify mentor is assigned to partner
        if mentor_id not in partner.get("assigned_mentor_ids", []):
            raise HTTPException(status_code=403, detail="Mentor not assigned to this partner")
        query["mentor_id"] = mentor_id
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    # Limit max results
    limit = min(limit, 100)
    
    # Get total count
    total = await db.partner_bookings.count_documents(query)
    
    # Get bookings
    bookings = await db.partner_bookings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with mentor names
    mentor_ids = list(set(b.get("mentor_id") for b in bookings if b.get("mentor_id")))
    mentors = await db.mentors.find(
        {"id": {"$in": mentor_ids}},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    mentor_map = {m["id"]: m["name"] for m in mentors}
    
    for booking in bookings:
        booking["mentor_name"] = mentor_map.get(booking.get("mentor_id"), "Unknown")
        # Convert datetime to ISO string
        if booking.get("created_at"):
            booking["created_at"] = booking["created_at"].isoformat()
        if booking.get("updated_at"):
            booking["updated_at"] = booking["updated_at"].isoformat()
    
    return {
        "bookings": bookings,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/bookings/{booking_id}")
async def get_booking(
    booking_id: str,
    request: Request,
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    Get details of a specific booking.
    Only returns booking if it belongs to this partner.
    """
    db = get_db(request)
    
    booking = await db.partner_bookings.find_one(
        {
            "id": booking_id,
            "partner_id": partner.get("id")
        },
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get mentor name
    mentor = await db.mentors.find_one(
        {"id": booking.get("mentor_id")},
        {"_id": 0, "name": 1}
    )
    booking["mentor_name"] = mentor.get("name") if mentor else "Unknown"
    
    # Convert datetime to ISO string
    if booking.get("created_at"):
        booking["created_at"] = booking["created_at"].isoformat()
    if booking.get("updated_at"):
        booking["updated_at"] = booking["updated_at"].isoformat()
    if booking.get("cancelled_at"):
        booking["cancelled_at"] = booking["cancelled_at"].isoformat()
    
    return booking


@router.delete("/bookings/{booking_id}")
async def cancel_booking(
    booking_id: str,
    request: Request,
    cancel_data: Optional[CancelBookingRequest] = None,
    partner: dict = Depends(get_partner_from_api_key)
):
    """
    Cancel a booking.
    Only scheduled bookings can be cancelled.
    """
    db = get_db(request)
    
    # Find the booking
    booking = await db.partner_bookings.find_one({
        "id": booking_id,
        "partner_id": partner.get("id")
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("status") != "scheduled":
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel booking with status '{booking.get('status')}'"
        )
    
    # Update the booking
    reason = cancel_data.reason if cancel_data else None
    
    await db.partner_bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc),
                "cancelled_reason": reason,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    logger.info(f"Partner booking cancelled: {booking_id} by partner {partner.get('name')}")
    
    return {
        "success": True,
        "message": "Booking cancelled successfully",
        "booking_id": booking_id
    }


# ============== Health Check ==============

@router.get("/health")
async def partner_api_health():
    """Health check for Partner API"""
    return {
        "status": "healthy",
        "api": "Partner API",
        "version": "1.0.0"
    }
