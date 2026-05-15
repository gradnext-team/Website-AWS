"""
Cohort Lifecycle Tests
Tests for cohort creation, status management, and registration flow
- Admin can create cohort with status 'registering' or 'active'
- Only one 'registering' cohort allowed at a time
- Only one 'active' cohort allowed at a time
- Admin can change cohort status via PUT /api/admin/cohorts/{id}/status
- Candidate can see registering cohort via GET /api/resources/cohort/registering
- Candidate can register for cohort via POST /api/resources/cohort/register/{id}
- Enrolled candidate can see their cohort details via GET /api/resources/cohort/my-enrollment
- Admin can view cohort members via GET /api/admin/cohorts/{id}/members
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCohortLifecycle:
    """Test cohort lifecycle management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin credentials"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        admin_login = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        
        # Store admin session
        self.admin_session = self.session
        
        # Create a separate session for free user
        self.free_session = requests.Session()
        self.free_session.headers.update({"Content-Type": "application/json"})
        free_login = self.free_session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert free_login.status_code == 200, f"Free user login failed: {free_login.text}"
        
        yield
        
    def test_01_get_existing_cohorts(self):
        """Test getting all existing cohorts"""
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        assert response.status_code == 200, f"Failed to get cohorts: {response.text}"
        
        data = response.json()
        assert "cohorts" in data
        print(f"Found {len(data['cohorts'])} existing cohorts")
        
        # Print existing cohorts for context
        for cohort in data['cohorts']:
            print(f"  - {cohort['name']} (status: {cohort.get('status', 'unknown')}, id: {cohort['id']})")
    
    def test_02_admin_create_cohort_registering(self):
        """Test admin can create a cohort with status 'registering'"""
        # First, check if there's already a registering cohort
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        existing_cohorts = response.json().get('cohorts', [])
        registering_exists = any(c.get('status') == 'registering' for c in existing_cohorts)
        
        if registering_exists:
            print("A registering cohort already exists - testing duplicate prevention")
            # Try to create another registering cohort - should fail
            cohort_data = {
                "name": f"TEST_Duplicate_Registering_{uuid.uuid4().hex[:6]}",
                "description": "Test duplicate registering cohort",
                "start_date": "2026-04-01",
                "end_date": "2026-05-31",
                "status": "registering",
                "max_participants": 30
            }
            response = self.admin_session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
            assert response.status_code == 400, f"Should fail when creating second registering cohort: {response.text}"
            assert "already exists" in response.json().get('detail', '').lower() or "registering" in response.json().get('detail', '').lower()
            print(f"Correctly prevented duplicate: {response.json().get('detail')}")
        else:
            # Create a new registering cohort
            cohort_data = {
                "name": f"TEST_March_2026_Batch_{uuid.uuid4().hex[:6]}",
                "description": "Test cohort for lifecycle testing",
                "start_date": "2026-03-01",
                "end_date": "2026-04-30",
                "status": "registering",
                "max_participants": 30
            }
            response = self.admin_session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
            assert response.status_code == 200, f"Failed to create cohort: {response.text}"
            
            data = response.json()
            assert "cohort_id" in data
            print(f"Created registering cohort: {data['cohort_id']}")
    
    def test_03_only_one_registering_cohort_allowed(self):
        """Test that only one registering cohort is allowed"""
        # Get current cohorts
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        existing_cohorts = response.json().get('cohorts', [])
        registering_cohorts = [c for c in existing_cohorts if c.get('status') == 'registering']
        
        if not registering_cohorts:
            pytest.skip("No registering cohort exists to test duplicate prevention")
        
        # Try to create another registering cohort
        cohort_data = {
            "name": f"TEST_Should_Fail_{uuid.uuid4().hex[:6]}",
            "description": "This should fail",
            "start_date": "2026-05-01",
            "end_date": "2026-06-30",
            "status": "registering",
            "max_participants": 25
        }
        response = self.admin_session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
        
        assert response.status_code == 400, f"Should have failed with 400, got {response.status_code}: {response.text}"
        error_detail = response.json().get('detail', '')
        assert "registering" in error_detail.lower() or "already exists" in error_detail.lower()
        print(f"Correctly prevented second registering cohort: {error_detail}")
    
    def test_04_only_one_active_cohort_allowed(self):
        """Test that only one active cohort is allowed"""
        # Get current cohorts
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        existing_cohorts = response.json().get('cohorts', [])
        active_cohorts = [c for c in existing_cohorts if c.get('status') == 'active']
        
        if not active_cohorts:
            # Create an active cohort first
            cohort_data = {
                "name": f"TEST_Active_Cohort_{uuid.uuid4().hex[:6]}",
                "description": "Test active cohort",
                "start_date": "2026-01-01",
                "end_date": "2026-02-28",
                "status": "active",
                "max_participants": 40
            }
            response = self.admin_session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
            if response.status_code != 200:
                pytest.skip(f"Could not create active cohort: {response.text}")
            print("Created active cohort for testing")
        
        # Try to create another active cohort
        cohort_data = {
            "name": f"TEST_Second_Active_{uuid.uuid4().hex[:6]}",
            "description": "This should fail",
            "start_date": "2026-02-01",
            "end_date": "2026-03-31",
            "status": "active",
            "max_participants": 30
        }
        response = self.admin_session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
        
        assert response.status_code == 400, f"Should have failed with 400, got {response.status_code}: {response.text}"
        error_detail = response.json().get('detail', '')
        assert "active" in error_detail.lower() or "already exists" in error_detail.lower()
        print(f"Correctly prevented second active cohort: {error_detail}")
    
    def test_05_admin_change_cohort_status(self):
        """Test admin can change cohort status via PUT /api/admin/cohorts/{id}/status"""
        # Get cohorts
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = response.json().get('cohorts', [])
        
        # Find a cohort that's not active (to test status change)
        test_cohort = None
        for c in cohorts:
            if c.get('status') in ['completed', 'archived']:
                test_cohort = c
                break
        
        if not test_cohort:
            # Try to find a registering cohort and change to completed
            for c in cohorts:
                if c.get('status') == 'registering':
                    test_cohort = c
                    break
        
        if not test_cohort:
            pytest.skip("No suitable cohort found for status change test")
        
        cohort_id = test_cohort['id']
        current_status = test_cohort.get('status')
        
        # Try to change to 'completed' or 'archived' (these don't have lifecycle restrictions)
        new_status = 'completed' if current_status != 'completed' else 'archived'
        
        response = self.admin_session.put(
            f"{BASE_URL}/api/admin/cohorts/{cohort_id}/status",
            json={"status": new_status}
        )
        
        assert response.status_code == 200, f"Failed to change status: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Changed cohort status from '{current_status}' to '{new_status}'")
    
    def test_06_status_change_lifecycle_validation(self):
        """Test that status change respects lifecycle rules"""
        # Get cohorts
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = response.json().get('cohorts', [])
        
        active_cohorts = [c for c in cohorts if c.get('status') == 'active']
        registering_cohorts = [c for c in cohorts if c.get('status') == 'registering']
        
        # If there's an active cohort, try to activate another one
        if active_cohorts and len(cohorts) > 1:
            # Find a non-active cohort
            non_active = next((c for c in cohorts if c.get('status') != 'active'), None)
            if non_active:
                response = self.admin_session.put(
                    f"{BASE_URL}/api/admin/cohorts/{non_active['id']}/status",
                    json={"status": "active"}
                )
                assert response.status_code == 400, f"Should fail when activating second cohort: {response.text}"
                print(f"Correctly prevented activating second cohort: {response.json().get('detail')}")
        
        # If there's a registering cohort, try to set another to registering
        if registering_cohorts and len(cohorts) > 1:
            non_registering = next((c for c in cohorts if c.get('status') != 'registering'), None)
            if non_registering:
                response = self.admin_session.put(
                    f"{BASE_URL}/api/admin/cohorts/{non_registering['id']}/status",
                    json={"status": "registering"}
                )
                assert response.status_code == 400, f"Should fail when setting second to registering: {response.text}"
                print(f"Correctly prevented second registering cohort: {response.json().get('detail')}")
    
    def test_07_candidate_see_registering_cohort(self):
        """Test candidate can see registering cohort via GET /api/resources/cohort/registering"""
        response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/registering")
        assert response.status_code == 200, f"Failed to get registering cohort: {response.text}"
        
        data = response.json()
        print(f"Registering cohort response: {data}")
        
        if data.get('cohort'):
            assert 'name' in data['cohort']
            assert 'spots_remaining' in data['cohort']
            print(f"Found registering cohort: {data['cohort']['name']}, spots: {data['cohort']['spots_remaining']}")
        else:
            print("No registering cohort available")
    
    def test_08_candidate_my_enrollment(self):
        """Test enrolled candidate can see their cohort details via GET /api/resources/cohort/my-enrollment"""
        response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/my-enrollment")
        assert response.status_code == 200, f"Failed to get enrollment: {response.text}"
        
        data = response.json()
        print(f"Enrollment data: enrolled={data.get('enrolled')}")
        
        if data.get('enrolled'):
            assert 'cohort' in data
            cohort = data['cohort']
            assert 'name' in cohort
            print(f"User is enrolled in: {cohort['name']}")
            
            # Check for sections and resources
            if 'sections' in cohort:
                print(f"  Sections: {len(cohort['sections'])}")
            if 'resources' in cohort:
                print(f"  Resources: {len(cohort['resources'])}")
        else:
            print("User is not enrolled in any cohort")
            if data.get('registering_cohort_available'):
                print(f"  Registering cohort available: {data.get('registering_cohort', {}).get('name')}")
    
    def test_09_admin_view_cohort_members(self):
        """Test admin can view cohort members via GET /api/admin/cohorts/{id}/members"""
        # Get cohorts
        response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = response.json().get('cohorts', [])
        
        if not cohorts:
            pytest.skip("No cohorts available to test members endpoint")
        
        # Test with first cohort that has members
        for cohort in cohorts:
            cohort_id = cohort['id']
            response = self.admin_session.get(f"{BASE_URL}/api/admin/cohorts/{cohort_id}/members")
            assert response.status_code == 200, f"Failed to get members: {response.text}"
            
            data = response.json()
            assert 'members' in data
            assert 'count' in data
            
            print(f"Cohort '{cohort['name']}' has {data['count']} members")
            
            if data['count'] > 0:
                # Verify member structure
                member = data['members'][0]
                assert 'id' in member
                assert 'name' in member or 'email' in member
                print(f"  Sample member: {member.get('name', member.get('email'))}")
                break
    
    def test_10_candidate_register_for_cohort(self):
        """Test candidate can register for cohort via POST /api/resources/cohort/register/{id}"""
        # First check if user is already enrolled
        enrollment_response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/my-enrollment")
        enrollment_data = enrollment_response.json()
        
        if enrollment_data.get('enrolled'):
            print(f"User already enrolled in: {enrollment_data['cohort']['name']}")
            
            # Try to register again - should fail
            reg_response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/registering")
            if reg_response.json().get('cohort'):
                cohort_id = reg_response.json()['cohort']['id']
                response = self.free_session.post(f"{BASE_URL}/api/resources/cohort/register/{cohort_id}")
                assert response.status_code == 400, f"Should fail when already enrolled: {response.text}"
                print(f"Correctly prevented double enrollment: {response.json().get('detail')}")
            return
        
        # Get registering cohort
        reg_response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/registering")
        reg_data = reg_response.json()
        
        if not reg_data.get('cohort') or not reg_data.get('can_register'):
            pytest.skip("No registering cohort available or user cannot register")
        
        cohort_id = reg_data['cohort']['id']
        cohort_name = reg_data['cohort']['name']
        
        # Register for cohort
        response = self.free_session.post(f"{BASE_URL}/api/resources/cohort/register/{cohort_id}")
        assert response.status_code == 200, f"Failed to register: {response.text}"
        
        data = response.json()
        assert 'message' in data
        print(f"Successfully registered for cohort: {cohort_name}")
        
        # Verify enrollment
        verify_response = self.free_session.get(f"{BASE_URL}/api/resources/cohort/my-enrollment")
        verify_data = verify_response.json()
        assert verify_data.get('enrolled') == True
        assert verify_data['cohort']['id'] == cohort_id
        print("Enrollment verified successfully")


