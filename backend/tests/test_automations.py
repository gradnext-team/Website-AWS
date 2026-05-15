"""
Test Suite for Email Automations Feature
Tests the 7-Day Free Trial Email Automation functionality including:
- GET /api/admin/automations - List automations (with auto-seeding)
- GET /api/admin/automations/resend-templates - Fetch templates from Resend
- PUT /api/admin/automations/{id} - Update automation configuration
- POST /api/admin/automations/{id}/toggle - Toggle automation enabled/disabled
- GET /api/admin/automations/{id}/logs - Get email send logs
- POST /api/admin/automations/{id}/run-now - Manually trigger automation run
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAutomationsAPI:
    """Test Automations API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Get admin auth token before each test"""
        self.session = requests.Session()
        
        # Login as admin using mock login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.admin_token = login_response.json().get('auth_token')
        self.session.headers.update({'Authorization': f'Bearer {self.admin_token}'})
        
    def test_01_list_automations_returns_seeded_data(self):
        """GET /api/admin/automations - Should return list with auto-seeded 7-day trial automation"""
        response = self.session.get(f"{BASE_URL}/api/admin/automations")
        
        assert response.status_code == 200, f"Failed to list automations: {response.text}"
        data = response.json()
        
        assert 'automations' in data, "Response should contain 'automations' key"
        automations = data['automations']
        assert len(automations) >= 1, "Should have at least 1 automation (seeded trial-7day)"
        
        # Find the trial-7day automation
        trial_auto = next((a for a in automations if a['id'] == 'trial-7day'), None)
        assert trial_auto is not None, "Should have seeded trial-7day automation"
        
        # Verify structure
        assert trial_auto['name'] == '7-Day Free Trial Sequence', "Automation name should match"
        assert 'days' in trial_auto, "Should have 'days' configuration"
        assert len(trial_auto['days']) == 7, "Should have 7 day configurations"
        assert 'stats' in trial_auto, "Should have 'stats' field"
        
        print(f"SUCCESS: Found {len(automations)} automation(s)")
        print(f"Trial automation enabled: {trial_auto.get('enabled', False)}")
        
    def test_02_fetch_resend_templates(self):
        """GET /api/admin/automations/resend-templates - Should fetch templates from Resend API"""
        response = self.session.get(f"{BASE_URL}/api/admin/automations/resend-templates")
        
        assert response.status_code == 200, f"Failed to fetch templates: {response.text}"
        data = response.json()
        
        assert 'templates' in data, "Response should contain 'templates' key"
        templates = data['templates']
        
        # Based on context, there should be 2 templates: 'Untitled Template' and 'Welcome Mail'
        if len(templates) > 0:
            print(f"SUCCESS: Found {len(templates)} Resend templates")
            for t in templates:
                assert 'id' in t, "Template should have 'id'"
                assert 'name' in t, "Template should have 'name'"
                print(f"  - {t['name']} (ID: {t['id']})")
        else:
            # Templates might be empty if API key issue
            if 'error' in data:
                print(f"Note: No templates returned, error: {data.get('error')}")
            else:
                print("Note: No templates found in Resend account")
                
    def test_03_update_automation_day_config(self):
        """PUT /api/admin/automations/trial-7day - Should update day configuration"""
        # First get current config
        list_response = self.session.get(f"{BASE_URL}/api/admin/automations")
        assert list_response.status_code == 200
        automations = list_response.json()['automations']
        trial_auto = next((a for a in automations if a['id'] == 'trial-7day'), None)
        assert trial_auto is not None
        
        # Get existing days and modify Day 1
        current_days = trial_auto['days']
        updated_days = []
        for d in current_days:
            day_config = {
                'day': d['day'],
                'enabled': d.get('enabled', False),
                'template_id': d.get('template_id'),
                'template_name': d.get('template_name'),
                'subject': d.get('subject', '')
            }
            # Enable Day 1 with a test subject
            if d['day'] == 1:
                day_config['enabled'] = True
                day_config['subject'] = 'TEST: Day 1 Updated Subject'
            updated_days.append(day_config)
        
        # Update automation
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/automations/trial-7day",
            json={'days': updated_days}
        )
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        data = update_response.json()
        
        assert data.get('success') == True, "Update should return success=True"
        assert 'automation' in data, "Response should contain updated automation"
        
        # Verify update persisted
        updated_auto = data['automation']
        day1 = next((d for d in updated_auto['days'] if d['day'] == 1), None)
        assert day1 is not None
        assert day1['enabled'] == True, "Day 1 should be enabled"
        assert day1['subject'] == 'TEST: Day 1 Updated Subject', "Day 1 subject should be updated"
        
        print("SUCCESS: Automation day config updated and persisted")
        
        # Reset back to original
        for d in updated_days:
            if d['day'] == 1:
                d['enabled'] = False
                d['subject'] = 'Welcome to gradnext!'
        self.session.put(
            f"{BASE_URL}/api/admin/automations/trial-7day",
            json={'days': updated_days}
        )
        
    def test_04_toggle_automation_enabled(self):
        """POST /api/admin/automations/trial-7day/toggle - Should toggle enabled state"""
        # First get current state
        list_response = self.session.get(f"{BASE_URL}/api/admin/automations")
        automations = list_response.json()['automations']
        trial_auto = next((a for a in automations if a['id'] == 'trial-7day'), None)
        initial_enabled = trial_auto.get('enabled', False)
        
        # Toggle state
        toggle_response = self.session.post(f"{BASE_URL}/api/admin/automations/trial-7day/toggle")
        
        assert toggle_response.status_code == 200, f"Failed to toggle: {toggle_response.text}"
        data = toggle_response.json()
        
        assert data.get('success') == True, "Toggle should return success=True"
        assert 'enabled' in data, "Response should contain new enabled state"
        assert data['enabled'] == (not initial_enabled), "State should be toggled"
        
        print(f"SUCCESS: Toggled automation from {initial_enabled} to {data['enabled']}")
        
        # Toggle back to original state
        self.session.post(f"{BASE_URL}/api/admin/automations/trial-7day/toggle")
        
    def test_05_get_automation_logs(self):
        """GET /api/admin/automations/trial-7day/logs - Should return email send logs"""
        response = self.session.get(f"{BASE_URL}/api/admin/automations/trial-7day/logs")
        
        assert response.status_code == 200, f"Failed to get logs: {response.text}"
        data = response.json()
        
        assert 'logs' in data, "Response should contain 'logs' key"
        assert 'total' in data, "Response should contain 'total' count"
        
        logs = data['logs']
        total = data['total']
        
        print(f"SUCCESS: Retrieved {len(logs)} logs (total: {total})")
        
        # If logs exist, verify structure
        if len(logs) > 0:
            log = logs[0]
            assert 'automation_id' in log, "Log should have automation_id"
            assert 'user_email' in log, "Log should have user_email"
            assert 'day' in log, "Log should have day"
            assert 'status' in log, "Log should have status"
            print(f"  Sample log: {log.get('user_email')} - Day {log.get('day')} - {log.get('status')}")
            
    def test_06_run_automation_now(self):
        """POST /api/admin/automations/trial-7day/run-now - Should manually trigger automation"""
        response = self.session.post(f"{BASE_URL}/api/admin/automations/trial-7day/run-now")
        
        assert response.status_code == 200, f"Failed to run automation: {response.text}"
        data = response.json()
        
        assert data.get('success') == True, "Run should return success=True"
        assert 'result' in data, "Response should contain 'result' stats"
        
        result = data['result']
        print("SUCCESS: Automation run completed")
        print(f"  Checked: {result.get('checked', 0)}")
        print(f"  Sent: {result.get('sent', 0)}")
        print(f"  Skipped (upgraded): {result.get('skipped_upgraded', 0)}")
        print(f"  Skipped (already sent): {result.get('skipped_already_sent', 0)}")
        print(f"  Failed: {result.get('failed', 0)}")
        
    def test_07_update_automation_not_found(self):
        """PUT /api/admin/automations/nonexistent - Should return 404"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/automations/nonexistent-automation",
            json={'enabled': True}
        )
        
        assert response.status_code == 404, f"Should return 404 for non-existent automation"
        print("SUCCESS: Correctly returns 404 for non-existent automation")
        
    def test_08_toggle_nonexistent_automation(self):
        """POST /api/admin/automations/nonexistent/toggle - Should return 404"""
        response = self.session.post(f"{BASE_URL}/api/admin/automations/nonexistent-automation/toggle")
        
        assert response.status_code == 404, f"Should return 404 for non-existent automation"
        print("SUCCESS: Correctly returns 404 for toggle on non-existent automation")
        
    def test_09_logs_pagination(self):
        """GET /api/admin/automations/trial-7day/logs - Test pagination params"""
        # Test with limit
        response = self.session.get(
            f"{BASE_URL}/api/admin/automations/trial-7day/logs",
            params={'limit': 5, 'skip': 0}
        )
        
        assert response.status_code == 200, f"Failed with pagination params: {response.text}"
        data = response.json()
        logs = data['logs']
        
        # Should not exceed limit
        assert len(logs) <= 5, "Should respect limit parameter"
        print(f"SUCCESS: Pagination works, returned {len(logs)} logs with limit=5")
        
    def test_10_update_with_enabled_flag(self):
        """PUT /api/admin/automations/trial-7day - Update enabled field directly"""
        # Enable automation directly
        response = self.session.put(
            f"{BASE_URL}/api/admin/automations/trial-7day",
            json={'enabled': True}
        )
        
        assert response.status_code == 200, f"Failed to update enabled: {response.text}"
        data = response.json()
        assert data['automation']['enabled'] == True, "Automation should be enabled"
        
        # Disable it back
        response = self.session.put(
            f"{BASE_URL}/api/admin/automations/trial-7day",
            json={'enabled': False}
        )
        assert response.status_code == 200
        assert response.json()['automation']['enabled'] == False
        
        print("SUCCESS: Can update enabled flag directly via PUT")
        
    def test_11_non_admin_cannot_access(self):
        """Verify non-admin users cannot access automations endpoints"""
        # Login as regular user
        user_session = requests.Session()
        login_response = user_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription"
        )
        assert login_response.status_code == 200
        user_token = login_response.json().get('auth_token')
        user_session.headers.update({'Authorization': f'Bearer {user_token}'})
        
        # Try to access automations
        response = user_session.get(f"{BASE_URL}/api/admin/automations")
        
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Non-admin should get 403, got {response.status_code}"
        print("SUCCESS: Non-admin users correctly blocked from automations endpoints")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
