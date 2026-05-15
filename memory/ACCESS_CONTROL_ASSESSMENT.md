# Access Control System - Comprehensive Assessment

## Executive Summary

This document analyzes the current access control implementation in the gradnext platform, covering all permutations of plans, expirations, and access levels.

---

## 1. PLAN CATEGORIES (Excluding Cohort & Add-ons)

### 1.1 Subscription Plans
| Plan | Monthly Price | Category | Expiry Logic |
|------|--------------|----------|--------------|
| Free Trial | ₹0 | subscription | 7 days from signup (uses `plan_end_date`) |
| Basic Plan | ₹499 | subscription | **NO EXPIRY CHECK IMPLEMENTED** |
| Pro Plan | ₹699 | subscription | **NO EXPIRY CHECK IMPLEMENTED** |
| Pro+ | ₹1,299 | subscription | **NO EXPIRY CHECK IMPLEMENTED** |

### 1.2 Coaching Programs
| Plan | Category | Expiry Logic |
|------|----------|--------------|
| Last Mile | coaching | **NO EXPIRY CHECK IMPLEMENTED** |
| Mid Mile | coaching | **NO EXPIRY CHECK IMPLEMENTED** |
| Full Prep | coaching | **NO EXPIRY CHECK IMPLEMENTED** |
| Pinnacle | coaching | **NO EXPIRY CHECK IMPLEMENTED** |

### 1.3 Single Session Purchases
- Stored in: `coaching_sessions_remaining` field
- **NO EXPIRY** - sessions never expire once purchased

---

## 2. CURRENT EXPIRY IMPLEMENTATION

### What's Implemented:
```
FREE TRIAL ONLY:
├── check_trial_status() function exists
├── Checks plan_end_date OR created_at + 7 days
├── Returns is_expired: true/false
└── When expired: sets has_sub, has_coaching, has_cohort to FALSE
```

### What's NOT Implemented:
```
PAID PLANS (Basic, Pro, Pro+, Last Mile, Mid Mile, Full Prep, Pinnacle):
├── NO subscription_end_date enforcement
├── NO plan_end_date enforcement
├── Plans remain active indefinitely once purchased
└── User keeps access even if subscription should have ended
```

### ⚠️ CRITICAL GAP:
The `check_trial_status()` function (line 24-90 in resources.py) ONLY runs for `free_trial` plan. It explicitly returns early with `is_expired: false` for ALL other plans.

---

## 3. ACCESS CONTROL BY FEATURE

### 3.1 COURSES PAGE

| Access Type | Implementation | CTA When Blocked | What Gets Blocked |
|-------------|---------------|------------------|-------------------|
| **Page-level block** | If `dashboardData.access.courses === false` | "Upgrade" button opens SubscriptionPlansModal | Entire page shows "Access Restricted" message |
| **Item-level block** | Each video/session has `locked` field | Lock icon on individual items | Only that specific video URL is null-ed |

**Current Logic (Backend - resources.py line 317-318):**
```python
is_free_trial = user_plan == "free_trial"
has_access = False if is_free_trial else has_subscription_access(user_plan, user_features)
```

**Issue:** Free trial users get NO access (has_access = False always), then individual videos marked as `is_free: true` are unlocked one by one. But **there's no partial access for paid plans** - they get full access or page-level block.

### 3.2 CASE DRILLS PAGE

| Access Type | Implementation | CTA When Blocked | What Gets Blocked |
|-------------|---------------|------------------|-------------------|
| **Page-level block** | If `dashboardData.access.drills === false` | "Upgrade" button opens SubscriptionPlansModal | Entire page shows "Access Restricted" |
| **Item-level block** | First 3 drills unlocked for non-subscribers | Lock icon on drill 4+ | Only specific drills locked, but users can still view the list |

**Current Logic (Backend - resources.py line 546-548):**
```python
# Free trial: only first 3 drills unlocked
if not has_access and i >= 3:
    drill_data["locked"] = True
```

**Can you give access to limited drills?** 
- **PARTIALLY YES** - Currently hardcoded to first 3 drills for free trial
- **NO admin control** to set X number of drills per user
- Would need to add `drills_limit` field to user/plan document

### 3.3 COACHING PAGE

| Access Type | Implementation | CTA When Blocked | What Gets Blocked |
|-------------|---------------|------------------|-------------------|
| **Page-level block** | NEVER - Coaching page always accessible | N/A | Nothing blocked at page level |
| **Booking block** | When `coaching_sessions_remaining <= 0` | "Buy Sessions" button | Cannot book, but can browse mentors |

**Current Logic (Backend - resources.py line 887-891):**
```python
# Grant coaching access if user has purchased single sessions
user_coaching_remaining = fresh_user.get("coaching_sessions_remaining", 0) or 0
if user_coaching_remaining and user_coaching_remaining > 0:
    has_coaching = True
```

**Key Finding:** Coaching access is based on **available session credits**, NOT plan type. A free trial user with purchased sessions CAN book coaching.

