"""
Create Admin User Script
Run this to create admin@gradnext.com user in the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import os
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin_user():
    # Get MongoDB connection
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_db")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if admin already exists
    existing = await db.users.find_one({"email": "admin@gradnext.com"})
    
    if existing:
        print("✅ Admin user admin@gradnext.com already exists!")
        print(f"   User ID: {existing.get('id')}")
        print(f"   Is Admin: {existing.get('is_admin')}")
        return
    
    # Create admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@gradnext.com",
        "name": "Admin User",
        "password_hash": pwd_context.hash("admin123"),
        "picture": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face",
        "plan": "free_trial",
        "is_admin": True,
        "is_mentor": False,
        "onboarding_completed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Insert into database
    await db.users.insert_one(admin_user)
    
    print("✅ Admin user created successfully!")
    print(f"   Email: admin@gradnext.com")
    print(f"   Password: admin123")
    print(f"   User ID: {admin_user['id']}")
    print(f"\n🔐 You can now login with:")
    print(f"   Email: admin@gradnext.com")
    print(f"   Password: admin123")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin_user())
