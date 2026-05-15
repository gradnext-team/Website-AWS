"""
Forms Router - Handles form submissions for various application forms
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import uuid
import os
import base64

router = APIRouter(prefix="/api/forms", tags=["forms"])

# Database will be set by server.py
db = None

def set_database(database):
    global db
    db = database

# Collections for storing form submissions
PINNACLE_APPLICATIONS_COLLECTION = "pinnacle_applications"
SCHOLARSHIP_APPLICATIONS_COLLECTION = "scholarship_applications"

@router.post("/pinnacle-application")
async def submit_pinnacle_application(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    location: str = Form(...),
    undergrad_university: str = Form(...),
    postgrad_university: Optional[str] = Form(""),
    has_interview: bool = Form(False),
    interview_company: Optional[str] = Form(""),
    interview_date: Optional[str] = Form(""),
    linkedin_url: Optional[str] = Form(""),
    reason_for_applying: str = Form(...),
    cv_file: Optional[UploadFile] = File(None)
):
    """Submit a Pinnacle Program application"""
    try:
        application_id = str(uuid.uuid4())
        
        # Handle CV file upload
        cv_data = None
        cv_filename = None
        cv_storage_path = None
        
        if cv_file:
            content = await cv_file.read()
            cv_filename = cv_file.filename
            
            # Try cloud storage first
            from services import cloud_storage_service
            if cloud_storage_service.is_enabled():
                try:
                    result = cloud_storage_service.upload_cv(
                        data=content,
                        filename=cv_filename,
                        user_id=application_id
                    )
                    cv_storage_path = result['storage_path']
                except Exception as e:
                    print(f"Cloud upload failed, using base64: {e}")
                    cv_data = base64.b64encode(content).decode('utf-8')
            else:
                # Fallback to base64
                cv_data = base64.b64encode(content).decode('utf-8')
        
        # Create application document
        application = {
            "id": application_id,
            "name": name,
            "email": email,
            "phone": phone,
            "location": location,
            "undergrad_university": undergrad_university,
            "postgrad_university": postgrad_university or "",
            "has_interview": has_interview,
            "interview_company": interview_company or "",
            "interview_date": interview_date or "",
            "linkedin_url": linkedin_url or "",
            "reason_for_applying": reason_for_applying,
            "cv_filename": cv_filename,
            "cv_data": cv_data,  # Base64 encoded CV (fallback)
            "cv_storage_path": cv_storage_path,  # Cloud storage path
            "status": "pending",  # pending, reviewed, contacted, accepted, rejected
            "admin_notes": "",
            "submitted_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Save to database
        await db[PINNACLE_APPLICATIONS_COLLECTION].insert_one(application)
        
        return {
            "success": True,
            "message": "Application submitted successfully",
            "application_id": application_id
        }
    except Exception as e:
        print(f"Error submitting Pinnacle application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pinnacle-applications")
async def get_pinnacle_applications(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all Pinnacle Program applications (admin only)"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        cursor = db[PINNACLE_APPLICATIONS_COLLECTION].find(
            query,
            {"cv_data": 0, "_id": 0}  # Exclude CV data and _id from list view
        ).sort("submitted_at", -1).skip(skip).limit(limit)
        
        applications = await cursor.to_list(length=limit)
        
        # Get total count
        total = await db[PINNACLE_APPLICATIONS_COLLECTION].count_documents(query)
        
        return {
            "applications": applications,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        print(f"Error fetching Pinnacle applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pinnacle-applications/{application_id}")
async def get_pinnacle_application(application_id: str):
    """Get a specific Pinnacle application with full details"""
    try:
        application = await db[PINNACLE_APPLICATIONS_COLLECTION].find_one(
            {"id": application_id},
            {"_id": 0}  # Exclude MongoDB _id
        )
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return application
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/pinnacle-applications/{application_id}")
async def update_pinnacle_application(application_id: str, updates: dict):
    """Update a Pinnacle application status or notes (admin only)"""
    try:
        # Only allow certain fields to be updated
        allowed_fields = ["status", "admin_notes"]
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        filtered_updates["updated_at"] = datetime.utcnow().isoformat()
        
        result = await db[PINNACLE_APPLICATIONS_COLLECTION].update_one(
            {"id": application_id},
            {"$set": filtered_updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": "Application updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pinnacle-applications/{application_id}")
async def delete_pinnacle_application(application_id: str):
    """Delete a Pinnacle application (admin only)"""
    try:
        result = await db[PINNACLE_APPLICATIONS_COLLECTION].delete_one({"id": application_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": "Application deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pinnacle-applications/{application_id}/cv")
async def download_cv(application_id: str):
    """Download CV for a specific application"""
    try:
        application = await db[PINNACLE_APPLICATIONS_COLLECTION].find_one(
            {"id": application_id},
            {"cv_data": 1, "cv_filename": 1}
        )
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        if not application.get("cv_data"):
            raise HTTPException(status_code=404, detail="No CV uploaded for this application")
        
        return {
            "filename": application.get("cv_filename", "cv.pdf"),
            "data": application.get("cv_data")  # Base64 encoded
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading CV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SCHOLARSHIP APPLICATIONS ====================

@router.post("/scholarship-application")
async def submit_scholarship_application(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    interview_company: str = Form(...),
    interview_date: str = Form(...),
    linkedin_url: Optional[str] = Form(""),
    reason_for_applying: str = Form(...),
    proof_file: UploadFile = File(...)
):
    """Submit a Scholarship application"""
    try:
        application_id = str(uuid.uuid4())
        
        # Handle proof file upload
        proof_data = None
        proof_filename = None
        proof_content_type = None
        if proof_file:
            content = await proof_file.read()
            proof_data = base64.b64encode(content).decode('utf-8')
            proof_filename = proof_file.filename
            proof_content_type = proof_file.content_type
        
        # Create application document
        application = {
            "id": application_id,
            "name": name,
            "email": email,
            "phone": phone,
            "interview_company": interview_company,
            "interview_date": interview_date,
            "linkedin_url": linkedin_url or "",
            "reason_for_applying": reason_for_applying,
            "proof_filename": proof_filename,
            "proof_content_type": proof_content_type,
            "proof_data": proof_data,
            "status": "pending",
            "admin_notes": "",
            "submitted_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].insert_one(application)
        
        return {
            "success": True,
            "message": "Scholarship application submitted successfully",
            "application_id": application_id
        }
    except Exception as e:
        print(f"Error submitting scholarship application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scholarship-applications")
async def get_scholarship_applications(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all scholarship applications (admin only)"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        cursor = db[SCHOLARSHIP_APPLICATIONS_COLLECTION].find(
            query,
            {"proof_data": 0, "_id": 0}
        ).sort("submitted_at", -1).skip(skip).limit(limit)
        
        applications = await cursor.to_list(length=limit)
        total = await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].count_documents(query)
        
        return {
            "applications": applications,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        print(f"Error fetching scholarship applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scholarship-applications/{application_id}")
async def get_scholarship_application(application_id: str):
    """Get a specific scholarship application with full details"""
    try:
        application = await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].find_one(
            {"id": application_id},
            {"_id": 0}
        )
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return application
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/scholarship-applications/{application_id}")
async def update_scholarship_application(application_id: str, updates: dict):
    """Update a scholarship application status or notes (admin only)"""
    try:
        allowed_fields = ["status", "admin_notes"]
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        filtered_updates["updated_at"] = datetime.utcnow().isoformat()
        
        result = await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].update_one(
            {"id": application_id},
            {"$set": filtered_updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": "Application updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scholarship-applications/{application_id}")
async def delete_scholarship_application(application_id: str):
    """Delete a scholarship application (admin only)"""
    try:
        result = await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].delete_one({"id": application_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return {"success": True, "message": "Application deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scholarship-applications/{application_id}/proof")
async def download_proof(application_id: str):
    """Download proof screenshot for a specific application"""
    try:
        application = await db[SCHOLARSHIP_APPLICATIONS_COLLECTION].find_one(
            {"id": application_id},
            {"proof_data": 1, "proof_filename": 1, "proof_content_type": 1}
        )
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        if not application.get("proof_data"):
            raise HTTPException(status_code=404, detail="No proof uploaded for this application")
        
        return {
            "filename": application.get("proof_filename", "proof.png"),
            "content_type": application.get("proof_content_type", "image/png"),
            "data": application.get("proof_data")
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading proof: {e}")
        raise HTTPException(status_code=500, detail=str(e))
