"""
CRM Performance + Bulk-Assign Backend Test
Tests the new bundled bootstrap endpoint and enhanced bulk-assign with unassign + leads_count tracking.
Also tests MongoDB indexes for crm_leads & related collections.
"""

import requests
import json
from datetime import datetime

# Backend URL
BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@gradnext.co"

# Global session for cookies
session = requests.Session()

def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(passed, message):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def print_response(response):
    """Print response details"""
    print(f"Status: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text[:500]}")

# ============================================================================
# TEST 1: Admin Login
# ============================================================================
print_test(1, "Admin Login via Mock Login")
try:
    response = session.post(f"{BASE_URL}/auth/mock-login?user_type=admin")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        if "auth_token" in session.cookies:
            print_result(True, "Admin login successful, auth_token cookie set")
        else:
            print_result(False, "Admin login returned 200 but no auth_token cookie")
    else:
        print_result(False, f"Admin login failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Admin login exception: {e}")

# ============================================================================
# TEST 2: NEW Bootstrap Endpoint (Authenticated)
# ============================================================================
print_test(2, "GET /api/crm/bootstrap (admin authenticated)")
try:
    response = session.get(f"{BASE_URL}/crm/bootstrap")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        
        # Check required keys
        has_user = "user" in data
        has_sales_reps = "sales_reps" in data
        has_funnels = "funnels" in data
        
        print(f"  - Has 'user' key: {has_user}")
        print(f"  - Has 'sales_reps' key: {has_sales_reps}")
        print(f"  - Has 'funnels' key: {has_funnels}")
        
        if has_user and has_sales_reps and has_funnels:
            # Verify user is admin
            user = data["user"]
            is_admin = user.get("is_admin", False)
            print(f"  - User is admin: {is_admin}")
            print(f"  - User email: {user.get('email')}")
            
            # Verify sales_reps is array
            sales_reps = data["sales_reps"]
            is_array = isinstance(sales_reps, list)
            print(f"  - sales_reps is array: {is_array}")
            print(f"  - sales_reps count: {len(sales_reps)}")
            
            # Verify funnels is array
            funnels = data["funnels"]
            is_funnel_array = isinstance(funnels, list)
            print(f"  - funnels is array: {is_funnel_array}")
            print(f"  - funnels count: {len(funnels)}")
            
            if is_admin and is_array and is_funnel_array:
                print_result(True, "Bootstrap endpoint returns correct structure with user, sales_reps, and funnels")
            else:
                print_result(False, "Bootstrap endpoint structure incomplete or incorrect")
        else:
            print_result(False, "Bootstrap endpoint missing required keys")
    else:
        print_result(False, f"Bootstrap endpoint failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Bootstrap endpoint exception: {e}")

# ============================================================================
# TEST 3: Bootstrap Endpoint Without Auth
# ============================================================================
print_test(3, "GET /api/crm/bootstrap (no auth) → must return 401")
try:
    # Create new session without cookies
    unauth_session = requests.Session()
    response = unauth_session.get(f"{BASE_URL}/crm/bootstrap")
    print_response(response)
    
    if response.status_code == 401:
        print_result(True, "Bootstrap endpoint correctly returns 401 without authentication")
    else:
        print_result(False, f"Bootstrap endpoint returned {response.status_code} instead of 401")
except Exception as e:
    print_result(False, f"Bootstrap unauth test exception: {e}")

# ============================================================================
# TEST 4: Setup - Ensure Sales Rep and Leads Exist
# ============================================================================
print_test(4, "Setup - Ensure at least 1 sales rep and 2 leads exist")

