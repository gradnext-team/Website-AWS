"""
Analytics API Routes for Admin Dashboard
Provides comprehensive analytics with customizable date ranges and categories.
"""

from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timedelta
from typing import Optional, List
import csv
import io
from pydantic import BaseModel

router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

async def verify_admin(request: Request):
    """Verify user is admin"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============ Helper Functions ============

# Platform launch date - used as minimum date for "all time" queries
PLATFORM_LAUNCH_DATE = datetime(2026, 2, 1, 0, 0, 0)


def parse_date_range(date_from: str, date_to: str, use_platform_launch_for_all_time: bool = True):
    """
    Parse date strings to datetime objects.
    
    Args:
        date_from: Start date string (ISO format)
        date_to: End date string (ISO format)
        use_platform_launch_for_all_time: If True, use Feb 1, 2026 as minimum start date
    
    Returns:
        Tuple of (start_date, end_date) as datetime objects
    """
    try:
        start = datetime.fromisoformat(date_from) if date_from else datetime.now() - timedelta(days=30)
        end = datetime.fromisoformat(date_to) if date_to else datetime.now()
        
        # Ensure start date is not before platform launch
        if use_platform_launch_for_all_time and start < PLATFORM_LAUNCH_DATE:
            start = PLATFORM_LAUNCH_DATE
        
        # Set end to end of day
        end = end.replace(hour=23, minute=59, second=59)
        return start, end
    except:
        return datetime.now() - timedelta(days=30), datetime.now()


def date_to_str(dt):
    """Convert datetime to string"""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt) if dt else None


# ============ Overview Analytics ============

@router.get("/overview")
async def get_analytics_overview(
    request: Request,
    date_from: str = None,
    date_to: str = None,
    category: str = "total"  # total, subscription, coaching
):
    """
    Get overview analytics for the dashboard.
    
    Category options:
    - total: All metrics combined
    - subscription: Only subscription-related metrics
    - coaching: Only coaching-related metrics
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    result = {
        "date_range": {"from": start_str, "to": end_str},
        "category": category,
        "metrics": {}
    }
    
    # ---- User Metrics (Always included) ----
    # Only count candidates (exclude mentors and admins)
    total_users = await db.users.count_documents({
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Active users (logged in during date range) - candidates only
    active_users = await db.users.count_documents({
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True},
        "last_login": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    # Fallback: if last_login not tracked, use created_at
    if active_users == 0:
        active_users = await db.users.count_documents({
            "is_mentor": {"$ne": True},
            "is_admin": {"$ne": True},
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        })
    
    result["metrics"]["total_users"] = total_users
    result["metrics"]["active_users"] = active_users
    
    # ---- Subscription Metrics ----
    if category in ["total", "subscription"]:
        date_start_iso = start_date.isoformat()
        date_end_iso = end_date.isoformat()

        # All subscription counts in a single aggregation round-trip
        sub_facet = await db.users.aggregate([{"$facet": {
            "active_subs": [{"$match": {"subscription.status": "active", "plan": {"$nin": ["free_trial", None, ""]}}}, {"$count": "n"}],
            "free_trial": [{"$match": {"plan": "free_trial"}}, {"$count": "n"}],
            "gained": [{"$match": {"subscription.created_at": {"$gte": date_start_iso, "$lte": date_end_iso}, "plan": {"$nin": ["free_trial", None, ""]}}}, {"$count": "n"}],
            "lost": [{"$match": {"subscription.cancelled_at": {"$gte": date_start_iso, "$lte": date_end_iso}}}, {"$count": "n"}],
            "total_candidates": [{"$match": {"is_mentor": {"$ne": True}, "is_admin": {"$ne": True}}}, {"$count": "n"}],
            "converted": [{"$match": {"plan": {"$nin": ["free_trial", None, ""]}, "subscription.status": "active", "is_mentor": {"$ne": True}, "is_admin": {"$ne": True}}}, {"$count": "n"}],
            "plan_dist": [{"$match": {"plan": {"$in": ["basic_plan", "pro_plan", "pro_plus", "free_trial"]}}}, {"$group": {"_id": "$plan", "count": {"$sum": 1}}}]
        }}]).to_list(1)

        sf = sub_facet[0] if sub_facet else {}
        active_subs = sf.get("active_subs", [{}])[0].get("n", 0)
        free_trial_users = sf.get("free_trial", [{}])[0].get("n", 0)
        subs_gained = sf.get("gained", [{}])[0].get("n", 0)
        subs_lost = sf.get("lost", [{}])[0].get("n", 0)
        total_free_trial_ever = sf.get("total_candidates", [{}])[0].get("n", 0)
        converted_users = sf.get("converted", [{}])[0].get("n", 0)
        free_to_paid_rate = (converted_users / total_free_trial_ever * 100) if total_free_trial_ever > 0 else 0
        plan_dist = {row["_id"]: row["count"] for row in sf.get("plan_dist", []) if row.get("_id")}
        
        result["metrics"]["subscription"] = {
            "active_subscriptions": active_subs,
            "free_trial_users": free_trial_users,
            "subscribers_gained": subs_gained,
            "subscribers_lost": subs_lost,
            "net_growth": subs_gained - subs_lost,
            "free_to_paid_rate": round(free_to_paid_rate, 2),
            "plan_distribution": plan_dist
        }
    
    # ---- Coaching Metrics ----
    if category in ["total", "coaching"]:
        # Total coaching sessions in date range
        coaching_done = await db.bookings.count_documents({
            "status": "completed",
            "date": {"$gte": start_str, "$lte": end_str}
        })
        
        # Active coaching (upcoming confirmed)
        active_coaching = await db.bookings.count_documents({
            "status": "confirmed",
            "date": {"$gte": datetime.now().strftime("%Y-%m-%d")}
        })
        
        # Peer sessions done
        peer_done = await db.peer_sessions.count_documents({
            "status": "completed",
            "date": {"$gte": start_str, "$lte": end_str}
        })
        
        # Session completion rate
        total_booked = await db.bookings.count_documents({
            "date": {"$gte": start_str, "$lte": end_str}
        })
        completion_rate = (coaching_done / total_booked * 100) if total_booked > 0 else 0
        
        result["metrics"]["coaching"] = {
            "coaching_sessions_done": coaching_done,
            "peer_sessions_done": peer_done,
            "active_coaching": active_coaching,
            "total_sessions": coaching_done + peer_done,
            "completion_rate": round(completion_rate, 2)
        }
    
    # ---- Revenue Metrics ----
    if category in ["total", "subscription"]:
        # Get payments in date range
        payments = await db.payments.find({
            "status": "captured",
            "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        }).to_list(1000)
        
        total_revenue = sum(p.get("amount", 0) for p in payments)
        num_transactions = len(payments)
        avg_order_value = (total_revenue / num_transactions) if num_transactions > 0 else 0
        
        # Revenue by plan
        revenue_by_plan = {}
        for p in payments:
            plan = p.get("plan_key", "unknown")
            revenue_by_plan[plan] = revenue_by_plan.get(plan, 0) + p.get("amount", 0)
        
        result["metrics"]["revenue"] = {
            "total_revenue": total_revenue,
            "num_transactions": num_transactions,
            "avg_order_value": round(avg_order_value, 2),
            "revenue_by_plan": revenue_by_plan
        }
    
    # ---- Session Payout Metrics ----
    if category in ["total", "coaching"]:
        # Get completed sessions with payment info
        completed_sessions = await db.bookings.find({
            "status": "completed",
            "date": {"$gte": start_str, "$lte": end_str}
        }).to_list(1000)
        
        # Batch-fetch mentor rates for sessions missing an override (avoids N+1)
        missing_rate_ids = list({
            s.get("mentor_id") for s in completed_sessions
            if s.get("payment_status") == "paid" and not s.get("payment_amount_override")
        })
        mentor_rates: dict = {}
        if missing_rate_ids:
            mentors_cursor = db.mentors.find(
                {"id": {"$in": missing_rate_ids}},
                {"id": 1, "hourly_rate": 1}
            )
            async for m in mentors_cursor:
                mentor_rates[m["id"]] = m.get("hourly_rate", 1500)

        total_payout = 0
        paid_sessions = 0
        for session in completed_sessions:
            if session.get("payment_status") == "paid":
                amount = session.get("payment_amount_override") or mentor_rates.get(session.get("mentor_id"), 1500)
                total_payout += amount
                paid_sessions += 1
        
        avg_session_payout = (total_payout / paid_sessions) if paid_sessions > 0 else 0
        
        result["metrics"]["payouts"] = {
            "total_payout": total_payout,
            "paid_sessions": paid_sessions,
            "avg_session_payout": round(avg_session_payout, 2)
        }
    
    return result


# ============ Subscriber Trends ============

@router.get("/subscribers/trends")
async def get_subscriber_trends(
    request: Request,
    date_from: str = None,
    date_to: str = None,
    granularity: str = "day"  # day, week, month
):
    """Get subscriber growth trends over time"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Fetch only users whose subscription activity falls within the date range
    users = await db.users.find({
        "$or": [
            {"subscription.created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}},
            {"subscription.cancelled_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
        ]
    }, {"_id": 0, "subscription": 1, "plan": 1}).to_list(5000)
    
    # Group by date
    gained_by_date = {}
    lost_by_date = {}
    
    for user in users:
        sub = user.get("subscription", {})
        
        # Gained
        created = sub.get("created_at", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if start_date <= dt <= end_date:
                    date_key = dt.strftime("%Y-%m-%d")
                    gained_by_date[date_key] = gained_by_date.get(date_key, 0) + 1
            except:
                pass
        
        # Lost
        cancelled = sub.get("cancelled_at", "")
        if cancelled:
            try:
                dt = datetime.fromisoformat(cancelled.replace("Z", "+00:00"))
                if start_date <= dt <= end_date:
                    date_key = dt.strftime("%Y-%m-%d")
                    lost_by_date[date_key] = lost_by_date.get(date_key, 0) + 1
            except:
                pass
    
    # Build trend data
    trends = []
    current = start_date
    while current <= end_date:
        date_key = current.strftime("%Y-%m-%d")
        trends.append({
            "date": date_key,
            "gained": gained_by_date.get(date_key, 0),
            "lost": lost_by_date.get(date_key, 0),
            "net": gained_by_date.get(date_key, 0) - lost_by_date.get(date_key, 0)
        })
        current += timedelta(days=1)
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "trends": trends,
        "summary": {
            "total_gained": sum(t["gained"] for t in trends),
            "total_lost": sum(t["lost"] for t in trends),
            "net_growth": sum(t["net"] for t in trends)
        }
    }


# ============ Revenue Trends ============

@router.get("/revenue/trends")
async def get_revenue_trends(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get revenue trends over time"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Get payments filtered to the requested date range at DB level
    payments = await db.payments.find({
        "status": "captured",
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    }, {"_id": 0, "created_at": 1, "amount": 1}).to_list(2000)

    # Group by date
    revenue_by_date = {}
    for p in payments:
        created = p.get("created_at", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if start_date <= dt <= end_date:
                    date_key = dt.strftime("%Y-%m-%d")
                    if date_key not in revenue_by_date:
                        revenue_by_date[date_key] = {"amount": 0, "count": 0}
                    revenue_by_date[date_key]["amount"] += p.get("amount", 0)
                    revenue_by_date[date_key]["count"] += 1
            except:
                pass
    
    # Build trend data
    trends = []
    current = start_date
    while current <= end_date:
        date_key = current.strftime("%Y-%m-%d")
        data = revenue_by_date.get(date_key, {"amount": 0, "count": 0})
        trends.append({
            "date": date_key,
            "revenue": data["amount"],
            "transactions": data["count"]
        })
        current += timedelta(days=1)
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "trends": trends,
        "summary": {
            "total_revenue": sum(t["revenue"] for t in trends),
            "total_transactions": sum(t["transactions"] for t in trends),
            "avg_daily_revenue": sum(t["revenue"] for t in trends) / len(trends) if trends else 0
        }
    }


# ============ Conversion Funnel ============

@router.get("/conversions/funnel")
async def get_conversion_funnel(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """
    Get conversion funnel data.
    
    Funnel stages:
    1. Signup (created account)
    2. Profile Completed (onboarding done)
    3. Feature Used (any feature engagement)
    4. Checkout Started (initiated payment)
    5. Payment Completed (successful subscription)
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Stage 1: Signups
    signups = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str}
    })
    
    # Stage 2: Profile Completed
    profile_completed = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str},
        "onboarding_completed": True
    })
    
    # Stage 3: Feature Used (has any activity - drills, videos watched, etc.)
    feature_used = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str},
        "$or": [
            {"drills_completed": {"$gt": 0}},
            {"videos_watched": {"$gt": 0}},
            {"resources_accessed": {"$gt": 0}},
            {"onboarding_completed": True}
        ]
    })
    # Fallback if fields don't exist
    if feature_used == 0:
        feature_used = profile_completed
    
    # Stage 4: Checkout Started (has pending or completed payment)
    checkout_started = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str},
        "$or": [
            {"subscription.razorpay_subscription_id": {"$exists": True}},
            {"pending_payment": {"$exists": True}}
        ]
    })
    
    # Stage 5: Payment Completed
    payment_completed = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str},
        "subscription.status": "active",
        "plan": {"$nin": ["free_trial", None, ""]}
    })
    
    # Calculate conversion rates and drop-offs
    funnel = [
        {"stage": "Signup", "count": signups, "rate": 100, "dropoff": 0},
        {"stage": "Profile Completed", "count": profile_completed, 
         "rate": round((profile_completed / signups * 100) if signups > 0 else 0, 2),
         "dropoff": round(((signups - profile_completed) / signups * 100) if signups > 0 else 0, 2)},
        {"stage": "Feature Used", "count": feature_used,
         "rate": round((feature_used / signups * 100) if signups > 0 else 0, 2),
         "dropoff": round(((profile_completed - feature_used) / profile_completed * 100) if profile_completed > 0 else 0, 2)},
        {"stage": "Checkout Started", "count": checkout_started,
         "rate": round((checkout_started / signups * 100) if signups > 0 else 0, 2),
         "dropoff": round(((feature_used - checkout_started) / feature_used * 100) if feature_used > 0 else 0, 2)},
        {"stage": "Payment Completed", "count": payment_completed,
         "rate": round((payment_completed / signups * 100) if signups > 0 else 0, 2),
         "dropoff": round(((checkout_started - payment_completed) / checkout_started * 100) if checkout_started > 0 else 0, 2)},
    ]
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "funnel": funnel,
        "overall_conversion": round((payment_completed / signups * 100) if signups > 0 else 0, 2)
    }


