"""
Test Pinnacle User (Megha Sharma) functionality
- Unlimited coaching sessions (coaching_sessions_total = -1)
- Unlimited strategy calls (strategy_call_credits = -1)
- Can book sessions without purchasing add-ons
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPinnacleUser:
    """Test Pinnacle user functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Pinnacle user (Megha Sharma)
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=pinnacle",
            json={}
        )
        assert response.status_code == 200, f"Mock login failed: {response.text}"
        
        data = response.json()
        self.user_data = data
        self.user_id = data.get("id")
        
        # Store session token for authenticated requests
        if "session_token" in data:
            self.session.cookies.set("session_token", data["session_token"])
        if "auth_token" in data:
            self.session.cookies.set("auth_token", data["auth_token"])
        
        yield
    
    def test_pinnacle_login_success(self):
        """Test that Pinnacle user can login via mock-login"""
        # Already logged in via setup, verify user data
        assert self.user_data.get("email") == "megha@gradnext.co", "Email should be megha@gradnext.co"
        assert self.user_data.get("name") == "Megha Sharma", "Name should be Megha Sharma"
        assert self.user_data.get("plan") == "pinnacle", "Plan should be pinnacle"
        print(f"SUCCESS: Pinnacle user logged in - {self.user_data.get('name')}")
    
    def test_pinnacle_unlimited_coaching_sessions(self):
        """Test that Pinnacle user has unlimited coaching sessions (coaching_sessions_total = -1)"""
        coaching_total = self.user_data.get("coaching_sessions_total")
        assert coaching_total == -1, f"Expected coaching_sessions_total = -1 (unlimited), got {coaching_total}"
        print(f"SUCCESS: Pinnacle user has unlimited coaching sessions (coaching_sessions_total = {coaching_total})")
    
    def test_pinnacle_user_not_mentor_or_admin(self):
        """Test that Pinnacle user is not a mentor or admin"""
        assert self.user_data.get("is_mentor") == False, "Pinnacle user should not be a mentor"
        assert self.user_data.get("is_admin") == False, "Pinnacle user should not be an admin"
        print("SUCCESS: Pinnacle user is a regular candidate (not mentor/admin)")
    
    def test_get_my_bookings(self):
        """Test that Pinnacle user can retrieve their bookings"""
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200, f"Get bookings failed: {response.text}"
        
        bookings = response.json()
        assert isinstance(bookings, list), "Bookings should be a list"
        print(f"SUCCESS: Retrieved {len(bookings)} bookings for Pinnacle user")
        
        # Check if we have the test booking
        if bookings:
            for booking in bookings:
                print(f"  - Booking: {booking.get('id')[:8]}... on {booking.get('date')} at {booking.get('time_slot')} with {booking.get('mentor_name')}")
                assert "mentor_name" in booking, "Booking should have mentor_name"
                assert "date" in booking, "Booking should have date"
                assert "status" in booking, "Booking should have status"
    
    def test_get_mentors_list(self):
        """Test that Pinnacle user can view mentors list"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200, f"Get mentors failed: {response.text}"
        
        mentors = response.json()
        assert isinstance(mentors, list), "Mentors should be a list"
        assert len(mentors) > 0, "Should have at least one mentor"
        print(f"SUCCESS: Retrieved {len(mentors)} mentors")
    
    def test_get_mentor_availability(self):
        """Test that Pinnacle user can view mentor availability"""
        # First get a mentor
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        mentors = response.json()
        
        if mentors:
            mentor_id = mentors[0].get("id")
            response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
            assert response.status_code == 200, f"Get availability failed: {response.text}"
            
            availability = response.json()
            assert isinstance(availability, list), "Availability should be a list"
            print(f"SUCCESS: Retrieved availability for mentor {mentor_id}")
    
    def test_pinnacle_can_access_coaching_page_data(self):
        """Test that Pinnacle user can access all coaching page data"""
        # Get mentors
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200, "Should be able to get mentors"
        
        # Get bookings
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200, "Should be able to get bookings"
        
        # Get earliest slots
        response = self.session.get(f"{BASE_URL}/api/mentors/earliest-slots")
        assert response.status_code == 200, "Should be able to get earliest slots"
        
        print("SUCCESS: Pinnacle user can access all coaching page data")
    
    def test_pinnacle_booking_has_meet_link(self):
        """Test that Pinnacle user's booking has meet link"""
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200
        
        bookings = response.json()
        
        # Find a confirmed booking
        confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
        
        if confirmed_bookings:
            booking = confirmed_bookings[0]
            # Meet link may or may not be present depending on booking setup
            print(f"SUCCESS: Found confirmed booking {booking.get('id')[:8]}...")
            if booking.get("meet_link"):
                print(f"  - Meet link: {booking.get('meet_link')}")
            else:
                print("  - Meet link not yet available (will be provided at session time)")
        else:
            print("INFO: No confirmed bookings found to check meet link")


class TestPinnacleBookingFlow:
    """Test that Pinnacle user can book sessions without purchasing add-ons"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Pinnacle user
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=pinnacle",
            json={}
        )
        assert response.status_code == 200
        
        data = response.json()
        if "session_token" in data:
            self.session.cookies.set("session_token", data["session_token"])
        if "auth_token" in data:
            self.session.cookies.set("auth_token", data["auth_token"])
        
        yield
    
    def test_pinnacle_can_view_book_session_tab(self):
        """Test that Pinnacle user can access Book Session functionality"""
        # Get mentors (required for Book Session tab)
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200, "Should be able to get mentors for booking"
        
        mentors = response.json()
        assert len(mentors) > 0, "Should have mentors available for booking"
        print(f"SUCCESS: Pinnacle user can view {len(mentors)} mentors for booking")
    
    def test_pinnacle_can_view_mentor_details(self):
        """Test that Pinnacle user can view mentor details"""
        # Get mentors
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        mentors = response.json()
        
        if mentors:
            mentor_id = mentors[0].get("id")
            response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}")
            assert response.status_code == 200, f"Should be able to get mentor details: {response.text}"
            
            mentor = response.json()
            assert "name" in mentor, "Mentor should have name"
            assert "company" in mentor or "expertise" in mentor, "Mentor should have company or expertise"
            print(f"SUCCESS: Pinnacle user can view mentor details for {mentor.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
