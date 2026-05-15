"""
Backend API Testing for CRM Bulk Update Funnel Endpoint
Tests the new POST /api/crm/leads/bulk-update-funnel endpoint for admins
to move many leads to a different funnel + stage in one shot.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@gradnext.co"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_test(test_num, description):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST {test_num}: {description}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def log_pass(message):
    print(f"{GREEN}✅ PASS: {message}{RESET}")

def log_fail(message):
    print(f"{RED}❌ FAIL: {message}{RESET}")

def log_info(message):
    print(f"{YELLOW}ℹ️  INFO: {message}{RESET}")

def log_critical(message):
    print(f"{RED}🔴 CRITICAL: {message}{RESET}")

# Global session for cookies
admin_session = requests.Session()
sales_rep_session = requests.Session()

def admin_login():
    """Login as admin to get auth cookie"""
    log_info("Logging in as admin...")
    url = f"{BACKEND_URL}/auth/mock-login"
    params = {"user_type": "admin"}
    resp = admin_session.post(url, params=params)
    if resp.status_code == 200:
        log_pass(f"Admin login successful")
        return True
    else:
        log_fail(f"Admin login failed: {resp.status_code} - {resp.text}")
        return False

def sales_rep_login():
    """Login as sales rep (non-admin) to test auth"""
    log_info("Logging in as sales rep (non-admin)...")
    # Try to use free user as non-admin
    url = f"{BACKEND_URL}/auth/mock-login"
    params = {"user_type": "free"}
    resp = sales_rep_session.post(url, params=params)
    if resp.status_code == 200:
        log_pass(f"Sales rep (non-admin) login successful")
        return True
    else:
        log_fail(f"Sales rep login failed: {resp.status_code} - {resp.text}")
        return False

def test_1_setup_get_funnels():
    """TEST 1: Setup - GET /api/crm/funnels to see available funnels"""
    log_test(1, "Setup - GET /api/crm/funnels")
    
    url = f"{BACKEND_URL}/crm/funnels"
    resp = admin_session.get(url)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    funnels = data.get("funnels", [])
    log_pass(f"Got {len(funnels)} funnel(s)")
    
    for funnel in funnels:
        funnel_id = funnel.get("id")
        funnel_name = funnel.get("name")
        stages = funnel.get("stages", [])
        log_info(f"Funnel: {funnel_name} (ID: {funnel_id}) with {len(stages)} stages")
        for stage in stages[:3]:  # Show first 3 stages
            log_info(f"  - Stage: {stage.get('name')} (ID: {stage.get('id')})")
    
    if len(funnels) == 0:
        log_fail("No funnels found")
        return None
    
    return funnels

def test_2_setup_get_leads():
    """TEST 2: Setup - GET /api/crm/leads to get lead IDs"""
    log_test(2, "Setup - GET /api/crm/leads?limit=5")
    
    url = f"{BACKEND_URL}/crm/leads"
    params = {"limit": 5}
    resp = admin_session.get(url, params=params)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    leads = data.get("leads", [])
    log_pass(f"Got {len(leads)} lead(s)")
    
    if len(leads) < 2:
        log_info(f"Only {len(leads)} leads available, need at least 2 for testing")
        # Create test leads if needed
        return create_test_leads()
    
    for lead in leads[:3]:
        lead_id = lead.get("id")
        lead_name = lead.get("name")
        lead_email = lead.get("email")
        funnel_id = lead.get("funnel_id")
        stage_id = lead.get("stage_id")
        log_info(f"Lead: {lead_name} ({lead_email}) - ID: {lead_id}")
        log_info(f"  Current funnel_id: {funnel_id}, stage_id: {stage_id}")
    
    return leads

def create_test_leads():
    """Create test leads if none exist"""
    log_info("Creating test leads...")
    
    url = f"{BACKEND_URL}/crm/leads"
    leads_created = []
    
    for i in range(3):
        lead_data = {
            "name": f"Test Lead {i+1} for Bulk Funnel",
            "email": f"testlead{i+1}_bulkfunnel_{datetime.now().timestamp()}@test.com",
            "phone": f"+1555000{i+1:04d}",
            "company": f"Test Company {i+1}",
            "source": "test_bulk_funnel"
        }
        
        resp = admin_session.post(url, json=lead_data)
        if resp.status_code == 200:
            lead = resp.json()
            leads_created.append(lead)
            log_pass(f"Created test lead: {lead.get('name')} (ID: {lead.get('id')})")
        else:
            log_fail(f"Failed to create test lead: {resp.status_code} - {resp.text}")
    
    return leads_created

def test_3_happy_path_move_to_different_funnel(funnels, leads):
    """TEST 3: Happy path - Move leads to a different funnel"""
    log_test(3, "Happy path - Move leads to different funnel")
    
    if len(funnels) < 2:
        log_info("Only 1 funnel exists, skipping test for moving to different funnel")
        log_info("Will test moving to different stage within same funnel instead")
        return None
    
    # Pick 2-3 leads
    test_leads = leads[:2]
    lead_ids = [lead.get("id") for lead in test_leads]
    
    # Get current funnel for first lead
    current_funnel_id = test_leads[0].get("funnel_id")
    
    # Find a different funnel
    target_funnel = None
    for funnel in funnels:
        if funnel.get("id") != current_funnel_id:
            target_funnel = funnel
            break
    
    if not target_funnel:
        log_fail("Could not find a different funnel")
        return None
    
    target_funnel_id = target_funnel.get("id")
    target_funnel_name = target_funnel.get("name")
    first_stage = target_funnel.get("stages", [])[0]
    first_stage_id = first_stage.get("id")
    first_stage_name = first_stage.get("name")
    
    log_info(f"Moving {len(lead_ids)} leads to funnel: {target_funnel_name} (ID: {target_funnel_id})")
    log_info(f"Lead IDs: {lead_ids}")
    
    # POST bulk-update-funnel
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": lead_ids,
        "funnel_id": target_funnel_id,
        "stage_id": None  # Should default to first stage
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    log_pass(f"Response: {json.dumps(result, indent=2)}")
    
    # Verify response structure
    if result.get("modified") != len(lead_ids):
        log_fail(f"Expected modified={len(lead_ids)}, got {result.get('modified')}")
        return None
    
    message = result.get("message", "")
    if target_funnel_name not in message or first_stage_name not in message:
        log_fail(f"Message doesn't include funnel name '{target_funnel_name}' or stage name '{first_stage_name}'")
        log_fail(f"Message: {message}")
        return None
    
    log_pass(f"Modified count matches: {result.get('modified')}")
    log_pass(f"Message includes funnel and stage names: {message}")
    
    # Verify leads were updated
    log_info("Verifying leads were updated...")
    for lead_id in lead_ids:
        url = f"{BACKEND_URL}/crm/leads/{lead_id}"
        resp = admin_session.get(url)
        if resp.status_code != 200:
            log_fail(f"Failed to get lead {lead_id}: {resp.status_code}")
            continue
        
        data = resp.json()
        lead = data.get("lead", {})
        
        if lead.get("funnel_id") != target_funnel_id:
            log_fail(f"Lead {lead_id} funnel_id not updated. Expected {target_funnel_id}, got {lead.get('funnel_id')}")
            return None
        
        if lead.get("stage_id") != first_stage_id:
            log_fail(f"Lead {lead_id} stage_id not updated to first stage. Expected {first_stage_id}, got {lead.get('stage_id')}")
            return None
        
        stage_changed_at = lead.get("stage_changed_at")
        if not stage_changed_at:
            log_fail(f"Lead {lead_id} stage_changed_at not set")
            return None
        
        log_pass(f"Lead {lead_id}: funnel_id={lead.get('funnel_id')}, stage_id={lead.get('stage_id')}, stage_changed_at={stage_changed_at}")
    
    return {"lead_ids": lead_ids, "funnel_id": target_funnel_id, "stage_id": first_stage_id}

def test_4_specific_stage(funnels, leads):
    """TEST 4: Move leads to specific stage"""
    log_test(4, "Move leads to specific stage")
    
    # Pick 1 lead
    test_lead = leads[0]
    lead_id = test_lead.get("id")
    
    # Pick a funnel and a specific stage (not the first one)
    target_funnel = funnels[0]
    stages = target_funnel.get("stages", [])
    
    if len(stages) < 2:
        log_fail("Funnel doesn't have enough stages for this test")
        return None
    
    target_stage = stages[1]  # Pick second stage
    target_funnel_id = target_funnel.get("id")
    target_stage_id = target_stage.get("id")
    target_stage_name = target_stage.get("name")
    
    log_info(f"Moving lead {lead_id} to funnel {target_funnel.get('name')}, stage {target_stage_name}")
    
    # POST bulk-update-funnel with specific stage
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": [lead_id],
        "funnel_id": target_funnel_id,
        "stage_id": target_stage_id
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    log_pass(f"Response: {json.dumps(result, indent=2)}")
    
    # Verify lead's stage_id
    url = f"{BACKEND_URL}/crm/leads/{lead_id}"
    resp = admin_session.get(url)
    if resp.status_code != 200:
        log_fail(f"Failed to get lead: {resp.status_code}")
        return None
    
    data = resp.json()
    lead = data.get("lead", {})
    
    if lead.get("stage_id") != target_stage_id:
        log_fail(f"Lead stage_id not updated. Expected {target_stage_id}, got {lead.get('stage_id')}")
        return None
    
    log_pass(f"Lead stage_id correctly set to {target_stage_id}")
    
    return {"lead_id": lead_id, "stage_id": target_stage_id}

def test_5_activity_log(lead_id):
    """TEST 5: Verify activity log written"""
    log_test(5, "Verify activity log written")
    
    log_info(f"Getting lead detail for lead_id: {lead_id}")
    
    # GET lead detail which includes activities
    url = f"{BACKEND_URL}/crm/leads/{lead_id}"
    resp = admin_session.get(url)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    activities = data.get("activities", [])
    
    log_info(f"Found {len(activities)} activities for lead {lead_id}")
    
    # Look for recent "stage_changed" activity
    stage_changed_activity = None
    for activity in activities:
        if activity.get("activity_type") == "stage_changed":
            stage_changed_activity = activity
            break
    
    if not stage_changed_activity:
        log_fail("No 'stage_changed' activity found")
        log_info(f"Activities: {json.dumps(activities, indent=2)}")
        return None
    
    details = stage_changed_activity.get("details", "")
    log_pass(f"Found stage_changed activity: {details}")
    
    # Verify the activity message format
    if "Moved from" not in details or "to" not in details:
        log_fail(f"Activity message doesn't match expected format 'Moved from X to Y'")
        log_fail(f"Details: {details}")
        return None
    
    log_pass(f"Activity message format correct: {details}")
    
    return stage_changed_activity

def test_6a_validation_empty_lead_ids():
    """TEST 6a: Validation - Empty lead_ids"""
    log_test("6a", "Validation - Empty lead_ids")
    
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": [],
        "funnel_id": "some-funnel-id",
        "stage_id": None
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 400:
        log_fail(f"Expected 400, got {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    detail = result.get("detail", "")
    
    if "No leads selected" not in detail:
        log_fail(f"Expected 'No leads selected' in error message, got: {detail}")
        return None
    
    log_pass(f"Correctly returned 400 with message: {detail}")
    return True

def test_6b_validation_nonexistent_funnel():
    """TEST 6b: Validation - Non-existent funnel_id"""
    log_test("6b", "Validation - Non-existent funnel_id")
    
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": ["some-lead-id"],
        "funnel_id": "non-existent-funnel-id-12345",
        "stage_id": None
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 404:
        log_fail(f"Expected 404, got {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    detail = result.get("detail", "")
    
    if "Funnel not found" not in detail:
        log_fail(f"Expected 'Funnel not found' in error message, got: {detail}")
        return None
    
    log_pass(f"Correctly returned 404 with message: {detail}")
    return True

def test_6c_validation_stage_wrong_funnel(funnels):
    """TEST 6c: Validation - Stage belongs to different funnel"""
    log_test("6c", "Validation - Stage belongs to different funnel")
    
    if len(funnels) < 2:
        log_info("Only 1 funnel exists, skipping this validation test")
        return None
    
    # Get stage from funnel 1
    funnel1 = funnels[0]
    funnel1_stage = funnel1.get("stages", [])[0]
    funnel1_stage_id = funnel1_stage.get("id")
    
    # Try to use it with funnel 2
    funnel2 = funnels[1]
    funnel2_id = funnel2.get("id")
    
    log_info(f"Trying to use stage {funnel1_stage_id} from funnel {funnel1.get('name')} with funnel {funnel2.get('name')}")
    
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": ["some-lead-id"],
        "funnel_id": funnel2_id,
        "stage_id": funnel1_stage_id
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 400:
        log_fail(f"Expected 400, got {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    detail = result.get("detail", "")
    
    if "Stage does not belong to this funnel" not in detail:
        log_fail(f"Expected 'Stage does not belong to this funnel' in error message, got: {detail}")
        return None
    
    log_pass(f"Correctly returned 400 with message: {detail}")
    return True

def test_7_auth_non_admin():
    """TEST 7: Auth - Non-admin (sales rep) should get 401 or 403"""
    log_test(7, "Auth - Non-admin should get 401 or 403")
    
    url = f"{BACKEND_URL}/crm/leads/bulk-update-funnel"
    payload = {
        "lead_ids": ["some-lead-id"],
        "funnel_id": "some-funnel-id",
        "stage_id": None
    }
    
    resp = sales_rep_session.post(url, json=payload)
    
    if resp.status_code not in [401, 403]:
        log_fail(f"Expected 401 or 403, got {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    detail = result.get("detail", "")
    
    log_pass(f"Correctly returned {resp.status_code} with message: {detail}")
    log_info("Non-admin users are properly blocked from accessing bulk-update-funnel endpoint")
    return True

def test_8_regression_bulk_assign():
    """TEST 8: Regression - bulk-assign still works"""
    log_test(8, "Regression - bulk-assign still works")
    
    # First get a sales rep
    url = f"{BACKEND_URL}/crm/sales-reps"
    resp = admin_session.get(url)
    
    if resp.status_code != 200:
        log_fail(f"Failed to get sales reps: {resp.status_code}")
        return None
    
    data = resp.json()
    reps = data.get("sales_reps", [])
    
    if len(reps) == 0:
        log_info("No sales reps found, creating one...")
        # Create a test sales rep
        url = f"{BACKEND_URL}/crm/sales-reps"
        rep_data = {
            "name": "Test Sales Rep",
            "email": f"testrep_{datetime.now().timestamp()}@test.com",
            "role": "sales_rep"
        }
        resp = admin_session.post(url, json=rep_data)
        if resp.status_code != 200:
            log_fail(f"Failed to create sales rep: {resp.status_code}")
            return None
        rep = resp.json()
        rep_id = rep.get("id")
    else:
        rep_id = reps[0].get("id")
    
    log_info(f"Using sales rep ID: {rep_id}")
    
    # Get some leads
    url = f"{BACKEND_URL}/crm/leads"
    params = {"limit": 2}
    resp = admin_session.get(url, params=params)
    
    if resp.status_code != 200:
        log_fail(f"Failed to get leads: {resp.status_code}")
        return None
    
    data = resp.json()
    leads = data.get("leads", [])
    
    if len(leads) == 0:
        log_fail("No leads available for testing")
        return None
    
    lead_ids = [lead.get("id") for lead in leads[:2]]
    
    # POST bulk-assign
    url = f"{BACKEND_URL}/crm/leads/bulk-assign"
    payload = {
        "lead_ids": lead_ids,
        "sales_rep_id": rep_id
    }
    
    resp = admin_session.post(url, json=payload)
    
    if resp.status_code != 200:
        log_fail(f"Status code: {resp.status_code}")
        log_fail(f"Response: {resp.text}")
        return None
    
    result = resp.json()
    log_pass(f"bulk-assign response: {json.dumps(result, indent=2)}")
    
    if result.get("modified") != len(lead_ids):
        log_fail(f"Expected modified={len(lead_ids)}, got {result.get('modified')}")
        return None
    
    log_pass(f"bulk-assign still works correctly")
    return True

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}CRM BULK UPDATE FUNNEL ENDPOINT TESTING{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"{YELLOW}Backend URL: {BACKEND_URL}{RESET}\n")
    
    # Login
    if not admin_login():
        log_critical("Admin login failed, cannot proceed")
        sys.exit(1)
    
    if not sales_rep_login():
        log_critical("Sales rep login failed, cannot proceed with auth test")
    
    # Setup tests
    funnels = test_1_setup_get_funnels()
    if not funnels:
        log_critical("Failed to get funnels, cannot proceed")
        sys.exit(1)
    
    leads = test_2_setup_get_leads()
    if not leads or len(leads) < 2:
        log_critical("Failed to get enough leads, cannot proceed")
        sys.exit(1)
    
    # Main tests
    test_3_result = test_3_happy_path_move_to_different_funnel(funnels, leads)
    
    test_4_result = test_4_specific_stage(funnels, leads)
    
    # Activity log test - use lead from test 4
    if test_4_result:
        test_5_activity_log(test_4_result.get("lead_id"))
    
    # Validation tests
    test_6a_validation_empty_lead_ids()
    test_6b_validation_nonexistent_funnel()
    test_6c_validation_stage_wrong_funnel(funnels)
    
    # Auth test
    test_7_auth_non_admin()
    
    # Regression test
    test_8_regression_bulk_assign()
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}ALL TESTS COMPLETED{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

if __name__ == "__main__":
    main()
