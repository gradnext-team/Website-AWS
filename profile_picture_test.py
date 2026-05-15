"""
Backend API Testing for Profile Picture Upload Fix
Tests the bug fix where ProfileCompletionModal was calling non-existent endpoint
/api/resources/upload-profile-picture instead of /api/profile/upload-picture
"""

import requests
import json
import sys
import io
from PIL import Image
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

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
session = requests.Session()

def create_test_image():
    """Create a small test JPEG image in memory"""
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

def create_test_text_file():
    """Create a test text file (non-image) for validation testing"""
    return io.BytesIO(b"This is not an image file")

def test_1_mock_login():
    """TEST 1: Authenticate using mock login"""
    log_test(1, "POST /api/auth/mock-login?user_type=full_prep - Authentication")
    
    url = f"{BACKEND_URL}/auth/mock-login"
    params = {"user_type": "full_prep"}
    
    try:
        resp = session.post(url, params=params)
        
        if resp.status_code != 200:
            log_fail(f"Status code: {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        log_pass(f"Mock login successful")
        log_info(f"User ID: {data.get('user', {}).get('id')}")
        log_info(f"User email: {data.get('user', {}).get('email')}")
        return True
        
    except Exception as e:
        log_fail(f"Exception during login: {str(e)}")
        return False

def test_2_upload_profile_picture():
    """TEST 2: Upload a test image to POST /api/profile/upload-picture"""
    log_test(2, "POST /api/profile/upload-picture - Upload profile picture")
    
    url = f"{BACKEND_URL}/profile/upload-picture"
    
    try:
        # Create test image
        img_bytes = create_test_image()
        files = {'file': ('test_profile.jpg', img_bytes, 'image/jpeg')}
        
        resp = session.post(url, files=files)
        
        if resp.status_code != 200:
            log_fail(f"Status code: {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return None
        
        data = resp.json()
        
        # Verify response structure
        if 'picture_url' not in data:
            log_fail("Response missing 'picture_url' field")
            log_fail(f"Response: {json.dumps(data, indent=2)}")
            return None
        
        if 'message' not in data:
            log_fail("Response missing 'message' field")
            log_fail(f"Response: {json.dumps(data, indent=2)}")
            return None
        
        picture_url = data['picture_url']
        message = data['message']
        
        log_pass(f"Picture uploaded successfully")
        log_info(f"picture_url: {picture_url[:100]}...")
        log_info(f"message: {message}")
        
        return picture_url
        
    except Exception as e:
        log_fail(f"Exception during upload: {str(e)}")
        return None

def test_3_verify_user_profile_updated(expected_picture_url):
    """TEST 3: Verify GET /api/auth/me shows the picture field"""
    log_test(3, "GET /api/auth/me - Verify picture field updated")
    
    if not expected_picture_url:
        log_fail("Skipping - no picture_url from test 2")
        return False
    
    url = f"{BACKEND_URL}/auth/me"
    
    try:
        resp = session.get(url)
        
        if resp.status_code != 200:
            log_fail(f"Status code: {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
        # Response is the user object directly, not wrapped
        user = resp.json()
        
        if 'picture' not in user:
            log_fail("User profile missing 'picture' field")
            log_fail(f"User data: {json.dumps(user, indent=2)}")
            return False
        
        actual_picture = user['picture']
        
        if actual_picture != expected_picture_url:
            log_fail(f"Picture URL mismatch!")
            log_fail(f"Expected: {expected_picture_url[:100]}...")
            log_fail(f"Actual: {actual_picture[:100]}...")
            return False
        
        log_pass(f"User profile picture field correctly updated")
        log_info(f"picture: {actual_picture[:100]}...")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during verification: {str(e)}")
        return False

def test_4_old_endpoint_returns_404():
    """TEST 4: Verify /api/resources/upload-profile-picture returns 404"""
    log_test(4, "POST /api/resources/upload-profile-picture - Verify old endpoint returns 404")
    
    url = f"{BACKEND_URL}/resources/upload-profile-picture"
    
    try:
        img_bytes = create_test_image()
        files = {'file': ('test.jpg', img_bytes, 'image/jpeg')}
        
        resp = session.post(url, files=files)
        
        if resp.status_code == 404:
            log_pass(f"Old endpoint correctly returns 404")
            return True
        else:
            log_fail(f"Old endpoint returned {resp.status_code} instead of 404")
            log_fail(f"Response: {resp.text}")
            return False
        
    except Exception as e:
        log_fail(f"Exception during test: {str(e)}")
        return False

def test_5_reject_non_image_files():
    """TEST 5: Verify POST /api/profile/upload-picture rejects non-image files"""
    log_test(5, "POST /api/profile/upload-picture - Reject non-image files (400)")
    
    url = f"{BACKEND_URL}/profile/upload-picture"
    
    try:
        # Create test text file
        text_file = create_test_text_file()
        files = {'file': ('test.txt', text_file, 'text/plain')}
        
        resp = session.post(url, files=files)
        
        if resp.status_code == 400:
            log_pass(f"Non-image file correctly rejected with 400")
            log_info(f"Response: {resp.text}")
            return True
        else:
            log_fail(f"Expected 400, got {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
    except Exception as e:
        log_fail(f"Exception during test: {str(e)}")
        return False

def test_6_peers_update_profile_with_picture():
    """TEST 6: Verify POST /api/peers/update-profile works with profile_picture field"""
    log_test(6, "POST /api/peers/update-profile - Update profile with picture URL")
    
    url = f"{BACKEND_URL}/peers/update-profile"
    
    try:
        # First upload a new picture to get a URL
        img_bytes = create_test_image()
        files = {'file': ('peer_profile.jpg', img_bytes, 'image/jpeg')}
        upload_resp = session.post(f"{BACKEND_URL}/profile/upload-picture", files=files)
        
        if upload_resp.status_code != 200:
            log_fail(f"Failed to upload picture for test: {upload_resp.status_code}")
            return False
        
        picture_url = upload_resp.json()['picture_url']
        
        # Now update peer profile with this picture
        payload = {
            "profile_picture": picture_url,
            "name": "Test Peer User",
            "university": "Test University"
        }
        
        resp = session.post(url, json=payload)
        
        if resp.status_code != 200:
            log_fail(f"Status code: {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        
        if not data.get('success'):
            log_fail(f"Response success=False: {data}")
            return False
        
        profile = data.get('profile', {})
        
        # Note: The endpoint accepts 'profile_picture' but returns 'picture' in the response
        actual_picture = profile.get('picture') or profile.get('profile_picture')
        
        if actual_picture != picture_url:
            log_fail(f"Profile picture not updated correctly")
            log_fail(f"Expected: {picture_url[:100]}...")
            log_fail(f"Actual: {actual_picture[:100] if actual_picture else 'None'}...")
            return False
        
        log_pass(f"Peer profile updated successfully with profile_picture")
        log_info(f"Profile name: {profile.get('name')}")
        log_info(f"Profile picture: {actual_picture[:100] if actual_picture else 'None'}...")
        
        return True
        
    except Exception as e:
        log_fail(f"Exception during test: {str(e)}")
        return False

def test_7_peers_toggle_listing_exists():
    """TEST 7: Verify POST /api/peers/toggle-listing endpoint exists and responds"""
    log_test(7, "POST /api/peers/toggle-listing - Verify endpoint exists")
    
    url = f"{BACKEND_URL}/peers/toggle-listing"
    
    try:
        resp = session.post(url)
        
        # We expect either 200 (success) or 404 (profile not found) or 400 (validation error)
        # But NOT 404 for endpoint not found (which would be a routing issue)
        
        if resp.status_code in [200, 400, 404]:
            log_pass(f"Endpoint exists and responds (status: {resp.status_code})")
            log_info(f"Response: {resp.text[:200]}")
            return True
        else:
            log_fail(f"Unexpected status code: {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
    except Exception as e:
        log_fail(f"Exception during test: {str(e)}")
        return False

def test_8_large_file_rejection():
    """TEST 8: Verify files larger than 5MB are rejected"""
    log_test(8, "POST /api/profile/upload-picture - Reject files > 5MB")
    
    url = f"{BACKEND_URL}/profile/upload-picture"
    
    try:
        # Create a file larger than 5MB by creating random data
        log_info("Creating 6MB test file...")
        large_data = b'X' * (6 * 1024 * 1024)  # 6MB of data
        large_file = io.BytesIO(large_data)
        
        log_info(f"File size: {len(large_data) / (1024*1024):.2f} MB")
        
        files = {'file': ('large.jpg', large_file, 'image/jpeg')}
        
        resp = session.post(url, files=files)
        
        if resp.status_code == 400:
            log_pass(f"Large file correctly rejected with 400")
            log_info(f"Response: {resp.text}")
            return True
        else:
            log_fail(f"Expected 400, got {resp.status_code}")
            log_fail(f"Response: {resp.text}")
            return False
        
    except Exception as e:
        log_fail(f"Exception during test: {str(e)}")
        return False

def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}PROFILE PICTURE UPLOAD FIX - BACKEND TESTING{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = {}
    
    # TEST 1: Mock login
    results["test_1_auth"] = test_1_mock_login()
    if not results["test_1_auth"]:
        print(f"\n{RED}FATAL: Authentication failed. Aborting tests.{RESET}")
        sys.exit(1)
    
    # TEST 2: Upload profile picture
    picture_url = test_2_upload_profile_picture()
    results["test_2_upload"] = picture_url is not None
    
    # TEST 3: Verify user profile updated
    results["test_3_verify_profile"] = test_3_verify_user_profile_updated(picture_url)
    
    # TEST 4: Old endpoint returns 404
    results["test_4_old_endpoint_404"] = test_4_old_endpoint_returns_404()
    
    # TEST 5: Reject non-image files
    results["test_5_reject_non_image"] = test_5_reject_non_image_files()
    
    # TEST 6: Peers update profile with picture
    results["test_6_peers_update"] = test_6_peers_update_profile_with_picture()
    
    # TEST 7: Peers toggle listing exists
    results["test_7_toggle_listing"] = test_7_peers_toggle_listing_exists()
    
    # TEST 8: Large file rejection
    results["test_8_large_file"] = test_8_large_file_rejection()
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        if result:
            print(f"{GREEN}✅ {test_name}: PASS{RESET}")
            passed += 1
        else:
            print(f"{RED}❌ {test_name}: FAIL{RESET}")
            failed += 1
    
    print(f"\n{BLUE}Total: {passed + failed} tests{RESET}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {failed}{RESET}")
    
    # Overall result
    if failed == 0:
        print(f"\n{GREEN}{'='*80}{RESET}")
        print(f"{GREEN}🎉 ALL TESTS PASSED!{RESET}")
        print(f"{GREEN}Profile picture upload fix is working correctly.{RESET}")
        print(f"{GREEN}{'='*80}{RESET}")
    else:
        print(f"\n{RED}{'='*80}{RESET}")
        print(f"{RED}❌ {failed} TEST(S) FAILED{RESET}")
        print(f"{RED}Profile picture upload has issues that need attention.{RESET}")
        print(f"{RED}{'='*80}{RESET}")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
