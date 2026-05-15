"""
Migration script to move hardcoded drills from ai_drills.py to MongoDB
Run this once to populate the database with drill data
"""
import sys
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

# Import the hardcoded drills
from routes.ai_drills import PRE_GENERATED_DRILLS, DRILL_TYPES

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "gradnext_db")


async def migrate_drills():
    """Migrate drills from hardcoded dictionary to MongoDB"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🚀 Starting drill migration to MongoDB...")
    print(f"   Database: {DB_NAME}")
    
    # Clear existing drills (optional - comment out if you want to preserve)
    existing_count = await db.ai_drills.count_documents({})
    if existing_count > 0:
        print(f"⚠️  Found {existing_count} existing drills in database")
        response = input("   Delete existing drills? (yes/no): ")
        if response.lower() == 'yes':
            await db.ai_drills.delete_many({})
            print("   ✓ Cleared existing drills")
    
    # Migrate drills
    total_drills = 0
    for drill_type, difficulties in PRE_GENERATED_DRILLS.items():
        print(f"\n📚 Migrating {drill_type} drills...")
        
        for difficulty, drills in difficulties.items():
            for drill in drills:
                # Add metadata
                drill_doc = {
                    **drill,
                    "drill_type": drill_type,
                    "difficulty": difficulty,
                    "created_at": None,  # Will be set on first insert
                    "updated_at": None
                }
                
                # Insert or update
                await db.ai_drills.update_one(
                    {"id": drill["id"]},
                    {"$set": drill_doc},
                    upsert=True
                )
                total_drills += 1
            
            print(f"   ✓ Migrated {len(drills)} {difficulty} drills")
    
    # Create indexes
    print("\n🔧 Creating indexes...")
    await db.ai_drills.create_index("id", unique=True)
    await db.ai_drills.create_index([("drill_type", 1), ("difficulty", 1)])
    await db.ai_drills.create_index("difficulty_label")
    print("   ✓ Indexes created")
    
    print(f"\n✅ Migration complete! Migrated {total_drills} drills to MongoDB")
    print(f"   Collection: ai_drills")
    
    # Verify
    verify_count = await db.ai_drills.count_documents({})
    print(f"   Verified: {verify_count} drills in database")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_drills())
