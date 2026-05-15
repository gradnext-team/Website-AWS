"""
Create a test booking with meet link for testing candidate access
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid

async def create_test_booking():
    """Create a test booking with meet link"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    # Get a test candidate
    candidate = await db.users.find_one({"email": "aarav@example.com"})
    if not candidate:
        print("❌ Test candidate not found. Creating one...")
        candidate = {
            "id": str(uuid.uuid4()),
            "email": "aarav@example.com",
            "name": "Aarav Agarwal",
            "role": "candidate",
            "phone_number": "+919876543210",
            "phone_country_code": "+91",
            "created_at": datetime.now()
        }
        await db.users.insert_one(candidate)
        print(f"✓ Created test candidate: {candidate['name']}")
    
    # Get a test mentor
    mentor = await db.mentors.find_one({})
    if not mentor:
        print("❌ No mentors found in database")
        client.close()
        return None
    
    print(f"✓ Using mentor: {mentor.get('name')}")
    
    # Create a booking for tomorrow at a joinable time (current time + 5 minutes)
    now = datetime.now()
    booking_time = now + timedelta(minutes=5)
    booking_date = booking_time.strftime("%Y-%m-%d")
    booking_time_slot = booking_time.strftime("%H:%M")
    
    # Create test booking
    booking_id = str(uuid.uuid4())
    test_meet_link = "https://meet.google.com/abc-defg-hij"  # Dummy meet link
    
    booking = {
        "id": booking_id,
        "user_id": candidate.get("id"),
        "mentor_id": mentor.get("id"),
        "date": booking_date,
        "time_slot": booking_time_slot,
        "status": "confirmed",
        "session_type": "Case session",
        "case_type": "Market sizing",
        "candidate_name": candidate.get("name"),
        "candidate_email": candidate.get("email"),
        "candidate_phone": candidate.get("phone_number"),
        "candidate_country_code": candidate.get("phone_country_code", "+91"),
        "mentor_name": mentor.get("name"),
        "mentor_email": mentor.get("email"),
        "mentor_phone": mentor.get("phone_number"),
        "mentor_country_code": mentor.get("phone_country_code", "+91"),
        "meet_link": test_meet_link,  # ✓ This is the critical field
        "created_at": datetime.now(),
        "candidate_checked_in": False,
        "mentor_checked_in": False,
        "notes": "Test booking for verifying meet link access"
    }
    
    # Insert booking
    await db.bookings.insert_one(booking)
    
    print("\n" + "="*60)
    print("✅ TEST BOOKING CREATED SUCCESSFULLY")
    print("="*60)
    print(f"Booking ID: {booking_id}")
    print(f"Candidate: {candidate.get('name')} ({candidate.get('email')})")
    print(f"Mentor: {mentor.get('name')}")
    print(f"Date: {booking_date}")
    print(f"Time: {booking_time_slot}")
    print(f"Meet Link: {test_meet_link}")
    print(f"Status: {booking['status']}")
    print(f"\n⏰ Session is joinable in ~5 minutes (10 min window before session)")
    print("="*60)
    
    client.close()
    return booking_id

if __name__ == "__main__":
    asyncio.run(create_test_booking())
