"""
Mentor Notifications System
Handles notifications to mentors - informational and response-required types
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/mentor-notifications", tags=["admin-mentor-notifications"])


# Pydantic Models
class FormField(BaseModel):
    name: str
    label: str
    type: str  # text, textarea, select, radio, checkbox, date, number
    options: Optional[List[str]] = None  # For select, radio, checkbox
    required: bool = False


class CreateNotificationRequest(BaseModel):
    type: str  # "informational" or "response_required"
    title: str
    message: str
    target_type: str  # "all", "specific", "criteria"
    target_mentor_ids: Optional[List[str]] = None  # For "specific" target
    target_criteria: Optional[Dict[str, Any]] = None  # For "criteria" target (e.g., {"is_active": true, "expertise": ["case_interview"]})
    send_email: bool = True
    form_fields: Optional[List[FormField]] = None  # For response_required type
    deadline: Optional[str] = None  # ISO date string for response deadline
    popup_enabled: bool = False  # If true, show as modal popup on dashboard land
    popup_max_views: int = 0  # Number of additional times to popup (max once per calendar day)


class NotificationResponseRequest(BaseModel):
    response_data: Dict[str, Any]


# Helper functions
def get_db(request: Request):
    return request.app.state.db


async def verify_admin(request: Request):
    """Verify admin access"""
    from routes.auth import get_current_user
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_target_mentors(db, target_type: str, target_mentor_ids: Optional[List[str]], target_criteria: Optional[Dict]) -> List[dict]:
    """Get list of mentors based on targeting criteria"""
    if target_type == "all":
        mentors = await db.mentors.find({"is_deleted": {"$ne": True}}, {"_id": 0}).to_list(1000)
    elif target_type == "specific" and target_mentor_ids:
        mentors = await db.mentors.find({"id": {"$in": target_mentor_ids}, "is_deleted": {"$ne": True}}, {"_id": 0}).to_list(1000)
    elif target_type == "criteria" and target_criteria:
        query = {"is_deleted": {"$ne": True}}
        
        # Build query from criteria
        if target_criteria.get("is_active") is not None:
            query["is_active"] = target_criteria["is_active"]
        if target_criteria.get("expertise"):
            query["expertise"] = {"$in": target_criteria["expertise"]}
        if target_criteria.get("session_types"):
            query["session_types"] = {"$in": target_criteria["session_types"]}
        if target_criteria.get("min_sessions"):
            query["total_sessions"] = {"$gte": target_criteria["min_sessions"]}
            
        mentors = await db.mentors.find(query, {"_id": 0}).to_list(1000)
    else:
        mentors = []
    
    return mentors


async def send_notification_email(mentor: dict, notification: dict):
    """Send email notification to mentor"""
    try:
        from services.email_service import send_email
        
        mentor_email = mentor.get("email")
        mentor_name = mentor.get("name", "").split()[0] if mentor.get("name") else "Mentor"
        
        if not mentor_email:
            logger.warning(f"No email for mentor {mentor.get('id')}")
            return False
        
        notification_type = notification.get("type")
        title = notification.get("title")
        message = notification.get("message")
        deadline = notification.get("deadline")
        
        # Build CTA text based on notification type
        if notification_type == "response_required":
            cta_text = "Go to Dashboard to Respond"
            deadline_text = f"<p style='color: #e53e3e; margin-top: 15px;'><strong>Response Deadline:</strong> {deadline}</p>" if deadline else ""
        else:
            cta_text = "Go to Dashboard"
            deadline_text = ""
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="padding: 20px;">
                <p style="margin-bottom: 20px;">Hi {mentor_name},</p>
                
                <p style="margin-bottom: 15px; font-size: 18px; font-weight: bold;">{title}</p>
                
                <div style="margin-bottom: 20px; white-space: pre-line;">{message}</div>
                
                {deadline_text}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.gradnext.co/mentor-dashboard?tab=notifications" 
                       style="background: #4F46E5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        {cta_text}
                    </a>
                </div>
                
                <p style="margin-bottom: 5px;">Best,</p>
                <p style="margin-top: 0;"><strong>Team gradnext</strong></p>
            </div>
        </body>
        </html>
        """
        
        subject = f"New Notification | {title}"
        await send_email(mentor_email, subject, html_content, sender_name="Team gradnext", from_email="hi@notifications.gradnext.co")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send notification email to {mentor.get('email')}: {e}")
        return False


# Admin Endpoints

