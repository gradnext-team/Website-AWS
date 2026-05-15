# Post-Workshop WhatsApp Follow-up Feature

## Overview
Automatically send WhatsApp messages to all registered participants after a workshop is completed.

## New Endpoint Created

### `POST /api/admin/workshops/{workshop_id}/whatsapp-post-workshop`

**Purpose:** Send follow-up WhatsApp message to all registered participants after workshop completion

**Authentication:** Admin only

**Parameters:**
- `workshop_id` (path parameter) - The ID of the completed workshop

---

## How It Works

### 1. Admin Triggers the Message
After a workshop is completed, admin can send a follow-up message by calling:
```bash
POST /api/admin/workshops/{workshop_id}/whatsapp-post-workshop
```

### 2. Backend Process
1. Fetches workshop details from database
2. Gets all registered participants for that workshop
3. Filters participants who have phone numbers
4. Sends WhatsApp template message to each participant
5. Returns summary of sent/failed messages

### 3. Message Details
**WhatsApp Template Name:** `post_workshop_followup`

**Template Parameters:**
1. **First Name** - Participant's first name (personalized greeting)
2. **Workshop Title** - Name of the workshop they attended
3. **Instructor** - Workshop instructor/host name

---

## Response Format

```json
{
  "message": "Post-workshop message sent to 45 participants, 2 failed",
  "sent": 45,
  "failed": 2,
  "total_registered": 50,
  "total_with_phone": 47,
  "errors": [
    "91XXXXXXXXXX: Invalid phone number",
    "91YYYYYYYYYY: Template not found"
  ]
}
```

**Fields Explained:**
- `sent` - Number of messages successfully sent
- `failed` - Number of messages that failed to send
- `total_registered` - Total number of registered participants
- `total_with_phone` - Number of participants with phone numbers
- `errors` - First 10 error messages (for debugging)

---

## Setting Up the WhatsApp Template

### Step 1: Create Template in WATI Dashboard

1. Go to your WATI dashboard
2. Navigate to **Templates** section
3. Click **Create New Template**
4. Use the following details:

**Template Name:** `post_workshop_followup`

**Category:** Marketing or Utility

**Language:** English

**Template Content:**
```
Hi {{1}}! 👋

Thank you for attending "{{2}}" with {{3}}! 

We hope you found the session valuable. We'd love to hear your feedback!

📝 What did you learn?
💡 Any suggestions for improvement?

Reply to this message or reach out to us anytime.

Looking forward to seeing you in our next workshop!

Team gradnext 🚀
```

**Parameters:**
- {{1}} = First Name
- {{2}} = Workshop Title
- {{3}} = Instructor Name

### Step 2: Submit for WhatsApp Approval
- Submit the template for WhatsApp Business API approval
- Wait for approval (usually takes 24-48 hours)
- Once approved, the template will be ready to use

### Step 3: Test the Template
- Send a test message through WATI dashboard
- Verify all parameters are rendering correctly
- Check formatting and emojis display properly

---

## Usage Examples

### Example 1: Send Post-Workshop Message via API

```bash
curl -X POST "https://app.gradnext.co/api/admin/workshops/workshop-123/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN"
```

### Example 2: Via Admin Panel (Frontend Integration)

Add a button in the workshop admin panel:

```jsx
const handleSendPostWorkshopMessage = async (workshopId) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/admin/workshops/${workshopId}/whatsapp-post-workshop`,
      {},
      { withCredentials: true }
    );
    
    alert(`Message sent to ${response.data.sent} participants!`);
  } catch (error) {
    alert('Failed to send messages: ' + error.response?.data?.detail);
  }
};

// Usage in component
<Button onClick={() => handleSendPostWorkshopMessage(workshop.id)}>
  Send Post-Workshop Message
</Button>
```

---

## Best Practices

### When to Send
- **Immediately after workshop ends** - Thank participants while workshop is fresh
- **Same day evening** - If workshop was in the morning
- **Next day morning** - For evening workshops
- **Within 24 hours** - Maximum delay for best engagement

### Message Customization Ideas
You can create multiple templates for different purposes:
- `post_workshop_feedback_request` - Ask for detailed feedback
- `post_workshop_resources` - Share workshop materials
- `post_workshop_recording` - Send recording link
- `post_workshop_certificate` - Notify about certificate availability

### Error Handling
- Always check the response for failed messages
- Review error logs to fix phone number issues
- Keep template parameters simple and tested
- Monitor WATI dashboard for delivery status

---

## Comparison with Existing Workshop Endpoints

| Endpoint | Purpose | Recipients | Timing |
|----------|---------|------------|--------|
| `whatsapp-broadcast` | Announce workshop to all users | All users with phone | Before workshop |
| `whatsapp-register-reminder` | Remind to register | Unregistered users | Before workshop |
| **`whatsapp-post-workshop`** | **Follow-up after workshop** | **Registered participants only** | **After workshop** |

---

## Implementation Details

**File:** `/app/backend/routes/admin.py`  
**Lines:** 3441-3522  
**Dependencies:**
- `services.wati_service` - WhatsApp messaging service
- WATI API credentials (configured in environment)

**Database Collections Used:**
- `workshops` - Workshop details
- `workshop_registrations` - Registered participants
- `users` - User phone numbers and names

---

## Testing Checklist

Before using in production:

- [ ] Template `post_workshop_followup` created in WATI
- [ ] Template approved by WhatsApp
- [ ] Test message sent to 1-2 test participants
- [ ] Parameters rendering correctly
- [ ] Error handling working (test with invalid phone)
- [ ] Admin authentication working
- [ ] Response format correct
- [ ] Logs being captured properly

---

## Monitoring & Analytics

Track these metrics:
- **Delivery Rate**: `sent / total_with_phone`
- **Registration Rate**: `total_registered / total_attendees`
- **Phone Coverage**: `total_with_phone / total_registered`
- **Failure Rate**: `failed / (sent + failed)`

**Goal Metrics:**
- Delivery rate > 95%
- Phone coverage > 80%
- Failure rate < 5%

---

## Future Enhancements

Potential improvements:
1. **Automated Scheduling** - Auto-send X hours after workshop ends
2. **Custom Messages** - Allow admin to customize message per workshop
3. **Feedback Link** - Include direct feedback form link
4. **Recording Link** - Automatically include workshop recording
5. **Certificate Link** - Send personalized certificate download link
6. **Survey Integration** - Embed post-workshop survey link
7. **Analytics Dashboard** - Track message delivery and engagement

---

## Support & Troubleshooting

### Common Issues

**Issue 1: Template not found error**
- **Solution:** Ensure template `post_workshop_followup` exists in WATI and is approved

**Issue 2: High failure rate**
- **Solution:** Check phone number formats in user database (should be with country code)

**Issue 3: No messages sent**
- **Solution:** Verify WATI API credentials are configured in environment variables

**Issue 4: Parameters not rendering**
- **Solution:** Check template parameter order matches code (1, 2, 3)

### Debug Steps
1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Verify WATI dashboard for template status
3. Test with a single user first
4. Check workshop_registrations collection has data
5. Verify users have valid phone_number field

---

## Deployment

✅ Backend endpoint created  
✅ Backend restarted  
⏳ Create WhatsApp template in WATI  
⏳ Get template approved by WhatsApp  
⏳ Add UI button in admin panel (optional)  
⏳ Test with sample workshop  
⏳ Deploy to production  

---

**Status:** Ready for use (pending WATI template creation & approval)  
**Created:** 2026-04-12  
**Location:** `/app/backend/routes/admin.py` lines 3441-3522
