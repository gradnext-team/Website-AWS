"""
Mixpanel Analytics Service
Comprehensive tracking for user events, logins, upgrades, and activities
"""

import os
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import logging
from pathlib import Path
from dotenv import load_dotenv

# Ensure environment is loaded from the correct path
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / '.env')

# Import Mixpanel
try:
    from mixpanel import Mixpanel, Consumer
    MIXPANEL_AVAILABLE = True
except ImportError:
    MIXPANEL_AVAILABLE = False
    Mixpanel = None

logger = logging.getLogger(__name__)

# Initialize Mixpanel
MIXPANEL_PROJECT_TOKEN = os.getenv("MIXPANEL_PROJECT_TOKEN", "")

mp = None
if MIXPANEL_AVAILABLE and MIXPANEL_PROJECT_TOKEN:
    mp = Mixpanel(MIXPANEL_PROJECT_TOKEN)
    logger.info(f"Mixpanel initialized with project token")
else:
    if not MIXPANEL_AVAILABLE:
        logger.warning("Mixpanel library not installed. Analytics tracking disabled.")
    else:
        logger.warning("MIXPANEL_PROJECT_TOKEN not set. Analytics tracking disabled.")


def is_enabled() -> bool:
    """Check if Mixpanel is properly configured"""
    return mp is not None


