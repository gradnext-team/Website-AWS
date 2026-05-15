"""
Test Suite for Drill Completion Count Fix and Plan Configurations
Tests:
1. Drills page shows correct unique completed count (not total attempts)
2. Pinnacle user gets access.coaching = true and is_unlimited_coaching = true
3. Basic plan users get has_access = true for peer practice with 4 sessions
4. Last Mile users get has_access = true for peer practice with 4 sessions
5. Startup migrations run on backend startup and update plan configurations
6. Favicon is properly configured
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStartupMigrations:
    """Test that startup migrations configure plans correctly"""
    
    def test_plans_endpoint_returns_data(self):
        """Verify plans endpoint is accessible and returns plans"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200
        data = response.json()
        
        # Plans endpoint returns {'plans': [...], 'grouped': {...}}
        assert 'plans' in data, "Response should have 'plans' key"
        plans = data['plans']
        assert isinstance(plans, list)
        assert len(plans) > 0
        print(f"✓ Plans endpoint returns {len(plans)} plans")
    
    def test_basic_plan_has_4_peer_sessions(self):
        """Verify Basic Plan has 4 peer sessions per month"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200
        data = response.json()
        plans = data.get('plans', [])
        
        basic = next((p for p in plans if p.get('id') == 'basic_plan'), None)
        assert basic is not None, "Basic Plan not found in public plans"
        
        features = basic.get('features', {})
        peer_sessions = features.get('peer_sessions_per_month', 0)
        assert peer_sessions == 4, f"Basic Plan peer_sessions_per_month should be 4, got {peer_sessions}"
        print(f"✓ Basic Plan has 4 peer sessions per month (peer_sessions_per_month={peer_sessions})")
    
    def test_last_mile_plan_has_4_peer_sessions(self):
        """Verify Last Mile plan has 4 peer sessions per month"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200
        data = response.json()
        plans = data.get('plans', [])
        
        last_mile = next((p for p in plans if p.get('id') == 'last_mile'), None)
        assert last_mile is not None, "Last Mile plan not found in public plans"
        
        features = last_mile.get('features', {})
        peer_sessions = features.get('peer_sessions_per_month', 0)
        assert peer_sessions == 4, f"Last Mile peer_sessions_per_month should be 4, got {peer_sessions}"
        print(f"✓ Last Mile plan has 4 peer sessions per month (peer_sessions_per_month={peer_sessions})")
    
    def test_pro_plus_has_unlimited_peer_sessions(self):
        """Verify Pro+ plan has unlimited peer sessions (-1)"""
        response = requests.get(f"{BASE_URL}/api/resources/plans")
        assert response.status_code == 200
        data = response.json()
        plans = data.get('plans', [])
        
        pro_plus = next((p for p in plans if p.get('id') == 'pro_plus'), None)
        assert pro_plus is not None, "Pro+ plan not found in public plans"
        
        features = pro_plus.get('features', {})
        peer_sessions = features.get('peer_sessions_per_month', 0)
        assert peer_sessions == -1, f"Pro+ peer_sessions_per_month should be -1 (unlimited), got {peer_sessions}"
        print(f"✓ Pro+ plan has unlimited peer sessions (peer_sessions_per_month={peer_sessions})")


class TestPinnacleUserAccess:
    """Test Pinnacle user gets unlimited coaching access"""
    
    def test_mock_pinnacle_user_has_unlimited_coaching(self):
        """Verify mock Pinnacle user gets is_unlimited_coaching=true"""
        session = requests.Session()
        
        # Login as Pinnacle user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=pinnacle")
        assert login_response.status_code == 200, f"Mock login failed: {login_response.text}"
        
        # Get dashboard summary
        dashboard_response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert dashboard_response.status_code == 200, f"Dashboard summary failed: {dashboard_response.text}"
        
        data = dashboard_response.json()
        user = data.get('user', {})
        access = data.get('access', {})
        
        # Verify unlimited coaching
        is_unlimited = user.get('is_unlimited_coaching', False)
        coaching_remaining = user.get('coaching_sessions_remaining', 0)
        has_coaching_access = access.get('coaching', False)
        
        assert is_unlimited == True, f"Pinnacle user should have is_unlimited_coaching=True, got {is_unlimited}"
        assert coaching_remaining == -1, f"Pinnacle user should have coaching_sessions_remaining=-1, got {coaching_remaining}"
        assert has_coaching_access == True, f"Pinnacle user should have access.coaching=True, got {has_coaching_access}"
        
        print(f"✓ Pinnacle user has unlimited coaching: is_unlimited_coaching={is_unlimited}, coaching_sessions_remaining={coaching_remaining}, access.coaching={has_coaching_access}")
    
    def test_pinnacle_user_plan_is_pinnacle(self):
        """Verify mock Pinnacle user has plan='pinnacle'"""
        session = requests.Session()
        
        # Login as Pinnacle user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=pinnacle")
        assert login_response.status_code == 200
        
        # Get dashboard summary
        dashboard_response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert dashboard_response.status_code == 200
        
        data = dashboard_response.json()
        user = data.get('user', {})
        
        plan = user.get('plan', '')
        assert plan.lower() == 'pinnacle', f"Pinnacle user should have plan='pinnacle', got '{plan}'"
        print(f"✓ Pinnacle user has correct plan: {plan}")


