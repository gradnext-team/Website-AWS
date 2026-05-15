"""
Unified Authentication System for gradnext
Supports:
- Email + Password login with OTP verification for signup/reset
- Direct Google OAuth (no third-party branding)
- Gmail OAuth for sending OTP emails
- Role-based access (Admin, Mentor, Candidate)
"""

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorDatabase
import httpx
import os
import random
import string
from datetime import datetime, timezone, timedelta
import jwt
import uuid
import hashlib
import base64
from email.mime.text import MIMEText
import logging

# Import Meta Pixel tracking service
from services import meta_pixel_service

# Import Mixpanel tracking service
from services import mixpanel_service

# Setup logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Configuration
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7
OTP_EXPIRATION_MINUTES = 10

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL") or os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "")

def get_frontend_url(request: Request) -> str:
    """Get frontend URL dynamically from request origin or fall back to env variable."""
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    
    # List of domains that should NOT be used as frontend URL
    # These are third-party OAuth providers that might appear in referer
    blocked_domains = [
        "accounts.google.com",
        "google.com",
        "googleapis.com",
        "facebook.com",
        "apple.com",
        "microsoft.com",
        "login.microsoftonline.com"
    ]
    
    # Try to get origin from headers (but not from OAuth providers)
    if origin and origin.startswith("http"):
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        if parsed.netloc and not any(blocked in parsed.netloc for blocked in blocked_domains):
            return origin.rstrip("/")
    
    # Try to extract from referer (but not from OAuth providers)
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            if not any(blocked in parsed.netloc for blocked in blocked_domains):
                return f"{parsed.scheme}://{parsed.netloc}"
    
    # Fall back to environment variable
    return FRONTEND_URL

# Gmail OAuth Configuration for sending emails
GMAIL_SENDER_EMAIL = os.environ.get("GMAIL_SENDER_EMAIL", "")  # Will be set after authorization

# Gmail API scopes
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


# Helper function to check if email belongs to a mentor
async def check_mentor_by_email(db, email: str):
    """
    Check if the given email exists in the mentors collection.
    Returns the mentor document if found, None otherwise.
    """
    mentor = await db.mentors.find_one({"email": email.lower()}, {"_id": 0})
    if not mentor:
        # Also try case-insensitive search
        mentor = await db.mentors.find_one(
            {"email": {"$regex": f"^{email}$", "$options": "i"}}, 
            {"_id": 0}
        )
    return mentor


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


def hash_password(password: str) -> str:
    """Hash password using SHA256 with salt"""
    salt = "gradnext_salt_2024"  # In production, use unique salt per user
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def create_jwt_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "user_id": user_id,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


async def get_gmail_credentials(db):
    """Get stored Gmail OAuth credentials from database"""
    creds = await db.gmail_credentials.find_one({"type": "gmail_sender"}, {"_id": 0})
    return creds


