# Strategy Call Post-Booking Flow - Current State & Recommendations

## 📊 Current Post-Booking Flow

### What Happens NOW After Booking:

1. **✅ Database Entry Created**
   - Session saved to `strategy_call_sessions` collection
   - Contains: user info, mentor info, date, time, status="scheduled"

2. **✅ Credit Deducted**
   - User's `strategy_calls_used` incremented by 1
   - Remaining credits updated

3. **✅ Frontend Confirmation**
   - Shows "Matched with [Mentor Name]!" screen
   - Displays mentor details (picture, position, company, rating)
   - Shows booking confirmation (date & time)
   - Success alert after 2 seconds
   - Modal closes

4. **❌ No Email Notifications**
   - User does NOT receive confirmation email
   - Mentor does NOT receive notification email
   - No calendar invite sent

5. **❌ No Dashboard Display**
   - Strategy call sessions NOT shown in "Upcoming Sessions" widget
   - Only coaching and peer sessions are displayed
   - User cannot see their booked strategy calls on dashboard

6. **❌ No Meeting Link**
   - No Google Meet/Zoom link generated
   - No video conferencing integration

7. **❌ No Reminders**
   - No email reminders before the session
   - No SMS/push notifications

---

## 🔍 Where Are Strategy Call Sessions?

### Current Implementation Gaps:

**Backend** (`/backend/routes/resources.py` - `get_dashboard_summary`):
```python
# Line 1220+: Fetches upcoming coaching sessions ✅
upcoming_coaching = await db.bookings.find({...}).to_list(10)

# Line 1265+: Fetches upcoming peer sessions ✅  
upcoming_peer_sessions = await db.peer_sessions.find({...}).to_list(5)

# ❌ MISSING: No fetch for strategy call sessions!
# Should add:
# upcoming_strategy = await db.strategy_call_sessions.find({...}).to_list(5)
```

**Frontend** (`DashboardOverview.jsx`):
```javascript
// Line 626: Destructures upcoming sessions
const upcoming_sessions = dashboardData?.upcoming_sessions || {};

// Line 887-888: Prepares coaching and peer
const upcomingCoaching = upcoming_sessions?.coaching || [];
const upcomingPeer = upcoming_sessions?.peer_practice || [];

// ❌ MISSING: No variable for strategy call sessions
// Should add:
// const upcomingStrategy = upcoming_sessions?.strategy_calls || [];
```

---

## ✅ Recommended Complete Post-Booking Flow

### Immediate Actions (After Booking Success):

1. **✅ Database Entry** (Already done)
   
2. **📧 Email Notifications**
   - **To User**: Confirmation email with:
     - Booking details (date, time, mentor)
     - Calendar invite (.ics file)
     - Pre-call instructions
     - Zoom/Meet link
   
   - **To Mentor**: Notification email with:
     - Student details (name, background, goals)
     - Session date & time
     - Calendar invite
     - Meeting link
     - Pre-session notes from student

3. **📅 Calendar Integration**
   - Generate Google Meet or Zoom link
   - Create calendar events
   - Send .ics file attachments

4. **✅ Frontend Updates** (Already done)
   - Show confirmation screen
   - Update credits display

---

### Dashboard Display (After Booking):

1. **Add "Upcoming Strategy Calls" Section**
   - Similar to coaching sessions widget
   - Shows next 2-3 strategy calls
   - Display: date, time, mentor name, mentor picture
   - Action: Join call (when time approaches)
   - Action: Cancel/Reschedule

2. **Session Card Design**:
   ```
   [Mentor Picture]  Friday, Feb 2, 2026
                     09:30 AM - 10:00 AM
                     with Priya Sharma
                     Senior Consultant, McKinsey
                     
                     [Join Call] [Reschedule]
   ```

3. **Integration with Existing Widget**:
   - Add after "Upcoming Coaching" section
   - Use same design language
   - Show "No upcoming strategy calls" if empty

---

### Reminder System:

1. **24 Hours Before**:
   - Email reminder to user & mentor
   - "Your strategy call tomorrow at 9:30 AM"
   - Include meeting link

2. **1 Hour Before**:
   - Push notification (if available)
   - Email reminder
   - "Your call starts in 1 hour"

3. **15 Minutes Before**:
   - Final reminder
   - Enable "Join Call" button

---

### During Session Time:

1. **Join Call Button Active**
   - Shows on dashboard
   - Links to video meeting
   - Tracks attendance

