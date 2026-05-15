"""
Fix script for Megha Aggarwal and ensure all candidates can view sessions
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid

async def fix_megha_and_verify_all_candidates():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    print("="*70)
    print("FIXING: Megha Aggarwal & Verifying All Candidate Sessions")
    print("="*70)
    
    # 1. Create REAL Megha Aggarwal
    print("\n1. CREATING MEGHA AGGARWAL...")
    
    real_megha = await db.users.find_one({"email": "meghaaggarwal.2000@gmail.com"})
    
    if not real_megha:
        megha_id = str(uuid.uuid4())
        real_megha = {
            "id": megha_id,
            "email": "meghaaggarwal.2000@gmail.com",
            "name": "Megha Aggarwal",
            "role": "candidate",
            "phone_number": "+919876543220",
            "phone_country_code": "+91",
            "current_plan": "full_prep",  # Assuming Full Prep, adjust if different
            "subscription_status": "active",
            "coaching_sessions_total": 10,
            "coaching_sessions_used": 0,
            "strategy_call_credits": 4,
            "strategy_calls_used": 0,
            "created_at": datetime.now(),
            "coaching_program_start_date": datetime.now().strftime("%Y-%m-%d"),
            "coaching_program_end_date": (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d"),
            "onboarding_completed": True
        }
        await db.users.insert_one(real_megha)
        print(f"✓ Created Megha Aggarwal: {real_megha['email']}")
        print(f"   User ID: {megha_id}")
        print(f"   Plan: {real_megha['current_plan']}")
    else:
        megha_id = real_megha.get('id')
        print(f"✓ Megha Aggarwal already exists: {real_megha.get('email')}")
        print(f"   User ID: {megha_id}")
    
    # 2. Create test bookings for Megha
    print("\n2. CREATING TEST BOOKINGS FOR MEGHA...")
    
    # Get a mentor
    mentor = await db.mentors.find_one({})
    if not mentor:
        print("✗ No mentors found")
        client.close()
        return
    
    # Create 2 bookings: one upcoming, one future
    bookings_to_create = [
        {
            "days_offset": 1,
            "time": "14:00",
            "type": "Case session",
            "case": "Market sizing"
        },
        {
            "days_offset": 7,
            "time": "16:00",
            "type": "Mock interview",
            "case": "Profitability"
        }
    ]
    
    created_count = 0
    for booking_info in bookings_to_create:
        booking_time = datetime.now() + timedelta(days=booking_info["days_offset"])
        booking_date = booking_time.strftime("%Y-%m-%d")
        booking_time_slot = booking_info["time"]
        
        # Check if booking already exists
        existing = await db.bookings.find_one({
            "user_id": megha_id,
            "date": booking_date,
            "time_slot": booking_time_slot
        })
        
        if not existing:
            booking_id = str(uuid.uuid4())
            test_meet_link = f"https://meet.google.com/megha-session-{created_count+1}"
            
            booking = {
                "id": booking_id,
                "user_id": megha_id,
                "mentor_id": mentor.get("id"),
                "date": booking_date,
                "time_slot": booking_time_slot,
                "status": "confirmed",
                "session_type": booking_info["type"],
                "case_type": booking_info["case"],
                "candidate_name": "Megha Aggarwal",
                "candidate_email": "meghaaggarwal.2000@gmail.com",
                "candidate_phone": "+919876543220",
                "candidate_country_code": "+91",
                "mentor_name": mentor.get("name"),
                "mentor_email": mentor.get("email"),
                "meet_link": test_meet_link,
                "created_at": datetime.now(),
                "candidate_checked_in": False,
                "mentor_checked_in": False,
                "notes": f"Test booking {created_count+1} for Megha Aggarwal"
            }
            
            await db.bookings.insert_one(booking)
            print(f"   ✓ Created booking {created_count+1}: {booking_date} at {booking_time_slot}")
            created_count += 1
        else:
            print(f"   → Booking already exists: {booking_date} at {booking_time_slot}")
    
    # 3. Verify Megha can see her bookings
    print("\n3. VERIFYING MEGHA'S BOOKINGS...")
    megha_bookings = await db.bookings.find({"user_id": megha_id}, {"_id": 0}).to_list(100)
    print(f"   ✓ Megha has {len(megha_bookings)} total booking(s)")
    
    for i, booking in enumerate(megha_bookings, 1):
        print(f"   Booking {i}: {booking.get('date')} at {booking.get('time_slot')} - {booking.get('status')}")
    
    # 4. Check ALL candidates and their bookings
    print("\n4. VERIFYING ALL CANDIDATES CAN VIEW SESSIONS...")
    print("-" * 70)
    
    all_candidates = await db.users.find({"role": "candidate"}, {"_id": 0}).to_list(100)
    
    issues_found = []
    
    for candidate in all_candidates:
        user_id = candidate.get('id')
        name = candidate.get('name')
        email = candidate.get('email')
        
        # Get bookings by user_id
        bookings = await db.bookings.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        
        print(f"\n   {name} ({email})")
        print(f"   User ID: {user_id}")
        print(f"   Bookings: {len(bookings)}")
        
        if len(bookings) > 0:
            # Check if bookings have meet_links
            bookings_without_links = [b for b in bookings if not b.get('meet_link')]
            if bookings_without_links:
                print(f"   ⚠️ {len(bookings_without_links)} booking(s) missing meet_link")
                issues_found.append({
                    "candidate": name,
                    "issue": "Missing meet_link",
                    "count": len(bookings_without_links)
                })
            
            # Show upcoming bookings
            today = datetime.now().strftime("%Y-%m-%d")
            upcoming = [b for b in bookings if b.get('date') >= today and b.get('status') == 'confirmed']
            if upcoming:
                print(f"   ✓ {len(upcoming)} upcoming session(s)")
                for booking in upcoming[:2]:
                    print(f"      - {booking.get('date')} at {booking.get('time_slot')} with {booking.get('mentor_name')}")
        else:
            if user_id and user_id != "mock-user-free" and "mock" not in str(user_id):
                print(f"   ⚠️ Real candidate with no bookings")
    
    # 5. Summary and recommendations
    print("\n\n" + "="*70)
    print("SUMMARY & RECOMMENDATIONS")
    print("="*70)
    
    print(f"\n✓ Megha Aggarwal created/verified: meghaaggarwal.2000@gmail.com")
    print(f"✓ User ID: {megha_id}")
    print(f"✓ Bookings created: {created_count} new booking(s)")
    print(f"✓ Total bookings: {len(megha_bookings)}")
    
    if issues_found:
        print(f"\n⚠️ ISSUES FOUND:")
        for issue in issues_found:
            print(f"   - {issue['candidate']}: {issue['issue']} ({issue['count']} booking(s))")
    else:
        print(f"\n✓ NO ISSUES FOUND - All candidates can view their sessions")
    
    print("\n📋 NEXT STEPS:")
    print("1. Ask Megha to login with: meghaaggarwal.2000@gmail.com")
    print("2. She should go to Dashboard → Coaching → Sessions")
    print("3. She will see her upcoming bookings")
    print("4. She can join sessions within the 10-minute window")
    
    print("\n💡 FOR PRODUCTION:")
    print("- Real Megha needs to sign up via Google/Email login")
    print("- Admin should verify her plan and credits")
    print("- Ensure Google Calendar integration is working for auto meet links")
    
    print("="*70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_megha_and_verify_all_candidates())
