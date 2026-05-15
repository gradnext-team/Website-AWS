"""
Discovery Calls Routes
Handles booking, management, and configuration of discovery calls
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import logging
import os
import pytz

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from services import meta_pixel_service
from services import google_sheets_service
import asyncio as _asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discovery-calls", tags=["discovery-calls"])
admin_router = APIRouter(prefix="/api/admin/discovery-calls", tags=["admin-discovery-calls"])

# Database will be set by server.py
db = None

# OAuth 2.0 Configuration for Discovery Calls Calendar
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").replace("/api", "")

# Scopes for Google Calendar - need write access to create events
CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

def set_database(database):
    global db
    db = database


def get_calendar_oauth_flow(redirect_uri: str) -> Flow:
    """Create OAuth flow for Google Calendar"""
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=CALENDAR_SCOPES,
        redirect_uri=redirect_uri
    )
    return flow


# ============= Models =============

class QuestionOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    value: str


class DiscoveryCallQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    type: str  # "short_text", "long_text", "single_choice", "multiple_choice", "dropdown", "phone", "email"
    required: bool = True
    options: List[QuestionOption] = []  # For choice-based questions
    order: int = 0
    placeholder: Optional[str] = None


class DiscoveryCallSettings(BaseModel):
    admin_email: str = "bookings@gradnext.co"
    call_duration_minutes: int = 15
    availability: Dict[str, Any] = {
        "monday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
        "tuesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
        "wednesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
        "thursday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
        "friday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
        "saturday": {"enabled": False, "slots": []},
        "sunday": {"enabled": False, "slots": []},
    }
    timezone: str = "Asia/Kolkata"
    buffer_minutes: int = 15  # Buffer between calls
    max_advance_days: int = 30  # How far in advance can book


class BookingRequest(BaseModel):
    selected_datetime: Optional[datetime] = None  # Legacy: UTC datetime
    selected_datetime_ist: Optional[str] = None  # New: IST datetime string "YYYY-MM-DD HH:MM"
    selected_date: Optional[str] = None  # "YYYY-MM-DD"
    selected_time: Optional[str] = None  # "HH:MM" in IST
    answers: Dict[str, Any]  # Question ID -> Answer
    # Optional cohort context — set when this discovery call was submitted
    # from the Cohort landing page. Used to tag the booking as `source=cohort`.
    cohort_id: Optional[str] = None
    cohort_slug: Optional[str] = None


class AcceptBookingRequest(BaseModel):
    """Optional schedule an admin can pick when accepting a booking that came in
    without a candidate-selected slot (the new flow). If both fields are
    provided they overwrite the booking's scheduled_date/time before invite
    creation."""
    selected_date: Optional[str] = None  # "YYYY-MM-DD"
    selected_time: Optional[str] = None  # "HH:MM" in IST


class BookingResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    scheduled_datetime: datetime
    status: str  # "pending", "accepted", "rejected", "completed", "cancelled"
    answers: Dict[str, Any]
    meet_link: Optional[str] = None
    calendar_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============= Public Routes =============

@router.get("/settings")
async def get_public_settings():
    """Get public discovery call settings (availability, duration)"""
    try:
        settings = await db.discovery_call_settings.find_one({"_id": "settings"})
        if not settings:
            # Return defaults
            return {
                "call_duration_minutes": 15,
                "availability": {
                    "monday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "tuesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "wednesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "thursday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "friday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "saturday": {"enabled": False, "slots": []},
                    "sunday": {"enabled": False, "slots": []},
                },
                "timezone": "Asia/Kolkata",
                "max_advance_days": 30,
                "buffer_minutes": 15
            }
        
        return {
            "call_duration_minutes": settings.get("call_duration_minutes", 15),
            "availability": settings.get("availability", {}),
            "timezone": settings.get("timezone", "Asia/Kolkata"),
            "max_advance_days": settings.get("max_advance_days", 30),
            "buffer_minutes": settings.get("buffer_minutes", 15)
        }
    except Exception as e:
        logger.error(f"Error getting public settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/questions")
async def get_questions():
    """Get all active discovery call questions"""
    try:
        questions = await db.discovery_call_questions.find({}).sort("order", 1).to_list(100)
        
        if not questions:
            # Return default questions based on the screenshots
            default_questions = get_default_questions()
            # Save defaults to database
            for q in default_questions:
                await db.discovery_call_questions.insert_one(q)
            return default_questions
        
        # Convert ObjectId to string
        for q in questions:
            q["_id"] = str(q["_id"])
        
        return questions
    except Exception as e:
        logger.error(f"Error getting questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-slots")
async def get_available_slots(date: str):
    """Get available time slots for a specific date"""
    try:
        # Parse the date
        target_date = datetime.strptime(date, "%Y-%m-%d")
        
        # Enforce: only allow booking from NEXT DAY onwards (in IST)
        now_ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
        tomorrow_ist = (now_ist + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        if target_date.date() < tomorrow_ist.date():
            return {"slots": [], "date": date, "message": "Slots are only available from tomorrow onwards."}
        
        # Get settings
        settings = await db.discovery_call_settings.find_one({"_id": "settings"})
        if not settings:
            settings = {
                "call_duration_minutes": 15,
                "buffer_minutes": 15,
                "availability": {
                    "monday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "tuesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "wednesday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "thursday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "friday": {"enabled": True, "slots": [{"start": "09:00", "end": "18:00"}]},
                    "saturday": {"enabled": False, "slots": []},
                    "sunday": {"enabled": False, "slots": []},
                }
            }
        
        # Get day of week
        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_name = day_names[target_date.weekday()]
        
        day_config = settings.get("availability", {}).get(day_name, {"enabled": False, "slots": []})
        
        if not day_config.get("enabled"):
            return {"slots": [], "date": date}
        
        # Generate all possible slots
        duration = settings.get("call_duration_minutes", 15)
        buffer = settings.get("buffer_minutes", 15)
        slot_interval = duration + buffer
        
        all_slots = []
        for time_range in day_config.get("slots", []):
            start_time = datetime.strptime(time_range["start"], "%H:%M").time()
            end_time = datetime.strptime(time_range["end"], "%H:%M").time()
            
            current = datetime.combine(target_date.date(), start_time)
            end = datetime.combine(target_date.date(), end_time)
            
            while current + timedelta(minutes=duration) <= end:
                all_slots.append(current)
                current += timedelta(minutes=slot_interval)
        
        # Get existing bookings for this date using the correct string fields
        # Bookings store scheduled_date as "YYYY-MM-DD" and scheduled_time as "HH:MM"
        existing_bookings = await db.discovery_call_bookings.find({
            "scheduled_date": date,
            "status": {"$in": ["pending", "accepted"]}
        }).to_list(100)
        
        booked_times = {b.get("scheduled_time") for b in existing_bookings if b.get("scheduled_time")}
        
        logger.info(f"Available slots check for {date}: {len(all_slots)} total slots, {len(booked_times)} already booked ({booked_times})")
        
        # Filter out booked slots and past slots
        now = datetime.utcnow() + timedelta(hours=5, minutes=30)  # IST offset
        available_slots = [
            slot.strftime("%H:%M") 
            for slot in all_slots 
            if slot.strftime("%H:%M") not in booked_times and slot > now
        ]
        
        return {"slots": available_slots, "date": date, "duration": duration}
    except Exception as e:
        logger.error(f"Error getting available slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/book")
async def book_discovery_call(request: Request, booking: BookingRequest):
    """Book a discovery call - times are in IST"""
    try:
        # Get questions to extract name and email
        questions = await db.discovery_call_questions.find({}).to_list(100)

        # Robust extraction — handles renamed questions, missing types, etc.
        # Match by `type` first (most reliable signal), then by multiple regex
        # patterns on the question text. Without this, admin renaming "Phone
        # Number" to "Mobile" or "WhatsApp Number" silently drops the phone
        # from every booking — which was the actual production bug.
        import re

        def _get_answer(q):
            qid = q.get("id") or str(q.get("_id", ""))
            v = booking.answers.get(qid)
            if v is None:
                v = booking.answers.get(str(q.get("_id", "")), "")
            if isinstance(v, list):
                return ", ".join(str(x) for x in v)
            return v or ""

        def _find_question(predicate):
            for q in questions:
                try:
                    if predicate(q):
                        return q
                except Exception:
                    continue
            return None

        def _q_text(q):
            return (q.get("question") or q.get("label") or q.get("title") or "").lower()

        # Find the questions for name / email / phone
        name_q = _find_question(lambda q: q.get("type") == "name") \
            or _find_question(lambda q: re.search(r"\b(your name|full name|first name|last name)\b", _q_text(q))) \
            or _find_question(lambda q: q.get("order") == 0 and "name" in _q_text(q)) \
            or _find_question(lambda q: re.search(r"\bname\b", _q_text(q)))

        email_q = _find_question(lambda q: q.get("type") == "email") \
            or _find_question(lambda q: "email" in _q_text(q))

        phone_q = _find_question(lambda q: q.get("type") == "phone") \
            or _find_question(lambda q: re.search(r"\b(phone|mobile|whatsapp|contact)\b", _q_text(q)))

        name = _get_answer(name_q) if name_q else ""
        email = _get_answer(email_q) if email_q else ""
        phone = _get_answer(phone_q) if phone_q else ""

        # Final fallback for phone: if extraction failed (e.g. question text
        # is weird), scan ALL answers for a phone-shaped string (8–15 digits
        # after stripping non-digits).
        if not phone:
            for q in questions:
                v = _get_answer(q)
                if isinstance(v, str) and v.strip():
                    digits = re.sub(r"\D", "", v)
                    if 8 <= len(digits) <= 15 and v != email and v != name:
                        phone = v
                        break

        if not name or not email:
            raise HTTPException(status_code=400, detail="Name and email are required")
        
        # Parse the scheduled datetime - handle both old and new formats
        # New format: separate date and time strings in IST
        # Old format: ISO datetime (legacy support)
        # Latest flow: candidate submits the form WITHOUT a date/time. Admin
        # picks the slot when they accept. In that case all three fields below
        # remain None and the booking is stored with scheduled_*=None.
        scheduled_datetime_ist = None
        scheduled_date_str = None
        scheduled_time_str = None
        
        if booking.selected_date and booking.selected_time:
            # Candidate-picked legacy flow: date and time in IST
            scheduled_date_str = booking.selected_date  # "YYYY-MM-DD"
            scheduled_time_str = booking.selected_time  # "HH:MM"
            ist = pytz.timezone('Asia/Kolkata')
            naive_datetime = datetime.strptime(f"{scheduled_date_str} {scheduled_time_str}", "%Y-%m-%d %H:%M")
            scheduled_datetime_ist = ist.localize(naive_datetime)
        elif booking.selected_datetime_ist:
            ist = pytz.timezone('Asia/Kolkata')
            naive_datetime = datetime.strptime(booking.selected_datetime_ist, "%Y-%m-%d %H:%M")
            scheduled_datetime_ist = ist.localize(naive_datetime)
            scheduled_date_str = naive_datetime.strftime("%Y-%m-%d")
            scheduled_time_str = naive_datetime.strftime("%H:%M")
        elif booking.selected_datetime:
            ist = pytz.timezone('Asia/Kolkata')
            if booking.selected_datetime.tzinfo is None:
                scheduled_datetime_ist = ist.localize(booking.selected_datetime)
            else:
                scheduled_datetime_ist = booking.selected_datetime.astimezone(ist)
            scheduled_date_str = scheduled_datetime_ist.strftime("%Y-%m-%d")
            scheduled_time_str = scheduled_datetime_ist.strftime("%H:%M")
        # else: no datetime provided — that's allowed in the new admin-pick flow

        # ====== SLOT AVAILABILITY CHECK (prevent double-booking) ======
        # Only enforce if the candidate actually picked a slot.
        if scheduled_date_str and scheduled_time_str:
            existing_booking = await db.discovery_call_bookings.find_one({
                "scheduled_date": scheduled_date_str,
                "scheduled_time": scheduled_time_str,
                "status": {"$in": ["pending", "accepted"]}
            })
            
            if existing_booking:
                logger.warning(f"Double-booking attempt blocked: {email} tried to book {scheduled_date_str} {scheduled_time_str} IST but slot already taken by booking {existing_booking.get('id')}")
                raise HTTPException(
                    status_code=409, 
                    detail="This time slot has already been booked. Please select a different time."
                )
        
        # Create booking record - store date and time separately for clarity
        booking_id = str(uuid.uuid4())
        booking_record = {
            "id": booking_id,
            "name": name,
            "email": email,
            "phone": phone,
            "scheduled_date": scheduled_date_str,  # "YYYY-MM-DD" in IST
            "scheduled_time": scheduled_time_str,  # "HH:MM" in IST
            "scheduled_datetime_ist": scheduled_datetime_ist,  # Full datetime with IST timezone
            "timezone": "Asia/Kolkata",  # Explicit timezone marker
            "status": "pending",
            "answers": booking.answers,
            "meet_link": None,
            "calendar_event_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            # Cohort tagging — when set, the admin merge endpoint exposes
            # `source: 'cohort'` on this booking so it carries the badge.
            "cohort_id": booking.cohort_id,
            "cohort_slug": booking.cohort_slug,
            "source": "cohort" if (booking.cohort_id or booking.cohort_slug) else "coaching",
        }
        
        await db.discovery_call_bookings.insert_one(booking_record)

        # ---- Mirror to `cohort_discovery_calls` ----
        # When the booking came from a cohort landing page, also write a row
        # into `cohort_discovery_calls` so the cohort admin tab shows it with
        # the correct name/email/PHONE. Previously the frontend made a second
        # axios call to /api/cohorts/discovery-call passing a frontend-extracted
        # phone — which silently dropped phone when the question text was
        # renamed (production bug). Doing it server-side here uses the same
        # robust extraction as above, so phone is reliably captured.
        if booking.cohort_id or booking.cohort_slug:
            try:
                cohort_doc = None
                if booking.cohort_id:
                    cohort_doc = await db.cohorts.find_one({"id": booking.cohort_id}, {"_id": 0, "id": 1, "name": 1, "slug": 1})
                if not cohort_doc and booking.cohort_slug:
                    cohort_doc = await db.cohorts.find_one({"slug": booking.cohort_slug}, {"_id": 0, "id": 1, "name": 1, "slug": 1})

                # Build a one-line message that summarizes all the extra answers
                summary_parts = []
                key_q_ids = {
                    (name_q.get("id") if name_q else None),
                    (email_q.get("id") if email_q else None),
                    (phone_q.get("id") if phone_q else None),
                }
                for q in questions:
                    qid = q.get("id") or str(q.get("_id", ""))
                    if qid in key_q_ids:
                        continue
                    val = _get_answer(q)
                    if val:
                        summary_parts.append(f"{q.get('question', '')}: {val}")
                summary = "\n".join(summary_parts)[:4000]

                cohort_record = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "email": email,
                    "phone": phone,  # ← properly captured via robust extraction
                    "cohort_id": cohort_doc.get("id") if cohort_doc else booking.cohort_id,
                    "cohort_name": cohort_doc.get("name") if cohort_doc else None,
                    "cohort_slug": cohort_doc.get("slug") if cohort_doc else booking.cohort_slug,
                    "message": summary,
                    "preferred_time": (
                        f"{scheduled_date_str} {scheduled_time_str} IST"
                        if scheduled_date_str else "To be scheduled"
                    ),
                    "status": "pending",
                    "scheduled_at": None,
                    "meet_link": None,
                    "admin_notes": None,
                    "linked_booking_id": booking_id,  # cross-reference back
                    "requested_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
                await db.cohort_discovery_calls.insert_one(cohort_record)
                logger.info(f"Cohort discovery call mirrored: {cohort_record['id']} (phone={'set' if phone else 'EMPTY'})")
            except Exception as mirror_err:
                # Non-blocking — the main booking already succeeded
                logger.warning(f"Cohort discovery mirror failed (non-blocking): {mirror_err}")

        if scheduled_date_str:
            logger.info(f"Discovery call booked: {booking_id} for {email} at {scheduled_date_str} {scheduled_time_str} IST")
        else:
            logger.info(f"Discovery call form submitted (admin will schedule): {booking_id} for {email}")
        
        # Sync to Google Sheet (fire-and-forget)
        try:
            _asyncio.create_task(
                google_sheets_service.append_discovery_call_to_sheet(
                    booking_record, questions
                )
            )
        except Exception as sheet_error:
            logger.warning(f"Google Sheet sync scheduling error (non-critical): {sheet_error}")
        
        # Track Lead event with Meta Conversion API
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            await meta_pixel_service.track_lead(
                user_email=email,
                content_name='discovery_call',
                content_category='booking',
                user_name=name,
                user_phone=phone,
                client_ip=client_ip,
                client_user_agent=client_user_agent,
                fbp=meta_cookies.get('fbp'),
                fbc=meta_cookies.get('fbc'),
            )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        return {
            "success": True,
            "booking_id": booking_id,
            "message": (
                "Your details have been received! Our team will reach out shortly to schedule your discovery call."
                if not scheduled_date_str
                else "Your discovery call has been booked! You will receive a confirmation email shortly."
            ),
            "scheduled_datetime": (
                f"{scheduled_date_str} {scheduled_time_str} IST"
                if scheduled_date_str
                else None
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error booking discovery call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Admin Routes =============

async def verify_admin(request: Request):
    """Verify admin access using the same pattern as other admin routes"""
    # Import get_current_user from auth module
    from routes.auth import get_current_user
    
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@admin_router.get("/pending-count")
async def get_pending_count(request: Request):
    """Get count of pending discovery calls for navigation badge"""
    await verify_admin(request)
    
    try:
        pending_count = await db.discovery_call_bookings.count_documents({"status": "pending"})
        return {"pending_count": pending_count}
    except Exception as e:
        logger.error(f"Error getting pending count: {e}")
        return {"pending_count": 0}


@admin_router.get("/settings")
async def get_admin_settings(request: Request):
    """Get all discovery call settings (admin only)"""
    await verify_admin(request)
    
    try:
        settings = await db.discovery_call_settings.find_one({"_id": "settings"})
        if not settings:
            return DiscoveryCallSettings().dict()
        
        settings.pop("_id", None)
        return settings
    except Exception as e:
        logger.error(f"Error getting admin settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/settings")
async def update_settings(request: Request, settings: DiscoveryCallSettings):
    """Update discovery call settings"""
    await verify_admin(request)
    
    try:
        settings_dict = settings.dict()
        settings_dict["_id"] = "settings"
        settings_dict["updated_at"] = datetime.utcnow()
        
        await db.discovery_call_settings.replace_one(
            {"_id": "settings"},
            settings_dict,
            upsert=True
        )
        
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/questions")
async def get_admin_questions(request: Request):
    """Get all questions (admin only)"""
    await verify_admin(request)
    
    try:
        questions = await db.discovery_call_questions.find({}).sort("order", 1).to_list(100)
        
        if not questions:
            default_questions = get_default_questions()
            for q in default_questions:
                await db.discovery_call_questions.insert_one(q)
            return default_questions
        
        for q in questions:
            q["_id"] = str(q["_id"])
        
        return questions
    except Exception as e:
        logger.error(f"Error getting questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/questions")
async def create_question(request: Request, question: DiscoveryCallQuestion):
    """Create a new question"""
    await verify_admin(request)
    
    try:
        question_dict = question.dict()
        question_dict["created_at"] = datetime.utcnow()
        
        # Get max order
        max_order_q = await db.discovery_call_questions.find_one(sort=[("order", -1)])
        question_dict["order"] = (max_order_q.get("order", 0) if max_order_q else 0) + 1
        
        await db.discovery_call_questions.insert_one(question_dict)
        
        return {"success": True, "question": question_dict}
    except Exception as e:
        logger.error(f"Error creating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.put("/questions/{question_id}")
async def update_question(request: Request, question_id: str, question: DiscoveryCallQuestion):
    """Update a question"""
    await verify_admin(request)
    
    try:
        question_dict = question.dict()
        question_dict["updated_at"] = datetime.utcnow()
        
        result = await db.discovery_call_questions.update_one(
            {"id": question_id},
            {"$set": question_dict}
        )
        
        if result.matched_count == 0:
            # Try with _id
            try:
                result = await db.discovery_call_questions.update_one(
                    {"_id": ObjectId(question_id)},
                    {"$set": question_dict}
                )
            except:
                pass
        
        return {"success": True, "message": "Question updated"}
    except Exception as e:
        logger.error(f"Error updating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.delete("/questions/{question_id}")
async def delete_question(request: Request, question_id: str):
    """Delete a question"""
    await verify_admin(request)
    
    try:
        result = await db.discovery_call_questions.delete_one({"id": question_id})
        
        if result.deleted_count == 0:
            try:
                result = await db.discovery_call_questions.delete_one({"_id": ObjectId(question_id)})
            except:
                pass
        
        return {"success": True, "message": "Question deleted"}
    except Exception as e:
        logger.error(f"Error deleting question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/questions/reorder")
async def reorder_questions(request: Request, order: List[str]):
    """Reorder questions"""
    await verify_admin(request)
    
    try:
        for idx, question_id in enumerate(order):
            await db.discovery_call_questions.update_one(
                {"id": question_id},
                {"$set": {"order": idx}}
            )
        
        return {"success": True, "message": "Questions reordered"}
    except Exception as e:
        logger.error(f"Error reordering questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/all-slots")
async def get_all_slots_admin(request: Request, date: str):
    """Admin slot picker — returns the entire day grid in 15-minute increments
    so the admin can schedule any discovery call at any time. The `booked`
    flag ONLY reflects other discovery-call bookings on that exact time —
    coaching/strategy/workshop calendars are intentionally NOT considered
    here because the discovery-call calendar is treated as its own dedicated
    calendar."""
    await verify_admin(request)
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")

        # Fixed 15-minute slot grid (independent of admin's `call_duration_minutes`
        # so the admin can place calls at any 15-min boundary).
        SLOT_INTERVAL = 15
        settings = await db.discovery_call_settings.find_one({"_id": "settings"}) or {}
        duration = settings.get("call_duration_minutes", 15)

        # Wider working window so admins can schedule outside default hours too
        day_start = datetime.combine(
            target_date.date(), datetime.strptime("08:00", "%H:%M").time()
        )
        day_end = datetime.combine(
            target_date.date(), datetime.strptime("22:00", "%H:%M").time()
        )

        all_times = []
        current = day_start
        while current + timedelta(minutes=duration) <= day_end:
            all_times.append(current.strftime("%H:%M"))
            current += timedelta(minutes=SLOT_INTERVAL)

        # IMPORTANT: ONLY look at the `discovery_call_bookings` collection.
        # The discovery-call calendar is intentionally independent of any
        # other booking system (coaching sessions, strategy calls, workshops).
        existing = await db.discovery_call_bookings.find({
            "scheduled_date": date,
            "status": {"$in": ["pending", "accepted"]},
        }).to_list(500)
        booked_map = {}
        for b in existing:
            t = b.get("scheduled_time")
            if t:
                booked_map[t] = {
                    "booking_id": b.get("id"),
                    "name": b.get("name"),
                }

        slots = [
            {
                "time": t,
                "booked": t in booked_map,
                "booked_with": booked_map.get(t, {}).get("name"),
            }
            for t in all_times
        ]

        return {"date": date, "slots": slots, "duration": duration, "interval": SLOT_INTERVAL}
    except Exception as e:
        logger.error(f"Error getting admin all-slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/calendar-overview")
async def get_calendar_overview(request: Request, month: str):
    """Return per-day booking counts for a month (YYYY-MM) so the admin's
    calendar can show busy-day indicators."""
    await verify_admin(request)
    try:
        # Validate / parse month
        year_str, mon_str = month.split("-")
        year = int(year_str)
        mon = int(mon_str)
        # Compute month start/end as YYYY-MM-DD strings
        from calendar import monthrange
        last_day = monthrange(year, mon)[1]
        month_start = f"{year:04d}-{mon:02d}-01"
        month_end = f"{year:04d}-{mon:02d}-{last_day:02d}"

        cursor = db.discovery_call_bookings.find({
            "scheduled_date": {"$gte": month_start, "$lte": month_end},
            "status": {"$in": ["pending", "accepted"]},
        }, {"scheduled_date": 1, "status": 1, "_id": 0})

        counts = {}
        async for b in cursor:
            d = b.get("scheduled_date")
            if not d:
                continue
            counts[d] = counts.get(d, 0) + 1

        return {"month": month, "counts": counts}
    except Exception as e:
        logger.error(f"Error getting calendar overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/bookings")
async def get_bookings(request: Request, status: Optional[str] = None):
    """Get all discovery call bookings with IST times.

    Merges two sources:
      - `discovery_call_bookings` (regular discovery calls)  →  source='coaching'
      - `cohort_discovery_calls`  (requested from Cohort page) →  source='cohort'

    Cohort entries are normalised to the same shape so the admin UI can
    render them in one table with a "Cohort" badge + cohort name.
    """
    await verify_admin(request)
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        # Sort by date descending (most recent first)
        bookings_cursor = db.discovery_call_bookings.find(query).sort("created_at", -1)
        bookings = await bookings_cursor.to_list(500)
        
        ist = pytz.timezone('Asia/Kolkata')
        
        for b in bookings:
            b["_id"] = str(b["_id"])
            # Tag source so the admin UI can render a badge. Prefer the
            # value already stored on the booking (set when the form was
            # submitted from the Cohort page) — fall back to 'coaching'.
            if not b.get("source"):
                b["source"] = "cohort" if (b.get("cohort_id") or b.get("cohort_slug")) else "coaching"
            # Resolve cohort_name lazily so admin UI can render the badge
            # text even on legacy bookings that only stored the slug/id.
            if b["source"] == "cohort" and not b.get("cohort_name"):
                lookup_q = {}
                if b.get("cohort_id"):
                    lookup_q["id"] = b["cohort_id"]
                elif b.get("cohort_slug"):
                    lookup_q["slug"] = b["cohort_slug"]
                if lookup_q:
                    cohort_doc = await db.cohorts.find_one(lookup_q, {"_id": 0, "name": 1})
                    if cohort_doc:
                        b["cohort_name"] = cohort_doc.get("name")
            
            # Format scheduled time as IST for display
            if b.get("scheduled_date") and b.get("scheduled_time"):
                # New format: already in IST
                b["scheduled_datetime_display"] = f"{b['scheduled_date']} {b['scheduled_time']} IST"
            elif b.get("scheduled_datetime_ist"):
                # IST-aware datetime
                dt = b["scheduled_datetime_ist"]
                if hasattr(dt, 'strftime'):
                    b["scheduled_datetime_display"] = dt.strftime("%Y-%m-%d %H:%M IST")
                else:
                    b["scheduled_datetime_display"] = str(dt)
            elif b.get("scheduled_datetime"):
                # Legacy: might be UTC or naive
                dt = b["scheduled_datetime"]
                if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
                    # Convert to IST
                    dt_ist = dt.astimezone(ist)
                    b["scheduled_datetime_display"] = dt_ist.strftime("%Y-%m-%d %H:%M IST")
                    b["scheduled_date"] = dt_ist.strftime("%Y-%m-%d")
                    b["scheduled_time"] = dt_ist.strftime("%H:%M")
                elif hasattr(dt, 'strftime'):
                    # Assume naive datetime is IST
                    b["scheduled_datetime_display"] = dt.strftime("%Y-%m-%d %H:%M IST")
                    b["scheduled_date"] = dt.strftime("%Y-%m-%d")
                    b["scheduled_time"] = dt.strftime("%H:%M")
                else:
                    b["scheduled_datetime_display"] = str(dt)
            else:
                b["scheduled_datetime_display"] = "Not scheduled"
        
        # ===== Merge cohort discovery calls =====
        # Cohort discovery calls live in a separate collection
        # (`cohort_discovery_calls`) and have a slightly different shape.
        # Normalise them so the admin UI can render them alongside regular
        # discovery calls in the same table.
        cohort_query = {}
        if status:
            # Map regular -> cohort status names. Cohort uses
            # "scheduled" instead of "accepted", but we keep "accepted" filter
            # also matching "scheduled" for UX consistency.
            cohort_query["status"] = "scheduled" if status == "accepted" else status
        # Skip cohort_discovery_calls entries that were AUTO-mirrored from a
        # parent booking in `discovery_call_bookings` (they carry
        # `linked_booking_id`). Otherwise the admin sees two rows for the
        # same submission — one with the full questionnaire answers (from
        # `discovery_call_bookings`) and one with only summary fields (the
        # mirror in `cohort_discovery_calls`), which looks like a duplicate
        # "empty" entry. The mirror still exists for the Cohort admin tab.
        cohort_query["$or"] = [
            {"linked_booking_id": {"$exists": False}},
            {"linked_booking_id": None},
            {"linked_booking_id": ""},
        ]
        cohort_calls_cursor = db.cohort_discovery_calls.find(cohort_query).sort("requested_at", -1)
        cohort_calls = await cohort_calls_cursor.to_list(500)

        normalised_cohort = []
        for c in cohort_calls:
            c.pop("_id", None)
            scheduled_at = c.get("scheduled_at")
            scheduled_date = None
            scheduled_time = None
            scheduled_display = "Not scheduled"
            if scheduled_at:
                try:
                    if isinstance(scheduled_at, str):
                        dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
                    else:
                        dt = scheduled_at
                    if dt.tzinfo is None:
                        dt = pytz.utc.localize(dt)
                    dt_ist = dt.astimezone(ist)
                    scheduled_date = dt_ist.strftime("%Y-%m-%d")
                    scheduled_time = dt_ist.strftime("%H:%M")
                    scheduled_display = f"{scheduled_date} {scheduled_time} IST"
                except Exception:
                    pass

            # Map cohort statuses -> admin UI statuses (so existing colour map works)
            cohort_status = c.get("status", "pending")
            ui_status = {
                "scheduled": "accepted",
                "completed": "completed",
                "cancelled": "rejected",
                "pending": "pending",
            }.get(cohort_status, cohort_status)

            try:
                created_at = datetime.fromisoformat(
                    str(c.get("requested_at", "")).replace("Z", "+00:00")
                ) if c.get("requested_at") else datetime.utcnow()
            except Exception:
                created_at = datetime.utcnow()

            normalised_cohort.append({
                "id": c.get("id"),
                "name": c.get("name"),
                "email": c.get("email"),
                "phone": c.get("phone"),
                "scheduled_date": scheduled_date,
                "scheduled_time": scheduled_time,
                "scheduled_datetime_display": scheduled_display,
                "status": ui_status,
                "answers": {
                    "Cohort": c.get("cohort_name") or c.get("cohort_slug") or "Cohort",
                    "Preferred time": c.get("preferred_time") or "—",
                    "Message": c.get("message") or "—",
                },
                "meet_link": c.get("meet_link"),
                "created_at": created_at,
                "updated_at": created_at,
                # Markers for the admin UI
                "source": "cohort",
                "cohort_name": c.get("cohort_name"),
                "cohort_slug": c.get("cohort_slug"),
                "cohort_id": c.get("cohort_id"),
            })

        bookings.extend(normalised_cohort)
        # Re-sort merged list by created_at desc.
        # Normalise to naive UTC for the sort key to avoid TypeError when
        # comparing naive datetimes (from `discovery_call_bookings.created_at`,
        # stored as `datetime.utcnow()`) with timezone-aware ones (from
        # `cohort_discovery_calls.requested_at`, parsed from ISO with tz).
        def _sort_key(x):
            dt = x.get("created_at") or datetime(1970, 1, 1)
            try:
                if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
                    dt = dt.astimezone(pytz.utc).replace(tzinfo=None)
            except Exception:
                dt = datetime(1970, 1, 1)
            return dt
        bookings.sort(key=_sort_key, reverse=True)

        # Get counts (across both sources) — exclude auto-mirrored cohort
        # entries (they have `linked_booking_id`) to avoid double-counting.
        not_mirrored = {"$or": [
            {"linked_booking_id": {"$exists": False}},
            {"linked_booking_id": None},
            {"linked_booking_id": ""},
        ]}
        total = (
            await db.discovery_call_bookings.count_documents({})
            + await db.cohort_discovery_calls.count_documents(not_mirrored)
        )
        pending = (
            await db.discovery_call_bookings.count_documents({"status": "pending"})
            + await db.cohort_discovery_calls.count_documents({"status": "pending", **not_mirrored})
        )
        accepted = (
            await db.discovery_call_bookings.count_documents({"status": "accepted"})
            + await db.cohort_discovery_calls.count_documents({"status": "scheduled", **not_mirrored})
        )
        rejected = (
            await db.discovery_call_bookings.count_documents({"status": "rejected"})
            + await db.cohort_discovery_calls.count_documents({"status": "cancelled", **not_mirrored})
        )
        completed = (
            await db.discovery_call_bookings.count_documents({"status": "completed"})
            + await db.cohort_discovery_calls.count_documents({"status": "completed", **not_mirrored})
        )
        
        return {
            "bookings": bookings,
            "counts": {
                "total": total,
                "pending": pending,
                "accepted": accepted,
                "rejected": rejected,
                "completed": completed
            }
        }
    except Exception as e:
        logger.error(f"Error getting bookings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/bookings/{booking_id}/accept")
async def accept_booking(
    request: Request,
    booking_id: str,
    body: AcceptBookingRequest = AcceptBookingRequest(),
):
    """Accept a discovery call booking and create calendar invite with Google Meet link.

    If the booking has no scheduled_date/time yet (new admin-pick flow), the
    admin MUST pass `selected_date` + `selected_time` in the body. We then
    persist them to the booking document before generating the calendar event.
    """
    await verify_admin(request)
    
    try:
        # Try regular bookings first, then cohort calls
        booking = await db.discovery_call_bookings.find_one({"id": booking_id})
        is_cohort_call = False
        update_collection = db.discovery_call_bookings
        if not booking:
            booking = await db.cohort_discovery_calls.find_one({"id": booking_id})
            is_cohort_call = True
            update_collection = db.cohort_discovery_calls
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # If admin supplied a slot in the body, prefer it over whatever the
        # booking currently has and persist it back.
        if body.selected_date and body.selected_time:
            # Double-booking guard against accepted/pending bookings on this slot
            existing = await db.discovery_call_bookings.find_one({
                "id": {"$ne": booking_id},
                "scheduled_date": body.selected_date,
                "scheduled_time": body.selected_time,
                "status": {"$in": ["pending", "accepted"]},
            })
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="This slot is already taken by another booking.",
                )
            await update_collection.update_one(
                {"id": booking_id},
                {"$set": {
                    "scheduled_date": body.selected_date,
                    "scheduled_time": body.selected_time,
                    "scheduled_datetime_ist": datetime.strptime(
                        f"{body.selected_date} {body.selected_time}", "%Y-%m-%d %H:%M"
                    ),
                    "updated_at": datetime.utcnow(),
                }},
            )
            booking["scheduled_date"] = body.selected_date
            booking["scheduled_time"] = body.selected_time
        elif not (booking.get("scheduled_date") and booking.get("scheduled_time")):
            raise HTTPException(
                status_code=400,
                detail="No date/time on this booking — admin must pick a slot before accepting.",
            )
        
        # Get settings for admin email
        settings = await db.discovery_call_settings.find_one({"_id": "settings"})
        admin_email = settings.get("admin_email", "bookings@gradnext.co") if settings else "bookings@gradnext.co"
        duration = settings.get("call_duration_minutes", 15) if settings else 15
        
        # Get the scheduled datetime in IST
        # Support both new format (date + time strings) and legacy format (datetime object)
        ist = pytz.timezone('Asia/Kolkata')
        
        if booking.get("scheduled_date") and booking.get("scheduled_time"):
            # New format: separate date and time in IST
            naive_datetime = datetime.strptime(
                f"{booking['scheduled_date']} {booking['scheduled_time']}", 
                "%Y-%m-%d %H:%M"
            )
            scheduled_datetime_ist = ist.localize(naive_datetime)
        elif booking.get("scheduled_datetime_ist"):
            # Already IST-aware datetime
            scheduled_datetime_ist = booking["scheduled_datetime_ist"]
            if scheduled_datetime_ist.tzinfo is None:
                scheduled_datetime_ist = ist.localize(scheduled_datetime_ist)
        elif booking.get("scheduled_datetime"):
            # Legacy format: stored datetime (might be UTC or naive)
            legacy_dt = booking["scheduled_datetime"]
            if legacy_dt.tzinfo is None:
                # Assume it was meant to be IST
                scheduled_datetime_ist = ist.localize(legacy_dt)
            else:
                scheduled_datetime_ist = legacy_dt.astimezone(ist)
        else:
            raise HTTPException(status_code=400, detail="No scheduled datetime found in booking")
        
        # Create calendar event with Google Meet link included
        from services.calendar_service import GoogleCalendarService
        calendar_service = GoogleCalendarService()
        
        meet_link = None
        event_id = None
        
        if calendar_service.is_available():
            # Use the discovery call specific method that includes Meet link
            # Pass the IST datetime - calendar service will handle timezone
            event_result = calendar_service.create_discovery_call_event(
                candidate_name=booking['name'],
                candidate_email=booking['email'],
                candidate_phone=booking.get('phone', 'N/A'),
                admin_email=admin_email,
                start_datetime=scheduled_datetime_ist,
                duration_minutes=duration
            )
            
            if event_result:
                meet_link = event_result.get("meet_link")
                event_id = event_result.get("event_id")
                logger.info(f"Discovery call event created with Meet link: {meet_link}")
        else:
            logger.warning("Calendar service not available for discovery call")
        
        # Update booking in the correct collection
        update_collection = db.cohort_discovery_calls if is_cohort_call else db.discovery_call_bookings
        cohort_status = "scheduled" if is_cohort_call else "accepted"
        await update_collection.update_one(
            {"id": booking_id},
            {
                "$set": {
                    "status": cohort_status,
                    "meet_link": meet_link,
                    "calendar_event_id": event_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Sync status + Meet link to Google Sheet (fire-and-forget)
        try:
            _asyncio.create_task(
                google_sheets_service.update_discovery_call_status_in_sheet(
                    booking_id=booking_id,
                    status="accepted",
                    meet_link=meet_link,
                )
            )
        except Exception as sheet_error:
            logger.warning(f"Google Sheet sync scheduling error (non-critical): {sheet_error}")
        
        # Format the scheduled time for response
        scheduled_time_display = scheduled_datetime_ist.strftime("%Y-%m-%d %H:%M IST")
        
        return {
            "success": True,
            "message": f"Booking accepted! Calendar invite sent for {scheduled_time_display}",
            "meet_link": meet_link,
            "scheduled_time": scheduled_time_display
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/bookings/{booking_id}/reject")
async def reject_booking(request: Request, booking_id: str, reason: Optional[str] = None):
    """Reject a discovery call booking (works for both regular and cohort calls)"""
    await verify_admin(request)
    
    try:
        # Try regular discovery_call_bookings first
        result = await db.discovery_call_bookings.update_one(
            {"id": booking_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejection_reason": reason,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        collection_used = "discovery_call_bookings"
        
        # If not found in regular bookings, try cohort_discovery_calls
        if result.matched_count == 0:
            result = await db.cohort_discovery_calls.update_one(
                {"id": booking_id},
                {
                    "$set": {
                        "status": "cancelled",  # cohort calls use "cancelled" for rejected
                        "rejection_reason": reason,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            collection_used = "cohort_discovery_calls"
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Sync status to Google Sheet (fire-and-forget)
        try:
            _asyncio.create_task(
                google_sheets_service.update_discovery_call_status_in_sheet(
                    booking_id=booking_id, status="rejected"
                )
            )
        except Exception as sheet_error:
            logger.warning(f"Google Sheet sync scheduling error (non-critical): {sheet_error}")

        logger.info(f"Booking {booking_id} rejected in {collection_used}")
        return {"success": True, "message": "Booking rejected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/bookings/sync-to-sheet")
async def sync_all_bookings_to_sheet(request: Request):
    """One-off: push every existing discovery-call booking into the Google Sheet.
    Safe to call repeatedly — rows are appended, so first run the sheet should
    start empty (or admin can clear the 'Discovery Calls' tab beforehand)."""
    await verify_admin(request)

    try:
        questions = await db.discovery_call_questions.find({}).to_list(100)
        bookings = await db.discovery_call_bookings.find({}).sort("created_at", 1).to_list(5000)

        synced = 0
        for b in bookings:
            b.pop("_id", None)
            try:
                await google_sheets_service.append_discovery_call_to_sheet(b, questions)
                synced += 1
            except Exception as sync_err:
                logger.warning(f"Failed to sync booking {b.get('id')}: {sync_err}")

        return {
            "success": True,
            "total_bookings": len(bookings),
            "synced": synced,
        }
    except Exception as e:
        logger.error(f"Error syncing bookings to sheet: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.post("/bookings/{booking_id}/complete")
async def complete_booking(request: Request, booking_id: str):
    """Mark a booking as completed (works for both regular and cohort calls)"""
    await verify_admin(request)
    
    try:
        # Try regular bookings first
        result = await db.discovery_call_bookings.update_one(
            {"id": booking_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # If not found, try cohort calls
        if result.matched_count == 0:
            result = await db.cohort_discovery_calls.update_one(
                {"id": booking_id},
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Sync status to Google Sheet (fire-and-forget)
        try:
            _asyncio.create_task(
                google_sheets_service.update_discovery_call_status_in_sheet(
                    booking_id=booking_id, status="completed"
                )
            )
        except Exception as sheet_error:
            logger.warning(f"Google Sheet sync scheduling error (non-critical): {sheet_error}")

        return {"success": True, "message": "Booking marked as completed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Calendar Connection Routes =============

@admin_router.get("/calendar/status")
async def get_calendar_status(request: Request):
    """Check if admin calendar is connected for discovery calls"""
    await verify_admin(request)
    
    try:
        # Check if we have stored credentials for discovery calls
        calendar_creds = await db.discovery_call_calendar.find_one({"_id": "admin_calendar"})
        
        if not calendar_creds or not calendar_creds.get("access_token"):
            return {
                "connected": False,
                "email": None
            }
        
        # Check if token is expired
        expiry = calendar_creds.get("token_expiry")
        is_expired = False
        if expiry:
            try:
                if isinstance(expiry, str):
                    is_expired = datetime.fromisoformat(expiry) < datetime.utcnow()
                elif isinstance(expiry, (int, float)):
                    # Legacy: expires_in seconds stored directly
                    is_expired = False  # Can't determine without connected_at
            except Exception:
                is_expired = False
        
        if is_expired:
            # Try to refresh
            try:
                creds = Credentials(
                    token=calendar_creds.get("access_token"),
                    refresh_token=calendar_creds.get("refresh_token"),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=GOOGLE_CLIENT_ID,
                    client_secret=GOOGLE_CLIENT_SECRET
                )
                if creds.expired and creds.refresh_token:
                    from google.auth.transport.requests import Request as GoogleRequest
                    creds.refresh(GoogleRequest())
                    
                    # Save refreshed credentials
                    await db.discovery_call_calendar.update_one(
                        {"_id": "admin_calendar"},
                        {"$set": {
                            "access_token": creds.token,
                            "token_expiry": creds.expiry.isoformat() if creds.expiry else None
                        }}
                    )
            except Exception as e:
                logger.error(f"Failed to refresh calendar token: {e}")
                return {
                    "connected": False,
                    "email": None,
                    "error": "Token expired and refresh failed"
                }
        
        return {
            "connected": True,
            "email": calendar_creds.get("email", "Connected")
        }
    except Exception as e:
        logger.error(f"Error checking calendar status: {e}")
        return {"connected": False, "email": None}


@admin_router.get("/calendar/connect")
async def initiate_calendar_connection(request: Request):
    """Start OAuth flow for Google Calendar connection"""
    await verify_admin(request)
    
    try:
        backend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001/api")
        redirect_uri = f"{backend_url}/api/admin/discovery-calls/calendar/callback"
        
        flow = get_calendar_oauth_flow(redirect_uri)
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Store state in database for verification
        await db.discovery_call_calendar.update_one(
            {"_id": "oauth_state"},
            {"$set": {"state": state, "created_at": datetime.utcnow()}},
            upsert=True
        )
        
        return {"authorization_url": authorization_url}
    except Exception as e:
        logger.error(f"Error initiating calendar connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/calendar/callback")
async def calendar_oauth_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle OAuth callback from Google"""
    try:
        if error:
            logger.error(f"OAuth error: {error}")
            return RedirectResponse(url=f"{FRONTEND_URL}/admin?calendar_error={error}")
        
        if not code:
            return RedirectResponse(url=f"{FRONTEND_URL}/admin?calendar_error=no_code")
        
        backend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001/api")
        redirect_uri = f"{backend_url}/api/admin/discovery-calls/calendar/callback"
        
        # Exchange code for tokens manually to avoid scope mismatch issues
        # (Google returns additional scopes like userinfo.email, openid that the Flow library rejects)
        import httpx
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            if token_response.status_code != 200:
                error_text = token_response.text
                logger.error(f"Token exchange failed: {error_text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/admin?calendar_error=token_exchange_failed")
            
            token_data = token_response.json()
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        
        if not access_token:
            return RedirectResponse(url=f"{FRONTEND_URL}/admin?calendar_error=no_access_token")
        
        # Build credentials from token data
        from google.oauth2.credentials import Credentials
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=CALENDAR_SCOPES
        )
        
        # Get user email from calendar API
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().get(calendarId='primary').execute()
        email = calendar_list.get('id', 'Unknown')
        
        # Store credentials
        expires_in = token_data.get("expires_in", 3600)
        token_expiry = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        
        await db.discovery_call_calendar.update_one(
            {"_id": "admin_calendar"},
            {"$set": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expiry": token_expiry,
                "email": email,
                "connected_at": datetime.utcnow()
            }},
            upsert=True
        )
        
        logger.info(f"Calendar connected successfully for discovery calls: {email}")
        return RedirectResponse(url=f"{FRONTEND_URL}/admin?section=discovery-calls&calendar_connected=true")
    except Exception as e:
        logger.error(f"Error in calendar callback: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/admin?calendar_error={str(e)}")