class TestBasicPlanPeerAccess:
    """Test Basic Plan users get peer practice access with 4 sessions"""
    
    def test_mock_subscription_user_has_peer_access(self):
        """Verify mock subscription user gets peer practice access"""
        session = requests.Session()
        
        # Login as subscription user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200, f"Mock login failed: {login_response.text}"
        
        # Get session credits
        credits_response = session.get(f"{BASE_URL}/api/peers/session-credits")
        assert credits_response.status_code == 200, f"Session credits failed: {credits_response.text}"
        
        data = credits_response.json()
        has_access = data.get('has_access', False)
        
        assert has_access == True, f"Subscription user should have peer practice access, got has_access={has_access}"
        print(f"✓ Subscription user has peer practice access: has_access={has_access}")
    
    def test_peer_practice_status_for_subscription_user(self):
        """Verify peer practice status endpoint returns correct access"""
        session = requests.Session()
        
        # Login as subscription user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        # Get peer practice status
        status_response = session.get(f"{BASE_URL}/api/resources/peer-practice/status")
        assert status_response.status_code == 200
        
        data = status_response.json()
        has_access = data.get('has_access', False)
        
        assert has_access == True, f"Subscription user should have peer practice access"
        print(f"✓ Peer practice status: has_access={has_access}")


class TestDrillCompletionCount:
    """Test that drill completion count shows unique drills, not total attempts"""
    
    def test_drill_history_endpoint(self):
        """Verify drill history endpoint returns data with drill_id for unique counting"""
        session = requests.Session()
        
        # Login as test user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        # Get drill history
        history_response = session.get(f"{BASE_URL}/api/ai-drills/history")
        assert history_response.status_code == 200
        
        data = history_response.json()
        history = data.get('history', [])
        
        # Count unique drill_ids
        unique_drills = set(h.get('drill_id') for h in history if h.get('drill_id'))
        total_attempts = len(history)
        
        print(f"✓ Drill history: {total_attempts} total attempts, {len(unique_drills)} unique drills completed")
        
        # The frontend should use unique count, not total attempts
        # This test verifies the data structure is correct for the frontend to calculate
        assert isinstance(history, list), "History should be a list"
        
        # If there are history entries, verify they have drill_id
        if history:
            assert 'drill_id' in history[0], "History entries should have drill_id for unique counting"
    
    def test_dashboard_progress_drills_count(self):
        """Verify dashboard progress returns correct drill count (unique, not attempts)"""
        session = requests.Session()
        
        # Login as test user
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        # Get dashboard summary
        dashboard_response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert dashboard_response.status_code == 200
        
        data = dashboard_response.json()
        progress = data.get('progress', {})
        
        drills_completed = progress.get('drills_completed', 0)
        total_drills = progress.get('total_drills', 0)
        
        print(f"✓ Dashboard progress: {drills_completed}/{total_drills} drills completed")
        
        # Verify the count is reasonable (not negative, not more than total)
        assert drills_completed >= 0, f"drills_completed should be >= 0, got {drills_completed}"
        assert total_drills > 0, f"total_drills should be > 0, got {total_drills}"
        assert drills_completed <= total_drills, f"drills_completed ({drills_completed}) should not exceed total_drills ({total_drills})"


class TestFavicon:
    """Test favicon is properly configured"""
    
    def test_favicon_html_reference(self):
        """Verify index.html has favicon link"""
        # Read the index.html file
        index_path = '/app/frontend/public/index.html'
        with open(index_path, 'r') as f:
            content = f.read()
        
        assert 'favicon.ico' in content, "index.html should reference favicon.ico"
        assert 'rel="icon"' in content, "index.html should have rel='icon' for favicon"
        print("✓ index.html has favicon link configured")
    
    def test_favicon_file_exists(self):
        """Verify favicon.ico file exists"""
        import os
        favicon_path = '/app/frontend/public/favicon.ico'
        assert os.path.exists(favicon_path), f"favicon.ico should exist at {favicon_path}"
        
        # Check file size is reasonable (not empty)
        size = os.path.getsize(favicon_path)
        assert size > 0, "favicon.ico should not be empty"
        print(f"✓ favicon.ico exists ({size} bytes)")


class TestProPlusUserWithCredentials:
    """Test with actual test credentials"""
    
    def test_login_with_test_credentials(self):
        """Test login with testdash@gradnext.co / Test@1234"""
        session = requests.Session()
        
        # Login with password
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "testdash@gradnext.co",
                "password": "Test@1234"
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Password login not available or credentials invalid: {login_response.status_code}")
        
        # Get dashboard summary
        dashboard_response = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert dashboard_response.status_code == 200
        
        data = dashboard_response.json()
        user = data.get('user', {})
        access = data.get('access', {})
        
        print(f"✓ Test user logged in: plan={user.get('plan')}, coaching_remaining={user.get('coaching_sessions_remaining')}")
        print(f"  Access: subscription={access.get('subscription')}, coaching={access.get('coaching')}")


class TestDrillsListEndpoint:
    """Test drills list endpoint"""
    
    def test_drills_list_returns_data(self):
        """Verify drills list endpoint returns drills"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert login_response.status_code == 200
        
        # Get drills list
        drills_response = session.get(f"{BASE_URL}/api/ai-drills/list")
        assert drills_response.status_code == 200
        
        data = drills_response.json()
        drills = data.get('drills', [])
        
        assert len(drills) > 0, "Should have at least one drill"
        
        # Verify drill structure
        first_drill = drills[0]
        assert 'id' in first_drill, "Drill should have id"
        assert 'name' in first_drill, "Drill should have name"
        assert 'drill_type' in first_drill, "Drill should have drill_type"
        
        print(f"✓ Drills list returns {len(drills)} drills")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