# ============ Session Analytics ============

@router.get("/sessions/trends")
async def get_session_trends(
    request: Request,
    date_from: str = None,
    date_to: str = None,
    session_type: str = "all"  # all, coaching, peer
):
    """Get session trends over time"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Replace per-day count loop with two aggregations (2 DB calls instead of N×2)
    date_filter = {"status": "completed", "date": {"$gte": start_str, "$lte": end_str}}
    group_by_date = [
        {"$match": date_filter},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}}
    ]

    coaching_by_date: dict[str, int] = {}
    peer_by_date: dict[str, int] = {}

    if session_type in ["all", "coaching"]:
        async for doc in db.bookings.aggregate(group_by_date):
            coaching_by_date[doc["_id"]] = doc["count"]

    if session_type in ["all", "peer"]:
        async for doc in db.peer_sessions.aggregate(group_by_date):
            peer_by_date[doc["_id"]] = doc["count"]

    trends = []
    current = start_date
    while current <= end_date:
        date_key = current.strftime("%Y-%m-%d")
        coaching_count = coaching_by_date.get(date_key, 0)
        peer_count = peer_by_date.get(date_key, 0)
        trends.append({
            "date": date_key,
            "coaching": coaching_count,
            "peer": peer_count,
            "total": coaching_count + peer_count
        })
        current += timedelta(days=1)
    
    return {
        "date_range": {"from": start_str, "to": end_str},
        "session_type": session_type,
        "trends": trends,
        "summary": {
            "total_coaching": sum(t["coaching"] for t in trends),
            "total_peer": sum(t["peer"] for t in trends),
            "total_sessions": sum(t["total"] for t in trends)
        }
    }


# ============ Retention & LTV ============

@router.get("/retention")
async def get_retention_metrics(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get retention, churn, and lifetime value metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Get users with subscriptions using a minimal projection
    users = await db.users.find({
        "subscription": {"$exists": True}
    }, {"_id": 0, "subscription": 1, "created_at": 1}).to_list(5000)
    
    # Calculate metrics
    total_subs = len(users)
    active_subs = 0
    churned_subs = 0
    total_duration_days = 0
    churned_duration_count = 0
    
    for user in users:
        sub = user.get("subscription", {})
        
        if sub.get("status") == "active":
            active_subs += 1
        elif sub.get("status") in ["cancelled", "expired"]:
            churned_subs += 1
            
            # Calculate subscription duration for churned users
            start = sub.get("created_at")
            end = sub.get("cancelled_at") or sub.get("expired_at")
            if start and end:
                try:
                    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    duration = (end_dt - start_dt).days
                    total_duration_days += duration
                    churned_duration_count += 1
                except:
                    pass
    
    # Calculate rates
    churn_rate = (churned_subs / total_subs * 100) if total_subs > 0 else 0
    renewal_rate = 100 - churn_rate
    avg_duration = (total_duration_days / churned_duration_count) if churned_duration_count > 0 else 0
    
    # Aggregate total revenue and distinct paying users in one DB round-trip
    rev_agg = await db.payments.aggregate([
        {"$match": {"status": "captured"}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$amount"},
            "user_ids": {"$addToSet": "$user_id"}
        }}
    ]).to_list(1)
    total_revenue = rev_agg[0]["total_revenue"] if rev_agg else 0
    paying_users = len([u for u in (rev_agg[0]["user_ids"] if rev_agg else []) if u])
    avg_revenue_per_user = (total_revenue / paying_users) if paying_users > 0 else 0
    
    # Lifetime Value estimate (ARPU * avg duration in months)
    ltv = avg_revenue_per_user * (avg_duration / 30) if avg_duration > 0 else avg_revenue_per_user
    
    # Cohort retention (by signup month)
    cohort_data = {}
    for user in users:
        created = user.get("created_at", "")
        if created:
            try:
                cohort_month = created[:7]  # YYYY-MM
                if cohort_month not in cohort_data:
                    cohort_data[cohort_month] = {"total": 0, "retained": 0}
                cohort_data[cohort_month]["total"] += 1
                if user.get("subscription", {}).get("status") == "active":
                    cohort_data[cohort_month]["retained"] += 1
            except:
                pass
    
    cohorts = [
        {
            "cohort": k,
            "total": v["total"],
            "retained": v["retained"],
            "retention_rate": round((v["retained"] / v["total"] * 100) if v["total"] > 0 else 0, 2)
        }
        for k, v in sorted(cohort_data.items(), reverse=True)[:12]
    ]
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "metrics": {
            "total_subscribers": total_subs,
            "active_subscribers": active_subs,
            "churned_subscribers": churned_subs,
            "churn_rate": round(churn_rate, 2),
            "renewal_rate": round(renewal_rate, 2),
            "avg_subscription_duration_days": round(avg_duration, 1),
            "avg_revenue_per_user": round(avg_revenue_per_user, 2),
            "estimated_ltv": round(ltv, 2)
        },
        "cohort_retention": cohorts
    }


# ============ Feature Adoption ============

@router.get("/engagement/features")
async def get_feature_adoption(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get feature adoption rates"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    total_users = await db.users.count_documents({})
    
    # Feature adoption metrics
    features = {}
    
    # Helper function to query with flexible date matching
    # Handles both datetime objects and ISO string formats
    async def get_distinct_users(collection, user_field: str, date_field: str):
        """Get distinct users with flexible date matching"""
        # Try with datetime objects first (for native MongoDB dates)
        try:
            users_dt = await collection.distinct(user_field, {
                date_field: {"$gte": start_date, "$lte": end_date}
            })
            if users_dt:
                return users_dt
        except:
            pass
        
        # Try with ISO strings (for string-stored dates)
        try:
            users_str = await collection.distinct(user_field, {
                date_field: {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            })
            if users_str:
                return users_str
        except:
            pass
        
        # Fallback: get all distinct users without date filter
        # This ensures we show data even if date formats don't match
        try:
            all_users = await collection.distinct(user_field)
            return all_users
        except:
            return []
    
    # Drills
    users_with_drills = await get_distinct_users(db.drill_sessions, "user_id", "created_at")
    features["case_drills"] = {
        "users": len(users_with_drills),
        "adoption_rate": round((len(users_with_drills) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    # Videos - check multiple possible date fields
    users_with_videos = await get_distinct_users(db.video_progress, "user_id", "updated_at")
    if not users_with_videos:
        users_with_videos = await get_distinct_users(db.video_progress, "user_id", "created_at")
    if not users_with_videos:
        users_with_videos = await get_distinct_users(db.video_progress, "user_id", "last_watched")
    features["video_course"] = {
        "users": len(users_with_videos),
        "adoption_rate": round((len(users_with_videos) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    # Peer Practice
    users_with_peer = await get_distinct_users(db.peer_sessions, "requester_id", "created_at")
    partners = await get_distinct_users(db.peer_sessions, "partner_id", "created_at")
    all_peer_users = set((users_with_peer or []) + (partners or []))
    features["peer_practice"] = {
        "users": len(all_peer_users),
        "adoption_rate": round((len(all_peer_users) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    # Coaching - check multiple possible date fields
    users_with_coaching = await get_distinct_users(db.bookings, "user_id", "created_at")
    if not users_with_coaching:
        users_with_coaching = await get_distinct_users(db.bookings, "user_id", "booked_at")
    features["coaching"] = {
        "users": len(users_with_coaching),
        "adoption_rate": round((len(users_with_coaching) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    # Resources
    users_with_resources = await get_distinct_users(db.resource_access, "user_id", "accessed_at")
    if not users_with_resources:
        users_with_resources = await get_distinct_users(db.resource_access, "user_id", "created_at")
    features["resources"] = {
        "users": len(users_with_resources),
        "adoption_rate": round((len(users_with_resources) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    # Workshops
    users_with_workshops = await get_distinct_users(db.workshop_registrations, "user_id", "registered_at")
    if not users_with_workshops:
        users_with_workshops = await get_distinct_users(db.workshop_registrations, "user_id", "created_at")
    features["workshops"] = {
        "users": len(users_with_workshops),
        "adoption_rate": round((len(users_with_workshops) / total_users * 100) if total_users > 0 else 0, 2)
    }
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "total_users": total_users,
        "features": features
    }


# ============ Mentor Utilization ============

@router.get("/mentors/utilization")
async def get_mentor_utilization(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get mentor utilization metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Get all mentors
    mentors = await db.mentors.find({}, {"_id": 0}).to_list(100)
    
    mentor_stats = []
    for mentor in mentors:
        mentor_id = mentor.get("id")
        
        # Sessions booked
        booked = await db.bookings.count_documents({
            "mentor_id": mentor_id,
            "date": {"$gte": start_str, "$lte": end_str}
        })
        
        # Sessions completed
        completed = await db.bookings.count_documents({
            "mentor_id": mentor_id,
            "date": {"$gte": start_str, "$lte": end_str},
            "status": "completed"
        })
        
        # Calculate available slots (assuming 8 hours/day availability)
        days_in_range = (end_date - start_date).days + 1
        available_slots = days_in_range * 8  # Rough estimate
        
        utilization = (booked / available_slots * 100) if available_slots > 0 else 0
        
        mentor_stats.append({
            "mentor_id": mentor_id,
            "name": mentor.get("name"),
            "sessions_booked": booked,
            "sessions_completed": completed,
            "completion_rate": round((completed / booked * 100) if booked > 0 else 0, 2),
            "utilization_rate": round(utilization, 2)
        })
    
    # Sort by utilization
    mentor_stats.sort(key=lambda x: x["sessions_booked"], reverse=True)
    
    return {
        "date_range": {"from": start_str, "to": end_str},
        "mentors": mentor_stats,
        "summary": {
            "total_mentors": len(mentors),
            "total_sessions_booked": sum(m["sessions_booked"] for m in mentor_stats),
            "total_sessions_completed": sum(m["sessions_completed"] for m in mentor_stats),
            "avg_utilization": round(sum(m["utilization_rate"] for m in mentor_stats) / len(mentor_stats) if mentor_stats else 0, 2)
        }
    }


# ============ Content Engagement ============

@router.get("/engagement/content")
async def get_content_engagement(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get content engagement metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Helper function to count with flexible date matching
    async def count_with_flexible_date(collection, date_field: str, extra_filter: dict = None):
        """Count documents with flexible date matching"""
        base_filter = extra_filter or {}
        
        # Try with datetime objects first
        try:
            filter_dt = {**base_filter, date_field: {"$gte": start_date, "$lte": end_date}}
            count = await collection.count_documents(filter_dt)
            if count > 0:
                return count
        except:
            pass
        
        # Try with ISO strings
        try:
            filter_str = {**base_filter, date_field: {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
            count = await collection.count_documents(filter_str)
            if count > 0:
                return count
        except:
            pass
        
        # Fallback: count all (without date filter)
        try:
            return await collection.count_documents(base_filter)
        except:
            return 0
    
    # Video engagement - try multiple date fields
    video_views = await count_with_flexible_date(db.video_progress, "updated_at")
    if video_views == 0:
        video_views = await count_with_flexible_date(db.video_progress, "created_at")
    if video_views == 0:
        video_views = await count_with_flexible_date(db.video_progress, "last_watched")
    
    # Drill completions - check for completed status with flexible field name
    drill_completions = await count_with_flexible_date(db.drill_sessions, "created_at", {"status": "completed"})
    if drill_completions == 0:
        drill_completions = await count_with_flexible_date(db.drill_sessions, "created_at", {"completed": True})
    
    # Resource downloads/access
    resource_access = await count_with_flexible_date(db.resource_access, "accessed_at")
    if resource_access == 0:
        resource_access = await count_with_flexible_date(db.resource_access, "created_at")
    
    # Workshop registrations
    workshop_regs = await count_with_flexible_date(db.workshop_registrations, "registered_at")
    if workshop_regs == 0:
        workshop_regs = await count_with_flexible_date(db.workshop_registrations, "created_at")
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "engagement": {
            "video_views": video_views,
            "drill_completions": drill_completions,
            "resource_access": resource_access,
            "workshop_registrations": workshop_regs,
            "total_engagements": video_views + drill_completions + resource_access + workshop_regs
        }
    }


# ============ Support Tickets ============

@router.get("/support/tickets")
async def get_support_metrics(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get support ticket metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Try to get support tickets with flexible date matching
    tickets = []
    
    # Try with datetime objects first
    try:
        tickets = await db.support_tickets.find({
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).to_list(1000)
    except:
        pass
    
    # If no results, try with ISO strings
    if not tickets:
        try:
            tickets = await db.support_tickets.find({
                "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }).to_list(1000)
        except:
            pass
    
    # Fallback: get all tickets without date filter
    if not tickets:
        try:
            tickets = await db.support_tickets.find({}).to_list(1000)
        except:
            tickets = []
    
    total_tickets = len(tickets)
    open_tickets = len([t for t in tickets if t.get("status") == "open"])
    resolved_tickets = len([t for t in tickets if t.get("status") == "resolved"])
    
    # Group by category
    by_category = {}
    for t in tickets:
        cat = t.get("category", "general")
        by_category[cat] = by_category.get(cat, 0) + 1
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "metrics": {
            "total_tickets": total_tickets,
            "open_tickets": open_tickets,
            "resolved_tickets": resolved_tickets,
            "resolution_rate": round((resolved_tickets / total_tickets * 100) if total_tickets > 0 else 0, 2)
        },
        "by_category": by_category
    }


# ============ Export Endpoints ============

@router.get("/export/summary")
async def export_summary_csv(
    request: Request,
    date_from: str = None,
    date_to: str = None,
    category: str = "total"
):
    """Export summary analytics as CSV"""
    await verify_admin(request)
    
    # Get overview data
    overview = await get_analytics_overview(request, date_from, date_to, category)
    
    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Analytics Summary Export"])
    writer.writerow(["Date Range", f"{overview['date_range']['from']} to {overview['date_range']['to']}"])
    writer.writerow(["Category", category])
    writer.writerow([])
    
    # User metrics
    writer.writerow(["User Metrics"])
    writer.writerow(["Total Users", overview["metrics"].get("total_users", 0)])
    writer.writerow(["Active Users", overview["metrics"].get("active_users", 0)])
    writer.writerow([])
    
    # Subscription metrics
    if "subscription" in overview["metrics"]:
        sub = overview["metrics"]["subscription"]
        writer.writerow(["Subscription Metrics"])
        writer.writerow(["Active Subscriptions", sub.get("active_subscriptions", 0)])
        writer.writerow(["Free Trial Users", sub.get("free_trial_users", 0)])
        writer.writerow(["Subscribers Gained", sub.get("subscribers_gained", 0)])
        writer.writerow(["Subscribers Lost", sub.get("subscribers_lost", 0)])
        writer.writerow(["Net Growth", sub.get("net_growth", 0)])
        writer.writerow(["Free to Paid Rate (%)", sub.get("free_to_paid_rate", 0)])
        writer.writerow([])
    
    # Revenue metrics
    if "revenue" in overview["metrics"]:
        rev = overview["metrics"]["revenue"]
        writer.writerow(["Revenue Metrics"])
        writer.writerow(["Total Revenue", rev.get("total_revenue", 0)])
        writer.writerow(["Transactions", rev.get("num_transactions", 0)])
        writer.writerow(["Avg Order Value", rev.get("avg_order_value", 0)])
        writer.writerow([])
    
    # Coaching metrics
    if "coaching" in overview["metrics"]:
        coach = overview["metrics"]["coaching"]
        writer.writerow(["Coaching Metrics"])
        writer.writerow(["Coaching Sessions Done", coach.get("coaching_sessions_done", 0)])
        writer.writerow(["Peer Sessions Done", coach.get("peer_sessions_done", 0)])
        writer.writerow(["Active Coaching", coach.get("active_coaching", 0)])
        writer.writerow(["Completion Rate (%)", coach.get("completion_rate", 0)])
        writer.writerow([])
    
    csv_content = output.getvalue()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=analytics_summary_{date_from}_{date_to}.csv"}
    )


@router.get("/export/detailed/{report_type}")
async def export_detailed_csv(
    request: Request,
    report_type: str,
    date_from: str = None,
    date_to: str = None
):
    """
    Export detailed report as CSV.
    
    Report types: subscribers, revenue, sessions, retention, mentors
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "subscribers":
        # Export subscriber details
        writer.writerow(["Date", "Subscribers Gained", "Subscribers Lost", "Net Growth"])
        trends = await get_subscriber_trends(request, date_from, date_to)
        for t in trends["trends"]:
            writer.writerow([t["date"], t["gained"], t["lost"], t["net"]])
    
    elif report_type == "revenue":
        # Export revenue details
        writer.writerow(["Date", "Revenue", "Transactions"])
        trends = await get_revenue_trends(request, date_from, date_to)
        for t in trends["trends"]:
            writer.writerow([t["date"], t["revenue"], t["transactions"]])
    
    elif report_type == "sessions":
        # Export session details
        writer.writerow(["Date", "Coaching Sessions", "Peer Sessions", "Total"])
        trends = await get_session_trends(request, date_from, date_to)
        for t in trends["trends"]:
            writer.writerow([t["date"], t["coaching"], t["peer"], t["total"]])
    
    elif report_type == "retention":
        # Export cohort retention
        writer.writerow(["Cohort", "Total Users", "Retained", "Retention Rate (%)"])
        retention = await get_retention_metrics(request, date_from, date_to)
        for c in retention["cohort_retention"]:
            writer.writerow([c["cohort"], c["total"], c["retained"], c["retention_rate"]])
    
    elif report_type == "mentors":
        # Export mentor utilization
        writer.writerow(["Mentor", "Sessions Booked", "Sessions Completed", "Completion Rate (%)", "Utilization Rate (%)"])
        mentors = await get_mentor_utilization(request, date_from, date_to)
        for m in mentors["mentors"]:
            writer.writerow([m["name"], m["sessions_booked"], m["sessions_completed"], m["completion_rate"], m["utilization_rate"]])
    
    else:
        writer.writerow(["Invalid report type"])
    
    csv_content = output.getvalue()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_{date_from}_{date_to}.csv"}
    )


