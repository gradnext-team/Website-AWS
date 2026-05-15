"""
Script to backfill missing meet_links for existing bookings.
This fixes the issue where candidates cannot join sessions because bookings don't have meet links.
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import sys

# Add backend to path
sys.path.insert(0, '/app/backend')

from services.calendar_service import create_coaching_session_event

async def backfill_meet_links():
    """Add meet_links to bookings that don't have them"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    # Find all bookings without meet_link
    bookings_without_link = await db.bookings.find({
        "meet_link": {"$exists": False}
    }).to_list(1000)
    
    print(f"Found {len(bookings_without_link)} bookings without meet_link")
    print()
    
    if len(bookings_without_link) == 0:
        print("✓ All bookings already have meet links!")
        client.close()
        return
    
    fixed_count = 0
    failed_count = 0
    
    for booking in bookings_without_link:
        booking_id = booking.get("id") or str(booking.get("_id"))
        date = booking.get("date")
        time_slot = booking.get("time_slot") or booking.get("time")
        
        print(f"Processing booking: {booking_id}")
        print(f"  Date: {date}, Time: {time_slot}")
        
        # Get mentor and candidate details
        mentor_id = booking.get("mentor_id")
        user_id = booking.get("user_id")
        
        try:
            # Get mentor
            mentor = await db.mentors.find_one({"id": mentor_id}) if mentor_id else None
            if not mentor:
                print(f"  ⚠ Mentor not found (id: {mentor_id}), skipping...")
                failed_count += 1
                continue
            
            # Get candidate
            candidate = await db.users.find_one({"id": user_id}) if user_id else None
            if not candidate:
                candidate = {"name": booking.get("candidate_name", "Candidate"), "email": booking.get("candidate_email", "")}
            
            mentor_name = mentor.get("name", "Mentor")
            mentor_email = mentor.get("email", "")
            candidate_name = candidate.get("name", "Candidate")
            candidate_email = candidate.get("email", "")
            
            session_type = booking.get("session_type", "Coaching Session")
            case_type = booking.get("case_type", "")
            
            calendar_notes = f"Session Type: {session_type}"
            if case_type:
                calendar_notes += f"\nCase Type: {case_type}"
            
            # Create calendar event with Google Meet link
            print(f"  Creating Google Meet link...")
            calendar_result = create_coaching_session_event(
                mentor_name=mentor_name,
                mentor_email=mentor_email,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                session_date=date,
                session_time=time_slot,
                duration_minutes=45,
                session_notes=calendar_notes
            )
            
            if calendar_result and calendar_result.get("meet_link"):
                meet_link = calendar_result.get("meet_link")
                
                # Update the booking
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {
                        "meet_link": meet_link,
                        "calendar_event_id": calendar_result.get("event_id"),
                        "calendar_html_link": calendar_result.get("html_link")
                    }}
                )
                
                print(f"  ✓ Meet link added: {meet_link[:50]}...")
                fixed_count += 1
            else:
                print(f"  ✗ Failed to create meet link (no result)")
                failed_count += 1
                
        except Exception as e:
            print(f"  ✗ Error: {e}")
            failed_count += 1
        
        print()
    
    print("\n" + "="*60)
    print("SUMMARY:")
    print(f"  Total processed: {len(bookings_without_link)}")
    print(f"  Successfully fixed: {fixed_count}")
    print(f"  Failed: {failed_count}")
    print("="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(backfill_meet_links())
