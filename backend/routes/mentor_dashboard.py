from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import uuid

from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/mentor-dashboard", tags=["mentor-dashboard"])

# IST timezone (UTC+5:30) - used for session time comparisons
IST = timezone(timedelta(hours=5, minutes=30))


class UpdateAvailabilityRequest(BaseModel):
    availability: List[dict]  # [{day: "Monday", slots: [{from: "09:00", to: "17:00"}]}]
    blocked_days: Optional[List[str]] = None  # ["2026-01-25", "2026-01-26"]
    max_sessions_per_day: Optional[int] = None
    minimum_booking_hours: Optional[int] = None  # Hours of advance notice required


class UpdateMentorProfileRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    bio: Optional[str] = None
    expertise: Optional[List[str]] = None
    linkedin: Optional[str] = None
    profile_picture: Optional[str] = None


class SubmitFeedbackRequest(BaseModel):
    booking_id: str
    session_type: str
    case_type: Optional[str] = None
    # Overall rating (required for all session types)
    rating_overall: int
    # Areas (optional - not needed for CV and General discussion)
    areas_of_strength: Optional[List[str]] = []
    areas_of_improvement: Optional[List[str]] = []
    qualitative_feedback: Optional[str] = None
    
    # Case Session ratings
    rating_problem_understanding: Optional[int] = None
    rating_framework_structure: Optional[int] = None
    rating_case_math: Optional[int] = None
    rating_business_judgment: Optional[int] = None
    rating_communication_synthesis: Optional[int] = None
    
    # PEI Session ratings
    rating_leadership_story: Optional[int] = None
    rating_connection_growth: Optional[int] = None
    rating_drive_story: Optional[int] = None
    rating_growth_story: Optional[int] = None
    
    # CV Review Session ratings
    rating_cv_layout: Optional[int] = None
    rating_experience_clarity: Optional[int] = None
    rating_quantification: Optional[int] = None
    rating_relevance_prioritization: Optional[int] = None
    rating_language_grammar: Optional[int] = None
    
    # FIT Session ratings
    rating_self_introduction: Optional[int] = None
    rating_leadership_examples: Optional[int] = None
    rating_teamwork: Optional[int] = None
    rating_motivation_drive: Optional[int] = None
    rating_cultural_fit: Optional[int] = None
    
    # General Discussion ratings
    rating_communication_clarity: Optional[int] = None
    rating_professionalism: Optional[int] = None
    rating_curiosity_engagement: Optional[int] = None
    
    # Legacy fields (for backward compatibility)
    rating_scoping_questions: Optional[int] = None
    rating_case_structure: Optional[int] = None
    rating_quantitative: Optional[int] = None
    quantitative_tested: Optional[bool] = True
    rating_communication: Optional[int] = None
    rating_business_acumen: Optional[int] = None


async def get_mentor_id(user: dict, db) -> str:
    """Get mentor ID from user, fallback to email lookup"""
    mentor_id = user.get("mentor_id")
    
    if mentor_id:
        # Verify mentor exists
        mentor = await db.mentors.find_one({"id": mentor_id})
        if mentor:
            return mentor_id
    
    # Fallback: find by email
    mentor = await db.mentors.find_one({"email": user.get("email")})
    if mentor:
        # Update user's mentor_id
        await db.users.update_one(
            {"id": user.get("id")},
            {"$set": {"mentor_id": mentor.get("id")}}
        )
        return mentor.get("id")
    
    return None


def _parse_deadline(deadline_str: str) -> datetime:
    """Parse a deadline string. Naive values (e.g. from datetime-local inputs)
    are treated as UTC so comparisons against tz-aware now() never raise."""
    dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/verify")
async def verify_mentor(request: Request):
    """Verify if current user is a mentor"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    return {"is_mentor": True, "mentor_id": mentor_id}


@router.get("/debug/session-lookup")
async def debug_session_lookup(request: Request):
    """Debug endpoint to diagnose mentor session visibility issues"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    result = {
        "user_email": user.get("email"),
        "user_id": user.get("id"),
        "user_mentor_id": user.get("mentor_id"),
        "user_is_mentor": user.get("is_mentor"),
    }
    
    # Check mentor record by mentor_id
    if user.get("mentor_id"):
        mentor_by_id = await db.mentors.find_one({"id": user.get("mentor_id")}, {"_id": 0, "id": 1, "email": 1, "name": 1})
        result["mentor_by_id"] = mentor_by_id
    else:
        result["mentor_by_id"] = None
    
    # Check mentor record by email
    mentor_by_email = await db.mentors.find_one({"email": user.get("email")}, {"_id": 0, "id": 1, "email": 1, "name": 1})
    result["mentor_by_email"] = mentor_by_email
    
    # Get resolved mentor_id
    resolved_mentor_id = await get_mentor_id(user, db)
    result["resolved_mentor_id"] = resolved_mentor_id
    
    # Count bookings with different mentor_id lookups
    if resolved_mentor_id:
        bookings_count = await db.bookings.count_documents({"mentor_id": resolved_mentor_id})
        result["bookings_with_resolved_id"] = bookings_count
        
        # Get sample booking
        sample_booking = await db.bookings.find_one({"mentor_id": resolved_mentor_id}, {"_id": 0, "id": 1, "mentor_id": 1, "mentor_name": 1, "date": 1, "status": 1})
        result["sample_booking"] = sample_booking
    
    # Also check bookings by mentor email (in case stored differently)
    bookings_by_email = await db.bookings.count_documents({"mentor_email": user.get("email")})
    result["bookings_by_mentor_email"] = bookings_by_email
    
    # Check strategy calls
    if resolved_mentor_id:
        strategy_calls_count = await db.strategy_call_sessions.count_documents({"mentor_id": resolved_mentor_id})
        result["strategy_calls_with_resolved_id"] = strategy_calls_count
    
    return result


