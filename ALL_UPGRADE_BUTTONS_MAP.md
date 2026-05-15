# 📍 All "Upgrade to Access" & "View Plans" Buttons - Complete Map

## Overview
This document lists ALL locations where "Upgrade to Access", "View Plans", and similar upgrade buttons appear in the frontend for Free Trial, Subscription, and Coaching users.

---

## 🎯 Button Locations by Page

### **1. Dashboard Layout (Sidebar/Left Bar)**

**File:** `/app/frontend/src/components/dashboard/DashboardLayout.jsx`

#### **Location 1.1: Top Trial/Expiry Banner**
**When shown:** Free trial or when plan expires
**Button text:** "View Plans"
**Lines:** 666-669
```jsx
<Button 
  className="mt-3 w-full bg-blue-600 hover:bg-blue-700"
  data-testid="view-plans-btn"
>
  View Plans
</Button>
```

**Triggers for:**
- ✅ Free trial users (active or expired)
- ✅ Subscription expired users
- ✅ Coaching program expired users

**Message shown:**
- "Upgrade to continue accessing premium content"

---

#### **Location 1.2: Left Sidebar Warning (when expired)**
**When shown:** Plan expired
**Button text:** "View Plans"
**Lines:** 410-419
```jsx
<p className="text-xs text-red-600 mt-1">
  Upgrade to continue accessing premium content
</p>
<Button 
  size="sm"
  className="mt-2 w-full bg-red-600 hover:bg-red-700"
  onClick={() => window.location.href = '/pricing'}
>
  <AlertCircle className="w-3 h-3 mr-2" />
  View Plans
</Button>
```

**Triggers for:**
- ✅ Trial expired
- ✅ Subscription expired
- ✅ Coaching program expired

---

### **2. Dashboard Home Page**

**File:** `/app/frontend/src/pages/Dashboard.jsx`

#### **Location 2.1: Dashboard Welcome Card**
**When shown:** For users who don't have Pro/Pro+ plan
**Button text:** "Upgrade to Pro"
**Lines:** 46-50
```jsx
<Button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
  Upgrade to Pro
</Button>
```

**Triggers for:**
- ✅ Free trial users
- ✅ Basic plan users
- ✅ Expired plan users

---

### **3. Subscription Management Component**

**File:** `/app/frontend/src/components/ui/SubscriptionManagement.jsx`

#### **Location 3.1: Free Trial Card**
**When shown:** User on free trial
**Button text:** "View Plans"
**Lines:** 1006-1012
```jsx
<Button 
  className="mt-4"
  onClick={() => setShowPlansDialog(true)}
>
  <Crown className="w-4 h-4 mr-2" />
  View Plans
</Button>
```

**Message:** "Upgrade to unlock all features, courses, and coaching sessions."

---

#### **Location 3.2: Expired Subscription Card**
**When shown:** Subscription expired
**Button text:** "Upgrade Plan"
**Lines:** 1197-1200
```jsx
<Button 
  onClick={() => setShowPlansDialog(true)}
>
  <ArrowUpRight className="w-4 h-4 mr-2" />
  Upgrade Plan
</Button>
```

---

#### **Location 3.3: Active Subscription - Change Plan**
**When shown:** Active subscription (Basic/Pro/Pro+)
**Button text:** "Change Plan"
**Lines:** Various
```jsx
<Button onClick={() => setShowPlansDialog(true)}>
  Change Plan
</Button>
```

---

### **4. Drills Page**

**File:** `/app/frontend/src/components/dashboard/DrillsPage.jsx`

#### **Location 4.1: Locked Drill Cards**
**When shown:** Drill is locked (for free trial or expired users)
**Button text:** "Upgrade to access"
**Lines:** 408-411
```jsx
<Button
  size="sm"
  variant="outline"
  className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
  onClick={() => window.location.href = '/pricing'}
>
  <Lock className="w-3 h-3 mr-1.5" />
  Upgrade to access
</Button>
```

**Triggers for:**
- ✅ Free trial users (drills beyond first 3 of each type)
- ✅ Expired subscription users (all drills except free ones)
- ✅ Users without subscription access

**Number of locked drills:**
- Free trial: All drills after first 3 per type
- Expired: All drills except marked as free

---

### **5. Videos/Courses Page**

**File:** `/app/frontend/src/components/dashboard/VideosPage.jsx`

#### **Location 5.1: Locked Video Cards**
**When shown:** Video is locked
**Button text:** "Upgrade to watch" (appears on locked video overlay)
**Lines:** 145-180 (approximately)
```jsx
{video.locked && (
  <div className="mt-3 pt-3 border-t border-slate-100">
    <Button
      size="sm"
      className="w-full"
      onClick={() => window.location.href = '/pricing'}
    >
      <Lock className="w-4 h-4 mr-2" />
      Upgrade to watch
    </Button>
  </div>
)}
```

**Triggers for:**
- ✅ Free trial users (videos beyond first 2)
- ✅ Expired subscription users (all videos except 2 free ones)
- ✅ Users without subscription access

**Locked videos:**
- Free trial: 2 intro videos unlocked, rest locked
- Expired: Only 2 free videos accessible

