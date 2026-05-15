# IMMEDIATE FIX - JUST DEPLOY

## Current Status

✅ **DEV environment:** Working correctly - mentors with 0 sessions show "NA"
❌ **PRODUCTION (app.gradnext.co):** Still showing 5.0 ratings

## Why Production Still Shows 5.0

Your production database still has the old 5.0 values because:
1. The cleanup code hasn't been deployed yet
2. OR it was deployed but the database wasn't cleaned

## THE FIX (Automatic)

I've added automatic cleanup that runs on EVERY backend startup.

### What Happens Now

When you deploy:
1. Backend starts up
2. **AUTOMATICALLY cleans all mentor ratings with 0 sessions**
3. Problem fixed - no manual steps needed

### Code Added (server.py)

```python
# CRITICAL: Clean up mentor ratings on EVERY startup
# Remove 5.0 ratings from mentors with 0 sessions
result = await db.mentors.update_many(
    {"sessions_conducted": 0, "rating": {"$exists": True}},
    {"$unset": {"rating": ""}}
)
```

## What You Need To Do

**JUST DEPLOY**

That's it. The cleanup runs automatically on startup.

## Expected Result

**Before Deploy:**
- Vishwajeet Karmwar: ⭐ 5.0, 👥 0 sessions ❌

**After Deploy (Automatic):**
- Vishwajeet Karmwar: ⭐ N/A, 👥 0 sessions ✅

## Verification

After deployment, check any mentor with 0 sessions:
- Should show "N/A" or no rating
- NOT 5.0

## Files Modified

- `/app/backend/server.py` - Added automatic cleanup on startup
- `/app/backend/models.py` - Removed default 5.0
- `/app/backend/routes/strategy_calls.py` - Fixed rating checks

**DEPLOY NOW - IT WILL FIX AUTOMATICALLY**
