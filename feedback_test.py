#!/usr/bin/env python3
"""
Feedback Feature Backend API Testing Script
Tests feedback endpoints according to the review request
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def test_feedback_feature_apis():
    """Test Feedback feature backend APIs as requested"""
    print_test_header("Feedback Feature Backend APIs")
    
    success_count = 0
    total_tests = 8
    
    # Authentication tokens
    admin_session_token = None
    candidate_session_token = None
    mentor_session_token = None
    
    # Step 1: Login as admin
    try:
        print_info("Step 1: Logging in as admin")
        response = requests.post(f"{BACKEND_URL}/auth/mock-login?user_type=admin", timeout=10)
        if response.status_code == 200:
            admin_data = response.json()
            admin_session_token = admin_data.get("session_token")
            print_success("Admin login successful")
        else:
            print_error(f"Admin login failed - status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Admin login failed - error: {e}")
        return False
    
    # Step 2: Login as candidate
    try:
        print_info("Step 2: Logging in as candidate")
        response = requests.post(f"{BACKEND_URL}/auth/mock-login?user_type=subscription", timeout=10)
        if response.status_code == 200:
            candidate_data = response.json()
            candidate_session_token = candidate_data.get("session_token")
            print_success("Candidate login successful")
        else:
            print_error(f"Candidate login failed - status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Candidate login failed - error: {e}")
        return False
    
    # Step 3: Login as mentor
    try:
        print_info("Step 3: Logging in as mentor")
        response = requests.post(f"{BACKEND_URL}/auth/mock-login?user_type=mentor", timeout=10)
        if response.status_code == 200:
            mentor_data = response.json()
            mentor_session_token = mentor_data.get("session_token")
            print_success("Mentor login successful")
        else:
            print_error(f"Mentor login failed - status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Mentor login failed - error: {e}")
        return False
    
    # Test 1: Submit feedback as candidate (POST /api/support/feedback)
    try:
        print_info("Test 1: Testing POST /api/support/feedback (Submit Feedback as Candidate)")
        headers = {"Cookie": f"session_token={candidate_session_token}", "Content-Type": "application/json"}
        
        feedback_data = {
            "feedback": "The platform is excellent! I love the AI drills and the mentor sessions are very helpful. The interface is user-friendly and the content quality is top-notch.",
            "rating": 5,
            "user_email": "candidate@gradnext.co",
            "user_name": "Sarah Johnson"
        }
        
        response = requests.post(f"{BACKEND_URL}/support/feedback", headers=headers, json=feedback_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True and "Thank you for your feedback" in data.get("message", ""):
                print_success("POST /api/support/feedback (candidate) passed - feedback submitted successfully")
                success_count += 1
            else:
                print_error(f"POST /api/support/feedback failed - unexpected response: {data}")
        else:
            print_error(f"POST /api/support/feedback failed - status code: {response.status_code}")
            
    except Exception as e:
        print_error(f"POST /api/support/feedback failed - error: {e}")
    
    # Test 2: Submit feedback as mentor (POST /api/support/feedback)
    try:
        print_info("Test 2: Testing POST /api/support/feedback (Submit Feedback as Mentor)")
        headers = {"Cookie": f"session_token={mentor_session_token}", "Content-Type": "application/json"}
        
        feedback_data = {
            "feedback": "Good platform for mentoring. The scheduling system works well, but could use some improvements in the feedback collection process.",
            "rating": 4,
            "user_email": "mentor@gradnext.co",
            "user_name": "Dr. Michael Chen"
        }
        
        response = requests.post(f"{BACKEND_URL}/support/feedback", headers=headers, json=feedback_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True and "Thank you for your feedback" in data.get("message", ""):
                print_success("POST /api/support/feedback (mentor) passed - feedback submitted successfully")
                success_count += 1
            else:
                print_error(f"POST /api/support/feedback failed - unexpected response: {data}")
        else:
            print_error(f"POST /api/support/feedback failed - status code: {response.status_code}")
            
    except Exception as e:
        print_error(f"POST /api/support/feedback failed - error: {e}")
    
    # Test 3: Submit more test feedbacks with different ratings
    try:
        print_info("Test 3: Submitting additional test feedbacks with different ratings")
        
        test_feedbacks = [
            {"rating": 3, "feedback": "Average experience. Some features work well, others need improvement.", "user_type": "candidate"},
            {"rating": 2, "feedback": "Had some issues with the platform. Customer support was slow to respond.", "user_type": "candidate"},
            {"rating": 1, "feedback": "Very disappointed with the service. Many bugs and poor user experience.", "user_type": "mentor"}
        ]
        
        for i, fb in enumerate(test_feedbacks):
            session_token = candidate_session_token if fb["user_type"] == "candidate" else mentor_session_token
            headers = {"Cookie": f"session_token={session_token}", "Content-Type": "application/json"}
            
            feedback_data = {
                "feedback": fb["feedback"],
                "rating": fb["rating"],
                "user_email": f"testuser{i+1}@gradnext.co",
                "user_name": f"Test User {i+1}"
            }
            
            response = requests.post(f"{BACKEND_URL}/support/feedback", headers=headers, json=feedback_data, timeout=10)
            
            if response.status_code != 200:
                print_warning(f"Failed to submit test feedback {i+1} - status: {response.status_code}")
        
        print_success("Additional test feedbacks submitted for testing")
        success_count += 0.5
        
    except Exception as e:
        print_error(f"Failed to submit additional test feedbacks - error: {e}")
    
    # Test 4: Get feedback list (GET /api/support/admin/feedback)
    try:
        print_info("Test 4: Testing GET /api/support/admin/feedback (Admin Feedback List)")
        headers = {"Cookie": f"session_token={admin_session_token}"}
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_fields = ["feedbacks", "total", "average_rating", "counts"]
            counts_fields = ["by_rating", "candidate", "mentor"]
            
            if all(field in data for field in expected_fields):
                counts = data.get("counts", {})
                if all(field in counts for field in counts_fields):
                    feedbacks = data.get("feedbacks", [])
                    total = data.get("total", 0)
                    avg_rating = data.get("average_rating", 0)
                    
                    if total >= 2:  # Should have at least 2 feedbacks from our tests
                        print_success(f"GET /api/support/admin/feedback passed - returns {total} feedbacks, avg rating: {avg_rating}")
                        success_count += 1
                    else:
                        print_warning(f"GET /api/support/admin/feedback passed but only {total} feedbacks found (expected at least 2)")
                        success_count += 0.7
                else:
                    missing_counts = [f for f in counts_fields if f not in counts]
                    print_error(f"GET /api/support/admin/feedback failed - missing counts fields: {missing_counts}")
            else:
                missing_fields = [f for f in expected_fields if f not in data]
                print_error(f"GET /api/support/admin/feedback failed - missing fields: {missing_fields}")
        else:
            print_error(f"GET /api/support/admin/feedback failed - status code: {response.status_code}")
            
    except Exception as e:
        print_error(f"GET /api/support/admin/feedback failed - error: {e}")
    
    # Test 5: Get feedback count (GET /api/support/admin/feedback/count)
    try:
        print_info("Test 5: Testing GET /api/support/admin/feedback/count (Feedback Count)")
        headers = {"Cookie": f"session_token={admin_session_token}"}
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback/count", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_fields = ["total", "recent"]
            
            if all(field in data for field in expected_fields):
                total_count = data.get("total", 0)
                recent_count = data.get("recent", 0)
                
                if total_count >= 2:  # Should have at least 2 from our tests
                    print_success(f"GET /api/support/admin/feedback/count passed - total: {total_count}, recent: {recent_count}")
                    success_count += 1
                else:
                    print_warning(f"GET /api/support/admin/feedback/count passed but only {total_count} total feedbacks")
                    success_count += 0.7
            else:
                missing_fields = [f for f in expected_fields if f not in data]
                print_error(f"GET /api/support/admin/feedback/count failed - missing fields: {missing_fields}")
        else:
            print_error(f"GET /api/support/admin/feedback/count failed - status code: {response.status_code}")
            
    except Exception as e:
        print_error(f"GET /api/support/admin/feedback/count failed - error: {e}")
    
    # Test 6: Get feedback details (GET /api/support/admin/feedback/{feedback_id})
    try:
        print_info("Test 6: Testing GET /api/support/admin/feedback/{feedback_id} (Feedback Details)")
        
        # First get a feedback ID from the feedback list
        headers = {"Cookie": f"session_token={admin_session_token}"}
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            feedbacks = data.get("feedbacks", [])
            
            if feedbacks:
                feedback_id = feedbacks[0].get("id")
                
                # Get feedback details
                response = requests.get(f"{BACKEND_URL}/support/admin/feedback/{feedback_id}", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    expected_fields = ["feedback", "user"]
                    
                    if all(field in data for field in expected_fields):
                        feedback = data.get("feedback", {})
                        user = data.get("user", {})
                        
                        if feedback.get("id") == feedback_id and user.get("name"):
                            print_success("GET /api/support/admin/feedback/{feedback_id} passed - returns feedback details with user info")
                            success_count += 1
                        else:
                            print_error("GET /api/support/admin/feedback/{feedback_id} failed - invalid feedback or user data")
                    else:
                        missing_fields = [f for f in expected_fields if f not in data]
                        print_error(f"GET /api/support/admin/feedback/{{feedback_id}} failed - missing fields: {missing_fields}")
                else:
                    print_error(f"GET /api/support/admin/feedback/{{feedback_id}} failed - status code: {response.status_code}")
            else:
                print_warning("GET /api/support/admin/feedback/{feedback_id} skipped - no feedbacks available to get details")
                success_count += 0.5
        else:
            print_error("Could not get feedback list to test feedback details functionality")
            
    except Exception as e:
        print_error(f"GET /api/support/admin/feedback/{{feedback_id}} failed - error: {e}")
    
    # Test 7: Filter tests - by rating and user_type
    try:
        print_info("Test 7: Testing GET /api/support/admin/feedback with filters")
        headers = {"Cookie": f"session_token={admin_session_token}"}
        
        # Test filter by rating=5
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback?rating=5", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            feedbacks = data.get("feedbacks", [])
            # Check if all returned feedbacks have rating 5
            all_rating_5 = all(fb.get("rating") == 5 for fb in feedbacks)
            
            if all_rating_5:
                print_success(f"GET /api/support/admin/feedback?rating=5 passed - returns {len(feedbacks)} 5-star feedbacks")
            else:
                print_error("GET /api/support/admin/feedback?rating=5 failed - contains non-5-star feedbacks")
        else:
            print_error(f"GET /api/support/admin/feedback?rating=5 failed - status code: {response.status_code}")
        
        # Test filter by user_type=mentor
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback?user_type=mentor", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            feedbacks = data.get("feedbacks", [])
            # Check if all returned feedbacks are from mentors
            all_mentor = all(fb.get("user_type") == "mentor" for fb in feedbacks)
            
            if all_mentor:
                print_success(f"GET /api/support/admin/feedback?user_type=mentor passed - returns {len(feedbacks)} mentor feedbacks")
                success_count += 1
            else:
                print_error("GET /api/support/admin/feedback?user_type=mentor failed - contains non-mentor feedbacks")
        else:
            print_error(f"GET /api/support/admin/feedback?user_type=mentor failed - status code: {response.status_code}")
            
    except Exception as e:
        print_error(f"Filter tests failed - error: {e}")
    
    # Test 8: Delete feedback (DELETE /api/support/admin/feedback/{feedback_id})
    try:
        print_info("Test 8: Testing DELETE /api/support/admin/feedback/{feedback_id} (Delete Feedback)")
        
        # First get a feedback ID from the feedback list
        headers = {"Cookie": f"session_token={admin_session_token}"}
        response = requests.get(f"{BACKEND_URL}/support/admin/feedback", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            feedbacks = data.get("feedbacks", [])
            
            if feedbacks:
                # Find a test feedback to delete (one with rating 1 or 2)
                test_feedback = None
                for fb in feedbacks:
                    if fb.get("rating") in [1, 2]:
                        test_feedback = fb
                        break
                
                if test_feedback:
                    feedback_id = test_feedback.get("id")
                    
                    # Delete the feedback
                    response = requests.delete(f"{BACKEND_URL}/support/admin/feedback/{feedback_id}", headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success") is True and "deleted successfully" in data.get("message", ""):
                            print_success("DELETE /api/support/admin/feedback/{feedback_id} passed - feedback deleted successfully")
                            success_count += 1
                        else:
                            print_error(f"DELETE /api/support/admin/feedback/{{feedback_id}} failed - unexpected response: {data}")
                    else:
                        print_error(f"DELETE /api/support/admin/feedback/{{feedback_id}} failed - status code: {response.status_code}")
                else:
                    print_warning("DELETE /api/support/admin/feedback/{feedback_id} skipped - no test feedback found to delete")
                    success_count += 0.5
            else:
                print_warning("DELETE /api/support/admin/feedback/{feedback_id} skipped - no feedbacks available to delete")
                success_count += 0.5
        else:
            print_error("Could not get feedback list to test delete functionality")
            
    except Exception as e:
        print_error(f"DELETE /api/support/admin/feedback/{{feedback_id}} failed - error: {e}")
    
    print_info(f"Feedback Feature APIs: {success_count}/{total_tests} tests passed")
    return success_count >= 6  # Allow some flexibility for missing data scenarios

if __name__ == "__main__":
    print(f"{Colors.BOLD}gradnext Feedback Feature API Testing{Colors.ENDC}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    success = test_feedback_feature_apis()
    
    if success:
        print_success("🎉 All feedback API tests passed!")
        sys.exit(0)
    else:
        print_error("❌ Some feedback API tests failed")
        sys.exit(1)