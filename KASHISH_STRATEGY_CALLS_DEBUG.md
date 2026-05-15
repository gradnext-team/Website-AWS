# Strategy Calls Debug - Kashish Malhotra Issue

## What Was Fixed

### 1. Auth Function Replacement ✅
**Problem:** `strategy_calls.py` had its own local `get_current_user()` function that only looked in the database.
**Fix:** Now imports `get_current_user` from `routes.auth` which handles OAuth users properly.

### 2. Enhanced Logging ✅  
Added detailed logging to see exactly what's happening:
- User authentication status
- Plan lookup results
- Base calculation from plan
- Additional credits from user/assignments
- Final calculation breakdown

## How to Test

### Step 1: Refresh Dashboard
1. Have Kashish **refresh the browser** (F5 or Ctrl+Refresh)
2. The Strategy Call card should update

### Step 2: Check Backend Logs
After refreshing, check logs to see the calculation:

```bash
tail -n 200 /var/log/supervisor/backend.out.log | grep -A 25 "STRATEGY CREDITS REQUEST"
```

### Step 3: What to Look For in Logs

**If Working Correctly:**
```
STRATEGY CREDITS REQUEST
✅ User authenticated: kashish@gradnext.co (id: user_ec49477b2b5b)
   Name: Kashish Malhotra
   Plan: full_prep
   Step 1: Checking plan features for plan_key='full_prep'
   ✅ Plan found: 'Full Prep' - strategy_calls=3
   Base from plan features: 3
   Step 2: Additional from user direct field: 0
   Step 3: No plan_assignments found

📊 FINAL CALCULATION:
   base_from_plan = 3
   additional_from_user = 0
   additional_from_assignments = 0
   TOTAL = 3
   USED = 0
   REMAINING = 3
```

**If Still Failing - Possible Issues:**

#### Issue A: User Not Authenticated
```
❌ User not authenticated - get_current_user returned None
```
**Fix:** User needs to log out and log back in via Google OAuth

#### Issue B: Plan Not Found
```
⚠️ Plan with plan_key='full_prep' NOT FOUND in database!
```
**Fix:** Run migration again to create plans

#### Issue C: User Has No Plan
```
⚠️ User has NO PLAN assigned!
```
**Fix:** Admin needs to assign Full Prep plan to user via Admin Panel

## Manual Database Check

To verify Kashish's data directly:

```bash
cd /app/backend && python3 << 'EOF'
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['gradnext']
    
    # Find user by email
    user = await db.users.find_one({"email": "kashish@gradnext.co"})
    
    if user:
        print(f"✅ User found:")
        print(f"   Email: {user.get('email')}")
        print(f"   Plan: {user.get('plan')}")
        print(f"   strategy_calls_total: {user.get('strategy_calls_total', 'NOT SET')}")
        print(f"   strategy_calls_used: {user.get('strategy_calls_used', 'NOT SET')}")
        
        # Check plan
        if user.get('plan'):
            plan = await db.plans.find_one({"plan_key": user.get('plan')})
            if plan:
                sc = plan.get('features', {}).get('strategy_calls', 0)
                print(f"   Plan has {sc} strategy calls")
                print(f"   Should show: {sc} remaining")
            else:
                print(f"   ❌ Plan not found!")
        else:
            print(f"   ❌ No plan assigned!")
    else:
        print(f"❌ User kashish@gradnext.co NOT found in database")
        print(f"   This means OAuth user was never persisted to MongoDB")
        print(f"   Admin should manually create user or user should complete payment")
    
    client.close()

asyncio.run(check())
EOF
```

## Expected Result

After refresh, Kashish should see:
- **Strategy Call card** showing **"3 sessions left"** in the yellow badge
- Book Now button should be clickable
- Modal should show list of eligible mentors

## If Still 0 After All Fixes

**Last Resort - Manual Fix:**

```bash
cd /app/backend && python3 << 'EOF'
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient

async def force_fix():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['gradnext']
    
    # Force update Kashish's user
    result = await db.users.update_one(
        {"email": "kashish@gradnext.co"},
        {
            "$set": {
                "plan": "full_prep",
                "strategy_calls_total": 0,  # Let plan features provide the base
                "strategy_calls_used": 0
            }
        }
    )
    
    if result.matched_count > 0:
        print("✅ User updated successfully")
    else:
        print("❌ User not found - cannot update")
    
    client.close()

asyncio.run(force_fix())
EOF
```

Then refresh dashboard again.

---

**Status:** Backend restarted with fixes
**Next:** Kashish should refresh browser and check dashboard
