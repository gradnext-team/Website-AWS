# How to Trigger Post-Workshop Messages for Existing Workshops

## Manual Trigger Endpoint

**Endpoint:** `POST /api/admin/workshops/{workshop_id}/whatsapp-post-workshop`

**What it does:**
- Sends thank you WhatsApp message to all registered participants
- Updates `workshop_name` attribute in WATI for each participant
- Returns count of successful/failed messages

---

## Method 1: Using curl (Command Line)

### Step 1: Get Workshop ID
Find the workshop ID from your database or admin panel.

Example workshop ID: `workshop_abc123`

### Step 2: Run curl Command

```bash
# Replace {workshop_id} with actual workshop ID
curl -X POST "https://app.gradnext.co/api/admin/workshops/{workshop_id}/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_ADMIN_AUTH_TOKEN"
```

**Example:**
```bash
curl -X POST "https://app.gradnext.co/api/admin/workshops/workshop_abc123/whatsapp-post-workshop" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=eyJhbGc..."
```

### Response:
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

---

## Method 2: Using Python Script

Create a script to trigger for one or multiple workshops:

```python
import requests

# Your admin auth token
AUTH_TOKEN = "your_admin_token_here"

# Workshop ID(s) to trigger
workshop_ids = [
    "workshop_abc123",
    "workshop_xyz789",
    "workshop_def456"
]

API_URL = "https://app.gradnext.co/api/admin/workshops"

for workshop_id in workshop_ids:
    response = requests.post(
        f"{API_URL}/{workshop_id}/whatsapp-post-workshop",
        headers={"Cookie": f"auth_token={AUTH_TOKEN}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {workshop_id}: Sent to {data['sent']} participants")
    else:
        print(f"❌ {workshop_id}: Failed - {response.text}")
```

---

## Method 3: Add Button in Admin Panel

Add a button in your workshop admin UI:

```jsx
const handleSendPostWorkshopMessages = async (workshopId) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/admin/workshops/${workshopId}/whatsapp-post-workshop`,
      {},
      { withCredentials: true }
    );
    
    const { sent, failed, total_registered } = response.data;
    
    alert(
      `✅ Post-workshop messages sent!\n\n` +
      `Sent: ${sent}\n` +
      `Failed: ${failed}\n` +
      `Total Registered: ${total_registered}`
    );
  } catch (error) {
    alert(`❌ Error: ${error.response?.data?.detail || error.message}`);
  }
};

// Add button to workshop management page
<Button 
  onClick={() => handleSendPostWorkshopMessages(workshop.id)}
  variant="primary"
>
  📱 Send Post-Workshop Messages
</Button>
```

---

## Method 4: Bulk Trigger for Multiple Workshops

If you want to trigger for all past workshops:

```python
import requests
import time

AUTH_TOKEN = "your_admin_token"
API_URL = "https://app.gradnext.co/api"

# Step 1: Get all past workshops
workshops_response = requests.get(
    f"{API_URL}/admin/workshops?is_past=true",
    headers={"Cookie": f"auth_token={AUTH_TOKEN}"}
)

past_workshops = workshops_response.json()

# Step 2: Trigger for each workshop
for workshop in past_workshops:
    workshop_id = workshop['id']
    workshop_title = workshop['title']
    
    print(f"\nProcessing: {workshop_title}")
    
    response = requests.post(
        f"{API_URL}/admin/workshops/{workshop_id}/whatsapp-post-workshop",
        headers={"Cookie": f"auth_token={AUTH_TOKEN}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"  ✅ Sent to {data['sent']} participants")
    else:
        print(f"  ❌ Failed: {response.status_code}")
    
    # Wait 2 seconds between workshops to avoid rate limiting
    time.sleep(2)
```

---

## Quick Test Script

Want to test with one workshop right now? Run this:

```bash
# I'll create a test script for you
cd /app/backend && python3 << 'SCRIPT'
import asyncio
import sys
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import os

async def trigger_workshop():
    # Get workshop ID from user
    workshop_id = input("Enter workshop ID: ").strip()
    
    if not workshop_id:
        print("❌ Workshop ID required")
        return
    
    # Connect to DB
    mongo_url = os.environ.get('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['gradnext']
    
    # Check if workshop exists
    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    
    if not workshop:
        print(f"❌ Workshop not found: {workshop_id}")
        return
    
    print(f"\n✅ Found workshop: {workshop.get('title')}")
    print(f"   Date: {workshop.get('date')}")
    print(f"   Time: {workshop.get('time')}")
    
    # Get registrations count
    reg_count = await db.workshop_registrations.count_documents({"workshop_id": workshop_id})
    print(f"   Registered participants: {reg_count}")
    
    if reg_count == 0:
        print("\n⚠️  No registrations found for this workshop")
        return
    
    confirm = input(f"\n📱 Send post-workshop messages to {reg_count} participants? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("Cancelled")
        return
    
    print(f"\n🔧 To trigger, call this endpoint:")
    print(f"POST /api/admin/workshops/{workshop_id}/whatsapp-post-workshop")
    print(f"\nOr use curl:")
    print(f'curl -X POST "YOUR_URL/api/admin/workshops/{workshop_id}/whatsapp-post-workshop" \\')
    print(f'  -H "Cookie: auth_token=YOUR_TOKEN"')

asyncio.run(trigger_workshop())
SCRIPT
```

---

## Important Notes

✅ **Can trigger multiple times** - System won't send duplicates if you trigger twice  
✅ **Only sends to registered participants** - Automatically filters by workshop registrations  
✅ **Only sends to users with phone numbers** - Skips users without valid phone  
✅ **Updates WATI attributes** - Each participant gets workshop_name attribute set  
✅ **Returns detailed report** - Shows sent/failed counts and any errors  

⚠️ **Requires admin authentication** - Must be logged in as admin  
⚠️ **Rate limiting** - Wait a few seconds between bulk triggers  

---

## What You Should Know

**Automated (Future Workshops):**
- System automatically triggers 2 hours after workshop ends
- No manual action needed

**Manual (Past Workshops):**
- Use the admin endpoint to trigger for any past workshop
- Can be triggered from code, curl, or admin UI button
- Useful for workshops that happened before this feature was built

---

**Ready to use!** Just call the endpoint with any workshop ID.
