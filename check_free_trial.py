import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'gradnext')]

    # Find free trial users
    users = await db.users.find(
        {"plan": {"$in": ["free_trial", "Free Trial"]}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "plan": 1}
    ).to_list(20)

    print("=== FREE TRIAL USERS ===")
    for u in users:
        uid = u.get("id")
        count = await db.user_activity.count_documents({"user_id": uid, "event": "daily_login"})
        print(f"  {u.get('name', 'N/A')} | {u.get('email', 'N/A')} | id: {uid} | daily_logins: {count}")

    if not users:
        print("  No free trial users found")

asyncio.run(check())
