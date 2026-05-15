# How to Check Production Logs - Super Simple Guide 👶

Since you deployed via Emergent and don't have direct server access, I've created **browser-based log viewers** you can use!

---

## 🎯 **3 Easy Ways to Check Logs**

---

## **Method 1: Check Recent Webhook Logs** (Most Useful!)

### **What This Shows:**
All webhook events received from Razorpay in the last 20 payments.

### **Steps:**

1. **Go to your website**: https://app.gradnext.co
2. **Log in as admin**
3. **Open browser console** (Press F12)
4. **Copy and paste this code**:

```javascript
fetch('https://app.gradnext.co/api/admin/logs/webhooks?limit=20', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.clear();
    console.log('=== RECENT WEBHOOK LOGS ===');
    console.log(`Total webhooks: ${data.total}\n`);
    
    data.logs.forEach((log, i) => {
      console.log(`\n${i+1}. ${log.event} at ${log.received_at}`);
      console.log(`   Subscription: ${log.subscription_id}`);
      console.log(`   User: ${log.user_id}`);
      console.log(`   Plan Key: ${log.plan_key || 'N/A'}`);
      console.log(`   Status: ${log.status || 'N/A'}`);
    });
  });
```

5. **Press Enter**
6. **Look for your recent test payment** in the list

---

## **Method 2: Check Recent Subscription Activations**

### **What This Shows:**
Users whose subscriptions were recently activated (successful upgrades).

### **Steps:**

1. **Stay in browser console** (from Method 1)
2. **Copy and paste this code**:

```javascript
fetch('https://app.gradnext.co/api/admin/logs/recent-activations?limit=10', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.clear();
    console.log('=== RECENT SUBSCRIPTION ACTIVATIONS ===');
    console.log(`Total: ${data.total}\n`);
    
    data.users.forEach((user, i) => {
      console.log(`\n${i+1}. ${user.name} (${user.email})`);
      console.log(`   User Plan Field: ${user.plan_field}`);
      console.log(`   Plan Name Field: ${user.plan_name_field}`);
      console.log(`   Subscription Plan Key: ${user.subscription_plan_key}`);
      console.log(`   Has Active Assignment: ${user.has_active_assignment}`);
      console.log(`   Active Assignment Plan: ${user.active_assignment_plan || 'None'}`);
      console.log(`   Activated: ${user.subscription_activated_at}`);
      console.log(`   Razorpay Sub ID: ${user.razorpay_subscription_id}`);
    });
  });
```

3. **Press Enter**
4. **Look for your test user** in the list
5. **Check if plan fields match**

---

## **Method 3: Check Specific User Details** (Most Detailed!)

### **What This Shows:**
Complete subscription details for a specific user (you!).

### **Steps:**

1. **Replace YOUR_EMAIL with your test email** in the code below
2. **Copy and paste**:

```javascript
fetch('https://app.gradnext.co/api/admin/logs/user-subscription/YOUR_EMAIL@gmail.com', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.clear();
    console.log('=== USER SUBSCRIPTION DETAILS ===');
    console.log(`\nUser: ${data.name} (${data.email})`);
    console.log(`User ID: ${data.user_id}`);
    
    console.log('\n📋 PLAN FIELDS:');
    console.log(`  plan: ${data.plan}`);
    console.log(`  plan_name: ${data.plan_name}`);
    console.log(`  plan_category: ${data.plan_category}`);
    console.log(`  is_subscribed: ${data.is_subscribed}`);
    
    console.log('\n📅 DATES:');
    console.log(`  plan_start_date: ${data.plan_start_date}`);
    console.log(`  plan_end_date: ${data.plan_end_date}`);
    
    console.log('\n💳 SUBSCRIPTION:');
    console.log(data.subscription);
    
    console.log('\n📝 PLAN ASSIGNMENTS:');
    data.plan_assignments.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.plan_key} (${a.plan_name})`);
      console.log(`     Active: ${a.is_active}`);
      console.log(`     Start: ${a.start_date}`);
      console.log(`     End: ${a.end_date}`);
    });
    
    console.log('\n🔔 RECENT WEBHOOKS:');
    data.recent_webhooks.forEach((w, i) => {
      console.log(`  ${i+1}. ${w.event} at ${w.received_at}`);
    });
    
    console.log('\n📊 FULL DATA:');
    console.log(data);
  });
```

3. **Press Enter**
4. **Review all the details**

---

## 📋 **What to Look For After Test Payment**

### **In Method 1 (Webhook Logs):**
✅ **Good**: You see a recent webhook with your subscription_id and plan_key: "basic_plan"
❌ **Bad**: No recent webhooks, or plan_key is missing/wrong

### **In Method 2 (Recent Activations):**
✅ **Good**: Your user appears with:
- `plan_field: "basic_plan"`
- `has_active_assignment: true`
- `active_assignment_plan: "basic_plan"`

❌ **Bad**: Your user shows:
- `plan_field: "free_trial"`
- `has_active_assignment: false`
- Plan fields don't match

### **In Method 3 (User Details):**
✅ **Good**: 
- `plan: "basic_plan"`
- `plan_name: "Basic Plan"`
- `subscription.status: "active"`
- `plan_assignments` has entry with `is_active: true` and `plan_key: "basic_plan"`

❌ **Bad**:
- `plan: "free_trial"` (didn't change!)
- No active plan assignment
- Subscription exists but plan fields not updated

---

## 🎯 **Complete Testing Workflow**

### **Step 1: Make Test Payment**
1. Go to app.gradnext.co
2. Log in with test account
3. Upgrade to Basic Plan (₹1)
4. Complete payment
5. **Wait 15 seconds**

### **Step 2: Check Webhook Logs**
- Run Method 1 code
- Find your recent webhook
- Note the subscription_id and plan_key

### **Step 3: Check Your User Details**
- Run Method 3 code with your email
- Look at all the fields
- Compare what SHOULD be vs what IS

### **Step 4: Share Results with Me**
Copy and paste the output showing:
- What your `plan` field shows
- What your `plan_assignments` shows
- What webhook logs show

---

## 💡 **Quick Troubleshooting**

### **"Unauthorized" Error**
**Solution**: Make sure you're logged in as admin in the same browser

### **"404 Not Found" Error**
**Solution**: Make sure you deployed the new code with these endpoints

### **Nothing Shows Up**
**Solution**: 
- Check if you're using the correct production URL
- Try refreshing the page and logging in again
- Make sure credentials: 'include' is in the fetch call

---

## 🆘 **What to Share After Testing**

After you run these commands, please share:

1. **Screenshot or copy** of Method 1 output (webhook logs)
2. **Screenshot or copy** of Method 3 output (your user details)
3. **Tell me**: 
   - Does your dashboard still show "Free Trial"?
   - What does `data.plan` show in Method 3?
   - Are there any plan_assignments with is_active: true?

This will tell us EXACTLY where the problem is!

---

## ✅ **Summary**

You now have 3 browser commands to check:
1. **Webhook logs** - Did webhooks arrive?
2. **Recent activations** - Who successfully upgraded?
3. **Your user details** - What's in YOUR user document?

No server access needed - all through your browser! 🎉
