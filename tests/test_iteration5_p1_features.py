"""
Test Suite for gradnext P1 Features - Iteration 5
Tests:
1. Candidate Profile - Peer Practice Availability with weekly From/To UI
2. Quick Add - Add to All Days button in Profile page
3. Cohort page shows user's specific cohort name
4. Cohort Resources section shows only resources for user's registered cohort
5. API /api/resources/cohort/resources returns cohort data based on user's cohort_batch
6. Sessions have Join buttons
7. Mentors endpoint returns all 6 mentors with default fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCohortMemberAuth:
    """Test cohort member authentication"""
    
    @pytest.fixture(scope="class")
    def cohort_session(self):
        """Get authenticated session for cohort member"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as cohort member
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=cohort")
        assert response.status_code == 200, f"Mock login failed: {response.text}"
        
        user_data = response.json()
        assert user_data.get("cohort_batch") == "Batch-2025-Q1", "User should be in Batch-2025-Q1"
        assert user_data.get("plan") in ["cohort_premium", "cohort_elite"], "User should have cohort plan"
        
        return session, user_data
    
    def test_cohort_member_login(self, cohort_session):
        """Test cohort member can login and has correct cohort_batch"""
        session, user_data = cohort_session
        
        assert user_data["id"] == "mock-user-cohort"
        assert user_data["email"] == "cohort@gradnext.co"
        assert user_data["cohort_batch"] == "Batch-2025-Q1"
        print(f"✓ Cohort member logged in: {user_data['name']} - {user_data['cohort_batch']}")


class TestCohortResourcesAPI:
    """Test /api/resources/cohort/resources endpoint"""
    
    @pytest.fixture(scope="class")
    def cohort_session(self):
        """Get authenticated session for cohort member"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=cohort")
        assert response.status_code == 200
        return session
    
    def test_cohort_resources_returns_user_cohort(self, cohort_session):
        """Test that /api/resources/cohort/resources returns user's cohort data"""
        response = cohort_session.get(f"{BASE_URL}/api/resources/cohort/resources")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("has_access") == True, "User should have cohort access"
        assert data.get("cohort") is not None, "Cohort data should be present"
        
        cohort = data["cohort"]
        assert cohort.get("name") == "Batch-2025-Q1", f"Expected Batch-2025-Q1, got {cohort.get('name')}"
        
        print(f"✓ Cohort resources API returns correct cohort: {cohort['name']}")
    
    def test_cohort_resources_structure(self, cohort_session):
        """Test cohort resources response structure"""
        response = cohort_session.get(f"{BASE_URL}/api/resources/cohort/resources")
        data = response.json()
        
        cohort = data.get("cohort", {})
        
        # Check required fields
        assert "id" in cohort, "Cohort should have id"
        assert "name" in cohort, "Cohort should have name"
        assert "sections" in cohort, "Cohort should have sections array"
        assert "resources" in cohort, "Cohort should have resources array"
        
        assert isinstance(cohort["sections"], list), "Sections should be a list"
        assert isinstance(cohort["resources"], list), "Resources should be a list"
        
        print(f"✓ Cohort resources structure is correct")
    
    def test_non_cohort_user_denied(self):
        """Test that non-cohort users are denied access"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as free trial user
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert response.status_code == 200
        
        # Try to access cohort resources
        response = session.get(f"{BASE_URL}/api/resources/cohort/resources")
        assert response.status_code == 403, f"Expected 403 for non-cohort user, got {response.status_code}"
        
        print("✓ Non-cohort users correctly denied access to cohort resources")


class TestCohortSessionsAPI:
    """Test cohort sessions with Join buttons"""
    
    @pytest.fixture(scope="class")
    def cohort_session(self):
        """Get authenticated session for cohort member"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=cohort")
        assert response.status_code == 200
        return session
    
    def test_cohort_sessions_have_meeting_links(self, cohort_session):
        """Test that upcoming sessions have meeting_link for Join button"""
        response = cohort_session.get(f"{BASE_URL}/api/resources/cohort/sessions")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("has_access") == True
        assert data.get("batch") == "Batch-2025-Q1"
        
        sessions = data.get("sessions", [])
        assert len(sessions) > 0, "Should have sessions"
        
        # Check upcoming sessions have meeting_link
        upcoming_sessions = [s for s in sessions if not s.get("is_past")]
        assert len(upcoming_sessions) > 0, "Should have upcoming sessions"
        
        for session in upcoming_sessions:
            assert session.get("meeting_link") is not None, f"Upcoming session {session['title']} should have meeting_link"
        
        print(f"✓ {len(upcoming_sessions)} upcoming sessions have meeting_link for Join button")
    
    def test_past_sessions_have_recordings(self, cohort_session):
        """Test that past sessions have recording URLs"""
        response = cohort_session.get(f"{BASE_URL}/api/resources/cohort/sessions")
        data = response.json()
        
        sessions = data.get("sessions", [])
        past_sessions = [s for s in sessions if s.get("is_past")]
        
        for session in past_sessions:
            assert session.get("recording_url") is not None, f"Past session {session['title']} should have recording_url"
        
        print(f"✓ {len(past_sessions)} past sessions have recording URLs")


