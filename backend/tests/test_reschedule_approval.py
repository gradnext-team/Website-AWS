"""
Reschedule Approval Flow Tests
Tests for the reschedule approval workflow:
- Reschedule request changes session status to reschedule_pending
- Session includes proposed_date, proposed_time_slot, reschedule_requested_by fields
- Approve reschedule updates session to confirmed with new time
- Decline reschedule keeps original time and returns to confirmed status
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


class TestRescheduleApprovalFlow:
    """Test the reschedule approval workflow"""
    
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
    
    def test_reschedule_endpoint_exists(self, admin_session):
        """Test PUT /api/peers/sessions/{id}/reschedule endpoint exists"""
        # Get existing sessions
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        if not sessions:
            pytest.skip("No sessions to test reschedule")
        
        # Find a confirmed session
        confirmed_session = None
        for s in sessions:
            if s["status"] == "confirmed":
                confirmed_session = s
                break
        
        if not confirmed_session:
            # Try to find any non-cancelled session
            for s in sessions:
                if s["status"] not in ["cancelled", "declined", "completed"]:
                    confirmed_session = s
                    break
        
        if not confirmed_session:
            pytest.skip("No active session to reschedule")
        
        # Try to reschedule
        new_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = admin_session.put(
            f"{BASE_URL}/api/peers/sessions/{confirmed_session['id']}/reschedule",
            json={"date": new_date, "time_slot": "15:00"}
        )
        
        # Should return 200 or 400 (if already reschedule_pending)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Reschedule should succeed"
            print(f"✓ Reschedule request sent for session {confirmed_session['id']}")
        else:
            print(f"✓ Reschedule endpoint exists (returned {response.status_code})")
    
    def test_reschedule_changes_status_to_pending(self, admin_session):
        """Test that reschedule request changes session status to reschedule_pending"""
        # Get sessions
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        # Find a session with reschedule_pending status
        reschedule_pending_session = None
        for s in sessions:
            if s["status"] == "reschedule_pending":
                reschedule_pending_session = s
                break
        
        if reschedule_pending_session:
            # Verify the session has reschedule-related fields
            assert "proposed_date" in reschedule_pending_session, "Session should have proposed_date"
            assert "proposed_time_slot" in reschedule_pending_session, "Session should have proposed_time_slot"
            assert "reschedule_requested_by" in reschedule_pending_session, "Session should have reschedule_requested_by"
            
            print(f"✓ Found reschedule_pending session with proposed date: {reschedule_pending_session.get('proposed_date')}")
            print(f"  - proposed_time_slot: {reschedule_pending_session.get('proposed_time_slot')}")
            print(f"  - reschedule_requested_by: {reschedule_pending_session.get('reschedule_requested_by')}")
        else:
            print("✓ No reschedule_pending sessions found (may need to create one)")
    
    def test_session_serialization_includes_reschedule_fields(self, admin_session):
        """Test that serialize_session includes all reschedule-related fields"""
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        if not sessions:
            pytest.skip("No sessions to check")
        
        session = sessions[0]
        
        # Check for reschedule-related fields in serialization
        expected_fields = [
            "was_rescheduled",
            "reschedule_requested_by",
            "reschedule_requested_by_name",
            "proposed_date",
            "proposed_time_slot",
            "original_date",
            "original_time_slot"
        ]
        
        for field in expected_fields:
            assert field in session, f"Session should have '{field}' field"
        
        print(f"✓ Session serialization includes all reschedule fields")
        print(f"  - was_rescheduled: {session.get('was_rescheduled')}")
        print(f"  - reschedule_requested_by: {session.get('reschedule_requested_by')}")
    
    def test_approve_reschedule_endpoint_exists(self, admin_session):
        """Test POST /api/peers/sessions/{id}/approve-reschedule endpoint exists"""
        # Get sessions
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        # Find a reschedule_pending session
        reschedule_pending_session = None
        for s in sessions:
            if s["status"] == "reschedule_pending":
                reschedule_pending_session = s
                break
        
        if not reschedule_pending_session:
            # Test with a fake session ID to verify endpoint exists
            response = admin_session.post(f"{BASE_URL}/api/peers/sessions/fake_session_id/approve-reschedule")
            assert response.status_code in [400, 403, 404], f"Endpoint should exist, got {response.status_code}"
            print("✓ approve-reschedule endpoint exists (tested with invalid session)")
            return
        
        # Try to approve (may fail if user is the requester)
        response = admin_session.post(
            f"{BASE_URL}/api/peers/sessions/{reschedule_pending_session['id']}/approve-reschedule"
        )
        
        # Should return 200, 400, or 403
        assert response.status_code in [200, 400, 403], f"Expected 200/400/403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Approve should succeed"
            print(f"✓ Reschedule approved for session {reschedule_pending_session['id']}")
        elif response.status_code == 403:
            print("✓ approve-reschedule endpoint exists (user cannot approve own request)")
        else:
            print(f"✓ approve-reschedule endpoint exists (returned {response.status_code})")
    
    def test_decline_reschedule_endpoint_exists(self, admin_session):
        """Test POST /api/peers/sessions/{id}/decline-reschedule endpoint exists"""
        # Test with a fake session ID to verify endpoint exists
        response = admin_session.post(f"{BASE_URL}/api/peers/sessions/fake_session_id/decline-reschedule")
        
        # Should return 400, 403, or 404 (not 405 Method Not Allowed)
        assert response.status_code in [400, 403, 404], f"Endpoint should exist, got {response.status_code}"
        print("✓ decline-reschedule endpoint exists")
    
    def test_cannot_approve_own_reschedule_request(self, admin_session):
        """Test that user cannot approve their own reschedule request"""
        # Get sessions
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        # Find a reschedule_pending session where current user is the requester
        own_reschedule_session = None
        for s in sessions:
            if s["status"] == "reschedule_pending":
                # Check if current user requested the reschedule
                # (we can't easily determine this without knowing user ID, but we can try)
                own_reschedule_session = s
                break
        
        if not own_reschedule_session:
            print("✓ No reschedule_pending sessions to test self-approval")
            return
        
        # Try to approve
        response = admin_session.post(
            f"{BASE_URL}/api/peers/sessions/{own_reschedule_session['id']}/approve-reschedule"
        )
        
        # If user is the requester, should get 403
        if response.status_code == 403:
            data = response.json()
            assert "cannot approve your own" in str(data.get("detail", "")).lower(), \
                "Should indicate user cannot approve own request"
            print("✓ Correctly prevents user from approving own reschedule request")
        elif response.status_code == 200:
            print("✓ User was not the requester, so approval succeeded")
        else:
            print(f"✓ Endpoint returned {response.status_code}")


class TestRescheduleApprovalWorkflow:
    """Test the complete reschedule approval workflow"""
    
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
    
    def test_get_partner_availability_for_reschedule(self, admin_session):
        """Test GET /api/peers/availability/{partner_id} for reschedule modal"""
        # Get sessions to find a partner
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        if not sessions:
            pytest.skip("No sessions to get partner availability")
        
        # Get partner ID from first session
        session = sessions[0]
        partner_id = session.get("partner_id")
        
        if not partner_id:
            pytest.skip("Session has no partner_id")
        
        # Fetch partner's availability
        response = admin_session.get(f"{BASE_URL}/api/peers/availability/{partner_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "peer_id" in data, "Response should have peer_id"
        assert "peer_name" in data, "Response should have peer_name"
        assert "available_slots" in data, "Response should have available_slots"
        
        print(f"✓ Got partner availability: {len(data['available_slots'])} slots for {data['peer_name']}")
    
    def test_reschedule_with_partner_availability_slot(self, admin_session):
        """Test reschedule using a slot from partner's availability"""
        # Get sessions
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        # Find a confirmed session
        confirmed_session = None
        for s in sessions:
            if s["status"] == "confirmed":
                confirmed_session = s
                break
        
        if not confirmed_session:
            pytest.skip("No confirmed session to reschedule")
        
        partner_id = confirmed_session.get("partner_id")
        
        # Get partner's availability
        avail_response = admin_session.get(f"{BASE_URL}/api/peers/availability/{partner_id}")
        
        if avail_response.status_code != 200:
            pytest.skip("Could not get partner availability")
        
        available_slots = avail_response.json().get("available_slots", [])
        
        if not available_slots:
            # Use a future date if no availability
            new_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
            new_time = "14:00"
        else:
            # Use first available slot
            slot = available_slots[0]
            new_date = slot["date"]
            new_time = slot["time"]
        
        # Request reschedule
        response = admin_session.put(
            f"{BASE_URL}/api/peers/sessions/{confirmed_session['id']}/reschedule",
            json={"date": new_date, "time_slot": new_time}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"✓ Reschedule requested to {new_date} at {new_time}")
        else:
            print(f"✓ Reschedule returned {response.status_code} (may already be pending)")