def track_event(distinct_id: str, event_name: str, properties: Dict[str, Any] = None) -> bool:
    """
    Track a single event in Mixpanel
    
    Args:
        distinct_id: The user's unique identifier
        event_name: Name of the event (e.g., 'login', 'signup', 'upgrade_clicked')
        properties: Additional event properties
    
    Returns:
        bool: True if event was tracked successfully
    """
    if not is_enabled():
        logger.debug(f"Mixpanel not enabled, skipping event: {event_name}")
        return False
    
    try:
        props = properties or {}
        # Add timestamp
        props["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        mp.track(distinct_id, event_name, props)
        logger.info(f"[Mixpanel] Event tracked: {event_name} for user {distinct_id}")
        return True
    except Exception as e:
        logger.error(f"[Mixpanel] Failed to track event {event_name}: {e}")
        return False


def set_user_properties(distinct_id: str, properties: Dict[str, Any]) -> bool:
    """
    Set user profile properties in Mixpanel
    
    Args:
        distinct_id: The user's unique identifier
        properties: User properties to set
    
    Returns:
        bool: True if properties were set successfully
    """
    if not is_enabled():
        return False
    
    try:
        # Filter out None values
        filtered_props = {k: v for k, v in properties.items() if v is not None}
        
        mp.people_set(distinct_id, filtered_props)
        logger.info(f"[Mixpanel] User properties set for {distinct_id}")
        return True
    except Exception as e:
        logger.error(f"[Mixpanel] Failed to set user properties: {e}")
        return False


def increment_user_property(distinct_id: str, property_name: str, value: int = 1) -> bool:
    """
    Increment a numeric user property (like login_count)
    
    Args:
        distinct_id: The user's unique identifier
        property_name: Property to increment
        value: Amount to increment by (default 1)
    
    Returns:
        bool: True if successful
    """
    if not is_enabled():
        return False
    
    try:
        mp.people_increment(distinct_id, {property_name: value})
        logger.info(f"[Mixpanel] Incremented {property_name} by {value} for {distinct_id}")
        return True
    except Exception as e:
        logger.error(f"[Mixpanel] Failed to increment property: {e}")
        return False


# ============ SPECIFIC EVENT TRACKING FUNCTIONS ============

def track_login(user_id: str, user_email: str, login_method: str = "email", 
                user_plan: str = None, is_new_user: bool = False,
                ip_address: str = None, user_agent: str = None) -> bool:
    """
    Track user login event
    
    Args:
        user_id: User's unique ID
        user_email: User's email
        login_method: 'email', 'google', 'otp'
        user_plan: Current subscription plan
        is_new_user: Whether this is the user's first login
        ip_address: User's IP address
        user_agent: Browser user agent
    """
    properties = {
        "email": user_email,
        "login_method": login_method,
        "plan": user_plan,
        "is_new_user": is_new_user,
        "ip_address": ip_address,
        "user_agent": user_agent
    }
    
    # Track the login event
    result = track_event(user_id, "user_logged_in", properties)
    
    # Increment login count on user profile
    if result:
        increment_user_property(user_id, "login_count", 1)
        
        # Update last login time on profile
        set_user_properties(user_id, {
            "$last_seen": datetime.now(timezone.utc).isoformat(),
            "last_login_method": login_method
        })
    
    return result


def track_signup(user_id: str, user_email: str, user_name: str = None,
                 signup_method: str = "email", referrer: str = None) -> bool:
    """
    Track new user signup
    """
    properties = {
        "email": user_email,
        "name": user_name,
        "signup_method": signup_method,
        "referrer": referrer
    }
    
    result = track_event(user_id, "user_signed_up", properties)
    
    # Set initial user profile
    if result:
        set_user_properties(user_id, {
            "$name": user_name,
            "$email": user_email,
            "$created": datetime.now(timezone.utc).isoformat(),
            "signup_method": signup_method,
            "plan": "free_trial",
            "login_count": 0
        })
    
    return result


def track_profile_completed(user_id: str, user_data: Dict[str, Any]) -> bool:
    """
    Track when user completes their profile/onboarding
    """
    properties = {
        "ug_college": user_data.get("ug_college"),
        "pg_college": user_data.get("pg_college"),
        "prep_objective": user_data.get("prep_objective"),
        "preparation_level": user_data.get("preparation_level"),
        "target_firms": user_data.get("target_firms", []),
        "has_phone": bool(user_data.get("phone_number")),
        "has_linkedin": bool(user_data.get("linkedin_url"))
    }
    
    result = track_event(user_id, "profile_completed", properties)
    
    # Update user profile with onboarding data
    if result:
        set_user_properties(user_id, {
            "$name": user_data.get("name"),
            "$phone": user_data.get("phone_number"),
            "ug_college": user_data.get("ug_college"),
            "pg_college": user_data.get("pg_college"),
            "prep_objective": user_data.get("prep_objective"),
            "preparation_level": user_data.get("preparation_level"),
            "target_firms": ", ".join(user_data.get("target_firms", [])),
            "onboarding_completed": True,
            "onboarding_completed_at": datetime.now(timezone.utc).isoformat()
        })
    
    return result


def track_upgrade_button_clicked(user_id: str, button_location: str, 
                                  current_plan: str = None, target_plan: str = None,
                                  page: str = None) -> bool:
    """
    Track when user clicks an upgrade button
    
    Args:
        user_id: User's unique ID
        button_location: Where the button was (e.g., 'free_trial_popup', 'sidebar', 
                        'courses_page', 'videos_page', 'drills_page', 'workshops_page',
                        'coaching_page', 'peer_practice_page', 'pricing_page')
        current_plan: User's current plan
        target_plan: The plan being upgraded to (if known)
        page: The page/URL where clicked
    """
    properties = {
        "button_location": button_location,
        "current_plan": current_plan,
        "target_plan": target_plan,
        "page": page
    }
    
    return track_event(user_id, "upgrade_button_clicked", properties)


def track_subscription_upgraded(user_id: str, old_plan: str, new_plan: str,
                                 billing_cycle: str = None, amount: float = None,
                                 coupon_code: str = None, upgrade_source: str = None) -> bool:
    """
    Track successful subscription upgrade
    
    Args:
        user_id: User's unique ID
        old_plan: Previous plan
        new_plan: New plan after upgrade
        billing_cycle: '1_month' or '6_month'
        amount: Amount paid
        coupon_code: Coupon used if any
        upgrade_source: How they upgraded ('razorpay', 'manual', 'coupon_activation')
    """
    properties = {
        "old_plan": old_plan,
        "new_plan": new_plan,
        "billing_cycle": billing_cycle,
        "amount": amount,
        "coupon_code": coupon_code,
        "upgrade_source": upgrade_source
    }
    
    result = track_event(user_id, "subscription_upgraded", properties)
    
    # Update user profile with new plan
    if result:
        set_user_properties(user_id, {
            "plan": new_plan,
            "billing_cycle": billing_cycle,
            "last_upgrade_date": datetime.now(timezone.utc).isoformat(),
            "total_revenue": amount  # This should ideally be incremented
        })
        
        # Increment total upgrades
        increment_user_property(user_id, "total_upgrades", 1)
    
    return result


def track_video_viewed(user_id: str, video_id: str, video_title: str = None,
                       video_category: str = None, watch_duration: int = None,
                       video_duration: int = None) -> bool:
    """
    Track video view event
    """
    completion_pct = None
    if watch_duration and video_duration and video_duration > 0:
        completion_pct = round((watch_duration / video_duration) * 100, 1)
    
    properties = {
        "video_id": video_id,
        "video_title": video_title,
        "video_category": video_category,
        "watch_duration_seconds": watch_duration,
        "video_duration_seconds": video_duration,
        "completion_percentage": completion_pct
    }
    
    result = track_event(user_id, "video_viewed", properties)
    
    if result:
        increment_user_property(user_id, "videos_watched", 1)
    
    return result


def track_drill_completed(user_id: str, drill_id: str, drill_title: str = None,
                          drill_category: str = None, score: float = None,
                          time_spent: int = None) -> bool:
    """
    Track drill completion event
    """
    properties = {
        "drill_id": drill_id,
        "drill_title": drill_title,
        "drill_category": drill_category,
        "score": score,
        "time_spent_seconds": time_spent
    }
    
    result = track_event(user_id, "drill_completed", properties)
    
    if result:
        increment_user_property(user_id, "drills_completed", 1)
    
    return result


def track_session_booked(user_id: str, session_id: str, session_type: str,
                         mentor_id: str = None, mentor_name: str = None,
                         session_date: str = None) -> bool:
    """
    Track coaching session booking
    
    Args:
        session_type: 'coaching' or 'peer'
    """
    properties = {
        "session_id": session_id,
        "session_type": session_type,
        "mentor_id": mentor_id,
        "mentor_name": mentor_name,
        "session_date": session_date
    }
    
    event_name = f"{session_type}_session_booked"
    result = track_event(user_id, event_name, properties)
    
    if result:
        increment_user_property(user_id, f"{session_type}_sessions_booked", 1)
    
    return result


def track_workshop_registered(user_id: str, workshop_id: str, workshop_title: str = None,
                               workshop_date: str = None) -> bool:
    """
    Track workshop registration
    """
    properties = {
        "workshop_id": workshop_id,
        "workshop_title": workshop_title,
        "workshop_date": workshop_date
    }
    
    result = track_event(user_id, "workshop_registered", properties)
    
    if result:
        increment_user_property(user_id, "workshops_registered", 1)
    
    return result


def track_resource_downloaded(user_id: str, resource_id: str, resource_title: str = None,
                               resource_category: str = None) -> bool:
    """
    Track resource download
    """
    properties = {
        "resource_id": resource_id,
        "resource_title": resource_title,
        "resource_category": resource_category
    }
    
    result = track_event(user_id, "resource_downloaded", properties)
    
    if result:
        increment_user_property(user_id, "resources_downloaded", 1)
    
    return result


def track_page_viewed(user_id: str, page_name: str, page_url: str = None) -> bool:
    """
    Track page view event
    """
    properties = {
        "page_name": page_name,
        "page_url": page_url
    }
    
    return track_event(user_id, "page_viewed", properties)


# ============ HISTORICAL DATA SYNC ============

async def sync_user_to_mixpanel(db, user: Dict[str, Any]) -> bool:
    """
    Sync a single user's profile and historical data to Mixpanel
    
    Args:
        db: Database connection
        user: User document from database
    
    Returns:
        bool: True if sync was successful
    """
    if not is_enabled():
        return False
    
    user_id = user.get("id")
    if not user_id:
        return False
    
    try:
        # Set comprehensive user profile
        profile_props = {
            "$name": user.get("name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "$email": user.get("email"),
            "$phone": user.get("phone_number"),
            "$created": user.get("created_at"),
            
            # Plan info
            "plan": user.get("plan", "free_trial"),
            "plan_start_date": user.get("plan_start_date") or user.get("subscription_start_date"),
            "plan_end_date": user.get("plan_end_date") or user.get("subscription_end_date"),
            "is_subscribed": user.get("is_subscribed", False),
            
            # Education & background
            "ug_college": user.get("ug_college"),
            "pg_college": user.get("pg_college"),
            "years_of_experience": user.get("years_of_experience"),
            
            # Preparation details
            "prep_objective": user.get("prep_objective"),
            "preparation_level": user.get("preparation_level"),
            "target_firms": ", ".join(user.get("target_firms", [])) if user.get("target_firms") else None,
            
            # Location
            "location": user.get("location"),
            
            # Status
            "onboarding_completed": user.get("onboarding_completed", False),
            "is_admin": user.get("is_admin", False),
            "is_mentor": user.get("is_mentor", False),
            
            # Activity metrics (will be updated with actual counts)
            "last_login_at": user.get("last_login_at")
        }
        
        # Filter out None values
        profile_props = {k: v for k, v in profile_props.items() if v is not None}
        
        mp.people_set(user_id, profile_props)
        
        # Get activity counts from database
        # Coaching sessions
        coaching_count = await db.bookings.count_documents({"user_id": user_id})
        
        # Peer sessions
        peer_count = await db.peer_sessions.count_documents({
            "$or": [{"user_id": user_id}, {"partner_id": user_id}]
        })
        
        # Drill completions
        drills_count = await db.drill_completions.count_documents({"user_id": user_id})
        
        # Workshop registrations
        workshops_count = await db.workshop_registrations.count_documents({"user_id": user_id})
        
        # Video progress
        videos_count = await db.video_progress.count_documents({"user_id": user_id})
        
        # Login count (from user_activity)
        login_count = await db.user_activity.count_documents({
            "user_id": user_id,
            "event": "daily_login"
        })
        
        # Set activity counts
        mp.people_set(user_id, {
            "coaching_sessions_booked": coaching_count,
            "peer_sessions_booked": peer_count,
            "drills_completed": drills_count,
            "workshops_registered": workshops_count,
            "videos_watched": videos_count,
            "login_count": login_count
        })
        
        logger.info(f"[Mixpanel] Synced user profile: {user.get('email')}")
        return True
        
    except Exception as e:
        logger.error(f"[Mixpanel] Failed to sync user {user_id}: {e}")
        return False


async def sync_all_users_to_mixpanel(db) -> Dict[str, Any]:
    """
    Sync all users to Mixpanel (for historical data)
    
    Returns:
        Dict with sync statistics
    """
    if not is_enabled():
        return {"error": "Mixpanel not configured"}
    
    try:
        # Get all non-deleted users
        users = await db.users.find(
            {"is_deleted": {"$ne": True}},
            {"_id": 0}
        ).to_list(10000)
        
        synced = 0
        failed = 0
        
        for user in users:
            try:
                success = await sync_user_to_mixpanel(db, user)
                if success:
                    synced += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"Error syncing user {user.get('id')}: {e}")
                failed += 1
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.05)
        
        logger.info(f"[Mixpanel] Historical sync complete: {synced} synced, {failed} failed")
        
        return {
            "total_users": len(users),
            "synced": synced,
            "failed": failed,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"[Mixpanel] Historical sync failed: {e}")
        return {"error": str(e)}


