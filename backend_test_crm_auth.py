#!/usr/bin/env python3
"""
Backend tests for CRM Authentication System
Tests the following scenarios:
1. GET /api/crm/auth/me (unauthenticated) - Expected: 401
2. Admin access via mock login - POST /api/auth/mock-login?user_type=admin, then GET /api/crm/auth/me
3. Send magic link - Create sales rep, then send magic link
4. Verify magic link token with invalid token - Expected: 400
5. Role-based access - Admin access to leads, funnels, dashboard
6. Logout - POST /api/crm/auth/logout
"""

import requests
import json
from datetime import datetime
from pymongo import MongoClient
import os

# Backend URL from environment
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gradnext')

def get_db():
    """Get MongoDB database connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def print_test_header(test_num, description):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def print_response(response):
    """Print response details"""
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text[:500]}")

def test_1_crm_auth_me_unauthenticated():
    """Test 1: GET /api/crm/auth/me (unauthenticated) - Expected: 401"""
    print_test_header(1, "CRM Auth Me (unauthenticated)")
    
    response = requests.get(f"{BACKEND_URL}/crm/auth/me")
    
    print_response(response)
    
    if response.status_code == 401:
        print_result(True, "Correctly returned 401 for unauthenticated request")
        return True
    else:
        print_result(False, f"Expected 401, got {response.status_code}")
        return False

def test_2_admin_access_via_mock_login():
    """Test 2: Admin access via mock login"""
    print_test_header(2, "Admin access via mock login")
    
    # Step 1: Mock login as admin
    print("\n🔐 Step 1: Logging in as admin...")
    login_response = requests.post(f"{BACKEND_URL}/auth/mock-login?user_type=admin")
    
    print(f"Login Status Code: {login_response.status_code}")
    print(f"Login Response: {login_response.text[:500]}")
    
    if login_response.status_code != 200:
        print_result(False, f"Admin login failed with status {login_response.status_code}")
        return False
    
    # Get auth_token from cookies
    auth_token = login_response.cookies.get('auth_token')
    if not auth_token:
        print_result(False, "No auth_token in response cookies")
        return False
    
    print(f"✅ Admin login successful, auth_token: {auth_token[:20]}...")
    
    # Step 2: GET /api/crm/auth/me with session cookie
    print("\n🔐 Step 2: Getting CRM auth/me with admin session...")
    headers = {"Cookie": f"auth_token={auth_token}"}
    me_response = requests.get(f"{BACKEND_URL}/crm/auth/me", headers=headers)
    
    print_response(me_response)
    
    if me_response.status_code != 200:
        print_result(False, f"CRM auth/me failed with status {me_response.status_code}")
        return False
    
    data = me_response.json()
    user = data.get("user", {})
    
    print(f"\n📊 User data:")
    print(f"  - is_admin: {user.get('is_admin')}")
    print(f"  - role: {user.get('role')}")
    print(f"  - name: {user.get('name')}")
    print(f"  - email: {user.get('email')}")
    
    # Verify user.is_admin=true and user.role="admin"
    if user.get("is_admin") == True and user.get("role") == "admin":
        print_result(True, "Admin user correctly authenticated with is_admin=true and role='admin'")
        return auth_token  # Return auth_token for subsequent tests
    else:
        print_result(False, f"Expected is_admin=true and role='admin', got is_admin={user.get('is_admin')}, role={user.get('role')}")
        return False

def test_3_send_magic_link(auth_token):
    """Test 3: Send magic link"""
    print_test_header(3, "Send magic link")
    
    # Step 1: Create a sales rep
    print("\n📝 Step 1: Creating a sales rep...")
    headers = {"Cookie": f"auth_token={auth_token}", "Content-Type": "application/json"}
    
    sales_rep_data = {
        "name": "Test Sales Rep",
        "email": "test-sales@example.com",
        "role": "sales_rep"
    }
    
    create_response = requests.post(
        f"{BACKEND_URL}/crm/sales-reps",
        headers=headers,
        json=sales_rep_data
    )
    
    print(f"Create Sales Rep Status Code: {create_response.status_code}")
    print(f"Create Sales Rep Response: {create_response.text[:500]}")
    
    if create_response.status_code not in [200, 400]:
        print_result(False, f"Failed to create sales rep with status {create_response.status_code}")
        return False
    
    # If 400, it might already exist - that's OK
    if create_response.status_code == 400:
        response_data = create_response.json()
        if "already exists" in response_data.get("detail", "").lower():
            print("ℹ️  Sales rep already exists, continuing with test...")
        else:
            print_result(False, f"Unexpected 400 error: {response_data.get('detail')}")
            return False
    else:
        print("✅ Sales rep created successfully")
    
    # Step 2: Send magic link
    print("\n📧 Step 2: Sending magic link...")
    magic_link_data = {
        "email": "test-sales@example.com"
    }
    
    magic_response = requests.post(
        f"{BACKEND_URL}/crm/auth/send-magic-link",
        json=magic_link_data
    )
    
    print_response(magic_response)
    
    if magic_response.status_code != 200:
        print_result(False, f"Send magic link failed with status {magic_response.status_code}")
        return False
    
    data = magic_response.json()
    message = data.get("message", "")
    
    if "login link has been sent" in message.lower() or "email is registered" in message.lower():
        print_result(True, f"Magic link endpoint returned success: {message}")
        return True
    else:
        print_result(False, f"Unexpected message: {message}")
        return False

def test_4_verify_invalid_magic_link_token():
    """Test 4: Verify magic link token with invalid token - Expected: 400"""
    print_test_header(4, "Verify magic link token (invalid)")
    
    invalid_token_data = {
        "token": "invalid_token_123"
    }
    
    response = requests.post(
        f"{BACKEND_URL}/crm/auth/verify-magic-link",
        json=invalid_token_data
    )
    
    print_response(response)
    
    if response.status_code == 400:
        data = response.json()
        detail = data.get("detail", "")
        
        if "invalid" in detail.lower() or "expired" in detail.lower():
            print_result(True, f"Correctly returned 400 with message: {detail}")
            return True
        else:
            print_result(False, f"Got 400 but unexpected message: {detail}")
            return False
    else:
        print_result(False, f"Expected 400, got {response.status_code}")
        return False

def test_5_role_based_access(auth_token):
    """Test 5: Role-based access - Admin access to leads, funnels, dashboard"""
    print_test_header(5, "Role-based access (Admin)")
    
    headers = {"Cookie": f"auth_token={auth_token}"}
    
    # Test 5a: GET /api/crm/leads
    print("\n📋 Test 5a: GET /api/crm/leads (should work for admin)...")
    leads_response = requests.get(f"{BACKEND_URL}/crm/leads", headers=headers)
    
    print(f"Leads Status Code: {leads_response.status_code}")
    print(f"Leads Response: {leads_response.text[:300]}")
    
    if leads_response.status_code != 200:
        print_result(False, f"GET /api/crm/leads failed with status {leads_response.status_code}")
        return False
    
    leads_data = leads_response.json()
    print(f"✅ GET /api/crm/leads successful - Total leads: {leads_data.get('total', 0)}")
    
    # Test 5b: POST /api/crm/funnels (admin only)
    print("\n📊 Test 5b: POST /api/crm/funnels (admin only)...")
    funnel_data = {
        "name": f"Test Funnel {datetime.utcnow().isoformat()}",
        "is_default": False,
        "stages": [
            {"name": "New", "color": "#6B7280", "order": 0},
            {"name": "Won", "color": "#22C55E", "order": 1}
        ]
    }
    
    funnel_response = requests.post(
        f"{BACKEND_URL}/crm/funnels",
        headers={**headers, "Content-Type": "application/json"},
        json=funnel_data
    )
    
    print(f"Funnel Status Code: {funnel_response.status_code}")
    print(f"Funnel Response: {funnel_response.text[:300]}")
    
    if funnel_response.status_code != 200:
        print_result(False, f"POST /api/crm/funnels failed with status {funnel_response.status_code}")
        return False
    
    print("✅ POST /api/crm/funnels successful (admin only endpoint)")
    
    # Test 5c: GET /api/crm/dashboard
    print("\n📈 Test 5c: GET /api/crm/dashboard...")
    dashboard_response = requests.get(f"{BACKEND_URL}/crm/dashboard", headers=headers)
    
    print(f"Dashboard Status Code: {dashboard_response.status_code}")
    print(f"Dashboard Response: {dashboard_response.text[:300]}")
    
    if dashboard_response.status_code != 200:
        print_result(False, f"GET /api/crm/dashboard failed with status {dashboard_response.status_code}")
        return False
    
    dashboard_data = dashboard_response.json()
    print(f"✅ GET /api/crm/dashboard successful")
    print(f"  - Total leads: {dashboard_data.get('total_leads', 0)}")
    print(f"  - Active leads: {dashboard_data.get('active_leads', 0)}")
    print(f"  - Total calls: {dashboard_data.get('total_calls', 0)}")
    
    print_result(True, "All role-based access tests passed")
    return True

def test_6_logout(auth_token):
    """Test 6: Logout - POST /api/crm/auth/logout"""
    print_test_header(6, "Logout")
    
    headers = {"Cookie": f"auth_token={auth_token}"}
    
    response = requests.post(f"{BACKEND_URL}/crm/auth/logout", headers=headers)
    
    print_response(response)
    
    if response.status_code != 200:
        print_result(False, f"Logout failed with status {response.status_code}")
        return False
    
    data = response.json()
    message = data.get("message", "")
    
    if "logged out" in message.lower():
        print_result(True, f"Logout successful: {message}")
        return True
    else:
        print_result(False, f"Unexpected message: {message}")
        return False

def main():
    """Run all CRM authentication tests"""
    print("\n" + "="*80)
    print("CRM AUTHENTICATION SYSTEM TESTING")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"MongoDB URL: {MONGO_URL}")
    print(f"Database: {DB_NAME}")
    
    results = []
    
    # Test 1: Unauthenticated access
    results.append(("Test 1: CRM Auth Me (unauthenticated)", test_1_crm_auth_me_unauthenticated()))
    
    # Test 2: Admin access via mock login
    auth_token = test_2_admin_access_via_mock_login()
    if auth_token:
        results.append(("Test 2: Admin access via mock login", True))
    else:
        results.append(("Test 2: Admin access via mock login", False))
        print("\n❌ Cannot continue with remaining tests without admin auth token")
        print_summary(results)
        return
    
    # Test 3: Send magic link
    results.append(("Test 3: Send magic link", test_3_send_magic_link(auth_token)))
    
    # Test 4: Verify invalid magic link token
    results.append(("Test 4: Verify invalid magic link token", test_4_verify_invalid_magic_link_token()))
    
    # Test 5: Role-based access
    results.append(("Test 5: Role-based access", test_5_role_based_access(auth_token)))
    
    # Test 6: Logout
    results.append(("Test 6: Logout", test_6_logout(auth_token)))
    
    # Print summary
    print_summary(results)

def print_summary(results):
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    main()
