"""
Abandoned Checkout Recovery Service
Sends automated emails to users who started checkout but didn't complete payment

IMPORTANT: Only sends emails for SUBSCRIPTION orders (not coaching sessions or top-ups)

Email Schedule:
- 1 hour after abandonment
- 24 hours after abandonment  
- 72 hours after abandonment

Includes discount code: WELCOME50 (50% off first billing cycle)
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

# Recovery email intervals in hours
RECOVERY_INTERVALS = {
    '1h': 1,
    '24h': 24,
    '72h': 72
}

# Default email templates (can be overridden from admin panel)
DEFAULT_TEMPLATES = {
    '1h': {
        'subject': "You're almost there! Complete your gradnext subscription",
        'body': """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <img src="https://app.gradnext.co/logo.png" alt="gradnext" style="height: 40px; margin-bottom: 20px;">
    
    <h2 style="color: #1a1f3d;">Hi {{name}},</h2>
    
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
        You were just one step away from unlocking your consulting prep journey!
    </p>
    
    <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1a1f3d; margin-top: 0;">Your cart:</h3>
        <p style="color: #4a5568; margin: 5px 0;"><strong>Plan:</strong> {{plan_name}}</p>
        <p style="color: #4a5568; margin: 5px 0;"><strong>Price:</strong> {{amount}}</p>
    </div>
    
    <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="color: #856404; margin: 0; font-weight: bold;">
            Special Offer: Use code <span style="background: #ffc107; padding: 2px 8px; border-radius: 4px;">WELCOME50</span> for 50% off your first billing cycle!
        </p>
        <p style="color: #856404; margin: 5px 0 0 0; font-size: 12px;">
            *Discount applicable only on the first billing cycle.
        </p>
    </div>
    
    <a href="https://app.gradnext.co/pricing" style="display: inline-block; background: #8b92ff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">
        Complete Your Purchase
    </a>
    
    <p style="color: #718096; font-size: 14px; margin-top: 30px;">
        Questions? Reply to this email or <a href="https://app.gradnext.co/discovery-call" style="color: #8b92ff;">book a discovery call</a>.
    </p>
    
    <p style="color: #4a5568;">
        Best,<br>
        Team gradnext
    </p>
</div>
"""
    },
    '24h': {
        'subject': "Don't miss out on your consulting prep!",
        'body': """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <img src="https://app.gradnext.co/logo.png" alt="gradnext" style="height: 40px; margin-bottom: 20px;">
    
    <h2 style="color: #1a1f3d;">Hi {{name}},</h2>
    
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
        We noticed you didn't complete your subscription yesterday. Your consulting prep journey is waiting!
    </p>
    
    <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1a1f3d; margin-top: 0;">What you'll get:</h3>
        <ul style="color: #4a5568; line-height: 1.8;">
            <li>35+ hours of video content</li>
            <li>Case interview drills and exercises</li>
            <li>Access to peer practice sessions</li>
            <li>Comprehensive case materials</li>
        </ul>
    </div>
    
    <div style="background: #d4edda; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="color: #155724; margin: 0; font-weight: bold;">
            Your discount is still active! Use code <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px;">WELCOME50</span> for 50% off your first billing cycle!
        </p>
        <p style="color: #155724; margin: 5px 0 0 0; font-size: 12px;">
            *Discount applicable only on the first billing cycle.
        </p>
    </div>
    
    <a href="https://app.gradnext.co/pricing" style="display: inline-block; background: #8b92ff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">
        Get Started Now
    </a>
    
    <p style="color: #718096; font-size: 14px; margin-top: 30px;">
        Need help deciding? <a href="https://app.gradnext.co/discovery-call" style="color: #8b92ff;">Book a free discovery call</a> with our team.
    </p>
    
    <p style="color: #4a5568;">
        Best,<br>
        Team gradnext
    </p>
</div>
"""
    },
    '72h': {
        'subject': "Last chance: Your exclusive discount expires soon!",
        'body': """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <img src="https://app.gradnext.co/logo.png" alt="gradnext" style="height: 40px; margin-bottom: 20px;">
    
    <h2 style="color: #1a1f3d;">Hi {{name}},</h2>
    
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
        This is your final reminder! Your exclusive 50% discount is about to expire.
    </p>
    
    <div style="background: #f8d7da; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <p style="color: #721c24; margin: 0; font-weight: bold;">
            Last chance! Use code <span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 4px;">WELCOME50</span> before it expires!
        </p>
        <p style="color: #721c24; margin: 5px 0 0 0; font-size: 12px;">
            *Discount applicable only on the first billing cycle.
        </p>
    </div>
    
    <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1a1f3d; margin-top: 0;">Your pending order:</h3>
        <p style="color: #4a5568; margin: 5px 0;"><strong>Plan:</strong> {{plan_name}}</p>
        <p style="color: #4a5568; margin: 5px 0;"><strong>Original Price:</strong> {{amount}}</p>
        <p style="color: #28a745; margin: 5px 0; font-size: 18px;"><strong>With WELCOME50:</strong> {{discounted_amount}} (first cycle only)</p>
    </div>
    
    <p style="color: #4a5568; font-size: 16px;">
        Don't let your consulting dreams wait. Join 1000+ candidates who've started their prep journey with gradnext.
    </p>
    
    <a href="https://app.gradnext.co/pricing" style="display: inline-block; background: #dc3545; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0;">
        Claim Your Discount Now
    </a>
    
    <p style="color: #718096; font-size: 14px; margin-top: 30px;">
        Have questions? Reply to this email - we're here to help!
    </p>
    
    <p style="color: #4a5568;">
        Best,<br>
        Team gradnext
    </p>
