"""
Fix Case Structuring drill difficulty values in MongoDB
Change the actual difficulty field to match the time-based labels
"""
import sys
import asyncio
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "gradnext_db")


async def fix_case_structuring_difficulty():
    """
    Fix Case Structuring drill difficulty values to match time-based labels:
    - 5 min drills (currently 'advanced') → change to 'beginner' (Easy)
    - 10 min drills (currently 'beginner') → change to 'intermediate' (Medium)
    - 15 min drills (currently 'intermediate') → change to 'advanced' (Hard)
    """
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔧 Fixing Case Structuring drill difficulty values...")
    
    # Get all Case Structuring drills
    cs_drills = await db.ai_drills.find(
        {"drill_type": "case_structuring"},
        {"_id": 0, "id": 1, "difficulty": 1}
    ).to_list(1000)
    
    print(f"Found {len(cs_drills)} Case Structuring drills")
    
    # Determine which drills need which difficulty based on their ID prefix
    # cs-a-* should be "beginner" (Easy, 5 min)
    # cs-b-* should be "intermediate" (Medium, 10 min)
    # cs-i-* should be "advanced" (Hard, 15 min)
    
    updates = {
        "cs-a": "beginner",   # Advanced → Beginner (Easy, 5 min)
        "cs-b": "intermediate",  # Beginner → Intermediate (Medium, 10 min)
        "cs-i": "advanced"    # Intermediate → Advanced (Hard, 15 min)
    }
    
    updated_count = 0
    for drill in cs_drills:
        drill_id = drill["id"]
        prefix = drill_id[:4]  # Get cs-a, cs-b, or cs-i
        
        new_difficulty = updates.get(prefix)
        if new_difficulty and drill["difficulty"] != new_difficulty:
            await db.ai_drills.update_one(
                {"id": drill_id},
                {"$set": {"difficulty": new_difficulty}}
            )
            print(f"  ✓ {drill_id}: {drill['difficulty']} → {new_difficulty}")
            updated_count += 1
    
    print(f"\n✅ Updated {updated_count} Case Structuring drills")
    
    # Verify the changes
    print("\n📊 Verification:")
    easy = await db.ai_drills.count_documents({"drill_type": "case_structuring", "difficulty": "beginner"})
    medium = await db.ai_drills.count_documents({"drill_type": "case_structuring", "difficulty": "intermediate"})
    hard = await db.ai_drills.count_documents({"drill_type": "case_structuring", "difficulty": "advanced"})
    
    print(f"  Easy (beginner): {easy} drills (5 min)")
    print(f"  Medium (intermediate): {medium} drills (10 min)")
    print(f"  Hard (advanced): {hard} drills (15 min)")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_case_structuring_difficulty())
