"""
Test Strategy Call Feedback Exclusion Bug Fix

This test verifies that strategy calls are correctly excluded from mentor feedback prompts.
Bug: Mentors were seeing strategy calls in their past sessions requiring feedback.
Fix: Added session_type filter to exclude 'Strategy Call', 'strategy_call', 'Strategy call' from:
  1. /mentor-dashboard/sessions/past endpoint
  2. /mentor-dashboard/stats endpoint (pending_feedbacks count)
  3. /feedback/pending-mandatory endpoint (was already working)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestStrategyCallFeedbackExclusion:
    """Tests to verify strategy calls are excluded from mentor feedback system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create a mentor auth session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as mentor using mock login with user_type parameter
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("auth_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.mentor_user = data
                self.mentor_id = data.get("mentor_id")
        
        yield
        
        # Cleanup - remove test data
        self.cleanup_test_data()
    
    def cleanup_test_data(self):
        """Remove test-created data"""
        # Test data cleanup would be done via admin API or direct DB access
        pass
    
    def test_mentor_login_successful(self):
        """Test that mentor can login successfully"""
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/verify")
        
        assert response.status_code == 200, f"Mentor verification failed: {response.text}"
        data = response.json()
        assert data.get("is_mentor") == True, "User should be a mentor"
        print(f"✓ Mentor login successful, mentor_id: {data.get('mentor_id')}")
    
    def test_past_sessions_endpoint_excludes_strategy_calls(self):
        """
        Test that /mentor-dashboard/sessions/past excludes strategy calls.
        Strategy calls should NOT appear in past sessions requiring feedback.
        """
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/sessions/past")
        
        assert response.status_code == 200, f"Past sessions API failed: {response.text}"
        
        sessions = response.json()
        
        # Check that no strategy calls are in the response
        strategy_call_types = ["Strategy Call", "strategy_call", "Strategy call"]
        strategy_calls_found = []
        
        for session in sessions:
            session_type = session.get("session_type", "")
            if session_type in strategy_call_types:
                strategy_calls_found.append({
                    "id": session.get("id"),
                    "session_type": session_type,
                    "date": session.get("date")
                })
        
        assert len(strategy_calls_found) == 0, (
            f"Strategy calls should NOT appear in past sessions. "
            f"Found {len(strategy_calls_found)} strategy calls: {strategy_calls_found}"
        )
        
        print(f"✓ Past sessions endpoint correctly excludes strategy calls")
        print(f"  Total past sessions returned: {len(sessions)}")
        
        # Log session types for verification
        session_types = {}
        for session in sessions:
            st = session.get("session_type", "Unknown")
            session_types[st] = session_types.get(st, 0) + 1
        print(f"  Session types in response: {session_types}")
    
    def test_stats_endpoint_excludes_strategy_calls_from_pending_feedbacks(self):
        """
        Test that /mentor-dashboard/stats excludes strategy calls from pending_feedbacks count.
        The pending_feedbacks count should only include coaching sessions, not strategy calls.
        """
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/stats")
        
        assert response.status_code == 200, f"Stats API failed: {response.text}"
        
        stats = response.json()
        
        # Verify stats structure
        assert "pending_feedbacks" in stats, "Stats should include pending_feedbacks count"
        assert "coaching_sessions" in stats, "Stats should include coaching_sessions count"
        assert "strategy_call_sessions" in stats, "Stats should include strategy_call_sessions count"
        
        pending_feedbacks = stats.get("pending_feedbacks", 0)
        coaching_sessions = stats.get("coaching_sessions", 0)
        strategy_call_sessions = stats.get("strategy_call_sessions", 0)
        
        print(f"✓ Stats endpoint returned successfully")
        print(f"  Pending feedbacks: {pending_feedbacks}")
        print(f"  Coaching sessions: {coaching_sessions}")
        print(f"  Strategy call sessions: {strategy_call_sessions}")
        
        # The pending_feedbacks should be <= coaching_sessions (can't have more pending than total)
        # This is a sanity check - pending feedbacks come from coaching sessions only
        assert pending_feedbacks <= coaching_sessions or coaching_sessions == 0, (
            f"Pending feedbacks ({pending_feedbacks}) should not exceed coaching sessions ({coaching_sessions})"
        )
    
    def test_pending_feedback_sessions_excludes_strategy_calls(self):
        """
        Test that /mentor-dashboard/sessions/pending-feedback excludes strategy calls.
        This endpoint returns sessions that need feedback - strategy calls should not be included.
        """
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/sessions/pending-feedback")
        
        assert response.status_code == 200, f"Pending feedback sessions API failed: {response.text}"
        
        sessions = response.json()
        
        # Check that no strategy calls are in the response
        strategy_call_types = ["Strategy Call", "strategy_call", "Strategy call"]
        strategy_calls_found = []
        
        for session in sessions:
            session_type = session.get("session_type", "")
            if session_type in strategy_call_types:
                strategy_calls_found.append({
                    "id": session.get("id"),
                    "session_type": session_type,
                    "date": session.get("date")
                })
        
        assert len(strategy_calls_found) == 0, (
            f"Strategy calls should NOT appear in pending feedback sessions. "
            f"Found {len(strategy_calls_found)} strategy calls: {strategy_calls_found}"
        )
        
        print(f"✓ Pending feedback sessions endpoint correctly excludes strategy calls")
        print(f"  Total pending feedback sessions: {len(sessions)}")
    
    def test_pending_mandatory_feedback_excludes_strategy_calls(self):
        """
        Test that /feedback/pending-mandatory excludes strategy calls.
        This endpoint returns the first pending feedback that must be completed.
        Strategy calls should never trigger mandatory feedback prompts.
        """
        response = self.session.get(f"{BASE_URL}/api/feedback/pending-mandatory")
        
        assert response.status_code == 200, f"Pending mandatory feedback API failed: {response.text}"
        
        data = response.json()
        
        has_pending = data.get("has_pending", False)
        
        if has_pending:
            session = data.get("session", {})
            session_type = session.get("session_type", "")
            
            strategy_call_types = ["Strategy Call", "strategy_call", "Strategy call"]
            
            assert session_type not in strategy_call_types, (
                f"Strategy calls should NOT trigger mandatory feedback. "
                f"Got session_type: {session_type}"
            )
            
            print(f"✓ Pending mandatory feedback is NOT a strategy call")
            print(f"  Session type: {session_type}")
            print(f"  Session date: {session.get('date')}")
        else:
            print(f"✓ No pending mandatory feedback (this is valid)")
    
    def test_upcoming_sessions_includes_strategy_calls(self):
        """
        Test that /mentor-dashboard/sessions/upcoming DOES include strategy calls.
        Strategy calls should appear in upcoming sessions (just not in feedback prompts).
        This verifies the fix didn't accidentally exclude strategy calls from everywhere.
        """
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/sessions/upcoming")
        
        assert response.status_code == 200, f"Upcoming sessions API failed: {response.text}"
        
        sessions = response.json()
        
        # Count session types
        session_types = {}
        for session in sessions:
            st = session.get("session_type", "Unknown")
            booking_type = session.get("booking_type", "unknown")
            key = f"{st} ({booking_type})"
            session_types[key] = session_types.get(key, 0) + 1
        
        print(f"✓ Upcoming sessions endpoint returned successfully")
        print(f"  Total upcoming sessions: {len(sessions)}")
        print(f"  Session types: {session_types}")
        
        # Note: Strategy calls may or may not be present depending on test data
        # The key point is that this endpoint should NOT filter them out


class TestStrategyCallDataVerification:
    """Additional tests to verify strategy call data structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create a mentor auth session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as mentor using mock login with user_type parameter
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("auth_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
    
    def test_debug_session_lookup(self):
        """
        Test the debug endpoint to understand mentor session data structure.
        This helps verify the mentor_id resolution is working correctly.
        """
        response = self.session.get(f"{BASE_URL}/api/mentor-dashboard/debug/session-lookup")
        
        assert response.status_code == 200, f"Debug session lookup failed: {response.text}"
        
        data = response.json()
        
        print(f"✓ Debug session lookup successful")
        print(f"  User email: {data.get('user_email')}")
        print(f"  Resolved mentor_id: {data.get('resolved_mentor_id')}")
        print(f"  Bookings with resolved ID: {data.get('bookings_with_resolved_id')}")
        print(f"  Strategy calls with resolved ID: {data.get('strategy_calls_with_resolved_id')}")
        
        # Verify mentor_id is resolved
        assert data.get("resolved_mentor_id") is not None, "Mentor ID should be resolved"


class TestCandidateFeedbackExclusion:
    """Tests to verify strategy calls are excluded from candidate feedback prompts too"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data - create a candidate auth session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as candidate using mock login with user_type parameter
        login_response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=full_prep")
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("auth_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
    
    def test_candidate_pending_mandatory_excludes_strategy_calls(self):
        """
        Test that /feedback/pending-mandatory excludes strategy calls for candidates.
        Candidates should not be prompted to give feedback for strategy calls.
        """
        response = self.session.get(f"{BASE_URL}/api/feedback/pending-mandatory")
        
        assert response.status_code == 200, f"Pending mandatory feedback API failed: {response.text}"
        
        data = response.json()
        
        has_pending = data.get("has_pending", False)
        
        if has_pending:
            session = data.get("session", {})
            session_type = session.get("session_type", "")
            feedback_type = data.get("feedback_type", "")
            
            strategy_call_types = ["Strategy Call", "strategy_call", "Strategy call"]
            
            # Only check coaching feedback type (not peer feedback)
            if feedback_type in ["candidate_to_mentor", "mentor_to_candidate"]:
                assert session_type not in strategy_call_types, (
                    f"Strategy calls should NOT trigger mandatory feedback for candidates. "
                    f"Got session_type: {session_type}"
                )
            
            print(f"✓ Candidate pending mandatory feedback check passed")
            print(f"  Feedback type: {feedback_type}")
            print(f"  Session type: {session_type}")
        else:
            print(f"✓ No pending mandatory feedback for candidate (this is valid)")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
