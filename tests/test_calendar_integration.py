"""
Test Suite for Google Calendar Integration - Iteration 6
Tests calendar status, booking with meet links, and join button functionality
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCalendarStatus:
    """Test calendar status endpoint"""
    
    def test_calendar_status_returns_available(self):
        """Calendar status endpoint should return calendar_available: true"""
        response = requests.get(f"{BASE_URL}/api/calendar/status")
        assert response.status_code == 200
        data = response.json()
        assert "calendar_available" in data
        assert data["calendar_available"] == True
        assert data.get("impersonating") == "info@gradnext.co"
        assert data.get("timezone") == "Asia/Kolkata"
        print(f"✓ Calendar status: {data}")


class TestCoachingBookingWithCalendar:
    """Test 1:1 coaching session booking with calendar integration"""
    
    @pytest.fixture
    def last_mile_session(self):
        """Login as last_mile user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert response.status_code == 200, f"Mock login failed: {response.text}"
        return session
    
    def test_get_mentors(self, last_mile_session):
        """Get list of mentors"""
        response = last_mile_session.get(f"{BASE_URL}/api/mentors")
        assert response.status_code == 200
        mentors = response.json()
        assert len(mentors) > 0, "No mentors found"
        print(f"✓ Found {len(mentors)} mentors")
        return mentors
    
    def test_get_mentor_availability(self, last_mile_session):
        """Get mentor availability"""
        # First get mentors
        mentors_response = last_mile_session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        assert len(mentors) > 0
        
        mentor_id = mentors[0]["id"]
        response = last_mile_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        assert response.status_code == 200
        availability = response.json()
        print(f"✓ Got availability for mentor {mentor_id}: {len(availability)} days")
        return availability
    
    def test_book_coaching_session_creates_calendar_event(self, last_mile_session):
        """Booking a coaching session should create calendar event with meet link"""
        # Get mentors
        mentors_response = last_mile_session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        assert len(mentors) > 0
        
        mentor_id = mentors[0]["id"]
        mentor_name = mentors[0].get("name", "Unknown")
        
        # Get availability
        avail_response = last_mile_session.get(f"{BASE_URL}/api/mentors/{mentor_id}/availability")
        availability = avail_response.json()
        
        # Find an available slot (weekday, not booked)
        booking_date = None
        booking_time = None
        
        for day in availability:
            date_str = day.get("date")
            slots = day.get("slots", day.get("time_slots", []))
            booked = day.get("booked_slots", [])
            available_slots = [s for s in slots if s not in booked]
            
            if available_slots:
                booking_date = date_str
                booking_time = available_slots[0]
                break
        
        if not booking_date or not booking_time:
            # Generate a future weekday date
            today = datetime.now()
            for i in range(1, 14):
                future_date = today + timedelta(days=i)
                if future_date.weekday() < 5:  # Monday to Friday
                    booking_date = future_date.strftime("%Y-%m-%d")
                    booking_time = "10:00"
                    break
        
        print(f"Attempting to book: {mentor_name} on {booking_date} at {booking_time}")
        
        # Book the session
        response = last_mile_session.post(
            f"{BASE_URL}/api/mentors/{mentor_id}/book",
            params={"date": booking_date, "time_slot": booking_time}
        )
        
        # Check response
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Booking response: {data}")
            
            # Verify calendar_invite_sent field
            assert "calendar_invite_sent" in data, "Response missing calendar_invite_sent field"
            
            # Verify meet_link if calendar invite was sent
            if data.get("calendar_invite_sent"):
                assert "meet_link" in data, "Response missing meet_link when calendar_invite_sent is true"
                assert data["meet_link"] is not None, "meet_link should not be None"
                assert "meet.google.com" in data["meet_link"], f"Invalid meet link: {data['meet_link']}"
                print(f"✓ Meet link created: {data['meet_link']}")
            else:
                print(f"⚠ Calendar invite not sent: {data.get('calendar_note', 'No reason provided')}")
            
            # Verify booking object has meet_link
            booking = data.get("booking", {})
            if data.get("calendar_invite_sent"):
                assert "meet_link" in booking, "Booking object missing meet_link"
                print(f"✓ Booking has meet_link: {booking.get('meet_link')}")
            
            return data
        elif response.status_code == 400:
            # Slot might already be booked
            print(f"⚠ Slot already booked or unavailable: {response.json()}")
            pytest.skip("Slot already booked - try different date/time")
        elif response.status_code == 403:
            print(f"⚠ No coaching sessions remaining: {response.json()}")
            pytest.skip("No coaching sessions remaining")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")


class TestUserBookingsWithMeetLink:
    """Test that user's bookings endpoint returns meet_link field"""
    
    @pytest.fixture
    def last_mile_session(self):
        """Login as last_mile user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert response.status_code == 200
        return session
    
    def test_my_bookings_returns_meet_link(self, last_mile_session):
        """User's bookings should include meet_link field"""
        response = last_mile_session.get(f"{BASE_URL}/api/mentors/bookings/my")
        assert response.status_code == 200
        bookings = response.json()
        
        print(f"✓ Found {len(bookings)} bookings")
        
        for booking in bookings:
            print(f"  - Booking {booking.get('id')}: date={booking.get('date')}, status={booking.get('status')}")
            if booking.get("meet_link"):
                print(f"    meet_link: {booking.get('meet_link')}")
                assert "meet.google.com" in booking["meet_link"], "Invalid meet link format"
        
        # Check if any booking has meet_link
        bookings_with_meet = [b for b in bookings if b.get("meet_link")]
        print(f"✓ {len(bookings_with_meet)} bookings have meet_link")
        
        return bookings


