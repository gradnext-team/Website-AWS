#!/usr/bin/env python3
"""
Remove Duplicate Plans Script

This script removes duplicate plans from the database, keeping only the most recent
version with proper category assignment.

Usage:
    python3 scripts/remove_duplicate_plans.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def remove_duplicate_plans():
    """Remove duplicate plans, keeping the ones with proper categories"""
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    print(f"Connecting to: {mongo_url}/{db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Get all plans
        all_plans = await db.plans.find({}, {"_id": 1, "id": 1, "plan_key": 1, "name": 1, "category": 1}).to_list(None)
        print(f"\n📊 Total plans in database: {len(all_plans)}")
        
        # Find duplicates by plan_key
        plan_keys = {}
        for plan in all_plans:
            plan_key = plan.get('plan_key')
            if plan_key not in plan_keys:
                plan_keys[plan_key] = []
            plan_keys[plan_key].append(plan)
        
        # Identify duplicates
        duplicates = {k: v for k, v in plan_keys.items() if len(v) > 1}
        
        if not duplicates:
            print("✅ No duplicate plans found!")
            return
        
        print(f"\n⚠️  Found {len(duplicates)} plans with duplicates:\n")
        
        deleted_count = 0
        for plan_key, plans in duplicates.items():
            print(f"\n{plan_key} ({len(plans)} copies):")
            
            # Sort by category existence (keep ones WITH category)
            plans_with_category = [p for p in plans if p.get('category')]
            plans_without_category = [p for p in plans if not p.get('category')]
            
            if plans_with_category and plans_without_category:
                # Delete the ones without category
                for plan in plans_without_category:
                    print(f"  ❌ Deleting: {plan.get('name')} (no category)")
                    await db.plans.delete_one({"_id": plan["_id"]})
                    deleted_count += 1
                
                # Keep the one with category
                kept_plan = plans_with_category[0]
                print(f"  ✅ Keeping: {kept_plan.get('name')} (category: {kept_plan.get('category')})")
            
            elif len(plans_with_category) > 1:
                # Multiple plans with categories - keep the first one
                print(f"  ⚠️  Multiple plans with categories - keeping first, deleting rest")
                for plan in plans_with_category[1:]:
                    print(f"  ❌ Deleting: {plan.get('name')} (duplicate with category)")
                    await db.plans.delete_one({"_id": plan["_id"]})
                    deleted_count += 1
                print(f"  ✅ Keeping: {plans_with_category[0].get('name')}")
        
        print(f"\n✅ Removed {deleted_count} duplicate plans")
        
        # Show remaining plans
        remaining = await db.plans.find({}, {"_id": 0, "plan_key": 1, "name": 1, "category": 1}).to_list(None)
        print(f"\n📋 Remaining plans: {len(remaining)}\n")
        
        for i, plan in enumerate(remaining, 1):
            category = plan.get('category', 'N/A')
            print(f"{i:2}. {plan.get('plan_key', 'N/A'):25} - {plan.get('name', 'N/A'):30} ({category})")
    
    finally:
        client.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Remove Duplicate Plans Utility")
    print("=" * 60)
    asyncio.run(remove_duplicate_plans())
    print("\n✅ Done!")
