"""
Candidate-facing notification endpoints
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/candidate/notifications", tags=["candidate-notifications"])


class NotificationResponseRequest(BaseModel):
    response_data: Dict[str, Any]


def get_db(request: Request):
    return request.app.state.db


async def get_current_user(request: Request):
    """Get current authenticated user"""
    from routes.auth import get_current_user as auth_get_user
    return await auth_get_user(request)


@router.get("/active-popup")
async def get_active_popup_notification(request: Request):
    """Return the next eligible popup notification for the current candidate.

    Eligible = popup_enabled is True, the user is in the target list, the user
    has not yet hit popup_max_views, and they have not already been shown the
    popup today (UTC calendar day).
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get("id")
    db = get_db(request)
    today_utc = datetime.now(timezone.utc).date().isoformat()

    # Most recent popup-enabled notifications targeted to this user
    notifications = await db.candidate_notifications.find(
        {
            "target_candidate_ids": user_id,
            "popup_enabled": True,
            "popup_max_views": {"$gt": 0},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    for notif in notifications:
        notif_id = notif.get("id")
        max_views = int(notif.get("popup_max_views") or 0)
        if max_views <= 0:
            continue

        response = await db.candidate_notification_responses.find_one(
            {"notification_id": notif_id, "candidate_id": user_id},
            {"_id": 0},
        )
        views = int((response or {}).get("popup_views_count") or 0)
        last_shown = (response or {}).get("last_popup_shown_date")

        if views >= max_views:
            continue
        if last_shown == today_utc:
            continue

        return {"notification": notif, "views_used": views, "max_views": max_views}

    return {"notification": None}


@router.post("/{notification_id}/popup-shown")
async def record_popup_shown(notification_id: str, request: Request):
    """Record that the popup was shown to this candidate today."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get("id")
    db = get_db(request)

    notification = await db.candidate_notifications.find_one(
        {"id": notification_id, "target_candidate_ids": user_id},
        {"_id": 0},
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    today_utc = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = await db.candidate_notification_responses.find_one(
        {"notification_id": notification_id, "candidate_id": user_id},
    )

    if existing:
        # Don't double-count if we've already recorded a view today
        if existing.get("last_popup_shown_date") == today_utc:
            return {
                "popup_views_count": int(existing.get("popup_views_count") or 0),
                "last_popup_shown_date": today_utc,
            }
        update = {
            "$set": {"last_popup_shown_date": today_utc},
            "$inc": {"popup_views_count": 1},
        }
        # Mark as read on first popup if it was still pending
        if existing.get("status") == "pending":
            update["$set"]["status"] = "read"
            update["$set"]["read_at"] = now_iso
        await db.candidate_notification_responses.update_one(
            {"notification_id": notification_id, "candidate_id": user_id},
            update,
        )
        new_views = int(existing.get("popup_views_count") or 0) + 1
    else:
        await db.candidate_notification_responses.insert_one({
            "notification_id": notification_id,
            "candidate_id": user_id,
            "candidate_name": user.get("name"),
            "candidate_email": user.get("email"),
            "status": "read",
            "read_at": now_iso,
            "response_data": None,
            "responded_at": None,
            "popup_views_count": 1,
            "last_popup_shown_date": today_utc,
        })
        new_views = 1

    return {"popup_views_count": new_views, "last_popup_shown_date": today_utc}


@router.get("")
async def get_my_notifications(request: Request):
    """Get all notifications for the current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("id")
    db = get_db(request)
    
    # Find all notifications where user is a target
    notifications = await db.candidate_notifications.find(
        {"target_candidate_ids": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get user's response status for each notification
    enriched_notifications = []
    unread_count = 0
    
    for notif in notifications:
        response = await db.candidate_notification_responses.find_one(
            {
                "notification_id": notif["id"],
                "candidate_id": user_id
            },
            {"_id": 0}
        )
        
        status = response.get("status", "pending") if response else "pending"
        notif["status"] = status
        notif["response_data"] = response.get("response_data") if response else None
        notif["responded_at"] = response.get("responded_at") if response else None
        
        # Count unread (pending status)
        if status == "pending":
            unread_count += 1
        
        enriched_notifications.append(notif)
    
    return {
        "notifications": enriched_notifications,
        "unread_count": unread_count
    }


@router.get("/unread-count")
async def get_unread_notification_count(request: Request):
    """Get count of unread notifications for the current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("id")
    db = get_db(request)
    
    # Get all notification IDs where user is a target
    notifications = await db.candidate_notifications.find(
        {"target_candidate_ids": user_id},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    
    notification_ids = [n["id"] for n in notifications]
    
    # Count how many have pending status (unread)
    unread_count = 0
    for notif_id in notification_ids:
        response = await db.candidate_notification_responses.find_one({
            "notification_id": notif_id,
            "candidate_id": user_id
        })
        
        # If no response or status is pending, it's unread
        if not response or response.get("status") == "pending":
            unread_count += 1
    
    return {"unread_count": unread_count}


@router.post("/{notification_id}/read")
async def mark_notification_as_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("id")
    db = get_db(request)
    
    # Check if notification exists and user is a target
    notification = await db.candidate_notifications.find_one(
        {
            "id": notification_id,
            "target_candidate_ids": user_id
        },
        {"_id": 0}
    )
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check if response record exists
    existing_response = await db.candidate_notification_responses.find_one({
        "notification_id": notification_id,
        "candidate_id": user_id
    })
    
    if existing_response:
        # Update status to read if it was pending
        if existing_response.get("status") == "pending":
            await db.candidate_notification_responses.update_one(
                {
                    "notification_id": notification_id,
                    "candidate_id": user_id
                },
                {"$set": {"status": "read", "read_at": datetime.now(timezone.utc).isoformat()}}
            )
    else:
        # Create new response record with read status
        response_doc = {
            "notification_id": notification_id,
            "candidate_id": user_id,
            "candidate_name": user.get("name"),
            "candidate_email": user.get("email"),
            "status": "read",
            "read_at": datetime.now(timezone.utc).isoformat(),
            "response_data": None,
            "responded_at": None
        }
        await db.candidate_notification_responses.insert_one(response_doc)
    
    # Update notification total_read count
    read_count = await db.candidate_notification_responses.count_documents({
        "notification_id": notification_id,
        "status": {"$in": ["read", "responded"]}
    })
    
    await db.candidate_notifications.update_one(
        {"id": notification_id},
        {"$set": {"total_read": read_count}}
    )
    
    return {"message": "Notification marked as read"}



@router.post("/mark-all-read")
async def mark_all_notifications_as_read(request: Request):
    """Mark all pending notifications as read for the current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("id")
    db = get_db(request)
    
    # Get all notifications where user is a target
    notifications = await db.candidate_notifications.find(
        {"target_candidate_ids": user_id},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    
    marked_count = 0
    touched_notification_ids = []
    
    for notification in notifications:
        notification_id = notification["id"]
        
        # Check if response record exists
        existing_response = await db.candidate_notification_responses.find_one({
            "notification_id": notification_id,
            "candidate_id": user_id
        })
        
        if existing_response:
            # Update status to read if it was pending
            if existing_response.get("status") == "pending":
                await db.candidate_notification_responses.update_one(
                    {
                        "notification_id": notification_id,
                        "candidate_id": user_id
                    },
                    {"$set": {"status": "read", "read_at": datetime.now(timezone.utc).isoformat()}}
                )
                marked_count += 1
                touched_notification_ids.append(notification_id)
        else:
            # Create new response record with read status
            response_doc = {
                "notification_id": notification_id,
                "candidate_id": user_id,
                "candidate_name": user.get("name"),
                "candidate_email": user.get("email"),
                "status": "read",
                "read_at": datetime.now(timezone.utc).isoformat(),
                "response_data": None,
                "responded_at": None
            }
            await db.candidate_notification_responses.insert_one(response_doc)
            marked_count += 1
            touched_notification_ids.append(notification_id)
    
    # Recompute and persist total_read on each notification we touched so the
    # admin "X read" stat reflects the actual number of unique readers.
    for notification_id in touched_notification_ids:
        read_count = await db.candidate_notification_responses.count_documents({
            "notification_id": notification_id,
            "status": {"$in": ["read", "responded"]}
        })
        await db.candidate_notifications.update_one(
            {"id": notification_id},
            {"$set": {"total_read": read_count}}
        )
    
    logger.info(f"Marked {marked_count} notifications as read for user {user_id}")
    
    return {
        "message": "All notifications marked as read",
        "marked_count": marked_count
    }


@router.post("/{notification_id}/respond")
async def respond_to_notification(notification_id: str, data: NotificationResponseRequest, request: Request):
    """Submit a response to a notification"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("id")
    db = get_db(request)
    
    # Check if notification exists and user is a target
    notification = await db.candidate_notifications.find_one(
        {
            "id": notification_id,
            "target_candidate_ids": user_id
        },
        {"_id": 0}
    )
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Check if notification requires response
    if notification.get("type") != "response_required":
        raise HTTPException(status_code=400, detail="This notification does not require a response")
    
    # Check deadline
    if notification.get("deadline"):
        deadline = datetime.fromisoformat(notification["deadline"].replace('Z', '+00:00'))
        # datetime-local inputs come in naive ISO format ("2026-04-30T20:07").
        # Treat naive deadlines as UTC so the comparison below never blows up.
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Response deadline has passed")
    
    # Validate required fields
    form_fields = notification.get("form_fields", [])
    for field in form_fields:
        if field.get("required"):
            field_name = field.get("name")
            if field_name not in data.response_data or not data.response_data[field_name]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Required field missing: {field.get('label', field_name)}"
                )
    
    # Check if already responded
    existing_response = await db.candidate_notification_responses.find_one({
        "notification_id": notification_id,
        "candidate_id": user_id
    })
    
    response_doc = {
        "notification_id": notification_id,
        "candidate_id": user_id,
        "candidate_name": user.get("name"),
        "candidate_email": user.get("email"),
        "status": "responded",
        "read_at": datetime.now(timezone.utc).isoformat(),
        "response_data": data.response_data,
        "responded_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing_response:
        # Update existing response
        await db.candidate_notification_responses.update_one(
            {
                "notification_id": notification_id,
                "candidate_id": user_id
            },
            {"$set": response_doc}
        )
    else:
        # Create new response
        await db.candidate_notification_responses.insert_one(response_doc)
    
    # Update notification counts
    read_count = await db.candidate_notification_responses.count_documents({
        "notification_id": notification_id,
        "status": {"$in": ["read", "responded"]}
    })
    
    responded_count = await db.candidate_notification_responses.count_documents({
        "notification_id": notification_id,
        "status": "responded"
    })
    
    await db.candidate_notifications.update_one(
        {"id": notification_id},
        {
            "$set": {
                "total_read": read_count,
                "total_responded": responded_count
            }
        }
    )
    
    logger.info(f"User {user_id} responded to notification {notification_id}")
    
    return {"message": "Response submitted successfully"}