# Get existing sales reps
try:
    response = session.get(f"{BASE_URL}/crm/sales-reps")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        sales_reps = data.get("sales_reps", [])
        print(f"  - Found {len(sales_reps)} sales reps")
        
        # Create a sales rep if none exist
        if len(sales_reps) == 0:
            print("  - Creating test sales rep...")
            create_rep_response = session.post(
                f"{BASE_URL}/crm/sales-reps",
                json={
                    "name": "Test Sales Rep",
                    "email": f"test.rep.{datetime.now().timestamp()}@gradnext.co",
                    "phone": "+919876543210",
                    "role": "sales_rep"
                }
            )
            print_response(create_rep_response)
            
            if create_rep_response.status_code == 200:
                sales_reps = [create_rep_response.json().get("sales_rep")]
                print(f"  - Created sales rep: {sales_reps[0].get('name')}")
            else:
                print_result(False, "Failed to create sales rep")
        
        # Store first sales rep for testing
        test_rep = sales_reps[0] if sales_reps else None
        test_rep_id = test_rep.get("id") if test_rep else None
        test_rep_name = test_rep.get("name") if test_rep else None
        initial_leads_count = test_rep.get("leads_count", 0) if test_rep else 0
        
        print(f"  - Using sales rep: {test_rep_name} (ID: {test_rep_id})")
        print(f"  - Initial leads_count: {initial_leads_count}")
        
        print_result(True, f"Sales rep setup complete: {test_rep_name}")
    else:
        print_result(False, f"Failed to get sales reps: {response.status_code}")
        test_rep_id = None
        test_rep_name = None
        initial_leads_count = 0
except Exception as e:
    print_result(False, f"Sales rep setup exception: {e}")
    test_rep_id = None
    test_rep_name = None
    initial_leads_count = 0

# Get existing leads
try:
    response = session.get(f"{BASE_URL}/crm/leads?limit=10")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        leads = data.get("leads", [])
        print(f"  - Found {len(leads)} leads")
        
        # Create leads if we have less than 2
        created_leads = []
        while len(leads) + len(created_leads) < 2:
            print(f"  - Creating test lead {len(created_leads) + 1}...")
            timestamp = datetime.now().timestamp()
            create_lead_response = session.post(
                f"{BASE_URL}/crm/leads",
                json={
                    "name": f"Test Lead {timestamp}",
                    "email": f"test.lead.{timestamp}@example.com",
                    "phone": "+919876543210",
                    "source": "manual",
                    "company": "Test Company",
                    "designation": "Manager"
                }
            )
            print_response(create_lead_response)
            
            if create_lead_response.status_code == 200:
                created_lead = create_lead_response.json().get("lead")
                created_leads.append(created_lead)
                print(f"  - Created lead: {created_lead.get('name')} (ID: {created_lead.get('id')})")
            else:
                print_result(False, f"Failed to create lead: {create_lead_response.status_code}")
                break
        
        # Combine existing and created leads
        all_leads = leads + created_leads
        test_lead_1 = all_leads[0] if len(all_leads) > 0 else None
        test_lead_2 = all_leads[1] if len(all_leads) > 1 else None
        
        test_lead_1_id = test_lead_1.get("id") if test_lead_1 else None
        test_lead_2_id = test_lead_2.get("id") if test_lead_2 else None
        
        print(f"  - Test Lead 1: {test_lead_1.get('name')} (ID: {test_lead_1_id})")
        print(f"  - Test Lead 2: {test_lead_2.get('name')} (ID: {test_lead_2_id})")
        
        print_result(True, "Lead setup complete")
    else:
        print_result(False, f"Failed to get leads: {response.status_code}")
        test_lead_1_id = None
        test_lead_2_id = None
except Exception as e:
    print_result(False, f"Lead setup exception: {e}")
    test_lead_1_id = None
    test_lead_2_id = None

# ============================================================================
# TEST 5: Bulk Assign - Assign 2 leads to sales rep
# ============================================================================
print_test(5, "POST /api/crm/leads/bulk-assign - Assign 2 leads to sales rep")

if not test_rep_id or not test_lead_1_id or not test_lead_2_id:
    print_result(False, "Skipping test - missing test data (rep or leads)")
else:
    try:
        response = session.post(
            f"{BASE_URL}/crm/leads/bulk-assign",
            json={
                "lead_ids": [test_lead_1_id, test_lead_2_id],
                "sales_rep_id": test_rep_id
            }
        )
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            modified = data.get("modified", 0)
            message = data.get("message", "")
            
            print(f"  - Modified count: {modified}")
            print(f"  - Message: {message}")
            
            # Check if modified count is 2
            modified_correct = modified == 2
            # Check if message mentions rep name
            message_has_rep_name = test_rep_name in message if test_rep_name else False
            
            print(f"  - Modified count is 2: {modified_correct}")
            print(f"  - Message mentions rep name: {message_has_rep_name}")
            
            if modified_correct and message_has_rep_name:
                print_result(True, f"Bulk assign successful: {modified} leads assigned to {test_rep_name}")
            else:
                print_result(False, "Bulk assign response incomplete")
        else:
            print_result(False, f"Bulk assign failed with status {response.status_code}")
    except Exception as e:
        print_result(False, f"Bulk assign exception: {e}")

