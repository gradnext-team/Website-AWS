"""
Test Plan Management System - Admin Dashboard
Tests CRUD operations for plans across 4 categories: subscription, coaching, cohort, addon
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consultant-gateway.preview.emergentagent.com')


class TestPlansManagement:
    """Plan Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        yield
        
        # Cleanup: Delete any test plans created
        try:
            plans_response = self.session.get(f"{BASE_URL}/api/admin/plans")
            if plans_response.status_code == 200:
                plans = plans_response.json().get('plans', [])
                for plan in plans:
                    if plan.get('plan_key', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan['id']}")
        except:
            pass
    
    # ============ GET Plans Tests ============
    
    def test_get_all_plans(self):
        """Test GET /api/admin/plans returns all plans with grouped structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert 'plans' in data, "Response should contain 'plans' array"
        assert 'grouped' in data, "Response should contain 'grouped' object"
        
        # Verify grouped categories exist
        grouped = data['grouped']
        assert 'subscription' in grouped, "Should have subscription category"
        assert 'coaching' in grouped, "Should have coaching category"
        assert 'cohort' in grouped, "Should have cohort category"
        assert 'addon' in grouped, "Should have addon category"
        
        # Verify plans have required fields
        if data['plans']:
            plan = data['plans'][0]
            assert 'id' in plan
            assert 'name' in plan
            assert 'plan_key' in plan
            assert 'category' in plan
            assert 'pricing' in plan
            assert 'features' in plan
        
        print(f"✓ GET /api/admin/plans - Found {len(data['plans'])} plans")
    
    def test_get_plans_by_category(self):
        """Test GET /api/admin/plans?category=subscription filters correctly"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans?category=subscription")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned plans should be subscription category
        for plan in data['plans']:
            assert plan['category'] == 'subscription', f"Plan {plan['name']} should be subscription"
        
        print(f"✓ GET /api/admin/plans?category=subscription - Found {len(data['plans'])} subscription plans")
    
    def test_get_single_plan(self):
        """Test GET /api/admin/plans/{plan_id} returns plan details"""
        # First get all plans to get a valid ID
        plans_response = self.session.get(f"{BASE_URL}/api/admin/plans")
        plans = plans_response.json().get('plans', [])
        
        if not plans:
            pytest.skip("No plans available to test")
        
        plan_id = plans[0]['id']
        response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        
        assert response.status_code == 200
        plan = response.json()
        
        assert plan['id'] == plan_id
        assert 'name' in plan
        assert 'features' in plan
        
        print(f"✓ GET /api/admin/plans/{plan_id} - Retrieved plan: {plan['name']}")
    
    def test_get_nonexistent_plan(self):
        """Test GET /api/admin/plans/{invalid_id} returns 404"""
        response = self.session.get(f"{BASE_URL}/api/admin/plans/nonexistent-plan-id")
        
        assert response.status_code == 404
        print("✓ GET /api/admin/plans/nonexistent - Returns 404")
    
    # ============ CREATE Plan Tests ============
    
    def test_create_subscription_plan(self):
        """Test POST /api/admin/plans creates a subscription plan"""
        unique_key = f"TEST_sub_{uuid.uuid4().hex[:6]}"
        
        plan_data = {
            "name": "Test Subscription Plan",
            "plan_key": unique_key,
            "category": "subscription",
            "description": "Test subscription plan for automated testing",
            "pricing": {
                "one_month": 999,
                "six_month": 799,
                "one_time": None
            },
            "currency": "INR",
            "duration_months": 1,
            "is_auto_renew": True,
            "features": {
                "course_recordings": True,
                "course_recordings_limited": False,
                "drills_exercises": True,
                "drills_limited": False,
                "case_materials": True,
                "case_materials_limited": False,
                "workshops": "recorded_and_live",
                "workshops_limited": False,
                "peer_to_peer": "1_per_week",
                "coaching_sessions": 2,
                "strategy_calls": 1,
                "dedicated_coach": False
            },
            "is_active": True,
            "is_hidden": False,
            "order": 100,
            "highlight": True,
            "badge": "Test Badge",
            "application_only": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        
        assert response.status_code in [200, 201], f"Create failed: {response.text}"
        data = response.json()
        
        assert 'plan_id' in data
        assert data['message'] == "Plan created successfully"
        
        # Verify plan was created by fetching it
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
        assert get_response.status_code == 200
        
        created_plan = get_response.json()
        assert created_plan['name'] == "Test Subscription Plan"
        assert created_plan['plan_key'] == unique_key
        assert created_plan['category'] == "subscription"
        assert created_plan['pricing']['one_month'] == 999
        assert created_plan['features']['coaching_sessions'] == 2
        
        print(f"✓ POST /api/admin/plans - Created subscription plan: {data['plan_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
    
    def test_create_coaching_plan(self):
        """Test POST /api/admin/plans creates a coaching plan"""
        unique_key = f"TEST_coach_{uuid.uuid4().hex[:6]}"
        
        plan_data = {
            "name": "Test Coaching Package",
            "plan_key": unique_key,
            "category": "coaching",
            "description": "1:1 coaching package for testing",
            "pricing": {
                "one_month": None,
                "six_month": None,
                "one_time": 16999
            },
            "currency": "INR",
            "duration_months": 2,
            "is_auto_renew": False,
            "features": {
                "course_recordings": True,
                "drills_exercises": True,
                "case_materials": True,
                "workshops": "recorded_and_live",
                "peer_to_peer": "unlimited",
                "coaching_sessions": 8,
                "strategy_calls": 2,
                "dedicated_coach": True
            },
            "is_active": True,
            "is_hidden": False,
            "order": 50
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
        created_plan = get_response.json()
        
        assert created_plan['category'] == "coaching"
        assert created_plan['pricing']['one_time'] == 16999
        assert created_plan['features']['dedicated_coach'] == True
        
        print(f"✓ POST /api/admin/plans - Created coaching plan: {data['plan_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
    
    def test_create_cohort_plan(self):
        """Test POST /api/admin/plans creates a cohort plan"""
        unique_key = f"TEST_cohort_{uuid.uuid4().hex[:6]}"
        
        plan_data = {
            "name": "Test Cohort Program",
            "plan_key": unique_key,
            "category": "cohort",
            "description": "Group program for testing",
            "pricing": {
                "one_time": 34999
            },
            "duration_months": 3,
            "features": {
                "course_recordings": True,
                "workshops": "recorded_and_live",
                "peer_to_peer": "unlimited",
                "coaching_sessions": 12,
                "strategy_calls": 4,
                "dedicated_coach": True
            },
            "is_active": True,
            "application_only": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
        created_plan = get_response.json()
        
        assert created_plan['category'] == "cohort"
        assert created_plan['application_only'] == True
        
        print(f"✓ POST /api/admin/plans - Created cohort plan: {data['plan_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
    
    def test_create_addon_plan(self):
        """Test POST /api/admin/plans creates an addon plan"""
        unique_key = f"TEST_addon_{uuid.uuid4().hex[:6]}"
        
        plan_data = {
            "name": "Test Add-on Sessions",
            "plan_key": unique_key,
            "category": "addon",
            "description": "Additional coaching sessions",
            "pricing": {
                "one_time": 4999
            },
            "features": {
                "coaching_sessions": 3,
                "strategy_calls": 0
            },
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
        created_plan = get_response.json()
        
        assert created_plan['category'] == "addon"
        
        print(f"✓ POST /api/admin/plans - Created addon plan: {data['plan_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{data['plan_id']}")
    
    def test_create_plan_duplicate_key_fails(self):
        """Test POST /api/admin/plans with duplicate plan_key fails"""
        # Get existing plan key
        plans_response = self.session.get(f"{BASE_URL}/api/admin/plans")
        plans = plans_response.json().get('plans', [])
        
        if not plans:
            pytest.skip("No plans available to test duplicate key")
        
        existing_key = plans[0]['plan_key']
        
        plan_data = {
            "name": "Duplicate Key Test",
            "plan_key": existing_key,  # Use existing key
            "category": "subscription"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/plans", json=plan_data)
        
        assert response.status_code == 400
        assert "already exists" in response.json().get('detail', '').lower()
        
        print(f"✓ POST /api/admin/plans - Duplicate key rejected correctly")
    
    # ============ UPDATE Plan Tests ============
    
    def test_update_plan_name(self):
        """Test PUT /api/admin/plans/{plan_id} updates plan name"""
        # Create a test plan first
        unique_key = f"TEST_update_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Original Name",
            "plan_key": unique_key,
            "category": "subscription"
        })
        
        assert create_response.status_code in [200, 201]
        plan_id = create_response.json()['plan_id']
        
        # Update the plan
        update_response = self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "name": "Updated Name"
        })
        
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        updated_plan = get_response.json()
        
        assert updated_plan['name'] == "Updated Name"
        
        print(f"✓ PUT /api/admin/plans/{plan_id} - Name updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_update_plan_pricing(self):
        """Test PUT /api/admin/plans/{plan_id} updates pricing"""
        unique_key = f"TEST_price_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Pricing Test Plan",
            "plan_key": unique_key,
            "category": "subscription",
            "pricing": {"one_month": 500}
        })
        
        plan_id = create_response.json()['plan_id']
        
        # Update pricing
        update_response = self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "pricing": {"one_month": 999, "six_month": 799}
        })
        
        assert update_response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        updated_plan = get_response.json()
        
        assert updated_plan['pricing']['one_month'] == 999
        assert updated_plan['pricing']['six_month'] == 799
        
        print(f"✓ PUT /api/admin/plans/{plan_id} - Pricing updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_update_plan_features(self):
        """Test PUT /api/admin/plans/{plan_id} updates features"""
        unique_key = f"TEST_feat_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Features Test Plan",
            "plan_key": unique_key,
            "category": "coaching",
            "features": {"coaching_sessions": 2, "dedicated_coach": False}
        })
        
        plan_id = create_response.json()['plan_id']
        
        # Update features
        update_response = self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "features": {"coaching_sessions": 10, "dedicated_coach": True, "peer_to_peer": "unlimited"}
        })
        
        assert update_response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        updated_plan = get_response.json()
        
        assert updated_plan['features']['coaching_sessions'] == 10
        assert updated_plan['features']['dedicated_coach'] == True
        assert updated_plan['features']['peer_to_peer'] == "unlimited"
        
        print(f"✓ PUT /api/admin/plans/{plan_id} - Features updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_toggle_plan_active_status(self):
        """Test PUT /api/admin/plans/{plan_id} toggles is_active"""
        unique_key = f"TEST_active_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Active Toggle Test",
            "plan_key": unique_key,
            "category": "subscription",
            "is_active": True
        })
        
        plan_id = create_response.json()['plan_id']
        
        # Deactivate
        update_response = self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "is_active": False
        })
        
        assert update_response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.json()['is_active'] == False
        
        # Reactivate
        self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={"is_active": True})
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.json()['is_active'] == True
        
        print(f"✓ PUT /api/admin/plans/{plan_id} - Active status toggled successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    def test_toggle_plan_visibility(self):
        """Test PUT /api/admin/plans/{plan_id} toggles is_hidden"""
        unique_key = f"TEST_hidden_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Visibility Toggle Test",
            "plan_key": unique_key,
            "category": "subscription",
            "is_hidden": False
        })
        
        plan_id = create_response.json()['plan_id']
        
        # Hide
        update_response = self.session.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json={
            "is_hidden": True
        })
        
        assert update_response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.json()['is_hidden'] == True
        
        print(f"✓ PUT /api/admin/plans/{plan_id} - Visibility toggled successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
    
    # ============ DELETE Plan Tests ============
    
    def test_delete_plan(self):
        """Test DELETE /api/admin/plans/{plan_id} removes plan"""
        unique_key = f"TEST_delete_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Delete Test Plan",
            "plan_key": unique_key,
            "category": "addon"
        })
        
        plan_id = create_response.json()['plan_id']
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.status_code == 404
        
        print(f"✓ DELETE /api/admin/plans/{plan_id} - Plan deleted successfully")
    
    def test_delete_nonexistent_plan(self):
        """Test DELETE /api/admin/plans/{invalid_id} returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/admin/plans/nonexistent-plan-id")
        
        assert response.status_code == 404
        print("✓ DELETE /api/admin/plans/nonexistent - Returns 404")
    
    # ============ DUPLICATE Plan Tests ============
    
    def test_duplicate_plan(self):
        """Test POST /api/admin/plans/{plan_id}/duplicate creates copy"""
        unique_key = f"TEST_dup_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Original Plan to Duplicate",
            "plan_key": unique_key,
            "category": "coaching",
            "pricing": {"one_time": 9999},
            "features": {"coaching_sessions": 5}
        })
        
        original_id = create_response.json()['plan_id']
        
        # Duplicate
        dup_response = self.session.post(f"{BASE_URL}/api/admin/plans/{original_id}/duplicate")
        
        assert dup_response.status_code in [200, 201]
        dup_data = dup_response.json()
        
        assert 'plan_id' in dup_data
        assert dup_data['plan_id'] != original_id
        
        # Verify duplicate has same data but different key
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{dup_data['plan_id']}")
        dup_plan = get_response.json()
        
        assert "Copy" in dup_plan['name']
        assert dup_plan['plan_key'] != unique_key
        assert dup_plan['pricing']['one_time'] == 9999
        assert dup_plan['features']['coaching_sessions'] == 5
        
        print(f"✓ POST /api/admin/plans/{original_id}/duplicate - Plan duplicated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{original_id}")
        self.session.delete(f"{BASE_URL}/api/admin/plans/{dup_data['plan_id']}")
    
    # ============ Feature Access Tests ============
    
    def test_plan_feature_workshops_options(self):
        """Test plan workshops feature accepts valid options"""
        unique_key = f"TEST_ws_{uuid.uuid4().hex[:6]}"
        
        for workshop_option in ['none', 'only_recorded', 'recorded_and_live']:
            create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
                "name": f"Workshop Test {workshop_option}",
                "plan_key": f"{unique_key}_{workshop_option}",
                "category": "subscription",
                "features": {"workshops": workshop_option}
            })
            
            assert create_response.status_code in [200, 201]
            plan_id = create_response.json()['plan_id']
            
            get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
            assert get_response.json()['features']['workshops'] == workshop_option
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        
        print("✓ Plan workshops feature accepts all valid options")
    
    def test_plan_feature_peer_practice_options(self):
        """Test plan peer_to_peer feature accepts valid options"""
        unique_key = f"TEST_peer_{uuid.uuid4().hex[:6]}"
        
        for peer_option in ['none', '1_only', '1_per_week', '2_per_week', 'unlimited']:
            create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
                "name": f"Peer Test {peer_option}",
                "plan_key": f"{unique_key}_{peer_option}",
                "category": "subscription",
                "features": {"peer_to_peer": peer_option}
            })
            
            assert create_response.status_code in [200, 201]
            plan_id = create_response.json()['plan_id']
            
            get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
            assert get_response.json()['features']['peer_to_peer'] == peer_option
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        
        print("✓ Plan peer_to_peer feature accepts all valid options")
    
    def test_plan_coaching_sessions_unlimited(self):
        """Test plan coaching_sessions accepts -1 for unlimited"""
        unique_key = f"TEST_unlimited_{uuid.uuid4().hex[:6]}"
        
        create_response = self.session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Unlimited Coaching Test",
            "plan_key": unique_key,
            "category": "coaching",
            "features": {"coaching_sessions": -1}
        })
        
        assert create_response.status_code in [200, 201]
        plan_id = create_response.json()['plan_id']
        
        get_response = self.session.get(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert get_response.json()['features']['coaching_sessions'] == -1
        
        print("✓ Plan coaching_sessions accepts -1 for unlimited")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")


class TestPlansAuthentication:
    """Test authentication requirements for plan endpoints"""
    
    def test_get_plans_requires_auth(self):
        """Test GET /api/admin/plans requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/plans")
        
        assert response.status_code == 401
        print("✓ GET /api/admin/plans requires authentication")
    
    def test_create_plan_requires_admin(self):
        """Test POST /api/admin/plans requires admin role"""
        session = requests.Session()
        
        # Login as regular user
        session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        
        response = session.post(f"{BASE_URL}/api/admin/plans", json={
            "name": "Unauthorized Test",
            "plan_key": "unauthorized_test",
            "category": "subscription"
        })
        
        assert response.status_code == 403
        print("✓ POST /api/admin/plans requires admin role")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
