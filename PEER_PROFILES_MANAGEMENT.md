# Peer Practice Profiles Management - Admin Feature

## Overview
A dedicated admin section to manage which mentees/peer profiles are visible on the website for peer practice matching.

---

## Features

### **1. Peer Profiles Management Dashboard**
- View all users who have created peer practice profiles
- Search by name, email, or university
- Filter by visibility status (Visible/Hidden)
- Sort by date, name, sessions done, or rating
- Toggle visibility with one click

### **2. Profile Visibility Control**
- **Show on Website** - Makes profile visible for peer matching
- **Hide from Website** - Removes profile from public peer matching list
- Instant toggle with admin tracking
- Confirmation dialogs for safety

### **3. Comprehensive Profile View**
For each profile, view:
- Basic info (name, email, profile picture)
- Academic background (university, UG/PG college)
- Career targeting (firms, preparation level, years of experience)
- Session statistics (total, completed, pending, cancelled)
- Peer rating
- LinkedIn profile
- Google Calendar connection status

### **4. Session Statistics per Mentee**
- Total sessions booked
- Completed sessions count
- Pending sessions count
- Cancelled sessions count

---

## UI Components

### **Stats Dashboard**
5 key metrics cards:
1. **Total Profiles** - All peer profiles created
2. **Visible on Website** (Green) - Profiles shown for matching
3. **Hidden** (Red) - Profiles removed from matching
4. **Calendar Connected** (Blue) - Profiles with Google Calendar sync
5. **Average Rating** (Amber) - Overall peer rating across all profiles

### **Search & Filters**
- Search bar (name, email, university)
- Visibility filter dropdown (All / Visible / Hidden)
- Sort options (Newest First, Name, Most Sessions, Highest Rated)
- Clear filters button

### **Profiles Table**
Columns:
- Profile (photo, name, email)
- University
- Firms Targeting (tags)
- Cases Done
- Sessions (total + completed count)
- Rating (stars)
- Visibility Status (eye icon)
- Actions (View Details, Toggle Visibility)

---

## API Endpoints

### Get All Peer Profiles
```
GET /api/admin/peer-profiles

Query Parameters:
- page (int): Page number (default: 1)
- limit (int): Items per page (default: 20)
- search (string): Search term for name/email/university
- is_listed (string): "true" | "false" | null (all)
- sort_by (string): "created_at" | "name" | "peer_sessions_done" | "peer_rating"
- sort_order (string): "desc" | "asc"

Response:
{
  "profiles": [...],
  "total": 50,
  "page": 1,
  "limit": 20,
  "total_pages": 3
}
```

### Toggle Profile Visibility
```
POST /api/admin/peer-profiles/{user_id}/toggle-visibility

Body:
{
  "is_listed": true/false,
  "notes": "Optional reason for change"
}

Response:
{
  "success": true,
  "message": "Profile visibility set to visible",
  "user_id": "user123",
  "is_listed": true
}
```

### Get Profile Stats
```
GET /api/admin/peer-profiles/stats

Response:
{
  "total_profiles": 50,
  "listed_profiles": 42,
  "unlisted_profiles": 8,
  "calendar_connected": 15,
  "average_rating": 4.3
}
```

---

## Use Cases

### Use Case 1: Hide Inactive Users
**Scenario**: Some users created profiles but never scheduled sessions.

**Solution**:
1. Admin navigates to "Peer Practice Profiles"
2. Sorts by "Most Sessions" ascending
3. Reviews users with 0 sessions
4. Clicks "Hide" icon to remove them from website
5. Profiles are hidden but data is preserved

### Use Case 2: Feature Top Performers
**Scenario**: Want to ensure high-rated mentees are visible.

**Solution**:
1. Sort by "Highest Rated"
2. Review top performers
3. Ensure they are marked as "Visible"
4. Check if they have complete profiles

### Use Case 3: Clean Up Duplicate Profiles
**Scenario**: User created multiple profiles.

**Solution**:
1. Search for user name
2. View all their profiles
3. Hide duplicate profiles
4. Keep only the active one visible

### Use Case 4: Manage No-Show Users
**Scenario**: User consistently doesn't show up for sessions.

**Solution**:
1. Admin reviews session statistics
2. Sees high cancelled session count
3. Clicks on profile for details
4. Hides profile from website
5. Adds note: "Repeated no-shows"

---

## MongoDB Schema

### Peer Profiles Collection
New fields added for admin management:

```javascript
{
  // Existing fields...
  "is_listed": boolean,  // Visibility on website
  
  // Admin tracking fields (NEW)
  "admin_visibility_updated_at": "datetime",
  "admin_visibility_updated_by": "admin@gradnext.co",
  "admin_visibility_notes": "string"
}
```

---

## Difference from "Peer Sessions" Section

### **Peer Practice Profiles** (NEW Section)
- **Purpose**: Manage WHO appears on the peer matching website
- **Focus**: User profiles, visibility, biographical data
- **Actions**: Show/Hide profiles, view profile details
- **Goal**: Control the pool of available mentees for matching

### **Peer Sessions Tracking** (Existing Section)
- **Purpose**: Monitor all peer session activities
- **Focus**: Booking data, session status, feedback
- **Actions**: Change status, manage participants, view feedback
- **Goal**: Track and manage actual peer practice sessions

**Key Difference**: 
- **Profiles** = Who CAN be matched
- **Sessions** = What HAS been matched/booked

---

## Admin Actions Log

All visibility changes are tracked:
```javascript
{
  "admin_visibility_updated_at": "2026-04-12T15:30:00Z",
  "admin_visibility_updated_by": "admin@gradnext.co",
  "admin_visibility_notes": "Hidden due to inactivity"
}
```

This provides:
- Accountability (who made the change)
- Timestamp (when it happened)
- Context (why it was changed)

---

## Benefits

1. **Quality Control**: Hide incomplete or low-quality profiles
2. **User Experience**: Only show active, engaged mentees for matching
3. **Moderation**: Quickly remove problematic users from matching pool
4. **Analytics**: Track which profiles are most active
5. **Flexibility**: Keep data but control visibility

---

## Navigation

**Admin Panel** → **Tabs** → **Peer Practice Profiles**

This is a SEPARATE tab from:
- Peer Sessions (tracks bookings)
- Users (general user management)
- Mentors (mentor-specific management)

---

## Testing

### Manual Test Steps:

1. **Access the Section**:
   - Login as admin
   - Navigate to Admin Panel
   - Click "Peer Practice Profiles" tab

2. **View Stats**:
   - Verify stats cards show correct counts
   - Check total profiles, visible/hidden split

3. **Search Functionality**:
   - Search for a specific user
   - Verify results filter correctly

4. **Toggle Visibility**:
   - Click eye icon on a profile row
   - Confirm the action
   - Verify profile visibility changes
   - Check stats update accordingly

5. **View Details**:
   - Click "View" icon on any profile
   - Modal opens with full details
   - Verify all session stats display
   - Test "Show/Hide" button in modal

6. **Filtering**:
   - Use visibility filter (All / Visible / Hidden)
   - Verify table updates
   - Test sorting options

### API Testing:

```bash
# Get admin token
TOKEN=$(curl -s -X POST "https://your-url/api/auth/mock-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gradnext.co"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['auth_token'])")

# Get all profiles
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-url/api/admin/peer-profiles?page=1&limit=20"

# Get stats
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-url/api/admin/peer-profiles/stats"

# Hide a profile
curl -X POST "https://your-url/api/admin/peer-profiles/USER_ID/toggle-visibility" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_listed":false,"notes":"Test hide"}'
```

---

## Files Created/Modified

### Backend:
- `/app/backend/routes/admin.py`
  - Added `get_all_peer_profiles()` - List all profiles with filters
  - Added `admin_toggle_peer_profile_visibility()` - Show/hide profiles
  - Added `get_peer_profiles_stats()` - Aggregate statistics

### Frontend:
- `/app/frontend/src/components/AdminComponents.jsx`
  - Added `PeerProfilesManagementSection` component (500+ lines)
  - Profile listing table
  - Stats dashboard
  - Search and filter UI
  - Profile detail modal
  - Visibility toggle functionality

---

## Future Enhancements

- Bulk visibility toggle (select multiple profiles)
- Export profiles to Excel
- Profile quality score (completeness percentage)
- Automated rules (e.g., auto-hide if inactive for 90 days)
- Profile verification status
- Notes/tags system for profiles
- Activity timeline for each profile

---

## Important Notes

- Hiding a profile does NOT delete it - data is preserved
- Hidden profiles can still access the platform
- Hidden profiles just won't appear in peer matching results
- Admin can always unhide profiles later
- Session history is preserved regardless of visibility status

---

*Feature Created: April 12, 2026*
*Version: 1.0*
