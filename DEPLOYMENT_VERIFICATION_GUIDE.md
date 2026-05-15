# Deployment Verification Guide

## 🎯 How to Verify If New Code Is Actually Deployed

---

## ✅ **Quick Version Check**

### **Step 1: Check Backend Version**

Open browser and go to:
```
https://app.gradnext.co/api/health
```

**Expected Response (NEW CODE):**
```json
{
  "status": "healthy",
  "version": "2025-01-28-webhook-fix-v2",
  "features": {
    "plan_assignments": true,
    "enhanced_webhook_logging": true,
    "admin_log_endpoints": true
  }
}
```

**Old Code Response:**
```json
{
  "status": "healthy"
}
```

If you see ONLY `{"status": "healthy"}` → **OLD CODE IS STILL RUNNING!**

---

## 🔍 **Detailed Deployment Checks**

### **Check 1: Admin Log Endpoints**

Try accessing:
```
https://app.gradnext.co/api/admin/logs/webhooks
```

- **✅ Returns data or 401 (unauthorized)** → New code deployed
- **❌ Returns 404 (not found)** → Old code still running

### **Check 2: Subscription Creation Structure**

When you create a subscription, check `pending_subscription`:

**NEW CODE (Correct):**
```javascript
pending_subscription: {
  razorpay_subscription_id: "sub_xxx",
  razorpay_plan_id: "plan_xxx",
  status: "created",
  plan_key: "basic_plan",  // ← Has plan_key
  billing_cycle: "monthly",
  locked_price: 1.18,
  base_price: 1,
  gst_amount: 0.18,
  auto_renew: true,
  created_at: "2025-01-28..."
}
```

**OLD CODE (Wrong):**
```javascript
pending_subscription: {
  razorpay_subscription_id: "sub_xxx",
  plan: "free_trial"  // ← Only 2 fields!
}
```

---

## 🚨 **Common Deployment Issues**

### **Issue 1: Build Failed**
**Symptom:** Deployment shows "completed" but errors in logs
**Solution:**
1. Check Emergent deployment logs
2. Look for build errors (Python syntax, missing imports)
3. Fix errors and redeploy

### **Issue 2: Service Didn't Restart**
**Symptom:** Code deployed but old version still running
**Solution:**
1. Manually restart backend service in Emergent
2. Or click "Restart All Services"

### **Issue 3: Wrong Branch Deployed**
**Symptom:** Emerges shows success but code doesn't match
**Solution:**
1. Check which branch/commit Emergent is deploying from
2. Verify your changes are in that branch
3. May need to push/commit changes first

### **Issue 4: Code Not Committed**
**Symptom:** Preview works, production doesn't
**Solution:**
1. Changes in preview aren't automatically in production
2. Need to commit changes to git/repository
3. Then deploy from that commit

### **Issue 5: Environment Separation**
**Symptom:** Different databases, different codebases
**Solution:**
- Preview = Separate environment
- Production = Separate environment
- Deployment doesn't copy from preview to production
- Need proper git workflow

---

## 📋 **Step-by-Step Deployment Verification**

### **After You Deploy:**

**1. Wait 5-10 minutes** for deployment to complete

**2. Check version endpoint:**
```
https://app.gradnext.co/api/health
```
Look for `version: "2025-01-28-webhook-fix-v2"`

**3. Try admin log endpoint:**
```javascript
fetch('https://app.gradnext.co/api/admin/logs/webhooks', {
  credentials: 'include'
}).then(r => console.log(r.status))
```
Should return 200 or 401, NOT 404

**4. Test subscription creation:**
- Create new test user
- Try to upgrade
- Check `pending_subscription` structure
- Should have 10 fields, not 2

**5. Check webhook processing:**
- Complete payment
- Wait 15 seconds
- Check user plan field
- Should change from free_trial to basic_plan

---

## 🔧 **What To Do If Old Code Is Still Running**

### **Option 1: Force Restart**
1. Go to Emergent dashboard
2. Find "Restart Services" or "Restart Backend"
3. Click it
4. Wait 2 minutes
5. Check version endpoint again

### **Option 2: Redeploy**
1. Make a small change (add a comment)
2. Commit the change
3. Deploy again
4. Verify version endpoint

### **Option 3: Check Deployment Logs**
1. In Emergent, find deployment logs
2. Look for errors:
   - Python syntax errors
   - Import errors
   - Missing dependencies
3. Fix any errors
4. Redeploy

### **Option 4: Contact Emergent Support**
If nothing works:
1. Tell them: "Deployment shows success but old code still running"
2. Share deployment ID/timestamp
3. Ask them to check backend service status

---

## ✅ **Successful Deployment Checklist**

- [ ] Version endpoint shows "2025-01-28-webhook-fix-v2"
- [ ] Admin log endpoints return 200/401, not 404
- [ ] pending_subscription has 10 fields when creating subscription
- [ ] Webhook processing updates user.plan correctly
- [ ] Plan assignments get created
- [ ] Dashboard shows correct plan after payment

---

## 🆘 **Troubleshooting Commands**

### **Check if endpoints exist:**
```javascript
// Should return 200 or 401
fetch('https://app.gradnext.co/api/admin/logs/webhooks').then(r => console.log('Status:', r.status))

// Should return 200 or 401
fetch('https://app.gradnext.co/api/admin/logs/recent-activations').then(r => console.log('Status:', r.status))
```

### **Check backend version:**
```javascript
fetch('https://app.gradnext.co/api/health')
  .then(r => r.json())
  .then(data => {
    if (data.version) {
      console.log('✅ NEW CODE deployed! Version:', data.version);
    } else {
      console.log('❌ OLD CODE still running! Only has:', data);
    }
  })
```

---

## 📊 **Deployment Timeline**

```
Deployment Started
  ↓
2-3 minutes: Building code
  ↓
1-2 minutes: Installing dependencies
  ↓
1-2 minutes: Starting services
  ↓
Total: 5-10 minutes
  ↓
Services Active
```

If more than 15 minutes passed and old code still running → Something is wrong!

---

## 💡 **Key Insight**

The health endpoint version check is the FASTEST way to verify deployment:

```bash
# Quick one-liner check:
curl https://app.gradnext.co/api/health
```

If you see `"version"` field → New code deployed ✅
If you DON'T see `"version"` field → Old code still running ❌

---

Use this guide after every deployment to verify changes are actually live!
