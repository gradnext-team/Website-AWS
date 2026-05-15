#!/usr/bin/env python3
"""
CRM Sync Endpoints Test
Tests the CRM sync endpoints as specified in the review request:
1. POST /api/auth/mock-login?user_type=admin
2. POST /api/crm/sync/discovery-calls
3. POST /api/crm/sync/free-signups
4. GET /api/crm/leads
"""

import requests
import json
from datetime import datetime

# Backend URL
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

def print_test_header(test_num, description):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def print_response_body(response, title="Response Body"):
    """Print formatted response body"""
    print(f"\n📄 {title}:")
    print("-" * 80)
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)
    print("-" * 80)

def test_1_admin_login():
    """Test 1: POST /api/auth/mock-login?user_type=admin"""
    print_test_header(1, "POST /api/auth/mock-login?user_type=admin - Admin Authentication")
    
    response = requests.post(f"{BACKEND_URL}/auth/mock-login?user_type=admin")
    
    print(f"Status Code: {response.status_code}")
    print_response_body(response, "Admin Login Response")
    
    if response.status_code != 200:
        print_result(False, f"Admin login failed with status {response.status_code}")
        return None, None
    
    # Try to get session_token from cookies
    session_token = response.cookies.get('session_token')
    auth_token = response.cookies.get('auth_token')
    
    # Also check response body for token
    try:
        data = response.json()
        if not session_token and 'session_token' in data:
            session_token = data['session_token']
        if not auth_token and 'auth_token' in data:
            auth_token = data['auth_token']
    except:
        pass
    
    token = session_token or auth_token
    
    if not token:
        print_result(False, "No session_token or auth_token in response")
        print(f"Response cookies: {response.cookies}")
        return None, None
    
    print_result(True, f"Admin authentication successful (token: {token[:20]}...)")
    
    # Prepare headers
    headers = {
        "Content-Type": "application/json"
    }
    
    if session_token:
        headers["Cookie"] = f"session_token={session_token}"
        headers["Authorization"] = f"Bearer {session_token}"
    else:
        headers["Cookie"] = f"auth_token={token}"
        headers["Authorization"] = f"Bearer {token}"
    
    return True, headers

