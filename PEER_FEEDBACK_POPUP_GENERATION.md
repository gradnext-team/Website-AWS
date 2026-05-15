# How Peer Feedback Popup is Generated in Candidate Dashboard

## Overview

The peer feedback popup is a **dynamic, multi-step modal** that adapts its content based on the session type selected by the user. It's built using React state management and conditional rendering.

**Location:** `/app/frontend/src/components/dashboard/PeerPracticePage.jsx`

---

## Step-by-Step Generation Process

### **Step 1: Trigger - User Clicks "Give Feedback" Button**

**Location:** Lines 2425 (Upcoming Sessions) and 2537 (Past Sessions)

```jsx
<Button onClick={() => openFeedbackModal(session)}>
  <MessageSquare className="w-4 h-4 mr-1" />
  Give Feedback
</Button>
```

**When shown:**
- Past sessions (30 mins after session start)
- Feedback not yet submitted
- Session status is 'confirmed'

---

### **Step 2: Modal Opens with Default State**

**Function:** `openFeedbackModal()` (Lines 759-773)

```javascript
const openFeedbackModal = (session) => {
  setFeedbackSession(session);  // Store which session
  
  // Initialize feedback form with default values
  setPeerFeedback({
    case_type: '',
    rating_scoping_questions: 3,
    rating_case_structure: 3,
    rating_quantitative: 3,
    quantitative_tested: true,
    rating_communication: 3,
    rating_business_acumen: 3,
    rating_overall: 3,
    qualitative_feedback: ''
  });
  
  setFeedbackModalOpen(true);  // Show modal
};
```

**State Variables:**
- `feedbackModalOpen` - Controls modal visibility
- `feedbackSession` - Stores the session being reviewed
- `peerFeedback` - Stores all form data

---

### **Step 3: Modal Renders with Dynamic Content**

**Location:** Lines 2922-3160

```jsx
<Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Session Feedback for Partner</DialogTitle>
    </DialogHeader>
    {/* Dynamic form fields based on session type */}
  </DialogContent>
</Dialog>
```

---

## Dynamic Form Generation

### **Section 1: Session Information (Static)**

**Lines 2929-2940**

Shows basic session details:
```jsx
<div className="bg-slate-50 p-3 rounded-lg">
  <p>Feedback for <strong>{partner_name}</strong></p>
  <p>{session.date} at {session.time_slot}</p>
</div>
```

---

### **Section 2: Session Type Selection (Required)**

**Lines 2942-2967**

Dropdown with 5 session types:
```javascript
const sessionTypeOptions = [
  'Case session',
  'PEI session',
  'CV review session',
  'FIT session',
  'General discussion'
];
```

**Why important:** This selection determines what rating fields and areas appear next.

---

### **Section 3: Case Type Selection (Conditional)**

**Lines 2969-2993**

**Only appears when:** `session_type === 'Case session'`

Dropdown with case types:
- Profitability
- Market Entry
- Guesstimate
- Pricing
- Growth
- M&A
- Unconventional

---

### **Section 4: Dynamic Performance Ratings (Core)**

**Lines 2995-3038**

**This is where the magic happens!**

The ratings shown dynamically change based on session type:

```javascript
{getPeerRatingConfig(peerFeedback.session_type).map((ratingItem) => (
  <div key={ratingItem.key}>
    <label>{ratingItem.label} *</label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button 
          className={/* Dynamic styling based on rating */}
          onClick={/* Update rating state */}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
))}
```

---

## Dynamic Rating Configurations

### **Function: `getPeerRatingConfig(sessionType)`** (Lines 61-108)

Returns different rating criteria based on session type:

#### **Case Session:**
```javascript
[
  { key: 'rating_problem_understanding', label: 'Problem Understanding & Initial Scoping' },
  { key: 'rating_framework_structure', label: 'Framework and Structure' },
  { key: 'rating_case_math', label: 'Case Math' },
  { key: 'rating_business_judgment', label: 'Business Judgment and Insights' },
  { key: 'rating_communication_synthesis', label: 'Communication and Synthesis' },
  { key: 'rating_overall', label: 'Overall', isOverall: true }
]
```

#### **PEI Session:**
```javascript
[
  { key: 'rating_leadership_story', label: 'Leadership Story' },
  { key: 'rating_connection_growth', label: 'Connection Growth' },
  { key: 'rating_drive_story', label: 'Drive Story' },
  { key: 'rating_growth_story', label: 'Growth Story' },
  { key: 'rating_overall', label: 'Overall', isOverall: true }
]
```

