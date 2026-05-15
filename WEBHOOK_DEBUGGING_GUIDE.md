# AUTO-UPGRADE ISSUE - WEBHOOK CONFIGURED BUT NOT WORKING

## 🔍 DEEPER INVESTIGATION NEEDED

Since webhook IS configured in Razorpay Dashboard, the issue is one of these:

---

## ⚠️ POSSIBLE CAUSES

### 1. Webhook Signature Mismatch (Most Likely - 60%)

**Problem:** 
Webhook secret in Razorpay Dashboard ≠ Webhook secret in backend .env

**What happens:**
- Razorpay sends webhook
- Backend receives it
- Signature verification fails (line 1355-1364)
- Returns 400 error to Razorpay
- User plan NOT updated

**How to check:**
```bash
# Check backend logs for signature errors
tail -n 500 /var/log/supervisor/backend.*.log | grep -i "signature"
```

**Expected if this is the issue:**
```
ERROR: Webhook signature verification failed: ...
```

**Solution:**
Ensure EXACT match:
- Razorpay Dashboard secret: `whsec_gradnext2025_Prod_8h3kL9mP4nQ7wX2tY6vR5jZ1cA0dF8bN3gH`
- Backend .env: `RAZORPAY_WEBHOOK_SECRET=whsec_gradnext2025_Prod_8h3kL9mP4nQ7wX2tY6vR5jZ1cA0dF8bN3gH`

---

### 2. Webhook Reaching Wrong Environment (Likely - 30%)

**Problem:**
Webhook pointing to preview instead of production backend

**What happens:**
- Webhook URL: `https://consultant-gateway.preview.emergentagent.com/api/subscriptions/webhook`
- User pays on: `https://app.gradnext.co`
- Webhook updates preview database, not production database!

**How to check:**
Check Razorpay Dashboard webhook URL exactly matches:
```
https://app.gradnext.co/api/subscriptions/webhook
```

NOT:
```
https://consultant-gateway.preview.emergentagent.com/api/subscriptions/webhook
```

---

### 3. Database Mismatch (Possible - 20%)

**Problem:**
Production frontend connects to different database than production backend

**What happens:**
- Backend updates one database (webhook processes)
- Frontend reads from different database (old data)

**How to check:**
Verify both frontend and backend use same MongoDB in production:
```bash
# Check backend MONGO_URL
echo $MONGO_URL

# Verify it's the production database
```

---

### 4. User ID Mismatch (Possible - 15%)

**Problem:**
Subscription created with one user ID, webhook processes different user ID

**What happens:**
- Subscription notes have: `user_id: "abc123"`
- Webhook updates user "abc123"
- But you're logged in as user "xyz789"
- So you don't see update

**How to check:**
```javascript
// In MongoDB
db.users.findOne({ email: "<your-email>" }, { id: 1 })
// Note the ID

// Then check subscription
db.webhook_logs.find().sort({received_at: -1}).limit(1)
// Check user_id in the notes
```

---

### 5. Webhook Timing/Race Condition (Possible - 10%)

**Problem:**
User refreshes before webhook processes

**What happens:**
- Payment success (t=0s)
- Frontend shows alert immediately (t=1s)
- User refreshes page manually (t=2s)
- Page loads old data (t=3s)
- Webhook arrives and processes (t=5s)
- But user already left page

**Solution:**
The frontend fix I applied should handle this (5-second wait)

---

## 🧪 COMPREHENSIVE DIAGNOSTIC STEPS

### Step 1: Check Backend Logs

```bash
# Check if webhook is being received
tail -n 500 /var/log/supervisor/backend.*.log | grep "Received webhook"

# Check for signature errors
tail -n 500 /var/log/supervisor/backend.*.log | grep -i "signature"

# Check for any webhook errors
tail -n 500 /var/log/supervisor/backend.*.log | grep -i "webhook" | grep -i "error"
```

**What to look for:**
- ✅ "Received webhook: subscription.activated" → Webhook arriving
- ❌ "Webhook signature verification failed" → Secret mismatch
- ❌ No webhook logs at all → Not reaching backend

### Step 2: Check Database Webhook Logs

```javascript
// Connect to production MongoDB
use test_database  // or your production DB name

// Check recent webhook logs
db.webhook_logs.find().sort({received_at: -1}).limit(10).pretty()
```

**What to look for:**
- Should see entries for your subscription
- Check `user_id` matches your actual user ID
- Check `event` is "subscription.activated" or "subscription.charged"
- Check timestamp is recent

### Step 3: Check User Record

```javascript
// Find your user
db.users.findOne(
  { email: "<your-email>" },
  { 
    plan: 1,
    plan_name: 1,
    is_subscribed: 1,
    subscription: 1,
    updated_at: 1
  }
)
```

**What to look for:**
- `plan`: Should be "basic_plan" (not "free_trial")
- `is_subscribed`: Should be true
- `subscription.status`: Should be "active"
- `updated_at`: Should be recent (within minutes of payment)

**If plan is still "free_trial":**
- Webhook didn't process successfully
- Check logs from Step 1

### Step 4: Check Razorpay Webhook Delivery

**In Razorpay Dashboard:**
1. Go to your subscription in Subscriptions section
2. Look for "Events" or "Webhook Logs" tab
3. Find `subscription.activated` event
4. Check webhook delivery status

**Possible statuses:**
- ✅ `200 OK` → Webhook delivered and processed successfully
- ❌ `400 Bad Request` → Signature verification failed
- ❌ `404 Not Found` → URL incorrect
- ❌ `500 Server Error` → Backend error
- ❌ `Timeout` → Backend not responding

### Step 5: Test Webhook Manually

