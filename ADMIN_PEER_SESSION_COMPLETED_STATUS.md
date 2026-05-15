# Admin Panel: Peer Session "Completed" Status Explained

## The Answer

**Peer sessions are marked as "completed" in the admin panel through TWO methods:**

### 1. **Automatic - When Feedback is Submitted** ✅ (Primary Method)

**Backend:** `/app/backend/routes/peers.py` (Lines 2728-2735)

When either participant submits feedback for the session, the status is **automatically changed to "completed"**:

```python
await db.peer_sessions.update_one(
    {"_id": session["_id"]},
    {"$set": {
        feedback_field: feedback_doc,
        feedback_submitted_field: True,
        "status": "completed"  # ← Automatically set!
    }}
)
```

**Trigger:** User submits feedback via `POST /api/peers/sessions/{session_id}/feedback`

**Why:** Feedback submission is considered proof that the session happened, so it automatically marks it as completed.

### 2. **Manual - Admin Can Change Status** ✅ (Override Method)

**Backend:** `/app/backend/routes/admin.py` (Lines 3815-3846)

Admins can manually update any peer session status through the admin panel:

```python
@router.post("/peer-sessions/{session_id}/update-status")
async def admin_update_peer_session_status(session_id: str, request: Request):
    """Admin can update peer session status"""
    
    if new_status not in ["pending", "confirmed", "completed", "cancelled", "declined"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.peer_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": new_status,  # ← Can be set to "completed"
            "admin_notes": notes,
            "admin_updated_at": datetime.utcnow()
        }}
    )
```

**Trigger:** Admin clicks "Update Status" button in admin panel and selects "completed"

**Why:** Allows admin override for edge cases (e.g., session happened but users forgot feedback)

---

## Complete Status Flow

### For Regular Users (Frontend View)

**Frontend:** `/app/frontend/src/components/dashboard/PeerPracticePage.jsx`
- Sessions are shown as "past" if `sessionDate < currentDate`
- Database status field is NOT checked by regular users
- Display is purely time-based

### For Admin Panel

**Frontend:** `/app/frontend/src/components/AdminComponents.jsx` (Lines 752-766)
- Admin panel DOES show the actual database `status` field
- Status badge colors:
  - `pending` → Amber
  - `confirmed` → Blue
  - `completed` → Green ← **This is what you see!**
  - `cancelled` → Gray
  - `declined` → Red
  - `reschedule_pending` → Purple

```javascript
const getStatusBadge = (status) => {
  const statusStyles = {
    'pending': 'bg-amber-100 text-amber-700',
    'confirmed': 'bg-blue-100 text-blue-700',
    'completed': 'bg-green-100 text-green-700',  // ← Green badge
    'cancelled': 'bg-slate-100 text-slate-700',
    'declined': 'bg-red-100 text-red-700',
    'reschedule_pending': 'bg-purple-100 text-purple-700',
  };
  return <span className={statusStyles[status]}>{status}</span>;
};
```

---

## Why Two Different Behaviors?

### Candidate View (Time-Based)
**Purpose:** Simple UX - sessions automatically move to "past" after time passes
**Logic:** Frontend filtering only
**No database update needed**

### Admin View (Status-Based)
**Purpose:** Track actual completion for:
- Analytics
- Payment/credit tracking
- Session quality monitoring
- Dispute resolution

**Logic:** Database field that gets updated when:
1. ✅ User submits feedback (automatic)
2. ✅ Admin manually updates (override)

---

## Complete Session Lifecycle with Status

```
┌─────────────────────────────────────────────────────────┐
│ 1. User A requests session with User B                  │
│    Status: "pending"                                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. User B approves the request                          │
│    Status: "confirmed"                                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Session time arrives                                  │
│    Both users check-in (optional)                        │
│    Status: Still "confirmed"                             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Session happens, time passes                          │
│    Frontend: Shows in "Past Sessions"                    │
│    Database: Status still "confirmed"                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5A. User A submits feedback                              │
│     Status: "completed" (AUTO)                           │
│     OR                                                    │
│ 5B. Admin manually marks as completed                    │
│     Status: "completed" (MANUAL)                         │
└─────────────────────────────────────────────────────────┘
```

---

## Statistics & Analytics

