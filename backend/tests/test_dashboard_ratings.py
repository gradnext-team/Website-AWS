"""
Test Dashboard Ratings and Feedback History Feature
Tests the clickable rating cards and feedback history modal functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardRatings:
    """Tests for dashboard rating cards and feedback history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "testdash@gradnext.co",
                "password": "Test@1234"
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user_data = login_response.json()
        print(f"Logged in as: {self.user_data.get('user', {}).get('email')}")
    
    def test_dashboard_summary_returns_ratings(self):
        """Test that dashboard-summary endpoint returns rating data"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200, f"Dashboard summary failed: {response.text}"
        data = response.json()
        
        # Verify stats section exists
        assert "stats" in data, "Missing 'stats' in response"
        stats = data["stats"]
        
        # Verify rating fields exist
        assert "avg_peer_rating" in stats, "Missing avg_peer_rating"
        assert "peer_rating_count" in stats, "Missing peer_rating_count"
        assert "avg_coach_rating" in stats, "Missing avg_coach_rating"
        assert "coach_rating_count" in stats, "Missing coach_rating_count"
        
        print(f"Peer Rating: {stats['avg_peer_rating']} ({stats['peer_rating_count']} reviews)")
        print(f"Coach Rating: {stats['avg_coach_rating']} ({stats['coach_rating_count']} reviews)")
    
    def test_dashboard_summary_returns_peer_feedback_sessions(self):
        """Test that dashboard-summary returns peer sessions with feedback"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        # Verify peer_sessions_with_feedback array exists
        assert "peer_sessions_with_feedback" in stats, "Missing peer_sessions_with_feedback"
        peer_sessions = stats["peer_sessions_with_feedback"]
        
        assert isinstance(peer_sessions, list), "peer_sessions_with_feedback should be a list"
        
        if len(peer_sessions) > 0:
            session = peer_sessions[0]
            # Verify session structure
            assert "id" in session, "Missing session id"
            assert "date" in session, "Missing session date"
            
            # Check for feedback data
            has_partner_feedback = "partner_feedback" in session
            has_requester_feedback = "requester_feedback" in session
            assert has_partner_feedback or has_requester_feedback, "Missing feedback in session"
            
            print(f"Found {len(peer_sessions)} peer sessions with feedback")
            print(f"First session date: {session.get('date')}")
    
    def test_dashboard_summary_returns_coach_feedback_sessions(self):
        """Test that dashboard-summary returns coach sessions with feedback"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        # Verify coach_sessions_with_feedback array exists
        assert "coach_sessions_with_feedback" in stats, "Missing coach_sessions_with_feedback"
        coach_sessions = stats["coach_sessions_with_feedback"]
        
        assert isinstance(coach_sessions, list), "coach_sessions_with_feedback should be a list"
        
        if len(coach_sessions) > 0:
            session = coach_sessions[0]
            # Verify session structure
            assert "id" in session, "Missing session id"
            assert "date" in session, "Missing session date"
            assert "mentor_feedback" in session, "Missing mentor_feedback"
            
            # Verify mentor info is enriched
            assert "mentor_name" in session, "Missing mentor_name"
            
            print(f"Found {len(coach_sessions)} coach sessions with feedback")
            print(f"First session mentor: {session.get('mentor_name')}")
    
    def test_peer_rating_value_correct(self):
        """Test that peer rating value is 4.3 as expected"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        # Test user should have avg_peer_rating of 4.3
        assert stats["avg_peer_rating"] == 4.3, f"Expected peer rating 4.3, got {stats['avg_peer_rating']}"
        assert stats["peer_rating_count"] == 1, f"Expected 1 peer review, got {stats['peer_rating_count']}"
        
        print("SUCCESS: Peer rating is 4.3 with 1 review")
    
    def test_coach_rating_value_correct(self):
        """Test that coach rating value is 4.5 as expected"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        # Test user should have avg_coach_rating of 4.5
        assert stats["avg_coach_rating"] == 4.5, f"Expected coach rating 4.5, got {stats['avg_coach_rating']}"
        assert stats["coach_rating_count"] == 1, f"Expected 1 coach review, got {stats['coach_rating_count']}"
        
        print("SUCCESS: Coach rating is 4.5 with 1 review")
    
    def test_peer_feedback_contains_required_fields(self):
        """Test that peer feedback contains all required fields for modal display"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        peer_sessions = data["stats"]["peer_sessions_with_feedback"]
        
        if len(peer_sessions) > 0:
            session = peer_sessions[0]
            
            # Check for partner info
            assert "partner_name" in session or "requester_name" in session, "Missing partner/requester name"
            
            # Check for feedback content
            feedback = session.get("partner_feedback") or session.get("requester_feedback")
            assert feedback is not None, "Missing feedback object"
            
            # Verify feedback has rating
            has_rating = any(key in feedback for key in ["average_rating", "rating", "overall_rating"])
            assert has_rating, "Missing rating in feedback"
            
            print("SUCCESS: Peer feedback contains all required fields")
    
    def test_coach_feedback_contains_required_fields(self):
        """Test that coach feedback contains all required fields for modal display"""
        response = self.session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        coach_sessions = data["stats"]["coach_sessions_with_feedback"]
        
        if len(coach_sessions) > 0:
            session = coach_sessions[0]
            
            # Check for mentor info
            assert "mentor_name" in session, "Missing mentor_name"
            
            # Check for feedback content
            feedback = session.get("mentor_feedback")
            assert feedback is not None, "Missing mentor_feedback object"
            
            # Verify feedback has rating
            has_rating = any(key in feedback for key in ["average_rating", "rating", "overall_rating"])
            assert has_rating, "Missing rating in mentor feedback"
            
            # Check for comment
            has_comment = any(key in feedback for key in ["comment", "comments", "feedback"])
            assert has_comment, "Missing comment in mentor feedback"
            
            print("SUCCESS: Coach feedback contains all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
