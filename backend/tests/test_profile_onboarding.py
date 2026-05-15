"""
Test Profile Onboarding Features:
- Phone number field with country code
- LinkedIn URL validation
- Profile update with all onboarding fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "testdash@gradnext.co"
TEST_USER_PASSWORD = "Test@1234"


@pytest.fixture(scope="module")
def auth_session():
    """Get authenticated session for test user"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code}")
    
    return session


class TestProfilePhoneNumber:
    """Tests for phone number field in profile"""
    
    def test_update_profile_with_phone_number(self, auth_session):
        """Test updating profile with phone number and country code"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "phone_number": "+919876543210",
            "phone_country_code": "+91"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Profile updated successfully"
    
    def test_get_profile_has_phone_fields(self, auth_session):
        """Test that profile returns phone number fields"""
        response = auth_session.get(f"{BASE_URL}/api/profile/me")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify phone fields exist in response
        assert "phone_number" in data or data.get("phone_number") is not None or "phone_number" in str(data)
        assert "phone_country_code" in data or data.get("phone_country_code") is not None or "phone_country_code" in str(data)
    
    def test_update_phone_with_different_country_codes(self, auth_session):
        """Test updating phone with various country codes"""
        test_cases = [
            ("+1", "2025551234"),
            ("+44", "7911123456"),
            ("+971", "501234567"),
            ("+91", "9876543210"),
        ]
        
        for country_code, phone in test_cases:
            full_phone = f"{country_code}{phone}"
            response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
                "phone_number": full_phone,
                "phone_country_code": country_code
            })
            
            assert response.status_code == 200, f"Failed for country code {country_code}"


class TestLinkedInValidation:
    """Tests for LinkedIn URL validation"""
    
    def test_valid_linkedin_url(self, auth_session):
        """Test updating profile with valid LinkedIn URL"""
        valid_urls = [
            "linkedin.com/in/johndoe",
            "https://linkedin.com/in/johndoe",
            "https://www.linkedin.com/in/johndoe",
            "www.linkedin.com/in/john-doe-123",
        ]
        
        for url in valid_urls:
            response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
                "linkedin_url": url
            })
            
            assert response.status_code == 200, f"Valid URL rejected: {url}"
    
    def test_invalid_linkedin_url(self, auth_session):
        """Test that invalid LinkedIn URLs are rejected"""
        invalid_urls = [
            "facebook.com/johndoe",
            "linkedin.com/company/test",
            "not-a-url",
        ]
        
        for url in invalid_urls:
            response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
                "linkedin_url": url
            })
            
            # Should return 400 for invalid URLs
            assert response.status_code == 400, f"Invalid URL accepted: {url}"
    
    def test_empty_linkedin_url_allowed(self, auth_session):
        """Test that empty LinkedIn URL is allowed (optional field)"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "linkedin_url": ""
        })
        
        assert response.status_code == 200


class TestOnboardingProfileUpdate:
    """Tests for full onboarding profile update"""
    
    def test_full_onboarding_update(self, auth_session):
        """Test updating all onboarding fields at once"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "name": "Test Dashboard User",
            "first_name": "Test",
            "last_name": "Dashboard User",
            "phone_number": "+919876543210",
            "phone_country_code": "+91",
            "ug_college": "Mesa School of Business",
            "pg_college": "Masters' Union",
            "pg_incoming": False,
            "linkedin_url": "linkedin.com/in/testuser",
            "target_firms": ["McKinsey", "BCG", "Bain"],
            "prep_objective": "interview_invite",
            "preparation_level": "intermediate",
            "onboarding_completed": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Profile updated successfully"
    
    def test_verify_onboarding_data_persisted(self, auth_session):
        """Verify onboarding data was persisted correctly"""
        response = auth_session.get(f"{BASE_URL}/api/profile/me")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify key fields
        assert data.get("first_name") == "Test" or "Test" in data.get("name", "")
        assert data.get("phone_country_code") == "+91"
        assert "McKinsey" in data.get("target_firms", []) or "McKinsey" in str(data.get("target_companies", []))
    
    def test_skip_linkedin_during_onboarding(self, auth_session):
        """Test that LinkedIn can be skipped (empty) during onboarding"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "linkedin_url": "",
            "onboarding_completed": True
        })
        
        assert response.status_code == 200
    
    def test_skip_picture_during_onboarding(self, auth_session):
        """Test that picture can be skipped during onboarding"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "picture": None,
            "onboarding_completed": True
        })
        
        assert response.status_code == 200


class TestCollegeFields:
    """Tests for college fields in profile"""
    
    def test_update_ug_college(self, auth_session):
        """Test updating UG college"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "ug_college": "Mesa School of Business"
        })
        
        assert response.status_code == 200
    
    def test_update_pg_college(self, auth_session):
        """Test updating PG college"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "pg_college": "Masters' Union"
        })
        
        assert response.status_code == 200
    
    def test_update_pg_incoming_status(self, auth_session):
        """Test updating PG incoming status with joining date"""
        response = auth_session.put(f"{BASE_URL}/api/profile/update", json={
            "pg_college": "IIM Ahmedabad",
            "pg_incoming": True,
            "pg_joining_month": "August",
            "pg_joining_year": "2026"
        })
        
        assert response.status_code == 200
        
        # Verify data persisted
        profile = auth_session.get(f"{BASE_URL}/api/profile/me").json()
        assert profile.get("pg_incoming") == True or profile.get("pg_joining_month") == "August"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