async def sync_historical_events(db, days_back: int = 90) -> Dict[str, Any]:
    """
    Sync historical events (upgrades, logins, etc.) to Mixpanel
    
    Args:
        db: Database connection
        days_back: How many days of history to sync
    
    Returns:
        Dict with sync statistics
    """
    if not is_enabled():
        return {"error": "Mixpanel not configured"}
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
    cutoff_str = cutoff_date.isoformat()
    
    events_synced = 0
    
    try:
        # Sync payment/upgrade events
        payment_orders = await db.payment_orders.find({
            "created_at": {"$gte": cutoff_str}
        }).to_list(10000)
        
        for order in payment_orders:
            user_id = order.get("user_id")
            if not user_id:
                continue
            
            try:
                track_event(user_id, "subscription_upgraded", {
                    "old_plan": "unknown",
                    "new_plan": order.get("plan_key"),
                    "billing_cycle": order.get("billing_cycle"),
                    "amount": order.get("amount"),
                    "coupon_code": order.get("coupon_code"),
                    "upgrade_source": order.get("payment_method", "razorpay"),
                    "historical_sync": True
                })
                events_synced += 1
            except Exception as e:
                logger.error(f"Error syncing payment event: {e}")
        
        # Sync login events from user_activity
        login_events = await db.user_activity.find({
            "event": "daily_login",
            "date": {"$gte": cutoff_str[:10]}
        }).to_list(50000)
        
        for event in login_events:
            user_id = event.get("user_id")
            if not user_id:
                continue
            
            try:
                track_event(user_id, "user_logged_in", {
                    "login_method": "historical",
                    "date": event.get("date"),
                    "historical_sync": True
                })
                events_synced += 1
            except Exception as e:
                logger.error(f"Error syncing login event: {e}")
            
            await asyncio.sleep(0.01)
        
        # Sync drill completions
        drills = await db.drill_completions.find({
            "completed_at": {"$gte": cutoff_str}
        }).to_list(50000)
        
        for drill in drills:
            user_id = drill.get("user_id")
            if not user_id:
                continue
            
            try:
                track_event(user_id, "drill_completed", {
                    "drill_id": drill.get("drill_id"),
                    "score": drill.get("score"),
                    "historical_sync": True
                })
                events_synced += 1
            except Exception as e:
                logger.error(f"Error syncing drill event: {e}")
            
            await asyncio.sleep(0.01)
        
        # Sync coaching session bookings
        bookings = await db.bookings.find({
            "created_at": {"$gte": cutoff_str}
        }).to_list(10000)
        
        for booking in bookings:
            user_id = booking.get("user_id")
            if not user_id:
                continue
            
            try:
                track_event(user_id, "coaching_session_booked", {
                    "session_id": booking.get("id"),
                    "mentor_id": booking.get("mentor_id"),
                    "session_date": booking.get("date"),
                    "historical_sync": True
                })
                events_synced += 1
            except Exception as e:
                logger.error(f"Error syncing booking event: {e}")
            
            await asyncio.sleep(0.01)
        
        # Sync workshop registrations
        workshops = await db.workshop_registrations.find({
            "registered_at": {"$gte": cutoff_str}
        }).to_list(10000)
        
        for workshop in workshops:
            user_id = workshop.get("user_id")
            if not user_id:
                continue
            
            try:
                track_event(user_id, "workshop_registered", {
                    "workshop_id": workshop.get("workshop_id"),
                    "historical_sync": True
                })
                events_synced += 1
            except Exception as e:
                logger.error(f"Error syncing workshop event: {e}")
            
            await asyncio.sleep(0.01)
        
        logger.info(f"[Mixpanel] Historical events sync complete: {events_synced} events")
        
        return {
            "events_synced": events_synced,
            "days_back": days_back,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"[Mixpanel] Historical events sync failed: {e}")
        return {"error": str(e)}