async def refresh_gmail_token(db, creds_doc):
    """Refresh Gmail access token using refresh token"""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    
    try:
        credentials = Credentials(
            token=creds_doc.get("access_token"),
            refresh_token=creds_doc.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=GMAIL_SCOPES
        )
        
        # Refresh the token
        request = Request()
        credentials.refresh(request)
        
        # Update in database
        await db.gmail_credentials.update_one(
            {"type": "gmail_sender"},
            {
                "$set": {
                    "access_token": credentials.token,
                    "token_expiry": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return credentials.token
    except Exception as e:
        print(f"Error refreshing Gmail token: {e}")
        return None


async def send_email_via_gmail(db, to_email: str, subject: str, html_content: str):
    """Send email using Gmail API with OAuth"""
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    
    try:
        creds_doc = await get_gmail_credentials(db)
        
        if not creds_doc:
            print("[Gmail] No Gmail credentials found. Please authorize Gmail first.")
            return False
        
        # Check if token needs refresh
        token_expiry = creds_doc.get("token_expiry")
        if token_expiry:
            if isinstance(token_expiry, str):
                token_expiry = datetime.fromisoformat(token_expiry.replace("Z", "+00:00"))
            if token_expiry.tzinfo is None:
                token_expiry = token_expiry.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) >= token_expiry:
                new_token = await refresh_gmail_token(db, creds_doc)
                if not new_token:
                    print("[Gmail] Failed to refresh token")
                    return False
                creds_doc["access_token"] = new_token
        
        # Create credentials object
        credentials = Credentials(
            token=creds_doc.get("access_token"),
            refresh_token=creds_doc.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=GMAIL_SCOPES
        )
        
        # Build Gmail service
        service = build("gmail", "v1", credentials=credentials)
        
        # Create email message
        sender_email = creds_doc.get("email", "noreply@gradnext.co")
        message = MIMEText(html_content, "html")
        message["To"] = to_email
        message["From"] = f"Team gradnext <{sender_email}>"
        message["Subject"] = subject
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        # Send email
        result = service.users().messages().send(
            userId="me",
            body={"raw": raw_message}
        ).execute()
        
        print(f"[Gmail] Email sent successfully to {to_email}, Message ID: {result.get('id')}")
        return True
        
    except Exception as e:
        print(f"[Gmail] Error sending email: {e}")
        return False


async def send_email_via_smtp(to_email: str, subject: str, html_content: str):
    """Send email using SMTP (fallback method) - now redirects to email_service"""
    from services.email_service import send_email
    result = await send_email(to_email, subject, html_content)
    return result.get("status") == "success"


async def send_welcome_email(db, email: str, first_name: str):
    """Send welcome email to new users after signup - uses Resend template"""
    from services.email_service import send_welcome_with_template
    
    # Use Resend template (configured via RESEND_TEMPLATE_WELCOME env var)
    # Falls back to inline HTML if template not configured
    result = await send_welcome_with_template(
        to=email,
        user_name=first_name
    )
    
    if result.get("status") == "success":
        print(f"[WELCOME EMAIL] Sent via {result.get('provider', 'unknown')} to {email}")
        return True
    else:
        print(f"[WELCOME EMAIL] Failed for {email}: {result.get('message')}")
        return False
    
    print(f"[WELCOME EMAIL] WARNING: Could not send welcome email to {email}: {result.get('message')}")
    return False


async def send_otp_email(db, email: str, otp: str, is_signup: bool = False, is_reset: bool = False):
    """Send OTP via Resend (primary) with SMTP fallback"""
    from services.email_service import send_email
    
    if is_reset:
        subject = "Reset Your gradnext Password"
        action = "reset your password"
    elif is_signup:
        subject = "Welcome to gradnext - Verify Your Email"
        action = "complete your sign up"
    else:
        subject = "Your gradnext Login Code"
        action = "log in"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0ea5e9; margin: 0;">gradnext</h1>
            <p style="color: #64748b; margin-top: 5px;">Interview Preparation Platform</p>
        </div>
        
        <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-top: 0;">{"Password Reset Code" if is_reset else "Your Verification Code"}</h2>
            <p style="color: #64748b;">Use this code to {action}:</p>
            <div style="background: #fff; border: 2px dashed #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0ea5e9;">{otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in {OTP_EXPIRATION_MINUTES} minutes.</p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request this code, you can safely ignore this email.
        </p>
    </body>
    </html>
    """
    
    # Use Resend (primary) with SMTP fallback
    result = await send_email(email, subject, html_content, sender_name="Team gradnext")
    
    if result.get("status") == "success":
        print(f"[OTP] Email sent via {result.get('provider', 'unknown')} to {email}")
        return True
    
    # Last resort: Log OTP for development/testing
    print(f"[OTP] WARNING: Could not send email. Email: {email}, Code: {otp}, Purpose: {'reset' if is_reset else 'signup' if is_signup else 'login'}")
    return False


async def get_current_user(request: Request):
    """Get current authenticated user from session token"""
    # Check cookie first
    token = request.cookies.get("session_token") or request.cookies.get("auth_token")
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        logger.warning("No session token found in cookies or headers")
        raise HTTPException(status_code=401, detail="Not authenticated - no token")
    
    logger.info(f"Authenticating with token: {token[:30]}...")
    
    db = get_db(request)
    
    # Check session in database
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    
    if not session:
        logger.warning(f"Session not found in database for token: {token[:30]}...")
        # Try JWT verification as fallback (for backward compatibility)
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("user_id")
            user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
            if user_data:
                logger.info(f"User authenticated via JWT: {user_data.get('email')}")
                return user_data
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            logger.warning(f"JWT verification failed: {str(e)}")
            pass
        raise HTTPException(status_code=401, detail="Invalid session")
    
    logger.info(f"Session found for user: {session.get('user_id')}")
    
    # Check session expiry
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            logger.warning(f"Session expired: {expires_at}")
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user data
    user_data = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user_data:
        logger.warning(f"User not found: {session['user_id']}")
        raise HTTPException(status_code=401, detail="User not found")
    
    logger.info(f"User authenticated: {user_data.get('email')}")
    return user_data


# ============ Pydantic Models ============

class SendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str = "login"  # 'login', 'signup', 'reset_password'


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    name: str = None  # Required for signup
    password: str = None  # Required for signup


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class GoogleTokenRequest(BaseModel):
    credential: str  # Google ID token from frontend


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: str = None
    role: str  # 'admin', 'mentor', 'candidate'
    plan: str = "free_trial"


# ============ Password-based Authentication ============

@router.post("/login")
async def login_with_password(data: LoginRequest, request: Request, response: Response):
    """Login with email and password"""
    try:
        db = get_db(request)
        email = data.email.lower()
        
        logger.info(f"Login attempt for email: {email}")
        
        # Find user
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            logger.warning(f"User not found: {email}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if user has password set
        if not user.get("password_hash"):
            logger.warning(f"User has no password hash: {email}")
            raise HTTPException(
                status_code=400, 
                detail="Please use OTP login or reset your password"
            )
        
        # Verify password
        if not verify_password(data.password, user["password_hash"]):
            logger.warning(f"Invalid password for user: {email}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        logger.info(f"Password verified for user: {email}")
        
        # Create session
        session_token = f"session_{uuid.uuid4().hex}"
        session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "session_token": session_token,
            "expires_at": session_expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Session created for user: {email}")
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
            path="/"
        )
        
        # Determine role
        role = "candidate"
        if user.get("is_admin"):
            role = "admin"
        elif user.get("is_mentor"):
            role = "mentor"
        
        # Update last_login_at timestamp
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"Login successful for user: {email}, role: {role}")
        
        # Track login event with Meta Conversion API (fire and forget)
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            await meta_pixel_service.track_login(
                user_email=user["email"],
                user_name=user.get("name"),
                user_id=user["id"],
                method='email',
                client_ip=client_ip,
                client_user_agent=client_user_agent,
                fbp=meta_cookies.get('fbp'),
                fbc=meta_cookies.get('fbc'),
            )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        # Track login event with Mixpanel
        try:
            mixpanel_service.track_login(
                user_id=user["id"],
                user_email=user["email"],
                login_method="email",
                user_plan=user.get("plan", "free_trial"),
                is_new_user=False,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get('user-agent')
            )
        except Exception as track_error:
            logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "picture": user.get("picture"),
                "role": role,
                "plan": user.get("plan", "free_trial")
            },
            "redirect": "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for {data.email}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during login: {str(e)}")


@router.post("/signup")
async def signup_with_password(data: SignupRequest, request: Request, response: Response):
    """Sign up with email, name, password after OTP verification"""
    db = get_db(request)
    email = data.email.lower()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered. Please login instead.")
    
    # Verify OTP
    otp_record = await db.otp_codes.find_one({"email": email}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    if otp_record.get("otp") != data.otp:
        await db.otp_codes.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check OTP expiry
    expires_at = otp_record.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            await db.otp_codes.delete_one({"email": email})
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Delete OTP after verification
    await db.otp_codes.delete_one({"email": email})
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if this email belongs to a mentor in our directory
    mentor_record = await check_mentor_by_email(db, email)
    is_mentor = mentor_record is not None
    mentor_id = mentor_record.get("id") if mentor_record else None
    
    if is_mentor:
        print(f"[SIGNUP] Auto-detected mentor: {email} -> {mentor_record.get('name')}")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    # Free trial is 7 days
    trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
    new_user = {
        "id": user_id,
        "email": email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "picture": None,
        "role": "mentor" if is_mentor else "candidate",
        "plan": "free_trial",
        "plan_start_date": datetime.now(timezone.utc).isoformat(),
        "plan_end_date": trial_end_date.isoformat(),
        "coaching_sessions_total": 0,
        "coaching_sessions_used": 0,
        "is_mentor": is_mentor,
        "mentor_id": mentor_id,
        "is_admin": False,
        "timezone": "Asia/Kolkata",  # Default timezone, user can change
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    # Send welcome email to new user (non-blocking)
    first_name = data.name.split()[0] if data.name else "there"
    try:
        await send_welcome_email(db, email, first_name)
    except Exception as e:
        print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
    
    # Link mentor record to this user if mentor
    if is_mentor and mentor_id:
        await db.mentors.update_one(
            {"id": mentor_id},
            {"$set": {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Determine redirect based on role
    redirect_path = "/mentor-dashboard" if is_mentor else "/dashboard"
    
    # Track signup event with Meta Conversion API (fire and forget)
    try:
        client_ip = request.client.host if request.client else None
        client_user_agent = request.headers.get('user-agent')
        meta_cookies = meta_pixel_service.extract_meta_cookies(request)
        await meta_pixel_service.track_signup(
            user_email=email,
            user_name=data.name,
            user_id=user_id,
            method='email',
            client_ip=client_ip,
            client_user_agent=client_user_agent,
            fbp=meta_cookies.get('fbp'),
            fbc=meta_cookies.get('fbc'),
        )
    except Exception as track_error:
        logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
    
    # Track signup event with Mixpanel
    try:
        mixpanel_service.track_signup(
            user_id=user_id,
            user_email=email,
            user_name=data.name,
            signup_method="email"
        )
    except Exception as track_error:
        logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
    
    return {
        "success": True,
        "message": "Account created successfully" + (" as a mentor!" if is_mentor else ""),
        "user": {
            "id": user_id,
            "email": email,
            "name": data.name,
            "picture": None,
            "role": "mentor" if is_mentor else "candidate",
            "plan": "free_trial",
            "is_mentor": is_mentor
        },
        "redirect": redirect_path
    }


@router.post("/forgot-password")
async def forgot_password(data: SendOTPRequest, request: Request):
    """Send OTP for password reset"""
    db = get_db(request)
    email = data.email.lower()
    
    # Check if user exists
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # Don't reveal if email exists for security
        return {"success": True, "message": "If the email exists, you will receive a reset code"}
    
    # Generate OTP
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    
    # Store OTP
    await db.otp_codes.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp": otp,
                "purpose": "reset_password",
                "expires_at": expires_at.isoformat(),
                "attempts": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Send OTP email
    await send_otp_email(db, email, otp, is_signup=False, is_reset=True)
    
    return {"success": True, "message": "Password reset code sent to your email"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, request: Request, response: Response):
    """Reset password after OTP verification"""
    db = get_db(request)
    email = data.email.lower()
    
    # Verify OTP
    otp_record = await db.otp_codes.find_one({"email": email}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No reset code found. Please request a new one.")
    
    if otp_record.get("otp") != data.otp:
        await db.otp_codes.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check expiry
    expires_at = otp_record.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            await db.otp_codes.delete_one({"email": email})
            raise HTTPException(status_code=400, detail="Reset code expired. Please request a new one.")
    
    # Delete OTP
    await db.otp_codes.delete_one({"email": email})
    
    # Validate password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    result = await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "password_hash": hash_password(data.new_password),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user for auto-login
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    # Create session for auto-login
    session_token = f"session_{uuid.uuid4().hex}"
    session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Determine role
    role = "candidate"
    if user.get("is_admin"):
        role = "admin"
    elif user.get("is_mentor"):
        role = "mentor"
    
    return {
        "success": True,
        "message": "Password reset successfully",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": role,
            "plan": user.get("plan", "free_trial")
        },
        "redirect": "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
    }


# ============ OTP Authentication Endpoints ============

@router.post("/send-otp")
async def send_otp(data: SendOTPRequest, request: Request):
    """Send OTP to email for login/signup/reset"""
    try:
        db = get_db(request)
        email = data.email.lower()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        is_signup = existing_user is None
        
        # Generate OTP
        otp = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
        
        # Store OTP in database
        await db.otp_codes.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "otp": otp,
                    "expires_at": expires_at.isoformat(),
                    "attempts": 0,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Send OTP email
        await send_otp_email(db, email, otp, is_signup)
        
        return {
            "success": True,
            "message": "OTP sent to your email",
            "is_new_user": is_signup
        }
    except Exception as e:
        logger.error(f"[send-otp] Error sending OTP to {data.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@router.post("/verify-otp")
async def verify_otp(data: VerifyOTPRequest, request: Request, response: Response):
    """Verify OTP and login/signup user"""
    db = get_db(request)
    email = data.email.lower()
    
    # Get stored OTP
    otp_record = await db.otp_codes.find_one({"email": email}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    # Check attempts
    if otp_record.get("attempts", 0) >= 5:
        await db.otp_codes.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    # Check expiry
    expires_at = otp_record.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            await db.otp_codes.delete_one({"email": email})
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Verify OTP
    if otp_record.get("otp") != data.otp:
        await db.otp_codes.update_one(
            {"email": email},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP verified - delete it
    await db.otp_codes.delete_one({"email": email})
    
    # Check if user exists
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if user:
        # Existing user - login
        user_id = user["id"]
    else:
        # New user - signup
        if not data.name:
            raise HTTPException(status_code=400, detail="Name is required for signup")
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # Free trial is 7 days
        trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
        new_user = {
            "id": user_id,
            "email": email,
            "name": data.name,
            "picture": None,
            "role": "candidate",  # Default role
            "plan": "free_trial",
            "plan_start_date": datetime.now(timezone.utc).isoformat(),
            "plan_end_date": trial_end_date.isoformat(),
            "coaching_sessions_total": 0,
            "coaching_sessions_used": 0,
            "is_mentor": False,
            "is_admin": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        user = new_user
        
        # Send welcome email to new user (non-blocking)
        first_name = data.name.split()[0] if data.name else "there"
        try:
            await send_welcome_email(db, email, first_name)
        except Exception as e:
            print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Update last_login_at timestamp
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Track login with Mixpanel
    try:
        is_new = created_new_user if 'created_new_user' in dir() else False
        mixpanel_service.track_login(
            user_id=user_id,
            user_email=user["email"],
            login_method="otp",
            user_plan=user.get("plan", "free_trial"),
            is_new_user=is_new,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get('user-agent')
        )
    except Exception as track_error:
        logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
    
    # Determine role
    role = "candidate"
    if user.get("is_admin"):
        role = "admin"
    elif user.get("is_mentor"):
        role = "mentor"
    
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": role,
            "plan": user.get("plan", "free_trial")
        },
        "redirect": "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
    }


# ============ Google OAuth Endpoints ============

@router.get("/google/test")
async def test_google_config(request: Request):
    """Test endpoint to verify Google OAuth configuration.

    Returns the EXACT `redirect_uri` value the backend sends to Google
    when initiating the mobile-Safari OAuth flow. The OAuth client in
    Google Cloud Console MUST have this exact URL whitelisted under
    "Authorized redirect URIs" — otherwise iPhone Safari users hit
    "Access blocked: Authorization Error / Error 400: invalid_request".
    """
    # Check if google-auth package is available
    google_auth_available = False
    try:
        from google.oauth2 import id_token  # noqa: F401
        from google.auth.transport import requests as google_requests  # noqa: F401
        google_auth_available = True
    except ImportError as e:
        google_auth_available = str(e)

    # Reconstruct the EXACT redirect_uri the OAuth-init endpoint sends
    # to Google. Uses identical logic as `google_oauth_redirect_init`.
    backend_url = (BACKEND_URL or "").strip()
    if not backend_url:
        scheme = request.headers.get("x-forwarded-proto", "https").strip()
        host = request.headers.get("host", "").strip()
        backend_url = f"{scheme}://{host}"
    backend_url = backend_url.strip().rstrip("/")
    expected_redirect_uri = f"{backend_url}/api/auth/google/redirect-callback"

    # Detect a common deployment misconfiguration: leading/trailing
    # whitespace in the BACKEND_URL env var. URL-encodes to "+" / "%20"
    # in the OAuth URL → Google rejects with "invalid_request: doesn't
    # comply with OAuth 2.0 policy" on Mobile Safari only (desktop uses
    # popup OAuth which doesn't send redirect_uri).
    raw_env = BACKEND_URL or ""
    backend_url_warnings = []
    if raw_env != raw_env.strip():
        backend_url_warnings.append(
            f"BACKEND_URL env var has surrounding whitespace ({len(raw_env) - len(raw_env.strip())} chars). "
            f"Re-save it WITHOUT spaces in the deployment dashboard."
        )
    if raw_env.endswith("/"):
        backend_url_warnings.append("BACKEND_URL env var ends with a trailing slash — strip it.")

    return {
        "google_client_id_configured": bool(GOOGLE_CLIENT_ID),
        "client_id_prefix": GOOGLE_CLIENT_ID[:30] + "..." if GOOGLE_CLIENT_ID else "NOT SET",
        "google_auth_package": google_auth_available,
        "status": "ready" if GOOGLE_CLIENT_ID and google_auth_available is True else "not_configured",
        # Diagnostic for the iPhone "Access blocked" error — the value
        # below MUST exist verbatim in the OAuth client's "Authorized
        # redirect URIs" list at console.cloud.google.com/apis/credentials.
        "expected_redirect_uri": expected_redirect_uri,
        "backend_url_resolved": backend_url,
        "BACKEND_URL_env": BACKEND_URL or "(not set — falling back to request host)",
        "BACKEND_URL_env_repr": repr(BACKEND_URL),  # exposes hidden whitespace
        "backend_url_warnings": backend_url_warnings,
    }

@router.post("/google/verify")
async def verify_google_token(data: GoogleTokenRequest, request: Request, response: Response):
    """Verify Google ID token and create user session (Direct Google OAuth)"""
    import traceback
    
    print(f"[GOOGLE AUTH] ========== START ==========")
    print(f"[GOOGLE AUTH] Received request from origin: {request.headers.get('origin', 'unknown')}")
    print(f"[GOOGLE AUTH] Credential length: {len(data.credential) if data.credential else 0}")
    
    # Step 1: Import google auth libraries
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        print("[GOOGLE AUTH] Step 1: Google auth libraries imported successfully")
    except ImportError as e:
        print(f"[GOOGLE AUTH] Step 1 FAILED: Could not import google auth: {e}")
        raise HTTPException(status_code=500, detail="Google auth library not available")
    
    # Step 2: Get database
    try:
        db = get_db(request)
        print("[GOOGLE AUTH] Step 2: Database connection OK")
    except Exception as e:
        print(f"[GOOGLE AUTH] Step 2 FAILED: Database error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    # Step 3: Check if Google OAuth is configured
    if not GOOGLE_CLIENT_ID:
        print("[GOOGLE AUTH] Step 3 FAILED: GOOGLE_OAUTH_CLIENT_ID not configured!")
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server")
    print(f"[GOOGLE AUTH] Step 3: Client ID configured: {GOOGLE_CLIENT_ID[:30]}...")
    
    try:
        # Step 4: Verify Google ID token
        print("[GOOGLE AUTH] Step 4: Verifying token...")
        idinfo = id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        print(f"[GOOGLE AUTH] Step 4 SUCCESS: Token verified for: {idinfo.get('email')}")
        
        # Check token is valid
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise HTTPException(status_code=401, detail="Invalid token issuer")
        
        email = idinfo.get('email', '').lower()
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            # Update existing user - but preserve custom uploaded picture
            existing_picture = user.get("picture", "")
            # Only use Google picture if user doesn't have a custom uploaded one
            # Custom pictures are base64 encoded or stored locally, Google ones start with https://lh3.googleusercontent.com
            use_picture = existing_picture
            if not existing_picture or existing_picture.startswith("https://lh3.googleusercontent.com"):
                use_picture = picture or existing_picture
            
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name or user.get("name"),
                    "picture": use_picture,
                    "google_id": idinfo.get('sub'),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            # Free trial is 7 days
            trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "google_id": idinfo.get('sub'),
                "role": "candidate",
                "plan": "free_trial",
                "plan_start_date": datetime.now(timezone.utc).isoformat(),
                "plan_end_date": trial_end_date.isoformat(),
                "coaching_sessions_total": 0,
                "coaching_sessions_used": 0,
                "is_mentor": False,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            
            # Send welcome email to new user (non-blocking)
            first_name = name.split()[0] if name else "there"
            try:
                await send_welcome_email(db, email, first_name)
            except Exception as e:
                print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
        
        # Create session
        session_token = f"session_{uuid.uuid4().hex}"
        session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "session_token": session_token,
            "expires_at": session_expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
            path="/"
        )
        
        # Update last_login_at timestamp
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Determine role
        role = "candidate"
        if user.get("is_admin"):
            role = "admin"
        elif user.get("is_mentor"):
            role = "mentor"
        
        # Track Google sign in/up with Meta Conversion API (fire and forget)
        # Check if it was a new user creation (no existing user before this request)
        is_new_user = user.get("created_at") == user.get("updated_at")  # New users have same created/updated time
        try:
            client_ip = request.client.host if request.client else None
            client_user_agent = request.headers.get('user-agent')
            meta_cookies = meta_pixel_service.extract_meta_cookies(request)
            if is_new_user:
                await meta_pixel_service.track_signup(
                    user_email=user["email"],
                    user_name=user.get("name"),
                    user_id=user["id"],
                    method='google',
                    client_ip=client_ip,
                    client_user_agent=client_user_agent,
                    fbp=meta_cookies.get('fbp'),
                    fbc=meta_cookies.get('fbc'),
                )
            else:
                await meta_pixel_service.track_login(
                    user_email=user["email"],
                    user_name=user.get("name"),
                    user_id=user["id"],
                    method='google',
                    client_ip=client_ip,
                    client_user_agent=client_user_agent,
                    fbp=meta_cookies.get('fbp'),
                    fbc=meta_cookies.get('fbc'),
                )
        except Exception as track_error:
            logger.warning(f"Meta Pixel tracking error (non-critical): {track_error}")
        
        # Track with Mixpanel
        try:
            if is_new_user:
                mixpanel_service.track_signup(
                    user_id=user["id"],
                    user_email=user["email"],
                    user_name=user.get("name"),
                    signup_method="google"
                )
            else:
                mixpanel_service.track_login(
                    user_id=user["id"],
                    user_email=user["email"],
                    login_method="google",
                    user_plan=user.get("plan", "free_trial"),
                    is_new_user=False,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get('user-agent')
                )
        except Exception as track_error:
            logger.warning(f"Mixpanel tracking error (non-critical): {track_error}")
        
        return {
            "success": True,
            "is_new_user": is_new_user,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "picture": user.get("picture"),
                "role": role,
                "plan": user.get("plan", "free_trial")
            },
            "redirect": "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
        }
        
    except ValueError as e:
        print(f"[GOOGLE AUTH] Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[GOOGLE AUTH] Auth error: {str(e)}")
        print(f"[GOOGLE AUTH] Traceback: {traceback.format_exc()}")
        # Return a generic error to avoid exposing internal details
        raise HTTPException(status_code=500, detail="Authentication failed. Please try again or contact support.")


@router.get("/google/login")
async def google_oauth_redirect_init(request: Request):
    """
    Initiate Google OAuth via server-side redirect.
    This is specifically for Mobile Safari where popup mode doesn't work reliably.
    """
    import urllib.parse
    
    # Log request details for debugging Safari issues
    user_agent = request.headers.get("user-agent", "unknown")
    origin = request.headers.get("origin", "none")
    referer = request.headers.get("referer", "none")
    print(f"[GOOGLE OAUTH] Request from User-Agent: {user_agent[:100]}")
    print(f"[GOOGLE OAUTH] Origin: {origin}, Referer: {referer}")
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    # Get the backend URL - use request host for more reliability
    # This helps with Safari which may have different behavior.
    backend_url = (BACKEND_URL or "").strip()
    if not backend_url:
        # Fallback: construct from request
        scheme = request.headers.get("x-forwarded-proto", "https").strip()
        host = request.headers.get("host", "").strip()
        backend_url = f"{scheme}://{host}"

    # Strip whitespace AND trailing slash. A leading/trailing space in
    # the BACKEND_URL env var (easy to introduce when copy-pasting into
    # the deployment dashboard) URL-encodes to "+" or "%20" and produces
    # a redirect_uri like " https://app.gradnext.co/api/auth/google/redirect-callback"
    # which Google rejects as `invalid_request: doesn't comply with
    # OAuth 2.0 policy` — visible only on the iPhone server-redirect
    # flow because desktop uses popup OAuth (no redirect_uri).
    backend_url = backend_url.strip().rstrip("/")
    
    # Build the Google OAuth URL
    redirect_uri = f"{backend_url}/api/auth/google/redirect-callback"
    
    # Generate a state parameter for CSRF protection
    import secrets
    state = secrets.token_urlsafe(32)
    
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        # NOTE: deliberately NOT requesting `access_type=offline`. We
        # only need the ID token (verified in `google_oauth_redirect_callback`
        # below) — never the access_token or refresh_token. Asking for
        # offline access on a login-only flow triggers Google's
        # "Secure your app" policy ("Access blocked: Authorization Error,
        # Error 400: invalid_request, doesn't comply with Google's OAuth
        # 2.0 policy") specifically on Mobile Safari / iOS, which has
        # stricter enforcement than desktop. Without offline access the
        # request is policy-compliant on all platforms.
        'prompt': 'select_account',
        # `include_granted_scopes=true` lets returning users skip the
        # consent screen if they previously granted these basic scopes.
        'include_granted_scopes': 'true',
        'state': state,
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    
    print(f"[GOOGLE OAUTH] Backend URL: {backend_url}")
    print(f"[GOOGLE OAUTH] Redirect URI: {redirect_uri}")
    print(f"[GOOGLE OAUTH] Full auth URL: {auth_url}")
    
    # Use 303 See Other - better for Safari compatibility
    # Safari sometimes has issues with 302 redirects in OAuth flows
    response = RedirectResponse(url=auth_url, status_code=303)
    
    # Add headers that help with Safari's ITP
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    return response


@router.get("/google/redirect-callback")
async def google_oauth_redirect_callback(request: Request, response: Response, code: str = None, error: str = None):
    """
    Handle the OAuth callback from Google's authorization server.
    Exchanges the code for tokens and creates/updates user.
    """
    import httpx
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    
    db = get_db(request)
    frontend_url = get_frontend_url(request)
    
    print(f"[GOOGLE REDIRECT CALLBACK] Received code: {bool(code)}, error: {error}")
    
    if error:
        error_url = f"{frontend_url}/?auth_error={error}"
        return RedirectResponse(url=error_url, status_code=302)
    
    if not code:
        error_url = f"{frontend_url}/?auth_error=no_code"
        return RedirectResponse(url=error_url, status_code=302)
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        error_url = f"{frontend_url}/?auth_error=oauth_not_configured"
        return RedirectResponse(url=error_url, status_code=302)
    
    try:
        # Exchange code for tokens. The redirect_uri here MUST byte-for-byte
        # match the one sent during the authorization step — including no
        # leading/trailing whitespace. See `google_oauth_redirect_init`
        # for the env-var hardening rationale.
        backend_url = (BACKEND_URL or "").strip().rstrip("/")
        redirect_uri = f"{backend_url}/api/auth/google/redirect-callback"
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    'code': code,
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code'
                }
            )
        
        if token_response.status_code != 200:
            print(f"[GOOGLE REDIRECT CALLBACK] Token exchange failed: {token_response.text}")
            error_url = f"{frontend_url}/?auth_error=token_exchange_failed"
            return RedirectResponse(url=error_url, status_code=302)
        
        tokens = token_response.json()
        id_token_str = tokens.get('id_token')
        
        if not id_token_str:
            error_url = f"{frontend_url}/?auth_error=no_id_token"
            return RedirectResponse(url=error_url, status_code=302)
        
        # Verify and decode the ID token
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        print(f"[GOOGLE REDIRECT CALLBACK] Token verified for: {idinfo.get('email')}")
        
        email = idinfo.get('email', '').lower()
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        if not email:
            error_url = f"{frontend_url}/?auth_error=no_email"
            return RedirectResponse(url=error_url, status_code=302)
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            # Update existing user
            existing_picture = user.get("picture", "")
            use_picture = existing_picture
            if not existing_picture or existing_picture.startswith("https://lh3.googleusercontent.com"):
                use_picture = picture or existing_picture
            
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name or user.get("name"),
                    "picture": use_picture,
                    "google_id": idinfo.get('sub'),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
            
            # Check if this email belongs to a mentor in our directory
            mentor_record = await check_mentor_by_email(db, email)
            is_mentor = mentor_record is not None
            mentor_id = mentor_record.get("id") if mentor_record else None
            
            if is_mentor and mentor_id:
                await db.mentors.update_one(
                    {"id": mentor_id},
                    {"$set": {"user_id": user_id, "email": email}}
                )
            
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "google_id": idinfo.get('sub'),
                "role": "mentor" if is_mentor else "candidate",
                "plan": "free_trial",
                "plan_start_date": datetime.now(timezone.utc).isoformat(),
                "plan_end_date": trial_end_date.isoformat(),
                "coaching_sessions_total": 0,
                "coaching_sessions_used": 0,
                "is_mentor": is_mentor,
                "mentor_id": mentor_id,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            user = {k: v for k, v in user.items() if k != "_id"}
            
            # Send welcome email to new user (non-blocking)
            first_name = name.split()[0] if name else "there"
            try:
                await send_welcome_email(db, email, first_name)
            except Exception as e:
                print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
        
        # Create session - use consistent pattern with user_sessions collection
        session_token = f"session_{uuid.uuid4().hex}"
        auth_token = create_jwt_token(user.get("id"))
        session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user.get("id"),
            "session_token": session_token,
            "auth_token": auth_token,
            "email": email,
            "expires_at": session_expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Determine redirect URL
        if user.get("is_admin"):
            redirect_path = "/admin"
        elif user.get("is_mentor"):
            redirect_path = "/mentor-dashboard"
        else:
            redirect_path = "/dashboard"
        
        # Redirect to frontend with both session and auth tokens in URL (for Safari localStorage fallback)
        frontend_url = get_frontend_url(request)
        success_url = f"{frontend_url}{redirect_path}?session_token={session_token}&auth_token={auth_token}&auth_success=true"
        
        print(f"[GOOGLE REDIRECT CALLBACK] Success, redirecting to: {redirect_path}")
        print(f"[GOOGLE REDIRECT CALLBACK] Frontend URL: {frontend_url}")
        print(f"[GOOGLE REDIRECT CALLBACK] Full success URL: {success_url}")
        
        # Check if this is Safari (User-Agent based detection)
        user_agent = request.headers.get("user-agent", "").lower()
        is_safari = "safari" in user_agent and "chrome" not in user_agent and "chromium" not in user_agent
        
        # For Safari: Use HTML page with JavaScript redirect to avoid Safari's redirect chain issues
        # This is a proven workaround for Safari's ITP and redirect handling quirks
        if is_safari or "iphone" in user_agent or "ipad" in user_agent:
            print(f"[GOOGLE REDIRECT CALLBACK] Safari detected, using HTML redirect")
            from fastapi.responses import HTMLResponse
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Signing you in...</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }}
                    .container {{
                        text-align: center;
                        padding: 2rem;
                    }}
                    .spinner {{
                        width: 50px;
                        height: 50px;
                        border: 4px solid rgba(255,255,255,0.3);
                        border-top: 4px solid white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    }}
                    @keyframes spin {{
                        0% {{ transform: rotate(0deg); }}
                        100% {{ transform: rotate(360deg); }}
                    }}
                    h2 {{ margin: 0 0 0.5rem; font-weight: 500; }}
                    p {{ margin: 0; opacity: 0.9; font-size: 0.9rem; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="spinner"></div>
                    <h2>Signing you in...</h2>
                    <p>Please wait while we redirect you.</p>
                </div>
                <script>
                    // Store tokens in localStorage for Safari
                    try {{
                        localStorage.setItem('session_token', '{session_token}');
                        localStorage.setItem('auth_token', '{auth_token}');
                    }} catch(e) {{
                        console.warn('Could not store tokens:', e);
                    }}
                    
                    // Use location.replace to avoid back button issues
                    setTimeout(function() {{
                        window.location.replace('{success_url}');
                    }}, 100);
                </script>
            </body>
            </html>
            """
            
            html_response = HTMLResponse(content=html_content, status_code=200)
            html_response.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                secure=True,
                samesite="none",
                max_age=60 * 60 * 24 * 7
            )
            return html_response
        
        # For other browsers: Use standard redirect
        redirect_response = RedirectResponse(url=success_url, status_code=302)
        redirect_response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=60 * 60 * 24 * 7
        )
        
        return redirect_response
        
    except Exception as e:
        print(f"[GOOGLE REDIRECT CALLBACK] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        frontend_url = get_frontend_url(request)
        error_url = f"{frontend_url}/?auth_error=server_error"
        return RedirectResponse(url=error_url, status_code=302)


@router.get("/google/callback")
async def google_oauth_callback(request: Request, response: Response):
    """
    Handle Google OAuth redirect callback for mobile devices.
    This endpoint receives the credential from Google after redirect-based OAuth.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    
    db = get_db(request)
    frontend_url = get_frontend_url(request)
    
    # Get the credential from query params (Google sends it as 'credential')
    credential = request.query_params.get('credential')
    
    print(f"[GOOGLE CALLBACK] Received callback, credential present: {bool(credential)}")
    print(f"[GOOGLE CALLBACK] Query params: {dict(request.query_params)}")
    
    if not credential:
        # If no credential, redirect to frontend with error
        error_url = f"{frontend_url}/?auth_error=no_credential"
        return RedirectResponse(url=error_url, status_code=302)
    
    if not GOOGLE_CLIENT_ID:
        error_url = f"{frontend_url}/?auth_error=oauth_not_configured"
        return RedirectResponse(url=error_url, status_code=302)
    
    try:
        # Verify Google ID token
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        print(f"[GOOGLE CALLBACK] Token verified for: {idinfo.get('email')}")
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            error_url = f"{frontend_url}/?auth_error=invalid_issuer"
            return RedirectResponse(url=error_url, status_code=302)
        
        email = idinfo.get('email', '').lower()
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        if not email:
            error_url = f"{frontend_url}/?auth_error=no_email"
            return RedirectResponse(url=error_url, status_code=302)
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            # Update existing user
            existing_picture = user.get("picture", "")
            use_picture = existing_picture
            if not existing_picture or existing_picture.startswith("https://lh3.googleusercontent.com"):
                use_picture = picture or existing_picture
            
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name or user.get("name"),
                    "picture": use_picture,
                    "google_id": idinfo.get('sub'),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
            
            # Check if this email belongs to a mentor in our directory
            mentor_record = await check_mentor_by_email(db, email)
            is_mentor = mentor_record is not None
            mentor_id = mentor_record.get("id") if mentor_record else None
            
            if is_mentor:
                print(f"[GOOGLE CALLBACK] Auto-detected mentor: {email} -> {mentor_record.get('name')}")
                # Link mentor record to this user
                await db.mentors.update_one(
                    {"id": mentor_id},
                    {"$set": {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "google_id": idinfo.get('sub'),
                "role": "mentor" if is_mentor else "candidate",
                "plan": "free_trial",
                "plan_start_date": datetime.now(timezone.utc).isoformat(),
                "plan_end_date": trial_end_date.isoformat(),
                "coaching_sessions_total": 0,
                "coaching_sessions_used": 0,
                "is_mentor": is_mentor,
                "mentor_id": mentor_id,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            
            # Send welcome email to new user (non-blocking)
            first_name = name.split()[0] if name else "there"
            try:
                await send_welcome_email(db, email, first_name)
            except Exception as e:
                print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
        
        # Create session
        session_token = f"session_{uuid.uuid4().hex}"
        auth_token = f"auth_{uuid.uuid4().hex}"
        session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "session_token": session_token,
            "auth_token": auth_token,
            "expires_at": session_expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Determine role and redirect
        role = "candidate"
        if user.get("is_admin"):
            role = "admin"
        elif user.get("is_mentor"):
            role = "mentor"
        
        redirect_path = "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
        
        # Create redirect URL with session tokens as query params
        # The frontend will read these and store them
        success_url = f"{frontend_url}{redirect_path}?session_token={session_token}&auth_token={auth_token}&auth_success=true"
        
        print(f"[GOOGLE CALLBACK] Redirecting to: {success_url[:100]}...")
        
        # Also set cookies
        redirect_response = RedirectResponse(url=success_url, status_code=302)
        redirect_response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
            path="/"
        )
        
        return redirect_response
        
    except ValueError as e:
        print(f"[GOOGLE CALLBACK] Token verification failed: {str(e)}")
        error_url = f"{frontend_url}/?auth_error=invalid_token&message={str(e)}"
        return RedirectResponse(url=error_url, status_code=302)
    except Exception as e:
        print(f"[GOOGLE CALLBACK] Error: {str(e)}")
        error_url = f"{frontend_url}/?auth_error=server_error&message={str(e)}"
        return RedirectResponse(url=error_url, status_code=302)


@router.post("/google/callback")
async def google_oauth_callback_post(request: Request, response: Response):
    """
    Handle Google OAuth redirect callback (POST version for form submissions).
    Google can POST the credential via form data.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    
    db = get_db(request)
    frontend_url = get_frontend_url(request)
    
    # Try to get credential from form data
    form_data = await request.form()
    credential = form_data.get('credential')
    
    print(f"[GOOGLE CALLBACK POST] Received callback, credential present: {bool(credential)}")
    
    if not credential:
        error_url = f"{frontend_url}/?auth_error=no_credential"
        return RedirectResponse(url=error_url, status_code=302)
    
    if not GOOGLE_CLIENT_ID:
        error_url = f"{frontend_url}/?auth_error=oauth_not_configured"
        return RedirectResponse(url=error_url, status_code=302)
    
    try:
        # Verify Google ID token
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        print(f"[GOOGLE CALLBACK POST] Token verified for: {idinfo.get('email')}")
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            error_url = f"{frontend_url}/?auth_error=invalid_issuer"
            return RedirectResponse(url=error_url, status_code=302)
        
        email = idinfo.get('email', '').lower()
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        if not email:
            error_url = f"{frontend_url}/?auth_error=no_email"
            return RedirectResponse(url=error_url, status_code=302)
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            existing_picture = user.get("picture", "")
            use_picture = existing_picture
            if not existing_picture or existing_picture.startswith("https://lh3.googleusercontent.com"):
                use_picture = picture or existing_picture
            
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name or user.get("name"),
                    "picture": use_picture,
                    "google_id": idinfo.get('sub'),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            trial_end_date = datetime.now(timezone.utc) + timedelta(days=7)
            
            # Check if this email belongs to a mentor in our directory
            mentor_record = await check_mentor_by_email(db, email)
            is_mentor = mentor_record is not None
            mentor_id = mentor_record.get("id") if mentor_record else None
            
            if is_mentor:
                print(f"[GOOGLE CALLBACK POST] Auto-detected mentor: {email} -> {mentor_record.get('name')}")
                # Link mentor record to this user
                await db.mentors.update_one(
                    {"id": mentor_id},
                    {"$set": {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "google_id": idinfo.get('sub'),
                "role": "mentor" if is_mentor else "candidate",
                "plan": "free_trial",
                "plan_start_date": datetime.now(timezone.utc).isoformat(),
                "plan_end_date": trial_end_date.isoformat(),
                "coaching_sessions_total": 0,
                "coaching_sessions_used": 0,
                "is_mentor": is_mentor,
                "mentor_id": mentor_id,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            
            # Send welcome email to new user (non-blocking)
            first_name = name.split()[0] if name else "there"
            try:
                await send_welcome_email(db, email, first_name)
            except Exception as e:
                print(f"[WELCOME EMAIL] Error sending to {email}: {e}")
        
        session_token = f"session_{uuid.uuid4().hex}"
        auth_token = f"auth_{uuid.uuid4().hex}"
        session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
        
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "session_token": session_token,
            "auth_token": auth_token,
            "expires_at": session_expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        role = "candidate"
        if user.get("is_admin"):
            role = "admin"
        elif user.get("is_mentor"):
            role = "mentor"
        
        redirect_path = "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
        success_url = f"{frontend_url}{redirect_path}?session_token={session_token}&auth_token={auth_token}&auth_success=true"
        
        redirect_response = RedirectResponse(url=success_url, status_code=302)
        redirect_response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
            path="/"
        )
        
        return redirect_response
        
    except ValueError as e:
        print(f"[GOOGLE CALLBACK POST] Token verification failed: {str(e)}")
        error_url = f"{frontend_url}/?auth_error=invalid_token"
        return RedirectResponse(url=error_url, status_code=302)
    except Exception as e:
        print(f"[GOOGLE CALLBACK POST] Error: {str(e)}")
        error_url = f"{frontend_url}/?auth_error=server_error"
        return RedirectResponse(url=error_url, status_code=302)


class GoogleSessionRequest(BaseModel):
    session_id: str


@router.post("/google/session")
async def exchange_google_session(data: GoogleSessionRequest, request: Request, response: Response):
    """Exchange a temporary session_id for a full user session (used by OAuth callback)"""
    db = get_db(request)
    
    # Look up the temporary session
    temp_session = await db.temp_auth_sessions.find_one({"session_id": data.session_id})
    
    if not temp_session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Check if session is expired (5 minute validity)
    created_at = temp_session.get("created_at")
    if created_at:
        from datetime import datetime, timezone, timedelta
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) - created_at > timedelta(minutes=5):
            await db.temp_auth_sessions.delete_one({"session_id": data.session_id})
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user info from temp session
    user_id = temp_session.get("user_id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create permanent session
    session_token = f"session_{uuid.uuid4().hex}"
    session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Delete temp session
    await db.temp_auth_sessions.delete_one({"session_id": data.session_id})
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Determine role
    role = "candidate"
    if user.get("is_admin"):
        role = "admin"
    elif user.get("is_mentor"):
        role = "mentor"
    
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name"),
            "picture": user.get("picture"),
            "role": role,
            "plan": user.get("plan", "free_trial")
        },
        "redirect": "/admin" if role == "admin" else "/mentor-dashboard" if role == "mentor" else "/dashboard"
    }


# ============ Session Management ============

@router.get("/me")
async def get_current_user_info(request: Request):
    """Get current authenticated user info"""
    user = await get_current_user(request)
    db = get_db(request)
    
    # Determine role
    role = "candidate"
    if user.get("is_admin"):
        role = "admin"
    elif user.get("is_mentor"):
        role = "mentor"
    
    # Resolve profile picture: prioritize peer_profiles.profile_picture over users.picture
    # This ensures custom uploaded pictures are shown instead of Google profile pictures
    picture = user.get("picture")
    user_id = user.get("id")
    
    if user_id and role == "candidate":
        peer_profile = await db.peer_profiles.find_one(
            {"user_id": user_id}, 
            {"_id": 0, "profile_picture": 1}
        )
        if peer_profile and peer_profile.get("profile_picture"):
            picture = peer_profile["profile_picture"]
    
    # Get plan category for strategy call flow determination
    plan_category = "subscription"  # default
    plan_key = user.get("plan")
    if plan_key:
        plan = await db.plans.find_one({"plan_key": plan_key})
        if plan:
            plan_category = plan.get("category", "subscription")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": picture,
        "role": role,
        "plan": user.get("plan", "free_trial"),
        "plan_category": plan_category,
        "is_admin": user.get("is_admin", False),
        "is_mentor": user.get("is_mentor", False),
        "coaching_sessions_total": user.get("coaching_sessions_total", 0),
        "coaching_sessions_used": user.get("coaching_sessions_used", 0),
        "timezone": user.get("timezone", "Asia/Kolkata")
    }


@router.put("/timezone")
async def update_user_timezone(request: Request, tz: str):
    """Update user's timezone preference"""
    db = get_db(request)
    user = await get_current_user(request)
    
    # Validate timezone
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
    from datetime import timezone as tz_module
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"timezone": tz, "updated_at": datetime.now(tz_module.utc).isoformat()}}
    )
    
    return {"success": True, "timezone": tz}


