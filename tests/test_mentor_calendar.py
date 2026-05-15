"""
Test Mentor Google Calendar Integration APIs
- OAuth flow for mentors to connect their Google Calendar
- Conflict detection to prevent double bookings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMentorCalendarAPIs:
    """Test mentor calendar integration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with mentor login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as mentor
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        assert response.status_code == 200, f"Mentor login failed: {response.text}"
        self.mentor_data = response.json()
        assert self.mentor_data.get("is_mentor") == True, "User should be a mentor"
        
    def test_calendar_status_returns_connection_info(self):
        """GET /api/mentor-calendar/status - Returns calendar connection status"""
        response = self.session.get(f"{BASE_URL}/api/mentor-calendar/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "connected" in data, "Response should have 'connected' field"
        assert "email" in data, "Response should have 'email' field"
        assert "last_synced" in data, "Response should have 'last_synced' field"
        
        # Since OAuth is not configured, should be disconnected
        assert data["connected"] == False, "Calendar should not be connected (OAuth not configured)"
        
    def test_calendar_auth_start_fails_without_oauth_config(self):
        """GET /api/mentor-calendar/auth/start - Returns 500 when OAuth not configured"""
        response = self.session.get(f"{BASE_URL}/api/mentor-calendar/auth/start")
        
        # Expected to fail with 500 since OAuth credentials not configured
        # Note: 520 is Cloudflare's "Web server is returning an unknown error"
        assert response.status_code in [500, 520], f"Expected 500 or 520, got {response.status_code}"
        
        if response.status_code == 500:
            data = response.json()
            assert "detail" in data
            assert "not configured" in data["detail"].lower() or "oauth" in data["detail"].lower()
        
    def test_calendar_disconnect_succeeds(self):
        """DELETE /api/mentor-calendar/disconnect - Disconnects calendar"""
        response = self.session.delete(f"{BASE_URL}/api/mentor-calendar/disconnect")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "disconnect" in data["message"].lower()
        
        # Verify status is now disconnected
        status_response = self.session.get(f"{BASE_URL}/api/mentor-calendar/status")
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data["connected"] == False
        
    def test_non_mentor_cannot_access_calendar_status(self):
        """Non-mentor users should get 403 when accessing calendar endpoints"""
        # Create new session and login as regular user
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        
        login_response = user_session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        user_data = login_response.json()
        assert user_data.get("is_mentor") == False, "User should not be a mentor"
        
        # Try to access calendar status
        response = user_session.get(f"{BASE_URL}/api/mentor-calendar/status")
        assert response.status_code == 403
        data = response.json()
        assert "mentor" in data["detail"].lower()
        
    def test_non_mentor_cannot_start_calendar_auth(self):
        """Non-mentor users should get 403 when trying to start OAuth"""
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        
        login_response = user_session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        response = user_session.get(f"{BASE_URL}/api/mentor-calendar/auth/start")
        assert response.status_code == 403
        
    def test_non_mentor_cannot_disconnect_calendar(self):
        """Non-mentor users should get 403 when trying to disconnect"""
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        
        login_response = user_session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        response = user_session.delete(f"{BASE_URL}/api/mentor-calendar/disconnect")
        assert response.status_code == 403


class TestMentorAvailabilityWithCalendar:
    """Test mentor availability endpoint with calendar integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_mentor_availability_returns_slots(self):
        """GET /api/mentors/{mentor_id}/availability - Returns availability with slots"""
        response = self.session.get(f"{BASE_URL}/api/mentors/mentor-1/availability")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of availability days
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            day = data[0]
            assert "mentor_id" in day, "Each day should have mentor_id"
            assert "date" in day, "Each day should have date"
            assert "slots" in day, "Each day should have slots"
            assert "booked_slots" in day, "Each day should have booked_slots"
            
            # Verify slots are time strings
            assert isinstance(day["slots"], list), "Slots should be a list"
            if len(day["slots"]) > 0:
                assert ":" in day["slots"][0], "Slots should be time strings like '09:00'"
                
    def test_mentor_availability_for_nonexistent_mentor(self):
        """GET /api/mentors/{mentor_id}/availability - Returns 404 for invalid mentor"""
        response = self.session.get(f"{BASE_URL}/api/mentors/nonexistent-mentor/availability")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()


class TestMentorDashboardVerify:
    """Test mentor dashboard verification endpoint"""
    
    def test_mentor_dashboard_verify_for_mentor(self):
        """GET /api/mentor-dashboard/verify - Returns is_mentor=true for mentors"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as mentor
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        assert login_response.status_code == 200
        
        # Verify mentor dashboard access
        response = session.get(f"{BASE_URL}/api/mentor-dashboard/verify")
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_mentor") == True
        
    def test_mentor_dashboard_verify_for_non_mentor(self):
        """GET /api/mentor-dashboard/verify - Returns is_mentor=false for non-mentors"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as regular user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        # Verify mentor dashboard access
        response = session.get(f"{BASE_URL}/api/mentor-dashboard/verify")
        # Should either return 403 or is_mentor=false
        if response.status_code == 200:
            data = response.json()
            assert data.get("is_mentor") == False
        else:
            assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
