# How Peer Practice Sessions Are Marked as Completed

## Overview
Peer practice sessions **do NOT have an explicit "completed" status field** in the database. Instead, completion is determined by **time-based logic** on the frontend.

## Completion Logic

### **A session is considered "completed" (past) when:**

```javascript
const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
const now = new Date();
return sessionDateTime < now;
```

**Translation:** If the session's date and time have passed, it's automatically considered "completed" or "past."

### **Location of Logic**
**Frontend:** `/app/frontend/src/components/dashboard/PeerPracticePage.jsx` (Lines 701-716)

```javascript
const { upcomingSessions, pendingRequests, pastSessions } = useMemo(() => {
  const now = new Date();
  
  // Upcoming sessions - future date AND not cancelled/declined
  const upcoming = mySessions.filter(s => {
    const sessionDate = new Date(`${s.date}T${s.time_slot}`);
    return sessionDate >= now && !['cancelled', 'declined'].includes(s.status);
  });
  
  // Past sessions - past date OR cancelled/declined
  const past = mySessions.filter(s => {
    const sessionDate = new Date(`${s.date}T${s.time_slot}`);
    return sessionDate < now || ['cancelled', 'declined'].includes(s.status);
  });
  
  return { upcomingSessions, pendingRequests, pastSessions };
}, [mySessions]);
```

## Session Status Field Values

The `status` field in the database tracks **approval/lifecycle status**, NOT completion:

### Database Status Values
1. **`pending`** - Session request waiting for partner approval
2. **`confirmed`** - Session approved by partner, ready to happen
3. **`declined`** - Partner declined the session request
4. **`cancelled`** - Session was cancelled by either party
5. **`reschedule_pending`** - Reschedule request waiting for approval

### Important Note
❌ There is NO `"completed"` status in the database  
✅ Completion is inferred from date/time comparison

## Check-In System

### Purpose
The check-in system tracks **attendance**, not completion:

**Backend:** `/app/backend/routes/session_tracking.py` (Lines 452-540)

### Check-In Fields in Database
```javascript
{
  requester_checked_in: boolean,
  requester_checked_in_at: ISO timestamp,
  partner_checked_in: boolean,
  partner_checked_in_at: ISO timestamp
}
```

### Check-In Window
- **Opens:** 10 minutes before session start
- **Closes:** 15 minutes after session start
- **Purpose:** Confirm attendance and provide meet link

### Check-In Logic
```javascript
// POST /api/sessions/peer/{session_id}/check-in

// Verify user is part of session
// Check if within check-in window (10 mins before to 15 mins after)
// Record check-in timestamp
// Return meeting link
```

## Session Lifecycle Flow

### 1. **Request Phase**
```
Status: pending
User A requests session → User B receives notification
```

### 2. **Confirmation Phase**
```
Status: confirmed (if approved) OR declined (if rejected)
Both users have confirmed session on their calendars
```

### 3. **Check-In Phase** (Day of Session)
```
Status: confirmed (unchanged)
Window: 10 mins before to 15 mins after start
Actions:
  - Users check-in
  - System records: requester_checked_in_at, partner_checked_in_at
  - Meet link provided
```

### 4. **Session Time**
```
Status: confirmed (unchanged)
Joinable Window: 15 mins before to 90 mins after start
Users join via meet link
```

### 5. **Post-Session** (Automatic)
```
Status: confirmed (unchanged)
Completion: Determined by date/time (sessionDate < now)
Display: Moves to "Past Sessions" tab
Feedback: Available 30 mins after session start
```

## Frontend Display Logic

### Upcoming Sessions Tab
**Shows sessions where:**
```javascript
sessionDateTime >= now && status NOT IN ['cancelled', 'declined']
```

### Past Sessions Tab
**Shows sessions where:**
```javascript
sessionDateTime < now OR status IN ['cancelled', 'declined']
```

### Join Button Availability
```javascript
// Joinable window: 15 mins before to 90 mins after start
const isSessionJoinable = (session) => {
  const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
  const now = new Date();
  const diffMinutes = (sessionDateTime - now) / (1000 * 60);
  return diffMinutes <= 15 && diffMinutes >= -90;
};
```

