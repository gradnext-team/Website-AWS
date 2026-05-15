"""
Contact Form Routes
Handles contact form submissions from the website
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from services import meta_pixel_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contact", tags=["contact"])
admin_router = APIRouter(prefix="/api/admin/forms", tags=["admin-forms"])

# Database will be set by server.py
db = None

def set_database(database):
    global db
    db = database


# ============= Models =============

class ContactFormSubmission(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    college: Optional[str] = None
    query: str


# ============= Public Routes =============

@router.post("/submit")
async def submit_contact_form(request: Request, submission: ContactFormSubmission):
    """Submit a contact form"""
    try:
        form_id = str(uuid.uuid4())
        form_data = {
            "id": form_id,
            "form_type": "contact",
            "name": submission.name,
            "email": submission.email,
            "phone": submission.phone,
            "college": submission.college,
            "query": submission.query,
            "status": "new",  # new, read, responded
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.form_submissions.insert_one(form_data)
        
        logger.info(f"Contact form submitted: {form_id} from {submission.email}")
        
        # Track Lead event with Meta Conversion API
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            await meta_pixel_service.track_lead(
                user_email=submission.email,
                content_name='contact_form',
                content_category='contact',
                user_name=submission.name,
                user_phone=submission.phone,
                client_ip=client_ip,
                client_user_agent=client_user_agent,
                fbp=meta_cookies.get('fbp'),
                fbc=meta_cookies.get('fbc'),
            )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        return {
            "success": True,
            "message": "Your query has been submitted. We'll get back to you soon!",
            "submission_id": form_id
        }
    except Exception as e:
        logger.error(f"Error submitting contact form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= Admin Routes =============

async def verify_admin(request: Request):
    """Verify admin access"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@admin_router.get("/submissions")
async def get_form_submissions(request: Request, form_type: Optional[str] = None, status: Optional[str] = None):
    """Get all form submissions with optional filters"""
    await verify_admin(request)
    
    try:
        query = {}
        if form_type:
            query["form_type"] = form_type
        if status:
            query["status"] = status
        
        submissions = await db.form_submissions.find(query).sort("created_at", -1).to_list(500)
        
        for s in submissions:
            s["_id"] = str(s["_id"])
        
        # Get counts by form type
        contact_count = await db.form_submissions.count_documents({"form_type": "contact"})
        new_count = await db.form_submissions.count_documents({"status": "new"})
        
        return {
            "submissions": submissions,
            "counts": {
                "total": len(submissions),
                "contact": contact_count,
                "new": new_count
            }
        }
    except Exception as e:
        logger.error(f"Error getting form submissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.put("/submissions/{submission_id}/status")
async def update_submission_status(request: Request, submission_id: str, status: str):
    """Update a form submission status"""
    await verify_admin(request)
    
    try:
        if status not in ["new", "read", "responded"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.form_submissions.update_one(
            {"id": submission_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        return {"success": True, "message": "Status updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating submission status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.delete("/submissions/{submission_id}")
async def delete_submission(request: Request, submission_id: str):
    """Delete a form submission"""
    await verify_admin(request)
    
    try:
        result = await db.form_submissions.delete_one({"id": submission_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        return {"success": True, "message": "Submission deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting submission: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_router.get("/counts")
async def get_forms_counts(request: Request):
    """Get counts for all form types for navigation badges"""
    await verify_admin(request)
    
    try:
        # Contact form - count new/unresponded
        contact_new = await db.form_submissions.count_documents({
            "form_type": "contact",
            "status": "new"
        })
        contact_total = await db.form_submissions.count_documents({"form_type": "contact"})
        
        # Support queries - count open
        support_open = await db.support_queries.count_documents({"status": "open"})
        support_total = await db.support_queries.count_documents({})
        
        # Feedback - no unresponded concept, just total
        feedback_total = await db.user_feedback.count_documents({})
        
        # Coach applications - count new
        coach_new = await db.coach_applications.count_documents({"status": "new"})
        coach_total = await db.coach_applications.count_documents({})
        
        return {
            "contact": {
                "new": contact_new,
                "total": contact_total
            },
            "support": {
                "open": support_open,
                "total": support_total
            },
            "feedback": {
                "total": feedback_total
            },
            "coach_applications": {
                "new": coach_new,
                "total": coach_total
            },
            "total_unresponded": contact_new + support_open + coach_new
        }
    except Exception as e:
        logger.error(f"Error getting forms counts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
