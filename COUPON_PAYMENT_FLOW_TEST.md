# Strategy Call Coupon + Payment Flow - Complete Test Guide

## Overview
This document verifies that ALL endpoints for the coupon application and payment flow are present and properly configured.

## ✅ Endpoints Verified

### 1. Coupon Validation
- **Endpoint**: `POST /api/discounts/validate`
- **File**: `/app/backend/routes/discounts.py` (line 584)
- **Router**: Included at `/api` (line 654 in server.py)
- **Purpose**: Validates coupon code before purchase
- **Request Body**:
  ```json
  {
    "code": "TESTAPOORV",
    "order_amount": 499,
    "order_type": "coaching",
    "plan_key": "addon_strategy_call"
  }
  ```
- **Response**: Returns discount details if valid

### 2. Purchase Addon (Create Razorpay Order)
- **Endpoint**: `POST /api/strategy-calls/purchase-addon`
- **File**: `/app/backend/routes/strategy_calls.py` (line 1806)
- **Router**: Included at `/api/strategy-calls` (line 641 in server.py)
- **Purpose**: Creates Razorpay order with coupon discount applied
- **Request Body**:
  ```json
  {
    "quantity": 1,
    "coupon_code": "TESTAPOORV"
  }
  ```
- **Response**: Returns Razorpay order details
- **Dependencies**:
  - ✅ Razorpay credentials in .env
  - ✅ Discount validation (uses order_type: 'coaching')
  - ✅ Razorpay package installed (v2.0.0)

### 3. Confirm Purchase (After Payment)
- **Endpoint**: `POST /api/strategy-calls/confirm-addon-purchase`
- **File**: `/app/backend/routes/strategy_calls.py` (line 1964)
- **Router**: Included at `/api/strategy-calls` (line 641 in server.py)
- **Purpose**: Verifies payment and adds credits to user
- **Request Body**: Empty (uses user session and pending_strategy_addon)
- **Actions**:
  - Verifies payment with Razorpay
  - Updates user's strategy_calls_total
  - Records payment in database
  - Records discount usage if coupon was applied
  - Clears pending_strategy_addon

## ✅ Configuration Verified

### Backend Environment Variables
```bash
RAZORPAY_KEY_ID=rzp_live_S75Pm55LYocWaN
RAZORPAY_KEY_SECRET=Eg5WhV8yBC3y2gDPJtOxfEPn
MONGO_URL=mongodb://localhost:27017
DB_NAME=gradnext
```

### Frontend Environment Variables
```bash
REACT_APP_BACKEND_URL=https://consultant-gateway.preview.emergentagent.com
```

### Dependencies
- ✅ `razorpay==2.0.0` in requirements.txt
- ✅ axios in frontend for API calls
- ✅ MongoDB driver (motor) for database

## ✅ Flow Logic Verified

### Step-by-Step Flow

1. **User enters coupon code and clicks "Apply"**
   - Frontend: `DashboardOverview.jsx` line 1299 (`handleApplyCoupon`)
   - Calls: `POST /api/discounts/validate`
   - Validates with `order_type: 'coaching'` ✅
   - Shows discount amount if valid

2. **User clicks "Purchase X Session"**
   - Frontend: `DashboardOverview.jsx` line 1357 (`handlePurchaseAddon`)
   - Calls: `POST /api/strategy-calls/purchase-addon`
   - Backend validates coupon again with `order_type: 'coaching'` ✅
   - Creates Razorpay order with discounted amount
   - Stores pending purchase in user document

3. **Razorpay modal opens, user completes payment**
   - Razorpay handles payment UI
   - On success, calls handler function

4. **Frontend confirms purchase**
   - Calls: `POST /api/strategy-calls/confirm-addon-purchase`
   - Backend verifies payment with Razorpay
   - Adds credits to user's account
   - Records payment and discount usage
   - Clears pending purchase

## ✅ Error Handling

### Potential Issues and Solutions

1. **"Method Not Allowed" (405/500)**
   - **Cause**: Endpoint doesn't exist in production
   - **Solution**: Deploy updated code to production

2. **"Payment gateway not configured" (500)**
   - **Cause**: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set
   - **Solution**: Ensure .env has correct keys (without quotes)

3. **"This discount doesn't apply to addon" (400)**
   - **Cause**: Coupon created with wrong applies_to value
   - **Solution**: Create coupon with "Applies To: Coaching" ✅ FIXED

4. **"Invalid discount code" (400)**
   - **Cause**: Coupon doesn't exist or is inactive
   - **Solution**: Verify coupon exists in database and is active

5. **"No pending addon purchase found" (400)**
   - **Cause**: User clicked confirm before purchase was initiated
   - **Solution**: Normal flow - should not occur in practice

## ✅ Database Operations

### Collections Used
1. **discounts** - Stores coupon codes
2. **discount_usage** - Records when coupons are used
3. **payments** - Records successful payments
4. **users** - Updates strategy_calls_total and pending_strategy_addon

### Data Flow
```
1. Coupon Validation
   └─> Read from: discounts
   └─> Check: discount_usage (for usage limits)

2. Purchase Initiation
   └─> Read from: plans (for pricing)
   └─> Write to: users (pending_strategy_addon)
   └─> Create: Razorpay order (external)

3. Purchase Confirmation
   └─> Read from: users (pending_strategy_addon)
   └─> Verify: Razorpay order (external)
   └─> Write to: users (strategy_calls_total, clear pending)
   └─> Write to: payments (payment record)
   └─> Write to: discount_usage (if coupon used)
   └─> Update: discounts (increment current_total_uses)
```

## ✅ Code Changes Summary

### Frontend Changes
- **File**: `DashboardOverview.jsx` line 1314
- **Change**: `order_type: 'coaching'` (was 'addon')
- **Impact**: Coupon validation now matches backend expectation

### Backend Changes
1. **File**: `strategy_calls.py` line 1865
   - **Change**: Validate discount with `order_type: 'coaching'`
   
2. **File**: `strategy_calls.py` line 2073
   - **Change**: Record discount usage with `order_type: 'coaching'`

3. **File**: `backend/.env`
   - **Change**: Removed quotes from RAZORPAY credentials
   - **Before**: `RAZORPAY_KEY_ID="rzp_live_..."`
   - **After**: `RAZORPAY_KEY_ID=rzp_live_...`

## ✅ Testing Checklist

### Before Deployment
- [x] All endpoints exist
- [x] All routers included in server.py
- [x] Environment variables configured
- [x] Dependencies installed
- [x] order_type fixed to 'coaching'
- [x] Razorpay credentials format fixed

### After Deployment
- [ ] Create test coupon with "Applies To: Coaching"
- [ ] Login as test user
- [ ] Navigate to Dashboard
- [ ] Click "Book Strategy Call" or "Purchase Session"
- [ ] Enter coupon code
- [ ] Click "Apply" - should show discount
- [ ] Click "Purchase" - should open Razorpay modal
- [ ] Complete test payment
- [ ] Verify credits added to account
- [ ] Verify payment recorded in admin panel

## 🎯 Conclusion

All required endpoints, configurations, and logic are present and correct. The code is ready for deployment. The only remaining step is to deploy to production and test the complete flow.

**Status**: ✅ READY FOR PRODUCTION DEPLOYMENT
