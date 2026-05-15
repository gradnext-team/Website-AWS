# Automated Workshop WhatsApp Messages

## Overview
The system automatically sends WhatsApp messages to registered workshop participants at three specific times without any manual intervention.

---

## ⏰ Automated Message Schedule

### 1. **24 Hours Before Workshop** 
⏰ **Timing:** 23-25 hours before workshop start time  
📱 **Template:** `workshop_reminder_24h_vf`  
👥 **Recipients:** All registered participants with phone numbers  
📋 **Parameters:** 5 (name, title, instructor, date, time)

**Purpose:** Give participants advance notice to prepare and plan

---

### 2. **1 Hour Before Workshop**
⏰ **Timing:** 45-75 minutes before workshop start time  
📱 **Template:** `workshop_reminder_1h_vf`  
👥 **Recipients:** All registered participants with phone numbers  
📋 **Parameters:** 5 (name, title, instructor, time)

**Purpose:** Final reminder so participants don't miss the workshop

---

### 3. **2 Hours After Workshop** ✨ (NEW)
⏰ **Timing:** 2-2.5 hours after workshop end time  
📱 **Template:** `workshop_thankyou`  
👥 **Recipients:** All registered participants with phone numbers  
📋 **Parameters:** 2 (first_name, workshop_name)

**Purpose:** Thank participants and remind about recording access

**Message Content:**
```
Hi {{first_name}}!

Thank you for attending our workshop on *"{{workshop_name}}"*. 

We hope you found it valuable and gained helpful insights from it.  

In case you were not able to attend the workshop, you can access the recording of the same in the dashboard.

Looking forward to seeing you in future workshops.  

Team gradnext
```

---

## 🔄 How The Automation Works

### Scheduler
- **Runs every:** 15 minutes
- **Service:** `workshop_reminder_service.py`
- **Started by:** Backend server on startup
- **Timezone:** IST (Indian Standard Time)

### Process Flow
1. Every 15 minutes, the scheduler wakes up
2. Checks all workshops in the database
3. Calculates time difference from current time
4. For each workshop that matches a trigger window:
   - Fetches all registered participants
   - Filters users with phone numbers
   - Sends WhatsApp template message to each
   - Records that the reminder was sent (prevents duplicates)
5. Logs success/failure counts

### Duplicate Prevention
The system tracks sent reminders in the `workshop_reminders_sent` collection:
- **Reminder Key:** `{workshop_id}_{reminder_type}`
- Example: `workshop_123_24h`, `workshop_123_post_workshop`
- Once sent, the same reminder won't be sent again for that workshop

---

## 📊 Example Timeline

Let's say a workshop is scheduled for **Jan 10, 2026 at 10:00 AM IST**:

```
Jan 9, 10:00 AM IST  → 24h reminder sent ✅
Jan 10, 9:00 AM IST  → 1h reminder sent ✅
Jan 10, 10:00 AM IST → Workshop starts 🎤
Jan 10, 12:00 PM IST → Workshop ends (assumed 2h duration)
Jan 10, 2:00 PM IST  → Thank you message sent ✅
```

---

## 🔍 Monitoring & Logs

### Check Scheduler Status
```bash
# Check if scheduler is running
tail -f /var/log/supervisor/backend.out.log | grep "Workshop Reminders"
```

### Example Log Output
```
[Workshop Reminders] Checking at IST: 2026-01-10 14:05
[Workshop Reminders] post_workshop for 'Case Interview Masterclass': sent=45, failed=2
[Workshop Reminders] Completed. 24h reminders: 0, 1h reminders: 0
```

### Database Collections

**workshop_reminders_sent** - Tracks sent reminders
```json
{
  "reminder_key": "workshop_123_post_workshop",
  "workshop_id": "workshop_123",
  "reminder_type": "post_workshop",
  "sent_count": 45,
  "failed_count": 2,
  "sent_at": "2026-01-10T08:30:00Z"
}
```

---

## ⚙️ Configuration

### Trigger Windows (in minutes from workshop start)

| Reminder Type | Window | Calculation |
|--------------|--------|-------------|
| 24h before | 23-25 hours | `23*60 <= diff <= 25*60` |
| 1h before | 45-75 minutes | `45 <= diff <= 75` |
| 2h after | 2-2.5 hours past | `-150 <= diff <= -120` |

