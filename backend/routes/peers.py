"""
Peer Practice API Routes
Handles peer listing, profile management, availability, and booking
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from dateutil.relativedelta import relativedelta
import uuid
import logging
import os

from routes.auth import get_current_user, get_db, send_email_via_gmail
from services.calendar_service import create_peer_practice_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/peers", tags=["peers"])

# Get frontend URL for links in emails
FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gradnext.co").replace("/api", "")


async def send_peer_session_approval_email(partner_email: str, partner_name: str, requester_name: str,
                                           session_date: str, session_time: str, session_type: str,
                                           case_type: str, notes: str, session_id: str):
    """Send email to partner asking them to approve or decline the session request"""
    from routes.auth import get_db
    from motor.motor_asyncio import AsyncIOMotorClient
    
    # Get database connection
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice?tab=sessions"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Peer Practice Request</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {partner_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                <strong>{requester_name}</strong> wants to practice with you!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">Session Details</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {session_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {session_time}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Type:</strong> {session_type}</p>
                {f'<p style="color: #475569; margin: 8px 0;"><strong>Case Type:</strong> {case_type}</p>' if case_type else ''}
                {f'<p style="color: #475569; margin: 8px 0;"><strong>Notes:</strong> {notes}</p>' if notes else ''}
            </div>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Please approve or decline this request from your dashboard:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    View Request in Dashboard
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Once you approve, a Google Meet link will be created and both of you will receive calendar invites.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                gradnext - Your Partner in Consulting Interview Prep
            </p>
        </div>
    </div>
    """
    
    try:
        await send_email_via_gmail(db, partner_email, f"{requester_name} wants to practice with you!", html_content)
        client.close()
        return True
    except Exception as e:
        logger.error(f"Failed to send approval email: {e}")
        client.close()
        return False

# ============ Pydantic Models ============

class PeerProfileCreate(BaseModel):
    name: str
    university: str
    firms_targeting: List[str]
    cases_done: int
    profile_picture: Optional[str] = None

class PeerProfileUpdate(BaseModel):
    name: Optional[str] = None
    university: Optional[str] = None
    firms_targeting: Optional[List[str]] = None
    cases_done: Optional[int] = None
    profile_picture: Optional[str] = None
    linkedin_url: Optional[str] = None
    location: Optional[str] = None
    years_of_experience: Optional[str] = None
    preparation_level: Optional[str] = None
    ug_college: Optional[str] = None
    pg_college: Optional[str] = None
    no_pg: Optional[bool] = None  # True if N/A for PG
    pg_incoming: Optional[bool] = None  # True if incoming student

class AvailabilitySlot(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # HH:MM
    end_time: str  # HH:MM

class SetAvailabilityRequest(BaseModel):
    slots: List[AvailabilitySlot]
    max_sessions_per_day: Optional[int] = 3
    blocked_dates: Optional[List[str]] = []  # List of YYYY-MM-DD dates to block

class BookSessionRequest(BaseModel):
    partner_id: str
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM
    session_type: Optional[str] = None  # Case session, Fit Interview, PEI session, etc.
    case_type: Optional[str] = None  # Profitability, Market Entry, etc.
    notes: Optional[str] = None  # Additional notes from requester

class FeedbackRequest(BaseModel):
    session_id: str
    session_type: str  # Type of session (Case, PEI, CV, FIT, General)
    case_type: Optional[str] = None  # Type of case practiced (only for Case sessions)
    rating_overall: int  # 1-5 (required for all session types)
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
    
    # Legacy fields (for backward compatibility)
    rating_scoping_questions: Optional[int] = None
    rating_case_structure: Optional[int] = None
    rating_quantitative: Optional[int] = None
    quantitative_tested: Optional[bool] = True
    rating_communication: Optional[int] = None
    rating_business_acumen: Optional[int] = None

class RescheduleRequest(BaseModel):
    date: str
    time_slot: str

class MessageRequest(BaseModel):
    message: str


# ============ Helper Functions ============

async def generate_thumbnail(image_data: bytes, content_type: str, max_size: int = 100, quality: int = 60) -> str:
    """Generate a small thumbnail from image data for list views.
    
    Args:
        image_data: Raw image bytes
        content_type: MIME type of image
        max_size: Maximum width/height of thumbnail
        quality: JPEG quality (1-100)
    
    Returns:
        Base64 data URI of thumbnail
    """
    try:
        from PIL import Image
        import io
        import base64
        
        # Open image
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary (for JPEG output)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Calculate thumbnail size maintaining aspect ratio
        width, height = img.size
        if width > height:
            new_width = max_size
            new_height = int(height * max_size / width)
        else:
            new_height = max_size
            new_width = int(width * max_size / height)
        
        # Resize with high-quality resampling
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Save to buffer as JPEG with specified quality
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        buffer.seek(0)
        
        # Encode as base64
        thumb_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{thumb_base64}"
        
    except Exception as e:
        logger.warning(f"Failed to generate thumbnail: {e}")
        # Return original as fallback (truncated if too large)
        import base64
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return f"data:{content_type};base64,{base64_data}"



async def recalculate_peer_stats(db, user_id: str):
    """Recalculate peer_sessions_done and peer_rating for a user based on actual session data.
    
    Logic:
    - peer_sessions_done = total number of completed sessions (as requester or partner)
    - peer_rating = average of all ratings received from session partners
      (Total rating / total sessions where rating was given)
    """
    # Get ALL completed sessions for this user
    completed_sessions = await db.peer_sessions.find({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ],
        "status": "completed"
    }).to_list(500)
    
    total_completed = len(completed_sessions)
    
    # Calculate average rating: only from sessions where the OTHER person gave feedback about THIS user
    total_rating = 0
    rated_sessions = 0
    
    for session in completed_sessions:
        if session["requester_id"] == user_id:
            # User was the requester → feedback ABOUT them is in partner_feedback
            fb = session.get("partner_feedback")
            if fb:
                rating = fb.get("average_rating") or fb.get("rating_overall")
                if rating is not None:
                    total_rating += rating
                    rated_sessions += 1
        elif session["partner_id"] == user_id:
            # User was the partner → feedback ABOUT them is in requester_feedback
            fb = session.get("requester_feedback")
            if fb:
                rating = fb.get("average_rating") or fb.get("rating_overall")
                if rating is not None:
                    total_rating += rating
                    rated_sessions += 1
    
    # Build update
    update_doc = {"peer_sessions_done": total_completed}
    
    if rated_sessions > 0:
        avg_rating = round(total_rating / rated_sessions, 1)
        update_doc["peer_rating"] = avg_rating
    elif total_completed == 0:
        update_doc["peer_rating"] = None  # No sessions, no rating
    
    # Update the peer profile
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {"$set": update_doc}
    )
    
    return update_doc



def serialize_peer(peer: dict, include_availability: bool = False, user_data: dict = None, plan_info: dict = None, use_thumbnail: bool = True) -> dict:
    """Convert peer document to JSON-serializable format
    
    Args:
        peer: Peer profile document
        include_availability: Include detailed availability slots
        user_data: User document with plan info
        plan_info: Pre-computed plan info
        use_thumbnail: If True, use thumbnail for picture (default for list views)
    """
    # Get subscription info from user data
    plan_category = "Free Trial"  # subscription, coaching, cohort
    plan_name = "Free Trial"  # Actual plan name like Pro, Pro+, Last Mile, Full Prep
    
    if user_data:
        # Check plan_assignments for active plan
        plan_assignments = user_data.get("plan_assignments", [])
        active_assignment = None
        for assignment in plan_assignments:
            if assignment.get("is_active"):
                active_assignment = assignment
                break
        
        if active_assignment:
            # Get category (subscription, coaching, cohort)
            category = active_assignment.get("category", "subscription")
            plan_category = category.capitalize() if category else "Subscription"
            
            # Get actual plan name
            plan_name = active_assignment.get("plan_name", "")
            if not plan_name:
                # Fallback to plan key
                plan_key = active_assignment.get("plan_key", "")
                plan_name = plan_key.replace("_", " ").title() if plan_key else "Unknown"
        elif plan_info:
            # Use plan_info from database lookup
            category = plan_info.get("category", "subscription")
            plan_category = category.capitalize() if category else "Subscription"
            plan_name = plan_info.get("name", user_data.get("plan", "").replace("_", " ").title())
        else:
            # Fallback to old method - just use plan field
            plan = user_data.get("plan", "free")
            if plan and plan not in ["free", "free_trial"]:
                plan_name = plan.replace("_", " ").title()
                # Default category based on common plan names (standardized to database convention)
                if plan in ["basic_plan", "pro_plan", "pro_plus"]:
                    plan_category = "Subscription"
                else:
                    plan_category = "Coaching"  # Most other plans are coaching
            elif plan in ["free", "free_trial"] or not plan:
                plan_category = "Subscription"
                plan_name = "Free Trial"
    
    # Use thumbnail for list views, full picture for detail views
    # Fall back to full picture if thumbnail not available
    if use_thumbnail:
        picture = (
            peer.get("profile_picture_thumbnail") or 
            peer.get("profile_picture") or 
            f"https://ui-avatars.com/api/?name={peer.get('name', 'User')}&background=random&size=100"
        )
    else:
        picture = peer.get("profile_picture") or f"https://ui-avatars.com/api/?name={peer.get('name', 'User')}&background=random"
    
    result = {
        "id": peer.get("user_id", str(peer.get("_id", ""))),
        "user_id": peer.get("user_id", str(peer.get("_id", ""))),  # Explicit user_id for availability lookup
        "name": peer.get("name", ""),
        "university": peer.get("university", ""),
        "ug_college": peer.get("ug_college", ""),
        "pg_college": peer.get("pg_college", ""),
        "no_pg": peer.get("no_pg", False),
        "pg_incoming": peer.get("pg_incoming", False),
        "firms_targeting": peer.get("firms_targeting", []),
        "cases_done": peer.get("cases_done", 0),
        "picture": picture,
        "linkedin_url": peer.get("linkedin_url", ""),
        "location": peer.get("location", ""),
        "years_of_experience": peer.get("years_of_experience", 0),
        "peer_rating": peer.get("peer_rating") if peer.get("peer_sessions_done", 0) > 0 else None,
        "peer_sessions_done": peer.get("peer_sessions_done", 0),
        "bio": f"Targeting {', '.join(peer.get('firms_targeting', [])[:2])} | {peer.get('university', '')} | {peer.get('cases_done', 0)} cases done",
        "target_companies": peer.get("firms_targeting", []),
        "preparation_stage": peer.get("preparation_level") or get_preparation_stage(peer.get("cases_done", 0)),
        "plan_category": plan_category,  # Bucket: Subscription, Coaching, Cohort
        "plan_name": plan_name,  # Actual plan: Pro, Pro+, Last Mile, Full Prep, etc.
        "is_listed": peer.get("is_listed", True),
        "max_sessions_per_day": peer.get("max_sessions_per_day", 3),
        "blocked_dates": peer.get("blocked_dates", []),
        "google_calendar_connected": peer.get("google_calendar_connected", False),
        "created_at": peer.get("created_at", datetime.utcnow()).isoformat() if isinstance(peer.get("created_at"), datetime) else peer.get("created_at", "")
    }
    
    if include_availability:
        result["availability"] = peer.get("availability_slots", [])
        result["weekly_availability"] = peer.get("weekly_availability", [])
    
    return result

