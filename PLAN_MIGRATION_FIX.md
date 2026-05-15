# Plan Migration Fix - Deployment Issue Resolution

## Problem
Deleted plans were reappearing after each deployment because the startup migration was using `upsert=True`, which recreated plans that were intentionally deleted by admins.

## Root Cause
Located in `/app/backend/migrations/startup_migrations.py`:
- The `migrate_plan_configurations()` function used `upsert=True` with `$set` operations
- This caused deleted plans to be recreated on every deployment
- Manual changes from admin panel were being overwritten by migration defaults

## Solution Implemented

### 1. Updated Plan Configuration
- Categorized plans correctly:
  - **Subscription**: free_trial, basic_plan, pro_plan, pro_plus
  - **Coaching**: last_mile, mid_mile, full_prep, pinnacle
  - **Cohort**: cohort_premium, cohort_elite
  - **Addon**: addon_peer_session
- Removed `single_session` plan (no longer needed)
- Set `free_trial` to be hidden by default (`is_visible: False`)

### 2. Modified Migration Logic

#### Before (Problematic):
```python
result = await db.plans.update_one(
    {"plan_key": plan_key},
    {
        "$set": {...},  # Overwrites existing data
        "$setOnInsert": {...}
    },
    upsert=True  # Recreates deleted plans
)
```

#### After (Fixed):
```python
# Check if plan exists
existing_plan = await db.plans.find_one({"plan_key": plan_key})

if existing_plan:
    # Skip - preserves manual changes
    continue

# Only create if doesn't exist
await db.plans.insert_one(new_plan)
```

### 3. Key Behaviors Now

✅ **Creates plans on first deployment only**
- Default plans are created when the app is first deployed
- Each plan includes default features, pricing, and category

✅ **Never recreates deleted plans**
- If you delete a plan from admin panel, it stays deleted
- Migration checks for both active and inactive plans

✅ **Preserves manual changes**
- Any changes made from admin panel persist across deployments
- Pricing modifications are preserved
- Feature updates are preserved
- Visibility settings are preserved

### 4. Migration Functions Updated

1. **`migrate_plan_configurations()`**
   - Only inserts plans that don't exist
   - Skips soft-deleted plans (is_active=False)
   - Never updates existing plans

2. **`sync_plan_pricing()`**
   - Sets default pricing only for plans without pricing
   - Preserves manual pricing changes

3. **`sync_plan_additional_features()`**
   - Sets default features only if not configured
   - Preserves manual feature changes

## Default Plans Created

### Subscription Plans
1. **Free Trial** (hidden by default)
   - 1 peer session/month
   - No coaching sessions
   - No strategy calls

2. **Basic Plan**
   - 4 peer sessions/month
   - No coaching sessions
   - No strategy calls

3. **Pro Plan**
   - 4 peer sessions/month
   - No coaching sessions
   - 1 strategy call

4. **Pro+**
   - Unlimited peer sessions
   - No coaching sessions
   - 2 strategy calls

### Coaching Plans
5. **Last Mile**
   - 4 peer sessions/month
   - 5 coaching sessions
   - 1 strategy call
   - One-time: ₹16,999

6. **Mid Mile**
   - 4 peer sessions/month
   - 10 coaching sessions
   - 2 strategy calls
   - One-time: ₹31,999

7. **Full Prep**
   - Unlimited peer sessions
   - 15 coaching sessions
   - 3 strategy calls
   - One-time: ₹49,999

8. **Pinnacle**
   - Unlimited peer sessions
   - Unlimited coaching sessions
   - 4 strategy calls
   - One-time: ₹119,999

### Cohort Plans
9. **Cohort Premium**
   - 8 peer sessions/month
   - 1 coaching session
   - 1 strategy call

10. **Cohort Elite**
    - 8 peer sessions/month
    - 3 coaching sessions
    - 2 strategy calls

### Addon Plans
11. **Peer-to-Peer Sessions**
    - Unlimited peer sessions
    - No coaching sessions
    - No strategy calls

## Duplicate Plans Issue

During implementation, we discovered **duplicate plans** in the database:
- 11 old plans without `category` field
- 11 new plans with proper `category` field (subscription/coaching/cohort/addon)

**Solution:** Removed all plans without category field, keeping only the properly categorized ones.

**If you see duplicates in future:**
Run the cleanup script:
```bash
cd /app/backend
python3 scripts/remove_duplicate_plans.py
```

## Testing

To verify the fix works:

1. **Delete a plan** from admin panel
2. **Restart the backend**: `sudo supervisorctl restart backend`
3. **Check the plan is still deleted** (not recreated)
4. **Modify a plan's features** from admin panel
5. **Restart the backend** again
6. **Verify your changes persist** (not overwritten)

## Migration Logs

Check logs to confirm migration behavior:
```bash
tail -f /var/log/supervisor/backend.err.log | grep -i "plan"
```

Expected output after fix:
```
INFO - Checking for missing default plans...
INFO - All default plans already exist - no changes made
INFO - Checking plan pricing configurations...
INFO - All plans already have pricing configured - no changes made
```

## Deployment Notes

- This fix is **backward compatible**
- Existing plans in production will **not be affected**
- Only missing default plans will be created
- Manual configurations will **persist** across all future deployments

---

**Fixed on**: February 3, 2026
**Files Modified**: `/app/backend/migrations/startup_migrations.py`
