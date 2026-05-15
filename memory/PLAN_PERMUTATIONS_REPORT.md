# gradnext Plan Permutations & Access Control Report

## Executive Summary

This document provides a comprehensive analysis of all plan upgrade/purchase permutations on the gradnext platform, detailing how each scenario affects user access and subscription timing.

---

## Table of Contents

1. [Plan Categories & Structure](#1-plan-categories--structure)
2. [Purchase Methods](#2-purchase-methods)
3. [Free Trial Upgrade Scenarios](#3-free-trial-upgrade-scenarios)
4. [Subscription to Coaching Upgrades](#4-subscription-to-coaching-upgrades)
5. [Single Session Purchases](#5-single-session-purchases)
6. [Plan Expiry Behavior](#6-plan-expiry-behavior)
7. [Admin vs User Purchase Differences](#7-admin-vs-user-purchase-differences)
8. [Access Control Matrix](#8-access-control-matrix)

---

## 1. Plan Categories & Structure

### 1.1 Subscription Plans (Auto-Renew Capable)

| Plan Key | Name | Duration | Price (1mo) | Price (6mo) | Peer Sessions | Coaching |
|----------|------|----------|-------------|-------------|---------------|----------|
| `free_trial` | Free Trial | 7 days | Free | - | 1/month | 0 |
| `basic_plan` | Basic Plan | 1 month | ₹499 | ₹399/mo | 4/month | 0 |
| `pro_plan` | Pro Plan | 1 month | ₹699 | ₹599/mo | 4/month | 0 |
| `pro_plus` | Pro+ | 1 month | ₹1,299 | ₹999/mo | Unlimited | 0 |

### 1.2 Coaching Programs (Fixed Duration)

| Plan Key | Name | Duration | One-Time Price | Peer Sessions | Coaching Sessions |
|----------|------|----------|----------------|---------------|-------------------|
| `last_mile` | Last Mile | 2 months | ₹10 (test) | 4/month | 5 total |
| `mid_mile` | Mid Mile | 3 months | ₹31,999 | 4/month | 10 total |
| `full_prep` | Full Prep | 6 months | ₹44,999 | Unlimited | 15 total |
| `pinnacle` | Pinnacle | 6 months | Application Only | Unlimited | Unlimited |

### 1.3 Cohort Programs (Fixed Duration, Batch-Based)

| Plan Key | Name | Duration | Price | Peer Sessions | Coaching |
|----------|------|----------|-------|---------------|----------|
| `cohort_premium` | Cohort Premium | 2 months | ₹12,999 | 8/month | 1 |
| `cohort_elite` | Cohort Elite | 2 months | ₹19,999 | 8/month | 3 |

### 1.4 Add-Ons (Supplementary Purchases)

| Plan Key | Name | Duration | Price | Description |
|----------|------|----------|-------|-------------|
| `addon_peer_session` | Peer Sessions | 1 month | ₹199/mo | Unlimited peer practice |
| `addon_strategy_call` | Strategy Call | One-time | ₹1,199 | Single strategy session |
| `addon_live_workshop` | Live Workshop | One-time | ₹199 | Workshop access |

---

## 2. Purchase Methods

### 2.1 User Self-Purchase (via Razorpay)

**Code Path:** `/api/payments/create-order` → `/api/payments/verify`

**Flow:**
1. User selects plan on frontend
2. Frontend calls `POST /api/payments/create-order` with `plan_key`
3. Backend creates Razorpay order with plan amount + 18% GST
4. User completes Razorpay payment
5. Frontend calls `POST /api/payments/verify` with payment details
6. Backend verifies signature and updates user record

**Fields Updated:**
```python
user_update = {
    "plan": plan_key,
    "plan_name": plan.name,
    "plan_category": plan.category,
    "subscription_date": now,
    "plan_start_date": now,
    "subscription_end": calculated_end_date,
    "plan_end_date": calculated_end_date,
    "coaching_sessions_total": features.coaching_sessions,
    "coaching_sessions_used": 0,
    "strategy_calls_total": features.strategy_calls,
    "strategy_calls_used": 0,
    "plan_features": features,
    "last_payment_id": razorpay_payment_id
}
```

### 2.2 Admin Manual Upgrade

**Code Path:** `PUT /api/admin/users/{user_id}`

**Flow:**
1. Admin selects user in Admin Panel
2. Admin changes plan dropdown
3. Frontend calls `PUT /api/admin/users/{user_id}` with new plan
4. Backend syncs features from plan configuration
5. User record updated immediately

**Key Differences from User Purchase:**
- No payment verification
- No Razorpay record created
- Plan features synced from `plans` collection
- `plan_end_date` calculated based on plan duration

---

## 3. Free Trial Upgrade Scenarios

### 3.1 Free Trial → Subscription Plan (User Purchase)

**Scenario:** User on free trial purchases Basic/Pro/Pro+

| Aspect | Before | After |
|--------|--------|-------|
| Plan | `free_trial` | `basic_plan` / `pro_plan` / `pro_plus` |
| Plan End Date | Created + 7 days | Now + 30 days (1 month subscription) |
| Content Access | Free items only | All courses, drills, workshops |
| Peer Sessions | 1/month | 4/month (Basic/Pro) or Unlimited (Pro+) |
| Coaching | None | None (subscription-only) |
| Days Left Display | Shows countdown | **HIDDEN** (to reduce churn) |

**Time Calculation:**
```python
# From payments.py line 227-232
if duration_months:
    subscription_end = now + relativedelta(months=duration_months)
elif duration_days:
    subscription_end = now + relativedelta(days=duration_days)
```

### 3.2 Free Trial → Coaching Program (User Purchase)

**Scenario:** User on free trial purchases Last Mile/Mid Mile/Full Prep

| Aspect | Before | After |
|--------|--------|-------|
| Plan | `free_trial` | `last_mile` / `mid_mile` / `full_prep` |
| Plan End Date | Created + 7 days | Now + 2/3/6 months (program duration) |
| Content Access | Free items only | All courses, drills, workshops |
| Peer Sessions | 1/month | 4/month or Unlimited (Full Prep) |
| Coaching Sessions | 0 | 5/10/15/Unlimited (based on plan) |
| Days Left Display | Shows countdown | **SHOWS** countdown |

### 3.3 Free Trial → Subscription (Admin Upgrade)

**Scenario:** Admin manually upgrades user from free trial to a subscription

| Aspect | Before | After |
|--------|--------|-------|
| Plan | `free_trial` | `basic_plan` / `pro_plan` / `pro_plus` |
| Plan End Date | Created + 7 days | Now + (duration_months × 30) days |
| Payment Record | None | **None** (no payment created) |
| Features Synced | Limited | Full plan features |

**Code Logic (admin.py lines 649-679):**
```python
if "plan" in update_data:
    plan_doc = await db.plans.find_one({"plan_key": new_plan_key})
    if plan_doc:
        # Sync features
        update_data["features"] = plan_features
        # Reset plan dates if plan is actually changing
        if update_data["plan"] != current_user.get("plan"):
            update_data["plan_start_date"] = datetime.utcnow().isoformat()
            if update_data["plan"] == "free_trial":
                update_data["plan_end_date"] = (datetime.utcnow() + timedelta(days=7)).isoformat()
            elif plan_doc.get("category") == "subscription":
                duration_days = plan_doc.get("duration_days") or 30
                if plan_doc.get("duration_months"):
                    duration_days = plan_doc.get("duration_months") * 30
                update_data["plan_end_date"] = (datetime.utcnow() + timedelta(days=duration_days)).isoformat()
```

### 3.4 Free Trial → Coaching (Admin Upgrade)

**Identical to 3.3** but uses coaching plan's `duration_months` for end date calculation.

---

## 4. Subscription to Coaching Upgrades

### 4.1 Subscription → Coaching (User Purchase)

**Scenario:** User with active Basic/Pro subscription purchases a coaching program

**Current Behavior (Based on Code Analysis):**
- The new coaching plan **REPLACES** the subscription plan
- The user's `plan` field is overwritten with the coaching plan key
- The subscription end date is **OVERWRITTEN** with the coaching program end date

| Aspect | Before (Pro Plan) | After (Full Prep) |
|--------|-------------------|-------------------|
| Plan | `pro_plan` | `full_prep` |
| Plan End Date | Subscription end | Now + 6 months |
| Content Access | Full | Full |
| Peer Sessions | 4/month | Unlimited |
| Coaching Sessions | 0 | 15 |

**IMPORTANT NOTE:** The current implementation does NOT run subscriptions and coaching programs in parallel. The user requested Option C (parallel tracking) but this is NOT yet implemented.

### 4.2 Subscription → Coaching (Admin Upgrade)

**Same behavior as 4.1** - the plan is replaced, not added.

---

## 5. Single Session Purchases

### 5.1 Single Coaching Session (Any User)

**Code Path:** `/api/payments/create-session-order` → `/api/payments/verify-session`

**Scenario:** Any user (free trial, subscription, or coaching) purchases a single coaching session

**What Happens:**
1. User selects mentor and initiates purchase
2. Payment is mentor-specific (uses `mentor.price_per_session`, default ₹1,500)
3. On successful payment, `coaching_sessions_remaining` is incremented by 1
4. **DOES NOT** change the user's plan or plan_end_date

| Aspect | Before | After |
|--------|--------|-------|
| Plan | Unchanged | Unchanged |
| Plan End Date | Unchanged | Unchanged |
| `coaching_sessions_remaining` | N | N + 1 |
| Can Book Coaching | Depends on plan | **YES** (has credits) |

**Code (payments.py lines 629-640):**
```python
# Add 1 coaching session to user
current_sessions = user_dict.get("coaching_sessions_remaining", 0) or 0
new_sessions = current_sessions + 1

user_update_result = await db.users.update_one(
    {"id": user_id},
    {"$set": {
        "coaching_sessions_remaining": new_sessions,
        "updated_at": now.isoformat()
    }}
)
```

### 5.2 Session Top-Up (Bulk Purchase)

**Code Path:** `/api/payments/topup/create-order` → `/api/payments/topup/verify`

**Scenario:** User purchases multiple sessions at once (1-30 sessions)

**Discount Tiers:**
| Sessions | Discount |
|----------|----------|
| 5+ | 5% |
| 10+ | 10% |
| 15+ | 15% |
| 20+ | 20% |

**What Happens:**
- Same as single session, but adds `session_count` to `coaching_sessions_remaining`
- Plan and plan_end_date remain unchanged
- Sessions **NEVER EXPIRE**

### 5.3 Free Trial + Single Session

**Scenario:** User on expired free trial purchases a single session

| Aspect | Before | After |
|--------|--------|-------|
| Plan | `free_trial` (expired) | `free_trial` (still expired) |
| Content Access | Locked | **Still Locked** |
| Coaching Access | None | **CAN BOOK** (has 1 credit) |
| `coaching_sessions_remaining` | 0 | 1 |

**Key Insight:** Single session purchases grant coaching access ONLY. They do NOT unlock courses, drills, or other content.

### 5.4 Subscription + Single Session

**Scenario:** User with active subscription purchases additional coaching sessions

| Aspect | Before (Pro Plan) | After |
|--------|-------------------|-------|
| Plan | `pro_plan` | `pro_plan` (unchanged) |
| Content Access | Full | Full |
| Coaching (from plan) | 0 | 0 |
| `coaching_sessions_remaining` | 0 | 1+ |
| Can Book Coaching | No | **YES** |

---

## 6. Plan Expiry Behavior

### 6.1 Free Trial Expiry

**What Expires:** After 7 days from account creation

**Access After Expiry:**
| Feature | Access |
|---------|--------|
| Dashboard | ✅ Accessible |
| Courses Page | ✅ Browsable, items locked |
| Drills Page | ✅ Browsable, items locked |
| Peer Practice Page | ✅ Browsable, booking disabled |
| Coaching Page | ✅ Accessible (can purchase sessions) |
| Workshops Page | ✅ Browsable, items locked |
| Single Session Credits | ✅ **NEVER EXPIRE** |

**Code (resources.py check_plan_status):**
```python
if result["trial_expired"]:
    result["use_item_level_locking"] = True
    result["can_access_courses"] = True  # Page browsable
    result["can_access_drills"] = True   # Page browsable
    # Items are locked individually via is_free flag
```

### 6.2 Subscription Plan Expiry

**What Expires:** After `subscription_end_date` (typically 1 month from purchase)

**Access After Expiry:**
- **Same as expired free trial** - pages browsable, items locked
- Days left is **NOT SHOWN** to subscription users (reduce churn)
- User must manually re-purchase (no auto-renewal currently)

### 6.3 Coaching Program Expiry

**What Expires:** After `coaching_program_end_date` (2-6 months based on program)

**Access After Expiry:**
| Feature | Access |
|---------|--------|
| Content (Courses/Drills) | ❌ Locked |
| Unused Coaching Sessions | ❌ **LOST** (plan sessions expire) |
| Purchased Single Sessions | ✅ **STILL VALID** |
| Peer Practice | ❌ Locked (unless has addon) |

**Key Distinction:**
- `coaching_sessions_total` / `coaching_sessions_used` → Expire with plan
- `coaching_sessions_remaining` (purchased) → **NEVER expire**

### 6.4 What NEVER Expires

1. **Single Session Credits** (`coaching_sessions_remaining`)
2. **User Account** (no account deletion on expiry)
3. **Progress Data** (videos watched, drills completed)
4. **Chat History** (peer/coaching messages)
5. **Feedback Given/Received**

---

## 7. Admin vs User Purchase Differences

### 7.1 Comparison Table

| Aspect | User Purchase (Razorpay) | Admin Upgrade |
|--------|--------------------------|---------------|
| Payment Record | ✅ Created in `payment_orders` | ❌ None |
| Razorpay Transaction | ✅ Real payment | ❌ None |
| GST Calculation | ✅ 18% added | ❌ Not applicable |
| Invoice Generated | ✅ Yes | ❌ No |
| Plan Start Date | Payment verification time | Admin update time |
| Plan End Date | Based on `duration_months` | Based on `duration_months` |
| Features Synced | ✅ From plan config | ✅ From plan config |
| Can Set Custom End Date | ❌ No | ✅ Yes (via `plan_end_date` field) |
| Can Set Custom Credits | ❌ No | ✅ Yes (manual override) |

### 7.2 Admin-Only Capabilities

1. **Custom Plan End Date:** Admin can set `plan_end_date` to any value
2. **Credit Override:** Admin can manually set `coaching_sessions_total`
3. **Plan Downgrade:** Admin can move user from Pro to Basic (user cannot)
4. **Pinnacle Assignment:** Only admin can assign Pinnacle (application-only)
5. **Cohort Enrollment:** Admin can enroll users in specific cohort batches

### 7.3 Admin Upgrade API

```http
PUT /api/admin/users/{user_id}
Content-Type: application/json

{
    "plan": "full_prep",
    "plan_end_date": "2026-07-01T00:00:00Z",  // Optional custom end date
    "coaching_sessions_total": 20  // Optional custom credits
}
```

---

## 8. Access Control Matrix

### 8.1 Content Access by Plan Status

| Status | Courses | Drills | Peer Practice | Coaching | Workshops |
|--------|---------|--------|---------------|----------|-----------|
| Active Free Trial | Free items | Free items | 1/month | Purchase only | Free items |
| Expired Free Trial | **Locked** | **Locked** | **Locked** | Purchase only | **Locked** |
| Active Subscription | ✅ Full | ✅ Full | Per plan | Purchase only | ✅ Full |
| Expired Subscription | **Locked** | **Locked** | **Locked** | Purchase only | **Locked** |
| Active Coaching | ✅ Full | ✅ Full | Per plan | ✅ Plan credits | ✅ Full |
| Expired Coaching | **Locked** | **Locked** | **Locked** | Purchased only | **Locked** |
| Has Single Sessions | Per plan | Per plan | Per plan | ✅ Can book | Per plan |

### 8.2 Days Left Display Logic

| Plan Type | Show Days Left? | Reason |
|-----------|-----------------|--------|
| Free Trial | ✅ Yes | Create urgency to convert |
| Subscription (Basic/Pro/Pro+) | ❌ No | Reduce churn anxiety |
| Coaching Program | ✅ Yes | Fixed duration, user expects it |
| Single Sessions | N/A | Never expire |

### 8.3 Upgrade CTA Behavior

| Current Plan | Trigger | CTA Action |
|--------------|---------|------------|
| Expired Trial | Click locked item | Open SubscriptionPlansModal |
| Expired Subscription | Click locked item | Open SubscriptionPlansModal |
| Active Trial | Click locked item | Open SubscriptionPlansModal |
| Active Subscription | Click "Get Coaching" | Show coaching plans |

---

## Appendix A: Database Schema Reference

### User Document (Key Fields)

```javascript
{
  "id": "user-abc123",
  "email": "user@example.com",
  "plan": "pro_plan",
  "plan_name": "Pro Plan",
  "plan_category": "subscription",
  "plan_start_date": "2026-01-15T10:00:00Z",
  "plan_end_date": "2026-02-15T10:00:00Z",
  "subscription_end": "2026-02-15T10:00:00Z",  // Same as plan_end_date for subscriptions
  "coaching_program_end_date": null,  // Set for coaching plans
  
  // Plan-based credits (expire with plan)
  "coaching_sessions_total": 0,
  "coaching_sessions_used": 0,
  
  // Purchased credits (NEVER expire)
  "coaching_sessions_remaining": 3,
  
  // Peer sessions
  "peer_sessions_total": 4,
  "peer_sessions_used": 1,
  
  // Special flags
  "is_unlimited_coaching": false,  // True for Pinnacle users
  "features": { ... }  // Synced from plan
}
```

### Payment Order Document

```javascript
{
  "id": "order-xyz789",
  "razorpay_order_id": "order_ABC123",
  "user_id": "user-abc123",
  "plan_key": "pro_plan",
  "base_amount": 699,
  "gst": 125.82,
  "amount": 824.82,
  "status": "paid",
  "created_at": "2026-01-15T10:00:00Z",
  "paid_at": "2026-01-15T10:05:00Z"
}
```

---

## Appendix B: Code File References

| File | Purpose |
|------|---------|
| `/app/backend/routes/payments.py` | User payment processing |
| `/app/backend/routes/admin.py` | Admin user management |
| `/app/backend/routes/resources.py` | Access control (`check_plan_status`) |
| `/app/frontend/src/components/dashboard/DashboardLayout.jsx` | Frontend access control |
| `/app/frontend/src/components/SubscriptionPlansModal.jsx` | Upgrade modal |

---

## Appendix C: Recommended Improvements

### C.1 Parallel Subscription + Coaching (Not Yet Implemented)

The user requested that subscriptions and coaching programs run in parallel with separate end dates. This would require:

1. New fields: `subscription_plan`, `subscription_end_date`, `coaching_plan`, `coaching_program_end_date`
2. Modified `check_plan_status` to check both independently
3. UI to show both active plans and their remaining time

### C.2 Auto-Renewal for Subscriptions (Not Yet Implemented)

Current behavior requires manual re-purchase. Auto-renewal would require:

1. Razorpay subscription API integration
2. Webhook handling for renewal events
3. User notification before renewal

---

*Report Generated: January 2026*
*Author: E1 Agent*
*Platform: gradnext*
