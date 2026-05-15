# Plan Key Mismatch Diagnosis Guide

## 🔍 How to Check If Plan Key Is Being Sent/Received Correctly

### **Step 1: Check What Frontend Sends**

When you click "Subscribe to Basic Plan", the frontend sends this to backend:

**File**: `frontend/src/components/ui/PlansModal.jsx`

```javascript
{
  plan_key: "basic_plan",  // ← THIS is sent
  billing_cycle: "monthly"
}
```

**To verify**: Add console.log in browser before payment:
```javascript
console.log('Subscribing to:', plan_key); // Should show "basic_plan"
```

---

### **Step 2: Check What Gets Stored in Razorpay**

Backend creates Razorpay subscription with notes:

**File**: `backend/routes/subscriptions.py` Line 476-484

```python
"notes": {
    "user_id": user.get("id"),
    "plan_key": data.plan_key,  # ← From frontend, should be "basic_plan"
    "billing_cycle": data.billing_cycle
}
```

**To verify in Razorpay Dashboard:**
1. Go to Razorpay Dashboard
2. Click "Subscriptions"
3. Find your test subscription
4. Click on it to see details
5. Look for "Notes" section
6. Check if `plan_key: "basic_plan"` is there

---

### **Step 3: Check What Webhook Receives**

When webhook fires, it reads from notes:

**File**: `backend/routes/subscriptions.py` Line 1476-1478

```python
notes = subscription_entity.get("notes", {})
plan_key = notes.get("plan_key")  # ← Should get "basic_plan"
```

**Current Logging**: Line 1382
```python
logger.info(f"Received webhook: {event} for subscription {subscription_id}")
```

**To check webhook logs**:
```bash
# In backend logs, look for:
"Received webhook: subscription.activated for subscription sub_xxxxx"
```

---

## 🎯 **Most Likely Issue Based on Your Test**

Since dates updated but plan didn't, here's what probably happened:

### **Scenario A: plan_key is NULL in webhook**
```python
notes = subscription_entity.get("notes", {})
plan_key = notes.get("plan_key")  # ← Returns None!

# Then:
plan = await db.plans.find_one({"plan_key": None})  # ← Finds nothing!

# Result: Plan lookup fails, dates update but plan stays "free_trial"
```

### **Scenario B: plan_key is wrong value**
```python
plan_key = notes.get("plan_key")  # Returns "free_trial" instead of "basic_plan"

# User stays on free_trial, just dates extend
```

---

## 🔧 **Quick Diagnostic Test**

Add this temporary logging to check what's happening:

**File**: `backend/routes/subscriptions.py`

**After line 1478**, add:
```python
# TEMPORARY DEBUG LOGGING
print(f"=== DEBUG: Webhook Plan Key ===")
print(f"All notes: {notes}")
print(f"Extracted plan_key: {plan_key}")
print(f"Billing cycle: {billing_cycle}")
print(f"================================")
```

**After line 1482**, add:
```python
# TEMPORARY DEBUG LOGGING
print(f"=== DEBUG: Plan Lookup Result ===")
print(f"Plan found: {plan is not None}")
if plan:
    print(f"Plan name: {plan.get('name')}")
    print(f"Plan key: {plan.get('plan_key')}")
else:
    print(f"⚠️  NO PLAN FOUND for plan_key: {plan_key}")
print(f"====================================")
```

Then check backend logs after payment to see what's printed.

---

## 📊 **Expected vs Actual Flow**

### **EXPECTED (Correct Flow)**:
```
1. Frontend sends: plan_key = "basic_plan"
   ↓
2. Backend creates Razorpay subscription with notes.plan_key = "basic_plan"
   ↓
3. User pays
   ↓
4. Razorpay sends webhook with notes.plan_key = "basic_plan"
   ↓
5. Webhook extracts: plan_key = "basic_plan"
   ↓
6. Looks up plan: finds "Basic Plan"
   ↓
7. Updates user.plan = "basic_plan"
   ✅ User has Basic Plan
```

### **ACTUAL (What's Happening)**:
```
1. Frontend sends: plan_key = ???
   ↓
2. Backend creates Razorpay subscription with notes.plan_key = ???
   ↓
3. User pays
   ↓
4. Razorpay sends webhook with notes.plan_key = ???
   ↓
5. Webhook extracts: plan_key = ??? (possibly None or wrong value)
   ↓
6. Looks up plan: fails or finds wrong plan
   ↓
7. Updates dates but NOT plan
   ❌ User stays on Free Trial
```

---

## 🎯 **How to Fix Based on Diagnosis**

### **If plan_key is NULL in webhook:**
- Check Razorpay subscription notes in dashboard
- If notes are empty → Frontend not sending plan_key correctly
- Fix in PlansModal.jsx

### **If plan_key is wrong value:**
- Check what value is actually in notes
- Trace back to frontend to see what's being sent
- Fix mapping in frontend

### **If plan_key is correct but plan lookup fails:**
- Check if plan exists in database with that plan_key
- Run: `db.plans.find({"plan_key": "basic_plan"})`
- Verify plan_key matches exactly (case sensitive!)

---

## ✅ **Action Items**

1. **Check Razorpay Dashboard**:
   - Find your test subscription
   - Look at "Notes" section
   - Confirm `plan_key` is there and has correct value

2. **Add Debug Logging** (code above)
   - Deploy with logging
   - Test payment again
   - Check backend logs

3. **Compare**:
   - What frontend sent
   - What Razorpay stored
   - What webhook received
   - What got written to database

The mismatch will be in one of these steps!

---

## 📞 **Report Back**

When you check, please tell me:
1. What's in Razorpay subscription notes for `plan_key`?
2. What do the debug logs show after payment?
3. What's in the user document: `user.plan` and `user.plan_assignments`?

This will help pinpoint exactly where the flow breaks!
