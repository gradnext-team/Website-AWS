"""
CRM System Routes
Handles leads, funnels, sales reps, call logs, and dashboard metrics.
Includes magic-link authentication for sales reps.
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Response
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid
import csv
import io
import logging
import secrets
import os

from routes.auth import get_current_user, get_db
try:
    from services.email_service import send_email
    EMAIL_AVAILABLE = True
except Exception:
    EMAIL_AVAILABLE = False
    send_email = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["crm"])


# ============ Auth Helpers ============

async def verify_crm_user(request: Request):
    """
    Verify the user is either:
    1. An admin (via main app session)
    2. A sales rep (via CRM magic link session)
    Returns dict: {id, name, email, role, is_admin}
    """
    db = get_db(request)

    # First check CRM session token
    crm_token = request.cookies.get("crm_session_token")
    if crm_token:
        session = await db.crm_sessions.find_one({"token": crm_token, "is_active": True}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at", "")
            if expires_at and expires_at > datetime.utcnow().isoformat():
                rep = await db.crm_sales_reps.find_one({"id": session["rep_id"], "is_active": True}, {"_id": 0})
                if rep:
                    return {
                        "id": rep["id"],
                        "name": rep["name"],
                        "email": rep["email"],
                        "role": "sales_rep",
                        "is_admin": False,
                        "rep_id": rep["id"],
                    }

    # Then check admin session
    try:
        user = await get_current_user(request)
        if isinstance(user, dict):
            is_admin = user.get('is_admin', False)
        else:
            is_admin = getattr(user, 'is_admin', False)
        if is_admin:
            return {
                "id": user.get("id") if isinstance(user, dict) else getattr(user, "id", None),
                "name": user.get("name", "Admin") if isinstance(user, dict) else getattr(user, "name", "Admin"),
                "email": user.get("email", "") if isinstance(user, dict) else getattr(user, "email", ""),
                "role": "admin",
                "is_admin": True,
                "rep_id": None,
            }
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Not authenticated")


async def verify_admin_only(request: Request):
    """Verify the user is an admin (not just a sales rep)"""
    crm_user = await verify_crm_user(request)
    if not crm_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return crm_user


# ============ Pydantic Models ============

class SalesRepCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "sales_rep"  # sales_rep, admin, both


class SalesRepUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class FunnelStage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str = "#3B82F6"
    order: int = 0


class FunnelSourceMapping(BaseModel):
    """Maps a lead source (e.g. 'free_signup') to a specific stage of the
    funnel. When a new lead is created with that source and no explicit
    funnel_id, the matching funnel + stage is chosen automatically."""
    source: str
    stage_id: str


class FunnelCreate(BaseModel):
    name: str
    stages: List[FunnelStage] = []
    is_default: bool = False
    source_mappings: List[FunnelSourceMapping] = []


class FunnelUpdate(BaseModel):
    name: Optional[str] = None
    stages: Optional[List[FunnelStage]] = None
    is_default: Optional[bool] = None
    source_mappings: Optional[List[FunnelSourceMapping]] = None


class LeadCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"  # free_signup, discovery_call, b2b_manual, csv_import, cohort, workshop
    source_details: Optional[str] = None
    funnel_id: Optional[str] = None
    stage_id: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    company: Optional[str] = None
    designation: Optional[str] = None
    custom_fields: Dict[str, Any] = {}


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    source_details: Optional[str] = None
    funnel_id: Optional[str] = None
    stage_id: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    designation: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # active, won, lost
    won_plan_key: Optional[str] = None         # plan_key chosen when lead won
    won_plan_name: Optional[str] = None        # human-readable plan name
    won_amount: Optional[float] = None         # custom amount (if applicable)


class CallLogCreate(BaseModel):
    lead_id: str
    sales_rep_id: str
    call_type: str = "outbound"  # outbound, inbound
    outcome: str  # picked_up, no_answer, busy, callback, voicemail, wrong_number, not_interested, interested
    duration_seconds: int = 0
    notes: Optional[str] = None
    called_at: Optional[str] = None  # ISO string


class LeadNoteCreate(BaseModel):
    lead_id: str
    note: str


class BulkAssignRequest(BaseModel):
    lead_ids: List[str]
    sales_rep_id: Optional[str] = None  # null = unassign all


class BulkFunnelUpdateRequest(BaseModel):
    """Body for POST /leads/bulk-update-funnel — move many leads into a
    different funnel (and optionally a specific stage) in one shot.
    If stage_id is omitted, the funnel's first stage is used as default."""
    lead_ids: List[str]
    funnel_id: str
    stage_id: Optional[str] = None


class BulkStageRequest(BaseModel):
    lead_ids: List[str]
    stage_id: str
    funnel_id: str


class MagicLinkRequest(BaseModel):
    email: str


class VerifyTokenRequest(BaseModel):
    token: str


class SetPasswordRequest(BaseModel):
    token: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str


# ============ CRM Auth ============

async def _send_invite_email(db, rep, origin):
    """Send an invite magic link to a new sales rep"""
    if not EMAIL_AVAILABLE or not send_email:
        logger.error("Email service not available for invite")
        return False

    token = secrets.token_urlsafe(48)
    expires_at = (datetime.utcnow() + timedelta(hours=48)).isoformat()

    await db.crm_magic_links.insert_one({
        "token": token,
        "rep_id": rep["id"],
        "email": rep["email"],
        "type": "invite",  # invite (first time) vs login (subsequent)
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.utcnow().isoformat()
    })

    if not origin:
        origin = os.environ.get("FRONTEND_URL", "https://app.gradnext.co")

    setup_url = f"{origin}/crm/setup?token={token}"

    html_content = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 24px; color: #1e293b; margin: 0;">gradnext</h1>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">CRM Portal</p>
        </div>
        <h2 style="color: #1e293b; font-size: 20px; text-align: center; margin-bottom: 8px;">Welcome to the team!</h2>
        <p style="color: #64748b; text-align: center; font-size: 14px; margin-bottom: 30px;">
            Hi {rep['name']}, you've been added to the gradnext CRM. Click below to set up your password and start working.
        </p>
        <div style="text-align: center; margin-bottom: 30px;">
            <a href="{setup_url}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #6366F1); color: white; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 600;">
                Set Up My Account
            </a>
        </div>
        <p style="color: #94a3b8; text-align: center; font-size: 12px;">
            This link expires in 48 hours. If you didn't expect this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #cbd5e1; text-align: center; font-size: 11px;">
            gradnext &middot; CRM Portal
        </p>
    </div>
    """

    try:
        await send_email(
            to=rep["email"],
            subject="You're invited to gradnext CRM — Set up your account",
            html_content=html_content,
            sender_name="gradnext CRM"
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send invite email to {rep['email']}: {e}")
        return False


@router.post("/auth/login")
async def crm_login(data: LoginRequest, request: Request, response: Response):
    """Login with email and password"""
    db = get_db(request)
    email = data.email.strip().lower()

    rep = await db.crm_sales_reps.find_one({"email": email, "is_active": True}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    stored_hash = rep.get("password_hash")
    if not stored_hash:
        raise HTTPException(status_code=401, detail="Account not set up yet. Check your email for the setup link.")

    # Verify password
    import bcrypt
    if not bcrypt.checkpw(data.password.encode('utf-8'), stored_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create session (7 days)
    session_token = f"crm_{secrets.token_hex(32)}"
    session_expires = (datetime.utcnow() + timedelta(days=7)).isoformat()

    await db.crm_sessions.insert_one({
        "token": session_token,
        "rep_id": rep["id"],
        "email": rep["email"],
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": session_expires
    })

    response.set_cookie(
        key="crm_session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    return {
        "message": "Login successful",
        "user": {
            "id": rep["id"],
            "name": rep["name"],
            "email": rep["email"],
            "role": rep.get("role", "sales_rep"),
            "is_admin": False,
        }
    }


@router.post("/auth/setup-password")
async def setup_password(data: SetPasswordRequest, request: Request, response: Response):
    """Set password after clicking invite magic link"""
    db = get_db(request)

    link = await db.crm_magic_links.find_one({"token": data.token, "used": False, "type": "invite"}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=400, detail="Invalid or expired setup link")

    if link.get("expires_at", "") < datetime.utcnow().isoformat():
        raise HTTPException(status_code=400, detail="Setup link has expired. Ask your admin to resend the invite.")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Mark link as used
    await db.crm_magic_links.update_one({"token": data.token}, {"$set": {"used": True}})

    # Verify rep exists
    rep = await db.crm_sales_reps.find_one({"id": link["rep_id"], "is_active": True}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=400, detail="Account not found or deactivated")

    # Hash password and store
    import bcrypt
    password_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.crm_sales_reps.update_one(
        {"id": rep["id"]},
        {"$set": {"password_hash": password_hash, "account_setup": True, "updated_at": datetime.utcnow().isoformat()}}
    )

    # Create session automatically
    session_token = f"crm_{secrets.token_hex(32)}"
    session_expires = (datetime.utcnow() + timedelta(days=7)).isoformat()

    await db.crm_sessions.insert_one({
        "token": session_token,
        "rep_id": rep["id"],
        "email": rep["email"],
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": session_expires
    })

    response.set_cookie(
        key="crm_session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    return {
        "message": "Password set successfully! You're now logged in.",
        "user": {
            "id": rep["id"],
            "name": rep["name"],
            "email": rep["email"],
            "role": rep.get("role", "sales_rep"),
            "is_admin": False,
        }
    }


@router.get("/auth/verify-invite")
async def verify_invite_token(request: Request, token: str = ""):
    """Check if an invite token is valid (for the setup page)"""
    db = get_db(request)

    if not token:
        raise HTTPException(status_code=400, detail="No token provided")

    link = await db.crm_magic_links.find_one({"token": token, "used": False, "type": "invite"}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=400, detail="Invalid or expired setup link")

    if link.get("expires_at", "") < datetime.utcnow().isoformat():
        raise HTTPException(status_code=400, detail="Setup link has expired")

    rep = await db.crm_sales_reps.find_one({"id": link["rep_id"], "is_active": True}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=400, detail="Account not found")

    return {"valid": True, "name": rep["name"], "email": rep["email"]}


@router.post("/auth/resend-invite/{rep_id}")
async def resend_invite(rep_id: str, request: Request):
    """Admin resends invite email to a sales rep"""
    await verify_admin_only(request)
    db = get_db(request)

    rep = await db.crm_sales_reps.find_one({"id": rep_id, "is_active": True}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=404, detail="Sales rep not found")

    # Invalidate old invite tokens
    await db.crm_magic_links.update_many(
        {"rep_id": rep_id, "type": "invite", "used": False},
        {"$set": {"used": True}}
    )

    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        origin = origin.split("/crm")[0].split("/api")[0].rstrip("/")

    sent = await _send_invite_email(db, rep, origin)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send invite email")

    return {"message": f"Invite resent to {rep['email']}"}


@router.put("/auth/admin-reset-password/{rep_id}")
async def admin_reset_password(rep_id: str, data: AdminResetPasswordRequest, request: Request):
    """Admin resets a sales rep's password"""
    await verify_admin_only(request)
    db = get_db(request)

    rep = await db.crm_sales_reps.find_one({"id": rep_id}, {"_id": 0})
    if not rep:
        raise HTTPException(status_code=404, detail="Sales rep not found")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    import bcrypt
    password_hash = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.crm_sales_reps.update_one(
        {"id": rep_id},
        {"$set": {"password_hash": password_hash, "account_setup": True, "updated_at": datetime.utcnow().isoformat()}}
    )

    # Invalidate all active sessions for this rep
    await db.crm_sessions.update_many({"rep_id": rep_id, "is_active": True}, {"$set": {"is_active": False}})

    return {"message": f"Password reset for {rep['name']}. They will need to login again."}


