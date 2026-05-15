"""
Calendar API Routes
Handles calendar event creation and management for sessions
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from routes.auth import get_current_user, get_db
from services.calendar_service import (
    get_calendar_service,
    create_coaching_session_event,
    create_peer_practice_event,
    create_workshop_event
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["calendar"])


# ============ Pydantic Models ============

class CoachingSessionRequest(BaseModel):
    mentor_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    duration_minutes: int = 45
    notes: Optional[str] = None


class PeerPracticeRequest(BaseModel):
    partner_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    duration_minutes: int = 45
    practice_type: str = "Case Interview"


class WorkshopInviteRequest(BaseModel):
    workshop_id: str
    attendee_emails: List[str]


class CalendarEventResponse(BaseModel):
    success: bool
    event_id: Optional[str] = None
    meet_link: Optional[str] = None
    html_link: Optional[str] = None
    message: str


# ============ Health Check ============

@router.get("/status")
async def calendar_status():
    """Check if Google Calendar integration is working"""
    service = get_calendar_service()
    return {
        "calendar_available": service.is_available(),
        "impersonating": "info@gradnext.co",
        "timezone": "Asia/Kolkata"
    }


# ============ Coaching Session Events ============

@router.post("/coaching-session", response_model=CalendarEventResponse)
async def create_coaching_calendar_event(
    request: Request,
    data: CoachingSessionRequest
):
    """
    Create a calendar event for a 1:1 coaching session
    Sends invites to both mentor and candidate with Google Meet link
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get mentor details
    mentor = await db.mentors.find_one({"id": data.mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    mentor_email = mentor.get("email")
    mentor_name = mentor.get("name")
    
    if not mentor_email:
        raise HTTPException(status_code=400, detail="Mentor email not configured")
    
    # Create calendar event
    result = create_coaching_session_event(
        mentor_name=mentor_name,
        mentor_email=mentor_email,
        candidate_name=user.name,
        candidate_email=user.email,
        session_date=data.date,
        session_time=data.time,
        duration_minutes=data.duration_minutes,
        session_notes=data.notes
    )
    
    if not result:
        return CalendarEventResponse(
            success=False,
            message="Failed to create calendar event. Please check calendar integration settings."
        )
    
    # Store the event details in the booking
    await db.bookings.update_one(
        {
            "user_id": user.get("id"),
            "mentor_id": data.mentor_id,
            "date": data.date,
            "time_slot": data.time
        },
        {
            "$set": {
                "calendar_event_id": result.get("event_id"),
                "meet_link": result.get("meet_link"),
                "calendar_html_link": result.get("html_link"),
                "calendar_created_at": datetime.utcnow()
            }
        }
    )
    
    logger.info(f"Created coaching calendar event for {user.email} with {mentor_email}")
    
    return CalendarEventResponse(
        success=True,
        event_id=result.get("event_id"),
        meet_link=result.get("meet_link"),
        html_link=result.get("html_link"),
        message=f"Calendar invite sent to {user.email} and {mentor_email}"
    )


# ============ Peer Practice Events ============

@router.post("/peer-practice", response_model=CalendarEventResponse)
async def create_peer_practice_calendar_event(
    request: Request,
    data: PeerPracticeRequest
):
    """
    Create a calendar event for a peer practice session
    Sends invites to both peers with Google Meet link
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get partner details
    partner = await db.users.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Peer partner not found")
    
    partner_email = partner.get("email")
    partner_name = partner.get("name")
    
    if not partner_email:
        raise HTTPException(status_code=400, detail="Partner email not available")
    
    # Create calendar event
    result = create_peer_practice_event(
        user1_name=user.name,
        user1_email=user.email,
        user2_name=partner_name,
        user2_email=partner_email,
        session_date=data.date,
        session_time=data.time,
        duration_minutes=data.duration_minutes,
        practice_type=data.practice_type
    )
    
    if not result:
        return CalendarEventResponse(
            success=False,
            message="Failed to create calendar event. Please check calendar integration settings."
        )
    
    # Store the event details in the peer session
    await db.peer_sessions.update_one(
        {
            "$or": [
                {"requester_id": user.get("id"), "partner_id": data.partner_id},
                {"requester_id": data.partner_id, "partner_id": user.get("id")}
            ],
            "date": data.date,
            "time_slot": data.time
        },
        {
            "$set": {
                "calendar_event_id": result.get("event_id"),
                "meet_link": result.get("meet_link"),
                "calendar_html_link": result.get("html_link"),
                "calendar_created_at": datetime.utcnow()
            }
        }
    )
    
    logger.info(f"Created peer practice calendar event for {user.email} with {partner_email}")
    
    return CalendarEventResponse(
        success=True,
        event_id=result.get("event_id"),
        meet_link=result.get("meet_link"),
        html_link=result.get("html_link"),
        message=f"Calendar invite sent to {user.email} and {partner_email}"
    )


# ============ Workshop Events (Admin) ============

@router.post("/workshop", response_model=CalendarEventResponse)
async def create_workshop_calendar_event(
    request: Request,
    data: WorkshopInviteRequest
):
    """
    Create a calendar event for a workshop and send invites to attendees
    Admin only
    """
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_db(request)
    
    # Get workshop details
    workshop = await db.workshops.find_one({"id": data.workshop_id}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Workshop not found")
    
    # Parse time (handle both HH:MM and HH:MM:SS formats)
    workshop_time = workshop.get("time", "10:00")
    if len(workshop_time) > 5:
        workshop_time = workshop_time[:5]
    
    # Parse duration (e.g., "2 hours" -> 120 minutes)
    duration_str = workshop.get("duration", "2 hours")
    try:
        if "hour" in duration_str.lower():
            hours = float(duration_str.split()[0])
            duration_minutes = int(hours * 60)
        elif "min" in duration_str.lower():
            duration_minutes = int(duration_str.split()[0])
        else:
            duration_minutes = 120  # Default 2 hours
    except:
        duration_minutes = 120
    
    # Create calendar event
    result = create_workshop_event(
        workshop_title=workshop.get("title"),
        instructor_name=workshop.get("instructor", workshop.get("host", "gradnext Team")),
        attendee_emails=data.attendee_emails,
        workshop_date=workshop.get("date"),
        workshop_time=workshop_time,
        duration_minutes=duration_minutes,
        description=workshop.get("description", ""),
        topics=workshop.get("topics", [])
    )
    
    if not result:
        return CalendarEventResponse(
            success=False,
            message="Failed to create calendar event. Please check calendar integration settings."
        )
    
    # Update workshop with calendar details
    await db.workshops.update_one(
        {"id": data.workshop_id},
        {
            "$set": {
                "calendar_event_id": result.get("event_id"),
                "meet_link": result.get("meet_link"),
                "meeting_link": result.get("meet_link"),  # Also update meeting_link field
                "calendar_html_link": result.get("html_link"),
                "calendar_created_at": datetime.utcnow()
            }
        }
    )
    
    logger.info(f"Created workshop calendar event for {workshop.get('title')} with {len(data.attendee_emails)} attendees")
    
    return CalendarEventResponse(
        success=True,
        event_id=result.get("event_id"),
        meet_link=result.get("meet_link"),
        html_link=result.get("html_link"),
        message=f"Calendar invites sent to {len(data.attendee_emails)} attendees"
    )


# ============ Cancel Event ============

@router.delete("/event/{event_id}")
async def cancel_calendar_event(event_id: str, request: Request):
    """Cancel a calendar event"""
    user = await get_current_user(request)
    db = get_db(request)
    
    service = get_calendar_service()
    if not service.is_available():
        raise HTTPException(status_code=503, detail="Calendar service not available")
    
    # Verify user owns this event (check bookings and peer_sessions)
    booking = await db.bookings.find_one({
        "calendar_event_id": event_id,
        "$or": [{"user_id": user.get("id")}, {"mentor_id": user.get("mentor_id")}]
    })
    
    peer_session = await db.peer_sessions.find_one({
        "calendar_event_id": event_id,
        "$or": [{"requester_id": user.get("id")}, {"partner_id": user.get("id")}]
    })
    
    if not booking and not peer_session and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You don't have permission to cancel this event")
    
    # Cancel the event
    success = service.cancel_event(event_id, notify_attendees=True)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to cancel calendar event")
    
    # Clear calendar info from database
    if booking:
        await db.bookings.update_one(
            {"calendar_event_id": event_id},
            {"$unset": {"calendar_event_id": "", "meet_link": "", "calendar_html_link": ""}}
        )
    if peer_session:
        await db.peer_sessions.update_one(
            {"calendar_event_id": event_id},
            {"$unset": {"calendar_event_id": "", "meet_link": "", "calendar_html_link": ""}}
        )
    
    return {"success": True, "message": "Calendar event cancelled"}


# ============ Get Event Details ============

@router.get("/event/{event_id}")
async def get_calendar_event(event_id: str, request: Request):
    """Get details of a calendar event"""
    user = await get_current_user(request)
    
    service = get_calendar_service()
    if not service.is_available():
        raise HTTPException(status_code=503, detail="Calendar service not available")
    
    event = service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return event