**In Razorpay Dashboard:**
1. Settings → Webhooks
2. Find your production webhook
3. Click "Send Test Webhook"
4. Select event: `subscription.activated`
5. Add test data (subscription ID, user ID in notes)
6. Send

**Then immediately check:**
```bash
tail -f /var/log/supervisor/backend.*.log | grep "webhook"
```

**Should see:**
```
INFO: Received webhook: subscription.activated for subscription sub_xxx
INFO: Activated subscription for user xxx
```

---

## ✅ SOLUTIONS FOR EACH ISSUE

### Solution 1: Fix Signature Mismatch

**Check backend .env:**
```bash
cat /app/backend/.env | grep RAZORPAY_WEBHOOK_SECRET
```

**Should be:**
```
RAZORPAY_WEBHOOK_SECRET=whsec_gradnext2025_Prod_8h3kL9mP4nQ7wX2tY6vR5jZ1cA0dF8bN3gH
```

**If different:**
- Update to match Razorpay Dashboard secret
- Restart backend: `sudo supervisorctl restart backend`

### Solution 2: Fix Webhook URL

**Verify in Razorpay Dashboard:**
- Webhook URL must be: `https://app.gradnext.co/api/subscriptions/webhook`
- NOT preview URL
- NOT localhost
- NOT any other domain

**If wrong:**
- Update webhook URL in Razorpay
- Save changes
- Wait 5 minutes

### Solution 3: Verify Database Connection

**Check production backend connects to production database:**
```bash
# In production backend .env
MONGO_URL=<should-be-production-mongodb>
DB_NAME=<should-be-production-db>
```

**Not:**
```
MONGO_URL=mongodb://localhost:27017  # This is preview/local!
```

### Solution 4: Debug User ID Issue

**Get your user ID:**
```javascript
db.users.findOne({ email: "<your-email>" }, { id: 1 })
```

**Then check subscription was created with same ID:**
```javascript
db.subscriptions.findOne({ user_id: "<your-id>" })
```

**If mismatch:**
- Subscription created for different user
- Need to check why user_id in notes is wrong

---

## 🔧 IMMEDIATE DEBUGGING ACTIONS

### Quick Test (Do This Now):

1. **Make another small payment** (₹1 test if possible)

2. **Immediately after payment, run:**
```bash
# Watch logs in real-time
tail -f /var/log/supervisor/backend.*.log | grep -i "webhook\|subscription"
```

3. **You should see within 5-10 seconds:**
```
INFO: Received webhook: subscription.activated for subscription sub_xxx
INFO: Processing subscription for user yyy
INFO: Activated subscription for user yyy
```

4. **If you DON'T see this:**
- Webhook not arriving → Check Razorpay webhook logs
- Signature error → Check secret matches
- Other error → Check full error message

5. **If you DO see "Activated subscription":**
- But plan still shows free trial
- Then it's a frontend caching or database read issue

---

## 🎯 MOST LIKELY SCENARIO

Based on "webhook configured but not working":

**60% - Webhook Secret Mismatch**
- Razorpay has one secret
- Backend has different secret
- All webhooks fail signature verification
- Check: Backend logs for "signature" errors

**30% - Wrong Webhook URL**
- Points to preview/dev environment
- Updates wrong database
- Check: Exact URL in Razorpay Dashboard

**10% - User ID or Database Issue**
- Webhook works but updates wrong user/database
- Check: MongoDB records

---

## 📊 DIAGNOSTIC CHECKLIST

Run through this checklist and report findings:

- [ ] Backend logs show "Received webhook: subscription.activated"
  - YES → Webhook arriving
  - NO → URL or network issue

- [ ] Backend logs show "signature verification failed"
  - YES → Secret mismatch
  - NO → Continue checking

- [ ] webhook_logs collection has recent entries
  - YES → Webhooks being logged
  - NO → Not reaching database write

- [ ] User record shows `plan: "basic_plan"`
  - YES → Backend updated user
  - NO → Webhook not processing

- [ ] Razorpay shows webhook delivery as 200 OK
  - YES → Backend responded successfully
  - NO → Check the error code

---

## 🚀 QUICK FIX TO TEST

Add temporary detailed logging:

**Edit:** `/app/backend/routes/subscriptions.py`

**Add after line 1355 (before signature verification):**
```python
# Temporary debug logging
logger.info(f"DEBUG: Webhook received")
logger.info(f"DEBUG: Body length: {len(body)}")
logger.info(f"DEBUG: Signature present: {bool(signature)}")
logger.info(f"DEBUG: Secret configured: {bool(RAZORPAY_WEBHOOK_SECRET)}")
logger.info(f"DEBUG: Secret (first 10 chars): {RAZORPAY_WEBHOOK_SECRET[:10] if RAZORPAY_WEBHOOK_SECRET else 'None'}")
```

**Then restart backend and test again.**

This will show:
- If webhook is reaching backend
- If secret is configured
- If signature is present

---

## 📞 WHAT TO SHARE WITH ME

Please run the diagnostics and share:

1. **Backend logs:**
```bash
tail -n 200 /var/log/supervisor/backend.*.log | grep -i "webhook"
```

2. **Recent webhook logs from database:**
```javascript
db.webhook_logs.find().sort({received_at: -1}).limit(5)
```

3. **Your user record:**
```javascript
db.users.findOne(
  { email: "<your-email>" },
  { plan: 1, is_subscribed: 1, subscription: 1 }
)
```

4. **Razorpay webhook status:**
- Screenshot or description of webhook delivery status for a recent payment

With this information, I can identify the exact issue and provide precise fix!

---

**Status:** 🔴 WEBHOOK CONFIGURED BUT NOT WORKING
**Next Action:** Run diagnostic steps above
**Priority:** CRITICAL - Blocking all subscriptions
**Timeline:** 30 minutes to identify and fix with diagnostics
