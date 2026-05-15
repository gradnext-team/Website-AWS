"""
Razorpay Subscription API Tests
Tests for subscription management endpoints including:
- GET /api/subscriptions/plans - Available subscription plans
- GET /api/subscriptions/status - User's subscription status
- POST /api/subscriptions/create - Create new subscription
- POST /api/subscriptions/cancel - Cancel subscription
- POST /api/subscriptions/reactivate - Reactivate cancelled subscription
- POST /api/subscriptions/change-plan - Upgrade/downgrade plan
- POST /api/subscriptions/cancel-scheduled-change - Cancel pending plan change
- POST /api/subscriptions/activate - Activate subscription after payment
- Admin endpoints for user subscription management
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@gradnext.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = f"test_sub_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER_PASSWORD = "test123"


class TestSubscriptionPlans:
    """Test GET /api/subscriptions/plans endpoint"""
    
    def test_get_plans_returns_available_plans(self):
        """Plans endpoint should return list of subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "plans" in data
        assert isinstance(data["plans"], list)
        assert len(data["plans"]) > 0
        
        # Verify plan structure
        for plan in data["plans"]:
            assert "plan_key" in plan
            assert "name" in plan
            assert "pricing" in plan
            assert "monthly" in plan["pricing"]
            assert "6_month_total" in plan["pricing"]
            assert "6_month_per_month" in plan["pricing"]
    
    def test_plans_include_expected_tiers(self):
        """Plans should include basic, pro, and pro_plus tiers"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        plan_keys = [p["plan_key"] for p in data["plans"]]
        assert "basic_plan" in plan_keys
        assert "pro_plan" in plan_keys
        assert "pro_plus" in plan_keys
    
    def test_plans_pricing_is_valid(self):
        """Plan pricing should be positive numbers"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        for plan in data["plans"]:
            pricing = plan["pricing"]
            assert pricing["monthly"] > 0
            assert pricing["6_month_total"] > 0
            assert pricing["6_month_per_month"] > 0
            # 6-month per month should be less than monthly (discount)
            assert pricing["6_month_per_month"] <= pricing["monthly"]


class TestSubscriptionStatus:
    """Test GET /api/subscriptions/status endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_status_requires_authentication(self):
        """Status endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/status")
        
        # Should return 401 or redirect for unauthenticated users
        assert response.status_code in [401, 403]
    
    def test_status_returns_subscription_info(self, admin_session):
        """Status endpoint should return subscription information"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "has_subscription" in data
        assert "status" in data
        assert "plan_key" in data
        assert "billing_cycle" in data
        assert "has_access" in data
        assert "is_subscription_plan" in data
    
    def test_status_shows_none_for_non_subscriber(self, admin_session):
        """Admin user without subscription should show status 'none'"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Admin doesn't have subscription
        assert data["status"] == "none"
        assert data["has_subscription"] == False


class TestSubscriptionCreate:
    """Test POST /api/subscriptions/create endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_create_requires_authentication(self):
        """Create endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={"plan_key": "pro_plan", "billing_cycle": "monthly"}
        )
        
        assert response.status_code in [401, 403]
    
    def test_create_requires_valid_plan_key(self, admin_session):
        """Create should fail with invalid plan key"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={"plan_key": "invalid_plan", "billing_cycle": "monthly"}
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_create_requires_valid_billing_cycle(self, admin_session):
        """Create should fail with invalid billing cycle"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={"plan_key": "pro_plan", "billing_cycle": "invalid_cycle"}
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
    
    def test_create_subscription_returns_razorpay_details(self, admin_session):
        """Create should return Razorpay subscription details
        
        NOTE: This creates a REAL subscription in Razorpay (live mode).
        The subscription will be in 'created' state until payment.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/create",
            json={"plan_key": "basic_plan", "billing_cycle": "monthly"}
        )
        
        # May fail if user already has active subscription
        if response.status_code == 400:
            data = response.json()
            if "already have" in data.get("detail", "").lower():
                pytest.skip("User already has active subscription")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "subscription_id" in data
        assert data["subscription_id"].startswith("sub_")  # Razorpay subscription ID format
        assert "razorpay_key" in data
        assert "amount" in data
        assert data["amount"] > 0
        assert "short_url" in data  # Hosted payment page URL


class TestSubscriptionCancel:
    """Test POST /api/subscriptions/cancel endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_cancel_requires_authentication(self):
        """Cancel endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/cancel",
            json={"reason": "testing"}
        )
        
        assert response.status_code in [401, 403]
    
    def test_cancel_fails_without_subscription(self, admin_session):
        """Cancel should fail if user has no subscription"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/cancel",
            json={"reason": "testing"}
        )
        
        # Admin doesn't have subscription
        assert response.status_code == 400
        data = response.json()
        assert "no active subscription" in data.get("detail", "").lower()