---

### **6. Workshops Page**

**File:** `/app/frontend/src/components/dashboard/WorkshopsPage.jsx`

#### **Location 6.1: No Access Banner**
**When shown:** User doesn't have workshop access
**Button text:** "Upgrade Plan"
**Lines:** 85-89
```jsx
{!isAdminRestricted && (
  <Button onClick={() => window.location.href = '/pricing'} className="mt-4">
    Upgrade Plan
  </Button>
)}
```

**Triggers for:**
- ✅ Free trial users (expired)
- ✅ Users without active subscription
- ✅ Expired subscription users

---

### **7. Coaching Page**

**File:** `/app/frontend/src/components/dashboard/CoachingPage.jsx`

#### **Location 7.1: No Coaching Access Banner**
**When shown:** User doesn't have coaching sessions
**Button text:** "View Plans"
**Lines:** 1052-1056
```jsx
<Link to="/#pricing-section">
  <Button className="bg-white text-blue-600 hover:bg-blue-50">
    View Plans <ArrowRight className="w-4 h-4 ml-2" />
  </Button>
</Link>
```

**Banner message:**
- "Your plan doesn't include coaching sessions"
- "Purchase single sessions or upgrade to a coaching plan"

**Triggers for:**
- ✅ Free trial users
- ✅ Basic/Pro/Pro+ subscription users (no coaching)
- ✅ Expired coaching plan users with 0 sessions
- ✅ Users with 0 coaching sessions

---

#### **Location 7.2: No Sessions Remaining Modal**
**When shown:** User tries to book with 0 sessions
**Button text:** "View Coaching Programs"
**Lines:** New implementation (from recent changes)
```jsx
<Button 
  variant="outline" 
  className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
  onClick={() => {
    setPurchaseModalOpen(false);
    setCoachingPlansModalOpen(true);
  }}
>
  <ArrowRight className="w-4 h-4 mr-2" />
  View Coaching Programs
</Button>
```

**Triggers for:**
- ✅ Users with 0 coaching sessions trying to book
- ✅ Works for all plan types (free, subscription, expired coaching)

---

### **8. Peer Practice Page**

**File:** `/app/frontend/src/components/dashboard/PeerPracticePage.jsx`

#### **Location 8.1: No Access Banner**
**When shown:** User doesn't have peer practice access
**Button text:** "Upgrade Plan"
**Lines:** 1346-1362
```jsx
<p className="font-medium text-amber-900">Upgrade to Book Peer Sessions</p>
<p className="text-sm text-amber-700">
  Your current plan doesn't include peer practice. 
  Upgrade to start practicing with other candidates.
</p>
<Button 
  onClick={() => window.location.href = '/pricing'}
  data-testid="upgrade-for-peers-btn"
>
  Upgrade Plan
</Button>
```

