# 🔄 Free Trial → Basic Plan Upgrade: Complete Guide

## Overview

When someone upgrades from **Free Trial** to **Basic Plan**, they move from limited trial access to a full subscription with unlocked premium content.

---

## 📊 BEFORE vs AFTER Comparison

### **FREE TRIAL (Before Upgrade)**

| Feature | Access Level | Details |
|---------|--------------|---------|
| **Duration** | 7 days | From account creation |
| **Videos** | 2 free videos only | "Introduction to Case Interviews" + "Structuring Your Approach" |
| **Drills** | First 3 of each type | Case Math (3), Case Structuring (3), etc. - Marked as free trial content |
| **Workshops** | 1 free workshop | "Profitability Case Masterclass" (recorded) |
| **Case Materials** | All 10 materials ✅ | Casebooks, templates, primers - Always free |
| **Peer Practice** | 1 session/month | Limited quota |
| **Coaching** | ❌ No access | Cannot book coaching sessions |
| **Item-Level Locking** | After expiry: Yes | Pages browsable, content locked |

### **BASIC PLAN (After Upgrade)**

| Feature | Access Level | Details |
|---------|--------------|---------|
| **Duration** | 3 months (90 days) | Renewable subscription |
| **Videos** | All unlocked ✅ | Full access to video course library |
| **Drills** | All unlocked ✅ | Unlimited access to all drill types |
| **Workshops** | All unlocked ✅ | Access to all workshops (recorded & live) |
| **Case Materials** | All 10 materials ✅ | Still free, always accessible |
| **Peer Practice** | 4 sessions/month | Increased from 1 to 4 sessions |
| **Coaching** | ❌ No access | Still no coaching (upgrade to coaching plans) |
| **Item-Level Locking** | No | Full access to all content |

---

## 🔐 Access Changes: What Gets Unlocked

### **Videos** 📹
**Before (Free Trial):**
- ✅ 2 intro videos only
- 🔒 All other videos locked

**After (Basic Plan):**
- ✅ ALL videos unlocked
- ✅ Full course library access
- ✅ Can watch any video anytime

### **Drills** 🎯
**Before (Free Trial):**
- ✅ First 3 drills per type (Case Math 1-3, Case Structuring 1-3)
- 🔒 All other drills locked

**After (Basic Plan):**
- ✅ ALL drills unlocked
- ✅ Unlimited practice attempts
- ✅ Full AI drill access
- ✅ Progress tracking enabled

### **Workshops** 🎓
**Before (Free Trial):**
- ✅ 1 free workshop (Profitability Case)
- 🔒 All other workshops locked

**After (Basic Plan):**
- ✅ ALL workshops unlocked
- ✅ Access to recorded workshops
- ✅ Can join live workshops (when available)

### **Peer Practice** 🤝
**Before (Free Trial):**
- 1 session per month
- Can browse peers but limited booking

**After (Basic Plan):**
- 4 sessions per month (4x increase!)
- Book sessions with any available peer
- Full scheduling access

### **Coaching** 💼
**Before (Free Trial):**
- ❌ Cannot book coaching sessions
- Can browse mentors but booking blocked

**After (Basic Plan):**
- ❌ Still no coaching access
- Need to upgrade to Coaching Plans (Last Mile, Mid Mile, etc.)
- Can purchase single sessions separately

---

## ⚡ TWO UPGRADE METHODS

### **Method 1: Manual Upgrade (Admin Action)**

**How it happens:**
1. Admin goes to Admin Dashboard → Users
2. Selects the user
3. Changes plan from "free_trial" to "basic_plan"
4. Clicks "Update User"

**What happens in the database:**
```json
{
  "plan": "basic_plan",
  "plan_start_date": "2025-01-27T10:00:00Z",  // NOW
  "plan_end_date": "2025-04-27T10:00:00Z",    // +90 days
  "subscription_end_date": "2025-04-27T10:00:00Z",
  "features": {
    "courses": true,
    "drills": true,
    "workshops": true,
    "peer_sessions_per_month": 4,
    "coaching_sessions": 0
  },
  "coaching_sessions_total": 0,
  "coaching_sessions_used": 0,
  "updated_at": "2025-01-27T10:00:00Z"
}
```

**Key characteristics:**
- ✅ Immediate activation
- ✅ Plan duration: 90 days from upgrade moment
- ⚠️ **NO proration** - Admin can set any end date
- ⚠️ **NO payment** - Free upgrade (goodwill/testing)
- ⚠️ **NO credit when upgrading again** - Manual upgrades don't get proration credits

