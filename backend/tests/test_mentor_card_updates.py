"""
Test suite for Mentor Card Updates - College field, Logo Repository dropdowns, Headline limit
Tests:
1. PUT /api/admin/mentors/{id} accepts 'college' field
2. POST /api/admin/mentors/invite accepts 'college' field
3. GET /api/resources/logos returns logo repository items
4. Mentor data includes college field in response
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMentorCardUpdates:
    """Test mentor card updates including college field and logo repository"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        # Store cookies for subsequent requests
        self.cookies = login_response.cookies
        
    def test_logo_repository_returns_items(self):
        """Test GET /api/resources/logos returns logo repository items"""
        response = self.session.get(
            f"{BASE_URL}/api/resources/logos",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Logo repository fetch failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "logos" in data, "Response should contain 'logos' key"
        logos = data["logos"]
        assert isinstance(logos, list), "Logos should be a list"
        assert len(logos) > 0, "Logo repository should have items"
        
        # Verify logo item structure
        first_logo = logos[0]
        assert "name" in first_logo, "Logo should have 'name' field"
        assert "logo_url" in first_logo, "Logo should have 'logo_url' field"
        
        print(f"✓ Logo repository has {len(logos)} items")
        
    def test_get_mentors_list(self):
        """Test GET /api/admin/mentors returns mentor list"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Get mentors failed: {response.text}"
        data = response.json()
        
        assert "mentors" in data, "Response should contain 'mentors' key"
        mentors = data["mentors"]
        assert isinstance(mentors, list), "Mentors should be a list"
        
        print(f"✓ Found {len(mentors)} mentors")
        return mentors
        
    def test_invite_mentor_with_college(self):
        """Test POST /api/admin/mentors/invite accepts 'college' field"""
        unique_id = str(uuid.uuid4())[:8]
        mentor_data = {
            "name": f"TEST_Mentor_{unique_id}",
            "email": f"test_mentor_{unique_id}@example.com",
            "phone": "+91 9876543210",
            "linkedin": "linkedin.com/in/testmentor",
            "location": "Mumbai, India",
            "consulting_position": "Senior Consultant",
            "consulting_firm": "McKinsey & Company",
            "current_company": "Google",
            "previous_company_1": "Amazon",
            "previous_company_2": "Microsoft",
            "years_experience": "5",
            "hourly_rate": 12000,
            "price_per_session": 1500,
            "headline": "Ex-McKinsey | 100+ Cases Solved",
            "college": "IIM Bangalore",  # New college field
            "bio": "Test mentor bio"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/mentors/invite",
            json=mentor_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Invite mentor failed: {response.text}"
        data = response.json()
        
        assert "mentor_id" in data, "Response should contain 'mentor_id'"
        mentor_id = data["mentor_id"]
        
        print(f"✓ Mentor invited successfully with ID: {mentor_id}")
        
        # Verify the mentor was created with college field
        get_response = self.session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=self.cookies
        )
        assert get_response.status_code == 200
        
        mentors = get_response.json()["mentors"]
        created_mentor = next((m for m in mentors if m["id"] == mentor_id), None)
        
        assert created_mentor is not None, "Created mentor should be in list"
        assert created_mentor.get("college") == "IIM Bangalore", f"College field should be 'IIM Bangalore', got: {created_mentor.get('college')}"
        assert created_mentor.get("headline") == "Ex-McKinsey | 100+ Cases Solved", "Headline should be saved"
        
        print(f"✓ Mentor college field verified: {created_mentor.get('college')}")
        
        # Cleanup - delete the test mentor
        self.test_mentor_id = mentor_id
        return mentor_id
        
    def test_update_mentor_with_college(self):
        """Test PUT /api/admin/mentors/{id} accepts 'college' field"""
        # First create a mentor to update
        unique_id = str(uuid.uuid4())[:8]
        create_data = {
            "name": f"TEST_Update_Mentor_{unique_id}",
            "email": f"test_update_{unique_id}@example.com",
            "phone": "+91 9876543211",
            "consulting_position": "Consultant",
            "consulting_firm": "BCG",
            "current_company": "BCG",
            "years_experience": "3",
            "hourly_rate": 10000,
            "price_per_session": 1200
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/mentors/invite",
            json=create_data,
            cookies=self.cookies
        )
        assert create_response.status_code == 200, f"Create mentor failed: {create_response.text}"
        mentor_id = create_response.json()["mentor_id"]
        
        # Now update the mentor with college field
        update_data = {
            "college": "IIM Ahmedabad",
            "headline": "BCG Consultant | Strategy Expert",
            "consulting_firm": "BCG",
            "current_company": "Meta",
            "previous_company_1": "Google",
            "previous_company_2": "Amazon"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/mentors/{mentor_id}",
            json=update_data,
            cookies=self.cookies
        )
        
        assert update_response.status_code == 200, f"Update mentor failed: {update_response.text}"
        
        # Verify the update
        get_response = self.session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=self.cookies
        )
        assert get_response.status_code == 200
        
        mentors = get_response.json()["mentors"]
        updated_mentor = next((m for m in mentors if m["id"] == mentor_id), None)
        
        assert updated_mentor is not None, "Updated mentor should be in list"
        assert updated_mentor.get("college") == "IIM Ahmedabad", f"College should be updated to 'IIM Ahmedabad', got: {updated_mentor.get('college')}"
        assert updated_mentor.get("headline") == "BCG Consultant | Strategy Expert", "Headline should be updated"
        assert updated_mentor.get("current_company") == "Meta", "Current company should be updated"
        assert updated_mentor.get("previous_company_1") == "Google", "Previous company 1 should be updated"
        assert updated_mentor.get("previous_company_2") == "Amazon", "Previous company 2 should be updated"
        
        print(f"✓ Mentor updated successfully with college: {updated_mentor.get('college')}")
        
        return mentor_id
        
    def test_mentor_headline_field(self):
        """Test that headline field is properly saved and retrieved"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create mentor with headline
        create_data = {
            "name": f"TEST_Headline_Mentor_{unique_id}",
            "email": f"test_headline_{unique_id}@example.com",
            "phone": "+91 9876543212",
            "consulting_position": "Manager",
            "consulting_firm": "Bain",
            "current_company": "Bain",
            "years_experience": "7",
            "hourly_rate": 15000,
            "price_per_session": 2000,
            "headline": "Bain Manager | 200+ Cases | IIM A Gold Medalist"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/mentors/invite",
            json=create_data,
            cookies=self.cookies
        )
        assert create_response.status_code == 200
        mentor_id = create_response.json()["mentor_id"]
        
        # Verify headline is saved
        get_response = self.session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=self.cookies
        )
        mentors = get_response.json()["mentors"]
        mentor = next((m for m in mentors if m["id"] == mentor_id), None)
        
        assert mentor is not None
        assert mentor.get("headline") == "Bain Manager | 200+ Cases | IIM A Gold Medalist"
        
        print(f"✓ Headline field verified: {mentor.get('headline')}")
        
        return mentor_id
        
    def test_mentor_company_fields(self):
        """Test that all company fields (consulting_firm, current_company, previous_company_1, previous_company_2) are saved"""
        unique_id = str(uuid.uuid4())[:8]
        
        create_data = {
            "name": f"TEST_Company_Mentor_{unique_id}",
            "email": f"test_company_{unique_id}@example.com",
            "phone": "+91 9876543213",
            "consulting_position": "Associate",
            "consulting_firm": "McKinsey & Company",
            "current_company": "Apple",
            "previous_company_1": "Google",
            "previous_company_2": "Microsoft",
            "years_experience": "4",
            "hourly_rate": 11000,
            "price_per_session": 1400
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/admin/mentors/invite",
            json=create_data,
            cookies=self.cookies
        )
        assert create_response.status_code == 200
        mentor_id = create_response.json()["mentor_id"]
        
        # Verify all company fields
        get_response = self.session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=self.cookies
        )
        mentors = get_response.json()["mentors"]
        mentor = next((m for m in mentors if m["id"] == mentor_id), None)
        
        assert mentor is not None
        assert mentor.get("consulting_firm") == "McKinsey & Company", f"Consulting firm mismatch: {mentor.get('consulting_firm')}"
        assert mentor.get("current_company") == "Apple", f"Current company mismatch: {mentor.get('current_company')}"
        assert mentor.get("previous_company_1") == "Google", f"Previous company 1 mismatch: {mentor.get('previous_company_1')}"
        assert mentor.get("previous_company_2") == "Microsoft", f"Previous company 2 mismatch: {mentor.get('previous_company_2')}"
        
        print(f"✓ All company fields verified for mentor {mentor_id}")
        
        return mentor_id


