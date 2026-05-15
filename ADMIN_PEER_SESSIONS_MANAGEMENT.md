# Admin Peer Sessions Management - Feature Documentation

## Overview
Enhanced admin panel for comprehensive peer session management with new admin-specific status options and participant management capabilities.

## New Features

### 1. **Admin-Specific Status Options**

Two new status types have been added to give admins more control:

- **`admin_cancelled`**: Used when admin cancels a session (e.g., due to no-show, inappropriate behavior)
- **`admin_rescheduled`**: Used when admin reschedules a session on behalf of users

These statuses are tracked separately from user-initiated cancellations and provide better analytics.

#### Complete Status List:
- `pending` - Awaiting partner approval
- `confirmed` - Both parties confirmed
- `completed` - Session finished
- `cancelled` - Generic cancellation
- `declined` - Partner declined the request
- **`admin_cancelled` - Admin cancelled the session** ✨ NEW
- **`admin_rescheduled` - Admin rescheduled the session** ✨ NEW
- `reschedule_pending` - Reschedule request pending

---

### 2. **Participant Management**

Admins can now manage who participates in peer sessions:

#### Actions Available:
- **Remove Requester**: Removes the person who requested the session
- **Remove Partner**: Removes the partner from the session
- **Future Enhancement**: Swap participants (endpoint ready, UI coming soon)

#### What Happens When You Remove a Participant:
- Session status automatically changes to `admin_cancelled`
- Timestamp of removal is recorded
- Admin action is logged in session history
- Cannot be undone (data preserved for audit trail)

---

### 3. **Admin Action History**

Every admin action on a peer session is now logged:

```json
{
  "timestamp": "2026-04-12T12:30:00Z",
  "admin_email": "admin@gradnext.co",
  "admin_name": "Admin User",
  "action": "Status changed to admin_cancelled",
  "notes": "No-show from requester"
}
```

This provides a complete audit trail of all administrative actions.

---

## API Endpoints

### Update Session Status
```
POST /api/admin/peer-sessions/{session_id}/update-status

Body:
{
  "status": "admin_cancelled",
  "notes": "Reason for status change (optional)"
}

Allowed statuses:
- pending, confirmed, completed, cancelled, declined
- admin_cancelled, admin_rescheduled, reschedule_pending
```

### Manage Participants
```
POST /api/admin/peer-sessions/{session_id}/participants

Body:
{
  "action": "remove_requester" | "remove_partner" | "swap_requester" | "swap_partner",
  "new_user_id": "user_id_here (required for swap actions)",
  "notes": "Optional reason"
}
```

### Get Action History
```
GET /api/admin/peer-sessions/{session_id}/action-history

Response:
{
  "session_id": "abc123",
  "action_history": [...],
  "total_actions": 3
}
```

---

## UI Changes

### Admin Peer Sessions Page (`/admin` → Peer Sessions Tab)

#### Filter Dropdown - Updated
Now includes new admin statuses in the filter dropdown:
- Admin Cancelled
- Admin Rescheduled

#### Session Actions - Enhanced
Each session row now has **3 action buttons**:

1. **👁️ View Details** - Opens modal with complete session info
2. **✏️ Update Status** - Change session status (including new admin statuses)
3. **👥 Manage Participants** - Remove participants ✨ NEW

#### Manage Participants Modal
- Shows both requester and partner with profile pictures
- "Remove" button for each participant
- Warning message about cancellation
- Clean, intuitive interface

---

## Use Cases

### Use Case 1: Handling No-Shows
**Problem**: A mentee booked multiple sessions but never showed up.

**Solution**:
1. Admin opens peer sessions list
2. Finds all sessions for that mentee
3. Clicks "Manage Participants" → Removes the mentee
4. Session is marked as `admin_cancelled`
5. Partner is freed up for other sessions

### Use Case 2: Managing Inappropriate Behavior
**Problem**: A user reported inappropriate conduct during a peer session.

**Solution**:
1. Admin reviews the session
2. Clicks "Manage Participants"
3. Removes the offending participant
4. Adds note: "Removed due to code of conduct violation"
5. Action is logged for records