**Admin can customize:**
- Plan end date (can make it longer or shorter)
- Coaching sessions (can manually add if desired)
- Any other user field

---

### **Method 2: Automatic Upgrade (User Purchase)**

**How it happens:**
1. User clicks "Upgrade" or "Buy Basic Plan"
2. Selects billing cycle (monthly or 6-month)
3. Pays via Razorpay (₹499/month or ₹2,394/6 months)
4. Payment confirmed
5. System automatically upgrades user

**What happens in the database:**
```json
{
  "plan": "basic_plan",
  "plan_start_date": "2025-01-27T10:00:00Z",
  "plan_end_date": "2025-02-27T10:00:00Z",    // +30 days (monthly)
  "subscription_end_date": "2025-02-27T10:00:00Z",
  "billing_cycle": "monthly",
  "billing_anchor_date": "27",  // Subscription renews on 27th
  "features": {
    "courses": true,
    "drills": true,
    "workshops": true,
    "peer_sessions_per_month": 4,
    "coaching_sessions": 0
  },
  "coaching_sessions_total": 0,
  "coaching_sessions_used": 0,
  "last_payment_id": "pay_abc123",
  "razorpay_subscription_id": "sub_xyz789",
  "updated_at": "2025-01-27T10:00:00Z"
}
```

**Key characteristics:**
- ✅ Immediate activation upon payment confirmation
- ✅ Plan duration: Based on billing cycle (30 days monthly, 180 days 6-month)
- ✅ **Automatic renewal** - Razorpay charges automatically
- ✅ **Proration available** - If upgrading to higher tier later
- ✅ **Payment record** - Transaction ID stored
- ✅ **Subscription tracking** - Razorpay subscription ID linked

**Billing cycles:**
- **Monthly**: ₹499/month, renews every 30 days
- **6-Month**: ₹2,394/6 months (saves 20%), renews every 180 days

---

## 🔄 Access Transition Timeline

### **Automatic Upgrade Timeline:**

```
┌─────────────────────────────────────────────────────┐
│ MOMENT OF PAYMENT                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. User completes payment (Razorpay)               │
│ 2. Payment webhook received (< 2 seconds)          │
│ 3. Database updated with new plan                  │
│ 4. User session refreshed                          │
│ 5. User redirected to dashboard                    │
│                                                     │
│ ✅ TOTAL TIME: 2-5 seconds                         │
│ ✅ ACCESS GRANTED: Immediate                        │
└─────────────────────────────────────────────────────┘
```

**User experience:**
1. **Before payment**: Sees locked content with "Upgrade to access" messages
2. **During payment**: Razorpay payment modal
3. **After payment**: Instant redirect to dashboard
4. **Access**: All content immediately unlocked
5. **Next page load**: Full Basic Plan features active

### **Manual Upgrade Timeline:**

```
┌─────────────────────────────────────────────────────┐
│ MOMENT ADMIN CLICKS "UPDATE"                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. Admin updates user plan                         │
│ 2. Database immediately updated                    │
│ 3. User's next request gets new permissions        │
│                                                     │
│ ✅ TOTAL TIME: Instant                             │
│ ✅ ACCESS GRANTED: Next page load                   │
└─────────────────────────────────────────────────────┘
```

**User experience:**
1. **Before update**: Limited trial access
2. **During update**: No notification (admin action)
3. **After update**: User refreshes or navigates
4. **Access**: All content unlocked on next interaction
5. **Email**: User receives upgrade confirmation email

---

## 📧 Notifications

### **Automatic Upgrade:**
User receives email:
```
Subject: Welcome to Basic Plan!

You've successfully upgraded to Basic Plan.

Access unlocked:
✅ All video lessons
✅ All case drills
✅ All workshops
✅ 4 peer practice sessions per month

Your plan expires: April 27, 2025
Next billing: February 27, 2025 (₹499)

[View My Dashboard]
```

### **Manual Upgrade:**
User receives email:
```
Subject: Your Plan Has Been Updated

Your gradnext plan has been upgraded to Basic Plan.

Access unlocked:
✅ All video lessons
✅ All case drills
✅ All workshops
✅ 4 peer practice sessions per month

Your plan expires: April 27, 2025

[View My Dashboard]
```

---

## 🎛️ Feature Availability Matrix