class TestPublicMentorEndpoints:
    """Test public mentor endpoints for dashboard display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with user authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as subscription user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription",
            json={}
        )
        assert login_response.status_code == 200, f"User login failed: {login_response.text}"
        self.cookies = login_response.cookies
        
    def test_get_mentors_for_dashboard(self):
        """Test GET /api/mentors returns mentor list for dashboard"""
        response = self.session.get(
            f"{BASE_URL}/api/mentors",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Get mentors failed: {response.text}"
        data = response.json()
        
        # Public endpoint returns list directly (not wrapped in 'mentors' key)
        mentors = data if isinstance(data, list) else data.get("mentors", [])
        
        if len(mentors) > 0:
            # Check that mentor has expected fields for card display
            mentor = mentors[0]
            
            # Line 1: Name
            assert "name" in mentor, "Mentor should have 'name' field"
            
            # Line 2: Position, Company | College
            assert "consulting_position" in mentor or "title" in mentor, "Mentor should have position field"
            assert "consulting_firm" in mentor or "company" in mentor, "Mentor should have company field"
            # College is optional but should be present if set
            
            # Line 3: Headline
            # Headline is optional
            
            print(f"✓ Mentor card fields verified for {mentor.get('name')}")
            print(f"  - Position: {mentor.get('consulting_position') or mentor.get('title')}")
            print(f"  - Firm: {mentor.get('consulting_firm') or mentor.get('company')}")
            print(f"  - College: {mentor.get('college', 'Not set')}")
            print(f"  - Headline: {mentor.get('headline', 'Not set')}")
        else:
            print("⚠ No mentors found in dashboard (may be all hidden)")


class TestLogoRepository:
    """Test logo repository endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_get_all_logos(self):
        """Test GET /api/resources/logos returns all logos"""
        response = self.session.get(f"{BASE_URL}/api/resources/logos")
        
        assert response.status_code == 200, f"Get logos failed: {response.text}"
        data = response.json()
        
        assert "logos" in data, "Response should contain 'logos' key"
        logos = data["logos"]
        
        print(f"✓ Logo repository has {len(logos)} items")
        
        # Print some logo names for verification
        if len(logos) > 0:
            print("  Sample logos:")
            for logo in logos[:5]:
                print(f"    - {logo.get('name')}: {logo.get('logo_url', 'No URL')[:50]}...")
                
    def test_get_homepage_logos(self):
        """Test GET /api/resources/logos?homepage_only=true returns homepage logos"""
        response = self.session.get(f"{BASE_URL}/api/resources/logos?homepage_only=true")
        
        assert response.status_code == 200, f"Get homepage logos failed: {response.text}"
        data = response.json()
        
        assert "logos" in data, "Response should contain 'logos' key"
        logos = data["logos"]
        
        print(f"✓ Homepage logos: {len(logos)} items")


# Cleanup test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_mentors():
    """Cleanup TEST_ prefixed mentors after all tests"""
    yield
    
    # Cleanup after tests
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as admin
    login_response = session.post(
        f"{BASE_URL}/api/auth/mock-login?user_type=admin",
        json={}
    )
    
    if login_response.status_code == 200:
        cookies = login_response.cookies
        
        # Get all mentors
        get_response = session.get(
            f"{BASE_URL}/api/admin/mentors",
            cookies=cookies
        )
        
        if get_response.status_code == 200:
            mentors = get_response.json().get("mentors", [])
            
            # Delete TEST_ prefixed mentors
            for mentor in mentors:
                if mentor.get("name", "").startswith("TEST_"):
                    delete_response = session.delete(
                        f"{BASE_URL}/api/admin/mentors/{mentor['id']}",
                        cookies=cookies
                    )
                    if delete_response.status_code == 200:
                        print(f"Cleaned up test mentor: {mentor['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