#### **CV Review Session:**
```javascript
[
  { key: 'rating_cv_layout', label: 'Overall CV Layout and Formatting' },
  { key: 'rating_experience_clarity', label: 'Clarity of Experience Descriptions' },
  { key: 'rating_quantification', label: 'Quantification of Achievements' },
  { key: 'rating_relevance_prioritization', label: 'Relevance and Prioritization' },
  { key: 'rating_language_grammar', label: 'Language and Grammar' },
  { key: 'rating_overall', label: 'Overall', isOverall: true }
]
```

#### **FIT Session:**
```javascript
[
  { key: 'rating_self_introduction', label: 'Self-Introduction and Presence' },
  { key: 'rating_leadership_examples', label: 'Leadership Examples' },
  { key: 'rating_teamwork', label: 'Teamwork and Collaboration' },
  { key: 'rating_motivation_drive', label: 'Motivation and Drive' },
  { key: 'rating_cultural_fit', label: 'Cultural Fit Alignment' },
  { key: 'rating_overall', label: 'Overall', isOverall: true }
]
```

#### **General Discussion:**
```javascript
[
  { key: 'rating_overall', label: 'Overall', isOverall: true }
]
```

---

### **Section 5: Areas of Strength & Improvement (Conditional)**

**Lines 3040-3127**

**Only appears when:** Session type has areas configured

**Function: `getPeerAreasConfig(sessionType)`** (Lines 110-158)

Returns different area options based on session type:

#### **Case Session Areas:**
```javascript
{
  hasAreas: true,
  options: [
    'Problem understanding & initial scoping',
    'Framework and structure',
    'Case math',
    'Hypothesis-driven approach',
    'Business judgment and insights',
    'Communication and synthesis'
  ]
}
```

#### **PEI Session Areas:**
```javascript
{
  hasAreas: true,
  options: [
    'Story structure (STAR format)',
    'Articulating personal impact',
    'Quantifying achievements',
    'Self-awareness and learnings',
    'Authenticity and delivery'
  ]
}
```

#### **General Discussion:**
```javascript
{
  hasAreas: false,  // No areas shown!
  options: []
}
```

**UI Behavior:**
- Multi-select buttons (pills)
- Green for "Areas of Strength"
- Amber for "Areas of Improvement"
- Cannot select same area in both categories (mutual exclusion)
- Minimum 1 required in each category

---

### **Section 6: Qualitative Feedback (Optional)**

**Lines 3129-3141**

```jsx
<Textarea
  placeholder="Any additional feedback, areas of improvement, or suggested next steps..."
  rows={4}
/>
```

Free-text field for detailed comments.

---

## Validation & Submission

### **Validation Logic** (Lines 775-813)

```javascript
const handleSubmitFeedback = async () => {
  // 1. Check session type selected
  if (!peerFeedback.session_type) {
    alert('Please select a session type');
    return;
  }
  
  // 2. Check case type (if Case session)
  if (isCaseSession && !peerFeedback.case_type) {
    alert('Please select a case type');
    return;
  }
  
  // 3. Check overall rating
  if (!peerFeedback.rating_overall) {
    alert('Please provide an overall rating');
    return;
  }
  
  // 4. Check all required ratings filled
  const missingRatings = ratingConfig.filter(r => !r.isOverall && !peerFeedback.ratings[r.key]);
  if (missingRatings.length > 0) {
    alert(`Please rate: ${missingRatings.map(r => r.label).join(', ')}`);
    return;
  }
  
  // 5. Check areas (if required for session type)
  if (areasConfig.hasAreas) {
    if (peerFeedback.areas_of_strength.length === 0) {
      alert('Please select at least one area of strength');
      return;
    }
    if (peerFeedback.areas_of_improvement.length === 0) {
      alert('Please select at least one area of improvement');
      return;
    }
  }
  
  // All validations passed - submit!
};
```

---

### **Backend Submission** (Line 830)

```javascript
const feedbackPayload = {
  session_id: feedbackSession.id,
  session_type: peerFeedback.session_type,
  case_type: isCaseSession ? peerFeedback.case_type : null,
  rating_overall: peerFeedback.rating_overall,
  areas_of_strength: areasConfig.hasAreas ? peerFeedback.areas_of_strength : [],
  areas_of_improvement: areasConfig.hasAreas ? peerFeedback.areas_of_improvement : [],
  qualitative_feedback: peerFeedback.qualitative_feedback,
  ...peerFeedback.ratings  // Flatten all dynamic ratings
};

await axios.post(`${BACKEND_URL}/api/peers/feedback`, feedbackPayload, { 
  withCredentials: true 
});
```

