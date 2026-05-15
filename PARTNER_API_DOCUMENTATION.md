# GradNext Partner API Documentation

## Overview

The Partner API allows authorized partner institutes to access mentor availability and create bookings on behalf of their candidates. This enables seamless integration with your existing booking systems.

---

## Authentication

All API requests must include your API key in the request header.

### Header Format
```
X-Partner-API-Key: pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Example (cURL)
```bash
curl -H "X-Partner-API-Key: pk_live_your_api_key_here" \
  https://app.gradnext.co/api/partner/mentors
```

### Example (JavaScript/Fetch)
```javascript
const response = await fetch('https://app.gradnext.co/api/partner/mentors', {
  headers: {
    'X-Partner-API-Key': 'pk_live_your_api_key_here'
  }
});
```

### Example (Python/Requests)
```python
import requests

headers = {
    'X-Partner-API-Key': 'pk_live_your_api_key_here'
}

response = requests.get(
    'https://app.gradnext.co/api/partner/mentors',
    headers=headers
)
```

---

## Base URL

**Production:**
```
https://app.gradnext.co/api/partner
```

**Note:** Make sure to use the production URL when integrating with your systems.

---

## Endpoints

### 1. Health Check

Check if the API is operational.

**Request**
```
GET /api/partner/health
```

**Response**
```json
{
  "status": "healthy",
  "api": "Partner API",
  "version": "1.0.0"
}
```

---

### 2. List Mentors

Get all mentors assigned to your partner account.

**Request**
```
GET /api/partner/mentors
```

**Response**
```json
{
  "mentors": [
    {
      "id": "mentor-123",
      "name": "John Smith",
      "title": "Senior Consultant",
      "company": "McKinsey",
      "consulting_firm": "McKinsey",
      "picture": "/api/images/img_abc123",
      "bio": "10 years of consulting experience...",
      "expertise": ["Strategy", "Case Interviews"],
      "specialization": "McKinsey",
      "years_experience": 10,
      "rating": 4.8,
      "sessions_conducted": 150
    }
  ],
  "count": 1
}
```

---

### 3. Get Mentor Details

Get detailed information about a specific mentor.

**Request**
```
GET /api/partner/mentors/{mentor_id}
```

**Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| mentor_id | string | The unique mentor ID |

**Response**
```json
{
  "id": "mentor-123",
  "name": "John Smith",
  "title": "Senior Consultant",
  "company": "McKinsey",
  "consulting_firm": "McKinsey",
  "picture": "/api/images/img_abc123",
  "bio": "10 years of consulting experience...",
  "expertise": ["Strategy", "Case Interviews"],
  "specialization": "McKinsey",
  "years_experience": 10,
  "rating": 4.8,
  "sessions_conducted": 150,
  "headline": "Ex-McKinsey | IIM Ahmedabad"
}
```

---

### 4. Get Mentor Availability

Get real-time available time slots for a mentor within a date range.

**Request**
```
GET /api/partner/mentors/{mentor_id}/availability?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

**Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mentor_id | string | Yes | The unique mentor ID |
| start_date | string | Yes | Start of date range (YYYY-MM-DD) |
| end_date | string | Yes | End of date range (YYYY-MM-DD) |

**Notes**
- Maximum date range: 30 days
- Availability is returned in IST (Indian Standard Time)
- Slots are in 30-minute intervals
- Already booked slots, blocked days, and Google Calendar conflicts are automatically excluded

**Example Request**
```
GET /api/partner/mentors/mentor-123/availability?start_date=2026-03-15&end_date=2026-03-21
```

**Response**
```json
{
  "mentor_id": "mentor-123",
  "start_date": "2026-03-15",
  "end_date": "2026-03-21",
  "availability": [
    {
      "date": "2026-03-16",
      "day": "Monday",
      "slots": ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00"],
      "booked_slots": ["11:00", "11:30"]
    },
    {
      "date": "2026-03-17",
      "day": "Tuesday",
      "slots": ["10:00", "10:30", "11:00", "11:30", "15:00", "15:30"],
      "booked_slots": []
    }
  ]
}
```

---

### 5. Create Booking

Book a session with a mentor for a candidate.

**Request**
```
POST /api/partner/bookings
Content-Type: application/json
```

**Request Body**
```json
{
  "mentor_id": "mentor-123",
  "date": "2026-03-16",
  "time_slot": "10:00",
  "candidate_name": "Jane Doe",
  "candidate_email": "jane.doe@example.com",
  "session_type": "case_interview",
  "duration_minutes": 45,
  "notes": "Optional notes about the session"
}
```

**Parameters**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mentor_id | string | Yes | The mentor's unique ID |
| date | string | Yes | Session date (YYYY-MM-DD) |
| time_slot | string | Yes | Start time (HH:MM, 30-min intervals) |
| candidate_name | string | Yes | Full name of the candidate |
| candidate_email | string | Yes | Valid email address |
| session_type | string | Yes | One of: `case_interview`, `fit_interview`, `resume_review` |
| duration_minutes | integer | No | Session length (default: 45) |
| notes | string | No | Additional notes |

**Response (Success - 200)**
```json
{
  "success": true,
  "booking": {
    "id": "booking-uuid-here",
    "mentor_id": "mentor-123",
    "mentor_name": "John Smith",
    "date": "2026-03-16",
    "time_slot": "10:00",
    "duration_minutes": 45,
    "session_type": "case_interview",
    "candidate_name": "Jane Doe",
    "candidate_email": "jane.doe@example.com",
    "status": "scheduled",
    "created_at": "2026-03-11T10:30:00+00:00"
  }
}
```

