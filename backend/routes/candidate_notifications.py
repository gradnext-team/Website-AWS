"""
Candidate Notifications System
Handles notifications to candidates - informational and response-required types
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/candidate-notifications", tags=["admin-candidate-notifications"])


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
    target_categories: List[str] = []  # Categories: "all", "coaching", "subscription", "free_trial"
    target_candidate_ids: Optional[List[str]] = None  # For specific candidate selection
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


async def get_target_candidates(db, target_categories: List[str], target_candidate_ids: Optional[List[str]]) -> List[dict]:
    """Get list of candidates based on target categories"""
    all_candidate_ids = set()
    
    # Process each category
    for category in target_categories:
        if category == 'all':
            # Get all users
            candidates = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
            all_candidate_ids.update([c['id'] for c in candidates])
            
        elif category == 'coaching':
            # Users who have booked coaching sessions
            bookings = await db.bookings.find(
                {"status": {"$in": ["confirmed", "completed"]}},
                {"_id": 0, "user_id": 1}
            ).to_list(10000)
            all_candidate_ids.update([b['user_id'] for b in bookings if b.get('user_id')])
            
        elif category == 'subscription':
            # Users with active paid subscriptions
            candidates = await db.users.find(
                {
                    "$or": [
                        {"is_subscribed": True},
                        {"plan": {"$in": ["pro", "premium", "elite"]}}
                    ]
                },
                {"_id": 0, "id": 1}
            ).to_list(10000)
            all_candidate_ids.update([c['id'] for c in candidates])
            
        elif category == 'free_trial':
            # Users on free trial
            candidates = await db.users.find(
                {
                    "$or": [
                        {"plan": "free_trial"},
                        {"plan": "free"},
                        {"is_subscribed": False}
                    ]
                },
                {"_id": 0, "id": 1}
            ).to_list(10000)
            all_candidate_ids.update([c['id'] for c in candidates])
    
    # Add specific candidate IDs if provided
    if target_candidate_ids:
        all_candidate_ids.update(target_candidate_ids)
    
    # Fetch full candidate details
    if all_candidate_ids:
        candidates = await db.users.find(
            {"id": {"$in": list(all_candidate_ids)}},
            {"_id": 0}
        ).to_list(10000)
        return candidates
    
    return []


async def send_notification_email(candidate: dict, notification: dict):
    """Send email notification to candidate"""
    try:
        from services.email_service import send_email
        
        candidate_email = candidate.get("email")
        candidate_name = candidate.get("name", "").split()[0] if candidate.get("name") else "User"
        
        if not candidate_email:
            logger.warning(f"No email for candidate {candidate.get('id')}")
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
                <p style="margin-bottom: 20px;">Hi {candidate_name},</p>
                
                <p style="margin-bottom: 15px; font-size: 18px; font-weight: bold;">{title}</p>
                
                <div style="margin-bottom: 20px; white-space: pre-line;">{message}</div>
                
                {deadline_text}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.gradnext.co/dashboard?tab=notifications" 
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
        await send_email(candidate_email, subject, html_content, sender_name="Team gradnext", from_email="hi@notifications.gradnext.co")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send notification email to {candidate.get('email')}: {e}")
        return False


# Admin Endpoints

@router.post("")
async def create_notification(data: CreateNotificationRequest, request: Request):
    """Create and send a notification to candidates"""
    admin = await verify_admin(request)
    db = get_db(request)
    
    # Validate notification type
    if data.type not in ["informational", "response_required"]:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    
    # Validate form fields for response_required
    if data.type == "response_required" and not data.form_fields:
        raise HTTPException(status_code=400, detail="Form fields required for response_required notifications")
    
    # Validate that at least one targeting option is selected
    if not data.target_categories and not data.target_candidate_ids:
        raise HTTPException(status_code=400, detail="At least one target category or specific candidate must be selected")
    
    # Get target candidates
    candidates = await get_target_candidates(db, data.target_categories, data.target_candidate_ids)
    
    if not candidates:
        raise HTTPException(status_code=400, detail="No candidates match the target criteria")
    
    # Create notification document
    notification_id = f"cand_notif_{uuid.uuid4().hex[:12]}"
    notification = {
        "id": notification_id,
        "type": data.type,
        "title": data.title,
        "message": data.message,
        "target_categories": data.target_categories,
        "target_candidate_ids": [c.get("id") for c in candidates],
        "send_email": data.send_email,
        "form_fields": [f.dict() for f in data.form_fields] if data.form_fields else None,
        "deadline": data.deadline,
        "popup_enabled": bool(data.popup_enabled),
        "popup_max_views": max(0, int(data.popup_max_views or 0)),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("id"),
        "created_by_name": admin.get("name"),
        "total_recipients": len(candidates),
        "total_read": 0,
        "total_responded": 0
    }
    
    await db.candidate_notifications.insert_one(notification)
    
    # Send emails if enabled
    emails_sent = 0
    if data.send_email:
        for candidate in candidates:
            if await send_notification_email(candidate, notification):
                emails_sent += 1
    
    logger.info(f"Created candidate notification {notification_id} for {len(candidates)} candidates (categories: {data.target_categories}), sent {emails_sent} emails")
    
    return {
        "message": "Notification created and sent successfully",
        "notification_id": notification_id,
        "total_recipients": len(candidates),
        "emails_sent": emails_sent,
        "target_categories": data.target_categories
    }


@router.get("")
async def list_notifications(request: Request, page: int = 1, limit: int = 20):
    """List all notifications (admin view)"""
    await verify_admin(request)
    db = get_db(request)
    
    skip = (page - 1) * limit
    
    notifications = await db.candidate_notifications.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.candidate_notifications.count_documents({})
    
    # Recompute read/responded counts from the responses collection so the
    # admin view never shows stale totals (the stored total_read can lag
    # behind when users mark-all-read in bulk).
    if notifications:
        notif_ids = [n["id"] for n in notifications]
        pipeline = [
            {"$match": {"notification_id": {"$in": notif_ids}}},
            {"$group": {
                "_id": "$notification_id",
                "read": {"$sum": {"$cond": [{"$in": ["$status", ["read", "responded"]]}, 1, 0]}},
                "responded": {"$sum": {"$cond": [{"$eq": ["$status", "responded"]}, 1, 0]}},
            }}
        ]
        stats_by_id = {}
        async for row in db.candidate_notification_responses.aggregate(pipeline):
            stats_by_id[row["_id"]] = {"read": row["read"], "responded": row["responded"]}
        
        for n in notifications:
            s = stats_by_id.get(n["id"], {"read": 0, "responded": 0})
            n["total_read"] = s["read"]
            n["total_responded"] = s["responded"]
    
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
    
    notification = await db.candidate_notifications.find_one({"id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Get response stats
    responses = await db.candidate_notification_responses.find(
        {"notification_id": notification_id}, {"_id": 0}
    ).to_list(10000)
    
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
    
    notification = await db.candidate_notifications.find_one({"id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    responses = await db.candidate_notification_responses.find(
        {"notification_id": notification_id}, {"_id": 0}
    ).sort("responded_at", -1).to_list(10000)
    
    # Get candidate details for those who haven't responded yet
    responded_candidate_ids = [r.get("candidate_id") for r in responses]
    target_candidate_ids = notification.get("target_candidate_ids", [])
    pending_candidate_ids = [cid for cid in target_candidate_ids if cid not in responded_candidate_ids]
    
    pending_candidates = []
    if pending_candidate_ids:
        pending_candidates = await db.users.find(
            {"id": {"$in": pending_candidate_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(10000)
    
    return {
        "notification": notification,
        "responses": responses,
        "pending_candidates": pending_candidates
    }


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.candidate_notifications.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Also delete responses
    await db.candidate_notification_responses.delete_many({"notification_id": notification_id})
    
    return {"message": "Notification deleted successfully"}


# Candidate-facing endpoints will be added to routes/dashboard.py or similar