def test_2_sync_discovery_calls(headers):
    """Test 2: POST /api/crm/sync/discovery-calls"""
    print_test_header(2, "POST /api/crm/sync/discovery-calls - Sync Discovery Calls")
    
    response = requests.post(f"{BACKEND_URL}/crm/sync/discovery-calls", headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print_response_body(response, "Discovery Calls Sync Response")
    
    if response.status_code != 200:
        print_result(False, f"Request failed with status {response.status_code}")
        return False
    
    try:
        data = response.json()
        
        # Check for required fields
        required_fields = ["message", "imported", "skipped"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_result(False, f"Missing required fields: {missing_fields}")
            return False
        
        imported = data.get("imported", 0)
        skipped = data.get("skipped", 0)
        errors = data.get("errors", [])
        
        print(f"\n📊 Sync Results:")
        print(f"  - Imported: {imported}")
        print(f"  - Skipped: {skipped}")
        print(f"  - Errors: {len(errors)}")
        
        if errors:
            print(f"\n⚠️  Errors encountered:")
            for error in errors[:5]:  # Show first 5 errors
                print(f"    - {error}")
        
        # Verify it didn't crash (status 200 means success)
        print_result(True, f"Discovery calls sync completed successfully (imported={imported}, skipped={skipped})")
        return True
        
    except Exception as e:
        print_result(False, f"Failed to parse response: {str(e)}")
        return False

def test_3_sync_free_signups(headers):
    """Test 3: POST /api/crm/sync/free-signups"""
    print_test_header(3, "POST /api/crm/sync/free-signups - Sync Free Signups")
    
    response = requests.post(f"{BACKEND_URL}/crm/sync/free-signups", headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print_response_body(response, "Free Signups Sync Response")
    
    if response.status_code != 200:
        print_result(False, f"Request failed with status {response.status_code}")
        return False
    
    try:
        data = response.json()
        
        # Check for required fields
        required_fields = ["message", "imported", "skipped"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_result(False, f"Missing required fields: {missing_fields}")
            return False
        
        imported = data.get("imported", 0)
        skipped = data.get("skipped", 0)
        errors = data.get("errors", [])
        
        print(f"\n📊 Sync Results:")
        print(f"  - Imported: {imported}")
        print(f"  - Skipped: {skipped}")
        print(f"  - Errors: {len(errors)}")
        
        if errors:
            print(f"\n⚠️  Errors encountered:")
            for error in errors[:5]:  # Show first 5 errors
                print(f"    - {error}")
        
        # Verify it didn't crash (status 200 means success)
        print_result(True, f"Free signups sync completed successfully (imported={imported}, skipped={skipped})")
        return True
        
    except Exception as e:
        print_result(False, f"Failed to parse response: {str(e)}")
        return False

def test_4_get_leads(headers):
    """Test 4: GET /api/crm/leads - Verify synced leads appear"""
    print_test_header(4, "GET /api/crm/leads - Verify Synced Leads")
    
    response = requests.get(f"{BACKEND_URL}/crm/leads", headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print_response_body(response, "Leads List Response")
    
    if response.status_code != 200:
        print_result(False, f"Request failed with status {response.status_code}")
        return False
    
    try:
        data = response.json()
        
        # Check for required fields
        if "leads" not in data or "total" not in data:
            print_result(False, "Missing 'leads' or 'total' field in response")
            return False
        
        leads = data.get("leads", [])
        total = data.get("total", 0)
        
        print(f"\n📊 Leads Summary:")
        print(f"  - Total Leads: {total}")
        print(f"  - Leads Returned: {len(leads)}")
        
        # Group leads by source
        sources = {}
        for lead in leads:
            source = lead.get("source", "unknown")
            sources[source] = sources.get(source, 0) + 1
        
        print(f"\n📊 Leads by Source:")
        for source, count in sources.items():
            print(f"  - {source}: {count}")
        
        # Show sample leads
        if leads:
            print(f"\n📋 Sample Leads (first 5):")
            for i, lead in enumerate(leads[:5], 1):
                print(f"\n  Lead {i}:")
                print(f"    - ID: {lead.get('id')}")
                print(f"    - Name: {lead.get('name')}")
                print(f"    - Email: {lead.get('email')}")
                print(f"    - Phone: {lead.get('phone')}")
                print(f"    - Source: {lead.get('source')}")
                print(f"    - Source Details: {lead.get('source_details')}")
                print(f"    - Status: {lead.get('status')}")
                print(f"    - Created At: {lead.get('created_at')}")
                
                # Show custom fields if present
                custom_fields = lead.get('custom_fields', {})
                if custom_fields:
                    print(f"    - Custom Fields: {json.dumps(custom_fields, indent=6)}")
        
        print_result(True, f"Successfully retrieved {total} leads from CRM")
        return True
        
    except Exception as e:
        print_result(False, f"Failed to parse response: {str(e)}")
        return False

def main():
    """Run all CRM sync tests"""
    print("\n" + "="*80)
    print("CRM SYNC ENDPOINTS TEST")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Test 1: Admin login
    test_1_result, headers = test_1_admin_login()
    results["Test 1 (Admin Login)"] = test_1_result
    
    if not test_1_result or not headers:
        print("\n❌ FATAL: Could not authenticate as admin. Aborting remaining tests.")
        print_summary(results)
        return
    
    # Test 2: Sync discovery calls
    test_2_result = test_2_sync_discovery_calls(headers)
    results["Test 2 (Sync Discovery Calls)"] = test_2_result
    
    # Test 3: Sync free signups
    test_3_result = test_3_sync_free_signups(headers)
    results["Test 3 (Sync Free Signups)"] = test_3_result
    
    # Test 4: Get leads
    test_4_result = test_4_get_leads(headers)
    results["Test 4 (Get Leads)"] = test_4_result
    
    # Print summary
    print_summary(results)

def print_summary(results):
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
