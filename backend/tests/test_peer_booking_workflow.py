"""
Peer Practice Booking Workflow Tests
Tests for the updated booking workflow with session_type, case_type, and notes parameters
Matches the coaching session booking workflow
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@gradnext.co"
ADMIN_PASSWORD = "KeiseiConsulting@2025"
MENTOR_EMAIL = "kashish@gradnext.co"
MENTOR_PASSWORD = "KeiseiConsulting@2025"

# Session types available
SESSION_TYPES = ["Case session", "Fit Interview", "PEI session", "Guesstimate", "General discussion"]

# Case types (only for Case session)
CASE_TYPES = ["Profitability", "Market Entry", "Guesstimate", "Pricing", "Growth", "M&A", "Unconventional"]


class TestBookingWithSessionType:
    """Test booking with session_type, case_type, and notes parameters"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def mentor_session(self):
        """Get authenticated mentor session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MENTOR_EMAIL,
            "password": MENTOR_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Mentor login failed: {response.status_code}")
        return session
    
    def test_book_session_with_session_type(self, admin_session):
        """Test POST /api/peers/book with session_type parameter"""
        # Get list of peers
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
        
        # Book with session_type
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "09:00",
            "session_type": "Fit Interview"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Booking should succeed"
            assert "session" in data, "Should return session details"
            
            session = data["session"]
            assert session.get("session_type") == "Fit Interview", f"session_type should be 'Fit Interview', got {session.get('session_type')}"
            assert session.get("duration_minutes") == 90, f"duration_minutes should be 90 (1.5 hrs), got {session.get('duration_minutes')}"
            print(f"✓ Booked session with session_type='Fit Interview', duration=90 mins")
        elif response.status_code == 400 and "no longer available" in response.text:
            print("✓ Slot already booked - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}: {response.text}"
    
    def test_book_case_session_with_case_type(self, admin_session):
        """Test POST /api/peers/book with session_type='Case session' and case_type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        
        # Book Case session with case_type
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "10:00",
            "session_type": "Case session",
            "case_type": "Profitability"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Booking should succeed"
            
            session = data["session"]
            assert session.get("session_type") == "Case session", f"session_type should be 'Case session', got {session.get('session_type')}"
            assert session.get("case_type") == "Profitability", f"case_type should be 'Profitability', got {session.get('case_type')}"
            print(f"✓ Booked Case session with case_type='Profitability'")
        elif response.status_code == 400 and "no longer available" in response.text:
            print("✓ Slot already booked - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}: {response.text}"
    
    def test_book_session_with_notes(self, admin_session):
        """Test POST /api/peers/book with notes parameter"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        # Book with notes
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "11:00",
            "session_type": "PEI session",
            "notes": "I want to practice leadership stories for McKinsey PEI"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Booking should succeed"
            
            session = data["session"]
            assert session.get("session_type") == "PEI session", f"session_type should be 'PEI session'"
            assert session.get("requester_notes") == "I want to practice leadership stories for McKinsey PEI", \
                f"requester_notes should match, got {session.get('requester_notes')}"
            print(f"✓ Booked session with notes")
        elif response.status_code == 400 and "no longer available" in response.text:
            print("✓ Slot already booked - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}: {response.text}"
    
    def test_book_session_default_session_type(self, admin_session):
        """Test that session_type defaults to 'General discussion' when not provided"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
        
        # Book without session_type
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "12:00"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            session = data["session"]
            assert session.get("session_type") == "General discussion", \
                f"session_type should default to 'General discussion', got {session.get('session_type')}"
            print(f"✓ session_type correctly defaults to 'General discussion'")
        elif response.status_code == 400 and "no longer available" in response.text:
            print("✓ Slot already booked - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}: {response.text}"


class TestMySessionsResponse:
    """Test GET /api/peers/my-sessions returns new fields"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return session
    
    def test_my_sessions_includes_session_type(self, admin_session):
        """Test GET /api/peers/my-sessions returns session_type field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        assert isinstance(sessions, list), "Should return a list of sessions"
        
        if len(sessions) > 0:
            session = sessions[0]
            
            # Check for new fields
            assert "session_type" in session, "Session should have session_type field"
            assert session["session_type"] in SESSION_TYPES + ["General discussion", "General"], \
                f"session_type should be valid, got {session['session_type']}"
            
            print(f"✓ Session has session_type: {session['session_type']}")
        else:
            print("✓ No sessions found (expected for new users)")
    
    def test_my_sessions_includes_case_type(self, admin_session):
        """Test GET /api/peers/my-sessions returns case_type field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        if len(sessions) > 0:
            session = sessions[0]
            
            # case_type should be present (can be null for non-case sessions)
            assert "case_type" in session, "Session should have case_type field"
            
            if session.get("session_type") == "Case session":
                assert session.get("case_type") in CASE_TYPES + [None], \
                    f"case_type should be valid for Case session, got {session.get('case_type')}"
            
            print(f"✓ Session has case_type: {session.get('case_type')}")
        else:
            print("✓ No sessions found")
    
    def test_my_sessions_includes_requester_notes(self, admin_session):
        """Test GET /api/peers/my-sessions returns requester_notes field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        if len(sessions) > 0:
            session = sessions[0]
            
            # requester_notes should be present (can be null)
            assert "requester_notes" in session, "Session should have requester_notes field"
            
            print(f"✓ Session has requester_notes: {session.get('requester_notes')}")
        else:
            print("✓ No sessions found")
    
    def test_my_sessions_includes_feedback_submitted(self, admin_session):
        """Test GET /api/peers/my-sessions returns feedback_submitted field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        if len(sessions) > 0:
            session = sessions[0]
            
            # feedback_submitted should be present
            assert "feedback_submitted" in session, "Session should have feedback_submitted field"
            assert isinstance(session["feedback_submitted"], bool), "feedback_submitted should be boolean"
            
            print(f"✓ Session has feedback_submitted: {session['feedback_submitted']}")
        else:
            print("✓ No sessions found")
    
    def test_my_sessions_includes_duration(self, admin_session):
        """Test GET /api/peers/my-sessions returns duration_minutes field (90 for 1.5 hrs)"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        if len(sessions) > 0:
            session = sessions[0]
            
            # duration_minutes should be present
            assert "duration_minutes" in session, "Session should have duration_minutes field"
            assert session["duration_minutes"] == 90, f"duration_minutes should be 90 (1.5 hrs), got {session['duration_minutes']}"
            
            print(f"✓ Session has duration_minutes: {session['duration_minutes']} (1.5 hrs)")
        else:
            print("✓ No sessions found")


class TestPeerAvailabilityEndpoint:
    """Test GET /api/peers/availability/{peer_id} returns correct format"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def mentor_session(self):
        """Get authenticated mentor session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MENTOR_EMAIL,
            "password": MENTOR_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Mentor login failed: {response.status_code}")
        return session
    
    def test_availability_returns_available_slots(self, admin_session):
        """Test GET /api/peers/availability/{peer_id} returns available_slots array"""
        # Get list of peers
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available")
        
        peer_id = peers[0]["id"]
        
        response = admin_session.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "peer_id" in data, "Response should have peer_id"
        assert "peer_name" in data, "Response should have peer_name"
        assert "available_slots" in data, "Response should have available_slots"
        assert isinstance(data["available_slots"], list), "available_slots should be a list"
        
        print(f"✓ Got availability for peer {data['peer_name']}: {len(data['available_slots'])} slots")
    
    def test_availability_slot_format(self, admin_session):
        """Test that available_slots have correct format (date, time, day_name)"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available")
        
        peer_id = peers[0]["id"]
        
        response = admin_session.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if len(data["available_slots"]) > 0:
            slot = data["available_slots"][0]
            
            # Check slot structure
            assert "date" in slot, "Slot should have date field"
            assert "time" in slot, "Slot should have time field"
            assert "day_name" in slot, "Slot should have day_name field"
            
            # Validate date format (YYYY-MM-DD)
            try:
                datetime.strptime(slot["date"], "%Y-%m-%d")
            except ValueError:
                assert False, f"date should be in YYYY-MM-DD format, got {slot['date']}"
            
            # Validate time format (HH:MM)
            try:
                datetime.strptime(slot["time"], "%H:%M")
            except ValueError:
                assert False, f"time should be in HH:MM format, got {slot['time']}"
            
            # Validate day_name
            valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            assert slot["day_name"] in valid_days, f"day_name should be valid, got {slot['day_name']}"
            
            print(f"✓ Slot format correct: {slot['date']} ({slot['day_name']}) at {slot['time']}")
        else:
            print("✓ No available slots (peer may not have set availability)")
    
    def test_mentor_availability(self, admin_session, mentor_session):
        """Test that mentor (kashish) has availability set"""
        # First get mentor's profile to get their ID
        mentor_profile = mentor_session.get(f"{BASE_URL}/api/peers/my-profile").json()
        
        if not mentor_profile.get("has_profile"):
            pytest.skip("Mentor has no peer profile")
        
        mentor_id = mentor_profile["profile"]["id"]
        
        # Get mentor's availability as admin
        response = admin_session.get(f"{BASE_URL}/api/peers/availability/{mentor_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        print(f"✓ Mentor {data['peer_name']} has {len(data['available_slots'])} available slots")
        
        # Print first few slots for verification
        for slot in data["available_slots"][:3]:
            print(f"  - {slot['date']} ({slot['day_name']}) at {slot['time']}")


class TestAllSessionTypes:
    """Test booking with all session types"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return session
    
    def test_book_guesstimate_session(self, admin_session):
        """Test booking Guesstimate session"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "14:00",
            "session_type": "Guesstimate"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            session = response.json()["session"]
            assert session.get("session_type") == "Guesstimate"
            print(f"✓ Booked Guesstimate session")
        elif response.status_code == 400:
            print("✓ Slot unavailable - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}"
    
    def test_book_general_discussion_session(self, admin_session):
        """Test booking General discussion session"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available")
        
        partner = peers[0]
        future_date = (datetime.now() + timedelta(days=13)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "15:00",
            "session_type": "General discussion"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            session = response.json()["session"]
            assert session.get("session_type") == "General discussion"
            print(f"✓ Booked General discussion session")
        elif response.status_code == 400:
            print("✓ Slot unavailable - API working correctly")
        else:
            assert False, f"Unexpected error: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
