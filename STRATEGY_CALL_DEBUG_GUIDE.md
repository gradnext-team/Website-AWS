# Strategy Call "No Available Slots" Issue - Debugging Guide

## Current Status

✅ **Backend is configured correctly**:
- 2 mentors with strategy call capability (Priya Sharma, Rahul Mehta)
- Both have full week availability (55 total slots configured)
- Mentors are in correct `gradnext` database
- API simulation shows 100+ slots available across 10 dates

❌ **Frontend shows**: "No available slots in the next 14 days"

## What I've Added

### Enhanced Logging

I've added detailed logging to the `/api/strategy-calls/unified-availability` endpoint to help debug the issue.

When the API is called, it now logs:
1. User making the request (email, ID, plan)
2. Number of mentors found
3. Each mentor's availability configuration
4. Current IST time
5. Total slots found in aggregation
6. Warning if no slots are found

## How to Debug

### Step 1: Try Booking Again
1. Refresh your page
2. Click "Book Strategy Call" button
3. Wait for the modal to load

### Step 2: Check Backend Logs

Run this command immediately after trying to book:

```bash
tail -30 /var/log/supervisor/backend.out.log | grep -A 20 "UNIFIED AVAILABILITY"
```

### What to Look For in Logs

#### **Scenario A: Mentor Count is 0**
```
Mentors found: 0
```
**Problem**: Database query not finding mentors  
**Cause**: Possible database connection issue or mentors got removed

#### **Scenario B: Mentors Found but No Availability**
```
Mentors found: 2
  - Priya Sharma: 0 days configured
  - Rahul Mehta: 0 days configured
```
**Problem**: Availability arrays are empty  
**Cause**: Data was cleared or not saved properly

#### **Scenario C: Mentors Found with Availability but 0 Slots**
```
Mentors found: 2
  - Priya Sharma: 5 days, 29 total slots configured
  - Rahul Mehta: 5 days, 26 total slots configured
...
Aggregation complete: 0 dates with 0 total slots
⚠️  NO SLOTS FOUND - All slots might be in the past
```
**Problem**: Slots exist but filtering them out  
**Cause**: Timezone issue or all slots are in the past

#### **Scenario D: Everything Looks Good**
```
Mentors found: 2
  - Priya Sharma: 5 days, 29 total slots configured
  - Rahul Mehta: 5 days, 26 total slots configured
...
Aggregation complete: 10 dates with 100 total slots
```
**Problem**: API returns data correctly but frontend doesn't display it  
**Cause**: Frontend parsing issue or authentication problem

## Common Issues and Solutions

### Issue 1: User Not Authenticated
**Symptom**: API returns 401 Unauthorized  
**Solution**: 
- Check if user is logged in
- Verify session token is valid
- Try logging out and logging back in

### Issue 2: Preview Environment Database
**Symptom**: Works in development but not in preview  
**Solution**:
- Preview environment might use a different database
- Data needs to be seeded in preview database as well
- Check MONGO_URL environment variable in preview

### Issue 3: Timezone Issues
**Symptom**: Mentors found but 0 slots  
**Solution**:
- System time might be far in the future
- Check: `date` command output
- Availability should start from Monday (Feb 2, 2026)

### Issue 4: Frontend Not Parsing Response
**Symptom**: API returns slots but frontend shows empty  
**Check**: Browser console for JavaScript errors

## Quick Verification Commands

### Check if mentors still exist:
```bash
cd /app/backend && python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['gradnext']
    count = await db.mentors.count_documents({
        "can_take_strategy_calls": True,
        "is_active": True,
        "availability": {"$exists": True, "$ne": []}
    })
    print(f"Strategy-ready mentors: {count}")
    client.close()

asyncio.run(check())
EOF
```

Expected output: `Strategy-ready mentors: 2`

### Check current system time:
```bash
date
```

Expected: Around January 31, 2026

### Test API directly (with auth):
```bash
# Get your session token from browser cookies
# Then test:
curl -X GET 'http://localhost:8001/api/strategy-calls/unified-availability' \
  -H 'Cookie: session_token=YOUR_TOKEN' | jq
```

Expected: JSON with "slots" object containing dates

## Next Steps

**Please try booking again** and then send me:

1. **Screenshot of the error** (if still showing)
2. **Backend logs** using the command above
3. **Browser console logs** (F12 → Console tab)

With these logs, I can pinpoint exactly what's happening and fix it!

## Possible Preview Environment Issue

If this is a **preview-specific issue**, it might be because:

1. **Preview uses separate database**: The preview environment might be using a different MongoDB instance that doesn't have the migrated data
2. **Environment variables**: MONGO_URL might point to a different database in preview
3. **Data isolation**: Preview and development environments are separate

**Solution**: We may need to run the migration script specifically in the preview environment's database.
