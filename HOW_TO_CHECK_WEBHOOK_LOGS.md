# How to Check Webhook Logs After Payment

## ✅ **Enhanced Logging Added**

I've added comprehensive debug logging to the webhook handler. Now when you make a payment, it will log:

1. When webhook is received
2. What plan_key is extracted from notes
3. If plan lookup succeeds or fails
4. What data is being written to database
5. If database update succeeds or fails
6. Any exceptions that occur

---

## 📋 **How to Check Logs After Test Payment**

### **Step 1: Make a Test Payment**

1. Go to your production site (app.gradnext.co)
2. Log in with test account
3. Click "Upgrade to Basic Plan"
4. Complete payment (use ₹1 test plan)
5. Wait about 10 seconds for webhook

### **Step 2: Check Backend Logs**

If you have access to production logs, run:

```bash
# View last 100 lines of backend logs
tail -n 100 /var/log/backend.log

# Or filter for webhook-related logs
grep -i "webhook\|activation" /var/log/backend.log | tail -n 50
```

---

## 🔍 **What to Look For in Logs**

You should see logs like this:

### **✅ SUCCESSFUL Flow (What We Want)**:

```
INFO: === WEBHOOK ACTIVATION START ===
INFO: User ID: user_91c8f67e1579
INFO: Subscription ID: sub_xxxxx
INFO: Notes received: {'user_id': 'user_91c8f67e1579', 'plan_key': 'basic_plan', ...}
INFO: Extracted - plan_key: basic_plan, billing_cycle: monthly
INFO: Looking up plan with plan_key: basic_plan
INFO: ✅ Plan found: Basic Plan (id: plan-basic)
INFO: Processing standard subscription activation
INFO: Calculated period_end: 2025-02-28T...
INFO: Created subscription_data: {...}
INFO: Created plan_assignment: {...}
INFO: Deactivating existing plan assignments...
INFO: Deactivate result: matched=1, modified=0
INFO: Updating user document with plan=basic_plan and creating plan_assignment...
INFO: ✅ Update result: matched=1, modified=1
INFO: ✅ SUCCESS: User plan updated to basic_plan
INFO: Activated subscription for user user_91c8f67e1579 with plan assignment
INFO: === WEBHOOK ACTIVATION COMPLETE ===
```

### **❌ FAILED Flow (Problems to Look For)**:

#### **Problem 1: plan_key Missing**
```
INFO: === WEBHOOK ACTIVATION START ===
INFO: Notes received: {'user_id': 'user_91c8f67e1579'}
ERROR: ❌ CRITICAL: plan_key is missing from notes!
```

#### **Problem 2: Plan Not Found**
```
INFO: Extracted - plan_key: basic_plan
INFO: Looking up plan with plan_key: basic_plan
ERROR: ❌ CRITICAL: No plan found for plan_key: basic_plan
```

#### **Problem 3: User Not Found**
```
INFO: Updating user document with plan=basic_plan...
INFO: ✅ Update result: matched=0, modified=0
ERROR: ❌ CRITICAL: No user found with id=user_xxxxx
```

#### **Problem 4: Database Exception**
```
ERROR: ❌ EXCEPTION during user update: ...
ERROR: Exception type: WriteError
ERROR: Exception details: ...
ERROR: Traceback: ...
```

---

## 📊 **What Each Log Means**

| Log Message | Meaning | What to Do |
|-------------|---------|------------|
| `plan_key is missing` | Notes don't contain plan_key | Check frontend/backend subscription creation |
| `No plan found` | Database doesn't have this plan_key | Check plans collection, run diagnostic |
| `matched=0` | User ID doesn't exist in database | User creation failed or wrong ID |
| `modified=0` (with matched=1) | Update query ran but nothing changed | Data might already be same (or update query issue) |
| `matched=1, modified=1` | ✅ Success! User updated | Everything worked! |
| `EXCEPTION during user update` | MongoDB error | Check exception details |

---

## 🎯 **Quick Diagnostic Checklist**

After test payment, check logs for:

- [ ] Webhook received? Look for "WEBHOOK ACTIVATION START"
- [ ] plan_key extracted? Look for "Extracted - plan_key: basic_plan"
- [ ] Plan found? Look for "Plan found: Basic Plan"
- [ ] Update successful? Look for "matched=1, modified=1"
- [ ] Any errors? Look for "❌" or "ERROR"

---

## 🚀 **Testing in Production**

Since you deployed to production:

1. **Make test payment** with ₹1 Basic Plan
2. **Wait 10-15 seconds** for webhook
3. **Check production logs** for above messages
4. **Look at user profile** - does it show Basic Plan?

---

## 📞 **If You Can't Access Production Logs**

### **Alternative: Check via Database**

If logs aren't accessible, check the database directly:

1. Use the diagnostic endpoint (after deploying):
   ```javascript
   fetch('https://app.gradnext.co/api/admin/plans/diagnostics', {
     credentials: 'include'
   }).then(r=>r.json()).then(console.log)
   ```

2. Check webhook_logs collection:
   - Should have recent entry for your test payment
   - Contains full webhook payload

---

## ✅ **Expected Timeline**

```
Payment Complete
  ↓
0-5 seconds: Razorpay processes payment
  ↓
5-10 seconds: Razorpay sends webhook
  ↓
10-15 seconds: Your backend processes webhook
  ↓
User plan should be updated by now!
```

If plan still not updated after 30 seconds → Check logs for errors

---

## 🆘 **Next Steps Based on Logs**

### **If Logs Show Success (matched=1, modified=1)**
- User document WAS updated
- Problem might be in dashboard display
- Check what dashboard component reads

### **If Logs Show Error**
- Share the error message with me
- We'll fix the specific issue
- Re-test

### **If No Webhook Logs at All**
- Webhook not reaching backend
- Check Razorpay webhook URL configuration
- Verify webhook secret matches

---

## 📝 **What to Share After Testing**

Please share:
1. **Relevant log lines** (copy the webhook activation section)
2. **Any errors** you see (the ❌ lines)
3. **Update result** (the matched/modified counts)
4. **User dashboard** - what plan does it show?

This will help me pinpoint the exact issue!