@router.post("")
async def create_notification(data: CreateNotificationRequest, request: Request):
    """Create and send a notification to mentors"""
    admin = await verify_admin(request)
    db = get_db(request)
    
    # Validate notification type
    if data.type not in ["informational", "response_required"]:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    
    # Validate form fields for response_required
    if data.type == "response_required" and not data.form_fields:
        raise HTTPException(status_code=400, detail="Form fields required for response_required notifications")
    
    # Get target mentors
    mentors = await get_target_mentors(db, data.target_type, data.target_mentor_ids, data.target_criteria)
    
    if not mentors:
        raise HTTPException(status_code=400, detail="No mentors match the target criteria")
    
    # Create notification document
    notification_id = f"notif_{uuid.uuid4().hex[:12]}"
    notification = {
        "id": notification_id,
        "type": data.type,
        "title": data.title,
        "message": data.message,
        "target_type": data.target_type,
        "target_mentor_ids": [m.get("id") for m in mentors],
        "target_criteria": data.target_criteria,
        "send_email": data.send_email,
        "form_fields": [f.dict() for f in data.form_fields] if data.form_fields else None,
        "deadline": data.deadline,
        "popup_enabled": bool(data.popup_enabled),
        "popup_max_views": max(0, int(data.popup_max_views or 0)),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("id"),
        "created_by_name": admin.get("name"),
        "total_recipients": len(mentors),
        "total_read": 0,
        "total_responded": 0
    }
    
    await db.mentor_notifications.insert_one(notification)
    
    # Send emails if enabled
    emails_sent = 0
    if data.send_email:
        for mentor in mentors:
            if await send_notification_email(mentor, notification):
                emails_sent += 1
    
    logger.info(f"Created notification {notification_id} for {len(mentors)} mentors, sent {emails_sent} emails")
    
    return {
        "message": "Notification created and sent successfully",
        "notification_id": notification_id,
        "total_recipients": len(mentors),
        "emails_sent": emails_sent
    }


@router.get("")
async def list_notifications(request: Request, page: int = 1, limit: int = 20):
    """List all notifications (admin view)"""
    await verify_admin(request)
    db = get_db(request)
    
    skip = (page - 1) * limit
    
    notifications = await db.mentor_notifications.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.mentor_notifications.count_documents({})
    
    return {
        "notifications": notifications,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@router.get("/{notification_id}")
async def get_notification(notification_id: str, request: Request):
    """Get a specific notification with response stats"""
    await verify_admin(request)
    db = get_db(request)
    
    notification = await db.mentor_notifications.find_one({"id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Get response stats
    responses = await db.mentor_notification_responses.find(
        {"notification_id": notification_id}, {"_id": 0}
    ).to_list(1000)
    
    read_count = len([r for r in responses if r.get("status") in ["read", "responded"]])
    responded_count = len([r for r in responses if r.get("status") == "responded"])
    
    notification["stats"] = {
        "total_recipients": notification.get("total_recipients", 0),
        "read_count": read_count,
        "responded_count": responded_count,
        "pending_count": notification.get("total_recipients", 0) - read_count
    }
    
    return notification


@router.get("/{notification_id}/responses")
async def get_notification_responses(notification_id: str, request: Request):
    """Get all responses for a notification"""
    await verify_admin(request)
    db = get_db(request)
    
    notification = await db.mentor_notifications.find_one({"id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    responses = await db.mentor_notification_responses.find(
        {"notification_id": notification_id}, {"_id": 0}
    ).sort("responded_at", -1).to_list(1000)
    
    # Get mentor details for those who haven't responded yet
    responded_mentor_ids = [r.get("mentor_id") for r in responses]
    target_mentor_ids = notification.get("target_mentor_ids", [])
    pending_mentor_ids = [mid for mid in target_mentor_ids if mid not in responded_mentor_ids]
    
    pending_mentors = []
    if pending_mentor_ids:
        pending_mentors = await db.mentors.find(
            {"id": {"$in": pending_mentor_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(1000)
    
    return {
        "notification": notification,
        "responses": responses,
        "pending_mentors": pending_mentors
    }


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.mentor_notifications.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Also delete responses
    await db.mentor_notification_responses.delete_many({"notification_id": notification_id})
    
    return {"message": "Notification deleted successfully"}


# Mentor-facing endpoints (to be added to mentor_dashboard.py)
# These are placeholder comments - actual implementation will be in mentor_dashboard.py
