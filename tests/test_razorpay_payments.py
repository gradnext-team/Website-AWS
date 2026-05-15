"""
Razorpay Payment Integration Tests
Tests for payment endpoints: config, create-order, history, subscription, orders
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consultant-gateway.preview.emergentagent.com')


class TestPaymentConfig:
    """Tests for GET /api/payments/config endpoint"""
    
    def test_get_razorpay_config(self):
        """Test that config endpoint returns Razorpay public key"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "key_id" in data
        assert data["key_id"].startswith("rzp_")  # Razorpay key format
        assert "currency" in data
        assert data["currency"] == "INR"
        assert "company_name" in data
        assert data["company_name"] == "gradnext"


class TestPaymentOrderCreation:
    """Tests for POST /api/payments/create-order endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as free user before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        self.user = login_response.json()
    
    def test_create_order_for_paid_plan(self):
        """Test creating order for a paid plan (Pro)"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "pro"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "order_id" in data
        assert data["order_id"].startswith("order_")  # Razorpay order format
        assert data["amount"] == 49900  # 499 INR in paise
        assert data["currency"] == "INR"
        assert data["key_id"].startswith("rzp_")
        assert data["plan_name"] == "Pro Subscriber"
        assert data["plan_key"] == "pro"
        assert data["user_email"] == self.user["email"]
    
    def test_create_order_for_premium_plan(self):
        """Test creating order for a premium plan (Mid Mile)"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "mid_mile"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["amount"] == 3999900  # 39999 INR in paise
        assert data["plan_name"] == "Mid Mile Prep"
    
    def test_create_order_for_free_plan_fails(self):
        """Test that creating order for free plan returns error"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "free_trial"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "free plan" in data["detail"].lower()
    
    def test_create_order_for_invalid_plan_fails(self):
        """Test that creating order for non-existent plan returns error"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "invalid_plan_xyz"}
        )
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_create_order_without_auth_fails(self):
        """Test that creating order without authentication fails"""
        # Use a new session without login
        response = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "pro"}
        )
        assert response.status_code in [401, 403]


class TestPaymentHistory:
    """Tests for GET /api/payments/history endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as free user before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
    
    def test_get_payment_history(self):
        """Test getting payment history for user"""
        response = self.session.get(f"{BASE_URL}/api/payments/history")
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert isinstance(data["payments"], list)
    
    def test_payment_history_without_auth_fails(self):
        """Test that payment history without auth fails"""
        response = requests.get(f"{BASE_URL}/api/payments/history")
        assert response.status_code in [401, 403]


class TestPaymentOrders:
    """Tests for GET /api/payments/orders endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as free user before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
    
    def test_get_orders(self):
        """Test getting orders for user"""
        response = self.session.get(f"{BASE_URL}/api/payments/orders")
        assert response.status_code == 200
        
        data = response.json()
        assert "orders" in data
        assert isinstance(data["orders"], list)
    
    def test_orders_contain_razorpay_order_id(self):
        """Test that orders contain Razorpay order IDs"""
        # First create an order
        self.session.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "pro"}
        )
        
        # Then get orders
        response = self.session.get(f"{BASE_URL}/api/payments/orders")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["orders"]) > 0:
            order = data["orders"][0]
            assert "razorpay_order_id" in order
            assert order["razorpay_order_id"].startswith("order_")
            assert "status" in order
            assert "plan_key" in order
            assert "amount" in order


class TestSubscriptionStatus:
    """Tests for GET /api/payments/subscription endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as free user before each test"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
    
    def test_get_subscription_status_free_user(self):
        """Test subscription status for free trial user"""
        response = self.session.get(f"{BASE_URL}/api/payments/subscription")
        assert response.status_code == 200
        
        data = response.json()
        assert "has_subscription" in data
        assert data["has_subscription"] is False
        assert data["plan_key"] == "free_trial"
        assert data["plan_name"] == "Free Trial"
    
    def test_subscription_status_without_auth_fails(self):
        """Test that subscription status without auth fails"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription")
        assert response.status_code in [401, 403]


class TestPlansEndpoint:
    """Tests for GET /api/resources/plans endpoint (public)"""
    
    def test_get_plans(self):
        """Test getting available plans"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)
        assert len(data["plans"]) > 0
    
    def test_plans_contain_required_fields(self):
        """Test that plans contain all required fields"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        
        for plan in data["plans"]:
            assert "id" in plan
            assert "name" in plan
            assert "price" in plan
            assert "currency" in plan
            assert "features" in plan
    
    def test_plans_include_free_trial(self):
        """Test that plans include free trial option"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        
        plan_ids = [p["id"] for p in data["plans"]]
        assert "free_trial" in plan_ids
    
    def test_plans_include_paid_options(self):
        """Test that plans include paid options"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        
        paid_plans = [p for p in data["plans"] if p["price"] > 0]
        assert len(paid_plans) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