| Feature | Free Trial (Active) | Free Trial (Expired) | Basic Plan | Details |
|---------|--------------------|--------------------|-----------|---------|
| **Pages Browsable** | ✅ Yes | ✅ Yes | ✅ Yes | Can see all pages |
| **Videos (All)** | 🔒 2 only | 🔒 Locked | ✅ Unlocked | Full library access |
| **Drills (All)** | 🔒 3 per type | 🔒 Locked | ✅ Unlocked | All drill types |
| **Workshops (All)** | 🔒 1 only | 🔒 Locked | ✅ Unlocked | Recorded + Live |
| **Case Materials** | ✅ All 10 | ✅ All 10 | ✅ All 10 | Always free |
| **Peer Practice** | ✅ 1/month | 🔒 0/month | ✅ 4/month | Quota increased |
| **Coaching** | 🔒 No | 🔒 No | 🔒 No | Need coaching plan |
| **Item Locking** | Partial | Yes | No | Content accessibility |

---

## 💡 Key Differences: Manual vs Automatic

| Aspect | Manual Upgrade | Automatic Upgrade |
|--------|---------------|-------------------|
| **Payment** | ❌ No charge | ✅ User pays |
| **Duration** | Admin decides | Based on billing cycle |
| **Proration** | ❌ No future credit | ✅ Gets credit on next upgrade |
| **Renewal** | ❌ One-time | ✅ Auto-renews |
| **Razorpay Link** | ❌ No subscription ID | ✅ Subscription tracked |
| **Cancellation** | Admin removes | User can cancel anytime |
| **Transaction Record** | ❌ No payment log | ✅ Full payment history |
| **Email Receipt** | Upgrade notification | Payment receipt + upgrade |

---

## 🔍 Database Comparison

### **Manual Upgrade Record:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "plan": "basic_plan",
  "plan_start_date": "2025-01-27T10:00:00Z",
  "plan_end_date": "2025-04-27T10:00:00Z",
  "features": {
    "courses": true,
    "drills": true,
    "peer_sessions_per_month": 4
  },
  "last_payment_id": null,  // ❌ No payment
  "razorpay_subscription_id": null,  // ❌ No subscription
  "billing_cycle": null,  // ❌ No cycle
  "updated_by": "admin@gradnext.co"  // ✅ Admin tracking
}
```

### **Automatic Upgrade Record:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "plan": "basic_plan",
  "plan_start_date": "2025-01-27T10:00:00Z",
  "plan_end_date": "2025-02-27T10:00:00Z",
  "features": {
    "courses": true,
    "drills": true,
    "peer_sessions_per_month": 4
  },
  "last_payment_id": "pay_abc123",  // ✅ Payment tracked
  "razorpay_subscription_id": "sub_xyz789",  // ✅ Subscription active
  "billing_cycle": "monthly",  // ✅ Cycle set
  "billing_anchor_date": "27",  // ✅ Renewal date
  "updated_at": "2025-01-27T10:00:00Z"
}
```

---

## ⚠️ Important Notes

### **Manual Upgrades - Admin Must Know:**
1. **No auto-renewal**: Plan expires on end date, doesn't auto-renew
2. **No proration credit**: If user later buys a plan, they don't get credit for manual upgrade time
3. **No payment tracking**: Won't appear in user's payment history
4. **Goodwill gesture**: Treated as free/promotional access
5. **Admin responsibility**: Must manually extend if needed

### **Automatic Upgrades - User Must Know:**
1. **Auto-renewal**: Credit card charged automatically on renewal date
2. **Cancellation**: User can cancel anytime, access continues until period end
3. **Proration**: If upgrading to higher tier, gets credit for unused days
4. **Payment history**: All transactions visible in dashboard
5. **Subscription management**: User controls their own subscription

---

## ✅ Summary

### **What Gets Unlocked Going Free Trial → Basic:**
- ✅ **ALL Videos** (from 2 to 50+ videos)
- ✅ **ALL Drills** (from 3 per type to unlimited)
- ✅ **ALL Workshops** (from 1 to all workshops)
- ✅ **Peer Practice** (from 1 to 4 sessions/month)
- ✅ **Full Access** (no item-level locking)

### **What Stays the Same:**
- ✅ Case materials (always free)
- ❌ Coaching access (still requires coaching plan)

### **Manual vs Automatic:**
- **Manual**: Free, one-time, no payment, admin-controlled
- **Automatic**: Paid, auto-renewing, user-controlled, proration eligible

**Duration:**
- **Manual**: 90 days (or custom)
- **Automatic**: 30 days (monthly) or 180 days (6-month)

---

**The upgrade is immediate in both cases - users get instant access to all Basic Plan features! 🚀**
