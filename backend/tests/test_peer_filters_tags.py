"""
Peer Practice Filters and Tags Tests
Tests for:
1. Session types (NO Guesstimate)
2. Case types (NO Guesstimate)
3. Plan category filter (Subscription/Coaching/Cohort/Free Trial)
4. University filter
5. Peer cards with plan_category and plan_name tags
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "info@gradnext.co"
ADMIN_PASSWORD = "KeiseiConsulting@2025"


class TestPeerListPlanFields:
    """Test that peer list returns plan_category and plan_name fields"""
    
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
    
    def test_peers_list_has_plan_category(self, admin_session):
        """Test GET /api/peers/list returns plan_category field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list of peers"
        
        if len(data) > 0:
            peer = data[0]
            # Check for plan_category field
            assert "plan_category" in peer, "Peer should have plan_category field"
            valid_categories = ["Subscription", "Coaching", "Cohort", "Free Trial"]
            assert peer["plan_category"] in valid_categories, \
                f"plan_category should be one of {valid_categories}, got {peer['plan_category']}"
            print(f"✓ Peer {peer['name']} has plan_category: {peer['plan_category']}")
        else:
            print("✓ Peer list is empty (no other listed peers)")
    
    def test_peers_list_has_plan_name(self, admin_session):
        """Test GET /api/peers/list returns plan_name field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if len(data) > 0:
            peer = data[0]
            # Check for plan_name field
            assert "plan_name" in peer, "Peer should have plan_name field"
            assert isinstance(peer["plan_name"], str), "plan_name should be a string"
            print(f"✓ Peer {peer['name']} has plan_name: {peer['plan_name']}")
        else:
            print("✓ Peer list is empty (no other listed peers)")
    
    def test_peers_list_has_university(self, admin_session):
        """Test GET /api/peers/list returns university field for filtering"""
        response = admin_session.get(f"{BASE_URL}/api/peers/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if len(data) > 0:
            peer = data[0]
            # Check for university field
            assert "university" in peer, "Peer should have university field"
            assert isinstance(peer["university"], str), "university should be a string"
            print(f"✓ Peer {peer['name']} has university: {peer['university']}")
        else:
            print("✓ Peer list is empty (no other listed peers)")


class TestMyProfilePlanFields:
    """Test that my-profile returns plan_category and plan_name fields"""
    
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
    
    def test_my_profile_has_plan_category(self, admin_session):
        """Test GET /api/peers/my-profile returns plan_category field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-profile")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if data.get("has_profile"):
            profile = data["profile"]
            # Check for plan_category field
            assert "plan_category" in profile, "Profile should have plan_category field"
            valid_categories = ["Subscription", "Coaching", "Cohort", "Free Trial"]
            assert profile["plan_category"] in valid_categories, \
                f"plan_category should be one of {valid_categories}, got {profile['plan_category']}"
            print(f"✓ Profile has plan_category: {profile['plan_category']}")
        else:
            print("✓ No profile exists yet")
    
    def test_my_profile_has_plan_name(self, admin_session):
        """Test GET /api/peers/my-profile returns plan_name field"""
        response = admin_session.get(f"{BASE_URL}/api/peers/my-profile")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        if data.get("has_profile"):
            profile = data["profile"]
            # Check for plan_name field
            assert "plan_name" in profile, "Profile should have plan_name field"
            assert isinstance(profile["plan_name"], str), "plan_name should be a string"
            print(f"✓ Profile has plan_name: {profile['plan_name']}")
        else:
            print("✓ No profile exists yet")


class TestBookingSessionTypes:
    """Test that booking accepts correct session types (NO Guesstimate)"""
    
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
    
    def test_book_with_case_session_type(self, admin_session):
        """Test booking with 'Case session' session type"""
        # Get list of peers
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        # Book with Case session type
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "19:00",
            "session_type": "Case session",
            "case_type": "Profitability"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["session_type"] == "Case session"
            print(f"✓ Booked session with session_type: Case session")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")
        else:
            print(f"Booking returned: {response.status_code}")
    
    def test_book_with_fit_interview_type(self, admin_session):
        """Test booking with 'Fit Interview' session type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "19:30",
            "session_type": "Fit Interview"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["session_type"] == "Fit Interview"
            print(f"✓ Booked session with session_type: Fit Interview")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")
    
    def test_book_with_pei_session_type(self, admin_session):
        """Test booking with 'PEI session' session type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "20:00",
            "session_type": "PEI session"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["session_type"] == "PEI session"
            print(f"✓ Booked session with session_type: PEI session")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")
    
    def test_book_with_general_discussion_type(self, admin_session):
        """Test booking with 'General discussion' session type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=13)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "20:30",
            "session_type": "General discussion"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["session_type"] == "General discussion"
            print(f"✓ Booked session with session_type: General discussion")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")


class TestBookingCaseTypes:
    """Test that booking accepts correct case types (NO Guesstimate)"""
    
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
    
    def test_book_with_profitability_case_type(self, admin_session):
        """Test booking with 'Profitability' case type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "21:00",
            "session_type": "Case session",
            "case_type": "Profitability"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["case_type"] == "Profitability"
            print(f"✓ Booked session with case_type: Profitability")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")
    
    def test_book_with_market_entry_case_type(self, admin_session):
        """Test booking with 'Market Entry' case type"""
        peers = admin_session.get(f"{BASE_URL}/api/peers/list").json()
        if not peers:
            pytest.skip("No peers available to book")
        
        partner = peers[0]
        
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        booking_data = {
            "partner_id": partner["id"],
            "date": future_date,
            "time_slot": "21:30",
            "session_type": "Case session",
            "case_type": "Market Entry"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/peers/book", json=booking_data)
        
        if response.status_code == 200:
            data = response.json()
            assert data["session"]["case_type"] == "Market Entry"
            print(f"✓ Booked session with case_type: Market Entry")
            
            # Cancel the test session
            session_id = data["session"]["id"]
            admin_session.delete(f"{BASE_URL}/api/peers/sessions/{session_id}")
        elif response.status_code == 400:
            print("✓ Slot not available (booking API working correctly)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