**Backend Endpoint:** `POST /api/peers/feedback`

**What happens:**
1. Feedback saved to database
2. Session status changes to "completed"
3. Partner's rating updated
4. Modal closes
5. Sessions list refreshes

---

## Visual Flow Example

### **User Selects "Case Session":**

```
1. [Session Type Dropdown] → Selects "Case session"
   ↓
2. [Case Type Dropdown] → Appears! Selects "Profitability"
   ↓
3. [Performance Ratings] → Shows 5 Case-specific ratings:
   - Problem Understanding (1-5 stars)
   - Framework & Structure (1-5 stars)
   - Case Math (1-5 stars)
   - Business Judgment (1-5 stars)
   - Communication & Synthesis (1-5 stars)
   - Overall Rating (1-5 stars)
   ↓
4. [Areas of Strength] → Shows 6 Case-specific areas (multi-select pills)
   ↓
5. [Areas of Improvement] → Shows same 6 areas (mutual exclusion)
   ↓
6. [Qualitative Feedback] → Optional text area
   ↓
7. [Submit Feedback] → Validates & sends to backend
```

### **User Selects "General Discussion":**

```
1. [Session Type Dropdown] → Selects "General discussion"
   ↓
2. [Case Type] → Hidden (not needed)
   ↓
3. [Performance Ratings] → Shows ONLY:
   - Overall Rating (1-5 stars)
   ↓
4. [Areas] → Hidden (not needed for General discussion)
   ↓
5. [Qualitative Feedback] → Optional text area
   ↓
6. [Submit Feedback] → Validates & sends to backend
```

---

## Styling Details

### **Rating Buttons:**
- 5 square buttons (1-5)
- Unselected: Light gray border, gray text
- Selected (specific rating): Amber fill, white text
- Selected (overall rating): Navy blue (#2E3558) fill, white text
- Hover: Light amber border

### **Area Pills:**
- Rounded-full badges
- Strength (selected): Green fill, white text
- Improvement (selected): Amber fill, white text
- Unselected: Gray border, gray text
- Disabled: Faded gray (when selected in opposite category)
- Hover: Colored border

### **Modal:**
- Max width: 2xl (42rem)
- Max height: 90vh (scrollable if content exceeds)
- Responsive: 2-column grid for ratings on desktop
- Mobile: Single column layout

---

## Key Technical Features

### **1. Conditional Rendering**
```javascript
{peerFeedback.session_type && (
  // Only show ratings if session type selected
)}

{peerFeedback.session_type === 'Case session' && (
  // Only show case type for Case sessions
)}

{getPeerAreasConfig(peerFeedback.session_type).hasAreas && (
  // Only show areas if session type requires them
)}
```

### **2. Dynamic State Management**
```javascript
const [peerFeedback, setPeerFeedback] = useState({
  session_type: '',
  case_type: '',
  ratings: {},  // Dynamic object for all ratings
  rating_overall: 0,
  areas_of_strength: [],
  areas_of_improvement: [],
  qualitative_feedback: ''
});
```

### **3. Configuration-Driven UI**
Two configuration functions drive the entire form:
- `getPeerRatingConfig(sessionType)` - What ratings to show
- `getPeerAreasConfig(sessionType)` - What areas to show

**Benefit:** Easy to add new session types without changing UI code!

---

## Summary

### **How Popup is Generated:**

1. **Trigger:** User clicks "Give Feedback" button
2. **Initialize:** Modal state set with session data
3. **Render:** Modal opens with header and session info
4. **Step 1:** User selects session type from dropdown
5. **Dynamic:** Form fields appear based on configuration
   - Ratings specific to session type
   - Areas specific to session type (if applicable)
6. **Validate:** All required fields checked on submit
7. **Submit:** Data sent to backend API
8. **Result:** Modal closes, status updated, list refreshes

### **Key Innovation:**
The popup is **not hardcoded** - it dynamically generates its content based on:
- Session type selected
- Configuration functions that define ratings and areas
- Conditional rendering for optional sections

This makes it flexible, maintainable, and easy to extend with new session types!

---

**Last Updated:** February 26, 2026  
**Status:** Current implementation documented
