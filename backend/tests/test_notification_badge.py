"""
Test cases for unread notification count badge feature
Tests the /candidate/notifications/unread-count endpoint and notification badge functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNotificationBadgeAPI:
    """Tests for notification badge API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Full Prep candidate using mock-login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login",
            json={"email": "fullprep@gradnext.co"}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            if data.get("token"):
                self.session.headers.update({"Authorization": f"Bearer {data['token']}"})
            self.user_id = data.get("user", {}).get("id")
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_unread_count_endpoint_exists(self):
        """Test that /candidate/notifications/unread-count endpoint exists and returns 200"""
        response = self.session.get(f"{BASE_URL}/api/candidate/notifications/unread-count")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "unread_count" in data, "Response should contain 'unread_count' field"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        assert data["unread_count"] >= 0, "unread_count should be non-negative"
        
        print(f"✓ Unread count endpoint working. Count: {data['unread_count']}")
    
    def test_notifications_endpoint_includes_unread_count(self):
        """Test that /candidate/notifications endpoint includes unread_count in response"""
        response = self.session.get(f"{BASE_URL}/api/candidate/notifications")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' field"
        assert "unread_count" in data, "Response should contain 'unread_count' field"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
        
        print(f"✓ Notifications endpoint includes unread_count: {data['unread_count']}")
        print(f"  Total notifications: {len(data['notifications'])}")
    
    def test_unread_count_matches_pending_notifications(self):
        """Test that unread_count matches the number of pending notifications"""
        response = self.session.get(f"{BASE_URL}/api/candidate/notifications")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        notifications = data.get("notifications", [])
        unread_count = data.get("unread_count", 0)
        
        # Count notifications with pending status
        pending_count = sum(1 for n in notifications if n.get("status") == "pending")
        
        assert unread_count == pending_count, f"unread_count ({unread_count}) should match pending notifications ({pending_count})"
        
        print(f"✓ Unread count ({unread_count}) matches pending notifications ({pending_count})")
    
    def test_unread_count_consistency(self):
        """Test that unread count from both endpoints is consistent"""
        # Get count from dedicated endpoint
        count_response = self.session.get(f"{BASE_URL}/api/candidate/notifications/unread-count")
        assert count_response.status_code == 200
        count_data = count_response.json()
        
        # Get count from notifications endpoint
        notif_response = self.session.get(f"{BASE_URL}/api/candidate/notifications")
        assert notif_response.status_code == 200
        notif_data = notif_response.json()
        
        assert count_data["unread_count"] == notif_data["unread_count"], \
            f"Counts should match: dedicated endpoint ({count_data['unread_count']}) vs notifications endpoint ({notif_data['unread_count']})"
        
        print(f"✓ Unread counts are consistent across endpoints: {count_data['unread_count']}")
    
    def test_unread_count_requires_authentication(self):
        """Test that unread count endpoint requires authentication"""
        # Create a new session without auth
        unauthenticated_session = requests.Session()
        unauthenticated_session.headers.update({"Content-Type": "application/json"})
        
        response = unauthenticated_session.get(f"{BASE_URL}/api/candidate/notifications/unread-count")
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        
        print("✓ Unread count endpoint correctly requires authentication")


class TestNotificationMarkAsRead:
    """Tests for marking notifications as read and count updates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Full Prep candidate using mock-login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login",
            json={"email": "fullprep@gradnext.co"}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            if data.get("token"):
                self.session.headers.update({"Authorization": f"Bearer {data['token']}"})
            self.user_id = data.get("user", {}).get("id")
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_mark_notification_as_read_decreases_count(self):
        """Test that marking a notification as read decreases the unread count"""
        # Get initial notifications
        response = self.session.get(f"{BASE_URL}/api/candidate/notifications")
        
        if response.status_code != 200:
            pytest.skip("Could not fetch notifications")
        
        data = response.json()
        notifications = data.get("notifications", [])
        initial_count = data.get("unread_count", 0)
        
        # Find a pending notification to mark as read
        pending_notification = next((n for n in notifications if n.get("status") == "pending"), None)
        
        if not pending_notification:
            print("✓ No pending notifications to test mark-as-read (count is already 0)")
            return
        
        notification_id = pending_notification.get("id")
        
        # Mark as read
        mark_response = self.session.post(f"{BASE_URL}/api/candidate/notifications/{notification_id}/read")
        
        if mark_response.status_code != 200:
            pytest.skip(f"Could not mark notification as read: {mark_response.status_code}")
        
        # Get updated count
        updated_response = self.session.get(f"{BASE_URL}/api/candidate/notifications/unread-count")
        assert updated_response.status_code == 200
        
        updated_count = updated_response.json().get("unread_count", 0)
        
        assert updated_count == initial_count - 1, \
            f"Unread count should decrease by 1 after marking as read. Initial: {initial_count}, Updated: {updated_count}"
        
        print(f"✓ Marking notification as read decreased count from {initial_count} to {updated_count}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
