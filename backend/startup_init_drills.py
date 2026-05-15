#!/usr/bin/env python3
"""
Startup script to initialize AI drills database
This runs automatically when the backend starts
"""
import sys
import asyncio
from pathlib import Path
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

async def initialize_if_needed():
    """Initialize drills database if empty"""
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        
        # Load environment
        load_dotenv(Path(__file__).resolve().parent.parent / '.env')
        
        MONGO_URL = os.getenv("MONGO_URL")
        DB_NAME = os.getenv("DB_NAME", "gradnext_db")
        
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Check if drills exist
        count = await db.ai_drills.count_documents({})
        
        if count == 0:
            print("🔄 Initializing AI drills database...")
            
            # Import and run main initialization
            from routes.ai_drills import PRE_GENERATED_DRILLS
            
            # Add base drills
            for drill_type, difficulties in PRE_GENERATED_DRILLS.items():
                for difficulty, drill_list in difficulties.items():
                    for drill in drill_list:
                        drill_doc = {
                            **drill,
                            "drill_type": drill_type,
                            "difficulty": difficulty,
                            "created_at": None,
                            "updated_at": None
                        }
                        await db.ai_drills.insert_one(drill_doc)
            
            # Fix Case Structuring difficulties
            await db.ai_drills.update_many(
                {"drill_type": "case_structuring", "id": {"$regex": "^cs-a"}},
                {"$set": {"difficulty": "beginner"}}
            )
            await db.ai_drills.update_many(
                {"drill_type": "case_structuring", "id": {"$regex": "^cs-b"}},
                {"$set": {"difficulty": "intermediate"}}
            )
            await db.ai_drills.update_many(
                {"drill_type": "case_structuring", "id": {"$regex": "^cs-i"}},
                {"$set": {"difficulty": "advanced"}}
            )
            
            # Create indexes
            await db.ai_drills.create_index("id", unique=True)
            await db.ai_drills.create_index([("drill_type", 1), ("difficulty", 1)])
            
            final_count = await db.ai_drills.count_documents({})
            print(f"✅ Initialized {final_count} drills")
        else:
            print(f"✓ Drills database already initialized ({count} drills)")
        
        client.close()
        
    except Exception as e:
        print(f"⚠️  Error during initialization: {e}")
        # Don't fail the startup if this errors

if __name__ == "__main__":
    asyncio.run(initialize_if_needed())
