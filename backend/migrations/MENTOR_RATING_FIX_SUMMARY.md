"""
MENTOR RATING FIX - COMPREHENSIVE VERIFICATION
================================================

ISSUE: Mentors with 0 sessions showing default 5.0 rating

ROOT CAUSES FOUND AND FIXED:
1. ✅ models.py - MentorBase had `rating: float = 5.0` default
2. ✅ models.py - MentorStats had `average_rating: float = 5.0` default
3. ✅ strategy_calls.py line 170 - had `mentor.get("rating", 0.0)` 
4. ✅ strategy_calls.py line 934 - had `mentor.get("rating", 0.0)`
5. ✅ admin.py line 1585 - had fallback to 5.0

FIXES APPLIED:
1. Changed models.py MentorBase.rating to Optional[float] = None
2. Changed models.py MentorStats.average_rating to Optional[float] = None
3. Updated strategy_calls.py line 170 to check sessions_conducted
4. Updated strategy_calls.py line 934 to check sessions_conducted
5. Updated admin.py to return None instead of 5.0
6. Re-ran migration to clean up database

DATABASE VERIFICATION:
✓ All mentors with 0 sessions have rating = None (not 5.0)
✓ No mentors with 0 sessions have any rating value

API ENDPOINTS FIXED:
✓ /api/strategy-calls/mentors (line 365) - returns None for 0 sessions
✓ get_best_available_mentor (line 170) - returns None for 0 sessions  
✓ GET booking/{booking_id} (line 934) - returns None for 0 sessions

FRONTEND:
Already handles null ratings correctly in CoachingPage.jsx
Shows "Not rated" or "N/A" when rating is null

IF STILL SEEING 5.0 IN UI:
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Clear browser cache
3. Check browser console for errors
4. Verify you're looking at the deployed version (not cached)
