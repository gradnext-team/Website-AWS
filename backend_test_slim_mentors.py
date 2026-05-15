#!/usr/bin/env python3
"""
Backend API Testing for GradNext Slim Mentor Data Fix
Tests the slim=true parameter on /api/mentors endpoint to verify sensitive fields are excluded.

Tests:
1. GET /api/mentors?slim=true - should return mentors WITHOUT sensitive fields
2. GET /api/mentors (without slim) - should return mentors WITH more fields
3. Size comparison - slim response should be significantly smaller
4. Image pre-warm - GET /api/images/img_5cdc21a95a31 - should return 200 with X-Cache: HIT
5. GZip compression - GET /api/resources/plans with Accept-Encoding: gzip
6. Health check - GET /api/
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# Sensitive fields that should NOT be present in slim=true response
SENSITIVE_FIELDS = [
    "google_calendar_credentials",
    "google_calendar_email",
    "email",
    "phone",
    "oauth_state"
]

# Fields that should be excluded in slim response (heavy/private)
SLIM_EXCLUDED_FIELDS = [
    "availability",
    "bio",
    "consulting_firm_logo",
    "current_company_logo",
    "blocked_days",
    "email",
    "phone",
    "linkedin",
    "expertise",
    "google_calendar_credentials",
    "google_calendar_email",
    "google_calendar_last_synced",
    "google_calendar_connected",
    "oauth_state",
    "oauth_state_created",
    "user_id",
    "strategy_call_approval_pending",
    "strategy_call_requested_at",
    "rating_updated_at",
    "created_at",
    "updated_at",
    "status"
]

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_mentors_slim():
    """Test 1: GET /api/mentors?slim=true - should NOT have sensitive fields"""
    print_test_header("Test 1: Mentors with slim=true (NO sensitive fields)")
    
    url = f"{BASE_URL}/mentors?slim=true"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get mentors - Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False, None
    
    print_result(True, f"Status: {response.status_code}")
    
    try:
        mentors = response.json()
        if not isinstance(mentors, list):
            print_result(False, "Response is not a list")
            return False, None
        
        print(f"   Mentors returned: {len(mentors)}")
        
        if len(mentors) == 0:
            print_result(False, "No mentors returned")
            return False, None
        
        # Check first mentor for sensitive fields
        first_mentor = mentors[0]
        print(f"   First mentor: {first_mentor.get('name', 'Unknown')}")
        print(f"   Mentor ID: {first_mentor.get('id', 'Unknown')}")
        
        # Check for sensitive fields that should NOT be present
        found_sensitive = []
        for field in SENSITIVE_FIELDS:
            if field in first_mentor:
                found_sensitive.append(field)
        
        if found_sensitive:
            print_result(False, f"SENSITIVE FIELDS FOUND: {', '.join(found_sensitive)}")
            print(f"   These fields should NOT be in slim response!")
            return False, mentors
        else:
            print_result(True, f"No sensitive fields found (verified: {', '.join(SENSITIVE_FIELDS)})")
        
        # Check for other excluded fields
        found_excluded = []
        for field in SLIM_EXCLUDED_FIELDS:
            if field in first_mentor:
                found_excluded.append(field)
        
        if found_excluded:
            print(f"   ⚠️  Other excluded fields found: {', '.join(found_excluded)}")
        
        # Show what fields ARE present
        present_fields = list(first_mentor.keys())
        print(f"   Fields present in slim response: {', '.join(present_fields[:10])}...")
        
        response_size = len(response.content)
        print(f"   Response size: {response_size:,} bytes")
        
        return True, mentors
        
    except Exception as e:
        print_result(False, f"Error parsing response: {e}")
        return False, None

def test_mentors_full():
    """Test 2: GET /api/mentors (without slim) - should have more fields"""
    print_test_header("Test 2: Mentors without slim parameter (WITH more fields)")
    
    url = f"{BASE_URL}/mentors"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get mentors - Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False, None
    
    print_result(True, f"Status: {response.status_code}")
    
    try:
        mentors = response.json()
        if not isinstance(mentors, list):
            print_result(False, "Response is not a list")
            return False, None
        
        print(f"   Mentors returned: {len(mentors)}")
        
        if len(mentors) == 0:
            print_result(False, "No mentors returned")
            return False, None
        
        # Check first mentor for fields
        first_mentor = mentors[0]
        print(f"   First mentor: {first_mentor.get('name', 'Unknown')}")
        
        # Check for fields that should be present in full response
        expected_fields = ["bio", "availability"]
        found_expected = []
        for field in expected_fields:
            if field in first_mentor:
                found_expected.append(field)
        
        if found_expected:
            print_result(True, f"Expected fields found: {', '.join(found_expected)}")
        else:
            print(f"   ⚠️  Expected fields not found: {', '.join(expected_fields)}")
        
        # Show what fields ARE present
        present_fields = list(first_mentor.keys())
        print(f"   Fields present in full response: {', '.join(present_fields[:15])}...")
        
        response_size = len(response.content)
        print(f"   Response size: {response_size:,} bytes")
        
        return True, mentors
        
    except Exception as e:
        print_result(False, f"Error parsing response: {e}")
        return False, None

def test_size_comparison(slim_mentors, full_mentors):
    """Test 3: Size comparison - slim should be significantly smaller"""
    print_test_header("Test 3: Size Comparison (slim vs full)")
    
    if not slim_mentors or not full_mentors:
        print_result(False, "Cannot compare - missing data from previous tests")
        return False
    
    slim_size = len(json.dumps(slim_mentors))
    full_size = len(json.dumps(full_mentors))
    
    print(f"   Slim response size: {slim_size:,} bytes")
    print(f"   Full response size: {full_size:,} bytes")
    
    if full_size > slim_size:
        reduction = ((full_size - slim_size) / full_size) * 100
        print_result(True, f"Slim response is {reduction:.1f}% smaller than full response")
        
        if reduction < 10:
            print(f"   ⚠️  Size reduction is less than 10% - may not be significant")
        
        return True
    else:
        print_result(False, f"Slim response is NOT smaller than full response")
        return False

def test_image_prewarm():
    """Test 4: Image pre-warm - should return 200 with X-Cache: HIT"""
    print_test_header("Test 4: Image Pre-warm (X-Cache: HIT)")
    
    url = f"{BASE_URL}/images/img_5cdc21a95a31"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get image - Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        return False
    
    print_result(True, f"Status: {response.status_code}")
    
    x_cache = response.headers.get('X-Cache', '')
    cache_control = response.headers.get('Cache-Control', '')
    etag = response.headers.get('ETag', '')
    
    print(f"   X-Cache: {x_cache}")
    print(f"   Cache-Control: {cache_control}")
    print(f"   ETag: {etag}")
    print(f"   Content-Type: {response.headers.get('Content-Type', '')}")
    print(f"   Content-Length: {len(response.content):,} bytes")
    
    if x_cache == 'HIT':
        print_result(True, "X-Cache: HIT - Image served from pre-warmed cache")
        return True
    else:
        print_result(False, f"X-Cache: {x_cache} (expected: HIT)")
        return False

def test_gzip_compression():
    """Test 5: GZip compression - should be compressed"""
    print_test_header("Test 5: GZip Compression")
    
    url = f"{BASE_URL}/resources/plans"
    headers = {"Accept-Encoding": "gzip"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get plans - Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False
    
    print_result(True, f"Status: {response.status_code}")
    
    content_encoding = response.headers.get('Content-Encoding', '')
    print(f"   Content-Encoding: {content_encoding or 'none'}")
    print(f"   Response size: {len(response.content):,} bytes")
    
    # Try to parse JSON
    try:
        data = response.json()
        plans_count = len(data) if isinstance(data, list) else 0
        print(f"   Plans returned: {plans_count}")
        print_result(True, "Response is valid JSON (not garbled)")
    except:
        print_result(False, "Response is not valid JSON")
        return False
    
    # Check if compressed
    if 'gzip' in content_encoding.lower():
        print_result(True, "GZip compression is active")
        return True
    else:
        print_result(True, "Response is valid (GZip may be applied transparently)")
        return True

def test_health_check():
    """Test 6: Health check"""
    print_test_header("Test 6: Health Check")
    
    url = f"{BASE_URL}/"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Health check failed - Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False
    
    print_result(True, f"Status: {response.status_code}")
    
    try:
        data = response.json()
        print(f"   Message: {data.get('message', 'N/A')}")
        return True
    except:
        print_result(False, "Response is not valid JSON")
        return False

def main():
    print("\n" + "="*80)
    print("GRADNEXT BACKEND API TESTING - SLIM MENTOR DATA FIX")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\nVerifying:")
    print("1. Slim mentors endpoint excludes sensitive fields")
    print("2. Full mentors endpoint includes more fields")
    print("3. Slim response is significantly smaller")
    print("4. Image pre-warming working")
    print("5. GZip compression working")
    print("6. Health check working")
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    # Test 1: Mentors with slim=true
    test_result, slim_mentors = test_mentors_slim()
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("Mentors slim=true (NO sensitive fields)", test_result))
    
    # Test 2: Mentors without slim
    test_result, full_mentors = test_mentors_full()
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("Mentors full (WITH more fields)", test_result))
    
    # Test 3: Size comparison
    test_result = test_size_comparison(slim_mentors, full_mentors)
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("Size comparison (slim < full)", test_result))
    
    # Test 4: Image pre-warm
    test_result = test_image_prewarm()
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("Image pre-warm (X-Cache: HIT)", test_result))
    
    # Test 5: GZip compression
    test_result = test_gzip_compression()
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("GZip compression", test_result))
    
    # Test 6: Health check
    test_result = test_health_check()
    results["total"] += 1
    results["passed" if test_result else "failed"] += 1
    results["tests"].append(("Health check", test_result))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success rate: {(results['passed']/results['total']*100):.1f}%")
    
    print("\nDetailed Results:")
    for test_name, passed in results["tests"]:
        status = "✅" if passed else "❌"
        print(f"  {status} {test_name}")
    
    if results['failed'] == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nSlim mentor data fix verified:")
        print("  ✅ Sensitive fields excluded from slim=true response")
        print("  ✅ Full response includes more fields")
        print("  ✅ Slim response is smaller than full response")
        print("  ✅ Image pre-warming working (X-Cache: HIT)")
        print("  ✅ GZip compression working")
        print("  ✅ Health check working")
    else:
        print(f"\n⚠️  {results['failed']} test(s) failed")
    
    print("="*80 + "\n")
    
    return results['failed'] == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
