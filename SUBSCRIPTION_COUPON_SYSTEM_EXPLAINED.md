# How Coupon Codes Work for Subscriptions - Complete Guide

## Overview

The coupon system for subscriptions is designed to offer **discounts on the first payment only**, with full-price renewals. This is because Razorpay subscriptions don't natively support first-payment discounts, so we use a clever workaround.

---

## Key Concept: Two-Payment Model

**When coupon is applied:**
1. **First Payment**: One-time discounted order (with coupon)
2. **Future Renewals**: Regular subscription at full price (no coupon)

**When no coupon:**
1. **All Payments**: Regular Razorpay subscription from start

---

## Step-by-Step Flow

### **Step 1: User Enters Coupon Code**

**Frontend:**
User enters coupon code during checkout (e.g., "SAVE20")

**Backend Validation:**
```python
# POST /api/subscriptions/create

# Look up coupon in database
coupon = await db.discounts.find_one({
    "code": "SAVE20",  # Uppercase
    "active": True
})
```

---

### **Step 2: Coupon Validation**

**Checks Performed:**

#### **2.1 Coupon Exists and Active**
```python
if not coupon or not coupon.get("active"):
    # Reject: Coupon not found or inactive
```

#### **2.2 Applicable to Subscriptions**
```python
applicable_order_types = coupon.get("applicable_order_types", [])
if "subscription" not in applicable_order_types:
    # Reject: Coupon only for one-time purchases
```

#### **2.3 Applicable to Selected Plan**
```python
applicable_plans = coupon.get("applicable_plans", [])
if applicable_plans and user_plan not in applicable_plans:
    # Reject: Coupon only for specific plans (e.g., Premium only)
```

#### **2.4 Usage Limit Not Exceeded**
```python
current_usage = coupon.get("current_usage", 0)
max_usage = coupon.get("max_usage")  # e.g., 100 uses total

if max_usage and current_usage >= max_usage:
    # Reject: Coupon fully redeemed
```

---

### **Step 3: Discount Calculation**

**Two Discount Types:**

#### **Type A: Percentage Discount**
```python
discount_type = "percentage"
discount_value = 20  # 20% off

# Example: Plan costs ₹590 (₹500 + GST)
coupon_discount = round(590 * (20 / 100))  # = ₹118
first_payment = 590 - 118  # = ₹472
```

#### **Type B: Fixed Amount Discount**
```python
discount_type = "fixed_amount"
discount_value = 100  # ₹100 off

# Example: Plan costs ₹590
coupon_discount = min(100, 590)  # Don't exceed total
first_payment = 590 - 100  # = ₹490
```

**Stored in Database:**
```javascript
coupon_details = {
  code: "SAVE20",
  discount_id: "discount-123",
  discount_type: "percentage",
  discount_value: 20,
  discount_amount: 118,  // Actual rupees off
  original_amount: 590,
  discounted_amount: 472
}
```

---

### **Step 4: Payment Structure (WITH COUPON)**

**Problem:** Razorpay subscriptions don't support discounted first payments.

**Solution:** Split into two parts:

#### **Part 1: One-Time Order (Discounted)**
```python
# Create Razorpay ORDER (not subscription)
razorpay_order = client.order.create({
    "amount": 472 * 100,  # ₹472 in paise
    "currency": "INR",
    "notes": {
        "type": "subscription_first_payment_discounted",
        "coupon_code": "SAVE20",
        "coupon_discount": 118,
        "original_amount": 590
    }
})
```

**User pays:** ₹472 (discounted amount)  
**Type:** One-time order, NOT a subscription yet

#### **Part 2: Pending Subscription Info**
```python
# Store in user.pending_subscription
pending_subscription = {
    "razorpay_order_id": "order_xyz",
    "razorpay_plan_id": "plan_123",
    "status": "pending_first_payment",
    "plan_key": "basic_plan",
    "billing_cycle": "monthly",
    "locked_price": 590,  # Full price for renewals
    "first_payment_discounted": True,
    "first_payment_coupon": {
        "code": "SAVE20",
        "discount_amount": 118
    },
    "first_payment_amount": 472,
    "auto_renew": True
}
```

---

### **Step 5: User Completes Payment**

**Razorpay Webhook:** `payment.captured`

**What Happens:**
1. Payment successful for one-time order
2. Backend receives webhook
3. Activates the subscription

---

### **Step 6: Subscription Activation (After Payment)**

**Endpoint:** `POST /api/subscriptions/payment-webhook` (internal)  
**Or:** `POST /api/subscriptions/activate-pending` (fallback)

**Activation Process:**

#### **6.1 Calculate First Period**
```python
now = datetime.now(timezone.utc)
if billing_cycle == "monthly":
    period_end = now + 1 month  # e.g., March 15
else:
    period_end = now + 6 months  # e.g., August 15
```

