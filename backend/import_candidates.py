"""
Script to import candidates from Excel file into the users collection.
Can be run standalone or called via admin API endpoint.
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mentor_coach_hub")


def normalize_plan_name(plan: str) -> str:
    """Convert plan names from Excel to database plan_key format."""
    if not plan or pd.isna(plan):
        return "free_trial"
    
    plan_lower = str(plan).lower().strip().replace(" ", "_").replace("-", "_")
    
    # Map common variations to standardized plan keys
    plan_mappings = {
        "full_prep": "full_prep",
        "fullprep": "full_prep",
        "full prep": "full_prep",
        "mid_mile": "mid_mile",
        "midmile": "mid_mile",
        "mid mile": "mid_mile",
        "last_mile": "last_mile",
        "lastmile": "last_mile",
        "last mile": "last_mile",
        "pinnacle": "pinnacle",
        "basic": "basic_plan",
        "basic_plan": "basic_plan",
        "pro": "pro_plan",
        "pro_plan": "pro_plan",
        "pro_plus": "pro_plus",
        "free_trial": "free_trial",
        "free": "free_trial",
    }
    
    return plan_mappings.get(plan_lower, plan_lower)


def parse_date(date_val) -> Optional[datetime]:
    """Parse date value from Excel, handling various formats."""
    if pd.isna(date_val) or date_val is None:
        return None
    if isinstance(date_val, datetime):
        return date_val.replace(tzinfo=timezone.utc)
    if isinstance(date_val, str):
        try:
            return datetime.fromisoformat(date_val).replace(tzinfo=timezone.utc)
        except:
            return None
    return None


def safe_int(val, default=0) -> int:
    """Safely convert value to int."""
    if pd.isna(val) or val is None:
        return default
    try:
        return int(float(val))
    except:
        return default


def safe_bool(val, default=False) -> bool:
    """Safely convert value to bool."""
    if pd.isna(val) or val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val > 0 or val == -1  # -1 often means unlimited/true
    if isinstance(val, str):
        return val.lower() in ('true', 'yes', '1', '-1')
    return default


def safe_str(val, default="") -> str:
    """Safely convert value to string."""
    if pd.isna(val) or val is None:
        return default
    return str(val).strip()


def row_to_user_doc(row: pd.Series) -> Dict[str, Any]:
    """Convert an Excel row to a user document for MongoDB."""
    email = safe_str(row.get('email'))
    name = safe_str(row.get('name'))
    
    if not email or not name:
        return None
    
    # Parse plan dates
    plan_start = parse_date(row.get('plan_start_date'))
    plan_end = parse_date(row.get('plan_end_date'))
    
    # Calculate coaching sessions
    total_sessions = safe_int(row.get('coaching_sessions_total'), 0)
    used_sessions = safe_int(row.get('coaching_sessions_used'), 0)
    remaining_sessions = safe_int(row.get('coaching_sessions_remaining'), 0)
    
    # If remaining isn't explicitly set, calculate it
    if remaining_sessions == 0 and total_sessions > 0:
        remaining_sessions = max(0, total_sessions - used_sessions)
    
    # Strategy calls
    strategy_total = safe_int(row.get('strategy_calls_total'), 0)
    strategy_used = safe_int(row.get('strategy_calls_used'), 0)
    strategy_remaining = safe_int(row.get('strategy_calls_remaining'), 0)
    if strategy_remaining == 0 and strategy_total > 0:
        strategy_remaining = max(0, strategy_total - strategy_used)
    
    # Peer sessions
    peer_per_month = safe_int(row.get('peer_sessions_per_month'), 0)
    peer_used = safe_int(row.get('peer_sessions_used_this_month'), 0)
    
    # Unlimited flags
    is_unlimited_coaching = safe_bool(row.get('is_unlimited_coaching'), False)
    is_unlimited_strategy = safe_bool(row.get('is_unlimited_strategy_calls'), False)
    is_unlimited_peer = safe_bool(row.get('is_unlimited_peer_sessions'), False)
    
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email.lower(),
        "name": name,
        "picture": safe_str(row.get('picture')) or None,
        "phone": safe_str(row.get('phone')) or None,
        "college": safe_str(row.get('college')) or None,
        "linkedin_url": safe_str(row.get('linkedin_url')) or None,
        "timezone": safe_str(row.get('timezone')) or None,
        
        # Plan info
        "plan": normalize_plan_name(row.get('plan')),
        "plan_start_date": plan_start,
        "plan_end_date": plan_end,
        
        # Coaching sessions
        "coaching_sessions_total": total_sessions,
        "coaching_sessions_used": used_sessions,
        "coaching_sessions_remaining": remaining_sessions,
        "is_unlimited_coaching": is_unlimited_coaching,
        
        # Strategy calls
        "strategy_calls_total": strategy_total,
        "strategy_calls_used": strategy_used,
        "strategy_calls_remaining": strategy_remaining,
        "is_unlimited_strategy_calls": is_unlimited_strategy,
        
        # Peer sessions
        "peer_sessions_per_month": peer_per_month,
        "peer_sessions_used_this_month": peer_used,
        "is_unlimited_peer_sessions": is_unlimited_peer,
        
        # Default user fields
        "google_id": None,  # Will be set when user logs in with Google
        "is_mentor": False,
        "is_admin": False,
        "is_candidate": True,  # Mark as candidate for filtering
        "mentor_id": None,
        "peer_rating": 5.0,
        "peer_sessions_done": 0,
        "peer_availability": [],
        "bio": None,
        "target_companies": [],
        "preparation_stage": None,
        "custom_access": {},
        "cohort_batch": None,
        "cohort_id": None,
        "cohort_enrolled_at": None,
        
        # Timestamps
        "created_at": now,
        "updated_at": now,
        "imported_at": now,  # Track when imported
        "import_source": "excel_migration"
    }
    
    return user_doc


async def import_candidates_from_excel(
    file_path: str,
    db_client: Optional[AsyncIOMotorClient] = None,
    skip_existing: bool = True,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Import candidates from Excel file into MongoDB.
    
    Args:
        file_path: Path to the Excel file
        db_client: Optional existing MongoDB client
        skip_existing: If True, skip users with existing emails
        dry_run: If True, don't actually insert, just return what would be inserted
    
    Returns:
        Dict with import results
    """
    results = {
        "total_rows": 0,
        "imported": 0,
        "skipped_existing": 0,
        "skipped_invalid": 0,
        "errors": [],
        "imported_users": [],
        "skipped_users": []
    }
    
    # Read Excel file
    try:
        df = pd.read_excel(file_path)
        results["total_rows"] = len(df)
    except Exception as e:
        results["errors"].append(f"Failed to read Excel file: {str(e)}")
        return results
    
    # Connect to MongoDB if no client provided
    close_client = False
    if db_client is None:
        db_client = AsyncIOMotorClient(MONGO_URL)
        close_client = True
    
    db = db_client[DB_NAME]
    
    try:
        for idx, row in df.iterrows():
            email = safe_str(row.get('email')).lower()
            name = safe_str(row.get('name'))
            
            # Skip invalid rows
            if not email or not name:
                results["skipped_invalid"] += 1
                results["errors"].append(f"Row {idx + 2}: Missing email or name")
                continue
            
            # Check if user already exists
            if skip_existing:
                existing = await db.users.find_one({"email": email})
                if existing:
                    results["skipped_existing"] += 1
                    results["skipped_users"].append({
                        "email": email,
                        "name": name,
                        "reason": "already exists"
                    })
                    continue
            
            # Convert row to user document
            user_doc = row_to_user_doc(row)
            if not user_doc:
                results["skipped_invalid"] += 1
                continue
            
            if dry_run:
                results["imported"] += 1
                results["imported_users"].append({
                    "email": email,
                    "name": name,
                    "plan": user_doc["plan"]
                })
            else:
                try:
                    await db.users.insert_one(user_doc)
                    results["imported"] += 1
                    results["imported_users"].append({
                        "email": email,
                        "name": name,
                        "plan": user_doc["plan"]
                    })
                except Exception as e:
                    results["errors"].append(f"Failed to insert {email}: {str(e)}")
    
    finally:
        if close_client:
            db_client.close()
    
    return results


