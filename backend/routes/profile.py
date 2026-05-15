from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import os
import re
import uuid
import base64
import logging

from routes.auth import get_current_user, get_db
from services.google_sheets_service import append_user_to_sheet
from services import mixpanel_service

router = APIRouter(prefix="/profile", tags=["profile"])
logger = logging.getLogger(__name__)

# Directory for profile pictures
UPLOAD_DIR = "/app/uploads/profile_pictures"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    phone_number: Optional[str] = None
    phone_country_code: Optional[str] = None
    location: Optional[str] = None
    location_country_code: Optional[str] = None
    years_of_experience: Optional[str] = None  # String range like "0-1", "1-2", "2-5", "5+"
    no_pg: Optional[bool] = None
    ug_college: Optional[str] = None
    pg_college: Optional[str] = None
    pg_incoming: Optional[bool] = None
    pg_joining_month: Optional[str] = None
    pg_joining_year: Optional[str] = None
    linkedin_url: Optional[str] = None
    target_firms: Optional[List[str]] = None
    target_companies: Optional[List[str]] = None  # Keep for backwards compatibility
    prep_objective: Optional[str] = None
    other_objective: Optional[str] = None
    preparation_level: Optional[str] = None
    preparation_stage: Optional[str] = None  # Keep for backwards compatibility
    peer_availability: Optional[List[str]] = None
    picture: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class UpdatePeerAvailabilityRequest(BaseModel):
    availability: List[str]  # ["Mon 10:00", "Tue 14:00", etc.]


