"""
Test Suite for gradnext Admin Panel - Iteration 4 Features
Tests:
1. Candidate dashboard 1:1 Coaching shows all mentors
2. Admin Mentors section shows mentor cards with ₹ (INR) rates
3. Admin Mentors section - Edit button opens modal with editable fields
4. Admin Peer Practice has search bar and status filter
5. Admin Cohort section shows Create Cohort and Add Section buttons
6. Mentors API returns all mentors correctly (/api/mentors)
7. Weekly availability selector shows Mon-Sun with Add Slot buttons
8. Quick Add to All Days button adds slots (not replaces)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMentorsAPI:
    """Test mentors API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_get_all_mentors_returns_list(self):
        """Test GET /api/mentors returns a list of mentors"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/mentors returns list with {len(data)} mentors")
        
    def test_mentors_have_required_fields(self):
        """Test that mentors have all required fields with defaults"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            mentor = data[0]
            required_fields = ['id', 'name', 'picture', 'title', 'company', 'rating', 'hourly_rate']
            for field in required_fields:
                assert field in mentor, f"Mentor missing required field: {field}"
            print(f"✓ Mentors have all required fields: {required_fields}")
        else:
            print("⚠ No mentors in database to verify fields")
            
    def test_mentors_have_inr_rates(self):
        """Test that mentor hourly_rate is in INR (numeric value)"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            for mentor in data:
                hourly_rate = mentor.get('hourly_rate', 0)
                assert isinstance(hourly_rate, (int, float)), f"hourly_rate should be numeric, got {type(hourly_rate)}"
                # INR rates are typically in thousands (e.g., 12000)
                print(f"✓ Mentor {mentor.get('name', 'Unknown')}: ₹{hourly_rate:,}")
        else:
            print("⚠ No mentors to verify rates")


class TestAdminMentorsAPI:
    """Test admin mentors API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        print("✓ Admin login successful")
        
    def test_admin_get_mentors(self):
        """Test GET /api/admin/mentors returns mentors list"""
        response = self.session.get(f"{BASE_URL}/api/admin/mentors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'mentors' in data, "Response should have 'mentors' key"
        assert isinstance(data['mentors'], list), "mentors should be a list"
        print(f"✓ Admin GET /api/admin/mentors returns {len(data['mentors'])} mentors")
        
    def test_admin_invite_mentor(self):
        """Test POST /api/admin/mentors/invite creates a new mentor"""
        mentor_data = {
            "name": "TEST_Dr. Test Mentor",
            "email": "test_mentor_iter4@gradnext.com",
            "specialization": "McKinsey",
            "hourly_rate": 15000,
            "bio": "Test mentor for iteration 4 testing",
            "title": "Senior Consultant",
            "company": "McKinsey"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/mentors/invite", json=mentor_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'mentor_id' in data, "Response should have mentor_id"
        self.created_mentor_id = data['mentor_id']
        print(f"✓ Created mentor with ID: {self.created_mentor_id}")
        
        # Verify mentor appears in list
        list_response = self.session.get(f"{BASE_URL}/api/admin/mentors")
        mentors = list_response.json().get('mentors', [])
        mentor_names = [m.get('name') for m in mentors]
        assert "TEST_Dr. Test Mentor" in mentor_names, "Created mentor should appear in list"
        print("✓ Created mentor appears in admin mentors list")
        
    def test_admin_update_mentor(self):
        """Test PUT /api/admin/mentors/{id} updates mentor details"""
        # First create a mentor
        mentor_data = {
            "name": "TEST_Update Mentor",
            "email": "test_update_mentor@gradnext.com",
            "specialization": "BCG",
            "hourly_rate": 12000
        }
        create_response = self.session.post(f"{BASE_URL}/api/admin/mentors/invite", json=mentor_data)
        assert create_response.status_code == 200
        mentor_id = create_response.json()['mentor_id']
        
        # Update the mentor
        update_data = {
            "name": "TEST_Updated Mentor Name",
            "hourly_rate": 18000,
            "bio": "Updated bio for testing"
        }
        update_response = self.session.put(f"{BASE_URL}/api/admin/mentors/{mentor_id}", json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"✓ Updated mentor {mentor_id}")
        
        # Verify update
        list_response = self.session.get(f"{BASE_URL}/api/admin/mentors")
        mentors = list_response.json().get('mentors', [])
        updated_mentor = next((m for m in mentors if m.get('id') == mentor_id), None)
        assert updated_mentor is not None, "Updated mentor should exist"
        assert updated_mentor.get('name') == "TEST_Updated Mentor Name", "Name should be updated"
        assert updated_mentor.get('hourly_rate') == 18000, "Rate should be updated"
        print("✓ Mentor update verified")


class TestAdminPeerPracticeAPI:
    """Test admin peer practice API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert login_response.status_code == 200
        
    def test_get_peer_practice_users(self):
        """Test GET /api/admin/peer-practice/users returns users list"""
        response = self.session.get(f"{BASE_URL}/api/admin/peer-practice/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'users' in data, "Response should have 'users' key"
        assert isinstance(data['users'], list), "users should be a list"
        print(f"✓ GET /api/admin/peer-practice/users returns {len(data['users'])} users")
        
        # Verify user fields for search/filter functionality
        if len(data['users']) > 0:
            user = data['users'][0]
            assert 'name' in user, "User should have name for search"
            assert 'email' in user, "User should have email for search"
            print("✓ Users have name and email fields for search functionality")


class TestAdminCohortAPI:
    """Test admin cohort API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert login_response.status_code == 200
        
    def test_get_cohorts(self):
        """Test GET /api/admin/cohorts returns cohorts list"""
        response = self.session.get(f"{BASE_URL}/api/admin/cohorts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'cohorts' in data, "Response should have 'cohorts' key"
        assert isinstance(data['cohorts'], list), "cohorts should be a list"
        print(f"✓ GET /api/admin/cohorts returns {len(data['cohorts'])} cohorts")
        
    def test_create_cohort(self):
        """Test POST /api/admin/cohorts creates a new cohort"""
        cohort_data = {
            "name": "TEST_Cohort Iteration 4",
            "description": "Test cohort for iteration 4 testing",
            "start_date": "2025-01-01",
            "end_date": "2025-03-31",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'cohort_id' in data, "Response should have cohort_id"
        cohort_id = data['cohort_id']
        print(f"✓ Created cohort with ID: {cohort_id}")
        
        # Verify cohort appears in list
        list_response = self.session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = list_response.json().get('cohorts', [])
        cohort_names = [c.get('name') for c in cohorts]
        assert "TEST_Cohort Iteration 4" in cohort_names, "Created cohort should appear in list"
        print("✓ Created cohort appears in admin cohorts list")
        
        return cohort_id
        
    def test_add_section_to_cohort(self):
        """Test POST /api/admin/cohorts/{id}/sections adds a section"""
        # First create a cohort
        cohort_data = {
            "name": "TEST_Cohort With Section",
            "description": "Test cohort for section testing",
            "start_date": "2025-01-01",
            "end_date": "2025-03-31"
        }
        create_response = self.session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
        assert create_response.status_code == 200
        cohort_id = create_response.json()['cohort_id']
        
        # Add a section
        section_data = {
            "title": "TEST_Week 1: Fundamentals",
            "description": "Introduction to case interviews",
            "order": 1
        }
        section_response = self.session.post(f"{BASE_URL}/api/admin/cohorts/{cohort_id}/sections", json=section_data)
        assert section_response.status_code == 200, f"Add section failed: {section_response.text}"
        
        data = section_response.json()
        assert 'section_id' in data, "Response should have section_id"
        print(f"✓ Added section with ID: {data['section_id']}")
        
        # Verify section appears in cohort
        list_response = self.session.get(f"{BASE_URL}/api/admin/cohorts")
        cohorts = list_response.json().get('cohorts', [])
        test_cohort = next((c for c in cohorts if c.get('id') == cohort_id), None)
        assert test_cohort is not None, "Cohort should exist"
        sections = test_cohort.get('sections', [])
        section_titles = [s.get('title') for s in sections]
        assert "TEST_Week 1: Fundamentals" in section_titles, "Section should appear in cohort"
        print("✓ Section appears in cohort sections list")
        
    def test_add_resource_to_cohort(self):
        """Test POST /api/admin/cohorts/{id}/resources adds a resource"""
        # First create a cohort
        cohort_data = {
            "name": "TEST_Cohort With Resource",
            "description": "Test cohort for resource testing",
            "start_date": "2025-01-01",
            "end_date": "2025-03-31"
        }
        create_response = self.session.post(f"{BASE_URL}/api/admin/cohorts", json=cohort_data)
        assert create_response.status_code == 200
        cohort_id = create_response.json()['cohort_id']
        
        # Add a resource
        resource_data = {
            "title": "TEST_Case Framework PDF",
            "type": "document",
            "file_url": "https://example.com/framework.pdf"
        }
        resource_response = self.session.post(f"{BASE_URL}/api/admin/cohorts/{cohort_id}/resources", json=resource_data)
        assert resource_response.status_code == 200, f"Add resource failed: {resource_response.text}"
        
        data = resource_response.json()
        assert 'resource_id' in data, "Response should have resource_id"
        print(f"✓ Added resource with ID: {data['resource_id']}")


class TestCandidateCoachingAPI:
    """Test candidate coaching API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with candidate auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as last_mile candidate (has coaching access)
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert login_response.status_code == 200, f"Candidate login failed: {login_response.text}"
        print("✓ Candidate (last_mile) login successful")
        
    def test_candidate_can_see_mentors(self):
        """Test that candidate can access mentors list"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Candidate can see {len(data)} mentors")
        
        # Verify mentor details are visible
        if len(data) > 0:
            mentor = data[0]
            assert 'name' in mentor, "Mentor should have name"
            assert 'picture' in mentor, "Mentor should have picture"
            assert 'rating' in mentor, "Mentor should have rating"
            assert 'sessions_conducted' in mentor or 'sessions_done' in mentor, "Mentor should have sessions count"
            print("✓ Mentor details are visible to candidate")


class TestMentorAvailabilityAPI:
    """Test mentor availability API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert login_response.status_code == 200
        
    def test_update_mentor_availability_weekly(self):
        """Test PUT /api/admin/mentors/{id}/availability with weekly format"""
        # First create a mentor
        mentor_data = {
            "name": "TEST_Availability Mentor",
            "email": "test_avail_mentor@gradnext.com",
            "specialization": "Bain",
            "hourly_rate": 14000
        }
        create_response = self.session.post(f"{BASE_URL}/api/admin/mentors/invite", json=mentor_data)
        assert create_response.status_code == 200
        mentor_id = create_response.json()['mentor_id']
        
        # Update availability with weekly format (Mon-Sun)
        availability_data = {
            "mentor_id": mentor_id,
            "availability": [
                {"date": "2025-01-20", "slots": ["09:00", "10:00", "11:00"]},
                {"date": "2025-01-21", "slots": ["14:00", "15:00", "16:00"]},
                {"date": "2025-01-22", "slots": ["09:00", "10:00"]}
            ]
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/mentors/{mentor_id}/availability", 
            json=availability_data
        )
        assert update_response.status_code == 200, f"Update availability failed: {update_response.text}"
        print(f"✓ Updated availability for mentor {mentor_id}")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Cleanup after tests
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as admin
    login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
    if login_response.status_code != 200:
        print("⚠ Could not login for cleanup")
        return
        
    # Get and delete test mentors
    mentors_response = session.get(f"{BASE_URL}/api/admin/mentors")
    if mentors_response.status_code == 200:
        mentors = mentors_response.json().get('mentors', [])
        for mentor in mentors:
            if mentor.get('name', '').startswith('TEST_'):
                delete_response = session.delete(f"{BASE_URL}/api/admin/mentors/{mentor['id']}")
                if delete_response.status_code == 200:
                    print(f"✓ Cleaned up test mentor: {mentor['name']}")
                    
    print("✓ Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
