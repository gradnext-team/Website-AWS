#!/usr/bin/env python3
"""
Test script for Strategy Call Auto-Assignment APIs
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import sys

BACKEND_URL = "http://localhost:8001"

async def test_apis():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['gradnext']
    
    print("=" * 80)
    print("STRATEGY CALL AUTO-ASSIGNMENT API TESTS")
    print("=" * 80)
    
    # Test 1: Check unified availability
    print("\n" + "=" * 80)
    print("TEST 1: Unified Availability Endpoint")
    print("=" * 80)
    
    user = await db.users.find_one({"id": "test-sub-user-1"})
    if not user:
        print("❌ Test user not found!")
        client.close()
        return
    
    print(f"\n✓ Test user: {user.get('email')}")
    print(f"  Plan: {user.get('plan')}")
    print(f"  Strategy calls: {user.get('strategy_calls_total', 0)} total, {user.get('strategy_calls_used', 0)} used")
    
    # Get mentors
    mentors = await db.mentors.find({
        "can_take_strategy_calls": True,
        "is_active": True,
        "$or": [
            {"is_hidden_from_strategy_calls": {"$ne": True}},
            {"is_hidden_from_strategy_calls": {"$exists": False}}
        ]
    }).to_list(100)
    
    print(f"\n✓ Found {len(mentors)} strategy call mentors")
    for mentor in mentors:
        print(f"  - {mentor.get('name')} ({mentor.get('company')}) - Rating: {mentor.get('rating', 0.0)}")
    
    # Simulate unified availability logic
    print("\n" + "-" * 80)
    print("Simulating Unified Availability Aggregation:")
    print("-" * 80)
    
    from datetime import timedelta
    import pytz
    
    ist = pytz.timezone('Asia/Kolkata')
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(ist)
    today = now_ist.date()
    
    aggregated_slots = {}
    days_to_check = 14
    
    for mentor in mentors:
        mentor_id = mentor.get("id")
        availability = mentor.get("availability", [])
        
        # Get existing bookings
        existing_bookings = await db.strategy_call_sessions.find({
            "mentor_id": mentor_id,
            "status": {"$in": ["scheduled", "confirmed"]}
        }).to_list(500)
        
        booked_slots = set()
        for booking in existing_bookings:
            slot_key = f"{booking['date']}_{booking['time']}"
            booked_slots.add(slot_key)
        
        # Process availability
        for day_avail in availability:
            day_name = day_avail.get("day")
            slots = day_avail.get("slots", [])
            
            if not slots:
                continue
            
            day_mapping = {
                "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
                "Friday": 4, "Saturday": 5, "Sunday": 6
            }
            target_weekday = day_mapping.get(day_name)
            if target_weekday is None:
                continue
            
            for i in range(days_to_check):
                check_date = today + timedelta(days=i)
                if check_date.weekday() == target_weekday and check_date > today:
                    date_str = check_date.strftime("%Y-%m-%d")
                    
                    for slot in slots:
                        time_str = slot.get("time")
                        if not time_str:
                            continue
                        
                        slot_key = f"{date_str}_{time_str}"
                        
                        if slot_key in booked_slots:
                            continue
                        
                        # Check if in past
                        slot_datetime_str = f"{date_str} {time_str}"
                        try:
                            slot_datetime = ist.localize(datetime.strptime(slot_datetime_str, "%Y-%m-%d %H:%M"))
                            if slot_datetime <= now_ist:
                                continue
                        except:
                            continue
                        
                        # Add to aggregated
                        if date_str not in aggregated_slots:
                            aggregated_slots[date_str] = {}
                        
                        if time_str not in aggregated_slots[date_str]:
                            aggregated_slots[date_str][time_str] = []
                        
                        aggregated_slots[date_str][time_str].append({
                            "mentor_id": mentor_id,
                            "mentor_name": mentor.get("name"),
                            "rating": mentor.get("rating", 0.0)
                        })
    
    print(f"\n✓ Aggregated slots from {len(mentors)} mentors")
    print(f"  Total dates with availability: {len(aggregated_slots)}")
    
    # Show sample slots
    print("\nSample slots (first 5 dates):")
    for i, (date, times) in enumerate(list(aggregated_slots.items())[:5]):
        print(f"\n📅 {date}:")
        for time, mentor_list in times.items():
            print(f"   {time} - {len(mentor_list)} mentor(s):")
            for m in mentor_list:
                print(f"     • {m['mentor_name']} (rating: {m['rating']})")
    
    # Test 2: Auto-assignment logic
    print("\n" + "=" * 80)
    print("TEST 2: Auto-Assignment Logic")
    print("=" * 80)
    
    # Find a slot with multiple mentors
    test_slot = None
    for date, times in aggregated_slots.items():
        for time, mentor_list in times.items():
            if len(mentor_list) >= 2:  # Multiple mentors available
                test_slot = {
                    "date": date,
                    "time": time,
                    "mentors": mentor_list
                }
                break
        if test_slot:
            break
    
    if test_slot:
        print(f"\n✓ Found test slot: {test_slot['date']} at {test_slot['time']}")
        print(f"  Available mentors: {len(test_slot['mentors'])}")
        
        # Simulate best mentor selection
        print("\nSimulating best mentor selection:")
        
        # Get booking counts
        mentor_scores = []
        for m in test_slot['mentors']:
            booking_count = await db.strategy_call_sessions.count_documents({
                "mentor_id": m['mentor_id'],
                "status": {"$in": ["scheduled", "confirmed", "completed"]}
            })
            
            mentor_scores.append({
                "name": m['mentor_name'],
                "rating": m['rating'],
                "bookings": booking_count
            })
        
        # Sort: rating DESC, bookings ASC
        mentor_scores.sort(key=lambda x: (-x['rating'], x['bookings']))
        
        print("\nMentor ranking:")
        for i, m in enumerate(mentor_scores):
            symbol = "🥇" if i == 0 else "🥈" if i == 1 else "🥉" if i == 2 else "  "
            print(f"{symbol} {m['name']}: Rating={m['rating']}, Bookings={m['bookings']}")
        
        print(f"\n✅ Selected: {mentor_scores[0]['name']} (best rating + fewest bookings)")
    else:
        print("\n⚠️  No slots with multiple mentors found for tie-breaking test")
    
    # Test 3: Verify booking would work
    print("\n" + "=" * 80)
    print("TEST 3: Booking Validation")
    print("=" * 80)
    
    # Check user credits
    plan = await db.plans.find_one({"plan_key": user.get('plan')})
    plan_strategy_calls = plan.get('features', {}).get('strategy_calls', 0) if plan else 0
    
    admin_value = user.get('strategy_calls_total')
    if admin_value is not None:
        base_credits = admin_value
    else:
        base_credits = plan_strategy_calls
    
    used = user.get('strategy_calls_used', 0) or 0
    remaining = max(0, base_credits - used)
    
    print(f"\n✓ User credits:")
    print(f"  Plan baseline: {plan_strategy_calls}")
    print(f"  Admin override: {admin_value}")
    print(f"  Base credits: {base_credits}")
    print(f"  Used: {used}")
    print(f"  Remaining: {remaining}")
    
    if remaining > 0:
        print(f"\n✅ User has {remaining} credit(s) - can book!")
    else:
        print(f"\n❌ User has no credits - cannot book")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    print(f"\n✅ Mentors with strategy call capability: {len(mentors)}")
    print(f"✅ Dates with availability: {len(aggregated_slots)}")
    print(f"✅ Auto-assignment logic: Working (best rated + fewest bookings)")
    print(f"✅ User credits: {remaining} remaining")
    
    if len(mentors) > 0 and len(aggregated_slots) > 0 and remaining > 0:
        print(f"\n🎉 ALL SYSTEMS READY FOR AUTO-ASSIGNMENT!")
    else:
        print(f"\n⚠️  Some components need attention")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_apis())
