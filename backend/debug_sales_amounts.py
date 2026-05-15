"""
Debug script to check what amounts are actually stored in the database
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def debug_sales():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'gradnext')
    db = client[db_name]
    
    print("=" * 80)
    print("DEBUGGING SALES REVENUE CALCULATION")
    print("=" * 80)
    
    # Check payment_orders
    paid_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},
        {"_id": 0, "id": 1, "amount": 1, "base_amount": 1, "gst": 1, "status": 1, "plan_key": 1}
    ).limit(5).to_list(5)
    
    print(f"\n📊 payment_orders (paid/completed) - Sample of first 5:")
    print(f"Total count: {await db.payment_orders.count_documents({'status': {'$in': ['paid', 'completed']}})}")
    for i, order in enumerate(paid_orders, 1):
        print(f"\n  Transaction {i}:")
        print(f"    ID: {order.get('id', 'N/A')}")
        print(f"    Status: {order.get('status', 'N/A')}")
        print(f"    Plan: {order.get('plan_key', 'N/A')}")
        print(f"    Amount: ₹{order.get('amount', 0):,.2f}")
        print(f"    Base Amount: ₹{order.get('base_amount', 0):,.2f}")
        print(f"    GST: ₹{order.get('gst', 0):,.2f}")
    
    # Check payments collection
    captured_payments = await db.payments.find(
        {"status": "captured"},
        {"_id": 0, "id": 1, "amount": 1, "base_amount": 1, "gst": 1, "status": 1, "plan_key": 1}
    ).limit(5).to_list(5)
    
    print(f"\n\n📊 payments (captured) - Sample of first 5:")
    print(f"Total count: {await db.payments.count_documents({'status': 'captured'})}")
    for i, payment in enumerate(captured_payments, 1):
        print(f"\n  Transaction {i}:")
        print(f"    ID: {payment.get('id', 'N/A')}")
        print(f"    Status: {payment.get('status', 'N/A')}")
        print(f"    Plan: {payment.get('plan_key', 'N/A')}")
        print(f"    Amount: ₹{payment.get('amount', 0):,.2f}")
        print(f"    Base Amount: ₹{payment.get('base_amount', 0):,.2f}")
        print(f"    GST: ₹{payment.get('gst', 0):,.2f}")
    
    # Calculate what the sum would be
    print(f"\n\n💰 REVENUE CALCULATION:")
    print(f"=" * 80)
    
    # Get all amounts
    all_paid_orders = await db.payment_orders.find(
        {"status": {"$in": ["paid", "completed"]}},
        {"_id": 0, "amount": 1}
    ).to_list(10000)
    
    all_captured = await db.payments.find(
        {"status": "captured"},
        {"_id": 0, "amount": 1}
    ).to_list(10000)
    
    sum_orders = sum(order.get("amount", 0) for order in all_paid_orders)
    sum_payments = sum(payment.get("amount", 0) for payment in all_captured)
    
    print(f"Sum from payment_orders: ₹{sum_orders:,.2f} ({len(all_paid_orders)} transactions)")
    print(f"Sum from payments: ₹{sum_payments:,.2f} ({len(all_captured)} transactions)")
    print(f"Total (WITH double counting): ₹{sum_orders + sum_payments:,.2f}")
    print(f"Total transactions: {len(all_paid_orders) + len(all_captured)}")
    
    # Check if amounts might be in paisa
    print(f"\n\n🔍 CHECKING IF AMOUNTS ARE IN PAISA:")
    print(f"If amounts are in paisa (Razorpay format where ₹1 = 100 paisa):")
    print(f"  Sum from payment_orders: ₹{sum_orders/100:,.2f}")
    print(f"  Sum from payments: ₹{sum_payments/100:,.2f}")
    print(f"  Total (WITH double counting): ₹{(sum_orders + sum_payments)/100:,.2f}")
    
    # Check for any non-standard status
    print(f"\n\n⚠️  CHECKING FOR OTHER STATUSES:")
    all_statuses_orders = await db.payment_orders.distinct("status")
    all_statuses_payments = await db.payments.distinct("status")
    print(f"All statuses in payment_orders: {all_statuses_orders}")
    print(f"All statuses in payments: {all_statuses_payments}")
    
    # Count by status
    for status in all_statuses_orders:
        count = await db.payment_orders.count_documents({"status": status})
        print(f"  payment_orders.{status}: {count}")
    
    for status in all_statuses_payments:
        count = await db.payments.count_documents({"status": status})
        print(f"  payments.{status}: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(debug_sales())
