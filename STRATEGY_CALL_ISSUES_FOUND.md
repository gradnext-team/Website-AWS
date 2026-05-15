# Strategy Call Issues Found 🔍

## Issue #1: Database Mismatch ❌

**Problem**: Your mentors are in the **wrong database**!

- **Mentors are stored in**: `test_database`
- **Backend is looking in**: `gradnext` database

**Impact**: The unified calendar API returns 0 available slots because it can't find any mentors.

### Solution:
The backend needs to use the correct database. Check the MONGO_URL environment variable.

---

## Issue #2: No Availability Configured ⚠️

**Problem**: Both mentors eligible for strategy calls have **EMPTY availability arrays**!

### Current Status:

#### 1. **Priya Sharma** (mentor-1)
- ✅ Can Take Strategy Calls: **True**
- ✅ Active: **True**
- ❌ Availability: **[] (Empty array)**

#### 2. **Rahul Mehta** (mentor-2)
- ✅ Can Take Strategy Calls: **True**
- ✅ Active: **True**
- ❌ Availability: **[] (Empty array)**

**Impact**: Even if the database connection is fixed, the unified calendar will show "No available slots" because neither mentor has configured their availability schedule.

### Expected Format:

Mentors need their `availability` field populated like this:

```javascript
{
  "id": "mentor-1",
  "name": "Priya Sharma",
  "can_take_strategy_calls": true,
  "is_active": true,
  "availability": [
    {
      "day": "Monday",
      "slots": [
        {"time": "09:00"},
        {"time": "10:00"},
        {"time": "14:00"},
        {"time": "15:30"}
      ]
    },
    {
      "day": "Wednesday",
      "slots": [
        {"time": "11:00"},
        {"time": "14:00"},
        {"time": "16:00"}
      ]
    },
    {
      "day": "Friday",
      "slots": [
        {"time": "10:00"},
        {"time": "15:00"}
      ]
    }
  ]
}
```

---

## How the Admin Panel Should Configure Availability

When configuring mentor availability through the admin panel, it should:

1. **Allow selecting days of the week** (Monday - Sunday)
2. **For each day, allow adding multiple time slots** (in HH:MM format, 30-min intervals)
3. **Store in the format shown above** (array of objects with `day` and `slots`)
4. **Save to the `availability` field** in the mentor document

---

## Testing the Fix

Once both issues are resolved:

1. **Database**: Mentors in correct database (`gradnext`)
2. **Availability**: Each mentor has at least one day with time slots configured

Then test the unified availability endpoint:

```bash
curl -X GET 'http://localhost:8001/api/strategy-calls/unified-availability' \
  --cookie 'session_token=YOUR_TOKEN' \
  -H 'Content-Type: application/json'
```

Expected response (if availability is configured for next week):
```json
{
  "slots": {
    "2025-02-03": {
      "09:00": {"available": true, "mentor_ids": ["mentor-1"]},
      "10:00": {"available": true, "mentor_ids": ["mentor-1", "mentor-2"]},
      "14:00": {"available": true, "mentor_ids": ["mentor-1"]}
    },
    "2025-02-05": {
      "11:00": {"available": true, "mentor_ids": ["mentor-2"]},
      "14:00": {"available": true, "mentor_ids": ["mentor-1", "mentor-2"]}
    }
  },
  "mentor_count": 2
}
```

---

## Summary

✅ **You have 2 mentors configured for strategy calls** (Priya Sharma, Rahul Mehta)  
❌ **Database mismatch**: Mentors in `test_database`, backend uses `gradnext`  
❌ **No availability configured**: Both mentors have empty availability arrays  

**To fix**: 
1. Move mentors to `gradnext` database OR update MONGO_URL
2. Configure availability schedules for both mentors via admin panel
