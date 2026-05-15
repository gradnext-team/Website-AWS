"""
Test Plan Management Feature
Tests for:
- Public plans API (GET /api/resources/plans)
- Admin plans CRUD API (GET/POST/PUT/DELETE /api/admin/plans)
- Plan duration supports days, weeks, months units
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consultant-gateway.preview.emergentagent.com')


class TestPublicPlansAPI:
    """Test public plans endpoint - no auth required"""
    
    def test_get_public_plans_returns_200(self):
        """GET /api/resources/plans should return 200"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_get_public_plans_returns_plans_array(self):
        """GET /api/resources/plans should return plans array"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        assert isinstance(data["plans"], list), "Plans should be a list"
        
    def test_public_plans_have_required_fields(self):
        """Each plan should have required fields for display"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        plans = data.get("plans", [])
        
        assert len(plans) > 0, "Should have at least one plan"
        
        required_fields = ["id", "name", "price", "duration", "features"]
        for plan in plans:
            for field in required_fields:
                assert field in plan, f"Plan missing required field: {field}"
                
    def test_public_plans_have_duration_string(self):
        """Plans should have human-readable duration string"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        plans = data.get("plans", [])
        
        for plan in plans:
            assert "duration" in plan, f"Plan {plan.get('name')} missing duration"
            # Duration should be a string like "3 months" or "Unlimited"
            assert isinstance(plan["duration"], str), f"Duration should be string, got {type(plan['duration'])}"
            
    def test_public_plans_have_features_object(self):
        """Plans should have features object with boolean values"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        data = response.json()
        plans = data.get("plans", [])
        
        feature_keys = ["courses", "workshops", "drills", "materials", "peer_practice", "coaching", "cohort"]
        
        for plan in plans:
            features = plan.get("features", {})
            assert isinstance(features, dict), f"Features should be dict for plan {plan.get('name')}"
            for key in feature_keys:
                if key in features:
                    assert isinstance(features[key], bool), f"Feature {key} should be boolean"


class TestAdminPlansAPI:
    """Test admin plans CRUD endpoints - requires admin auth"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert login_response.status_code == 200, "Admin login failed"
        
    def test_admin_get_plans_requires_auth(self):
        """GET /api/admin/plans should require admin auth"""
        # Without auth
        response = requests.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
    def test_admin_get_plans_returns_200(self):
        """GET /api/admin/plans should return 200 for admin"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_admin_get_plans_returns_plans_array(self):
        """GET /api/admin/plans should return plans array"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans")
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' key"
        assert isinstance(data["plans"], list), "Plans should be a list"
        
    def test_admin_plans_have_admin_fields(self):
        """Admin plans should have additional admin fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans")
        data = response.json()
        plans = data.get("plans", [])
        
        assert len(plans) > 0, "Should have at least one plan"
        
        admin_fields = ["id", "plan_key", "name", "is_active", "order"]
        for plan in plans:
            for field in admin_fields:
                assert field in plan, f"Admin plan missing field: {field}"