def get_preparation_stage(cases_done) -> str:
    """Determine preparation stage based on cases done"""
    # Handle string ranges like "0-5", "10-20", "30+"
    if isinstance(cases_done, str):
        if cases_done == "30+":
            return "advanced"
        elif cases_done in ["20-30"]:
            return "intermediate"
        elif cases_done in ["10-20"]:
            return "intermediate"
        else:
            return "beginner"
    
    # Handle numeric values
    cases_num = int(cases_done) if cases_done else 0
    if cases_num >= 50:
        return "advanced"
    elif cases_num >= 20:
        return "intermediate"
    else:
        return "beginner"

def serialize_session(session: dict, current_user_id: str) -> dict:
    """Convert session document to JSON-serializable format"""
    # Determine if current user gave feedback
    is_requester = session.get("requester_id") == current_user_id
    feedback_submitted = (
        session.get("requester_feedback") is not None if is_requester 
        else session.get("partner_feedback") is not None
    )
    
    # Check if partner gave feedback (to show "View Feedback" button)
    partner_feedback_received = (
        session.get("partner_feedback") is not None if is_requester
        else session.get("requester_feedback") is not None
    )
    
    # Check join status
    user_joined = (
        session.get("requester_joined_at") is not None if is_requester
        else session.get("partner_joined_at") is not None
    )
    partner_joined = (
        session.get("partner_joined_at") is not None if is_requester
        else session.get("requester_joined_at") is not None
    )
    
    # Use thumbnails for pictures to reduce response size
    # Fall back to ui-avatars if no picture available
    requester_pic = session.get("requester_picture_thumbnail") or session.get("requester_picture", "")
    partner_pic = session.get("partner_picture_thumbnail") or session.get("partner_picture", "")
    
    # If picture is a large base64 (>10KB), use placeholder instead
    if requester_pic.startswith("data:") and len(requester_pic) > 10000:
        requester_pic = f"https://ui-avatars.com/api/?name={session.get('requester_name', 'User')}&background=random&size=100"
    if partner_pic.startswith("data:") and len(partner_pic) > 10000:
        partner_pic = f"https://ui-avatars.com/api/?name={session.get('partner_name', 'User')}&background=random&size=100"
    
    return {
        "id": session.get("id") or str(session.get("_id", "")),
        "requester_id": session.get("requester_id", ""),
        "requester_name": session.get("requester_name", ""),
        "requester_picture": requester_pic,
        "partner_id": session.get("partner_id", ""),
        "partner_name": session.get("partner_name", ""),
        "partner_picture": partner_pic,
        "date": session.get("date", ""),
        "time_slot": session.get("time_slot", ""),
        "duration_minutes": session.get("duration_minutes", 90),
        "session_type": session.get("session_type", "General discussion"),
        "case_type": session.get("case_type"),
        "requester_notes": session.get("requester_notes"),
        "status": session.get("status", "pending"),
        "meet_link": session.get("meet_link", ""),
        "requester_feedback": session.get("requester_feedback"),
        "partner_feedback": session.get("partner_feedback"),
        "feedback_submitted": feedback_submitted,
        "partner_feedback_received": partner_feedback_received,
        "user_joined": user_joined,
        "partner_joined": partner_joined,
        "requester_joined_at": session.get("requester_joined_at"),
        "partner_joined_at": session.get("partner_joined_at"),
        "was_rescheduled": session.get("was_rescheduled", False),
        # Reschedule pending fields
        "reschedule_requested_by": session.get("reschedule_requested_by", ""),
        "reschedule_requested_by_name": session.get("reschedule_requested_by_name", ""),
        "proposed_date": session.get("proposed_date", ""),
        "proposed_time_slot": session.get("proposed_time_slot", ""),
        "original_date": session.get("original_date", ""),
        "original_time_slot": session.get("original_time_slot", ""),
        "created_at": session.get("created_at", datetime.utcnow()).isoformat() if isinstance(session.get("created_at"), datetime) else session.get("created_at", "")
    }


async def get_user_peer_access(db, user_id: str) -> dict:
    """Check if user has peer practice access and get session credits (monthly system)
    
    IMPORTANT: This function now checks if the user's plan has EXPIRED.
    If the plan_end_date has passed, the user loses peer practice access.
    """
    import pytz
    
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "role": 1, "plan": 1, "plan_assignments": 1, "is_subscribed": 1, "plan_start_date": 1, "plan_end_date": 1, "subscription_end_date": 1, "coaching_program_end_date": 1}
    )
    
    if not user:
        return {"has_access": False, "is_mentor": False, "sessions_per_month": 0, "reason": "User not found"}
    
    # Mentors don't have peer practice access
    # Check both role and plan fields for mentor status
    if user.get("role") == "mentor" or user.get("plan") == "mentor":
        return {"has_access": False, "is_mentor": True, "sessions_per_month": 0, "reason": "Mentors do not have peer practice access"}
    
    # Determine which plan key to look up and get subscription dates
    plan_key = None
    plan_start_date = user.get("plan_start_date")
    plan_end_date = user.get("plan_end_date")
    
    # First check plan_assignments for active assignment
    plan_assignments = user.get("plan_assignments", [])
    for assignment in plan_assignments:
        if assignment.get("is_active"):
            plan_key = assignment.get("plan_key")
            # Use assignment dates if available
            if assignment.get("start_date"):
                plan_start_date = assignment.get("start_date")
            if assignment.get("end_date"):
                plan_end_date = assignment.get("end_date")
            break
    
    # Fallback to user's plan field if no active assignment
    if not plan_key:
        user_plan = user.get("plan")
        if user_plan and user_plan not in ["free", "mentor", None, ""]:
            plan_key = user_plan
        elif user_plan == "free" or user_plan == "free_trial" or not user_plan:
            # Free trial users - look up free_trial plan features
            plan_key = "free_trial"
    
    # No plan found - no access
    if not plan_key:
        return {"has_access": False, "is_mentor": False, "sessions_per_month": 0, "reason": "No active plan - upgrade required"}
    
    # ============ CHECK PLAN EXPIRY ============
    # CRITICAL: If the plan has expired, the user loses peer practice access
    now = datetime.utcnow()
    if now.tzinfo is None:
        import pytz
        now = pytz.UTC.localize(now)
    
    # Check multiple date fields for expiry
    expiry_date = None
    for date_field in ["plan_end_date", "subscription_end_date", "coaching_program_end_date"]:
        date_value = user.get(date_field)
        if date_value:
            if isinstance(date_value, str):
                try:
                    dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    if dt.tzinfo is None:
                        dt = pytz.UTC.localize(dt)
                    # Take the latest end date as the effective expiry
                    if expiry_date is None or dt > expiry_date:
                        expiry_date = dt
                except:
                    pass
            elif isinstance(date_value, datetime):
                if date_value.tzinfo is None:
                    date_value = pytz.UTC.localize(date_value)
                if expiry_date is None or date_value > expiry_date:
                    expiry_date = date_value
    
    # If we found an expiry date and it's in the past, plan is EXPIRED
    if expiry_date and now >= expiry_date:
        return {
            "has_access": False,
            "is_mentor": False,
            "sessions_per_month": 0,
            "reason": "Your plan has expired. Please renew to access peer practice.",
            "plan_expired": True,
            "plan_end_date": expiry_date.isoformat()
        }
    
    # Normalize plan_key for matching (convert underscores to spaces, handle case)
    plan_key_normalized = plan_key.replace("_", " ")
    
    # Handle special cases like "pro_plus" -> "Pro+"
    plan_key_special = plan_key.replace("_plus", "+").replace("_", " ")
    
    # Look up the plan's features by key OR by name (since some plans have key=None)
    # Try multiple matching strategies - sort by peer_sessions_per_month descending to get the plan with access first
    # This handles cases where there are duplicate plan entries
    plans_cursor = db.plans.find(
        {"$or": [
            {"key": plan_key},
            {"key": plan_key_normalized},
            {"plan_key": plan_key},
            {"plan_key": plan_key_normalized},
            {"name": {"$regex": f"^{plan_key}$", "$options": "i"}},
            {"name": {"$regex": f"^{plan_key_normalized}$", "$options": "i"}},
            {"name": {"$regex": f"^{plan_key_special}$", "$options": "i"}},
            # Also try matching "Pro+" style names
            {"name": plan_key_special.title()},
            {"name": plan_key_special.title().replace(" ", "")}
        ]},
        {"_id": 0, "features": 1, "category": 1, "name": 1, "key": 1, "plan_key": 1, "duration_months": 1}
    ).sort([("features.peer_sessions_per_month", -1)])  # Sort to prefer plans with peer access
    
    plan = await plans_cursor.to_list(length=1)
    plan = plan[0] if plan else None
    
    if not plan:
        # Plan not found in DB - check if it's free_trial with no DB entry
        if plan_key in ["free_trial", "free"]:
            return {"has_access": True, "is_mentor": False, "sessions_per_month": 1, "plan_name": "Free Trial", "reason": "Free trial - 1 session per month", "plan_start_date": plan_start_date}
        # Unknown plan - give generous default access (unlimited) to avoid blocking users
        return {"has_access": True, "is_mentor": False, "sessions_per_month": 999, "plan_name": plan_key, "reason": "Plan not found, unlimited access granted", "plan_start_date": plan_start_date}
    
    features = plan.get("features", {})
    
    # NEW: Check for peer_sessions_per_month first (new monthly system)
    sessions_per_month = features.get("peer_sessions_per_month")
    
    # LEGACY SUPPORT: Fall back to peer_to_peer if peer_sessions_per_month not set
    if sessions_per_month is None:
        peer_to_peer = features.get("peer_to_peer", "none")
        
        if peer_to_peer == "none":
            return {"has_access": False, "is_mentor": False, "sessions_per_month": 0, "plan_name": plan.get("name", ""), "reason": "Plan does not include peer practice"}
        
        # Convert legacy weekly values to monthly (approx 4 weeks per month)
        if peer_to_peer == "unlimited":
            sessions_per_month = -1  # Unlimited
        elif peer_to_peer == "1_only":
            sessions_per_month = 1
        elif "_per_week" in str(peer_to_peer):
            try:
                weekly = int(str(peer_to_peer).split("_")[0])
                sessions_per_month = weekly * 4  # Convert to monthly
            except:
                sessions_per_month = 4
        else:
            sessions_per_month = 0
    
    # Handle 0 = no access
    if sessions_per_month == 0:
        return {"has_access": False, "is_mentor": False, "sessions_per_month": 0, "plan_name": plan.get("name", ""), "reason": "Plan does not include peer practice"}
    
    # Handle -1 = unlimited
    if sessions_per_month == -1:
        sessions_per_month = 999
    
    return {
        "has_access": True,
        "is_mentor": False,
        "sessions_per_month": sessions_per_month,
        "plan_name": plan.get("name", ""),
        "plan_start_date": plan_start_date,
        "plan_end_date": plan_end_date,
        "plan_duration_months": plan.get("duration_months"),
        "reason": "Active plan with peer practice"
    }