@router.get("/timezones")
async def get_timezone_list():
    """Get list of common timezones for selection"""
    return {
        "timezones": [
            {"value": "Asia/Kolkata", "label": "India (IST)", "offset": "+05:30"},
            {"value": "America/New_York", "label": "US Eastern (EST/EDT)", "offset": "-05:00"},
            {"value": "America/Los_Angeles", "label": "US Pacific (PST/PDT)", "offset": "-08:00"},
            {"value": "America/Chicago", "label": "US Central (CST/CDT)", "offset": "-06:00"},
            {"value": "Europe/London", "label": "UK (GMT/BST)", "offset": "+00:00"},
            {"value": "Europe/Paris", "label": "Central Europe (CET/CEST)", "offset": "+01:00"},
            {"value": "Asia/Dubai", "label": "Dubai (GST)", "offset": "+04:00"},
            {"value": "Asia/Singapore", "label": "Singapore (SGT)", "offset": "+08:00"},
            {"value": "Asia/Tokyo", "label": "Japan (JST)", "offset": "+09:00"},
            {"value": "Australia/Sydney", "label": "Sydney (AEDT/AEST)", "offset": "+11:00"},
            {"value": "UTC", "label": "UTC", "offset": "+00:00"},
        ]
    }


@router.post("/set-password")
async def set_password_for_new_user(request: Request, response: Response):
    """Allow newly auto-created users (e.g. after cohort payment) to set their
    password for the first time. Requires the user to be authenticated via
    session cookie or Bearer token. Clears the needs_password_setup flag."""
    from pydantic import BaseModel as _BM

    class SetPasswordPayload(_BM):
        new_password: str

    body_raw = await request.json()
    new_password = body_raw.get("new_password", "").strip()
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_dict = user if isinstance(user, dict) else (user.dict() if hasattr(user, "dict") else user)

    db = get_db(request)
    hashed = hash_password(new_password)
    await db.users.update_one(
        {"id": user_dict["id"]},
        {"$set": {
            "password_hash": hashed,
            "needs_password_setup": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    logger.info("set-password: user %s set their password for the first time", user_dict.get("email"))
    return {"success": True, "message": "Password set successfully"}


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    db = get_db(request)
    
    token = request.cookies.get("session_token") or request.cookies.get("auth_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie("session_token", path="/")
    response.delete_cookie("auth_token", path="/")
    
    return {"success": True, "message": "Logged out successfully"}


# ============ Admin: User Role Management ============

@router.post("/admin/promote")
async def promote_user(request: Request, email: str, role: str):
    """Admin endpoint to promote user to mentor or admin"""
    db = get_db(request)
    current_user = await get_current_user(request)
    
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if role not in ["mentor", "admin", "candidate"]:
        raise HTTPException(status_code=400, detail="Invalid role. Use: mentor, admin, or candidate")
    
    user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {
        "is_mentor": role == "mentor",
        "is_admin": role == "admin",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if role == "mentor" and not user.get("mentor_id"):
        update_data["mentor_id"] = f"mentor_{uuid.uuid4().hex[:8]}"
    
    await db.users.update_one(
        {"email": email.lower()},
        {"$set": update_data}
    )
    
    return {"success": True, "message": f"User promoted to {role}"}


# ============ Mock Login (for testing - keep for backward compatibility) ============

@router.get("/mock-login/status")
async def mock_login_status():
    """Check if mock login is enabled"""
    import os
    enable_mock_login = os.environ.get("ENABLE_MOCK_LOGIN", "true").lower() == "true"
    return {"enabled": enable_mock_login}

@router.post("/mock-login")
async def mock_login(request: Request, response: Response, user_type: str = "free"):
    """Mock login for testing - creates a test user and returns session"""
    import os
    from models import PlanType
    
    # Check if mock login is enabled (disabled in production by default)
    enable_mock_login = os.environ.get("ENABLE_MOCK_LOGIN", "true").lower() == "true"
    if not enable_mock_login:
        raise HTTPException(status_code=403, detail="Mock login is disabled in production")
    
    # Calculate trial end date for mock free trial users (7 days from now)
    trial_end = datetime.now(timezone.utc) + timedelta(days=7)
    trial_start = datetime.now(timezone.utc)
    
    MOCK_USERS = {
        "free": {
            "id": "mock-user-free",
            "email": "free@gradnext.co",
            "name": "Free Trial User",
            "picture": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
            "plan": "free_trial",
            "plan_start_date": trial_start.isoformat(),
            "plan_end_date": trial_end.isoformat(),
            "is_mentor": False,
            "is_admin": False,
            "strategy_calls_total": 0,
            "strategy_calls_used": 0,
            "onboarding_completed": True
        },
        "subscription": {
            "id": "mock-user-sub",
            "email": "pro@gradnext.co",
            "name": "Pro Subscriber",
            "picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
            "plan": "full_prep",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": 10,
            "coaching_sessions_used": 0,
            "strategy_calls_total": 0,  # Will get 3 from full_prep plan features
            "strategy_calls_used": 0,
            "onboarding_completed": True
        },
        "basic": {
            "id": "mock-user-basic",
            "email": "basic@gradnext.co",
            "name": "Basic User",
            "picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
            "plan": "basic_plan",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": 0,
            "coaching_sessions_used": 0,
            "strategy_calls_total": 0,
            "strategy_calls_used": 0,
            "onboarding_completed": True
        },
        "mentor": {
            "id": "mock-mentor-1",
            "email": "mentor@gradnext.co",
            "name": "Priya Sharma",
            "picture": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
            "plan": "free_trial",
            "is_mentor": True,
            "is_admin": False,
            "mentor_id": "mentor-1",
            "onboarding_completed": True
        },
        "admin": {
            "id": "mock-admin-1",
            "email": "admin@gradnext.co",
            "name": "Admin User",
            "picture": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face",
            "plan": "free_trial",
            "is_mentor": False,
            "is_admin": True,
            "onboarding_completed": True
        },
        "pinnacle": {
            "id": "mock-pinnacle-1",
            "email": "megha@gradnext.co",
            "name": "Megha Sharma",
            "picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
            "plan": "pinnacle",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": -1,
            "coaching_sessions_remaining": -1,
            "coaching_sessions_used": 0,
            "strategy_calls_total": -1,
            "strategy_calls_remaining": -1,
            "strategy_calls_used": 0,
            "is_unlimited_coaching": True,
            "onboarding_completed": True
        },
        "full_prep": {
            "id": "mock-full-prep-1",
            "email": "fullprep@gradnext.co",
            "name": "Aarav Agarwal",
            "picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
            "plan": "full_prep",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": 10,
            "coaching_sessions_used": 2,
            "coaching_sessions_remaining": 8,
            "strategy_calls_total": 3,
            "strategy_calls_used": 1,
            "onboarding_completed": True,
            "subscription_status": "active",
            "coaching_program_expired": False,
            "subscription_expired": False,
            "coaching_program_end_date": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        },
        "pro_plus": {
            "id": "mock-pro-plus-1",
            "email": "proplus@gradnext.co",
            "name": "Pro Plus User",
            "picture": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
            "plan": "pro_plus",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": 20,
            "coaching_sessions_used": 5,
            "strategy_calls_total": 5,
            "strategy_calls_used": 2,
            "onboarding_completed": True
        },
        "megha_aggarwal": {
            "id": "016a2618-f1eb-40e3-8d0e-979bba107e65",
            "email": "meghaaggarwal.2000@gmail.com",
            "name": "Megha Aggarwal",
            "picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
            "plan": "full_prep",
            "is_mentor": False,
            "is_admin": False,
            "coaching_sessions_total": 10,
            "coaching_sessions_used": 0,
            "coaching_sessions_remaining": 10,
            "strategy_calls_total": 4,
            "strategy_calls_used": 0,
            "onboarding_completed": True,
            "subscription_status": "active",
            "coaching_program_expired": False,
            "subscription_expired": False,
            "coaching_program_end_date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()
        }
    }
    
    if user_type not in MOCK_USERS:
        user_type = "free"
    
    mock_data = MOCK_USERS[user_type]
    db = get_db(request)
    
    # Create or update user - check by email first (unique index), then by id
    existing_by_email = await db.users.find_one({"email": mock_data["email"]}, {"_id": 0})
    existing_by_id = await db.users.find_one({"id": mock_data["id"]}, {"_id": 0})
    
    if existing_by_email:
        # User exists with this email - update with mock data but keep their ID
        user_id = existing_by_email.get("id")
        mock_data["id"] = user_id  # Preserve existing user ID
        mock_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one(
            {"email": mock_data["email"]},
            {"$set": mock_data}
        )
    elif existing_by_id:
        # User exists with this mock ID - update with new mock data
        mock_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one(
            {"id": mock_data["id"]},
            {"$set": mock_data}
        )
    else:
        # No existing user - create new
        mock_data["created_at"] = datetime.now(timezone.utc).isoformat()
        mock_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one(mock_data)
    
    user = mock_data
    
    # Create or update peer profile for non-mentors
    if not user.get("is_mentor") and not user.get("is_admin"):
        peer_profile = await db.peer_profiles.find_one({"user_id": user["id"]})
        if not peer_profile:
            await db.peer_profiles.insert_one({
                "user_id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "profile_picture": user.get("picture"),
                "is_listed": True,
                "rating": 4.5,
                "sessions_done": 0,
                "preparation_level": "intermediate",
                "weekly_availability": [
                    {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"},
                    {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00"},
                    {"day_of_week": 2, "start_time": "09:00", "end_time": "17:00"},
                    {"day_of_week": 3, "start_time": "09:00", "end_time": "17:00"},
                    {"day_of_week": 4, "start_time": "09:00", "end_time": "17:00"}
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    # Also set auth_token for backward compatibility
    jwt_token = create_jwt_token(user["id"])
    response.set_cookie(
        key="auth_token",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/"
    )
    
    role = "admin" if user.get("is_admin") else "mentor" if user.get("is_mentor") else "candidate"
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": role,
        "plan": user.get("plan", "free_trial"),
        "is_mentor": user.get("is_mentor", False),
        "is_admin": user.get("is_admin", False),
        "coaching_sessions_total": user.get("coaching_sessions_total", 0),
        "coaching_sessions_used": user.get("coaching_sessions_used", 0),
        "session_token": session_token,
        "auth_token": jwt_token
    }



# ============ Gmail OAuth for Email Sending ============

@router.get("/gmail/authorize")
async def gmail_authorize(request: Request):
    """
    Initiate Gmail OAuth authorization for email sending.
    Automatically redirects to Google's consent screen.
    """
    import urllib.parse
    
    # Build authorization URL
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
    redirect_uri = f"{backend_url}/api/auth/gmail/callback"
    
    # URL encode the redirect URI
    encoded_redirect_uri = urllib.parse.quote(redirect_uri, safe='')
    
    # Build Google OAuth URL with gmail.send scope
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={encoded_redirect_uri}&"
        "response_type=code&"
        "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send%20email%20profile&"
        "access_type=offline&"
        "prompt=consent"
    )
    
    # Redirect to Google OAuth
    return RedirectResponse(url=auth_url)


@router.get("/gmail/callback")
async def gmail_callback(request: Request, code: str = None, error: str = None):
    """
    Handle Gmail OAuth callback and store credentials.
    """
    db = get_db(request)
    
    if error:
        # Redirect to admin panel with error
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
        return RedirectResponse(url=f"{frontend_url}/admin?gmail_error={error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code not provided")
    
    try:
        backend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
        redirect_uri = f"{backend_url}/api/auth/gmail/callback"
        
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to exchange code: {token_response.text}"
                )
            
            tokens = token_response.json()
            
            # Get user info to get the email
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            
            if userinfo_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            userinfo = userinfo_response.json()
            gmail_email = userinfo.get("email", "")
        
        # Store credentials in database
        token_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))
        
        await db.gmail_credentials.update_one(
            {"type": "gmail_sender"},
            {
                "$set": {
                    "type": "gmail_sender",
                    "email": gmail_email,
                    "access_token": tokens.get("access_token"),
                    "refresh_token": tokens.get("refresh_token"),
                    "token_expiry": token_expiry.isoformat(),
                    "scope": tokens.get("scope"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        print(f"[Gmail] Successfully authorized Gmail for: {gmail_email}")
        
        # Redirect to admin panel with success
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
        if not frontend_url or frontend_url == "/api":
            frontend_url = os.environ.get("FRONTEND_URL", "")
        return RedirectResponse(url=f"{frontend_url}/admin?gmail_success=true&gmail_email={gmail_email}")
        
    except Exception as e:
        print(f"[Gmail] OAuth callback error: {e}")
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
        if not frontend_url or frontend_url == "/api":
            frontend_url = os.environ.get("FRONTEND_URL", "")
        return RedirectResponse(url=f"{frontend_url}/admin?gmail_error={str(e)}")


@router.get("/gmail/status")
async def gmail_status(request: Request):
    """Check Gmail OAuth status"""
    db = get_db(request)
    
    creds = await db.gmail_credentials.find_one({"type": "gmail_sender"}, {"_id": 0})
    
    if not creds:
        return {
            "configured": False,
            "message": "Gmail not configured. Please authorize Gmail for sending emails."
        }
    
    # Check if token is expired
    token_expiry = creds.get("token_expiry")
    is_expired = False
    if token_expiry:
        if isinstance(token_expiry, str):
            token_expiry = datetime.fromisoformat(token_expiry.replace("Z", "+00:00"))
        if token_expiry.tzinfo is None:
            token_expiry = token_expiry.replace(tzinfo=timezone.utc)
        is_expired = datetime.now(timezone.utc) >= token_expiry
    
    return {
        "configured": True,
        "email": creds.get("email"),
        "token_expired": is_expired,
        "has_refresh_token": bool(creds.get("refresh_token")),
        "last_updated": creds.get("updated_at"),
        "message": "Gmail configured and ready to send emails" if not is_expired else "Token expired but will auto-refresh"
    }


@router.post("/gmail/test")
async def test_gmail(request: Request, email: str = None):
    """Send a test email via Gmail"""
    db = get_db(request)
    
    # Verify admin access
    try:
        current_user = await get_current_user(request)
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        test_email = email or current_user.get("email")
    except HTTPException:
        if not email:
            raise HTTPException(status_code=400, detail="Email address required")
        test_email = email
    
    # Check Gmail configuration
    creds = await db.gmail_credentials.find_one({"type": "gmail_sender"}, {"_id": 0})
    if not creds:
        raise HTTPException(
            status_code=400, 
            detail="Gmail not configured. Please authorize Gmail first."
        )
    
    # Send test email
    subject = "gradnext - Gmail Test Email"
    html_content = """
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0ea5e9; margin: 0;">gradnext</h1>
            <p style="color: #64748b; margin-top: 5px;">Interview Preparation Platform</p>
        </div>
        
        <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-top: 0;">Gmail Integration Test</h2>
            <p style="color: #64748b;">This is a test email to verify Gmail OAuth integration.</p>
            <p style="color: #22c55e; font-weight: bold;">✓ Gmail is working correctly!</p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            Sent from gradnext platform
        </p>
    </body>
    </html>
    """
    
    success = await send_email_via_gmail(db, test_email, subject, html_content)
    
    if success:
        return {
            "success": True,
            "message": f"Test email sent successfully to {test_email}"
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail="Failed to send test email. Please check Gmail authorization."
        )


@router.delete("/gmail/disconnect")
async def disconnect_gmail(request: Request):
    """Remove Gmail OAuth credentials"""
    db = get_db(request)
    
    # Verify admin access
    current_user = await get_current_user(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.gmail_credentials.delete_one({"type": "gmail_sender"})
    
    if result.deleted_count > 0:
        return {"success": True, "message": "Gmail disconnected successfully"}
    else:
        return {"success": False, "message": "No Gmail configuration found"}
