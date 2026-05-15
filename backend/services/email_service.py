"""
Email Service using Resend (Primary) with SMTP Fallback
Provides flexible email sending with customizable sender names.
Supports both inline HTML and Resend templates.
"""
import os
import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Try to import and initialize Resend
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")
    RESEND_AVAILABLE = bool(resend.api_key)
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("Resend library not installed. Using SMTP fallback.")

# Default configuration
DEFAULT_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "noreply@gradnext.co")
DEFAULT_REPLY_TO = os.environ.get("RESEND_REPLY_TO", "support@gradnext.co")
DEFAULT_SENDER_NAME = os.environ.get("RESEND_DEFAULT_SENDER_NAME", "Team gradnext")

# SMTP fallback configuration
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")

# =============================================================================
# RESEND TEMPLATE IDS - Update these after creating templates in Resend dashboard
# Go to https://resend.com/emails to create templates and get their IDs
# =============================================================================
RESEND_TEMPLATES = {
    "otp": os.environ.get("RESEND_TEMPLATE_OTP"),                    # OTP verification
    "welcome": os.environ.get("RESEND_TEMPLATE_WELCOME"),            # Welcome email
    "session_reminder": os.environ.get("RESEND_TEMPLATE_SESSION_REMINDER"),  # Session reminder
    "session_booked": os.environ.get("RESEND_TEMPLATE_SESSION_BOOKED"),      # Session booked confirmation
    "session_cancelled": os.environ.get("RESEND_TEMPLATE_SESSION_CANCELLED"), # Session cancelled
    "payment_success": os.environ.get("RESEND_TEMPLATE_PAYMENT_SUCCESS"),    # Payment confirmation
    "support_reply": os.environ.get("RESEND_TEMPLATE_SUPPORT_REPLY"),        # Support reply
    "newsletter": os.environ.get("RESEND_TEMPLATE_NEWSLETTER"),              # Newsletter
}


