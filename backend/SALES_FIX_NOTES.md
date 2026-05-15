# Sales Revenue Fix - Double-Counting Resolution

## Problem Identified
The Sales Dashboard was showing **INFLATED revenue figures** due to DOUBLE-COUNTING of transactions.

### Root Cause
The `/api/admin/sales/summary` endpoint was merging data from TWO collections:
1. `payment_orders` collection (status: "paid", "completed")
2. `payments` collection (status: "captured")

**WITHOUT deduplication**, causing the same transaction to be counted TWICE if it existed in both collections.

### Example of Double-Counting
```
payment_orders: order_123 = ₹1000
payments:       order_123 = ₹1000
----------------------------------
Total counted:            = ₹2000  ❌ WRONG (should be ₹1000)
```

## Solution Implemented

### Deduplication Logic Added
Before merging the two collections, the code now:

1. **Builds a dedup key set** from `payment_orders`:
   - By `order_id` / `razorpay_order_id`
   - By `id` (payment ID)
   - By `user_id` + `plan_key` combination

2. **Filters captured_payments** to exclude duplicates:
   - Checks each payment against all three key types
   - Only adds payments that don't match any existing key

3. **Merges deduplicated data**:
   - Combines `payment_orders` + `deduplicated_payments`
   - Calculates accurate totals without double-counting

### Code Changes
**File**: `/app/backend/routes/sales_admin.py`
**Lines**: ~143-165 (in `get_sales_summary` function)

## Testing
✅ Deduplication logic tested with mock data
✅ Correctly identifies duplicates by:
  - Order ID
  - Payment ID
  - User + Plan combination
✅ Reduces duplicate count from 3 → 1 in test case
✅ Accurate revenue calculation: ₹3500 (not ₹6500)

## Impact
- **Total Revenue**: Now shows ONLY paid transactions (no double-counting)
- **Today's Revenue**: Accurate count of today's payments
- **This Month**: Correct monthly revenue
- **Transaction Count**: Reflects unique transactions only

## What Was NOT Changed
✅ Status filtering remains strict: ONLY "paid", "completed", "captured" statuses
✅ No forecasting or future projections
✅ No pending/created/failed transactions included
✅ Transaction table already had deduplication (unchanged)

## Verification Steps
1. Deploy the fix to production
2. Refresh the Sales Dashboard
3. Verify revenue numbers match the transaction table totals
4. Check that transaction count matches the number of rows in the table

## Expected Result After Fix
If you had:
- 104 unique transactions
- But revenue was showing 2x the actual amount

After fix:
- 104 transactions (unchanged)
- Revenue = sum of ONLY those 104 unique transactions
- No more double-counting from both collections
