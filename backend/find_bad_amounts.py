"""
Find transactions with suspiciously large amounts in payments collection
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def find_bad_amounts():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'gradnext')
    db = client[db_name]
    
    # Get all captured payments
    payments = await db.payments.find(
        {"status": "captured"},
        {"_id": 0, "id": 1, "user_id": 1, "amount": 1, "plan_key": 1, "amount_in_paise": 1}
    ).sort("amount", -1).to_list(10000)  # Sort by amount descending
    
    print(f"Total payments: {len(payments)}")
    print(f"\n{'='*80}")
    print(f"TOP 20 LARGEST AMOUNTS:")
    print(f"{'='*80}\n")
    
    total_sum = 0
    for i, payment in enumerate(payments[:20], 1):
        amount = payment.get("amount", 0)
        amount_in_paise = payment.get("amount_in_paise", "N/A")
        total_sum += amount
        
        print(f"{i}. ID: {payment.get('id', 'N/A')[:30]}")
        print(f"   Amount: ₹{amount:,.2f}")
        print(f"   Amount in Paisa field: {amount_in_paise}")
        print(f"   Plan: {payment.get('plan_key', 'N/A')}")
        print(f"   User: {payment.get('user_id', 'N/A')}")
        
        # Check if this looks like paisa
        if amount > 10000:
            print(f"   ⚠️  SUSPICIOUS! If in paisa: ₹{amount/100:,.2f}")
        print()
    
    print(f"\n{'='*80}")
    print(f"STATISTICS:")
    print(f"{'='*80}")
    print(f"Sum of top 20: ₹{total_sum:,.2f}")
    print(f"Total sum all payments: ₹{sum(p.get('amount', 0) for p in payments):,.2f}")
    
    # Check how many have amount_in_paise field
    with_paise_field = [p for p in payments if p.get("amount_in_paise") is not None]
    print(f"\nPayments with 'amount_in_paise' field: {len(with_paise_field)}")
    print(f"Payments WITHOUT 'amount_in_paise' field: {len(payments) - len(with_paise_field)}")
    
    # Check for amounts > 10k (likely in paisa)
    large_amounts = [p for p in payments if p.get("amount", 0) > 10000]
    print(f"\nPayments with amount > ₹10,000: {len(large_amounts)}")
    if large_amounts:
        print(f"Sum of these large amounts: ₹{sum(p.get('amount', 0) for p in large_amounts):,.2f}")
        print(f"If these are in paisa: ₹{sum(p.get('amount', 0) for p in large_amounts) / 100:,.2f}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(find_bad_amounts())