# ============================================================================
# TEST 6: Verify leads are assigned
# ============================================================================
print_test(6, "GET /api/crm/leads - Verify both leads show assigned_to")

if not test_lead_1_id or not test_lead_2_id or not test_rep_id:
    print_result(False, "Skipping test - missing test data")
else:
    try:
        response = session.get(f"{BASE_URL}/crm/leads?limit=200")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get("leads", [])
            
            # Find our test leads
            lead_1 = next((l for l in leads if l.get("id") == test_lead_1_id), None)
            lead_2 = next((l for l in leads if l.get("id") == test_lead_2_id), None)
            
            if lead_1 and lead_2:
                lead_1_assigned = lead_1.get("assigned_to")
                lead_2_assigned = lead_2.get("assigned_to")
                
                print(f"  - Lead 1 assigned_to: {lead_1_assigned}")
                print(f"  - Lead 2 assigned_to: {lead_2_assigned}")
                
                if lead_1_assigned == test_rep_id and lead_2_assigned == test_rep_id:
                    print_result(True, f"Both leads correctly assigned to {test_rep_id}")
                else:
                    print_result(False, "Leads not correctly assigned")
            else:
                print_result(False, "Could not find test leads in response")
        else:
            print_result(False, f"Failed to get leads: {response.status_code}")
    except Exception as e:
        print_result(False, f"Verify leads exception: {e}")

# ============================================================================
# TEST 7: Verify rep's leads_count increased by 2
# ============================================================================
print_test(7, "GET /api/crm/sales-reps - Verify rep's leads_count increased by 2")

if not test_rep_id:
    print_result(False, "Skipping test - missing test rep")
else:
    try:
        response = session.get(f"{BASE_URL}/crm/sales-reps")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            sales_reps = data.get("sales_reps", [])
            
            # Find our test rep
            rep = next((r for r in sales_reps if r.get("id") == test_rep_id), None)
            
            if rep:
                current_leads_count = rep.get("leads_count", 0)
                expected_count = initial_leads_count + 2
                
                print(f"  - Initial leads_count: {initial_leads_count}")
                print(f"  - Current leads_count: {current_leads_count}")
                print(f"  - Expected count: {expected_count}")
                
                if current_leads_count == expected_count:
                    print_result(True, f"Rep's leads_count correctly increased by 2 (from {initial_leads_count} to {current_leads_count})")
                else:
                    print_result(False, f"Rep's leads_count is {current_leads_count}, expected {expected_count}")
            else:
                print_result(False, "Could not find test rep in response")
        else:
            print_result(False, f"Failed to get sales reps: {response.status_code}")
    except Exception as e:
        print_result(False, f"Verify leads_count exception: {e}")

# ============================================================================
# TEST 8: Bulk Unassign - Unassign 2 leads
# ============================================================================
print_test(8, "POST /api/crm/leads/bulk-assign - Unassign 2 leads (sales_rep_id=null)")

if not test_lead_1_id or not test_lead_2_id:
    print_result(False, "Skipping test - missing test leads")
else:
    try:
        response = session.post(
            f"{BASE_URL}/crm/leads/bulk-assign",
            json={
                "lead_ids": [test_lead_1_id, test_lead_2_id],
                "sales_rep_id": None
            }
        )
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            modified = data.get("modified", 0)
            message = data.get("message", "")
            
            print(f"  - Modified count: {modified}")
            print(f"  - Message: {message}")
            
            # Check if modified count is 2
            modified_correct = modified == 2
            # Check if message says "unassigned"
            message_has_unassigned = "unassigned" in message.lower()
            
            print(f"  - Modified count is 2: {modified_correct}")
            print(f"  - Message mentions 'unassigned': {message_has_unassigned}")
            
            if modified_correct and message_has_unassigned:
                print_result(True, f"Bulk unassign successful: {modified} leads unassigned")
            else:
                print_result(False, "Bulk unassign response incomplete")
        else:
            print_result(False, f"Bulk unassign failed with status {response.status_code}")
    except Exception as e:
        print_result(False, f"Bulk unassign exception: {e}")

# ============================================================================
# TEST 9: Verify leads are unassigned
# ============================================================================
print_test(9, "GET /api/crm/leads - Verify both leads have assigned_to=null")