@router.get("/stats")
async def get_mentor_stats(request: Request):
    """Get mentor statistics from actual bookings and feedbacks (includes strategy calls)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    # Get all coaching bookings for this mentor (EXCLUDE strategy calls)
    all_bookings = await db.bookings.find({
        "mentor_id": mentor_id,
        "session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
    }, {"_id": 0}).to_list(1000)
    
    # Get all strategy call sessions for this mentor
    all_strategy_calls = await db.strategy_call_sessions.find({"mentor_id": mentor_id}, {"_id": 0}).to_list(1000)
    
    # Use IST timezone for session comparisons (sessions are booked in IST)
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Calculate coaching session stats
    completed_sessions = []
    upcoming_sessions = []
    
    for b in all_bookings:
        booking_date = b.get("date", "")
        booking_time = b.get("time_slot") or b.get("time") or "00:00"
        booking_status = b.get("status", "")
        
        is_past = False
        if booking_status == "completed" or b.get("completion_status") == "completed":
            is_past = True
        elif booking_date < today:
            is_past = True
        elif booking_date == today:
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_minutes = session_hour * 60 + session_min
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes >= session_minutes:
                    is_past = True
            except:
                pass
        
        if is_past and booking_status not in ["cancelled"]:
            completed_sessions.append(b)
        elif booking_status in ["pending", "confirmed"] and not is_past:
            upcoming_sessions.append(b)
    
    # Calculate strategy call stats
    completed_strategy_calls = []
    upcoming_strategy_calls = []
    
    for sc in all_strategy_calls:
        sc_date = sc.get("date", "")
        sc_time = sc.get("time", "00:00")
        sc_status = sc.get("status", "")
        
        is_past = False
        if sc_status == "completed":
            is_past = True
        elif sc_date < today:
            is_past = True
        elif sc_date == today:
            try:
                session_hour, session_min = map(int, sc_time.split(":"))
                session_minutes = session_hour * 60 + session_min
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes >= session_minutes:
                    is_past = True
            except:
                pass
        
        if is_past and sc_status not in ["cancelled"]:
            completed_strategy_calls.append(sc)
        elif sc_status in ["scheduled", "confirmed"] and not is_past:
            upcoming_strategy_calls.append(sc)
    
    pending_feedback = [b for b in completed_sessions if not b.get("mentor_feedback_submitted")]
    
    # Get mentor's hourly rate from admin settings
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    hourly_rate = mentor.get("hourly_rate", 0) if mentor else 0  # 0 if not set by admin
    strategy_call_rate = mentor.get("strategy_call_rate", 0) if mentor else 0  # 0 if not set by admin
    
    # Calculate earnings (coaching + strategy calls)
    coaching_earnings = len(completed_sessions) * hourly_rate
    strategy_earnings = len(completed_strategy_calls) * strategy_call_rate
    total_earnings = coaching_earnings + strategy_earnings
    
    # Calculate this month's earnings
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    this_month_coaching = [b for b in completed_sessions if b.get("date", "").startswith(current_month)]
    this_month_strategy = [sc for sc in completed_strategy_calls if sc.get("date", "").startswith(current_month)]
    this_month_earnings = (len(this_month_coaching) * hourly_rate) + (len(this_month_strategy) * strategy_call_rate)
    
    # Get mentor document for stored values (from historical import)
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0, "rating": 1, "sessions_conducted": 1})
    stored_rating = mentor.get("rating") if mentor else None
    stored_sessions = (mentor.get("sessions_conducted") or 0) if mentor else 0
    
    # Get feedbacks received from candidates
    candidate_feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": mentor_id},
        {"_id": 0, "rating_overall": 1, "is_historical": 1}
    ).to_list(500)
    
    # Separate historical (imported) feedbacks from real user feedbacks
    real_feedbacks = [f for f in candidate_feedbacks if not f.get("is_historical", False)]
    
    # Historical rating weight: fixed at 3 reviews (assumed baseline)
    HISTORICAL_RATING_WEIGHT = 3
    
    # Calculate blended rating
    if stored_rating is not None and real_feedbacks:
        # Blend historical rating with new ratings
        new_ratings_sum = sum(f.get("rating_overall", 5) for f in real_feedbacks)
        new_ratings_count = len(real_feedbacks)
        
        blended_rating = (stored_rating * HISTORICAL_RATING_WEIGHT + new_ratings_sum) / (HISTORICAL_RATING_WEIGHT + new_ratings_count)
        average_rating = round(blended_rating, 1)
    elif stored_rating is not None:
        # Only historical rating exists
        average_rating = round(float(stored_rating), 1)
    elif candidate_feedbacks:
        # No historical rating, calculate from all feedbacks
        total_rating = sum(f.get("rating_overall", 0) for f in candidate_feedbacks)
        average_rating = round(total_rating / len(candidate_feedbacks), 1)
    else:
        average_rating = None
    
    # Combined totals
    total_all_sessions = len(all_bookings) + len(all_strategy_calls)
    total_completed = len(completed_sessions) + len(completed_strategy_calls)
    total_upcoming = len(upcoming_sessions) + len(upcoming_strategy_calls)
    
    # Use maximum of stored sessions (historical) and calculated sessions
    total_sessions_display = max(stored_sessions, total_completed)
    
    return {
        "total_sessions": total_all_sessions,
        "completed_sessions": total_sessions_display,  # Now includes historical
        "upcoming_sessions": total_upcoming,
        "total_earnings": total_earnings,
        "this_month_earnings": this_month_earnings,
        "average_rating": average_rating,
        "total_reviews": len(candidate_feedbacks),
        "pending_feedbacks": len(pending_feedback),
        # Detailed breakdown
        "coaching_sessions": len(all_bookings),
        "strategy_call_sessions": len(all_strategy_calls),
        "upcoming_coaching": len(upcoming_sessions),
        "upcoming_strategy_calls": len(upcoming_strategy_calls)
    }


@router.get("/sessions/upcoming")
async def get_upcoming_sessions(request: Request):
    """Get mentor's upcoming sessions from database (includes coaching, strategy calls, and partner bookings)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Use IST timezone for session comparisons (sessions are booked in IST)
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Get all coaching bookings for mentor that are pending/confirmed (active sessions only)
    all_bookings = await db.bookings.find(
        {
            "mentor_id": mentor_id,
            "status": {"$in": ["pending", "confirmed"]}
        },
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Get all strategy call sessions for mentor that are scheduled/confirmed
    all_strategy_calls = await db.strategy_call_sessions.find(
        {
            "mentor_id": mentor_id,
            "status": {"$in": ["scheduled", "confirmed"]}
        },
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Get all partner bookings for mentor that are scheduled
    all_partner_bookings = await db.partner_bookings.find(
        {
            "mentor_id": mentor_id,
            "status": "scheduled"
        },
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Filter coaching bookings to only include future sessions
    upcoming_bookings = []
    for booking in all_bookings:
        booking_date = booking.get("date", "")
        booking_time = booking.get("time_slot") or booking.get("time") or "00:00"
        
        if booking_date > today:
            upcoming_bookings.append(booking)
        elif booking_date == today:
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_end_minutes = session_hour * 60 + session_min + 30
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes < session_end_minutes:
                    upcoming_bookings.append(booking)
            except:
                upcoming_bookings.append(booking)
    
    # Filter strategy calls to only include future sessions
    upcoming_strategy_calls = []
    for sc in all_strategy_calls:
        sc_date = sc.get("date", "")
        sc_time = sc.get("time") or sc.get("time_slot") or "00:00"
        
        if sc_date > today:
            upcoming_strategy_calls.append(sc)
        elif sc_date == today:
            try:
                session_hour, session_min = map(int, sc_time.split(":"))
                session_end_minutes = session_hour * 60 + session_min + 30
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes < session_end_minutes:
                    upcoming_strategy_calls.append(sc)
            except:
                upcoming_strategy_calls.append(sc)
    
    # Filter partner bookings to only include future sessions
    upcoming_partner_bookings = []
    for pb in all_partner_bookings:
        pb_date = pb.get("date", "")
        pb_time = pb.get("time_slot") or "00:00"
        
        if pb_date > today:
            upcoming_partner_bookings.append(pb)
        elif pb_date == today:
            try:
                session_hour, session_min = map(int, pb_time.split(":"))
                session_end_minutes = session_hour * 60 + session_min + 30
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes < session_end_minutes:
                    upcoming_partner_bookings.append(pb)
            except:
                upcoming_partner_bookings.append(pb)
    
    # Enrich coaching bookings with candidate info and feedback status
    result = []
    for booking in upcoming_bookings:
        candidate = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0})
        
        mentor_feedback = await db.mentor_feedbacks.find_one({"booking_id": booking.get("id")})
        candidate_feedback = await db.candidate_feedbacks.find_one({"booking_id": booking.get("id")})
        
        result.append({
            "id": booking.get("id"),
            "booking_type": "coaching",  # NEW: Identify as coaching session
            "candidate_id": booking.get("user_id"),
            "candidate_name": candidate.get("name", "Unknown") if candidate else "Unknown",
            "candidate_picture": candidate.get("picture", "") if candidate else "",
            "candidate_email": candidate.get("email", "") if candidate else "",
            "date": booking.get("date"),
            "time": booking.get("time_slot") or booking.get("time") or "",
            "duration": "60 min",
            "session_type": booking.get("session_type", "General discussion"),
            "case_type": booking.get("case_type"),
            "candidate_notes": booking.get("candidate_notes"),
            "status": booking.get("status"),
            "meet_link": booking.get("meet_link", ""),
            "calendar_event_id": booking.get("calendar_event_id", ""),
            "mentor_checked_in": booking.get("mentor_checked_in", False),
            "candidate_checked_in": booking.get("candidate_checked_in", False),
            "completion_status": booking.get("completion_status"),
            "feedback_submitted": mentor_feedback is not None,
            "candidate_feedback_submitted": candidate_feedback is not None,
            "was_rescheduled": booking.get("was_rescheduled", False),
            "previous_date": booking.get("previous_date"),
            "previous_time_slot": booking.get("previous_time_slot"),
            "rescheduled_at": booking.get("rescheduled_at"),
            "rescheduled_by": booking.get("rescheduled_by"),
            "rescheduled_by_name": booking.get("rescheduled_by_name")
        })
    
    # Enrich strategy calls with candidate info
    for sc in upcoming_strategy_calls:
        candidate = await db.users.find_one({"id": sc.get("user_id")}, {"_id": 0})
        
        result.append({
            "id": sc.get("id"),
            "booking_type": "strategy_call",  # NEW: Identify as strategy call
            "candidate_id": sc.get("user_id"),
            "candidate_name": sc.get("user_name") or (candidate.get("name", "Unknown") if candidate else "Unknown"),
            "candidate_picture": candidate.get("picture", "") if candidate else "",
            "candidate_email": sc.get("user_email") or (candidate.get("email", "") if candidate else ""),
            "date": sc.get("date"),
            "time": sc.get("time", ""),
            "duration": f"{sc.get('duration_minutes', 30)} min",
            "session_type": "Strategy Call",  # Fixed type for strategy calls
            "case_type": None,
            "candidate_notes": sc.get("notes"),
            "status": sc.get("status"),
            "meet_link": sc.get("meet_link", ""),
            "calendar_event_id": sc.get("calendar_event_id", ""),
            "mentor_checked_in": sc.get("mentor_checked_in", False),
            "candidate_checked_in": sc.get("candidate_checked_in", False),
            "completion_status": sc.get("completion_status"),
            "feedback_submitted": False,  # Strategy calls don't have feedback yet
            "candidate_feedback_submitted": False,
            "was_rescheduled": False,
            "previous_date": None,
            "previous_time_slot": None,
            "rescheduled_at": None,
            "rescheduled_by": None,
            "rescheduled_by_name": None
        })
    
    # Add partner bookings to result (bookings from partner institutes)
    for pb in upcoming_partner_bookings:
        # Get partner info
        partner = await db.partners.find_one({"id": pb.get("partner_id")}, {"_id": 0, "name": 1})
        partner_name = partner.get("name", "Partner Institute") if partner else "Partner Institute"
        
        result.append({
            "id": pb.get("id"),
            "booking_type": "partner_booking",  # Identify as partner booking
            "candidate_id": None,  # Partner candidates don't have platform accounts
            "candidate_name": pb.get("candidate_name", "Unknown"),
            "candidate_picture": "",  # No picture for external candidates
            "candidate_email": pb.get("candidate_email", ""),
            "date": pb.get("date"),
            "time": pb.get("time_slot", ""),
            "duration": f"{pb.get('duration_minutes', 45)} min",
            "session_type": pb.get("session_type", "").replace("_", " ").title(),
            "case_type": None,
            "candidate_notes": pb.get("notes"),
            "status": pb.get("status"),
            "meet_link": "",  # Partner handles their own meet links
            "calendar_event_id": "",
            "mentor_checked_in": False,
            "candidate_checked_in": False,
            "completion_status": None,
            "feedback_submitted": False,
            "candidate_feedback_submitted": False,
            "was_rescheduled": False,
            "previous_date": None,
            "previous_time_slot": None,
            "rescheduled_at": None,
            "rescheduled_by": None,
            "rescheduled_by_name": None,
            "partner_name": partner_name,  # Extra field for partner bookings
            "is_partner_booking": True  # Flag for UI differentiation
        })
    
    # Sort combined results by date and time
    result.sort(key=lambda x: (x.get("date", ""), x.get("time", "")))
    
    return result


@router.get("/sessions/past")
async def get_past_sessions(request: Request):
    """Get mentor's past sessions from database"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Use IST timezone for session comparisons (sessions are booked in IST)
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Get all bookings for mentor (EXCLUDE strategy calls - they don't need feedback)
    all_bookings = await db.bookings.find(
        {
            "mentor_id": mentor_id,
            "session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
        },
        {"_id": 0}
    ).sort("date", -1).to_list(200)
    
    # Filter to only include past sessions (considering both date AND time)
    past_bookings = []
    for booking in all_bookings:
        booking_date = booking.get("date", "")
        # Handle None or missing time_slot properly
        booking_time = booking.get("time_slot") or booking.get("time") or "00:00"
        booking_status = booking.get("status", "")
        
        # Define terminal statuses to show in past (completed, no-show, but NOT cancelled)
        terminal_statuses = [
            "completed",
            "no_show", "mentor_no_show", "candidate_no_show", "both_no_show"
        ]
        
        # Statuses to completely exclude (cancelled sessions should not appear anywhere)
        excluded_statuses = [
            "cancelled", "candidate_cancelled", "mentor_cancelled",
            "cancelled_by_candidate", "cancelled_by_mentor", "cancelled_by_admin",
            "rescheduled", "mentor_rescheduled", "candidate_rescheduled"
        ]
        
        # Skip cancelled sessions entirely
        if booking_status in excluded_statuses:
            continue
        
        # Session is past if:
        # 1. Status is a terminal status (completed/no_show), OR
        # 2. Date is in the past (and not cancelled), OR
        # 3. Date is today AND time + 30 min has passed (and not cancelled)
        if booking_status in terminal_statuses:
            past_bookings.append(booking)
        elif booking_date < today:
            past_bookings.append(booking)
        elif booking_date == today:
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_end_minutes = session_hour * 60 + session_min + 30  # 30 min after session start
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes >= session_end_minutes:
                    past_bookings.append(booking)
            except:
                # If time parsing fails but date is today, still include it if status suggests it's done
                if booking_status not in ["pending", "confirmed"]:
                    past_bookings.append(booking)
    
    # Enrich with candidate info and feedback status
    result = []
    for booking in past_bookings:
        candidate = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0})
        
        # Check feedback from collections directly for accuracy
        mentor_feedback = await db.mentor_feedbacks.find_one(
            {"booking_id": booking.get("id")},
            {"_id": 0}
        )
        candidate_feedback = await db.candidate_feedbacks.find_one(
            {"booking_id": booking.get("id")},
            {"_id": 0}
        )
        
        result.append({
            "id": booking.get("id"),
            "candidate_id": booking.get("user_id"),
            "candidate_name": candidate.get("name", "Unknown") if candidate else "Unknown",
            "candidate_picture": candidate.get("picture", "") if candidate else "",
            "date": booking.get("date"),
            "time": booking.get("time_slot") or booking.get("time") or "",
            "duration": "60 min",
            "session_type": booking.get("session_type", "General discussion"),
            "status": booking.get("status", "completed"),
            "completion_status": booking.get("completion_status"),
            "feedback_submitted": mentor_feedback is not None,
            "mentor_feedback_submitted": mentor_feedback is not None,  # Alias for frontend compatibility
            "candidate_feedback_submitted": candidate_feedback is not None,
            "candidate_rating": candidate_feedback.get("rating_overall") if candidate_feedback else None,  # Rating given by candidate to mentor
            "feedback": {
                "rating": mentor_feedback.get("rating_overall"),
                "case_type": mentor_feedback.get("case_type"),
                "qualitative_feedback": mentor_feedback.get("qualitative_feedback")
            } if mentor_feedback else None
        })
    
    return result


@router.get("/sessions/pending-feedback")
async def get_pending_feedback_sessions(request: Request):
    """Get sessions that need feedback - uses same logic as /sessions/past"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Use IST timezone for session comparisons (same as /sessions/past)
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Get ALL bookings for this mentor (exclude strategy calls)
    all_bookings = await db.bookings.find(
        {
            "mentor_id": mentor_id,
            "session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
        },
        {"_id": 0}
    ).to_list(200)
    
    # Filter to past sessions using SAME logic as /sessions/past endpoint
    past_bookings = []
    for booking in all_bookings:
        booking_date = booking.get("date", "")
        booking_time = booking.get("time_slot") or booking.get("time") or "00:00"
        booking_status = booking.get("status", "")
        
        # Skip cancelled sessions (all variants)
        excluded_statuses = [
            "cancelled", "candidate_cancelled", "mentor_cancelled",
            "cancelled_by_candidate", "cancelled_by_mentor", "cancelled_by_admin",
            "rescheduled", "mentor_rescheduled", "candidate_rescheduled"
        ]
        if booking_status in excluded_statuses:
            continue
        
        # Session is past if:
        # 1. Status is completed, OR
        # 2. Date is in the past, OR
        # 3. Date is today AND time + 30 min has passed
        is_past = False
        if booking_status == "completed":
            is_past = True
        elif booking_date < today:
            is_past = True
        elif booking_date == today:
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_end_minutes = session_hour * 60 + session_min + 30
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes >= session_end_minutes:
                    is_past = True
            except:
                pass
        
        if is_past:
            past_bookings.append(booking)
    
    # Now filter to only those WITHOUT feedback
    pending = []
    for booking in past_bookings:
        booking_id = booking.get("id")
        
        # Check mentor_feedbacks collection (primary)
        feedback = await db.mentor_feedbacks.find_one({"booking_id": booking_id})
        if feedback:
            # Feedback exists - make sure flag is updated
            if not booking.get("mentor_feedback_submitted"):
                await db.bookings.update_one(
                    {"id": booking_id},
                    {"$set": {"mentor_feedback_submitted": True, "feedback_submitted": True}}
                )
            continue
        
        # Also check session_feedbacks collection (legacy/fallback)
        feedback = await db.session_feedbacks.find_one(
            {"booking_id": booking_id, "mentor_id": mentor_id}
        )
        if feedback:
            # Feedback exists - make sure flag is updated
            if not booking.get("mentor_feedback_submitted"):
                await db.bookings.update_one(
                    {"id": booking_id},
                    {"$set": {"mentor_feedback_submitted": True, "feedback_submitted": True}}
                )
            continue
        
        # No feedback found - add to pending list
        candidate = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0})
        pending.append({
            "id": booking_id,
            "candidate_id": booking.get("user_id"),
            "candidate_name": candidate.get("name", "Unknown") if candidate else "Unknown",
            "candidate_picture": candidate.get("picture", "") if candidate else "",
            "date": booking.get("date"),
            "time": booking.get("time_slot") or booking.get("time") or "",
            "session_type": booking.get("session_type", "Coaching Session"),
            "feedback_submitted": False
        })
    
    return pending