class TestSubscriptionReactivate:
    """Test POST /api/subscriptions/reactivate endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_reactivate_requires_authentication(self):
        """Reactivate endpoint should require authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/reactivate")
        
        assert response.status_code in [401, 403]
    
    def test_reactivate_fails_without_cancelled_subscription(self, admin_session):
        """Reactivate should fail if subscription is not cancelled"""
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/reactivate")
        
        assert response.status_code == 400
        data = response.json()
        assert "not in cancelled state" in data.get("detail", "").lower()


class TestSubscriptionChangePlan:
    """Test POST /api/subscriptions/change-plan endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_change_plan_requires_authentication(self):
        """Change plan endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code in [401, 403]
    
    def test_change_plan_fails_without_subscription(self, admin_session):
        """Change plan should fail if user has no subscription"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "no active subscription" in data.get("detail", "").lower()
    
    def test_change_plan_validates_plan_key(self, admin_session):
        """Change plan should validate plan key"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "invalid_plan", "new_billing_cycle": "monthly"}
        )
        
        # Should fail - either 400 (no subscription) or 404 (plan not found)
        assert response.status_code in [400, 404]


class TestCancelScheduledChange:
    """Test POST /api/subscriptions/cancel-scheduled-change endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_cancel_scheduled_change_requires_authentication(self):
        """Cancel scheduled change should require authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/cancel-scheduled-change")
        
        assert response.status_code in [401, 403]
    
    def test_cancel_scheduled_change_fails_without_pending_change(self, admin_session):
        """Cancel scheduled change should fail if no pending change"""
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/cancel-scheduled-change")
        
        assert response.status_code == 400
        data = response.json()
        assert "no scheduled change" in data.get("detail", "").lower()


class TestSubscriptionActivate:
    """Test POST /api/subscriptions/activate endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_activate_requires_authentication(self):
        """Activate endpoint should require authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/activate")
        
        assert response.status_code in [401, 403]
    
    def test_activate_handles_no_pending_subscription(self, admin_session):
        """Activate should handle case when no pending subscription or pending subscription exists
        
        Note: The endpoint returns 200 with success=false if there's a pending subscription
        in 'created' state (waiting for payment), or 400 if no pending subscription at all.
        """
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/activate")
        
        # Either 400 (no pending) or 200 with success=false (pending but not paid)
        if response.status_code == 400:
            data = response.json()
            assert "no pending subscription" in data.get("detail", "").lower()
        elif response.status_code == 200:
            data = response.json()
            # If there's a pending subscription in 'created' state
            assert data.get("success") == False or data.get("status") == "created"
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestAdminSubscriptionEndpoints:
    """Test admin subscription management endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_admin_get_user_subscription_requires_auth(self):
        """Admin endpoint should require authentication"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/admin/user/some-user-id"
        )
        assert response.status_code in [401, 403]
    
    def test_admin_get_user_subscription_works_for_admin(self, admin_session):
        """Admin endpoint should work for admin users"""
        # Use admin's own user ID
        response = admin_session.get(
            f"{BASE_URL}/api/subscriptions/admin/user/1d2de7d6-6542-45ef-8375-e100323bb3d3"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "subscription" in data
        assert "email" in data
    
    def test_admin_get_user_subscription_returns_404_for_invalid_user(self, admin_session):
        """Admin endpoint should return 404 for non-existent user"""
        response = admin_session.get(
            f"{BASE_URL}/api/subscriptions/admin/user/invalid-user-id-12345"
        )
        
        assert response.status_code == 404
    
    def test_admin_extend_subscription_requires_auth(self):
        """Admin extend endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/admin/extend/some-user-id?days=30"
        )
        
        assert response.status_code in [401, 403]
    
    def test_admin_extend_fails_for_user_without_subscription(self, admin_session):
        """Admin extend should fail if user has no subscription period"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/admin/extend/1d2de7d6-6542-45ef-8375-e100323bb3d3?days=30"
        )
        
        # Admin user doesn't have subscription
        assert response.status_code == 400
        data = response.json()
        assert "no subscription period" in data.get("detail", "").lower()


class TestWebhookEndpoint:
    """Test POST /api/subscriptions/webhook endpoint"""
    
    def test_webhook_accepts_post_requests(self):
        """Webhook endpoint should accept POST requests"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/webhook",
            json={"event": "test", "payload": {}}
        )
        
        # Should not return 404 or 405
        assert response.status_code not in [404, 405]
    
    def test_webhook_handles_invalid_payload(self):
        """Webhook should handle invalid payload gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/webhook",
            json={"invalid": "payload"}
        )
        
        # Should return 200 with ignored status or 400 for invalid
        assert response.status_code in [200, 400]


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