async def get_remaining_sessions_this_month(db, user_id: str, sessions_per_month: int, plan_start_date=None) -> dict:
    """Calculate remaining peer sessions for the current billing month.
    
    Monthly Credit System Rules:
    - Credits are based on a rolling month from subscription start date
    - If subscription started on Jan 15th, current month runs from 15th to 14th of next month
    - Users can book sessions anytime within their subscription validity
    - Total credits = sessions_per_month × subscription_duration_months
    - Users can use all their credits anytime (not restricted to monthly allocation)
    
    Example:
    - Subscription started: Jan 15th
    - Current date: Jan 27th
    - Current billing month: Jan 15 - Feb 14
    - If user has 4 credits/month and used 2 this month, 2 remaining
    - Credits reset on Feb 15th
    """
    today = datetime.utcnow().date()
    
    # Determine the current billing month based on subscription start date
    if plan_start_date:
        # Parse the start date if it's a string
        if isinstance(plan_start_date, str):
            try:
                start_dt = datetime.fromisoformat(plan_start_date.replace('Z', '+00:00')).date()
            except Exception:
                start_dt = today.replace(day=1)  # Default to first of current month
        else:
            start_dt = plan_start_date.date() if hasattr(plan_start_date, 'date') else plan_start_date
        
        # Calculate the current billing period
        # Find the most recent occurrence of the start day
        day_of_month = start_dt.day
        
        # Handle end of month edge cases (e.g., started on 31st)
        try:
            if today.day >= day_of_month:
                # Current month period started this month
                billing_start = today.replace(day=day_of_month)
            else:
                # Current month period started last month
                billing_start = (today - relativedelta(months=1)).replace(day=min(day_of_month, 28))
        except ValueError:
            # Handle invalid day for month (e.g., Feb 30)
            billing_start = today.replace(day=1)
        
        # Billing end is one day before the next billing start
        billing_end = billing_start + relativedelta(months=1) - timedelta(days=1)
        next_reset = billing_start + relativedelta(months=1)
    else:
        # No start date - use calendar month as fallback
        billing_start = today.replace(day=1)
        billing_end = (billing_start + relativedelta(months=1)) - timedelta(days=1)
        next_reset = billing_start + relativedelta(months=1)
    
    # Count sessions scheduled for THIS billing month
    sessions_this_month = await db.peer_sessions.count_documents({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ],
        "status": {"$in": ["pending", "confirmed", "matched", "reschedule_pending"]},
        "date": {
            "$gte": billing_start.isoformat(),
            "$lte": billing_end.isoformat()
        }
    })
    
    remaining = max(0, sessions_per_month - sessions_this_month) if sessions_per_month < 999 else 999
    
    return {
        "sessions_per_month": sessions_per_month,
        "sessions_used": sessions_this_month,
        "sessions_remaining": remaining,
        "is_unlimited": sessions_per_month >= 999,
        "billing_start": billing_start.isoformat(),
        "billing_end": billing_end.isoformat(),
        "next_reset": next_reset.isoformat()
    }


# ============ Profile Management Endpoints ============

@router.get("/my-profile")
async def get_my_peer_profile(request: Request):
    """Get the current user's peer practice profile"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    
    if not profile:
        return {"has_profile": False, "profile": None}
    
    # Get user subscription data including plan_assignments
    user_data = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "plan": 1, "subscription_type": 1, "is_subscribed": 1, "plan_assignments": 1}
    )
    
    return {
        "has_profile": True,
        "profile": serialize_peer(profile, include_availability=True, user_data=user_data)
    }


@router.get("/session-credits")
async def get_session_credits(request: Request):
    """Get user's peer practice session credits and remaining sessions"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Get peer access info
    access_info = await get_user_peer_access(db, user_id)
    
    if not access_info["has_access"]:
        return {
            "has_access": False,
            "is_mentor": access_info.get("is_mentor", False),
            "reason": access_info.get("reason", "No access"),
            "sessions_per_month": 0,
            "sessions_used": 0,
            "sessions_remaining": 0,
            "is_unlimited": False,
            "plan_expired": access_info.get("plan_expired", False),
            "plan_end_date": access_info.get("plan_end_date")
        }
    
    # Get remaining sessions this month (rolling from subscription start)
    remaining_info = await get_remaining_sessions_this_month(
        db, user_id, access_info["sessions_per_month"], access_info.get("plan_start_date")
    )
    
    return {
        "has_access": True,
        "is_mentor": False,
        "plan_name": access_info.get("plan_name", ""),
        "plan_expired": False,
        **remaining_info
    }