**Triggers for:**
- ✅ Free trial users (expired)
- ✅ Users without subscription
- ✅ Expired subscription users
- ✅ Mentors (they don't get peer practice)

---

#### **Location 8.2: Peer Card - Book Button (when no access)**
**When shown:** User clicks on peer card but has no sessions
**Button text:** "Upgrade to Book" or "Plan Expired"
**Lines:** 1633-1636
```jsx
<Button 
  variant="outline"
  onClick={() => window.location.href = '/pricing'}
>
  <Calendar className="w-4 h-4 mr-2" /> 
  {isPlanExpiredForPeerPractice ? 'Plan Expired' : 'Upgrade to Book'}
</Button>
```

**Triggers for:**
- ✅ Users with 0 peer practice sessions
- ✅ Expired plan users

---

## 📊 Summary by User Type

### **Free Trial User (Active)**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Dashboard** | Welcome card | "Upgrade to Pro" | → Pricing page |
| **Sidebar** | Top banner | "View Plans" | → Pricing page |
| **Drills** | Locked drill cards | "Upgrade to access" | → Pricing page |
| **Videos** | Locked video cards | "Upgrade to watch" | → Pricing page |
| **Coaching** | No access banner | "View Plans" | → Pricing section |
| **Peer Practice** | List view warning | "Upgrade Plan" | → Pricing page |
| **Profile** | Subscription section | "View Plans" | → Plans modal |

---

### **Free Trial User (Expired)**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Sidebar** | Top banner (red) | "View Plans" | → Pricing page |
| **Sidebar** | Left warning | "View Plans" | → Pricing page |
| **Dashboard** | Welcome card | "Upgrade to Pro" | → Pricing page |
| **Drills** | All locked drills | "Upgrade to access" | → Pricing page |
| **Videos** | All locked videos | "Upgrade to watch" | → Pricing page |
| **Workshops** | No access banner | "Upgrade Plan" | → Pricing page |
| **Coaching** | No access banner | "View Plans" | → Pricing section |
| **Peer Practice** | No access banner | "Upgrade Plan" | → Pricing page |
| **Profile** | Expired card | "Upgrade Plan" | → Plans modal |

---

### **Subscription User (Basic/Pro/Pro+) - Active**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Dashboard** | Welcome card (if not Pro+) | "Upgrade to Pro" | → Pricing page |
| **Coaching** | No access banner | "View Plans" | → Pricing section |
| **Coaching** | 0 sessions modal | "View Coaching Programs" | → Coaching plans modal |
| **Profile** | Subscription card | "Change Plan" | → Plans modal |

---

### **Subscription User (Expired)**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Sidebar** | Top banner (red) | "View Plans" | → Pricing page |
| **Sidebar** | Left warning | "View Plans" | → Pricing page |
| **Dashboard** | Welcome card | "Upgrade to Pro" | → Pricing page |
| **Drills** | All locked drills | "Upgrade to access" | → Pricing page |
| **Videos** | All locked videos | "Upgrade to watch" | → Pricing page |
| **Workshops** | No access banner | "Upgrade Plan" | → Pricing page |
| **Coaching** | No access banner | "View Plans" | → Pricing section |
| **Peer Practice** | No access banner | "Upgrade Plan" | → Pricing page |
| **Peer Practice** | Peer cards | "Plan Expired" | → Pricing page |
| **Profile** | Expired card | "Upgrade Plan" | → Plans modal |

---

### **Coaching Plan User - Active (with sessions)**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Profile** | Subscription card | "View Plans" | → Plans modal |

---

### **Coaching Plan User - Active (0 sessions remaining)**

| Page | Button Location | Button Text | Action |
|------|----------------|-------------|--------|
| **Coaching** | Try to book session | "View Coaching Programs" | → Coaching plans modal |
| **Coaching** | No sessions modal | "Top Up Sessions" | → Top up modal |
| **Profile** | Subscription card | "View Plans" | → Plans modal |

---

### **Coaching Plan User (Expired)**

Same as **Subscription User (Expired)** above.

---

## 🎯 Quick Reference: Where Each Button Goes

| Button Text | Destination | Purpose |
|------------|-------------|---------|
| **"View Plans"** | `/pricing` OR Plans modal | Show all subscription plans |
| **"Upgrade to Pro"** | `/pricing` | Direct to pricing page |
| **"Upgrade Plan"** | `/pricing` OR Plans modal | Upgrade current plan |
| **"Upgrade to access"** | `/pricing` | Unlock locked drill |
| **"Upgrade to watch"** | `/pricing` | Unlock locked video |
| **"Upgrade to Book"** | `/pricing` | Get peer practice access |
| **"Plan Expired"** | `/pricing` | Renew expired plan |
| **"Change Plan"** | Plans modal | Change current subscription |
| **"View Coaching Programs"** | Coaching plans modal | Show coaching programs |
| **"Top Up Sessions"** | Top up modal | Add single coaching sessions |

---

## 📱 Modal Flows

### **Plans Modal Flow:**
```
User clicks "View Plans" or "Change Plan"
         ↓
SubscriptionManagement.jsx modal opens
         ↓
Shows Basic, Pro, Pro+ plans with monthly/6-month toggle
         ↓
User selects plan → Shows proration summary (if upgrading)
         ↓
User confirms → Razorpay payment (if amount > 0)
         ↓
Plan activated
```

### **Coaching Programs Modal Flow:**
```
User clicks "View Coaching Programs"
         ↓
CoachingPlansModal opens (in CoachingPage.jsx)
         ↓
Shows Last Mile, Mid Mile, Full Prep cards
         ↓
User clicks "Select Plan" → Redirects to /#pricing-section
```

### **Top Up Modal Flow:**
```
User clicks "Top Up Sessions"
         ↓
TopUpModal opens with slider (1-30 sessions)
         ↓
Shows volume discounts and GST breakdown
         ↓
User confirms → Razorpay payment
         ↓
Sessions added to account
```

---

## 🔍 Testing Guide

### **To Test All Buttons:**

1. **As Free Trial User:**
   - Login with free trial account
   - Visit each page and verify upgrade buttons appear
   - Check that locked content shows "Upgrade to access"

2. **As Expired Free Trial:**
   - Wait for trial to expire or set end date in past
   - Verify sidebar shows red "View Plans" button
   - Check all content is locked with upgrade buttons

3. **As Basic Subscription User:**
   - Login with Basic plan
   - Verify "Upgrade to Pro" appears on dashboard
   - Check coaching page shows "View Plans"

4. **As Expired Subscription User:**
   - Set subscription end date in past
   - Verify all upgrade buttons appear
   - Check "Plan Expired" button on peer practice

5. **As Coaching User (0 sessions):**
   - Login with coaching plan, 0 sessions remaining
   - Try to book coaching session
   - Verify "View Coaching Programs" modal appears

---

## ✅ Total Count

**Total unique button locations:** 15+ across 8 different pages/components

**Button types:**
- "View Plans" - 6 locations
- "Upgrade Plan" - 4 locations
- "Upgrade to access" - 1 location (drills)
- "Upgrade to watch" - 1 location (videos)
- "Upgrade to Pro" - 1 location (dashboard)
- "Upgrade to Book" - 1 location (peer practice)
- "Change Plan" - 1 location (profile)
- "View Coaching Programs" - 1 location (coaching modal)

All buttons are context-aware and show based on user's plan status, expiry, and access level.