@router.get("/auth/me")
async def crm_auth_me(request: Request):
    """Get current CRM user info"""
    try:
        crm_user = await verify_crm_user(request)
        return {"user": crm_user}
    except HTTPException:
        raise HTTPException(status_code=401, detail="Not authenticated")


@router.get("/bootstrap")
async def crm_bootstrap(request: Request):
    """Bundled bootstrap endpoint — returns user + sales_reps + funnels in ONE
    call instead of 3 sequential roundtrips. Drastically improves CRM dashboard
    initial load time (especially on slow networks / production behind CDN).

    Frontend should call this ONCE on CRM mount instead of /auth/me,
    /sales-reps, /funnels separately.
    """
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    # Fetch both in parallel via asyncio.gather (saves ~150ms vs sequential)
    import asyncio
    reps_task = db.crm_sales_reps.find(
        {"is_active": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    funnels_task = db.crm_funnels.find({}, {"_id": 0}).to_list(100)
    reps, funnels = await asyncio.gather(reps_task, funnels_task)

    return {
        "user": crm_user,
        "sales_reps": reps,
        "funnels": funnels,
    }


@router.post("/auth/logout")
async def crm_logout(request: Request, response: Response):
    """Logout from CRM"""
    db = get_db(request)
    crm_token = request.cookies.get("crm_session_token")
    if crm_token:
        await db.crm_sessions.update_one({"token": crm_token}, {"$set": {"is_active": False}})
    response.delete_cookie("crm_session_token", path="/")
    return {"message": "Logged out"}


# ============ Sales Reps ============

@router.get("/sales-reps")
async def get_sales_reps(request: Request):
    """Get all sales reps"""
    await verify_crm_user(request)
    db = get_db(request)
    reps = await db.crm_sales_reps.find({"is_active": True}, {"_id": 0, "password_hash": 0}).to_list(500)
    return {"sales_reps": reps}


@router.get("/sales-reps/all")
async def get_all_sales_reps(request: Request):
    """Get all sales reps including inactive"""
    await verify_admin_only(request)
    db = get_db(request)
    reps = await db.crm_sales_reps.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return {"sales_reps": reps}


@router.post("/sales-reps")
async def create_sales_rep(data: SalesRepCreate, request: Request):
    """Create a new sales rep and send invite email"""
    await verify_admin_only(request)
    db = get_db(request)

    # Check duplicate email
    existing = await db.crm_sales_reps.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Sales rep with this email already exists")

    rep = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email.strip().lower(),
        "phone": data.phone,
        "role": data.role,
        "is_active": True,
        "account_setup": False,
        "password_hash": None,
        "leads_count": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    await db.crm_sales_reps.insert_one(rep)
    rep.pop("_id", None)

    # Auto-send invite email
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        origin = origin.split("/crm")[0].split("/api")[0].rstrip("/")
    invite_sent = await _send_invite_email(db, rep, origin)

    return {
        "message": f"Sales rep created{' and invite sent' if invite_sent else ' (invite email failed — resend manually)'}",
        "sales_rep": rep,
        "invite_sent": invite_sent
    }


@router.put("/sales-reps/{rep_id}")
async def update_sales_rep(rep_id: str, data: SalesRepUpdate, request: Request):
    """Update a sales rep"""
    await verify_admin_only(request)
    db = get_db(request)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = await db.crm_sales_reps.update_one({"id": rep_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sales rep not found")
    return {"message": "Sales rep updated"}


@router.delete("/sales-reps/{rep_id}")
async def delete_sales_rep(rep_id: str, request: Request):
    """Soft-delete a sales rep"""
    await verify_admin_only(request)
    db = get_db(request)
    result = await db.crm_sales_reps.update_one(
        {"id": rep_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sales rep not found")
    return {"message": "Sales rep deactivated"}


# ============ Funnels ============

@router.get("/funnels")
async def get_funnels(request: Request):
    """Get all funnels"""
    await verify_crm_user(request)
    db = get_db(request)
    funnels = await db.crm_funnels.find({}, {"_id": 0}).to_list(100)

    if not funnels:
        # Create default funnel
        default_funnel = {
            "id": str(uuid.uuid4()),
            "name": "Default Sales Funnel",
            "is_default": True,
            "stages": [
                {"id": str(uuid.uuid4()), "name": "New", "color": "#6B7280", "order": 0},
                {"id": str(uuid.uuid4()), "name": "Contacted", "color": "#3B82F6", "order": 1},
                {"id": str(uuid.uuid4()), "name": "Call Scheduled", "color": "#8B5CF6", "order": 2},
                {"id": str(uuid.uuid4()), "name": "Call Done", "color": "#F59E0B", "order": 3},
                {"id": str(uuid.uuid4()), "name": "Qualified", "color": "#10B981", "order": 4},
                {"id": str(uuid.uuid4()), "name": "Proposal Sent", "color": "#EC4899", "order": 5},
                {"id": str(uuid.uuid4()), "name": "Negotiation", "color": "#F97316", "order": 6},
                {"id": str(uuid.uuid4()), "name": "Won", "color": "#22C55E", "order": 7},
                {"id": str(uuid.uuid4()), "name": "Lost", "color": "#EF4444", "order": 8},
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.crm_funnels.insert_one(default_funnel)
        default_funnel.pop("_id", None)
        funnels = [default_funnel]

    return {"funnels": funnels}


@router.post("/funnels")
async def create_funnel(data: FunnelCreate, request: Request):
    """Create a new funnel"""
    await verify_admin_only(request)
    db = get_db(request)

    funnel = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "is_default": data.is_default,
        "stages": [s.dict() for s in data.stages] if data.stages else [
            {"id": str(uuid.uuid4()), "name": "New", "color": "#6B7280", "order": 0},
            {"id": str(uuid.uuid4()), "name": "Won", "color": "#22C55E", "order": 1},
            {"id": str(uuid.uuid4()), "name": "Lost", "color": "#EF4444", "order": 2},
        ],
        "source_mappings": [m.dict() for m in (data.source_mappings or [])],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    if data.is_default:
        await db.crm_funnels.update_many({}, {"$set": {"is_default": False}})

    await db.crm_funnels.insert_one(funnel)
    funnel.pop("_id", None)
    return {"message": "Funnel created", "funnel": funnel}


@router.put("/funnels/{funnel_id}")
async def update_funnel(funnel_id: str, data: FunnelUpdate, request: Request):
    """Update a funnel"""
    await verify_admin_only(request)
    db = get_db(request)

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.stages is not None:
        update_data["stages"] = [s.dict() for s in data.stages]
    if data.is_default is not None:
        update_data["is_default"] = data.is_default
        if data.is_default:
            await db.crm_funnels.update_many({"id": {"$ne": funnel_id}}, {"$set": {"is_default": False}})
    if data.source_mappings is not None:
        update_data["source_mappings"] = [m.dict() for m in data.source_mappings]

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")

    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = await db.crm_funnels.update_one({"id": funnel_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Funnel not found")
    return {"message": "Funnel updated"}


@router.delete("/funnels/{funnel_id}")
async def delete_funnel(funnel_id: str, request: Request):
    """Delete a funnel"""
    await verify_admin_only(request)
    db = get_db(request)

    funnel = await db.crm_funnels.find_one({"id": funnel_id}, {"_id": 0})
    if not funnel:
        raise HTTPException(status_code=404, detail="Funnel not found")
    if funnel.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete the default funnel")

    # Move leads in this funnel to default funnel
    default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
    if default_funnel:
        first_stage_id = default_funnel["stages"][0]["id"] if default_funnel.get("stages") else None
        await db.crm_leads.update_many(
            {"funnel_id": funnel_id},
            {"$set": {"funnel_id": default_funnel["id"], "stage_id": first_stage_id}}
        )

    await db.crm_funnels.delete_one({"id": funnel_id})
    return {"message": "Funnel deleted"}


# ============ Leads ============

@router.get("/leads")
async def get_leads(
    request: Request,
    funnel_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    skip: int = 0,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """Get leads with filtering"""
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    query = {}
    # Track $or conditions separately so multiple filters using $or don't clobber each other
    or_clauses = []
    # Sales reps can only see their assigned leads
    if not crm_user.get("is_admin"):
        query["assigned_to"] = crm_user.get("rep_id")
    if funnel_id:
        query["funnel_id"] = funnel_id
    if stage_id:
        query["stage_id"] = stage_id
    if assigned_to:
        # Special sentinel: "__unassigned__" → leads with no rep assigned.
        # Powers the "Unassigned only" filter option which is the most common
        # starting point for bulk-assigning fresh leads.
        if assigned_to == "__unassigned__":
            or_clauses.append([{"assigned_to": None}, {"assigned_to": {"$exists": False}}])
        else:
            query["assigned_to"] = assigned_to
    if source:
        query["source"] = source
    if status:
        query["status"] = status
    if search:
        or_clauses.append([
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
        ])

    # Combine multiple $or clauses with $and so they don't overwrite each other
    if len(or_clauses) == 1:
        query["$or"] = or_clauses[0]
    elif len(or_clauses) > 1:
        query["$and"] = [{"$or": clause} for clause in or_clauses]

    sort_dir = -1 if sort_order == "desc" else 1
    # Project only the fields the UI uses (saves bandwidth) and run count+find in parallel
    import asyncio
    projection = {
        "_id": 0,
        "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1,
        "source": 1, "funnel_id": 1, "stage_id": 1,
        "assigned_to": 1, "status": 1,
        "created_at": 1, "updated_at": 1,
        "won_plan_name": 1, "won_amount": 1, "won_plan_key": 1,
    }
    total_task = db.crm_leads.count_documents(query)
    find_task = db.crm_leads.find(query, projection).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    total, leads = await asyncio.gather(total_task, find_task)

    # Enrich with sales rep names
    rep_ids = list(set(l.get("assigned_to") for l in leads if l.get("assigned_to")))
    reps_map = {}
    if rep_ids:
        reps = await db.crm_sales_reps.find({"id": {"$in": rep_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        reps_map = {r["id"]: r["name"] for r in reps}

    for lead in leads:
        lead["assigned_to_name"] = reps_map.get(lead.get("assigned_to"), None)

    return {"leads": leads, "total": total}


@router.get("/leads/overdue")
async def get_overdue_leads(request: Request):
    """Compute leads that have been stuck in a stage longer than the
    configured days_threshold for that stage's workflow rule.

    Returns:
      {
        "count": int,
        "leads": [{
          "lead_id", "lead_name", "stage_name", "funnel_name",
          "days_in_stage", "days_threshold", "rule_name", "assigned_to_name"
        }, ...]
      }

    Sales reps only see overdue leads assigned to them.
    """
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    rules = await db.crm_workflow_rules.find({"is_active": {"$ne": False}}, {"_id": 0}).to_list(500)
    if not rules:
        return {"count": 0, "leads": []}

    # Build maps for fast lookup
    funnels = await db.crm_funnels.find({}, {"_id": 0}).to_list(100)
    funnel_map = {f["id"]: f for f in funnels}

    # Query leads matching any rule's (funnel, stage) pair, status = active only
    rule_conditions = [
        {"funnel_id": r["funnel_id"], "stage_id": r["stage_id"]} for r in rules
    ]
    query = {"$or": rule_conditions, "status": "active"}
    if not crm_user.get("is_admin"):
        query["assigned_to"] = crm_user.get("rep_id")

    leads = await db.crm_leads.find(query, {"_id": 0}).to_list(2000)

    # Enrich with rep names
    rep_ids = list({l.get("assigned_to") for l in leads if l.get("assigned_to")})
    reps_map = {}
    if rep_ids:
        reps = await db.crm_sales_reps.find({"id": {"$in": rep_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        reps_map = {r["id"]: r["name"] for r in reps}

    now = datetime.utcnow()
    overdue = []
    for lead in leads:
        # Find the matching rule for this lead's (funnel, stage)
        matching_rule = next(
            (r for r in rules if r["funnel_id"] == lead.get("funnel_id") and r["stage_id"] == lead.get("stage_id")),
            None
        )
        if not matching_rule:
            continue
        # Fallback: if stage_changed_at is missing on legacy leads, use created_at
        stage_ts = lead.get("stage_changed_at") or lead.get("created_at")
        if not stage_ts:
            continue
        try:
            stage_dt = datetime.fromisoformat(stage_ts.replace("Z", ""))
        except Exception:
            continue
        days_in_stage = (now - stage_dt).total_seconds() / 86400
        if days_in_stage < matching_rule["days_threshold"]:
            continue
        funnel = funnel_map.get(lead.get("funnel_id"))
        stage_name = "Unknown"
        if funnel:
            for s in funnel.get("stages", []):
                if s["id"] == lead.get("stage_id"):
                    stage_name = s["name"]
                    break
        overdue.append({
            "lead_id": lead["id"],
            "lead_name": lead.get("name", "Unknown"),
            "stage_name": stage_name,
            "funnel_name": funnel.get("name") if funnel else "Unknown",
            "days_in_stage": round(days_in_stage, 1),
            "days_threshold": matching_rule["days_threshold"],
            "rule_name": matching_rule["name"],
            "assigned_to_name": reps_map.get(lead.get("assigned_to")),
        })

    # Sort by most overdue first
    overdue.sort(key=lambda x: x["days_in_stage"], reverse=True)
    return {"count": len(overdue), "leads": overdue}


@router.get("/leads/reach-outs")
async def get_reach_outs(
    request: Request,
    assigned_to: Optional[str] = None,
    follow_up_filter: Optional[str] = None,  # overdue | today | tomorrow | this_week | any
    created_filter: Optional[str] = None,     # today | this_week | this_month | any
    month_filter: Optional[str] = None,       # "YYYY-MM" e.g. "2026-01" — filters by created_at month
):
    """Return leads grouped into 3 action sections:

    - to_be_reached_out: active leads with NO contact logs yet (fresh leads)
    - follow_up:         active leads with at least 1 contact log (in progress)
    - closed:            leads with status == 'won' OR 'lost'

    Optional date filters (apply across all 3 groups):
      follow_up_filter — date bucket for `next_follow_up_date`:
        overdue (<today), today, tomorrow, this_week (today..today+7), any
      created_filter   — date bucket for `created_at`:
        today, this_week (last 7 days), this_month (calendar month), any

    Each lead returns full info (name, email, phone, created_at, last_contacted_at,
    next_follow_up_date, source, stage_name, funnel_name, assigned_to_name, status,
    won_plan_name, won_amount).

    Sales reps see only leads assigned to them. Admins see all; can filter by
    `?assigned_to=<rep_id>`.

    Sort:
      - to_be_reached_out:  oldest created first (most overdue to contact)
      - follow_up:          by next_follow_up_date ascending (overdue first),
                            then by last_contacted_at descending
      - closed:             most recently updated first
    """
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    # Build base query
    query = {}
    if not crm_user.get("is_admin"):
        query["assigned_to"] = crm_user.get("rep_id")
    elif assigned_to:
        query["assigned_to"] = assigned_to

    # Push the created_filter down to MongoDB (indexable on created_at)
    # so we don't load 5000 docs into memory just to filter most away.
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    week_end = today + timedelta(days=7)
    week_ago = today - timedelta(days=7)

    if created_filter and created_filter != "any":
        if created_filter == "today":
            start_iso = today.isoformat()
            end_iso = (today + timedelta(days=1)).isoformat()
            query["created_at"] = {"$gte": start_iso, "$lt": end_iso}
        elif created_filter == "this_week":
            query["created_at"] = {"$gte": week_ago.isoformat()}
        elif created_filter == "this_month":
            month_start = datetime(today.year, today.month, 1).date().isoformat()
            query["created_at"] = {"$gte": month_start}

    # Month-wise filter: "YYYY-MM" → show leads created in that specific calendar month
    if month_filter and month_filter != "any":
        try:
            parts = month_filter.split("-")
            y, m = int(parts[0]), int(parts[1])
            m_start = datetime(y, m, 1).date().isoformat()
            if m == 12:
                m_end = datetime(y + 1, 1, 1).date().isoformat()
            else:
                m_end = datetime(y, m + 1, 1).date().isoformat()
            # month_filter overrides created_filter if both are set
            query["created_at"] = {"$gte": m_start, "$lt": m_end}
        except Exception:
            pass  # ignore malformed month_filter

    # Project only the fields the UI actually needs (saves bandwidth + memory)
    projection = {
        "_id": 0,
        "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1,
        "source": 1, "funnel_id": 1, "stage_id": 1,
        "assigned_to": 1, "status": 1,
        "created_at": 1, "updated_at": 1, "last_contacted_at": 1,
        "next_follow_up_date": 1, "won_plan_name": 1, "won_amount": 1,
    }
    leads = await db.crm_leads.find(query, projection).to_list(5000)
    if not leads:
        return {
            "groups": {"to_be_reached_out": [], "follow_up": [], "closed": []},
            "totals": {"to_be_reached_out": 0, "follow_up": 0, "closed": 0},
        }

    def _parse_date(v):
        if not v:
            return None
        try:
            # next_follow_up_date is "YYYY-MM-DD"; created_at is full ISO
            return datetime.fromisoformat(str(v).replace("Z", "")).date()
        except Exception:
            return None

    # follow_up_filter still applied in-memory (next_follow_up_date is "YYYY-MM-DD")
    if follow_up_filter and follow_up_filter != "any":
        def keep_followup(l):
            d = _parse_date(l.get("next_follow_up_date"))
            if d is None:
                return False
            if follow_up_filter == "overdue":
                return d < today
            if follow_up_filter == "today":
                return d == today
            if follow_up_filter == "tomorrow":
                return d == tomorrow
            if follow_up_filter == "this_week":
                return today <= d <= week_end
            return True
        leads = [l for l in leads if keep_followup(l)]

    # Resolve rep + funnel info in bulk (parallel)
    import asyncio
    rep_ids = list({l.get("assigned_to") for l in leads if l.get("assigned_to")})

    async def _load_reps():
        if not rep_ids:
            return {}
        reps = await db.crm_sales_reps.find(
            {"id": {"$in": rep_ids}},
            {"_id": 0, "id": 1, "name": 1},
        ).to_list(500)
        return {r["id"]: r["name"] for r in reps}

    async def _load_funnels():
        funnels = await db.crm_funnels.find({}, {"_id": 0}).to_list(100)
        return {f["id"]: f for f in funnels}

    # Bulk-fetch the LEADS that have contact logs (so we can split fresh vs follow-up)
    lead_ids = [l["id"] for l in leads]

    async def _load_contacted():
        """Returns dict of lead_id -> {last_log_date, outcome, method} for leads with contact logs."""
        if not lead_ids:
            return {}
        # Get the LATEST contact log per lead (sorted by created_at desc, grouped)
        pipeline = [
            {"$match": {"lead_id": {"$in": lead_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$lead_id",
                "last_log_date": {"$first": "$created_at"},
                "outcome": {"$first": "$outcome"},
                "method": {"$first": "$method"},
                "reply": {"$first": "$reply"},
                "log_count": {"$sum": 1},
            }},
        ]
        results = await db.crm_contact_logs.aggregate(pipeline).to_list(10000)
        return {
            r["_id"]: {
                "last_log_date": r.get("last_log_date"),
                "outcome": r.get("outcome"),
                "method": r.get("method"),
                "reply": r.get("reply"),
                "log_count": r.get("log_count", 0),
            }
            for r in results
        }

    reps_map, funnel_map, contacted_map = await asyncio.gather(
        _load_reps(), _load_funnels(), _load_contacted()
    )

    def _enrich(lead):
        funnel = funnel_map.get(lead.get("funnel_id"))
        stage_name = "—"
        if funnel:
            for s in funnel.get("stages", []):
                if s["id"] == lead.get("stage_id"):
                    stage_name = s["name"]
                    break
        contact_info = contacted_map.get(lead["id"], {})
        return {
            "id": lead["id"],
            "name": lead.get("name", ""),
            "email": lead.get("email"),
            "phone": lead.get("phone"),
            "created_at": lead.get("created_at"),
            "last_contacted_at": lead.get("last_contacted_at"),
            "next_follow_up_date": lead.get("next_follow_up_date"),
            "source": lead.get("source"),
            "stage_id": lead.get("stage_id"),
            "stage_name": stage_name,
            "funnel_id": lead.get("funnel_id"),
            "funnel_name": (funnel or {}).get("name") or "—",
            "assigned_to": lead.get("assigned_to"),
            "assigned_to_name": reps_map.get(lead.get("assigned_to")),
            "status": lead.get("status", "active"),
            "won_plan_name": lead.get("won_plan_name"),
            "won_amount": lead.get("won_amount"),
            "company": lead.get("company"),
            "updated_at": lead.get("updated_at"),
            # Contact log info for UI display
            "last_call_outcome": contact_info.get("outcome"),
            "last_call_method": contact_info.get("method"),
            "last_call_date": contact_info.get("last_log_date"),
            "call_count": contact_info.get("log_count", 0),
        }

    to_be_reached, follow_up, closed = [], [], []
    for l in leads:
        enriched = _enrich(l)
        status = l.get("status", "active")
        if status in ("won", "lost"):
            closed.append(enriched)
        elif l["id"] in contacted_map:
            follow_up.append(enriched)
        else:
            to_be_reached.append(enriched)

    # Sort each group
    to_be_reached.sort(key=lambda x: x.get("created_at") or "")
    follow_up.sort(
        key=lambda x: (
            x.get("next_follow_up_date") or "9999-12-31",
            -(int(datetime.fromisoformat(x["last_contacted_at"].replace("Z", "")).timestamp())
              if x.get("last_contacted_at") else 0),
        )
    )
    closed.sort(key=lambda x: x.get("updated_at") or "", reverse=True)

    return {
        "groups": {
            "to_be_reached_out": to_be_reached,
            "follow_up": follow_up,
            "closed": closed,
        },
        "totals": {
            "to_be_reached_out": len(to_be_reached),
            "follow_up": len(follow_up),
            "closed": len(closed),
        },
    }


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    """Get a single lead with activity log"""
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Sales reps can only view their assigned leads
    if not crm_user.get("is_admin") and lead.get("assigned_to") != crm_user.get("rep_id"):
        raise HTTPException(status_code=403, detail="You can only view your assigned leads")

    # Get assigned rep name
    if lead.get("assigned_to"):
        rep = await db.crm_sales_reps.find_one({"id": lead["assigned_to"]}, {"_id": 0, "name": 1})
        lead["assigned_to_name"] = rep["name"] if rep else None

    # Get call logs
    call_logs = await db.crm_call_logs.find({"lead_id": lead_id}, {"_id": 0}).sort("called_at", -1).to_list(100)

    # Get activities
    activities = await db.crm_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Get funnel info
    funnel = None
    if lead.get("funnel_id"):
        funnel = await db.crm_funnels.find_one({"id": lead["funnel_id"]}, {"_id": 0})

    return {"lead": lead, "call_logs": call_logs, "activities": activities, "funnel": funnel}


@router.post("/leads")
async def create_lead(data: LeadCreate, request: Request):
    """Create a new lead"""
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    # If no funnel specified, try to auto-route via funnel.source_mappings.
    # Otherwise fall back to the default funnel.
    funnel_id = data.funnel_id
    stage_id = data.stage_id
    if not funnel_id:
        # Look for a funnel that maps this source -> stage
        if data.source:
            mapped = await db.crm_funnels.find_one(
                {"source_mappings.source": data.source},
                {"_id": 0},
            )
            if mapped:
                funnel_id = mapped["id"]
                if not stage_id:
                    # Find the stage_id from this funnel's mapping
                    for m in (mapped.get("source_mappings") or []):
                        if m.get("source") == data.source and m.get("stage_id"):
                            # Verify the stage still exists on this funnel
                            stage_ids = {s.get("id") for s in (mapped.get("stages") or [])}
                            if m["stage_id"] in stage_ids:
                                stage_id = m["stage_id"]
                                break
                    # Fallback to first stage if mapping pointed to a deleted stage
                    if not stage_id and mapped.get("stages"):
                        stage_id = mapped["stages"][0]["id"]
        # If still no funnel, use the default
        if not funnel_id:
            default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
            if default_funnel:
                funnel_id = default_funnel["id"]
                if not stage_id and default_funnel.get("stages"):
                    stage_id = default_funnel["stages"][0]["id"]

    lead = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "source": data.source,
        "source_details": data.source_details,
        "funnel_id": funnel_id,
        "stage_id": stage_id,
        "assigned_to": data.assigned_to,
        "tags": data.tags,
        "notes": data.notes,
        "company": data.company,
        "designation": data.designation,
        "custom_fields": data.custom_fields,
        "status": "active",
        "call_count": 0,
        "last_call_at": None,
        "last_contacted_at": None,
        "stage_changed_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    await db.crm_leads.insert_one(lead)
    lead.pop("_id", None)

    # Log activity
    await _log_activity(db, lead["id"], "lead_created", f"Lead created from source: {data.source}")

    # Update rep leads count
    if data.assigned_to:
        await db.crm_sales_reps.update_one({"id": data.assigned_to}, {"$inc": {"leads_count": 1}})

    return {"message": "Lead created", "lead": lead}


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: LeadUpdate, request: Request):
    """Update a lead"""
    user = await verify_crm_user(request)
    db = get_db(request)

    existing = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Sales reps can only update their assigned leads and cannot reassign
    # Use exclude_unset to detect fields explicitly provided (even if null),
    # so reps can't sneak in {"assigned_to": null} either.
    provided_fields = data.dict(exclude_unset=True)
    if not user.get("is_admin"):
        if existing.get("assigned_to") != user.get("rep_id"):
            raise HTTPException(status_code=403, detail="You can only update your assigned leads")
        if "assigned_to" in provided_fields:
            raise HTTPException(status_code=403, detail="Sales reps cannot reassign leads")

    # Use exclude_unset so admins can explicitly set fields to null
    # (e.g. assigned_to=null to unassign a lead).
    update_data = provided_fields
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")

    update_data["updated_at"] = datetime.utcnow().isoformat()

    # Track stage changes
    if "stage_id" in update_data and update_data["stage_id"] != existing.get("stage_id"):
        # Stamp when stage changed so the workflow follow-up engine can
        # detect leads stuck in a stage.
        update_data["stage_changed_at"] = datetime.utcnow().isoformat()
        # Get stage names
        funnel_id = update_data.get("funnel_id", existing.get("funnel_id"))
        funnel = await db.crm_funnels.find_one({"id": funnel_id}, {"_id": 0})
        if funnel:
            old_stage_name = "Unknown"
            new_stage_name = "Unknown"
            for s in funnel.get("stages", []):
                if s["id"] == existing.get("stage_id"):
                    old_stage_name = s["name"]
                if s["id"] == update_data["stage_id"]:
                    new_stage_name = s["name"]
            await _log_activity(
                db, lead_id, "stage_changed",
                f"Stage changed from '{old_stage_name}' to '{new_stage_name}'",
                performed_by=user.get("name", "Admin")
            )

    # Track assignment changes
    if "assigned_to" in update_data and update_data["assigned_to"] != existing.get("assigned_to"):
        new_rep_id = update_data["assigned_to"]
        if new_rep_id:
            rep = await db.crm_sales_reps.find_one({"id": new_rep_id}, {"_id": 0, "name": 1})
            rep_name = rep["name"] if rep else "Unknown"
            await _log_activity(
                db, lead_id, "assigned",
                f"Lead assigned to {rep_name}",
                performed_by=user.get("name", "Admin")
            )
        else:
            await _log_activity(
                db, lead_id, "unassigned",
                "Lead unassigned",
                performed_by=user.get("name", "Admin")
            )
        # Update counts: decrement old rep, increment new rep (only if not null)
        if existing.get("assigned_to"):
            await db.crm_sales_reps.update_one({"id": existing["assigned_to"]}, {"$inc": {"leads_count": -1}})
        if new_rep_id:
            await db.crm_sales_reps.update_one({"id": new_rep_id}, {"$inc": {"leads_count": 1}})

    # Track status changes
    if "status" in update_data and update_data["status"] != existing.get("status"):
        await _log_activity(
            db, lead_id, "status_changed",
            f"Status changed to '{update_data['status']}'",
            performed_by=user.get("name", "Admin")
        )

    await db.crm_leads.update_one({"id": lead_id}, {"$set": update_data})
    return {"message": "Lead updated"}


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    """Delete a lead"""
    await verify_admin_only(request)
    db = get_db(request)

    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.get("assigned_to"):
        await db.crm_sales_reps.update_one({"id": lead["assigned_to"]}, {"$inc": {"leads_count": -1}})

    await db.crm_leads.delete_one({"id": lead_id})
    await db.crm_call_logs.delete_many({"lead_id": lead_id})
    await db.crm_activities.delete_many({"lead_id": lead_id})
    return {"message": "Lead deleted"}


@router.post("/leads/bulk-assign")
async def bulk_assign_leads(data: BulkAssignRequest, request: Request):
    """Bulk assign leads to a sales rep (or unassign by passing
    sales_rep_id=null). Recalculates leads_count on affected reps so the
    Sales Team tab stays accurate.
    """
    user = await verify_admin_only(request)
    db = get_db(request)

    if not data.lead_ids:
        raise HTTPException(status_code=400, detail="No leads selected")

    new_rep_id = data.sales_rep_id
    new_rep_name = None
    if new_rep_id:
        rep = await db.crm_sales_reps.find_one({"id": new_rep_id}, {"_id": 0, "name": 1})
        if not rep:
            raise HTTPException(status_code=404, detail="Sales rep not found")
        new_rep_name = rep["name"]

    # Get the currently-assigned reps so we can decrement their counts
    existing_leads = await db.crm_leads.find(
        {"id": {"$in": data.lead_ids}},
        {"_id": 0, "id": 1, "assigned_to": 1},
    ).to_list(len(data.lead_ids))

    # Apply the bulk update
    result = await db.crm_leads.update_many(
        {"id": {"$in": data.lead_ids}},
        {"$set": {"assigned_to": new_rep_id, "updated_at": datetime.utcnow().isoformat()}}
    )

    # Recalculate leads_count for affected reps:
    # - decrement for each lead that had a prior rep (and the prior rep != new rep)
    # - increment for each lead that didn't have the new rep before
    decrement_counts = {}
    increment_count = 0
    for lead in existing_leads:
        prior = lead.get("assigned_to")
        if prior and prior != new_rep_id:
            decrement_counts[prior] = decrement_counts.get(prior, 0) + 1
        if new_rep_id and prior != new_rep_id:
            increment_count += 1

    # Apply decrements
    for rep_id, count in decrement_counts.items():
        await db.crm_sales_reps.update_one(
            {"id": rep_id},
            {"$inc": {"leads_count": -count}}
        )
    # Apply increment to new rep
    if new_rep_id and increment_count > 0:
        await db.crm_sales_reps.update_one(
            {"id": new_rep_id},
            {"$inc": {"leads_count": increment_count}}
        )

    # Log activity for each lead
    action_label = f"Lead assigned to {new_rep_name}" if new_rep_id else "Lead unassigned"
    action_type = "assigned" if new_rep_id else "unassigned"
    for lid in data.lead_ids:
        await _log_activity(
            db, lid, action_type,
            action_label,
            performed_by=user.get("name", "Admin")
        )

    if new_rep_id:
        return {"message": f"{result.modified_count} lead(s) assigned to {new_rep_name}", "modified": result.modified_count}
    return {"message": f"{result.modified_count} lead(s) unassigned", "modified": result.modified_count}


@router.post("/leads/bulk-update-funnel")
async def bulk_update_funnel(data: BulkFunnelUpdateRequest, request: Request):
    """Bulk move leads to a different funnel + stage. Mirrors the per-lead
    funnel/stage change logic in PUT /leads/{id} so workflow timers reset
    (stage_changed_at) and an activity row is logged per lead.
    If stage_id is omitted, defaults to the first stage in the funnel.
    """
    user = await verify_admin_only(request)
    db = get_db(request)

    if not data.lead_ids:
        raise HTTPException(status_code=400, detail="No leads selected")

    # Validate funnel + resolve target stage
    funnel = await db.crm_funnels.find_one({"id": data.funnel_id}, {"_id": 0})
    if not funnel:
        raise HTTPException(status_code=404, detail="Funnel not found")

    stages = funnel.get("stages", []) or []
    if not stages:
        raise HTTPException(status_code=400, detail="Funnel has no stages")

    target_stage_id = data.stage_id
    if target_stage_id:
        target_stage = next((s for s in stages if s.get("id") == target_stage_id), None)
        if not target_stage:
            raise HTTPException(status_code=400, detail="Stage does not belong to this funnel")
    else:
        target_stage = stages[0]
        target_stage_id = target_stage["id"]

    target_stage_name = target_stage.get("name", "Unknown")

    # Snapshot the existing funnel/stage for each lead so we can log meaningful
    # activity entries (e.g. "Moved from 'Lead Capture · New' to 'Sales · Qualified'").
    existing_leads = await db.crm_leads.find(
        {"id": {"$in": data.lead_ids}},
        {"_id": 0, "id": 1, "funnel_id": 1, "stage_id": 1},
    ).to_list(len(data.lead_ids))

    now_iso = datetime.utcnow().isoformat()
    result = await db.crm_leads.update_many(
        {"id": {"$in": data.lead_ids}},
        {"$set": {
            "funnel_id": data.funnel_id,
            "stage_id": target_stage_id,
            "stage_changed_at": now_iso,
            "updated_at": now_iso,
        }}
    )

    # Build a quick lookup so activity messages reference the OLD funnel/stage names
    other_funnel_ids = list({l.get("funnel_id") for l in existing_leads if l.get("funnel_id") and l.get("funnel_id") != data.funnel_id})
    funnels_lookup = {data.funnel_id: funnel}
    if other_funnel_ids:
        other_funnels = await db.crm_funnels.find({"id": {"$in": other_funnel_ids}}, {"_id": 0}).to_list(50)
        for f in other_funnels:
            funnels_lookup[f["id"]] = f

    def _stage_name(funnel_id, stage_id):
        f = funnels_lookup.get(funnel_id)
        if not f:
            return "Unknown"
        for s in (f.get("stages") or []):
            if s.get("id") == stage_id:
                return s.get("name") or "Unknown"
        return "Unknown"

    # Log per-lead activity entries (skip ones that were already in target stage)
    for lead in existing_leads:
        old_funnel_id = lead.get("funnel_id")
        old_stage_id = lead.get("stage_id")
        if old_funnel_id == data.funnel_id and old_stage_id == target_stage_id:
            continue  # no-op for this lead
        old_funnel_name = (funnels_lookup.get(old_funnel_id) or {}).get("name", "Unknown")
        old_stage_name = _stage_name(old_funnel_id, old_stage_id)
        await _log_activity(
            db, lead["id"], "stage_changed",
            f"Moved from '{old_funnel_name} · {old_stage_name}' to '{funnel.get('name', 'Unknown')} · {target_stage_name}'",
            performed_by=user.get("name", "Admin"),
        )

    return {
        "message": f"{result.modified_count} lead(s) moved to {funnel.get('name')} · {target_stage_name}",
        "modified": result.modified_count,
        "funnel_id": data.funnel_id,
        "stage_id": target_stage_id,
    }


@router.post("/leads/bulk-stage")
async def bulk_stage_leads(data: BulkStageRequest, request: Request):
    """Bulk move leads to a stage"""
    user = await verify_admin_only(request)
    db = get_db(request)

    result = await db.crm_leads.update_many(
        {"id": {"$in": data.lead_ids}},
        {"$set": {"funnel_id": data.funnel_id, "stage_id": data.stage_id, "updated_at": datetime.utcnow().isoformat()}}
    )

    return {"message": f"{result.modified_count} leads moved"}


# ============ CSV Import ============

def _map_call_status_to_outcome(call_status: str) -> str:
    """Map free-text call status from sheets to a valid contact log outcome."""
    if not call_status:
        return "reached"
    cs = call_status.lower().strip()
    if cs in ("reached", "connected", "answered", "spoke", "done", "completed"):
        return "reached"
    if cs in ("not reached", "not_reached", "no answer", "unanswered", "unreachable", "not reachable", "dnp"):
        return "not_reached"
    if cs in ("busy", "call back", "callback"):
        return "busy"
    if cs in ("voicemail", "vm"):
        return "voicemail"
    if cs in ("interested", "warm", "hot"):
        return "interested"
    if cs in ("not interested", "not_interested", "cold", "rejected"):
        return "not_interested"
    return "reached"  # default fallback



@router.post("/leads/import-csv")
async def import_leads_csv(request: Request, file: UploadFile = File(...)):
    """Import leads from CSV file (supports comma, tab, and semicolon delimiters)"""
    await verify_admin_only(request)
    db = get_db(request)

    fname = (file.filename or "").lower()
    if not (fname.endswith('.csv') or fname.endswith('.tsv') or fname.endswith('.txt')):
        raise HTTPException(status_code=400, detail="File must be a CSV, TSV, or TXT file")

    content = await file.read()
    # Strip UTF-8 BOM if present
    if content[:3] == b'\xef\xbb\xbf':
        content = content[3:]
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    # Auto-detect delimiter: check first line for tabs, semicolons, or commas
    first_line = text.split('\n')[0] if text else ''
    if '\t' in first_line:
        delimiter = '\t'
    elif ';' in first_line and ',' not in first_line:
        delimiter = ';'
    else:
        delimiter = ','

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    # Handle duplicate column headers — the Sign Up sheet has "Date", "Call Status",
    # "Lead Status", "Intent", "Remarks" appearing multiple times. csv.DictReader
    # overwrites duplicates, so we use csv.reader + manual header mapping instead.
    lines = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="CSV is empty")

    raw_headers = lines[0]
    # Make headers unique by appending _2, _3 etc. for duplicates
    seen = {}
    headers = []
    for h in raw_headers:
        h_clean = h.strip()
        h_lower = h_clean.lower()
        if h_lower in seen:
            seen[h_lower] += 1
            headers.append(f"{h_clean}_{seen[h_lower]}")
        else:
            seen[h_lower] = 1
            headers.append(h_clean)

    rows = []
    for line in lines[1:]:
        if not line or all(not cell.strip() for cell in line):
            continue
        row = {}
        for i, val in enumerate(line):
            if i < len(headers):
                row[headers[i]] = val
        rows.append(row)

    original_headers = [h.strip() for h in raw_headers]  # before dedup, for display

    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty")

    # Get default funnel
    default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
    funnel_id = default_funnel["id"] if default_funnel else None
    first_stage_id = default_funnel["stages"][0]["id"] if default_funnel and default_funnel.get("stages") else None

    imported = 0
    skipped = 0
    contacted_count = 0
    errors = []

    # Column mapping (flexible) — also checks partial matches for robustness
    def find_col(row, candidates):
        # Exact match first (case-insensitive)
        for c in candidates:
            for key in row:
                if key.strip().lower() == c.lower():
                    val = row[key]
                    return val.strip() if val else ""
        # Partial match fallback (column name contains the candidate)
        for c in candidates:
            for key in row:
                k = key.strip().lower()
                # Only match if the candidate is a substantial part (avoid false positives)
                if len(c) >= 4 and c.lower() in k and not k.endswith("_2") and not k.endswith("_3"):
                    val = row[key]
                    return val.strip() if val else ""
        return ""

    def parse_date_flexible(val):
        """Parse dates in various formats: ISO YYYY-MM-DD, DD/MM/YYYY,
        DD-MM-YYYY, DD Mon YYYY, etc. Tries ISO format first so we
        don't misread 2025-12-10 as Oct-12 (which dateutil does when
        `dayfirst=True` is set globally)."""
        if not val or not val.strip():
            return None
        val = val.strip()
        import re
        from dateutil import parser as dateparser
        # ISO YYYY-MM-DD or YYYY/MM/DD (year-first) — unambiguous, parse
        # WITHOUT dayfirst so the day/month aren't swapped.
        if re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}", val):
            try:
                parsed = dateparser.parse(val, dayfirst=False, yearfirst=True)
                return parsed.isoformat() if parsed else None
            except Exception:
                pass
        try:
            # Fallback: dayfirst=True is correct for Indian sheets that
            # use DD/MM/YYYY or DD-MM-YYYY.
            parsed = dateparser.parse(val, dayfirst=True)
            return parsed.isoformat() if parsed else None
        except Exception:
            return None

    for idx, row in enumerate(rows):
        try:
            name = find_col(row, ["name", "full name", "fullname", "contact name", "lead name"])
            email = find_col(row, ["email", "email address", "e-mail", "mail"])
            phone = find_col(row, ["phone", "phone number", "mobile", "contact", "tel", "telephone"])
            company = find_col(row, ["company", "organisation", "organization", "org", "firm"])
            designation = find_col(row, ["designation", "title", "role", "position", "job title"])
            source = find_col(row, ["source", "lead source"]) or "csv_import"
            notes = find_col(row, ["notes", "remarks", "comment", "comments"])

            # Additional columns from "Sign Up" sheet.
            # Many sheets use different column names for the most-recent
            # contact date — we accept any of these and treat them as
            # equivalent so the lead is correctly marked as "contacted".
            first_call_date_str = find_col(row, [
                "first call date", "first_call_date", "1st call date", "1st call",
                "first call", "call date", "first contact date",
            ])
            second_call_date_str = find_col(row, [
                "second call date", "second_call_date", "2nd call date", "2nd call", "second call",
            ])
            # Generic "last contacted" / "last contact" column — common
            # in sheets that already track outreach centrally. Previously
            # not parsed, so leads imported from such sheets showed up
            # as "Not contacted" in the Reach Outs UI.
            last_contacted_str = find_col(row, [
                "last contacted", "last_contacted", "last contacted at",
                "last contacted date", "last contact date", "last contact",
                "last contacted on", "last call date", "last call",
                "last reach out", "last reach-out", "last reachout",
                "last touch", "last touched", "last touched at",
                "last activity", "last activity date",
                "last outreach", "last outreach date",
            ])
            call_status = find_col(row, ["call status", "call_status"])
            lead_status_raw = find_col(row, ["final status", "final_status"]) or find_col(row, ["lead status", "lead_status"])
            poc = find_col(row, ["poc", "point of contact", "sales rep", "sales_rep", "assigned to"])
            plan_purchased = find_col(row, ["plan purchased", "plan_purchased", "plan"])
            amount_str = find_col(row, ["amount", "deal amount", "deal_amount"])
            ug_college = find_col(row, ["ug college", "ug_college", "ug college/university"])
            pg_college = find_col(row, ["pg college", "pg_college"])
            target_firms = find_col(row, ["target firms", "target_firms"])
            signup_date_str = find_col(row, [
                "sign-up date & time", "sign-up date", "signup date", "signup_date",
                "sign up date", "date of signup", "registration date"
            ])

            if not name and not email and not phone:
                skipped += 1
                continue

            # Parse first call date
            first_call_date = parse_date_flexible(first_call_date_str)
            second_call_date = parse_date_flexible(second_call_date_str)
            last_contacted_date = parse_date_flexible(last_contacted_str)
            signup_date = parse_date_flexible(signup_date_str)

            # The "effective" last-contacted timestamp on the lead is the
            # most recent of (last_contacted column, second call, first
            # call). Any of these being present means the lead has been
            # reached out to → it goes into "Follow Up" instead of
            # "To be reached out".
            effective_last_contacted = None
            for candidate in (last_contacted_date, second_call_date, first_call_date):
                if candidate and (not effective_last_contacted or candidate > effective_last_contacted):
                    effective_last_contacted = candidate

            # Determine lead status
            status = "active"
            won_plan_name = None
            won_amount = None
            if lead_status_raw:
                ls = lead_status_raw.lower().strip()
                if ls in ("won", "converted", "purchased", "paid"):
                    status = "won"
                    won_plan_name = plan_purchased or None
                    try:
                        won_amount = float(amount_str.replace(",", "").replace("₹", "").strip()) if amount_str else None
                    except (ValueError, AttributeError):
                        won_amount = None
                elif ls in ("lost", "dropped", "not interested", "closed", "dead"):
                    status = "lost"

            lead_id = str(uuid.uuid4())
            created_at = signup_date or datetime.utcnow().isoformat()

            # Exclude already-parsed columns from custom_fields
            known_cols = {
                "name", "full name", "email", "email address", "phone", "phone number",
                "mobile", "company", "organisation", "organization", "designation",
                "title", "role", "source", "lead source", "notes", "remarks",
                "first call date", "first_call_date", "1st call date", "1st call",
                "second call date", "second_call_date", "2nd call date",
                "last contacted", "last_contacted", "last contacted at",
                "last contacted date", "last contact date", "last contact",
                "last contacted on", "last call date", "last call",
                "last reach out", "last reach-out", "last reachout",
                "last touch", "last touched", "last touched at",
                "last activity", "last activity date",
                "last outreach", "last outreach date",
                "call status", "call_status", "lead status", "lead_status",
                "final status", "final_status", "poc", "point of contact",
                "sales rep", "sales_rep", "assigned to",
                "plan purchased", "plan_purchased", "plan",
                "amount", "deal amount", "deal_amount",
                "ug college", "ug_college", "ug college/university",
                "pg college", "pg_college", "target firms", "target_firms",
                "sign-up date & time", "sign-up date", "signup date", "signup_date",
                "sign up date", "date of signup", "registration date",
                "first call", "second call", "first contact date",
                "comment", "comments",
            }

            lead = {
                "id": lead_id,
                "name": name or "Unknown",
                "email": email or None,
                "phone": phone or None,
                "source": "csv_import",
                "source_details": source if source != "csv_import" else file.filename,
                "funnel_id": funnel_id,
                "stage_id": first_stage_id,
                "assigned_to": None,
                "tags": ["csv-import"],
                "notes": notes or None,
                "company": company or target_firms or None,
                "designation": designation or None,
                "custom_fields": {k.strip(): v.strip() for k, v in row.items() if v and k.strip().lower() not in known_cols},
                "status": status,
                "won_plan_name": won_plan_name,
                "won_amount": won_amount,
                "call_count": 0,
                "last_call_at": None,
                "last_contacted_at": effective_last_contacted,
                "created_at": created_at,
                "updated_at": datetime.utcnow().isoformat(),
                "stage_changed_at": created_at,
            }

            # Store extra profile info in custom_fields
            if ug_college and "ug_college" not in (lead.get("custom_fields") or {}):
                lead.setdefault("custom_fields", {})["UG College"] = ug_college
            if pg_college and "pg_college" not in (lead.get("custom_fields") or {}):
                lead.setdefault("custom_fields", {})["PG College"] = pg_college

            await db.crm_leads.insert_one(lead)

            # If first call date exists, create a contact log so lead appears in "Follow up"
            if first_call_date:
                contact_log = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead_id,
                    "lead_name": name or "Unknown",
                    "method": "call",
                    "outcome": _map_call_status_to_outcome(call_status),
                    "reply": f"Imported from sheet. Call status: {call_status}" if call_status else "Imported from sheet (first call)",
                    "next_follow_up_date": None,
                    "performed_by_id": "csv_import",
                    "performed_by_name": poc or "CSV Import",
                    "created_at": first_call_date,
                }
                await db.crm_contact_logs.insert_one(contact_log)
                contacted_count += 1

            # If second call date exists, create another contact log
            if second_call_date:
                contact_log2 = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead_id,
                    "lead_name": name or "Unknown",
                    "method": "call",
                    "outcome": _map_call_status_to_outcome(call_status),
                    "reply": f"Imported from sheet (second call). Call status: {call_status}" if call_status else "Imported from sheet (second call)",
                    "next_follow_up_date": None,
                    "performed_by_id": "csv_import",
                    "performed_by_name": poc or "CSV Import",
                    "created_at": second_call_date,
                }
                await db.crm_contact_logs.insert_one(contact_log2)
                # Update last_contacted_at to the most recent call
                await db.crm_leads.update_one(
                    {"id": lead_id},
                    {"$set": {"last_contacted_at": second_call_date}}
                )

            # If a generic "Last Contacted" column was supplied (and we
            # did NOT already log it via first/second call), create a
            # contact log so the lead lands in "Follow Up" instead of
            # "To be reached out". Without this, sheets that only have
            # a "Last Contacted" column produce leads with
            # `last_contacted_at` set but NO contact log → reach-outs
            # endpoint puts them back in the "Not contacted" bucket.
            if last_contacted_date and not first_call_date and not second_call_date:
                contact_log_lc = {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead_id,
                    "lead_name": name or "Unknown",
                    "method": "call",
                    "outcome": _map_call_status_to_outcome(call_status),
                    "reply": (
                        f"Imported from sheet (last contacted). Call status: {call_status}"
                        if call_status else "Imported from sheet (last contacted)"
                    ),
                    "next_follow_up_date": None,
                    "performed_by_id": "csv_import",
                    "performed_by_name": poc or "CSV Import",
                    "created_at": last_contacted_date,
                }
                await db.crm_contact_logs.insert_one(contact_log_lc)
                contacted_count += 1

            imported += 1
        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")
            skipped += 1

    return {
        "message": f"Import complete: {imported} imported, {skipped} skipped, {contacted_count} marked as contacted",
        "imported": imported,
        "skipped": skipped,
        "contacted": contacted_count,
        "errors": errors[:10],
        "columns_found": original_headers if original_headers else (list(rows[0].keys()) if rows else [])
    }


# ============ Call Logs ============

@router.get("/call-logs")
async def get_call_logs(
    request: Request,
    lead_id: Optional[str] = None,
    sales_rep_id: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get call logs with filtering"""
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    query = {}
    # Sales reps only see their own call logs
    if not crm_user.get("is_admin"):
        query["sales_rep_id"] = crm_user.get("rep_id")
    if lead_id:
        query["lead_id"] = lead_id
    if sales_rep_id:
        query["sales_rep_id"] = sales_rep_id
    if outcome:
        query["outcome"] = outcome

    total = await db.crm_call_logs.count_documents(query)
    logs = await db.crm_call_logs.find(query, {"_id": 0}).sort("called_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enrich with names
    lead_ids = list(set(l.get("lead_id") for l in logs))
    rep_ids = list(set(l.get("sales_rep_id") for l in logs))

    leads_map = {}
    if lead_ids:
        leads = await db.crm_leads.find({"id": {"$in": lead_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        leads_map = {l["id"]: l["name"] for l in leads}

    reps_map = {}
    if rep_ids:
        reps = await db.crm_sales_reps.find({"id": {"$in": rep_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        reps_map = {r["id"]: r["name"] for r in reps}

    for log in logs:
        log["lead_name"] = leads_map.get(log.get("lead_id"), "Unknown")
        log["sales_rep_name"] = reps_map.get(log.get("sales_rep_id"), "Unknown")

    return {"call_logs": logs, "total": total}


@router.post("/call-logs")
async def create_call_log(data: CallLogCreate, request: Request):
    """Log a call"""
    user = await verify_crm_user(request)
    db = get_db(request)

    log = {
        "id": str(uuid.uuid4()),
        "lead_id": data.lead_id,
        "sales_rep_id": data.sales_rep_id,
        "call_type": data.call_type,
        "outcome": data.outcome,
        "duration_seconds": data.duration_seconds,
        "notes": data.notes,
        "called_at": data.called_at or datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    await db.crm_call_logs.insert_one(log)
    log.pop("_id", None)

    # Update lead's call count and last call
    await db.crm_leads.update_one(
        {"id": data.lead_id},
        {
            "$inc": {"call_count": 1},
            "$set": {
                "last_call_at": log["called_at"],
                "last_contacted_at": log["called_at"],
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )

    # Get rep name for activity log
    rep = await db.crm_sales_reps.find_one({"id": data.sales_rep_id}, {"_id": 0, "name": 1})
    rep_name = rep["name"] if rep else "Unknown"

    outcome_display = data.outcome.replace("_", " ").title()
    await _log_activity(
        db, data.lead_id, "call_logged",
        f"Call by {rep_name} - Outcome: {outcome_display}",
        performed_by=rep_name
    )

    return {"message": "Call logged", "call_log": log}


# ============ Notes ============

@router.post("/leads/{lead_id}/notes")
async def add_note(lead_id: str, data: LeadNoteCreate, request: Request):
    """Add a note to a lead"""
    user = await verify_crm_user(request)
    db = get_db(request)

    lead = await db.crm_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    await _log_activity(
        db, lead_id, "note_added",
        data.note,
        performed_by=user.get("name", "Admin")
    )
    return {"message": "Note added"}


# ============ Dashboard Metrics ============

@router.get("/dashboard")
async def get_dashboard_metrics(request: Request, period: str = "30d"):
    """Get CRM dashboard metrics"""
    crm_user = await verify_crm_user(request)
    db = get_db(request)
    is_admin = crm_user.get("is_admin", False)
    rep_id = crm_user.get("rep_id")

    # Parse period
    days = 30
    if period == "7d":
        days = 7
    elif period == "30d":
        days = 30
    elif period == "90d":
        days = 90
    elif period == "all":
        days = 3650

    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Base filter for sales rep (only their leads/calls)
    lead_filter = {"assigned_to": rep_id} if not is_admin else {}
    call_filter = {"sales_rep_id": rep_id} if not is_admin else {}

    # Total leads
    total_leads = await db.crm_leads.count_documents(lead_filter)
    active_leads = await db.crm_leads.count_documents({**lead_filter, "status": "active"})
    won_leads = await db.crm_leads.count_documents({**lead_filter, "status": "won"})
    lost_leads = await db.crm_leads.count_documents({**lead_filter, "status": "lost"})

    # Leads in period
    period_leads = await db.crm_leads.count_documents({**lead_filter, "created_at": {"$gte": cutoff}})

    # Conversion rate
    conversion_rate = round((won_leads / max(total_leads, 1)) * 100, 1)

    # Call metrics
    total_calls = await db.crm_call_logs.count_documents({**call_filter, "called_at": {"$gte": cutoff}})
    picked_up_calls = await db.crm_call_logs.count_documents({
        **call_filter,
        "called_at": {"$gte": cutoff},
        "outcome": "picked_up"
    })
    no_answer_calls = await db.crm_call_logs.count_documents({
        **call_filter,
        "called_at": {"$gte": cutoff},
        "outcome": "no_answer"
    })

    pickup_rate = round((picked_up_calls / max(total_calls, 1)) * 100, 1)

    # Leads that have been called at least once
    leads_with_calls = await db.crm_leads.count_documents({**lead_filter, "call_count": {"$gt": 0}})
    call_rate = round((leads_with_calls / max(total_leads, 1)) * 100, 1)

    # Leads by source
    pipeline_source = [
        {"$match": lead_filter} if lead_filter else {"$match": {}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    source_agg = await db.crm_leads.aggregate(pipeline_source).to_list(50)
    leads_by_source = {item["_id"]: item["count"] for item in source_agg if item["_id"]}

    # Leads by stage (for default funnel)
    default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
    leads_by_stage = {}
    if default_funnel:
        for stage in default_funnel.get("stages", []):
            count = await db.crm_leads.count_documents({
                **lead_filter,
                "funnel_id": default_funnel["id"],
                "stage_id": stage["id"]
            })
            leads_by_stage[stage["name"]] = count

    # Rep performance (admin sees all reps, sales rep sees only themselves)
    if is_admin:
        reps = await db.crm_sales_reps.find({"is_active": True}, {"_id": 0}).to_list(50)
    else:
        reps = await db.crm_sales_reps.find({"id": rep_id, "is_active": True}, {"_id": 0}).to_list(1)
    rep_performance = []
    for rep in reps:
        rep_leads = await db.crm_leads.count_documents({"assigned_to": rep["id"]})
        rep_won = await db.crm_leads.count_documents({"assigned_to": rep["id"], "status": "won"})
        rep_calls = await db.crm_call_logs.count_documents({
            "sales_rep_id": rep["id"],
            "called_at": {"$gte": cutoff}
        })
        rep_pickups = await db.crm_call_logs.count_documents({
            "sales_rep_id": rep["id"],
            "called_at": {"$gte": cutoff},
            "outcome": "picked_up"
        })
        rep_performance.append({
            "id": rep["id"],
            "name": rep["name"],
            "leads": rep_leads,
            "won": rep_won,
            "calls": rep_calls,
            "pickups": rep_pickups,
            "conversion_rate": round((rep_won / max(rep_leads, 1)) * 100, 1),
            "pickup_rate": round((rep_pickups / max(rep_calls, 1)) * 100, 1)
        })

    # Daily lead trend (last N days, max 30 points)
    trend_days = min(days, 30)
    daily_trend = []
    for i in range(trend_days - 1, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        count = await db.crm_leads.count_documents({
            **lead_filter,
            "created_at": {"$gte": day_start, "$lte": day_end}
        })
        calls = await db.crm_call_logs.count_documents({
            **call_filter,
            "called_at": {"$gte": day_start, "$lte": day_end}
        })
        daily_trend.append({
            "date": day.strftime("%b %d"),
            "leads": count,
            "calls": calls
        })

    # Call outcome distribution
    pipeline_outcomes = [
        {"$match": {**call_filter, "called_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$outcome", "count": {"$sum": 1}}}
    ]
    outcome_agg = await db.crm_call_logs.aggregate(pipeline_outcomes).to_list(50)
    call_outcomes = {item["_id"]: item["count"] for item in outcome_agg if item["_id"]}

    return {
        "total_leads": total_leads,
        "active_leads": active_leads,
        "won_leads": won_leads,
        "lost_leads": lost_leads,
        "period_leads": period_leads,
        "conversion_rate": conversion_rate,
        "total_calls": total_calls,
        "picked_up_calls": picked_up_calls,
        "no_answer_calls": no_answer_calls,
        "pickup_rate": pickup_rate,
        "call_rate": call_rate,
        "leads_by_source": leads_by_source,
        "leads_by_stage": leads_by_stage,
        "rep_performance": rep_performance,
        "daily_trend": daily_trend,
        "call_outcomes": call_outcomes
    }


# ============ Sync Existing Data ============

def _safe_isoformat(val):
    """Safely convert any datetime-like value to ISO string"""
    if val is None:
        return datetime.utcnow().isoformat()
    try:
        if isinstance(val, datetime):
            return val.isoformat()
        # Handle string datetimes
        s = str(val)
        if s:
            return s
        return datetime.utcnow().isoformat()
    except Exception:
        return datetime.utcnow().isoformat()


def _safe_dict(val):
    """Safely convert answers/custom_fields to a JSON-safe dict"""
    if not val or not isinstance(val, dict):
        return {}
    safe = {}
    for k, v in val.items():
        try:
            key = str(k)
            if isinstance(v, datetime):
                safe[key] = v.isoformat()
            elif isinstance(v, (str, int, float, bool)):
                safe[key] = v
            elif isinstance(v, list):
                safe[key] = [str(i) for i in v]
            elif v is None:
                safe[key] = None
            else:
                safe[key] = str(v)
        except Exception:
            safe[str(k)] = str(v) if v else ""
    return safe


@router.post("/sync/discovery-calls")
async def sync_discovery_calls(request: Request):
    """Import existing discovery call bookings as CRM leads"""
    await verify_admin_only(request)
    db = get_db(request)

    # Ensure default funnel exists
    default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
    if not default_funnel:
        # Trigger funnel creation by calling get_funnels logic
        default_funnel = {
            "id": str(uuid.uuid4()),
            "name": "Default Sales Funnel",
            "is_default": True,
            "stages": [
                {"id": str(uuid.uuid4()), "name": "New", "color": "#6B7280", "order": 0},
                {"id": str(uuid.uuid4()), "name": "Contacted", "color": "#3B82F6", "order": 1},
                {"id": str(uuid.uuid4()), "name": "Call Scheduled", "color": "#8B5CF6", "order": 2},
                {"id": str(uuid.uuid4()), "name": "Call Done", "color": "#F59E0B", "order": 3},
                {"id": str(uuid.uuid4()), "name": "Qualified", "color": "#10B981", "order": 4},
                {"id": str(uuid.uuid4()), "name": "Proposal Sent", "color": "#EC4899", "order": 5},
                {"id": str(uuid.uuid4()), "name": "Negotiation", "color": "#F97316", "order": 6},
                {"id": str(uuid.uuid4()), "name": "Won", "color": "#22C55E", "order": 7},
                {"id": str(uuid.uuid4()), "name": "Lost", "color": "#EF4444", "order": 8},
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.crm_funnels.insert_one(default_funnel)
        default_funnel.pop("_id", None)

    funnel_id = default_funnel["id"]
    first_stage_id = default_funnel["stages"][0]["id"] if default_funnel.get("stages") else None

    imported = 0
    skipped = 0
    errors = []

    # --- Sync from discovery_call_bookings ---
    try:
        bookings_cursor = db.discovery_call_bookings.find({})
        bookings = await bookings_cursor.to_list(10000)
    except Exception as e:
        logger.error(f"Failed to fetch discovery_call_bookings: {e}")
        bookings = []

    for b in bookings:
        try:
            b.pop("_id", None)
            email = str(b.get("email", "")).strip() if b.get("email") else ""
            name = str(b.get("name", "")).strip() if b.get("name") else "Unknown"
            phone = str(b.get("phone", "")).strip() if b.get("phone") else None

            if not email and not phone and name == "Unknown":
                skipped += 1
                continue

            # Check for duplicate
            if email:
                existing = await db.crm_leads.find_one({"email": email, "source": "discovery_call"})
                if existing:
                    skipped += 1
                    continue

            source_detail = str(b.get("source", "coaching"))
            cohort_name = b.get("cohort_name") or b.get("cohort_slug")
            if cohort_name:
                source_detail = f"Cohort: {cohort_name}"

            lead = {
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email or None,
                "phone": phone,
                "source": "discovery_call",
                "source_details": source_detail,
                "funnel_id": funnel_id,
                "stage_id": first_stage_id,
                "assigned_to": None,
                "tags": ["discovery-call"],
                "notes": None,
                "company": None,
                "designation": None,
                "custom_fields": _safe_dict(b.get("answers")),
                "status": "active",
                "call_count": 0,
                "last_call_at": None,
                "last_contacted_at": None,
                "created_at": _safe_isoformat(b.get("created_at")),
                "updated_at": datetime.utcnow().isoformat()
            }
            await db.crm_leads.insert_one(lead)
            imported += 1
        except Exception as e:
            errors.append(f"Booking: {str(e)[:100]}")
            skipped += 1

    # --- Sync from cohort_discovery_calls ---
    try:
        cohort_cursor = db.cohort_discovery_calls.find({})
        cohort_calls = await cohort_cursor.to_list(10000)
    except Exception as e:
        logger.error(f"Failed to fetch cohort_discovery_calls: {e}")
        cohort_calls = []

    for c in cohort_calls:
        try:
            c.pop("_id", None)
            email = str(c.get("email", "")).strip() if c.get("email") else ""
            name = str(c.get("name", "")).strip() if c.get("name") else "Unknown"
            phone = str(c.get("phone", "")).strip() if c.get("phone") else None

            if not email and not phone and name == "Unknown":
                skipped += 1
                continue

            if email:
                existing = await db.crm_leads.find_one({"email": email, "source": "discovery_call"})
                if existing:
                    skipped += 1
                    continue

            cohort_name = c.get("cohort_name") or c.get("cohort_slug") or "Cohort"
            source_detail = f"Cohort: {cohort_name}"

            answers = {
                "Cohort": cohort_name,
                "Preferred time": str(c.get("preferred_time", "—")),
                "Message": str(c.get("message", "—")),
            }

            lead = {
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email or None,
                "phone": phone,
                "source": "discovery_call",
                "source_details": source_detail,
                "funnel_id": funnel_id,
                "stage_id": first_stage_id,
                "assigned_to": None,
                "tags": ["discovery-call", "cohort"],
                "notes": None,
                "company": None,
                "designation": None,
                "custom_fields": answers,
                "status": "active",
                "call_count": 0,
                "last_call_at": None,
                "last_contacted_at": None,
                "created_at": _safe_isoformat(c.get("requested_at") or c.get("created_at")),
                "updated_at": datetime.utcnow().isoformat()
            }
            await db.crm_leads.insert_one(lead)
            imported += 1
        except Exception as e:
            errors.append(f"Cohort: {str(e)[:100]}")
            skipped += 1

    return {
        "message": f"Synced: {imported} imported, {skipped} skipped",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10] if errors else []
    }


@router.post("/sync/free-signups")
async def sync_free_signups(request: Request):
    """Import free trial users as CRM leads"""
    await verify_admin_only(request)
    db = get_db(request)

    # Ensure default funnel exists
    default_funnel = await db.crm_funnels.find_one({"is_default": True}, {"_id": 0})
    if not default_funnel:
        default_funnel = {
            "id": str(uuid.uuid4()),
            "name": "Default Sales Funnel",
            "is_default": True,
            "stages": [
                {"id": str(uuid.uuid4()), "name": "New", "color": "#6B7280", "order": 0},
                {"id": str(uuid.uuid4()), "name": "Contacted", "color": "#3B82F6", "order": 1},
                {"id": str(uuid.uuid4()), "name": "Call Scheduled", "color": "#8B5CF6", "order": 2},
                {"id": str(uuid.uuid4()), "name": "Call Done", "color": "#F59E0B", "order": 3},
                {"id": str(uuid.uuid4()), "name": "Qualified", "color": "#10B981", "order": 4},
                {"id": str(uuid.uuid4()), "name": "Proposal Sent", "color": "#EC4899", "order": 5},
                {"id": str(uuid.uuid4()), "name": "Negotiation", "color": "#F97316", "order": 6},
                {"id": str(uuid.uuid4()), "name": "Won", "color": "#22C55E", "order": 7},
                {"id": str(uuid.uuid4()), "name": "Lost", "color": "#EF4444", "order": 8},
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.crm_funnels.insert_one(default_funnel)
        default_funnel.pop("_id", None)

    funnel_id = default_funnel["id"]
    first_stage_id = default_funnel["stages"][0]["id"] if default_funnel.get("stages") else None

    # Broader filter: free trial users + users without a paid plan
    try:
        users = await db.users.find(
            {"$or": [
                {"plan": {"$in": ["free_trial", "Free Trial", "free", ""]}},
                {"plan": {"$exists": False}},
                {"plan": None},
            ]}
        ).to_list(20000)
    except Exception as e:
        logger.error(f"Failed to fetch users: {e}")
        return {"message": f"Error fetching users: {str(e)}", "imported": 0, "skipped": 0, "errors": [str(e)]}

    imported = 0
    skipped = 0
    errors = []

    for u in users:
        try:
            u.pop("_id", None)
            email = str(u.get("email", "")).strip() if u.get("email") else ""
            name = str(u.get("name", "")).strip() if u.get("name") else "Unknown"
            phone = str(u.get("phone_number") or u.get("phone", "")).strip() or None

            if not email:
                skipped += 1
                continue

            # Check for duplicate (any source, not just free_signup)
            existing = await db.crm_leads.find_one({"email": email})
            if existing:
                skipped += 1
                continue

            lead = {
                "id": str(uuid.uuid4()),
                "name": name,
                "email": email,
                "phone": phone,
                "source": "free_signup",
                "source_details": "Free Trial Signup",
                "funnel_id": funnel_id,
                "stage_id": first_stage_id,
                "assigned_to": None,
                "tags": ["free-signup"],
                "notes": None,
                "company": None,
                "designation": None,
                "custom_fields": {},
                "status": "active",
                "call_count": 0,
                "last_call_at": None,
                "last_contacted_at": None,
                "created_at": _safe_isoformat(u.get("created_at")),
                "updated_at": datetime.utcnow().isoformat()
            }
            await db.crm_leads.insert_one(lead)
            imported += 1
        except Exception as e:
            errors.append(f"User {u.get('email', '?')}: {str(e)[:100]}")
            skipped += 1

    return {
        "message": f"Synced: {imported} imported, {skipped} skipped",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10] if errors else []
    }


# ============ Activity Logger ============

async def _log_activity(db, lead_id: str, activity_type: str, details: str, performed_by: str = "System"):
    """Log an activity for a lead"""
    activity = {
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "activity_type": activity_type,
        "details": details,
        "performed_by": performed_by,
        "created_at": datetime.utcnow().isoformat()
    }
    await db.crm_activities.insert_one(activity)



# ============ Plans (for Won lead plan selector) ============

@router.get("/plans")
async def get_plans_for_crm(request: Request):
    """Lightweight plans list for the CRM Won-lead plan picker.
    Returns plan_key, name, category, pricing — no admin auth needed beyond CRM auth."""
    await verify_crm_user(request)
    db = get_db(request)
    plans = await db.plans.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "plan_key": 1, "name": 1, "category": 1, "pricing": 1, "order": 1}
    ).sort("order", 1).to_list(200)
    return {"plans": plans}


# ============ Workflow Rules (per-stage follow-up cadence) ============

class WorkflowRuleCreate(BaseModel):
    name: str                       # human label, e.g. "Follow up after Discovery"
    funnel_id: str
    stage_id: str
    days_threshold: int = 3         # alert if lead is in stage > X days
    description: Optional[str] = None


class WorkflowRuleUpdate(BaseModel):
    name: Optional[str] = None
    funnel_id: Optional[str] = None
    stage_id: Optional[str] = None
    days_threshold: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/workflow-rules")
async def list_workflow_rules(request: Request):
    """List all workflow follow-up rules."""
    await verify_crm_user(request)
    db = get_db(request)
    rules = await db.crm_workflow_rules.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"rules": rules}


@router.post("/workflow-rules")
async def create_workflow_rule(data: WorkflowRuleCreate, request: Request):
    """Create a workflow rule. Admin-only."""
    await verify_admin_only(request)
    db = get_db(request)
    # Validate funnel + stage exist
    funnel = await db.crm_funnels.find_one({"id": data.funnel_id}, {"_id": 0, "stages": 1})
    if not funnel:
        raise HTTPException(status_code=404, detail="Funnel not found")
    stage_ids = [s.get("id") for s in funnel.get("stages", [])]
    if data.stage_id not in stage_ids:
        raise HTTPException(status_code=400, detail="Stage does not belong to the chosen funnel")
    if data.days_threshold < 1:
        raise HTTPException(status_code=400, detail="days_threshold must be at least 1")
    rule = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "funnel_id": data.funnel_id,
        "stage_id": data.stage_id,
        "days_threshold": data.days_threshold,
        "description": data.description,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    await db.crm_workflow_rules.insert_one(rule)
    rule.pop("_id", None)
    return {"message": "Workflow rule created", "rule": rule}


@router.put("/workflow-rules/{rule_id}")
async def update_workflow_rule(rule_id: str, data: WorkflowRuleUpdate, request: Request):
    """Update a workflow rule. Admin-only."""
    await verify_admin_only(request)
    db = get_db(request)
    existing = await db.crm_workflow_rules.find_one({"id": rule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Workflow rule not found")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    # If funnel/stage changed, validate
    new_funnel_id = update_data.get("funnel_id", existing.get("funnel_id"))
    new_stage_id = update_data.get("stage_id", existing.get("stage_id"))
    if "funnel_id" in update_data or "stage_id" in update_data:
        funnel = await db.crm_funnels.find_one({"id": new_funnel_id}, {"_id": 0, "stages": 1})
        if not funnel:
            raise HTTPException(status_code=404, detail="Funnel not found")
        stage_ids = [s.get("id") for s in funnel.get("stages", [])]
        if new_stage_id not in stage_ids:
            raise HTTPException(status_code=400, detail="Stage does not belong to the chosen funnel")
    if "days_threshold" in update_data and update_data["days_threshold"] < 1:
        raise HTTPException(status_code=400, detail="days_threshold must be at least 1")
    update_data["updated_at"] = datetime.utcnow().isoformat()
    await db.crm_workflow_rules.update_one({"id": rule_id}, {"$set": update_data})
    return {"message": "Workflow rule updated"}


@router.delete("/workflow-rules/{rule_id}")
async def delete_workflow_rule(rule_id: str, request: Request):
    """Delete a workflow rule. Admin-only."""
    await verify_admin_only(request)
    db = get_db(request)
    result = await db.crm_workflow_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow rule not found")
    return {"message": "Workflow rule deleted"}


# ============ Overdue leads (driven by workflow rules) ============
# NOTE: The actual endpoint is defined above (before /leads/{lead_id})
# to ensure FastAPI route matching picks it up correctly.


# ============ Contact Logs (quick "I reached out" log) ============

class ContactLogCreate(BaseModel):
    lead_id: str
    method: str             # call, whatsapp, email, in_person
    outcome: str            # reached, not_reached, busy, voicemail, interested, not_interested
    reply: Optional[str] = None
    next_follow_up_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


@router.post("/contact-logs")
async def create_contact_log(data: ContactLogCreate, request: Request):
    """Create a contact log entry for a lead.

    Stamps `last_contacted_at` on the lead so the Reach Outs page can
    visually show when a lead was last touched.
    """
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    valid_methods = {"call", "whatsapp", "email", "in_person"}
    valid_outcomes = {"reached", "not_reached", "busy", "voicemail", "interested", "not_interested"}
    if data.method not in valid_methods:
        raise HTTPException(status_code=400, detail=f"method must be one of {sorted(valid_methods)}")
    if data.outcome not in valid_outcomes:
        raise HTTPException(status_code=400, detail=f"outcome must be one of {sorted(valid_outcomes)}")

    lead = await db.crm_leads.find_one({"id": data.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Sales reps can only log contacts for leads assigned to them
    if not crm_user.get("is_admin") and lead.get("assigned_to") != crm_user.get("rep_id"):
        raise HTTPException(status_code=403, detail="You can only log contacts for leads assigned to you")

    log = {
        "id": str(uuid.uuid4()),
        "lead_id": data.lead_id,
        "lead_name": lead.get("name"),
        "method": data.method,
        "outcome": data.outcome,
        "reply": data.reply,
        "next_follow_up_date": data.next_follow_up_date,
        "performed_by_id": crm_user.get("rep_id") or crm_user.get("user_id"),
        "performed_by_name": crm_user.get("name") or "Unknown",
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.crm_contact_logs.insert_one(log)
    log.pop("_id", None)

    # Update lead's last_contacted_at + optionally next_follow_up_date
    update_fields = {
        "last_contacted_at": log["created_at"],
        "updated_at": log["created_at"],
    }
    if data.next_follow_up_date:
        update_fields["next_follow_up_date"] = data.next_follow_up_date
    await db.crm_leads.update_one({"id": data.lead_id}, {"$set": update_fields})

    # Log to activity timeline
    summary_parts = [f"Contact logged: {data.method.replace('_', ' ')} -> {data.outcome.replace('_', ' ')}"]
    if data.reply:
        summary_parts.append(f"Reply: {data.reply[:120]}")
    await _log_activity(db, data.lead_id, "contact_logged", " - ".join(summary_parts), crm_user.get("name"))

    return {"message": "Contact logged", "log": log}


@router.get("/contact-logs")
async def list_contact_logs(request: Request, lead_id: Optional[str] = None, limit: int = 100):
    """List contact logs. If lead_id provided, scoped to that lead.
    Sales reps see only logs for their assigned leads."""
    crm_user = await verify_crm_user(request)
    db = get_db(request)

    query = {}
    if lead_id:
        query["lead_id"] = lead_id

    if not crm_user.get("is_admin"):
        my_lead_ids = await db.crm_leads.find(
            {"assigned_to": crm_user.get("rep_id")},
            {"_id": 0, "id": 1},
        ).to_list(5000)
        allowed_ids = [l["id"] for l in my_lead_ids]
        if lead_id and lead_id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Not allowed")
        if not lead_id:
            query["lead_id"] = {"$in": allowed_ids}

    logs = await db.crm_contact_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"logs": logs, "total": len(logs)}

