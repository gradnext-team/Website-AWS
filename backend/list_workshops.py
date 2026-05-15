#!/usr/bin/env python3
"""
Helper script to list all workshops and their IDs
Usage: python3 list_workshops.py
"""
import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

async def list_workshops(filter_type="all"):
    """
    List workshops with their IDs and registration counts
    
    Args:
        filter_type: "all", "past", or "upcoming"
    """
    mongo_url = os.environ.get('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['gradnext']
    
    # Build query
    query = {}
    if filter_type == "past":
        query = {"is_past": True}
    elif filter_type == "upcoming":
        query = {"is_past": {"$ne": True}}
    
    print("=" * 90)
    if filter_type == "all":
        print("📋 ALL WORKSHOPS")
    elif filter_type == "past":
        print("📋 PAST WORKSHOPS")
    else:
        print("📋 UPCOMING WORKSHOPS")
    print("=" * 90)
    
    # Get workshops
    workshops = await db.workshops.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    if not workshops:
        print("\n⚠️  No workshops found")
        client.close()
        return
    
    print(f"\nFound {len(workshops)} workshop(s):\n")
    
    for i, workshop in enumerate(workshops, 1):
        workshop_id = workshop.get('id', 'N/A')
        title = workshop.get('title', 'Untitled')
        date = workshop.get('date', 'N/A')
        time = workshop.get('time', 'N/A')
        instructor = workshop.get('instructor', workshop.get('host', 'N/A'))
        is_past = workshop.get('is_past', False)
        
        # Get registration count
        reg_count = await db.workshop_registrations.count_documents({"workshop_id": workshop_id})
        
        # Get users with phone numbers
        if reg_count > 0:
            registrations = await db.workshop_registrations.find(
                {"workshop_id": workshop_id},
                {"_id": 0, "user_id": 1}
            ).to_list(1000)
            
            user_ids = [r.get("user_id") for r in registrations]
            phone_count = await db.users.count_documents({
                "id": {"$in": user_ids},
                "phone_number": {"$exists": True, "$nin": ["", None]}
            })
        else:
            phone_count = 0
        
        # Status
        status = "✅ Past" if is_past else "🔜 Upcoming"
        
        print(f"{i}. {status} | {title}")
        print(f"   📅 {date} at {time}")
        print(f"   👤 Instructor: {instructor}")
        print(f"   🆔 Workshop ID: {workshop_id}")
        print(f"   👥 Registrations: {reg_count} ({phone_count} with phone)")
        
        if reg_count > 0:
            print(f"   📱 Can send messages to: {phone_count} participants")
        
        print()
    
    print("=" * 90)
    print("\n💡 HOW TO USE:")
    print("   1. Copy the Workshop ID you want")
    print("   2. Use this command:")
    print("      curl -X POST 'https://app.gradnext.co/api/admin/workshops/{WORKSHOP_ID}/whatsapp-post-workshop' \\")
    print("           -H 'Cookie: auth_token=YOUR_TOKEN'")
    print("\n   OR add a button in your admin panel using the Workshop ID")
    print("=" * 90)
    
    client.close()

if __name__ == "__main__":
    # Check for filter argument
    filter_type = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    if filter_type not in ["all", "past", "upcoming"]:
        print("Usage: python3 list_workshops.py [all|past|upcoming]")
        sys.exit(1)
    
    asyncio.run(list_workshops(filter_type))
