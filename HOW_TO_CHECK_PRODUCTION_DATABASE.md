# How to Check & Fix Production Database

Since you deployed via Emergent and don't have direct database access, I've created **admin API endpoints** that you can call to check and fix your production database.

---

## 🔍 Step 1: Check for Issues (Diagnosis)

### **Endpoint:**
```
GET https://app.gradnext.co/api/admin/plans/diagnostics
```

### **How to Call:**

#### **Option A: Using Browser (Easiest)**
1. Log into your production admin panel
2. Open browser console (F12)
3. Run this code:
```javascript
fetch('https://app.gradnext.co/api/admin/plans/diagnostics', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Diagnosis Results:', data);
    
    if (data.issues_found.length === 0) {
      console.log('✅ No issues found!');
    } else {
      console.log('⚠️ Issues found:', data.issues_found.length);
      data.issues_found.forEach(issue => {
        console.log(`- ${issue.plan}: ${issue.description}`);
      });
    }
  });
```

#### **Option B: Using curl**
```bash
curl -X GET "https://app.gradnext.co/api/admin/plans/diagnostics" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  | json_pp
```

### **What It Checks:**
- ✅ Duplicate plan records
- ✅ Conflicting configurations
- ✅ Missing peer practice access
- ✅ All subscription plans (Basic, Pro, Pro+)

### **Example Response:**
```json
{
  "status": "checked",
  "plans_checked": [
    {
      "plan_key": "basic_plan",
      "total_records": 2,
      "has_duplicates": true,
      "records": [
        {
          "_id": "...",
          "id": "plan-basic",
          "has_id_field": true,
          "peer_to_peer": "1_per_week"
        },
        {
          "_id": "...",
          "id": null,
          "has_id_field": false,
          "peer_to_peer": "none"
        }
      ]
    }
  ],
  "issues_found": [
    {
      "plan": "basic_plan",
      "issue": "duplicate_records",
      "severity": "high",
      "description": "Found 2 records for basic_plan. Should be only 1."
    }
  ],
  "recommendations": [
    {
      "action": "cleanup_required",
      "description": "⚠️ Issues found. Use /admin/plans/cleanup endpoint to fix."
    }
  ]
}
```

---

## 🔧 Step 2: Fix Issues (Cleanup)

### **Step 2A: Dry Run (Safe - No Changes Made)**

Test what would be fixed WITHOUT making changes:

```javascript
fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=true', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Dry Run Results:', data);
    
    data.actions_taken.forEach(action => {
      console.log(`\n${action.plan_key}:`);
      console.log(`  Duplicates to remove: ${action.duplicates_removed}`);
      console.log(`  Records to update: ${action.records_updated}`);
      action.details.forEach(detail => console.log(`  - ${detail}`));
    });
  });
```

### **Step 2B: Apply Fixes (Makes Changes)**

After reviewing dry run, apply the fixes:

```javascript
fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=false', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Cleanup Results:', data);
    
    if (data.message.includes('✅')) {
      console.log('✅ Database fixed successfully!');
    }
    
    data.actions_taken.forEach(action => {
      console.log(`\n${action.plan_key}:`);
      console.log(`  Duplicates removed: ${action.duplicates_removed}`);
      console.log(`  Records updated: ${action.records_updated}`);
    });
  });
```

---

## 🎯 Complete Workflow

### **From Your Browser Console:**

```javascript
// Step 1: Diagnose
console.log('🔍 Step 1: Checking for issues...');
await fetch('https://app.gradnext.co/api/admin/plans/diagnostics', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Issues found:', data.issues_found.length);
    if (data.issues_found.length > 0) {
      console.log('⚠️ Issues:', data.issues_found);
    } else {
      console.log('✅ No issues!');
    }
  });

// Step 2: Dry Run
console.log('\n🧪 Step 2: Testing cleanup (dry run)...');
await fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=true', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Dry run results:', data);
  });

// Step 3: Apply Fix (uncomment when ready)
// console.log('\n🔧 Step 3: Applying fixes...');
// await fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=false', {
//   method: 'POST',
//   credentials: 'include'
// })
//   .then(r => r.json())
//   .then(data => {
//     console.log('✅ Fixed:', data);
//   });

// Step 4: Verify
console.log('\n✅ Step 4: Verifying fix...');
await fetch('https://app.gradnext.co/api/admin/plans/diagnostics', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Final check:', data.issues_found.length === 0 ? '✅ All good!' : '⚠️ Still has issues');
  });
```

---

## 📋 What the Cleanup Does

1. **Removes Duplicates:**
   - Keeps: Records with `id` field (admin-managed)
   - Deletes: Records without `id` field (legacy duplicates)

2. **Updates Configuration:**
   - Basic Plan: Sets peer_to_peer = "1_per_week", sessions = 4
   - Pro Plan: Sets peer_to_peer = "1_per_week", sessions = 4
   - Pro+ Plan: Sets peer_to_peer = "unlimited", sessions = -1

3. **Safe:**
   - Always run dry_run=true first to preview changes
   - Only admin users can access these endpoints
   - Backs up what it's changing in the response

---

## ✅ After Cleanup

### **Test New User Flow:**

1. Create a new test account
2. Upgrade to Basic Plan
3. Complete payment
4. Go to Peer Practice page
5. Should see: "4 of 4 credits remaining"
6. Should NOT see: "As a mentor..." error

---

## 🆘 Troubleshooting

### **Issue: "Unauthorized" error**
**Solution:** Make sure you're logged in as admin in the browser where you're running the commands.

### **Issue: "CORS error"**
**Solution:** Run the commands in the same browser tab where you're logged into the admin panel.

### **Issue: Still seeing errors after cleanup**
**Solution:** 
1. Run diagnostics again to check what's remaining
2. Clear browser cache
3. Log out and log back in
4. Test with a brand new user account

---

## 📞 Quick Commands Cheat Sheet

```javascript
// Check issues
fetch('https://app.gradnext.co/api/admin/plans/diagnostics', {credentials:'include'}).then(r=>r.json()).then(console.log)

// Dry run fix
fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=true', {method:'POST',credentials:'include'}).then(r=>r.json()).then(console.log)

// Apply fix
fetch('https://app.gradnext.co/api/admin/plans/cleanup?dry_run=false', {method:'POST',credentials:'include'}).then(r=>r.json()).then(console.log)
```

---

## ✅ Summary

Since you don't have direct database access, these endpoints let you:
- ✅ Check for duplicate plan records
- ✅ Preview what would be fixed (dry run)
- ✅ Apply fixes automatically
- ✅ Verify everything is working

All through simple browser console commands while logged into your admin panel!