@router.post("/create-profile")
async def create_peer_profile(request: Request, profile_data: PeerProfileCreate):
    """Create a new peer practice profile and list user"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    # Check if profile already exists
    existing = await db.peer_profiles.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists. Use update endpoint.")
    
    # Create new profile
    new_profile = {
        "user_id": user_id,
        "email": user_email,
        "name": profile_data.name,
        "university": profile_data.university,
        "firms_targeting": profile_data.firms_targeting,
        "cases_done": profile_data.cases_done,
        "profile_picture": profile_data.profile_picture,
        "peer_rating": None,
        "peer_sessions_done": 0,
        "is_listed": True,
        "weekly_availability": [],
        "availability_slots": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.peer_profiles.insert_one(new_profile)
    new_profile["_id"] = result.inserted_id
    
    return {
        "success": True,
        "message": "Profile created successfully",
        "profile": serialize_peer(new_profile, include_availability=True)
    }

@router.put("/update-profile")
@router.post("/update-profile")  # Support both PUT and POST for compatibility
async def update_peer_profile(request: Request, profile_data: PeerProfileUpdate):
    """Update the current user's peer profile and sync to main user profile"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Build update dict for peer profile
    update_data = {"updated_at": datetime.utcnow()}
    user_update_data = {}  # For syncing to main user profile
    
    if profile_data.name:
        update_data["name"] = profile_data.name
    if profile_data.university:
        update_data["university"] = profile_data.university
    if profile_data.firms_targeting:
        update_data["firms_targeting"] = profile_data.firms_targeting
        user_update_data["target_firms"] = profile_data.firms_targeting
    if profile_data.cases_done is not None:
        update_data["cases_done"] = profile_data.cases_done
    if profile_data.profile_picture:
        update_data["profile_picture"] = profile_data.profile_picture
        user_update_data["picture"] = profile_data.profile_picture  # Sync to user profile
    if profile_data.linkedin_url:
        update_data["linkedin_url"] = profile_data.linkedin_url
        user_update_data["linkedin_url"] = profile_data.linkedin_url
    if profile_data.location:
        update_data["location"] = profile_data.location
        user_update_data["location"] = profile_data.location
    if profile_data.years_of_experience is not None:
        update_data["years_of_experience"] = profile_data.years_of_experience
        user_update_data["years_of_experience"] = profile_data.years_of_experience
    if profile_data.preparation_level:
        update_data["preparation_level"] = profile_data.preparation_level
        user_update_data["preparation_level"] = profile_data.preparation_level
    if profile_data.ug_college:
        update_data["ug_college"] = profile_data.ug_college
        user_update_data["ug_college"] = profile_data.ug_college
    if profile_data.pg_college:
        update_data["pg_college"] = profile_data.pg_college
        user_update_data["pg_college"] = profile_data.pg_college
    if profile_data.no_pg is not None:
        update_data["no_pg"] = profile_data.no_pg
        user_update_data["no_pg"] = profile_data.no_pg
    if profile_data.pg_incoming is not None:
        update_data["pg_incoming"] = profile_data.pg_incoming
        user_update_data["pg_incoming"] = profile_data.pg_incoming
    
    # Update peer profile
    result = await db.peer_profiles.find_one_and_update(
        {"user_id": user_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Also sync relevant fields to main user profile
    if user_update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": user_update_data}
        )
    
    return {
        "success": True,
        "profile": serialize_peer(result, include_availability=True)
    }

@router.post("/toggle-listing")
async def toggle_peer_listing(request: Request):
    """Toggle whether the user is listed for peer practice"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Create a profile first.")
    
    new_status = not profile.get("is_listed", True)
    
    # If trying to list, require complete profile
    if new_status:
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        
        missing_fields = []
        
        # Check for profile picture - must be a custom upload, not Google/default avatar
        custom_profile_pic = profile.get("profile_picture")
        user_picture = user_data.get("picture") if user_data else None
        
        # A valid picture must be:
        # 1. A custom upload in peer profile, OR
        # 2. A custom upload in user profile (not Google/avatar URLs)
        has_valid_picture = False
        if custom_profile_pic:
            # Has custom upload in peer profile
            has_valid_picture = True
        elif user_picture:
            # Check if it's a real custom picture, not Google or UI avatars
            is_google_pic = "googleusercontent" in user_picture
            is_avatar_pic = "ui-avatars" in user_picture
            has_valid_picture = not is_google_pic and not is_avatar_pic
        
        if not has_valid_picture:
            missing_fields.append("Profile Picture")
        
        # Check for LinkedIn URL
        has_linkedin = profile.get("linkedin_url") or (user_data and user_data.get("linkedin_url"))
        if not has_linkedin:
            missing_fields.append("LinkedIn Profile")
        
        # Check for Location
        has_location = profile.get("location") or (user_data and user_data.get("location"))
        if not has_location:
            missing_fields.append("Location")
        
        # Check for Years of Experience (0 is valid, so check for None explicitly)
        years_exp = profile.get("years_of_experience")
        if years_exp is None:
            years_exp = user_data.get("years_of_experience") if user_data else None
        if years_exp is None:
            missing_fields.append("Years of Experience")
        
        # Check for Target Firms
        has_firms = profile.get("firms_targeting") or (user_data and user_data.get("target_firms"))
        if not has_firms or len(has_firms) == 0:
            missing_fields.append("Target Firms")
        
        # Check for Preparation Level
        has_prep_level = profile.get("preparation_level") or (user_data and user_data.get("preparation_level"))
        if not has_prep_level:
            missing_fields.append("Preparation Level")
        
        # Check for UG College (Not Applicable is acceptable)
        ug_college = profile.get("ug_college") or (user_data.get("ug_college") if user_data else None)
        if not ug_college:
            missing_fields.append("UG University")
        
        # Check for PG College (Not Applicable is acceptable via no_pg flag)
        no_pg = profile.get("no_pg") or (user_data.get("no_pg") if user_data else False)
        pg_college = profile.get("pg_college") or (user_data.get("pg_college") if user_data else None)
        pg_incoming = profile.get("pg_incoming") or (user_data.get("pg_incoming") if user_data else False)
        if not no_pg and not pg_college:
            missing_fields.append("PG University")
        
        if missing_fields:
            # Return detailed missing fields info for better UX
            raise HTTPException(
                status_code=400, 
                detail={
                    "message": "Complete your profile to get listed",
                    "missing_fields": missing_fields,
                    "profile_data": {
                        "profile_picture": profile.get("profile_picture"),
                        "linkedin_url": profile.get("linkedin_url") or (user_data.get("linkedin_url") if user_data else None),
                        "location": profile.get("location") or (user_data.get("location") if user_data else None),
                        "years_of_experience": years_exp,
                        "firms_targeting": profile.get("firms_targeting") or (user_data.get("target_firms") if user_data else []),
                        "preparation_level": profile.get("preparation_level") or (user_data.get("preparation_level") if user_data else None),
                        "ug_college": ug_college,
                        "pg_college": pg_college,
                        "no_pg": no_pg,
                        "pg_incoming": pg_incoming,
                        "pg_joining_month": user_data.get("pg_joining_month") if user_data else None,
                        "pg_joining_year": user_data.get("pg_joining_year") if user_data else None,
                    }
                }
            )
    
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"is_listed": new_status, "updated_at": datetime.utcnow()}}
    )
    
    return {
        "success": True,
        "is_listed": new_status,
        "message": f"You are now {'listed' if new_status else 'unlisted'} for peer practice"
    }

@router.delete("/delete-profile")
async def delete_peer_profile(request: Request):
    """Delete the current user's peer profile (unlist from peer practice)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    result = await db.peer_profiles.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {"success": True, "message": "Profile deleted successfully"}


# ============ Availability Management ============

@router.post("/set-availability")
async def set_peer_availability(request: Request, availability: SetAvailabilityRequest):
    """Set weekly availability slots for peer practice"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Convert slots to storable format
    slots_data = [
        {
            "day_of_week": slot.day_of_week,
            "start_time": slot.start_time,
            "end_time": slot.end_time
        }
        for slot in availability.slots
    ]
    
    result = await db.peer_profiles.find_one_and_update(
        {"user_id": user_id},
        {
            "$set": {
                "weekly_availability": slots_data,
                "max_sessions_per_day": availability.max_sessions_per_day or 3,
                "blocked_dates": availability.blocked_dates or [],
                "updated_at": datetime.utcnow()
            }
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found. Create a profile first.")
    
    return {
        "success": True,
        "message": "Availability updated successfully",
        "weekly_availability": slots_data,
        "max_sessions_per_day": availability.max_sessions_per_day or 3,
        "blocked_dates": availability.blocked_dates or []
    }

@router.get("/availability/{peer_id}")
async def get_peer_availability(request: Request, peer_id: str):
    """Get available slots for a specific peer for the next 30 days.
    
    Monthly Credit System:
    - Returns slots for the next 30 days
    - Users can book anytime within their subscription validity
    - Credit validation is done at booking time
    """
    await get_current_user(request)  # Verify authenticated
    db = get_db(request)
    
    # Get peer's profile
    peer = await db.peer_profiles.find_one({"user_id": peer_id})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer not found")
    
    weekly_availability = peer.get("weekly_availability", [])
    
    # Calculate date range - show availability for next 30 days
    today = datetime.utcnow().date()
    end_date = today + timedelta(days=30)
    
    booked_sessions = await db.peer_sessions.find({
        "$or": [
            {"requester_id": peer_id},
            {"partner_id": peer_id}
        ],
        "date": {
            "$gte": today.isoformat(),
            "$lte": end_date.isoformat()
        },
        "status": {"$in": ["pending", "confirmed", "matched", "completed"]}
    }).to_list(200)
    
    # Build a set of all blocked time slots
    # Each session is 90 minutes, so it blocks 3 consecutive 30-min slots
    blocked_slots = set()
    for s in booked_sessions:
        session_date = s["date"]
        session_time = s["time_slot"]
        
        # Parse start time
        start_h, start_m = map(int, session_time.split(':'))
        start_minutes = start_h * 60 + start_m
        
        # Block 90 minutes worth of slots (the session duration)
        # Plus block slots that would overlap if booked
        # A 90-min session blocks: start, start+30, start+60
        # And you can't book at start-30 or start-60 either (would overlap)
        for offset in [-60, -30, 0, 30, 60]:
            block_minutes = start_minutes + offset
            if block_minutes >= 0 and block_minutes < 24 * 60:
                block_h = block_minutes // 60
                block_m = block_minutes % 60
                blocked_slots.add((session_date, f"{block_h:02d}:{block_m:02d}"))
    
    # Fetch Google Calendar busy times if connected
    if peer.get("google_calendar_connected"):
        try:
            start_datetime = datetime.combine(today, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            calendar_busy_slots = await get_google_calendar_busy_times(peer, start_datetime, end_datetime)
            blocked_slots.update(calendar_busy_slots)
            logger.info(f"Added {len(calendar_busy_slots)} Google Calendar busy slots for peer {peer_id}")
        except Exception as e:
            logger.error(f"Failed to fetch Google Calendar busy times for peer {peer_id}: {str(e)}")
            # Continue without calendar data - don't fail the whole request
    
    # Helper to generate 30-minute slots between start and end time
    def generate_time_slots(start_time: str, end_time: str):
        """Generate 30-minute interval slots between start and end time"""
        slots = []
        start_h, start_m = map(int, start_time.split(':'))
        end_h, end_m = map(int, end_time.split(':'))
        
        current_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        
        # Generate slots in 30-minute intervals
        # Each session is 90 minutes, so we need at least 90 minutes before end
        while current_minutes + 90 <= end_minutes:
            hours = current_minutes // 60
            mins = current_minutes % 60
            slots.append(f"{hours:02d}:{mins:02d}")
            current_minutes += 30  # 30-minute intervals
        
        return slots
    
    # Generate available slots for next 30 days
    available_slots = []
    now = datetime.utcnow()
    current_time_minutes = now.hour * 60 + now.minute
    
    for day_offset in range(31):  # 0 to 30 days
        check_date = today + timedelta(days=day_offset)
        day_of_week = check_date.weekday()  # 0=Monday
        is_today = day_offset == 0
        
        # Find slots for this day of week
        for slot in weekly_availability:
            if slot["day_of_week"] == day_of_week:
                date_str = check_date.isoformat()
                
                # Generate all 30-minute slots between start and end time
                time_slots = generate_time_slots(slot["start_time"], slot["end_time"])
                
                for time_str in time_slots:
                    # Skip past time slots for today
                    if is_today:
                        slot_h, slot_m = map(int, time_str.split(':'))
                        slot_minutes = slot_h * 60 + slot_m
                        # Add 30 min buffer - don't show slots starting in less than 30 mins
                        if slot_minutes <= current_time_minutes + 30:
                            continue
                    
                    # Check if not blocked by existing session OR Google Calendar
                    if (date_str, time_str) not in blocked_slots:
                        available_slots.append({
                            "date": date_str,
                            "time": time_str,
                            "end_time": slot["end_time"],
                            "day_name": check_date.strftime("%A")
                        })
    
    return {
        "peer_id": peer_id,
        "peer_name": peer.get("name", ""),
        "available_slots": available_slots,
        "calendar_synced": peer.get("google_calendar_connected", False),
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat()
    }


# ============ Google Calendar Integration ============

@router.get("/calendar/status")
async def get_peer_calendar_status(request: Request):
    """Check if peer has connected their Google Calendar"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    if not profile:
        return {
            "connected": False,
            "email": None,
            "last_synced": None,
            "has_profile": False
        }
    
    return {
        "connected": profile.get("google_calendar_connected", False),
        "email": profile.get("google_calendar_email"),
        "last_synced": profile.get("google_calendar_last_synced"),
        "has_profile": True
    }


@router.get("/calendar/auth/start")
async def start_peer_calendar_auth(request: Request):
    """Start Google Calendar OAuth flow for peer"""
    import urllib.parse
    import secrets
    import os
    
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Check if profile exists
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=400, detail="Create a peer profile first")
    
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500, 
            detail="Google OAuth not configured. Please contact support."
        )
    
    # Build redirect URI
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    redirect_uri = f"{backend_url}/api/peers/calendar/auth/callback"
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Build authorization URL
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'https://www.googleapis.com/auth/calendar.readonly',
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state
    }
    
    authorization_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    
    # Store state in profile for verification
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"oauth_state": state, "oauth_state_created": datetime.utcnow()}}
    )
    
    return {"authorization_url": authorization_url}


