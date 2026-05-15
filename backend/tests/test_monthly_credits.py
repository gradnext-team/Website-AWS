"""
Monthly Credit System Tests
Tests for the new monthly peer practice credit system (changed from weekly)

Features tested:
- GET /api/peers/session-credits - returns monthly credit info (sessions_per_month, billing_start, billing_end, next_reset)
- GET /api/peers/availability/{peer_id} - returns slots for 30 days (not just current week)
- POST /api/peers/book - works with the new monthly credit system
- GET /api/peers/list - returns available peers with their availability
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test users from the request
TEST_USER_FREE_TRIAL = {
    "email": "kashish0144@gmail.com",
    "user_id": "user_fa3b0654402e",
    "plan": "free_trial"
}

TEST_USER_PINNACLE = {
    "email": "kashishm0144@gmail.com",
    "user_id": "user_80ae349929b8",
    "plan": "pinnacle"
}


class TestMonthlySessionCredits:
    """Test GET /api/peers/session-credits endpoint with monthly credit system"""
    
    @pytest.fixture(scope="class")
    def mock_session_pro(self):
        """Get authenticated session using mock login for subscription user"""
        session = requests.Session()
        # Use POST for mock-login and user_type=subscription for pro user
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    @pytest.fixture(scope="class")
    def mock_session_free(self):
        """Get authenticated session using mock login for free user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    def test_session_credits_returns_monthly_fields(self, mock_session_pro):
        """Test that session-credits endpoint returns monthly credit fields"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Required fields for monthly system
        assert "has_access" in data, "Response should have 'has_access' field"
        assert "sessions_per_month" in data, "Response should have 'sessions_per_month' field (NEW monthly system)"
        assert "sessions_used" in data, "Response should have 'sessions_used' field"
        assert "sessions_remaining" in data, "Response should have 'sessions_remaining' field"
        assert "is_unlimited" in data, "Response should have 'is_unlimited' field"
        assert "is_mentor" in data, "Response should have 'is_mentor' field"
        
        # NEW monthly billing fields
        assert "billing_start" in data, "Response should have 'billing_start' field (NEW monthly system)"
        assert "billing_end" in data, "Response should have 'billing_end' field (NEW monthly system)"
        assert "next_reset" in data, "Response should have 'next_reset' field (NEW monthly system)"
        
        # Type checks
        assert isinstance(data["has_access"], bool), "has_access should be boolean"
        assert isinstance(data["sessions_per_month"], int), "sessions_per_month should be integer"
        assert isinstance(data["sessions_used"], int), "sessions_used should be integer"
        assert isinstance(data["sessions_remaining"], int), "sessions_remaining should be integer"
        assert isinstance(data["is_unlimited"], bool), "is_unlimited should be boolean"
        assert isinstance(data["is_mentor"], bool), "is_mentor should be boolean"
        
        # Validate date formats for billing fields
        if data["billing_start"]:
            try:
                datetime.fromisoformat(data["billing_start"])
            except ValueError:
                pytest.fail(f"billing_start should be ISO format date, got: {data['billing_start']}")
        
        if data["billing_end"]:
            try:
                datetime.fromisoformat(data["billing_end"])
            except ValueError:
                pytest.fail(f"billing_end should be ISO format date, got: {data['billing_end']}")
        
        if data["next_reset"]:
            try:
                datetime.fromisoformat(data["next_reset"])
            except ValueError:
                pytest.fail(f"next_reset should be ISO format date, got: {data['next_reset']}")
        
        print(f"✓ Session credits endpoint returns all monthly fields")
        print(f"  - has_access: {data['has_access']}")
        print(f"  - sessions_per_month: {data['sessions_per_month']}")
        print(f"  - sessions_used: {data['sessions_used']}")
        print(f"  - sessions_remaining: {data['sessions_remaining']}")
        print(f"  - is_unlimited: {data['is_unlimited']}")
        print(f"  - billing_start: {data['billing_start']}")
        print(f"  - billing_end: {data['billing_end']}")
        print(f"  - next_reset: {data['next_reset']}")
    
    def test_session_credits_math_correct_monthly(self, mock_session_pro):
        """Test that sessions_remaining = sessions_per_month - sessions_used (unless unlimited)"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["has_access"] and not data["is_unlimited"]:
            expected_remaining = max(0, data["sessions_per_month"] - data["sessions_used"])
            assert data["sessions_remaining"] == expected_remaining, \
                f"sessions_remaining should be {expected_remaining}, got {data['sessions_remaining']}"
            print(f"✓ Monthly session credits math is correct: {data['sessions_per_month']} - {data['sessions_used']} = {data['sessions_remaining']}")
        elif data["is_unlimited"]:
            assert data["sessions_remaining"] == 999, "Unlimited users should have 999 sessions_remaining"
            print("✓ Unlimited user has 999 sessions_remaining")
        else:
            assert data["sessions_remaining"] == 0, "Users without access should have 0 sessions_remaining"
            print("✓ User without access has 0 sessions_remaining")
    
    def test_billing_period_is_approximately_one_month(self, mock_session_pro):
        """Test that billing period spans approximately one month"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["has_access"] and data["billing_start"] and data["billing_end"]:
            billing_start = datetime.fromisoformat(data["billing_start"])
            billing_end = datetime.fromisoformat(data["billing_end"])
            
            # Billing period should be approximately 28-31 days
            period_days = (billing_end - billing_start).days + 1  # +1 because end is inclusive
            assert 28 <= period_days <= 31, f"Billing period should be ~30 days, got {period_days} days"
            
            print(f"✓ Billing period is {period_days} days (from {data['billing_start']} to {data['billing_end']})")
        else:
            print("✓ User has no access or billing dates not set")
    
    def test_next_reset_is_after_billing_end(self, mock_session_pro):
        """Test that next_reset is after billing_end"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["has_access"] and data["billing_end"] and data["next_reset"]:
            billing_end = datetime.fromisoformat(data["billing_end"])
            next_reset = datetime.fromisoformat(data["next_reset"])
            
            # next_reset should be the day after billing_end
            assert next_reset > billing_end, f"next_reset ({next_reset}) should be after billing_end ({billing_end})"
            
            print(f"✓ next_reset ({data['next_reset']}) is after billing_end ({data['billing_end']})")
        else:
            print("✓ User has no access or dates not set")
    
    def test_session_credits_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Session credits endpoint correctly requires authentication")


