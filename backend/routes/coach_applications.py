"""
Coach Applications Routes
Handles coach/mentor application submissions and admin management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach-applications", tags=["coach-applications"])
admin_router = APIRouter(prefix="/api/admin/coach-applications", tags=["admin-coach-applications"])

# Get database from request state
def get_db(request: Request):
    return request.app.state.db

# Admin verification
async def verify_admin(request: Request):
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class CoachApplicationSubmit(BaseModel):
    name: str
    consulting_company: str
    last_position: str
    years_in_consulting: str
    why_mentor: str
    mentoring_experience: Optional[str] = ""
    linkedin_profile: str


# Public endpoint to submit coach application
@router.post("/submit")
async def submit_coach_application(request: Request, data: CoachApplicationSubmit):
    """Submit a new coach/mentor application"""
    db = get_db(request)
    
    try:
        application = {
            "id": str(uuid.uuid4()),
            "name": data.name,
            "consulting_company": data.consulting_company,
            "last_position": data.last_position,
            "years_in_consulting": data.years_in_consulting,
            "why_mentor": data.why_mentor,
            "mentoring_experience": data.mentoring_experience or "",
            "linkedin_profile": data.linkedin_profile,
            "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.coach_applications.insert_one(application)
        
        logger.info(f"New coach application submitted: {data.name}")
        
        return {
            "success": True,
            "message": "Your application has been submitted. We'll review it and get back to you soon.",
            "application_id": application["id"]
        }
    except Exception as e:
        logger.error(f"Error submitting coach application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints
@admin_router.get("")
async def get_coach_applications(request: Request, status: Optional[str] = None):
    """Get all coach applications (admin only)"""
    await verify_admin(request)
    db = get_db(request)
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        applications = await db.coach_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=1000)
        
        # Get counts
        total = await db.coach_applications.count_documents({})
        new_count = await db.coach_applications.count_documents({"status": "new"})
        
        return {
            "applications": applications,
            "counts": {
                "total": total,
                "new": new_count
            }
        }
    except Exception as e:
        logger.error(f"Error fetching coach applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/counts")
async def get_coach_applications_counts(request: Request):
    """Get counts for coach applications"""
    await verify_admin(request)
    db = get_db(request)
    
    try:
        total = await db.coach_applications.count_documents({})
        new_count = await db.coach_applications.count_documents({"status": "new"})
        
        return {
            "total": total,
            "new": new_count
        }
    except Exception as e:
        logger.error(f"Error getting coach applications counts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.put("/{application_id}/status")
async def update_application_status(request: Request, application_id: str, status: str):
    """Update coach application status"""
    await verify_admin(request)
    db = get_db(request)
    
    valid_statuses = ["new", "reviewed", "approved", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    try:
        result = await db.coach_applications.update_one(
            {"id": application_id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": f"Status updated to {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating application status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.delete("/{application_id}")
async def delete_application(request: Request, application_id: str):
    """Delete a coach application"""
    await verify_admin(request)
    db = get_db(request)
    
    try:
        result = await db.coach_applications.delete_one({"id": application_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": "Application deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting application: {e}")
        raise HTTPException(status_code=500, detail=str(e))