@router.get("/calendar/auth/callback")
async def peer_calendar_auth_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback for peer calendar"""
    from fastapi.responses import RedirectResponse
    import os
    import httpx
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "").rstrip("/")
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
    
    if error:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/peer-practice?calendar_error={error}",
            status_code=302
        )
    
    if not code or not state:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/peer-practice?calendar_error=missing_params",
            status_code=302
        )
    
    db = get_db(request)
    
    # Find peer profile by OAuth state
    profile = await db.peer_profiles.find_one({"oauth_state": state})
    if not profile:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/peer-practice?calendar_error=invalid_state",
            status_code=302
        )
    
    try:
        # Build redirect URI
        backend_url = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
        redirect_uri = f"{backend_url}/api/peers/calendar/auth/callback"
        
        # Exchange code for tokens
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
                raise Exception(f"Token exchange failed: {token_response.text}")
            
            tokens = token_response.json()
        
        # Create credentials
        credentials = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/calendar.readonly']
        )
        
        # Get user's email from calendar API
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        primary_calendar = next(
            (cal for cal in calendar_list.get('items', []) if cal.get('primary')),
            None
        )
        calendar_email = primary_calendar.get('id') if primary_calendar else 'Unknown'
        
        # Store credentials in profile
        credentials_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else ['https://www.googleapis.com/auth/calendar.readonly']
        }
        
        await db.peer_profiles.update_one(
            {"user_id": profile["user_id"]},
            {
                "$set": {
                    "google_calendar_credentials": credentials_data,
                    "google_calendar_connected": True,
                    "google_calendar_email": calendar_email,
                    "google_calendar_last_synced": datetime.utcnow()
                },
                "$unset": {"oauth_state": "", "oauth_state_created": ""}
            }
        )
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/peer-practice?calendar_connected=true",
            status_code=302
        )
        
    except Exception as e:
        import urllib.parse
        error_str = str(e)[:150]
        safe_details = urllib.parse.quote(error_str, safe='')
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard/peer-practice?calendar_error=connection_failed&details={safe_details}",
            status_code=302
        )


@router.post("/calendar/sync")
async def sync_peer_calendar(request: Request):
    """Manually trigger a calendar sync"""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if not profile.get("google_calendar_connected"):
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    credentials_data = profile.get("google_calendar_credentials")
    if not credentials_data:
        raise HTTPException(status_code=400, detail="Calendar credentials not found")
    
    try:
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes")
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        calendars_count = len(calendar_list.get('items', []))
        
        # Update last synced time
        await db.peer_profiles.update_one(
            {"user_id": user_id},
            {"$set": {"google_calendar_last_synced": datetime.utcnow()}}
        )
        
        # If credentials were refreshed, save new token
        if credentials.token != credentials_data.get("token"):
            await db.peer_profiles.update_one(
                {"user_id": user_id},
                {"$set": {"google_calendar_credentials.token": credentials.token}}
            )
        
        return {
            "success": True,
            "message": "Calendar synced successfully",
            "calendars_checked": calendars_count,
            "synced_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        if "invalid_grant" in str(e).lower() or "token" in str(e).lower():
            await db.peer_profiles.update_one(
                {"user_id": user_id},
                {"$set": {"google_calendar_connected": False}}
            )
            raise HTTPException(status_code=401, detail="Calendar authorization expired. Please reconnect.")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.delete("/calendar/disconnect")
async def disconnect_peer_calendar(request: Request):
    """Disconnect Google Calendar from peer profile"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "google_calendar_connected": False,
                "google_calendar_email": None,
                "google_calendar_last_synced": None
            },
            "$unset": {"google_calendar_credentials": ""}
        }
    )
    
    return {"success": True, "message": "Google Calendar disconnected successfully"}


