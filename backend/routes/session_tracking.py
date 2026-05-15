"""
Session Tracking Module
Handles session check-ins, completion verification, and no-show detection
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Constants
CHECK_IN_WINDOW_BEFORE = 15  # minutes before session start (matches frontend "Join" enable window)
CHECK_IN_WINDOW_AFTER = 30   # minutes after session start (matches frontend grace period)
NO_SHOW_THRESHOLD = 15       # minutes after session start to mark as potential no-show


class SessionCheckInResponse(BaseModel):
    success: bool
    message: str
    meet_link: Optional[str] = None
    checked_in_at: Optional[str] = None


class SessionCompletionRequest(BaseModel):
    status: str  # "completed", "no_show_candidate", "no_show_mentor", "cancelled"
    notes: Optional[str] = None
    duration_minutes: Optional[int] = None


async def _resolve_is_booking_mentor(db, user: dict, booking: dict) -> bool:
    """Robustly determine whether the current user is the mentor on this booking.

    The mentor's user record and mentor record may differ in how they were
    linked (cached mentor_id, email match, or user_id link). Any ONE of the
    following being true is enough:
      1. The user's cached mentor_id on the user record equals booking.mentor_id.
      2. The user's email matches the mentor record that owns this booking.
      3. The mentor record's user_id points at this user's id.
    """
    if not user.get("is_mentor"):
        return False

    booking_mentor_id = booking.get("mentor_id")
    if not booking_mentor_id:
        return False

    # Fast path: cached mentor_id
    if user.get("mentor_id") == booking_mentor_id:
        return True

    # Look up the actual mentor record for this booking and compare identifiers.
    mentor = await db.mentors.find_one({"id": booking_mentor_id}, {"_id": 0})
    if not mentor:
        return False
    if mentor.get("email") and mentor.get("email").lower() == (user.get("email") or "").lower():
        return True
    if mentor.get("user_id") and mentor.get("user_id") == user.get("id"):
        return True
    return False


@router.post("/{booking_id}/check-in")
async def check_in_session(booking_id: str, request: Request) -> SessionCheckInResponse:
    """
    Check-in to a session and get the meeting link.
    Only available within the check-in window (10 mins before to 15 mins after session start).
    Supports coaching bookings, strategy call sessions, and partner bookings.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the booking - check all collections
    booking = await db.bookings.find_one({"id": booking_id})
    booking_collection = "bookings"
    booking_type = "coaching"
    
    if not booking:
        # Try strategy_call_sessions
        booking = await db.strategy_call_sessions.find_one({"id": booking_id})
        booking_collection = "strategy_call_sessions"
        booking_type = "strategy_call"
    
    if not booking:
        # Try partner_bookings
        booking = await db.partner_bookings.find_one({"id": booking_id})
        booking_collection = "partner_bookings"
        booking_type = "partner_booking"
    
    if not booking:
        raise HTTPException(
            status_code=404,
            detail=(
                "Session not found. If you just rescheduled, refresh the page and try again; "
                "otherwise contact support@gradnext.co with your session details."
            ),
        )
    
    # Verify user is part of this booking
    user_id = user.get("id")
    is_candidate = booking.get("user_id") == user_id
    is_booking_mentor = await _resolve_is_booking_mentor(db, user, booking)
    
    if not is_candidate and not is_booking_mentor:
        raise HTTPException(status_code=403, detail="You are not part of this session")
    
    # Parse session datetime - handle different field names across collections
    session_date = booking.get("date")
    session_time = booking.get("time_slot") or booking.get("time") or "00:00"
    
    try:
        # Parse as IST (UTC+5:30)
        session_datetime_str = f"{session_date} {session_time}"
        session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
        # Assume IST timezone
        ist_offset = timedelta(hours=5, minutes=30)
        session_datetime_utc = session_datetime - ist_offset
        session_datetime_utc = session_datetime_utc.replace(tzinfo=timezone.utc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid session datetime: {e}")
    
    # Check if within check-in window
    now = datetime.now(timezone.utc)
    window_start = session_datetime_utc - timedelta(minutes=CHECK_IN_WINDOW_BEFORE)
    window_end = session_datetime_utc + timedelta(minutes=CHECK_IN_WINDOW_AFTER)
    
    if now < window_start:
        minutes_until = int((window_start - now).total_seconds() / 60)
        raise HTTPException(
            status_code=400, 
            detail=f"Check-in opens {minutes_until} minutes before the session. Please wait."
        )
    
    if now > window_end:
        raise HTTPException(
            status_code=400, 
            detail="Check-in window has closed. Please contact support if you need assistance."
        )
    
    # Record check-in in the correct collection
    check_in_time = now.isoformat()
    collection = getattr(db, booking_collection)
    
    if is_booking_mentor:
        await collection.update_one(
            {"id": booking_id},
            {
                "$set": {
                    "mentor_checked_in_at": check_in_time,
                    "mentor_checked_in": True
                }
            }
        )
        role = "mentor"
    else:
        await collection.update_one(
            {"id": booking_id},
            {
                "$set": {
                    "candidate_checked_in_at": check_in_time,
                    "candidate_checked_in": True
                }
            }
        )
        role = "candidate"
    
    # Get the meeting link (stored securely in booking)
    meet_link = booking.get("meet_link")
    
    if not meet_link:
        # Fallback: try to get from calendar event
        meet_link = booking.get("calendar_meet_link")
    
    # If still no meet link, try to create one on-demand (only for coaching bookings)
    if not meet_link and booking_type == "coaching":
        try:
            from services.calendar_service import create_coaching_session_event
            
            # Get mentor details
            mentor = await db.mentors.find_one({"id": booking.get("mentor_id")})
            mentor_name = mentor.get("name", "Mentor") if mentor else "Mentor"
            mentor_email = mentor.get("email", "") if mentor else ""
            
            # Get candidate details
            candidate = await db.users.find_one({"id": booking.get("user_id")})
            candidate_name = candidate.get("name", "Candidate") if candidate else booking.get("candidate_name", "Candidate")
            candidate_email = candidate.get("email", "") if candidate else ""
            
            # Build session notes
            session_type = booking.get("session_type", "Coaching")
            case_type = booking.get("case_type", "")
            calendar_notes = f"Session Type: {session_type}"
            if case_type:
                calendar_notes += f"\nCase Type: {case_type}"
            
            # Try to create calendar event with meet link
            calendar_result = create_coaching_session_event(
                mentor_name=mentor_name,
                mentor_email=mentor_email,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                session_date=booking.get("date"),
                session_time=booking.get("time_slot"),
                duration_minutes=45,
                session_notes=calendar_notes
            )
            
            if calendar_result and calendar_result.get("meet_link"):
                meet_link = calendar_result.get("meet_link")
                # Update the booking with the new meet link
                await collection.update_one(
                    {"id": booking_id},
                    {"$set": {
                        "meet_link": meet_link,
                        "calendar_event_id": calendar_result.get("event_id"),
                        # Persist meet_space_name so a later artifact-
                        # fetch run can pull the recording even when the
                        # link was created on-demand at check-in time.
                        "meet_space_name": calendar_result.get("meet_space_name"),
                        "calendar_html_link": calendar_result.get("html_link")
                    }}
                )
        except Exception as e:
            # Log the error but don't fail the check-in
            import logging
            logging.error(f"Failed to create on-demand meet link for booking {booking_id}: {e}")
    
    return SessionCheckInResponse(
        success=True,
        message=f"Successfully checked in as {role}",
        meet_link=meet_link,
        checked_in_at=check_in_time
    )


@router.get("/{booking_id}/status")
async def get_session_status(booking_id: str, request: Request):
    """
    Get the current status of a session including check-in status.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the booking - check all collections
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.strategy_call_sessions.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.partner_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is part of this booking
    user_id = user.get("id")
    is_candidate = booking.get("user_id") == user_id
    is_booking_mentor = await _resolve_is_booking_mentor(db, user, booking)
    
    if not is_candidate and not is_booking_mentor:
        raise HTTPException(status_code=403, detail="You are not part of this session")
    
    # Parse session datetime for status calculations
    session_date = booking.get("date")
    session_time = booking.get("time_slot") or booking.get("time") or "00:00"
    
    try:
        session_datetime_str = f"{session_date} {session_time}"
        session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
        ist_offset = timedelta(hours=5, minutes=30)
        session_datetime_utc = session_datetime - ist_offset
        session_datetime_utc = session_datetime_utc.replace(tzinfo=timezone.utc)
    except:
        session_datetime_utc = None
    
    now = datetime.now(timezone.utc)
    
    # Determine check-in window status
    check_in_status = "not_available"
    if session_datetime_utc:
        window_start = session_datetime_utc - timedelta(minutes=CHECK_IN_WINDOW_BEFORE)
        window_end = session_datetime_utc + timedelta(minutes=CHECK_IN_WINDOW_AFTER)
        
        if now < window_start:
            check_in_status = "upcoming"
            minutes_until = int((window_start - now).total_seconds() / 60)
        elif now <= window_end:
            check_in_status = "open"
        else:
            check_in_status = "closed"
    
    return {
        "booking_id": booking_id,
        "status": booking.get("status", "confirmed"),
        "date": session_date,
        "time_slot": session_time,
        "mentor_checked_in": booking.get("mentor_checked_in", False),
        "candidate_checked_in": booking.get("candidate_checked_in", False),
        "mentor_checked_in_at": booking.get("mentor_checked_in_at"),
        "candidate_checked_in_at": booking.get("candidate_checked_in_at"),
        "check_in_window_status": check_in_status,
        "session_completion_status": booking.get("completion_status"),
        "is_mentor": is_booking_mentor,
        "is_candidate": is_candidate
    }


@router.post("/{booking_id}/complete")
async def mark_session_complete(
    booking_id: str, 
    completion_data: SessionCompletionRequest,
    request: Request
):
    """
    Mark a session as completed or report a no-show.
    Only the mentor can mark completion status.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the booking - check all collections
    booking = await db.bookings.find_one({"id": booking_id})
    booking_collection = "bookings"
    
    if not booking:
        booking = await db.strategy_call_sessions.find_one({"id": booking_id})
        booking_collection = "strategy_call_sessions"
    
    if not booking:
        booking = await db.partner_bookings.find_one({"id": booking_id})
        booking_collection = "partner_bookings"
    
    if not booking:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is the mentor for this booking (use the same robust resolution
    # as check-in so email-matched mentors aren't falsely rejected).
    if not await _resolve_is_booking_mentor(db, user, booking):
        if not user.get("is_mentor", False):
            raise HTTPException(status_code=403, detail="Only mentors can mark session completion")
        raise HTTPException(status_code=403, detail="You are not the mentor for this session")
    
    # Validate status
    valid_statuses = ["completed", "no_show_candidate", "no_show_mentor", "cancelled"]
    if completion_data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Update booking
    update_data = {
        "completion_status": completion_data.status,
        "completion_marked_at": datetime.now(timezone.utc).isoformat(),
        "completion_marked_by": user.get("id")
    }
    
    if completion_data.notes:
        update_data["completion_notes"] = completion_data.notes
    
    if completion_data.duration_minutes:
        update_data["actual_duration_minutes"] = completion_data.duration_minutes
    
    # If completed, update booking status
    if completion_data.status == "completed":
        update_data["status"] = "completed"
    elif completion_data.status in ["no_show_candidate", "no_show_mentor"]:
        update_data["status"] = "no_show"
    
    collection = getattr(db, booking_collection)
    await collection.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )

    # If session was completed and has a meet_space_name, fire-and-forget
    # an immediate artifact sync. Recordings usually finalize 5-15 min
    # after a session ends, so we kick off a tiered retry chain (4, 10, 20
    # min) that keeps trying until Google publishes the recording.
    if (
        completion_data.status == "completed"
        and booking.get("meet_space_name")
        and booking_collection in ("bookings", "strategy_call_sessions")
    ):
        try:
            import asyncio as _asyncio
            from services.meet_artifacts_service import sync_artifacts_for_record

            async def _delayed_sync():
                # Tiered retries — Google's recording-finalization time
                # varies widely (we've seen 3 min on short calls, 15+ min
                # on long ones). Stop as soon as we get a recording_url.
                for delay_minutes in (4, 10, 20):
                    await _asyncio.sleep(delay_minutes * 60)
                    try:
                        fresh = await collection.find_one({"id": booking_id}, {"_id": 0})
                        if not fresh:
                            return
                        if fresh.get("recording_url") and fresh.get("recording_drive_moved"):
                            return
                        await sync_artifacts_for_record(collection, fresh)
                    except Exception as e:  # noqa: BLE001
                        import logging
                        logging.warning(f"[on-complete sync attempt {delay_minutes}m] {booking_id}: {e}")

            _asyncio.create_task(_delayed_sync())
        except Exception as e:  # noqa: BLE001
            import logging
            logging.warning(f"Failed to schedule on-complete artifact sync for {booking_id}: {e}")

    return {
        "success": True,
        "message": f"Session marked as {completion_data.status}",
        "booking_id": booking_id
    }


@router.get("/pending-confirmation")
async def get_pending_confirmations(request: Request):
    """
    Get sessions that need completion confirmation (for mentors).
    Returns sessions that ended more than 45 minutes + buffer time ago but haven't been marked.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can access this")
    
    # Get mentor profile
    mentor = await db.mentors.find_one({"user_id": user.get("id")})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    mentor_id = mentor.get("id")
    
    # Get current time
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    
    # Find bookings that:
    # 1. Belong to this mentor
    # 2. Are confirmed (not cancelled)
    # 3. Don't have completion_status set
    # 4. Session time has passed
    
    bookings = await db.bookings.find({
        "mentor_id": mentor_id,
        "status": {"$in": ["confirmed", "pending"]},
        "completion_status": {"$exists": False}
    }, {"_id": 0}).to_list(100)
    
    pending = []
    for booking in bookings:
        try:
            session_datetime_str = f"{booking.get('date')} {booking.get('time_slot')}"
            session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
            
            # Check if session should be over (45-minute sessions + 1 hour buffer)
            session_end_plus_buffer = session_datetime + timedelta(minutes=105)  # 45 min + 60 min buffer
            
            if now_ist > session_end_plus_buffer:
                pending.append({
                    "id": booking.get("id"),
                    "date": booking.get("date"),
                    "time_slot": booking.get("time_slot"),
                    "candidate_name": booking.get("candidate_name"),
                    "session_type": booking.get("session_type"),
                    "mentor_checked_in": booking.get("mentor_checked_in", False),
                    "candidate_checked_in": booking.get("candidate_checked_in", False)
                })
        except:
            continue
    
    return pending


@router.get("/check-in-ready")
async def get_check_in_ready_sessions(request: Request):
    """
    Get sessions that are ready for check-in (within the check-in window).
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id")
    is_mentor = user.get("is_mentor", False)
    
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now + ist_offset
    
    # Build query based on user type
    if is_mentor:
        mentor = await db.mentors.find_one({"user_id": user_id})
        if not mentor:
            return []
        query = {"mentor_id": mentor.get("id"), "status": {"$in": ["confirmed", "pending"]}}
    else:
        query = {"user_id": user_id, "status": {"$in": ["confirmed", "pending"]}}
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(50)
    
    ready_sessions = []
    for booking in bookings:
        try:
            session_datetime_str = f"{booking.get('date')} {booking.get('time_slot')}"
            session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
            
            window_start = session_datetime - timedelta(minutes=CHECK_IN_WINDOW_BEFORE)
            window_end = session_datetime + timedelta(minutes=CHECK_IN_WINDOW_AFTER)
            
            if window_start <= now_ist <= window_end:
                ready_sessions.append({
                    "id": booking.get("id"),
                    "date": booking.get("date"),
                    "time_slot": booking.get("time_slot"),
                    "mentor_name": booking.get("mentor_name"),
                    "candidate_name": booking.get("candidate_name"),
                    "session_type": booking.get("session_type"),
                    "already_checked_in": booking.get("mentor_checked_in" if is_mentor else "candidate_checked_in", False)
                })
        except:
            continue
    
    return ready_sessions



# ============ Peer Session Check-In ============

@router.post("/peer/{session_id}/check-in")
async def check_in_peer_session(session_id: str, request: Request) -> SessionCheckInResponse:
    """
    Check-in to a peer practice session and get the meeting link.
    Only available within the check-in window (10 mins before to 15 mins after session start).
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the peer session
    session = await db.peer_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Verify user is part of this session
    user_id = user.get("id")
    is_requester = session.get("requester_id") == user_id
    is_partner = session.get("partner_id") == user_id
    
    if not is_requester and not is_partner:
        raise HTTPException(status_code=403, detail="You are not part of this session")
    
    # Parse session datetime
    session_date = session.get("date")
    session_time = session.get("time_slot")
    
    try:
        # Parse as IST (UTC+5:30)
        session_datetime_str = f"{session_date} {session_time}"
        session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
        # Assume IST timezone
        ist_offset = timedelta(hours=5, minutes=30)
        session_datetime_utc = session_datetime - ist_offset
        session_datetime_utc = session_datetime_utc.replace(tzinfo=timezone.utc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid session datetime: {e}")
    
    # Check if within check-in window
    now = datetime.now(timezone.utc)
    window_start = session_datetime_utc - timedelta(minutes=CHECK_IN_WINDOW_BEFORE)
    window_end = session_datetime_utc + timedelta(minutes=CHECK_IN_WINDOW_AFTER)
    
    if now < window_start:
        minutes_until = int((window_start - now).total_seconds() / 60)
        raise HTTPException(
            status_code=400, 
            detail=f"Check-in opens {minutes_until} minutes before the session. Please wait."
        )
    
    if now > window_end:
        raise HTTPException(
            status_code=400, 
            detail="Check-in window has closed. Please contact support if you need assistance."
        )
    
    # Record check-in
    check_in_time = now.isoformat()
    
    if is_requester:
        await db.peer_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "requester_checked_in_at": check_in_time,
                    "requester_checked_in": True
                }
            }
        )
        role = "requester"
    else:
        await db.peer_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "partner_checked_in_at": check_in_time,
                    "partner_checked_in": True
                }
            }
        )
        role = "partner"
    
    # Get the meeting link (stored securely in session)
    meet_link = session.get("meet_link")
    
    return SessionCheckInResponse(
        success=True,
        message=f"Successfully checked in as {role}",
        meet_link=meet_link,
        checked_in_at=check_in_time
    )


@router.get("/peer/{session_id}/status")
async def get_peer_session_status(session_id: str, request: Request):
    """
    Get the current status of a peer session including check-in status.
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the session
    session = await db.peer_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Verify user is part of this session
    user_id = user.get("id")
    is_requester = session.get("requester_id") == user_id
    is_partner = session.get("partner_id") == user_id
    
    if not is_requester and not is_partner:
        raise HTTPException(status_code=403, detail="You are not part of this session")
    
    # Parse session datetime for status calculations
    session_date = session.get("date")
    session_time = session.get("time_slot")
    
    try:
        session_datetime_str = f"{session_date} {session_time}"
        session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
        ist_offset = timedelta(hours=5, minutes=30)
        session_datetime_utc = session_datetime - ist_offset
        session_datetime_utc = session_datetime_utc.replace(tzinfo=timezone.utc)
    except:
        session_datetime_utc = None
    
    now = datetime.now(timezone.utc)
    
    # Determine check-in window status
    check_in_status = "not_available"
    if session_datetime_utc:
        window_start = session_datetime_utc - timedelta(minutes=CHECK_IN_WINDOW_BEFORE)
        window_end = session_datetime_utc + timedelta(minutes=CHECK_IN_WINDOW_AFTER)
        
        if now < window_start:
            check_in_status = "upcoming"
        elif now <= window_end:
            check_in_status = "open"
        else:
            check_in_status = "closed"
    
    return {
        "session_id": session_id,
        "status": session.get("status", "confirmed"),
        "date": session_date,
        "time_slot": session_time,
        "requester_checked_in": session.get("requester_checked_in", False),
        "partner_checked_in": session.get("partner_checked_in", False),
        "requester_checked_in_at": session.get("requester_checked_in_at"),
        "partner_checked_in_at": session.get("partner_checked_in_at"),
        "check_in_window_status": check_in_status,
        "is_requester": is_requester,
        "is_partner": is_partner
    }
