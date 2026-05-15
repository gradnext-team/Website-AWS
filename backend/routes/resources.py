from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timedelta
import time as _time
import uuid
from models import (
    VideoLesson, Workshop, CaseDrill, Resource, CohortSession,
    UserProgress, User, PlanType
)
from routes.auth import get_current_user, get_db
from routes.ai_drills import PRE_GENERATED_DRILLS
from services.google_sheets_service import append_workshop_registration_to_sheet
import pytz

router = APIRouter(prefix="/resources", tags=["resources"])

# ── Simple in-memory response cache for public endpoints ────────────────
# Plans, testimonials and logos rarely change but are hit by every visitor.
_response_cache = {}  # key -> {"ts": float, "data": any}
_CACHE_TTL = 120  # 2 minutes


def _rcache_get(key: str):
    entry = _response_cache.get(key)
    if entry and (_time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _rcache_set(key: str, data):
    _response_cache[key] = {"ts": _time.time(), "data": data}


def invalidate_resources_cache():
    """Call after admin edits plans/testimonials/logos."""
    _response_cache.clear()


def get_total_drills_count():
    """Get total number of available drills from PRE_GENERATED_DRILLS"""
    total = 0
    for drill_type, difficulties in PRE_GENERATED_DRILLS.items():
        for difficulty, drills in difficulties.items():
            total += len(drills)
    return total


def parse_date_field(date_value) -> Optional[datetime]:
    """Parse a date field that could be string or datetime"""
    if not date_value:
        return None
    
    if isinstance(date_value, datetime):
        if date_value.tzinfo is None:
            return pytz.UTC.localize(date_value)
        return date_value
    
    if isinstance(date_value, str):
        try:
            dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = pytz.UTC.localize(dt)
            return dt
        except:
            return None
    
    return None


def check_trial_status(user_data: dict) -> dict:
    """Check if user's free trial is expired and calculate days remaining"""
    plan = user_data.get("plan", "").lower()
    
    # Only check for free trial users
    if plan != "free_trial":
        return {
            "is_trial": False,
            "is_expired": False,
            "days_remaining": None,
            "expiry_date": None
        }
    
    # Get plan end date
    plan_end_date = user_data.get("plan_end_date")
    
    if not plan_end_date:
        # If no end date set, calculate from created_at + 7 days
        created_at = user_data.get("created_at")
        if created_at:
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except:
                    created_at = datetime.now(pytz.UTC)
            elif isinstance(created_at, datetime):
                if created_at.tzinfo is None:
                    created_at = pytz.UTC.localize(created_at)
            plan_end_date = created_at + timedelta(days=7)
        else:
            # No created_at, assume not expired
            return {
                "is_trial": True,
                "is_expired": False,
                "days_remaining": 7,
                "expiry_date": None
            }
    
    # Parse plan_end_date if it's a string
    if isinstance(plan_end_date, str):
        try:
            plan_end_date = datetime.fromisoformat(plan_end_date.replace('Z', '+00:00'))
        except:
            return {
                "is_trial": True,
                "is_expired": False,
                "days_remaining": 7,
                "expiry_date": None
            }
    
    # Ensure timezone aware
    if plan_end_date.tzinfo is None:
        plan_end_date = pytz.UTC.localize(plan_end_date)
    
    # Calculate days remaining
    now = datetime.now(pytz.UTC)
    time_remaining = plan_end_date - now
    days_remaining = max(0, time_remaining.days)
    
    is_expired = now >= plan_end_date
    
    return {
        "is_trial": True,
        "is_expired": is_expired,
        "days_remaining": days_remaining if not is_expired else 0,
        "expiry_date": plan_end_date.isoformat()
    }


def check_plan_status(user_data: dict) -> dict:
    """
    Comprehensive plan status check for ALL plan types.
    
    Returns status for:
    - Free Trial: 7-day expiry, show days left
    - Subscription Plans (Basic/Pro/Pro+): Enforce subscription_end_date, HIDE days left
    - Coaching Programs (Last Mile/Mid Mile/Full Prep/Pinnacle): Enforce coaching_program_end_date, show days left
    - Single Sessions: NEVER expire
    
    Key business rules:
    1. Expired trial = pages browsable, items locked
    2. Expired subscription = same as expired trial
    3. Expired coaching = lose coaching access, keep subscription if active
    4. Single sessions survive all expiries
    """
    plan = user_data.get("plan", "").lower()
    now = datetime.now(pytz.UTC)
    
    # Define plan categories - standardized to use database plan_key convention
    SUBSCRIPTION_PLANS = ["basic_plan", "pro_plan", "pro_plus"]
    COACHING_PLANS = ["last_mile", "mid_mile", "full_prep", "pinnacle"]
    
    result = {
        "plan_type": "unknown",
        "plan_category": "unknown",
        
        # Trial status (for free_trial only)
        "is_trial": False,
        "trial_expired": False,
        "trial_days_remaining": None,
        "trial_expiry_date": None,
        
        # Subscription status (for Basic/Pro/Pro+)
        "has_subscription": False,
        "subscription_expired": False,
        "subscription_days_remaining": None,  # Will be None to hide from UI
        "subscription_expiry_date": None,
        "show_subscription_days": False,  # Always False for subscriptions (reduce churn)
        
        # Coaching program status (for Last Mile/Mid Mile/Full Prep/Pinnacle)
        "has_coaching_program": False,
        "coaching_program_expired": False,
        "coaching_program_days_remaining": None,
        "coaching_program_expiry_date": None,
        "show_coaching_days": True,  # Always True for coaching programs
        
        # Single sessions (never expire)
        "has_single_sessions": False,
        "single_sessions_remaining": 0,
        
        # Overall access flags
        "can_access_courses": False,
        "can_access_drills": False,
        "can_access_peer_practice": False,
        "can_access_coaching": False,
        "can_access_workshops": False,
        
        # Item-level locking (NEW: key for the new access control)
        "use_item_level_locking": False,  # When True, pages are browsable but items are locked
    }
    
    # ============ FREE TRIAL ============
    if plan == "free_trial":
        result["plan_type"] = "free_trial"
        result["plan_category"] = "trial"
        result["is_trial"] = True
        
        # Calculate trial expiry
        plan_end_date = parse_date_field(user_data.get("plan_end_date"))
        if not plan_end_date:
            created_at = parse_date_field(user_data.get("created_at"))
            if created_at:
                plan_end_date = created_at + timedelta(days=7)
        
        if plan_end_date:
            result["trial_expiry_date"] = plan_end_date.isoformat()
            time_remaining = plan_end_date - now
            result["trial_days_remaining"] = max(0, time_remaining.days)
            result["trial_expired"] = now >= plan_end_date
        
        # Free trial: browsable pages with item-level locking
        if result["trial_expired"]:
            result["use_item_level_locking"] = True
            # All access is item-level locked
            result["can_access_courses"] = True  # Page browsable
            result["can_access_drills"] = True   # Page browsable
            result["can_access_peer_practice"] = True  # Page browsable
            result["can_access_coaching"] = True  # Page always browsable
            result["can_access_workshops"] = True  # Page browsable
        else:
            # Active trial: limited access to free content
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True
            result["can_access_workshops"] = True
    
    # ============ SUBSCRIPTION PLANS (Basic/Pro/Pro+) ============
    elif plan in SUBSCRIPTION_PLANS:
        result["plan_type"] = plan
        result["plan_category"] = "subscription"
        result["has_subscription"] = True
        result["show_subscription_days"] = False  # HIDE days left to reduce churn
        
        # Check subscription_end_date
        sub_end_date = parse_date_field(user_data.get("subscription_end_date")) or \
                       parse_date_field(user_data.get("subscription_end")) or \
                       parse_date_field(user_data.get("plan_end_date"))
        
        if sub_end_date:
            result["subscription_expiry_date"] = sub_end_date.isoformat()
            time_remaining = sub_end_date - now
            result["subscription_days_remaining"] = max(0, time_remaining.days)
            result["subscription_expired"] = now >= sub_end_date
        else:
            # No end date set - treat as expired (should have been set during plan assignment)
            result["subscription_expired"] = True
            result["subscription_days_remaining"] = 0
        
        if result["subscription_expired"]:
            result["use_item_level_locking"] = True
            # Expired subscription: pages browsable, items locked
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True
            result["can_access_workshops"] = True
        else:
            # Active subscription: full access
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True
            result["can_access_workshops"] = True
    
    # ============ COACHING PLANS (Last Mile/Mid Mile/Full Prep/Pinnacle) ============
    elif plan in COACHING_PLANS:
        result["plan_type"] = plan
        result["plan_category"] = "coaching"
        result["has_coaching_program"] = True
        result["has_subscription"] = True  # Coaching plans include subscription features
        result["show_coaching_days"] = True  # Show days left for coaching
        
        # Check coaching_program_end_date
        coaching_end_date = parse_date_field(user_data.get("coaching_program_end_date")) or \
                           parse_date_field(user_data.get("subscription_end_date")) or \
                           parse_date_field(user_data.get("plan_end_date"))
        
        if coaching_end_date:
            result["coaching_program_expiry_date"] = coaching_end_date.isoformat()
            time_remaining = coaching_end_date - now
            result["coaching_program_days_remaining"] = max(0, time_remaining.days)
            result["coaching_program_expired"] = now >= coaching_end_date
        else:
            # No end date set - treat as expired (should have been set during plan assignment)
            result["coaching_program_expired"] = True
            result["coaching_program_days_remaining"] = 0
        
        # IMPORTANT: If coaching is expired, subscription is also expired (they're the same plan!)
        if result["coaching_program_expired"]:
            result["subscription_expired"] = True  # This is crucial for has_full_access calculation
            result["use_item_level_locking"] = True
            # Expired coaching: pages browsable, items locked
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True  # Can still browse, but no credits
            result["can_access_workshops"] = True
        else:
            # Active coaching: full access
            result["subscription_expired"] = False
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True
            result["can_access_workshops"] = True
    
    # ============ OTHER PLANS (Cohort, Mentor, etc.) ============
    else:
        result["plan_type"] = plan or "none"
        result["plan_category"] = "other"
        # Check for cohort plans
        if plan and "cohort" in plan:
            result["plan_category"] = "cohort"
            result["has_subscription"] = True
            result["can_access_courses"] = True
            result["can_access_drills"] = True
            result["can_access_peer_practice"] = True
            result["can_access_coaching"] = True
            result["can_access_workshops"] = True
        elif plan == "mentor":
            result["plan_category"] = "mentor"
            # Mentors have limited candidate features
    
    # ============ SINGLE SESSIONS (Never expire) ============
    coaching_sessions_remaining = user_data.get("coaching_sessions_remaining", 0) or 0
    if coaching_sessions_remaining > 0:
        result["has_single_sessions"] = True
        result["single_sessions_remaining"] = coaching_sessions_remaining
        # Single sessions ALWAYS allow coaching access
        result["can_access_coaching"] = True
    
    return result


# ============ Public Plans Endpoint ============

@router.get("/plans")
async def get_public_plans(request: Request, page: Optional[str] = None, category: Optional[str] = None, region: Optional[str] = None):
    """Get all active plans for public display (landing page)
    
    Args:
        page: Filter by landing page (e.g., 'home', 'pricing', 'coaching', 'cohort')
        category: Filter by category (e.g., 'subscription', 'coaching', 'cohort', 'addon')
        region: Region code for regional pricing (e.g., 'US', 'IN', 'GB')
    """
    # Check cache (keyed by all query params)
    cache_key = f"plans_{page}_{category}_{region}"
    cached = _rcache_get(cache_key)
    if cached is not None:
        return cached

    db = request.app.state.db
    
    # Build query - only active and visible plans
    query = {"is_active": True, "is_hidden": {"$ne": True}}
    
    if category:
        query["category"] = category
    
    # Get plans
    plans = await db.plans.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Log for debugging
    print(f"[Plans API] Found {len(plans)} plans with query: {query}")
    
    # If no plans exist, seed with defaults and return them
    if not plans:
        print("[Plans API] No plans found, seeding defaults...")
        from routes.admin import DEFAULT_PLANS
        for plan in DEFAULT_PLANS:
            if plan.get("is_active", True):
                plan_copy = plan.copy()
                plan_copy["created_at"] = datetime.utcnow().isoformat()
                plan_copy["updated_at"] = datetime.utcnow().isoformat()
                await db.plans.insert_one(plan_copy)
        plans = [p.copy() for p in DEFAULT_PLANS if p.get("is_active", True)]
        print(f"[Plans API] Seeded {len(plans)} default plans")
    
    # Filter by page if specified
    if page:
        plans = [p for p in plans if page in p.get("show_on_pages", ["home"])]
    
    # Transform to public-friendly format
    public_plans = []
    for plan in plans:
        # Get regional pricing if available
        regional_pricing = plan.get("regional_pricing", {})
        pricing_data = regional_pricing.get(region, regional_pricing.get("DEFAULT", plan.get("pricing", {}))) if region and regional_pricing else plan.get("pricing", {})
        
        # Calculate best price from regional or default pricing
        if isinstance(pricing_data, dict):
            prices = [v for v in [pricing_data.get("one_month"), pricing_data.get("six_month"), pricing_data.get("one_time")] if v is not None and v > 0]
            best_price = min(prices) if prices else 0
            currency = pricing_data.get("currency", "INR")
        else:
            best_price = plan.get("price", 0)
            currency = "INR"
        
        # Calculate duration string
        duration_months = plan.get("duration_months")
        duration_days = plan.get("duration_days")
        
        if duration_days:
            duration_str = f"{duration_days} days"
        elif duration_months:
            duration_str = f"{duration_months} month{'s' if duration_months > 1 else ''}"
        else:
            duration_str = "Unlimited"
        
        public_plans.append({
            "id": plan.get("plan_key", plan.get("id")),
            "plan_key": plan.get("plan_key"),
            "name": plan.get("name"),
            "category": plan.get("category", "subscription"),
            "description": plan.get("description", ""),
            "price": best_price,
            "pricing": pricing_data,  # Use regional pricing data
            "currency": currency,  # Currency from regional pricing
            "duration": duration_str,
            "duration_months": duration_months,
            "duration_days": duration_days,
            "is_auto_renew": plan.get("is_auto_renew", False),
            "features": plan.get("features", {}),
            "display_features": plan.get("display_features", []),
            "highlight": plan.get("highlight", False),
            "badge": plan.get("badge"),
            "order": plan.get("order", 0),
            "show_on_pages": plan.get("show_on_pages", ["home"]),
            "auto_add_to_subscription": plan.get("auto_add_to_subscription", False),
            "requires_base_plan": plan.get("requires_base_plan", False),
            "is_application_based": plan.get("is_application_based", False),
            "is_visible": plan.get("is_visible", True)
        })
    
    # Group by category for easier frontend handling
    grouped = {}
    for plan in public_plans:
        cat = plan.get("category", "subscription")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(plan)
    
    result = {"plans": public_plans, "grouped": grouped}
    _rcache_set(cache_key, result)
    return result


@router.get("/plans/{plan_key}")
async def get_plan_by_key(plan_key: str, request: Request):
    """Get a specific plan by its key for public access"""
    db = request.app.state.db
    
    plan = await db.plans.find_one(
        {"plan_key": plan_key, "is_active": True}, 
        {"_id": 0}
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Calculate duration string
    duration_value = plan.get("duration_value")
    duration_unit = plan.get("duration_unit", "months")
    
    if duration_value:
        unit_label = duration_unit.rstrip('s') if duration_value == 1 else duration_unit
        duration_str = f"{duration_value} {unit_label}"
    else:
        duration_str = "Unlimited"
    
    return {
        "id": plan.get("plan_key", plan.get("id")),
        "name": plan.get("name"),
        "description": plan.get("description", ""),
        "price": plan.get("price", 0),
        "currency": plan.get("currency", "INR"),
        "duration": duration_str,
        "duration_value": duration_value,
        "duration_unit": duration_unit,
        "coaching_sessions": plan.get("coaching_sessions", 0),
        "is_subscription": plan.get("is_subscription", False),
        "features": plan.get("features", {}),
        "highlight": plan.get("highlight", False),
        "badge": plan.get("badge")
    }


def has_subscription_access(plan: str, user_features: dict = None) -> bool:
    """Check if user has subscription-level access
    
    Args:
        plan: The plan key/name
        user_features: Optional features dict from user document
    """
    # First check if user has explicit features that grant access
    if user_features:
        # Check if any subscription feature is enabled
        sub_features = ['course_recordings', 'peer_practice', 'peer_to_peer', 'case_drills', 'drills_exercises', 'workshops']
        for feature in sub_features:
            feature_value = user_features.get(feature)
            if feature_value == True or (isinstance(feature_value, str) and feature_value not in ['', 'none', 'false']):
                return True
    
    # Fall back to plan-based check using PlanType enum (now standardized to database convention)
    subscription_plans = [
        PlanType.BASIC.value, PlanType.PRO.value, PlanType.PRO_PLUS.value,
        PlanType.LAST_MILE.value, PlanType.MID_MILE.value, PlanType.FULL_PREP.value,
        PlanType.PINNACLE.value, PlanType.COHORT_PREMIUM.value, PlanType.COHORT_ELITE.value,
    ]
    return plan in subscription_plans


def has_coaching_access(plan: str) -> bool:
    """Check if user has coaching-level access"""
    coaching_plans = [
        PlanType.PRO_PLUS.value, PlanType.PINNACLE.value,
        PlanType.LAST_MILE.value, PlanType.MID_MILE.value, PlanType.FULL_PREP.value,
        PlanType.COHORT_PREMIUM.value, PlanType.COHORT_ELITE.value,
        # Note: basic_plan and pro_plan do NOT have coaching access
    ]
    return plan in coaching_plans


def has_cohort_access(plan: str) -> bool:
    """Check if user has cohort-level access"""
    cohort_plans = [PlanType.COHORT_PREMIUM.value, PlanType.COHORT_ELITE.value]
    return plan in cohort_plans


@router.get("/videos")
async def get_videos(request: Request):
    """Get video lessons with access control - Legacy endpoint, use /courses instead"""
    user = await get_current_user(request)
    db = get_db(request)
    
    videos = await db.videos.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    
    # Free trial users only get access to content marked as is_free
    is_free_trial = user_plan == "free_trial"
    has_access = False if is_free_trial else has_subscription_access(user_plan, user_features)
    
    result = []
    for i, video in enumerate(videos):
        video_is_free = video.get("is_free", False)
        # Ensure all fields have defaults
        video_data = {
            "id": video.get("id", f"video-{i}"),
            "title": video.get("title", "Untitled Video"),
            "description": video.get("description", ""),
            "duration": video.get("duration", "0:00"),
            "module": video.get("module", "General"),
            "order": video.get("order", i),
            "thumbnail": video.get("thumbnail", ""),
            "video_url": video.get("video_url", ""),
            "is_free": video_is_free,
            "locked": False
        }
        
        # Lock videos not marked as free for users without subscription access
        if not has_access and not video_is_free:
            video_data["locked"] = True
            video_data["video_url"] = None
        
        result.append(video_data)
    
    return result


@router.get("/courses")
async def get_courses(request: Request):
    """Get courses with full hierarchy: modules > submodules > sessions"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_data = user if isinstance(user, dict) else user.__dict__
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    
    # Get comprehensive plan status
    plan_status = check_plan_status(user_data)
    
    # Check trial status for free trial users
    is_free_trial = user_plan == "free_trial"
    trial_expired = plan_status.get("trial_expired", False)
    
    # Determine access level using plan_status
    # - Expired trial: NO access (even to free content)
    # - Active trial: Only free content accessible
    # - Expired subscription/coaching: NO access
    # - Active subscription/coaching: Full access
    if is_free_trial and trial_expired:
        has_access = False
        allow_free_content = False  # Expired trials get NO content
    elif is_free_trial:
        has_access = False
        allow_free_content = True   # Active trials get free content only
    elif plan_status.get("use_item_level_locking"):
        # Expired paid plan - lock all content
        has_access = False
        allow_free_content = False
    else:
        has_access = has_subscription_access(user_plan, user_features)
        allow_free_content = True   # Active paid users get everything
    
    # Get all courses - sort by order, with null/missing order at the end
    courses_cursor = db.courses.find({}, {"_id": 0})
    all_courses = await courses_cursor.to_list(100)
    
    # Sort courses: those with order first (by order), then those without order (by created_at or title)
    courses_with_order = [c for c in all_courses if c.get("order") is not None]
    courses_without_order = [c for c in all_courses if c.get("order") is None]
    
    courses_with_order.sort(key=lambda x: x.get("order", 0))
    courses_without_order.sort(key=lambda x: x.get("created_at", "") or x.get("title", ""))
    
    courses = courses_with_order + courses_without_order
    
    if not courses:
        # Return legacy video format if no courses exist
        return await get_legacy_videos_as_courses(db, has_access)
    
    course_ids = [c.get("id") for c in courses]
    
    # Batch fetch all modules for all courses at once
    all_modules = await db.course_modules.find(
        {"course_id": {"$in": course_ids}}, {"_id": 0}
    ).sort("order", 1).to_list(1000)
    
    module_ids = [m.get("id") for m in all_modules]
    
    # Batch fetch all sessions at once (now linked directly to modules via module_id)
    all_sessions = await db.course_sessions.find(
        {"module_id": {"$in": module_ids}}, {"_id": 0}
    ).sort("order", 1).to_list(5000)
    
    # Group sessions by module_id
    sessions_by_module = {}
    for session in all_sessions:
        mid = session.get("module_id")
        if mid not in sessions_by_module:
            sessions_by_module[mid] = []
        sessions_by_module[mid].append(session)
    
    # Group modules by course_id
    modules_by_course = {}
    for module in all_modules:
        cid = module.get("course_id")
        if cid not in modules_by_course:
            modules_by_course[cid] = []
        modules_by_course[cid].append(module)
    
    # Sort modules within each course by order (null values at end)
    for cid in modules_by_course:
        modules_list = modules_by_course[cid]
        with_order = [m for m in modules_list if m.get("order") is not None]
        without_order = [m for m in modules_list if m.get("order") is None]
        with_order.sort(key=lambda x: x.get("order", 0))
        modules_by_course[cid] = with_order + without_order
    
    # Sort sessions within each module by order (null values at end)
    for mid in sessions_by_module:
        sessions_list = sessions_by_module[mid]
        with_order = [s for s in sessions_list if s.get("order") is not None]
        without_order = [s for s in sessions_list if s.get("order") is None]
        with_order.sort(key=lambda x: x.get("order", 0))
        sessions_by_module[mid] = with_order + without_order
    
    # Build result structure (3-level: Course -> Module -> Session)
    result = []
    
    for course in courses:
        course_id = course.get("id")
        course_modules = []
        
        for module in modules_by_course.get(course_id, []):
            module_id = module.get("id")
            module_sessions = []
            
            for session in sessions_by_module.get(module_id, []):
                session_is_free = session.get("is_free", False)
                session_data = {
                    "id": session.get("id"),
                    "title": session.get("title"),
                    "description": session.get("description", ""),
                    "duration": session.get("duration", ""),
                    "content_type": session.get("content_type", "video"),
                    "video_url": session.get("video_url"),
                    "pdf_url": session.get("pdf_url"),
                    "quiz_questions": session.get("quiz_questions"),
                    "attachments": session.get("attachments", []),
                    "thumbnail": session.get("thumbnail"),
                    "order": session.get("order", 0),
                    "is_free": session_is_free,
                    "locked": False
                }
                
                # Determine if session should be locked:
                # - Expired trial: ALL sessions locked (even free ones)
                # - Active trial: Only non-free sessions locked
                # - Paid subscription: Nothing locked (if has_access)
                should_lock = False
                if not has_access:
                    if not allow_free_content:
                        # Expired trial: lock everything
                        should_lock = True
                    elif not session_is_free:
                        # Active trial: lock non-free content
                        should_lock = True
                
                if should_lock:
                    session_data["locked"] = True
                    session_data["video_url"] = None
                    session_data["pdf_url"] = None
                    session_data["quiz_questions"] = None
                    session_data["attachments"] = []
                
                module_sessions.append(session_data)
            
            course_modules.append({
                "id": module.get("id"),
                "title": module.get("title"),
                "order": module.get("order", 0),
                "sessions": module_sessions,
                "total_duration": module.get("total_duration", "")
            })
        
        result.append({
            "id": course_id,
            "title": course.get("title"),
            "description": course.get("description", ""),
            "thumbnail": course.get("thumbnail"),
            "order": course.get("order", 0),
            "modules": course_modules
        })
    
    return {"courses": result, "plan_status": plan_status}


async def get_legacy_videos_as_courses(db, has_access):
    """Convert legacy videos to course format for backwards compatibility"""
    legacy_videos = await db.videos.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not legacy_videos:
        return []
    
    # Group by module - now modules contain sessions directly (no submodules)
    modules_map = {}
    for i, video in enumerate(legacy_videos):
        module_name = video.get("module", "General")
        if module_name not in modules_map:
            modules_map[module_name] = []
        
        video_is_free = video.get("is_free", False)
        session_data = {
            "id": video.get("id", f"video-{i}"),
            "title": video.get("title"),
            "description": video.get("description", ""),
            "duration": video.get("duration", "0:00"),
            "content_type": "video",
            "video_url": video.get("video_url"),
            "pdf_url": None,
            "quiz_questions": None,
            "attachments": [],
            "thumbnail": video.get("thumbnail"),
            "order": video.get("order", i),
            "is_free": video_is_free,
            "locked": not has_access and not video_is_free
        }
        if session_data["locked"]:
            session_data["video_url"] = None
            
        modules_map[module_name].append(session_data)
    
    # New 3-level structure: Course -> Module -> Session (no submodules)
    legacy_modules = []
    for idx, (module_name, sessions) in enumerate(modules_map.items()):
        legacy_modules.append({
            "id": f"legacy-module-{idx}",
            "title": module_name,
            "order": idx,
            "sessions": sessions,  # Sessions directly under module
            "total_duration": ""
        })
    
    return [{
        "id": "legacy-course",
        "title": "Interview Preparation Course",
        "description": "Complete guide to consulting interview preparation",
        "thumbnail": legacy_videos[0].get("thumbnail") if legacy_videos else "",
        "order": 0,
        "modules": legacy_modules
    }]


@router.get("/workshops")
async def get_workshops(request: Request):
    """Get workshops with access control based on plan settings"""
    user = await get_current_user(request)
    db = get_db(request)
    
    workshops = await db.workshops.find({}, {"_id": 0}).sort("date", -1).to_list(100)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    
    # Check if user's plan is expired
    plan_status = check_plan_status(user)
    is_plan_expired = (
        plan_status.get("subscription_expired") or 
        plan_status.get("coaching_program_expired") or
        plan_status.get("trial_expired")
    )
    is_free_trial = plan_status.get("is_trial", False)
    
    # Get the workshop access level from the plan configuration
    # Priority: user's features > plan configuration > default ("none")
    workshop_access = "none"  # Default: no access
    
    # If plan is expired or user is on free trial, no workshop access
    if is_plan_expired or is_free_trial:
        workshop_access = "none"
    elif user_features and user_features.get("workshops"):
        # First check if user has explicit features set
        workshop_access = user_features.get("workshops")
    else:
        # Fetch the plan configuration from database
        plan_config = await db.plans.find_one({"plan_key": user_plan}, {"_id": 0, "features": 1})
        if plan_config and plan_config.get("features"):
            workshop_access = plan_config["features"].get("workshops", "none")
    
    # workshop_access can be:
    # - "none": No access to any workshops
    # - "only_recorded": Only past/recorded workshops
    # - "recorded_and_live": Both live (upcoming) and recorded workshops
    
    # Check if user is registered for any workshops
    user_registrations = await db.workshop_registrations.find(
        {"user_id": user_id},
        {"workshop_id": 1}
    ).to_list(100)
    registered_workshop_ids = {r["workshop_id"] for r in user_registrations}
    
    # OPTIMIZATION: Get all registration counts in a single aggregation query
    # instead of querying for each workshop individually (N+1 problem fix)
    workshop_ids = [w.get("id", "") for w in workshops if w.get("id")]
    registration_counts = {}
    if workshop_ids:
        pipeline = [
            {"$match": {"workshop_id": {"$in": workshop_ids}}},
            {"$group": {"_id": "$workshop_id", "count": {"$sum": 1}}}
        ]
        counts_cursor = db.workshop_registrations.aggregate(pipeline)
        async for doc in counts_cursor:
            registration_counts[doc["_id"]] = doc["count"]
    
    result = []
    for workshop in workshops:
        workshop_id = workshop.get("id", "")
        is_past = workshop.get("is_past", workshop.get("status") == "completed")
        is_free = workshop.get("is_free", False)
        is_registered = workshop_id in registered_workshop_ids
        
        # Get registration count from pre-fetched data
        registration_count = registration_counts.get(workshop_id, 0)
        
        workshop_data = {
            "id": workshop_id,
            "title": workshop.get("title", ""),
            "description": workshop.get("description", ""),
            "mentor_name": workshop.get("instructor", workshop.get("mentor_name", workshop.get("host", ""))),
            "instructor_title": workshop.get("instructor_title", ""),
            "date": workshop.get("date", ""),
            "time": workshop.get("time", ""),
            "duration": workshop.get("duration", ""),
            "is_past": is_past,
            "status": workshop.get("status", "upcoming"),
            "recording_url": workshop.get("video_url", workshop.get("recording_url", "")),
            "video_url": workshop.get("video_url", workshop.get("recording_url", "")),
            "meeting_link": workshop.get("meeting_link", ""),
            "thumbnail": workshop.get("thumbnail", ""),
            "thumbnail_hero": workshop.get("thumbnail_hero"),
            "thumbnail_card": workshop.get("thumbnail_card"),
            "thumbnail_recording": workshop.get("thumbnail_recording"),
            "is_free": is_free,
            "locked": False,
            "lock_reason": None,
            "max_participants": workshop.get("max_participants", 50),
            "registration_count": registration_count,
            "is_registered": is_registered,
            "can_register": False
        }
        
        # Determine access based on workshop type and plan
        if is_free:
            # Free workshops are accessible to everyone
            workshop_data["locked"] = False
            workshop_data["can_register"] = not is_past and not is_registered
        elif workshop_access == "none":
            # No access - everything locked
            workshop_data["locked"] = True
            workshop_data["lock_reason"] = "upgrade_required"
            workshop_data["recording_url"] = None
            workshop_data["video_url"] = None
            workshop_data["meeting_link"] = None
        elif workshop_access == "only_recorded":
            if is_past:
                # Can access recordings
                workshop_data["locked"] = False
            else:
                # Upcoming workshops locked
                workshop_data["locked"] = True
                workshop_data["lock_reason"] = "upgrade_for_live"
                workshop_data["can_register"] = False
        elif workshop_access == "recorded_and_live":
            # Full access
            workshop_data["locked"] = False
            workshop_data["can_register"] = not is_past and not is_registered
        
        result.append(workshop_data)
    
    # Return workshops along with the user's access level for UI decisions
    return {
        "workshops": result,
        "access_level": workshop_access,
        "is_plan_expired": is_plan_expired,
        "is_free_trial": is_free_trial
    }


@router.post("/workshops/{workshop_id}/register")
async def register_for_workshop(workshop_id: str, request: Request):
    """Register user for an upcoming workshop"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    user_email = user.get("email") if isinstance(user, dict) else user.email
    user_name = user.get("name") if isinstance(user, dict) else user.name
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    
    # Get workshop details
    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Workshop not found")
    
    # Check if workshop is upcoming (not past/completed)
    if workshop.get("is_past") or workshop.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot register for past workshops")
    
    # Check user's access level
    plan_status = check_plan_status(user)
    is_plan_expired = (
        plan_status.get("subscription_expired") or 
        plan_status.get("coaching_program_expired") or
        plan_status.get("trial_expired")
    )
    is_free_trial = plan_status.get("is_trial", False)
    
    # Get workshop access level
    workshop_access = "none"
    if is_plan_expired or is_free_trial:
        workshop_access = "none"
    elif user_features and user_features.get("workshops"):
        workshop_access = user_features.get("workshops")
    else:
        plan_config = await db.plans.find_one({"plan_key": user_plan}, {"_id": 0, "features": 1})
        if plan_config and plan_config.get("features"):
            workshop_access = plan_config["features"].get("workshops", "none")
    
    # Only users with "recorded_and_live" access can register for live workshops
    if workshop_access != "recorded_and_live" and not workshop.get("is_free"):
        raise HTTPException(status_code=403, detail="Your plan does not include live workshop access. Please upgrade to register.")
    
    # Check if already registered
    existing = await db.workshop_registrations.find_one({
        "workshop_id": workshop_id,
        "user_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You are already registered for this workshop")
    
    # Check max participants
    max_participants = workshop.get("max_participants", 50)
    current_count = await db.workshop_registrations.count_documents({"workshop_id": workshop_id})
    if current_count >= max_participants:
        raise HTTPException(status_code=400, detail="Workshop is full. No more registrations available.")
    
    # Create Google Calendar event with the workshop's meeting link
    # All registrants get the SAME meeting link set by admin
    meet_link = workshop.get("meeting_link")  # Use the workshop's pre-set link
    calendar_event_id = None
    
    try:
        from services.calendar_service import GoogleCalendarService
        
        calendar_service = GoogleCalendarService()
        if calendar_service.is_available():
            # Parse workshop date and time
            workshop_date = workshop.get("date")
            workshop_time = workshop.get("time", "10:00")
            duration_str = workshop.get("duration", "1 hour")
            
            # Parse duration (e.g., "2 hours" -> 120 minutes)
            duration_minutes = 60  # default
            if "hour" in duration_str.lower():
                try:
                    hours = float(duration_str.lower().replace("hours", "").replace("hour", "").strip())
                    duration_minutes = int(hours * 60)
                except:
                    pass
            
            # Create calendar event WITH the workshop's meeting link (not a new one)
            event_result = calendar_service.create_workshop_event_with_link(
                workshop_title=workshop.get("title"),
                workshop_description=workshop.get("description", ""),
                instructor_name=workshop.get("instructor", ""),
                workshop_date=workshop_date,
                workshop_time=workshop_time,
                duration_minutes=duration_minutes,
                attendee_email=user_email,
                attendee_name=user_name,
                meeting_link=meet_link  # Pass the workshop's existing link
            )
            
            if event_result:
                calendar_event_id = event_result.get("event_id")
    except Exception as e:
        import logging
        logging.error(f"Failed to create calendar event for workshop registration: {e}")
    
    # Create registration
    registration = {
        "id": str(uuid.uuid4()),
        "workshop_id": workshop_id,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "meet_link": meet_link,
        "calendar_event_id": calendar_event_id,
        "registered_at": datetime.utcnow(),
        "status": "registered"
    }
    
    await db.workshop_registrations.insert_one(registration)
    
    # Sync to Google Sheet - "Workshop Sign-ups" tab
    try:
        # Fetch full user profile for all available data
        full_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if full_user:
            import asyncio as _asyncio
            _asyncio.create_task(append_workshop_registration_to_sheet(full_user, workshop))
    except Exception as e:
        import logging as _logging
        _logging.error(f"Failed to trigger Google Sheet sync for workshop registration: {e}")
    
    # Send confirmation email
    try:
        from services.email_service import send_email
        
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Workshop Registration Confirmed! 🎉</h2>
            <p>Hi {user_name},</p>
            <p>You have successfully registered for the following workshop:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e293b; margin-top: 0;">{workshop.get("title")}</h3>
                <p style="color: #64748b; margin-bottom: 10px;">{workshop.get("description", "")}</p>
                <p><strong>Instructor:</strong> {workshop.get("instructor", "TBA")}</p>
                <p><strong>Date:</strong> {workshop.get("date")}</p>
                <p><strong>Time:</strong> {workshop.get("time")} IST</p>
                <p><strong>Duration:</strong> {workshop.get("duration", "1 hour")}</p>
            </div>
            
            {"<p><strong>Meeting Link:</strong> <a href='" + meet_link + "'>" + meet_link + "</a></p>" if meet_link else "<p>Meeting link will be shared before the workshop.</p>"}
            
            <p style="color: #64748b; font-size: 14px;">A calendar invite has been sent to your email. The Join button will appear on your dashboard 15 minutes before the workshop starts.</p>
            
            <p>See you at the workshop!</p>
            <p>Team gradnext</p>
        </div>
        """
        
        await send_email(
            to_email=user_email,
            subject=f"Workshop Registration Confirmed: {workshop.get('title')}",
            html_content=email_html,
            from_email="hi@mail.gradnext.co"
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send workshop registration email: {e}")
    
    # Send WhatsApp registration confirmation
    try:
        from services.wati_service import wati_service
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        phone = user_data.get("phone_number", "") if user_data else ""
        if phone:
            first_name = user_data.get("first_name") or user_data.get("name", "").split()[0] if user_data.get("name") else "there"
            parameters = [
                {"name": "1", "value": first_name},
                {"name": "2", "value": workshop.get("title", "")},
                {"name": "3", "value": workshop.get("instructor", workshop.get("host", ""))},
                {"name": "4", "value": workshop.get("date", "")},
                {"name": "5", "value": workshop.get("time", "")},
                {"name": "6", "value": workshop.get("duration", "")}
            ]
            import asyncio as _async
            _async.create_task(wati_service.send_template_message(
                recipient_number=phone,
                template_name="workshop_registration_confirmation_vf",
                parameters=parameters
            ))
    except Exception as e:
        import logging as _log
        _log.error(f"Failed to send WhatsApp workshop registration confirmation: {e}")
    
    return {
        "success": True,
        "message": "Successfully registered for workshop",
        "registration_id": registration["id"],
        "meet_link": meet_link
    }


@router.delete("/workshops/{workshop_id}/unregister")
async def unregister_from_workshop(workshop_id: str, request: Request):
    """Unregister user from a workshop"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Find and delete registration
    registration = await db.workshop_registrations.find_one_and_delete({
        "workshop_id": workshop_id,
        "user_id": user_id
    })
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    # Try to delete calendar event
    if registration.get("calendar_event_id"):
        try:
            from services.calendar_service import GoogleCalendarService
            calendar_service = GoogleCalendarService()
            if calendar_service.is_available():
                calendar_service.delete_event(registration["calendar_event_id"])
        except Exception as e:
            import logging
            logging.error(f"Failed to delete calendar event: {e}")
    
    return {"success": True, "message": "Successfully unregistered from workshop"}


@router.get("/drills")
async def get_drills(request: Request):
    """Get case drills with access control"""
    user = await get_current_user(request)
    db = get_db(request)
    
    drills = await db.drills.find({}, {"_id": 0}).to_list(100)
    
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    has_access = has_subscription_access(user_plan, user_features)
    
    result = []
    for i, drill in enumerate(drills):
        drill_data = {
            "id": drill.get("id", f"drill-{i}"),
            "title": drill.get("title", "Untitled Drill"),
            "category": drill.get("category", "General"),
            "difficulty": drill.get("difficulty", "beginner"),
            "duration": drill.get("duration", "15 min"),
            "description": drill.get("description", ""),
            "is_free": drill.get("is_free", False),
            "questions": drill.get("questions", []),
            "locked": False
        }
        # Free trial: only first 3 drills unlocked
        if not has_access and i >= 3:
            drill_data["locked"] = True
        result.append(drill_data)
    
    return result


@router.get("/materials")
async def get_materials(request: Request):
    """Get case interview materials - always accessible"""
    await get_current_user(request)  # Verify authentication
    db = get_db(request)
    
    materials = await db.materials.find({}, {"_id": 0}).to_list(100)
    
    result = []
    for material in materials:
        # Return all fields from the database with defaults
        material_data = {
            "id": material.get("id", ""),
            "title": material.get("title", ""),
            "category": material.get("category", ""),
            "description": material.get("description", ""),
            "file_url": material.get("file_url", ""),
            "file_type": material.get("file_type", "pdf"),
            "is_free": material.get("is_free", True),
            "locked": False  # Always accessible
        }
        result.append(material_data)
    
    return result


@router.get("/peer-practice/status")
async def get_peer_practice_status(request: Request):
    """Get peer practice access status"""
    user = await get_current_user(request)
    user_data = user if isinstance(user, dict) else user.__dict__
    
    user_features = user.get("features") if isinstance(user, dict) else getattr(user, 'features', None)
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    
    # Get comprehensive plan status to check for expiry
    plan_status = check_plan_status(user_data)
    
    # Check if plan is expired
    if plan_status.get("use_item_level_locking"):
        # Expired plan - no access
        return {
            "has_access": False,
            "plan_status": plan_status,
            "total_members": 1000,
            "countries": 13,
            "message": "Your plan has expired. Renew to access peer practice."
        }
    
    # Check specific peer_practice feature first, then fall back to subscription access
    has_access = False
    if user_features and user_features.get("peer_practice"):
        has_access = True
    else:
        has_access = has_subscription_access(user_plan, user_features)
    
    return {
        "has_access": has_access,
        "plan_status": plan_status,
        "total_members": 1000,
        "countries": 13,
        "message": "Unlock peer-to-peer practice with a subscription" if not has_access else "You have access to peer practice"
    }


@router.get("/cohort/sessions")
async def get_cohort_sessions(request: Request):
    """Get cohort sessions"""
    user = await get_current_user(request)
    db = get_db(request)
    
    has_access = has_cohort_access(user.plan)
    
    if not has_access:
        return {
            "has_access": False,
            "sessions": [],
            "message": "Purchase a cohort plan to access live sessions"
        }
    
    sessions = await db.cohort_sessions.find({
        "batch": user.cohort_batch
    }).sort("week", 1).to_list(100)
    
    result = []
    for session in sessions:
        session_data = CohortSession(**session).dict()
        result.append(session_data)
    
    return {
        "has_access": True,
        "batch": user.cohort_batch,
        "sessions": result
    }


@router.get("/cohort/active")
async def get_active_cohort(request: Request):
    """Get the currently active cohort (for enrolled users)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # If user is enrolled in a cohort, return that cohort's details
    if user.cohort_id:
        cohort = await db.cohorts.find_one({"id": user.cohort_id}, {"_id": 0})
        if cohort:
            # Get sections and resources
            sections = await db.cohort_sections.find(
                {"cohort_id": cohort["id"]}, {"_id": 0}
            ).to_list(50)
            resources = await db.cohort_resources.find(
                {"cohort_id": cohort["id"]}, {"_id": 0}
            ).to_list(100)
            
            cohort["sections"] = sections
            cohort["resources"] = resources
            cohort["is_enrolled"] = True
            
            return {"cohort": cohort, "enrolled": True}
    
    # If not enrolled, return the active cohort info (read-only)
    active_cohort = await db.cohorts.find_one({"status": "active"}, {"_id": 0})
    if active_cohort:
        active_cohort["is_enrolled"] = False
        return {"cohort": active_cohort, "enrolled": False, "message": "You are not enrolled in this cohort"}
    
    return {"cohort": None, "enrolled": False, "message": "No active cohort at this time"}


@router.get("/cohort/registering")
async def get_registering_cohort(request: Request):
    """Get the cohort currently accepting registrations"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Check if user is already enrolled in any cohort
    is_enrolled = bool(user.cohort_id)
    
    # Get registering cohort
    registering_cohort = await db.cohorts.find_one({"status": "registering"}, {"_id": 0})
    
    if not registering_cohort:
        return {
            "cohort": None,
            "can_register": False,
            "message": "No cohort currently accepting registrations"
        }
    
    # Count current registrations
    current_members = await db.users.count_documents({"cohort_id": registering_cohort["id"]})
    max_participants = registering_cohort.get("max_participants", 50)
    spots_remaining = max(0, max_participants - current_members)
    
    registering_cohort["current_members"] = current_members
    registering_cohort["spots_remaining"] = spots_remaining
    registering_cohort["is_full"] = spots_remaining == 0
    
    return {
        "cohort": registering_cohort,
        "can_register": not is_enrolled and spots_remaining > 0,
        "is_enrolled_elsewhere": is_enrolled,
        "message": "You are already enrolled in a cohort" if is_enrolled else None
    }


@router.post("/cohort/register/{cohort_id}")
async def register_for_cohort(cohort_id: str, request: Request):
    """Register current user for a cohort (self-registration)"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Check if user is already enrolled
    if user.cohort_id:
        raise HTTPException(status_code=400, detail="You are already enrolled in a cohort")
    
    # Get the cohort
    cohort = await db.cohorts.find_one({"id": cohort_id, "status": "registering"}, {"_id": 0})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found or not accepting registrations")
    
    # Check if cohort is full
    current_members = await db.users.count_documents({"cohort_id": cohort_id})
    max_participants = cohort.get("max_participants", 50)
    
    if current_members >= max_participants:
        raise HTTPException(status_code=400, detail="This cohort is full")
    
    # Enroll the user
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "cohort_id": cohort_id,
            "cohort_batch": cohort["name"],
            "cohort_enrolled_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": f"Successfully registered for '{cohort['name']}'",
        "cohort_id": cohort_id,
        "cohort_name": cohort["name"]
    }


@router.get("/cohort/my-enrollment")
async def get_my_cohort_enrollment(request: Request):
    """Get current user's cohort enrollment status"""
    user = await get_current_user(request)
    db = get_db(request)
    
    if not user.cohort_id:
        # Check for registering cohort
        registering = await db.cohorts.find_one({"status": "registering"}, {"_id": 0})
        return {
            "enrolled": False,
            "cohort": None,
            "registering_cohort_available": registering is not None,
            "registering_cohort": registering
        }
    
    # Get enrolled cohort details
    cohort = await db.cohorts.find_one({"id": user.cohort_id}, {"_id": 0})
    if not cohort:
        return {"enrolled": False, "cohort": None}
    
    # Get sections and resources
    sections = await db.cohort_sections.find({"cohort_id": cohort["id"]}, {"_id": 0}).to_list(50)
    resources = await db.cohort_resources.find({"cohort_id": cohort["id"]}, {"_id": 0}).to_list(100)
    
    cohort["sections"] = sections
    cohort["resources"] = resources
    
    return {
        "enrolled": True,
        "cohort": cohort,
        "enrolled_at": user.cohort_enrolled_at if hasattr(user, 'cohort_enrolled_at') else None
    }

@router.get("/progress")
async def get_user_progress(request: Request):
    """Get user's learning progress"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    progress = await db.progress.find_one({"user_id": user_id})
    
    if not progress:
        progress = UserProgress(user_id=user_id)
        await db.progress.insert_one(progress.dict())
        progress = progress.dict()
    
    # Get actual total videos count - only count items explicitly marked as videos
    total_videos = await db.course_sessions.count_documents({"content_type": "video"})
    if total_videos == 0:
        total_videos = await db.videos.count_documents({})
    
    # Count unique completed drills from drill_completions collection
    completed_drills_pipeline = [
        {"$match": {
            "user_id": user_id,
            "drill_type": {"$in": ["case_math", "case_structuring"]}
        }},
        {"$group": {"_id": "$drill_id"}},
        {"$count": "total"}
    ]
    drill_result = await db.drill_completions.aggregate(completed_drills_pipeline).to_list(1)
    completed_drills_count = drill_result[0]["total"] if drill_result else 0
    
    total_workshops = await db.workshops.count_documents({"is_past": True})
    
    # Get the list of completed video IDs
    videos_completed_list = progress.get("videos_completed", [])
    
    return {
        "videos_completed": videos_completed_list,  # Return the actual list of IDs
        "videos_completed_count": len(videos_completed_list),
        "total_videos": total_videos,
        "drills_completed": completed_drills_count,
        "total_drills": get_total_drills_count(),  # Dynamic count from PRE_GENERATED_DRILLS
        "workshops_attended": len(progress.get("workshops_attended", [])),
        "total_workshops": total_workshops,
        "peer_sessions_count": progress.get("peer_sessions_count", 0)
    }


@router.post("/progress/video/{video_id}")
async def mark_video_complete(video_id: str, request: Request):
    """Mark a video as completed"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    await db.progress.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"videos_completed": video_id},
            "$set": {"updated_at": __import__("datetime").datetime.utcnow()}
        },
        upsert=True
    )
    
    return {"message": "Video marked as complete"}


@router.post("/progress/drill/{drill_id}")
async def mark_drill_complete(drill_id: str, request: Request):
    """Mark a drill as completed"""
    user = await get_current_user(request)
    db = get_db(request)
    
    user_id = user.get("id") if isinstance(user, dict) else user.id
    await db.progress.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"drills_completed": drill_id},
            "$set": {"updated_at": __import__("datetime").datetime.utcnow()}
        },
        upsert=True
    )
    
    return {"message": "Drill marked as complete"}