### Use Case 3: Admin-Initiated Rescheduling
**Problem**: System maintenance requires moving sessions.

**Solution**:
1. Admin identifies affected sessions
2. Clicks "Update Status"
3. Sets status to `admin_rescheduled`
4. Adds note: "Rescheduled due to maintenance window"
5. Coordinates new time with participants separately

---

## Data Model Changes

### Session Document Fields (MongoDB)

New fields added to `peer_sessions` collection:

```javascript
{
  // Existing fields...
  
  // New admin-specific fields
  "admin_notes": "string",
  "admin_updated_at": "datetime",
  "last_admin_email": "admin@gradnext.co",
  "admin_action_history": [
    {
      "timestamp": "datetime",
      "admin_email": "string",
      "admin_name": "string",
      "action": "string",
      "notes": "string"
    }
  ],
  
  // Participant management fields
  "requester_removed_by_admin": true/false,
  "requester_removed_at": "datetime",
  "partner_removed_by_admin": true/false,
  "partner_removed_at": "datetime",
  "admin_swapped_requester": true/false,
  "admin_swapped_partner": true/false
}
```

---

## Testing

### Manual Testing Steps:

1. **Test New Status Options**:
   - Login as admin
   - Navigate to Admin → Peer Sessions
   - Click "Update Status" on any session
   - Verify "Admin Cancelled" and "Admin Rescheduled" appear in dropdown
   - Select one and save
   - Verify session status updates correctly

2. **Test Participant Removal**:
   - Click "Manage Participants" (Users icon) on a session
   - Verify modal shows both requester and partner
   - Click "Remove" on one participant
   - Confirm the action
   - Verify session status changes to "admin_cancelled"
   - Verify session list refreshes

3. **Test Filtering**:
   - Use status filter dropdown
   - Select "Admin Cancelled"
   - Verify only admin-cancelled sessions appear

### API Testing (curl):

```bash
# Get auth token
TOKEN=$(curl -s -X POST "https://your-backend-url/api/auth/mock-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gradnext.co"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['auth_token'])")

# Update status to admin_cancelled
curl -X POST "https://your-backend-url/api/admin/peer-sessions/SESSION_ID/update-status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"admin_cancelled","notes":"No-show from both participants"}'

# Remove a participant
curl -X POST "https://your-backend-url/api/admin/peer-sessions/SESSION_ID/participants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"remove_requester","notes":"Repeated no-shows"}'
```

---

## Benefits

1. **Better Control**: Admin can now manage sessions that are problematic
2. **Accountability**: All admin actions are logged with timestamps and notes
3. **Analytics**: Separate status types allow better reporting on admin interventions
4. **User Experience**: Quickly handle no-shows and free up participants
5. **Compliance**: Audit trail for all administrative actions

---

## Future Enhancements

- Add "Swap Participant" UI for replacing one user with another
- Send automated notifications when admin takes action
- Add bulk actions for managing multiple sessions at once
- Export admin action history for compliance reports
- Add permission levels (some admins can only view, others can modify)

---

## Notes for Developers

- All admin actions are logged in `admin_action_history` array
- Status validation happens in backend, frontend just displays options
- Removing a participant automatically sets status to `admin_cancelled`
- `get_current_user(request)` is used to identify admin making changes
- MongoDB `$push` operator used for action history (preserves all actions)

---

## Files Modified

### Backend:
- `/app/backend/routes/admin.py`
  - Updated `admin_update_peer_session_status()` - Added admin status options
  - Added `admin_manage_peer_session_participants()` - Participant management
  - Added `get_peer_session_action_history()` - View admin actions

### Frontend:
- `/app/frontend/src/components/AdminComponents.jsx`
  - Updated `PeerSessionsSection` component
  - Added `admin_cancelled` and `admin_rescheduled` to status badges
  - Added "Manage Participants" button and modal
  - Added participant removal handlers
  - Updated filter and status dropdowns

---

## Support

For issues or questions:
1. Check admin panel console for JavaScript errors
2. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
3. Verify admin user has `is_admin: true` flag in database
4. Ensure all sessions have valid `id` field

---

*Document Created: April 12, 2026*
*Feature Version: 1.0*
