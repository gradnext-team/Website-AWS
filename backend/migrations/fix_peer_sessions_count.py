"""
Migration: Fix peer_sessions_done to show total completed sessions instead of feedback count
Updates all peer profiles to reflect actual completed session counts
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


async def fix_peer_sessions_count():
    """Update all peer profiles with correct completed session counts"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔄 Fixing peer_sessions_done counts...")
    
    # Get all peer profiles
    profiles = await db.peer_profiles.find({}, {"_id": 0, "user_id": 1, "name": 1}).to_list(None)
    
    updated_count = 0
    for profile in profiles:
        user_id = profile["user_id"]
        
        # Count total completed sessions for this user (either as requester or partner)
        completed_sessions = await db.peer_sessions.count_documents({
            "$or": [
                {"requester_id": user_id},
                {"partner_id": user_id}
            ],
            "status": "completed"
        })
        
        # Count sessions with feedback for rating calculation
        sessions_with_feedback = await db.peer_sessions.find({
            "$or": [
                {"requester_id": user_id},
                {"partner_id": user_id}
            ],
            "status": "completed"
        }).to_list(100)
        
        total_rating = 0
        rating_count = 0
        for s in sessions_with_feedback:
            if s["requester_id"] == user_id and s.get("partner_feedback"):
                total_rating += s["partner_feedback"].get("average_rating", s["partner_feedback"].get("rating_overall", 5))
                rating_count += 1
            elif s["partner_id"] == user_id and s.get("requester_feedback"):
                total_rating += s["requester_feedback"].get("average_rating", s["requester_feedback"].get("rating_overall", 5))
                rating_count += 1
        
        # Update profile
        update_doc = {"peer_sessions_done": completed_sessions}
        
        if rating_count > 0:
            avg_rating = round(total_rating / rating_count, 1)
            update_doc["peer_rating"] = avg_rating
        
        if completed_sessions > 0 or rating_count > 0:
            await db.peer_profiles.update_one(
                {"user_id": user_id},
                {"$set": update_doc}
            )
            updated_count += 1
            print(f"  ✓ Updated {profile.get('name', user_id)}: {completed_sessions} sessions, rating: {update_doc.get('peer_rating', 'NA')}")
    
    print(f"\n✅ Migration complete: Updated {updated_count} peer profiles")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_peer_sessions_count())