@router.post("/feedback")
async def submit_session_feedback(feedback: SubmitFeedbackRequest, request: Request):
    """Submit feedback for a completed session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    
    # Check if feedback already exists
    existing = await db.mentor_feedbacks.find_one({"booking_id": feedback.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this session")
    
    # Get the booking to find candidate_id
    booking = await db.bookings.find_one({"id": feedback.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    candidate_id = booking.get("user_id")
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "booking_id": feedback.booking_id,
        "mentor_id": mentor_id,
        "candidate_id": candidate_id,
        "mentor_name": user.get("name", "Mentor"),
        "session_type": feedback.session_type,
        "case_type": feedback.case_type,
        "rating_overall": feedback.rating_overall,
        "areas_of_strength": feedback.areas_of_strength or [],
        "areas_of_improvement": feedback.areas_of_improvement or [],
        "qualitative_feedback": feedback.qualitative_feedback,
        "created_at": datetime.now(timezone.utc),
        
        # Case Session ratings
        "rating_problem_understanding": feedback.rating_problem_understanding,
        "rating_framework_structure": feedback.rating_framework_structure,
        "rating_case_math": feedback.rating_case_math,
        "rating_business_judgment": feedback.rating_business_judgment,
        "rating_communication_synthesis": feedback.rating_communication_synthesis,
        
        # PEI Session ratings
        "rating_leadership_story": feedback.rating_leadership_story,
        "rating_connection_growth": feedback.rating_connection_growth,
        "rating_drive_story": feedback.rating_drive_story,
        "rating_growth_story": feedback.rating_growth_story,
        
        # CV Review Session ratings
        "rating_cv_layout": feedback.rating_cv_layout,
        "rating_experience_clarity": feedback.rating_experience_clarity,
        "rating_quantification": feedback.rating_quantification,
        "rating_relevance_prioritization": feedback.rating_relevance_prioritization,
        "rating_language_grammar": feedback.rating_language_grammar,
        
        # FIT Session ratings
        "rating_self_introduction": feedback.rating_self_introduction,
        "rating_leadership_examples": feedback.rating_leadership_examples,
        "rating_teamwork": feedback.rating_teamwork,
        "rating_motivation_drive": feedback.rating_motivation_drive,
        "rating_cultural_fit": feedback.rating_cultural_fit,
        
        # General Discussion ratings
        "rating_communication_clarity": feedback.rating_communication_clarity,
        "rating_professionalism": feedback.rating_professionalism,
        "rating_curiosity_engagement": feedback.rating_curiosity_engagement,
        
        # Legacy fields (for backward compatibility)
        "rating_scoping_questions": feedback.rating_scoping_questions,
        "rating_case_structure": feedback.rating_case_structure,
        "rating_quantitative": feedback.rating_quantitative,
        "quantitative_tested": feedback.quantitative_tested,
        "rating_communication": feedback.rating_communication,
        "rating_business_acumen": feedback.rating_business_acumen
    }
    
    # Save to mentor_feedbacks collection (used by past sessions API)
    await db.mentor_feedbacks.insert_one(feedback_doc)
    
    # Determine the correct status based on check-in data
    mentor_checked_in = booking.get("mentor_checked_in", False)
    candidate_checked_in = booking.get("candidate_checked_in", False)
    
    if mentor_checked_in and candidate_checked_in:
        new_status = "completed"
    elif mentor_checked_in and not candidate_checked_in:
        new_status = "candidate_no_show"
    elif not mentor_checked_in and candidate_checked_in:
        new_status = "mentor_no_show"
    else:
        new_status = "both_no_show"
    
    # Update booking status and session_type if changed
    update_fields = {"status": new_status, "mentor_feedback_submitted": True, "feedback_submitted": True}
    if feedback.session_type:
        update_fields["session_type"] = feedback.session_type
    
    await db.bookings.update_one(
        {"id": feedback.booking_id},
        {"$set": update_fields}
    )
    
    return {"message": "Feedback submitted successfully"}


@router.get("/candidate-feedbacks")
async def get_candidate_feedbacks(request: Request):
    """Get feedbacks received from candidates (reviews about the mentor)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Get feedbacks from candidate_feedbacks collection (reviews about mentor)
    feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": mentor_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with candidate names
    result = []
    for fb in feedbacks:
        # For historical imports, use candidate_name_override
        if fb.get("is_historical") and fb.get("candidate_name_override"):
            candidate_name = fb.get("candidate_name_override")
        else:
            candidate = await db.users.find_one({"id": fb.get("candidate_id")}, {"_id": 0})
            candidate_name = candidate.get("name", "Anonymous") if candidate else "Anonymous"
        
        # Handle date formatting - could be datetime or string
        created_at = fb.get("created_at")
        if isinstance(created_at, datetime):
            formatted_date = created_at.strftime("%B %d, %Y")
        elif isinstance(created_at, str):
            # Parse ISO string and format
            try:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                formatted_date = dt.strftime("%B %d, %Y")
            except:
                formatted_date = created_at[:10] if created_at else ""
        else:
            formatted_date = ""
        
        result.append({
            "id": fb.get("id"),
            "candidate_name": candidate_name,
            "date": formatted_date,
            "rating_overall": fb.get("rating_overall", fb.get("rating", 5)),
            "other_feedback": fb.get("other_feedback", fb.get("comment", fb.get("feedback", ""))),
            "is_historical": fb.get("is_historical", False)
        })
    
    return result


