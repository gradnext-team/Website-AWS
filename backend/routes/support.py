"""
Support and Feedback Routes
Handles user queries and feedback submissions
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import logging
import base64
import uuid

from routes.auth import get_current_user, get_db
from routes.admin import verify_admin as admin_verify_admin

router = APIRouter(prefix="/support", tags=["support"])
logger = logging.getLogger(__name__)

# Maximum file size (5MB)
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}


class SupportQuery(BaseModel):
    query: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    attachment_url: Optional[str] = None  # Base64 encoded image or URL


class FeedbackSubmission(BaseModel):
    feedback: str
    rating: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None


@router.post("/query")
async def submit_support_query(data: SupportQuery, request: Request):
    """
    Submit a support query from the user
    """
    try:
        # Get current user for authentication
        user = await get_current_user(request)
        db = get_db(request)
        
        # Determine user type
        user_type = "candidate"  # default
        if user.get("is_mentor"):
            user_type = "mentor"
        elif user.get("is_admin"):
            user_type = "admin"
        
        # Create support query document
        query_doc = {
            "id": f"query_{datetime.now(timezone.utc).timestamp()}_{user.get('id', 'unknown')}",
            "user_id": user.get("id"),
            "user_email": user.get("email") or data.user_email,
            "user_name": user.get("name") or data.user_name,
            "user_type": user_type,
            "query": data.query,
            "attachment_url": data.attachment_url,  # Store attachment URL/base64
            "status": "open",
            "last_reply_by": "user",  # Track who replied last
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "type": "support_query"
        }
        
        # Store in database
        await db.support_queries.insert_one(query_doc)
        
        logger.info(f"Support query submitted by {user_type} {user.get('id')}")
        
        return {
            "success": True,
            "message": "Your query has been submitted successfully. We'll get back to you soon."
        }
    
    except Exception as e:
        logger.error(f"Failed to submit support query: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit support query")


@router.post("/upload-attachment")
async def upload_support_attachment(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Upload an attachment for support query (image only)
    Returns a base64 encoded string that can be stored with the query
    """
    try:
        # Get current user for authentication
        user = await get_current_user(request)
        
        # Check file extension
        filename = file.filename.lower()
        ext = '.' + filename.split('.')[-1] if '.' in filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds 5MB limit"
            )
        
        # Convert to base64 with data URL format
        content_type = file.content_type or f"image/{ext[1:]}"
        base64_data = base64.b64encode(content).decode('utf-8')
        data_url = f"data:{content_type};base64,{base64_data}"
        
        logger.info(f"Support attachment uploaded by user {user.get('id')}")
        
        return {
            "success": True,
            "attachment_url": data_url,
            "filename": file.filename,
            "size": len(content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload support attachment: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload attachment")


@router.post("/feedback")
async def submit_feedback(data: FeedbackSubmission, request: Request):
    """
    Submit user feedback
    """
    try:
        # Get current user for authentication
        user = await get_current_user(request)
        db = get_db(request)
        
        # Determine user type
        user_type = "candidate"  # default
        if user.get("is_mentor"):
            user_type = "mentor"
        elif user.get("is_admin"):
            user_type = "admin"
        
        # Create feedback document
        feedback_doc = {
            "id": f"feedback_{datetime.now(timezone.utc).timestamp()}_{user.get('id', 'unknown')}",
            "user_id": user.get("id"),
            "user_email": user.get("email") or data.user_email,
            "user_name": user.get("name") or data.user_name,
            "user_type": user_type,
            "feedback": data.feedback,
            "rating": data.rating,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "type": "user_feedback"
        }
        
        # Store in database
        await db.user_feedback.insert_one(feedback_doc)
        
        logger.info(f"Feedback submitted by {user_type} {user.get('id')}")
        
        return {
            "success": True,
            "message": "Thank you for your feedback! We appreciate your input."
        }
    
    except Exception as e:
        logger.error(f"Failed to submit feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


# ============ Admin Feedback Management ============

@router.get("/admin/feedback")
async def get_all_feedback(
    request: Request,
    rating: Optional[int] = None,
    user_type: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """
    Get all user feedback for admin view
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    # Build query filter
    query_filter = {}
    if rating:
        query_filter["rating"] = rating
    if user_type:
        query_filter["user_type"] = user_type
    
    # Get feedback (exclude MongoDB _id field)
    feedbacks = await db.user_feedback.find(query_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total_count = await db.user_feedback.count_documents(query_filter)
    
    # Get counts by rating
    rating_counts = {}
    for r in range(1, 6):
        rating_counts[str(r)] = await db.user_feedback.count_documents({"rating": r})
    
    # Get counts by user type
    candidate_count = await db.user_feedback.count_documents({"user_type": "candidate"})
    mentor_count = await db.user_feedback.count_documents({"user_type": "mentor"})
    
    # Calculate average rating
    pipeline = [
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
    ]
    avg_result = await db.user_feedback.aggregate(pipeline).to_list(1)
    avg_rating = round(avg_result[0]["avg_rating"], 1) if avg_result and avg_result[0].get("avg_rating") else 0
    
    return {
        "feedbacks": feedbacks,
        "total": total_count,
        "average_rating": avg_rating,
        "counts": {
            "by_rating": rating_counts,
            "candidate": candidate_count,
            "mentor": mentor_count
        }
    }


@router.get("/admin/feedback/count")
async def get_feedback_count(request: Request):
    """
    Get count of feedback for sidebar badge
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    total_count = await db.user_feedback.count_documents({})
    
    # Count feedback from last 7 days
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_count = await db.user_feedback.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "total": total_count,
        "recent": recent_count
    }


@router.get("/admin/feedback/{feedback_id}")
async def get_feedback_details(feedback_id: str, request: Request):
    """
    Get detailed information about a specific feedback
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    # Get feedback (exclude _id)
    feedback = await db.user_feedback.find_one({"id": feedback_id}, {"_id": 0})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Get user details (exclude _id)
    user = await db.users.find_one({"id": feedback.get("user_id")}, {"_id": 0})
    
    return {
        "feedback": feedback,
        "user": {
            "id": user.get("id") if user else None,
            "name": user.get("name") if user else feedback.get("user_name"),
            "email": user.get("email") if user else feedback.get("user_email"),
            "plan": user.get("plan") if user else None,
            "created_at": user.get("created_at") if user else None
        } if user else {
            "name": feedback.get("user_name"),
            "email": feedback.get("user_email")
        }
    }


@router.delete("/admin/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str, request: Request):
    """
    Delete a feedback entry
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    result = await db.user_feedback.delete_one({"id": feedback_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {
        "success": True,
        "message": "Feedback deleted successfully"
    }




# ============ Admin Support Management ============

class AdminReply(BaseModel):
    reply: str


# Use the admin verification from admin.py routes
# (imported as admin_verify_admin)


@router.get("/admin/queries")
async def get_all_support_queries(
    request: Request,
    status: Optional[str] = None,
    user_type: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """
    Get all support queries for admin view
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    # Build query filter
    query_filter = {}
    if status:
        query_filter["status"] = status
    if user_type:
        query_filter["user_type"] = user_type
    
    # Get queries (exclude MongoDB _id field)
    queries = await db.support_queries.find(query_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total_count = await db.support_queries.count_documents(query_filter)
    
    # Get counts by status
    open_count = await db.support_queries.count_documents({"status": "open"})
    in_progress_count = await db.support_queries.count_documents({"status": "in_progress"})
    resolved_count = await db.support_queries.count_documents({"status": "resolved"})
    
    # Get in-progress breakdown by who replied last
    in_progress_admin_side = await db.support_queries.count_documents({
        "status": "in_progress",
        "last_reply_by": "admin"
    })
    in_progress_user_side = await db.support_queries.count_documents({
        "status": "in_progress",
        "last_reply_by": "user"
    })
    
    # Get counts by user type
    candidate_count = await db.support_queries.count_documents({"user_type": "candidate"})
    mentor_count = await db.support_queries.count_documents({"user_type": "mentor"})
    
    return {
        "queries": queries,
        "total": total_count,
        "counts": {
            "open": open_count,
            "in_progress": in_progress_count,
            "in_progress_admin_side": in_progress_admin_side,
            "in_progress_user_side": in_progress_user_side,
            "resolved": resolved_count,
            "candidate": candidate_count,
            "mentor": mentor_count
        }
    }


@router.get("/admin/queries/count")
async def get_support_queries_count(request: Request):
    """
    Get count of open and in-progress queries for sidebar badge
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    open_count = await db.support_queries.count_documents({"status": "open"})
    in_progress_count = await db.support_queries.count_documents({"status": "in_progress"})
    
    return {
        "open": open_count,
        "in_progress": in_progress_count,
        "total": open_count + in_progress_count
    }


@router.get("/admin/queries/{query_id}")
async def get_support_query_details(query_id: str, request: Request):
    """
    Get detailed information about a specific support query
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    # Get query (exclude _id)
    query = await db.support_queries.find_one({"id": query_id}, {"_id": 0})
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    # Get user details (exclude _id)
    user = await db.users.find_one({"id": query.get("user_id")}, {"_id": 0})
    
    # Get reply history (exclude _id)
    replies = await db.support_replies.find({"query_id": query_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    return {
        "query": query,
        "user": {
            "id": user.get("id") if user else None,
            "name": user.get("name") if user else query.get("user_name"),
            "email": user.get("email") if user else query.get("user_email"),
            "plan": user.get("plan") if user else None,
            "created_at": user.get("created_at") if user else None
        } if user else {
            "name": query.get("user_name"),
            "email": query.get("user_email")
        },
        "replies": replies
    }


@router.post("/admin/queries/{query_id}/reply")
async def reply_to_support_query(query_id: str, data: AdminReply, request: Request):
    """
    Reply to a support query and send email notification to the user
    """
    await admin_verify_admin(request)
    admin = await get_current_user(request)
    db = get_db(request)
    
    # Get query
    query = await db.support_queries.find_one({"id": query_id})
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    # Create reply document
    reply_doc = {
        "id": f"reply_{datetime.now(timezone.utc).timestamp()}",
        "query_id": query_id,
        "admin_id": admin.get("id"),
        "admin_name": admin.get("name", "Support Team"),
        "reply": data.reply,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store reply
    await db.support_replies.insert_one(reply_doc)
    
    # Remove _id before returning (MongoDB adds it automatically)
    reply_doc_clean = {k: v for k, v in reply_doc.items() if k != '_id'}
    
    # Update query status to in_progress (not resolved automatically)
    await db.support_queries.update_one(
        {"id": query_id},
        {
            "$set": {
                "status": "in_progress",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_reply_by": "admin",
                "last_reply_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Send email to user
    try:
        from services.email_service import send_support_reply_email
        
        user_email = query.get("user_email")
        user_name = query.get("user_name", "User")
        original_query = query.get("query")
        
        # Send email
        await send_support_reply_email(
            to_email=user_email,
            user_name=user_name,
            original_query=original_query,
            reply_message=data.reply,
            admin_name=admin.get("name", "Support Team")
        )
        
        logger.info(f"Support reply email sent to {user_email}")
    except Exception as e:
        logger.error(f"Failed to send support reply email: {e}")
        # Don't fail the request if email fails
    
    return {
        "success": True,
        "message": "Reply sent successfully",
        "reply": reply_doc_clean
    }


@router.patch("/admin/queries/{query_id}/status")
async def update_query_status(query_id: str, status: str, request: Request):
    """
    Update the status of a support query
    """
    await admin_verify_admin(request)
    db = get_db(request)
    
    if status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Update status
    result = await db.support_queries.update_one(
        {"id": query_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Query not found")
    
    return {
        "success": True,
        "message": "Status updated successfully"
    }