# ============ Custom Dashboard Config ============

@router.get("/dashboard-config")
async def get_dashboard_config(request: Request):
    """Get user's custom dashboard configuration"""
    await verify_admin(request)
    db = get_db(request)
    
    config = await db.admin_settings.find_one({"key": "analytics_dashboard_config"})
    
    if not config:
        # Return default config
        return {
            "widgets": [
                {"id": "active_users", "enabled": True, "order": 1},
                {"id": "subscriber_growth", "enabled": True, "order": 2},
                {"id": "revenue_trend", "enabled": True, "order": 3},
                {"id": "conversion_funnel", "enabled": True, "order": 4},
                {"id": "session_stats", "enabled": True, "order": 5},
                {"id": "retention_metrics", "enabled": True, "order": 6},
                {"id": "feature_adoption", "enabled": True, "order": 7},
                {"id": "mentor_utilization", "enabled": True, "order": 8},
                {"id": "content_engagement", "enabled": True, "order": 9},
                {"id": "support_tickets", "enabled": False, "order": 10},
            ]
        }
    
    return config.get("value", {})


@router.post("/dashboard-config")
async def save_dashboard_config(request: Request):
    """Save user's custom dashboard configuration"""
    await verify_admin(request)
    db = get_db(request)
    
    body = await request.json()
    widgets = body.get("widgets", [])
    
    await db.admin_settings.update_one(
        {"key": "analytics_dashboard_config"},
        {"$set": {"key": "analytics_dashboard_config", "value": {"widgets": widgets}}},
        upsert=True
    )
    
    return {"success": True, "message": "Dashboard configuration saved"}


