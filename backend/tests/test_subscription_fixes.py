"""
Test suite for Subscription Fixes and Admin Debug Endpoints
Tests for:
1. Subscription creation with coupon_code parameter
2. Admin debug endpoints (/debug/user-plan, /debug/mentor-sessions)
3. Admin fix endpoints (/fix-subscription, /fix-mentor-bookings)
4. Plan label mapping verification (basic_plan, pro_plan display correctly)
5. Feedback modal strategy call exclusion

Created: 2026-01
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSubscriptionCreationWithCoupon:
    """Test POST /api/subscriptions/create with coupon_code parameter"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Get authenticated session via mock login"""
        session = requests.Session()
        # Use mock login for testing
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "candidate"}
        )
        if response.status_code != 200:
            pytest.skip("Mock login failed - mock login may be disabled")
        return session
    
    def test_subscription_create_accepts_coupon_code(self, authenticated_session):
        """Subscription creation endpoint should accept coupon_code parameter"""
        # Test the API contract - endpoint accepts the parameter
        response = authenticated_session.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={
                "plan_key": "pro_plan",
                "billing_cycle": "monthly",
                "coupon_code": "TESTCOUPON"  # Invalid coupon, but tests parameter acceptance
            }
        )
        
        # Should not fail with 422 (validation error) - endpoint accepts coupon_code
        # It may fail with 400 (invalid coupon) or succeed if coupon exists
        assert response.status_code != 422, "Endpoint should accept coupon_code parameter"
        
        # Either success (200) or business logic error (400/404) - not validation error
        assert response.status_code in [200, 400, 404, 500], f"Unexpected status: {response.status_code}"
        print(f"Subscription create with coupon_code: Status {response.status_code}")
    
    def test_subscription_create_without_coupon(self, authenticated_session):
        """Subscription creation should work without coupon_code"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={
                "plan_key": "basic_plan",
                "billing_cycle": "monthly"
            }
        )
        
        # Should not fail with validation error
        assert response.status_code != 422, "Endpoint should work without coupon_code"
        print(f"Subscription create without coupon: Status {response.status_code}")


class TestAdminDebugEndpoints:
    """Test admin debug endpoints for troubleshooting"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session via mock login"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "admin"}
        )
        if response.status_code != 200:
            pytest.skip("Admin mock login failed")
        return session
    
    @pytest.fixture
    def test_user_email(self, admin_session):
        """Get or create a test user email for debug queries"""
        # Get any user from the system to test debug endpoints
        response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=1")
        if response.status_code == 200:
            data = response.json()
            users = data.get("users", [])
            if users:
                return users[0].get("email")
        return "test@example.com"  # Fallback
    
    def test_debug_user_plan_returns_plan_diagnosis(self, admin_session, test_user_email):
        """Debug user-plan endpoint should return plan diagnosis data"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/debug/user-plan/{test_user_email}"
        )
        
        # Should return 200 for valid user or 404 for non-existent
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            assert "user_email" in data
            assert "current_plan_data" in data
            assert "access_check_results" in data
            assert "diagnosis" in data
            
            # Verify diagnosis contains recommendation
            assert "recommendation" in data.get("diagnosis", {})
            print(f"Debug user-plan response: {data.get('diagnosis')}")
    
    def test_debug_user_plan_requires_admin(self):
        """Debug endpoint should require admin authentication"""
        # Unauthenticated request
        response = requests.get(
            f"{BASE_URL}/api/admin/debug/user-plan/test@example.com"
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_debug_user_plan_returns_404_for_nonexistent_user(self, admin_session):
        """Debug endpoint should return 404 for non-existent user"""
        fake_email = f"nonexistent_{uuid.uuid4().hex[:8]}@test.com"
        response = admin_session.get(
            f"{BASE_URL}/api/admin/debug/user-plan/{fake_email}"
        )
        assert response.status_code == 404


class TestAdminMentorDebugEndpoints:
    """Test admin mentor debug endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "admin"}
        )
        if response.status_code != 200:
            pytest.skip("Admin mock login failed")
        return session
    
    def test_debug_mentor_sessions_returns_session_data(self, admin_session):
        """Debug mentor-sessions endpoint should return session analysis"""
        # First, get a mentor email from the system
        mentors_response = admin_session.get(f"{BASE_URL}/api/admin/mentors?limit=1")
        
        if mentors_response.status_code != 200:
            pytest.skip("Could not retrieve mentors list")
        
        mentors_data = mentors_response.json()
        mentors = mentors_data.get("mentors", [])
        
        if not mentors:
            pytest.skip("No mentors in system to test")
        
        mentor_email = mentors[0].get("email")
        
        response = admin_session.get(
            f"{BASE_URL}/api/admin/debug/mentor-sessions/{mentor_email}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "mentor_email" in data
        assert "mentor_record" in data
        assert "user_record" in data
        assert "potential_issues" in data
        assert "id_match" in data
        
        print(f"Mentor debug: {data.get('potential_issues', [])}")
    
    def test_debug_mentor_sessions_requires_admin(self):
        """Debug mentor-sessions should require admin auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/debug/mentor-sessions/test@example.com"
        )
        assert response.status_code in [401, 403]


class TestAdminFixEndpoints:
    """Test admin fix endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "admin"}
        )
        if response.status_code != 200:
            pytest.skip("Admin mock login failed")
        return session
    
    def test_fix_subscription_requires_admin(self):
        """Fix subscription endpoint should require admin auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/fix-subscription",
            json={
                "user_email": "test@example.com",
                "plan_key": "pro_plan",
                "billing_cycle": "6_month"
            }
        )
        assert response.status_code in [401, 403]
    
    def test_fix_subscription_validates_user_exists(self, admin_session):
        """Fix subscription should return 404 for non-existent user"""
        fake_email = f"nonexistent_{uuid.uuid4().hex[:8]}@test.com"
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/fix-subscription",
            json={
                "user_email": fake_email,
                "plan_key": "pro_plan",
                "billing_cycle": "6_month"
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_fix_subscription_validates_plan_exists(self, admin_session):
        """Fix subscription should return 404 for non-existent plan"""
        # First get a real user
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=1")
        if users_response.status_code != 200:
            pytest.skip("Could not get users")
        
        users = users_response.json().get("users", [])
        if not users:
            pytest.skip("No users to test with")
        
        response = admin_session.post(
            f"{BASE_URL}/api/admin/fix-subscription",
            json={
                "user_email": users[0].get("email"),
                "plan_key": "nonexistent_plan_xyz",
                "billing_cycle": "monthly"
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_fix_mentor_bookings_requires_admin(self):
        """Fix mentor bookings endpoint should require admin auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/fix-mentor-bookings/test@example.com"
        )
        assert response.status_code in [401, 403]