@router.get("/availability")
async def get_mentor_availability(request: Request):
    """Get mentor's weekly availability template, blocked days, and max sessions"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    
    # Get weekly availability from database
    availability = await db.mentor_weekly_availability.find(
        {"mentor_id": mentor_id},
        {"_id": 0, "mentor_id": 0, "updated_at": 0}
    ).to_list(10)
    
    if not availability:
        # Return default weekly availability
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        availability = [
            {"day": day, "slots": [{"from": "09:00", "to": "17:00"}]} 
            for day in days
        ]
    
    # Get mentor settings
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    blocked_days = mentor.get("blocked_days", []) if mentor else []
    max_sessions_per_day = mentor.get("max_sessions_per_day", 5) if mentor else 5
    minimum_booking_hours = mentor.get("minimum_booking_hours", 12) if mentor else 12
    
    return {
        "availability": availability,
        "blocked_days": blocked_days,
        "max_sessions_per_day": max_sessions_per_day,
        "minimum_booking_hours": minimum_booking_hours
    }


@router.put("/availability")
async def update_mentor_availability(availability_data: UpdateAvailabilityRequest, request: Request):
    """Update mentor's weekly availability template, blocked days, and max sessions"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    
    # Store weekly availability template
    # First delete ALL existing weekly availability (this clears the slate)
    await db.mentor_weekly_availability.delete_many({"mentor_id": mentor_id})
    
    # Clear cached per-day availability (stale data from previous template)
    await db.mentor_availability.delete_many({"mentor_id": mentor_id})
    
    # Now insert new availability - ONLY days that have slots
    # If availability_data.availability is empty or all days have empty slots,
    # nothing will be inserted, effectively clearing the mentor's availability
    for day_data in availability_data.availability:
        day_name = day_data.get("day")
        slots = day_data.get("slots", [])
        
        # Only insert if there are actual slots to save
        if day_name and slots and len(slots) > 0:
            await db.mentor_weekly_availability.insert_one({
                "mentor_id": mentor_id,
                "day": day_name,
                "slots": slots,
                "updated_at": datetime.now(timezone.utc)
            })
    
    # Update blocked days and max sessions in mentor profile
    update_data = {}
    
    if availability_data.blocked_days is not None:
        update_data["blocked_days"] = availability_data.blocked_days
    
    if availability_data.max_sessions_per_day is not None:
        update_data["max_sessions_per_day"] = availability_data.max_sessions_per_day
    
    if availability_data.minimum_booking_hours is not None:
        update_data["minimum_booking_hours"] = availability_data.minimum_booking_hours
    
    if update_data:
        await db.mentors.update_one(
            {"id": mentor_id},
            {"$set": update_data}
        )
    
    return {"message": "Availability updated successfully"}


