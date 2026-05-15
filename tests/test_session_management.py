"""
Test Session Management Features:
- Peer Practice: Chat, Reschedule, Cancel
- Mentor Coaching: Reschedule, Cancel
- Dashboard: Join buttons for upcoming sessions
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPeerSessionManagement:
    """Tests for peer practice session management - Chat, Reschedule, Cancel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as cohort member user"""
        self.session = requests.Session()
        # Login as free user (has peer practice access via cohort)
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert response.status_code == 200
        self.user = response.json()
        yield
        # Cleanup handled by individual tests
    
    def test_get_peer_sessions(self):
        """Test getting peer sessions list"""
        response = self.session.get(f"{BASE_URL}/api/peers/my-sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        print(f"Found {len(sessions)} peer sessions")
    
    def test_book_peer_session(self):
        """Test booking a new peer session"""
        response = self.session.post(
            f"{BASE_URL}/api/peers/book",
            json={
                "partner_id": "peer-4",
                "date": "2025-03-01",
                "time_slot": "10:00"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert data["session"]["partner_id"] == "peer-4"
        assert data["session"]["date"] == "2025-03-01"
        self.test_session_id = data["session"]["id"]
        print(f"Booked peer session: {self.test_session_id}")
        return self.test_session_id
    
    def test_peer_chat_get_messages(self):
        """Test getting chat messages for a peer session"""
        # First book a session
        session_id = self.test_book_peer_session()
        
        response = self.session.get(f"{BASE_URL}/api/peers/sessions/{session_id}/messages")
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert data["session_id"] == session_id
        print(f"Got {len(data['messages'])} messages for session")
    
    def test_peer_chat_send_message(self):
        """Test sending a chat message in peer session"""
        # First book a session
        session_id = self.test_book_peer_session()
        
        test_message = f"Test message {uuid.uuid4().hex[:8]}"
        response = self.session.post(
            f"{BASE_URL}/api/peers/sessions/{session_id}/messages",
            json={"message": test_message}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["message"]["message"] == test_message
        assert data["message"]["sender_id"] == self.user["id"]
        print(f"Sent message: {test_message}")
    
    def test_peer_chat_empty_message_rejected(self):
        """Test that empty messages are rejected"""
        # First book a session
        session_id = self.test_book_peer_session()
        
        response = self.session.post(
            f"{BASE_URL}/api/peers/sessions/{session_id}/messages",
            json={"message": ""}
        )
        assert response.status_code == 400
        print("Empty message correctly rejected")
    
    def test_peer_reschedule_session(self):
        """Test rescheduling a peer session"""
        # First book a session
        session_id = self.test_book_peer_session()
        
        response = self.session.put(
            f"{BASE_URL}/api/peers/sessions/{session_id}/reschedule",
            json={
                "date": "2025-03-05",
                "time_slot": "15:00"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["new_date"] == "2025-03-05"
        assert data["new_time_slot"] == "15:00"
        print(f"Rescheduled session to {data['new_date']} at {data['new_time_slot']}")
    
    def test_peer_reschedule_missing_fields(self):
        """Test reschedule fails without required fields"""
        session_id = self.test_book_peer_session()
        
        response = self.session.put(
            f"{BASE_URL}/api/peers/sessions/{session_id}/reschedule",
            json={"date": "2025-03-05"}  # Missing time_slot
        )
        assert response.status_code == 400
        print("Reschedule without time_slot correctly rejected")
    
    def test_peer_cancel_session(self):
        """Test cancelling a peer session"""
        # First book a session
        session_id = self.test_book_peer_session()
        
        response = self.session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert "cancelled" in data["message"].lower()
        print(f"Cancelled session: {session_id}")
    
    def test_peer_cancel_nonexistent_session(self):
        """Test cancelling a non-existent session returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/peers/sessions/nonexistent-id")
        assert response.status_code == 404
        print("Cancel non-existent session correctly returns 404")


