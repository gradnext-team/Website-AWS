"""
Lead Scoring & Activity Tracking
Tracks user activity and calculates lead scores for free trial users.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from routes.auth import get_current_user

router = APIRouter(tags=["tracking"])


class TrackEventRequest(BaseModel):
    event: str  # e.g., "pricing_modal_opened", "book_now_clicked", "coaching_page_viewed"
    metadata: Optional[dict] = None


@router.post("/tracking/event")
async def track_event(body: TrackEventRequest, request: Request):
    """Track a user activity event for lead scoring"""
    try:
        user = await get_current_user(request)
    except Exception:
        return {"ok": True}  # Silently skip if not authenticated

    db = request.app.state.db
    await db.user_activity.insert_one({
        "user_id": user.get("id"),
        "event": body.event,
        "metadata": body.metadata,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True}


@router.post("/tracking/login")
async def track_login(request: Request):
    """Track a user login/return visit (called once per session)"""
    try:
        user = await get_current_user(request)
    except Exception:
        return {"ok": True}

    db = request.app.state.db
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Only log one login per day per user
    existing = await db.user_activity.find_one({
        "user_id": user.get("id"),
        "event": "daily_login",
        "date": today
    })
    if not existing:
        await db.user_activity.insert_one({
            "user_id": user.get("id"),
            "event": "daily_login",
            "date": today,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"ok": True}


@router.get("/tracking/visit-count")
async def get_visit_count(request: Request):
    """Return the number of unique daily_login days for the current user"""
    try:
        user = await get_current_user(request)
    except Exception:
        return {"count": 0}

    db = request.app.state.db
    count = await db.user_activity.count_documents({
        "user_id": user.get("id"),
        "event": "daily_login"
    })
    return {"count": count}


# ─── Admin Lead Scores ────────────────────────────────────────────

admin_router = APIRouter(prefix="/admin/lead-scores", tags=["lead-scores"])


async def verify_admin(request: Request):
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@admin_router.get("")
async def get_lead_scores(request: Request):
    """Calculate and return lead scores for all free trial users"""
    await verify_admin(request)
    db = request.app.state.db

    # Get all free trial users
    trial_users = await db.users.find(
        {"plan": {"$in": ["free_trial", "Free Trial"]}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1, "created_at": 1,
         "phone_number": 1, "onboarding_completed": 1}
    ).to_list(5000)
    if not trial_users:
        return {"leads": [], "stats": {"total": 0, "hot": 0, "warm": 0, "cold": 0}}

    user_ids = [u.get("id") for u in trial_users if u.get("id")]

    # Batch fetch all needed data
    # 1. Drill completions (stored in drill_completions collection)
    drill_completions = await db.drill_completions.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "drill_id": 1}
    ).to_list(5000)
    drills_by_user = {}
    for d in drill_completions:
        uid = d.get("user_id")
        did = d.get("drill_id")
        if uid not in drills_by_user:
            drills_by_user[uid] = set()
        if did:
            drills_by_user[uid].add(did)

    # 2. Video progress (stored in progress collection as videos_completed array)
    progress_docs = await db.progress.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "videos_completed": 1}
    ).to_list(5000)
    videos_by_user = {}
    for p in progress_docs:
        uid = p.get("user_id")
        vids = p.get("videos_completed", [])
        if uid and vids:
            videos_by_user[uid] = set(vids)

    # 3. Peer profiles (only count if listed/visible)
    peer_profiles = await db.peer_profiles.find(
        {"user_id": {"$in": user_ids}, "is_listed": True},
        {"_id": 0, "user_id": 1}
    ).to_list(5000)
    users_with_peer_profile = {p.get("user_id") for p in peer_profiles}

    # 4. Peer sessions
    peer_sessions = await db.peer_sessions.find(
        {"$or": [
            {"requester_id": {"$in": user_ids}},
            {"partner_id": {"$in": user_ids}}
        ], "status": {"$in": ["confirmed", "completed"]}},
        {"_id": 0, "requester_id": 1, "partner_id": 1}
    ).to_list(5000)
    peer_sessions_by_user = {}
    for s in peer_sessions:
        for uid in [s.get("requester_id"), s.get("partner_id")]:
            if uid in user_ids:
                peer_sessions_by_user[uid] = peer_sessions_by_user.get(uid, 0) + 1

    # 5. Activity events (daily logins + tracked events)
    activities = await db.user_activity.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "event": 1}
    ).to_list(10000)
    activity_by_user = {}
    for a in activities:
        uid = a.get("user_id")
        event = a.get("event")
        if uid not in activity_by_user:
            activity_by_user[uid] = {"daily_login": 0, "pricing_modal_opened": 0, "book_now_clicked": 0, "coaching_page_viewed": 0}
        if event in activity_by_user[uid]:
            activity_by_user[uid][event] += 1

    # Calculate scores
    leads = []
    stats = {"total": 0, "hot": 0, "warm": 0, "cold": 0}

    for user in trial_users:
        uid = user.get("id")
        if not uid:
            continue

        score = 0
        breakdown = {}

        # Peer profile listed (+10) — only if actively listed/visible
        if uid in users_with_peer_profile:
            score += 10
            breakdown["peer_profile_listed"] = 10
        unique_drills = len(drills_by_user.get(uid, set()))
        if unique_drills > 0:
            pts = unique_drills * 5
            score += pts
            breakdown["drills_completed"] = {"count": unique_drills, "points": pts}

        # Videos watched (+5 each)
        unique_videos = len(videos_by_user.get(uid, set()))
        if unique_videos > 0:
            pts = unique_videos * 5
            score += pts
            breakdown["videos_watched"] = {"count": unique_videos, "points": pts}

        # Peer sessions (+15 each)
        peer_count = peer_sessions_by_user.get(uid, 0)
        if peer_count > 0:
            pts = peer_count * 15
            score += pts
            breakdown["peer_sessions"] = {"count": peer_count, "points": pts}

        # Activity events
        user_activity = activity_by_user.get(uid, {})

        # Daily returns (+10 each)
        login_days = user_activity.get("daily_login", 0)
        if login_days > 0:
            pts = login_days * 10
            score += pts
            breakdown["days_returned"] = {"count": login_days, "points": pts}

        # Coaching page viewed (+5 each)
        coaching_views = user_activity.get("coaching_page_viewed", 0)
        if coaching_views > 0:
            pts = coaching_views * 5
            score += pts
            breakdown["coaching_page_viewed"] = {"count": coaching_views, "points": pts}

        # Book Now clicked (+5 each)
        book_clicks = user_activity.get("book_now_clicked", 0)
        if book_clicks > 0:
            pts = book_clicks * 5
            score += pts
            breakdown["book_now_clicked"] = {"count": book_clicks, "points": pts}

        # Pricing modal opened (+5 each)
        pricing_opens = user_activity.get("pricing_modal_opened", 0)
        if pricing_opens > 0:
            pts = pricing_opens * 5
            score += pts
            breakdown["pricing_modal_opened"] = {"count": pricing_opens, "points": pts}

        # Categorize
        if score >= 70:
            category = "hot"
        elif score >= 30:
            category = "warm"
        else:
            category = "cold"

        stats["total"] += 1
        stats[category] += 1

        # Calculate trial days remaining
        days_left = None
        if user.get("created_at"):
            try:
                created = user["created_at"]
                if isinstance(created, str):
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                trial_end = created + timedelta(days=7)
                days_left = max(0, (trial_end - datetime.now(timezone.utc)).days)
            except Exception:
                pass

        leads.append({
            "user_id": uid,
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "picture": user.get("picture"),
            "phone": user.get("phone_number"),
            "score": score,
            "category": category,
            "breakdown": breakdown,
            "days_left": days_left,
            "created_at": user.get("created_at")
        })

    # Sort by score descending
    leads.sort(key=lambda x: x["score"], reverse=True)

    return {"leads": leads, "stats": stats}