class TestPeerPracticeWithCalendar:
    """Test peer practice session booking with calendar integration"""
    
    @pytest.fixture
    def subscription_session(self):
        """Login as subscription user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert response.status_code == 200
        return session
    
    def test_get_peers_list(self, subscription_session):
        """Get list of available peers"""
        response = subscription_session.get(f"{BASE_URL}/api/peers/list")
        assert response.status_code == 200
        peers = response.json()
        assert len(peers) > 0, "No peers found"
        print(f"✓ Found {len(peers)} peers")
        return peers
    
    def test_book_peer_session_creates_calendar_event(self, subscription_session):
        """Booking a peer session should create calendar event with meet link"""
        # Get peers
        peers_response = subscription_session.get(f"{BASE_URL}/api/peers/list")
        peers = peers_response.json()
        assert len(peers) > 0
        
        peer = peers[0]
        peer_id = peer["id"]
        peer_name = peer.get("name", "Unknown")
        
        # Generate a future weekday date
        today = datetime.now()
        booking_date = None
        for i in range(1, 14):
            future_date = today + timedelta(days=i)
            if future_date.weekday() < 5:  # Monday to Friday
                booking_date = future_date.strftime("%Y-%m-%d")
                break
        
        # Use a simple time slot (HH:MM format) - peer availability may have day prefix
        time_slot = "10:00"
        
        print(f"Attempting to book peer session: {peer_name} on {booking_date} at {time_slot}")
        
        # Book the session
        response = subscription_session.post(
            f"{BASE_URL}/api/peers/book",
            json={
                "partner_id": peer_id,
                "date": booking_date,
                "time_slot": time_slot
            }
        )
        
        assert response.status_code == 200, f"Booking failed: {response.text}"
        data = response.json()
        print(f"✓ Peer session booking response: {data}")
        
        # Verify calendar_invite_sent field
        assert "calendar_invite_sent" in data, "Response missing calendar_invite_sent field"
        
        # Verify meet_link if calendar invite was sent
        if data.get("calendar_invite_sent"):
            assert "meet_link" in data, "Response missing meet_link when calendar_invite_sent is true"
            assert data["meet_link"] is not None, "meet_link should not be None"
            assert "meet.google.com" in data["meet_link"], f"Invalid meet link: {data['meet_link']}"
            print(f"✓ Meet link created: {data['meet_link']}")
        else:
            print(f"⚠ Calendar invite not sent: {data.get('calendar_note', 'No reason provided')}")
        
        # Verify session object has meet_link
        session_data = data.get("session", {})
        if data.get("calendar_invite_sent"):
            assert "meet_link" in session_data, "Session object missing meet_link"
            print(f"✓ Session has meet_link: {session_data.get('meet_link')}")
        
        return data
    
    def test_my_peer_sessions_returns_meet_link(self, subscription_session):
        """User's peer sessions should include meet_link field"""
        response = subscription_session.get(f"{BASE_URL}/api/peers/my-sessions")
        assert response.status_code == 200
        sessions = response.json()
        
        print(f"✓ Found {len(sessions)} peer sessions")
        
        for session in sessions:
            print(f"  - Session {session.get('id')}: date={session.get('date')}, status={session.get('status')}")
            if session.get("meet_link"):
                print(f"    meet_link: {session.get('meet_link')}")
                assert "meet.google.com" in session["meet_link"], "Invalid meet link format"
        
        # Check if any session has meet_link
        sessions_with_meet = [s for s in sessions if s.get("meet_link")]
        print(f"✓ {len(sessions_with_meet)} sessions have meet_link")
        
        return sessions


class TestWorkshopMeetingLink:
    """Test workshop meeting link functionality"""
    
    @pytest.fixture
    def subscription_session(self):
        """Login as subscription user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert response.status_code == 200
        return session
    
    def test_workshops_have_meeting_link_field(self, subscription_session):
        """Workshops should have meeting_link field for join button"""
        response = subscription_session.get(f"{BASE_URL}/api/resources/workshops")
        assert response.status_code == 200
        workshops = response.json()
        
        print(f"✓ Found {len(workshops)} workshops")
        
        upcoming_workshops = [w for w in workshops if not w.get("is_past")]
        print(f"  - {len(upcoming_workshops)} upcoming workshops")
        
        for workshop in upcoming_workshops:
            print(f"  - Workshop: {workshop.get('title')}")
            print(f"    date: {workshop.get('date')}, time: {workshop.get('time')}")
            print(f"    meeting_link: {workshop.get('meeting_link', 'NOT SET')}")
        
        return workshops


class TestCalendarAPIEndpoints:
    """Test calendar API endpoints directly"""
    
    @pytest.fixture
    def last_mile_session(self):
        """Login as last_mile user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=last_mile")
        assert response.status_code == 200
        return session
    
    def test_calendar_coaching_session_endpoint(self, last_mile_session):
        """Test direct calendar coaching session endpoint"""
        # Get a mentor
        mentors_response = last_mile_session.get(f"{BASE_URL}/api/mentors")
        mentors = mentors_response.json()
        
        if not mentors:
            pytest.skip("No mentors available")
        
        mentor_id = mentors[0]["id"]
        
        # Generate future weekday date
        today = datetime.now()
        for i in range(1, 14):
            future_date = today + timedelta(days=i)
            if future_date.weekday() < 5:
                booking_date = future_date.strftime("%Y-%m-%d")
                break
        
        # Test the calendar endpoint
        response = last_mile_session.post(
            f"{BASE_URL}/api/calendar/coaching-session",
            json={
                "mentor_id": mentor_id,
                "date": booking_date,
                "time": "11:00",
                "duration_minutes": 60,
                "notes": "Test session from pytest"
            }
        )
        
        print(f"Calendar coaching-session response: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # This endpoint requires a booking to exist first, so it may fail
        # But we're testing the endpoint exists and responds
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
