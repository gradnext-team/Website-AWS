"""
Candidate Analytics API Routes
Comprehensive analytics dashboard for candidate progress and engagement tracking
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
import io
import csv
import json

from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/admin/candidate-analytics", tags=["candidate-analytics"])


async def verify_admin(request: Request):
    """Verify the current user is an admin"""
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def calculate_days_since(date_input: Optional[Union[str, datetime]]) -> Optional[int]:
    """Calculate days since a given date"""
    if not date_input:
        return None
    try:
        if isinstance(date_input, datetime):
            date = date_input if date_input.tzinfo else date_input.replace(tzinfo=timezone.utc)
        elif isinstance(date_input, str):
            date = datetime.fromisoformat(date_input.replace("Z", "+00:00"))
        else:
            return None
        delta = datetime.now(timezone.utc) - date
        return delta.days
    except (ValueError, AttributeError, TypeError):
        return None


def get_months_since_enrolled(created_at) -> Optional[float]:
    """Calculate months since user enrolled"""
    if not created_at:
        return None
    try:
        # Handle both datetime objects and strings
        if isinstance(created_at, datetime):
            date = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        elif isinstance(created_at, str):
            date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            return None
        delta = datetime.now(timezone.utc) - date
        return round(delta.days / 30.0, 1)
    except (ValueError, AttributeError, TypeError):
        return None


async def get_user_activity_metrics(db, user_id: str) -> Dict[str, Any]:
    """Get detailed activity metrics for a user"""
    
    # Get coaching sessions from bookings collection (uses user_id field)
    coaching_bookings = await db.bookings.find(
        {"user_id": user_id},
        {"_id": 0, "status": 1, "date": 1, "session_type": 1}
    ).to_list(1000)
    
    coaching_completed = len([b for b in coaching_bookings if b.get("status") == "completed"])
    
    # Get peer sessions from peer_sessions collection
    peer_sessions = await db.peer_sessions.find(
        {"$or": [
            {"user_id": user_id},
            {"partner_id": user_id}
        ]},
        {"_id": 0, "status": 1, "scheduled_date": 1}
    ).to_list(1000)
    
    peer_completed = len([s for s in peer_sessions if s.get("status") == "completed"])
    
    # Get video watch history from progress collection
    user_progress = await db.progress.find_one({"user_id": user_id})
    videos_completed = user_progress.get("videos_completed", []) if user_progress else []
    videos_watched = len(videos_completed)
    
    # Also check video_progress collection as fallback
    if videos_watched == 0:
        video_progress_docs = await db.video_progress.find(
            {"user_id": user_id},
            {"_id": 0, "video_id": 1, "session_id": 1}
        ).to_list(5000)
        videos_watched = len(set(
            v.get("video_id") or v.get("session_id") 
            for v in video_progress_docs 
            if v.get("video_id") or v.get("session_id")
        ))
    
    # Get drill completions
    drill_completions = await db.drill_completions.find(
        {"user_id": user_id},
        {"_id": 0, "score": 1, "drill_id": 1, "completed_at": 1}
    ).to_list(5000)
    drills_done = len(drill_completions)
    
    # Calculate average score
    scores = [d.get("score", 0) for d in drill_completions if d.get("score") is not None]
    avg_drill_score = round(sum(scores) / len(scores), 1) if scores else None
    
    # Get unique drills
    unique_drills = list(set(d.get("drill_id") for d in drill_completions if d.get("drill_id")))
    
    # Get workshop attendance
    workshop_registrations = await db.workshop_registrations.find(
        {"user_id": user_id},
        {"_id": 0, "attended": 1}
    ).to_list(500)
    workshops_attended = len([w for w in workshop_registrations if w.get("attended")])
    workshops_registered = len(workshop_registrations)
    
    # Get resource downloads
    resource_downloads = await db.resource_downloads.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    resources_downloaded = len(resource_downloads)
    
    # Calculate last activity date from multiple sources
    activity_dates = []
    
    # Add coaching booking dates
    for booking in coaching_bookings:
        if booking.get("date"):
            try:
                booking_date = booking["date"]
                if isinstance(booking_date, datetime):
                    activity_dates.append(booking_date)
                elif isinstance(booking_date, str):
                    activity_dates.append(datetime.fromisoformat(booking_date.replace("Z", "+00:00")))
            except:
                pass
    
    # Add peer session dates
    for session in peer_sessions:
        if session.get("scheduled_date"):
            try:
                if isinstance(session["scheduled_date"], datetime):
                    activity_dates.append(session["scheduled_date"])
                else:
                    activity_dates.append(datetime.fromisoformat(str(session["scheduled_date"]).replace("Z", "+00:00")))
            except:
                pass
    
    # Add drill completion dates
    for drill in drill_completions:
        if drill.get("completed_at"):
            try:
                completed_at = drill["completed_at"]
                if isinstance(completed_at, datetime):
                    activity_dates.append(completed_at)
                elif isinstance(completed_at, str):
                    activity_dates.append(datetime.fromisoformat(completed_at.replace("Z", "+00:00")))
            except:
                pass
    
    last_activity_date = max(activity_dates).isoformat() if activity_dates else None
    days_since_activity = calculate_days_since(last_activity_date) if last_activity_date else None
    
    return {
        "peer_sessions_done": peer_completed,
        "coaching_sessions_done": coaching_completed,
        "videos_watched": videos_watched,
        "drills_done": drills_done,
        "avg_drill_score": avg_drill_score,
        "drills_attempted": unique_drills,
        "workshops_attended": workshops_attended,
        "workshops_registered": workshops_registered,
        "resources_downloaded": resources_downloaded,
        "last_activity_date": last_activity_date,
        "days_since_activity": days_since_activity
    }


@router.get("/summary")
async def get_candidate_analytics_summary(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    plan: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    """
    Get aggregated analytics for all candidates with comprehensive metrics
    
    Metrics per candidate:
    - Profile information (name, email, phone, location, colleges, LinkedIn)
    - Preparation details (objective, level, target firms)
    - Plan information (current plan, enrollment date, months enrolled)
    - Activity metrics (sessions, videos, drills, workshops)
    - Engagement metrics (last login, days since activity)
    - Performance metrics (average drill score, drills completed)
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Build filter for users
    user_filter = {"is_deleted": {"$ne": True}}
    
    # Date filter (based on created_at)
    if date_from:
        user_filter["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in user_filter:
            user_filter["created_at"]["$lte"] = date_to
        else:
            user_filter["created_at"] = {"$lte": date_to}
    
    # Plan filter
    if plan and plan != "all":
        user_filter["plan"] = plan
    
    # Search filter - searches across multiple fields
    if search:
        user_filter["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone_number": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"ug_college": {"$regex": search, "$options": "i"}},
            {"pg_college": {"$regex": search, "$options": "i"}},
            {"plan": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count for pagination
    total_candidates = await db.users.count_documents(user_filter)
    
    # Fields that can be sorted at database level
    db_sortable_fields = ["first_name", "last_name", "name", "email", "created_at", "last_login_at", "plan"]
    
    # Determine sort direction for MongoDB
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Map frontend sort field to DB field
    sort_field_map = {
        "first_name": "first_name",
        "last_name": "last_name",
        "name": "name",
        "email": "email",
        "created_at": "created_at",
        "last_login_at": "last_login_at",
        "plan": "plan"
    }
    
    # Check if we can sort at DB level
    db_sort_field = sort_field_map.get(sort_by)
    
    if db_sort_field:
        # Sort at database level - efficient for large datasets
        skip = (page - 1) * limit
        users = await db.users.find(
            user_filter,
            {"_id": 0}
        ).sort(db_sort_field, sort_direction).skip(skip).limit(limit).to_list(limit)
    else:
        # For computed fields, we need to fetch all matching users, compute metrics, then sort
        # This is necessary because these metrics aren't stored in the user document
        all_users = await db.users.find(
            user_filter,
            {"_id": 0}
        ).to_list(10000)  # Limit to prevent memory issues
        
        # We'll process all users and sort later
        users = all_users
    
    analytics_data = []
    
    for user in users:
        user_id = user.get("id")
        
        # Get activity metrics
        activity = await get_user_activity_metrics(db, user_id)
        
        # Calculate enrollment period
        months_enrolled = get_months_since_enrolled(user.get("created_at"))
        days_since_last_login = calculate_days_since(user.get("last_login_at"))
        
        # Get plan details
        plan_key = user.get("plan", "free_trial")
        plan_start = user.get("plan_start_date") or user.get("created_at")
        plan_end = user.get("plan_end_date") or user.get("subscription_end_date")
        
        analytics_data.append({
            # Basic Profile
            "user_id": user_id,
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "full_name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone_number": user.get("phone_number", ""),
            "phone_country_code": user.get("phone_country_code", ""),
            
            # LinkedIn & Location
            "linkedin_url": user.get("linkedin_url", ""),
            "location": user.get("location", ""),
            "location_country_code": user.get("location_country_code", ""),
            
            # Education
            "ug_college": user.get("ug_college", ""),
            "pg_college": user.get("pg_college", ""),
            "no_pg": user.get("no_pg", False),
            "pg_incoming": user.get("pg_incoming", False),
            "years_of_experience": user.get("years_of_experience", ""),
            
            # Preparation Details
            "prep_objective": user.get("prep_objective", ""),
            "other_objective": user.get("other_objective", ""),
            "preparation_level": user.get("preparation_level", ""),
            "target_firms": user.get("target_firms", []),
            "target_companies": user.get("target_companies", []),
            
            # Plan & Subscription
            "plan": plan_key,
            "plan_name": user.get("plan_name", ""),
            "plan_category": user.get("plan_category", ""),
            "plan_start_date": plan_start,
            "plan_end_date": plan_end,
            "is_subscribed": user.get("is_subscribed", False),
            "months_enrolled": months_enrolled,
            
            # Activity Metrics
            "peer_sessions_done": activity["peer_sessions_done"],
            "coaching_sessions_done": activity["coaching_sessions_done"],
            "videos_watched": activity["videos_watched"],
            "drills_done": activity["drills_done"],
            "workshops_attended": activity["workshops_attended"],
            "workshops_registered": activity["workshops_registered"],
            "resources_downloaded": activity["resources_downloaded"],
            
            # Performance Metrics
            "avg_drill_score": activity["avg_drill_score"],
            "drills_attempted_list": activity["drills_attempted"],
            
            # Engagement Metrics
            "created_at": user.get("created_at"),
            "last_login_at": user.get("last_login_at"),
            "days_since_last_login": days_since_last_login,
            "last_activity_date": activity["last_activity_date"],
            "days_since_activity": activity["days_since_activity"],
            
            # Onboarding
            "onboarding_completed": user.get("onboarding_completed", False),
            
            # Ratings
            "peer_rating": user.get("peer_rating"),
            
            # Additional fields
            "bio": user.get("bio", ""),
            "picture": user.get("picture", "")
        })
    
    # Sort the data for computed fields (when not sorted at DB level)
    reverse = sort_order == "desc"
    
    # Fields that can be sorted at database level
    db_sortable_fields_check = ["first_name", "last_name", "name", "email", "created_at", "last_login_at", "plan"]
    
    # If sorting by a computed field, sort in memory and apply pagination
    if sort_by not in db_sortable_fields_check:
        def sort_key(item):
            value = item.get(sort_by, 0)
            if value is None:
                return -float('inf') if reverse else float('inf')
            # Handle datetime objects - convert to timestamp for comparison
            if isinstance(value, datetime):
                return value.timestamp()
            if isinstance(value, str):
                # Try to parse as datetime if it looks like a date
                if 'T' in value or '-' in value:
                    try:
                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        return dt.timestamp()
                    except:
                        pass
                return value.lower()
            return value
        
        valid_sort_fields = [
            "first_name", "last_name", "email", "created_at", "last_login_at",
            "plan", "months_enrolled", "peer_sessions_done", "coaching_sessions_done",
            "videos_watched", "drills_done", "avg_drill_score", "days_since_last_login",
            "days_since_activity", "workshops_attended"
        ]
        
        if sort_by in valid_sort_fields:
            analytics_data.sort(key=sort_key, reverse=reverse)
        
        # Apply pagination after sorting for computed fields
        skip = (page - 1) * limit
        total_candidates = len(analytics_data)  # Update total for computed field sorting
        analytics_data = analytics_data[skip:skip + limit]
    
    # Calculate summary statistics (from ALL data before pagination for computed fields)
    # For DB-sorted fields, this will only be from the current page
    total_peer_sessions = sum(c["peer_sessions_done"] for c in analytics_data)
    total_coaching_sessions = sum(c["coaching_sessions_done"] for c in analytics_data)
    total_videos_watched = sum(c["videos_watched"] for c in analytics_data)
    total_drills_done = sum(c["drills_done"] for c in analytics_data)
    
    # Plan distribution
    plan_distribution = {}
    for c in analytics_data:
        plan = c["plan"]
        plan_distribution[plan] = plan_distribution.get(plan, 0) + 1
    
    # Average metrics
    avg_drill_scores = [c["avg_drill_score"] for c in analytics_data if c["avg_drill_score"] is not None]
    platform_avg_score = round(sum(avg_drill_scores) / len(avg_drill_scores), 1) if avg_drill_scores else None
    
    # Active users (logged in last 7 days)
    active_users_7d = len([c for c in analytics_data if c["days_since_last_login"] is not None and c["days_since_last_login"] <= 7])
    active_users_30d = len([c for c in analytics_data if c["days_since_last_login"] is not None and c["days_since_last_login"] <= 30])
    
    # Onboarding completion rate
    onboarded_users = len([c for c in analytics_data if c["onboarding_completed"]])
    onboarding_rate = round((onboarded_users / len(analytics_data)) * 100, 1) if analytics_data else 0
    
    return {
        "candidates": analytics_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_candidates,
            "total_pages": (total_candidates + limit - 1) // limit
        },
        "summary": {
            "total_candidates": total_candidates,
            "active_users_7d": active_users_7d,
            "active_users_30d": active_users_30d,
            "onboarded_users": onboarded_users,
            "onboarding_rate": onboarding_rate,
            "total_peer_sessions": total_peer_sessions,
            "total_coaching_sessions": total_coaching_sessions,
            "total_videos_watched": total_videos_watched,
            "total_drills_done": total_drills_done,
            "platform_avg_drill_score": platform_avg_score,
            "plan_distribution": plan_distribution
        },
        "filters_applied": {
            "date_from": date_from,
            "date_to": date_to,
            "plan": plan,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "search": search,
            "page": page,
            "limit": limit
        }
    }


@router.get("/candidate/{user_id}")
async def get_candidate_detail(
    user_id: str,
    request: Request
):
    """
    Get comprehensive details for a single candidate
    
    Includes:
    - Full profile information
    - Detailed activity history
    - Performance trends
    - Session details
    - Drill completions with scores
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Get user data
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get activity metrics
    activity = await get_user_activity_metrics(db, user_id)
    
    # Get detailed session history (coaching sessions - uses user_id field)
    bookings = await db.bookings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(500)
    
    # Get peer session history
    peer_sessions_history = await db.peer_sessions.find(
        {"$or": [{"user_id": user_id}, {"partner_id": user_id}]},
        {"_id": 0}
    ).sort("scheduled_date", -1).to_list(500)
    
    # Get detailed drill history
    drills = await db.drill_completions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(500)
    
    # Get drill details (names, categories)
    drill_details = []
    for drill in drills:
        drill_id = drill.get("drill_id")
        drill_info = await db.drills.find_one(
            {"id": drill_id},
            {"_id": 0, "title": 1, "category": 1, "difficulty": 1}
        )
        drill_details.append({
            **drill,
            "drill_title": drill_info.get("title") if drill_info else "Unknown",
            "drill_category": drill_info.get("category") if drill_info else "Unknown",
            "drill_difficulty": drill_info.get("difficulty") if drill_info else None
        })
    
    # Get video watch history from progress collection
    user_progress = await db.progress.find_one({"user_id": user_id})
    video_views = []
    if user_progress and user_progress.get("videos_completed"):
        for video_id in user_progress.get("videos_completed", []):
            video_views.append({
                "video_id": video_id,
                "user_id": user_id
            })
    
    # Also check video_progress collection as fallback
    if not video_views:
        video_progress_docs = await db.video_progress.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("updated_at", -1).to_list(500)
        video_views = video_progress_docs
    
    # Get workshop history
    workshops = await db.workshop_registrations.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(200)
    
    # Calculate engagement trends (last 30 days)
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    recent_activities = {
        "sessions_last_30d": 0,
        "videos_last_30d": 0,
        "drills_last_30d": 0
    }
    
    for booking in bookings:
        if booking.get("date"):
            try:
                date = datetime.fromisoformat(booking["date"].replace("Z", "+00:00"))
                if date >= thirty_days_ago:
                    recent_activities["sessions_last_30d"] += 1
            except:
                pass
    
    for view in video_views:
        if view.get("viewed_at"):
            try:
                date = datetime.fromisoformat(view["viewed_at"].replace("Z", "+00:00"))
                if date >= thirty_days_ago:
                    recent_activities["videos_last_30d"] += 1
            except:
                pass
    
    for drill in drills:
        if drill.get("completed_at"):
            try:
                date = datetime.fromisoformat(drill["completed_at"].replace("Z", "+00:00"))
                if date >= thirty_days_ago:
                    recent_activities["drills_last_30d"] += 1
            except:
                pass
    
    return {
        "profile": {
            "user_id": user_id,
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "full_name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone_number": user.get("phone_number", ""),
            "phone_country_code": user.get("phone_country_code", ""),
            "linkedin_url": user.get("linkedin_url", ""),
            "location": user.get("location", ""),
            "location_country_code": user.get("location_country_code", ""),
            "bio": user.get("bio", ""),
            "picture": user.get("picture", ""),
            "ug_college": user.get("ug_college", ""),
            "pg_college": user.get("pg_college", ""),
            "no_pg": user.get("no_pg", False),
            "pg_incoming": user.get("pg_incoming", False),
            "years_of_experience": user.get("years_of_experience", ""),
            "prep_objective": user.get("prep_objective", ""),
            "other_objective": user.get("other_objective", ""),
            "preparation_level": user.get("preparation_level", ""),
            "target_firms": user.get("target_firms", []),
            "target_companies": user.get("target_companies", []),
            "plan": user.get("plan", ""),
            "plan_name": user.get("plan_name", ""),
            "plan_start_date": user.get("plan_start_date"),
            "plan_end_date": user.get("plan_end_date"),
            "is_subscribed": user.get("is_subscribed", False),
            "created_at": user.get("created_at"),
            "last_login_at": user.get("last_login_at"),
            "onboarding_completed": user.get("onboarding_completed", False)
        },
        "activity_summary": {
            **activity,
            "months_enrolled": get_months_since_enrolled(user.get("created_at")),
            "days_since_last_login": calculate_days_since(user.get("last_login_at")),
            **recent_activities
        },
        "session_history": bookings,
        "peer_session_history": peer_sessions_history,
        "drill_history": drill_details,
        "video_history": video_views[:50],  # Last 50 videos
        "workshop_history": workshops
    }


@router.get("/export")
async def export_candidate_analytics(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    plan: Optional[str] = None,
    format: str = "csv"
):
    """
    Export candidate analytics data to CSV or JSON
    """
    await verify_admin(request)
    
    # Get analytics data (get all, no pagination for export)
    analytics_response = await get_candidate_analytics_summary(
        request=request,
        date_from=date_from,
        date_to=date_to,
        plan=plan,
        sort_by="created_at",
        sort_order="desc",
        limit=10000  # Large limit for export
    )
    
    candidates = analytics_response["candidates"]
    
    if format == "json":
        output = io.BytesIO()
        output.write(json.dumps({
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "filters": analytics_response["filters_applied"],
            "summary": analytics_response["summary"],
            "candidates": candidates
        }, indent=2).encode('utf-8'))
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=candidate_analytics_{datetime.now().strftime('%Y%m%d')}.json"}
        )
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    writer.writerow([
        "User ID", "First Name", "Last Name", "Email", "Phone", "LinkedIn",
        "Location", "UG College", "PG College", "Years of Experience",
        "Prep Objective", "Preparation Level", "Target Firms",
        "Plan", "Months Enrolled", "Plan Start", "Plan End",
        "Peer Sessions", "Coaching Sessions", "Videos Watched", "Drills Done",
        "Avg Drill Score", "Workshops Attended", "Resources Downloaded",
        "Last Login", "Days Since Login", "Last Activity", "Days Since Activity",
        "Onboarding Complete", "Created At"
    ])
    
    # Data rows
    for c in candidates:
        writer.writerow([
            c["user_id"],
            c["first_name"],
            c["last_name"],
            c["email"],
            c["phone_number"],
            c["linkedin_url"],
            c["location"],
            c["ug_college"],
            c["pg_college"],
            c["years_of_experience"],
            c["prep_objective"],
            c["preparation_level"],
            ", ".join(c["target_firms"]) if c["target_firms"] else "",
            c["plan"],
            c["months_enrolled"],
            c["plan_start_date"],
            c["plan_end_date"],
            c["peer_sessions_done"],
            c["coaching_sessions_done"],
            c["videos_watched"],
            c["drills_done"],
            c["avg_drill_score"] if c["avg_drill_score"] else "N/A",
            c["workshops_attended"],
            c["resources_downloaded"],
            c["last_login_at"],
            c["days_since_last_login"],
            c["last_activity_date"],
            c["days_since_activity"],
            "Yes" if c["onboarding_completed"] else "No",
            c["created_at"]
        ])
    
    # Add summary rows
    writer.writerow([])
    writer.writerow(["SUMMARY"])
    summary = analytics_response["summary"]
    writer.writerow(["Total Candidates", summary["total_candidates"]])
    writer.writerow(["Active Users (7 days)", summary["active_users_7d"]])
    writer.writerow(["Active Users (30 days)", summary["active_users_30d"]])
    writer.writerow(["Onboarding Rate", f"{summary['onboarding_rate']}%"])
    writer.writerow(["Total Peer Sessions", summary["total_peer_sessions"]])
    writer.writerow(["Total Coaching Sessions", summary["total_coaching_sessions"]])
    writer.writerow(["Total Videos Watched", summary["total_videos_watched"]])
    writer.writerow(["Total Drills Done", summary["total_drills_done"]])
    writer.writerow(["Platform Avg Drill Score", summary["platform_avg_drill_score"] or "N/A"])
    
    writer.writerow([])
    writer.writerow(["PLAN DISTRIBUTION"])
    for plan, count in summary["plan_distribution"].items():
        writer.writerow([plan, count])
    
    csv_content = output.getvalue()
    output.close()
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=candidate_analytics_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# ============ Detailed Feedback Endpoint ============

@router.get("/{user_id}/feedback")
async def get_candidate_detailed_feedback(user_id: str, request: Request):
    """Get detailed feedback for all sessions (coaching and peer) for a specific candidate"""
    await verify_admin(request)
    db = get_db(request)
    
    # Get all coaching sessions for this candidate
    coaching_sessions = await db.bookings.find({
        "user_id": user_id
    }).sort("date", -1).to_list(100)
    
    # Get all peer sessions for this candidate
    peer_sessions = await db.peer_sessions.find({
        "$or": [
            {"requester_id": user_id},
            {"partner_id": user_id}
        ]
    }).sort("date", -1).to_list(100)
    
    # Process coaching sessions with feedback
    coaching_feedback_list = []
    for session in coaching_sessions:
        booking_id = session.get("id")
        
        # Get mentor info
        mentor = await db.mentors.find_one({"id": session.get("mentor_id")})
        mentor_name = mentor.get("name", "Unknown Mentor") if mentor else "Unknown Mentor"
        
        # Get feedback from feedback collection or booking
        feedback = await db.mentor_feedback.find_one({"booking_id": booking_id})
        
        # Check if feedback exists
        if feedback or session.get("mentor_feedback_given"):
            # Build feedback data
            feedback_data = feedback or session.get("mentor_feedback", {})
            
            # Get areas of strength and improvement
            strengths = []
            improvements = []
            
            # Analyze ratings to determine strengths and improvements
            ratings = {
                "Scoping Questions": feedback_data.get("rating_scoping_questions", 0),
                "Case Structure": feedback_data.get("rating_case_structure", 0),
                "Quantitative Skills": feedback_data.get("rating_quantitative", 0) if feedback_data.get("quantitative_tested", True) else None,
                "Communication": feedback_data.get("rating_communication", 0),
                "Business Acumen": feedback_data.get("rating_business_acumen", 0)
            }
            
            for area, rating in ratings.items():
                if rating and rating >= 4:
                    strengths.append(area)
                elif rating and rating <= 2:
                    improvements.append(area)
            
            coaching_feedback_list.append({
                "session_id": booking_id,
                "date": session.get("date"),
                "time": session.get("time"),
                "mentor_name": mentor_name,
                "case_type": feedback_data.get("case_type", session.get("case_type", "N/A")),
                "status": session.get("status", "pending"),
                "has_feedback": True,
                "ratings": {
                    "scoping_questions": ratings["Scoping Questions"],
                    "case_structure": ratings["Case Structure"],
                    "quantitative": ratings["Quantitative Skills"],
                    "communication": ratings["Communication"],
                    "business_acumen": ratings["Business Acumen"],
                    "overall": feedback_data.get("rating_overall", 0)
                },
                "areas_of_strength": strengths,
                "areas_of_improvement": improvements,
                "qualitative_feedback": feedback_data.get("qualitative_feedback", ""),
                "quantitative_tested": feedback_data.get("quantitative_tested", True)
            })
        else:
            # Session without feedback
            coaching_feedback_list.append({
                "session_id": booking_id,
                "date": session.get("date"),
                "time": session.get("time"),
                "mentor_name": mentor_name,
                "case_type": session.get("case_type", "N/A"),
                "status": session.get("status", "pending"),
                "has_feedback": False,
                "ratings": None,
                "areas_of_strength": [],
                "areas_of_improvement": [],
                "qualitative_feedback": "",
                "quantitative_tested": True
            })
    
    # Process peer sessions (peer feedback is typically simpler)
    peer_feedback_list = []
    for session in peer_sessions:
        session_id = session.get("id")
        
        # Determine if user was requester or partner
        is_requester = session.get("requester_id") == user_id
        
        # Get partner info
        partner_id = session.get("partner_id") if is_requester else session.get("requester_id")
        partner = await db.users.find_one({"id": partner_id}) if partner_id else None
        partner_name = partner.get("name", "Unknown Partner") if partner else "Unknown Partner"
        
        # Check for feedback
        feedback = await db.peer_feedback.find_one({
            "session_id": session_id,
            "reviewer_id": partner_id,
            "reviewee_id": user_id
        })
        
        if feedback:
            peer_feedback_list.append({
                "session_id": session_id,
                "date": session.get("date"),
                "time": session.get("time"),
                "partner_name": partner_name,
                "case_type": session.get("case_type", "Practice"),
                "status": session.get("status", "pending"),
                "has_feedback": True,
                "rating": feedback.get("rating", 0),
                "strengths": feedback.get("strengths", ""),
                "improvements": feedback.get("improvements", ""),
                "comments": feedback.get("comments", "")
            })
        else:
            peer_feedback_list.append({
                "session_id": session_id,
                "date": session.get("date"),
                "time": session.get("time"),
                "partner_name": partner_name,
                "case_type": session.get("case_type", "Practice"),
                "status": session.get("status", "pending"),
                "has_feedback": False,
                "rating": None,
                "strengths": "",
                "improvements": "",
                "comments": ""
            })
    
    return {
        "user_id": user_id,
        "coaching_sessions": coaching_feedback_list,
        "peer_sessions": peer_feedback_list,
        "summary": {
            "total_coaching_sessions": len(coaching_sessions),
            "coaching_with_feedback": len([s for s in coaching_feedback_list if s["has_feedback"]]),
            "total_peer_sessions": len(peer_sessions),
            "peer_with_feedback": len([s for s in peer_feedback_list if s["has_feedback"]]),
            "avg_coaching_rating": round(
                sum([s["ratings"]["overall"] for s in coaching_feedback_list if s["has_feedback"] and s["ratings"]]) / 
                len([s for s in coaching_feedback_list if s["has_feedback"] and s["ratings"]])
            , 2) if any(s["has_feedback"] and s["ratings"] for s in coaching_feedback_list) else 0
        }
    }

