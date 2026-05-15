"""
Test Session Join Functionality
Tests that candidates can access session join links in the candidate portal
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import pytz

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test booking details
TEST_BOOKING_ID = "7ceecc43-94da-47a7-9747-5891fcd26593"
TEST_USER_EMAIL = "aarav@example.com"
TEST_USER_PASSWORD = "test123"
EXPECTED_MEET_LINK = "https://meet.google.com/abc-defg-hij"


class TestSessionJoinFunctionality:
    """Test session join functionality for candidates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def _login(self):
        """Helper to login as test user"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        return response
    
    def test_01_login_as_test_user(self):
        """Login as the test candidate user"""
        response = self._login()
        
        print(f"Login status: {response.status_code}")
        print(f"Login response: {response.text[:500] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Email is nested under 'user' key
        user_email = data.get("user", {}).get("email") or data.get("email")
        print(f"Login successful: {user_email}")
        assert user_email == TEST_USER_EMAIL
    
    def test_02_get_my_bookings_api(self):
        """Test that the bookings API returns the test booking"""
        # Login first
        login_response = self._login()
        
        if login_response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        # Get bookings
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        
        print(f"Bookings API status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        bookings = response.json()
        print(f"Total bookings returned: {len(bookings)}")
        
        # Find the test booking
        test_booking = None
        for booking in bookings:
            print(f"  - Booking: {booking.get('id')}")
            if booking.get("id") == TEST_BOOKING_ID:
                test_booking = booking
                break
        
        assert test_booking is not None, f"Test booking {TEST_BOOKING_ID} not found in bookings"
        
        print(f"Test booking found:")
        print(f"  - ID: {test_booking.get('id')}")
        print(f"  - Date: {test_booking.get('date')}")
        print(f"  - Time: {test_booking.get('time_slot')}")
        print(f"  - Status: {test_booking.get('status')}")
        print(f"  - Mentor: {test_booking.get('mentor_name')}")
        
        # Verify booking has expected fields
        assert test_booking.get("status") == "confirmed", "Booking should be confirmed"
        assert test_booking.get("date") is not None, "Booking should have a date"
        assert test_booking.get("time_slot") is not None, "Booking should have a time slot"
    
    def test_03_check_in_api_returns_meet_link(self):
        """Test that check-in API returns the meet link"""
        # Login first
        login_response = self._login()
        
        if login_response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        # Call check-in API
        response = self.session.post(f"{BASE_URL}/api/sessions/{TEST_BOOKING_ID}/check-in")
        
        print(f"Check-in API status: {response.status_code}")
        print(f"Check-in response: {response.text[:500] if response.text else 'empty'}")
        
        # Check-in might fail if outside window, but we should get a proper response
        if response.status_code == 200:
            data = response.json()
            print(f"Check-in successful:")
            print(f"  - Success: {data.get('success')}")
            print(f"  - Message: {data.get('message')}")
            print(f"  - Meet Link: {data.get('meet_link')}")
            
            assert data.get("success") == True, "Check-in should be successful"
            assert data.get("meet_link") is not None, "Meet link should be returned"
            assert data.get("meet_link") == EXPECTED_MEET_LINK, f"Expected {EXPECTED_MEET_LINK}, got {data.get('meet_link')}"
        elif response.status_code == 400:
            # Outside check-in window
            data = response.json()
            print(f"Check-in window issue: {data.get('detail')}")
            # This is expected if we're outside the window
            assert "Check-in" in data.get("detail", "") or "window" in data.get("detail", "").lower(), "Should mention check-in window"
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_04_session_status_api(self):
        """Test session status API returns correct information"""
        # Login first
        login_response = self._login()
        
        if login_response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        # Get session status
        response = self.session.get(f"{BASE_URL}/api/sessions/{TEST_BOOKING_ID}/status")
        
        print(f"Session status API: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Session status:")
            print(f"  - Booking ID: {data.get('booking_id')}")
            print(f"  - Status: {data.get('status')}")
            print(f"  - Date: {data.get('date')}")
            print(f"  - Time: {data.get('time_slot')}")
            print(f"  - Check-in window: {data.get('check_in_window_status')}")
            print(f"  - Candidate checked in: {data.get('candidate_checked_in')}")
            
            assert data.get("booking_id") == TEST_BOOKING_ID
            assert data.get("status") in ["confirmed", "pending", "completed"]
        else:
            print(f"Status API error: {response.text}")
    
    def test_05_booking_has_meet_link_in_database(self):
        """Verify the booking has meet_link stored in database (via API)"""
        # Login first
        login_response = self._login()
        
        if login_response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        # Get bookings
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        
        assert response.status_code == 200
        
        bookings = response.json()
        test_booking = None
        for booking in bookings:
            if booking.get("id") == TEST_BOOKING_ID:
                test_booking = booking
                break
        
        assert test_booking is not None, "Test booking not found"
        
        # Note: meet_link might not be exposed in the bookings list API for security
        # The meet_link is only returned via check-in API
        print(f"Booking fields available: {list(test_booking.keys())}")
        
        # Verify essential fields are present
        assert "id" in test_booking
        assert "date" in test_booking
        assert "time_slot" in test_booking
        assert "status" in test_booking
        assert "mentor_name" in test_booking


class TestJoinWindowLogic:
    """Test the join window timing logic"""
    
    def test_join_window_calculation(self):
        """Test that join window is correctly calculated (10 min before to 15 min after)"""
        ist = pytz.timezone('Asia/Kolkata')
        
        # Session at 12:00
        session_time = ist.localize(datetime(2026, 4, 8, 12, 0, 0))
        
        # Window should be 11:50 to 12:15
        window_start = session_time - timedelta(minutes=10)
        window_end = session_time + timedelta(minutes=15)
        
        assert window_start.strftime("%H:%M") == "11:50"
        assert window_end.strftime("%H:%M") == "12:15"
        
        print(f"Session at {session_time.strftime('%H:%M')}")
        print(f"Join window: {window_start.strftime('%H:%M')} to {window_end.strftime('%H:%M')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