async def get_google_calendar_busy_times(peer_profile: dict, start_date: datetime, end_date: datetime) -> set:
    """
    Fetch busy times from Google Calendar for a peer.
    Returns a set of (date_str, time_str) tuples that are blocked.
    """
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    busy_slots = set()
    
    if not peer_profile.get("google_calendar_connected"):
        return busy_slots
    
    credentials_data = peer_profile.get("google_calendar_credentials")
    if not credentials_data:
        return busy_slots
    
    try:
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_data.get("client_id") or os.environ.get("GOOGLE_OAUTH_CLIENT_ID"),
            client_secret=credentials_data.get("client_secret") or os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET"),
            scopes=credentials_data.get("scopes", ['https://www.googleapis.com/auth/calendar.readonly'])
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
        # Format times for Google Calendar API (RFC3339 format)
        time_min = start_date.strftime('%Y-%m-%dT00:00:00Z')
        time_max = end_date.strftime('%Y-%m-%dT23:59:59Z')
        
        logger.info(f"Querying Google Calendar from {time_min} to {time_max}")
        
        # Get list of calendars
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        logger.info(f"Found {len(calendars)} calendars for peer {peer_profile.get('user_id')}")
        
        if not calendars:
            return busy_slots
        
        # Prioritize primary calendar first, then others
        primary_calendar = next((cal for cal in calendars if cal.get('primary')), None)
        other_calendars = [cal for cal in calendars if not cal.get('primary')]
        
        # Process primary calendar first, then up to 4 others
        calendars_to_check = []
        if primary_calendar:
            calendars_to_check.append(primary_calendar)
        calendars_to_check.extend(other_calendars[:4])
        
        logger.info(f"Checking {len(calendars_to_check)} calendars (primary: {primary_calendar.get('id') if primary_calendar else 'None'})")
        
        # First, try to get events directly from calendars
        # This is more reliable than freebusy for seeing actual events
        total_events = 0
        for cal in calendars_to_check:
            cal_id = cal.get('id')
            try:
                events_result = service.events().list(
                    calendarId=cal_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy='startTime',
                    maxResults=100
                ).execute()
                
                events = events_result.get('items', [])
                total_events += len(events)
                
                for event in events:
                    event_summary = event.get('summary', 'No title')
                    logger.info(f"Processing event: {event_summary}")
                    
                    # Skip events marked as "free" or transparent
                    if event.get('transparency') == 'transparent':
                        logger.info(f"  Skipping transparent event: {event_summary}")
                        continue
                    
                    start = event.get('start', {})
                    end = event.get('end', {})
                    
                    # Handle all-day events
                    if 'date' in start:
                        # All-day event - block the entire day
                        event_date = start['date']
                        # Block common working hours for all-day events
                        for hour in range(8, 20):
                            for minute in [0, 30]:
                                busy_slots.add((event_date, f"{hour:02d}:{minute:02d}"))
                        continue
                    
                    # Handle timed events
                    start_time_str = start.get('dateTime', '')
                    end_time_str = end.get('dateTime', '')
                    
                    if not start_time_str or not end_time_str:
                        continue
                    
                    # Parse datetime
                    try:
                        # Handle timezone offset in the datetime string
                        if 'Z' in start_time_str:
                            busy_start = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                        else:
                            busy_start = datetime.fromisoformat(start_time_str)
                            
                        if 'Z' in end_time_str:
                            busy_end = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                        else:
                            busy_end = datetime.fromisoformat(end_time_str)
                        
                        # Convert to naive datetime for slot generation
                        busy_start_naive = busy_start.replace(tzinfo=None)
                        busy_end_naive = busy_end.replace(tzinfo=None)
                        
                        # Round down to nearest 30 minutes
                        busy_start_naive = busy_start_naive.replace(
                            minute=(busy_start_naive.minute // 30) * 30, 
                            second=0, 
                            microsecond=0
                        )
                        
                        # Block from 60 minutes before (since sessions are 90 min)
                        block_start = busy_start_naive - timedelta(minutes=60)
                        
                        while block_start < busy_end_naive:
                            date_str = block_start.strftime('%Y-%m-%d')
                            time_str = block_start.strftime('%H:%M')
                            busy_slots.add((date_str, time_str))
                            block_start += timedelta(minutes=30)
                            
                    except Exception as parse_error:
                        logger.warning(f"Failed to parse event time: {parse_error}")
                        continue
                        
            except Exception as cal_error:
                logger.warning(f"Failed to fetch events from calendar {cal_id}: {cal_error}")
                continue
        
        logger.info(f"Found {total_events} events, {len(busy_slots)} blocked slots from Google Calendar for peer {peer_profile.get('user_id')}")
        
    except Exception as e:
        logger.error(f"Error fetching Google Calendar busy times: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    
    return busy_slots


# ============ Listing Endpoints ============

@router.get("/list")
async def list_peers(request: Request):
    """Get all listed peers available for practice with earliest availability"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Get all listed peers except current user
    peers = await db.peer_profiles.find({
        "is_listed": True,
        "user_id": {"$ne": user_id}
    }).sort("peer_rating", -1).to_list(100)
    
    if not peers:
        return []
    
    # Batch fetch all user data in one query
    peer_user_ids = [peer.get("user_id") for peer in peers]
    users_cursor = db.users.find(
        {"id": {"$in": peer_user_ids}},
        {"_id": 0, "id": 1, "role": 1, "plan": 1, "subscription_type": 1, "is_subscribed": 1, "plan_assignments": 1, "is_mentor": 1, "is_admin": 1}
    )
    users_list = await users_cursor.to_list(length=100)
    users_map = {u.get("id"): u for u in users_list}
    
    # Get today's date for earliest slot calculation
    today = datetime.utcnow().date()
    now = datetime.utcnow()
    current_time_minutes = now.hour * 60 + now.minute
    
    # Build result list
    result = []
    for peer in peers:
        user_data = users_map.get(peer.get("user_id"))
        
        # Skip mentors and admins - they don't participate in peer practice
        if user_data:
            if user_data.get("is_mentor") == True or user_data.get("is_admin") == True:
                continue
            if user_data.get("role") == "mentor" or user_data.get("plan") == "mentor":
                continue
        
        # Determine plan info without database lookup (use cached mapping)
        plan_info = None
        if user_data:
            user_plan = user_data.get("plan")
            if user_plan and user_plan not in ["free", "mentor", None, ""]:
                if user_plan == "free_trial":
                    plan_info = {"name": "Free Trial", "category": "Free Trial"}
                else:
                    # Default mapping based on plan key patterns
                    if any(x in user_plan.lower() for x in ['coaching', 'last_mile', 'mid_mile', 'full_prep', 'pinnacle']):
                        plan_info = {"name": user_plan.replace("_", " ").title(), "category": "Coaching"}
                    elif any(x in user_plan.lower() for x in ['cohort']):
                        plan_info = {"name": user_plan.replace("_", " ").title(), "category": "Cohort"}
                    elif any(x in user_plan.lower() for x in ['basic', 'pro', 'plus', 'subscriber']):
                        plan_info = {"name": user_plan.replace("_", " ").title(), "category": "Subscription"}
                    else:
                        plan_info = {"name": user_plan.replace("_", " ").title(), "category": "Subscription"}
        
        peer_data = serialize_peer(peer, user_data=user_data, plan_info=plan_info)
        
        # Calculate earliest available slot from weekly_availability
        weekly = peer.get("weekly_availability", [])
        earliest_slot = None
        
        if weekly:
            # Check next 14 days for earliest slot
            for day_offset in range(14):
                check_date = today + timedelta(days=day_offset)
                day_of_week = check_date.weekday()
                is_today = day_offset == 0
                
                for slot in weekly:
                    if slot.get("day_of_week") == day_of_week:
                        start_time = slot.get("start_time", "09:00")
                        
                        # Skip past times for today
                        if is_today:
                            slot_h, slot_m = map(int, start_time.split(':'))
                            slot_minutes = slot_h * 60 + slot_m
                            if slot_minutes <= current_time_minutes + 30:
                                continue
                        
                        earliest_slot = {
                            "date": check_date.isoformat(),
                            "time": start_time,
                            "day_name": check_date.strftime("%A")
                        }
                        break
                
                if earliest_slot:
                    break
        
        peer_data["earliest_slot"] = earliest_slot
        peer_data["availability"] = list(set([slot["start_time"] for slot in weekly]))[:5]
        result.append(peer_data)
    
    return result


# ============ Booking Endpoints ============

@router.post("/book")
async def book_peer_session(request: Request, booking: BookSessionRequest):
    """Book a peer practice session.
    
    Rules (Monthly Credit System):
    - Credits are calculated on a rolling monthly basis from subscription start date
    - Users can book sessions anytime within their subscription period
    - Both requester and partner need available credits for the current billing month
    - Credits reset monthly based on subscription start date
    """
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_email = user.get("email") if isinstance(user, dict) else user.email
    user_name = user.get("name") if isinstance(user, dict) else getattr(user, "name", "User")
    user_picture = user.get("picture") if isinstance(user, dict) else getattr(user, "picture", None)
    
    # Parse booking date
    booking_date = datetime.strptime(booking.date, "%Y-%m-%d").date()
    today = datetime.utcnow().date()
    
    # Rule: Cannot book sessions in the past
    if booking_date < today:
        raise HTTPException(status_code=400, detail="Cannot book sessions in the past.")
    
    # Check if user has peer practice access
    access_info = await get_user_peer_access(db, user_id)
    if not access_info["has_access"]:
        raise HTTPException(status_code=403, detail=access_info.get("reason", "You don't have access to peer practice sessions. Please upgrade your plan."))
    
    # Check requester's credits for this billing month
    remaining_info = await get_remaining_sessions_this_month(
        db, user_id, access_info["sessions_per_month"], access_info.get("plan_start_date")
    )
    if remaining_info["sessions_remaining"] <= 0 and not remaining_info["is_unlimited"]:
        next_reset = remaining_info.get("next_reset", "next month")
        raise HTTPException(
            status_code=400, 
            detail=f"You've used all {remaining_info['sessions_per_month']} session(s) for this billing period. Your credits will reset on {next_reset}."
        )
    
    # Get partner's profile
    partner = await db.peer_profiles.find_one({"user_id": booking.partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Get partner's user data for email
    partner_user = await db.users.find_one({"id": booking.partner_id}, {"_id": 0, "email": 1, "name": 1})
    partner_email = partner_user.get("email") if partner_user else partner.get("email", "")
    
    # Check if slot is available
    existing = await db.peer_sessions.find_one({
        "$or": [
            {"requester_id": booking.partner_id},
            {"partner_id": booking.partner_id}
        ],
        "date": booking.date,
        "time_slot": booking.time_slot,
        "status": {"$in": ["pending", "confirmed", "matched"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="This slot is no longer available")
    
    # Check if partner has available credits for their billing month
    partner_access = await get_user_peer_access(db, booking.partner_id)
    if partner_access["has_access"]:
        partner_remaining = await get_remaining_sessions_this_month(
            db, booking.partner_id, partner_access["sessions_per_month"], partner_access.get("plan_start_date")
        )
        if partner_remaining["sessions_remaining"] <= 0 and not partner_remaining["is_unlimited"]:
            partner_next_reset = partner_remaining.get("next_reset", "next month")
            raise HTTPException(
                status_code=400, 
                detail=f"Your partner has no remaining sessions this month. Their credits reset on {partner_next_reset}."
            )
    
    # Get requester's profile for their info
    requester_profile = await db.peer_profiles.find_one({"user_id": user_id})
    requester_picture = requester_profile.get("profile_picture") if requester_profile else user_picture
    requester_name = requester_profile.get("name") if requester_profile else user_name
    
    # Generate a unique session ID for approval links
    import uuid
    session_id = f"peer_{uuid.uuid4().hex[:16]}"
    
    # Create session with PENDING status (needs partner approval)
    session_data = {
        "id": session_id,
        "requester_id": user_id,
        "requester_email": user_email,
        "requester_name": requester_name or "User",
        "requester_picture": requester_picture or f"https://ui-avatars.com/api/?name={requester_name}&background=random",
        "partner_id": booking.partner_id,
        "partner_email": partner_email,
        "partner_name": partner.get("name", "Partner"),
        "partner_picture": partner.get("profile_picture") or f"https://ui-avatars.com/api/?name={partner.get('name', 'P')}&background=random",
        "date": booking.date,
        "time_slot": booking.time_slot,
        "duration_minutes": 90,  # 1.5 hours
        "session_type": booking.session_type or "General discussion",
        "case_type": booking.case_type,
        "requester_notes": booking.notes,
        "status": "pending",  # Pending approval from partner
        "meet_link": "",
        "requester_feedback": None,
        "partner_feedback": None,
        "created_at": datetime.utcnow()
    }
    
    result = await db.peer_sessions.insert_one(session_data)
    
    # Send approval request email to partner
    try:
        await send_peer_session_approval_email(
            partner_email=partner_email,
            partner_name=partner.get("name", "there"),
            requester_name=requester_name or "A peer",
            session_date=booking.date,
            session_time=booking.time_slot,
            session_type=booking.session_type or "Case Interview Practice",
            case_type=booking.case_type,
            notes=booking.notes,
            session_id=session_id
        )
    except Exception as e:
        logger.error(f"Failed to send approval email: {e}")
    
    return {
        "success": True,
        "message": "Session request sent! Waiting for partner approval.",
        "session": serialize_session(session_data, user_id)
    }


@router.post("/sessions/{session_id}/approve")
async def approve_peer_session(request: Request, session_id: str):
    """Partner approves a pending peer practice session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session by custom ID or MongoDB _id
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Only the partner can approve
    if session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the invited partner can approve this session")
    
    if session["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Session is already {session['status']}")
    
    # Create calendar event with Google Meet
    meet_link = ""
    calendar_event_id = ""
    try:
        practice_type = session.get("session_type", "Case Interview")
        if session.get("case_type"):
            practice_type = f"{session['session_type']} - {session['case_type']}"
        
        event_result = create_peer_practice_event(
            user1_name=session["requester_name"],
            user1_email=session["requester_email"],
            user2_name=session["partner_name"],
            user2_email=session["partner_email"],
            session_date=session["date"],
            session_time=session["time_slot"],
            duration_minutes=90,
            practice_type=practice_type
        )
        if event_result and event_result.get("meet_link"):
            meet_link = event_result["meet_link"]
            calendar_event_id = event_result.get("event_id", "")
            hidden_event_id = event_result.get("hidden_event_id", "")
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")
        hidden_event_id = ""
    
    # Update session to confirmed
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "confirmed",
            "meet_link": meet_link,
            "calendar_event_id": calendar_event_id,
            "hidden_event_id": hidden_event_id,
            "approved_at": datetime.utcnow()
        }}
    )
    
    # Send confirmation email to requester
    try:
        await send_session_confirmed_email(
            db=db,
            requester_email=session["requester_email"],
            requester_name=session["requester_name"],
            partner_name=session["partner_name"],
            session_date=session["date"],
            session_time=session["time_slot"],
            meet_link=meet_link
        )
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")
    
    return {
        "success": True,
        "message": "Session approved! Calendar invite sent to both participants.",
        "meet_link": meet_link
    }