async def send_email_with_template(
    to: str | List[str],
    template_id: str,
    template_data: Dict[str, Any] = None,
    subject: Optional[str] = None,
    sender_name: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> dict:
    """
    Send an email using a Resend template.
    Subject, from, and reply-to are all optional — Resend uses template defaults if not provided.
    
    Args:
        to: Recipient email(s)
        template_id: The Resend template UUID (from dashboard)
        template_data: Variables to pass to the template (e.g., {"name": "Kashish"})
        subject: Email subject (optional — uses template default if omitted)
        sender_name: Display name (optional — uses template default if omitted)
        from_email: Sender email (optional — uses template default if omitted)
        reply_to: Reply-to email (optional — uses template default if omitted)
    """
    if not RESEND_AVAILABLE:
        return {"status": "error", "message": "Resend not available"}
    
    if not template_id:
        return {"status": "error", "message": "Template ID not provided"}
    
    try:
        recipients = [to] if isinstance(to, str) else to
        
        # Build params — only include fields that are explicitly provided
        # Resend uses template defaults for any omitted field
        params = {
            "from": f"{DEFAULT_SENDER_NAME} <{DEFAULT_FROM_EMAIL}>",
            "to": recipients,
            "template": {
                "id": template_id,
                "variables": template_data or {}
            }
        }
        
        # Override from/subject/reply_to ONLY if explicitly passed by caller
        if sender_name or from_email:
            from_addr = from_email or DEFAULT_FROM_EMAIL
            params["from"] = f"{sender_name} <{from_addr}>" if sender_name else from_addr
        
        if subject:
            params["subject"] = subject
        
        if reply_to:
            params["reply_to"] = reply_to
        
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Template email sent via Resend to {recipients}")
        return {
            "status": "success",
            "message": f"Email sent to {', '.join(recipients)}",
            "email_id": email_response.get("id") if isinstance(email_response, dict) else str(email_response),
            "provider": "resend_template"
        }
    except Exception as e:
        logger.error(f"Template email failed: {str(e)}")
        return {"status": "error", "message": f"Template email failed: {str(e)}"}


async def send_email(
    to: str | List[str],
    subject: str,
    html_content: str,
    sender_name: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None,
    text_content: Optional[str] = None,
    attachments: Optional[list] = None
) -> dict:
    """
    Send an email using Resend (primary) or SMTP (fallback).
    
    Args:
        to: Recipient email(s) - can be string or list
        subject: Email subject
        html_content: HTML body of the email
        sender_name: Display name (e.g., "Team gradnext", "Kashish from gradnext")
        from_email: Sender email address (defaults to RESEND_FROM_EMAIL)
        reply_to: Reply-to email address (defaults to RESEND_REPLY_TO)
        text_content: Plain text version (optional)
    
    Returns:
        dict with status and email_id on success
    
    Examples:
        # Default sender (Team gradnext)
        await send_email("user@example.com", "Welcome!", "<h1>Hello</h1>")
        
        # Custom sender name
        await send_email(
            "user@example.com", 
            "Your session reminder",
            "<h1>Reminder</h1>",
            sender_name="Kashish from gradnext"
        )
    """
    # Try Resend first
    if RESEND_AVAILABLE:
        result = await _send_via_resend(to, subject, html_content, sender_name, from_email, reply_to, text_content, attachments)
        if result.get("status") == "success":
            return result
        logger.warning(f"Resend failed, trying SMTP fallback: {result.get('message')}")
    
    # Fallback to SMTP (attachments not supported on this path)
    return await _send_via_smtp(to, subject, html_content, sender_name, from_email, reply_to)


async def _send_via_resend(
    to: str | List[str],
    subject: str,
    html_content: str,
    sender_name: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None,
    text_content: Optional[str] = None,
    attachments: Optional[list] = None
) -> dict:
    """Send email via Resend API. `attachments` is a list of dicts:
    [{"filename": "...", "content": "<raw bytes or string>"}].
    String content is base64-encoded for Resend's payload format."""
    try:
        # Build the "from" address with display name
        sender = sender_name or DEFAULT_SENDER_NAME
        from_addr = from_email or DEFAULT_FROM_EMAIL
        formatted_from = f"{sender} <{from_addr}>"
        
        # Ensure "to" is a list
        recipients = [to] if isinstance(to, str) else to
        
        # Build email params
        params = {
            "from": formatted_from,
            "to": recipients,
            "subject": subject,
            "html": html_content,
        }
        
        # Add reply-to
        reply_to_addr = reply_to or DEFAULT_REPLY_TO
        if reply_to_addr:
            params["reply_to"] = reply_to_addr
        
        # Add plain text if provided
        if text_content:
            params["text"] = text_content

        # Add attachments if provided (Resend expects base64-encoded `content`)
        if attachments:
            import base64
            normalized = []
            for att in attachments:
                content = att.get("content")
                if isinstance(content, str):
                    content_b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
                else:
                    content_b64 = base64.b64encode(content).decode("ascii")
                item = {
                    "filename": att.get("filename") or "attachment",
                    "content": content_b64,
                }
                if att.get("content_type"):
                    item["content_type"] = att["content_type"]
                normalized.append(item)
            params["attachments"] = normalized
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Email sent via Resend to {recipients}: {subject}")
        return {
            "status": "success",
            "message": f"Email sent to {', '.join(recipients)}",
            "email_id": email_response.get("id") if isinstance(email_response, dict) else str(email_response),
            "provider": "resend"
        }
    except Exception as e:
        logger.error(f"Resend failed for {to}: {str(e)}")
        return {
            "status": "error",
            "message": f"Resend failed: {str(e)}"
        }


async def _send_via_smtp(
    to: str | List[str],
    subject: str,
    html_content: str,
    sender_name: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None
) -> dict:
    """Send email via SMTP (fallback)"""
    try:
        if not SMTP_USER or not SMTP_PASSWORD:
            return {"status": "error", "message": "SMTP not configured"}
        
        sender = sender_name or DEFAULT_SENDER_NAME
        from_addr = from_email or SMTP_USER
        recipients = [to] if isinstance(to, str) else to
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{sender} <{from_addr}>"
        msg['To'] = ', '.join(recipients)
        
        if reply_to or DEFAULT_REPLY_TO:
            msg['Reply-To'] = reply_to or DEFAULT_REPLY_TO
        
        msg.attach(MIMEText(html_content, 'html'))
        
        # Send via SMTP in thread
        def send_smtp():
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(from_addr, recipients, msg.as_string())
        
        await asyncio.to_thread(send_smtp)
        
        logger.info(f"Email sent via SMTP to {recipients}: {subject}")
        return {
            "status": "success",
            "message": f"Email sent to {', '.join(recipients)}",
            "provider": "smtp"
        }
    except Exception as e:
        logger.error(f"SMTP failed for {to}: {str(e)}")
        return {
            "status": "error",
            "message": f"SMTP failed: {str(e)}"
        }


async def send_otp_email(to: str, otp: str, user_name: str = "there") -> dict:
    """Send OTP verification email"""
    subject = "Your gradnext Verification Code"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">gradnext</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi {user_name}!</h2>
            <p>Your verification code is:</p>
            <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
                {otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
                © 2024 gradnext. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(to, subject, html_content, sender_name="Team gradnext")


async def send_welcome_email(to: str, user_name: str) -> dict:
    """Send welcome email to new users"""
    subject = "Welcome to gradnext"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="padding: 20px;">
            <p style="margin-bottom: 20px;">Hey {user_name},</p>
            
            <p style="margin-bottom: 20px;">Welcome to gradnext! I'm genuinely excited you're here.</p>
            
            <p style="margin-bottom: 20px;">I'm Kashish Malhotra, co-founder of gradnext and a former BCG consultant. Over the past few years, I've been lucky enough to help hundreds of people land offers at McKinsey, BCG, Bain, and other top firms. Now I'm hoping I can help you do the same.</p>
            
            <p style="margin-bottom: 20px;">I know consulting interviews can feel intimidating. The firms are selective, the process is intense, and sometimes it feels like everyone else has it figured out except you.</p>
            
            <p style="margin-bottom: 20px;">But here's the truth: with the right preparation and guidance, you absolutely can do this. I've seen it happen again and again.</p>
            
            <p style="margin-bottom: 20px;">This platform is built for people like you who are serious about breaking into consulting. Whether you're just starting out or already deep into prep, you'll find resources, coaching, and a community that actually gets what you're going through.</p>
            
            <p style="margin-bottom: 20px;">Take some time to explore what's available. Learn at your own pace, ask questions, and use everything here to get better every single day. I've put together everything I wish I had when I was preparing for my own consulting interviews.</p>
            
            <p style="margin-bottom: 20px;">If you ever need help figuring out where to start or what to focus on, just reach out to us.</p>
            
            <p style="margin-bottom: 20px;">Looking forward to being part of your journey.</p>
            
            <p style="margin-bottom: 5px;">Best,</p>
            <p style="margin-top: 0;"><strong>Kashish</strong></p>
        </div>
    </body>
    </html>
    """
    return await send_email(to, subject, html_content, sender_name="Kashish from gradnext")


async def send_session_reminder_email(
    to: str,
    user_name: str,
    session_type: str,
    mentor_name: str,
    session_date: str,
    session_time: str,
    meet_link: str = None
) -> dict:
    """Send session reminder email"""
    subject = f"Reminder: Your {session_type} session is coming up!"
    
    meet_button = ""
    if meet_link:
        meet_button = f"""
        <div style="text-align: center; margin: 20px 0;">
            <a href="{meet_link}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Join Session →
            </a>
        </div>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Session Reminder</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi {user_name}!</h2>
            <p>This is a reminder for your upcoming session:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Session Type:</strong> {session_type}</p>
                <p style="margin: 5px 0;"><strong>With:</strong> {mentor_name}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> {session_date}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> {session_time}</p>
            </div>
            {meet_button}
            <p style="color: #666; font-size: 14px;">Please join on time for the best experience.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
                © 2024 gradnext. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(to, subject, html_content, sender_name="Team gradnext")


async def send_custom_email(
    to: str | List[str],
    subject: str,
    html_content: str,
    sender_name: str = "Team gradnext"
) -> dict:
    """
    Send a custom email with specified sender name.
    Use this for marketing emails or personalized communications.
    
    Examples:
        # From founder
        await send_custom_email(
            "user@example.com",
            "A personal note",
            "<h1>Hi!</h1><p>...</p>",
            sender_name="Kashish from gradnext"
        )
    """
    return await send_email(to, subject, html_content, sender_name=sender_name)


# Keep backward compatibility with existing support reply function
async def send_support_reply_email(
    to_email: str,
    user_name: str,
    original_query: str,
    reply_message: str,
    admin_name: str = "Support Team"
):
    """Send an email reply to a user's support query"""
    subject = "Re: Your Support Query - gradnext"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">gradnext Support</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi {user_name},</h2>
            <p>Thank you for reaching out to us. Here's our response to your query:</p>
            
            <div style="background: #e8e8e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-style: italic; color: #666;">Your original query:</p>
                <p style="margin: 10px 0 0 0; color: #333;">{original_query}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd;">
                <p style="margin: 0; white-space: pre-wrap;">{reply_message}</p>
            </div>
            
            <p>If you have any more questions, feel free to reply to this email.</p>
            <p>Best regards,<br><strong>{admin_name}</strong><br>gradnext Support Team</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
                © 2024 gradnext. All rights reserved.
            </p>
        </div>
    </body>
    </html>
    """
    
    result = await send_email(to_email, subject, html_content, sender_name="gradnext Support")
    return result.get("status") == "success"



# =============================================================================
# TEMPLATE-BASED EMAIL FUNCTIONS
# These use Resend templates if configured, otherwise fall back to inline HTML
# =============================================================================

async def send_otp_with_template(to: str, otp: str, user_name: str = "there") -> dict:
    """Send OTP using Resend template if available"""
    template_id = RESEND_TEMPLATES.get("otp")
    
    if template_id:
        return await send_email_with_template(
            to=to,
            template_id=template_id,
            template_data={
                "name": user_name,
                "otp_code": otp,
                "expiry_minutes": "10"
            },
            sender_name="Team gradnext"
        )
    
    # Fallback to inline HTML
    return await send_otp_email(to, otp, user_name)


async def send_welcome_with_template(to: str, user_name: str) -> dict:
    """Send welcome email using Resend template if available, falls back to inline HTML"""
    template_id = RESEND_TEMPLATES.get("welcome")
    
    if template_id:
        result = await send_email_with_template(
            to=to,
            template_id=template_id,
            template_data={
                "name": user_name,
                "first_name": user_name,  # Alternative variable name
                "dashboard_url": "https://app.gradnext.co/dashboard"
            },
            subject="Welcome to gradnext",
            sender_name="Kashish from gradnext"
        )
        if result.get("status") == "success":
            return result
        logger.warning(f"Template welcome email failed, falling back to inline HTML: {result.get('message')}")
    
    # Fallback to inline HTML
    return await send_welcome_email(to, user_name)


async def send_session_reminder_with_template(
    to: str,
    user_name: str,
    session_type: str,
    mentor_name: str,
    session_date: str,
    session_time: str,
    meet_link: str = None
) -> dict:
    """Send session reminder using Resend template if available"""
    template_id = RESEND_TEMPLATES.get("session_reminder")
    
    if template_id:
        return await send_email_with_template(
            to=to,
            template_id=template_id,
            template_data={
                "name": user_name,
                "session_type": session_type,
                "mentor_name": mentor_name,
                "session_date": session_date,
                "session_time": session_time,
                "meet_link": meet_link or ""
            },
            sender_name="Team gradnext"
        )
    
    # Fallback to inline HTML
    return await send_session_reminder_email(to, user_name, session_type, mentor_name, session_date, session_time, meet_link)


async def send_newsletter(
    to: str | List[str],
    subject: str,
    content_html: str = None,
    template_id: str = None,
    template_data: Dict[str, Any] = None,
    sender_name: str = "Kashish from gradnext"
) -> dict:
    """
    Send a newsletter email.
    
    Can use either:
    1. A Resend template (pass template_id and template_data)
    2. Raw HTML content (pass content_html)
    
    Example with template:
        await send_newsletter(
            to=["user1@example.com", "user2@example.com"],
            subject="Weekly Update",
            template_id="tmpl_newsletter_123",
            template_data={"week": "Feb 10-16", "highlights": "..."}
        )
    
    Example with HTML:
        await send_newsletter(
            to="user@example.com",
            subject="Big Announcement!",
            content_html="<h1>Hello!</h1><p>We have news...</p>"
        )
    """
    if template_id:
        return await send_email_with_template(
            to=to,
            template_id=template_id,
            template_data=template_data or {},
            subject=subject,
            sender_name=sender_name
        )
    elif content_html:
        return await send_email(
            to=to,
            subject=subject,
            html_content=content_html,
            sender_name=sender_name
        )
    else:
        return {"status": "error", "message": "Either template_id or content_html is required"}


async def send_bulk_newsletter(
    recipients: List[str],
    subject: str,
    content_html: str = None,
    template_id: str = None,
    template_data: Dict[str, Any] = None,
    sender_name: str = "Kashish from gradnext",
    batch_size: int = 50,
    delay_between_batches: float = 1.0
) -> dict:
    """
    Send newsletter to multiple recipients in batches.
    
    Args:
        recipients: List of email addresses
        subject: Email subject
        content_html: HTML content (if not using template)
        template_id: Resend template ID (if using template)
        template_data: Data to pass to template
        sender_name: Sender display name
        batch_size: Number of emails per batch (max 50 for Resend)
        delay_between_batches: Seconds to wait between batches
    
    Returns:
        dict with success count, failed count, and errors
    """
    results = {
        "total": len(recipients),
        "sent": 0,
        "failed": 0,
        "errors": []
    }
    
    # Process in batches
    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]
        
        for email in batch:
            try:
                if template_id:
                    result = await send_email_with_template(
                        to=email,
                        template_id=template_id,
                        template_data=template_data or {},
                        subject=subject,
                        sender_name=sender_name
                    )
                else:
                    result = await send_email(
                        to=email,
                        subject=subject,
                        html_content=content_html,
                        sender_name=sender_name
                    )
                
                if result.get("status") == "success":
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append({"email": email, "error": result.get("message")})
                    
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"email": email, "error": str(e)})
        
        # Delay between batches to avoid rate limits
        if i + batch_size < len(recipients):
            await asyncio.sleep(delay_between_batches)
    
    return results
