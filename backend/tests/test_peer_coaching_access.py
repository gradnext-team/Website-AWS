"""
Test Plan Expiry Access Control for Peer Practice and Coaching
Tests that expired users are properly blocked from premium features
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExpiredUserPeerPracticeAccess:
    """Tests for Peer Practice access control for expired users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_expired_trial_user_session_credits(self):
        """Test that expired trial user gets has_access=false and plan_expired=true"""
        # Login as expired trial user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "expired@gradnext.com", "password": "test123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Check session-credits endpoint
        credits_response = self.session.get(f"{BASE_URL}/api/peers/session-credits")
        assert credits_response.status_code == 200
        
        data = credits_response.json()
        assert data["has_access"] == False, "Expired user should not have access"
        assert data["plan_expired"] == True, "plan_expired flag should be True"
        assert data["sessions_remaining"] == 0, "Sessions remaining should be 0"
        assert "expired" in data.get("reason", "").lower(), "Reason should mention expiry"
    
    def test_expired_pro_user_session_credits(self):
        """Test that expired pro user gets has_access=false and plan_expired=true"""
        # Login as expired pro user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "access_revoke_test@test.co", "password": "test123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Check session-credits endpoint
        credits_response = self.session.get(f"{BASE_URL}/api/peers/session-credits")
        assert credits_response.status_code == 200
        
        data = credits_response.json()
        assert data["has_access"] == False, "Expired user should not have access"
        assert data["plan_expired"] == True, "plan_expired flag should be True"
        assert data["sessions_remaining"] == 0, "Sessions remaining should be 0"


class TestExpiredUserDashboardSummary:
    """Tests for Dashboard Summary access control for expired users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_expired_trial_user_dashboard_summary(self):
        """Test that expired trial user gets use_item_level_locking=true"""
        # Login as expired trial user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "expired@gradnext.com", "password": "test123"}
        )
        assert login_response.status_code == 200
        
        # Check dashboard-summary endpoint
        summary_response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert summary_response.status_code == 200
        
        data = summary_response.json()
        plan_status = data.get("plan_status", {})
        
        # Verify expired flags
        assert plan_status.get("use_item_level_locking") == True, "use_item_level_locking should be True"
        assert plan_status.get("trial_expired") == True, "trial_expired should be True"
        assert plan_status.get("trial_days_remaining") == 0, "trial_days_remaining should be 0"
    
    def test_expired_pro_user_dashboard_summary(self):
        """Test that expired pro user gets use_item_level_locking=true and subscription_expired=true"""
        # Login as expired pro user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "access_revoke_test@test.co", "password": "test123"}
        )
        assert login_response.status_code == 200
        
        # Check dashboard-summary endpoint
        summary_response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert summary_response.status_code == 200
        
        data = summary_response.json()
        plan_status = data.get("plan_status", {})
        
        # Verify expired flags
        assert plan_status.get("use_item_level_locking") == True, "use_item_level_locking should be True"
        assert plan_status.get("subscription_expired") == True, "subscription_expired should be True"
        assert plan_status.get("has_subscription") == True, "has_subscription should be True (but expired)"


class TestExpiredUserCoachingAccess:
    """Tests for Coaching access control for expired users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_expired_user_coaching_sessions_remaining(self):
        """Test that expired user has 0 coaching sessions remaining"""
        # Login as expired trial user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "expired@gradnext.com", "password": "test123"}
        )
        assert login_response.status_code == 200
        
        # Check dashboard-summary for coaching sessions
        summary_response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert summary_response.status_code == 200
        
        data = summary_response.json()
        user_data = data.get("user", {})
        plan_status = data.get("plan_status", {})
        
        # Verify coaching access is restricted
        assert user_data.get("coaching_sessions_remaining") == 0, "Coaching sessions should be 0"
        assert plan_status.get("has_single_sessions") == False, "Should not have single sessions"
        assert plan_status.get("single_sessions_remaining") == 0, "Single sessions remaining should be 0"
    
    def test_expired_pro_user_coaching_sessions(self):
        """Test that expired pro user has 0 effective coaching sessions"""
        # Login as expired pro user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "access_revoke_test@test.co", "password": "test123"}
        )
        assert login_response.status_code == 200
        
        # Check dashboard-summary for coaching sessions
        summary_response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert summary_response.status_code == 200
        
        data = summary_response.json()
        user_data = data.get("user", {})
        plan_status = data.get("plan_status", {})
        
        # Verify coaching access is restricted for expired subscription
        assert user_data.get("coaching_sessions_remaining") == 0, "Coaching sessions should be 0"
        assert plan_status.get("subscription_expired") == True, "Subscription should be expired"


class TestActiveUserAccess:
    """Tests to verify active users still have access (regression test)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_admin_user_has_access(self):
        """Test that admin user has full access"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@gradnext.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        
        # Check dashboard-summary
        summary_response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert summary_response.status_code == 200
        
        data = summary_response.json()
        user_data = data.get("user", {})
        
        # Admin should have access
        assert user_data.get("is_admin") == True, "Admin flag should be True"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
