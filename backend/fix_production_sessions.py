"""
PRODUCTION FIX: Diagnose and fix session viewing issues for all candidates
Run this on PRODUCTION database to fix Megha Aggarwal and verify all candidates
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def diagnose_and_fix_all_candidates():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.gradnext
    
    print("="*70)
    print("PRODUCTION DIAGNOSTIC: Session Viewing Issues")
    print("="*70)
    print(f"Timestamp: {datetime.now()}")
    print("="*70)
    
    # 1. Find Megha Aggarwal
    print("\n1. CHECKING MEGHA AGGARWAL...")
    megha = await db.users.find_one({"email": "meghaaggarwal.2000@gmail.com"})
    
    if not megha:
        print("   ❌ Megha Aggarwal NOT FOUND in users collection")
        print("   Searching by name...")
        megha = await db.users.find_one({"name": {"$regex": "Megha.*Aggarwal", "$options": "i"}})
    
    if megha:
        user_id = megha.get('id')
        print(f"   ✓ Found: {megha.get('name')} ({megha.get('email')})")
        print(f"   User ID: {user_id}")
        print(f"   Plan: {megha.get('current_plan') or megha.get('plan')}")
        print(f"   Sessions used: {megha.get('coaching_sessions_used', 0)}")
        
        # Check bookings by user_id
        bookings_by_id = await db.bookings.find({"user_id": user_id}).to_list(500)
        print(f"\n   Bookings with correct user_id: {len(bookings_by_id)}")
        
        # Check bookings by email (potential orphans)
        bookings_by_email = await db.bookings.find({
            "candidate_email": megha.get('email')
        }).to_list(500)
        print(f"   Bookings by email: {len(bookings_by_email)}")
        
        # MISMATCH DETECTED
        if len(bookings_by_email) > len(bookings_by_id):
            mismatch_count = len(bookings_by_email) - len(bookings_by_id)
            print(f"\n   🚨 USER_ID MISMATCH DETECTED!")
            print(f"   {mismatch_count} booking(s) have WRONG user_id")
            
            # Get unique wrong user_ids
            wrong_ids = set()
            for booking in bookings_by_email:
                if booking.get('user_id') != user_id:
                    wrong_ids.add(booking.get('user_id'))
            
            print(f"   Wrong user_id(s): {wrong_ids}")
            
            # ASK FOR CONFIRMATION
            print(f"\n   FIX: Update {mismatch_count} booking(s) to use correct user_id?")
            print(f"        From: {wrong_ids}")
            print(f"        To: {user_id}")
            
            # AUTO-FIX (remove input for production automation)
            fix_confirm = "yes"  # Change to input("   Type 'yes' to fix: ") for manual confirmation
            
            if fix_confirm.lower() == "yes":
                result = await db.bookings.update_many(
                    {
                        "candidate_email": megha.get('email'),
                        "user_id": {"$ne": user_id}
                    },
                    {"$set": {"user_id": user_id}}
                )
                
                print(f"\n   ✅ FIXED: Updated {result.modified_count} booking(s)")
                
                # Verify fix
                fixed_bookings = await db.bookings.find({"user_id": user_id}).to_list(500)
                print(f"   ✓ Megha now has {len(fixed_bookings)} bookings")
        else:
            print(f"   ✓ No user_id mismatch - bookings are correct")
        
        # Check for missing meet_links
        bookings_without_links = await db.bookings.find({
            "user_id": user_id,
            "$or": [
                {"meet_link": {"$exists": False}},
                {"meet_link": None},
                {"meet_link": ""}
            ]
        }).to_list(500)
        
        if len(bookings_without_links) > 0:
            print(f"\n   ⚠️ {len(bookings_without_links)} booking(s) missing meet_link")
            print(f"      These sessions cannot be joined until meet_link is added")
    else:
        print("   ❌ Megha Aggarwal NOT FOUND")
    
    # 2. Check ALL candidates
    print("\n\n2. CHECKING ALL CANDIDATES...")
    print("-" * 70)
    
    all_candidates = await db.users.find({"role": "candidate"}, {"_id": 0}).to_list(500)
    
    issues_summary = {
        "user_id_mismatch": [],
        "missing_meet_links": [],
        "no_bookings": []
    }
    
    for candidate in all_candidates:
        user_id = candidate.get('id')
        if not user_id:
            continue
        
        name = candidate.get('name')
        email = candidate.get('email')
        
        # Check bookings
        bookings_by_id = await db.bookings.find({"user_id": user_id}).to_list(500)
        bookings_by_email = await db.bookings.find({"candidate_email": email}).to_list(500)
        
        # User ID mismatch
        if len(bookings_by_email) > len(bookings_by_id):
            issues_summary["user_id_mismatch"].append({
                "name": name,
                "email": email,
                "correct_id": user_id,
                "bookings_mismatched": len(bookings_by_email) - len(bookings_by_id)
            })
        
        # Missing meet links
        bookings_without_links = [b for b in bookings_by_id if not b.get('meet_link')]
        if len(bookings_without_links) > 0:
            issues_summary["missing_meet_links"].append({
                "name": name,
                "email": email,
                "count": len(bookings_without_links)
            })
        
        # No bookings (for active users)
        if len(bookings_by_id) == 0 and len(bookings_by_email) == 0:
            if candidate.get('coaching_sessions_used', 0) > 0:
                issues_summary["no_bookings"].append({
                    "name": name,
                    "email": email,
                    "sessions_used": candidate.get('coaching_sessions_used', 0)
                })
    
    # 3. SUMMARY REPORT
    print("\n\n" + "="*70)
    print("DIAGNOSTIC SUMMARY")
    print("="*70)
    
    print(f"\nTotal candidates checked: {len(all_candidates)}")
    
    if len(issues_summary["user_id_mismatch"]) > 0:
        print(f"\n🚨 USER_ID MISMATCH ({len(issues_summary['user_id_mismatch'])} candidate(s)):")
        for issue in issues_summary["user_id_mismatch"]:
            print(f"   - {issue['name']} ({issue['email']}): {issue['bookings_mismatched']} booking(s)")
    else:
        print("\n✓ No user_id mismatches found")
    
    if len(issues_summary["missing_meet_links"]) > 0:
        print(f"\n⚠️ MISSING MEET LINKS ({len(issues_summary['missing_meet_links'])} candidate(s)):")
        for issue in issues_summary["missing_meet_links"]:
            print(f"   - {issue['name']}: {issue['count']} booking(s) without meet_link")
    else:
        print("\n✓ All bookings have meet_links")
    
    if len(issues_summary["no_bookings"]) > 0:
        print(f"\n⚠️ NO BOOKINGS (but sessions used) ({len(issues_summary['no_bookings'])} candidate(s)):")
        for issue in issues_summary["no_bookings"]:
            print(f"   - {issue['name']}: {issue['sessions_used']} sessions used but no bookings found")
    
    # 4. AUTO-FIX ALL USER_ID MISMATCHES
    if len(issues_summary["user_id_mismatch"]) > 0:
        print(f"\n\n4. AUTO-FIXING USER_ID MISMATCHES...")
        
        total_fixed = 0
        for issue in issues_summary["user_id_mismatch"]:
            result = await db.bookings.update_many(
                {
                    "candidate_email": issue['email'],
                    "user_id": {"$ne": issue['correct_id']}
                },
                {"$set": {"user_id": issue['correct_id']}}
            )
            
            if result.modified_count > 0:
                print(f"   ✅ {issue['name']}: Fixed {result.modified_count} booking(s)")
                total_fixed += result.modified_count
        
        print(f"\n   ✅ TOTAL FIXED: {total_fixed} booking(s)")
    
    print("\n" + "="*70)
    print("DIAGNOSTIC COMPLETE")
    print("="*70)
    
    print("\nNEXT STEPS:")
    print("1. Ask Megha to login and check Dashboard → Coaching → Sessions")
    print("2. For missing meet_links: Run Google Calendar sync or add manually")
    print("3. Monitor for additional user reports")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(diagnose_and_fix_all_candidates())
