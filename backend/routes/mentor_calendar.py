"""
Mentor Google Calendar Integration
- OAuth flow for mentors to connect their Google Calendar
- Conflict detection to prevent double bookings
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import os
import json
import time

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/mentor-calendar", tags=["mentor-calendar"])

# Simple in-memory cache for Google Calendar busy slots
# Format: {cache_key: {"data": {...}, "expires": timestamp}}
_calendar_cache = {}
CACHE_TTL_SECONDS = 300  # 5 minute cache

# OAuth 2.0 Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").replace("/api", "")

# Scopes for Google Calendar read access - using single broad scope
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

def get_oauth_flow(redirect_uri: str) -> Flow:
    """Create OAuth flow for Google Calendar"""
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    return flow


@router.get("/status")
async def get_calendar_connection_status(request: Request):
    """Check if mentor has connected their Google Calendar"""
    user = await get_current_user(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can access this feature")
    
    db = get_db(request)
    
    # Check if mentor has stored calendar credentials
    mentor = await db.mentors.find_one({"id": user.get("mentor_id")}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    calendar_connected = mentor.get("google_calendar_connected", False)
    calendar_email = mentor.get("google_calendar_email", None)
    last_synced = mentor.get("google_calendar_last_synced", None)
    
    # Calculate if sync is stale (> 15 minutes old)
    sync_stale = False
    if last_synced:
        if isinstance(last_synced, str):
            last_synced_dt = datetime.fromisoformat(last_synced.replace('Z', '+00:00'))
        else:
            last_synced_dt = last_synced
        sync_stale = (datetime.utcnow() - last_synced_dt.replace(tzinfo=None)) > timedelta(minutes=15)
    
    return {
        "connected": calendar_connected,
        "email": calendar_email,
        "last_synced": last_synced,
        "sync_stale": sync_stale,
        "auto_sync_enabled": mentor.get("google_calendar_auto_sync", True)
    }


@router.post("/sync")
async def sync_calendar_now(request: Request):
    """
    Manually trigger a calendar sync to refresh busy slots cache.
    This re-fetches all busy times from Google Calendar.
    """
    user = await get_current_user(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can access this feature")
    
    db = get_db(request)
    
    mentor = await db.mentors.find_one({"id": user.get("mentor_id")}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    if not mentor.get("google_calendar_connected"):
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    credentials_data = mentor.get("google_calendar_credentials")
    if not credentials_data:
        raise HTTPException(status_code=400, detail="Calendar credentials not found")
    
    try:
        # Recreate credentials
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes")
        )
        
        # Build calendar service and verify connection
        service = build('calendar', 'v3', credentials=credentials)
        
        # Get all calendars to verify access
        calendar_list = service.calendarList().list().execute()
        calendars_count = len(calendar_list.get('items', []))
        
        # Update last synced time
        await db.mentors.update_one(
            {"id": user.get("mentor_id")},
            {"$set": {"google_calendar_last_synced": datetime.utcnow()}}
        )
        
        # If credentials were refreshed, save new token
        if credentials.token != credentials_data.get("token"):
            await db.mentors.update_one(
                {"id": user.get("mentor_id")},
                {"$set": {"google_calendar_credentials.token": credentials.token}}
            )
        
        return {
            "message": "Calendar synced successfully",
            "calendars_checked": calendars_count,
            "synced_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"Calendar sync error: {e}")
        # If token is invalid, mark calendar as disconnected
        if "invalid_grant" in str(e).lower() or "token" in str(e).lower():
            await db.mentors.update_one(
                {"id": user.get("mentor_id")},
                {"$set": {"google_calendar_connected": False}}
            )
            raise HTTPException(status_code=401, detail="Calendar authorization expired. Please reconnect.")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/auth/start")
async def start_calendar_auth(request: Request):
    """Start Google Calendar OAuth flow"""
    import urllib.parse
    import secrets
    
    user = await get_current_user(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can access this feature")
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500, 
            detail="Google OAuth not configured. Please contact support."
        )
    
    # Build redirect URI
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    redirect_uri = f"{backend_url}/api/mentor-calendar/auth/callback"
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Build authorization URL manually for better control
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'https://www.googleapis.com/auth/calendar.readonly',
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state
    }
    
    authorization_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    
    print(f"[Calendar OAuth] Generated auth URL with redirect_uri: {redirect_uri}")
    print(f"[Calendar OAuth] Client ID: {GOOGLE_CLIENT_ID[:20]}...")
    
    # Store state in database for verification
    db = get_db(request)
    await db.mentors.update_one(
        {"id": user.get("mentor_id")},
        {"$set": {"oauth_state": state, "oauth_state_created": datetime.utcnow()}}
    )
    
    return {"authorization_url": authorization_url}


@router.get("/auth/callback")
async def calendar_auth_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback"""
    
    if error:
        # Redirect to frontend with error
        return RedirectResponse(
            url=f"{FRONTEND_URL}/mentor-dashboard?calendar_error={error}",
            status_code=302
        )
    
    if not code or not state:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/mentor-dashboard?calendar_error=missing_params",
            status_code=302
        )
    
    db = get_db(request)
    
    # Find mentor by OAuth state
    mentor = await db.mentors.find_one({"oauth_state": state})
    if not mentor:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/mentor-dashboard?calendar_error=invalid_state",
            status_code=302
        )
    
    try:
        import httpx
        
        # Build redirect URI - must EXACTLY match what's in Google Console
        backend_url = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
        redirect_uri = f"{backend_url}/api/mentor-calendar/auth/callback"
        
        print(f"[Calendar OAuth] Using redirect_uri: {redirect_uri}")
        print(f"[Calendar OAuth] Received code (first 20 chars): {code[:20] if code else 'None'}...")
        
        # Exchange code for tokens manually to avoid scope mismatch issues
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
                error_text = token_response.text
                print(f"[Calendar OAuth] Token exchange FAILED: {error_text}")
                raise Exception(f"Token exchange failed: {error_text}")
            
            tokens = token_response.json()
            print(f"[Calendar OAuth] Token exchange SUCCESS")
        
        # Create credentials from tokens
        credentials = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=SCOPES
        )
        
        # Get user's email from calendar API
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        primary_calendar = next(
            (cal for cal in calendar_list.get('items', []) if cal.get('primary')),
            None
        )
        calendar_email = primary_calendar.get('id') if primary_calendar else 'Unknown'
        
        # Store credentials in database
        credentials_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else SCOPES
        }
        
        await db.mentors.update_one(
            {"id": mentor["id"]},
            {
                "$set": {
                    "google_calendar_credentials": credentials_data,
                    "google_calendar_connected": True,
                    "google_calendar_email": calendar_email,
                    "google_calendar_last_synced": datetime.utcnow()
                },
                "$unset": {"oauth_state": "", "oauth_state_created": ""}
            }
        )
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/mentor-dashboard?calendar_connected=true",
            status_code=302
        )
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        error_str = str(e)
        print(f"[Calendar OAuth] EXCEPTION: {error_str}")
        print(f"[Calendar OAuth] Full traceback:\n{error_details}")
        
        # Parse error type for user-friendly message
        if "redirect_uri_mismatch" in error_str.lower():
            error_code = "redirect_uri_mismatch"
        elif "invalid_grant" in error_str.lower():
            error_code = "invalid_grant"
        elif "invalid_client" in error_str.lower():
            error_code = "invalid_client"
        else:
            error_code = "token_exchange_failed"
        
        # URL-encode the error details (keep only alphanumeric and basic chars)
        import urllib.parse
        safe_details = urllib.parse.quote(error_str[:150], safe='')
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/mentor-dashboard?calendar_error={error_code}&details={safe_details}",
            status_code=302
        )


