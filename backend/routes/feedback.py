"""
Feedback Routes
Handles mentor feedback for candidates and candidate feedback for mentors
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from routes.auth import get_current_user, get_db
import pytz

router = APIRouter(prefix="/feedback", tags=["feedback"])

# Default session duration in minutes
DEFAULT_SESSION_DURATION = 45

def is_session_actually_ended(session_date: str, session_time: str, duration_minutes: int = DEFAULT_SESSION_DURATION) -> bool:
    """
    Check if a session has actually ended based on its scheduled time + duration.
    Returns True only if current time is past (session_time + duration).
    """
    if not session_date or not session_time:
        return False
    
    try:
        # Parse session datetime in IST
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(pytz.UTC).astimezone(ist)
        
        # Parse session time
        session_datetime_str = f"{session_date} {session_time}"
        session_datetime = datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M")
        session_datetime_ist = ist.localize(session_datetime)
        
        # Session ends at start_time + duration
        session_end_time = session_datetime_ist + timedelta(minutes=duration_minutes)
        
        # Return True only if current time is past the session end time
        return now_ist >= session_end_time
    except Exception as e:
        # If parsing fails, be conservative and don't show feedback prompt
        return False


# ============ Pydantic Models ============

class MentorFeedbackRequest(BaseModel):
    """Feedback that mentor fills for candidate"""
    booking_id: str
    case_type: str  # Profitability, Market Entry, Guesstimate, Pricing, Growth, M&A, Unconventional, Random
    rating_scoping_questions: int  # 1-5
    rating_case_structure: int  # 1-5
    # Case Math - can use either field name for backwards compatibility
    rating_case_math: Optional[int] = None  # 1-5 or None (NA) - new field name
    rating_quantitative: Optional[int] = None  # 1-5 or None (NA) - legacy field name
    case_math_tested: Optional[bool] = None  # If false, rating is NA - new field name
    quantitative_tested: Optional[bool] = None  # If false, rating is NA - legacy field name
    rating_communication: int  # 1-5
    rating_business_acumen: int  # 1-5
    rating_overall: int  # 1-5
    qualitative_feedback: Optional[str] = None  # Optional


class CandidateFeedbackRequest(BaseModel):
    """Feedback that candidate fills for mentor"""
    booking_id: str
    mentor_followed_instructions: bool  # Yes/No
    rating_facilitation_style: int  # 1-5
    rating_feedback_quality: int  # 1-5
    rating_overall: int  # 1-5
    other_feedback: Optional[str] = None



# ============ Mandatory Pending Feedback ============

@router.get("/pending-mandatory")
async def get_pending_mandatory_feedback(request: Request):
    """Get the first pending feedback session that must be completed before using the dashboard.
    Works for both candidates (coaching + peer) and mentors (coaching).
    
    IMPORTANT: Only shows feedback prompt if the session has actually ended
    (session_time + duration has passed).
    """
    user = await get_current_user(request)
    db = get_db(request)
    user_id = user.get("id")
    is_mentor = user.get("is_mentor", False)
    mentor_id = user.get("mentor_id")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # For mentors: check coaching sessions where mentor hasn't submitted feedback
    # EXCLUDE strategy calls - they don't require feedback
    if is_mentor and mentor_id:
        # Get all potential pending sessions - include BOTH completed status AND past date sessions
        pending_cursor = db.bookings.find(
            {
                "mentor_id": mentor_id,
                "$or": [
                    {"status": "completed"},
                    {"date": {"$lt": today_str}, "status": {"$nin": ["cancelled"]}}
                ],
                "mentor_feedback_submitted": {"$ne": True},
                "session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
            },
            {"_id": 0}
        ).sort("date", -1)
        
        async for pending in pending_cursor:
            # Check if session has actually ended (time + duration passed)
            session_time = pending.get("time_slot") or pending.get("time")
            session_duration = pending.get("duration", DEFAULT_SESSION_DURATION)
            
            if not is_session_actually_ended(pending.get("date"), session_time, session_duration):
                continue  # Session hasn't ended yet, skip
            
            # NEW: Check if BOTH mentor and candidate actually joined the session
            # Only trigger feedback if both participants checked in
            mentor_checked_in = pending.get("mentor_checked_in", False)
            candidate_checked_in = pending.get("candidate_checked_in", False)
            
            if not (mentor_checked_in and candidate_checked_in):
                continue  # Session didn't actually happen (one or both no-showed), skip
            
            # Double-check: feedback might exist but booking flag wasn't updated
            existing_feedback = await db.mentor_feedbacks.find_one({"booking_id": pending.get("id")})
            if not existing_feedback:
                existing_feedback = await db.session_feedbacks.find_one({"booking_id": pending.get("id"), "mentor_id": mentor_id})
            if existing_feedback:
                await db.bookings.update_one(
                    {"id": pending.get("id")},
                    {"$set": {"mentor_feedback_submitted": True}}
                )
                continue  # This one is already done, check next
            
            # Found a valid pending feedback
            candidate = await db.users.find_one({"id": pending.get("user_id")}, {"_id": 0, "name": 1, "picture": 1})
            peer_profile = await db.peer_profiles.find_one({"user_id": pending.get("user_id")}, {"_id": 0, "profile_picture": 1})
            return {
                "has_pending": True,
                "feedback_type": "mentor_to_candidate",
                "session": {
                    "id": pending.get("id"),
                    "date": pending.get("date"),
                    "time": pending.get("time_slot") or pending.get("time"),
                    "session_type": pending.get("session_type") or pending.get("type") or "Coaching",
                    "case_type": pending.get("case_type"),
                    "candidate_name": pending.get("candidate_name") or (candidate.get("name") if candidate else "Candidate"),
                    "candidate_picture": (peer_profile.get("profile_picture") if peer_profile else None) or (candidate.get("picture") if candidate else None),
                    "mentor_name": pending.get("mentor_name"),
                }
            }
        return {"has_pending": False}

    # For candidates: check coaching sessions first, then peer sessions
    # 1. Coaching feedback pending - EXCLUDE strategy calls
    # Include BOTH completed status AND past date sessions
    pending_cursor = db.bookings.find(
        {
            "user_id": user_id,
            "$or": [
                {"status": "completed"},
                {"date": {"$lt": today_str}, "status": {"$nin": ["cancelled"]}}
            ],
            "candidate_feedback_submitted": {"$ne": True},
            "session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
        },
        {"_id": 0}
    ).sort("date", -1)
    
    pending_coaching = None
    async for booking in pending_cursor:
        # Check if session has actually ended (time + duration passed)
        session_time = booking.get("time_slot") or booking.get("time")
        session_duration = booking.get("duration", DEFAULT_SESSION_DURATION)
        
        if not is_session_actually_ended(booking.get("date"), session_time, session_duration):
            continue  # Session hasn't ended yet, skip
        
        # NEW: Check if BOTH mentor and candidate actually joined the session
        # Only trigger feedback if both participants checked in
        mentor_checked_in = booking.get("mentor_checked_in", False)
        candidate_checked_in = booking.get("candidate_checked_in", False)
        
        if not (mentor_checked_in and candidate_checked_in):
            continue  # Session didn't actually happen (one or both no-showed), skip
        
        # Double-check: feedback might exist but booking flag wasn't updated
        existing_feedback = await db.candidate_feedbacks.find_one({"booking_id": booking.get("id")})
        if existing_feedback:
            # Fix the flag and check next
            await db.bookings.update_one(
                {"id": booking.get("id")},
                {"$set": {"candidate_feedback_submitted": True}}
            )
            continue
        
        # Found a valid pending feedback
        pending_coaching = booking
        break
    
    if pending_coaching:
        mentor = await db.mentors.find_one({"id": pending_coaching.get("mentor_id")}, {"_id": 0, "name": 1, "picture": 1, "company": 1, "consulting_firm": 1, "title": 1})
        return {
            "has_pending": True,
            "feedback_type": "candidate_to_mentor",
            "session": {
                "id": pending_coaching.get("id"),
                "date": pending_coaching.get("date"),
                "time": pending_coaching.get("time_slot") or pending_coaching.get("time"),
                "session_type": pending_coaching.get("session_type") or pending_coaching.get("type") or "Coaching",
                "case_type": pending_coaching.get("case_type"),
                "mentor_name": (mentor.get("name") if mentor else None) or pending_coaching.get("mentor_name") or "Mentor",
                "mentor_picture": (mentor.get("picture") if mentor else None) or pending_coaching.get("mentor_picture"),
                "mentor_company": (mentor.get("company") or mentor.get("consulting_firm") if mentor else None) or pending_coaching.get("mentor_company"),
                "mentor_title": mentor.get("title") if mentor else None,
            }
        }

    # 2. Peer feedback pending
    # Check for sessions where:
    # - User is requester OR partner
    # - Session is completed OR confirmed but past
    # - User hasn't submitted feedback (check BOTH the _submitted flag AND the actual feedback object)
    pending_peer_cursor = db.peer_sessions.find(
        {
            "$and": [
                {"$or": [{"requester_id": user_id}, {"partner_id": user_id}]},
                {"$or": [
                    {"status": "completed"},
                    {"status": "confirmed", "date": {"$lt": today_str}}
                ]},
                {"$or": [
                    # Requester hasn't submitted: check both flag AND actual feedback object
                    {"$and": [
                        {"requester_id": user_id}, 
                        {"requester_feedback_submitted": {"$ne": True}},
                        {"requester_feedback": {"$eq": None}}
                    ]},
                    # Partner hasn't submitted: check both flag AND actual feedback object
                    {"$and": [
                        {"partner_id": user_id}, 
                        {"partner_feedback_submitted": {"$ne": True}},
                        {"partner_feedback": {"$eq": None}}
                    ]}
                ]}
            ]
        },
        {"_id": 0}
    ).sort("date", -1)
    
    pending_peer = None
    async for peer_session in pending_peer_cursor:
        # Check if session has actually ended (time + duration passed)
        session_time = peer_session.get("time_slot") or peer_session.get("time")
        session_duration = peer_session.get("duration", DEFAULT_SESSION_DURATION)
        
        if not is_session_actually_ended(peer_session.get("date"), session_time, session_duration):
            continue  # Session hasn't ended yet, skip
        
        # NEW: Check if BOTH users actually joined the session
        # Only trigger feedback if both participants checked in
        requester_checked_in = peer_session.get("requester_checked_in", False)
        partner_checked_in = peer_session.get("partner_checked_in", False)
        
        if not (requester_checked_in and partner_checked_in):
            continue  # Session didn't actually happen (one or both no-showed), skip
        
        # Double-check: verify feedback is really not submitted
        # This handles edge cases where the query might return stale data
        is_requester = peer_session.get("requester_id") == user_id
        if is_requester:
            if peer_session.get("requester_feedback") is not None or peer_session.get("requester_feedback_submitted") == True:
                # Feedback already exists, update the flag if needed and skip
                await db.peer_sessions.update_one(
                    {"id": peer_session.get("id")},
                    {"$set": {"requester_feedback_submitted": True}}
                )
                continue
        else:
            if peer_session.get("partner_feedback") is not None or peer_session.get("partner_feedback_submitted") == True:
                # Feedback already exists, update the flag if needed and skip
                await db.peer_sessions.update_one(
                    {"id": peer_session.get("id")},
                    {"$set": {"partner_feedback_submitted": True}}
                )
                continue
        
        pending_peer = peer_session
        break
    
    if pending_peer:
        is_requester = pending_peer.get("requester_id") == user_id
        partner_name = pending_peer.get("partner_name") if is_requester else pending_peer.get("requester_name")
        partner_id = pending_peer.get("partner_id") if is_requester else pending_peer.get("requester_id")
        partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "name": 1, "picture": 1})
        peer_profile = await db.peer_profiles.find_one({"user_id": partner_id}, {"_id": 0, "profile_picture": 1, "name": 1})

        return {
            "has_pending": True,
            "feedback_type": "peer",
            "session": {
                "id": pending_peer.get("id"),
                "date": pending_peer.get("date"),
                "time": pending_peer.get("time_slot"),
                "session_type": pending_peer.get("session_type", "Peer Practice"),
                "case_type": pending_peer.get("case_type"),
                "partner_name": peer_profile.get("name") if peer_profile else (partner.get("name") if partner else partner_name or "Peer"),
                "partner_picture": peer_profile.get("profile_picture") if peer_profile else (partner.get("picture") if partner else None),
            }
        }

    return {"has_pending": False}


# ============ Mentor Feedback Endpoints ============

@router.post("/mentor-to-candidate")
async def submit_mentor_feedback(feedback: MentorFeedbackRequest, request: Request):
    """Submit feedback from mentor to candidate"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can submit this feedback")
    
    # Get the booking
    booking = await db.bookings.find_one({"id": feedback.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify mentor is part of this booking - check multiple ways
    mentor_id = user.get("mentor_id")  # User may have mentor_id field
    
    # Also try to find mentor by user_id or by email
    mentor = await db.mentors.find_one({
        "$or": [
            {"user_id": user.get("id")},
            {"id": mentor_id},
            {"email": user.get("email")}
        ]
    })
    
    if not mentor:
        raise HTTPException(status_code=403, detail="Mentor profile not found")
    
    if mentor.get("id") != booking.get("mentor_id"):
        raise HTTPException(status_code=403, detail="You are not the mentor for this session")
    
    # Validate ratings are 1-5
    for rating_field in ['rating_scoping_questions', 'rating_case_structure', 
                         'rating_communication', 'rating_business_acumen', 'rating_overall']:
        rating = getattr(feedback, rating_field)
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail=f"{rating_field} must be between 1 and 5")
    
    # Handle case math fields - support both old and new field names
    case_math_tested = feedback.case_math_tested if feedback.case_math_tested is not None else (feedback.quantitative_tested if feedback.quantitative_tested is not None else True)
    case_math_rating = feedback.rating_case_math if feedback.rating_case_math is not None else feedback.rating_quantitative
    
    if case_math_tested and case_math_rating:
        if case_math_rating < 1 or case_math_rating > 5:
            raise HTTPException(status_code=400, detail="Case math rating must be between 1 and 5")
    
    # Validate case type
    valid_case_types = ["Profitability", "Market Entry", "Guesstimate", "Pricing", "Growth", "M&A", "Unconventional", "Random"]
    if feedback.case_type not in valid_case_types:
        raise HTTPException(status_code=400, detail=f"Invalid case_type. Must be one of: {valid_case_types}")
    
    # Check if feedback already exists
    existing = await db.mentor_feedbacks.find_one({"booking_id": feedback.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this session")
    
    # Calculate average rating (excluding case math if NA)
    ratings = [
        feedback.rating_scoping_questions,
        feedback.rating_case_structure,
        feedback.rating_communication,
        feedback.rating_business_acumen,
        feedback.rating_overall
    ]
    if case_math_tested and case_math_rating:
        ratings.append(case_math_rating)
    
    average_rating = sum(ratings) / len(ratings)
    
    # Save feedback
    feedback_doc = {
        "id": f"mf-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{feedback.booking_id[:8]}",
        "booking_id": feedback.booking_id,
        "mentor_id": mentor.get("id"),
        "candidate_id": booking.get("user_id"),
        "case_type": feedback.case_type,
        "rating_scoping_questions": feedback.rating_scoping_questions,
        "rating_case_structure": feedback.rating_case_structure,
        "rating_case_math": case_math_rating if case_math_tested else None,
        "case_math_tested": case_math_tested,
        # Also store with old field names for backwards compatibility
        "rating_quantitative": case_math_rating if case_math_tested else None,
        "quantitative_tested": case_math_tested,
        "rating_communication": feedback.rating_communication,
        "rating_business_acumen": feedback.rating_business_acumen,
        "rating_overall": feedback.rating_overall,
        "average_rating": round(average_rating, 2),
        "qualitative_feedback": feedback.qualitative_feedback,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mentor_feedbacks.insert_one(feedback_doc)
    
    # Update booking to mark feedback submitted
    await db.bookings.update_one(
        {"id": feedback.booking_id},
        {"$set": {"mentor_feedback_submitted": True, "mentor_feedback_id": feedback_doc["id"]}}
    )
    
    # Update candidate's average rating
    await update_candidate_average_rating(db, booking.get("user_id"))
    
    return {"success": True, "message": "Feedback submitted successfully"}


@router.get("/mentor-to-candidate/{booking_id}")
async def get_mentor_feedback(booking_id: str, request: Request):
    """Get mentor feedback for a specific booking"""
    user = await get_current_user(request)
    db = get_db(request)
    
    feedback = await db.mentor_feedbacks.find_one({"booking_id": booking_id}, {"_id": 0})
    if not feedback:
        return {"feedback": None}
    
    return {"feedback": feedback}


# ============ Candidate Feedback Endpoints ============

@router.post("/candidate-to-mentor")
async def submit_candidate_feedback(feedback: CandidateFeedbackRequest, request: Request):
    """Submit feedback from candidate to mentor"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get the booking
    booking = await db.bookings.find_one({"id": feedback.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is the candidate for this booking
    if booking.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="You are not the candidate for this session")
    
    # Validate ratings
    for rating_field in ['rating_facilitation_style', 'rating_feedback_quality', 'rating_overall']:
        rating = getattr(feedback, rating_field)
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail=f"{rating_field} must be between 1 and 5")
    
    # Check if feedback already exists
    existing = await db.candidate_feedbacks.find_one({"booking_id": feedback.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this session")
    
    # Calculate average rating
    average_rating = (feedback.rating_facilitation_style + feedback.rating_feedback_quality + feedback.rating_overall) / 3
    
    # Save feedback
    feedback_doc = {
        "id": f"cf-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{feedback.booking_id[:8]}",
        "booking_id": feedback.booking_id,
        "candidate_id": user.get("id"),
        "mentor_id": booking.get("mentor_id"),
        "mentor_followed_instructions": feedback.mentor_followed_instructions,
        "rating_facilitation_style": feedback.rating_facilitation_style,
        "rating_feedback_quality": feedback.rating_feedback_quality,
        "rating_overall": feedback.rating_overall,
        "average_rating": round(average_rating, 2),
        "other_feedback": feedback.other_feedback,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.candidate_feedbacks.insert_one(feedback_doc)
    
    # Update booking to mark feedback submitted
    await db.bookings.update_one(
        {"id": feedback.booking_id},
        {"$set": {"candidate_feedback_submitted": True, "candidate_feedback_id": feedback_doc["id"]}}
    )
    
    # Update mentor's average rating
    await update_mentor_average_rating(db, booking.get("mentor_id"))
    
    return {"success": True, "message": "Feedback submitted successfully"}


@router.get("/candidate-to-mentor/{booking_id}")
async def get_candidate_feedback(booking_id: str, request: Request):
    """Get candidate feedback for a specific booking"""
    user = await get_current_user(request)
    db = get_db(request)
    
    feedback = await db.candidate_feedbacks.find_one({"booking_id": booking_id}, {"_id": 0})
    if not feedback:
        return {"feedback": None}
    
    return {"feedback": feedback}


# ============ Rating Calculation Helpers ============

async def update_mentor_average_rating(db, mentor_id: str):
    """
    Recalculate and persist the mentor's published rating using only the
    most recent 10 real (non-historical) candidate feedbacks. Historical
    Excel imports stay untouched in `candidate_feedbacks` but are excluded
    from the windowed average.
    """
    feedbacks = await db.candidate_feedbacks.find(
        {"mentor_id": mentor_id, "is_historical": {"$ne": True}}
    ).sort("created_at", -1).limit(10).to_list(10)

    if not feedbacks:
        return

    total_rating = sum(f.get("rating_overall", 0) for f in feedbacks)
    average_rating = round(total_rating / len(feedbacks), 2)

    # total_reviews on the mentor stays as the all-time count, not just the windowed 10
    total_count = await db.candidate_feedbacks.count_documents(
        {"mentor_id": mentor_id, "is_historical": {"$ne": True}}
    )

    await db.mentors.update_one(
        {"id": mentor_id},
        {"$set": {
            "rating": average_rating,
            "feedback_count": total_count,
            "rating_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )


async def update_candidate_average_rating(db, candidate_id: str):
    """Calculate and update candidate's average rating from all mentor feedbacks"""
    # Get all feedbacks for this candidate
    feedbacks = await db.mentor_feedbacks.find({"candidate_id": candidate_id}).to_list(1000)
    
    if not feedbacks:
        return
    
    # Calculate average of all overall ratings
    total_rating = sum(f.get("rating_overall", 0) for f in feedbacks)
    average_rating = round(total_rating / len(feedbacks), 2)
    feedback_count = len(feedbacks)
    
    # Update user profile
    await db.users.update_one(
        {"id": candidate_id},
        {"$set": {
            "coaching_rating": average_rating,
            "coaching_feedback_count": feedback_count,
            "rating_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )


# ============ Get Feedback Status ============

@router.get("/status/{booking_id}")
async def get_feedback_status(booking_id: str, request: Request):
    """Get feedback submission status for a booking"""
    user = await get_current_user(request)
    db = get_db(request)
    
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    mentor_feedback = await db.mentor_feedbacks.find_one({"booking_id": booking_id})
    candidate_feedback = await db.candidate_feedbacks.find_one({"booking_id": booking_id})
    
    return {
        "mentor_feedback_submitted": mentor_feedback is not None,
        "candidate_feedback_submitted": candidate_feedback is not None
    }


# ============ Get Feedback Details (for viewing feedback) ============

@router.get("/candidate/{booking_id}")
async def view_candidate_feedback_for_mentor(booking_id: str, request: Request):
    """Get candidate's feedback for a booking (mentor viewing candidate's feedback about them)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Verify user is the mentor for this booking
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if user is the mentor
    mentor_id_from_user = user.get("mentor_id")
    is_mentor = user.get("is_mentor", False)
    
    if is_mentor:
        mentor = await db.mentors.find_one({
            "$or": [
                {"id": booking.get("mentor_id"), "user_id": user.get("id")},
                {"id": booking.get("mentor_id"), "email": user.get("email")},
                {"id": mentor_id_from_user}
            ]
        })
        if not mentor or mentor.get("id") != booking.get("mentor_id"):
            raise HTTPException(status_code=403, detail="You are not the mentor for this session")
    else:
        raise HTTPException(status_code=403, detail="Only mentors can view candidate feedback")
    
    feedback = await db.candidate_feedbacks.find_one({"booking_id": booking_id}, {"_id": 0})
    if not feedback:
        raise HTTPException(status_code=404, detail="No feedback found for this session")
    
    return feedback


@router.get("/mentor/{booking_id}")
async def view_mentor_feedback_for_candidate(booking_id: str, request: Request):
    """Get mentor's feedback for a booking (candidate viewing mentor's feedback about them)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Verify user is the candidate for this booking
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="You are not the candidate for this session")
    
    feedback = await db.mentor_feedbacks.find_one({"booking_id": booking_id}, {"_id": 0})
    if not feedback:
        raise HTTPException(status_code=404, detail="No feedback found for this session")
    
    return feedback