class TestFeedbackStrategyCallExclusion:
    """Test that strategy calls are excluded from mandatory feedback"""
    
    @pytest.fixture
    def mentor_session(self):
        """Get authenticated mentor session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "mentor"}
        )
        if response.status_code != 200:
            pytest.skip("Mentor mock login failed")
        return session
    
    def test_pending_mandatory_feedback_endpoint_exists(self, mentor_session):
        """Pending mandatory feedback endpoint should be accessible"""
        # Correct endpoint is /api/feedback/pending-mandatory
        response = mentor_session.get(f"{BASE_URL}/api/feedback/pending-mandatory")
        
        # Should return 200 (with or without pending feedback)
        assert response.status_code == 200
        data = response.json()
        
        # Response should have has_pending field
        assert "has_pending" in data
        print(f"Pending feedback response: {data}")
    
    def test_pending_feedback_excludes_strategy_calls_in_query(self, mentor_session):
        """Verify that pending feedback query excludes strategy calls
        
        The actual database query includes session_type filter:
        {"$nin": ["Strategy Call", "strategy_call", "Strategy call"]}
        
        We can only verify the endpoint works; full verification requires
        database inspection or creating test data.
        """
        response = mentor_session.get(f"{BASE_URL}/api/feedback/pending-mandatory")
        
        assert response.status_code == 200
        data = response.json()
        
        # If there's pending feedback, verify it's not a strategy call
        if data.get("has_pending") and data.get("session"):
            session_type = data["session"].get("session_type", "")
            # Strategy calls should not trigger mandatory feedback
            assert session_type.lower() not in ["strategy call", "strategy_call"], \
                f"Strategy call '{session_type}' should be excluded from mandatory feedback"


class TestPlanLabelMapping:
    """Test that plan labels display correctly"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "candidate"}
        )
        if response.status_code != 200:
            pytest.skip("Mock login failed")
        return session
    
    def test_dashboard_summary_returns_correct_plan_key(self, authenticated_session):
        """Dashboard summary should return correct plan key"""
        # Correct endpoint is /api/resources/dashboard-summary
        response = authenticated_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # User object should have plan field
        user = data.get("user", {})
        plan = user.get("plan")
        
        # If user has a plan, verify it's a valid key
        valid_plan_keys = [
            "free_trial", "basic", "basic_plan", "pro", "pro_plan", 
            "pro_plus", "last_mile", "mid_mile", "full_prep",
            "cohort_premium", "cohort_elite"
        ]
        
        if plan:
            print(f"User plan key: {plan}")
            # Plan should be a recognized key
            assert plan in valid_plan_keys or plan == "" or plan is None, \
                f"Unexpected plan key: {plan}"
    
    def test_subscription_plans_have_correct_keys(self):
        """Subscription plans API should return correct plan_key values"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        for plan in data.get("plans", []):
            plan_key = plan.get("plan_key")
            plan_name = plan.get("name")
            
            # Verify mapping consistency
            if plan_key == "basic_plan":
                assert "Basic" in plan_name, f"basic_plan should map to 'Basic', got: {plan_name}"
            elif plan_key == "pro_plan":
                assert "Pro" in plan_name, f"pro_plan should map to 'Pro', got: {plan_name}"
            elif plan_key == "pro_plus":
                assert "Pro Plus" in plan_name or "Pro+" in plan_name, \
                    f"pro_plus should map to 'Pro Plus', got: {plan_name}"
            
            print(f"Plan key '{plan_key}' -> name '{plan_name}'")


class TestAccessControlWithPlanField:
    """Test access control works with plan field"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/mock-login",
            params={"user_type": "admin"}
        )
        if response.status_code != 200:
            pytest.skip("Admin mock login failed")
        return session
    
    def test_debug_user_plan_shows_subscription_access_check(self, admin_session):
        """Debug user-plan should show has_subscription_access results"""
        # Get a user to check
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users?limit=5")
        if users_response.status_code != 200:
            pytest.skip("Could not get users")
        
        users = users_response.json().get("users", [])
        
        # Find a user with a subscription plan
        test_user = None
        for user in users:
            if user.get("plan") in ["basic_plan", "pro_plan", "pro_plus"]:
                test_user = user
                break
        
        if not test_user:
            # Just use first user
            if users:
                test_user = users[0]
            else:
                pytest.skip("No users to test")
        
        response = admin_session.get(
            f"{BASE_URL}/api/admin/debug/user-plan/{test_user.get('email')}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify access check results are present
        assert "access_check_results" in data
        access_results = data["access_check_results"]
        
        assert "has_subscription_by_plan" in access_results
        assert "subscription_plans_list" in access_results
        
        # Verify subscription plans list includes basic_plan and pro_plan
        plans_list = access_results.get("subscription_plans_list", [])
        assert "basic_plan" in plans_list, "basic_plan should be in subscription list"
        assert "pro_plan" in plans_list, "pro_plan should be in subscription list"
        assert "pro_plus" in plans_list, "pro_plus should be in subscription list"
        
        print(f"Access check results: {access_results}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
