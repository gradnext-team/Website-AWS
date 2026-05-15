"""
Create a second funnel for testing bulk-update-funnel endpoint
"""
import requests

BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# Login as admin
session = requests.Session()
resp = session.post(f"{BACKEND_URL}/auth/mock-login", params={"user_type": "admin"})
print(f"Admin login: {resp.status_code}")

# Create second funnel
funnel_data = {
    "name": "Marketing Funnel",
    "is_default": False,
    "stages": [
        {"id": "stage-mkt-1", "name": "Lead", "color": "#3B82F6", "order": 0},
        {"id": "stage-mkt-2", "name": "MQL", "color": "#8B5CF6", "order": 1},
        {"id": "stage-mkt-3", "name": "SQL", "color": "#10B981", "order": 2},
        {"id": "stage-mkt-4", "name": "Opportunity", "color": "#F59E0B", "order": 3},
        {"id": "stage-mkt-5", "name": "Closed Won", "color": "#22C55E", "order": 4},
        {"id": "stage-mkt-6", "name": "Closed Lost", "color": "#EF4444", "order": 5},
    ]
}

resp = session.post(f"{BACKEND_URL}/crm/funnels", json=funnel_data)
print(f"Create funnel: {resp.status_code}")
if resp.status_code == 200:
    print(f"Funnel created: {resp.json()}")
else:
    print(f"Error: {resp.text}")
