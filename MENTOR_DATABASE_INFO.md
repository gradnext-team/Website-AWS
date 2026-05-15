# Mentor Database Information

## Current Status
**The database is currently EMPTY** - no mentors have been seeded yet.

## Seed Data Available

The application has **5 mentors** defined in the seed data (`/app/backend/seed_data.py`):

---

### 1. **Priya Sharma**
- **ID**: `mentor-1`
- **Company**: McKinsey & Company
- **Position**: Senior Consultant
- **Email**: priya.sharma@gradnext.co
- **Experience**: 5 years
- **Rating**: 4.9 ⭐
- **Sessions Conducted**: 150
- **Expertise**: Profitability, Market Entry, Operations
- **Bio**: Former McKinsey consultant with 5+ years of experience in strategy consulting. Helped 50+ candidates crack MBB interviews. Specializes in profitability and market entry cases.
- **Status**: Active ✅

---

### 2. **Rahul Mehta**
- **ID**: `mentor-2`
- **Company**: BCG
- **Position**: Manager
- **Email**: rahul.mehta@gradnext.co
- **Experience**: 7 years
- **Rating**: 4.8 ⭐
- **Sessions Conducted**: 200
- **Expertise**: Growth Strategy, Digital Transformation, M&A
- **Bio**: BCG Manager with expertise in digital transformation and growth strategy. 7 years of consulting experience across multiple industries. Known for structured problem-solving approach.
- **Status**: Active ✅

---

### 3. **Ananya Gupta**
- **ID**: `mentor-3`
- **Company**: Bain & Company
- **Position**: Associate
- **Email**: ananya.gupta@gradnext.co
- **Experience**: 3 years
- **Rating**: 4.9 ⭐
- **Sessions Conducted**: 80
- **Expertise**: PE Due Diligence, Consumer Goods, Pricing
- **Bio**: Bain Associate specializing in private equity due diligence and consumer goods. IIM Ahmedabad alumnus with a knack for making complex cases simple.
- **Status**: Active ✅

---

### 4. **Vikram Singh**
- **ID**: `mentor-4`
- **Company**: McKinsey & Company
- **Position**: Senior Associate
- **Email**: vikram.singh@gradnext.co
- **Experience**: 4 years
- **Rating**: 4.7 ⭐
- **Sessions Conducted**: 120
- **Expertise**: Healthcare, Life Sciences, Fit Interviews
- **Bio**: McKinsey Senior Associate with deep expertise in healthcare and life sciences. Former doctor turned consultant. Expert at fit interviews and personal experience questions.
- **Status**: Active ✅

---

### 5. **Sneha Reddy**
- **ID**: `mentor-5`
- **Company**: BCG
- **Position**: Consultant
- **Email**: sneha.reddy@gradnext.co
- **Experience**: 4 years
- **Rating**: 4.8 ⭐
- **Sessions Conducted**: 100
- **Expertise**: Financial Services, Guesstimates, Market Sizing
- **Bio**: BCG Consultant focused on financial services and fintech. ISB alumnus with prior experience in investment banking. Expert in market sizing and guesstimates.
- **Status**: Active ✅

---

## How to Seed the Database

To load these mentors into the database, you would typically run:

```bash
cd /app/backend
python seed_data.py
```

## Strategy Call Availability

⚠️ **Important Note**: The seed data file shows these mentors are defined, but **none of them have the `can_take_strategy_calls` field set** in the seed data.

For the unified calendar to work with strategy calls, these mentors need:

1. **`can_take_strategy_calls: true`** - Flag to indicate they're eligible for strategy calls
2. **`availability`** array - Day-based availability configuration like:
   ```javascript
   "availability": [
     {
       "day": "Monday",
       "slots": [
         {"time": "09:00"},
         {"time": "10:00"},
         {"time": "14:30"}
       ]
     },
     {
       "day": "Wednesday",
       "slots": [...]
     }
   ]
   ```

The seed data file has a function `generate_mentor_availability()` that creates availability slots, but this appears to use an older structure with a separate `mentor_availability` collection rather than embedding availability in the mentor document itself.

## Current Implementation Gap

The unified calendar implementation in `/app/backend/routes/strategy_calls.py` expects:
- Mentors to have availability embedded in their document as shown above
- The `can_take_strategy_calls` boolean flag
- The `is_active` flag set to true

However, the seed data doesn't include these fields, which means:
1. **The database needs to be seeded first**
2. **The mentors need to be updated with strategy call configuration**
3. **Availability needs to be configured in the new format**

## Summary

You have 5 well-qualified MBB mentors defined in your seed data, but they need to be:
1. ✅ Loaded into the database
2. ⚠️ Updated with `can_take_strategy_calls: true`
3. ⚠️ Configured with day-based availability schedules
4. ⚠️ Optionally connected to Google Calendar for real-time conflict detection

Once these steps are completed, the unified calendar will automatically aggregate their availability and enable the auto-assignment strategy call booking flow! 🚀
