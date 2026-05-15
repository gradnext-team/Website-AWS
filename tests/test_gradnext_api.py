"""
gradnext API Tests
Tests for public endpoints and API structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Health check and root endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
    
    def test_root_endpoint(self):
        """Test /api/ returns API message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "gradnext API"


class TestPaymentPlansEndpoint:
    """Tests for /api/payments/plans endpoint"""
    
    def test_get_plans_returns_200(self):
        """Test plans endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        assert response.status_code == 200
    
    def test_get_plans_returns_7_plans(self):
        """Test plans endpoint returns all 7 plans"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 7
    
    def test_plans_have_required_fields(self):
        """Test each plan has required fields"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        
        required_fields = ["key", "name", "amount", "amount_display", "duration_months", "sessions", "description"]
        
        for plan in data:
            for field in required_fields:
                assert field in plan, f"Plan {plan.get('key', 'unknown')} missing field: {field}"
    
    def test_basic_plan_pricing(self):
        """Test Basic plan has correct pricing"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        
        basic_plan = next((p for p in data if p["key"] == "basic"), None)
        assert basic_plan is not None
        assert basic_plan["amount"] == 499900  # ₹4,999 in paise
        assert basic_plan["duration_months"] == 3
        assert basic_plan["sessions"] == 0
    
    def test_pro_plan_pricing(self):
        """Test Pro plan has correct pricing"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        
        pro_plan = next((p for p in data if p["key"] == "pro"), None)
        assert pro_plan is not None
        assert pro_plan["amount"] == 799900  # ₹7,999 in paise
        assert pro_plan["duration_months"] == 6
    
    def test_coaching_plans_have_sessions(self):
        """Test coaching plans have coaching sessions"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        
        coaching_plans = ["last_mile", "mid_mile", "full_prep"]
        for plan_key in coaching_plans:
            plan = next((p for p in data if p["key"] == plan_key), None)
            assert plan is not None, f"Plan {plan_key} not found"
            assert plan["sessions"] > 0, f"Plan {plan_key} should have coaching sessions"
    
    def test_cohort_plans_exist(self):
        """Test cohort plans exist with correct structure"""
        response = requests.get(f"{BASE_URL}/api/payments/plans")
        data = response.json()
        
        cohort_premium = next((p for p in data if p["key"] == "cohort_premium"), None)
        cohort_elite = next((p for p in data if p["key"] == "cohort_elite"), None)
        
        assert cohort_premium is not None
        assert cohort_elite is not None
        assert cohort_premium["sessions"] == 1
        assert cohort_elite["sessions"] == 3


class TestMentorsEndpoint:
    """Tests for /api/mentors endpoint"""
    
    def test_get_mentors_returns_200(self):
        """Test mentors endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
    
    def test_get_mentors_returns_list(self):
        """Test mentors endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/mentors")
        data = response.json()
        assert isinstance(data, list)
    
    def test_mentors_have_required_fields(self):
        """Test each mentor has required fields"""
        response = requests.get(f"{BASE_URL}/api/mentors")
        data = response.json()
        
        required_fields = ["id", "name", "title", "company", "bio", "expertise", "picture", "years_experience", "rating"]
        
        for mentor in data:
            for field in required_fields:
                assert field in mentor, f"Mentor {mentor.get('name', 'unknown')} missing field: {field}"
    
    def test_mentors_have_valid_ratings(self):
        """Test mentors have valid ratings between 0 and 5"""
        response = requests.get(f"{BASE_URL}/api/mentors")
        data = response.json()
        
        for mentor in data:
            assert 0 <= mentor["rating"] <= 5, f"Mentor {mentor['name']} has invalid rating: {mentor['rating']}"
    
    def test_mentors_are_active(self):
        """Test all returned mentors are active"""
        response = requests.get(f"{BASE_URL}/api/mentors")
        data = response.json()
        
        for mentor in data:
            assert mentor.get("is_active", True) == True


class TestPaymentConfigEndpoint:
    """Tests for /api/payments/config endpoint"""
    
    def test_get_config_returns_200(self):
        """Test config endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
    
    def test_config_has_required_fields(self):
        """Test config has required fields"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        data = response.json()
        
        assert "currency" in data
        assert data["currency"] == "INR"
        assert "company_name" in data
        assert data["company_name"] == "gradnext"


class TestAuthEndpoints:
    """Tests for authentication endpoints"""
    
    def test_auth_me_requires_authentication(self):
        """Test /api/auth/me returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
    
    def test_auth_session_requires_session_id(self):
        """Test /api/auth/session requires session ID"""
        response = requests.post(f"{BASE_URL}/api/auth/session")
        assert response.status_code == 400


class TestResourceEndpoints:
    """Tests for resource endpoints (require auth)"""
    
    def test_videos_requires_auth(self):
        """Test /api/resources/videos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/resources/videos")
        assert response.status_code == 401
    
    def test_workshops_requires_auth(self):
        """Test /api/resources/workshops requires authentication"""
        response = requests.get(f"{BASE_URL}/api/resources/workshops")
        assert response.status_code == 401
    
    def test_drills_requires_auth(self):
        """Test /api/resources/drills requires authentication"""
        response = requests.get(f"{BASE_URL}/api/resources/drills")
        assert response.status_code == 401
    
    def test_materials_requires_auth(self):
        """Test /api/resources/materials requires authentication"""
        response = requests.get(f"{BASE_URL}/api/resources/materials")
        assert response.status_code == 401


class TestPaymentOrderEndpoints:
    """Tests for payment order endpoints (require auth or Razorpay config)"""
    
    def test_create_order_requires_auth_or_razorpay(self):
        """Test /api/payments/create-order requires authentication or returns 503 if Razorpay not configured"""
        response = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            json={"plan_key": "basic"}
        )
        # Returns 401 (auth required) or 503 (Razorpay not configured) or 520 (ingress error for 503)
        assert response.status_code in [401, 503, 520]
    
    def test_verify_payment_requires_auth_or_razorpay(self):
        """Test /api/payments/verify requires authentication or returns 503 if Razorpay not configured"""
        response = requests.post(
            f"{BASE_URL}/api/payments/verify",
            json={
                "razorpay_order_id": "test",
                "razorpay_payment_id": "test",
                "razorpay_signature": "test",
                "plan_key": "basic"
            }
        )
        # Returns 401 (auth required) or 503 (Razorpay not configured) or 520 (ingress error for 503)
        assert response.status_code in [401, 503, 520]


class TestMentorBookingEndpoints:
    """Tests for mentor booking endpoints"""
    
    def test_get_mentor_by_id(self):
        """Test getting a specific mentor by ID"""
        # First get list of mentors
        response = requests.get(f"{BASE_URL}/api/mentors")
        mentors = response.json()
        
        if len(mentors) > 0:
            mentor_id = mentors[0]["id"]
            response = requests.get(f"{BASE_URL}/api/mentors/{mentor_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == mentor_id
    
    def test_get_nonexistent_mentor_returns_404(self):
        """Test getting non-existent mentor returns 404"""
        response = requests.get(f"{BASE_URL}/api/mentors/nonexistent-id")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
