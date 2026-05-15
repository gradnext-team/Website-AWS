# Post-Workshop Messages API Documentation

## Endpoint

```
POST /api/admin/workshops/{workshop_id}/whatsapp-post-workshop
```

**Authentication:** Required (Admin only)

---

## Description

Triggers post-workshop thank you messages and WATI attribute updates for all registered participants of a specific workshop.

---

## Request

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workshop_id` | string | Yes | The ID of the workshop |

### Headers

```http
Content-Type: application/json
Cookie: auth_token=YOUR_ADMIN_TOKEN
```

### Body

Empty - no request body needed.

---

## Response

### Success Response (200 OK)

```json
{
  "message": "Post-workshop message sent to 45 participants, 2 failed",
  "sent": 45,
  "failed": 2,
  "total_registered": 50,
  "total_with_phone": 47,
  "errors": []
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable summary |
| `sent` | integer | Number of messages successfully sent |
| `failed` | integer | Number of messages that failed |
| `total_registered` | integer | Total registered participants |
| `total_with_phone` | integer | Participants with valid phone numbers |
| `errors` | array | List of error messages (first 10) |

### Error Responses

**404 Not Found**
```json
{
  "detail": "Workshop not found"
}
```

**401 Unauthorized**
```json
{
  "detail": "Not authenticated"
}
```

**403 Forbidden**
```json
{
  "detail": "Admin access required"
}
```

---

## What It Does

When you call this endpoint, it:

1. ✅ Fetches all registered participants for the workshop
2. ✅ Filters participants with valid phone numbers
3. ✅ Sends WhatsApp thank you message to each (template: `workshop_thankyou`)
4. ✅ Updates `workshop_name` attribute in WATI for each participant
5. ✅ Returns detailed success/failure report

---

## Examples

### Using curl

```bash
# Basic call
curl -X POST "https://app.gradnext.co/api/admin/workshops/workshop-123/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN"

# With verbose output
curl -X POST "https://app.gradnext.co/api/admin/workshops/workshop-123/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN" \
  -v

# Save response to file
curl -X POST "https://app.gradnext.co/api/admin/workshops/workshop-123/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN" \
  -o response.json
```

### Using Python

```python
import requests

API_URL = "https://app.gradnext.co/api"
ADMIN_TOKEN = "your_admin_auth_token"

# Single workshop
workshop_id = "workshop-123"

response = requests.post(
    f"{API_URL}/admin/workshops/{workshop_id}/whatsapp-post-workshop",
    headers={
        "Content-Type": "application/json",
        "Cookie": f"auth_token={ADMIN_TOKEN}"
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"✅ Success!")
    print(f"Sent: {data['sent']}")
    print(f"Failed: {data['failed']}")
    print(f"Total Registered: {data['total_registered']}")
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

const API_URL = 'https://app.gradnext.co/api';
const ADMIN_TOKEN = 'your_admin_auth_token';

async function sendPostWorkshopMessages(workshopId) {
  try {
    const response = await axios.post(
      `${API_URL}/admin/workshops/${workshopId}/whatsapp-post-workshop`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${ADMIN_TOKEN}`
        }
      }
    );
    
    console.log('✅ Success!');
    console.log(`Sent: ${response.data.sent}`);
    console.log(`Failed: ${response.data.failed}`);
    console.log(`Total: ${response.data.total_registered}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
sendPostWorkshopMessages('workshop-123');
```

### Using Postman

**Request:**
- Method: `POST`
- URL: `https://app.gradnext.co/api/admin/workshops/workshop-123/whatsapp-post-workshop`
- Headers:
  - `Content-Type`: `application/json`
  - `Cookie`: `auth_token=YOUR_ADMIN_TOKEN`
- Body: Empty

---

## Bulk Trigger (Multiple Workshops)

### Python Script

```python
import requests
import time

API_URL = "https://app.gradnext.co/api"
ADMIN_TOKEN = "your_admin_token"

# List of workshop IDs to process
workshop_ids = [
    "workshop-123",
    "workshop-456",
    "workshop-789"
]

results = []

for workshop_id in workshop_ids:
    print(f"\nProcessing: {workshop_id}")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/workshops/{workshop_id}/whatsapp-post-workshop",
            headers={"Cookie": f"auth_token={ADMIN_TOKEN}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Sent to {data['sent']} participants")
            results.append({
                "workshop_id": workshop_id,
                "status": "success",
                "sent": data['sent'],
                "failed": data['failed']
            })
        else:
            print(f"  ❌ Failed: {response.status_code}")
            results.append({
                "workshop_id": workshop_id,
                "status": "error",
                "error": response.text
            })
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        results.append({
            "workshop_id": workshop_id,
            "status": "exception",
            "error": str(e)
        })
    
    # Wait 2 seconds between requests to avoid rate limiting
    time.sleep(2)

# Print summary
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
total_sent = sum(r.get('sent', 0) for r in results)
total_failed = sum(r.get('failed', 0) for r in results)
print(f"Total workshops processed: {len(workshop_ids)}")
print(f"Total messages sent: {total_sent}")
print(f"Total messages failed: {total_failed}")
```

---

## Integration Examples

### Zapier/Make.com

**Trigger:** When workshop ends (scheduled or webhook)

**Action:**
- HTTP Request
- Method: POST
- URL: `https://app.gradnext.co/api/admin/workshops/{{workshop_id}}/whatsapp-post-workshop`
- Headers: 
  - `Content-Type`: `application/json`
  - `Cookie`: `auth_token={{admin_token}}`

### n8n Workflow

```json
{
  "nodes": [
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "position": [250, 300],
      "parameters": {
        "method": "POST",
        "url": "=https://app.gradnext.co/api/admin/workshops/{{$json.workshop_id}}/whatsapp-post-workshop",
        "authentication": "genericCredentialType",
        "options": {
          "headers": {
            "Cookie": "auth_token={{$credentials.adminToken}}"
          }
        }
      }
    }
  ]
}
```

---

## Rate Limiting

**Recommendations:**
- Wait 1-2 seconds between requests when triggering multiple workshops
- WATI API has rate limits (~60 requests/minute)
- For bulk operations, process in batches of 10-20 workshops

---

## Testing

### Test with Sample Workshop

```bash
# Replace with actual values
WORKSHOP_ID="workshop-123"
ADMIN_TOKEN="your_token"

curl -X POST "https://app.gradnext.co/api/admin/workshops/${WORKSHOP_ID}/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=${ADMIN_TOKEN}" \
  | jq '.'
```

Expected output:
```json
{
  "message": "Post-workshop message sent to 5 participants, 0 failed",
  "sent": 5,
  "failed": 0,
  "total_registered": 5,
  "total_with_phone": 5,
  "errors": []
}
```

---

## Monitoring

### Check Logs

```bash
# Backend logs
tail -f /var/log/supervisor/backend.out.log | grep "post_workshop"

# Look for:
# - "Post-workshop follow-up for 'Workshop Title': sent=X, failed=Y"
# - "Updated workshop_name attribute for {phone}"
```

### WATI Dashboard

1. Go to WATI Dashboard → Contacts
2. Search for a participant's phone number
3. Check Attributes → Should see `workshop_name` updated
4. Check Activity → Should see template message sent

---

## Troubleshooting

### Issue: "Workshop not found"
**Solution:** Verify workshop ID is correct
```bash
curl "https://app.gradnext.co/api/admin/workshops" \
  -H "Cookie: auth_token=${ADMIN_TOKEN}"
```

### Issue: "Not authenticated"
**Solution:** Check admin token is valid
```bash
curl "https://app.gradnext.co/api/admin/health" \
  -H "Cookie: auth_token=${ADMIN_TOKEN}"
```

### Issue: sent=0, failed=0
**Solution:** Workshop has no registrations with phone numbers
- Check registration count
- Verify users have phone_number field populated

### Issue: High failure rate
**Solution:** 
- Check WATI credentials are correct
- Verify template `workshop_thankyou` exists and is approved
- Check phone number formats (should include country code)

---

## Best Practices

✅ **Test first** - Try with one workshop before bulk processing  
✅ **Check registrations** - Ensure workshop has participants before triggering  
✅ **Monitor results** - Check sent/failed counts in response  
✅ **Handle errors** - Implement retry logic for failed requests  
✅ **Rate limit** - Wait between bulk requests  
✅ **Log results** - Keep track of which workshops were processed  
✅ **Verify in WATI** - Check WATI dashboard to confirm delivery  

---

## Security

⚠️ **Keep admin token secure**
- Never commit tokens to version control
- Use environment variables
- Rotate tokens periodically
- Limit API access to trusted IPs

---

## Related Endpoints

- `GET /api/admin/workshops` - List all workshops
- `GET /api/admin/workshops/{id}` - Get workshop details
- `GET /api/admin/workshops/{id}/registrations` - Get registrations
- `POST /api/admin/workshops/{id}/whatsapp-broadcast` - Pre-workshop broadcast

---

**API is live and ready to use!** 🚀