#### **6.2 Create Renewal Subscription**
```python
# Create Razorpay subscription for FUTURE renewals
# Starts AFTER first period ends
razorpay_subscription = client.subscription.create({
    "plan_id": "plan_123",
    "total_count": 199,  # One less since first payment done
    "start_at": period_end.timestamp(),  # Start on March 15
    "notes": {
        "first_payment_discounted": True,
        "coupon_code": "SAVE20"
    }
})
```

**Key Points:**
- `start_at` = Period end date (e.g., March 15)
- First period already paid (₹472)
- Renewal subscription starts AFTER first period
- Renewal amount = Full price (₹590)

#### **6.3 Activate User Subscription**
```python
subscription_data = {
    "razorpay_subscription_id": "sub_abc",  # For renewals
    "status": "active",
    "plan_key": "basic_plan",
    "billing_cycle": "monthly",
    "current_period_start": "2026-02-15",
    "current_period_end": "2026-03-15",
    "locked_price": 590,  # Full price
    "first_payment_discounted": True,
    "first_payment_coupon": {...},
    "first_payment_amount": 472,
    "auto_renew": True
}

await db.users.update_one(
    {"id": user_id},
    {"$set": {
        "subscription": subscription_data,
        "is_subscribed": True,
        "plan": "basic_plan"
    }}
)
```

#### **6.4 Increment Coupon Usage**
```python
await db.discounts.update_one(
    {"id": coupon.discount_id},
    {"$inc": {"current_usage": 1}}
)

# If current_usage was 45, now becomes 46
```

#### **6.5 Record Usage in History**
```python
await db.discount_usage.insert_one({
    "discount_id": coupon.discount_id,
    "user_id": user_id,
    "order_id": "order_xyz",
    "discount_amount": 118,
    "applied_at": now.isoformat()
})
```

---

### **Step 7: Future Renewals**

**On March 15 (Period End):**

Razorpay automatically charges the user:
- **Amount:** ₹590 (full price, NO coupon)
- **Subscription ID:** `sub_abc`
- **No discount applied**

**User's subscription extends:**
- New period: March 15 - April 15
- Same price: ₹590
- Continues monthly/6-monthly

---

## Payment Structure (WITHOUT COUPON)

**Simpler Flow:**

```python
# Create regular Razorpay subscription immediately
razorpay_subscription = client.subscription.create({
    "plan_id": "plan_123",
    "total_count": 200,
    "notes": {...}
})

# User pays full price from first payment
# All renewals at same price
```

---

## Database Schema

### **Discounts Collection:**
```javascript
{
  _id: ObjectId("..."),
  id: "discount-123",
  code: "SAVE20",
  active: true,
  discount_type: "percentage",  // or "fixed_amount"
  subscription_discount_value: 20,  // 20% or ₹20
  applicable_order_types: ["subscription"],
  applicable_plans: ["basic_plan", "pro_plan"],  // or [] for all
  max_usage: 100,  // null = unlimited
  current_usage: 46,
  created_at: "2026-01-01T00:00:00Z",
  expires_at: "2026-12-31T23:59:59Z"
}
```

### **User Pending Subscription:**
```javascript
user.pending_subscription = {
  razorpay_order_id: "order_xyz",
  razorpay_plan_id: "plan_123",
  status: "pending_first_payment",
  plan_key: "basic_plan",
  billing_cycle: "monthly",
  locked_price: 590,
  first_payment_discounted: true,
  first_payment_coupon: {
    code: "SAVE20",
    discount_id: "discount-123",
    discount_amount: 118
  },
  first_payment_amount: 472
}
```

### **User Active Subscription:**
```javascript
user.subscription = {
  razorpay_subscription_id: "sub_abc",
  razorpay_plan_id: "plan_123",
  status: "active",
  plan_key: "basic_plan",
  billing_cycle: "monthly",
  current_period_start: "2026-02-15T00:00:00Z",
  current_period_end: "2026-03-15T00:00:00Z",
  locked_price: 590,
  first_payment_discounted: true,
  first_payment_coupon: {...},
  first_payment_amount: 472,
  auto_renew: true,
  activated_at: "2026-02-15T12:30:00Z"
}
```

### **Discount Usage Intent (Pending):**
```javascript
{
  _id: ObjectId("..."),
  discount_id: "discount-123",
  user_id: "user-456",
  order_id: "order_xyz",
  discount_amount: 118,
  status: "pending",  // Changes to "completed" after payment
  created_at: "2026-02-15T12:00:00Z"
}
```

### **Discount Usage (Completed):**
```javascript
{
  _id: ObjectId("..."),
  discount_id: "discount-123",
  user_id: "user-456",
  order_id: "order_xyz",
  discount_amount: 118,
  applied_at: "2026-02-15T12:30:00Z"
}
```

---

## Example Scenarios

### **Scenario 1: 20% Off Monthly Plan**

**Plan:** Basic (₹500/month + 18% GST = ₹590/month)  
**Coupon:** SAVE20 (20% off)

