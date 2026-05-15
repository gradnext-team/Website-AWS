# Plan Naming Audit Report

## ✅ STANDARDIZATION COMPLETE

### Final Solution: Updated PlanType Enum to Match Database Convention

The enum values were updated to use the same naming as the database (`"basic_plan"`, `"pro_plan"`) instead of the legacy values (`"basic"`, `"pro"`).

### Files Modified:

1. **`/app/backend/models.py`** - Updated PlanType enum:
   - `BASIC = "basic"` → `BASIC = "basic_plan"`
   - `PRO = "pro"` → `PRO = "pro_plan"`

2. **`/app/backend/routes/resources.py`** - Cleaned up workarounds:
   - `check_plan_status()` - Now uses clean list: `["basic_plan", "pro_plan", "pro_plus"]`
   - `has_subscription_access()` - Uses enum values directly (now consistent)
   - `has_coaching_access()` - Uses enum values directly (now consistent)

3. **`/app/backend/routes/peers.py`** - Cleaned up workarounds:
   - Plan category check now uses: `["basic_plan", "pro_plan", "pro_plus"]`

---

## Complete Plan Naming Convention Map

### PlanType Enum (`/app/backend/models.py`) - NOW STANDARDIZED ✅
| Enum Name | Enum Value |
|-----------|------------|
| FREE_TRIAL | `"free_trial"` |
| BASIC | `"basic_plan"` ✅ |
| PRO | `"pro_plan"` ✅ |
| PRO_PLUS | `"pro_plus"` |
| LAST_MILE | `"last_mile"` |
| MID_MILE | `"mid_mile"` |
| FULL_PREP | `"full_prep"` |
| PINNACLE | `"pinnacle"` |
| COHORT_PREMIUM | `"cohort_premium"` |
| COHORT_ELITE | `"cohort_elite"` |
| SINGLE_SESSION | `"single_session"` |

### Database Plan Keys (`/app/backend/routes/admin.py` - seed data)
| Plan Key | Category |
|----------|----------|
| `"free_trial"` | subscription |
| `"basic_plan"` | subscription |
| `"pro_plan"` | subscription |
| `"pro_plus"` | subscription |
| `"single_session"` | coaching |
| `"last_mile"` | coaching |
| `"mid_mile"` | coaching |
| `"full_prep"` | coaching |
| `"pinnacle"` | coaching |
| `"cohort_premium"` | cohort |
| `"cohort_elite"` | cohort |

### ✅ ALL NAMING NOW CONSISTENT

| Plan | Enum Value | Database plan_key | Status |
|------|------------|-------------------|--------|
| Basic | `"basic_plan"` | `"basic_plan"` | ✅ Match |
| Pro | `"pro_plan"` | `"pro_plan"` | ✅ Match |
| Pro+ | `"pro_plus"` | `"pro_plus"` | ✅ Match |
| All others | Same | Same | ✅ Match |

---

## File-by-File Plan Name Usage

### Backend Files

#### `/app/backend/models.py`
- **Uses**: Enum values (`"basic"`, `"pro"`, `"pro_plus"`, etc.)
- **Purpose**: Defines PlanType enum

#### `/app/backend/routes/resources.py`
- **Line 136**: `SUBSCRIPTION_PLANS = ["basic_plan", "pro_plan", "pro_plus", "basic", "pro"]` ✅ FIXED
- **Line 137**: `COACHING_PLANS = ["last_mile", "mid_mile", "full_prep", "pinnacle"]`
- **Line 179**: `if plan == "free_trial"`
- **Line 470-478**: `has_subscription_access()` - Uses both conventions ✅ FIXED
- **Line 487-492**: `has_coaching_access()` - Uses enum values (coaching plans match)
- **Line 497-498**: `has_cohort_access()` - Uses enum values
- **Line 1528**: `user_plan == "pinnacle"`
- **Line 1559**: `coaching_plan_list = ["last_mile", "mid_mile", "full_prep", "cohort_premium", "cohort_elite"]`

#### `/app/backend/routes/subscriptions.py`
- **Line 270**: `tier_order = {"basic_plan": 1, "pro_plan": 2, "pro_plus": 3}`
- **Line 303**: `user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"]`
- **Line 378**: `user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"]`
- **Line 406-408**: Price mapping uses `"basic_plan"`, `"pro_plan"`, `"pro_plus"`
- **Line 1089**: `user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"]`

#### `/app/backend/routes/peers.py`
- **Line 264**: `plan in ["basic", "pro", "pro_plus", "basic_plan", "pro_plan"]` ✅ FIXED
- **Line 455**: `user_plan == "free_trial"`
- **Line 528**: `plan_key in ["free_trial", "free"]`
- **Line 1637**: `user_plan == "free_trial"`

#### `/app/backend/routes/mentors.py`
- **Line 512-513**: Uses `PlanType.LAST_MILE`, `PlanType.MID_MILE`, etc. (enum values)
- **Line 520**: `user_plan.lower() == "pinnacle"`
- **Line 1141**: `candidate_plan == "pinnacle"`
- **Line 1164**: `coaching_plans = ["last_mile", "mid_mile", "full_prep"]`