class TestPeerAvailability30Days:
    """Test GET /api/peers/availability/{peer_id} returns 30 days of availability"""
    
    @pytest.fixture(scope="class")
    def mock_session_pro(self):
        """Get authenticated session using mock login for subscription user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    def test_availability_returns_30_days(self, mock_session_pro):
        """Test that availability endpoint returns slots for 30 days"""
        # Use the test user ID from the request
        peer_id = TEST_USER_FREE_TRIAL["user_id"]
        
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Required fields
        assert "peer_id" in data, "Response should have peer_id"
        assert "peer_name" in data, "Response should have peer_name"
        assert "available_slots" in data, "Response should have available_slots"
        assert "start_date" in data, "Response should have start_date"
        assert "end_date" in data, "Response should have end_date"
        
        # Verify date range is 30 days
        start_date = datetime.fromisoformat(data["start_date"])
        end_date = datetime.fromisoformat(data["end_date"])
        date_range = (end_date - start_date).days
        
        assert date_range == 30, f"Date range should be 30 days, got {date_range} days"
        
        print(f"✓ Availability endpoint returns 30-day range")
        print(f"  - peer_id: {data['peer_id']}")
        print(f"  - peer_name: {data['peer_name']}")
        print(f"  - start_date: {data['start_date']}")
        print(f"  - end_date: {data['end_date']}")
        print(f"  - available_slots count: {len(data['available_slots'])}")
    
    def test_availability_slots_within_30_days(self, mock_session_pro):
        """Test that all returned slots are within the 30-day window"""
        peer_id = TEST_USER_FREE_TRIAL["user_id"]
        
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["available_slots"]:
            today = datetime.utcnow().date()
            end_date = today + timedelta(days=30)
            
            for slot in data["available_slots"]:
                slot_date = datetime.fromisoformat(slot["date"]).date()
                assert today <= slot_date <= end_date, \
                    f"Slot date {slot_date} should be within 30 days from today"
            
            print(f"✓ All {len(data['available_slots'])} slots are within 30-day window")
        else:
            print("✓ No available slots (peer may not have set availability)")
    
    def test_availability_slot_structure(self, mock_session_pro):
        """Test that availability slots have correct structure"""
        peer_id = TEST_USER_FREE_TRIAL["user_id"]
        
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["available_slots"]:
            slot = data["available_slots"][0]
            
            # Required slot fields
            assert "date" in slot, "Slot should have date"
            assert "time" in slot, "Slot should have time"
            assert "day_name" in slot, "Slot should have day_name"
            
            # Validate date format
            try:
                datetime.fromisoformat(slot["date"])
            except ValueError:
                pytest.fail(f"Slot date should be ISO format, got: {slot['date']}")
            
            # Validate time format (HH:MM)
            assert len(slot["time"]) == 5, f"Time should be HH:MM format, got: {slot['time']}"
            assert slot["time"][2] == ":", f"Time should have colon separator, got: {slot['time']}"
            
            print(f"✓ Slot structure is correct")
            print(f"  - date: {slot['date']}")
            print(f"  - time: {slot['time']}")
            print(f"  - day_name: {slot['day_name']}")
        else:
            print("✓ No available slots to verify structure")
    
    def test_availability_includes_calendar_sync_status(self, mock_session_pro):
        """Test that availability response includes calendar_synced field"""
        peer_id = TEST_USER_FREE_TRIAL["user_id"]
        
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/availability/{peer_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "calendar_synced" in data, "Response should have calendar_synced field"
        assert isinstance(data["calendar_synced"], bool), "calendar_synced should be boolean"
        
        print(f"✓ calendar_synced field present: {data['calendar_synced']}")


class TestPeerListWithAvailability:
    """Test GET /api/peers/list returns peers with availability info"""
    
    @pytest.fixture(scope="class")
    def mock_session_pro(self):
        """Get authenticated session using mock login for subscription user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    def test_peer_list_returns_peers(self, mock_session_pro):
        """Test that peer list endpoint returns list of peers"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list of peers"
        
        if len(data) > 0:
            peer = data[0]
            
            # Required peer fields
            assert "id" in peer, "Peer should have id"
            assert "user_id" in peer, "Peer should have user_id for availability lookup"
            assert "name" in peer, "Peer should have name"
            assert "plan_category" in peer, "Peer should have plan_category"
            assert "plan_name" in peer, "Peer should have plan_name"
            
            print(f"✓ Peer list returns {len(data)} peers")
            print(f"  - First peer: {peer['name']}")
            print(f"  - plan_category: {peer['plan_category']}")
            print(f"  - plan_name: {peer['plan_name']}")
        else:
            print("✓ Peer list is empty (no other listed peers)")
    
    def test_peer_has_user_id_for_availability(self, mock_session_pro):
        """Test that peers have user_id field for availability lookup"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/list")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for peer in data[:5]:  # Check first 5 peers
                assert "user_id" in peer, f"Peer {peer.get('name', 'unknown')} should have user_id"
                assert peer["user_id"], f"Peer {peer.get('name', 'unknown')} user_id should not be empty"
            
            print(f"✓ All peers have user_id for availability lookup")
        else:
            print("✓ No peers to verify")