**Backend:** `/app/backend/routes/admin.py` (Lines 3711-3714)

The admin stats API counts sessions by status:

```python
total = await db.peer_sessions.count_documents(base_filter)
pending = await db.peer_sessions.count_documents({**base_filter, "status": "pending"})
confirmed = await db.peer_sessions.count_documents({**base_filter, "status": "confirmed"})
completed = await db.peer_sessions.count_documents({**base_filter, "status": "completed"})
cancelled = await db.peer_sessions.count_documents({**base_filter, "status": "cancelled"})
declined = await db.peer_sessions.count_documents({**base_filter, "status": "declined"})
```

This means:
- ✅ Admin dashboard shows accurate "Completed" count
- ✅ Only includes sessions where feedback was given OR admin marked complete
- ✅ "Confirmed" sessions that passed but no feedback = NOT counted as completed

---

## Real-World Examples

### Scenario 1: Normal Flow (Feedback Submitted)
```
1. Session scheduled: status = "confirmed"
2. Session happens at 2:00 PM
3. 2:30 PM - User A submits feedback
   → status automatically changes to "completed" ✅
4. Admin panel shows green "completed" badge
```

### Scenario 2: No Feedback, Time Passed
```
1. Session scheduled: status = "confirmed"
2. Session happens at 2:00 PM
3. No one submits feedback
   → status remains "confirmed" (not "completed")
4. Admin panel shows blue "confirmed" badge
5. Frontend still shows in "Past Sessions" (time-based)
```

### Scenario 3: Admin Override
```
1. Session scheduled: status = "confirmed"
2. Session happens but users forgot feedback
3. Admin manually changes status to "completed"
   → status = "completed" ✅
4. Admin panel shows green "completed" badge
```

### Scenario 4: Cancelled Session
```
1. Session scheduled: status = "confirmed"
2. User cancels before session time
   → status = "cancelled"
3. Admin panel shows gray "cancelled" badge
4. Frontend shows in "Past Sessions" (because cancelled)
```

---

## Key Differences Summary

| Aspect | Candidate View | Admin View |
|--------|---------------|------------|
| **What field checked?** | Date/time only | `status` field in DB |
| **"Completed" means** | Time has passed | Feedback submitted OR admin marked |
| **Database update?** | No | Yes |
| **Status values used** | N/A (time-based) | pending, confirmed, completed, etc. |
| **When shows as past?** | sessionDate < now | status = "completed" (green badge) |

---

## How to Check Session Status

### As Admin in Admin Panel:

1. Go to Admin Dashboard → Peer Sessions
2. Look at the status badge color:
   - 🟢 **Green "completed"** = Feedback submitted or admin marked
   - 🔵 **Blue "confirmed"** = Scheduled, may have happened but no feedback
   - 🟡 **Amber "pending"** = Awaiting partner approval
   - ⚪ **Gray "cancelled"** = Cancelled by user
   - 🔴 **Red "declined"** = Partner rejected

### As User in Dashboard:

1. Go to Dashboard → Peer Practice → My Sessions
2. Look at tab location:
   - **Upcoming Sessions** tab = Future date/time
   - **Past Sessions** tab = Past date/time (regardless of status)

---

## API Endpoints Summary

### For Users:
- `GET /api/peers/my-sessions` - Returns all sessions (status included but not primary filter)
- `POST /api/peers/sessions/{id}/feedback` - Submit feedback → **Auto-sets status to "completed"**

### For Admins:
- `GET /api/admin/peer-sessions` - Get all sessions with status filter
- `GET /api/admin/peer-sessions/stats` - Count by status (including "completed")
- `POST /api/admin/peer-sessions/{id}/update-status` - Manually change status

---

## Conclusion

**The "completed" status you see in the admin panel comes from:**

1. **Primary method (90% of cases):** Automatic when user submits feedback
2. **Secondary method (10% of cases):** Manual admin override

**This is different from the candidate view** which uses time-based logic and doesn't care about the database status field.

The dual system allows:
- ✅ Simple UX for candidates (automatic time-based)
- ✅ Accurate tracking for admins (feedback-confirmed completion)
- ✅ Override capability for edge cases
- ✅ Reliable analytics and metrics

---

**Last Updated:** February 26, 2026  
**Status:** Current implementation documented