@router.get("/me")
async def get_my_profile(request: Request):
    """Get current user's full profile"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get fresh data from database
    user_data = await db.users.find_one({"id": user.get("id")}, {"_id": 0})
    if user_data:
        return user_data
    
    # Return user object if no database entry
    return {
        "id": user.get("id"),
        "email": user.email,
        "name": user.name,
        "first_name": getattr(user, 'first_name', ''),
        "last_name": getattr(user, 'last_name', ''),
        "picture": user.picture,
        "plan": user.plan,
        "coaching_sessions_total": user.coaching_sessions_total,
        "coaching_sessions_used": user.coaching_sessions_used,
        "cohort_batch": user.cohort_batch,
        "is_mentor": user.get("is_mentor"),
        "peer_rating": getattr(user, 'peer_rating', 5.0),
        "peer_sessions_done": getattr(user, 'peer_sessions_done', 0),
        "peer_availability": getattr(user, 'peer_availability', []),
        "bio": getattr(user, 'bio', ''),
        "ug_college": getattr(user, 'ug_college', ''),
        "pg_college": getattr(user, 'pg_college', ''),
        "pg_incoming": getattr(user, 'pg_incoming', False),
        "pg_joining_month": getattr(user, 'pg_joining_month', ''),
        "pg_joining_year": getattr(user, 'pg_joining_year', ''),
        "target_firms": getattr(user, 'target_firms', []),
        "target_companies": getattr(user, 'target_companies', []),
        "prep_objective": getattr(user, 'prep_objective', ''),
        "preparation_level": getattr(user, 'preparation_level', 'beginner'),
        "preparation_stage": getattr(user, 'preparation_stage', 'beginner'),
        "onboarding_completed": getattr(user, 'onboarding_completed', False)
    }


@router.put("/update")
async def update_profile(profile_data: UpdateProfileRequest, request: Request):
    """Update user's profile"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Validate LinkedIn URL if provided
    if profile_data.linkedin_url:
        import re
        linkedin_pattern = r'^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?$'
        if not re.match(linkedin_pattern, profile_data.linkedin_url.strip(), re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Invalid LinkedIn URL. Please use format: linkedin.com/in/yourprofile")
    
    update_dict = {"updated_at": datetime.utcnow()}
    
    # Map all fields
    field_mappings = {
        'name': profile_data.name,
        'first_name': profile_data.first_name,
        'last_name': profile_data.last_name,
        'bio': profile_data.bio,
        'phone_number': profile_data.phone_number,
        'phone_country_code': profile_data.phone_country_code,
        'location': profile_data.location,
        'location_country_code': profile_data.location_country_code,
        'years_of_experience': profile_data.years_of_experience,
        'no_pg': profile_data.no_pg,
        'ug_college': profile_data.ug_college,
        'pg_college': profile_data.pg_college,
        'pg_incoming': profile_data.pg_incoming,
        'pg_joining_month': profile_data.pg_joining_month,
        'pg_joining_year': profile_data.pg_joining_year,
        'linkedin_url': profile_data.linkedin_url,
        'target_firms': profile_data.target_firms,
        'target_companies': profile_data.target_companies,
        'prep_objective': profile_data.prep_objective,
        'other_objective': profile_data.other_objective,
        'preparation_level': profile_data.preparation_level,
        'preparation_stage': profile_data.preparation_stage,
        'peer_availability': profile_data.peer_availability,
        'picture': profile_data.picture,
        'onboarding_completed': profile_data.onboarding_completed,
    }
    
    for field, value in field_mappings.items():
        if value is not None:
            update_dict[field] = value
    
    # Sync preparation_level and preparation_stage
    if profile_data.preparation_level is not None:
        update_dict['preparation_stage'] = profile_data.preparation_level
    if profile_data.preparation_stage is not None:
        update_dict['preparation_level'] = profile_data.preparation_stage
    
    # Sync target_firms and target_companies
    if profile_data.target_firms is not None:
        update_dict['target_companies'] = profile_data.target_firms
    if profile_data.target_companies is not None:
        update_dict['target_firms'] = profile_data.target_companies
    
    await db.users.update_one(
        {"id": user.get("id")},
        {"$set": update_dict}
    )
    
    # Always sync relevant fields to peer_profile if it exists
    user_id = user.get("id")
    existing_peer_profile = await db.peer_profiles.find_one({"user_id": user_id})
    
    if existing_peer_profile:
        # Build sync data from what was updated
        peer_sync_data = {"updated_at": datetime.utcnow()}
        
        if profile_data.name:
            peer_sync_data["name"] = profile_data.name
        if profile_data.ug_college is not None:
            peer_sync_data["ug_college"] = profile_data.ug_college
            peer_sync_data["university"] = profile_data.ug_college or profile_data.pg_college
        if profile_data.pg_college is not None:
            peer_sync_data["pg_college"] = profile_data.pg_college
            if not profile_data.ug_college:
                peer_sync_data["university"] = profile_data.pg_college
        if profile_data.no_pg is not None:
            peer_sync_data["no_pg"] = profile_data.no_pg
        if profile_data.pg_incoming is not None:
            peer_sync_data["pg_incoming"] = profile_data.pg_incoming
        if profile_data.target_firms:
            peer_sync_data["firms_targeting"] = profile_data.target_firms
        if profile_data.linkedin_url is not None:
            peer_sync_data["linkedin_url"] = profile_data.linkedin_url
        if profile_data.location is not None:
            peer_sync_data["location"] = profile_data.location
        if profile_data.location_country_code is not None:
            peer_sync_data["location_country_code"] = profile_data.location_country_code
        if profile_data.years_of_experience is not None:
            peer_sync_data["years_of_experience"] = profile_data.years_of_experience
        if profile_data.preparation_level is not None:
            peer_sync_data["preparation_level"] = profile_data.preparation_level
        if profile_data.picture:
            peer_sync_data["profile_picture"] = profile_data.picture
        
        await db.peer_profiles.update_one(
            {"user_id": user_id},
            {"$set": peer_sync_data}
        )
    
    # If onboarding is being completed, create peer_profile if doesn't exist
    if profile_data.onboarding_completed and not existing_peer_profile:
        user_name = profile_data.name or user.get("name", "")
        user_picture = profile_data.picture or user.get("picture", "")
        
        peer_profile_data = {
            "user_id": user_id,
            "email": user.get("email", ""),
            "name": user_name,
            "university": profile_data.pg_college or profile_data.ug_college or "",
            "ug_college": profile_data.ug_college or "",
            "pg_college": profile_data.pg_college or "",
            "no_pg": profile_data.no_pg or False,
            "firms_targeting": profile_data.target_firms or [],
            "linkedin_url": profile_data.linkedin_url or "",
            "location": profile_data.location or "",
            "location_country_code": profile_data.location_country_code or "",
            "years_of_experience": profile_data.years_of_experience or "",
            "preparation_level": profile_data.preparation_level or "beginner",
            "cases_done": 0,
            "profile_picture": user_picture,
            "is_listed": False,
            "rating": 5.0,
            "sessions_done": 0,
            "availability": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.peer_profiles.insert_one(peer_profile_data)
    
    # Sync to Google Sheet when onboarding is completed
    if profile_data.onboarding_completed:
        # Fetch the full updated user data from DB
        updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if updated_user:
            import asyncio
            asyncio.create_task(append_user_to_sheet(updated_user))
            
            # Track profile completion with Mixpanel
            try:
                mixpanel_service.track_profile_completed(user_id, updated_user)
            except Exception as e:
                print(f"Mixpanel tracking error (non-critical): {e}")
    
    return {"message": "Profile updated successfully"}


@router.post("/upload-picture")
async def upload_profile_picture(request: Request, file: UploadFile = File(...)):
    """Upload a profile picture - syncs to both users and peer_profiles"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file content
    content = await file.read()
    
    # Validate file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
    
    user_id = user.get("id")
    content_type = file.content_type or "image/jpeg"
    
    # Try cloud storage first, fallback to base64
    from services import cloud_storage_service
    
    if cloud_storage_service.is_enabled():
        try:
            # Upload to cloud storage
            result = cloud_storage_service.upload_profile_picture(
                data=content,
                filename=file.filename or "profile.jpg",
                user_id=user_id
            )
            # Generate URL for the file
            picture_url = f"/api/files/{result['storage_path']}"
        except Exception as e:
            logging.warning(f"Cloud upload failed, using base64 fallback: {e}")
            # Fallback to base64
            base64_data = base64.b64encode(content).decode("utf-8")
            picture_url = f"data:{content_type};base64,{base64_data}"
    else:
        # Fallback: Store as base64 data URI
        base64_data = base64.b64encode(content).decode("utf-8")
        picture_url = f"data:{content_type};base64,{base64_data}"
    
    # Update user's picture in users collection
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"picture": picture_url, "updated_at": datetime.utcnow()}}
    )
    
    # Also sync to peer_profiles if it exists
    await db.peer_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"profile_picture": picture_url, "updated_at": datetime.utcnow()}}
    )
    
    return {"picture_url": picture_url, "message": "Picture uploaded successfully"}


@router.put("/availability")
async def update_peer_availability(availability_data: UpdatePeerAvailabilityRequest, request: Request):
    """Update user's availability for peer practice"""
    user = await get_current_user(request)
    db = get_db(request)
    
    await db.users.update_one(
        {"id": user.get("id")},
        {"$set": {
            "peer_availability": availability_data.availability,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Availability updated successfully"}


@router.get("/stats")
async def get_user_stats(request: Request):
    """Get user's statistics"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Get fresh user data from database
    user_data = await db.users.find_one({"id": user.get("id")}, {"_id": 0})
    
    # Count peer sessions
    peer_sessions = await db.peer_sessions.count_documents({
        "$or": [
            {"requester_id": user.get("id")},
            {"partner_id": user.get("id")}
        ]
    })
    
    # Get progress
    progress = await db.user_progress.find_one({"user_id": user.get("id")})
    
    coaching_used = user_data.get('coaching_sessions_used', 0) if user_data else 0
    coaching_total = user_data.get('coaching_sessions_total', 0) if user_data else 0
    
    return {
        "peer_sessions_done": peer_sessions,
        "peer_rating": user_data.get('peer_rating', 5.0) if user_data else 5.0,
        "videos_completed": len(progress.get("videos_completed", [])) if progress else 0,
        "drills_completed": len(progress.get("drills_completed", [])) if progress else 0,
        "coaching_sessions_used": coaching_used,
        "coaching_sessions_remaining": coaching_total - coaching_used
    }


# ============= Phone Number Management =============

class SavePhoneRequest(BaseModel):
    phone_number: str  # e.g. "8866007332"
    country_code: str = "+91"  # e.g. "+91"


def normalize_phone(country_code: str, phone_number: str) -> str:
    """Normalize phone to international format without + (e.g., 918866007332)"""
    cc = country_code.replace('+', '').replace(' ', '').strip()
    pn = phone_number.replace('+', '').replace(' ', '').replace('-', '').strip()
    if pn.startswith(cc):
        pn = pn[len(cc):]
    return f"{cc}{pn}"


def validate_phone_number(phone_number: str) -> bool:
    """Basic phone number validation"""
    cleaned = re.sub(r'[\s\-\+\(\)]', '', phone_number)
    return cleaned.isdigit() and 7 <= len(cleaned) <= 15


@router.post("/phone/save")
async def save_phone_number(data: SavePhoneRequest, request: Request):
    """Save/update phone number for WhatsApp updates"""
    user = await get_current_user(request)
    db = get_db(request)
    user_id = user.get("id")

    if not validate_phone_number(data.phone_number):
        raise HTTPException(status_code=400, detail="Invalid phone number. Please enter a valid number.")

    cc = data.country_code.replace('+', '').strip()
    if not cc.isdigit() or len(cc) < 1 or len(cc) > 4:
        raise HTTPException(status_code=400, detail="Invalid country code.")

    full_number = normalize_phone(data.country_code, data.phone_number)

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "phone_number": data.phone_number,
                "phone_country_code": data.country_code,
                "phone_verified": False,
                "whatsapp_number": full_number,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    logger.info(f"Phone number saved for user {user_id}: ...{full_number[-4:]}")

    return {
        "success": True,
        "message": "Phone number saved successfully.",
        "phone_number": data.phone_number,
        "country_code": data.country_code,
    }


@router.delete("/phone/remove")
async def remove_phone_number(request: Request):
    """Remove phone number"""
    user = await get_current_user(request)
    db = get_db(request)
    user_id = user.get("id")

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "phone_number": None,
                "phone_country_code": None,
                "phone_verified": False,
                "phone_verified_at": None,
                "whatsapp_number": None,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    logger.info(f"Phone number removed for user {user_id}")
    return {"success": True, "message": "Phone number removed successfully."}
