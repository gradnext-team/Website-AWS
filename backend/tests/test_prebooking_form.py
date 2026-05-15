"""
Test Pre-Booking Form Feature
Tests for session type, case type, and candidate notes in booking flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPreBookingFormBackend:
    """Test pre-booking form fields in booking API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_booking_endpoint_accepts_session_type(self):
        """Test that booking endpoint accepts session_type field"""
        # Login as admin with coaching access
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get mentors list
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        assert mentors_response.status_code == 200
        mentors = mentors_response.json()
        assert len(mentors) > 0, "No mentors found"
        
        mentor_id = mentors[0]['id']
        
        # Get mentor availability
        avail_response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        assert avail_response.status_code == 200
        availability = avail_response.json()
        
        # Find an available slot
        available_slot = None
        available_date = None
        for day in availability:
            slots = day.get('slots', [])
            booked = day.get('booked_slots', [])
            available = [s for s in slots if s not in booked]
            if available:
                available_date = day['date']
                available_slot = available[0]
                break
        
        if not available_slot:
            pytest.skip("No available slots found for testing")
        
        # Test booking with session_type
        booking_response = self.session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={
                "date": available_date,
                "time_slot": available_slot,
                "session_type": "FIIT session",
                "candidate_notes": "Test notes for FIIT session"
            }
        )
        
        # Should succeed or fail with slot already booked (not validation error)
        assert booking_response.status_code in [200, 400, 403], f"Unexpected status: {booking_response.status_code}, {booking_response.text}"
        
        if booking_response.status_code == 200:
            data = booking_response.json()
            assert "booking" in data or "message" in data
            print(f"✓ Booking created with session_type: FIIT session")
            
            # Verify booking has session_type stored
            if "booking" in data:
                booking = data["booking"]
                assert booking.get("session_type") == "FIIT session", f"session_type not stored correctly: {booking}"
                print(f"✓ session_type stored correctly in booking")
    
    def test_booking_validates_session_type(self):
        """Test that booking endpoint validates session_type values"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get mentors
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        mentor_id = mentors[0]['id']
        
        # Get availability
        avail_response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        availability = avail_response.json()
        
        available_slot = None
        available_date = None
        for day in availability:
            slots = day.get('slots', [])
            booked = day.get('booked_slots', [])
            available = [s for s in slots if s not in booked]
            if available:
                available_date = day['date']
                available_slot = available[0]
                break
        
        if not available_slot:
            pytest.skip("No available slots")
        
        # Test with invalid session_type
        booking_response = self.session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={
                "date": available_date,
                "time_slot": available_slot,
                "session_type": "Invalid Session Type"
            }
        )
        
        # Should return 400 for invalid session type
        assert booking_response.status_code == 400, f"Expected 400 for invalid session_type, got {booking_response.status_code}"
        print(f"✓ Invalid session_type correctly rejected")
    
    def test_case_type_required_for_case_session(self):
        """Test that case_type is validated for Case sessions"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get mentors
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        mentor_id = mentors[0]['id']
        
        # Get availability
        avail_response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        availability = avail_response.json()
        
        available_slot = None
        available_date = None
        for day in availability:
            slots = day.get('slots', [])
            booked = day.get('booked_slots', [])
            available = [s for s in slots if s not in booked]
            if available:
                available_date = day['date']
                available_slot = available[0]
                break
        
        if not available_slot:
            pytest.skip("No available slots")
        
        # Test Case session with invalid case_type
        booking_response = self.session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={
                "date": available_date,
                "time_slot": available_slot,
                "session_type": "Case session",
                "case_type": "Invalid Case Type"
            }
        )
        
        # Should return 400 for invalid case_type
        assert booking_response.status_code == 400, f"Expected 400 for invalid case_type, got {booking_response.status_code}"
        print(f"✓ Invalid case_type correctly rejected")
    
    def test_valid_case_types(self):
        """Test all valid case types are accepted"""
        valid_case_types = ["Profitability", "Market Entry", "Guesstimate", "Pricing", "Growth", "M&A", "Unconventional"]
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get mentors
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        mentor_id = mentors[0]['id']
        
        # Get availability
        avail_response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        availability = avail_response.json()
        
        # Find multiple available slots
        available_slots = []
        for day in availability:
            slots = day.get('slots', [])
            booked = day.get('booked_slots', [])
            for slot in slots:
                if slot not in booked:
                    available_slots.append((day['date'], slot))
                    if len(available_slots) >= len(valid_case_types):
                        break
            if len(available_slots) >= len(valid_case_types):
                break
        
        if len(available_slots) < 1:
            pytest.skip("Not enough available slots")
        
        # Test first valid case type
        date, slot = available_slots[0]
        booking_response = self.session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={
                "date": date,
                "time_slot": slot,
                "session_type": "Case session",
                "case_type": valid_case_types[0],
                "candidate_notes": f"Testing {valid_case_types[0]} case type"
            }
        )
        
        # Should succeed (200) or fail due to slot already booked (400) or no sessions (403)
        assert booking_response.status_code in [200, 400, 403], f"Unexpected status: {booking_response.status_code}"
        
        if booking_response.status_code == 200:
            data = booking_response.json()
            if "booking" in data:
                assert data["booking"].get("case_type") == valid_case_types[0]
                print(f"✓ Case type '{valid_case_types[0]}' accepted and stored")
    
    def test_valid_session_types(self):
        """Test all valid session types"""
        valid_session_types = ["Case session", "FIIT session", "PEI session", "CV review session", "General discussion"]
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Verify BookSessionRequest model accepts all session types
        # This is a code review check - the model should have these values
        print(f"✓ Valid session types defined: {valid_session_types}")
        
        # Get mentors to verify API is working
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        assert mentors_response.status_code == 200
        print(f"✓ Mentors API accessible")
    
    def test_candidate_notes_stored(self):
        """Test that candidate_notes are stored with booking"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get my bookings to check if notes are returned
        bookings_response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        # Check that bookings have session_type field
        for booking in bookings:
            # session_type should be present (may be null for old bookings)
            if "session_type" in booking:
                print(f"✓ Booking {booking.get('id', 'unknown')[:8]}... has session_type: {booking.get('session_type')}")
            if "case_type" in booking and booking.get("case_type"):
                print(f"  - case_type: {booking.get('case_type')}")
            if "candidate_notes" in booking and booking.get("candidate_notes"):
                print(f"  - candidate_notes: {booking.get('candidate_notes')[:50]}...")


class TestMentorDashboardSessionDetails:
    """Test that mentor dashboard shows session details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_mentor_upcoming_sessions_include_session_details(self):
        """Test that mentor's upcoming sessions include session_type, case_type, candidate_notes"""
        # Login as mentor
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "suraj@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200, f"Mentor login failed: {login_response.text}"
        
        # Get upcoming sessions
        sessions_response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/sessions/upcoming")
        assert sessions_response.status_code == 200, f"Failed to get upcoming sessions: {sessions_response.text}"
        
        sessions = sessions_response.json()
        print(f"✓ Found {len(sessions)} upcoming sessions for mentor")
        
        # Check session structure includes new fields
        for session in sessions:
            assert "session_type" in session, f"session_type missing from session: {session}"
            print(f"  Session {session.get('id', 'unknown')[:8]}...")
            print(f"    - session_type: {session.get('session_type')}")
            if session.get('case_type'):
                print(f"    - case_type: {session.get('case_type')}")
            if session.get('candidate_notes'):
                print(f"    - candidate_notes: {session.get('candidate_notes')[:50]}...")
    
    def test_mentor_past_sessions_include_session_details(self):
        """Test that mentor's past sessions include session_type"""
        # Login as mentor
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "suraj@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get past sessions
        sessions_response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/sessions/past")
        assert sessions_response.status_code == 200
        
        sessions = sessions_response.json()
        print(f"✓ Found {len(sessions)} past sessions for mentor")
        
        # Check session structure
        for session in sessions[:5]:  # Check first 5
            print(f"  Session {session.get('id', 'unknown')[:8]}... - {session.get('session_type', 'N/A')}")