@router.post("/sessions/{session_id}/decline")
async def decline_peer_session(request: Request, session_id: str):
    """Partner declines a pending peer practice session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Only the partner can decline
    if session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the invited partner can decline this session")
    
    if session["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Session is already {session['status']}")
    
    # Update session to declined (credits restored for both users)
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "declined",
            "declined_at": datetime.utcnow()
        }}
    )
    
    # Send notification to requester that session was declined
    try:
        await send_session_declined_email(
            db=db,
            requester_email=session["requester_email"],
            requester_name=session["requester_name"],
            partner_name=session["partner_name"],
            session_date=session["date"],
            session_time=session["time_slot"]
        )
    except Exception as e:
        logger.error(f"Failed to send decline notification: {e}")
    
    return {
        "success": True,
        "message": "Session declined. Credits restored for both users."
    }


async def send_session_confirmed_email(db, requester_email: str, requester_name: str, partner_name: str,
                                        session_date: str, session_time: str, meet_link: str):
    """Send confirmation email when partner approves the session"""
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice?tab=sessions"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Session Confirmed!</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {requester_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Great news! <strong>{partner_name}</strong> has accepted your practice session request.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">Session Details</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {session_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {session_time}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Partner:</strong> {partner_name}</p>
                {f'<p style="color: #475569; margin: 8px 0;"><strong>Meet Link:</strong> <a href="{meet_link}">{meet_link}</a></p>' if meet_link else ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    View in Dashboard
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
                A calendar invite has been sent to both of you. Good luck with your practice!
            </p>
        </div>
    </div>
    """
    
    await send_email_via_gmail(db, requester_email, f"{partner_name} confirmed your practice session!", html_content)


async def send_session_declined_email(db, requester_email: str, requester_name: str, partner_name: str,
                                       session_date: str, session_time: str):
    """Send notification when partner declines the session"""
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Session Request Update</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {requester_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Unfortunately, <strong>{partner_name}</strong> is unable to accept your practice session for {session_date} at {session_time}.
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Don't worry - your session credit has been restored. Feel free to book with another peer!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    Find Another Peer
                </a>
            </div>
        </div>
    </div>
    """
    
    await send_email_via_gmail(db, requester_email, f"Session request update from {partner_name}", html_content)


@router.get("/my-sessions")
async def get_my_sessions(request: Request):
    """Get all peer practice sessions for current user"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    sessions = await db.peer_sessions.find({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ]
    }, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Batch fetch thumbnails for all users in sessions
    user_ids_in_sessions = set()
    for s in sessions:
        if s.get("requester_id"):
            user_ids_in_sessions.add(s["requester_id"])
        if s.get("partner_id"):
            user_ids_in_sessions.add(s["partner_id"])
    
    # Fetch thumbnails from peer_profiles
    thumbnails_map = {}
    if user_ids_in_sessions:
        profiles = await db.peer_profiles.find(
            {"user_id": {"$in": list(user_ids_in_sessions)}},
            {"_id": 0, "user_id": 1, "profile_picture_thumbnail": 1}
        ).to_list(len(user_ids_in_sessions))
        thumbnails_map = {p["user_id"]: p.get("profile_picture_thumbnail") for p in profiles if p.get("profile_picture_thumbnail")}
    
    # Enrich sessions with thumbnails
    for s in sessions:
        req_id = s.get("requester_id")
        part_id = s.get("partner_id")
        
        if req_id in thumbnails_map:
            s["requester_picture_thumbnail"] = thumbnails_map[req_id]
        if part_id in thumbnails_map:
            s["partner_picture_thumbnail"] = thumbnails_map[part_id]
    
    return [serialize_session(s, user_id) for s in sessions]

@router.put("/sessions/{session_id}/reschedule")
async def reschedule_session(request: Request, session_id: str, reschedule: RescheduleRequest):
    """Request to reschedule a peer practice session - requires approval from partner"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_name = user.get("name") if isinstance(user, dict) else user.name
    
    # Find session by custom ID or MongoDB _id
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Determine who needs to approve (the other person)
    if session["requester_id"] == user_id:
        approver_id = session["partner_id"]
        approver_name = session["partner_name"]
        approver_email = session["partner_email"]
    else:
        approver_id = session["requester_id"]
        approver_name = session["requester_name"]
        approver_email = session["requester_email"]
    
    # Update session to reschedule_pending status
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "status": "reschedule_pending",
            "reschedule_requested_by": user_id,
            "reschedule_requested_by_name": user_name,
            "proposed_date": reschedule.date,
            "proposed_time_slot": reschedule.time_slot,
            "original_date": session["date"],
            "original_time_slot": session["time_slot"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Send email to the other person for approval
    try:
        await send_reschedule_request_email(
            db=db,
            approver_email=approver_email,
            approver_name=approver_name,
            requester_name=user_name,
            original_date=session["date"],
            original_time=session["time_slot"],
            new_date=reschedule.date,
            new_time=reschedule.time_slot
        )
    except Exception as e:
        logger.error(f"Failed to send reschedule email: {e}")
    
    return {"success": True, "message": f"Reschedule request sent to {approver_name} for approval"}


@router.post("/sessions/{session_id}/approve-reschedule")
async def approve_reschedule(request: Request, session_id: str):
    """Approve a reschedule request"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "reschedule_pending":
        raise HTTPException(status_code=400, detail="No pending reschedule request")
    
    # Only the person who didn't request can approve
    if session.get("reschedule_requested_by") == user_id:
        raise HTTPException(status_code=403, detail="You cannot approve your own reschedule request")
    
    # Check user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_date = session["proposed_date"]
    new_time = session["proposed_time_slot"]
    
    # Cancel OLD calendar events before creating new ones
    try:
        from services.calendar_service import get_calendar_service
        calendar_service = get_calendar_service()
        
        # Delete old visible calendar event
        if session.get("calendar_event_id"):
            calendar_service.cancel_event(session["calendar_event_id"], notify_attendees=True)
            logger.info(f"Cancelled old visible calendar event for reschedule: {session['calendar_event_id']}")
        
        # Delete old hidden event
        if session.get("hidden_event_id"):
            calendar_service.cancel_event(session["hidden_event_id"], notify_attendees=False)
            logger.info(f"Cancelled old hidden Meet event for reschedule: {session['hidden_event_id']}")
    except Exception as e:
        logger.error(f"Failed to cancel old calendar events for reschedule: {e}")
    
    # Create NEW calendar event with Google Meet for the rescheduled time
    meet_link = ""
    calendar_event_id = ""
    hidden_event_id = ""
    try:
        practice_type = session.get("session_type", "Case Interview")
        if session.get("case_type"):
            practice_type = f"{session['session_type']} - {session['case_type']}"
        
        event_result = create_peer_practice_event(
            user1_name=session["requester_name"],
            user1_email=session["requester_email"],
            user2_name=session["partner_name"],
            user2_email=session["partner_email"],
            session_date=new_date,
            session_time=new_time,
            duration_minutes=90,
            practice_type=f"{practice_type} (Rescheduled)"
        )
        if event_result and event_result.get("meet_link"):
            meet_link = event_result["meet_link"]
            calendar_event_id = event_result.get("event_id", "")
            hidden_event_id = event_result.get("hidden_event_id", "")
            logger.info(f"Created new calendar event for rescheduled session: {calendar_event_id}")
    except Exception as e:
        logger.error(f"Failed to create calendar event for reschedule: {e}")
        # Use existing meet link if new one fails
        meet_link = session.get("meet_link", "")
        calendar_event_id = session.get("calendar_event_id", "")
        hidden_event_id = session.get("hidden_event_id", "")
    
    # Update session with new date/time and new meet link
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "date": new_date,
            "time_slot": new_time,
            "status": "confirmed",
            "was_rescheduled": True,
            "meet_link": meet_link,
            "calendar_event_id": calendar_event_id,
            "hidden_event_id": hidden_event_id,
            "rescheduled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "proposed_date": "",
            "proposed_time_slot": "",
            "reschedule_requested_by": "",
            "reschedule_requested_by_name": ""
        }}
    )
    
    # Send confirmation email to BOTH participants
    try:
        # Email to requester
        await send_reschedule_confirmed_email(
            db=db,
            email=session["requester_email"],
            name=session["requester_name"],
            partner_name=session["partner_name"],
            new_date=new_date,
            new_time=new_time,
            meet_link=meet_link
        )
        # Email to partner
        await send_reschedule_confirmed_email(
            db=db,
            email=session["partner_email"],
            name=session["partner_name"],
            partner_name=session["requester_name"],
            new_date=new_date,
            new_time=new_time,
            meet_link=meet_link
        )
        logger.info(f"Sent reschedule confirmation emails to both participants")
    except Exception as e:
        logger.error(f"Failed to send reschedule confirmation email: {e}")
    
    return {
        "success": True, 
        "message": "Reschedule approved! New calendar invite sent to both participants.",
        "meet_link": meet_link
    }


@router.post("/sessions/{session_id}/decline-reschedule")
async def decline_reschedule(request: Request, session_id: str):
    """Decline a reschedule request - keeps original time"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "reschedule_pending":
        raise HTTPException(status_code=400, detail="No pending reschedule request")
    
    # Check user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Restore original date/time and set back to confirmed
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "date": session.get("original_date", session["date"]),
            "time_slot": session.get("original_time_slot", session["time_slot"]),
            "status": "confirmed",
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "proposed_date": "",
            "proposed_time_slot": "",
            "original_date": "",
            "original_time_slot": "",
            "reschedule_requested_by": "",
            "reschedule_requested_by_name": ""
        }}
    )
    
    return {"success": True, "message": "Reschedule declined. Original time kept."}


async def send_reschedule_request_email(db, approver_email: str, approver_name: str, requester_name: str,
                                         original_date: str, original_time: str, new_date: str, new_time: str):
    """Send email requesting approval for reschedule"""
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice?tab=sessions"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Reschedule Request</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {approver_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                <strong>{requester_name}</strong> has requested to reschedule your practice session.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">Original Time</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {original_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {original_time}</p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                
                <h3 style="color: #1e293b; margin-top: 0;">Proposed New Time</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {new_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {new_time}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    Review in Dashboard
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
                Please approve or decline this reschedule request from your dashboard.
            </p>
        </div>
    </div>
    """
    
    await send_email_via_gmail(db, approver_email, f"{requester_name} requested to reschedule your session", html_content)


