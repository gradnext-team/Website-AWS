"""
Complete AI Drills Database Initialization Script
Run this ONCE after deployment to populate the drills in production MongoDB
"""
import sys
import asyncio
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "gradnext_db")


async def initialize_drills():
    """Complete initialization of all AI drills in production database"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 80)
    print("AI DRILLS DATABASE INITIALIZATION")
    print("=" * 80)
    
    # Check if drills already exist
    existing_count = await db.ai_drills.count_documents({})
    if existing_count > 0:
        print(f"\n⚠️  Found {existing_count} existing drills in database")
        response = input("   Delete and recreate all drills? (yes/no): ")
        if response.lower() != 'yes':
            print("   Aborted. No changes made.")
            client.close()
            return
        
        await db.ai_drills.delete_many({})
        print("   ✓ Cleared existing drills")
    
    print("\n📚 Loading drill data from codebase...")
    
    # Import the hardcoded drills
    try:
        from routes.ai_drills import PRE_GENERATED_DRILLS
        print(f"   ✓ Loaded PRE_GENERATED_DRILLS from ai_drills.py")
    except Exception as e:
        print(f"   ✗ Error loading drills: {e}")
        client.close()
        return
    
    # Migrate all drills to MongoDB
    print("\n🔄 Migrating drills to MongoDB...")
    total_drills = 0
    
    for drill_type, difficulties in PRE_GENERATED_DRILLS.items():
        print(f"\n   {drill_type}:")
        for difficulty, drills in difficulties.items():
            for drill in drills:
                drill_doc = {
                    **drill,
                    "drill_type": drill_type,
                    "difficulty": difficulty,
                    "created_at": None,
                    "updated_at": None
                }
                
                await db.ai_drills.update_one(
                    {"id": drill["id"]},
                    {"$set": drill_doc},
                    upsert=True
                )
                total_drills += 1
            
            print(f"      ✓ {difficulty}: {len(drills)} drills")
    
    print(f"\n   Total migrated: {total_drills} drills")
    
    # Add Charts & Exhibits Hard drills (ce-h-1 to ce-h-10)
    print("\n📊 Adding Charts & Exhibits Hard drills...")
    
    # Import the hard drills script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        from add_charts_hard_drills import HARD_DRILLS as charts_hard
        
        for drill in charts_hard:
            drill_doc = {
                **drill,
                "drill_type": "charts_exhibits",
                "difficulty": "advanced",
                "created_at": None,
                "updated_at": None
            }
            
            await db.ai_drills.update_one(
                {"id": drill["id"]},
                {"$set": drill_doc},
                upsert=True
            )
        
        print(f"   ✓ Added {len(charts_hard)} Hard drills")
        total_drills += len(charts_hard)
    except Exception as e:
        print(f"   ⚠️  Could not load Charts & Exhibits Hard drills: {e}")
    
    # Update Charts & Exhibits Hard drills with proper questions (ce-h-4 to ce-h-10)
    print("\n📝 Updating Hard drills with proper questions...")
    
    try:
        from update_hard_drills_proper_questions import PROPER_HARD_DRILLS
        
        updated = 0
        for drill_id, drill_data in PROPER_HARD_DRILLS.items():
            result = await db.ai_drills.update_one(
                {"id": drill_id},
                {"$set": {
                    "title": drill_data["title"],
                    "questions": drill_data["questions"]
                }}
            )
            
            if result.modified_count > 0:
                updated += 1
        
        print(f"   ✓ Updated {updated} drills with proper questions")
    except Exception as e:
        print(f"   ⚠️  Could not update Hard drill questions: {e}")
    
    # Fix Case Structuring difficulty values
    print("\n🔧 Fixing Case Structuring difficulty values...")
    
    cs_drills = await db.ai_drills.find(
        {"drill_type": "case_structuring"},
        {"_id": 0, "id": 1, "difficulty": 1}
    ).to_list(1000)
    
    updates = {
        "cs-a": "beginner",      # 5 min = Easy
        "cs-b": "intermediate",  # 10 min = Medium
        "cs-i": "advanced"       # 15 min = Hard
    }
    
    updated_cs = 0
    for drill in cs_drills:
        drill_id = drill["id"]
        prefix = drill_id[:4]
        new_difficulty = updates.get(prefix)
        
        if new_difficulty and drill["difficulty"] != new_difficulty:
            await db.ai_drills.update_one(
                {"id": drill_id},
                {"$set": {"difficulty": new_difficulty}}
            )
            updated_cs += 1
    
    print(f"   ✓ Fixed {updated_cs} Case Structuring drills")
    
    # Create indexes
    print("\n🔧 Creating database indexes...")
    await db.ai_drills.create_index("id", unique=True)
    await db.ai_drills.create_index([("drill_type", 1), ("difficulty", 1)])
    await db.ai_drills.create_index("difficulty")
    print("   ✓ Indexes created")
    
    # Final verification
    print("\n✅ INITIALIZATION COMPLETE")
    print("=" * 80)
    
    final_count = await db.ai_drills.count_documents({})
    print(f"\nTotal drills in database: {final_count}")
    
    # Count by type
    for drill_type in ["case_math", "case_structuring", "charts_exhibits"]:
        count = await db.ai_drills.count_documents({"drill_type": drill_type})
        print(f"   {drill_type}: {count} drills")
        
        # Count by difficulty
        for diff in ["beginner", "intermediate", "advanced"]:
            diff_count = await db.ai_drills.count_documents({
                "drill_type": drill_type,
                "difficulty": diff
            })
            if diff_count > 0:
                print(f"      {diff}: {diff_count}")
    
    print("\n" + "=" * 80)
    print("Database is ready for production use!")
    print("=" * 80)
    
    client.close()


if __name__ == "__main__":
    print("\n⚡ Starting AI Drills Database Initialization...\n")
    asyncio.run(initialize_drills())