**Breakdown:**
```
Original Price: ₹590
Discount (20%): -₹118
First Payment: ₹472

Timeline:
- Feb 15: User pays ₹472 (discounted)
- Mar 15: Auto-renew charges ₹590 (full price)
- Apr 15: Auto-renew charges ₹590 (full price)
- ... continues monthly at ₹590
```

---

### **Scenario 2: ₹500 Off 6-Month Plan**

**Plan:** Pro (₹599/month × 6 = ₹3,594 + GST = ₹4,241)  
**Coupon:** FIRST500 (₹500 fixed discount)

**Breakdown:**
```
Original Price: ₹4,241
Discount: -₹500
First Payment: ₹3,741

Timeline:
- Feb 15: User pays ₹3,741 (discounted)
- Aug 15: Auto-renew charges ₹4,241 (full price)
- Feb 15 (next year): Auto-renew charges ₹4,241
- ... continues 6-monthly at ₹4,241
```

---

### **Scenario 3: Plan-Specific Coupon**

**Coupon:** PREMIUM50 (50% off, Premium plan only)

**What Happens:**
```
User selects Basic Plan + enters PREMIUM50:
❌ Error: "Coupon not applicable to this plan"

User selects Premium Plan + enters PREMIUM50:
✅ Success: 50% discount applied
```

---

### **Scenario 4: Usage Limit Reached**

**Coupon:** LAUNCH100 (max 100 uses, current usage: 100)

**What Happens:**
```
User enters LAUNCH100:
❌ Error: "Coupon usage limit exceeded"
Coupon still active, but all 100 uses consumed
```

---

## API Endpoints Summary

### **Create Subscription with Coupon:**
```
POST /api/subscriptions/create
{
  "plan_key": "basic_plan",
  "billing_cycle": "monthly",
  "coupon_code": "SAVE20"  // Optional
}

Response (with coupon):
{
  "success": true,
  "payment_type": "order",  // One-time order
  "order_id": "order_xyz",
  "amount": 472,
  "original_amount": 590,
  "coupon_applied": true,
  "coupon_code": "SAVE20",
  "coupon_discount": 118,
  "renewal_amount": 590,
  "message": "First payment discounted. Subscription will start after payment."
}

Response (no coupon):
{
  "success": true,
  "payment_type": "subscription",  // Regular subscription
  "subscription_id": "sub_abc",
  "amount": 590,
  ...
}
```

### **Activate After Payment:**
```
POST /api/subscriptions/activate-pending
{
  "payment_id": "pay_xyz",
  "order_id": "order_xyz"
}

Response:
{
  "success": true,
  "subscription_activated": true,
  "plan_end_date": "2026-03-15T00:00:00Z",
  "renewal_subscription_id": "sub_abc"
}
```

---

## Admin Management

### **Creating Coupons:**

**Admin Panel → Discounts → Add New**

**Fields:**
- **Code:** SAVE20 (unique, uppercase)
- **Type:** Percentage or Fixed Amount
- **Value:** 20 (%) or 100 (₹)
- **Applicable To:** Subscriptions, One-time, or Both
- **Applicable Plans:** All or specific plans
- **Max Usage:** 100 uses or unlimited
- **Active:** Yes/No
- **Expires At:** Optional expiry date

### **Viewing Coupon Usage:**

**Admin Panel → Discounts → View Usage**

Shows:
- Total uses: 46/100
- List of users who used it
- Discount amounts
- Dates applied

---

## Key Features

✅ **First Payment Only:** Discount applies once  
✅ **Flexible Discount:** Percentage or fixed amount  
✅ **Plan-Specific:** Can limit to certain plans  
✅ **Usage Limits:** Prevent abuse  
✅ **Usage Tracking:** Full audit trail  
✅ **Auto-Renewal:** Full price renewals automatic  
✅ **Expiry Dates:** Time-limited campaigns  

---

## Technical Challenges Solved

### **Challenge 1: Razorpay Limitation**
**Problem:** Razorpay subscriptions don't support first-payment discounts  
**Solution:** Split into one-time order (discounted) + subscription (renewals)

### **Challenge 2: Renewal Timing**
**Problem:** How to ensure subscription starts after first period?  
**Solution:** Use `start_at` timestamp = period end date

### **Challenge 3: Usage Tracking**
**Problem:** Prevent double-redemption  
**Solution:** Usage intent (pending) → Usage record (completed)

---

## Summary

**Coupon Flow:**
1. User enters code → Validated
2. Discount calculated
3. One-time order created (discounted)
4. User pays discounted amount
5. Subscription activated immediately
6. Renewal subscription created (starts after first period)
7. Future renewals at full price

**Key Points:**
- Discount = First payment only
- Renewals = Full price
- Two-part payment structure
- Usage tracking + limits
- Plan-specific + flexible

---

**Last Updated:** February 26, 2026  
**Status:** Fully functional and documented