@admin_router.delete("/calendar/disconnect")
async def disconnect_calendar(request: Request):
    """Disconnect Google Calendar"""
    await verify_admin(request)
    
    try:
        await db.discovery_call_calendar.delete_one({"_id": "admin_calendar"})
        return {"success": True, "message": "Calendar disconnected"}
    except Exception as e:
        logger.error(f"Error disconnecting calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Default Questions =============

def get_default_questions():
    """Return default discovery call questions based on the screenshots"""
    return [
        {
            "id": str(uuid.uuid4()),
            "question": "Your Name",
            "type": "short_text",
            "required": True,
            "options": [],
            "order": 0,
            "placeholder": "Enter your full name"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Email",
            "type": "email",
            "required": True,
            "options": [],
            "order": 1,
            "placeholder": "Enter your email address"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Phone Number",
            "type": "phone",
            "required": True,
            "options": [],
            "order": 2,
            "placeholder": "+91 XXXXX XXXXX"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Current Location",
            "type": "short_text",
            "required": True,
            "options": [],
            "order": 3,
            "placeholder": "City, Country"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Undergraduate University",
            "type": "short_text",
            "required": True,
            "options": [],
            "order": 4,
            "placeholder": "Enter your undergraduate university"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Postgraduate University (or if you have an admit from a college)",
            "type": "short_text",
            "required": False,
            "options": [],
            "order": 5,
            "placeholder": "Enter your postgraduate university or leave blank"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Total Work Ex (in Months)",
            "type": "short_text",
            "required": True,
            "options": [],
            "order": 6,
            "placeholder": "e.g., 24"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Latest Organisation",
            "type": "short_text",
            "required": True,
            "options": [],
            "order": 7,
            "placeholder": "Enter your current/latest employer"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Which one of the following best describes your current situation?",
            "type": "single_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "Preparing for Consulting Interviews", "value": "preparing"},
                {"id": str(uuid.uuid4()), "label": "Currently in Interview Process", "value": "interviewing"},
                {"id": str(uuid.uuid4()), "label": "Exploring Career Options", "value": "exploring"},
                {"id": str(uuid.uuid4()), "label": "Looking to Switch to Consulting", "value": "switching"},
                {"id": str(uuid.uuid4()), "label": "MBA Student/Applicant", "value": "mba"}
            ],
            "order": 8,
            "placeholder": None
        },
        {
            "id": str(uuid.uuid4()),
            "question": "If you are in an interview process, which firm?",
            "type": "short_text",
            "required": False,
            "options": [],
            "order": 9,
            "placeholder": "e.g., McKinsey, BCG, Bain"
        },
        {
            "id": str(uuid.uuid4()),
            "question": "What is your primary goal or expected outcome from working with us?",
            "type": "multiple_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "Crack MBB interviews", "value": "mbb"},
                {"id": str(uuid.uuid4()), "label": "Crack Tier-2 consulting interviews", "value": "tier2"},
                {"id": str(uuid.uuid4()), "label": "Improve case solving skills", "value": "case_skills"},
                {"id": str(uuid.uuid4()), "label": "Get structured preparation plan", "value": "prep_plan"},
                {"id": str(uuid.uuid4()), "label": "Practice with peers", "value": "peer_practice"},
                {"id": str(uuid.uuid4()), "label": "Get feedback from consultants", "value": "feedback"}
            ],
            "order": 10,
            "placeholder": None
        },
        {
            "id": str(uuid.uuid4()),
            "question": "What do you think is your biggest pain point or obstacle in achieving this goal?",
            "type": "single_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "CV not getting shortlisted", "value": "cv_rejection"},
                {"id": str(uuid.uuid4()), "label": "Not getting interview calls", "value": "no_interview"},
                {"id": str(uuid.uuid4()), "label": "Struggling with case interviews", "value": "case_interview"},
                {"id": str(uuid.uuid4()), "label": "Struggling with fit/PEI interviews", "value": "fit_interview"},
                {"id": str(uuid.uuid4()), "label": "Application strategy and targeting", "value": "application"},
                {"id": str(uuid.uuid4()), "label": "Lack of structured preparation", "value": "structure"},
                {"id": str(uuid.uuid4()), "label": "Limited practice partners", "value": "partners"},
                {"id": str(uuid.uuid4()), "label": "Time management", "value": "time"}
            ],
            "order": 11,
            "placeholder": None
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Which programme format do you think would be most suitable for you to achieve your goal?",
            "type": "single_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "One-on-one coaching (starts from ₹16,999)", "value": "coaching"},
                {"id": str(uuid.uuid4()), "label": "Self-learning (starts from ₹399 per month)", "value": "self_learning"},
                {"id": str(uuid.uuid4()), "label": "Not sure yet", "value": "unsure"}
            ],
            "order": 12,
            "placeholder": None
        },
        {
            "id": str(uuid.uuid4()),
            "question": "What is the purpose of the call?",
            "type": "multiple_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "Understand gradnext offerings", "value": "understand"},
                {"id": str(uuid.uuid4()), "label": "Get personalized recommendations", "value": "recommendations"},
                {"id": str(uuid.uuid4()), "label": "Discuss pricing and plans", "value": "pricing"},
                {"id": str(uuid.uuid4()), "label": "Ask specific questions", "value": "questions"},
                {"id": str(uuid.uuid4()), "label": "Get started with preparation", "value": "get_started"}
            ],
            "order": 13,
            "placeholder": None
        },
        {
            "id": str(uuid.uuid4()),
            "question": "Anything you would like us to know?",
            "type": "long_text",
            "required": False,
            "options": [],
            "order": 14,
            "placeholder": "Share any additional information or questions..."
        },
        {
            "id": str(uuid.uuid4()),
            "question": "How did you hear about us?",
            "type": "single_choice",
            "required": True,
            "options": [
                {"id": str(uuid.uuid4()), "label": "Google Search", "value": "google"},
                {"id": str(uuid.uuid4()), "label": "LinkedIn", "value": "linkedin"},
                {"id": str(uuid.uuid4()), "label": "Instagram", "value": "instagram"},
                {"id": str(uuid.uuid4()), "label": "Friend/Colleague Referral", "value": "referral"},
                {"id": str(uuid.uuid4()), "label": "YouTube", "value": "youtube"},
                {"id": str(uuid.uuid4()), "label": "Other", "value": "other"}
            ],
            "order": 15,
            "placeholder": None
        }
    ]