@router.get("/payments")
async def get_mentor_payments(request: Request):
    """
    Get mentor's payment history with three statuses:
    - pending: Session completed + Feedback given + Not paid
    - on_hold: Session completed + Feedback NOT given
    - paid: Marked as paid by admin
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Get mentor's hourly rate from admin settings
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    hourly_rate = mentor.get("hourly_rate", 0) if mentor else 0  # 0 if not set by admin
    
    # Get completed bookings
    bookings = await db.bookings.find(
        {"mentor_id": mentor_id, "status": "completed"},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    # Build payment history with accurate statuses
    payments = []
    for booking in bookings:
        booking_id = booking.get("id")
        candidate = await db.users.find_one({"id": booking.get("user_id")}, {"_id": 0})
        candidate_name = candidate.get("name", "Unknown") if candidate else "Unknown"
        
        # Check if feedback was submitted
        mentor_feedback = await db.mentor_feedbacks.find_one({"booking_id": booking_id})
        has_feedback = mentor_feedback is not None
        
        # Check if marked as paid by admin
        is_paid = booking.get("payment_status") == "paid"
        
        # Determine status
        if is_paid:
            status = "paid"
            status_label = "Paid"
        elif has_feedback:
            status = "pending"
            status_label = "Payment Pending"
        else:
            status = "on_hold"
            status_label = "On Hold - Awaiting Feedback"
        
        # Use override amount if set, else hourly rate
        amount = booking.get("payment_amount_override") or hourly_rate
        
        payments.append({
            "id": f"pay-{booking_id}",
            "booking_id": booking_id,
            "date": booking.get("date", ""),
            "time_slot": booking.get("time_slot") or booking.get("time") or "",
            "amount": amount,
            "sessions_count": 1,
            "status": status,
            "status_label": status_label,
            "description": f"Session with {candidate_name}",
            "session_type": booking.get("session_type", "Coaching Session"),
            "candidate_name": candidate_name,
            "has_feedback": has_feedback,
            "paid_at": booking.get("paid_at"),
        })
    
    return payments


@router.get("/profile")
async def get_mentor_profile(request: Request):
    """Get mentor's own profile information"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    # Get dynamic stats - properly count completed sessions (including past ones)
    # Use IST timezone for session comparisons (sessions are booked in IST)
    now = datetime.now(IST)
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    all_bookings = await db.bookings.find({"mentor_id": mentor_id}, {"_id": 0}).to_list(1000)
    
    completed_sessions = 0
    for b in all_bookings:
        booking_date = b.get("date", "")
        booking_time = b.get("time_slot") or b.get("time") or "00:00"
        booking_status = b.get("status", "")
        
        # Check if session is in the past
        is_past = False
        if booking_status == "completed" or b.get("completion_status") == "completed":
            is_past = True
        elif booking_date < today:
            is_past = True
        elif booking_date == today:
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_minutes = session_hour * 60 + session_min
                current_minutes = int(current_time.split(":")[0]) * 60 + int(current_time.split(":")[1])
                if current_minutes >= session_minutes:
                    is_past = True
            except:
                pass
        
        if is_past and booking_status not in ["cancelled"]:
            completed_sessions += 1
    
    # Get candidate feedbacks
    feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": mentor_id}, 
        {"_id": 0, "rating_overall": 1, "is_historical": 1}
    ).to_list(500)
    
    # Separate historical (imported) feedbacks from real user feedbacks
    real_feedbacks = [f for f in feedbacks if not f.get("is_historical", False)]
    
    # Historical rating weight: fixed at 3 reviews (assumed baseline)
    HISTORICAL_RATING_WEIGHT = 3
    
    # Calculate blended rating
    stored_rating = mentor.get("rating")
    stored_sessions = mentor.get("sessions_conducted", 0) or 0
    
    if stored_rating is not None and real_feedbacks:
        # Blend historical rating with new ratings
        new_ratings_sum = sum(f.get("rating_overall", 5) for f in real_feedbacks)
        new_ratings_count = len(real_feedbacks)
        
        blended_rating = (stored_rating * HISTORICAL_RATING_WEIGHT + new_ratings_sum) / (HISTORICAL_RATING_WEIGHT + new_ratings_count)
        avg_rating = round(blended_rating, 1)
    elif stored_rating is not None:
        # Only historical rating exists
        avg_rating = round(float(stored_rating), 1)
    elif feedbacks:
        # No historical rating, calculate from all feedbacks
        avg_rating = round(sum(f.get("rating_overall", 0) for f in feedbacks) / len(feedbacks), 1)
    else:
        avg_rating = None
    
    # Use maximum of stored sessions and calculated completed sessions
    total_sessions = max(stored_sessions, completed_sessions)
    
    return {
        "id": mentor.get("id"),
        "name": mentor.get("name", ""),
        "email": mentor.get("email", ""),
        "title": mentor.get("title", ""),
        "company": mentor.get("company", ""),
        "bio": mentor.get("bio", ""),
        "expertise": mentor.get("expertise", []),
        "profile_picture": mentor.get("profile_picture", mentor.get("picture", "")),
        "linkedin": mentor.get("linkedin", ""),
        "rating": avg_rating,
        "total_sessions": total_sessions,
        "total_reviews": len(feedbacks),
        "hourly_rate": mentor.get("hourly_rate"),  # Hourly rate set by admin
        "strategy_call_rate": mentor.get("strategy_call_rate"),  # Strategy call rate set by admin
        "payout_per_session": mentor.get("payout_per_session", 1000),  # Legacy field
        "google_calendar_connected": mentor.get("google_calendar_connected", False),
        "google_calendar_email": mentor.get("google_calendar_email"),
        "timezone": mentor.get("timezone", "Asia/Kolkata"),
    }