# ============ MRR (Monthly Recurring Revenue) ============

@router.get("/mrr")
async def get_mrr_metrics(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get Monthly Recurring Revenue metrics and trends"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Get all active subscriptions with their plan details
    active_subs = await db.users.find({
        "subscription.status": "active",
        "plan": {"$nin": ["free_trial", None, ""]}
    }, {"_id": 0, "plan": 1, "subscription": 1}).to_list(10000)
    
    # Get plan prices
    plans = await db.plans.find({}, {"_id": 0, "plan_key": 1, "pricing": 1}).to_list(100)
    plan_prices = {}
    for plan in plans:
        pricing = plan.get("pricing", {})
        # Use monthly price or calculate from annual
        monthly_price = pricing.get("monthly", 0)
        if not monthly_price and pricing.get("annual"):
            monthly_price = pricing.get("annual") / 12
        plan_prices[plan.get("plan_key")] = monthly_price
    
    # Calculate current MRR
    current_mrr = 0
    mrr_by_plan = {}
    for user in active_subs:
        plan_key = user.get("plan")
        billing_cycle = user.get("subscription", {}).get("billing_cycle", "monthly")
        
        price = plan_prices.get(plan_key, 0)
        if billing_cycle == "annual":
            # Convert annual to monthly
            monthly_value = price / 12
        else:
            monthly_value = price
        
        current_mrr += monthly_value
        mrr_by_plan[plan_key] = mrr_by_plan.get(plan_key, 0) + monthly_value
    
    # Calculate MRR trend over time
    # Get subscription history
    all_users = await db.users.find({
        "subscription.created_at": {"$exists": True}
    }, {"_id": 0, "plan": 1, "subscription": 1}).to_list(10000)
    
    # Build monthly MRR trend
    mrr_trend = []
    current = start_date.replace(day=1)  # Start of month
    
    while current <= end_date:
        month_str = current.strftime("%Y-%m")
        month_end = (current.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        
        # Calculate MRR for this month
        month_mrr = 0
        for user in all_users:
            sub = user.get("subscription", {})
            created = sub.get("created_at", "")
            cancelled = sub.get("cancelled_at")
            
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    # Check if subscription was active during this month
                    if created_dt <= month_end:
                        # Check if not cancelled or cancelled after this month
                        is_active = True
                        if cancelled:
                            try:
                                cancelled_dt = datetime.fromisoformat(cancelled.replace("Z", "+00:00"))
                                if cancelled_dt < current:
                                    is_active = False
                            except:
                                pass
                        
                        if is_active:
                            plan_key = user.get("plan")
                            billing_cycle = sub.get("billing_cycle", "monthly")
                            price = plan_prices.get(plan_key, 0)
                            
                            if billing_cycle == "annual":
                                monthly_value = price / 12
                            else:
                                monthly_value = price
                            
                            month_mrr += monthly_value
                except:
                    pass
        
        mrr_trend.append({
            "month": month_str,
            "mrr": round(month_mrr, 2),
            "change": 0  # Will calculate after
        })
        
        # Move to next month
        current = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
    
    # Calculate month-over-month growth
    for i in range(1, len(mrr_trend)):
        prev_mrr = mrr_trend[i-1]["mrr"]
        curr_mrr = mrr_trend[i]["mrr"]
        if prev_mrr > 0:
            growth = ((curr_mrr - prev_mrr) / prev_mrr) * 100
            mrr_trend[i]["change"] = round(growth, 2)
    
    # Calculate growth rate
    if len(mrr_trend) >= 2:
        first_mrr = mrr_trend[0]["mrr"]
        last_mrr = mrr_trend[-1]["mrr"]
        overall_growth = ((last_mrr - first_mrr) / first_mrr * 100) if first_mrr > 0 else 0
    else:
        overall_growth = 0
    
    return {
        "current_mrr": round(current_mrr, 2),
        "mrr_by_plan": {k: round(v, 2) for k, v in mrr_by_plan.items()},
        "mrr_trend": mrr_trend,
        "growth_rate": round(overall_growth, 2),
        "active_subscriptions": len(active_subs)
    }


# ============ Checkout Abandonment ============

@router.get("/checkout-abandonment")
async def get_checkout_abandonment(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get checkout abandonment metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Get payment orders created (checkout initiated)
    checkout_initiated = await db.payment_orders.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str}
    })
    
    # Get successful payments (checkout completed)
    checkout_completed = await db.payments.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str},
        "status": "captured"
    })
    
    # Calculate abandonment
    abandoned = checkout_initiated - checkout_completed
    abandonment_rate = (abandoned / checkout_initiated * 100) if checkout_initiated > 0 else 0
    
    # Get trend data
    trends = []
    current = start_date
    while current <= end_date:
        date_key = current.strftime("%Y-%m-%d")
        next_day = current + timedelta(days=1)
        
        day_initiated = await db.payment_orders.count_documents({
            "created_at": {"$gte": current.isoformat(), "$lt": next_day.isoformat()}
        })
        
        day_completed = await db.payments.count_documents({
            "created_at": {"$gte": current.isoformat(), "$lt": next_day.isoformat()},
            "status": "captured"
        })
        
        day_abandoned = day_initiated - day_completed
        day_rate = (day_abandoned / day_initiated * 100) if day_initiated > 0 else 0
        
        trends.append({
            "date": date_key,
            "initiated": day_initiated,
            "completed": day_completed,
            "abandoned": day_abandoned,
            "abandonment_rate": round(day_rate, 2)
        })
        
        current = next_day
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "checkout_initiated": checkout_initiated,
        "checkout_completed": checkout_completed,
        "checkout_abandoned": abandoned,
        "abandonment_rate": round(abandonment_rate, 2),
        "trends": trends
    }


# ============ Website Traffic (Placeholder for Analytics Integration) ============