class TestAdminPlansCRUD:
    """Test admin plans Create, Read, Update, Delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.test_plan_key = f"test_plan_{uuid.uuid4().hex[:8]}"
        self.created_plan_id = None
        
    def teardown_method(self):
        """Cleanup created test plan"""
        if self.created_plan_id:
            try:
                self.session.delete(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
            except:
                pass
                
    def test_create_plan_with_days_duration(self):
        """POST /api/admin/plans should create plan with days duration"""
        plan_data = {
            "name": "Test Plan Days",
            "plan_key": f"test_days_{uuid.uuid4().hex[:8]}",
            "description": "Test plan with days duration",
            "price": 99,
            "currency": "INR",
            "duration_value": 14,
            "duration_unit": "days",
            "coaching_sessions": 0,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": False,
                "drills": True,
                "materials": True,
                "peer_practice": False,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 99,
            "highlight": False,
            "badge": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan_id" in data, "Response should contain plan_id"
        self.created_plan_id = data["plan_id"]
        
        # Verify plan was created with correct duration
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
        assert get_response.status_code == 200
        plan = get_response.json()
        assert plan.get("duration_value") == 14, f"Expected duration_value 14, got {plan.get('duration_value')}"
        assert plan.get("duration_unit") == "days", f"Expected duration_unit 'days', got {plan.get('duration_unit')}"
        
    def test_create_plan_with_weeks_duration(self):
        """POST /api/admin/plans should create plan with weeks duration"""
        plan_data = {
            "name": "Test Plan Weeks",
            "plan_key": f"test_weeks_{uuid.uuid4().hex[:8]}",
            "description": "Test plan with weeks duration",
            "price": 199,
            "currency": "INR",
            "duration_value": 4,
            "duration_unit": "weeks",
            "coaching_sessions": 2,
            "is_subscription": True,
            "features": {
                "courses": True,
                "workshops": True,
                "drills": True,
                "materials": True,
                "peer_practice": True,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 98,
            "highlight": True,
            "badge": "Test Badge"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_plan_id = data["plan_id"]
        
        # Verify plan was created with correct duration
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
        plan = get_response.json()
        assert plan.get("duration_value") == 4
        assert plan.get("duration_unit") == "weeks"
        
    def test_create_plan_with_months_duration(self):
        """POST /api/admin/plans should create plan with months duration"""
        plan_data = {
            "name": "Test Plan Months",
            "plan_key": f"test_months_{uuid.uuid4().hex[:8]}",
            "description": "Test plan with months duration",
            "price": 999,
            "currency": "INR",
            "duration_value": 3,
            "duration_unit": "months",
            "coaching_sessions": 5,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": True,
                "drills": True,
                "materials": True,
                "peer_practice": True,
                "coaching": True,
                "cohort": False
            },
            "is_active": True,
            "order": 97,
            "highlight": False,
            "badge": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_plan_id = data["plan_id"]
        
        # Verify plan was created with correct duration
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
        plan = get_response.json()
        assert plan.get("duration_value") == 3
        assert plan.get("duration_unit") == "months"
        
    def test_update_plan(self):
        """PUT /api/admin/plans/{id} should update plan"""
        # First create a plan
        plan_data = {
            "name": "Test Plan Update",
            "plan_key": f"test_update_{uuid.uuid4().hex[:8]}",
            "description": "Original description",
            "price": 100,
            "currency": "INR",
            "duration_value": 1,
            "duration_unit": "months",
            "coaching_sessions": 0,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": False,
                "drills": True,
                "materials": True,
                "peer_practice": False,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 96,
            "highlight": False,
            "badge": ""
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert create_response.status_code == 200
        self.created_plan_id = create_response.json()["plan_id"]
        
        # Update the plan
        update_data = {
            "name": "Updated Plan Name",
            "description": "Updated description",
            "price": 200,
            "duration_value": 2,
            "duration_unit": "weeks",
            "highlight": True,
            "badge": "Updated Badge"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/plans/{self.created_plan_id}",
            json=update_data
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
        plan = get_response.json()
        assert plan.get("name") == "Updated Plan Name"
        assert plan.get("description") == "Updated description"
        assert plan.get("price") == 200
        assert plan.get("duration_value") == 2
        assert plan.get("duration_unit") == "weeks"
        assert plan.get("highlight") == True
        assert plan.get("badge") == "Updated Badge"
        
    def test_delete_plan(self):
        """DELETE /api/admin/plans/{id} should delete plan"""
        # First create a plan
        plan_data = {
            "name": "Test Plan Delete",
            "plan_key": f"test_delete_{uuid.uuid4().hex[:8]}",
            "description": "Plan to delete",
            "price": 50,
            "currency": "INR",
            "duration_value": 7,
            "duration_unit": "days",
            "coaching_sessions": 0,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": False,
                "drills": True,
                "materials": True,
                "peer_practice": False,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 95,
            "highlight": False,
            "badge": ""
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert create_response.status_code == 200
        plan_id = create_response.json()["plan_id"]
        
        # Delete the plan
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.status_code == 404, "Plan should be deleted"
        
        # Clear created_plan_id since we already deleted it
        self.created_plan_id = None
        
    def test_duplicate_plan_key_rejected(self):
        """POST /api/admin/plans should reject duplicate plan_key"""
        plan_key = f"test_dup_{uuid.uuid4().hex[:8]}"
        
        plan_data = {
            "name": "Test Plan 1",
            "plan_key": plan_key,
            "description": "First plan",
            "price": 100,
            "currency": "INR",
            "duration_value": 1,
            "duration_unit": "months",
            "coaching_sessions": 0,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": False,
                "drills": True,
                "materials": True,
                "peer_practice": False,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 94,
            "highlight": False,
            "badge": ""
        }
        
        # Create first plan
        response1 = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response1.status_code == 200
        self.created_plan_id = response1.json()["plan_id"]
        
        # Try to create duplicate
        plan_data["name"] = "Test Plan 2"
        response2 = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"


class TestPublicPlansReflectAdminChanges:
    """Test that public plans API reflects admin changes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.created_plan_id = None
        
    def teardown_method(self):
        """Cleanup created test plan"""
        if self.created_plan_id:
            try:
                self.session.delete(f"{BASE_URL}/api/admin/plans/{self.created_plan_id}")
            except:
                pass
                
    def test_new_plan_appears_in_public_api(self):
        """New plan created via admin should appear in public API"""
        plan_key = f"test_public_{uuid.uuid4().hex[:8]}"
        
        plan_data = {
            "name": "Test Public Plan",
            "plan_key": plan_key,
            "description": "Test plan for public API",
            "price": 299,
            "currency": "INR",
            "duration_value": 30,
            "duration_unit": "days",
            "coaching_sessions": 1,
            "is_subscription": False,
            "features": {
                "courses": True,
                "workshops": True,
                "drills": True,
                "materials": True,
                "peer_practice": False,
                "coaching": False,
                "cohort": False
            },
            "is_active": True,
            "order": 93,
            "highlight": True,
            "badge": "New!"
        }
        
        # Create plan via admin API
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        assert create_response.status_code == 200
        self.created_plan_id = create_response.json()["plan_id"]
        
        # Check public API
        public_response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert public_response.status_code == 200
        
        public_plans = public_response.json().get("plans", [])
        plan_ids = [p.get("id") for p in public_plans]
        
        # The public API uses plan_key as id
        assert plan_key in plan_ids, f"New plan {plan_key} should appear in public API"
        
        # Find the plan and verify duration string
        new_plan = next((p for p in public_plans if p.get("id") == plan_key), None)
        assert new_plan is not None
        assert new_plan.get("duration") == "30 days", f"Expected '30 days', got {new_plan.get('duration')}"
        assert new_plan.get("highlight") == True
        assert new_plan.get("badge") == "New!"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
