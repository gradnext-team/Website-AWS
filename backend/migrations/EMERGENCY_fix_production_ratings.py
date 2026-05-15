"""
EMERGENCY FIX: Remove all 5.0 ratings from mentors with 0 sessions
This script is safe to run on PRODUCTION database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / '.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "test_database")


async def emergency_fix_production():
    """Remove 5.0 ratings from ALL mentors with 0 sessions"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("="*70)
    print("EMERGENCY FIX: Removing 5.0 ratings from mentors with 0 sessions")
    print("="*70)
    
    # Find ALL mentors with sessions_conducted = 0 OR sessions_done = 0
    # AND have a rating of 5.0 or 5
    problem_mentors = await db.mentors.find({
        "$or": [
            {"sessions_conducted": 0},
            {"sessions_done": 0},
            {"sessions_conducted": {"$exists": False}},
            {"sessions_done": {"$exists": False}}
        ],
        "rating": {"$in": [5.0, 5, "5.0", "5"]}
    }, {"_id": 0, "name": 1, "email": 1, "rating": 1, "sessions_conducted": 1, "sessions_done": 1}).to_list(None)
    
    print(f"\nFound {len(problem_mentors)} mentors with 0 sessions but 5.0 rating")
    
    if len(problem_mentors) == 0:
        print("✓ No mentors need fixing!")
        client.close()
        return
    
    print("\nMentors to fix:")
    for mentor in problem_mentors[:10]:
        print(f"  - {mentor.get('name', 'Unknown')} ({mentor.get('email')})")
        print(f"    Current rating: {mentor.get('rating')}")
        print(f"    Sessions: {mentor.get('sessions_conducted', 0)}")
    
    if len(problem_mentors) > 10:
        print(f"  ... and {len(problem_mentors) - 10} more")
    
    # Ask for confirmation
    print(f"\n⚠️  About to remove ratings from {len(problem_mentors)} mentors")
    confirmation = input("Type 'YES' to proceed: ")
    
    if confirmation != "YES":
        print("❌ Aborted")
        client.close()
        return
    
    # Fix all mentors
    fixed_count = 0
    for mentor in problem_mentors:
        result = await db.mentors.update_one(
            {"email": mentor["email"]},
            {
                "$unset": {"rating": ""},
                "$set": {
                    "sessions_conducted": mentor.get("sessions_conducted", 0),
                    "sessions_done": mentor.get("sessions_done", 0)
                }
            }
        )
        if result.modified_count > 0:
            fixed_count += 1
    
    print(f"\n✅ Fixed {fixed_count} mentors")
    print(f"Ratings removed, sessions_conducted preserved")
    
    # Verify
    remaining = await db.mentors.count_documents({
        "$or": [
            {"sessions_conducted": 0},
            {"sessions_done": 0}
        ],
        "rating": {"$in": [5.0, 5]}
    })
    
    print(f"\nVerification: {remaining} mentors still have problem")
    
    if remaining == 0:
        print("✅ All mentors fixed successfully!")
    else:
        print("⚠️  Some mentors still need fixing")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(emergency_fix_production())