async def main():
    """Run import from command line."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import candidates from Excel')
    parser.add_argument('file', help='Path to Excel file')
    parser.add_argument('--dry-run', action='store_true', help='Preview without inserting')
    parser.add_argument('--allow-duplicates', action='store_true', help='Allow duplicate emails')
    
    args = parser.parse_args()
    
    print(f"Importing candidates from: {args.file}")
    print(f"Dry run: {args.dry_run}")
    print(f"Skip existing: {not args.allow_duplicates}")
    print("-" * 50)
    
    results = await import_candidates_from_excel(
        file_path=args.file,
        skip_existing=not args.allow_duplicates,
        dry_run=args.dry_run
    )
    
    print(f"\nResults:")
    print(f"  Total rows: {results['total_rows']}")
    print(f"  Imported: {results['imported']}")
    print(f"  Skipped (existing): {results['skipped_existing']}")
    print(f"  Skipped (invalid): {results['skipped_invalid']}")
    
    if results['errors']:
        print(f"\nErrors ({len(results['errors'])}):")
        for err in results['errors'][:10]:
            print(f"  - {err}")
        if len(results['errors']) > 10:
            print(f"  ... and {len(results['errors']) - 10} more")
    
    if results['imported_users']:
        print(f"\nImported users ({len(results['imported_users'])}):")
        for u in results['imported_users'][:5]:
            print(f"  - {u['name']} ({u['email']}) - {u['plan']}")
        if len(results['imported_users']) > 5:
            print(f"  ... and {len(results['imported_users']) - 5} more")
    
    if results['skipped_users']:
        print(f"\nSkipped users ({len(results['skipped_users'])}):")
        for u in results['skipped_users'][:5]:
            print(f"  - {u['name']} ({u['email']}) - {u['reason']}")
        if len(results['skipped_users']) > 5:
            print(f"  ... and {len(results['skipped_users']) - 5} more")


if __name__ == "__main__":
    asyncio.run(main())
