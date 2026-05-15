"""
Test Mentor Analytics API Endpoints
Tests for the comprehensive mentor analytics dashboard feature
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMentorAnalytics:
    """Test mentor analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for all tests"""
        self.session = requests.Session()
        # Login as admin
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_user = response.json()
        assert self.admin_user.get("is_admin") == True
    
    # ============ Summary Endpoint Tests ============
    
    def test_get_mentor_analytics_summary(self):
        """Test GET /api/admin/mentor-analytics/summary returns all mentor data"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "mentors" in data
        assert "total_mentors" in data
        assert "summary" in data
        assert "filters_applied" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_sessions_completed" in summary
        assert "total_sessions_cancelled" in summary
        assert "total_sessions_no_show" in summary
        assert "total_sessions_rescheduled" in summary
        assert "total_platform_revenue" in summary
        assert "total_mentor_earnings" in summary
        assert "total_pending_feedbacks" in summary
        assert "platform_avg_rating" in summary
        
        # Verify mentor data structure
        if len(data["mentors"]) > 0:
            mentor = data["mentors"][0]
            assert "mentor_id" in mentor
            assert "name" in mentor
            assert "email" in mentor
            assert "sessions_completed" in mentor
            assert "sessions_cancelled" in mentor
            assert "sessions_no_show" in mentor
            assert "sessions_rescheduled" in mentor
            assert "avg_rating" in mentor
            assert "total_earnings" in mentor
            assert "total_revenue" in mentor
            assert "pending_feedbacks" in mentor
    
    def test_summary_sorting_by_sessions_completed(self):
        """Test sorting by sessions_completed descending"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary",
            params={"sort_by": "sessions_completed", "sort_order": "desc"}
        )
        assert response.status_code == 200
        
        data = response.json()
        mentors = data["mentors"]
        
        # Verify sorting is applied
        assert data["filters_applied"]["sort_by"] == "sessions_completed"
        assert data["filters_applied"]["sort_order"] == "desc"
        
        # Verify descending order
        if len(mentors) >= 2:
            for i in range(len(mentors) - 1):
                assert mentors[i]["sessions_completed"] >= mentors[i+1]["sessions_completed"]
    
    def test_summary_sorting_by_total_earnings(self):
        """Test sorting by total_earnings ascending"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary",
            params={"sort_by": "total_earnings", "sort_order": "asc"}
        )
        assert response.status_code == 200
        
        data = response.json()
        mentors = data["mentors"]
        
        # Verify ascending order
        if len(mentors) >= 2:
            for i in range(len(mentors) - 1):
                assert mentors[i]["total_earnings"] <= mentors[i+1]["total_earnings"]
    
    def test_summary_sorting_by_avg_rating(self):
        """Test sorting by avg_rating"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary",
            params={"sort_by": "avg_rating", "sort_order": "desc"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters_applied"]["sort_by"] == "avg_rating"
    
    def test_summary_date_range_filter(self):
        """Test date range filtering"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary",
            params={"date_from": "2026-01-01", "date_to": "2026-12-31"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters_applied"]["date_from"] == "2026-01-01"
        assert data["filters_applied"]["date_to"] == "2026-12-31"
    
    def test_summary_search_filter(self):
        """Test search by mentor name"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary",
            params={"search": "Priya"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters_applied"]["search"] == "Priya"
        
        # Verify search results contain the search term
        for mentor in data["mentors"]:
            assert "priya" in mentor["name"].lower() or "priya" in mentor["email"].lower()
    
    # ============ Mentor Session Details Tests ============
    
    def test_get_mentor_session_details(self):
        """Test GET /api/admin/mentor-analytics/mentor/{mentor_id}/sessions"""
        # First get a mentor ID from summary
        summary_response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        assert summary_response.status_code == 200
        
        mentors = summary_response.json()["mentors"]
        if len(mentors) == 0:
            pytest.skip("No mentors available for testing")
        
        # Find a mentor with sessions
        mentor_with_sessions = None
        for m in mentors:
            if m["total_sessions"] > 0:
                mentor_with_sessions = m
                break
        
        if not mentor_with_sessions:
            pytest.skip("No mentors with sessions available")
        
        mentor_id = mentor_with_sessions["mentor_id"]
        
        # Get session details
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/mentor/{mentor_id}/sessions"
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "mentor" in data
        assert "summary" in data
        assert "sessions" in data
        assert "pagination" in data
        
        # Verify mentor info
        assert data["mentor"]["id"] == mentor_id
        assert "name" in data["mentor"]
        assert "email" in data["mentor"]
        assert "hourly_rate" in data["mentor"]
        assert "single_session_price" in data["mentor"]
        
        # Verify summary
        summary = data["summary"]
        assert "total_sessions" in summary
        assert "sessions_completed" in summary
        assert "sessions_cancelled" in summary
        assert "sessions_no_show" in summary
        assert "sessions_rescheduled" in summary
        assert "avg_rating" in summary
        assert "total_earnings" in summary
        assert "total_revenue" in summary
        
        # Verify session data structure
        if len(data["sessions"]) > 0:
            session = data["sessions"][0]
            assert "session_id" in session
            assert "date" in session
            assert "time_slot" in session
            assert "status" in session
            assert "candidate_name" in session
            assert "was_rescheduled" in session
            assert "candidate_feedback_given" in session
            assert "session_earnings" in session
            assert "session_revenue" in session
        
        # Verify pagination
        assert "page" in data["pagination"]
        assert "limit" in data["pagination"]
        assert "total" in data["pagination"]
        assert "total_pages" in data["pagination"]
    
    def test_mentor_sessions_pagination(self):
        """Test pagination for mentor sessions"""
        # Get a mentor with sessions
        summary_response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        mentors = summary_response.json()["mentors"]
        
        mentor_with_sessions = None
        for m in mentors:
            if m["total_sessions"] > 0:
                mentor_with_sessions = m
                break
        
        if not mentor_with_sessions:
            pytest.skip("No mentors with sessions available")
        
        mentor_id = mentor_with_sessions["mentor_id"]
        
        # Test with limit
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/mentor/{mentor_id}/sessions",
            params={"page": 1, "limit": 5}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 5
        assert len(data["sessions"]) <= 5
    
    def test_mentor_sessions_not_found(self):
        """Test 404 for non-existent mentor"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/mentor/non-existent-mentor-id/sessions"
        )
        assert response.status_code == 404
    
    # ============ Export Tests ============
    
    def test_export_csv(self):
        """Test CSV export of mentor analytics"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/export",
            params={"format": "csv"}
        )
        assert response.status_code == 200
        
        # Verify content type
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Verify CSV content
        content = response.text
        assert "Mentor Name" in content
        assert "Email" in content
        assert "Total Sessions" in content
        assert "Completed" in content
        assert "Cancelled" in content
        assert "Total Earnings" in content
        assert "Total Revenue" in content
        assert "SUMMARY" in content
    
    def test_export_json(self):
        """Test JSON export of mentor analytics"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/export",
            params={"format": "json"}
        )
        assert response.status_code == 200
        
        # Verify content type
        assert "application/json" in response.headers.get("Content-Type", "")
        
        # Verify JSON structure
        data = response.json()
        assert "exported_at" in data
        assert "filters" in data
        assert "summary" in data
        assert "mentors" in data
    
    def test_export_with_date_filter(self):
        """Test export with date range filter"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/export",
            params={
                "format": "csv",
                "date_from": "2026-01-01",
                "date_to": "2026-12-31"
            }
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
    
    def test_export_mentor_sessions(self):
        """Test export sessions for a specific mentor"""
        # Get a mentor with sessions
        summary_response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        mentors = summary_response.json()["mentors"]
        
        mentor_with_sessions = None
        for m in mentors:
            if m["total_sessions"] > 0:
                mentor_with_sessions = m
                break
        
        if not mentor_with_sessions:
            pytest.skip("No mentors with sessions available")
        
        mentor_id = mentor_with_sessions["mentor_id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/mentor/{mentor_id}/export-sessions"
        )
        assert response.status_code == 200
        
        # Verify CSV content
        assert "text/csv" in response.headers.get("Content-Type", "")
        content = response.text
        assert "Date" in content
        assert "Time" in content
        assert "Status" in content
        assert "Candidate Name" in content
    
    # ============ Authorization Tests ============
    
    def test_unauthorized_access(self):
        """Test that non-admin users cannot access analytics"""
        # Create a new session without admin login
        new_session = requests.Session()
        
        # Login as regular user
        response = new_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=candidate",
            headers={"Content-Type": "application/json"}
        )
        
        # Try to access analytics
        response = new_session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        assert response.status_code == 403
    
    # ============ Data Integrity Tests ============
    
    def test_summary_totals_match_individual_mentors(self):
        """Verify that summary totals match sum of individual mentor data"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/mentor-analytics/summary"
        )
        assert response.status_code == 200
        
        data = response.json()
        mentors = data["mentors"]
        summary = data["summary"]
        
        # Calculate totals from individual mentors
        calc_completed = sum(m["sessions_completed"] for m in mentors)
        calc_cancelled = sum(m["sessions_cancelled"] for m in mentors)
        calc_no_show = sum(m["sessions_no_show"] for m in mentors)
        calc_rescheduled = sum(m["sessions_rescheduled"] for m in mentors)
        calc_earnings = sum(m["total_earnings"] for m in mentors)
        calc_revenue = sum(m["total_revenue"] for m in mentors)
        calc_pending = sum(m["pending_feedbacks"] for m in mentors)
        
        # Verify totals match
        assert summary["total_sessions_completed"] == calc_completed
        assert summary["total_sessions_cancelled"] == calc_cancelled
        assert summary["total_sessions_no_show"] == calc_no_show
        assert summary["total_sessions_rescheduled"] == calc_rescheduled
        assert summary["total_mentor_earnings"] == calc_earnings
        assert summary["total_platform_revenue"] == calc_revenue
        assert summary["total_pending_feedbacks"] == calc_pending


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