**Why Windows?**  
The scheduler runs every 15 minutes, so we use windows to ensure we catch the reminder even if the exact time is between scheduler runs.

### Modifying Timing

To change when the thank you message is sent, edit `/app/backend/services/workshop_reminder_service.py`:

```python
# Current: 2 hours after (120-150 minutes past)
if -150 <= diff_minutes <= -120:  

# Change to 1 hour after (60-90 minutes past)
if -90 <= diff_minutes <= -60:

# Change to 4 hours after (240-270 minutes past)  
if -270 <= diff_minutes <= -240:
```

---

## 🧪 Testing

### Test Scenario 1: Manual Test
1. Create a test workshop scheduled for current time + 2.5 hours
2. Register yourself for the workshop
3. Wait for scheduler to run (within 15 min)
4. Check backend logs for confirmation
5. Wait 2.5 hours, check for thank you message

### Test Scenario 2: Database Verification
```javascript
// Check if reminders were sent
db.workshop_reminders_sent.find({
  workshop_id: "workshop_123"
})

// Expected output:
[
  { reminder_key: "workshop_123_24h", sent_count: 45, ... },
  { reminder_key: "workshop_123_1h", sent_count: 45, ... },
  { reminder_key: "workshop_123_post_workshop", sent_count: 45, ... }
]
```

---

## 🚨 Troubleshooting

### Issue 1: Messages not being sent
**Check:**
1. Scheduler is running: `sudo supervisorctl status backend`
2. WATI credentials configured
3. Workshop has `date` and `time` fields set correctly
4. Users have valid `phone_number` in database
5. Check logs for errors

### Issue 2: Duplicate messages
**Check:**
- `workshop_reminders_sent` collection for duplicate entries
- If found, the deduplication is working correctly
- If getting actual duplicate WhatsApp messages, check WATI dashboard

### Issue 3: Wrong timing
**Check:**
1. Workshop `time` field format (e.g., "10:00 AM IST")
2. Server timezone is set correctly
3. Scheduler window calculation matches workshop duration

### Issue 4: Some users not receiving
**Check:**
1. User has `phone_number` field (not null/empty)
2. Phone number format is correct (with country code)
3. Check WATI dashboard for delivery failures
4. Review error logs for specific users

---

## 📈 Success Metrics

Track these in your database:
- **Total workshops:** Count of workshops in period
- **Reminders sent:** Sum of `sent_count` from `workshop_reminders_sent`
- **Success rate:** `sent_count / (sent_count + failed_count)`
- **Coverage:** Percentage of registered users with phone numbers

**Target Metrics:**
- ✅ 24h reminder coverage: >90%
- ✅ 1h reminder coverage: >90%
- ✅ Post-workshop thank you coverage: >90%
- ✅ Delivery success rate: >95%

---

## 🔧 Maintenance

### Regular Checks (Weekly)
- [ ] Review `workshop_reminders_sent` collection size
- [ ] Check error logs for patterns
- [ ] Verify WATI template approval status
- [ ] Monitor delivery rates

### Cleanup (Monthly)
```javascript
// Remove old reminder records (optional, for database maintenance)
db.workshop_reminders_sent.deleteMany({
  sent_at: { $lt: new Date('2025-12-01') }
})
```

---

## 🎯 Benefits of Automation

✅ **Zero manual work** - Set and forget  
✅ **Consistent timing** - Never miss a reminder  
✅ **Scales infinitely** - Works for 1 or 100 workshops  
✅ **Prevents duplicates** - Built-in deduplication  
✅ **Detailed logging** - Full audit trail  
✅ **Error resilient** - Continues even if some fail  

---

## 📝 Summary

**Current Status:** ✅ Fully Automated

**Messages:** 
1. 24h before (existing)
2. 1h before (existing)
3. **2h after (NEW)** ✨

**Template:** `workshop_thankyou`  
**Scheduler:** Runs every 15 minutes  
**No manual intervention required**

---

**Last Updated:** 2026-04-12  
**File:** `/app/backend/services/workshop_reminder_service.py`  
**Lines:** 89-107 (post-workshop logic)
