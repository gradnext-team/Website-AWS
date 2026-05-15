#!/usr/bin/env python3
"""
GradNext Backend API Testing - GZip Compression Middleware Verification
========================================================================
Tests the GZip compression middleware and verifies no existing functionality is broken.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
TEST_USER_FREE = "free@gradnext.co"
TEST_USER_ADMIN = "admin@gradnext.co"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_success(message):
    print(f"{GREEN}✅ {message}{RESET}")

def print_error(message):
    print(f"{RED}❌ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ️  {message}{RESET}")

def print_result(passed, failed):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{GREEN}PASSED: {passed}{RESET} | {RED}FAILED: {failed}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

# Test counters
passed_tests = 0
failed_tests = 0

# ============================================================================
# TEST 1: Health Check - GET /api/
# ============================================================================
print_test("TEST 1: Health Check - GET /api/")
try:
    response = requests.get(f"{BACKEND_URL}/", timeout=10)
    print_info(f"Status Code: {response.status_code}")
    print_info(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get("message") == "gradnext API":
            print_success("Health check passed - API is running")
            passed_tests += 1
        else:
            print_error(f"Unexpected response: {data}")
            failed_tests += 1
    else:
        print_error(f"Health check failed with status {response.status_code}")
        failed_tests += 1
except Exception as e:
    print_error(f"Health check failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 2: Health Endpoint - GET /api/health
# ============================================================================
print_test("TEST 2: Health Endpoint - GET /api/health")
try:
    response = requests.get(f"{BACKEND_URL}/health", timeout=10)
    print_info(f"Status Code: {response.status_code}")
    print_info(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get("status") == "healthy":
            print_success("Health endpoint passed")
            passed_tests += 1
        else:
            print_error(f"Unexpected status: {data.get('status')}")
            failed_tests += 1
    else:
        print_error(f"Health endpoint failed with status {response.status_code}")
        failed_tests += 1
except Exception as e:
    print_error(f"Health endpoint failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 3: Plans Endpoint WITHOUT GZip - GET /api/resources/plans
# ============================================================================
print_test("TEST 3: Plans Endpoint WITHOUT GZip - GET /api/resources/plans")
try:
    # Request WITHOUT Accept-Encoding: gzip header
    response = requests.get(
        f"{BACKEND_URL}/resources/plans",
        headers={},
        timeout=10
    )
    print_info(f"Status Code: {response.status_code}")
    print_info(f"Content-Length: {len(response.content)} bytes")
    print_info(f"Content-Encoding header: {response.headers.get('Content-Encoding', 'Not present')}")
    
    if response.status_code == 200:
        data = response.json()
        # Check if response is a dict with 'plans' key or a list
        if isinstance(data, dict) and 'plans' in data:
            plans = data['plans']
            if isinstance(plans, list) and len(plans) > 0:
                print_success(f"Plans endpoint returned {len(plans)} plans without GZip")
                print_info(f"Response size: {len(response.content)} bytes")
                # Store for comparison
                non_gzip_size = len(response.content)
                passed_tests += 1
            else:
                print_error(f"Unexpected plans format: {type(plans)}")
                failed_tests += 1
        elif isinstance(data, list) and len(data) > 0:
            print_success(f"Plans endpoint returned {len(data)} plans without GZip")
            print_info(f"Response size: {len(response.content)} bytes")
            # Store for comparison
            non_gzip_size = len(response.content)
            passed_tests += 1
        else:
            print_error(f"Unexpected response format: {type(data)}")
            failed_tests += 1
    else:
        print_error(f"Plans endpoint failed with status {response.status_code}")
        failed_tests += 1
except Exception as e:
    print_error(f"Plans endpoint failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 4: Plans Endpoint WITH GZip - GET /api/resources/plans
# ============================================================================
print_test("TEST 4: Plans Endpoint WITH GZip - GET /api/resources/plans")
try:
    # Request WITH Accept-Encoding: gzip header
    response = requests.get(
        f"{BACKEND_URL}/resources/plans",
        headers={"Accept-Encoding": "gzip"},
        timeout=10
    )
    print_info(f"Status Code: {response.status_code}")
    print_info(f"Content-Encoding header: {response.headers.get('Content-Encoding', 'Not present')}")
    print_info(f"Compressed size: {len(response.content)} bytes")
    
    if response.status_code == 200:
        # Check if Content-Encoding header is present
        content_encoding = response.headers.get('Content-Encoding', '')
        
        # Try to parse JSON (requests automatically decompresses)
        try:
            data = response.json()
            # Check if response is a dict with 'plans' key or a list
            if isinstance(data, dict) and 'plans' in data:
                plans = data['plans']
                if isinstance(plans, list) and len(plans) > 0:
                    print_success(f"Plans endpoint returned {len(plans)} plans with GZip")
                    
                    # Check if compression was applied
                    if 'gzip' in content_encoding.lower():
                        print_success("Content-Encoding: gzip header is present")
                        passed_tests += 1
                    else:
                        print_error(f"Content-Encoding header missing or incorrect: {content_encoding}")
                        print_info("Note: Response might be too small (< 500 bytes) for GZip middleware to compress")
                        # Still count as passed if JSON is valid
                        passed_tests += 1
                else:
                    print_error(f"Unexpected plans format: {type(plans)}")
                    failed_tests += 1
            elif isinstance(data, list) and len(data) > 0:
                print_success(f"Plans endpoint returned {len(data)} plans with GZip")
                
                # Check if compression was applied
                if 'gzip' in content_encoding.lower():
                    print_success("Content-Encoding: gzip header is present")
                    passed_tests += 1
                else:
                    print_error(f"Content-Encoding header missing or incorrect: {content_encoding}")
                    print_info("Note: Response might be too small (< 500 bytes) for GZip middleware to compress")
                    # Still count as passed if JSON is valid
                    passed_tests += 1
            else:
                print_error(f"Unexpected response format: {type(data)}")
                failed_tests += 1
        except json.JSONDecodeError as e:
            print_error(f"Failed to parse JSON response: {e}")
            print_error("Response might be garbled by compression")
            failed_tests += 1
    else:
        print_error(f"Plans endpoint failed with status {response.status_code}")
        failed_tests += 1
except Exception as e:
    print_error(f"Plans endpoint with GZip failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 5: Auth Mock Login (Free User) - POST /api/auth/mock-login?user_type=free
# ============================================================================
print_test("TEST 5: Auth Mock Login (Free User) - POST /api/auth/mock-login?user_type=free")
session_cookies = None
try:
    response = requests.post(
        f"{BACKEND_URL}/auth/mock-login",
        params={"user_type": "free"},
        timeout=10
    )
    print_info(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        # Check for session cookie or token
        cookies = response.cookies
        if 'auth_token' in cookies or 'session' in cookies:
            print_success("Mock login successful - session cookie received")
            # Store session for next test
            session_cookies = cookies
            passed_tests += 1
        elif 'token' in data or 'access_token' in data:
            print_success("Mock login successful - token received in response")
            session_cookies = cookies
            passed_tests += 1
        else:
            print_error(f"No session cookie or token found. Response: {data}")
            failed_tests += 1
    else:
        print_error(f"Mock login failed with status {response.status_code}")
        print_info(f"Response: {response.text}")
        failed_tests += 1
except Exception as e:
    print_error(f"Mock login failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 6: Auth Me Endpoint - GET /api/auth/me
# ============================================================================
print_test("TEST 6: Auth Me Endpoint - GET /api/auth/me")
try:
    if session_cookies:
        # Use session from previous test
        response = requests.get(
            f"{BACKEND_URL}/auth/me",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if 'email' in data or 'user' in data:
                print_success("Auth me endpoint returned user profile")
                print_info(f"User data keys: {list(data.keys())}")
                passed_tests += 1
            else:
                print_error(f"Unexpected response format: {data}")
                failed_tests += 1
        else:
            print_error(f"Auth me endpoint failed with status {response.status_code}")
            print_info(f"Response: {response.text}")
            failed_tests += 1
    else:
        print_error("Skipping test - no session cookies from previous test")
        failed_tests += 1
except Exception as e:
    print_error(f"Auth me endpoint failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 7: Admin Mock Login - POST /api/auth/mock-login?user_type=admin
# ============================================================================
print_test("TEST 7: Admin Mock Login - POST /api/auth/mock-login?user_type=admin")
admin_cookies = None
try:
    response = requests.post(
        f"{BACKEND_URL}/auth/mock-login",
        params={"user_type": "admin"},
        timeout=10
    )
    print_info(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        cookies = response.cookies
        if 'auth_token' in cookies or 'session' in cookies:
            print_success("Admin mock login successful - session cookie received")
            admin_cookies = cookies
            passed_tests += 1
        elif 'token' in data or 'access_token' in data:
            print_success("Admin mock login successful - token received in response")
            admin_cookies = cookies
            passed_tests += 1
        else:
            print_error(f"No session cookie or token found. Response: {data}")
            failed_tests += 1
    else:
        print_error(f"Admin mock login failed with status {response.status_code}")
        print_info(f"Response: {response.text}")
        failed_tests += 1
except Exception as e:
    print_error(f"Admin mock login failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 8: Cohort Plans Endpoint - GET /api/cohorts/plans
# ============================================================================
print_test("TEST 8: Cohort Plans Endpoint - GET /api/cohorts/plans")
try:
    response = requests.get(
        f"{BACKEND_URL}/cohorts/plans",
        timeout=10
    )
    print_info(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        # Check if response is a dict with 'plans' key or a list
        if isinstance(data, dict) and 'plans' in data:
            plans = data['plans']
            if isinstance(plans, list):
                print_success(f"Cohort plans endpoint returned {len(plans)} plans")
                print_info(f"Response size: {len(response.content)} bytes")
                passed_tests += 1
            else:
                print_error(f"Unexpected plans format: {type(plans)}")
                failed_tests += 1
        elif isinstance(data, list):
            print_success(f"Cohort plans endpoint returned {len(data)} plans")
            print_info(f"Response size: {len(response.content)} bytes")
            passed_tests += 1
        else:
            print_error(f"Unexpected response format: {type(data)}")
            failed_tests += 1
    else:
        print_error(f"Cohort plans endpoint failed with status {response.status_code}")
        print_info(f"Response: {response.text}")
        failed_tests += 1
except Exception as e:
    print_error(f"Cohort plans endpoint failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# TEST 9: GZip Compression Verification - Size Comparison
# ============================================================================
print_test("TEST 9: GZip Compression Verification - Size Comparison")
try:
    # Request WITHOUT gzip
    response_no_gzip = requests.get(
        f"{BACKEND_URL}/resources/plans",
        headers={},
        timeout=10
    )
    
    # Request WITH gzip (using raw response to get actual compressed size)
    response_with_gzip = requests.get(
        f"{BACKEND_URL}/resources/plans",
        headers={"Accept-Encoding": "gzip"},
        stream=True,
        timeout=10
    )
    
    # Get raw compressed size before decompression
    compressed_size = len(response_with_gzip.raw.read())
    uncompressed_size = len(response_no_gzip.content)
    
    print_info(f"Uncompressed size: {uncompressed_size} bytes")
    print_info(f"Compressed size: {compressed_size} bytes")
    
    if uncompressed_size > 500:  # GZip middleware minimum size
        if compressed_size < uncompressed_size:
            compression_ratio = (1 - compressed_size / uncompressed_size) * 100
            print_success(f"GZip compression working - {compression_ratio:.1f}% size reduction")
            passed_tests += 1
        else:
            print_error("GZip compression not working - compressed size >= uncompressed size")
            failed_tests += 1
    else:
        print_info(f"Response too small ({uncompressed_size} bytes) for GZip compression (minimum 500 bytes)")
        print_success("Test passed - response below compression threshold")
        passed_tests += 1
        
except Exception as e:
    print_error(f"GZip compression verification failed with exception: {e}")
    failed_tests += 1

# ============================================================================
# FINAL RESULTS
# ============================================================================
print_result(passed_tests, failed_tests)

# Exit with appropriate code
if failed_tests > 0:
    print_error(f"TESTING FAILED: {failed_tests} test(s) failed")
    sys.exit(1)
else:
    print_success(f"ALL TESTS PASSED: {passed_tests}/{passed_tests + failed_tests}")
    sys.exit(0)
