"""
Database cleanup route - SAFE endpoint to fix mentor ratings
Separated from main admin routes to avoid breaking production
"""
from fastapi import APIRouter, HTTPException, Request
from routes.auth import get_current_user, get_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/cleanup", tags=["admin-cleanup"])


async def verify_admin(request: Request):
    """Verify user is admin"""
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/mentor-ratings")
async def cleanup_mentor_ratings(request: Request):
    """
    Remove ratings from mentors without actual feedback
    Safe to run multiple times
    """
    await verify_admin(request)
    db = get_db(request)
    
    logger.info("Starting mentor ratings cleanup")
    
    # Step 1: Remove ratings from mentors with 0 sessions
    result1 = await db.mentors.update_many(
        {
            "$or": [
                {"sessions_conducted": 0},
                {"sessions_conducted": {"$exists": False}}
            ],
            "rating": {"$exists": True}
        },
        {"$unset": {"rating": ""}}
    )
    
    # Step 2: For mentors with sessions, verify they have actual feedback
    mentors_with_rating = await db.mentors.find(
        {"rating": {"$exists": True}},
        {"_id": 0, "id": 1, "email": 1}
    ).to_list(None)
    
    no_feedback_count = 0
    for mentor in mentors_with_rating:
        # Check if mentor has any completed bookings with feedback
        has_feedback = await db.bookings.count_documents({
            "mentor_id": mentor.get("id"),
            "status": "completed",
            "candidate_feedback": {"$exists": True}
        })
        
        if has_feedback == 0:
            await db.mentors.update_one(
                {"id": mentor.get("id")},
                {"$unset": {"rating": ""}}
            )
            no_feedback_count += 1
    
    # Verify cleanup
    remaining = await db.mentors.count_documents({
        "sessions_conducted": 0,
        "rating": {"$exists": True}
    })
    
    logger.info(f"Cleanup complete: {result1.modified_count + no_feedback_count} mentors fixed")
    
    return {
        "success": True,
        "message": "Mentor ratings cleaned successfully",
        "details": {
            "removed_from_zero_sessions": result1.modified_count,
            "removed_from_no_feedback": no_feedback_count,
            "total_cleaned": result1.modified_count + no_feedback_count,
            "remaining_bad": remaining
        }
    }
