"""
Migration: Remove default 5.0 rating for mentors with 0 sessions
Sets rating to None for mentors who haven't conducted any sessions
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "test_database")


async def fix_mentor_ratings():
    """Remove default rating for mentors with 0 sessions"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔄 Fixing mentor ratings for mentors with 0 sessions...")
    
    # Find mentors with 0 sessions and a rating of 5.0
    mentors_to_fix = await db.mentors.find({
        "sessions_conducted": 0,
        "rating": {"$exists": True}
    }, {"_id": 0, "id": 1, "name": 1, "rating": 1, "sessions_conducted": 1}).to_list(None)
    
    print(f"Found {len(mentors_to_fix)} mentors with 0 sessions and ratings")
    
    updated_count = 0
    for mentor in mentors_to_fix:
        # Remove the rating field (set to None/null)
        result = await db.mentors.update_one(
            {"id": mentor["id"]},
            {"$unset": {"rating": ""}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"  ✓ Removed rating for {mentor.get('name', mentor['id'])} (was {mentor.get('rating')})")
    
    print(f"\n✅ Migration complete: Updated {updated_count} mentors")
    print(f"Mentors with 0 sessions now have no rating displayed")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_mentor_ratings())