2. **Session Status Updates**:
   - "in_progress" when joined
   - "completed" after end time
   - "no_show" if not joined

---

### Post-Session Flow:

1. **Immediate**:
   - Mark session as completed
   - Send thank you email

2. **Follow-up (24 hours after)**:
   - Request feedback from user
   - Request feedback from mentor
   - Email with feedback form link

3. **Dashboard**:
   - Move to "Past Sessions"
   - Show feedback option
   - Display session notes/recording (if any)

---

## 🛠️ Implementation Priority

### Phase 1: Critical (Implement Now)
1. ✅ Show strategy calls in dashboard upcoming sessions
2. ✅ Email confirmation to user
3. ✅ Email notification to mentor
4. ✅ Meeting link generation (Google Meet/Zoom)

### Phase 2: Important (Next)
1. Calendar invite attachments
2. 24-hour reminder emails
3. Join call functionality
4. Cancel/reschedule options

### Phase 3: Nice to Have
1. 1-hour & 15-min reminders
2. SMS notifications
3. Push notifications
4. Session recording
5. Post-session feedback system

---

## 📧 Email Templates Needed

### 1. User Confirmation Email
```
Subject: Strategy Call Confirmed - Feb 2 at 9:30 AM with Priya Sharma

Hi [User Name],

Your strategy call has been confirmed!

📅 Date: Friday, February 2, 2026
⏰ Time: 9:30 AM - 10:00 AM IST
👤 Mentor: Priya Sharma
   Senior Consultant, McKinsey & Company
   ⭐ 4.9 rating

🔗 Meeting Link: [Join Call]

What to Prepare:
- Your case questions or challenges
- Specific areas you want to focus on
- Any materials you'd like to discuss

[Add to Calendar]

See you soon!
```

### 2. Mentor Notification Email
```
Subject: New Strategy Call Booked - Feb 2 at 9:30 AM

Hi Priya,

You have a new strategy call session booked:

📅 Date: Friday, February 2, 2026
⏰ Time: 9:30 AM - 10:00 AM IST
👤 Student: John Doe
   Plan: Full Prep

🔗 Meeting Link: [Join Call]

Student Notes:
[Any notes provided during booking]

[Add to Calendar] [View Details]
```

### 3. Reminder Email (24h before)
```
Subject: Reminder: Strategy Call Tomorrow at 9:30 AM

Hi [User Name],

Your strategy call is tomorrow!

📅 Tomorrow at 9:30 AM
👤 with Priya Sharma

🔗 [Join Call]

Prepare your questions and see you soon!
```

---

## 🔗 Meeting Link Integration

### Options:

**Option 1: Google Meet (Recommended)**
- Automatic link generation via Google Calendar API
- No additional service needed
- Integrates with existing calendar

**Option 2: Zoom**
- Requires Zoom API integration
- More robust features
- Better recording options

**Option 3: Custom Video Solution**
- Use Jitsi (open source)
- Full control
- No external dependencies

---

## 📝 Database Schema Check

Current `strategy_call_sessions` document:
```javascript
{
  "id": "strategy-xxxxx",
  "type": "strategy_call",
  "user_id": "user-123",
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "mentor_id": "mentor-1",
  "mentor_name": "Priya Sharma",
  "mentor_email": "priya@example.com",
  "date": "2026-02-02",
  "time": "09:30",
  "duration_minutes": 30,
  "status": "scheduled",
  "notes": "",
  "created_at": "2026-01-31T13:00:00Z",
  "updated_at": "2026-01-31T13:00:00Z"
}
```

**Recommended Additions**:
```javascript
{
  // ... existing fields ...
  "meeting_link": "https://meet.google.com/xxx-yyyy-zzz",
  "calendar_event_id": "google-cal-event-id",
  "reminder_sent_24h": false,
  "reminder_sent_1h": false,
  "joined_at": null,
  "completed_at": null,
  "feedback_requested": false,
  "user_feedback": null,
  "mentor_feedback": null
}
```

---

## 🎯 Summary

**Current State**: 
- ✅ Booking works
- ✅ Credits deducted
- ✅ Frontend confirmation
- ❌ No emails
- ❌ No dashboard display
- ❌ No meeting links
- ❌ No reminders

**Next Steps**:
1. Add strategy calls to dashboard upcoming sessions widget
2. Implement email notifications
3. Add meeting link generation
4. Enable join call functionality

**Impact**: 
- Better user experience
- Reduced no-shows
- Professional communication
- Clear session visibility
- Easy access to calls
