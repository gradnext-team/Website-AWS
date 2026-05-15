"""
POST-DEPLOYMENT FIX FOR PRODUCTION DATABASE

After you deploy, you need to run this API endpoint to fix production mentors:

API Endpoint: POST /api/admin/fix-mentor-ratings

This endpoint will:
1. Find all mentors with 0 sessions and 5.0 rating
2. Remove their ratings
3. Return count of fixed mentors

HOW TO RUN:
1. Deploy your application
2. Open browser console on app.gradnext.co
3. Run this command:

fetch('https://app.gradnext.co/api/admin/fix-mentor-ratings', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log)

OR use curl:
curl -X POST https://app.gradnext.co/api/admin/fix-mentor-ratings \
  -H "Cookie: your-session-cookie" \
  --cookie-jar cookies.txt

This will fix all mentors in production database.
"""
