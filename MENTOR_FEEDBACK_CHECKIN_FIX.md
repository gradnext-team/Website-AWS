# Mentor/Coaching Feedback Check-In Fix - Complete

## Change Implemented

**Date:** February 26, 2026  
**Scope:** Coaching/Mentor sessions feedback trigger  
**Type:** Bug fix / UX improvement (matching peer sessions)

---

## Problem Fixed

**Before:** Mandatory feedback popup triggered for coaching sessions even when one or both participants didn't join.

**After:** Feedback popup only triggers if **BOTH mentor and candidate checked in** to the session.

---

## Code Changes

### **File:** `/app/backend/routes/feedback.py`

#### **Change 1: Mentor Feedback (Lines 118-123)**
For mentors giving feedback to candidates:

```python
# NEW: Check if BOTH mentor and candidate actually joined the session
# Only trigger feedback if both participants checked in
mentor_checked_in = pending.get("mentor_checked_in", False)
candidate_checked_in = pending.get("candidate_checked_in", False)

if not (mentor_checked_in and candidate_checked_in):
    continue  # Session didn't actually happen (one or both no-showed), skip
```

#### **Change 2: Candidate Feedback (Lines 180-185)**
For candidates giving feedback to mentors:

```python
# NEW: Check if BOTH mentor and candidate actually joined the session
# Only trigger feedback if both participants checked in
mentor_checked_in = booking.get("mentor_checked_in", False)
candidate_checked_in = booking.get("candidate_checked_in", False)

if not (mentor_checked_in and candidate_checked_in):
    continue  # Session didn't actually happen (one or both no-showed), skip
```

---

## New Behavior

### **Feedback Trigger Scenarios:**

| Scenario | Mentor Checked In | Candidate Checked In | Mentor Gets Popup | Candidate Gets Popup |
|----------|------------------|---------------------|-------------------|---------------------|
| Both joined ✅ | ✅ Yes | ✅ Yes | ✅ **Yes** | ✅ **Yes** |
| Mentor no-show | ❌ No | ✅ Yes | ❌ **No** | ❌ **No** |
| Candidate no-show | ✅ Yes | ❌ No | ❌ **No** | ❌ **No** |
| Both no-show | ❌ No | ❌ No | ❌ **No** | ❌ **No** |

**Key Point:** If even ONE person doesn't check in, NEITHER gets feedback popup.

---

## Consistency with Peer Sessions

This fix makes coaching sessions **consistent with peer sessions**:

### **Peer Sessions** (Fixed Earlier Today)
- Requires both users checked in → feedback triggered
- One or both no-show → no feedback

### **Coaching Sessions** (Fixed Now)
- Requires both users checked in → feedback triggered
- One or both no-show → no feedback

**Result:** Consistent behavior across all session types! ✅

---

## User Experience Improvements

### **Before Fix:**
```
Scenario: Mentor No-Show
1. Candidate books coaching session for 2:00 PM
2. Candidate checks in at 1:55 PM
3. Mentor doesn't show up (doesn't check in)
4. Candidate waits, session doesn't happen
5. Next day candidate logs in → Forced feedback popup ❌
6. "Rate your mentor" (but mentor never showed up!)
7. Frustrating experience
```

### **After Fix:**
```
Scenario: Mentor No-Show
1. Candidate books coaching session for 2:00 PM
2. Candidate checks in at 1:55 PM
3. Mentor doesn't show up (doesn't check in)
4. Candidate waits, session doesn't happen
5. Next day candidate logs in → No popup ✅
6. Dashboard accessible immediately
7. Better experience - no annoying popup for non-existent session
```

---

## Why Require BOTH Users?

### **Rationale (Same as Peer Sessions):**

1. **Fairness:** If one person no-showed, the session didn't really happen
2. **Data Quality:** Feedback should only be for actual mentoring sessions
3. **User Experience:** Don't bother users with feedback for sessions that didn't occur
4. **Professional Standards:** Coaching requires both parties present to be meaningful