@router.put("/profile")
async def update_mentor_profile(profile_data: UpdateMentorProfileRequest, request: Request):
    """Update mentor's profile information - goes through approval workflow"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Map profile_picture to picture for consistency
    if "profile_picture" in update_data:
        update_data["picture"] = update_data.pop("profile_picture")
    
    # Store as pending changes (requires admin approval)
    update_data["submitted_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.mentors.update_one(
        {"id": mentor_id},
        {"$set": {"pending_changes": update_data}}
    )
    
    return {"message": "Profile changes submitted for admin approval"}


@router.put("/profile/timezone")
async def update_mentor_timezone(request: Request, tz: str):
    """Update mentor's display timezone preference. No admin approval required —
    it's a personal display setting that doesn't affect canonical (IST) storage."""
    user = await get_current_user(request)
    db = get_db(request)

    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")

    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=404, detail="Mentor profile not found")

    await db.mentors.update_one(
        {"id": mentor_id},
        {"$set": {"timezone": tz, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "timezone": tz}


@router.get("/candidates")
async def get_mentor_candidates(request: Request):
    """Get list of candidates who have had sessions with this mentor"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return []
    
    # Get all bookings for this mentor
    bookings = await db.bookings.find(
        {"mentor_id": mentor_id},
        {"_id": 0}
    ).to_list(500)
    
    # Get unique user IDs
    user_ids = list(set(b.get("user_id") for b in bookings if b.get("user_id")))
    
    # Get user details
    candidates = []
    for user_id in user_ids:
        candidate = await db.users.find_one({"id": user_id}, {"_id": 0})
        if candidate:
            # Count sessions with this candidate
            candidate_bookings = [b for b in bookings if b.get("user_id") == user_id]
            completed_sessions = len([b for b in candidate_bookings if b.get("status") == "completed"])
            upcoming_sessions = len([b for b in candidate_bookings if b.get("status") in ["pending", "confirmed"]])
            
            candidates.append({
                "id": candidate.get("id"),
                "name": candidate.get("name", "Unknown"),
                "email": candidate.get("email", ""),
                "picture": candidate.get("picture", ""),
                "plan": candidate.get("plan", "free"),
                "total_sessions": len(candidate_bookings),
                "completed_sessions": completed_sessions,
                "upcoming_sessions": upcoming_sessions,
                "last_session_date": max([b.get("date", "") for b in candidate_bookings]) if candidate_bookings else None
            })
    
    # Sort by last session date (most recent first)
    candidates.sort(key=lambda x: x.get("last_session_date") or "", reverse=True)
    
    return candidates


