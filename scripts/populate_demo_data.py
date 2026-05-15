#!/usr/bin/env python3
"""
Script to populate dashboard with realistic demo data for screenshot
"""
import asyncio
import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import random
import uuid

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

async def populate_demo_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.gradnext
    
    # Use the mock user for Full Prep
    user_id = "mock-full-prep-1"
    user_email = "fullprep@gradnext.co"
    user_name = "Aarav Agarwal"
    
    print(f"Populating data for user: {user_name} ({user_id})")
    
    # Update the user's name in the users collection
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"name": user_name, "email": user_email}},
        upsert=True
    )
    print(f"✓ Updated user name to {user_name}")
    
    # 1. Update user progress document with video IDs (4 videos completed)
    actual_video_ids = []
    courses_cursor = db.courses.find({}, {"_id": 0, "modules": 1})
    async for course in courses_cursor:
        for module in course.get("modules", []):
            for session in module.get("sessions", []):
                if session.get("type") == "video" and len(actual_video_ids) < 4:
                    actual_video_ids.append(session.get("id"))
    
    if not actual_video_ids:
        actual_video_ids = [f"video-{i}" for i in range(1, 5)]
    
    # 33 drills completed total (11 case_math + 11 case_structuring + 11 charts_exhibits)
    progress_data = {
        "user_id": user_id,
        "videos_completed": actual_video_ids[:4],  # 4 videos completed
        "drills_completed": [f"drill-{i}" for i in range(1, 34)],  # 33 drills
        "updated_at": datetime.utcnow()
    }
    
    await db.user_progress.update_one(
        {"user_id": user_id},
        {"$set": progress_data},
        upsert=True
    )
    print(f"✓ Updated user progress: 4 videos, 33 drills")
    
    # 2. Add drill completion history with scores
    # 11 for each type = 33 total
    drill_history = []
    
    # Case Math - 11 drills with scores (highest range: 8.0-9.5 on chart)
    case_math_scores = [80, 82, 84, 85, 87, 88, 90, 91, 93, 94, 95]
    for i, score in enumerate(case_math_scores):
        drill_history.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "drill_id": f"drill-case_math-{i+1}",
            "drill_type": "case_math",
            "score": score,
            "total": 100,
            "time_taken": random.randint(180, 600),
            "completed_at": datetime.utcnow() - timedelta(days=30-i*2, hours=random.randint(0, 23)),
            "created_at": datetime.utcnow() - timedelta(days=30-i*2)
        })
    
    # Case Structuring - 11 drills with scores (mid range: 5.0-7.0 on chart)
    case_structuring_scores = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
    for i, score in enumerate(case_structuring_scores):
        drill_history.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "drill_id": f"drill-case_structuring-{i+1}",
            "drill_type": "case_structuring",
            "score": score,
            "total": 100,
            "time_taken": random.randint(180, 600),
            "completed_at": datetime.utcnow() - timedelta(days=30-i*2, hours=random.randint(0, 23)),
            "created_at": datetime.utcnow() - timedelta(days=30-i*2)
        })
    
    # Charts & Exhibits - 11 drills with scores (lower range: 2.5-4.5 on chart)
    charts_exhibits_scores = [25, 28, 30, 32, 35, 37, 38, 40, 42, 44, 45]
    for i, score in enumerate(charts_exhibits_scores):
        drill_history.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "drill_id": f"drill-charts_exhibits-{i+1}",
            "drill_type": "charts_exhibits",
            "score": score,
            "total": 100,
            "time_taken": random.randint(180, 600),
            "completed_at": datetime.utcnow() - timedelta(days=30-i*2, hours=random.randint(0, 23)),
            "created_at": datetime.utcnow() - timedelta(days=30-i*2)
        })
    
    # Clear existing and insert new
    await db.drill_completions.delete_many({"user_id": user_id})
    if drill_history:
        await db.drill_completions.insert_many(drill_history)
    print(f"✓ Added {len(drill_history)} drill completions (11 each type)")
    
    # 3. Add peer practice sessions with feedback
    peer_sessions_data = []
    for i in range(6):
        session_id = str(uuid.uuid4())
        partner_id = f"peer-user-{i+1}"
        rating = random.choice([4.0, 4.2, 4.3, 4.5, 4.0, 4.4])
        
        peer_sessions_data.append({
            "id": session_id,
            "requester_id": partner_id,
            "partner_id": user_id,
            "requester_name": f"Practice Partner {i+1}",
            "partner_name": user_name,
            "date": (datetime.utcnow() - timedelta(days=random.randint(5, 25))).strftime("%Y-%m-%d"),
            "time_slot": f"{10 + (i % 8)}:00 - {11 + (i % 8)}:30",
            "session_type": "Case session",
            "status": "completed",
            "meeting_link": "https://meet.google.com/abc-defg-hij",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(10, 30)),
            "requester_feedback": {
                "rating_overall": rating,
                "average_rating": rating,
                "rating_problem_understanding": random.randint(4, 5),
                "rating_framework_structure": random.randint(4, 5),
                "rating_case_math": random.randint(3, 5),
                "rating_communication_synthesis": random.randint(4, 5),
                "feedback_text": "Great session!",
                "submitted_at": datetime.utcnow() - timedelta(days=random.randint(1, 20))
            }
        })
    
    await db.peer_sessions.delete_many({"partner_id": user_id, "status": "completed"})
    if peer_sessions_data:
        await db.peer_sessions.insert_many(peer_sessions_data)
    print(f"✓ Added {len(peer_sessions_data)} peer sessions with feedback")
    
    # 4. Add mentor feedbacks
    mentor_feedbacks = []
    for i in range(4):
        booking_id = f"booking-{i+1}"
        rating = random.choice([4.3, 4.5, 4.8, 4.6])
        
        mentor_feedbacks.append({
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "mentor_id": f"mentor-{i+1}",
            "candidate_id": user_id,
            "rating_overall": rating,
            "average_rating": rating,
            "rating_problem_understanding": random.randint(4, 5),
            "rating_framework_structure": random.randint(4, 5),
            "rating_case_math": random.randint(4, 5),
            "rating_business_judgment": random.randint(4, 5),
            "rating_communication_synthesis": random.randint(4, 5),
            "strengths": "Excellent structured thinking",
            "areas_for_improvement": "Could improve on case math speed",
            "overall_feedback": "Great progress!",
            "session_type": "Case session",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 25))
        })
    
    await db.mentor_feedbacks.delete_many({"candidate_id": user_id})
    if mentor_feedbacks:
        await db.mentor_feedbacks.insert_many(mentor_feedbacks)
    print(f"✓ Added {len(mentor_feedbacks)} mentor feedbacks")
    
    # 5. Add upcoming peer practice sessions
    upcoming_peer_sessions = []
    for i in range(2):
        session_date = datetime.utcnow() + timedelta(days=i+1)
        upcoming_peer_sessions.append({
            "id": str(uuid.uuid4()),
            "requester_id": user_id,
            "requestee_id": f"peer-partner-{i+1}",
            "partner_id": f"peer-partner-{i+1}",
            "requester_name": user_name,
            "requestee_name": f"Rahul Sharma" if i == 0 else "Priya Patel",
            "partner_name": f"Rahul Sharma" if i == 0 else "Priya Patel",
            "date": session_date.strftime("%Y-%m-%d"),
            "time_slot": f"{10 + i*2}:00 - {11 + i*2}:30",
            "session_type": "Case session",
            "status": "confirmed",
            "meeting_link": "https://meet.google.com/abc-defg-hij",
            "created_at": datetime.utcnow() - timedelta(days=2)
        })
    
    await db.peer_sessions.delete_many({"requester_id": user_id, "status": "confirmed"})
    if upcoming_peer_sessions:
        await db.peer_sessions.insert_many(upcoming_peer_sessions)
    print(f"✓ Added {len(upcoming_peer_sessions)} upcoming peer sessions")
    
    # 6. Add upcoming coaching session
    coaching_date = datetime.utcnow() + timedelta(days=3)
    upcoming_coaching = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "candidate_id": user_id,
        "mentor_id": "mentor-arjun",
        "mentor_name": "Arjun Mehta",
        "mentor_title": "Ex-McKinsey EM",
        "mentor_company": "McKinsey & Company",
        "mentor_picture": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
        "date": coaching_date.strftime("%Y-%m-%d"),
        "time_slot": "14:00 - 15:00",
        "session_type": "Case Interview",
        "session_type_category": "coaching",
        "status": "confirmed",
        "meeting_link": "https://meet.google.com/xyz-uvwx-yz",
        "created_at": datetime.utcnow() - timedelta(days=5)
    }
    
    await db.bookings.delete_many({"user_id": user_id, "status": "confirmed"})
    await db.bookings.insert_one(upcoming_coaching)
    print(f"✓ Added 1 upcoming coaching session")
    
    print("\n✅ Demo data population complete!")
    print(f"   Name: {user_name}")
    print(f"   Courses: 4/10 completed")
    print(f"   Case Drills: 33/74 completed")
    print(f"   - Case Math: 11/25")
    print(f"   - Case Structuring: 11/25")
    print(f"   - Charts & Exhibits: 11/25")
    print(f"   Peer Rating: ~4.2/5 (6 ratings)")
    print(f"   Coach Rating: ~4.5/5 (4 ratings)")
    print(f"   Upcoming Sessions: 3 total")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(populate_demo_data())
