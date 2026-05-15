# Strategy Call Coupon Configuration Guide

## How to Create a Discount for Strategy Calls

When creating a discount code for "Strategy Call" purchases in the Admin Panel, follow these steps:

### Step 1: Navigate to Discounts
1. Go to `/admin` in your application
2. Click on "Discounts" in the sidebar

### Step 2: Create New Discount
Click "Create Discount" button

### Step 3: Configure the Discount
Fill in the following fields:

- **Discount Name**: (e.g., "Test 1", "Strategy Call Promo")
- **Discount Type**: Select **"Coupon Code"**
- **Coupon Code**: Enter the code (e.g., "TESTAPOORV", "SAVE50")
- **Discount Value Type**: Choose "Percentage (%)" or "Fixed Amount (₹)"
- **Coaching Discount (%)**: Enter the discount value (e.g., 99 for 99%)
  
**IMPORTANT:**
- ✅ **Applies To**: CHECK **"Coaching"**  
  (Strategy calls are categorized under coaching services)
- **Applicable Plans**: Leave empty for all plans, or select specific ones
- **Total Usage Limit**: Leave empty for unlimited, or set a number
- **Per User Limit**: Leave empty for unlimited, or set a number  
- **Start Date**: Set start date
- **End Date**: Set end date
- **Minimum Order Value**: (Optional) Set minimum order amount

### Step 4: Save
Click "Create Discount" to save

## Why "Coaching"?
Strategy calls are 1:1 sessions with mentors, which fall under the "coaching" category in the system. When users apply a coupon for strategy call purchases, the system validates that the discount `applies_to` includes "coaching".

## Testing
After creating the discount:
1. Go to the candidate dashboard
2. Click "Book Strategy Call" or "Purchase Session"
3. Enter the coupon code
4. Click "Apply"
5. You should see the discount applied correctly

## Common Issues

### ❌ Error: "This discount doesn't apply to addon"
**Cause**: The discount was created with "Applies To: Subscription" instead of "Coaching"  
**Fix**: Edit the discount and change "Applies To" to include "Coaching"

### ❌ Error: "Invalid discount code"
**Cause**: 
- Coupon code doesn't exist
- Coupon is not active
- Discount has expired
**Fix**: Verify the discount exists, is active, and dates are valid