@router.delete("/disconnect")
async def disconnect_calendar(request: Request):
    """Disconnect Google Calendar"""
    user = await get_current_user(request)
    
    if not user.get("is_mentor"):
        raise HTTPException(status_code=403, detail="Only mentors can access this feature")
    
    db = get_db(request)
    
    await db.mentors.update_one(
        {"id": user.get("mentor_id")},
        {
            "$set": {
                "google_calendar_connected": False,
                "google_calendar_email": None,
                "google_calendar_last_synced": None
            },
            "$unset": {"google_calendar_credentials": ""}
        }
    )
    
    return {"message": "Google Calendar disconnected successfully"}


@router.get("/busy-slots")
async def get_busy_slots(
    request: Request,
    date: str,
    mentor_id: Optional[str] = None
):
    """
    Get busy time slots for a mentor on a specific date
    Checks ALL calendars the mentor has access to
    """
    db = get_db(request)
    
    # If mentor_id provided, use it; otherwise get from current user
    if mentor_id:
        mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    else:
        user = await get_current_user(request)
        if not user.get("is_mentor"):
            raise HTTPException(status_code=403, detail="Only mentors can access this feature")
        mentor = await db.mentors.find_one({"id": user.get("mentor_id")}, {"_id": 0})
    
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Check if calendar is connected
    if not mentor.get("google_calendar_connected"):
        return {"busy_slots": [], "calendar_connected": False}
    
    credentials_data = mentor.get("google_calendar_credentials")
    if not credentials_data:
        return {"busy_slots": [], "calendar_connected": False}
    
    try:
        # Recreate credentials
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes")
        )
        
        # Build calendar service
        service = build('calendar', 'v3', credentials=credentials)
        
        # Parse date and create time range for the full day in IST (UTC+5:30)
        target_date = datetime.strptime(date, "%Y-%m-%d")
        time_min = f"{date}T00:00:00+05:30"  # IST timezone
        time_max = f"{date}T23:59:59+05:30"  # IST timezone
        
        # Get all calendars
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        # Collect busy times from all calendars
        busy_slots = set()
        
        print(f"[Calendar Busy] Checking {len(calendars)} calendars for date {date}")
        
        for calendar in calendars:
            calendar_id = calendar.get('id')
            calendar_summary = calendar.get('summary', 'Unknown')
            
            try:
                # Use Events API instead of FreeBusy to get ALL events
                # This captures events regardless of "Show as" status (busy/free)
                events_result = service.events().list(
                    calendarId=calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy='startTime'
                ).execute()
                
                events = events_result.get('items', [])
                print(f"[Calendar Busy] Calendar '{calendar_summary}': {len(events)} events")
                
                for event in events:
                    # Skip all-day events (they have 'date' instead of 'dateTime')
                    start_info = event.get('start', {})
                    end_info = event.get('end', {})
                    
                    if 'dateTime' not in start_info:
                        continue  # Skip all-day events
                    
                    # Get mentor's email for comparison
                    mentor_email = mentor.get('google_calendar_email', '').lower()
                    
                    # Check if this is the mentor's PRIMARY calendar
                    is_primary = calendar.get('primary', False)
                    
                    # For the primary calendar, include all events
                    # For other calendars, only include events where mentor is involved
                    if not is_primary:
                        attendees = event.get('attendees', [])
                        mentor_is_attendee = any(
                            att.get('email', '').lower() == mentor_email
                            for att in attendees
                        )
                        
                        # Also check if the event creator is the mentor
                        creator_email = event.get('creator', {}).get('email', '').lower()
                        mentor_is_creator = creator_email == mentor_email
                        
                        # Check if the calendar ID matches mentor's email (personal calendar)
                        is_personal_calendar = calendar_id.lower() == mentor_email
                        
                        if not mentor_is_attendee and not mentor_is_creator and not is_personal_calendar:
                            # Skip events on shared calendars where mentor is not involved
                            continue
                    
                    # Parse start and end times
                    start_str = start_info.get('dateTime')
                    end_str = end_info.get('dateTime')
                    event_summary = event.get('summary', 'No title')
                    print(f"[Calendar Busy] Event '{event_summary}': {start_str} to {end_str}")
                    
                    # Handle both Z suffix and +HH:MM format
                    if start_str.endswith('Z'):
                        start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    else:
                        start = datetime.fromisoformat(start_str)
                    
                    if end_str.endswith('Z'):
                        end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    else:
                        end = datetime.fromisoformat(end_str)
                    
                    # Convert to IST for slot calculation
                    # Add 5:30 hours if in UTC
                    from datetime import timezone
                    ist_offset = timedelta(hours=5, minutes=30)
                    
                    if start.tzinfo is not None and start.utcoffset() == timedelta(0):
                        start = start + ist_offset
                    if end.tzinfo is not None and end.utcoffset() == timedelta(0):
                        end = end + ist_offset
                    
                    # Skip zero-duration events (reminders)
                    if start == end:
                        continue
                    
                    # Mark ALL 30-minute slots that overlap with this event
                    # Convert start and end to minutes from midnight
                    start_minutes = start.hour * 60 + start.minute
                    end_minutes = end.hour * 60 + end.minute
                    
                    # Round start down to nearest 30-min slot
                    start_slot = (start_minutes // 30) * 30
                    # Round end up to nearest 30-min slot (if not exactly on a slot)
                    end_slot = ((end_minutes + 29) // 30) * 30 if end_minutes % 30 != 0 else end_minutes
                    
                    # Mark each 30-minute slot that the event spans
                    current = start_slot
                    while current < end_slot and current < 24 * 60:
                        hour = current // 60
                        minute = current % 60
                        busy_slots.add(f"{hour:02d}:{minute:02d}")
                        current += 30
                        
            except HttpError as e:
                # Skip calendars we can't access
                print(f"Could not access calendar {calendar_id}: {e}")
                continue
        
        # Update last synced time
        await db.mentors.update_one(
            {"id": mentor["id"]},
            {"$set": {"google_calendar_last_synced": datetime.utcnow()}}
        )
        
        # If credentials were refreshed, save new token
        if credentials.token != credentials_data.get("token"):
            await db.mentors.update_one(
                {"id": mentor["id"]},
                {"$set": {"google_calendar_credentials.token": credentials.token}}
            )
        
        return {
            "busy_slots": sorted(list(busy_slots)),
            "calendar_connected": True,
            "date": date
        }
        
    except Exception as e:
        print(f"Error fetching busy slots: {e}")
        # If token is invalid, mark calendar as disconnected
        if "invalid_grant" in str(e).lower() or "token" in str(e).lower():
            await db.mentors.update_one(
                {"id": mentor["id"]},
                {"$set": {"google_calendar_connected": False}}
            )
        return {"busy_slots": [], "calendar_connected": False, "error": str(e)}


async def get_mentor_busy_slots(db, mentor_id: str, date: str) -> List[str]:
    """
    Helper function to get busy slots for a mentor
    Used by other modules (e.g., mentors.py) to filter availability
    """
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    
    if not mentor or not mentor.get("google_calendar_connected"):
        return []
    
    credentials_data = mentor.get("google_calendar_credentials")
    if not credentials_data:
        return []
    
    try:
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes")
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
        # Query in IST timezone
        time_min = f"{date}T00:00:00+05:30"
        time_max = f"{date}T23:59:59+05:30"
        
        # Get all calendars
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        busy_slots = set()
        
        for calendar in calendars:
            calendar_id = calendar.get('id')
            
            try:
                # Use Events API to get ALL events
                events_result = service.events().list(
                    calendarId=calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy='startTime'
                ).execute()
                
                events = events_result.get('items', [])
                
                for event in events:
                    # Skip all-day events
                    start_info = event.get('start', {})
                    end_info = event.get('end', {})
                    
                    if 'dateTime' not in start_info:
                        continue
                    
                    # Get mentor's email for comparison
                    mentor_email = mentor.get('google_calendar_email', '').lower()
                    
                    # Check if this is the mentor's PRIMARY calendar
                    is_primary = calendar.get('primary', False)
                    
                    # For the primary calendar, include all events
                    # For other calendars, only include events where mentor is involved
                    if not is_primary:
                        attendees = event.get('attendees', [])
                        mentor_is_attendee = any(
                            att.get('email', '').lower() == mentor_email
                            for att in attendees
                        )
                        creator_email = event.get('creator', {}).get('email', '').lower()
                        mentor_is_creator = creator_email == mentor_email
                        is_personal_calendar = calendar_id.lower() == mentor_email
                        
                        if not mentor_is_attendee and not mentor_is_creator and not is_personal_calendar:
                            continue
                    
                    start_str = start_info.get('dateTime')
                    end_str = end_info.get('dateTime')
                    
                    if start_str.endswith('Z'):
                        start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    else:
                        start = datetime.fromisoformat(start_str)
                    
                    if end_str.endswith('Z'):
                        end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    else:
                        end = datetime.fromisoformat(end_str)
                    
                    # Convert to IST if in UTC
                    ist_offset = timedelta(hours=5, minutes=30)
                    if start.tzinfo is not None and start.utcoffset() == timedelta(0):
                        start = start + ist_offset
                    if end.tzinfo is not None and end.utcoffset() == timedelta(0):
                        end = end + ist_offset
                    
                    # Skip zero-duration events (reminders)
                    if start == end:
                        continue
                    
                    # Mark all 30-minute slots that overlap with this event
                    start_minutes = start.hour * 60 + start.minute
                    end_minutes = end.hour * 60 + end.minute
                    
                    # Round start down to nearest 30-min slot
                    start_slot = (start_minutes // 30) * 30
                    # Round end up to nearest 30-min slot
                    end_slot = ((end_minutes + 29) // 30) * 30 if end_minutes % 30 != 0 else end_minutes
                    
                    # Mark each 30-minute slot
                    current = start_slot
                    while current < end_slot and current < 24 * 60:
                        hour = current // 60
                        minute = current % 60
                        busy_slots.add(f"{hour:02d}:{minute:02d}")
                        current += 30
                        
            except HttpError:
                continue
        
        # Update token if refreshed
        if credentials.token != credentials_data.get("token"):
            await db.mentors.update_one(
                {"id": mentor_id},
                {"$set": {"google_calendar_credentials.token": credentials.token}}
            )
        
        return list(busy_slots)
        
    except Exception as e:
        print(f"Error in get_mentor_busy_slots: {e}")
        return []



async def get_mentor_busy_slots_batch(db, mentor_id: str, start_date: str, end_date: str) -> dict:
    """
    Batch helper function to get busy slots for a mentor across a date range.
    Returns a dict mapping date strings to lists of busy slots.
    Much more efficient than calling get_mentor_busy_slots for each day.
    Uses in-memory caching to avoid repeated API calls.
    """
    global _calendar_cache
    
    # Check cache first
    cache_key = f"{mentor_id}:{start_date}:{end_date}"
    current_time = time.time()
    
    if cache_key in _calendar_cache:
        cached = _calendar_cache[cache_key]
        if cached["expires"] > current_time:
            return cached["data"]
        else:
            # Expired, remove from cache
            del _calendar_cache[cache_key]
    
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    
    if not mentor or not mentor.get("google_calendar_connected"):
        return {}
    
    credentials_data = mentor.get("google_calendar_credentials")
    if not credentials_data:
        return {}
    
    try:
        credentials = Credentials(
            token=credentials_data.get("token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes")
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
        # Query full date range in IST timezone
        time_min = f"{start_date}T00:00:00+05:30"
        time_max = f"{end_date}T23:59:59+05:30"
        
        # Get all calendars once
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        # Dict to store busy slots by date
        busy_slots_by_date = {}
        
        for calendar in calendars:
            calendar_id = calendar.get('id')
            
            try:
                # Use Events API to get ALL events for the date range
                events_result = service.events().list(
                    calendarId=calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy='startTime',
                    maxResults=500
                ).execute()
                
                events = events_result.get('items', [])
                mentor_email = mentor.get('google_calendar_email', '').lower()
                is_primary = calendar.get('primary', False)
                
                for event in events:
                    start_info = event.get('start', {})
                    end_info = event.get('end', {})
                    
                    if 'dateTime' not in start_info:
                        continue
                    
                    # For non-primary calendars, check if mentor is involved
                    if not is_primary:
                        attendees = event.get('attendees', [])
                        mentor_is_attendee = any(
                            att.get('email', '').lower() == mentor_email
                            for att in attendees
                        )
                        creator_email = event.get('creator', {}).get('email', '').lower()
                        mentor_is_creator = creator_email == mentor_email
                        is_personal_calendar = calendar_id.lower() == mentor_email
                        
                        if not mentor_is_attendee and not mentor_is_creator and not is_personal_calendar:
                            continue
                    
                    start_str = start_info.get('dateTime')
                    end_str = end_info.get('dateTime')
                    
                    if start_str.endswith('Z'):
                        start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    else:
                        start = datetime.fromisoformat(start_str)
                    
                    if end_str.endswith('Z'):
                        end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    else:
                        end = datetime.fromisoformat(end_str)
                    
                    # Convert to IST if in UTC
                    ist_offset = timedelta(hours=5, minutes=30)
                    if start.tzinfo is not None and start.utcoffset() == timedelta(0):
                        start = start + ist_offset
                    if end.tzinfo is not None and end.utcoffset() == timedelta(0):
                        end = end + ist_offset
                    
                    # Skip zero-duration events
                    if start == end:
                        continue
                    
                    # Get the date string for this event
                    event_date = start.strftime("%Y-%m-%d")
                    if event_date not in busy_slots_by_date:
                        busy_slots_by_date[event_date] = set()
                    
                    # Mark all 30-minute slots that overlap with this event
                    start_minutes = start.hour * 60 + start.minute
                    end_minutes = end.hour * 60 + end.minute
                    
                    start_slot = (start_minutes // 30) * 30
                    end_slot = ((end_minutes + 29) // 30) * 30 if end_minutes % 30 != 0 else end_minutes
                    
                    current = start_slot
                    while current < end_slot and current < 24 * 60:
                        hour = current // 60
                        minute = current % 60
                        busy_slots_by_date[event_date].add(f"{hour:02d}:{minute:02d}")
                        current += 30
                        
            except HttpError:
                continue
        
        # Update token if refreshed
        if credentials.token != credentials_data.get("token"):
            await db.mentors.update_one(
                {"id": mentor_id},
                {"$set": {"google_calendar_credentials.token": credentials.token}}
            )
        
        # Convert sets to lists
        result = {date: list(slots) for date, slots in busy_slots_by_date.items()}
        
        # Store in cache
        _calendar_cache[cache_key] = {
            "data": result,
            "expires": current_time + CACHE_TTL_SECONDS
        }
        
        return result
        
    except Exception as e:
        print(f"Error in get_mentor_busy_slots_batch: {e}")
        return {}
