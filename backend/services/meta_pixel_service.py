"""
Meta Conversion API Service
Server-side event tracking for Facebook/Meta Pixel

Pixel ID: 1459804045037272

Event Deduplication Strategy: External ID + FBP
-------------------------------------------------
Both browser pixel and server CAPI send the same external_id (user ID)
and fbp (_fbp cookie). Meta automatically deduplicates events with
matching event_name + external_id/fbp within 48 hours.

Browser pixel gets external_id via fbq('init', PIXEL_ID, { external_id: userId })
Server CAPI gets external_id (hashed user_id) + fbp (from X-Meta-Fbp header).
The frontend passes _fbp and _fbc cookies via X-Meta-Fbp / X-Meta-Fbc headers.
"""

import os
import hashlib
import time
import uuid
import httpx
import logging
from typing import Optional, Dict, Any, List
from fastapi import Request

logger = logging.getLogger(__name__)

# Meta Conversion API configuration
PIXEL_ID = os.environ.get('META_PIXEL_ID', '1459804045037272')
ACCESS_TOKEN = os.environ.get('META_CONVERSION_API_TOKEN', '')
API_VERSION = 'v18.0'
API_ENDPOINT = f'https://graph.facebook.com/{API_VERSION}/{PIXEL_ID}/events'


def extract_meta_cookies(request: Request) -> Dict[str, Optional[str]]:
    """
    Extract Meta tracking cookies from request headers.
    The frontend passes _fbp and _fbc cookies via custom headers
    (since they're first-party cookies on the frontend domain and 
    won't be sent cross-domain automatically).
    
    Returns: { 'fbp': str|None, 'fbc': str|None }
    """
    return {
        'fbp': request.headers.get('x-meta-fbp'),
        'fbc': request.headers.get('x-meta-fbc'),
    }


def generate_event_id() -> str:
    """Generate a unique event ID for deduplication with browser pixel"""
    timestamp = hex(int(time.time() * 1000))[2:]
    random_part = uuid.uuid4().hex[:12]
    return f"evt_{timestamp}_{random_part}"


def hash_data(value: str) -> str:
    """Hash user data using SHA-256 as required by Meta"""
    if not value:
        return ''
    return hashlib.sha256(value.lower().strip().encode('utf-8')).hexdigest()


def get_event_time() -> int:
    """Get current Unix timestamp"""
    return int(time.time())


async def send_event(
    event_name: str,
    event_id: Optional[str] = None,  # For deduplication with browser pixel
    user_email: Optional[str] = None,
    user_phone: Optional[str] = None,
    user_name: Optional[str] = None,
    user_id: Optional[str] = None,
    custom_data: Optional[Dict[str, Any]] = None,
    event_source_url: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,  # Facebook click ID from _fbc cookie
    fbp: Optional[str] = None,  # Facebook browser ID from _fbp cookie
) -> Dict[str, Any]:
    """
    Send a single event to Meta Conversion API
    
    Args:
        event_name: Standard event name (Purchase, CompleteRegistration, Lead, etc.)
        event_id: Unique event ID for deduplication (must match browser pixel's eventID)
        user_email: User's email (will be hashed)
        user_phone: User's phone number (will be hashed)
        user_name: User's name (will be split and hashed)
        user_id: External user ID
        custom_data: Additional event data (value, currency, content_ids, etc.)
        event_source_url: URL where the event occurred
        client_ip: Client's IP address
        client_user_agent: Client's user agent string
        fbc: Facebook click ID cookie
        fbp: Facebook browser ID cookie
    
    Returns:
        dict: { success: bool, event_id: str, message: str }
    """
    # Generate event_id if not provided (for server-only events)
    if not event_id:
        event_id = generate_event_id()
    
    if not ACCESS_TOKEN:
        logger.warning('Meta Conversion API token not configured')
        return {"success": False, "event_id": event_id, "message": "CAPI token not configured"}
    
    try:
        # Build user_data object with hashed values
        user_data = {
            'client_ip_address': client_ip,
            'client_user_agent': client_user_agent,
        }
        
        if user_email:
            user_data['em'] = [hash_data(user_email)]
        
        if user_phone:
            # Remove any non-numeric characters and hash
            clean_phone = ''.join(filter(str.isdigit, user_phone))
            user_data['ph'] = [hash_data(clean_phone)]
        
        if user_name:
            # Split name into first and last
            name_parts = user_name.strip().split(' ', 1)
            user_data['fn'] = [hash_data(name_parts[0])]
            if len(name_parts) > 1:
                user_data['ln'] = [hash_data(name_parts[1])]
        
        if user_id:
            user_data['external_id'] = [hash_data(user_id)]
        
        if fbc:
            user_data['fbc'] = fbc
        
        if fbp:
            user_data['fbp'] = fbp
        
        # Build event object with event_id for deduplication
        event = {
            'event_name': event_name,
            'event_id': event_id,  # Critical for deduplication
            'event_time': get_event_time(),
            'action_source': 'website',
            'user_data': user_data,
        }
        
        if event_source_url:
            event['event_source_url'] = event_source_url
        
        if custom_data:
            event['custom_data'] = custom_data
        
        # Send to Meta API
        payload = {
            'data': [event],
            'access_token': ACCESS_TOKEN,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                API_ENDPOINT,
                json=payload,
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f'[Meta CAPI] Event sent: {event_name}, event_id: {event_id}, events_received: {result.get("events_received", 0)}')
                return {"success": True, "event_id": event_id, "message": "Event sent successfully"}
            else:
                logger.error(f'[Meta CAPI] Failed to send event: {response.status_code} - {response.text}')
                return {"success": False, "event_id": event_id, "message": f"API error: {response.status_code}"}
                
    except Exception as e:
        logger.error(f'[Meta CAPI] Error sending event: {str(e)}')
        return {"success": False, "event_id": event_id, "message": str(e)}