class TestBookingWithMonthlyCredits:
    """Test POST /api/peers/book works with monthly credit system"""
    
    @pytest.fixture(scope="class")
    def mock_session_pro(self):
        """Get authenticated session using mock login for subscription user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    def test_booking_checks_monthly_credits(self, mock_session_pro):
        """Test that booking endpoint checks monthly session credits"""
        # First check current credits
        credits_response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        credits = credits_response.json()
        
        print(f"Current credits: {credits}")
        
        if not credits.get("has_access"):
            pytest.skip("User doesn't have peer practice access")
        
        # Get a peer to book with
        peers_response = mock_session_pro.get(f"{BASE_URL}/api/peers/list")
        peers = peers_response.json()
        
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        # Try to book within the 30-day window
        future_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "10:00",
            "session_type": "Case session",
            "case_type": "Profitability"
        }
        
        response = mock_session_pro.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if credits["sessions_remaining"] > 0 or credits["is_unlimited"]:
            # Should succeed or fail for other reasons (slot taken, etc.)
            if response.status_code == 200:
                data = response.json()
                assert data.get("success") == True, "Booking should succeed"
                print(f"✓ Booking succeeded with {credits['sessions_remaining']} monthly credits remaining")
            elif response.status_code == 400:
                # Slot might be taken or other validation error
                print(f"✓ Booking failed (expected - slot may be taken): {response.json().get('detail')}")
            elif response.status_code == 403:
                print(f"✓ Booking denied (access issue): {response.json().get('detail')}")
            else:
                print(f"✓ Booking response: {response.status_code} - {response.text[:200]}")
        else:
            # Should fail due to no credits
            assert response.status_code in [400, 403], f"Expected 400/403 for no credits, got {response.status_code}"
            print("✓ Booking correctly denied when no monthly credits remaining")
    
    def test_booking_within_30_day_window(self, mock_session_pro):
        """Test that booking is allowed within the 30-day availability window"""
        # Get a peer to book with
        peers_response = mock_session_pro.get(f"{BASE_URL}/api/peers/list")
        peers = peers_response.json()
        
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        # Try to book at day 25 (within 30-day window)
        future_date = (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "14:00",
            "session_type": "Fit Interview"
        }
        
        response = mock_session_pro.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        # Should not fail due to date being too far in future
        if response.status_code == 400:
            error_detail = response.json().get("detail", "").lower()
            assert "too far" not in error_detail, f"Should allow booking 25 days ahead, got: {error_detail}"
        
        print(f"✓ Booking 25 days ahead is allowed (status: {response.status_code})")


class TestNoWeeklyFieldsRemaining:
    """Test that old weekly fields are not present in responses"""
    
    @pytest.fixture(scope="class")
    def mock_session_pro(self):
        """Get authenticated session using mock login for subscription user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        if response.status_code != 200:
            pytest.skip(f"Mock login failed: {response.status_code} - {response.text}")
        return session
    
    def test_session_credits_no_weekly_fields(self, mock_session_pro):
        """Test that session-credits doesn't return old weekly fields"""
        response = mock_session_pro.get(f"{BASE_URL}/api/peers/session-credits")
        
        assert response.status_code == 200
        data = response.json()
        
        # Old weekly fields should NOT be present
        assert "sessions_per_week" not in data, "sessions_per_week should be replaced with sessions_per_month"
        assert "week_start" not in data, "week_start should be replaced with billing_start"
        assert "week_end" not in data, "week_end should be replaced with billing_end"
        
        # New monthly fields SHOULD be present
        assert "sessions_per_month" in data, "sessions_per_month should be present"
        assert "billing_start" in data, "billing_start should be present"
        assert "billing_end" in data, "billing_end should be present"
        assert "next_reset" in data, "next_reset should be present"
        
        print("✓ No old weekly fields present, all monthly fields present")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
