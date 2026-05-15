# FIX FOR MENTOR RATINGS - PRODUCTION

## Issue
Mentors with 0 sessions are showing 5.0 rating in production.

## Solution

### Step 1: Deploy Your Application
Deploy the latest code to production.

### Step 2: Run This Command

**Open browser console on app.gradnext.co and paste:**

```javascript
fetch('https://app.gradnext.co/api/admin/cleanup/mentor-ratings', {
  method: 'POST',
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ CLEANUP RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Removed from mentors with 0 sessions: ${data.details.removed_from_zero_sessions}`);
  console.log(`Removed from mentors without feedback: ${data.details.removed_from_no_feedback}`);
  console.log(`Total mentors cleaned: ${data.details.total_cleaned}`);
  console.log(`Remaining bad records: ${data.details.remaining_bad}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (data.details.remaining_bad === 0) {
    alert(`✅ SUCCESS! Fixed ${data.details.total_cleaned} mentors. Refresh the page now.`);
  } else {
    alert(`⚠️ Fixed ${data.details.total_cleaned} but ${data.details.remaining_bad} still need fixing. Run again.`);
  }
})
.catch(err => {
  console.error('❌ Error:', err);
  alert('Error running cleanup. Make sure you are logged in as admin.');
});
```

### Step 3: Refresh Page
After seeing "SUCCESS", hard refresh the coaching page (Ctrl+Shift+R or Cmd+Shift+R)

### Expected Result

**BEFORE:**
- Vishwajeet Karmwar: ⭐ 5.0, 👥 0 sessions ❌

**AFTER:**
- Vishwajeet Karmwar: ⭐ N/A, 👥 0 sessions ✅

## What This Does

1. Removes ratings from ALL mentors with 0 sessions
2. Removes ratings from mentors without actual candidate feedback
3. Only keeps ratings for mentors who have REAL feedback from candidates

## Safe to Run Multiple Times

This endpoint is safe to run multiple times. It will only remove ratings where they shouldn't exist.

## Files Changed

- `/app/backend/routes/cleanup.py` - NEW cleanup endpoint
- `/app/backend/server.py` - Added cleanup router
- `/app/backend/models.py` - Removed default 5.0 rating
- `/app/backend/routes/strategy_calls.py` - Fixed rating display logic

## Verification

After cleanup, check any mentor with 0 sessions:
- Should show "N/A" or no rating
- NOT show 5.0

Only mentors with completed sessions + candidate feedback should have ratings.