---

## 4. PERMUTATION MATRIX

### Scenario: Free Trial User

| Day | Trial Status | Courses | Drills | Peer Practice | Coaching | Workshops |
|-----|-------------|---------|--------|---------------|----------|-----------|
| Day 1-7 | Active | Only `is_free` videos | First 3 only | 1 session/month | Browse only (0 sessions) | Only recorded |
| Day 8+ | **EXPIRED** | ❌ BLOCKED (entire page) | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |

**CTA When Expired:** "Upgrade" button → SubscriptionPlansModal

---

### Scenario: Free Trial → Purchases Single Coaching Session

| State | Courses | Drills | Coaching |
|-------|---------|--------|----------|
| During trial (Day 1-7) | Limited | First 3 | Can book 1 session ✅ |
| After trial expires (Day 8+) | ❌ BLOCKED | ❌ BLOCKED | **⚠️ UNCLEAR BEHAVIOR** |

**⚠️ BUG/GAP IDENTIFIED:**
When trial expires, the system sets `has_coaching = False` (line 1289), but the check for `coaching_sessions_remaining > 0` happens BEFORE the expiry check (line 887-891). Need to verify actual behavior.

**Testing Required:** Does a user with expired trial + purchased sessions still have access to book coaching?

---

### Scenario: Free Trial → Upgrades to Basic/Pro/Pro+

| Timeline | Plan | Courses | Drills | Coaching | Sessions |
|----------|------|---------|--------|----------|----------|
| Before upgrade | free_trial | Limited | 3 | 0 | 0 |
| After upgrade | basic_plan | ✅ Full | ✅ Full | Browse only | 0 |
| **When does Basic expire?** | **NEVER** | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

**⚠️ CRITICAL GAP:** No expiry enforcement for subscription plans. User keeps access forever.

---

### Scenario: Free Trial → Upgrades to Coaching Program (Mid Mile)

| Timeline | Plan | Courses | Drills | Coaching | Peer | Strategy |
|----------|------|---------|--------|----------|------|----------|
| Before upgrade | free_trial | Limited | 3 | 0 | 1/mo | 0 |
| After upgrade | mid_mile | ✅ Full | ✅ Full | 10 sessions | 4/mo | 2 |
| **When does Mid Mile expire?** | **NEVER** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

**⚠️ CRITICAL GAP:** No expiry enforcement for coaching programs. Sessions remain available forever.

---

### Scenario: Expired Free Trial + Separately Purchased Single Session

| State | Expected Behavior | Current Behavior |
|-------|-------------------|------------------|
| Courses | ❌ Should be blocked | ❌ Blocked correctly |
| Drills | ❌ Should be blocked | ❌ Blocked correctly |
| Peer Practice | ❌ Should be blocked | ❌ Blocked correctly |
| **Coaching** | ✅ Should allow booking purchased session | **⚠️ UNCLEAR - needs testing** |
| Workshops | ❌ Should be blocked | ❌ Blocked correctly |

**Business Question:** If a user's trial expires but they have 1 purchased coaching session, should they:
1. Be able to book that session? (Likely YES - they paid for it)
2. Have access to courses/drills to prepare for the session? (Likely NO - not paid for)

---

## 5. DATE FIELDS ANALYSIS

### Current Fields in User Document:
| Field | Purpose | Used By | Enforced? |
|-------|---------|---------|-----------|
| `plan_end_date` | Free trial expiry | `check_trial_status()` | ✅ YES (trial only) |
| `subscription_date` | When subscription started | Display only | ❌ NO |
| `subscription_end` | When subscription should end | **NOTHING** | ❌ NO |
| `created_at` | Account creation date | Trial calculation fallback | ✅ YES |

### Missing Fields:
| Field Needed | Purpose |
|--------------|---------|
| `coaching_program_end_date` | When coaching program access expires |
| `session_purchase_date` | When single sessions were purchased |
| `sessions_expire_date` | When purchased sessions expire (if ever) |

---

## 6. CTA ANALYSIS

### When Access is Blocked:

| Component | Trigger | CTA Shown | Action |
|-----------|---------|-----------|--------|
| DashboardLayout (Sidebar) | Trial expired | "Upgrade" button (red) | Opens SubscriptionPlansModal |
| DashboardLayout (Sidebar) | Trial expiring (≤3 days) | "Upgrade" button (amber) | Opens SubscriptionPlansModal |
| CoursesPage | `access.courses === false` | "Upgrade" button | Opens SubscriptionPlansModal |
| DrillsPage | `access.drills === false` | "Upgrade" button | Opens SubscriptionPlansModal |
| Individual Video | `locked === true` | Lock icon | No action (can't click) |
| Individual Drill | `locked === true` | Lock icon | No action (can't click) |
| CoachingPage | `coaching_sessions_remaining <= 0` | "Buy Sessions" | Goes to pricing/payment |

### Admin Override:
| Feature | Admin Can Block? | Shows "Upgrade" CTA? |
|---------|-----------------|---------------------|
| Courses | ✅ Yes (`custom_access.courses = false`) | ❌ No (shows "Contact support" instead) |
| Drills | ✅ Yes | ❌ No |
| Workshops | ✅ Yes | ❌ No |
| Coaching | ✅ Yes | ❌ No |
| Peer Practice | ✅ Yes | ❌ No |

---

## 7. GAPS & RECOMMENDATIONS

### Critical Gaps:

1. **No Expiry for Paid Plans**
   - Users who buy Basic/Pro/Pro+ keep access forever
   - Users with coaching programs never lose access
   - **Fix:** Add expiry checks for all plan types in `dashboard-summary` endpoint

2. **Unclear Single Session + Expired Trial**
   - Logic conflict between trial expiry and session credit checks
   - **Fix:** Define business rule and implement clearly

3. **No Partial Content Control**
   - Cannot say "User X gets 5 drills" (only hardcoded 3 for free trial)
   - **Fix:** Add per-user content limits

4. **Session Credits Never Expire**
   - Once purchased, sessions remain forever
   - **Fix:** Add `sessions_expire_date` field if needed

### Recommended Database Schema Changes:

```javascript
user: {
  // Existing
  plan: "basic_plan",
  plan_end_date: "2026-02-01", // Currently only for free trial
  
  // ADD THESE:
  subscription_end_date: "2026-02-01",  // For Basic/Pro/Pro+
  coaching_program_end_date: "2026-03-01",  // For Last Mile/Mid Mile/etc.
  sessions_purchase_date: "2026-01-15",
  sessions_expire_date: "2026-07-15",  // 6 months from purchase
  
  // Content limits (optional)
  drills_limit: 10,  // null = unlimited
  courses_limit: null,  // null = all courses
}
```

---

## 8. ANSWER TO YOUR QUESTIONS

### Q1: What happens when free trial ends?
**A:** ALL pages are blocked. User sees "Trial Expired" banner with "Upgrade" button. Every feature (Courses, Drills, Peer Practice, Coaching, Workshops) shows "Access Restricted".

### Q2: What access does expired trial user still have?
**A:** NONE. Currently the system blocks everything when trial expires.

### Q3: What if free trial user upgrades to coaching program?
**A:** 
- Plan changes from `free_trial` to `mid_mile` (or similar)
- **End date:** Currently NEVER - no expiry implemented
- **Access to courses/drills:** YES, because coaching plans include subscription features

### Q4: What if free trial expires but user has purchased single session?
**A:** 
- **CURRENTLY:** Unclear/buggy behavior - needs testing
- **SHOULD BE:** User can book their purchased session but cannot access courses/drills

### Q5: Can you give access to limited drills?
**A:** 
- **Currently:** Only via code (hardcoded to 3 for free trial)
- **Admin panel:** NO control for partial access
- **Needed:** Add `drills_limit` field and UI controls

---

## 9. FULL PERMUTATION TABLE

| Starting Plan | Action | Courses | Drills | Coaching | End Date |
|--------------|--------|---------|--------|----------|----------|
| Free Trial | No action | Limited | 3 | 0 | 7 days |
| Free Trial | Trial expires | ❌ | ❌ | ❌ | Expired |
| Free Trial | Buy Basic | ✅ All | ✅ All | 0 | **NEVER** ⚠️ |
| Free Trial | Buy Pro | ✅ All | ✅ All | 0 | **NEVER** ⚠️ |
| Free Trial | Buy Pro+ | ✅ All | ✅ All | 0 | **NEVER** ⚠️ |
| Free Trial | Buy Mid Mile | ✅ All | ✅ All | 10 | **NEVER** ⚠️ |
| Free Trial | Buy 1 Session | Limited | 3 | 1 | Trial: 7 days |
| Expired Trial | Buy 1 Session | ❌ | ❌ | **1** (unclear) | **NEVER** |
| Basic | Plan "expires" | ✅ All | ✅ All | 0 | Not enforced |
| Mid Mile | Buy extra session | ✅ All | ✅ All | 10+1 | Not enforced |

---

## 10. NEXT STEPS

1. **Decide Business Rules:**
   - Do subscription plans expire? When?
   - Do coaching programs expire? When?
   - Do purchased sessions expire? When?
   - Should expired trial + purchased session allow coaching only?

2. **Implement Expiry Logic:**
   - Add `subscription_end_date` checking for Basic/Pro/Pro+
   - Add `coaching_program_end_date` checking for coaching plans
   - Decide if purchased sessions should have separate expiry

3. **Add Admin Controls:**
   - Per-user content limits (X drills, Y courses)
   - Ability to extend/shorten subscription dates
   - Ability to add bonus sessions

4. **Testing Required:**
   - Test expired trial + purchased session behavior
   - Test what happens when admin sets `custom_access.coaching = false` but user has session credits