**Important Notes**
- Calendar invites are NOT sent automatically. Your platform should send invites to the candidate.
- The booking will appear on the mentor's dashboard.
- The time slot will be blocked and unavailable for other bookings.

---

### 6. List Bookings

Get all bookings made through your partner account.

**Request**
```
GET /api/partner/bookings
```

**Query Parameters (all optional)**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `scheduled`, `completed`, `cancelled`, `no_show` |
| mentor_id | string | Filter by specific mentor |
| start_date | string | Filter bookings from this date (YYYY-MM-DD) |
| end_date | string | Filter bookings until this date (YYYY-MM-DD) |
| limit | integer | Max results (default: 50, max: 100) |
| skip | integer | Pagination offset |

**Example Request**
```
GET /api/partner/bookings?status=scheduled&limit=20
```

**Response**
```json
{
  "bookings": [
    {
      "id": "booking-uuid",
      "partner_id": "partner-uuid",
      "mentor_id": "mentor-123",
      "mentor_name": "John Smith",
      "date": "2026-03-16",
      "time_slot": "10:00",
      "duration_minutes": 45,
      "session_type": "case_interview",
      "candidate_name": "Jane Doe",
      "candidate_email": "jane.doe@example.com",
      "status": "scheduled",
      "notes": null,
      "created_at": "2026-03-11T10:30:00+00:00",
      "updated_at": "2026-03-11T10:30:00+00:00"
    }
  ],
  "total": 1,
  "limit": 50,
  "skip": 0
}
```

---

### 7. Get Booking Details

Get details of a specific booking.

**Request**
```
GET /api/partner/bookings/{booking_id}
```

**Response**
```json
{
  "id": "booking-uuid",
  "partner_id": "partner-uuid",
  "mentor_id": "mentor-123",
  "mentor_name": "John Smith",
  "date": "2026-03-16",
  "time_slot": "10:00",
  "duration_minutes": 45,
  "session_type": "case_interview",
  "candidate_name": "Jane Doe",
  "candidate_email": "jane.doe@example.com",
  "status": "scheduled",
  "notes": null,
  "created_at": "2026-03-11T10:30:00+00:00",
  "updated_at": "2026-03-11T10:30:00+00:00"
}
```

---

### 8. Cancel Booking

Cancel a scheduled booking.

**Request**
```
DELETE /api/partner/bookings/{booking_id}
Content-Type: application/json
```

**Request Body (optional)**
```json
{
  "reason": "Candidate requested cancellation"
}
```

**Response**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "booking_id": "booking-uuid"
}
```

**Notes**
- Only bookings with status `scheduled` can be cancelled.
- Cancellation frees up the time slot for other bookings.

---

## Error Responses

### Authentication Errors

**401 Unauthorized - Missing API Key**
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["header", "x-partner-api-key"],
      "msg": "Field required"
    }
  ]
}
```

**401 Unauthorized - Invalid API Key**
```json
{
  "detail": "Invalid or inactive API key"
}
```

### Authorization Errors

**403 Forbidden - Mentor Not Assigned**
```json
{
  "detail": "Mentor not assigned to this partner"
}
```

### Validation Errors

**400 Bad Request - Invalid Date Format**
```json
{
  "detail": "Invalid date format. Use YYYY-MM-DD"
}
```

**400 Bad Request - Invalid Time Slot**
```json
{
  "detail": "Invalid time_slot format. Use HH:MM (30-min intervals)"
}
```

**400 Bad Request - Invalid Session Type**
```json
{
  "detail": "Invalid session_type. Must be one of: case_interview, fit_interview, resume_review"
}
```

### Conflict Errors

**409 Conflict - Slot Unavailable**
```json
{
  "detail": "Time slot is not available. It may be booked, blocked, or outside availability."
}
```

### Not Found Errors

**404 Not Found**
```json
{
  "detail": "Mentor not found"
}
```

---

## Session Types

| Type | Description |
|------|-------------|
| `case_interview` | Practice case interview session |
| `fit_interview` | Behavioral/fit interview practice |
| `resume_review` | Resume review and feedback |

---

## Rate Limits

- **No strict rate limits** currently enforced
- Please implement reasonable request patterns
- Recommended: Cache mentor list and refresh every 5 minutes
- Recommended: Don't poll availability more than once per minute

---

## Best Practices

1. **Cache mentor data**: Mentor profiles don't change frequently. Cache for 5-10 minutes.

2. **Check availability before booking**: Always verify the slot is available before attempting to book.

3. **Handle errors gracefully**: Implement proper error handling for all API calls.

4. **Use meaningful candidate info**: Provide accurate candidate names and emails for mentor reference.

5. **Implement retry logic**: For network errors, implement exponential backoff retry.

---

## Integration Workflow

```
1. GET /api/partner/mentors
   └── Display mentor list to user

2. User selects a mentor
   └── GET /api/partner/mentors/{id}/availability?start_date=...&end_date=...
       └── Display available slots

3. User selects a time slot
   └── POST /api/partner/bookings
       └── Create booking
       └── Send calendar invite to candidate (your responsibility)

4. Booking management
   └── GET /api/partner/bookings (list all)
   └── DELETE /api/partner/bookings/{id} (cancel if needed)
```

---

## Support

For API support or questions, contact your GradNext partnership manager.

---

## Changelog

### Version 1.0.0 (March 2026)
- Initial API release
- Mentor listing and details
- Real-time availability checking
- Booking creation and cancellation
- Booking management endpoints