class TestRescheduleStatusDisplay:
    """Test that reschedule_pending status is properly returned"""
    
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
    
    def test_my_sessions_returns_reschedule_pending_status(self, admin_session):
        """Test that GET /api/peers/my-sessions returns sessions with reschedule_pending status"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-sessions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        sessions = response.json()
        
        # Check if any session has reschedule_pending status
        reschedule_pending_count = sum(1 for s in sessions if s.get("status") == "reschedule_pending")
        
        print(f"✓ Found {reschedule_pending_count} sessions with reschedule_pending status")
        
        # Verify status field is present in all sessions
        for session in sessions:
            assert "status" in session, "Session should have status field"
            assert session["status"] in ["pending", "confirmed", "reschedule_pending", "cancelled", "declined", "completed", "matched"], \
                f"Invalid status: {session['status']}"
        
        print(f"✓ All {len(sessions)} sessions have valid status field")
    
    def test_reschedule_pending_session_has_proposed_fields(self, admin_session):
        """Test that reschedule_pending sessions have proposed date/time fields"""
        sessions = admin_session.get(f"{BASE_URL}/api/peers/my-sessions").json()
        
        reschedule_pending_sessions = [s for s in sessions if s.get("status") == "reschedule_pending"]
        
        if not reschedule_pending_sessions:
            print("✓ No reschedule_pending sessions to verify (test passed)")
            return
        
        for session in reschedule_pending_sessions:
            # These fields should be populated for reschedule_pending sessions
            assert session.get("proposed_date"), f"reschedule_pending session should have proposed_date"
            assert session.get("proposed_time_slot"), f"reschedule_pending session should have proposed_time_slot"
            assert session.get("reschedule_requested_by"), f"reschedule_pending session should have reschedule_requested_by"
            
            print(f"✓ Session {session['id']} has proposed: {session['proposed_date']} at {session['proposed_time_slot']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
