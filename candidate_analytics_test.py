#!/usr/bin/env python3
"""
Candidate Analytics API Testing
Testing the specific candidate analytics endpoint reported as failing.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def test_candidate_analytics_endpoint():
    """Test the candidate analytics API endpoint that's returning errors"""
    print("🎯 TESTING CANDIDATE ANALYTICS API ENDPOINT")
    print("=" * 60)
    
    # Step 1: Admin Authentication
    print("\n1️⃣ TESTING ADMIN AUTHENTICATION")
    auth_url = f"{API_BASE}/auth/mock-login?user_type=admin"
    
    try:
        auth_response = requests.post(auth_url, timeout=30)
        print(f"   Auth URL: {auth_url}")
        print(f"   Status Code: {auth_response.status_code}")
        
        if auth_response.status_code == 200:
            auth_data = auth_response.json()
            session_token = auth_data.get('session_token')
            auth_token = auth_data.get('auth_token')
            cookies = auth_response.cookies
            
            print(f"   ✅ Admin authentication successful")
            print(f"   Session Token: {session_token[:20]}..." if session_token else "   ❌ No session token")
            print(f"   Auth Token: {auth_token[:20]}..." if auth_token else "   ❌ No auth token")
            print(f"   Cookies: {dict(cookies)}")
            
        else:
            print(f"   ❌ Admin authentication failed")
            print(f"   Response: {auth_response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Auth request failed: {str(e)}")
        return False
    
    # Step 2: Test Candidate Analytics Summary Endpoint
    print("\n2️⃣ TESTING CANDIDATE ANALYTICS SUMMARY ENDPOINT")
    analytics_url = f"{API_BASE}/admin/candidate-analytics/summary"
    
    try:
        # Use cookies from authentication
        analytics_response = requests.get(
            analytics_url,
            cookies=cookies,
            timeout=60  # Longer timeout as this might be a complex query
        )
        
        print(f"   Analytics URL: {analytics_url}")
        print(f"   Status Code: {analytics_response.status_code}")
        print(f"   Response Headers: {dict(analytics_response.headers)}")
        
        if analytics_response.status_code == 200:
            try:
                analytics_data = analytics_response.json()
                print(f"   ✅ Candidate analytics endpoint working correctly")
                
                # Check response structure
                print(f"\n   📊 RESPONSE STRUCTURE:")
                if 'candidates' in analytics_data:
                    candidates_count = len(analytics_data['candidates'])
                    print(f"   - Candidates array: {candidates_count} candidates")
                else:
                    print(f"   ❌ Missing 'candidates' field")
                
                if 'summary' in analytics_data:
                    summary = analytics_data['summary']
                    print(f"   - Summary object present:")
                    print(f"     • Total candidates: {summary.get('total_candidates', 'N/A')}")
                    print(f"     • Active users (7d): {summary.get('active_users_7d', 'N/A')}")
                    print(f"     • Active users (30d): {summary.get('active_users_30d', 'N/A')}")
                    print(f"     • Platform avg drill score: {summary.get('platform_avg_drill_score', 'N/A')}")
                else:
                    print(f"   ❌ Missing 'summary' field")
                
                if 'pagination' in analytics_data:
                    pagination = analytics_data['pagination']
                    print(f"   - Pagination object:")
                    print(f"     • Page: {pagination.get('page', 'N/A')}")
                    print(f"     • Limit: {pagination.get('limit', 'N/A')}")
                    print(f"     • Total: {pagination.get('total', 'N/A')}")
                    print(f"     • Total pages: {pagination.get('total_pages', 'N/A')}")
                else:
                    print(f"   ❌ Missing 'pagination' field")
                
                # Sample candidate data
                if analytics_data.get('candidates'):
                    first_candidate = analytics_data['candidates'][0]
                    print(f"\n   👤 SAMPLE CANDIDATE DATA:")
                    print(f"   - User ID: {first_candidate.get('user_id', 'N/A')}")
                    print(f"   - Name: {first_candidate.get('first_name', '')} {first_candidate.get('last_name', '')}")
                    print(f"   - Email: {first_candidate.get('email', 'N/A')}")
                    print(f"   - Plan: {first_candidate.get('plan', 'N/A')}")
                    print(f"   - Coaching sessions: {first_candidate.get('coaching_sessions_done', 0)}")
                    print(f"   - Peer sessions: {first_candidate.get('peer_sessions_done', 0)}")
                    print(f"   - Videos watched: {first_candidate.get('videos_watched', 0)}")
                    print(f"   - Drills done: {first_candidate.get('drills_done', 0)}")
                
                return True
                
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON response: {str(e)}")
                print(f"   Response content (first 500 chars): {analytics_response.text[:500]}")
                return False
                
        else:
            print(f"   ❌ Candidate analytics endpoint failed")
            print(f"   Response: {analytics_response.text}")
            
            # Check for specific error patterns
            if analytics_response.status_code == 403:
                print(f"   🔐 Access forbidden - admin authentication might have failed")
            elif analytics_response.status_code == 404:
                print(f"   🔍 Endpoint not found - route might not be registered")
            elif analytics_response.status_code >= 500:
                print(f"   💥 Server error - check backend logs")
            
            return False
            
    except Exception as e:
        print(f"   ❌ Analytics request failed: {str(e)}")
        return False