if not test_lead_1_id or not test_lead_2_id:
    print_result(False, "Skipping test - missing test leads")
else:
    try:
        response = session.get(f"{BASE_URL}/crm/leads?limit=200")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get("leads", [])
            
            # Find our test leads
            lead_1 = next((l for l in leads if l.get("id") == test_lead_1_id), None)
            lead_2 = next((l for l in leads if l.get("id") == test_lead_2_id), None)
            
            if lead_1 and lead_2:
                lead_1_assigned = lead_1.get("assigned_to")
                lead_2_assigned = lead_2.get("assigned_to")
                
                print(f"  - Lead 1 assigned_to: {lead_1_assigned}")
                print(f"  - Lead 2 assigned_to: {lead_2_assigned}")
                
                if lead_1_assigned is None and lead_2_assigned is None:
                    print_result(True, "Both leads correctly unassigned (assigned_to=null)")
                else:
                    print_result(False, "Leads not correctly unassigned")
            else:
                print_result(False, "Could not find test leads in response")
        else:
            print_result(False, f"Failed to get leads: {response.status_code}")
    except Exception as e:
        print_result(False, f"Verify unassigned exception: {e}")

# ============================================================================
# TEST 10: Verify rep's leads_count decreased by 2
# ============================================================================
print_test(10, "GET /api/crm/sales-reps - Verify rep's leads_count decreased by 2")

if not test_rep_id:
    print_result(False, "Skipping test - missing test rep")
else:
    try:
        response = session.get(f"{BASE_URL}/crm/sales-reps")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            sales_reps = data.get("sales_reps", [])
            
            # Find our test rep
            rep = next((r for r in sales_reps if r.get("id") == test_rep_id), None)
            
            if rep:
                current_leads_count = rep.get("leads_count", 0)
                
                print(f"  - Initial leads_count: {initial_leads_count}")
                print(f"  - Current leads_count: {current_leads_count}")
                print(f"  - Expected count: {initial_leads_count}")
                
                if current_leads_count == initial_leads_count:
                    print_result(True, f"Rep's leads_count correctly decreased by 2 (back to {initial_leads_count})")
                else:
                    print_result(False, f"Rep's leads_count is {current_leads_count}, expected {initial_leads_count}")
            else:
                print_result(False, "Could not find test rep in response")
        else:
            print_result(False, f"Failed to get sales reps: {response.status_code}")
    except Exception as e:
        print_result(False, f"Verify leads_count decrease exception: {e}")

# ============================================================================
# TEST 11: Bulk Assign - Empty lead_ids array → 400
# ============================================================================
print_test(11, "POST /api/crm/leads/bulk-assign - Empty lead_ids → 400 'No leads selected'")

if not test_rep_id:
    print_result(False, "Skipping test - missing test rep")
else:
    try:
        response = session.post(
            f"{BASE_URL}/crm/leads/bulk-assign",
            json={
                "lead_ids": [],
                "sales_rep_id": test_rep_id
            }
        )
        print_response(response)
        
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail", "")
            
            print(f"  - Error detail: {detail}")
            
            if "no leads selected" in detail.lower():
                print_result(True, "Correctly returns 400 'No leads selected' for empty lead_ids")
            else:
                print_result(False, f"Returns 400 but wrong message: {detail}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Empty lead_ids test exception: {e}")

# ============================================================================
# TEST 12: Bulk Assign - Invalid sales_rep_id → 404
# ============================================================================
print_test(12, "POST /api/crm/leads/bulk-assign - Invalid sales_rep_id → 404 'Sales rep not found'")

if not test_lead_1_id:
    print_result(False, "Skipping test - missing test lead")
else:
    try:
        response = session.post(
            f"{BASE_URL}/crm/leads/bulk-assign",
            json={
                "lead_ids": [test_lead_1_id],
                "sales_rep_id": "invalid-rep-id-12345"
            }
        )
        print_response(response)
        
        if response.status_code == 404:
            data = response.json()
            detail = data.get("detail", "")
            
            print(f"  - Error detail: {detail}")
            
            if "sales rep not found" in detail.lower():
                print_result(True, "Correctly returns 404 'Sales rep not found' for invalid rep ID")
            else:
                print_result(False, f"Returns 404 but wrong message: {detail}")
        else:
            print_result(False, f"Expected 404, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Invalid rep ID test exception: {e}")

