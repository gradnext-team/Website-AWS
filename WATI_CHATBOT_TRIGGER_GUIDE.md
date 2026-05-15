# WATI Chatbot Trigger Guide

## Overview
You can now trigger WATI chatbots/flows programmatically for any contact.

---

## How to Find Your Flow ID

### Step 1: Log in to WATI Dashboard
Go to your WATI account: https://app.wati.io

### Step 2: Navigate to Flows
1. Click on **"Flows"** in the left sidebar
2. You'll see a list of all your chatbot flows

### Step 3: Get Flow ID
**Method 1: From URL**
- Click on any flow to edit it
- Look at the URL in your browser
- Example: `https://app.wati.io/flows/editor/63f5a8b9c1234567890abcde`
- The Flow ID is: `63f5a8b9c1234567890abcde`

**Method 2: From Flow Settings**
- Open the flow
- Click on flow settings/info
- The Flow ID should be displayed

---

## How to Trigger a Chatbot

### Method 1: Using Flow ID (Recommended)
```python
await wati_service.trigger_chatbot(
    recipient_number="918222866630",
    flow_id="63f5a8b9c1234567890abcde"  # Your flow ID
)
```

### Method 2: Using Flow Name
```python
await wati_service.trigger_chatbot(
    recipient_number="918222866630",
    flow_name="Welcome Flow"  # Exact name from WATI
)
```

---

## Test Script

To test triggering a chatbot for Kashish, I need:
1. **Flow ID** or **Flow Name** from your WATI dashboard
2. **Phone number** (already have: 918222866630)

Once you provide the Flow ID/Name, I can trigger it immediately!

---

## Example Use Cases

### 1. Welcome New Users
```python
# Trigger welcome chatbot when user signs up
await wati_service.trigger_chatbot(
    recipient_number=user.phone_number,
    flow_id="welcome_flow_id"
)
```

### 2. Post-Purchase Follow-up
```python
# Trigger feedback chatbot after purchase
await wati_service.trigger_chatbot(
    recipient_number=customer.phone,
    flow_id="feedback_flow_id"
)
```

### 3. Onboarding Sequence
```python
# Trigger onboarding flow for new subscribers
await wati_service.trigger_chatbot(
    recipient_number=subscriber.phone,
    flow_id="onboarding_flow_id"
)
```

### 4. Re-engagement Campaign
```python
# Trigger re-engagement chatbot for inactive users
await wati_service.trigger_chatbot(
    recipient_number=inactive_user.phone,
    flow_id="reengagement_flow_id"
)
```

---

## API Endpoint (Optional)

You can also create an admin endpoint to trigger chatbots:

```python
@router.post("/trigger-chatbot")
async def trigger_chatbot_for_user(
    user_id: str,
    flow_id: str,
    request: Request
):
    await verify_admin(request)
    db = get_db(request)
    
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("phone_number"):
        raise HTTPException(status_code=404, detail="User not found or no phone")
    
    # Trigger chatbot
    from services.wati_service import wati_service
    result = await wati_service.trigger_chatbot(
        recipient_number=user["phone_number"],
        flow_id=flow_id
    )
    
    return {"message": "Chatbot triggered", "result": result}
```

---

## Next Steps

**To test the chatbot trigger:**
1. Go to your WATI dashboard
2. Find the Flow ID you want to trigger
3. Share it with me
4. I'll trigger it for Kashish (918222866630)

**Example:**
"Trigger flow ID `63f5a8b9c1234567890abcde` for Kashish"

---

## Important Notes

✅ **Flow must be active** in WATI  
✅ **Contact must exist** in WATI (will be auto-created if not)  
✅ **Phone number must be valid**  
⚠️ **Flow will start immediately** upon trigger  
⚠️ **Only one flow can be active** per contact at a time  

---

**Ready to test! Just provide the Flow ID or Flow Name.**
