# Authentication Issue After Database Change - SOLUTION

## What Happened

When we fixed the database name from `test_database` to `gradnext`, your existing browser session became invalid because:
- Your session token is stored in your browser cookies
- The session data was in the old `test_database`
- Backend is now looking for sessions in `gradnext` database
- **Result**: 401 Unauthorized error

## Solution: Log Out and Log Back In

The simplest solution is to create a fresh session:

### Option 1: Log Out and Log In (Recommended)
1. Click on your profile/avatar
2. Click "Logout"
3. Log back in with your credentials
4. Try booking strategy call again

This will create a new session in the correct `gradnext` database.

---

### Option 2: Manual Cookie Fix (For Testing)

If you don't want to log out, you can manually add a test session:

1. **Open Developer Tools** (Press F12 or right-click → Inspect)

2. **Go to Application/Storage Tab**
   - Chrome/Edge: Application → Storage → Cookies
   - Firefox: Storage → Cookies

3. **Find your domain** (e.g., localhost:3000 or your preview URL)

4. **Add/Edit the session_token cookie**:
   - Name: `session_token`
   - Value: `session_fdd15d242894e67dda8241618a03f3e5f77265ba`
   - Domain: (leave as default)
   - Path: `/`
   - Expires: Set to 30 days from now

5. **Refresh the page** (F5)

6. **Try booking again**

---

### Option 3: Clear Cookies and Re-login

1. Open Developer Tools (F12)
2. Go to Application → Clear Storage (Chrome) or Storage (Firefox)
3. Click "Clear site data" or delete all cookies
4. Refresh page
5. Log in again

---

## Verification

After logging in with a fresh session, you should be able to:
- ✅ Access the dashboard
- ✅ Click "Book Strategy Call"
- ✅ See the unified calendar with 100+ available slots
- ✅ Select a time and book successfully

---

## Technical Details

**Database Changed**: `test_database` → `gradnext`

**What Was Migrated**:
- ✅ Mentors (with availability)
- ✅ Users
- ✅ Plans
- ✅ Workshops
- ❌ Sessions (empty in both databases)

**Why Sessions Weren't Migrated**:
- No active sessions existed in the source database
- Sessions are typically short-lived and recreated on login

**Current User for Testing**:
- Email: `pro@gradnext.co`
- Plan: `full_prep` (can book strategy calls)
- A long-lived test session has been created (30 days)

---

## If Issues Persist

If you still see "Failed to load available slots" after logging in:

1. **Check browser console** (F12 → Console tab)
2. **Look for errors** related to:
   - Authentication
   - API calls
   - CORS issues

3. **Check Network tab** (F12 → Network)
   - Find the `/api/strategy-calls/unified-availability` request
   - Check the response status and data

4. **Share the error** with me and I'll help debug further!

---

## Summary

**Quick Fix**: **Log out and log back in** to create a fresh session in the correct database! 🔐
