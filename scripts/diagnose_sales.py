#!/usr/bin/env python3
"""
Sales Diagnostic Script
Run this on your production server to diagnose why subscription sales aren't showing.

Usage: python3 diagnose_sales.py
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def diagnose():
    # Connect to database
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 70)
    print("SALES DIAGNOSTIC REPORT")
    print(f"Database: {db_name}")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)
    
    # 1. Check payments collection
    print("\n" + "=" * 70)
    print("1. PAYMENTS COLLECTION (where subscription payments should be stored)")
    print("=" * 70)
    
    payments_total = await db.payments.count_documents({})
    payments_captured = await db.payments.count_documents({"status": "captured"})
    payments_subscription = await db.payments.count_documents({"status": "captured", "type": "subscription"})
    
    print(f"   Total records: {payments_total}")
    print(f"   Captured payments: {payments_captured}")
    print(f"   Subscription payments (captured): {payments_subscription}")
    
    if payments_total > 0:
        print("\n   Sample payment records:")
        samples = await db.payments.find({}).limit(3).to_list(3)
        for s in samples:
            print(f"   - ID: {s.get('id')}, User: {s.get('user_email')}, Amount: {s.get('amount')}, Status: {s.get('status')}, Type: {s.get('type')}")
    
    # 2. Check payment_orders collection
    print("\n" + "=" * 70)
    print("2. PAYMENT_ORDERS COLLECTION (for coaching/session purchases)")
    print("=" * 70)
    
    orders_total = await db.payment_orders.count_documents({})
    orders_paid = await db.payment_orders.count_documents({"status": {"$in": ["paid", "completed"]}})
    
    print(f"   Total records: {orders_total}")
    print(f"   Paid/Completed orders: {orders_paid}")
    
    # 3. Check webhook_logs
    print("\n" + "=" * 70)
    print("3. WEBHOOK_LOGS (Razorpay webhook events)")
    print("=" * 70)
    
    webhook_total = await db.webhook_logs.count_documents({})
    webhook_activated = await db.webhook_logs.count_documents({"event": "subscription.activated"})
    webhook_charged = await db.webhook_logs.count_documents({"event": "subscription.charged"})
    
    print(f"   Total webhook events: {webhook_total}")
    print(f"   subscription.activated events: {webhook_activated}")
    print(f"   subscription.charged events: {webhook_charged}")
    
    if webhook_total > 0:
        print("\n   Recent webhook events:")
        recent = await db.webhook_logs.find({}).sort("received_at", -1).limit(5).to_list(5)
        for w in recent:
            print(f"   - Event: {w.get('event')}, User: {w.get('user_id')}, Time: {w.get('received_at')}")
    
    # 4. Check users with paid subscriptions
    print("\n" + "=" * 70)
    print("4. USERS WITH PAID SUBSCRIPTIONS")
    print("=" * 70)
    
    # Users with non-free plans
    paid_plans = ["basic", "pro", "pro_monthly", "pro_yearly", "basic_monthly", "basic_yearly"]
    users_paid = await db.users.find({
        "$or": [
            {"plan": {"$in": paid_plans}},
            {"subscription.status": "active"},
            {"razorpay_subscription_id": {"$exists": True, "$ne": None}}
        ]
    }).to_list(100)
    
    print(f"   Users with paid plans or active subscriptions: {len(users_paid)}")
    
    for u in users_paid[:10]:
        sub = u.get("subscription", {})
        print(f"\n   User: {u.get('email')}")
        print(f"   - Plan: {u.get('plan')}")
        print(f"   - Plan Name: {u.get('plan_name')}")
        print(f"   - Subscription Status: {sub.get('status')}")
        print(f"   - Razorpay Sub ID: {sub.get('razorpay_subscription_id') or u.get('razorpay_subscription_id')}")
        print(f"   - Activated At: {sub.get('activated_at')}")
        print(f"   - Locked Price: {sub.get('locked_price')}")
    
    # 5. Check if there's a mismatch
    print("\n" + "=" * 70)
    print("5. DIAGNOSIS SUMMARY")
    print("=" * 70)
    
    if len(users_paid) > 0 and payments_subscription == 0:
        print("\n   ⚠️  ISSUE DETECTED: Users have paid subscriptions but no payment records!")
        print("\n   Possible causes:")
        print("   1. Payment recording was added after subscriptions were created")
        print("   2. The record_subscription_payment function is failing silently")
        print("   3. Webhook events aren't triggering payment recording")
        print("\n   Recommended actions:")
        print("   1. Check backend logs for 'Failed to record subscription payment' errors")
        print("   2. Run the backfill script to create payment records from existing subscriptions")
        print("   3. Test a new subscription to verify the flow works")
    elif len(users_paid) == 0:
        print("\n   ℹ️  No users with paid subscriptions found.")
        print("   This could be normal if this is a test environment.")
    else:
        print(f"\n   ✅ Found {payments_subscription} subscription payments for {len(users_paid)} paid users")
    
    # 6. Suggest backfill if needed
    if len(users_paid) > payments_subscription:
        print("\n" + "=" * 70)
        print("6. BACKFILL RECOMMENDATION")
        print("=" * 70)
        print(f"\n   Missing payment records: ~{len(users_paid) - payments_subscription}")
        print("   Run: python3 /app/scripts/backfill_payments.py")
    
    client.close()
    print("\n" + "=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(diagnose())