### **Specific to Mentor Sessions:**

**Problem Scenario Without Fix:**
- Mentor doesn't show → Candidate still gets feedback popup
- Candidate gives low rating for "session" that was just a no-show
- Unfair to mentor's overall rating if they had valid reason for absence
- OR Candidate confused about what to rate

**With Fix:**
- Mentor doesn't show → No feedback request
- Candidate can report no-show through support if needed
- Cleaner data - feedback only from actual sessions
- Mentor's rating only reflects actual delivered sessions

---

## Check-In System Reference

### **How Check-In Works for Coaching:**

**Endpoint:** `POST /api/sessions/{booking_id}/check-in`  
**Location:** `/app/backend/routes/session_tracking.py`

**Check-In Window:**
- Opens: 10 minutes before session start
- Closes: 15 minutes after session start

**What Happens on Check-In:**
```python
# Updates bookings collection
{
  mentor_checked_in: true,
  mentor_checked_in_at: "2026-02-26T14:05:32Z",
  candidate_checked_in: true,
  candidate_checked_in_at: "2026-02-26T14:07:15Z"
}
```

**Frontend Locations:**
- **Candidate:** `CoachingPage.jsx` - `handleJoinSession()` function
- **Mentor:** `MentorDashboard.jsx` - Check-in on join

---

## Edge Cases Handled

### **1. Legacy Sessions (No Check-In Data)**
```python
mentor_checked_in = booking.get("mentor_checked_in", False)
candidate_checked_in = booking.get("candidate_checked_in", False)
```
- Uses `False` as default
- Old sessions without check-in data won't trigger feedback
- Prevents false positives for historical data

### **2. Partial Check-In Data**
- If only one check-in field exists
- Defaults missing field to `False`
- Requires both fields to be explicitly `True`

### **3. Strategy Calls**
```python
"session_type": {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
```
- Strategy calls already excluded from feedback requirement
- This logic remains unchanged

### **4. Session Marked as Completed Without Check-In**
- Admin might manually mark session as "completed"
- But if no check-in data exists, still won't trigger feedback
- Admin can manually request feedback if needed

---

## Testing Scenarios

### **Test Case 1: Both Check In (Happy Path)**
```
Setup:
- Coaching session booked for today 2:00 PM
- Mentor checks in at 1:55 PM
- Candidate checks in at 2:05 PM
- Session happens, ends at 3:00 PM

Expected Result:
- After 3:00 PM:
  - Mentor logs in → Feedback popup for candidate ✅
  - Candidate logs in → Feedback popup for mentor ✅
```

### **Test Case 2: Mentor No-Show**
```
Setup:
- Coaching session booked for today 2:00 PM
- Candidate checks in at 1:55 PM
- Mentor never checks in
- Session time passes

Expected Result:
- After 3:00 PM:
  - Mentor logs in → No popup ✅
  - Candidate logs in → No popup ✅
```

### **Test Case 3: Candidate No-Show**
```
Setup:
- Coaching session booked for today 2:00 PM
- Mentor checks in at 1:55 PM
- Candidate never checks in
- Session time passes

Expected Result:
- After 3:00 PM:
  - Mentor logs in → No popup ✅
  - Candidate logs in → No popup ✅
```

### **Test Case 4: Both No-Show**
```
Setup:
- Coaching session booked for today 2:00 PM
- Neither party checks in
- Session time passes

Expected Result:
- After 3:00 PM:
  - Neither party sees popup ✅
```

### **Test Case 5: Legacy Session**
```
Setup:
- Old coaching session from before check-in feature
- No mentor_checked_in or candidate_checked_in fields
- Session marked as completed

Expected Result:
- Users login → No popup ✅
- (Default False for missing fields)
```

---

## Impact Analysis

### **Who This Affects:**

**Mentors:**
- ✅ Won't get feedback requests for sessions where candidate no-showed
- ✅ Won't have to explain "N/A - candidate didn't attend"
- ✅ Cleaner workflow

