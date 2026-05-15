# Strategy Calls - Priority-Based Logic with Minimum Protection

## Core Principle

Users get **at least** what their plan promises, and admins can increase (but not decrease below plan minimum).

## Calculation Formula

```
TOTAL = MAX(plan_baseline, admin_override) + bonus_credits
REMAINING = TOTAL - used
```

Where:
- **plan_baseline**: Strategy calls from plan features (e.g., Full Prep = 3)
- **admin_override**: `strategy_calls_total` field set by admin (0 = no override)
- **bonus_credits**: Additional credits from `plan_assignments` or addon purchases

## Scenarios

### Scenario 1: Fresh Subscription (No Admin Changes)
```
Plan: Full Prep (3 strategy calls)
Admin Override: 0 (not set)
Bonus Credits: 0

Calculation:
- MAX(3, 0) + 0 = 3
- Shows: 3 sessions ✅
```

### Scenario 2: Admin Increases to 4
```
Plan: Full Prep (3 strategy calls)
Admin Override: 4 (admin manually set to 4)
Bonus Credits: 0

Calculation:
- MAX(3, 4) + 0 = 4
- Shows: 4 sessions ✅
```

### Scenario 3: Admin Tries to Decrease to 2
```
Plan: Full Prep (3 strategy calls)
Admin Override: 2 (admin tried to set to 2)
Bonus Credits: 0

Calculation:
- MAX(3, 2) + 0 = 3 (plan minimum protected)
- Shows: 3 sessions ✅
- Note: Users never get less than plan promise
```

### Scenario 4: User Books 1 Session
```
Plan: Full Prep (3 strategy calls)
Admin Override: 0
Bonus Credits: 0
Used: 1

Calculation:
- MAX(3, 0) + 0 - 1 = 2
- Shows: 2 sessions remaining ✅
```

### Scenario 5: User Purchases 2 Addon Credits
```
Plan: Full Prep (3 strategy calls)
Admin Override: 0
Bonus Credits: 2 (purchased addons)
Used: 0

Calculation:
- MAX(3, 0) + 2 = 5
- Shows: 5 sessions ✅
```

### Scenario 6: Admin Override + Addon Purchase
```
Plan: Full Prep (3 strategy calls)
Admin Override: 5 (admin set to 5)
Bonus Credits: 2 (purchased addons)
Used: 1

Calculation:
- MAX(3, 5) + 2 - 1 = 6
- Shows: 6 sessions ✅
```

### Scenario 7: Admin Uses Plan Assignment for Bonus
```
Plan: Full Prep (3 strategy calls)
Admin Override: 0
Bonus Credits: 1 (from plan_assignment)
Used: 0

Calculation:
- MAX(3, 0) + 1 = 4
- Shows: 4 sessions ✅
```

## How Admin Can Manage Credits

### Option 1: Direct Override (strategy_calls_total)
- Admin sets `strategy_calls_total` in user edit form
- If value > plan_baseline → User gets override amount
- If value < plan_baseline → User gets plan_baseline (protected)
- If value = 0 → User gets plan_baseline (no override)

### Option 2: Plan Assignments (Bonus)
- Admin can grant additional credits via "plan_assignments"
- These are ALWAYS additive (bonuses)
- Good for: Compensations, promotions, special grants

### Option 3: Addon Purchase (User-initiated)
- User purchases addon credits via payment
- These are ALWAYS additive (purchased extras)
- Stored as increase in `strategy_calls_total`

## Implementation Details

### Database Fields

**User Document:**
```javascript
{
  "plan": "full_prep",                    // Plan key
  "strategy_calls_total": 5,              // Admin override (0 = no override)
  "strategy_calls_used": 2,               // Sessions consumed
  "plan_assignments": [                   // Admin bonus grants
    {
      "strategy_calls_granted": 1,
      "is_active": true
    }
  ]
}
```

**Plan Document:**
```javascript
{
  "plan_key": "full_prep",
  "features": {
    "strategy_calls": 3                   // Plan baseline
  }
}
```

### Calculation Code

```python
# Step 1: Get plan baseline
plan_baseline = plan.features.strategy_calls or 0

# Step 2: Get admin override
admin_override = user.strategy_calls_total or 0

# Step 3: Base = MAX(baseline, override)
base_credits = max(plan_baseline, admin_override) if admin_override > 0 else plan_baseline

# Step 4: Add bonuses
bonus_credits = sum(assignment.strategy_calls_granted for assignment in plan_assignments)

# Step 5: Calculate
total = base_credits + bonus_credits
used = user.strategy_calls_used
remaining = max(0, total - used)
```

## Benefits of This Approach

✅ **User Protection**: Users always get at least what their plan promises
✅ **Flexibility**: Admins can increase credits easily
✅ **Clarity**: Clear separation between base and bonuses
✅ **Scalability**: Supports multiple bonus sources (assignments, purchases)
✅ **Predictability**: Plan changes don't accidentally reduce user credits

## Edge Cases

### Case 1: User Downgrades Plan
- Old Plan: Full Prep (3 sessions)
- New Plan: Pro (1 session)
- Admin Override: 0
- Result: Shows 1 session (new plan baseline)
- **Important**: This can reduce credits! Consider setting admin_override to old plan amount before downgrade

### Case 2: Plan Features Updated
- Full Prep updated from 3 → 5 sessions
- Existing users with admin_override = 0 → Automatically get 5
- Existing users with admin_override = 4 → Get 5 (new plan baseline higher)
- Existing users with admin_override = 6 → Keep 6 (override still higher)

### Case 3: Addon Purchase Impact on Override
When user purchases addon:
```python
# Current: admin_override = 0, plan = 3
# User purchases 2
new_override = admin_override + 2  # 0 + 2 = 2

# Result: MAX(3, 2) = 3 (no visible change!)
```

**Issue**: This seems wrong. User paid for 2 but sees 0 increase.

**Solution**: Addon purchases should be stored separately OR we need to ensure admin_override starts at plan_baseline when first addon purchased.

### REVISED Addon Purchase Logic:

```python
# When user purchases addon
current_override = user.strategy_calls_total or 0

if current_override == 0:
    # First purchase - set override to plan baseline + purchase
    plan_baseline = get_plan_baseline(user)
    new_override = plan_baseline + quantity
else:
    # Subsequent purchase - just add
    new_override = current_override + quantity

user.strategy_calls_total = new_override
```

This ensures:
- Plan: 3, Purchase 2 → Override becomes 5 → Shows 5 ✅
- Plan: 3, Override: 5, Purchase 2 → Override becomes 7 → Shows 7 ✅