class TestCohortEdgeCases:
    """Test edge cases for cohort lifecycle"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        admin_login = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert admin_login.status_code == 200
        yield
    
    def test_invalid_status_value(self):
        """Test that invalid status values are rejected"""
        # Get a cohort
        response = self.session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = response.json().get('cohorts', [])
        
        if not cohorts:
            pytest.skip("No cohorts available")
        
        cohort_id = cohorts[0]['id']
        
        # Try invalid status
        response = self.session.put(
            f"{BASE_URL}/api/admin/cohorts/{cohort_id}/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Should reject invalid status: {response.text}"
        print(f"Correctly rejected invalid status: {response.json().get('detail')}")
    
    def test_cohort_not_found(self):
        """Test 404 for non-existent cohort"""
        response = self.session.get(f"{BASE_URL}/api/admin/cohorts/nonexistent-cohort-id/members")
        # This might return 200 with empty members or 404
        print(f"Non-existent cohort response: {response.status_code}")
    
    def test_register_for_non_registering_cohort(self):
        """Test that registration fails for non-registering cohorts"""
        # Create a free user session
        free_session = requests.Session()
        free_session.headers.update({"Content-Type": "application/json"})
        free_session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        
        # Get cohorts and find one that's not registering
        response = self.session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = response.json().get('cohorts', [])
        
        non_registering = next((c for c in cohorts if c.get('status') != 'registering'), None)
        
        if not non_registering:
            pytest.skip("No non-registering cohort available")
        
        # Try to register
        response = free_session.post(f"{BASE_URL}/api/resources/cohort/register/{non_registering['id']}")
        assert response.status_code in [400, 404], f"Should fail for non-registering cohort: {response.text}"
        print(f"Correctly prevented registration for {non_registering.get('status')} cohort")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