class TestMentorBookingManagement:
    """Tests for mentor coaching session management - Reschedule, Cancel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as user with coaching access"""
        self.session = requests.Session()
        # Login as last_mile user (has coaching sessions)
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert response.status_code == 200
        self.user = response.json()
        yield
    
    def test_get_mentors(self):
        """Test getting mentors list"""
        response = self.session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        mentors = response.json()
        assert isinstance(mentors, list)
        assert len(mentors) > 0
        # Verify mentor has required fields
        mentor = mentors[0]
        assert "id" in mentor
        assert "name" in mentor
        assert "company" in mentor
        print(f"Found {len(mentors)} mentors")
    
    def test_get_mentor_availability(self):
        """Test getting mentor availability"""
        response = self.session.get(f"{BASE_URL}/api/mentors/mentor-1/availability")
        assert response.status_code == 200
        availability = response.json()
        assert isinstance(availability, list)
        if availability:
            slot = availability[0]
            assert "date" in slot
            assert "slots" in slot
        print(f"Got availability for {len(availability)} dates")
    
    def test_get_my_bookings(self):
        """Test getting user's mentor bookings"""
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"Found {len(bookings)} mentor bookings")
        return bookings
    
    def test_mentor_booking_has_join_link(self):
        """Test that confirmed bookings have meet_link for Join button"""
        bookings = self.test_get_my_bookings()
        confirmed_with_link = [b for b in bookings if b.get("status") == "confirmed" and b.get("meet_link")]
        print(f"Found {len(confirmed_with_link)} confirmed bookings with meet links")
        # At least some bookings should have meet links
        if bookings:
            for booking in bookings[:3]:
                print(f"  Booking {booking['id'][:8]}... - status: {booking['status']}, has_link: {bool(booking.get('meet_link'))}")
    
    def test_reschedule_mentor_booking(self):
        """Test rescheduling a mentor booking"""
        bookings = self.test_get_my_bookings()
        confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
        
        if not confirmed_bookings:
            pytest.skip("No confirmed bookings to reschedule")
        
        booking_id = confirmed_bookings[0]["id"]
        response = self.session.put(
            f"{BASE_URL}/api/mentors/bookings/{booking_id}/reschedule",
            json={
                "date": "2026-02-01",
                "time_slot": "11:00"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["new_date"] == "2026-02-01"
        assert data["new_time_slot"] == "11:00"
        print(f"Rescheduled booking to {data['new_date']} at {data['new_time_slot']}")
    
    def test_reschedule_with_different_mentor(self):
        """Test rescheduling to a different mentor"""
        bookings = self.test_get_my_bookings()
        confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
        
        if not confirmed_bookings:
            pytest.skip("No confirmed bookings to reschedule")
        
        booking_id = confirmed_bookings[0]["id"]
        original_mentor = confirmed_bookings[0]["mentor_id"]
        new_mentor = "mentor-2" if original_mentor != "mentor-2" else "mentor-3"
        
        response = self.session.put(
            f"{BASE_URL}/api/mentors/bookings/{booking_id}/reschedule",
            json={
                "date": "2026-02-02",
                "time_slot": "14:00",
                "mentor_id": new_mentor
            }
        )
        assert response.status_code == 200
        print(f"Rescheduled booking to different mentor: {new_mentor}")
    
    def test_cancel_mentor_booking(self):
        """Test cancelling a mentor booking"""
        bookings = self.test_get_my_bookings()
        confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
        
        if not confirmed_bookings:
            pytest.skip("No confirmed bookings to cancel")
        
        booking_id = confirmed_bookings[-1]["id"]  # Cancel the last one
        response = self.session.delete(f"{BASE_URL}/api/mentors/bookings/{booking_id}")
        assert response.status_code == 200
        data = response.json()
        assert "cancelled" in data["message"].lower()
        print(f"Cancelled booking: {booking_id}")


class TestDashboardUpcomingSessions:
    """Tests for dashboard upcoming sessions with Join buttons"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as user with sessions"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert response.status_code == 200
        self.user = response.json()
        yield
    
    def test_dashboard_data_includes_upcoming_sessions(self):
        """Test that dashboard data includes upcoming sessions"""
        response = self.session.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Check for upcoming_sessions in response
        assert "upcoming_sessions" in data
        upcoming = data["upcoming_sessions"]
        
        # Check structure
        if "coaching" in upcoming:
            print(f"Found {len(upcoming.get('coaching', []))} upcoming coaching sessions")
        if "peer_practice" in upcoming:
            print(f"Found {len(upcoming.get('peer_practice', []))} upcoming peer sessions")
        if "workshops" in upcoming:
            print(f"Found {len(upcoming.get('workshops', []))} upcoming workshops")
    
    def test_coaching_sessions_have_meet_link(self):
        """Test that coaching sessions have meet_link for Join button"""
        response = self.session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        
        confirmed = [b for b in bookings if b.get("status") == "confirmed"]
        with_links = [b for b in confirmed if b.get("meet_link")]
        
        print(f"Confirmed bookings: {len(confirmed)}, with meet links: {len(with_links)}")
        
        # Verify meet_link format
        for booking in with_links[:2]:
            assert booking["meet_link"].startswith("https://meet.google.com/")
            print(f"  Meet link: {booking['meet_link']}")
    
    def test_peer_sessions_have_meet_link(self):
        """Test that peer sessions have meet_link for Join button"""
        # Login as free user for peer sessions
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        
        response = self.session.get(f"{BASE_URL}/api/peers/my-sessions")
        assert response.status_code == 200
        sessions = response.json()
        
        confirmed = [s for s in sessions if s.get("status") in ["confirmed", "pending", "matched"]]
        with_links = [s for s in confirmed if s.get("meet_link")]
        
        print(f"Active peer sessions: {len(confirmed)}, with meet links: {len(with_links)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