**Candidates:**
- ✅ Won't get feedback requests for sessions where mentor no-showed
- ✅ No frustration rating a mentor they never met
- ✅ Better user experience

**Admins:**
- ✅ Cleaner feedback data (only from actual sessions)
- ✅ More accurate mentor ratings
- ✅ Better quality metrics

### **Data Quality Impact:**

**Before:**
- Feedback includes ratings for no-show sessions
- Mentor ratings affected by sessions they didn't attend
- Candidate frustration feedback for non-existent sessions

**After:**
- Feedback only from actual sessions
- Mentor ratings only reflect delivered sessions
- Higher quality, more meaningful data

---

## Comparison: All Session Types Now Fixed

### **Summary Table:**

| Session Type | Check-In Requirement | Status |
|-------------|---------------------|--------|
| **Peer Practice** | Both users must check in | ✅ Fixed |
| **Coaching (Mentor → Candidate)** | Both must check in | ✅ Fixed |
| **Coaching (Candidate → Mentor)** | Both must check in | ✅ Fixed |
| **Strategy Calls** | N/A (no feedback required) | N/A |

**All session types now have consistent check-in validation!** 🎉

---

## Monitoring & Analytics

### **Expected Changes:**

**Metrics That May Decrease (Expected):**
- Feedback submission rate (fewer invalid sessions)
- Total feedback count (quality over quantity)

**Metrics That Should Improve:**
- User satisfaction (no annoying invalid popups)
- Feedback data quality (only actual sessions)
- Check-in compliance rate (users understand importance)

**Metrics That Should Stay Same:**
- Session completion rate
- Mentor ratings average (cleaner data)
- Candidate engagement

### **What to Monitor:**

1. **Check-In Rates:** Should remain high (important now!)
2. **User Complaints:** Should decrease (no invalid popups)
3. **Feedback Quality:** Should improve (only real sessions)
4. **No-Show Reports:** Might increase through support (good to track)

---

## Rollback Plan

If this causes issues, rollback is simple:

**Remove Lines 118-123 (Mentor Feedback) and Lines 180-185 (Candidate Feedback):**
```python
# Delete these lines from both sections:
mentor_checked_in = booking.get("mentor_checked_in", False)
candidate_checked_in = booking.get("candidate_checked_in", False)

if not (mentor_checked_in and candidate_checked_in):
    continue
```

**Restart backend:**
```bash
sudo supervisorctl restart backend
```

---

## Communication to Users

### **What Users Should Know:**

**Key Message:**
"Feedback requests now only appear if both participants checked in to the session. This ensures you're only asked to rate sessions that actually happened."

**FAQ:**

**Q: Why didn't I get a feedback request for my session?**  
A: Feedback is only requested if both you and your session partner checked in. If one person didn't check in, neither party receives a feedback request.

**Q: What if the session happened but we didn't check in?**  
A: Please make sure to check in during the check-in window (10 mins before to 15 mins after session start) to ensure feedback is requested.

**Q: What if my mentor/candidate no-showed?**  
A: If they didn't check in, you won't receive a feedback request. You can report no-shows through the support channel if needed.

---

## Summary

### **What Changed:**
- Added check-in validation to both mentor and candidate feedback triggers
- Total: 12 lines of code added (6 per feedback type)
- Consistent with peer sessions fix

### **User Impact:**
- ✅ Better UX - no popups for sessions that didn't happen
- ✅ Cleaner data - feedback only from actual sessions
- ✅ Fair to users - no-shows don't get feedback requests
- ✅ Consistent behavior across all session types

### **Technical Impact:**
- ✅ Minimal code change (12 lines)
- ✅ No database schema changes
- ✅ No frontend changes needed
- ✅ Backward compatible (legacy sessions handled)
- ✅ Consistent with peer sessions logic

### **Status:** ✅ Deployed and working

---

**Last Updated:** February 26, 2026  
**Backend Status:** Healthy ✅  
**Consistency:** All session types now use check-in validation ✅