def test_with_parameters():
    """Test the analytics endpoint with various parameters"""
    print("\n3️⃣ TESTING WITH PARAMETERS")
    
    # First authenticate
    auth_url = f"{API_BASE}/auth/mock-login?user_type=admin"
    auth_response = requests.post(auth_url)
    
    if auth_response.status_code != 200:
        print("   ❌ Could not authenticate for parameter testing")
        return False
    
    cookies = auth_response.cookies
    analytics_url = f"{API_BASE}/admin/candidate-analytics/summary"
    
    test_cases = [
        {"params": {}, "description": "No parameters"},
        {"params": {"page": 1, "limit": 10}, "description": "Pagination parameters"},
        {"params": {"plan": "pro_plan"}, "description": "Filter by plan"},
        {"params": {"sort_by": "created_at", "sort_order": "desc"}, "description": "Sort parameters"},
        {"params": {"search": "test"}, "description": "Search parameter"},
    ]
    
    for test_case in test_cases:
        try:
            print(f"\n   Testing: {test_case['description']}")
            response = requests.get(
                analytics_url,
                params=test_case["params"],
                cookies=cookies,
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                candidate_count = len(data.get('candidates', []))
                print(f"   ✅ Success - {candidate_count} candidates returned")
            else:
                print(f"   ❌ Failed - {response.text[:200]}")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")

def check_backend_logs():
    """Instructions for checking backend logs"""
    print("\n4️⃣ BACKEND LOG ANALYSIS")
    print("To check backend logs for analytics errors, run:")
    print("   sudo tail -n 100 /var/log/supervisor/backend.*.log | grep -i 'analytics\\|error\\|exception'")
    print("   Or check real-time logs with:")
    print("   sudo tail -f /var/log/supervisor/backend.*.log")

def main():
    """Main testing function"""
    print("🧪 CANDIDATE ANALYTICS API TESTING")
    print("Testing the candidate analytics endpoint reported as failing")
    print("Backend URL:", BACKEND_URL)
    print("Timestamp:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    # Run the main test
    success = test_candidate_analytics_endpoint()
    
    # Run parameter tests if main test passed
    if success:
        test_with_parameters()
    
    # Always show log instructions
    check_backend_logs()
    
    # Final result
    print("\n" + "="*60)
    if success:
        print("🎉 RESULT: Candidate Analytics API is working correctly!")
        print("The 'fail to load analytics' error might be a frontend issue.")
    else:
        print("💥 RESULT: Candidate Analytics API has issues!")
        print("This explains the 'fail to load analytics' error in frontend.")
    print("="*60)
    
    return success

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {str(e)}")
        sys.exit(1)