@router.get("/dashboard-summary")
async def get_dashboard_summary(request: Request):
    """Get dashboard summary based on user's plan"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get user id from session
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # IMPORTANT: Fetch fresh user data from database instead of using session data
    # This ensures we get the latest coaching_sessions_remaining after purchases
    fresh_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not fresh_user:
        # Fallback to session user if not found in DB (shouldn't happen)
        fresh_user = user if isinstance(user, dict) else user.dict() if hasattr(user, 'dict') else {}
    
    user_plan = fresh_user.get("plan", "")
    user_features = fresh_user.get("features")
    
    progress = await db.progress.find_one({"user_id": user_id}) or {}
    
    has_sub = has_subscription_access(user_plan, user_features)
    has_coaching = has_coaching_access(user_plan)
    has_cohort = has_cohort_access(user_plan)
    
    # Also grant coaching access if user has purchased single sessions (coaching_sessions_remaining > 0)
    # This allows users without a coaching plan to still book sessions after purchasing credits
    user_coaching_remaining = fresh_user.get("coaching_sessions_remaining", 0) or 0
    if user_coaching_remaining and user_coaching_remaining > 0:
        has_coaching = True
    
    # Get user's completed videos count and actual total videos
    user_videos_completed = len(progress.get("videos_completed", []))
    
    # Get actual total videos count - only count items explicitly marked as videos
    # First try course_sessions with content_type="video"
    total_videos = await db.course_sessions.count_documents({"content_type": "video"})
    
    # If no videos in course_sessions, check the videos collection
    if total_videos == 0:
        total_videos = await db.videos.count_documents({})
    
    # Count unique completed drills from drill_completions collection
    # This counts distinct drill_ids the user has completed (not repeat attempts)
    completed_drills_pipeline = [
        {"$match": {
            "user_id": user_id,
            "drill_type": {"$in": ["case_math", "case_structuring"]}
        }},
        {"$group": {"_id": "$drill_id"}},
        {"$count": "total"}
    ]
    drill_result = await db.drill_completions.aggregate(completed_drills_pipeline).to_list(1)
    completed_drills_count = drill_result[0]["total"] if drill_result else 0
    
    # Get upcoming coaching sessions (confirmed, not cancelled, future dates)
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(pytz.UTC).astimezone(ist)
    today = now_ist.strftime("%Y-%m-%d")
    current_time = now_ist.strftime("%H:%M")
    
    # Calculate time 15 minutes ago for join window (sessions are joinable until 15 mins after start)
    join_window_cutoff = (now_ist - timedelta(minutes=15)).strftime("%H:%M")
    
    # Auto-complete coaching sessions ONLY when BOTH parties have checked in
    # This replaces the old time-based auto-completion
    await db.bookings.update_many(
        {
            "status": {"$nin": ["cancelled", "completed"]},
            "candidate_checked_in": True,
            "mentor_checked_in": True
        },
        {"$set": {"status": "completed"}}
    )
    
    # Auto-complete peer sessions ONLY when BOTH parties have checked in
    await db.peer_sessions.update_many(
        {
            "status": {"$in": ["pending", "confirmed", "matched"]},
            "requester_checked_in": True,
            "partner_checked_in": True
        },
        {"$set": {"status": "completed"}}
    )
    
    # For sessions from BEFORE today (not today), mark based on check-in status
    # Only auto-update sessions that are still "pending" or "confirmed"
    # Don't touch sessions with terminal statuses (no_show, cancelled, rescheduled variants)
    yesterday = (now_ist - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Terminal statuses that should NOT be auto-changed
    terminal_statuses = [
        "completed", "cancelled", "candidate_cancelled", "mentor_cancelled",
        "cancelled_by_candidate", "cancelled_by_mentor", "cancelled_by_admin",
        "no_show", "mentor_no_show", "candidate_no_show", "both_no_show",
        "rescheduled", "mentor_rescheduled", "candidate_rescheduled"
    ]
    
    # Get past sessions that need status update
    past_sessions = await db.bookings.find({
        "status": {"$nin": terminal_statuses},
        "date": {"$lt": today}  # Strictly before today
    }).to_list(1000)
    
    for session in past_sessions:
        # Determine correct status based on check-in data
        mentor_in = session.get("mentor_checked_in", False)
        candidate_in = session.get("candidate_checked_in", False)
        
        if mentor_in and candidate_in:
            new_status = "completed"
        elif mentor_in and not candidate_in:
            new_status = "candidate_no_show"
        elif not mentor_in and candidate_in:
            new_status = "mentor_no_show"
        else:
            new_status = "both_no_show"
        
        await db.bookings.update_one(
            {"id": session.get("id")},
            {"$set": {"status": new_status}}
        )
    
    await db.peer_sessions.update_many(
        {
            "status": {"$in": ["pending", "confirmed", "matched"]},
            "date": {"$lt": today}  # Strictly before today
        },
        {"$set": {"status": "completed"}}
    )
    
    # Query for upcoming bookings - exclude completed and all cancelled statuses
    cancelled_statuses = [
        "cancelled", "candidate_cancelled", "mentor_cancelled",
        "cancelled_by_candidate", "cancelled_by_mentor", "cancelled_by_admin"
    ]
    upcoming_bookings_cursor = db.bookings.find({
        "user_id": user_id,
        "status": {"$nin": cancelled_statuses + ["completed"]}
    }, {"_id": 0}).sort("date", 1)
    
    # Filter in Python to handle today's sessions correctly
    # Include sessions until 15 minutes AFTER their start time (join window)
    upcoming_bookings = []
    async for booking in upcoming_bookings_cursor:
        booking_date = booking.get("date", "")
        booking_time = booking.get("time_slot", "00:00")
        
        # Include if:
        # 1. Date is in future, OR
        # 2. Today and within join window (session time + 15 mins hasn't passed)
        if booking_date > today:
            upcoming_bookings.append(booking)
        elif booking_date == today:
            # Calculate if we're still within the 15-minute join window
            # Session is visible until 15 minutes after its start time
            try:
                session_hour, session_min = map(int, booking_time.split(":"))
                session_end_window = session_hour * 60 + session_min + 15  # Add 15 mins
                current_hour, current_min = map(int, current_time.split(":"))
                current_minutes = current_hour * 60 + current_min
                
                if current_minutes <= session_end_window:
                    upcoming_bookings.append(booking)
            except:
                # Fallback: include if time hasn't passed
                if booking_time >= current_time:
                    upcoming_bookings.append(booking)
        
        if len(upcoming_bookings) >= 5:
            break
    
    # Enrich bookings with mentor info
    for booking in upcoming_bookings:
        mentor = await db.mentors.find_one({"id": booking.get("mentor_id")}, {"_id": 0})
        if mentor:
            booking["mentor_name"] = mentor.get("name")
            booking["mentor_picture"] = mentor.get("picture")
            booking["mentor_company"] = mentor.get("company")
    
    # Get upcoming peer sessions - only confirmed/matched sessions
    # Filter to include sessions within join window (15 mins after start)
    upcoming_peer_cursor = db.peer_sessions.find({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ],
        "status": {"$in": ["confirmed", "matched"]}
    }, {"_id": 0}).sort("date", 1)
    
    upcoming_peer_sessions = []
    async for session in upcoming_peer_cursor:
        session_date = session.get("date", "")
        session_time = session.get("time_slot", "00:00")
        
        # Include if:
        # 1. Date is in future, OR
        # 2. Today and within join window (session time + 15 mins hasn't passed)
        if session_date > today:
            upcoming_peer_sessions.append(session)
        elif session_date == today:
            # Calculate if we're still within the 15-minute join window
            try:
                session_hour, session_min = map(int, session_time.split(":"))
                session_end_window = session_hour * 60 + session_min + 15  # Add 15 mins
                current_hour, current_min = map(int, current_time.split(":"))
                current_minutes = current_hour * 60 + current_min
                
                if current_minutes <= session_end_window:
                    upcoming_peer_sessions.append(session)
            except:
                # Fallback: include if time hasn't passed
                if session_time >= current_time:
                    upcoming_peer_sessions.append(session)
        
        if len(upcoming_peer_sessions) >= 5:
            break
    
    # Batch fetch peer profiles for enrichment (avoid N+1 queries)
    # Collect all user IDs that need profile lookup
    user_ids_to_lookup = set()
    for session in upcoming_peer_sessions:
        partner_pic = session.get("partner_picture", "")
        requester_pic = session.get("requester_picture", "")
        
        if session.get("partner_id") and (not partner_pic or "googleusercontent" in partner_pic or "ui-avatars" in partner_pic):
            user_ids_to_lookup.add(session["partner_id"])
        if session.get("requester_id") and (not requester_pic or "googleusercontent" in requester_pic or "ui-avatars" in requester_pic):
            user_ids_to_lookup.add(session["requester_id"])
    
    # Fetch all needed profiles in one query
    profiles_map = {}
    if user_ids_to_lookup:
        profiles = await db.peer_profiles.find(
            {"user_id": {"$in": list(user_ids_to_lookup)}},
            {"_id": 0, "user_id": 1, "profile_picture": 1, "name": 1}
        ).to_list(len(user_ids_to_lookup))
        profiles_map = {p["user_id"]: p for p in profiles}
    
    # Enrich sessions with profiles
    for session in upcoming_peer_sessions:
        partner_id = session.get("partner_id")
        requester_id = session.get("requester_id")
        
        if partner_id in profiles_map:
            profile = profiles_map[partner_id]
            if profile.get("profile_picture"):
                session["partner_picture"] = profile["profile_picture"]
            if not session.get("partner_name") and profile.get("name"):
                session["partner_name"] = profile["name"]
        
        if requester_id in profiles_map:
            profile = profiles_map[requester_id]
            if profile.get("profile_picture"):
                session["requester_picture"] = profile["profile_picture"]
            if not session.get("requester_name") and profile.get("name"):
                session["requester_name"] = profile["name"]
    
    # Get upcoming workshops
    upcoming_workshops = await db.workshops.find({
        "status": "upcoming",
        "date": {"$gte": today}
    }, {"_id": 0}).sort("date", 1).to_list(5)
    
    # Get upcoming strategy call sessions
    # Auto-complete strategy calls ONLY when both parties have checked in
    await db.strategy_call_sessions.update_many(
        {
            "status": {"$in": ["scheduled", "confirmed"]},
            "candidate_checked_in": True,
            "mentor_checked_in": True
        },
        {"$set": {"status": "completed"}}
    )
    
    # For strategy calls from BEFORE today, update based on check-in status
    terminal_statuses_strategy = [
        "completed", "cancelled", "candidate_cancelled", "mentor_cancelled",
        "no_show", "mentor_no_show", "candidate_no_show", "both_no_show"
    ]
    
    past_strategy_sessions = await db.strategy_call_sessions.find({
        "status": {"$nin": terminal_statuses_strategy},
        "date": {"$lt": today}
    }).to_list(1000)
    
    for session in past_strategy_sessions:
        mentor_in = session.get("mentor_checked_in", False)
        candidate_in = session.get("candidate_checked_in", False)
        
        if mentor_in and candidate_in:
            new_status = "completed"
        elif mentor_in and not candidate_in:
            new_status = "candidate_no_show"
        elif not mentor_in and candidate_in:
            new_status = "mentor_no_show"
        else:
            new_status = "both_no_show"
        
        await db.strategy_call_sessions.update_one(
            {"id": session.get("id")},
            {"$set": {"status": new_status}}
        )
    
    # Query for upcoming strategy call sessions
    upcoming_strategy_cursor = db.strategy_call_sessions.find({
        "user_id": user_id,
        "status": {"$in": ["scheduled", "confirmed"]}
    }, {"_id": 0}).sort("date", 1)
    
    upcoming_strategy_sessions = []
    async for session in upcoming_strategy_cursor:
        session_date = session.get("date", "")
        session_time = session.get("time", "00:00")
        
        # Include if:
        # 1. Date is in future, OR
        # 2. Today and within join window (session time + 15 mins hasn't passed)
        if session_date > today:
            upcoming_strategy_sessions.append(session)
        elif session_date == today:
            # Calculate if we're still within the 15-minute join window
            try:
                session_hour, session_min = map(int, session_time.split(":"))
                session_end_window = session_hour * 60 + session_min + 15  # Add 15 mins
                current_hour, current_min = map(int, current_time.split(":"))
                current_minutes = current_hour * 60 + current_min
                
                if current_minutes <= session_end_window:
                    upcoming_strategy_sessions.append(session)
            except:
                # Fallback: include if time hasn't passed
                if session_time >= current_time:
                    upcoming_strategy_sessions.append(session)
        
        if len(upcoming_strategy_sessions) >= 5:
            break
    
    # Enrich strategy sessions with mentor info
    for session in upcoming_strategy_sessions:
        mentor = await db.mentors.find_one({"id": session.get("mentor_id")}, {"_id": 0})
        if mentor:
            session["mentor_name"] = mentor.get("name")
            session["mentor_picture"] = mentor.get("picture")
            session["mentor_company"] = mentor.get("company") or mentor.get("consulting_firm")
            session["mentor_title"] = mentor.get("title") or mentor.get("position")

    # === Get pending feedbacks ===
    
    # Pending coaching feedback - past sessions where user hasn't submitted feedback
    pending_coach_feedback = await db.bookings.find({
        "user_id": user_id,
        "status": "completed",
        "candidate_feedback_submitted": {"$ne": True}
    }, {"_id": 0}).sort("date", -1).to_list(10)
    
    # Enrich with mentor info
    for booking in pending_coach_feedback:
        mentor = await db.mentors.find_one({"id": booking.get("mentor_id")}, {"_id": 0})
        if mentor:
            booking["mentor_name"] = mentor.get("name")
            booking["mentor_picture"] = mentor.get("picture")
            booking["mentor_company"] = mentor.get("company")
    
    # Pending peer feedback - past sessions where user hasn't submitted feedback
    # Need to check requester_feedback or partner_feedback based on user role
    # Include:
    # 1. Sessions with status "completed"
    # 2. Past confirmed sessions (date < today)
    # 3. Today's confirmed sessions (user can give feedback after the session)
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    all_peer_needing_feedback = await db.peer_sessions.find({
        "$and": [
            {"$or": [
                {"requester_id": user_id},
                {"partner_id": user_id}
            ]},
            {"$or": [
                {"status": "completed"},
                {"status": "confirmed", "date": {"$lte": today_str}}  # Today and past confirmed sessions
            ]}
        ]
    }, {"_id": 0}).sort("date", -1).to_list(50)
    
    pending_peer_feedback = []
    for session in all_peer_needing_feedback:
        is_requester = session.get("requester_id") == user_id
        if is_requester:
            # User is requester, check if they submitted requester_feedback
            if not session.get("requester_feedback"):
                pending_peer_feedback.append(session)
        else:
            # User is partner, check if they submitted partner_feedback
            if not session.get("partner_feedback"):
                pending_peer_feedback.append(session)
    
    # Limit to 10
    pending_peer_feedback = pending_peer_feedback[:10]
    
    # Batch fetch peer profiles for pending feedback enrichment
    feedback_user_ids = set()
    for session in pending_peer_feedback:
        partner_pic = session.get("partner_picture", "")
        requester_pic = session.get("requester_picture", "")
        
        if session.get("partner_id") and (not partner_pic or "googleusercontent" in partner_pic or "ui-avatars" in partner_pic):
            feedback_user_ids.add(session["partner_id"])
        if session.get("requester_id") and (not requester_pic or "googleusercontent" in requester_pic or "ui-avatars" in requester_pic):
            feedback_user_ids.add(session["requester_id"])
    
    # Fetch all needed profiles in one query
    feedback_profiles_map = {}
    if feedback_user_ids:
        feedback_profiles = await db.peer_profiles.find(
            {"user_id": {"$in": list(feedback_user_ids)}},
            {"_id": 0, "user_id": 1, "profile_picture": 1, "name": 1}
        ).to_list(len(feedback_user_ids))
        feedback_profiles_map = {p["user_id"]: p for p in feedback_profiles}
    
    # Enrich pending feedback sessions
    for session in pending_peer_feedback:
        partner_id = session.get("partner_id")
        requester_id = session.get("requester_id")
        
        if partner_id in feedback_profiles_map:
            profile = feedback_profiles_map[partner_id]
            if profile.get("profile_picture"):
                session["partner_picture"] = profile["profile_picture"]
            if not session.get("partner_name") and profile.get("name"):
                session["partner_name"] = profile["name"]
        
        if requester_id in feedback_profiles_map:
            profile = feedback_profiles_map[requester_id]
            if profile.get("profile_picture"):
                session["requester_picture"] = profile["profile_picture"]
            if not session.get("requester_name") and profile.get("name"):
                session["requester_name"] = profile["name"]
    
    # === NEW: Get session statistics and ratings ===
    
    # Count completed coaching sessions
    completed_coaching = await db.bookings.count_documents({
        "user_id": user_id,
        "status": "completed"
    })
    
    # Count completed peer sessions
    completed_peer = await db.peer_sessions.count_documents({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ],
        "status": "completed"
    })
    
    # Get average rating from peer sessions (where user received feedback)
    # Also collect sessions data for feedback history modal
    peer_feedback_cursor = db.peer_sessions.find({
        "$or": [
            {"requester_id": user_id, "partner_feedback": {"$exists": True}},
            {"partner_id": user_id, "requester_feedback": {"$exists": True}}
        ]
    }, {"_id": 0}).sort("date", -1)
    
    peer_ratings = []
    peer_sessions_with_feedback = []
    async for session in peer_feedback_cursor:
        if session.get("requester_id") == user_id and session.get("partner_feedback"):
            # User was requester, get partner's feedback about them
            pf = session["partner_feedback"]
            rating = pf.get("average_rating") or pf.get("rating") or pf.get("overall_rating") or pf.get("rating_overall")
            if rating:
                peer_ratings.append(float(rating))
            peer_sessions_with_feedback.append(session)
        elif session.get("partner_id") == user_id and session.get("requester_feedback"):
            # User was partner, get requester's feedback about them
            rf = session["requester_feedback"]
            rating = rf.get("average_rating") or rf.get("rating") or rf.get("overall_rating") or rf.get("rating_overall")
            if rating:
                peer_ratings.append(float(rating))
            peer_sessions_with_feedback.append(session)
    
    avg_peer_rating = round(sum(peer_ratings) / len(peer_ratings), 1) if peer_ratings else None
    
    # Get average rating from coaching sessions (mentor feedback)
    # Fetch from mentor_feedbacks collection where candidate_id matches
    coach_ratings = []
    coach_sessions_with_feedback = []
    
    # Get all mentor feedbacks for this candidate
    mentor_feedbacks_cursor = db.mentor_feedbacks.find({
        "candidate_id": user_id
    }, {"_id": 0}).sort("created_at", -1)
    
    async for feedback in mentor_feedbacks_cursor:
        # Get the rating - try different field names for compatibility
        rating = feedback.get("rating_overall") or feedback.get("average_rating") or feedback.get("rating")
        if rating:
            coach_ratings.append(float(rating))
        
        # Get the associated booking for session details
        booking = await db.bookings.find_one({"id": feedback.get("booking_id")}, {"_id": 0})
        if booking:
            # Enrich with mentor info and feedback data
            mentor = await db.mentors.find_one({"id": booking.get("mentor_id")}, {"_id": 0})
            if mentor:
                booking["mentor_name"] = mentor.get("name")
                booking["mentor_picture"] = mentor.get("picture")
            
            # Attach the feedback data to the booking for the modal
            booking["mentor_feedback"] = feedback
            coach_sessions_with_feedback.append(booking)
    
    avg_coach_rating = round(sum(coach_ratings) / len(coach_ratings), 1) if coach_ratings else None
    
    # Use fresh_user data from database for response (not stale session data)
    user_data = fresh_user
    
    # Resolve profile picture: prioritize peer_profiles.profile_picture over users.picture
    # This ensures custom uploaded pictures are shown instead of Google profile pictures
    resolved_picture = user_data.get("picture")
    if user_id and not user_data.get("is_mentor") and not user_data.get("is_admin"):
        peer_profile = await db.peer_profiles.find_one(
            {"user_id": user_id}, 
            {"_id": 0, "profile_picture": 1}
        )
        if peer_profile and peer_profile.get("profile_picture"):
            resolved_picture = peer_profile["profile_picture"]
    
    # Check if user has unlimited coaching (Pinnacle plan or coaching_sessions_total = -1)
    user_plan = user_data.get("plan", "").lower()
    is_unlimited_coaching = (
        user_plan == "pinnacle" or 
        user_data.get("coaching_sessions_total") == -1 or
        user_data.get("is_unlimited_coaching", False)
    )
    
    # Calculate coaching sessions remaining properly
    if is_unlimited_coaching:
        coaching_remaining = -1  # -1 indicates unlimited
    else:
        # Calculate remaining sessions from two sources:
        # 1. Plan-based sessions: coaching_sessions_total - coaching_sessions_used
        # 2. Purchased sessions: coaching_sessions_remaining (for single session purchases)
        
        plan_total = user_data.get("coaching_sessions_total", 0) or 0
        plan_used = user_data.get("coaching_sessions_used", 0) or 0
        plan_remaining = max(0, plan_total - plan_used)
        
        # Check if admin has manually set coaching_sessions_total
        admin_set_total = user_data.get("coaching_sessions_total")
        admin_set_used = user_data.get("coaching_sessions_used", 0) or 0
        
        # If admin has set a total, use that for calculation
        if admin_set_total is not None and admin_set_total > 0:
            coaching_remaining = max(0, admin_set_total - admin_set_used)
            # IMPORTANT: Also add any additionally purchased sessions (top-ups/single session buys)
            # These are stored separately in coaching_sessions_remaining
            purchased_remaining = user_data.get("coaching_sessions_remaining", 0) or 0
            if purchased_remaining > 0:
                coaching_remaining += purchased_remaining
        else:
            # Get purchased sessions (stored in coaching_sessions_remaining)
            # This is separate from plan-based sessions
            purchased_remaining = user_data.get("coaching_sessions_remaining")
            
            # For users with coaching plans, they use plan-based tracking
            # For users without coaching plans who purchased sessions, use coaching_sessions_remaining
            coaching_plan_list = ["last_mile", "mid_mile", "full_prep", "cohort_premium", "cohort_elite"]
            user_plan_lower = user_data.get("plan", "").lower()
            
            if user_plan_lower in coaching_plan_list:
                # Coaching plan user: use plan-based calculation
                # Add any additionally purchased sessions
                coaching_remaining = plan_remaining + (purchased_remaining if purchased_remaining and purchased_remaining > 0 else 0)
            else:
                # Non-coaching plan user: use purchased sessions only
                coaching_remaining = purchased_remaining if purchased_remaining is not None else 0
    
    # ============ NEW COMPREHENSIVE PLAN STATUS CHECK ============
    # This replaces the old trial-only check with a full plan status system
    plan_status = check_plan_status(user_data)
    
    # Legacy trial_status for backward compatibility
    trial_status = check_trial_status(user_data)
    
    # Determine if ANY plan has expired (trial, subscription, or coaching)
    any_plan_expired = (
        plan_status.get("trial_expired") or 
        plan_status.get("subscription_expired") or 
        plan_status.get("coaching_program_expired")
    )
    
    # Use item-level locking when plan is expired (pages browsable, items locked)
    use_item_level_locking = plan_status.get("use_item_level_locking", False)
    
    # Determine full access vs limited access
    # Full access = active paid plan (not expired)
    # Limited access = free trial (active or expired) or expired paid plan
    has_full_access = (
        (plan_status.get("has_subscription") and not plan_status.get("subscription_expired")) or
        (plan_status.get("has_coaching_program") and not plan_status.get("coaching_program_expired"))
    )
    
    # Update access flags based on new plan status
    # If plan is expired, we use item-level locking (pages accessible, items locked)
    # If plan is active, full access to items
    if any_plan_expired and not has_full_access:
        # Expired plan: pages browsable, items locked via item-level locking
        has_sub = False  # No subscription-level content access
        has_coaching = plan_status.get("has_single_sessions", False)  # Only if has purchased sessions
        has_cohort = False
    elif plan_status.get("is_trial") and not plan_status.get("trial_expired"):
        # Active trial: pages browsable with limited free content
        # has_sub stays False (no full subscription access)
        # but pages should be accessible for browsing
        has_sub = False  # Trial users don't have full subscription access
        has_coaching = plan_status.get("has_single_sessions", False)
        has_cohort = False
    else:
        # Keep existing access calculations
        if trial_status.get("is_expired") and not has_full_access:
            has_sub = False
            has_coaching = plan_status.get("has_single_sessions", False)
            has_cohort = False
    
    # Get custom access overrides from admin (if any)
    custom_access = user_data.get("custom_access", {})
    
    # Apply custom access overrides
    # If custom_access explicitly sets a value, use it; otherwise use default
    # Also track which ones are admin-restricted (for UI to not show upgrade prompts)
    # 
    # NEW BEHAVIOR: When use_item_level_locking is True, pages are still "accessible"
    # but individual items will be locked. The access flags indicate PAGE access.
    # For active trial users, pages should also be accessible (they get limited free content)
    is_active_trial = plan_status.get("is_trial") and not plan_status.get("trial_expired")
    pages_accessible = use_item_level_locking or is_active_trial
    
    final_access = {
        "subscription": custom_access.get("subscription") if custom_access.get("subscription") is not None else has_sub,
        # Coaching page should ALWAYS be browsable (like other pages), items locked inside if no sessions
        # This follows the same pattern as courses/drills/workshops - page is accessible, items are locked based on plan
        "coaching": custom_access.get("coaching") if custom_access.get("coaching") is not None else True,
        "cohort": custom_access.get("cohort") if custom_access.get("cohort") is not None else has_cohort,
        # Page-level access - when item_level_locking is True OR active trial, pages are browsable
        "courses": custom_access.get("courses") if custom_access.get("courses") is not None else (True if pages_accessible else has_sub),
        "drills": custom_access.get("drills") if custom_access.get("drills") is not None else (True if pages_accessible else has_sub),
        "workshops": custom_access.get("workshops") if custom_access.get("workshops") is not None else (True if pages_accessible else has_sub),
        "materials": custom_access.get("materials") if custom_access.get("materials") is not None else (True if pages_accessible else has_sub),
        "peer_practice": custom_access.get("peer_practice") if custom_access.get("peer_practice") is not None else (True if pages_accessible else has_sub),
    }
    
    # Track which features were explicitly restricted by admin
    admin_restricted = {
        key: custom_access.get(key) == False 
        for key in ["courses", "drills", "workshops", "materials", "peer_practice", "coaching", "cohort"]
    }
    
    # Get peer session and strategy call limits
    peer_sessions_total = user_data.get("peer_sessions_total", -1)  # -1 = unlimited
    peer_sessions_used = user_data.get("peer_sessions_used", 0) or 0
    strategy_calls_total = user_data.get("strategy_calls_total", 0) or 0
    strategy_calls_used = user_data.get("strategy_calls_used", 0) or 0
    
    # Calculate remaining
    peer_remaining = -1 if peer_sessions_total == -1 or peer_sessions_total is None else max(0, peer_sessions_total - peer_sessions_used)
    strategy_remaining = max(0, strategy_calls_total - strategy_calls_used)
    
    return {
        "user": {
            "id": user_data.get("id"),
            "name": user_data.get("name"),
            "email": user_data.get("email"),
            "picture": resolved_picture,
            "plan": user_data.get("plan"),
            "plan_end_date": user_data.get("plan_end_date"),
            "subscription_date": user_data.get("subscription_date"),
            "subscription_end": user_data.get("subscription_end"),
            "coaching_sessions_remaining": coaching_remaining,
            "coaching_sessions_total": user_data.get("coaching_sessions_total", 0),
            "coaching_sessions_used": user_data.get("coaching_sessions_used", 0),
            "peer_sessions_remaining": peer_remaining,
            "peer_sessions_total": peer_sessions_total,
            "peer_sessions_used": peer_sessions_used,
            "strategy_calls_remaining": strategy_remaining,
            "strategy_calls_total": strategy_calls_total,
            "strategy_calls_used": strategy_calls_used,
            "is_unlimited_coaching": is_unlimited_coaching,
            "cohort_batch": user_data.get("cohort_batch"),
            "is_mentor": user_data.get("is_mentor", False),
            "is_admin": user_data.get("is_admin", False),
            "onboarding_completed": user_data.get("onboarding_completed", False)
        },
        "access": final_access,
        "admin_restricted": admin_restricted,
        # NEW: Comprehensive plan status for frontend access control
        "plan_status": {
            "plan_type": plan_status.get("plan_type"),
            "plan_category": plan_status.get("plan_category"),
            "has_full_access": has_full_access,
            "use_item_level_locking": use_item_level_locking,
            # Trial info
            "is_trial": plan_status.get("is_trial"),
            "trial_expired": plan_status.get("trial_expired"),
            "trial_days_remaining": plan_status.get("trial_days_remaining"),
            # Subscription info (days hidden to reduce churn)
            "has_subscription": plan_status.get("has_subscription"),
            "subscription_expired": plan_status.get("subscription_expired"),
            "show_subscription_days": plan_status.get("show_subscription_days"),
            # Coaching program info (days shown)
            "has_coaching_program": plan_status.get("has_coaching_program"),
            "coaching_program_expired": plan_status.get("coaching_program_expired"),
            "coaching_program_days_remaining": plan_status.get("coaching_program_days_remaining"),
            "show_coaching_days": plan_status.get("show_coaching_days"),
            # Single sessions (never expire)
            "has_single_sessions": plan_status.get("has_single_sessions"),
            "single_sessions_remaining": plan_status.get("single_sessions_remaining"),
        },
        "progress": {
            "videos_completed": user_videos_completed,
            "total_videos": total_videos,  # Actual total videos from database
            "drills_completed": completed_drills_count,
            "total_drills": get_total_drills_count(),  # Dynamic count from PRE_GENERATED_DRILLS
            "peer_sessions": progress.get("peer_sessions_count", 0)
        },
        "user_progress": {
            "total_materials": total_videos + get_total_drills_count(),
            "completed_materials": user_videos_completed + completed_drills_count,
            "total_sessions": (user_data.get("coaching_sessions_total", 0) or 0) + peer_sessions_total if peer_sessions_total != -1 else 0,
            "completed_sessions": (user_data.get("coaching_sessions_used", 0) or 0) + peer_sessions_used,
            "overall_progress": round(
                ((user_videos_completed + completed_drills_count) / max(1, total_videos + get_total_drills_count())) * 100
            )
        },
        "stats": {
            "total_sessions": completed_coaching + completed_peer,
            "coaching_sessions_done": completed_coaching,
            "peer_sessions_done": completed_peer,
            "avg_peer_rating": avg_peer_rating,
            "peer_rating_count": len(peer_ratings),
            "avg_coach_rating": avg_coach_rating,
            "coach_rating_count": len(coach_ratings),
            "peer_sessions_with_feedback": peer_sessions_with_feedback[:20],
            "coach_sessions_with_feedback": coach_sessions_with_feedback[:20]
        },
        "upcoming_sessions": {
            "coaching": upcoming_bookings,
            "peer_practice": upcoming_peer_sessions,
            "strategy_calls": upcoming_strategy_sessions,
            "workshops": upcoming_workshops
        },
        "pending_feedbacks": {
            "coaching": pending_coach_feedback,
            "peer_practice": pending_peer_feedback
        },
        "limits": {
            "free_videos": 2,
            "free_drills": 3,
            "free_workshops": 1,
            "coaching_sessions_remaining": coaching_remaining,
            "peer_sessions_remaining": peer_remaining,
        },
        "trial_status": trial_status  # Keep for backward compatibility
    }


@router.get("/cohort/resources")
async def get_cohort_resources(request: Request):
    """Get resources for user's registered cohort only"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get user plan (handle both dict and object access)
    user_plan = user.get("plan") if isinstance(user, dict) else user.plan
    user_id = user.get("id") if isinstance(user, dict) else user.id
    
    # Check if user has cohort access
    if not has_cohort_access(user_plan):
        raise HTTPException(status_code=403, detail="No cohort access. Please upgrade to a cohort plan.")
    
    # Find the user's cohort based on cohort_batch field
    cohort_name = user.get("cohort_batch") if isinstance(user, dict) else getattr(user, 'cohort_batch', None)
    
    if not cohort_name:
        # Try to get from database
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        cohort_name = user_doc.get("cohort_batch") if user_doc else None
    
    if not cohort_name:
        return {
            "has_access": True,
            "cohort": None,
            "message": "You are not assigned to a cohort yet. Please contact support."
        }
    
    # Find the cohort
    cohort = await db.cohorts.find_one({"name": cohort_name}, {"_id": 0})
    
    if not cohort:
        # Create a default cohort for this user
        cohort = {
            "id": f"cohort-default-{cohort_name.replace(' ', '-').lower()}",
            "name": cohort_name,
            "description": f"Cohort: {cohort_name}",
            "status": "active",
            "sections": [],
            "resources": []
        }
    else:
        # Get sections for this cohort
        sections = await db.cohort_sections.find(
            {"cohort_id": cohort["id"]}, 
            {"_id": 0}
        ).sort("order", 1).to_list(50)
        cohort["sections"] = sections
        
        # Get resources for this cohort
        resources = await db.cohort_resources.find(
            {"cohort_id": cohort["id"]}, 
            {"_id": 0}
        ).to_list(100)
        cohort["resources"] = resources
    
    return {
        "has_access": True,
        "cohort": cohort
    }


