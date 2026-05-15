# Subscription Access Fix - Payment vs Manual Assignment

## 🎯 Problem Identified

### Issue Description:
When users upgraded from Free Trial to a paid plan (Basic/Pro/Pro+) via Razorpay payment, **all pages showed as LOCKED** even though they successfully paid.

However, when an admin manually changed a user's plan in the admin panel, **all pages unlocked correctly** with proper access levels.

---

## 🔍 Root Cause Analysis

### Backend Access Check Priority:

The backend checks for plan access in this specific order:

1. **FIRST**: Checks `user.plan_assignments[]` array for active assignments
2. **SECOND**: Falls back to `user.plan` field if no active assignment found

### What Was Happening:

#### ❌ **Razorpay Webhook (Payment Flow)**:
```javascript
// Only updated the plan field
user.plan = "pro_plan"
user.plan_name = "Pro Plan"
user.subscription = {...}

// But did NOT create plan_assignments entry
user.plan_assignments = []  // Empty!
```

**Result**: Backend checks `plan_assignments` → finds nothing → **denies access** ❌

#### ✅ **Admin Panel (Manual Assignment)**:
```javascript
// Creates a plan_assignment entry
user.plan_assignments = [{
  id: "assign-xxxxx",
  plan_key: "basic_plan",
  is_active: true,
  start_date: "...",
  end_date: "...",
  ...
}]
```

**Result**: Backend checks `plan_assignments` → finds active assignment → **grants access** ✅

---

## ✅ Solution Implemented

### Updated Webhook Handler:

**File**: `/app/backend/routes/subscriptions.py`

**What Changed**:

When Razorpay webhook processes a successful subscription payment, it now:

1. **Creates a plan_assignment entry** (just like admin panel does)
2. **Deactivates old plan assignments** (prevents conflicts)
3. **Updates user.plan field** (backwards compatibility)
4. **Sets is_active: true** (enables access)

### Code Changes:

```python
# Create plan assignment for proper access control
plan_assignment = {
    "id": f"assign-{uuid.uuid4().hex[:8]}",
    "user_id": user_id,
    "plan_key": plan_key,
    "plan_name": plan.get("name"),
    "category": "subscription",
    "start_date": now.isoformat(),
    "end_date": period_end.isoformat(),
    "is_trial": False,
    "is_active": True,  # ← KEY: This grants access!
    "assigned_by": "system_webhook",
    "billing_cycle": billing_cycle
}

# Deactivate existing assignments
await db.users.update_one(
    {"id": user_id},
    {"$set": {"plan_assignments.$[].is_active": False}}
)

# Add new active assignment
await db.users.update_one(
    {"id": user_id},
    {
        "$push": {"plan_assignments": plan_assignment},
        "$set": {
            "plan": plan_key,
            "subscription": subscription_data,
            ...
        }
    }
)
```

---

## 📊 Flow Comparison

### Before Fix:

```
User Pays for Pro Plan
  ↓
Webhook receives payment
  ↓
Updates: user.plan = "pro_plan"
  ↓
Backend checks: plan_assignments = []
  ↓
❌ No active assignment found
  ↓
❌ ACCESS DENIED - All pages locked
```

### After Fix:

```
User Pays for Pro Plan
  ↓
Webhook receives payment
  ↓
Creates: plan_assignment with is_active=true
Updates: user.plan = "pro_plan"
  ↓
Backend checks: plan_assignments = [{is_active: true, ...}]
  ↓
✅ Active assignment found
  ↓
✅ ACCESS GRANTED - Pages unlock correctly!
```

---

## ✅ Testing Checklist

After deploying this fix, test the following:

### Test 1: New User Payment Flow
- [ ] Create new account (free trial)
- [ ] Upgrade to Basic Plan via payment
- [ ] Complete payment successfully
- [ ] Check Dashboard → All pages should unlock
- [ ] Check Peer Practice → Should show "4 of 4 credits"
- [ ] Check Case Drills → Should be accessible

### Test 2: Plan Upgrade Flow
- [ ] User on Basic Plan
- [ ] Upgrade to Pro Plan via payment
- [ ] Complete payment
- [ ] Verify Pro Plan features unlock

### Test 3: Admin Manual Assignment (Should Still Work)
- [ ] Admin changes user plan manually
- [ ] User sees updated access
- [ ] Old behavior preserved

---

## 🔧 Deployment Instructions

1. **Deploy this code to production**
2. **Test with a new payment** (use test mode if available)
3. **Verify pages unlock after payment**
4. **Monitor webhook logs** for any errors

---

## 📝 Technical Notes

### Why plan_assignments?

The `plan_assignments` system was designed to:
- Allow multiple plan types (subscriptions, trials, coaching programs)
- Track assignment history
- Enable admin overrides
- Support expiration dates
- Handle upgrades/downgrades

The webhook was missing this integration, causing the access denial.

### Backwards Compatibility:

The fix maintains backwards compatibility:
- Still updates `user.plan` field
- Existing users with only `plan` field still work
- New payments get both `plan` field AND `plan_assignment`

---

## ✅ Success Criteria

After deployment, users who pay for a plan should:
- ✅ Immediately see unlocked pages
- ✅ Have correct access levels (Basic = 4 peer sessions, Pro = 4 sessions + live workshops, etc.)
- ✅ Not see "Access Restricted" messages
- ✅ Experience should match admin-assigned plans

---

## 🆘 Troubleshooting

If issues persist after deployment:

1. **Check webhook logs**: Verify `plan_assignment` is being created
2. **Check user document**: Look for `plan_assignments` array with `is_active: true`
3. **Clear browser cache**: Sometimes old access data is cached
4. **Test with brand new account**: Ensures clean state

---

## Summary

This was a critical bug where the webhook payment flow and admin assignment flow were inconsistent. The fix aligns both flows to use the same `plan_assignments` system, ensuring users get proper access immediately after payment.