#### `/app/backend/routes/admin.py`
- **Line 3493-3851**: Plan seed data uses `"basic_plan"`, `"pro_plan"`, etc.
- **Line 5100**: `for plan_key in ["basic_plan", "pro_plan", "pro_plus"]`
- **Line 5167**: `if plan_key in ["basic_plan", "pro_plan"]`
- **Line 5217-5225**: Uses `"basic_plan"`, `"pro_plan"`, `"pro_plus"`

#### `/app/backend/routes/auth.py`
- **Line 330, 449, 493, 728, 868**: Default plan `"free_trial"`
- **Line 1172**: `"plan": "full_prep"`
- **Line 1205**: `"plan": "pinnacle"`

#### `/app/backend/routes/payments.py`
- **Line 432**: `user_dict.get("plan", "free_trial")`
- Gets plan keys from database (no hardcoded plan names)

#### `/app/backend/routes/sales_admin.py`
- **Line 46-50**: Uses substring matching (works with both conventions)
  ```python
  elif any(x in plan_key.lower() for x in ["pro", "basic", "subscription"]):
  ```

#### `/app/backend/server.py`
- **Line 113-122**: Uses `"free_trial"`, `"basic_plan"`, `"pro_plan"`, `"pro_plus"`, `"last_mile"`, etc.
- **Line 221-229**: Uses `"pinnacle"`, `["last_mile", "mid_mile", "full_prep", "pinnacle"]`
- **Line 363-367**: Uses `"free_trial"`, `"basic_plan"`, `"pro_plus"`, `"last_mile"`, `"pinnacle"`

#### `/app/backend/migrations/startup_migrations.py`
- **Line 18-81**: Uses `"free_trial"`, `"basic_plan"`, `"pro_plan"`, `"pro_plus"`, `"last_mile"`, etc.
- **Line 153, 175, 189, 203**: Uses `"pinnacle"`
- **Line 226-230**: Uses `"last_mile"`, `"mid_mile"`, `"full_prep"`, `"cohort_premium"`, `"cohort_elite"`

---

### Frontend Files

#### `/app/frontend/src/components/ui/PlansModal.jsx`
- **Line 19-28**: Uses `"free_trial"`, `"basic_plan"`, `"pro_plan"`, `"pro_plus"`
- **Line 115**: `planOrder = ['basic_plan', 'pro_plan', 'pro_plus']`
- **Line 376-383**: Uses `"basic_plan"`, `"pro_plan"`

#### `/app/frontend/src/components/ui/SubscriptionManagement.jsx`
- **Line 24-33**: Uses `"free_trial"`, `"basic_plan"`, `"pro_plan"`, `"pro_plus"`
- **Line 264**: `planOrder = ['basic_plan', 'pro_plan', 'pro_plus']`
- **Line 788**: `['basic_plan', 'pro_plan', 'pro_plus'].includes(userPlan)`

#### `/app/frontend/src/components/dashboard/SubscriptionPlansModal.jsx`
- **Line 16**: `SUBSCRIPTION_PLAN_KEYS = ['basic_plan', 'pro_plan', 'pro_plus']`
- **Line 72-78**: Uses `"basic_plan"`, `"pro_plan"`

#### `/app/frontend/src/components/dashboard/ProfilePage.jsx`
- **Line 238**: Uses `"basic_plan"`, `"pro_plan"`, `"pro_plus"`, `"free_trial"`

#### `/app/frontend/src/components/dashboard/DashboardLayout.jsx`
- **Line 23**: `user.plan === 'free_trial'`
- **Line 155-169**: Uses `"free_trial"`, `"last_mile"`, `"mid_mile"`, `"full_prep"`

#### `/app/frontend/src/components/payment/PricingPage.jsx`
- **Line 40-69**: Uses `"last_mile"`, `"mid_mile"`, `"full_prep"`

---

## Recommendations

### Short-term (Implemented ✅)
1. Updated access control functions to recognize both naming conventions
2. `has_subscription_access()` now accepts both `"basic"` and `"basic_plan"`
3. `check_plan_status()` now accepts both conventions

### Long-term (Not Implemented - For Future Consideration)
1. **Standardize on one convention**: Either update the enum to use `"basic_plan"` OR update the database to use `"basic"`
2. **Update PlanType enum** in `models.py` to match database:
   ```python
   BASIC = "basic_plan"  # Instead of "basic"
   PRO = "pro_plan"      # Instead of "pro"
   ```
3. **Or update database seed data** to use enum values without `_plan` suffix

### Why Both Conventions Exist
- **Enum values** (`"basic"`, `"pro"`): Legacy convention, used in access control
- **Database plan_key** (`"basic_plan"`, `"pro_plan"`): Used by subscription/payment system and admin panel

The subscription system stores `plan_key` from the database directly into the user's `plan` field, which is why users end up with `"basic_plan"` instead of `"basic"`.
