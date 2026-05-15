## COMPLETE FIX FOR MENTOR RATINGS

### What's Been Fixed

**1. Backend Code:**
- ✅ `models.py` - Removed default `rating: 5.0` from MentorBase
- ✅ `models.py` - Removed default `average_rating: 5.0` from MentorStats
- ✅ All API endpoints check sessions_conducted before showing rating
- ✅ Added comprehensive database cleanup endpoint

**2. Frontend:**
- ✅ Shows "NA" for mentors without ratings
- ✅ Properly handles null/undefined ratings

**3. Database Cleanup Endpoint:**
- ✅ `/api/admin/fix-mentor-ratings` - Comprehensive cleanup

### After Deployment: Run This Fix

**Open browser console on app.gradnext.co and run:**

```javascript
fetch('https://app.gradnext.co/api/admin/fix-mentor-ratings', {
  method: 'POST',
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ Database Fix Results:');
  console.log(`Total fixed: ${data.total_fixed} mentors`);
  console.log(`- Removed ratings from ${data.step1_zero_sessions} mentors with 0 sessions`);
  console.log(`- Removed ratings from ${data.step2_no_feedback} mentors without feedback`);
  console.log(`Remaining bad records: ${data.remaining_bad_records}`);
  
  if (data.remaining_bad_records === 0) {
    alert('✅ All mentor ratings fixed! Refresh the page.');
  } else {
    alert(`⚠️ ${data.remaining_bad_records} records still need fixing`);
  }
});
```

### What This Does

**Step 1:** Removes ratings from mentors with 0 sessions
**Step 2:** Removes ratings from mentors without actual candidate feedback
**Step 3:** Verifies no bad records remain

### Expected Result

After running the fix:
- ✅ Mentors with 0 sessions: Show "NA" (no rating)
- ✅ Mentors with sessions but no feedback: Show "NA"
- ✅ Mentors with feedback: Show actual rating (e.g., 4.5)

### Verify the Fix

**Check a specific mentor:**
```javascript
fetch('https://app.gradnext.co/api/admin/mentors', {
  credentials: 'include'
})
.then(r => r.json())
.then(mentors => {
  // Find mentor with 0 sessions
  const mentor = mentors.find(m => m.sessions_conducted === 0);
  console.log('Mentor:', mentor.name);
  console.log('Sessions:', mentor.sessions_conducted);
  console.log('Rating:', mentor.rating || 'None (✓ Correct)');
});
```

### If Still Seeing 5.0

1. **Clear browser cache** (Ctrl+Shift+R)
2. **Check deployment** - Make sure latest code is deployed
3. **Run the fix endpoint again** - It's safe to run multiple times
4. **Hard refresh** the admin/coaching pages