@router.get("/candidates/{candidate_id}")
async def get_candidate_details(candidate_id: str, request: Request):
    """Get comprehensive information about a candidate including all session history and feedback"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="User is not a mentor")
    
    mentor_id = await get_mentor_id(user, db)
    
    # Get candidate info from users collection
    candidate = await db.users.find_one({"id": candidate_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get peer profile for additional info (location, education, etc.)
    peer_profile = await db.peer_profiles.find_one({"user_id": candidate_id}, {"_id": 0})
    
    # ========== COACHING SESSIONS (with all mentors) ==========
    all_coaching_sessions = await db.bookings.find(
        {"user_id": candidate_id},
        {"_id": 0}
    ).sort("date", -1).to_list(200)
    
    # Enrich with mentor names
    for session in all_coaching_sessions:
        mentor = await db.mentors.find_one({"id": session.get("mentor_id")}, {"_id": 0, "name": 1, "picture": 1})
        if mentor:
            session["mentor_name"] = mentor.get("name", "Unknown Mentor")
            session["mentor_picture"] = mentor.get("picture")
    
    # ========== PEER SESSIONS ==========
    peer_sessions = await db.peer_sessions.find(
        {"$or": [{"requester_id": candidate_id}, {"partner_id": candidate_id}]},
        {"_id": 0}
    ).sort("date", -1).to_list(200)
    
    # ========== ALL MENTOR FEEDBACKS (from all mentors) ==========
    all_mentor_feedbacks = await db.mentor_feedbacks.find(
        {"candidate_id": candidate_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich mentor feedbacks with mentor names
    for feedback in all_mentor_feedbacks:
        mentor = await db.mentors.find_one({"id": feedback.get("mentor_id")}, {"_id": 0, "name": 1, "picture": 1})
        if mentor:
            feedback["mentor_name"] = mentor.get("name", feedback.get("mentor_name", "Unknown Mentor"))
            feedback["mentor_picture"] = mentor.get("picture")
    
    # ========== PEER FEEDBACKS (feedback received from peers) ==========
    peer_feedbacks = []
    for session in peer_sessions:
        # Determine which feedback is about this candidate
        if session.get("requester_id") == candidate_id:
            # Candidate was requester, partner's feedback is about them
            fb = session.get("partner_feedback")
            if fb:
                fb["from_name"] = session.get("partner_name", "Unknown")
                fb["session_date"] = session.get("date")
                fb["session_type"] = fb.get("session_type") or session.get("session_type", "Case session")
                peer_feedbacks.append(fb)
        else:
            # Candidate was partner, requester's feedback is about them
            fb = session.get("requester_feedback")
            if fb:
                fb["from_name"] = session.get("requester_name", "Unknown")
                fb["session_date"] = session.get("date")
                fb["session_type"] = fb.get("session_type") or session.get("session_type", "Case session")
                peer_feedbacks.append(fb)
    
    # ========== AGGREGATE AREAS OF STRENGTH/WEAKNESS ==========
    all_strengths = []
    all_improvements = []
    
    # From mentor feedbacks
    for fb in all_mentor_feedbacks:
        all_strengths.extend(fb.get("areas_of_strength", []))
        all_improvements.extend(fb.get("areas_of_improvement", []))
    
    # From peer feedbacks
    for fb in peer_feedbacks:
        all_strengths.extend(fb.get("areas_of_strength", []))
        all_improvements.extend(fb.get("areas_of_improvement", []))
    
    # Count occurrences
    from collections import Counter
    strength_counts = Counter(all_strengths)
    improvement_counts = Counter(all_improvements)
    
    # Get top areas (sorted by frequency)
    top_strengths = [{"area": area, "count": count} for area, count in strength_counts.most_common(10)]
    top_improvements = [{"area": area, "count": count} for area, count in improvement_counts.most_common(10)]
    
    # ========== CALCULATE STATISTICS ==========
    completed_coaching = [s for s in all_coaching_sessions if s.get("status") == "completed"]
    upcoming_coaching = [s for s in all_coaching_sessions if s.get("status") in ["pending", "confirmed"]]
    completed_peer = [s for s in peer_sessions if s.get("status") == "completed"]
    
    # Average ratings
    mentor_ratings = [fb.get("rating_overall", 0) for fb in all_mentor_feedbacks if fb.get("rating_overall")]
    peer_ratings = [fb.get("rating_overall", 0) for fb in peer_feedbacks if fb.get("rating_overall")]
    
    avg_mentor_rating = round(sum(mentor_ratings) / len(mentor_ratings), 1) if mentor_ratings else None
    avg_peer_rating = round(sum(peer_ratings) / len(peer_ratings), 1) if peer_ratings else None
    
    # Sessions with this mentor specifically
    sessions_with_me = [s for s in all_coaching_sessions if s.get("mentor_id") == mentor_id]
    my_feedbacks = [fb for fb in all_mentor_feedbacks if fb.get("mentor_id") == mentor_id]
    
    return {
        "candidate": {
            "id": candidate.get("id"),
            "name": candidate.get("name", "Unknown"),
            "email": candidate.get("email", ""),
            "picture": candidate.get("picture") or peer_profile.get("profile_picture") if peer_profile else "",
            "plan": candidate.get("plan", "free"),
            "joined_at": candidate.get("created_at"),
            
            # Profile details from peer_profiles
            "location": peer_profile.get("location") if peer_profile else None,
            "ug_college": peer_profile.get("ug_college") if peer_profile else None,
            "pg_college": peer_profile.get("pg_college") if peer_profile else None,
            "no_pg": peer_profile.get("no_pg", False) if peer_profile else False,
            "pg_incoming": peer_profile.get("pg_incoming", False) if peer_profile else False,
            "linkedin_url": peer_profile.get("linkedin_url") if peer_profile else None,
            "target_firms": peer_profile.get("target_firms", []) if peer_profile else [],
            "preparation_level": peer_profile.get("preparation_level") if peer_profile else None,
            "bio": peer_profile.get("bio") if peer_profile else None,
            "current_company": peer_profile.get("current_company") if peer_profile else None,
            "current_role": peer_profile.get("current_role") if peer_profile else None,
        },
        
        "coaching_sessions": all_coaching_sessions[:50],  # Last 50 coaching sessions
        "peer_sessions": peer_sessions[:50],  # Last 50 peer sessions
        
        "mentor_feedbacks": all_mentor_feedbacks,
        "peer_feedbacks": peer_feedbacks[:30],  # Last 30 peer feedbacks
        
        "aggregated_areas": {
            "strengths": top_strengths,
            "improvements": top_improvements
        },
        
        "stats": {
            "total_coaching_sessions": len(all_coaching_sessions),
            "completed_coaching_sessions": len(completed_coaching),
            "upcoming_coaching_sessions": len(upcoming_coaching),
            "total_peer_sessions": len(peer_sessions),
            "completed_peer_sessions": len(completed_peer),
            "avg_mentor_rating": avg_mentor_rating,
            "avg_peer_rating": avg_peer_rating,
            "total_mentor_feedbacks": len(all_mentor_feedbacks),
            "total_peer_feedbacks": len(peer_feedbacks),
            
            # Sessions with current mentor
            "sessions_with_me": len(sessions_with_me),
            "my_feedbacks_count": len(my_feedbacks)
        }
    }



# ============ MENTOR NOTIFICATIONS ============

@router.get("/notifications")
async def get_mentor_notifications(request: Request):
    """Get notifications for the current mentor"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get the mentor ID (from mentors collection, not user ID)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return {"notifications": [], "unread_count": 0, "pending_response_count": 0}
    
    # Get all notifications targeted to this mentor
    notifications = await db.mentor_notifications.find(
        {"target_mentor_ids": mentor_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get mentor's responses/read status
    responses = await db.mentor_notification_responses.find(
        {"mentor_id": mentor_id},
        {"_id": 0}
    ).to_list(100)
    
    response_map = {r.get("notification_id"): r for r in responses}
    
    # Enrich notifications with read/response status
    result = []
    unread_count = 0
    pending_response_count = 0
    
    for notif in notifications:
        notif_id = notif.get("id")
        response = response_map.get(notif_id)
        
        notif["is_read"] = response is not None
        notif["read_at"] = response.get("read_at") if response else None
        notif["is_responded"] = response.get("status") == "responded" if response else False
        notif["responded_at"] = response.get("responded_at") if response else None
        notif["my_response"] = response.get("response_data") if response else None
        
        if not notif["is_read"]:
            unread_count += 1
        
        if notif.get("type") == "response_required" and not notif["is_responded"]:
            # Check if deadline has passed
            deadline = notif.get("deadline")
            if deadline:
                deadline_dt = _parse_deadline(deadline)
                if datetime.now(timezone.utc) > deadline_dt:
                    notif["is_expired"] = True
                else:
                    pending_response_count += 1
            else:
                pending_response_count += 1
        
        result.append(notif)
    
    return {
        "notifications": result,
        "unread_count": unread_count,
        "pending_response_count": pending_response_count
    }


@router.get("/notifications/unread-count")
async def get_unread_notification_count(request: Request):
    """Get count of unread notifications for the notification bell"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get the mentor ID (from mentors collection, not user ID)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return {"unread_count": 0, "pending_response_count": 0, "total_count": 0}
    
    # Get all notification IDs targeted to this mentor
    notifications = await db.mentor_notifications.find(
        {"target_mentor_ids": mentor_id},
        {"_id": 0, "id": 1, "type": 1, "deadline": 1}
    ).to_list(100)
    
    notification_ids = [n.get("id") for n in notifications]
    
    # Get read notification IDs
    read_responses = await db.mentor_notification_responses.find(
        {"mentor_id": mentor_id, "notification_id": {"$in": notification_ids}},
        {"_id": 0, "notification_id": 1, "status": 1}
    ).to_list(100)
    
    read_ids = {r.get("notification_id") for r in read_responses}
    responded_ids = {r.get("notification_id") for r in read_responses if r.get("status") == "responded"}
    
    unread_count = len([n for n in notifications if n.get("id") not in read_ids])
    
    # Count pending responses (response_required but not responded, not expired)
    pending_response_count = 0
    for n in notifications:
        if n.get("type") == "response_required" and n.get("id") not in responded_ids:
            deadline = n.get("deadline")
            if deadline:
                deadline_dt = _parse_deadline(deadline)
                if datetime.now(timezone.utc) <= deadline_dt:
                    pending_response_count += 1
            else:
                pending_response_count += 1
    
    return {
        "unread_count": unread_count,
        "pending_response_count": pending_response_count,
        "total_count": unread_count + pending_response_count
    }


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get the mentor ID (from mentors collection, not user ID)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=403, detail="Mentor record not found")
    
    # Verify notification exists and is targeted to this mentor
    notification = await db.mentor_notifications.find_one({
        "id": notification_id,
        "target_mentor_ids": mentor_id
    })
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check if already has a response record
    existing = await db.mentor_notification_responses.find_one({
        "notification_id": notification_id,
        "mentor_id": mentor_id
    })
    
    if existing:
        return {"message": "Already marked as read", "read_at": existing.get("read_at")}
    
    # Create read record
    response_id = f"resp_{uuid.uuid4().hex[:12]}"
    read_record = {
        "id": response_id,
        "notification_id": notification_id,
        "mentor_id": mentor_id,
        "mentor_name": user.get("name"),
        "mentor_email": user.get("email"),
        "status": "read",
        "read_at": datetime.now(timezone.utc).isoformat(),
        "response_data": None,
        "responded_at": None
    }
    
    await db.mentor_notification_responses.insert_one(read_record)
    
    # Update notification stats
    await db.mentor_notifications.update_one(
        {"id": notification_id},
        {"$inc": {"total_read": 1}}
    )
    
    return {"message": "Marked as read", "read_at": read_record["read_at"]}


@router.post("/notifications/{notification_id}/respond")
async def respond_to_notification(notification_id: str, request: Request):
    """Submit a response to a notification"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get the mentor ID (from mentors collection, not user ID)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=403, detail="Mentor record not found")
    
    # Parse request body
    body = await request.json()
    response_data = body.get("response_data", {})
    
    # Verify notification exists and is targeted to this mentor
    notification = await db.mentor_notifications.find_one({
        "id": notification_id,
        "target_mentor_ids": mentor_id,
        "type": "response_required"
    })
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found or not a response-required type")
    
    # Check deadline
    deadline = notification.get("deadline")
    if deadline:
        deadline_dt = _parse_deadline(deadline)
        if datetime.now(timezone.utc) > deadline_dt:
            raise HTTPException(status_code=400, detail="Response deadline has passed")
    
    # Validate required fields
    form_fields = notification.get("form_fields", [])
    for field in form_fields:
        if field.get("required") and not response_data.get(field.get("name")):
            raise HTTPException(status_code=400, detail=f"Field '{field.get('label')}' is required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if already responded
    existing = await db.mentor_notification_responses.find_one({
        "notification_id": notification_id,
        "mentor_id": mentor_id
    })
    
    if existing:
        # Update existing response
        await db.mentor_notification_responses.update_one(
            {"id": existing.get("id")},
            {"$set": {
                "status": "responded",
                "response_data": response_data,
                "responded_at": now
            }}
        )
        
        # Update stats if first time responding
        if existing.get("status") != "responded":
            await db.mentor_notifications.update_one(
                {"id": notification_id},
                {"$inc": {"total_responded": 1}}
            )
    else:
        # Create new response record
        response_id = f"resp_{uuid.uuid4().hex[:12]}"
        response_record = {
            "id": response_id,
            "notification_id": notification_id,
            "mentor_id": mentor_id,
            "mentor_name": user.get("name"),
            "mentor_email": user.get("email"),
            "status": "responded",
            "read_at": now,
            "response_data": response_data,
            "responded_at": now
        }
        
        await db.mentor_notification_responses.insert_one(response_record)
        
        # Update notification stats
        await db.mentor_notifications.update_one(
            {"id": notification_id},
            {"$inc": {"total_read": 1, "total_responded": 1}}
        )
    
    return {"message": "Response submitted successfully", "responded_at": now}



@router.get("/notifications/active-popup")
async def get_active_popup_notification(request: Request):
    """Return the next eligible popup notification for the current mentor.

    Eligible = popup_enabled is True, the mentor is in the target list, the
    mentor has not yet hit popup_max_views, and they have not already been
    shown the popup today (UTC calendar day).
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db(request)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        return {"notification": None}

    today_utc = datetime.now(timezone.utc).date().isoformat()

    notifications = await db.mentor_notifications.find(
        {
            "target_mentor_ids": mentor_id,
            "popup_enabled": True,
            "popup_max_views": {"$gt": 0},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    for notif in notifications:
        notif_id = notif.get("id")
        max_views = int(notif.get("popup_max_views") or 0)
        if max_views <= 0:
            continue

        response = await db.mentor_notification_responses.find_one(
            {"notification_id": notif_id, "mentor_id": mentor_id},
            {"_id": 0},
        )
        views = int((response or {}).get("popup_views_count") or 0)
        last_shown = (response or {}).get("last_popup_shown_date")

        if views >= max_views:
            continue
        if last_shown == today_utc:
            continue

        return {"notification": notif, "views_used": views, "max_views": max_views}

    return {"notification": None}


@router.post("/notifications/{notification_id}/popup-shown")
async def record_popup_shown(notification_id: str, request: Request):
    """Record that the popup was shown to this mentor today."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db(request)
    mentor_id = await get_mentor_id(user, db)
    if not mentor_id:
        raise HTTPException(status_code=403, detail="Mentor record not found")

    notification = await db.mentor_notifications.find_one({
        "id": notification_id,
        "target_mentor_ids": mentor_id,
    })
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    today_utc = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = await db.mentor_notification_responses.find_one({
        "notification_id": notification_id,
        "mentor_id": mentor_id,
    })

    if existing:
        if existing.get("last_popup_shown_date") == today_utc:
            return {
                "popup_views_count": int(existing.get("popup_views_count") or 0),
                "last_popup_shown_date": today_utc,
            }
        await db.mentor_notification_responses.update_one(
            {"id": existing.get("id")},
            {
                "$set": {"last_popup_shown_date": today_utc},
                "$inc": {"popup_views_count": 1},
            },
        )
        new_views = int(existing.get("popup_views_count") or 0) + 1
    else:
        response_id = f"resp_{uuid.uuid4().hex[:12]}"
        await db.mentor_notification_responses.insert_one({
            "id": response_id,
            "notification_id": notification_id,
            "mentor_id": mentor_id,
            "mentor_name": user.get("name"),
            "mentor_email": user.get("email"),
            "status": "read",
            "read_at": now_iso,
            "response_data": None,
            "responded_at": None,
            "popup_views_count": 1,
            "last_popup_shown_date": today_utc,
        })
        await db.mentor_notifications.update_one(
            {"id": notification_id},
            {"$inc": {"total_read": 1}},
        )
        new_views = 1

    return {"popup_views_count": new_views, "last_popup_shown_date": today_utc}