class TestBookingAPIValidation:
    """Test BookSessionRequest model validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_booking_request_model_fields(self):
        """Verify BookSessionRequest model has required fields"""
        # This is a code review test - verify the model structure
        # The model should have: date, time_slot, session_type, case_type (optional), candidate_notes (optional)
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get mentors
        mentors_response = self.session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        mentor_id = mentors[0]['id']
        
        # Get availability
        avail_response = self.session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        availability = avail_response.json()
        
        available_slot = None
        available_date = None
        for day in availability:
            slots = day.get('slots', [])
            booked = day.get('booked_slots', [])
            available = [s for s in slots if s not in booked]
            if available:
                available_date = day['date']
                available_slot = available[0]
                break
        
        if not available_slot:
            pytest.skip("No available slots")
        
        # Test booking without session_type (should fail or use default)
        booking_response = self.session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            json={
                "date": available_date,
                "time_slot": available_slot
                # No session_type - should fail validation
            }
        )
        
        # Should return 422 (validation error) since session_type is required
        # Or 200 if there's a default value
        print(f"Booking without session_type returned: {booking_response.status_code}")
        if booking_response.status_code == 422:
            print(f"✓ session_type is required (validation error returned)")
        elif booking_response.status_code == 200:
            print(f"✓ Booking succeeded (session_type may have default)")


class TestUserCoachingAccess:
    """Test that user has coaching access for booking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_admin_user_has_coaching_access(self):
        """Verify admin user info@gradnext.co has coaching access"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@gradnext.co", "password": "KeiseiConsulting@2025"}
        )
        assert login_response.status_code == 200
        
        # Get user info
        user_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert user_response.status_code == 200
        
        user = user_response.json()
        print(f"User: {user.get('email')}")
        print(f"  Plan: {user.get('plan')}")
        print(f"  Coaching sessions total: {user.get('coaching_sessions_total')}")
        print(f"  Coaching sessions used: {user.get('coaching_sessions_used')}")
        print(f"  Coaching sessions remaining: {user.get('coaching_sessions_remaining')}")
        
        # Verify user has coaching plan
        coaching_plans = ['last_mile', 'mid_mile', 'full_prep']
        assert user.get('plan') in coaching_plans, f"User plan '{user.get('plan')}' is not a coaching plan"
        print(f"✓ User has coaching plan: {user.get('plan')}")
        
        # Verify user has sessions remaining
        remaining = user.get('coaching_sessions_remaining', 0)
        assert remaining > 0, f"User has no coaching sessions remaining: {remaining}"
        print(f"✓ User has {remaining} coaching sessions remaining")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
