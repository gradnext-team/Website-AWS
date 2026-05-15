"""
Contact Form API
Handles contact form submissions and sends notifications via email
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/contact", tags=["contact"])


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


class ContactFormRequest(BaseModel):
    name: str
    email: EmailStr
    category: str
    subject: str
    message: str


@router.post("")
async def submit_contact_form(data: ContactFormRequest, request: Request):
    """Submit a contact form message"""
    db = get_db(request)
    
    # Store the contact submission in database
    contact_doc = {
        "name": data.name,
        "email": data.email,
        "category": data.category,
        "subject": data.subject,
        "message": data.message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "responded_at": None
    }
    
    result = await db.contact_submissions.insert_one(contact_doc)
    
    # Try to send email notification to admin
    try:
        await send_contact_notification(db, data)
    except Exception as e:
        print(f"[Contact] Warning: Could not send email notification: {e}")
        # Don't fail the request if email fails - submission is saved
    
    return {
        "success": True,
        "message": "Your message has been received. We'll get back to you within 24-48 hours."
    }


async def send_contact_notification(db, data: ContactFormRequest):
    """Send email notification about new contact form submission"""
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials
    from email.mime.text import MIMEText
    import base64
    
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
    GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "info@gradnext.co")
    
    # Get Gmail credentials
    creds_doc = await db.gmail_credentials.find_one({"type": "gmail_sender"}, {"_id": 0})
    
    if not creds_doc:
        print("[Contact] No Gmail credentials found. Contact submission saved to database.")
        return
    
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
    
    # Create notification email for admin
    sender_email = creds_doc.get("email", "noreply@gradnext.co")
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Contact Form Submission</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 120px;">Name:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{data.name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:{data.email}" style="color: #0891b2;">{data.email}</a></td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Category:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{data.category.replace('_', ' ').title()}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Subject:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{data.subject}</td>
                </tr>
            </table>
            <div style="margin-top: 20px;">
                <h3 style="color: #334155; margin-bottom: 10px;">Message:</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="color: #475569; line-height: 1.6; white-space: pre-wrap;">{data.message}</p>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <a href="mailto:{data.email}?subject=Re: {data.subject}" 
                   style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Reply to {data.name}
                </a>
            </div>
        </div>
        <div style="padding: 20px; text-align: center; background: #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
                This is an automated notification from gradnext Contact Form
            </p>
        </div>
    </body>
    </html>
    """
    
    message = MIMEText(html_content, "html")
    message["To"] = ADMIN_EMAIL
    message["From"] = sender_email
    message["Subject"] = f"[Contact Form] {data.category.title()}: {data.subject}"
    message["Reply-To"] = data.email
    
    # Encode and send
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    result = service.users().messages().send(
        userId="me",
        body={"raw": raw_message}
    ).execute()
    
    print(f"[Contact] Notification sent to admin, Message ID: {result.get('id')}")
    
    # Also send confirmation to the user
    await send_user_confirmation(service, sender_email, data)


async def send_user_confirmation(service, sender_email: str, data: ContactFormRequest):
    """Send confirmation email to the user"""
    from email.mime.text import MIMEText
    import base64
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Thank You for Contacting Us</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
            <p style="color: #334155; font-size: 16px;">Hi {data.name},</p>
            <p style="color: #475569; line-height: 1.6;">
                Thank you for reaching out to gradnext. We've received your message and our team will get back to you within 24-48 hours.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <h3 style="color: #334155; margin-top: 0;">Your Message Summary:</h3>
                <p style="color: #64748b; margin: 5px 0;"><strong>Category:</strong> {data.category.replace('_', ' ').title()}</p>
                <p style="color: #64748b; margin: 5px 0;"><strong>Subject:</strong> {data.subject}</p>
            </div>
            <p style="color: #475569; line-height: 1.6;">
                In the meantime, feel free to explore our resources or start your free trial.
            </p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://gradnext.co" 
                   style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Visit gradnext
                </a>
            </div>
        </div>
        <div style="padding: 20px; text-align: center; background: #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
                gradnext - Making your consulting dream possible<br/>
                <a href="mailto:info@gradnext.co" style="color: #0891b2;">info@gradnext.co</a>
            </p>
        </div>
    </body>
    </html>
    """
    
    message = MIMEText(html_content, "html")
    message["To"] = data.email
    message["From"] = sender_email
    message["Subject"] = "We received your message - gradnext"
    
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    try:
        service.users().messages().send(
            userId="me",
            body={"raw": raw_message}
        ).execute()
        print(f"[Contact] Confirmation email sent to {data.email}")
    except Exception as e:
        print(f"[Contact] Could not send confirmation to user: {e}")
