"""
Quick fix script to manually add meet links to bookings that don't have them.
Usage: python3 add_meet_link_to_booking.py <booking_id> <meet_link>
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys

async def add_meet_link(booking_id, meet_link):
    """Add meet_link to a specific booking"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    # Find the booking
    booking = await db.bookings.find_one({"id": booking_id})
    
    if not booking:
        # Try finding by _id if not found by id field
        from bson import ObjectId
        try:
            booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        except:
            pass
    
    if not booking:
        print(f"❌ Booking not found: {booking_id}")
        client.close()
        return False
    
    print(f"Found booking:")
    print(f"  ID: {booking.get('id') or booking_id}")
    print(f"  Date: {booking.get('date')}")
    print(f"  Time: {booking.get('time_slot') or booking.get('time')}")
    print(f"  Candidate: {booking.get('candidate_name')}")
    print(f"  Mentor: {booking.get('mentor_name')}")
    print()
    
    # Update the booking
    result = await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {"meet_link": meet_link}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Successfully added meet link!")
        print(f"   Link: {meet_link}")
        client.close()
        return True
    else:
        print(f"❌ Failed to update booking")
        client.close()
        return False

async def list_bookings_without_links():
    """List all bookings without meet links"""
    
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    from datetime import datetime, timedelta
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get bookings without meet_link
    bookings = await db.bookings.find({
        "$or": [
            {"meet_link": {"$exists": False}},
            {"meet_link": None},
            {"meet_link": ""}
        ],
        "date": {"$gte": today}  # Only future bookings
    }).to_list(50)
    
    if len(bookings) == 0:
        print("✅ All upcoming bookings have meet links!")
        client.close()
        return
    
    print(f"Found {len(bookings)} upcoming bookings without meet links:\n")
    
    for i, booking in enumerate(bookings, 1):
        booking_id = booking.get("id") or str(booking.get("_id"))
        print(f"{i}. Booking ID: {booking_id}")
        print(f"   Date: {booking.get('date')}, Time: {booking.get('time_slot') or booking.get('time')}")
        print(f"   Candidate: {booking.get('candidate_name')}")
        print(f"   Mentor: {booking.get('mentor_name')}")
        print(f"   Status: {booking.get('status')}")
        print()
    
    client.close()

if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments - list bookings
        print("Listing bookings without meet links...\n")
        asyncio.run(list_bookings_without_links())
        print("\nUsage: python3 add_meet_link_to_booking.py <booking_id> <meet_link>")
    elif len(sys.argv) == 3:
        # Add meet link
        booking_id = sys.argv[1]
        meet_link = sys.argv[2]
        asyncio.run(add_meet_link(booking_id, meet_link))
    else:
        print("Usage: python3 add_meet_link_to_booking.py <booking_id> <meet_link>")
        print("Or run without arguments to list bookings without meet links")