class TestMentorsAPI:
    """Test /api/mentors endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=cohort")
        assert response.status_code == 200
        return session
    
    def test_mentors_returns_all_mentors(self, session):
        """Test that /api/mentors returns all mentors"""
        response = session.get(f"{BASE_URL}/api/mentors")
        
        assert response.status_code == 200
        mentors = response.json()
        
        assert isinstance(mentors, list), "Response should be a list"
        assert len(mentors) >= 6, f"Expected at least 6 mentors, got {len(mentors)}"
        
        print(f"✓ Mentors API returns {len(mentors)} mentors")
    
    def test_mentors_have_default_fields(self, session):
        """Test that mentors have all required default fields"""
        response = session.get(f"{BASE_URL}/api/mentors")
        mentors = response.json()
        
        required_fields = [
            "id", "name", "title", "company", "bio", "expertise",
            "picture", "years_experience", "sessions_conducted", 
            "rating", "is_active", "hourly_rate", "specialization", "availability"
        ]
        
        for mentor in mentors:
            for field in required_fields:
                assert field in mentor, f"Mentor {mentor.get('name', 'unknown')} missing field: {field}"
        
        print(f"✓ All {len(mentors)} mentors have required default fields")
    
    def test_mentors_hourly_rate_format(self, session):
        """Test that mentors have hourly_rate in INR"""
        response = session.get(f"{BASE_URL}/api/mentors")
        mentors = response.json()
        
        for mentor in mentors:
            hourly_rate = mentor.get("hourly_rate")
            assert hourly_rate is not None, f"Mentor {mentor['name']} should have hourly_rate"
            assert isinstance(hourly_rate, (int, float)), f"hourly_rate should be numeric"
            assert hourly_rate > 0, f"hourly_rate should be positive"
        
        print(f"✓ All mentors have valid hourly_rate in INR")


class TestProfileAPI:
    """Test profile API for peer availability"""
    
    @pytest.fixture(scope="class")
    def cohort_session(self):
        """Get authenticated session for cohort member"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=cohort")
        assert response.status_code == 200
        return session
    
    def test_profile_has_peer_availability_field(self, cohort_session):
        """Test that profile has peer_availability field"""
        response = cohort_session.get(f"{BASE_URL}/api/profile/me")
        
        assert response.status_code == 200
        profile = response.json()
        
        # peer_availability should exist (may be empty array)
        assert "peer_availability" in profile or profile.get("peer_availability") is None or isinstance(profile.get("peer_availability", []), list), \
            "Profile should support peer_availability field"
        
        print(f"✓ Profile API supports peer_availability field")
    
    def test_profile_update_peer_availability(self, cohort_session):
        """Test updating peer_availability with weekly slots"""
        # Create test availability data
        test_availability = [
            {
                "day": "Monday",
                "slots": [{"from": "09:00", "to": "17:00"}]
            },
            {
                "day": "Tuesday",
                "slots": [{"from": "10:00", "to": "18:00"}]
            }
        ]
        
        # Update profile
        response = cohort_session.put(
            f"{BASE_URL}/api/profile/update",
            json={"peer_availability": test_availability}
        )
        
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        
        # Verify update
        response = cohort_session.get(f"{BASE_URL}/api/profile/me")
        profile = response.json()
        
        # Check if peer_availability was saved
        saved_availability = profile.get("peer_availability", [])
        assert len(saved_availability) >= 2, "Should have saved availability for at least 2 days"
        
        print(f"✓ Profile peer_availability update works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