async def send_reschedule_approved_email(db, email: str, name: str, new_date: str, new_time: str):
    """Send email confirming reschedule was approved"""
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice?tab=sessions"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Reschedule Approved</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Your reschedule request has been approved!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">New Session Time</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {new_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {new_time}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    View in Dashboard
                </a>
            </div>
        </div>
    </div>
    """
    
    await send_email_via_gmail(db, email, f"Reschedule approved - New time: {new_date} at {new_time}", html_content)


async def send_reschedule_confirmed_email(db, email: str, name: str, partner_name: str, 
                                           new_date: str, new_time: str, meet_link: str):
    """Send email to both participants confirming reschedule with new calendar invite and meet link"""
    dashboard_url = f"{FRONTEND_URL}/dashboard/peer-practice?tab=sessions"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Session Rescheduled ✓</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Great news! Your peer practice session with <strong>{partner_name}</strong> has been rescheduled.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">📅 New Session Details</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {new_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {new_time}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Partner:</strong> {partner_name}</p>
                {f'<p style="color: #475569; margin: 8px 0;"><strong>Meet Link:</strong> <a href="{meet_link}" style="color: #2563eb;">{meet_link}</a></p>' if meet_link else ''}
            </div>
            
            {f'''
            <div style="text-align: center; margin: 20px 0;">
                <a href="{meet_link}" 
                   style="background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    Join Google Meet
                </a>
            </div>
            ''' if meet_link else ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    View in Dashboard
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
                A new calendar invite has been sent to both participants. The old invite has been replaced.
            </p>
        </div>
    </div>
    """
    
    await send_email_via_gmail(db, email, f"Session Rescheduled - {new_date} at {new_time} with {partner_name}", html_content)


@router.delete("/sessions/{session_id}")
async def cancel_session(request: Request, session_id: str):
    """Cancel a peer practice session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session - try by custom 'id' field first, then by ObjectId
    session = await db.peer_sessions.find_one({"id": session_id})
    if not session:
        try:
            session = await db.peer_sessions.find_one({"_id": ObjectId(session_id)})
        except:
            pass
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cancel calendar events (both visible and hidden)
    try:
        from services.calendar_service import get_calendar_service
        calendar_service = get_calendar_service()
        
        # Delete visible calendar event
        if session.get("calendar_event_id"):
            calendar_service.cancel_event(session["calendar_event_id"], notify_attendees=True)
            logger.info(f"Cancelled visible calendar event: {session['calendar_event_id']}")
        
        # Delete hidden event (for Meet link)
        if session.get("hidden_event_id"):
            calendar_service.cancel_event(session["hidden_event_id"], notify_attendees=False)
            logger.info(f"Cancelled hidden Meet event: {session['hidden_event_id']}")
    except Exception as e:
        logger.error(f"Failed to cancel calendar events: {e}")
    
    # Update status to cancelled
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"status": "cancelled", "cancelled_by": user_id, "cancelled_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )
    
    return {"success": True, "message": "Session cancelled successfully. Your credit has been restored."}


# ============ Feedback & Join Tracking ============

@router.post("/sessions/{session_id}/join")
async def track_session_join(request: Request, session_id: str):
    """Track when a user joins a peer practice session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Determine which join field to update
    if session["requester_id"] == user_id:
        join_field = "requester_joined_at"
    else:
        join_field = "partner_joined_at"
    
    # Update join timestamp
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {join_field: datetime.utcnow().isoformat()}}
    )
    
    return {
        "success": True,
        "meet_link": session.get("meet_link", ""),
        "message": "Join tracked successfully"
    }


@router.get("/sessions/{session_id}/feedback")
async def get_session_feedback(request: Request, session_id: str):
    """Get feedback for a session (view partner's feedback about you)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find session
    session = await db.peer_sessions.find_one({
        "$or": [{"id": session_id}, {"_id": ObjectId(session_id) if len(session_id) == 24 else None}]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is part of session
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Return partner's feedback about the user
    if session["requester_id"] == user_id:
        # User is requester, return partner's feedback
        feedback = session.get("partner_feedback")
        feedback_from = session.get("partner_name")
    else:
        # User is partner, return requester's feedback
        feedback = session.get("requester_feedback")
        feedback_from = session.get("requester_name")
    
    return {
        "has_feedback": feedback is not None,
        "feedback": feedback,
        "feedback_from": feedback_from,
        "session_date": session.get("date"),
        "session_time": session.get("time_slot"),
        "session_type": session.get("session_type")
    }


@router.post("/feedback")
async def submit_feedback(request: Request, feedback: FeedbackRequest):
    """Submit mentor-style feedback for a completed peer session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    session = await db.peer_sessions.find_one({
        "$or": [{"id": feedback.session_id}, {"_id": ObjectId(feedback.session_id) if len(feedback.session_id) == 24 else None}]
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Determine which feedback field to update
    if session["requester_id"] == user_id:
        feedback_field = "requester_feedback"
        partner_id = session["partner_id"]
    elif session["partner_id"] == user_id:
        feedback_field = "partner_feedback"
        partner_id = session["requester_id"]
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build the feedback document with all fields
    feedback_doc = {
        "session_type": feedback.session_type,
        "case_type": feedback.case_type,
        "rating_overall": feedback.rating_overall,
        "areas_of_strength": feedback.areas_of_strength or [],
        "areas_of_improvement": feedback.areas_of_improvement or [],
        "qualitative_feedback": feedback.qualitative_feedback,
        "created_at": datetime.utcnow().isoformat(),
        
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
        
        # Legacy fields (for backward compatibility)
        "rating_scoping_questions": feedback.rating_scoping_questions,
        "rating_case_structure": feedback.rating_case_structure,
        "rating_quantitative": feedback.rating_quantitative,
        "quantitative_tested": feedback.quantitative_tested,
        "rating_communication": feedback.rating_communication,
        "rating_business_acumen": feedback.rating_business_acumen,
        
        # Average rating (use overall rating as average)
        "average_rating": feedback.rating_overall
    }
    
    # Update session with feedback
    # Also set the _submitted flag that the mandatory feedback check looks for
    feedback_submitted_field = "requester_feedback_submitted" if feedback_field == "requester_feedback" else "partner_feedback_submitted"
    
    await db.peer_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            feedback_field: feedback_doc,
            feedback_submitted_field: True,  # This flag is checked by /api/feedback/pending-mandatory
            "status": "completed"
        }}
    )
    
    # Recalculate stats for BOTH users (partner being rated AND submitter)
    # This ensures both users' session counts and ratings are always up-to-date
    await recalculate_peer_stats(db, partner_id)   # Update the person being rated
    await recalculate_peer_stats(db, user_id)      # Update the feedback submitter
    
    return {"success": True, "message": "Feedback submitted. Thank you!"}

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(request: Request, session_id: str):
    """Get messages for a session"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Verify user is part of session
    session = await db.peer_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.peer_messages.find(
        {"session_id": session_id}
    ).sort("created_at", 1).to_list(100)
    
    return {
        "messages": [
            {
                "id": str(m["_id"]),
                "sender_id": m["sender_id"],
                "sender_name": m["sender_name"],
                "sender_picture": m["sender_picture"],
                "message": m["message"],
                "created_at": m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"]
            }
            for m in messages
        ]
    }

@router.post("/sessions/{session_id}/messages")
async def send_session_message(request: Request, session_id: str, msg: MessageRequest):
    """Send a message in a session chat"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_name = user.get("name") if isinstance(user, dict) else getattr(user, "name", "User")
    user_picture = user.get("picture") if isinstance(user, dict) else getattr(user, "picture", None)
    
    # Verify user is part of session
    session = await db.peer_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["requester_id"] != user_id and session["partner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get user's profile picture
    profile = await db.peer_profiles.find_one({"user_id": user_id})
    if profile:
        user_picture = profile.get("profile_picture") or user_picture
        user_name = profile.get("name") or user_name
    
    message_data = {
        "session_id": session_id,
        "sender_id": user_id,
        "sender_name": user_name or "User",
        "sender_picture": user_picture or f"https://ui-avatars.com/api/?name={user_name}&background=random",
        "message": msg.message,
        "created_at": datetime.utcnow()
    }
    
    result = await db.peer_messages.insert_one(message_data)
    message_data["_id"] = result.inserted_id
    
    return {
        "success": True,
        "message": {
            "id": str(result.inserted_id),
            "sender_id": user_id,
            "sender_name": message_data["sender_name"],
            "sender_picture": message_data["sender_picture"],
            "message": msg.message,
            "created_at": message_data["created_at"].isoformat()
        }
    }


# ============ File Upload for Profile Picture ============

@router.post("/upload-picture")
async def upload_profile_picture(request: Request):
    """Upload a profile picture for peer practice - updates both peer_profiles and users collection"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    form = await request.form()
    file = form.get("file")
    
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed (JPG, PNG)")
    
    # Read file content
    content = await file.read()
    
    # Validate file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
    
    # Store as base64 data URI
    import base64
    base64_data = base64.b64encode(content).decode("utf-8")
    data_uri = f"data:{content_type};base64,{base64_data}"
    
    # Generate thumbnail for list views (max 100x100, quality 60%)
    thumbnail_uri = await generate_thumbnail(content, content_type, max_size=100, quality=60)
    
    # Update peer_profiles with picture and thumbnail
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "profile_picture": data_uri,
            "profile_picture_thumbnail": thumbnail_uri,
            "updated_at": datetime.utcnow()
        }},
        upsert=False  # Don't create profile, just update if exists
    )
    
    # Also update the main users collection to keep picture in sync
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "picture": data_uri,
            "picture_thumbnail": thumbnail_uri,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"success": True, "picture_url": data_uri}