### Feedback Window
```javascript
// Feedback available: 30 mins after session start
const needsFeedback = (session) => {
  const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
  const feedbackWindowStart = new Date(sessionDateTime.getTime() + 30 * 60 * 1000);
  return new Date() >= feedbackWindowStart && !session.feedback_submitted;
};
```

## Key Differences from Coaching Sessions

### Coaching Sessions
- ✅ Have explicit `status: "completed"` field
- ✅ Mentor manually marks as completed
- ✅ Mentor submits completion notes and duration
- ✅ Backend endpoint: `POST /api/sessions/{booking_id}/complete`

### Peer Practice Sessions
- ❌ NO explicit "completed" status
- ❌ NO manual completion action
- ✅ Automatically considered "past" when date/time passes
- ✅ Only tracks: check-ins, feedback, and status (pending/confirmed/cancelled)

## Why This Design?

### Rationale
1. **Peer-to-peer nature:** No authority figure to mark completion
2. **Automatic transition:** Sessions naturally become "past" after time elapses
3. **Simplified workflow:** No manual action needed from either party
4. **Feedback-driven:** Completion verified through mutual feedback submission

### Implicit Completion Indicators
1. **Time passed:** Session datetime < current time
2. **Check-in recorded:** requester_checked_in && partner_checked_in
3. **Feedback given:** requester_feedback && partner_feedback (optional)

## Analytics & Tracking

### Completed Peer Sessions Count
**Backend:** `/app/backend/routes/resources.py` (Lines 2102-2106)

```javascript
// Count completed peer sessions for user profile stats
completed_peer = await db.peer_sessions.count_documents({
  "$or": [
    {"requester_id": user_id},
    {"partner_id": user_id}
  ],
  "status": {"$in": ["confirmed"]},  // Excludes cancelled/declined
  "date": {"$lt": today_str}  // Past date
})
```

### Check-In Statistics
```javascript
both_checked_in = await db.peer_sessions.count_documents({
  "requester_checked_in": true,
  "partner_checked_in": true,
  "date": date_filter
})
```

## Summary

### Peer Session "Completion" Checklist

| Criteria | How It's Tracked |
|----------|------------------|
| **Session happened** | `sessionDate < currentDate` (automatic) |
| **Status in system** | Remains `"confirmed"` (never changes to "completed") |
| **Attendance** | `requester_checked_in` + `partner_checked_in` (optional) |
| **User verification** | Feedback submission (optional) |
| **Display location** | Past Sessions tab (frontend filtering) |

### Key Takeaway
**Peer practice sessions are marked as "completed" purely by time passage, not by explicit database status.**

The system:
1. ✅ Creates session with `status: "confirmed"`
2. ✅ Tracks check-ins during session window
3. ✅ Automatically moves to "Past Sessions" when time passes
4. ✅ Collects feedback post-session
5. ❌ Never updates status to "completed"

This is **different from coaching sessions** which require mentor to explicitly mark as completed.

## Potential Enhancements (If Needed)

### If Explicit Completion is Required:

**Option 1: Automatic Backend Job**
```python
# Run daily cron job
async def auto_complete_past_peer_sessions():
    """Mark confirmed peer sessions as completed if past"""
    await db.peer_sessions.update_many(
        {
            "status": "confirmed",
            "date": {"$lt": today_str}
        },
        {"$set": {"status": "completed"}}
    )
```

**Option 2: Completion on Check-In**
```python
# When both parties check-in, mark as "in_progress"
# After 2 hours, mark as "completed"
```

**Option 3: Feedback-Based Completion**
```python
# Mark as completed when both parties submit feedback
if requester_feedback and partner_feedback:
    status = "completed"
```

### Current System is Sufficient Because:
1. ✅ Frontend correctly categorizes past vs upcoming
2. ✅ Analytics count completed sessions correctly
3. ✅ Feedback system works independently
4. ✅ No business logic depends on explicit "completed" status
5. ✅ Simpler system with less manual intervention

---

**Last Updated:** February 26, 2026  
**Status:** Current implementation working as designed