@router.get("/website-traffic")
async def get_website_traffic(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """
    Get website traffic metrics.
    
    Note: This endpoint provides placeholder data. For production use, integrate with:
    - Google Analytics
    - Mixpanel
    - Segment
    - Or implement custom event tracking
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Check if we have any website_analytics collection
    has_analytics = "website_analytics" in await db.list_collection_names()
    
    if has_analytics:
        # If analytics data exists, fetch it
        sessions_data = await db.website_analytics.find({
            "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": end_date.strftime("%Y-%m-%d")}
        }).to_list(1000)
        
        total_sessions = sum(d.get("sessions", 0) for d in sessions_data)
        total_users = sum(d.get("users", 0) for d in sessions_data)
        total_pageviews = sum(d.get("pageviews", 0) for d in sessions_data)
        avg_session_duration = sum(d.get("avg_session_duration", 0) for d in sessions_data) / len(sessions_data) if sessions_data else 0
        bounce_rate = sum(d.get("bounce_rate", 0) for d in sessions_data) / len(sessions_data) if sessions_data else 0
        
        # Traffic sources
        traffic_sources = {}
        for d in sessions_data:
            for source, count in d.get("traffic_sources", {}).items():
                traffic_sources[source] = traffic_sources.get(source, 0) + count
    else:
        # Return note about integration needed
        total_sessions = 0
        total_users = 0
        total_pageviews = 0
        avg_session_duration = 0
        bounce_rate = 0
        traffic_sources = {}
    
    # Pages per session
    pages_per_session = (total_pageviews / total_sessions) if total_sessions > 0 else 0
    
    # Generate trend data (daily breakdown)
    trends = []
    current = start_date
    while current <= end_date:
        date_key = current.strftime("%Y-%m-%d")
        
        if has_analytics:
            day_data = next((d for d in sessions_data if d.get("date") == date_key), {})
            day_sessions = day_data.get("sessions", 0)
            day_users = day_data.get("users", 0)
            day_bounce = day_data.get("bounce_rate", 0)
        else:
            day_sessions = 0
            day_users = 0
            day_bounce = 0
        
        trends.append({
            "date": date_key,
            "sessions": day_sessions,
            "users": day_users,
            "bounce_rate": day_bounce
        })
        
        current += timedelta(days=1)
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "integration_status": "active" if has_analytics else "not_configured",
        "note": "Integrate Google Analytics or custom event tracking for real data" if not has_analytics else None,
        "metrics": {
            "total_sessions": total_sessions,
            "total_users": total_users,
            "pages_per_session": round(pages_per_session, 2),
            "avg_session_duration": round(avg_session_duration, 2),
            "bounce_rate": round(bounce_rate, 2)
        },
        "traffic_sources": traffic_sources,
        "trends": trends
    }


# ============ Subscription Health Metrics ============

@router.get("/subscription-health")
async def get_subscription_health(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get comprehensive subscription health metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Active subscribers (paid plans only)
    active_subscribers = await db.users.count_documents({
        "subscription.status": "active",
        "plan": {"$nin": ["free_trial", None, ""]}
    })
    
    # Free trial users
    free_trial_users = await db.users.count_documents({
        "plan": "free_trial"
    })
    
    # Churned users (cancelled in date range) - check both field names for compatibility
    churned_users = await db.users.count_documents({
        "$or": [
            {"subscription.cancelled_at": {"$gte": start_str, "$lte": end_str}},
            {"subscription.cancellation_date": {"$gte": start_str, "$lte": end_str}}
        ]
    })
    
    # Get all users with subscriptions for calculations
    all_subs = await db.users.find({
        "subscription.created_at": {"$exists": True}
    }, {"_id": 0, "plan": 1, "subscription": 1, "created_at": 1}).to_list(10000)
    
    # Calculate average subscription duration
    total_duration_days = 0
    duration_count = 0
    for user in all_subs:
        sub = user.get("subscription", {})
        created = sub.get("created_at")
        cancelled = sub.get("cancelled_at")
        
        if created:
            try:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if cancelled:
                    # Cancelled subscription - calculate duration
                    cancelled_dt = datetime.fromisoformat(cancelled.replace("Z", "+00:00"))
                    duration = (cancelled_dt - created_dt).days
                    total_duration_days += duration
                    duration_count += 1
                else:
                    # Active subscription - duration until now
                    duration = (datetime.now() - created_dt).days
                    total_duration_days += duration
                    duration_count += 1
            except:
                pass
    
    avg_subscription_duration = (total_duration_days / duration_count) if duration_count > 0 else 0
    
    # Trial activation rate (users who used trial features)
    # Check if trial users have any activity (drills, videos, sessions, etc.)
    trial_users_list = await db.users.find(
        {"plan": "free_trial"},
        {"_id": 0, "id": 1, "email": 1}
    ).to_list(10000)
    
    activated_trial_users = 0
    for user in trial_users_list:
        user_id = user.get("id") or user.get("email")
        # Check for any activity
        has_activity = False
        
        # Check drill sessions
        drill_count = await db.drill_sessions.count_documents({"user_id": user_id})
        if drill_count > 0:
            has_activity = True
        
        # Check video progress
        if not has_activity:
            video_count = await db.video_progress.count_documents({"user_id": user_id})
            if video_count > 0:
                has_activity = True
        
        # Check peer sessions
        if not has_activity:
            peer_count = await db.peer_sessions.count_documents({
                "$or": [{"requester_id": user_id}, {"partner_id": user_id}]
            })
            if peer_count > 0:
                has_activity = True
        
        if has_activity:
            activated_trial_users += 1
    
    trial_activation_rate = (activated_trial_users / len(trial_users_list) * 100) if len(trial_users_list) > 0 else 0
    
    # Trial to paid conversion
    # Users who were on free_trial and are now on paid plans
    # This is complex - we'll estimate from current data (candidates only)
    total_users = await db.users.count_documents({
        "created_at": {"$exists": True},
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    paid_users = active_subscribers
    trial_to_paid_rate = (paid_users / total_users * 100) if total_users > 0 else 0
    
    # Churn rate
    # Churn rate = (Churned in period / Active at start of period) * 100
    # Get active subscribers at start of period
    active_at_start = await db.users.count_documents({
        "subscription.status": "active",
        "plan": {"$nin": ["free_trial", None, ""]},
        "subscription.created_at": {"$lt": start_str}
    })
    
    churn_rate = (churned_users / active_at_start * 100) if active_at_start > 0 else 0
    
    # Signups in date range
    signups = await db.users.count_documents({
        "created_at": {"$gte": start_str, "$lte": end_str}
    })
    
    # Signups who started trial (activated features)
    signups_list = await db.users.find(
        {"created_at": {"$gte": start_str, "$lte": end_str}},
        {"_id": 0, "id": 1, "email": 1}
    ).to_list(10000)
    
    activated_signups = 0
    for user in signups_list:
        user_id = user.get("id") or user.get("email")
        # Check for any activity
        activity_count = await db.drill_sessions.count_documents({"user_id": user_id})
        if activity_count == 0:
            activity_count = await db.video_progress.count_documents({"user_id": user_id})
        if activity_count == 0:
            activity_count = await db.peer_sessions.count_documents({
                "$or": [{"requester_id": user_id}, {"partner_id": user_id}]
            })
        
        if activity_count > 0:
            activated_signups += 1
    
    signup_activation_rate = (activated_signups / signups * 100) if signups > 0 else 0
    
    # Get plan distribution
    plan_dist = {}
    for plan in ["free_trial", "basic_plan", "pro_plan", "pro_plus", "last_mile", "mid_mile", "full_prep", "pinnacle"]:
        count = await db.users.count_documents({"plan": plan})
        if count > 0:
            plan_dist[plan] = count
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "metrics": {
            "active_subscribers": active_subscribers,
            "free_trial_users": free_trial_users,
            "churned_users": churned_users,
            "churn_rate": round(churn_rate, 2),
            "avg_subscription_duration_days": round(avg_subscription_duration, 1),
            "avg_subscription_duration_months": round(avg_subscription_duration / 30, 1),
            "trial_activation_rate": round(trial_activation_rate, 2),
            "trial_to_paid_conversion": round(trial_to_paid_rate, 2),
            "signups_in_period": signups,
            "signups_activated": activated_signups,
            "signup_activation_rate": round(signup_activation_rate, 2),
            "plan_distribution": plan_dist
        }
    }


# ============ Session Metrics ============

@router.get("/session-metrics")
async def get_session_metrics(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """Get comprehensive session metrics"""
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Total coaching sessions done
    coaching_done = await db.bookings.count_documents({
        "status": "completed",
        "date": {"$gte": start_str, "$lte": end_str}
    })
    
    # Total peer sessions done
    peer_done = await db.peer_sessions.count_documents({
        "status": "completed",
        "date": {"$gte": start_str, "$lte": end_str}
    })
    
    # Active coaching members (users with upcoming sessions)
    active_coaching_users = await db.bookings.distinct("user_id", {
        "status": {"$in": ["confirmed", "pending"]},
        "date": {"$gte": datetime.now().strftime("%Y-%m-%d")}
    })
    
    # Average sessions per user
    # Get all users who had sessions in date range
    coaching_users = await db.bookings.distinct("user_id", {
        "date": {"$gte": start_str, "$lte": end_str}
    })
    peer_requesters = await db.peer_sessions.distinct("requester_id", {
        "date": {"$gte": start_str, "$lte": end_str}
    })
    peer_partners = await db.peer_sessions.distinct("partner_id", {
        "date": {"$gte": start_str, "$lte": end_str}
    })
    
    all_session_users = set(coaching_users + peer_requesters + peer_partners)
    total_sessions = coaching_done + peer_done
    avg_sessions_per_user = (total_sessions / len(all_session_users)) if len(all_session_users) > 0 else 0
    
    # Session completion rate
    total_booked_coaching = await db.bookings.count_documents({
        "date": {"$gte": start_str, "$lte": end_str}
    })
    total_booked_peer = await db.peer_sessions.count_documents({
        "date": {"$gte": start_str, "$lte": end_str}
    })
    total_booked = total_booked_coaching + total_booked_peer
    completion_rate = (total_sessions / total_booked * 100) if total_booked > 0 else 0
    
    # Average session payout to mentor
    completed_coaching = await db.bookings.find({
        "status": "completed",
        "date": {"$gte": start_str, "$lte": end_str}
    }).to_list(10000)
    
    total_payout = 0
    for session in completed_coaching:
        if session.get("payment_status") == "paid":
            amount = session.get("payment_amount_override")
            if not amount:
                # Get mentor's rate
                mentor = await db.mentors.find_one({"id": session.get("mentor_id")})
                amount = mentor.get("hourly_rate", 1500) if mentor else 1500
            total_payout += amount
    
    avg_session_payout = (total_payout / len([s for s in completed_coaching if s.get("payment_status") == "paid"])) if len([s for s in completed_coaching if s.get("payment_status") == "paid"]) > 0 else 0
    
    return {
        "date_range": {"from": start_str, "to": end_str},
        "metrics": {
            "total_coaching_sessions": coaching_done,
            "total_peer_sessions": peer_done,
            "total_sessions": total_sessions,
            "active_coaching_members": len(active_coaching_users),
            "unique_session_users": len(all_session_users),
            "avg_sessions_per_user": round(avg_sessions_per_user, 2),
            "session_completion_rate": round(completion_rate, 2),
            "avg_session_payout": round(avg_session_payout, 2),
            "total_session_payout": round(total_payout, 2)
        }
    }


# ============ Member Breakdown Analytics ============

@router.get("/member-breakdown")
async def get_member_breakdown(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """
    Get comprehensive breakdown of members by plan type and category.
    Shows coaching members, subscription members, free trial, etc.
    Active/Inactive is based on login activity during the selected date range.
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Convert to ISO format for comparison
    start_date_iso = start_date.isoformat()
    end_date_iso = (end_date + timedelta(days=1)).isoformat()  # Include end date
    
    # Total candidates (excluding mentors and admins)
    total_candidates = await db.users.count_documents({
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Active users (logged in during the selected date range)
    active_users_count = await db.users.count_documents({
        "last_login_at": {
            "$gte": start_date_iso,
            "$lt": end_date_iso
        },
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Inactive users (did NOT log in during the selected date range)
    inactive_users_count = total_candidates - active_users_count
    
    # New users (signed up during the selected date range)
    new_users_count = await db.users.count_documents({
        "created_at": {
            "$gte": start_date_iso,
            "$lt": end_date_iso
        },
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Free trial users
    free_trial_count = await db.users.count_documents({
        "plan": "free_trial",
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Users without any plan (no plan assigned)
    no_plan_count = await db.users.count_documents({
        "$or": [
            {"plan": {"$in": [None, ""]}},
            {"plan": {"$exists": False}}
        ],
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Get all plans to categorize them
    plans = await db.plans.find({}, {"_id": 0}).to_list(100)
    plan_categories = {}
    for p in plans:
        category = p.get("category", "subscription")
        
        # Add mapping for all possible keys the plan might be stored as
        # 1. By key field (if set)
        if p.get("key"):
            plan_categories[p.get("key")] = category
        
        # 2. By ID (UUID)
        if p.get("id"):
            plan_categories[p.get("id")] = category
        
        # 3. By name converted to lowercase with underscores (e.g., "Full Prep" -> "full_prep")
        if p.get("name"):
            name_key = p.get("name", "").lower().replace(" ", "_")
            plan_categories[name_key] = category
        
        # 4. By exact name
        if p.get("name"):
            plan_categories[p.get("name")] = category
    
    # Count users by plan category
    category_counts = {
        "subscription": 0,
        "coaching": 0,
        "cohort": 0,
        "addon": 0
    }
    
    plan_counts = {}
    
    # Get all paid users (not free_trial, not null)
    paid_users = await db.users.find({
        "plan": {"$nin": ["free_trial", None, ""]},
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    }, {"_id": 0, "plan": 1, "subscription": 1}).to_list(10000)
    
    for user in paid_users:
        plan = user.get("plan", "")
        sub = user.get("subscription", {})
        
        # Count by plan
        if plan:
            plan_counts[plan] = plan_counts.get(plan, 0) + 1
            
            # Categorize
            category = plan_categories.get(plan, "subscription")
            if category in category_counts:
                category_counts[category] += 1
            else:
                category_counts["subscription"] += 1
    
    # Active coaching members (users with upcoming confirmed sessions)
    active_coaching_user_ids = await db.bookings.distinct("user_id", {
        "status": {"$in": ["confirmed", "pending"]},
        "date": {"$gte": datetime.now().strftime("%Y-%m-%d")}
    })
    
    # Total mentors
    total_mentors = await db.mentors.count_documents({})
    active_mentors = await db.mentors.count_documents({"is_active": True})
    
    # Users with active subscriptions
    active_subscription_count = await db.users.count_documents({
        "subscription.status": "active",
        "plan": {"$nin": ["free_trial", None, ""]},
        "is_mentor": {"$ne": True},
        "is_admin": {"$ne": True}
    })
    
    # Calculate percentages
    def calc_pct(count, total):
        return round((count / total * 100), 1) if total > 0 else 0
    
    return {
        "date_range": {"from": start_date.strftime("%Y-%m-%d"), "to": end_date.strftime("%Y-%m-%d")},
        "summary": {
            "total_candidates": total_candidates,
            "total_paid_members": len(paid_users),
            "free_trial_members": free_trial_count,
            "no_plan_members": no_plan_count,
            "active_subscriptions": active_subscription_count,
            "active_coaching_members": len(active_coaching_user_ids)
        },
        "activity": {
            "new_users": {
                "count": new_users_count,
                "percentage": calc_pct(new_users_count, total_candidates),
                "label": "Signed up during period"
            },
            "active_users": {
                "count": active_users_count,
                "percentage": calc_pct(active_users_count, total_candidates),
                "label": "Logged in during period"
            },
            "inactive_users": {
                "count": inactive_users_count,
                "percentage": calc_pct(inactive_users_count, total_candidates),
                "label": "Did not log in during period"
            }
        },
        "by_category": {
            "subscription": {
                "count": category_counts["subscription"],
                "percentage": calc_pct(category_counts["subscription"], total_candidates),
                "label": "Subscription Plans"
            },
            "coaching": {
                "count": category_counts["coaching"],
                "percentage": calc_pct(category_counts["coaching"], total_candidates),
                "label": "Coaching Programs"
            },
            "cohort": {
                "count": category_counts["cohort"],
                "percentage": calc_pct(category_counts["cohort"], total_candidates),
                "label": "Cohort Programs"
            },
            "addon": {
                "count": category_counts["addon"],
                "percentage": calc_pct(category_counts["addon"], total_candidates),
                "label": "Add-ons"
            },
            "free_trial": {
                "count": free_trial_count,
                "percentage": calc_pct(free_trial_count, total_candidates),
                "label": "Free Trial"
            },
            "no_plan": {
                "count": no_plan_count,
                "percentage": calc_pct(no_plan_count, total_candidates),
                "label": "No Plan Assigned"
            }
        },
        "by_plan": plan_counts,
        "mentors": {
            "total": total_mentors,
            "active": active_mentors
        }
    }



@router.get("/coaching-sessions-analytics")
async def get_coaching_sessions_analytics(
    request: Request,
    date_from: str = None,
    date_to: str = None
):
    """
    Get coaching session performance metrics with daily breakdown.
    """
    await verify_admin(request)
    db = get_db(request)
    
    start_date, end_date = parse_date_range(date_from, date_to)
    
    # Date range filter
    date_filter = {
        "date": {
            "$gte": start_date.strftime("%Y-%m-%d"),
            "$lte": end_date.strftime("%Y-%m-%d")
        }
    }
    
    # Total sessions scheduled (all statuses)
    total_scheduled = await db.bookings.count_documents(date_filter)
    
    # Sessions by status - new status system
    status_counts = {}
    statuses = ["confirmed", "completed", "mentor_no_show", "candidate_no_show", "both_no_show",
                "mentor_cancelled", "candidate_cancelled", "mentor_rescheduled", "candidate_rescheduled"]
    
    for status in statuses:
        count = await db.bookings.count_documents({**date_filter, "status": status})
        status_counts[status] = count
    
    # No-show breakdown - include both new and legacy status values
    mentor_no_show = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "mentor_no_show"},
            {"completion_status": "mentor_no_show"},
            {"completion_status": {"$regex": "mentor.*no.*show", "$options": "i"}}
        ]
    })
    
    candidate_no_show = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "candidate_no_show"},
            {"completion_status": "candidate_no_show"},
            {"completion_status": {"$regex": "candidate.*no.*show", "$options": "i"}}
        ]
    })
    
    both_no_show = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "both_no_show"},
            {"status": "no_show"}  # Legacy status
        ]
    })
    
    # Rescheduled breakdown - include both new and legacy status values
    mentor_reschedule = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "mentor_rescheduled"},
            {"status": "rescheduled", "rescheduled_by": "mentor"}
        ]
    })
    
    candidate_reschedule = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "candidate_rescheduled"},
            {"status": "rescheduled", "rescheduled_by": "candidate"}
        ]
    })
    
    # Cancellation breakdown - include both new and legacy status values
    mentor_cancellation = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "mentor_cancelled"},
            {"status": "cancelled_by_mentor"}
        ]
    })
    
    candidate_cancellation = await db.bookings.count_documents({
        **date_filter,
        "$or": [
            {"status": "candidate_cancelled"},
            {"status": "cancelled_by_candidate"}
        ]
    })
    
    # Daily completed sessions for line graph
    pipeline = [
        {"$match": {**date_filter, "status": "completed"}},
        {"$group": {
            "_id": "$date",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_completed_cursor = db.bookings.aggregate(pipeline)
    daily_completed = await daily_completed_cursor.to_list(1000)
    
    # Fill in missing dates with 0
    daily_data = []
    current_date = start_date
    completed_dict = {item["_id"]: item["count"] for item in daily_completed}
    
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        daily_data.append({
            "date": date_str,
            "completed": completed_dict.get(date_str, 0)
        })
        current_date += timedelta(days=1)
    
    # Calculate number of days in the date range
    total_days = (end_date - start_date).days + 1
    
    # Calculate average sessions per day
    completed_count = status_counts.get("completed", 0)
    avg_sessions_per_day = round(completed_count / total_days, 2) if total_days > 0 else 0
    
    return {
        "date_range": {
            "from": start_date.strftime("%Y-%m-%d"),
            "to": end_date.strftime("%Y-%m-%d"),
            "total_days": total_days
        },
        "summary": {
            "total_scheduled": total_scheduled,
            "completed": completed_count,
            "confirmed": status_counts.get("confirmed", 0),
            "completion_rate": round(completed_count / total_scheduled * 100, 1) if total_scheduled > 0 else 0,
            "avg_sessions_per_day": avg_sessions_per_day
        },
        "breakdown": {
            "no_shows": {
                "mentor": mentor_no_show,
                "candidate": candidate_no_show,
                "both": both_no_show,
                "total": mentor_no_show + candidate_no_show + both_no_show
            },
            "cancellations": {
                "mentor": mentor_cancellation,
                "candidate": candidate_cancellation,
                "total": mentor_cancellation + candidate_cancellation
            },
            "reschedules": {
                "mentor": mentor_reschedule,
                "candidate": candidate_reschedule,
                "total": mentor_reschedule + candidate_reschedule
            },
            "disruptions": {
                "mentor": mentor_no_show + mentor_cancellation + mentor_reschedule,
                "candidate": candidate_no_show + candidate_cancellation + candidate_reschedule,
                "both_no_show": both_no_show
            }
        },
        "daily_completed": daily_data
    }



# ============ Subscription Analytics ============

@router.get("/subscription-analytics")
async def get_subscription_analytics(request: Request):
    """
    Get comprehensive subscription analytics including:
    - Subscriptions by plan (Basic, Pro, Pro Plus) and duration (1 or 6 month)
    - Active vs Expired subscriptions
    - Average price per plan
    - Customer lifetime (total months purchased)
    - Customer LTV (total revenue per customer)
    """
    await verify_admin(request)
    db = get_db(request)
    
    now = datetime.utcnow()
    
    # Subscription plan keys to filter
    SUBSCRIPTION_PLAN_KEYS = ["basic_plan", "pro_plan", "pro_plus"]
    
    # ========== 1. Get all subscription purchases from payment_orders ==========
    subscription_orders = await db.payment_orders.find(
        {
            "status": {"$in": ["paid", "completed"]},
            "plan_key": {"$in": SUBSCRIPTION_PLAN_KEYS}
        },
        {"_id": 0}
    ).to_list(50000)
    
    # Also check payments collection for subscription payments
    subscription_payments = await db.payments.find(
        {
            "status": "captured",
            "plan_key": {"$in": SUBSCRIPTION_PLAN_KEYS}
        },
        {"_id": 0}
    ).to_list(50000)
    
    # Combine and deduplicate (prefer payment_orders as primary source)
    seen_order_ids = set(o.get("razorpay_order_id") for o in subscription_orders if o.get("razorpay_order_id"))
    for sp in subscription_payments:
        if sp.get("razorpay_order_id") not in seen_order_ids:
            subscription_orders.append(sp)
    
    # ========== 2. Count subscriptions by plan and duration ==========
    plan_duration_counts = {
        "basic_plan": {"1_month": 0, "6_month": 0, "total": 0},
        "pro_plan": {"1_month": 0, "6_month": 0, "total": 0},
        "pro_plus": {"1_month": 0, "6_month": 0, "total": 0}
    }
    
    plan_revenue = {
        "basic_plan": {"total": 0, "count": 0},
        "pro_plan": {"total": 0, "count": 0},
        "pro_plus": {"total": 0, "count": 0}
    }
    
    # Get plan pricing for duration inference
    plans = await db.plans.find(
        {"plan_key": {"$in": SUBSCRIPTION_PLAN_KEYS}},
        {"_id": 0, "plan_key": 1, "pricing": 1}
    ).to_list(10)
    
    plan_pricing = {}
    for plan in plans:
        plan_pricing[plan.get("plan_key")] = plan.get("pricing", {})
    
    # Customer purchases tracking for LTV
    customer_purchases = {}  # user_id -> list of purchases
    customer_subscription_months = {}  # user_id -> total months purchased
    
    for order in subscription_orders:
        plan_key = order.get("plan_key")
        if plan_key not in plan_duration_counts:
            continue
            
        # Determine billing cycle
        billing_cycle = order.get("billing_cycle", "")
        amount = order.get("amount", 0)
        
        # If billing_cycle not stored, infer from amount
        if not billing_cycle and plan_key in plan_pricing:
            pricing = plan_pricing[plan_key]
            one_month_price = pricing.get("one_month", 0)
            six_month_price = pricing.get("six_month", 0)
            
            # Compare with pricing (accounting for GST ~18%)
            if six_month_price and amount > 0:
                # 6-month prices are typically lower per month
                six_month_total = six_month_price * 6 * 1.18  # Approximate with GST
                one_month_total = one_month_price * 1.18
                
                # If amount is closer to 6-month total, it's 6-month
                if six_month_price and abs(amount - six_month_total) < abs(amount - one_month_total):
                    billing_cycle = "six_month"
                else:
                    billing_cycle = "one_month"
            else:
                billing_cycle = "one_month"
        
        # Normalize billing cycle
        if billing_cycle in ["6_month", "six_month", "6month", "6-month"]:
            duration_key = "6_month"
            months = 6
        else:
            duration_key = "1_month"
            months = 1
        
        plan_duration_counts[plan_key][duration_key] += 1
        plan_duration_counts[plan_key]["total"] += 1
        
        # Track revenue
        plan_revenue[plan_key]["total"] += amount
        plan_revenue[plan_key]["count"] += 1
        
        # Track customer purchases for LTV
        user_id = order.get("user_id")
        if user_id:
            if user_id not in customer_purchases:
                customer_purchases[user_id] = []
                customer_subscription_months[user_id] = 0
            customer_purchases[user_id].append(order)
            customer_subscription_months[user_id] += months
    
    # ========== 3. Calculate Active vs Expired subscriptions ==========
    # Get unique subscription users with their current status
    subscription_user_ids = list(customer_purchases.keys())
    
    active_count = 0
    expired_count = 0
    
    if subscription_user_ids:
        users_with_subscription = await db.users.find(
            {"id": {"$in": subscription_user_ids}},
            {"_id": 0, "id": 1, "plan_end_date": 1, "subscription_end": 1, "plan": 1}
        ).to_list(50000)
        
        for user in users_with_subscription:
            # Check plan_end_date or subscription_end
            end_date_str = user.get("plan_end_date") or user.get("subscription_end")
            if end_date_str:
                try:
                    if isinstance(end_date_str, str):
                        end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00").replace("+00:00", ""))
                    else:
                        end_date = end_date_str
                    
                    if end_date > now:
                        active_count += 1
                    else:
                        expired_count += 1
                except Exception:
                    expired_count += 1
            else:
                expired_count += 1
    
    # ========== 4. Calculate Average Price per Plan ==========
    avg_price_per_plan = {}
    for plan_key, data in plan_revenue.items():
        plan_name = plan_key.replace("_", " ").title().replace("Plan", "").strip()
        if plan_key == "pro_plus":
            plan_name = "Pro Plus"
        avg_price_per_plan[plan_key] = {
            "name": plan_name,
            "avg_price": round(data["total"] / data["count"], 2) if data["count"] > 0 else 0,
            "total_revenue": round(data["total"], 2),
            "purchase_count": data["count"]
        }
    
    overall_subscription_revenue = sum(d["total"] for d in plan_revenue.values())
    overall_subscription_count = sum(d["count"] for d in plan_revenue.values())
    overall_avg_price = round(overall_subscription_revenue / overall_subscription_count, 2) if overall_subscription_count > 0 else 0
    
    # ========== 5. Calculate Customer Lifetime and LTV ==========
    # Get ALL purchases for LTV (including coaching, add-ons, etc.)
    all_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},
        {"_id": 0, "user_id": 1, "amount": 1, "plan_key": 1}
    ).to_list(50000)
    
    all_payments = await db.payments.find(
        {"status": "captured"},
        {"_id": 0, "user_id": 1, "amount": 1, "plan_key": 1}
    ).to_list(50000)
    
    # Calculate total revenue per customer
    customer_total_revenue = {}
    
    for order in all_orders:
        user_id = order.get("user_id")
        if user_id:
            customer_total_revenue[user_id] = customer_total_revenue.get(user_id, 0) + order.get("amount", 0)
    
    seen_payment_ids = set(o.get("razorpay_payment_id") for o in all_orders if o.get("razorpay_payment_id"))
    for payment in all_payments:
        if payment.get("razorpay_payment_id") not in seen_payment_ids:
            user_id = payment.get("user_id")
            if user_id:
                customer_total_revenue[user_id] = customer_total_revenue.get(user_id, 0) + payment.get("amount", 0)
    
    # Calculate LTV metrics
    total_customers_with_purchases = len(customer_total_revenue)
    total_revenue_all_customers = sum(customer_total_revenue.values())
    avg_ltv = round(total_revenue_all_customers / total_customers_with_purchases, 2) if total_customers_with_purchases > 0 else 0
    
    # Calculate subscription customer specific LTV
    subscription_customer_ltv = {}
    for user_id in customer_purchases.keys():
        subscription_customer_ltv[user_id] = customer_total_revenue.get(user_id, 0)
    
    subscription_customer_count = len(subscription_customer_ltv)
    subscription_total_ltv = sum(subscription_customer_ltv.values())
    avg_subscription_customer_ltv = round(subscription_total_ltv / subscription_customer_count, 2) if subscription_customer_count > 0 else 0
    
    # Average lifetime (months) for subscription customers
    total_subscription_months = sum(customer_subscription_months.values())
    avg_lifetime_months = round(total_subscription_months / subscription_customer_count, 2) if subscription_customer_count > 0 else 0
    
    # Distribution of customer lifetimes
    lifetime_distribution = {
        "1_month": 0,
        "2_3_months": 0,
        "4_6_months": 0,
        "7_12_months": 0,
        "12_plus_months": 0
    }
    
    for user_id, months in customer_subscription_months.items():
        if months <= 1:
            lifetime_distribution["1_month"] += 1
        elif months <= 3:
            lifetime_distribution["2_3_months"] += 1
        elif months <= 6:
            lifetime_distribution["4_6_months"] += 1
        elif months <= 12:
            lifetime_distribution["7_12_months"] += 1
        else:
            lifetime_distribution["12_plus_months"] += 1
    
    # ========== Format Response ==========
    return {
        "summary": {
            "total_subscription_purchases": overall_subscription_count,
            "total_subscription_revenue": round(overall_subscription_revenue, 2),
            "unique_subscription_customers": subscription_customer_count,
            "active_subscriptions": active_count,
            "expired_subscriptions": expired_count,
            "overall_avg_price": overall_avg_price,
            "avg_customer_lifetime_months": avg_lifetime_months,
            "avg_customer_ltv": avg_subscription_customer_ltv,
            "total_ltv": round(subscription_total_ltv, 2)
        },
        "by_plan": {
            "basic_plan": {
                "name": "Basic",
                "counts": plan_duration_counts["basic_plan"],
                "avg_price": avg_price_per_plan["basic_plan"]["avg_price"],
                "total_revenue": avg_price_per_plan["basic_plan"]["total_revenue"]
            },
            "pro_plan": {
                "name": "Pro",
                "counts": plan_duration_counts["pro_plan"],
                "avg_price": avg_price_per_plan["pro_plan"]["avg_price"],
                "total_revenue": avg_price_per_plan["pro_plan"]["total_revenue"]
            },
            "pro_plus": {
                "name": "Pro Plus",
                "counts": plan_duration_counts["pro_plus"],
                "avg_price": avg_price_per_plan["pro_plus"]["avg_price"],
                "total_revenue": avg_price_per_plan["pro_plus"]["total_revenue"]
            }
        },
        "by_duration": {
            "1_month": {
                "total": sum(p["1_month"] for p in plan_duration_counts.values()),
                "by_plan": {k: v["1_month"] for k, v in plan_duration_counts.items()}
            },
            "6_month": {
                "total": sum(p["6_month"] for p in plan_duration_counts.values()),
                "by_plan": {k: v["6_month"] for k, v in plan_duration_counts.items()}
            }
        },
        "subscription_status": {
            "active": active_count,
            "expired": expired_count,
            "total_customers": subscription_customer_count
        },
        "lifetime_metrics": {
            "avg_lifetime_months": avg_lifetime_months,
            "total_subscription_months_sold": total_subscription_months,
            "distribution": lifetime_distribution
        },
        "ltv_metrics": {
            "avg_ltv_per_subscription_customer": avg_subscription_customer_ltv,
            "total_ltv_subscription_customers": round(subscription_total_ltv, 2),
            "avg_ltv_all_customers": avg_ltv,
            "total_paying_customers": total_customers_with_purchases
        }
    }



# ============ Mixpanel Analytics Sync ============

from fastapi import BackgroundTasks
import asyncio

# Store sync status in memory (will reset on server restart)
_mixpanel_sync_status = {
    "users_sync": {"status": "idle", "result": None, "started_at": None},
    "events_sync": {"status": "idle", "result": None, "started_at": None}
}

@router.get("/mixpanel/status")
async def get_mixpanel_status(request: Request):
    """Get Mixpanel integration status and sync job status"""
    await verify_admin(request)
    
    from services import mixpanel_service
    
    return {
        "enabled": mixpanel_service.is_enabled(),
        "project_token_configured": bool(mixpanel_service.MIXPANEL_PROJECT_TOKEN),
        "timestamp": datetime.now().isoformat(),
        "sync_status": _mixpanel_sync_status
    }


async def _run_users_sync(db):
    """Background task to sync users to Mixpanel"""
    global _mixpanel_sync_status
    from services import mixpanel_service
    
    try:
        _mixpanel_sync_status["users_sync"]["status"] = "running"
        _mixpanel_sync_status["users_sync"]["started_at"] = datetime.now().isoformat()
        
        result = await mixpanel_service.sync_all_users_to_mixpanel(db)
        
        _mixpanel_sync_status["users_sync"]["status"] = "completed"
        _mixpanel_sync_status["users_sync"]["result"] = result
    except Exception as e:
        _mixpanel_sync_status["users_sync"]["status"] = "failed"
        _mixpanel_sync_status["users_sync"]["result"] = {"error": str(e)}


async def _run_events_sync(db, days_back: int):
    """Background task to sync historical events to Mixpanel"""
    global _mixpanel_sync_status
    from services import mixpanel_service
    
    try:
        _mixpanel_sync_status["events_sync"]["status"] = "running"
        _mixpanel_sync_status["events_sync"]["started_at"] = datetime.now().isoformat()
        
        result = await mixpanel_service.sync_historical_events(db, days_back)
        
        _mixpanel_sync_status["events_sync"]["status"] = "completed"
        _mixpanel_sync_status["events_sync"]["result"] = result
    except Exception as e:
        _mixpanel_sync_status["events_sync"]["status"] = "failed"
        _mixpanel_sync_status["events_sync"]["result"] = {"error": str(e)}


@router.post("/mixpanel/sync-users")


@router.get("/subscription-daywise")
async def get_subscription_daywise(request: Request, days: int = 30):
    """
    Get day-wise subscription purchase data for visualization
    Returns data for the last N days (default 30)
    """
    await verify_admin(request)
    db = get_db(request)
    
    from datetime import datetime, timedelta
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Subscription plan keys
    SUBSCRIPTION_PLAN_KEYS = ["basic_plan", "pro_plan", "pro_plus"]
    
    # Get all subscription orders in date range
    subscription_orders = await db.payment_orders.find({
        "status": {"$in": ["paid", "completed"]},
        "plan_key": {"$in": SUBSCRIPTION_PLAN_KEYS},
        "paid_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0, "paid_at": 1, "plan_key": 1, "created_at": 1}).to_list(10000)
    
    # Get subscription payments from payments collection
    subscription_payments = await db.payments.find({
        "status": "captured",
        "plan_key": {"$in": SUBSCRIPTION_PLAN_KEYS},
        "captured_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0, "captured_at": 1, "paid_at": 1, "plan_key": 1, "created_at": 1}).to_list(10000)
    
    # Group by date
    day_wise_data = {}
    
    # Process payment orders
    for order in subscription_orders:
        date_str = order.get("paid_at") or order.get("created_at")
        if date_str:
            # Extract just the date part (YYYY-MM-DD)
            date_only = date_str[:10] if isinstance(date_str, str) else date_str.strftime("%Y-%m-%d")
            if date_only not in day_wise_data:
                day_wise_data[date_only] = {"date": date_only, "count": 0, "by_plan": {}}
            day_wise_data[date_only]["count"] += 1
            
            # Count by plan
            plan_key = order.get("plan_key", "unknown")
            day_wise_data[date_only]["by_plan"][plan_key] = day_wise_data[date_only]["by_plan"].get(plan_key, 0) + 1
    
    # Process payments
    for payment in subscription_payments:
        date_str = payment.get("captured_at") or payment.get("paid_at") or payment.get("created_at")
        if date_str:
            date_only = date_str[:10] if isinstance(date_str, str) else date_str.strftime("%Y-%m-%d")
            if date_only not in day_wise_data:
                day_wise_data[date_only] = {"date": date_only, "count": 0, "by_plan": {}}
            day_wise_data[date_only]["count"] += 1
            
            plan_key = payment.get("plan_key", "unknown")
            day_wise_data[date_only]["by_plan"][plan_key] = day_wise_data[date_only]["by_plan"].get(plan_key, 0) + 1
    
    # Fill in missing dates with zero counts
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str not in day_wise_data:
            day_wise_data[date_str] = {"date": date_str, "count": 0, "by_plan": {}}
        current_date += timedelta(days=1)
    
    # Convert to sorted list
    day_wise_list = sorted(day_wise_data.values(), key=lambda x: x["date"])
    
    return {
        "success": True,
        "days": days,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "data": day_wise_list,
        "total_subscriptions": sum(d["count"] for d in day_wise_list)
    }


@router.get("/subscription-signups-daywise")
async def get_subscription_signups_daywise(request: Request, days: int = 30):
    """
    Get day-wise subscription sign-ups (user registrations with subscription plans)
    Returns data for the last N days (default 30)
    
    Sign-up = when a user account was created with a subscription plan assigned
    """
    await verify_admin(request)
    db = get_db(request)
    
    from datetime import datetime, timedelta
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Subscription plan keys
    SUBSCRIPTION_PLAN_KEYS = ["basic_plan", "pro_plan", "pro_plus"]
    
    # Get all users who signed up with subscription plans in the date range
    # A sign-up is when a user was created (created_at) with a subscription plan
    users_with_subscriptions = await db.users.find({
        "plan": {"$in": SUBSCRIPTION_PLAN_KEYS},
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0, "created_at": 1, "plan": 1}).to_list(10000)
    
    # Group by date
    day_wise_data = {}
    
    for user in users_with_subscriptions:
        date_str = user.get("created_at")
        if date_str:
            # Extract just the date part (YYYY-MM-DD)
            date_only = date_str[:10] if isinstance(date_str, str) else date_str.strftime("%Y-%m-%d")
            if date_only not in day_wise_data:
                day_wise_data[date_only] = {"date": date_only, "count": 0, "by_plan": {}}
            day_wise_data[date_only]["count"] += 1
            
            # Count by plan
            plan_key = user.get("plan", "unknown")
            day_wise_data[date_only]["by_plan"][plan_key] = day_wise_data[date_only]["by_plan"].get(plan_key, 0) + 1
    
    # Fill in missing dates with zero counts
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str not in day_wise_data:
            day_wise_data[date_str] = {"date": date_str, "count": 0, "by_plan": {}}
        current_date += timedelta(days=1)
    
    # Convert to sorted list
    day_wise_list = sorted(day_wise_data.values(), key=lambda x: x["date"])
    
    return {
        "success": True,
        "data": day_wise_list,
        "total_signups": sum(item["count"] for item in day_wise_list),
        "date_range": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d"),
            "days": days
        }
    }


@router.get("/mixpanel/sync-users")
async def sync_users_to_mixpanel(request: Request, background_tasks: BackgroundTasks):
    """
    Sync all user profiles to Mixpanel (runs in background)
    Check /api/admin/analytics/mixpanel/status for progress
    """
    await verify_admin(request)
    db = get_db(request)
    
    from services import mixpanel_service
    
    if not mixpanel_service.is_enabled():
        raise HTTPException(status_code=400, detail="Mixpanel is not configured")
    
    # Check if already running
    if _mixpanel_sync_status["users_sync"]["status"] == "running":
        return {
            "message": "Users sync already in progress",
            "started_at": _mixpanel_sync_status["users_sync"]["started_at"],
            "check_status_at": "/api/admin/analytics/mixpanel/status"
        }
    
    # Start background task
    background_tasks.add_task(_run_users_sync, db)
    
    return {
        "message": "Users sync started in background",
        "check_status_at": "/api/admin/analytics/mixpanel/status"
    }


@router.post("/mixpanel/sync-events")
@router.get("/mixpanel/sync-events")
async def sync_historical_events_to_mixpanel(
    request: Request,
    background_tasks: BackgroundTasks,
    days_back: int = 90
):
    """
    Sync historical events to Mixpanel (runs in background)
    Check /api/admin/analytics/mixpanel/status for progress
    
    Args:
        days_back: Number of days of history to sync (default 90)
    """
    await verify_admin(request)
    db = get_db(request)
    
    from services import mixpanel_service
    
    if not mixpanel_service.is_enabled():
        raise HTTPException(status_code=400, detail="Mixpanel is not configured")
    
    # Check if already running
    if _mixpanel_sync_status["events_sync"]["status"] == "running":
        return {
            "message": "Events sync already in progress",
            "started_at": _mixpanel_sync_status["events_sync"]["started_at"],
            "check_status_at": "/api/admin/analytics/mixpanel/status"
        }
    
    # Start background task
    background_tasks.add_task(_run_events_sync, db, days_back)
    
    return {
        "message": f"Historical events sync started in background (last {days_back} days)",
        "check_status_at": "/api/admin/analytics/mixpanel/status"
    }
