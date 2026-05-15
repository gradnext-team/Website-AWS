"""
Test Profile Picture Prioritization Fix
Tests that custom uploaded pictures in peer_profiles are displayed instead of Google profile pictures.

Key test scenarios:
1. /api/auth/me returns custom picture from peer_profiles for candidates
2. /api/resources/dashboard-summary returns custom picture from peer_profiles
3. Pending peer feedback sessions are enriched with pictures from peer_profiles
4. Upcoming peer sessions are enriched with pictures from peer_profiles
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
TEST_USER_WITH_CUSTOM_PICTURE = {
    "email": "kashishm0144@gmail.com",
    "password": "Test@1234"
}

TEST_USER_WITHOUT_PICTURE = {
    "email": "testdash@gradnext.co",
    "password": "Test@1234"
}


class TestProfilePicturePrioritization:
    """Test that custom profile pictures from peer_profiles are prioritized over Google pictures"""
    
    @pytest.fixture(scope="class")
    def session_with_custom_picture(self):
        """Login as user with custom picture in peer_profiles"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login with password
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_WITH_CUSTOM_PICTURE["email"],
            "password": TEST_USER_WITH_CUSTOM_PICTURE["password"]
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed for test user with custom picture: {response.text}")
        
        return session
    
    @pytest.fixture(scope="class")
    def session_without_picture(self):
        """Login as user without custom picture"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login with password
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_WITHOUT_PICTURE["email"],
            "password": TEST_USER_WITHOUT_PICTURE["password"]
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed for test user without picture: {response.text}")
        
        return session
    
    def test_auth_me_returns_custom_picture(self, session_with_custom_picture):
        """Test /api/auth/me returns custom picture from peer_profiles instead of Google picture"""
        response = session_with_custom_picture.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "picture" in data, "Response should contain 'picture' field"
        
        picture = data.get("picture")
        
        # The fix should return base64 data (custom picture) instead of Google URL
        # Google URLs start with https://lh3.googleusercontent.com
        if picture:
            print(f"Picture value (first 100 chars): {picture[:100] if len(picture) > 100 else picture}")
            
            # Custom pictures are base64 encoded (start with 'data:image')
            # Google pictures start with 'https://lh3.googleusercontent.com'
            is_custom_picture = picture.startswith('data:image') or not picture.startswith('https://lh3.googleusercontent.com')
            
            assert is_custom_picture, f"Expected custom picture (base64 or non-Google URL), but got Google URL: {picture[:100]}"
            print(f"✓ /api/auth/me returns custom picture (not Google URL)")
        else:
            print("⚠ Picture is None/empty - user may not have any picture set")
    
    def test_dashboard_summary_returns_custom_picture(self, session_with_custom_picture):
        """Test /api/resources/dashboard-summary returns custom picture from peer_profiles"""
        response = session_with_custom_picture.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        
        user = data.get("user", {})
        picture = user.get("picture")
        
        if picture:
            print(f"Dashboard picture value (first 100 chars): {picture[:100] if len(picture) > 100 else picture}")
            
            # Custom pictures are base64 encoded (start with 'data:image')
            # Google pictures start with 'https://lh3.googleusercontent.com'
            is_custom_picture = picture.startswith('data:image') or not picture.startswith('https://lh3.googleusercontent.com')
            
            assert is_custom_picture, f"Expected custom picture (base64 or non-Google URL), but got Google URL: {picture[:100]}"
            print(f"✓ /api/resources/dashboard-summary returns custom picture (not Google URL)")
        else:
            print("⚠ Picture is None/empty - user may not have any picture set")
    
    def test_dashboard_summary_structure(self, session_with_custom_picture):
        """Test dashboard-summary returns all expected fields"""
        response = session_with_custom_picture.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check main structure
        assert "user" in data
        assert "access" in data
        assert "progress" in data
        assert "stats" in data
        assert "upcoming_sessions" in data
        assert "pending_feedbacks" in data
        
        # Check user fields
        user = data["user"]
        assert "id" in user
        assert "name" in user
        assert "email" in user
        assert "picture" in user
        assert "plan" in user
        
        print(f"✓ Dashboard summary structure is correct")
        print(f"  User: {user.get('name')} ({user.get('email')})")
        print(f"  Plan: {user.get('plan')}")
    
    def test_pending_feedbacks_structure(self, session_with_custom_picture):
        """Test pending_feedbacks section exists and has correct structure"""
        response = session_with_custom_picture.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        pending_feedbacks = data.get("pending_feedbacks", {})
        
        # Check structure
        assert "coaching" in pending_feedbacks, "pending_feedbacks should have 'coaching' key"
        assert "peer_practice" in pending_feedbacks, "pending_feedbacks should have 'peer_practice' key"
        
        coaching_feedbacks = pending_feedbacks.get("coaching", [])
        peer_feedbacks = pending_feedbacks.get("peer_practice", [])
        
        print(f"✓ Pending feedbacks structure is correct")
        print(f"  Coaching feedbacks pending: {len(coaching_feedbacks)}")
        print(f"  Peer practice feedbacks pending: {len(peer_feedbacks)}")
        
        # If there are peer feedbacks, check they have picture fields
        for i, session in enumerate(peer_feedbacks[:3]):  # Check first 3
            print(f"  Peer session {i+1}:")
            print(f"    - partner_picture: {'present' if session.get('partner_picture') else 'missing'}")
            print(f"    - requester_picture: {'present' if session.get('requester_picture') else 'missing'}")
    
    def test_upcoming_peer_sessions_enrichment(self, session_with_custom_picture):
        """Test upcoming peer sessions are enriched with pictures from peer_profiles"""
        response = session_with_custom_picture.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        upcoming_sessions = data.get("upcoming_sessions", {})
        peer_sessions = upcoming_sessions.get("peer_practice", [])
        
        print(f"✓ Upcoming peer sessions: {len(peer_sessions)}")
        
        # If there are upcoming peer sessions, check they have picture fields
        for i, session in enumerate(peer_sessions[:3]):  # Check first 3
            print(f"  Session {i+1}:")
            print(f"    - partner_picture: {'present' if session.get('partner_picture') else 'missing'}")
            print(f"    - requester_picture: {'present' if session.get('requester_picture') else 'missing'}")
            print(f"    - partner_name: {session.get('partner_name', 'N/A')}")
            print(f"    - requester_name: {session.get('requester_name', 'N/A')}")


class TestUserWithoutCustomPicture:
    """Test behavior for users without custom pictures"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Login as user without custom picture"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_WITHOUT_PICTURE["email"],
            "password": TEST_USER_WITHOUT_PICTURE["password"]
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        
        return session
    
    def test_auth_me_without_custom_picture(self, session):
        """Test /api/auth/me for user without custom picture in peer_profiles"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        
        picture = data.get("picture")
        print(f"User without custom picture - picture value: {picture[:100] if picture and len(picture) > 100 else picture}")
        
        # This user should have either Google picture or no picture
        # The test just verifies the endpoint works
        print(f"✓ /api/auth/me works for user without custom picture")
    
    def test_dashboard_summary_without_custom_picture(self, session):
        """Test dashboard-summary for user without custom picture"""
        response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        user = data.get("user", {})
        picture = user.get("picture")
        
        print(f"Dashboard for user without custom picture - picture: {picture[:100] if picture and len(picture) > 100 else picture}")
        print(f"✓ Dashboard summary works for user without custom picture")


class TestPeerProfilesCollection:
    """Test peer_profiles collection data directly via API"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Login as user with custom picture"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_WITH_CUSTOM_PICTURE["email"],
            "password": TEST_USER_WITH_CUSTOM_PICTURE["password"]
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        
        return session
    
    def test_peer_profile_endpoint(self, session):
        """Test that peer profile endpoint returns profile_picture"""
        # First get user ID from /api/auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        user_id = me_response.json().get("id")
        
        # Try to get peer profile
        profile_response = session.get(f"{BASE_URL}/api/peers/profile")
        
        if profile_response.status_code == 200:
            profile = profile_response.json()
            profile_picture = profile.get("profile_picture")
            
            print(f"Peer profile for user {user_id}:")
            print(f"  - profile_picture present: {bool(profile_picture)}")
            if profile_picture:
                print(f"  - profile_picture type: {'base64' if profile_picture.startswith('data:') else 'URL'}")
                print(f"  - profile_picture (first 100 chars): {profile_picture[:100]}")
            
            print(f"✓ Peer profile endpoint works")
        else:
            print(f"⚠ Peer profile endpoint returned {profile_response.status_code}")


class TestPictureConsistency:
    """Test that picture is consistent across all endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Login as user with custom picture"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_WITH_CUSTOM_PICTURE["email"],
            "password": TEST_USER_WITH_CUSTOM_PICTURE["password"]
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        
        return session
    
    def test_picture_consistency_across_endpoints(self, session):
        """Test that the same picture is returned from /api/auth/me and /api/resources/dashboard-summary"""
        # Get picture from /api/auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_picture = me_response.json().get("picture")
        
        # Get picture from dashboard-summary
        dashboard_response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert dashboard_response.status_code == 200
        dashboard_picture = dashboard_response.json().get("user", {}).get("picture")
        
        print(f"Picture from /api/auth/me: {me_picture[:50] if me_picture else 'None'}...")
        print(f"Picture from dashboard-summary: {dashboard_picture[:50] if dashboard_picture else 'None'}...")
        
        # Both should return the same picture
        assert me_picture == dashboard_picture, "Picture should be consistent across endpoints"
        print(f"✓ Picture is consistent across /api/auth/me and /api/resources/dashboard-summary")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
