#!/usr/bin/env python3
"""
Backfill Payment Records Script
Creates payment records for existing subscriptions that don't have them.

Usage: python3 backfill_payments.py [--dry-run]

Options:
  --dry-run    Show what would be created without actually creating records
"""

import asyncio
import os
import sys
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def backfill_payments(dry_run=False):
    # Connect to database
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 70)
    print("BACKFILL PAYMENT RECORDS")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Database: {db_name}")
    print("=" * 70)
    
    # Get all users with active/paid subscriptions
    users = await db.users.find({
        "$or": [
            {"subscription.status": "active"},
            {"subscription.razorpay_subscription_id": {"$exists": True, "$ne": None}},
            {"plan": {"$nin": ["free", "free_trial", None, ""]}}
        ]
    }).to_list(1000)
    
    print(f"\nFound {len(users)} users with subscriptions to check")
    
    created_count = 0
    skipped_count = 0
    
    for user in users:
        user_id = user.get("id")
        email = user.get("email")
        subscription = user.get("subscription", {})
        
        # Skip if no subscription data
        if not subscription and not user.get("razorpay_subscription_id"):
            skipped_count += 1
            continue
        
        razorpay_sub_id = subscription.get("razorpay_subscription_id") or user.get("razorpay_subscription_id")
        
        # Check if payment record already exists
        existing = await db.payments.find_one({
            "$or": [
                {"user_id": user_id, "type": "subscription"},
                {"razorpay_subscription_id": razorpay_sub_id}
            ]
        })
        
        if existing:
            print(f"  SKIP: {email} - Payment record already exists")
            skipped_count += 1
            continue
        
        # Get amount info
        total_amount = subscription.get("locked_price") or subscription.get("base_price") or 0
        
        # Skip if no amount (likely manual upgrade or invalid)
        if not total_amount:
            # Try to get from plan
            plan_key = subscription.get("plan_key") or user.get("plan")
            if plan_key:
                plan = await db.plans.find_one({"plan_key": plan_key})
                if plan:
                    billing_cycle = subscription.get("billing_cycle", "monthly")
                    if billing_cycle == "yearly":
                        total_amount = plan.get("yearly_price", 0)
                    else:
                        total_amount = plan.get("monthly_price", 0)
        
        if not total_amount:
            print(f"  SKIP: {email} - No amount found")
            skipped_count += 1
            continue
        
        # Calculate GST
        base_amount = round(total_amount / 1.18, 2)
        gst_amount = round(total_amount - base_amount, 2)
        
        # Create payment record
        activated_at = subscription.get("activated_at") or user.get("created_at") or datetime.now(timezone.utc).isoformat()
        
        payment_record = {
            "id": f"backfill-{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "user_email": email,
            "user_name": user.get("name"),
            "razorpay_subscription_id": razorpay_sub_id,
            "razorpay_payment_id": None,  # Not available for backfill
            "type": "subscription",
            "payment_type": "first_payment",
            "plan_key": subscription.get("plan_key") or user.get("plan"),
            "plan_name": subscription.get("plan_name") or user.get("plan_name"),
            "billing_cycle": subscription.get("billing_cycle", "monthly"),
            "amount": total_amount,
            "base_amount": base_amount,
            "gst_amount": gst_amount,
            "currency": "INR",
            "status": "captured",
            "created_at": activated_at,
            "captured_at": activated_at,
            "backfilled": True,
            "backfilled_at": datetime.now(timezone.utc).isoformat(),
            "notes": {"source": "backfill_script"}
        }
        
        print(f"\n  CREATE: {email}")
        print(f"    Plan: {payment_record['plan_key']}")
        print(f"    Amount: ₹{total_amount}")
        print(f"    Date: {activated_at}")
        
        if not dry_run:
            await db.payments.insert_one(payment_record)
            print(f"    ✅ Created payment record")
        else:
            print(f"    [DRY RUN - would create]")
        
        created_count += 1
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total users checked: {len(users)}")
    print(f"  Payment records created: {created_count}")
    print(f"  Skipped (already exists or no data): {skipped_count}")
    
    if dry_run and created_count > 0:
        print(f"\n  ℹ️  Run without --dry-run to actually create {created_count} records")
    
    client.close()

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(backfill_payments(dry_run))