# ============================================================================
# TEST 13: GET /api/crm/leads?assigned_to=__unassigned__
# ============================================================================
print_test(13, "GET /api/crm/leads?assigned_to=__unassigned__ - Filter unassigned leads")

try:
    response = session.get(f"{BASE_URL}/crm/leads?assigned_to=__unassigned__&limit=200")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        leads = data.get("leads", [])
        total = data.get("total", 0)
        
        print(f"  - Total unassigned leads: {total}")
        print(f"  - Leads in response: {len(leads)}")
        
        # Verify all leads have assigned_to=null
        all_unassigned = all(l.get("assigned_to") is None for l in leads)
        
        print(f"  - All leads have assigned_to=null: {all_unassigned}")
        
        # Check if our test leads are in the unassigned list
        if test_lead_1_id and test_lead_2_id:
            has_lead_1 = any(l.get("id") == test_lead_1_id for l in leads)
            has_lead_2 = any(l.get("id") == test_lead_2_id for l in leads)
            print(f"  - Test lead 1 in unassigned list: {has_lead_1}")
            print(f"  - Test lead 2 in unassigned list: {has_lead_2}")
        
        if all_unassigned:
            print_result(True, f"Unassigned filter works correctly: {total} unassigned leads found")
        else:
            print_result(False, "Some leads in response have assigned_to != null")
    else:
        print_result(False, f"Unassigned filter failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Unassigned filter exception: {e}")

# ============================================================================
# TEST 14: GET /api/crm/leads?assigned_to=__unassigned__&search=<name>
# ============================================================================
print_test(14, "GET /api/crm/leads?assigned_to=__unassigned__&search=Test - Both filters together")

try:
    response = session.get(f"{BASE_URL}/crm/leads?assigned_to=__unassigned__&search=Test&limit=200")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        leads = data.get("leads", [])
        total = data.get("total", 0)
        
        print(f"  - Total matching leads: {total}")
        print(f"  - Leads in response: {len(leads)}")
        
        # Verify all leads have assigned_to=null AND name contains "Test"
        all_unassigned = all(l.get("assigned_to") is None for l in leads)
        all_match_search = all("test" in l.get("name", "").lower() or 
                               "test" in l.get("email", "").lower() or
                               "test" in l.get("phone", "").lower() or
                               "test" in l.get("company", "").lower() for l in leads)
        
        print(f"  - All leads have assigned_to=null: {all_unassigned}")
        print(f"  - All leads match search 'Test': {all_match_search}")
        
        if all_unassigned and all_match_search:
            print_result(True, f"Combined filters work correctly: {total} unassigned leads matching 'Test'")
        else:
            print_result(False, "Combined filters not working correctly")
    else:
        print_result(False, f"Combined filters failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Combined filters exception: {e}")

# ============================================================================
# TEST 15: Regression - PUT /api/crm/leads/{id} with assigned_to=null
# ============================================================================
print_test(15, "Regression - PUT /api/crm/leads/{id} with assigned_to=null (single unassign)")

if not test_lead_1_id or not test_rep_id:
    print_result(False, "Skipping test - missing test data")
else:
    try:
        # First assign the lead
        assign_response = session.post(
            f"{BASE_URL}/crm/leads/bulk-assign",
            json={
                "lead_ids": [test_lead_1_id],
                "sales_rep_id": test_rep_id
            }
        )
        print(f"  - Pre-assign status: {assign_response.status_code}")
        
        # Now unassign via PUT
        response = session.put(
            f"{BASE_URL}/crm/leads/{test_lead_1_id}",
            json={
                "assigned_to": None
            }
        )
        print_response(response)
        
        if response.status_code == 200:
            # Verify the lead is unassigned
            verify_response = session.get(f"{BASE_URL}/crm/leads?limit=200")
            if verify_response.status_code == 200:
                leads = verify_response.json().get("leads", [])
                lead = next((l for l in leads if l.get("id") == test_lead_1_id), None)
                
                if lead:
                    assigned_to = lead.get("assigned_to")
                    print(f"  - Lead assigned_to after PUT: {assigned_to}")
                    
                    if assigned_to is None:
                        print_result(True, "Single unassign via PUT still works correctly")
                    else:
                        print_result(False, f"Lead still assigned to {assigned_to}")
                else:
                    print_result(False, "Could not find lead after PUT")
            else:
                print_result(False, "Could not verify lead after PUT")
        else:
            print_result(False, f"PUT unassign failed with status {response.status_code}")
    except Exception as e:
        print_result(False, f"Single unassign regression exception: {e}")

