# Debugging Different Plan Behavior

## Observed Behavior
| Plan | Period Changes | Plan Field Changes |
|------|---------------|-------------------|
| Basic | Yes (→ 30 days) | No (stays free_trial) |
| Pro | No | No |
| Pro Plus | No | No |

## Questions to Investigate

### 1. Were the tests done AFTER my code changes?
My changes to PlansModal.jsx should call `/api/subscriptions/activate` after payment.
- If tests were before my changes: Frontend was just waiting for webhook
- If tests were after: The activate endpoint should have been called

### 2. Check Browser Console Logs
After payment, check browser console (F12) for:
```
Activation response: {...}
```
or
```
Activation fallback: {...}
```

This will tell us if the activate endpoint was called and what it returned.

### 3. Check Backend Logs During Payment
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i "activat\|plan_key\|subscription"
```

### 4. Check Each User's Database State
For each test user, check:
```javascript
// In MongoDB
db.users.findOne({email: "test@example.com"}, {
    plan: 1,
    plan_end_date: 1,
    subscription: 1,
    pending_subscription: 1,
    plan_assignments: 1
})
```

## Possible Explanations

### Theory 1: Caching Issue
- Basic plan test might have been cached differently
- Try hard refresh (Ctrl+Shift+R) before testing

### Theory 2: Different Razorpay Flow
- Basic plan might have different Razorpay configuration
- Check Razorpay dashboard for each subscription

### Theory 3: Duplicate Plans in Database
We found duplicate plans with `category: None` and `category: subscription`.
Could be querying the wrong one in some cases.

### Theory 4: Session/Cookie Issue
- Pro/Pro Plus users might have different session state
- Check if authentication is valid for all tests

## Quick Test

To verify my fix is working, try:
1. Clear browser cache
2. Hard refresh the page
3. Log out and log back in
4. Try subscribing to basic_plan again
5. Check browser console for "Activation response"

If "Activation response" shows in console but plan still not updating,
then the backend `/activate` endpoint has an issue.

If "Activation response" doesn't show, then frontend changes aren't deployed.
