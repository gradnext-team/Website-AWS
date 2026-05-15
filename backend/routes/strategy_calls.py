"""
Strategy Call Management Routes
Handles strategy call bookings, mentor eligibility, and credit tracking.
"""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from services.calendar_service import create_strategy_call_event, get_calendar_service
from routes.auth import send_email_via_gmail

logger = logging.getLogger(__name__)
router = APIRouter()

# Frontend URL for emails
FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gradnext.co").replace("/api", "")


# TEST ENDPOINT - unified availability without auth for debugging
@router.get("/test-no-auth")
async def test_unified_no_auth(request: Request, days: int = 14):
    """TEST: Check what unified availability returns"""
    import pytz
    
    db = get_db(request)
    
    mentors = await db.mentors.find({
        "can_take_strategy_calls": True,
        "is_active": {"$ne": False},
        "is_deleted": {"$ne": True}
    }).to_list(100)
    
    debug_info = {
        "mentors_found": len(mentors),
        "mentors": [],
        "current_time": None,
        "today": None,
        "processing": []
    }
    
    if not mentors:
        return {"error": "no mentors", "mentor_count": 0, "slots": {}, "debug": debug_info}
    
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    today = now_ist.date()
    
    debug_info["current_time"] = now_ist.isoformat()
    debug_info["today"] = str(today)
    
    for m in mentors:
        debug_info["mentors"].append({
            "name": m.get("name"),
            "avail_days": len(m.get("availability", []))
        })
    
    aggregated_slots = {}
    day_mapping = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
    
    for mentor in mentors:
        mentor_name = mentor.get("name")
        availability = mentor.get("availability", [])
        
        for day_avail in availability:
            day_name = day_avail.get("day")
            slots = day_avail.get("slots", [])
            target_weekday = day_mapping.get(day_name)
            
            debug_info["processing"].append(f"{mentor_name} - {day_name}: {len(slots)} slots, weekday={target_weekday}")
            
            if target_weekday is None:
                continue
            
            for i in range(days):
                check_date = today + timedelta(days=i)
                
                if check_date.weekday() == target_weekday:
                    date_str = check_date.strftime("%Y-%m-%d")
                    
                    for slot in slots:
                        time_str = slot.get("time")
                        if not time_str:
                            continue
                        
                        try:
                            slot_datetime = ist.localize(datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M"))
                            
                            if slot_datetime > now_ist:
                                if date_str not in aggregated_slots:
                                    aggregated_slots[date_str] = {}
                                if time_str not in aggregated_slots[date_str]:
                                    aggregated_slots[date_str][time_str] = {"available": True, "mentor_ids": []}
                                aggregated_slots[date_str][time_str]["mentor_ids"].append(mentor.get("id"))
                        except Exception as e:
                            debug_info["processing"].append(f"Error: {e}")
    
    return {
        "slots": aggregated_slots,
        "mentor_count": len(mentors),
        "debug_total": sum(len(t) for t in aggregated_slots.values()),
        "debug": debug_info
    }



def get_db(request: Request):
    return request.app.state.db


async def get_best_available_mentor(db, mentor_ids: list, date: str, time: str):
    """
    Select best mentor from available options using:
    1. Highest rating (primary)
    2. Fewest strategy call bookings (tie-breaker)
    3. Most recent availability update (secondary tie-breaker)
    """
    if not mentor_ids:
        return None
    
    # Get mentor details
    mentors = await db.mentors.find({
        "id": {"$in": mentor_ids}
    }).to_list(len(mentor_ids))
    
    if not mentors:
        return None
    
    # Get strategy call booking counts for each mentor
    mentor_scores = []
    for mentor in mentors:
        mentor_id = mentor.get("id")
        
        # Count total strategy call bookings
        booking_count = await db.strategy_call_sessions.count_documents({
            "mentor_id": mentor_id,
            "status": {"$in": ["scheduled", "confirmed", "completed"]}
        })
        
        # Verify this specific slot is still available (race condition check)
        slot_taken = await db.strategy_call_sessions.find_one({
            "mentor_id": mentor_id,
            "date": date,
            "time": time,
            "status": {"$in": ["scheduled", "confirmed"]}
        })
        
        if slot_taken:
            continue  # Skip this mentor, slot was just taken
        
        # Handle updated_at for sorting (convert to comparable value)
        updated_at_value = mentor.get("updated_at", "")
        if isinstance(updated_at_value, datetime):
            updated_at_sortable = updated_at_value.timestamp()
        elif isinstance(updated_at_value, str):
            try:
                updated_at_sortable = datetime.fromisoformat(updated_at_value.replace('Z', '+00:00')).timestamp()
            except:
                updated_at_sortable = 0
        else:
            updated_at_sortable = 0
        
        mentor_scores.append({
            "mentor": mentor,
            "mentor_id": mentor_id,
            "rating": mentor.get("rating") if mentor.get("sessions_conducted", 0) > 0 else None,
            "booking_count": booking_count,
            "updated_at": updated_at_sortable
        })
    
    if not mentor_scores:
        return None
    
    # Sort by: rating DESC, booking_count ASC, updated_at DESC
    mentor_scores.sort(
        key=lambda x: (-x["rating"], x["booking_count"], -x["updated_at"]),
        reverse=False
    )
    
    best = mentor_scores[0]
    logger.info(f"Auto-assigned mentor: {best['mentor_id']} (rating: {best['rating']}, bookings: {best['booking_count']})")
    
    return best["mentor"]


# Import the main auth function instead of local one
from routes.auth import get_current_user


# ============== Models ==============

class StrategyCallBookingRequest(BaseModel):
    mentor_id: Optional[str] = None  # Optional for auto-assignment
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    notes: Optional[str] = None
    auto_assign: bool = False  # True for subscription/cohort users


class AddonPurchaseRequest(BaseModel):
    quantity: int = 1
    coupon_code: Optional[str] = None


class MentorStrategyCallToggleRequest(BaseModel):
    enable: bool


# ============== Endpoints ==============

@router.get("/credits")
async def get_strategy_call_credits(request: Request):
    """Get user's strategy call credits"""
    user = await get_current_user(request)
    
    logger.info("=" * 60)
    logger.info("STRATEGY CREDITS REQUEST")
    
    if not user:
        logger.error("❌ User not authenticated - get_current_user returned None")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    logger.info(f"✅ User authenticated: {user.get('email')} (id: {user.get('id')})")
    logger.info(f"   Name: {user.get('name')}")
    logger.info(f"   Plan: {user.get('plan', 'NO PLAN')}")
    logger.info(f"   User strategy_calls_total: {user.get('strategy_calls_total', 'NOT SET')}")
    logger.info(f"   User strategy_calls_used: {user.get('strategy_calls_used', 'NOT SET')}")
    
    # Get strategy calls with ADMIN ABSOLUTE PRIORITY:
    # 1. If admin has explicitly set strategy_calls_total (even to 0) → Use that value
    # 2. If admin has NEVER set it (field doesn't exist or None) → Use plan baseline
    # 3. Add bonus credits from plan_assignments on top
    
    # Step 1: Get plan baseline (only as fallback)
    plan_baseline = 0
    plan_key = user.get("plan")
    logger.info(f"   Step 1: Checking plan features for plan_key='{plan_key}'")
    
    if plan_key:
        plan = await db.plans.find_one({"plan_key": plan_key})
        if plan:
            features = plan.get("features", {})
            plan_strategy_calls = features.get("strategy_calls", 0)
            # -1 means unlimited
            if plan_strategy_calls == -1:
                plan_baseline = 999  # Represent as high number
            else:
                plan_baseline = plan_strategy_calls or 0
            logger.info(f"   ✅ Plan found: '{plan.get('name')}' - strategy_calls={plan_strategy_calls}")
        else:
            logger.warning(f"   ⚠️ Plan with plan_key='{plan_key}' NOT FOUND in database!")
    else:
        logger.warning(f"   ⚠️ User has NO PLAN assigned!")
    
    logger.info(f"   Plan baseline: {plan_baseline}")
    
    # Step 2: Check if admin has explicitly set strategy_calls_total
    # Key: We need to distinguish between "not set" (None) and "set to 0"
    admin_value_exists = "strategy_calls_total" in user
    admin_value = user.get("strategy_calls_total")
    
    logger.info(f"   Step 2: Admin value exists in user doc: {admin_value_exists}, value: {admin_value}")
    
    # Step 3: Determine base credits with ABSOLUTE ADMIN PRIORITY
    if admin_value_exists and admin_value is not None:
        # Admin has explicitly set a value (could be 0, 2, 4, anything)
        # Use admin's exact value - NO minimum protection
        if admin_value == -1:
            base_credits = 999  # Unlimited
        else:
            base_credits = admin_value
        logger.info(f"   Step 3: Using ADMIN ABSOLUTE VALUE: {base_credits}")
        if admin_value == 0:
            logger.info(f"   ℹ️ Admin explicitly set to 0 (overriding plan baseline {plan_baseline})")
    else:
        # Admin has NOT set a value, use plan baseline
        base_credits = plan_baseline
        logger.info(f"   Step 3: Admin never set value, using plan baseline: {base_credits}")
    
    # Step 4: Add bonus credits from plan_assignments
    bonus_from_assignments = 0
    plan_assignments = user.get("plan_assignments", [])
    if plan_assignments:
        logger.info(f"   Step 4: Checking {len(plan_assignments)} plan_assignments for bonus credits")
        for assignment in plan_assignments:
            if assignment.get("is_active", True):
                granted = assignment.get("strategy_calls_granted", 0) or 0
                bonus_from_assignments += granted
                logger.info(f"      + Bonus from plan_assignment: {granted}")
    else:
        logger.info(f"   Step 4: No plan_assignments (no bonus credits)")
    
    # Calculate total: base + bonuses
    strategy_calls_total = base_credits + bonus_from_assignments
    
    # Get used count (single source of truth)
    strategy_calls_used = user.get("strategy_calls_used", 0) or 0
    
    # Calculate remaining
    strategy_calls_remaining = max(0, strategy_calls_total - strategy_calls_used)
    
    logger.info(f"")
    logger.info(f"📊 FINAL CALCULATION:")
    logger.info(f"   plan_baseline = {plan_baseline}")
    logger.info(f"   admin_value = {admin_value} (exists: {admin_value_exists})")
    logger.info(f"   base_credits = {base_credits} (ADMIN PRIORITY)")
    logger.info(f"   bonus_from_assignments = {bonus_from_assignments}")
    logger.info(f"   TOTAL = {base_credits} + {bonus_from_assignments} = {strategy_calls_total}")
    logger.info(f"   USED = {strategy_calls_used}")
    logger.info(f"   REMAINING = {strategy_calls_remaining}")
    logger.info(f"=" * 60)
    
    # Get addon price for purchasing more
    addon_plan = await db.plans.find_one({"plan_key": "addon_strategy_call"})
    addon_price = 1199  # Default fallback
    if addon_plan:
        pricing = addon_plan.get("pricing", {})
        if isinstance(pricing, dict):
            # New pricing structure
            addon_price = pricing.get("one_time") or pricing.get("one_month") or 1199
        else:
            # Old structure or direct price field
            addon_price = addon_plan.get("price", 1199)
    addon_price_with_gst = round(addon_price * 1.18)
    
    return {
        "strategy_calls_total": strategy_calls_total,
        "strategy_calls_used": strategy_calls_used,
        "strategy_calls_remaining": strategy_calls_remaining,
        "is_unlimited": strategy_calls_total >= 999,
        "addon_price": addon_price,
        "addon_price_with_gst": addon_price_with_gst,
        "addon_plan_key": "addon_strategy_call"
    }


@router.get("/mentors")
async def get_strategy_call_mentors(request: Request):
    """Get list of mentors who can take strategy calls"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Find mentors who can take strategy calls and are active
    mentors = await db.mentors.find({
        "can_take_strategy_calls": True,
        "is_active": {"$ne": False},
        "is_deleted": {"$ne": True},
        "is_hidden_from_strategy_calls": {"$ne": True}
    }).to_list(100)
    
    # Format mentor data for frontend
    mentor_list = []
    for mentor in mentors:
        sessions_conducted = mentor.get("sessions_conducted", 0)
        # Only show rating if mentor has conducted sessions
        rating = mentor.get("rating") if sessions_conducted > 0 else None
        
        mentor_list.append({
            "id": mentor.get("id"),
            "name": mentor.get("name"),
            "title": mentor.get("title") or mentor.get("consulting_position"),
            "company": mentor.get("company") or mentor.get("consulting_firm"),
            "company_logo": mentor.get("consulting_firm_logo") or mentor.get("current_company_logo"),
            "picture": mentor.get("picture"),
            "bio": mentor.get("bio", "")[:200] + "..." if len(mentor.get("bio", "")) > 200 else mentor.get("bio", ""),
            "expertise": mentor.get("expertise", [])[:3],
            "rating": rating,
            "sessions_conducted": sessions_conducted
        })
    
    return {
        "mentors": mentor_list,
        "count": len(mentor_list),
        "single_mentor": len(mentor_list) == 1
    }


@router.get("/mentors/{mentor_id}/availability")
async def get_mentor_strategy_availability(mentor_id: str, request: Request):
    """Get mentor's availability for strategy calls (30-min slots)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Verify mentor can take strategy calls
    mentor = await db.mentors.find_one({"id": mentor_id, "can_take_strategy_calls": True})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not available for strategy calls")
    
    # Get mentor's availability (reuse existing availability system)
    availability = mentor.get("availability", [])
    
    # Get strategy call duration from settings (default 30 min)
    settings = await db.settings.find_one({"key": "strategy_call_duration"})
    duration_minutes = settings.get("value", 30) if settings else 30
    
    # Get booked slots for this mentor (strategy calls + coaching)
    # to exclude from availability
    now = datetime.now(timezone.utc)
    booked_sessions = await db.coaching_sessions.find({
        "mentor_id": mentor_id,
        "status": {"$in": ["scheduled", "confirmed"]},
        "date": {"$gte": now.strftime("%Y-%m-%d")}
    }).to_list(500)
    
    booked_strategy = await db.strategy_call_sessions.find({
        "mentor_id": mentor_id,
        "status": {"$in": ["scheduled", "confirmed"]},
        "date": {"$gte": now.strftime("%Y-%m-%d")}
    }).to_list(500)
    
    # Combine booked slots
    booked_slots = {}
    for session in booked_sessions + booked_strategy:
        date_key = session.get("date")
        if date_key not in booked_slots:
            booked_slots[date_key] = []
        booked_slots[date_key].append(session.get("time"))
    
    return {
        "mentor_id": mentor_id,
        "mentor_name": mentor.get("name"),
        "availability": availability,
        "booked_slots": booked_slots,
        "duration_minutes": duration_minutes,
        "timezone": user.get("timezone", "Asia/Kolkata")
    }


# Email notification functions

# Common tz abbreviation map for user-facing display
_TZ_ABBR = {
    "Asia/Kolkata": "IST",
    "America/New_York": "ET",
    "America/Los_Angeles": "PT",
    "America/Chicago": "CT",
    "America/Denver": "MT",
    "America/Phoenix": "MST",
    "Europe/London": "GMT",
    "Europe/Paris": "CET",
    "Europe/Berlin": "CET",
    "Asia/Dubai": "GST",
    "Asia/Singapore": "SGT",
    "Asia/Tokyo": "JST",
    "Asia/Hong_Kong": "HKT",
    "Australia/Sydney": "AEDT",
    "UTC": "UTC",
}


def format_session_for_user_tz(session_date: str, session_time_ist: str, user_timezone: str):
    """Convert an IST date+time (strings "YYYY-MM-DD" and "HH:MM") into the
    viewer's local timezone. Returns a dict with both representations so email
    templates can show e.g. "18:30 EDT (9:00 AM IST)" where helpful.

    Always falls back to IST if conversion fails."""
    try:
        import pytz as _pytz
        tz_ist = _pytz.timezone("Asia/Kolkata")
        naive = datetime.strptime(f"{session_date} {session_time_ist}", "%Y-%m-%d %H:%M")
        aware_ist = tz_ist.localize(naive)
        target_tz_name = user_timezone or "Asia/Kolkata"
        try:
            tz_user = _pytz.timezone(target_tz_name)
        except Exception:
            tz_user = tz_ist
            target_tz_name = "Asia/Kolkata"
        aware_user = aware_ist.astimezone(tz_user)
        abbr = _TZ_ABBR.get(target_tz_name) or aware_user.tzname() or target_tz_name.split("/")[-1]
        ist_abbr = "IST"
        # Pretty-format date in user's timezone (may differ from IST date on edges)
        user_date_formatted = aware_user.strftime("%A, %B %d, %Y")
        user_time_formatted = aware_user.strftime("%H:%M")
        user_time_12h = aware_user.strftime("%I:%M %p").lstrip("0")
        ist_date_formatted = aware_ist.strftime("%A, %B %d, %Y")
        same_date = aware_user.strftime("%Y-%m-%d") == aware_ist.strftime("%Y-%m-%d")
        return {
            "user_tz": target_tz_name,
            "user_tz_abbr": abbr,
            "user_date": user_date_formatted,
            "user_time": user_time_formatted,
            "user_time_12h": user_time_12h,
            "ist_date": ist_date_formatted,
            "ist_time": session_time_ist,
            "ist_tz_abbr": ist_abbr,
            "same_date": same_date,
            "is_ist_viewer": target_tz_name == "Asia/Kolkata",
        }
    except Exception as e:
        logger.warning(f"Timezone conversion failed ({e}), falling back to IST")
        return {
            "user_tz": "Asia/Kolkata",
            "user_tz_abbr": "IST",
            "user_date": session_date,
            "user_time": session_time_ist,
            "user_time_12h": session_time_ist,
            "ist_date": session_date,
            "ist_time": session_time_ist,
            "ist_tz_abbr": "IST",
            "same_date": True,
            "is_ist_viewer": True,
        }


async def send_strategy_call_confirmation_email_user(user_email: str, user_name: str, mentor_name: str,
                                                      mentor_company: str, mentor_position: str,
                                                      session_date: str, session_time: str, duration_minutes: int,
                                                      user_timezone: str = "Asia/Kolkata"):
    """Send confirmation email to user after booking strategy call.

    `session_date`/`session_time` are in IST. We convert them to the
    recipient's `user_timezone` so the email reads in their local time."""

    tz = format_session_for_user_tz(session_date, session_time, user_timezone)
    formatted_date = tz["user_date"]
    display_time = f"{tz['user_time']} {tz['user_tz_abbr']}"
    ist_reference = ""
    if not tz["is_ist_viewer"]:
        ist_reference = f"<p style=\"color: #94a3b8; margin: 4px 0 0; font-size: 13px;\">({tz['ist_time']} {tz['ist_tz_abbr']}, {tz['ist_date']})</p>"

    dashboard_url = f"{FRONTEND_URL}/dashboard"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Strategy Call Confirmed!</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {user_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Your strategy call with <strong>{mentor_name}</strong> has been confirmed!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">📅 Session Details</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {formatted_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {display_time}</p>
                {ist_reference}
                <p style="color: #475569; margin: 8px 0;"><strong>Duration:</strong> {duration_minutes} minutes</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Mentor:</strong> {mentor_name}</p>
                <p style="color: #475569; margin: 8px 0;">{mentor_position}, {mentor_company}</p>
            </div>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                    <strong>📍 How to Join:</strong><br>
                    Go to your dashboard and click the "Join Call" button when it's time for your session.
                </p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">✏️ Prepare for Your Call</h3>
                <ul style="color: #475569; line-height: 1.8;">
                    <li>Review your case questions or challenges</li>
                    <li>Prepare specific areas you want to focus on</li>
                    <li>Have any materials ready that you'd like to discuss</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{dashboard_url}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 14px 32px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; font-size: 16px;
                          display: inline-block;">
                    View in Dashboard
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                A calendar invite has been sent separately. You'll receive a reminder before your session.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 14px;">
                    Looking forward to your session!<br>
                    <strong>gradnext Team</strong>
                </p>
            </div>
        </div>
    </div>
    """
    
    try:
        from services.email_service import send_email
        await send_email(
            to=user_email,
            subject=f"Strategy Call Confirmed - {formatted_date} at {display_time}",
            html_content=html_content,
            sender_name="Team gradnext"
        )
        logger.info(f"Sent strategy call confirmation to user: {user_email}")
    except Exception as e:
        logger.error(f"Failed to send user confirmation email: {e}")
        raise


async def send_strategy_call_confirmation_email_mentor(mentor_email: str, mentor_name: str, user_name: str,
                                                        user_email: str, session_date: str, session_time: str,
                                                        duration_minutes: int, notes: str,
                                                        mentor_timezone: str = "Asia/Kolkata"):
    """Send notification email to mentor about new strategy call booking.
    Time is shown in the mentor's local timezone."""

    tz = format_session_for_user_tz(session_date, session_time, mentor_timezone)
    formatted_date = tz["user_date"]
    display_time = f"{tz['user_time']} {tz['user_tz_abbr']}"
    ist_reference = ""
    if not tz["is_ist_viewer"]:
        ist_reference = f"<p style=\"color: #94a3b8; margin: 4px 0 0; font-size: 13px;\">({tz['ist_time']} {tz['ist_tz_abbr']}, {tz['ist_date']})</p>"

    dashboard_url = f"{FRONTEND_URL}/dashboard"
    
    html_content = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📞 New Strategy Call Booked</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                Hi {mentor_name},
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                You have a new strategy call session booked!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">📅 Session Details</h3>
                <p style="color: #475569; margin: 8px 0;"><strong>Date:</strong> {formatted_date}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Time:</strong> {display_time}</p>
                {ist_reference}
                <p style="color: #475569; margin: 8px 0;"><strong>Duration:</strong> {duration_minutes} minutes</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Student:</strong> {user_name}</p>
                <p style="color: #475569; margin: 8px 0;"><strong>Email:</strong> {user_email}</p>
            </div>
            
            {f'''<div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b; margin-top: 0;">📝 Student Notes</h3>
                <p style="color: #475569; line-height: 1.6;">{notes}</p>
            </div>''' if notes else ''}
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                    <strong>📍 How to Join:</strong><br>
                    Go to your dashboard and click the "Join Call" button when it's time for the session.
                </p>
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
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                A calendar invite has been sent separately. You'll receive a reminder before the session.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 14px;">
                    Thank you for being a mentor!<br>
                    <strong>gradnext Team</strong>
                </p>
            </div>
        </div>
    </div>
    """
    
    try:
        from services.email_service import send_email
        await send_email(
            to=mentor_email,
            subject=f"New Strategy Call - {formatted_date} at {display_time}",
            html_content=html_content,
            sender_name="Team gradnext"
        )
        logger.info(f"Sent strategy call notification to mentor: {mentor_email}")
    except Exception as e:
        logger.error(f"Failed to send mentor notification email: {e}")
        raise


@router.post("/book")
async def book_strategy_call(booking: StrategyCallBookingRequest, request: Request):
    """Book a strategy call with a mentor (supports auto-assignment for subscription/cohort users)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Track Mixpanel event - Strategy Call Booking Initiated
    try:
        from services.mixpanel_service import track_event
        track_event(
            distinct_id=user.get("id"),
            event_name="strategy_call_booking_initiated",
            properties={
                "date": booking.date,
                "time": booking.time,
                "auto_assign": booking.auto_assign,
                "mentor_id": booking.mentor_id if not booking.auto_assign else "auto",
                "user_plan": user.get("plan", "free_trial")
            }
        )
    except Exception as e:
        logger.error(f"Failed to track Mixpanel event: {e}")
    
    # Check credits using same ABSOLUTE ADMIN PRIORITY logic as /credits endpoint
    # Step 1: Get plan baseline
    plan_baseline = 0
    plan_key = user.get("plan")
    plan_category = None
    
    if plan_key:
        plan = await db.plans.find_one({"plan_key": plan_key})
        if plan:
            features = plan.get("features", {})
            plan_strategy_calls = features.get("strategy_calls", 0)
            plan_category = plan.get("category", "subscription")
            if plan_strategy_calls == -1:
                plan_baseline = 999
            else:
                plan_baseline = plan_strategy_calls or 0
    
    # Step 2: Check if admin has set a value
    admin_value_exists = "strategy_calls_total" in user
    admin_value = user.get("strategy_calls_total")
    
    # Step 3: Use admin's ABSOLUTE value if set, otherwise plan baseline
    if admin_value_exists and admin_value is not None:
        if admin_value == -1:
            base_credits = 999  # Unlimited
        else:
            base_credits = admin_value  # Admin's exact value (could be 0)
    else:
        base_credits = plan_baseline
    
    # Step 4: Add bonuses from plan_assignments
    bonus_from_assignments = 0
    plan_assignments = user.get("plan_assignments", [])
    for assignment in plan_assignments:
        if assignment.get("is_active", True):
            bonus_from_assignments += assignment.get("strategy_calls_granted", 0) or 0
    
    # Calculate total and remaining
    strategy_calls_total = base_credits + bonus_from_assignments
    strategy_calls_used = user.get("strategy_calls_used", 0) or 0
    strategy_calls_remaining = max(0, strategy_calls_total - strategy_calls_used)
    
    if strategy_calls_remaining <= 0:
        raise HTTPException(
            status_code=400, 
            detail="No strategy call credits remaining. Please purchase additional credits."
        )
    
    # AUTO-ASSIGNMENT LOGIC for subscription/cohort users
    assigned_mentor = None
    
    if booking.auto_assign:
        # Get unified availability for this slot. Use days=14 to match the
        # frontend's listing default so we hit the same get_mentor_busy_slots_batch
        # cache entry the user's browser populated.
        unified_avail_response = await get_unified_availability(request, days=14)
        slots = unified_avail_response.get("slots", {})
        
        date_slots = slots.get(booking.date, {})
        time_slot = date_slots.get(booking.time, {})
        available_mentor_ids = time_slot.get("mentor_ids", [])
        
        if not available_mentor_ids:
            raise HTTPException(
                status_code=400,
                detail="No mentors available at this time slot"
            )
        
        # Auto-assign best mentor
        assigned_mentor = await get_best_available_mentor(
            db, 
            available_mentor_ids, 
            booking.date, 
            booking.time
        )
        
        if not assigned_mentor:
            raise HTTPException(
                status_code=400,
                detail="Selected slot no longer available. Please try another time."
            )
        
        mentor_id = assigned_mentor.get("id")
        logger.info(f"Auto-assigned mentor {mentor_id} for user {user.get('id')}")
        
    else:
        # MANUAL SELECTION for coaching users (existing flow)
        if not booking.mentor_id:
            raise HTTPException(
                status_code=400,
                detail="mentor_id is required for manual booking"
            )
        
        # Verify mentor can take strategy calls
        assigned_mentor = await db.mentors.find_one({
            "id": booking.mentor_id, 
            "can_take_strategy_calls": True
        })
        
        if not assigned_mentor:
            raise HTTPException(status_code=404, detail="Mentor not available for strategy calls")
        
        mentor_id = booking.mentor_id
        logger.info(f"Manual booking with mentor {mentor_id} for user {user.get('id')}")
    
    # Get strategy call duration
    settings = await db.settings.find_one({"key": "strategy_call_duration"})
    duration_minutes = settings.get("value", 30) if settings else 30
    
    # Final check if slot is available (race condition protection)
    existing = await db.strategy_call_sessions.find_one({
        "mentor_id": mentor_id,
        "date": booking.date,
        "time": booking.time,
        "status": {"$in": ["scheduled", "confirmed"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="This slot is already booked")
    
    # Check coaching bookings collection for conflicts
    coaching_conflict = await db.bookings.find_one({
        "mentor_id": mentor_id,
        "date": booking.date,
        "time_slot": booking.time,
        "status": {"$in": ["confirmed", "pending"]}
    })
    
    if coaching_conflict:
        raise HTTPException(status_code=400, detail="This slot is already booked for coaching")
    
    # Google Calendar conflict check.
    # In auto-assign mode this was already verified inside get_unified_availability
    # (above) so we skip it to avoid spurious "Coach's calendar is blocked" errors
    # caused by the second fetch using a different cache-key range / fresh fetch
    # diverging from the response the user actually saw.
    # In manual mode we still verify, but reuse the same cache window the listing
    # endpoint uses so the booking sees the *exact* data the user picked from.
    if not booking.auto_assign and assigned_mentor.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch
            import pytz as _pytz
            ist_tz = _pytz.timezone('Asia/Kolkata')
            today_ist = datetime.now(_pytz.UTC).astimezone(ist_tz).date()
            window_start = today_ist.strftime("%Y-%m-%d")
            window_end = (today_ist + timedelta(days=14)).strftime("%Y-%m-%d")

            busy_slots_by_date = await get_mentor_busy_slots_batch(
                db, mentor_id, window_start, window_end
            )
            busy_times = busy_slots_by_date.get(booking.date, [])

            if booking.time in busy_times:
                logger.warning(f"Google Calendar conflict (manual) for mentor {mentor_id} at {booking.date} {booking.time}")
                raise HTTPException(
                    status_code=400,
                    detail="This time is blocked on the coach's calendar. Please select a different time."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Google Calendar check failed for {mentor_id}: {e}")
            # Best-effort: don't block booking on calendar API failure
    
    now = datetime.now(timezone.utc)
    
    # Generate Google Meet link (hidden from calendar invite)
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    session_datetime_str = f"{booking.date} {booking.time}"
    session_datetime_ist = ist.localize(datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M"))
    
    meet_link = ""
    calendar_event_id = ""
    meet_space_name = None
    try:
        event_result = create_strategy_call_event(
            user_name=user.get("name"),
            user_email=user.get("email"),
            mentor_name=assigned_mentor.get("name"),
            mentor_email=assigned_mentor.get("email"),
            start_datetime_ist=session_datetime_ist,
            duration_minutes=duration_minutes,
            notes=booking.notes
        )
        meet_link = event_result.get("meet_link", "")
        calendar_event_id = event_result.get("event_id", "")
        meet_space_name = event_result.get("meet_space_name")
        logger.info(f"Created calendar event and meet link for strategy call: {calendar_event_id}")
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")
        # Continue with booking even if calendar creation fails
    
    # Create strategy call session
    session_id = f"strategy-{uuid.uuid4().hex[:12]}"
    session = {
        "id": session_id,
        "type": "strategy_call",
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "mentor_id": mentor_id,
        "mentor_name": assigned_mentor.get("name"),
        "mentor_email": assigned_mentor.get("email"),
        "date": booking.date,
        "time": booking.time,
        "duration_minutes": duration_minutes,
        "status": "scheduled",
        "notes": booking.notes,
        "meet_link": meet_link,
        "meet_space_name": meet_space_name,
        "calendar_event_id": calendar_event_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.strategy_call_sessions.insert_one(session)
    
    # Deduct credit
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$inc": {"strategy_calls_used": 1},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    logger.info(f"Strategy call booked: {session_id} for user {user.get('id')} with mentor {mentor_id}")
    
    # Track Mixpanel event - Strategy Call Booked
    try:
        from services.mixpanel_service import track_event
        track_event(
            distinct_id=user.get("id"),
            event_name="strategy_call_booked",
            properties={
                "session_id": session_id,
                "mentor_id": mentor_id,
                "mentor_name": assigned_mentor.get("name"),
                "date": booking.date,
                "time": booking.time,
                "auto_assigned": booking.auto_assign,
                "duration_minutes": duration_minutes,
                "user_plan": user.get("plan", "free_trial"),
                "credits_remaining": strategy_calls_remaining - 1
            }
        )
    except Exception as e:
        logger.error(f"Failed to track Mixpanel event: {e}")
    
    # Send confirmation emails to both user and mentor
    try:
        # Email to user — in the user's saved timezone
        await send_strategy_call_confirmation_email_user(
            user_email=user.get("email"),
            user_name=user.get("name"),
            mentor_name=assigned_mentor.get("name"),
            mentor_company=assigned_mentor.get("company") or assigned_mentor.get("consulting_firm"),
            mentor_position=assigned_mentor.get("title") or assigned_mentor.get("position"),
            session_date=booking.date,
            session_time=booking.time,
            duration_minutes=duration_minutes,
            user_timezone=user.get("timezone") or "Asia/Kolkata",
        )

        # Email to mentor — in the mentor's saved timezone
        await send_strategy_call_confirmation_email_mentor(
            mentor_email=assigned_mentor.get("email"),
            mentor_name=assigned_mentor.get("name"),
            user_name=user.get("name"),
            user_email=user.get("email"),
            session_date=booking.date,
            session_time=booking.time,
            duration_minutes=duration_minutes,
            notes=booking.notes,
            mentor_timezone=assigned_mentor.get("timezone") or "Asia/Kolkata",
        )
        
        logger.info(f"Confirmation emails sent for strategy call: {session_id}")
    except Exception as e:
        logger.error(f"Failed to send confirmation emails: {e}")
        # Continue even if email fails
    
    
    # Return mentor details for confirmation (don't return full session to avoid ObjectId serialization issue)
    return {
        "success": True,
        "session_id": session_id,
        "message": f"Strategy call booked with {assigned_mentor.get('name')} on {booking.date} at {booking.time}",
        "booking_details": {
            "date": booking.date,
            "time": booking.time,
            "duration_minutes": duration_minutes,
            "status": "scheduled",
            "notes": booking.notes
        },
        "mentor": {
            "id": assigned_mentor.get("id"),
            "name": assigned_mentor.get("name"),
            "picture": assigned_mentor.get("picture"),
            "company": assigned_mentor.get("company"),
            "consulting_firm": assigned_mentor.get("consulting_firm"),
            "position": assigned_mentor.get("position"),
            "title": assigned_mentor.get("title"),
            "consulting_position": assigned_mentor.get("consulting_position"),
            "bio": assigned_mentor.get("bio"),
            "rating": assigned_mentor.get("rating") if assigned_mentor.get("sessions_conducted", 0) > 0 else None,
            "consulting_firm_logo": assigned_mentor.get("consulting_firm_logo"),
            "company_logo": assigned_mentor.get("company_logo"),
            "past_companies": assigned_mentor.get("past_companies", []),
            "experience_years": assigned_mentor.get("experience_years")
        },
        "auto_assigned": booking.auto_assign
    }


@router.get("/my-sessions")
async def get_my_strategy_sessions(request: Request):
    """Get all strategy call sessions for the current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get all sessions for this user (upcoming and past)
    sessions = await db.strategy_call_sessions.find(
        {"user_id": user.get("id")},
        {"_id": 0}
    ).sort("date", -1).to_list(100)  # Sort by date, most recent first
    
    # Enrich with mentor details
    for session in sessions:
        mentor = await db.mentors.find_one(
            {"id": session.get("mentor_id")},
            {"_id": 0, "name": 1, "picture": 1, "company": 1, "consulting_firm": 1, "title": 1, "position": 1}
        )
        if mentor:
            session["mentor_name"] = mentor.get("name")
            session["mentor_picture"] = mentor.get("picture")
            session["mentor_company"] = mentor.get("company") or mentor.get("consulting_firm")
            session["mentor_title"] = mentor.get("title") or mentor.get("position")
    
    return {
        "success": True,
        "sessions": sessions
    }


class CancelStrategyCallRequest(BaseModel):
    reason: Optional[str] = None


class RescheduleStrategyCallRequest(BaseModel):
    new_date: str
    new_time: str
    reason: Optional[str] = None


@router.post("/{session_id}/cancel")
async def cancel_strategy_call(session_id: str, request: Request, body: CancelStrategyCallRequest = None):
    """Cancel a strategy call session using the same policy as coaching sessions"""
    import pytz
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Find the session
    session = await db.strategy_call_sessions.find_one(
        {"id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Strategy call session not found")
    
    # Determine if user is the candidate, mentor, or admin
    is_candidate = session.get("user_id") == user.get("id")
    is_mentor = session.get("mentor_id") == user.get("mentor_id") if user.get("is_mentor") else False
    is_admin = user.get("is_admin", False)
    
    # Verify authorization
    if not is_candidate and not is_mentor and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this session")
    
    # Check if session is already cancelled or completed
    if session.get("status") in ["cancelled", "completed"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {session.get('status')} session")
    
    # Get cancellation policy from admin settings
    policy = await db.platform_settings.find_one({"type": "cancellation_policy"})
    candidate_hours = 4  # Default
    mentor_hours = 4  # Default
    if policy:
        candidate_hours = policy.get('candidate_hours', 4)
        mentor_hours = policy.get('mentor_hours', 4)
    
    # Determine which policy applies
    if is_mentor:
        policy_hours = mentor_hours
        role = "Mentors"
    else:
        policy_hours = candidate_hours
        role = "Candidates"
    
    # Check cancellation policy timing
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    session_datetime_str = f"{session.get('date')} {session.get('time')}"
    session_datetime = ist.localize(datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M"))
    
    hours_until_session = (session_datetime - now_ist).total_seconds() / 3600
    
    # Admin can cancel anytime, but candidates/mentors must follow policy
    if not is_admin and hours_until_session < policy_hours:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel. {role} must cancel at least {policy_hours} hours before the session. You have {hours_until_session:.1f} hours remaining."
        )
    
    # Refund credit if within policy window (always refund if cancelled within policy)
    refund_credit = True
    
    # Update session status
    cancel_reason = body.reason if body else None
    cancelled_by_role = "admin" if is_admin else ("mentor" if is_mentor else "candidate")
    await db.strategy_call_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user.get("id"),
            "cancelled_by_name": user.get("name"),
            "cancelled_by_role": cancelled_by_role,
            "cancellation_reason": cancel_reason,
            "credit_refunded": refund_credit
        }}
    )
    
    # Refund credit if within policy
    if refund_credit:
        await db.users.update_one(
            {"id": session.get("user_id")},
            {"$inc": {"strategy_call_credits": 1}}
        )
    
    # Get mentor details for email
    mentor = await db.mentors.find_one({"id": session.get("mentor_id")}, {"_id": 0})
    mentor_name = mentor.get("name", "Your mentor") if mentor else "Your mentor"
    mentor_email = mentor.get("email") if mentor else None
    
    # Send cancellation emails
    user_data = await db.users.find_one({"id": session.get("user_id")}, {"_id": 0})
    user_email = user_data.get("email") if user_data else session.get("user_email")
    user_name = user_data.get("name") if user_data else session.get("user_name")
    
    # Format date for email — per recipient's local timezone
    user_tz_name = (user_data.get("timezone") if user_data else None) or "Asia/Kolkata"
    mentor_tz_name = (mentor.get("timezone") if mentor else None) or "Asia/Kolkata"
    user_tz_info = format_session_for_user_tz(session.get("date"), session.get("time"), user_tz_name)
    mentor_tz_info = format_session_for_user_tz(session.get("date"), session.get("time"), mentor_tz_name)

    # Email to user
    if user_email:
        user_subject = "Strategy Call Cancelled - gradnext"
        user_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2E3558;">Strategy Call Cancelled</h2>
            <p>Hi {user_name},</p>
            <p>Your strategy call has been cancelled{' by ' + user.get('name') if cancelled_by_role != 'candidate' else ''}.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Session Details:</strong></p>
                <p>📅 Date: {user_tz_info['user_date']}</p>
                <p>🕐 Time: {user_tz_info['user_time']} {user_tz_info['user_tz_abbr']}{' (' + session.get('time') + ' IST)' if not user_tz_info['is_ist_viewer'] else ''}</p>
                <p>👤 Mentor: {mentor_name}</p>
            </div>
            
            <p style='color: #28a745;'>✅ <strong>Good news!</strong> Your strategy call credit has been refunded.</p>
            
            <p>You can book another strategy call anytime from your dashboard.</p>
            
            <p>Best regards,<br>The gradnext Team</p>
        </div>
        """
        try:
            await send_email_via_gmail(db, user_email, user_subject, user_body)
        except Exception as e:
            logger.error(f"Failed to send cancellation email to user: {e}")
    
    # Email to mentor
    if mentor_email:
        mentor_subject = "Strategy Call Cancelled - gradnext"
        mentor_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2E3558;">Strategy Call Cancelled</h2>
            <p>Hi {mentor_name},</p>
            <p>A strategy call with you has been cancelled{' by ' + user.get('name') if cancelled_by_role == 'candidate' else (' by admin' if cancelled_by_role == 'admin' else '')}.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Session Details:</strong></p>
                <p>📅 Date: {mentor_tz_info['user_date']}</p>
                <p>🕐 Time: {mentor_tz_info['user_time']} {mentor_tz_info['user_tz_abbr']}{' (' + session.get('time') + ' IST)' if not mentor_tz_info['is_ist_viewer'] else ''}</p>
                <p>👤 Candidate: {user_name}</p>
                {f"<p>📝 Reason: {cancel_reason}</p>" if cancel_reason else ""}
            </div>
            
            <p>This time slot is now available for other bookings.</p>
            
            <p>Best regards,<br>The gradnext Team</p>
        </div>
        """
        try:
            await send_email_via_gmail(db, mentor_email, mentor_subject, mentor_body)
        except Exception as e:
            logger.error(f"Failed to send cancellation email to mentor: {e}")
    
    # Delete Google Calendar event if exists
    calendar_event_id = session.get("calendar_event_id")
    if calendar_event_id:
        try:
            calendar_service = get_calendar_service()
            if calendar_service.is_available():
                calendar_service.cancel_event(calendar_event_id, notify_attendees=True)
                logger.info(f"Cancelled calendar event {calendar_event_id} for cancelled strategy call")
        except Exception as e:
            logger.error(f"Failed to cancel calendar event: {e}")
    
    return {
        "success": True,
        "message": "Strategy call cancelled successfully",
        "credit_refunded": refund_credit,
        "refund_message": "Credit refunded" if refund_credit else "No refund (cancelled less than 24 hours before session)"
    }


@router.post("/{session_id}/reschedule")
async def reschedule_strategy_call(session_id: str, request: Request, body: RescheduleStrategyCallRequest):
    """Reschedule a strategy call to a new date/time"""
    import pytz
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Find the session
    session = await db.strategy_call_sessions.find_one(
        {"id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Strategy call session not found")
    
    # Determine if user is the candidate, mentor, or admin
    is_candidate = session.get("user_id") == user.get("id")
    is_mentor = session.get("mentor_id") == user.get("mentor_id") if user.get("is_mentor") else False
    is_admin = user.get("is_admin", False)
    
    # Verify authorization
    if not is_candidate and not is_mentor and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this session")
    
    # Check if session can be rescheduled
    if session.get("status") in ["cancelled", "completed"]:
        raise HTTPException(status_code=400, detail=f"Cannot reschedule a {session.get('status')} session")
    
    # Get reschedule policy from admin settings (same as cancellation policy)
    policy = await db.platform_settings.find_one({"type": "cancellation_policy"})
    candidate_hours = 4  # Default
    mentor_hours = 4  # Default
    if policy:
        candidate_hours = policy.get('candidate_hours', 4)
        mentor_hours = policy.get('mentor_hours', 4)
    
    # Determine which policy applies
    if is_mentor:
        policy_hours = mentor_hours
        role = "Mentors"
    else:
        policy_hours = candidate_hours
        role = "Candidates"
    
    # Check reschedule policy timing
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    session_datetime_str = f"{session.get('date')} {session.get('time')}"
    session_datetime = ist.localize(datetime.strptime(session_datetime_str, "%Y-%m-%d %H:%M"))
    
    hours_until_session = (session_datetime - now_ist).total_seconds() / 3600
    
    # Admin can reschedule anytime, but candidates/mentors must follow policy
    if not is_admin and hours_until_session < policy_hours:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reschedule. {role} must reschedule at least {policy_hours} hours before the session. You have {hours_until_session:.1f} hours remaining."
        )
    
    # Validate new date/time
    new_datetime_str = f"{body.new_date} {body.new_time}"
    try:
        new_datetime = ist.localize(datetime.strptime(new_datetime_str, "%Y-%m-%d %H:%M"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date/time format")
    
    if new_datetime <= now_ist:
        raise HTTPException(status_code=400, detail="New date/time must be in the future")
    
    # Check if the new slot is available for the same mentor
    mentor_id = session.get("mentor_id")
    existing_booking = await db.strategy_call_sessions.find_one({
        "mentor_id": mentor_id,
        "date": body.new_date,
        "time": body.new_time,
        "status": {"$in": ["scheduled", "confirmed"]},
        "id": {"$ne": session_id}  # Exclude current session
    })
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="This time slot is no longer available")
    
    # Also check coaching sessions for conflict
    coaching_conflict = await db.bookings.find_one({
        "mentor_id": mentor_id,
        "date": body.new_date,
        "time_slot": body.new_time,
        "status": {"$in": ["pending", "confirmed"]}
    })
    
    if coaching_conflict:
        raise HTTPException(status_code=400, detail="Mentor has a coaching session at this time")
    
    # Check Google Calendar for conflicts using the SAME cache-key window as the
    # /available-slots listing endpoint (start_date=today, end_date=today+14)
    # so we hit the same cached entry and never disagree with what the user just saw.
    mentor_data = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if mentor_data and mentor_data.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch
            import pytz as _pytz
            ist_tz = _pytz.timezone('Asia/Kolkata')
            today_ist = datetime.now(_pytz.UTC).astimezone(ist_tz).date()
            window_start = today_ist.strftime("%Y-%m-%d")
            window_end = (today_ist + timedelta(days=14)).strftime("%Y-%m-%d")

            busy_slots_by_date = await get_mentor_busy_slots_batch(
                db, mentor_id, window_start, window_end
            )
            busy_times = busy_slots_by_date.get(body.new_date, [])
            if body.new_time in busy_times:
                raise HTTPException(status_code=400, detail="This time is blocked on the coach's calendar. Please select a different time.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Google Calendar check failed during reschedule for {mentor_id}: {e}")
    
    # Store previous details
    previous_date = session.get("date")
    previous_time = session.get("time")
    
    # Update session with new date/time
    await db.strategy_call_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "date": body.new_date,
            "time": body.new_time,
            "status": "scheduled",
            "rescheduled_at": datetime.now(timezone.utc).isoformat(),
            "rescheduled_by": user.get("id"),
            "rescheduled_by_name": user.get("name"),
            "reschedule_reason": body.reason,
            "previous_date": previous_date,
            "previous_time": previous_time,
            "was_rescheduled": True
        }}
    )
    
    # Get mentor details
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    mentor_name = mentor.get("name", "Your mentor") if mentor else "Your mentor"
    mentor_email = mentor.get("email") if mentor else None
    
    # Get user details
    user_data = await db.users.find_one({"id": session.get("user_id")}, {"_id": 0})
    user_email = user_data.get("email") if user_data else session.get("user_email")
    user_name = user_data.get("name") if user_data else session.get("user_name")
    
    # Format dates for email — per recipient's local timezone
    user_tz_name = (user_data.get("timezone") if user_data else None) or "Asia/Kolkata"
    mentor_tz_name = (mentor.get("timezone") if mentor else None) or "Asia/Kolkata"

    user_old_tz = format_session_for_user_tz(previous_date, previous_time, user_tz_name)
    user_new_tz = format_session_for_user_tz(body.new_date, body.new_time, user_tz_name)
    mentor_old_tz = format_session_for_user_tz(previous_date, previous_time, mentor_tz_name)
    mentor_new_tz = format_session_for_user_tz(body.new_date, body.new_time, mentor_tz_name)

    # Email to user
    if user_email:
        user_subject = "Strategy Call Rescheduled - gradnext"
        old_line = f"{user_old_tz['user_date']} at {user_old_tz['user_time']} {user_old_tz['user_tz_abbr']}"
        new_line = f"{user_new_tz['user_date']} at {user_new_tz['user_time']} {user_new_tz['user_tz_abbr']}"
        ist_hint_old = "" if user_old_tz['is_ist_viewer'] else f" ({previous_time} IST)"
        ist_hint_new = "" if user_new_tz['is_ist_viewer'] else f" ({body.new_time} IST)"
        user_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2E3558;">Strategy Call Rescheduled</h2>
            <p>Hi {user_name},</p>
            <p>Your strategy call has been rescheduled.</p>
            
            <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Previous Time:</strong></p>
                <p style="margin: 5px 0; text-decoration: line-through;">📅 {old_line}{ist_hint_old}</p>
            </div>
            
            <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Time:</strong></p>
                <p style="margin: 5px 0;">📅 {new_line}{ist_hint_new}</p>
                <p style="margin: 5px 0;">👤 Mentor: {mentor_name}</p>
            </div>
            
            <p>Please make sure to join at the new scheduled time. You'll receive the meeting link in your dashboard.</p>
            
            <p>Best regards,<br>The gradnext Team</p>
        </div>
        """
        try:
            await send_email_via_gmail(db, user_email, user_subject, user_body)
        except Exception as e:
            logger.error(f"Failed to send reschedule email to user: {e}")
    
    # Email to mentor
    if mentor_email:
        mentor_subject = "Strategy Call Rescheduled - gradnext"
        old_line = f"{mentor_old_tz['user_date']} at {mentor_old_tz['user_time']} {mentor_old_tz['user_tz_abbr']}"
        new_line = f"{mentor_new_tz['user_date']} at {mentor_new_tz['user_time']} {mentor_new_tz['user_tz_abbr']}"
        ist_hint_old = "" if mentor_old_tz['is_ist_viewer'] else f" ({previous_time} IST)"
        ist_hint_new = "" if mentor_new_tz['is_ist_viewer'] else f" ({body.new_time} IST)"
        mentor_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2E3558;">Strategy Call Rescheduled</h2>
            <p>Hi {mentor_name},</p>
            <p>A strategy call has been rescheduled.</p>
            
            <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Previous Time:</strong></p>
                <p style="margin: 5px 0; text-decoration: line-through;">📅 {old_line}{ist_hint_old}</p>
            </div>
            
            <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Time:</strong></p>
                <p style="margin: 5px 0;">📅 {new_line}{ist_hint_new}</p>
                <p style="margin: 5px 0;">👤 Candidate: {user_name}</p>
                {f"<p style='margin: 5px 0;'>📝 Reason: {body.reason}</p>" if body.reason else ""}
            </div>
            
            <p>Best regards,<br>The gradnext Team</p>
        </div>
        """
        try:
            await send_email_via_gmail(db, mentor_email, mentor_subject, mentor_body)
        except Exception as e:
            logger.error(f"Failed to send reschedule email to mentor: {e}")
    
    # Update Google Calendar event with new time
    calendar_event_id = session.get("calendar_event_id")
    if calendar_event_id:
        try:
            calendar_service = get_calendar_service()
            if calendar_service.is_available():
                # Parse new datetime
                new_start = ist.localize(datetime.strptime(f"{body.new_date} {body.new_time}", "%Y-%m-%d %H:%M"))
                duration = session.get("duration_minutes", 30)
                new_end = new_start + timedelta(minutes=duration)
                
                # Update the calendar event
                calendar_service.update_event(
                    calendar_event_id,
                    {
                        "start": new_start.isoformat(),
                        "end": new_end.isoformat(),
                        "description": f"""Strategy Call Session (RESCHEDULED)

Student: {user_name}
Mentor: {mentor_name}

Duration: {duration} minutes

Originally scheduled: {previous_date} at {previous_time} IST
New time: {body.new_date} at {body.new_time} IST

To join: Go to your gradnext dashboard and click the "Join Call" button at session time.
"""
                    }
                )
                logger.info(f"Updated calendar event {calendar_event_id} for rescheduled strategy call")
        except Exception as e:
            logger.error(f"Failed to update calendar event: {e}")
    
    return {
        "success": True,
        "message": "Strategy call rescheduled successfully",
        "new_date": body.new_date,
        "new_time": body.new_time,
        "previous_date": previous_date,
        "previous_time": previous_time
    }


@router.get("/{session_id}/available-slots")
async def get_available_reschedule_slots(session_id: str, request: Request, days: int = 14):
    """Get available slots for rescheduling a strategy call (same mentor only)"""
    import pytz
    
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Find the session
    session = await db.strategy_call_sessions.find_one(
        {"id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Strategy call session not found")
    
    # Verify ownership
    if session.get("user_id") != user.get("id") and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    mentor_id = session.get("mentor_id")
    
    # Get mentor's weekly availability
    weekly_templates = await db.mentor_weekly_availability.find({
        "mentor_id": mentor_id
    }).to_list(100)
    
    mentor_weekly = {}
    for template in weekly_templates:
        day = template.get("day")
        mentor_weekly[day] = template.get("slots", [])
    
    # Get existing bookings for this mentor
    existing_strategy = await db.strategy_call_sessions.find({
        "mentor_id": mentor_id,
        "status": {"$in": ["scheduled", "confirmed"]},
        "id": {"$ne": session_id}
    }).to_list(500)
    
    existing_coaching = await db.bookings.find({
        "mentor_id": mentor_id,
        "status": {"$in": ["pending", "confirmed"]}
    }).to_list(500)
    
    booked_slots = set()
    for b in existing_strategy:
        booked_slots.add(f"{b.get('date')}_{b.get('time')}")
    for b in existing_coaching:
        booked_slots.add(f"{b.get('date')}_{b.get('time_slot')}")
    
    # Set up timezone and date references (needed for Google Calendar check and slot generation)
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    today = now_ist.date()
    
    # Check Google Calendar conflicts for this mentor
    gcal_busy_slots = set()
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if mentor and mentor.get("google_calendar_connected"):
        try:
            from routes.mentor_calendar import get_mentor_busy_slots_batch
            start_date = today.strftime("%Y-%m-%d")
            end_date = (today + timedelta(days=days)).strftime("%Y-%m-%d")
            busy_slots_by_date = await get_mentor_busy_slots_batch(db, mentor_id, start_date, end_date)
            for date_str, time_slots in busy_slots_by_date.items():
                for time_slot in time_slots:
                    gcal_busy_slots.add(f"{date_str}_{time_slot}")
        except Exception as e:
            logger.warning(f"Google Calendar check failed for reschedule slots (mentor {mentor_id}): {e}")
    
    # Generate available slots
    
    day_mapping = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }
    
    def generate_slots_from_range(from_time: str, to_time: str):
        slots = []
        try:
            from_dt = datetime.strptime(from_time, "%H:%M")
            to_dt = datetime.strptime(to_time, "%H:%M")
            current = from_dt
            while current < to_dt:
                slots.append(current.strftime("%H:%M"))
                current += timedelta(minutes=30)
        except:
            pass
        return slots
    
    available_slots = {}
    
    for i in range(days):
        check_date = today + timedelta(days=i)
        weekday = check_date.weekday()
        day_name = list(day_mapping.keys())[list(day_mapping.values()).index(weekday)]
        date_str = check_date.strftime("%Y-%m-%d")
        
        day_time_ranges = mentor_weekly.get(day_name, [])
        if not day_time_ranges:
            continue
        
        for time_range in day_time_ranges:
            from_time = time_range.get("from", "")
            to_time = time_range.get("to", "")
            if not from_time or not to_time:
                continue
            
            time_slots = generate_slots_from_range(from_time, to_time)
            
            for time_str in time_slots:
                slot_key = f"{date_str}_{time_str}"
                
                if slot_key in booked_slots:
                    continue
                
                # Skip if Google Calendar shows busy
                if slot_key in gcal_busy_slots:
                    continue
                
                # Check if slot is in the future (at least 12 hours)
                slot_datetime_str = f"{date_str} {time_str}"
                try:
                    slot_datetime = ist.localize(datetime.strptime(slot_datetime_str, "%Y-%m-%d %H:%M"))
                    hours_until = (slot_datetime - now_ist).total_seconds() / 3600
                    if hours_until < 12:
                        continue
                except:
                    continue
                
                if date_str not in available_slots:
                    available_slots[date_str] = []
                
                available_slots[date_str].append(time_str)
    
    # Sort times within each date
    for date in available_slots:
        available_slots[date].sort()
    
    return {
        "success": True,
        "mentor_id": mentor_id,
        "slots": available_slots
    }


@router.get("/unified-availability")
async def get_unified_availability(request: Request, days: int = 14):
    """
    Get aggregated availability from ALL strategy call mentors (for subscription/cohort users)
    Returns slots without showing which specific mentors are available
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    print("\n" + "="*80)
    print("=== UNIFIED AVAILABILITY REQUEST ===")
    print(f"User: {user.get('email')} ({user.get('id')})")
    print(f"Plan: {user.get('plan')}")
    print(f"Days requested: {days}")
    print("="*80)
    
    # Get all mentors eligible for strategy calls
    mentors = await db.mentors.find({
        "can_take_strategy_calls": True,
        "is_active": {"$ne": False},
        "is_deleted": {"$ne": True},
        "is_hidden_from_strategy_calls": {"$ne": True}
    }).to_list(100)
    
    mentor_ids = [m.get("id") for m in mentors]
    print(f"\nMentors found: {len(mentors)}")
    for m in mentors:
        print(f"  - {m.get('name')} (id: {m.get('id')})")
    
    if not mentors:
        print("⚠️  No mentors found!")
        return {"slots": {}, "mentor_count": 0}
    
    # Fetch weekly availability templates for all strategy call mentors
    weekly_templates = await db.mentor_weekly_availability.find({
        "mentor_id": {"$in": mentor_ids}
    }).to_list(500)
    
    # Group templates by mentor_id and day
    mentor_weekly = {}
    for template in weekly_templates:
        mid = template.get("mentor_id")
        day = template.get("day")
        if mid not in mentor_weekly:
            mentor_weekly[mid] = {}
        mentor_weekly[mid][day] = template.get("slots", [])
    
    print(f"\nWeekly availability templates loaded:")
    for mid, days_data in mentor_weekly.items():
        total_slots = sum(len(slots) for slots in days_data.values())
        print(f"  - {mid}: {len(days_data)} days configured, {total_slots} time ranges")
    
    from datetime import timedelta
    import pytz
    
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    today = now_ist.date()
    
    print(f"\nCurrent IST: {now_ist.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Today: {today} ({today.strftime('%A')})")
    
    # Helper function to generate time slots from a time range
    def generate_slots_from_range(from_time: str, to_time: str, interval_minutes: int = 30):
        """Generate 30-minute slots from a time range like '09:00' to '17:00'"""
        slots = []
        try:
            from_dt = datetime.strptime(from_time, "%H:%M")
            to_dt = datetime.strptime(to_time, "%H:%M")
            current = from_dt
            while current < to_dt:
                slots.append(current.strftime("%H:%M"))
                current += timedelta(minutes=interval_minutes)
        except Exception as e:
            print(f"Error generating slots from {from_time}-{to_time}: {e}")
        return slots
    
    # Day name to weekday number mapping
    day_mapping = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }
    
    # Aggregate slots from all mentors
    aggregated_slots = {}
    
    for mentor in mentors:
        mentor_id = mentor.get("id")
        mentor_availability = mentor_weekly.get(mentor_id, {})
        
        if not mentor_availability:
            print(f"  ⚠️ No weekly template for {mentor.get('name')}")
            continue
        
        # Get mentor's blocked days
        blocked_days = mentor.get("blocked_days", [])
        
        # Get existing bookings for this mentor (strategy calls + coaching)
        existing_strategy_bookings = await db.strategy_call_sessions.find({
            "mentor_id": mentor_id,
            "status": {"$in": ["scheduled", "confirmed"]}
        }).to_list(500)
        
        existing_coaching_bookings = await db.coaching_sessions.find({
            "mentor_id": mentor_id,
            "status": {"$in": ["scheduled", "confirmed"]}
        }).to_list(500)
        
        # Also check bookings collection (used by coaching)
        existing_bookings = await db.bookings.find({
            "mentor_id": mentor_id,
            "status": {"$in": ["confirmed", "pending"]}
        }).to_list(500)
        
        booked_slots = set()
        for booking in existing_strategy_bookings + existing_coaching_bookings:
            slot_key = f"{booking.get('date')}_{booking.get('time')}"
            booked_slots.add(slot_key)
        for booking in existing_bookings:
            slot_key = f"{booking.get('date')}_{booking.get('time_slot', booking.get('time', ''))}"
            booked_slots.add(slot_key)
        
        # Check Google Calendar conflicts if mentor has calendar connected
        gcal_busy_slots = set()
        if mentor.get("google_calendar_connected"):
            try:
                # Use the same function that works for regular mentor availability
                from routes.mentor_calendar import get_mentor_busy_slots_batch
                
                start_date = today.strftime("%Y-%m-%d")
                end_date = (today + timedelta(days=days)).strftime("%Y-%m-%d")
                
                # This function uses the mentor's own calendar credentials
                busy_slots_by_date = await get_mentor_busy_slots_batch(db, mentor_id, start_date, end_date)
                
                # Convert busy_slots_by_date dict to the gcal_busy_slots format
                for date_str, time_slots in busy_slots_by_date.items():
                    for time_slot in time_slots:
                        gcal_busy_slots.add(f"{date_str}_{time_slot}")
                
                if gcal_busy_slots:
                    print(f"  📅 {mentor.get('name')}: Found {len(gcal_busy_slots)} Google Calendar busy slots")
            except Exception as e:
                import traceback
                print(f"  ⚠️ Google Calendar check failed for {mentor.get('name')}: {e}")
                print(f"     Traceback: {traceback.format_exc()}")
        
        # Process each day in the next X days
        for i in range(days):
            check_date = today + timedelta(days=i)
            weekday = check_date.weekday()
            day_name = list(day_mapping.keys())[list(day_mapping.values()).index(weekday)]
            date_str = check_date.strftime("%Y-%m-%d")
            
            # Skip blocked days
            if date_str in blocked_days:
                continue
            
            # Get time ranges for this day of week
            day_time_ranges = mentor_availability.get(day_name, [])
            if not day_time_ranges:
                continue
            
            # Generate slots from time ranges
            for time_range in day_time_ranges:
                from_time = time_range.get("from", "")
                to_time = time_range.get("to", "")
                if not from_time or not to_time:
                    continue
                
                time_slots = generate_slots_from_range(from_time, to_time)
                
                for time_str in time_slots:
                    slot_key = f"{date_str}_{time_str}"
                    
                    # Skip if this mentor is already booked at this slot
                    if slot_key in booked_slots:
                        continue
                    
                    # Skip if Google Calendar shows busy
                    if slot_key in gcal_busy_slots:
                        continue
                    
                    # Check if slot is in the past
                    slot_datetime_str = f"{date_str} {time_str}"
                    try:
                        slot_datetime = ist.localize(datetime.strptime(slot_datetime_str, "%Y-%m-%d %H:%M"))
                        if slot_datetime <= now_ist:
                            continue
                    except:
                        continue
                    
                    # Add to aggregated slots
                    if date_str not in aggregated_slots:
                        aggregated_slots[date_str] = {}
                    
                    if time_str not in aggregated_slots[date_str]:
                        aggregated_slots[date_str][time_str] = {
                            "available": True,
                            "mentor_ids": []
                        }
                    
                    aggregated_slots[date_str][time_str]["mentor_ids"].append(mentor_id)
    
    total_slots = sum(len(times) for times in aggregated_slots.values())
    print(f"\nAggregation complete:")
    print(f"  - Total dates with slots: {len(aggregated_slots)}")
    print(f"  - Total time slots: {total_slots}")
    print(f"  - First 5 dates: {list(aggregated_slots.keys())[:5]}")
    
    if len(aggregated_slots) == 0:
        print("⚠️  NO SLOTS FOUND - All slots might be in the past!")
    
    print("="*80 + "\n")
    
    return {
        "slots": aggregated_slots,
        "mentor_count": len(mentors)
    }


@router.get("/debug/availability-check")
async def debug_availability_check(request: Request, date: str = None):
    """
    Debug endpoint to check why a specific date/time might show as available.
    Call with ?date=2026-02-23 to check a specific date.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    # Get all strategy call mentors
    mentors = await db.mentors.find({
        "can_take_strategy_calls": True,
        "is_active": {"$ne": False},
        "is_deleted": {"$ne": True},
        "is_hidden_from_strategy_calls": {"$ne": True}
    }).to_list(100)
    
    result = {
        "total_strategy_call_mentors": len(mentors),
        "check_date": date,
        "mentors": []
    }
    
    for mentor in mentors:
        mentor_info = {
            "id": mentor.get("id"),
            "name": mentor.get("name"),
            "email": mentor.get("email"),
            "google_calendar_connected": mentor.get("google_calendar_connected", False),
            "has_calendar_credentials": bool(mentor.get("google_calendar_credentials")),
            "booked_slots_on_date": [],
            "google_calendar_busy_slots": []
        }
        
        # Check booked slots for this date
        if date:
            strategy_bookings = await db.strategy_call_sessions.find({
                "mentor_id": mentor.get("id"),
                "date": date,
                "status": {"$in": ["scheduled", "confirmed"]}
            }, {"_id": 0, "time": 1, "status": 1}).to_list(50)
            
            coaching_bookings = await db.bookings.find({
                "mentor_id": mentor.get("id"),
                "date": date,
                "status": {"$in": ["confirmed", "pending"]}
            }, {"_id": 0, "time_slot": 1, "status": 1}).to_list(50)
            
            mentor_info["booked_slots_on_date"] = [
                {"time": b.get("time"), "type": "strategy_call"} for b in strategy_bookings
            ] + [
                {"time": b.get("time_slot"), "type": "coaching"} for b in coaching_bookings
            ]
            
            # Check Google Calendar
            if mentor.get("google_calendar_connected"):
                try:
                    from routes.mentor_calendar import get_mentor_busy_slots_batch
                    busy_slots = await get_mentor_busy_slots_batch(db, mentor.get("id"), date, date)
                    mentor_info["google_calendar_busy_slots"] = busy_slots.get(date, [])
                except Exception as e:
                    mentor_info["google_calendar_error"] = str(e)
        
        result["mentors"].append(mentor_info)
    
    return result


@router.get("/sessions")
async def get_user_strategy_sessions(request: Request):
    """Get user's strategy call sessions"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    sessions = await db.strategy_call_sessions.find({
        "user_id": user.get("id")
    }).sort("date", -1).to_list(50)
    
    return {
        "sessions": sessions,
        "count": len(sessions)
    }


@router.post("/purchase-addon")
async def purchase_strategy_call_addon(purchase: AddonPurchaseRequest, request: Request):
    """Initiate purchase of additional strategy call sessions"""
    try:
        # Wrap entire function to catch all errors
        try:
            user = await get_current_user(request)
        except Exception as e:
            logger.error(f"Auth error in purchase-addon: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Not authenticated: {str(e)}")
        
        if not user:
            logger.error("No user returned from get_current_user in purchase-addon")
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        logger.info(f"Purchase addon request from user: {user.get('email')}")
        
        db = get_db(request)
    except Exception as e:
        logger.error(f"CRITICAL ERROR in purchase-addon setup: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    
    try:
        if purchase.quantity < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        
        # Get addon plan pricing
        logger.info(f"Fetching addon plan from database...")
        addon_plan = await db.plans.find_one({"plan_key": "addon_strategy_call"})
        if not addon_plan:
            logger.error("Addon plan 'addon_strategy_call' not found in database")
            raise HTTPException(status_code=404, detail="Strategy call addon plan not found")
        
        logger.info(f"Addon plan found: {addon_plan.get('name')}")
        
        # Get price from new pricing structure
        pricing = addon_plan.get("pricing", {})
        if isinstance(pricing, dict):
            unit_price = pricing.get("one_time") or pricing.get("one_month") or 999
        else:
            unit_price = addon_plan.get("price", 999)
        
        logger.info(f"Unit price: {unit_price}, Quantity: {purchase.quantity}")
        total_price = unit_price * purchase.quantity
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting addon plan or pricing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching pricing: {str(e)}")
    
    # Apply coupon discount if provided
    discount_amount = 0
    applied_discount = None
    
    if purchase.coupon_code:
        try:
            # Validate discount
            discount = await db.discounts.find_one({
                "code": purchase.coupon_code.upper(),
                "type": "coupon",
                "is_active": True
            })
            
            if discount:
                # Import validation function
                from routes.discounts import validate_discount_applicability
                
                # Check user usage
                user_usage_count = await db.discount_usage.count_documents({
                    "discount_id": discount["id"],
                    "user_id": user.get("id")
                })
                
                validation = validate_discount_applicability(
                    discount=discount,
                    order_type="coaching",
                    plan_key="addon_strategy_call",
                    order_amount=total_price,
                    user_id=user.get("id"),
                    user_usage_count=user_usage_count
                )
                
                if validation["valid"]:
                    discount_amount = validation["discount_amount"]
                    applied_discount = {
                        "discount_id": discount["id"],
                        "code": purchase.coupon_code.upper(),
                        "name": discount["name"],
                        "amount": discount_amount
                    }
        except Exception as e:
            logger.warning(f"Coupon validation error: {str(e)}")
            # Continue without discount if validation fails
    
    # Calculate final amounts
    discounted_price = total_price - discount_amount
    gst_amount = round(discounted_price * 0.18)
    total_with_gst = discounted_price + gst_amount
    
    # Create Razorpay order
    try:
        import razorpay
        import os
        
        RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
        RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")
        
        logger.info(f"Razorpay credentials check - Key ID exists: {bool(RAZORPAY_KEY_ID)}, Secret exists: {bool(RAZORPAY_KEY_SECRET)}")
        
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            logger.error("Razorpay credentials missing in environment")
            raise HTTPException(status_code=500, detail="Payment gateway not configured")
        
        logger.info("Creating Razorpay client...")
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        
        now = datetime.now(timezone.utc)
        
        # Generate short receipt ID (max 40 chars for Razorpay)
        user_id_short = user.get('id')[-8:] if user.get('id') else 'unknown'
        receipt_id = f"SC_{now.strftime('%y%m%d%H%M%S')}_{user_id_short}"
        
        # Razorpay requires amount as integer (paise)
        razorpay_amount = int(round(total_with_gst * 100))
        
        logger.info(f"Creating Razorpay order: amount={razorpay_amount} paise, receipt={receipt_id}")
        
        order = client.order.create({
            "amount": razorpay_amount,  # Must be integer in paise
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "user_id": user.get("id"),
                "user_email": user.get("email"),
                "type": "strategy_call_addon",
                "quantity": purchase.quantity,
                "unit_price": unit_price,
                "base_amount": total_price,
                "discount_amount": discount_amount,
                "discounted_price": discounted_price,
                "coupon_code": purchase.coupon_code if applied_discount else None,
                "gst_amount": gst_amount,
                "total_amount": total_with_gst
            }
        })
        
        logger.info(f"Razorpay order created successfully: {order['id']}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Razorpay error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Payment gateway error: {str(e)}")
    
    # Store pending purchase
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$set": {
                "pending_strategy_addon": {
                    "order_id": order["id"],
                    "quantity": purchase.quantity,
                    "unit_price": unit_price,
                    "total_price": total_price,
                    "discount_amount": discount_amount,
                    "discounted_price": discounted_price,
                    "coupon_code": purchase.coupon_code if applied_discount else None,
                    "discount_id": applied_discount["discount_id"] if applied_discount else None,
                    "gst_amount": gst_amount,
                    "total_with_gst": total_with_gst,
                    "created_at": now.isoformat()
                }
            }
        }
    )
    
    # Track this strategy-call purchase attempt as an Abandoned Cart entry.
    # Removed automatically on successful /confirm-addon-purchase.
    try:
        from services.google_sheets_service import append_abandoned_cart_to_sheet
        user_for_sheet = await db.users.find_one(
            {"id": user.get("id")}, {"_id": 0}
        ) or {}
        await append_abandoned_cart_to_sheet(
            user_for_sheet,
            {
                "plan_attempted_key": "strategy_call_addon",
                "plan_attempted_name": f"{purchase.quantity} Strategy Call{'s' if purchase.quantity > 1 else ''}",
                "plan_attempted_type": "Strategy Call",
                "attempted_at": now.isoformat(),
            },
        )
    except Exception as cart_error:
        logger.warning(f"Abandoned cart tracking error (non-critical): {cart_error}")
    
    return {
        "success": True,
        "order_id": order["id"],
        "razorpay_key": RAZORPAY_KEY_ID,
        "amount": total_with_gst,
        "base_amount": total_price,
        "discount_amount": discount_amount,
        "discounted_price": discounted_price,
        "gst_amount": gst_amount,
        "quantity": purchase.quantity,
        "currency": "INR",
        "applied_discount": applied_discount
    }


@router.post("/confirm-addon-purchase")
async def confirm_strategy_addon_purchase(request: Request):
    """Confirm addon purchase after payment"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db(request)
    
    pending = user.get("pending_strategy_addon")
    if not pending:
        raise HTTPException(status_code=400, detail="No pending addon purchase found")
    
    # Verify payment with Razorpay
    import razorpay
    import os
    
    RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    
    try:
        order = client.order.fetch(pending["order_id"])
        if order.get("status") != "paid":
            return {
                "success": False,
                "message": "Payment not completed",
                "order_status": order.get("status")
            }
    except Exception as e:
        logger.error(f"Failed to verify addon order: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify payment")
    
    now = datetime.now(timezone.utc)
    quantity = pending.get("quantity", 1)
    
    # IMPORTANT: With priority-based logic, we need to handle addon purchases carefully
    # If user has 0 override (using plan baseline), first purchase should set override to plan_baseline + purchase
    # If user already has override, just add to it
    
    current_override = user.get("strategy_calls_total", 0) or 0
    
    if current_override == 0:
        # User is currently using plan baseline, need to include it in override
        plan_key = user.get("plan")
        plan_baseline = 0
        if plan_key:
            plan = await db.plans.find_one({"plan_key": plan_key})
            if plan:
                features = plan.get("features", {})
                plan_strategy_calls = features.get("strategy_calls", 0)
                if plan_strategy_calls == -1:
                    plan_baseline = 999
                else:
                    plan_baseline = plan_strategy_calls or 0
        
        # Set override to plan baseline + purchased quantity
        new_total = plan_baseline + quantity
        logger.info(f"First addon purchase: setting override from 0 to {new_total} (plan_baseline:{plan_baseline} + quantity:{quantity})")
    else:
        # User already has override, just add to it
        new_total = current_override + quantity
        logger.info(f"Additional addon purchase: adding {quantity} to existing override {current_override} = {new_total}")
    
    await db.users.update_one(
        {"id": user.get("id")},
        {
            "$set": {
                "strategy_calls_total": new_total,
                "updated_at": now.isoformat()
            },
            "$unset": {
                "pending_strategy_addon": ""
            }
        }
    )
    
    # Record payment
    payment_record = {
        "id": f"strategy-addon-{uuid.uuid4().hex[:12]}",
        "order_id": pending["order_id"] or f"order_strategy_{uuid.uuid4().hex[:16]}",  # Unique order_id for index
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "razorpay_order_id": pending["order_id"],
        "type": "strategy_call_addon",
        "plan_key": "addon_strategy_call",
        "quantity": quantity,
        "amount": pending.get("total_with_gst", 0),
        "base_amount": pending.get("total_price", 0),
        "discount_amount": pending.get("discount_amount", 0),
        "discounted_price": pending.get("discounted_price", pending.get("total_price", 0)),
        "coupon_code": pending.get("coupon_code"),
        "gst_amount": pending.get("gst_amount", 0),
        "currency": "INR",
        "status": "captured",
        "created_at": now.isoformat(),
        "captured_at": now.isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    # Strategy-call addon payment succeeded — clear from Abandoned Cart sheet.
    try:
        from services.google_sheets_service import remove_abandoned_cart_from_sheet
        if user.get("email"):
            await remove_abandoned_cart_from_sheet(user.get("email"), "Strategy Call")
    except Exception as cart_error:
        logger.warning(f"Abandoned cart removal error (non-critical): {cart_error}")
    
    # Record discount usage if coupon was applied
    if pending.get("coupon_code") and pending.get("discount_id"):
        discount_usage_record = {
            "id": str(uuid.uuid4()),
            "discount_id": pending["discount_id"],
            "discount_code": pending["coupon_code"],
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "order_type": "coaching",
            "plan_key": "addon_strategy_call",
            "original_amount": pending.get("total_price", 0),
            "discount_applied": pending.get("discount_amount", 0),
            "final_amount": pending.get("discounted_price", 0),
            "payment_id": payment_record["id"],
            "order_id": pending["order_id"],
            "used_at": now.isoformat()
        }
        await db.discount_usage.insert_one(discount_usage_record)
    
    logger.info(f"Strategy call addon purchased: {quantity} credits for user {user.get('id')}")
    
    return {
        "success": True,
        "message": f"Successfully added {quantity} strategy call credit(s)!",
        "credits_added": quantity,
        "new_total": new_total
    }


# ============== Mentor Profile Endpoints ==============

@router.get("/mentor/status")
async def get_mentor_strategy_status(request: Request):
    """Get mentor's strategy call eligibility status"""
    user = await get_current_user(request)
    if not user or not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Not a mentor")
    
    db = get_db(request)
    
    mentor_id = user.get("mentor_id")
    mentor = await db.mentors.find_one({"id": mentor_id})
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    return {
        "can_take_strategy_calls": mentor.get("can_take_strategy_calls", False),
        "strategy_call_approval_pending": mentor.get("strategy_call_approval_pending", False),
        "strategy_call_enabled_by": mentor.get("strategy_call_enabled_by"),
        "strategy_call_enabled_at": mentor.get("strategy_call_enabled_at")
    }


@router.post("/mentor/toggle-strategy-calls")
async def toggle_mentor_strategy_calls(toggle: MentorStrategyCallToggleRequest, request: Request):
    """
    Toggle mentor's strategy call availability.
    - If admin enabled and mentor wants to disable: Allowed immediately
    - If disabled and mentor wants to enable: Requires admin approval
    """
    user = await get_current_user(request)
    if not user or not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Not a mentor")
    
    db = get_db(request)
    
    mentor_id = user.get("mentor_id")
    mentor = await db.mentors.find_one({"id": mentor_id})
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    now = datetime.now(timezone.utc)
    current_status = mentor.get("can_take_strategy_calls", False)
    
    if toggle.enable:
        # Mentor wants to enable strategy calls
        if current_status:
            return {"success": True, "message": "Strategy calls already enabled"}
        
        # Request approval from admin
        await db.mentors.update_one(
            {"id": mentor_id},
            {
                "$set": {
                    "strategy_call_approval_pending": True,
                    "strategy_call_requested_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Create approval request
        approval_request = {
            "id": f"approval-{uuid.uuid4().hex[:12]}",
            "type": "strategy_call_enable",
            "mentor_id": mentor_id,
            "mentor_name": mentor.get("name"),
            "mentor_email": mentor.get("email"),
            "status": "pending",
            "requested_at": now.isoformat()
        }
        await db.mentor_approval_requests.insert_one(approval_request)
        
        logger.info(f"Mentor {mentor_id} requested strategy call approval")
        
        return {
            "success": True,
            "message": "Request submitted for admin approval",
            "approval_pending": True
        }
    else:
        # Mentor wants to disable strategy calls - allowed immediately
        await db.mentors.update_one(
            {"id": mentor_id},
            {
                "$set": {
                    "can_take_strategy_calls": False,
                    "strategy_call_approval_pending": False,
                    "strategy_call_disabled_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
            }
        )
        
        logger.info(f"Mentor {mentor_id} disabled strategy calls")
        
        return {
            "success": True,
            "message": "Strategy calls disabled",
            "can_take_strategy_calls": False
        }


# ============== Admin Endpoints ==============

@router.get("/admin/approval-requests")
async def get_strategy_call_approval_requests(request: Request):
    """Get pending strategy call approval requests for admin"""
    db = get_db(request)
    
    # Verify admin
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    requests = await db.mentor_approval_requests.find({
        "type": "strategy_call_enable",
        "status": "pending"
    }).sort("requested_at", -1).to_list(50)
    
    return {
        "requests": requests,
        "count": len(requests)
    }


@router.post("/admin/approve-strategy-call/{mentor_id}")
async def approve_mentor_strategy_calls(mentor_id: str, request: Request):
    """Admin approves mentor for strategy calls"""
    db = get_db(request)
    
    # Verify admin
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Update mentor
    result = await db.mentors.update_one(
        {"id": mentor_id},
        {
            "$set": {
                "can_take_strategy_calls": True,
                "strategy_call_approval_pending": False,
                "strategy_call_enabled_by": "admin_approved",
                "strategy_call_enabled_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Update approval request
    await db.mentor_approval_requests.update_one(
        {"mentor_id": mentor_id, "type": "strategy_call_enable", "status": "pending"},
        {
            "$set": {
                "status": "approved",
                "approved_at": now.isoformat(),
                "approved_by": user.get("id")
            }
        }
    )
    
    logger.info(f"Admin approved mentor {mentor_id} for strategy calls")
    
    return {"success": True, "message": "Mentor approved for strategy calls"}


@router.post("/admin/reject-strategy-call/{mentor_id}")
async def reject_mentor_strategy_calls(mentor_id: str, request: Request):
    """Admin rejects mentor's strategy call request"""
    db = get_db(request)
    
    # Verify admin
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Update mentor
    await db.mentors.update_one(
        {"id": mentor_id},
        {
            "$set": {
                "strategy_call_approval_pending": False,
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Update approval request
    await db.mentor_approval_requests.update_one(
        {"mentor_id": mentor_id, "type": "strategy_call_enable", "status": "pending"},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "rejected_by": user.get("id")
            }
        }
    )
    
    logger.info(f"Admin rejected mentor {mentor_id} for strategy calls")
    
    return {"success": True, "message": "Request rejected"}


# ============== Settings Endpoints ==============

@router.get("/settings/duration")
async def get_strategy_call_duration(request: Request):
    """Get configured strategy call duration"""
    db = get_db(request)
    
    settings = await db.settings.find_one({"key": "strategy_call_duration"})
    duration = settings.get("value", 30) if settings else 30
    
    return {"duration_minutes": duration}


@router.put("/admin/settings/duration")
async def set_strategy_call_duration(request: Request):
    """Set strategy call duration (admin only)"""
    db = get_db(request)
    
    # Verify admin
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    duration = data.get("duration_minutes", 30)
    
    if duration < 15 or duration > 120:
        raise HTTPException(status_code=400, detail="Duration must be between 15 and 120 minutes")
    
    await db.settings.update_one(
        {"key": "strategy_call_duration"},
        {"$set": {"value": duration, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "duration_minutes": duration}