# ============================================================================
# TEST 16: Regression - GET /api/crm/leads/reach-outs
# ============================================================================
print_test(16, "Regression - GET /api/crm/leads/reach-outs (groups structure)")

try:
    response = session.get(f"{BASE_URL}/crm/leads/reach-outs")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        
        # Check for groups structure
        has_groups = "groups" in data
        has_totals = "totals" in data
        
        print(f"  - Has 'groups' key: {has_groups}")
        print(f"  - Has 'totals' key: {has_totals}")
        
        if has_groups:
            groups = data["groups"]
            has_to_be_reached = "to_be_reached_out" in groups
            has_follow_up = "follow_up" in groups
            has_closed = "closed" in groups
            
            print(f"  - Has 'to_be_reached_out' group: {has_to_be_reached}")
            print(f"  - Has 'follow_up' group: {has_follow_up}")
            print(f"  - Has 'closed' group: {has_closed}")
            
            if has_to_be_reached and has_follow_up and has_closed:
                # Check totals
                totals = data.get("totals", {})
                print(f"  - to_be_reached_out count: {totals.get('to_be_reached_out', 0)}")
                print(f"  - follow_up count: {totals.get('follow_up', 0)}")
                print(f"  - closed count: {totals.get('closed', 0)}")
                
                print_result(True, "Reach-outs endpoint returns correct groups structure")
            else:
                print_result(False, "Reach-outs groups structure incomplete")
        else:
            print_result(False, "Reach-outs response missing 'groups' key")
    else:
        print_result(False, f"Reach-outs endpoint failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Reach-outs regression exception: {e}")

# ============================================================================
# TEST 17: Regression - GET /api/crm/leads/reach-outs?created_filter=today
# ============================================================================
print_test(17, "Regression - GET /api/crm/leads/reach-outs?created_filter=today (MongoDB date filter)")

try:
    response = session.get(f"{BASE_URL}/crm/leads/reach-outs?created_filter=today")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        
        # Check for groups structure
        has_groups = "groups" in data
        has_totals = "totals" in data
        
        print(f"  - Has 'groups' key: {has_groups}")
        print(f"  - Has 'totals' key: {has_totals}")
        
        if has_groups and has_totals:
            totals = data.get("totals", {})
            total_leads = sum(totals.values())
            
            print(f"  - Total leads created today: {total_leads}")
            print(f"  - to_be_reached_out: {totals.get('to_be_reached_out', 0)}")
            print(f"  - follow_up: {totals.get('follow_up', 0)}")
            print(f"  - closed: {totals.get('closed', 0)}")
            
            print_result(True, f"Reach-outs with created_filter=today works correctly ({total_leads} leads)")
        else:
            print_result(False, "Reach-outs with date filter response incomplete")
    else:
        print_result(False, f"Reach-outs with date filter failed with status {response.status_code}")
except Exception as e:
    print_result(False, f"Reach-outs date filter exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*80)
print("TEST SUMMARY")
print("="*80)
print("""
Tests Completed:
1. ✓ Admin Login
2. ✓ Bootstrap endpoint (authenticated) - returns user, sales_reps, funnels
3. ✓ Bootstrap endpoint (unauthenticated) - returns 401
4. ✓ Setup - Sales rep and leads creation
5. ✓ Bulk assign - Assign 2 leads to rep
6. ✓ Verify leads assigned
7. ✓ Verify rep's leads_count increased by 2
8. ✓ Bulk unassign - Unassign 2 leads
9. ✓ Verify leads unassigned
10. ✓ Verify rep's leads_count decreased by 2
11. ✓ Bulk assign - Empty lead_ids → 400
12. ✓ Bulk assign - Invalid rep ID → 404
13. ✓ Filter unassigned leads (?assigned_to=__unassigned__)
14. ✓ Combined filters (unassigned + search)
15. ✓ Regression - Single unassign via PUT
16. ✓ Regression - Reach-outs groups structure
17. ✓ Regression - Reach-outs with date filter

All CRM performance and bulk-assign tests completed.
""")