</div>
"""
    }
}


async def get_email_template(db, interval: str) -> Dict[str, str]:
    """Get email template from database or use default"""
    template = await db.abandoned_checkout_templates.find_one({"interval": interval})
    if template:
        return {
            'subject': template.get('subject'),
            'body': template.get('body')
        }
    return DEFAULT_TEMPLATES.get(interval, DEFAULT_TEMPLATES['1h'])


async def send_recovery_email(db, user_email: str, user_name: str, plan_name: str, amount: float, interval: str) -> bool:
    """Send abandoned checkout recovery email"""
    try:
        # Import email sending function
        from routes.auth import send_email_via_gmail
        
        template = await get_email_template(db, interval)
        
        # Calculate discounted amount (50% off)
        discounted_amount = round(amount * 0.5)
        
        # Replace placeholders
        subject = template['subject']
        body = template['body'].replace('{{name}}', user_name or 'there')
        body = body.replace('{{plan_name}}', plan_name or 'Subscription')
        body = body.replace('{{amount}}', f"₹{int(amount):,}")
        body = body.replace('{{discounted_amount}}', f"₹{discounted_amount:,}")
        
        await send_email_via_gmail(db, user_email, subject, body)
        logger.info(f"[Abandoned Checkout] ✅ Sent {interval} recovery email to {user_email}")
        return True
        
    except Exception as e:
        logger.error(f"[Abandoned Checkout] ❌ Failed to send {interval} email to {user_email}: {e}")
        return False


async def process_abandoned_checkouts():
    """Main function to process abandoned checkouts and send recovery emails"""
    logger.info("[Abandoned Checkout] Starting check...")
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.gradnext
        
        now = datetime.utcnow()
        emails_sent = 0
        
        # Get abandoned subscription orders only (created but not completed)
        # Subscription orders have plan_key and billing_cycle, but no "type" field
        # Other orders (single_coaching_session, session_topup) have explicit "type" field
        abandoned_orders = await db.payment_orders.find({
            "status": "created",  # Order created but payment not completed
            "plan_key": {"$exists": True},  # Must have plan_key (subscription orders)
            "type": {"$exists": False}  # Exclude orders with explicit type (coaching sessions, topups)
        }).to_list(1000)
        
        logger.info(f"[Abandoned Checkout] Found {len(abandoned_orders)} abandoned orders")
        
        for order in abandoned_orders:
            order_id = order.get("id") or str(order.get("_id"))
            user_email = order.get("user_email")
            user_name = order.get("user_name", "").split()[0] if order.get("user_name") else "there"
            plan_name = order.get("plan_name")
            amount = order.get("amount", 0)
            created_at = order.get("created_at")
            
            if not user_email or not created_at:
                continue
            
            # Parse created_at
            try:
                if isinstance(created_at, str):
                    order_time = datetime.fromisoformat(created_at.replace("Z", "+00:00")).replace(tzinfo=None)
                else:
                    order_time = created_at
            except (ValueError, TypeError):
                continue
            
            hours_since_order = (now - order_time).total_seconds() / 3600
            
            # Check each recovery interval
            for interval, hours in RECOVERY_INTERVALS.items():
                # Check if it's time to send this email (within a 1-hour window)
                if hours <= hours_since_order < hours + 1:
                    # Check if email already sent
                    recovery_key = f"{order_id}_{interval}"
                    existing = await db.abandoned_checkout_emails.find_one({
                        "recovery_key": recovery_key
                    })
                    
                    if existing:
                        continue  # Already sent
                    
                    logger.info(f"[Abandoned Checkout] Sending {interval} email for order {order_id}")
                    
                    # Send email
                    sent = await send_recovery_email(
                        db=db,
                        user_email=user_email,
                        user_name=user_name,
                        plan_name=plan_name,
                        amount=amount,
                        interval=interval
                    )
                    
                    # Record that email was sent
                    if sent:
                        await db.abandoned_checkout_emails.insert_one({
                            "recovery_key": recovery_key,
                            "order_id": order_id,
                            "user_email": user_email,
                            "interval": interval,
                            "sent_at": now
                        })
                        emails_sent += 1
        
        logger.info(f"[Abandoned Checkout] Completed. Sent {emails_sent} recovery emails.")
        client.close()
        
    except Exception as e:
        logger.error(f"[Abandoned Checkout] Error: {e}")


async def start_abandoned_checkout_scheduler(interval_minutes: int = 30):
    """Start the background abandoned checkout scheduler"""
    logger.info(f"[Abandoned Checkout] Starting scheduler with {interval_minutes} minute interval")
    
    while True:
        try:
            await process_abandoned_checkouts()
        except Exception as e:
            logger.error(f"[Abandoned Checkout] Error in scheduler loop: {e}")
        
        # Wait for next check
        await asyncio.sleep(interval_minutes * 60)