async def track_signup(
    user_email: str,
    user_name: Optional[str] = None,
    user_id: Optional[str] = None,
    method: str = 'email',
    event_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
) -> Dict[str, Any]:
    """Track user registration/signup"""
    return await send_event(
        event_name='CompleteRegistration',
        event_id=event_id,
        user_email=user_email,
        user_name=user_name,
        user_id=user_id,
        custom_data={
            'content_name': 'signup',
            'status': 'complete',
            'method': method,
        },
        client_ip=client_ip,
        client_user_agent=client_user_agent,
        fbc=fbc,
        fbp=fbp,
    )


async def track_login(
    user_email: str,
    user_name: Optional[str] = None,
    user_id: Optional[str] = None,
    method: str = 'email',
    event_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
) -> Dict[str, Any]:
    """Track user login (custom event)"""
    return await send_event(
        event_name='Login',
        event_id=event_id,
        user_email=user_email,
        user_name=user_name,
        user_id=user_id,
        custom_data={
            'content_name': 'login',
            'method': method,
        },
        client_ip=client_ip,
        client_user_agent=client_user_agent,
        fbc=fbc,
        fbp=fbp,
    )


async def track_purchase(
    user_email: str,
    value: float,
    currency: str = 'INR',
    content_name: Optional[str] = None,
    content_ids: Optional[List[str]] = None,
    content_type: str = 'subscription',
    user_name: Optional[str] = None,
    user_id: Optional[str] = None,
    event_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
) -> Dict[str, Any]:
    """Track successful purchase"""
    custom_data = {
        'value': value,
        'currency': currency,
        'content_type': content_type,
    }
    
    if content_name:
        custom_data['content_name'] = content_name
    
    if content_ids:
        custom_data['content_ids'] = content_ids
    
    return await send_event(
        event_name='Purchase',
        event_id=event_id,
        user_email=user_email,
        user_name=user_name,
        user_id=user_id,
        custom_data=custom_data,
        client_ip=client_ip,
        client_user_agent=client_user_agent,
        fbc=fbc,
        fbp=fbp,
    )


async def track_initiate_checkout(
    user_email: str,
    value: float,
    currency: str = 'INR',
    content_name: Optional[str] = None,
    content_ids: Optional[List[str]] = None,
    content_type: str = 'subscription',
    user_name: Optional[str] = None,
    user_id: Optional[str] = None,
    event_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
) -> Dict[str, Any]:
    """Track checkout initiation"""
    custom_data = {
        'value': value,
        'currency': currency,
        'content_type': content_type,
    }
    
    if content_name:
        custom_data['content_name'] = content_name
    
    if content_ids:
        custom_data['content_ids'] = content_ids
    
    return await send_event(
        event_name='InitiateCheckout',
        event_id=event_id,
        user_email=user_email,
        user_name=user_name,
        user_id=user_id,
        custom_data=custom_data,
        client_ip=client_ip,
        client_user_agent=client_user_agent,
        fbc=fbc,
        fbp=fbp,
    )


async def track_lead(
    user_email: str,
    content_name: str,
    content_category: Optional[str] = None,
    user_name: Optional[str] = None,
    user_phone: Optional[str] = None,
    event_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbc: Optional[str] = None,
    fbp: Optional[str] = None,
) -> Dict[str, Any]:
    """Track lead generation (form submissions)"""
    custom_data = {
        'content_name': content_name,
    }
    
    if content_category:
        custom_data['content_category'] = content_category
    
    return await send_event(
        event_name='Lead',
        event_id=event_id,
        user_email=user_email,
        user_name=user_name,
        user_phone=user_phone,
        custom_data=custom_data,
        client_ip=client_ip,
        client_user_agent=client_user_agent,
        fbc=fbc,
        fbp=fbp,
    )
