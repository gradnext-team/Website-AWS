# Google Calendar Integration Setup Guide

This guide walks you through setting up Google Calendar OAuth for mentor calendar sync in gradnext.

---

## Overview

The Google Calendar integration allows mentors to connect their personal calendars. When connected:
- The system checks **ALL calendars** the mentor has access to
- Busy time slots are automatically hidden from candidates
- No buffer time is added (exact conflict detection)
- Calendar events remain private - we only check availability, not event details

---

## Step-by-Step Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `gradnext Calendar` (or similar)
4. Click **Create**
5. Wait for project creation, then select it

### Step 2: Enable Google Calendar API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on **Google Calendar API**
4. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have Google Workspace, then choose Internal)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: gradnext
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **Save and Continue**

6. **Scopes page**: Click **Add or Remove Scopes**
   - Search and add:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events.readonly`
   - Click **Update** → **Save and Continue**

7. **Test users page** (for External apps):
   - Click **Add Users**
   - Add email addresses of mentors who will test
   - Click **Save and Continue**

8. Review and click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Enter name: `gradnext Web Client`
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-domain.com/api/mentor-calendar/auth/callback
   ```
   Replace `your-domain.com` with your actual domain (e.g., `cohort-admin.preview.emergentagent.com`)

6. Click **Create**
7. **Copy the Client ID and Client Secret** - you'll need these!

### Step 5: Configure Environment Variables

Add these to your `backend/.env` file:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
```

### Step 6: Restart Backend

After updating the .env file:
```bash
sudo supervisorctl restart backend
```

---

## How It Works (Automatic Sync)

### Real-Time Conflict Detection
- When a candidate views a mentor's availability, the system automatically queries the mentor's Google Calendar
- Busy slots are filtered out from the available time slots
- No manual action required from mentors

### Sync Refresh
- Calendar is checked in real-time when availability is requested
- Mentors can click **"Sync Now"** button to manually trigger a refresh
- The system shows when the last sync occurred
- If sync is older than 15 minutes, it shows as "stale" with an amber warning

### Token Refresh
- OAuth tokens are automatically refreshed when they expire
- If refresh fails, the calendar is marked as disconnected
- Mentor will need to reconnect via the "Connect Google Calendar" button

---

## Admin Tasks

As an admin, you **do NOT need to do anything** for ongoing operation. The system handles:
- ✅ Token refresh automatically
- ✅ Real-time calendar checks
- ✅ Error handling and reconnection prompts

Your only tasks are:
1. **Initial Setup**: Configure Google Cloud OAuth (one-time)
2. **Publishing**: If you want anyone (not just test users) to connect, you'll need to publish your OAuth app and go through Google's verification

---

## Mentor Experience

1. Mentor goes to **Mentor Dashboard** → **Availability** tab
2. Clicks **"Connect Google Calendar"**
3. Redirected to Google to authorize
4. After authorization, redirected back to dashboard
5. Calendar shows as "Connected" with synced email
6. Availability automatically excludes busy times

---

## Troubleshooting

### "Google OAuth not configured"
- Ensure `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are set in `backend/.env`
- Restart the backend after adding

### "redirect_uri_mismatch"
- The redirect URI in Google Cloud Console must exactly match:
  `https://your-domain.com/api/mentor-calendar/auth/callback`
- Check for trailing slashes or protocol mismatches

### "access_denied" or "This app isn't verified"
- For testing: Add test users in OAuth consent screen
- For production: Submit app for Google verification

### Calendar shows "disconnected" unexpectedly
- Token may have expired and refresh failed
- Ask mentor to reconnect by clicking "Connect Google Calendar"

---

## Security Notes

- We only request **read-only** access to calendars
- We **never** see event titles, descriptions, or attendees
- We only check if a time slot is "busy" or "free"
- Credentials are stored encrypted in the database
- Mentors can disconnect at any time

---

## Production Checklist

Before going live:
- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Redirect URI matches your production domain
- [ ] Environment variables set
- [ ] (Optional) OAuth app verified for public use