# ============ Public Testimonials Endpoint ============

@router.get("/testimonials")
async def get_public_testimonials(request: Request, page: Optional[str] = None):
    """Get active testimonials for public display
    
    Args:
        page: Filter by landing page (e.g., 'home', 'coaching', 'cohort')
    """
    cache_key = f"testimonials_{page}"
    cached = _rcache_get(cache_key)
    if cached is not None:
        return cached

    db = request.app.state.db
    
    # Only get active testimonials
    query = {"is_active": True}
    
    testimonials = await db.testimonials.find(query, {"_id": 0}).to_list(100)
    
    # Filter by page if specified
    if page:
        testimonials = [t for t in testimonials if page in t.get("show_on_pages", ["home"])]
    
    result = {"testimonials": testimonials}
    _rcache_set(cache_key, result)
    return result


# ============ Public Logos Endpoint ============

@router.get("/logos")
async def get_public_logos(request: Request, category: Optional[str] = None, homepage_only: Optional[bool] = None):
    """Get logos for public display"""
    cache_key = f"logos_{category}_{homepage_only}"
    cached = _rcache_get(cache_key)
    if cached is not None:
        return cached

    db = request.app.state.db
    
    query = {}
    if category:
        query["category"] = category
    if homepage_only:
        query["show_on_homepage"] = True
    
    logos = await db.logo_repository.find(query, {"_id": 0}).to_list(100)
    
    result = {"logos": logos}
    _rcache_set(cache_key, result)
    return result
