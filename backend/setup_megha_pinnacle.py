"""
Create Megha user and investigate Pinnacle program functionality
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid

async def setup_megha_and_test_pinnacle():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    print("="*70)
    print("SETUP: Creating Megha & Testing Pinnacle Functionality")
    print("="*70)
    
    # 1. Create or find Megha
    print("\n1. CREATING/FINDING MEGHA...")
    megha = await db.users.find_one({"email": "megha@gradnext.co"})
    
    if not megha:
        megha_id = str(uuid.uuid4())
        megha = {
            "id": megha_id,
            "email": "megha@gradnext.co",
            "name": "Megha Sharma",
            "role": "candidate",
            "phone_number": "+919876543211",
            "phone_country_code": "+91",
            "current_plan": "pinnacle",
            "subscription_status": "active",
            "coaching_sessions_total": -1,  # Unlimited
            "coaching_sessions_used": 0,
            "strategy_call_credits": -1,  # Unlimited
            "strategy_calls_used": 0,
            "created_at": datetime.now(),
            "coaching_program_start_date": datetime.now().strftime("%Y-%m-%d"),
            "coaching_program_end_date": (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d"),
        }
        await db.users.insert_one(megha)
        print(f"✓ Created Megha: {megha['email']}")
    else:
        megha_id = megha.get('id')
        print(f"✓ Found Megha: {megha.get('email')}")
    
    # Update Megha to ensure she has Pinnacle access
    await db.users.update_one(
        {"id": megha_id},
        {"$set": {
            "current_plan": "pinnacle",
            "subscription_status": "active",
            "coaching_sessions_total": -1,
            "strategy_call_credits": -1,
        }}
    )
    print(f"✓ Updated Megha with Pinnacle plan")
    
    # 2. Create a test booking for Megha
    print("\n2. CREATING TEST BOOKING FOR MEGHA...")
    
    # Get a mentor
    mentor = await db.mentors.find_one({})
    if not mentor:
        print("✗ No mentors found")
        client.close()
        return
    
    # Create booking
    now = datetime.now()
    booking_time = now + timedelta(minutes=10)
    booking_date = booking_time.strftime("%Y-%m-%d")
    booking_time_slot = booking_time.strftime("%H:%M")
    
    booking_id = str(uuid.uuid4())
    test_meet_link = "https://meet.google.com/megha-test-session"
    
    booking = {
        "id": booking_id,
        "user_id": megha_id,
        "mentor_id": mentor.get("id"),
        "date": booking_date,
        "time_slot": booking_time_slot,
        "status": "confirmed",
        "session_type": "Case session",
        "case_type": "Profitability",
        "candidate_name": "Megha Sharma",
        "candidate_email": "megha@gradnext.co",
        "candidate_phone": "+919876543211",
        "candidate_country_code": "+91",
        "mentor_name": mentor.get("name"),
        "mentor_email": mentor.get("email"),
        "meet_link": test_meet_link,
        "created_at": datetime.now(),
        "candidate_checked_in": False,
        "mentor_checked_in": False,
        "notes": "Test booking for Megha (Pinnacle user)"
    }
    
    await db.bookings.insert_one(booking)
    print(f"✓ Created booking for Megha")
    print(f"   Date: {booking_date} at {booking_time_slot}")
    print(f"   Mentor: {mentor.get('name')}")
    print(f"   Meet Link: {test_meet_link}")
    
    # 3. Check Pinnacle plan configuration
    print("\n3. PINNACLE PLAN DETAILS...")
    pinnacle_plan = await db.plans.find_one({"name": "Pinnacle"}, {"_id": 0})
    
    if pinnacle_plan:
        features = pinnacle_plan.get('features', {})
        print(f"✓ Pinnacle Plan Configuration:")
        print(f"   Coaching Sessions: {features.get('coaching_sessions', 'N/A')}")
        print(f"   Strategy Calls: {features.get('strategy_calls', 'N/A')}")
        print(f"   Peer Sessions/Month: {features.get('peer_sessions_per_month', 'N/A')}")
        print(f"   Dedicated Coach: {features.get('dedicated_coach', False)}")
        print(f"   Priority Support: {features.get('priority_support', False)}")
        
        # Check if -1 means unlimited
        coaching = features.get('coaching_sessions')
        if coaching == -1:
            print(f"   ✓ Unlimited coaching sessions enabled")
        
        strategy = features.get('strategy_calls')
        if strategy == -1:
            print(f"   ✓ Unlimited strategy calls enabled")
    
    # 4. Verify Megha can see her bookings
    print("\n4. VERIFYING MEGHA'S ACCESS...")
    megha_bookings = await db.bookings.find({"user_id": megha_id}, {"_id": 0}).to_list(100)
    print(f"✓ Megha has {len(megha_bookings)} booking(s)")
    
    # 5. Check add-on functionality for Pinnacle
    print("\n5. PINNACLE ADD-ON SESSION LOGIC...")
    print("   NOTE: Pinnacle users should have:")
    print("   - Unlimited coaching sessions (coaching_sessions_total = -1)")
    print("   - Unlimited strategy calls (strategy_call_credits = -1)")
    print("   - No need to purchase add-ons")
    
    megha_updated = await db.users.find_one({"id": megha_id}, {"_id": 0})
    print(f"\n   Megha's Current Credits:")
    print(f"   - Coaching Sessions Total: {megha_updated.get('coaching_sessions_total')}")
    print(f"   - Coaching Sessions Used: {megha_updated.get('coaching_sessions_used', 0)}")
    print(f"   - Strategy Call Credits: {megha_updated.get('strategy_call_credits')}")
    print(f"   - Strategy Calls Used: {megha_updated.get('strategy_calls_used', 0)}")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"✓ Megha created/updated: megha@gradnext.co")
    print(f"✓ Plan: Pinnacle (unlimited sessions)")
    print(f"✓ Test booking created: {booking_date} at {booking_time_slot}")
    print(f"✓ Megha can now log in and see her session")
    print("\nTo test:")
    print("1. Login as Megha (megha@gradnext.co) via /test-login")
    print("2. Go to Dashboard → Coaching → Sessions")
    print("3. Should see the upcoming booking")
    print("4. Can join when within the 10-minute window")
    print("="*70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_megha_and_test_pinnacle())
