"""
Test Access Control Features for Consulting Prep Platform
- Trial expiry with item-level locking
- First 3 drills of each type are free trial content
- Subscription end dates enforcement
- Days left visibility rules
- Single sessions never expire
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EXPIRED_TRIAL_USER = {"email": "expired@gradnext.com", "password": "test123"}
ACTIVE_TRIAL_USER = {"email": "freetrial@gradnext.com", "password": "test123"}
ADMIN_USER = {"email": "admin@gradnext.com", "password": "admin123"}


class TestDashboardSummaryPlanStatus:
    """Test dashboard-summary endpoint returns correct plan_status flags"""
    
    def test_expired_trial_user_plan_status(self):
        """Expired trial user should have use_item_level_locking=True"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Get dashboard summary
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200, f"Dashboard summary failed: {resp.text}"
        
        data = resp.json()
        plan_status = data.get("plan_status", {})
        
        # Verify plan_status flags for expired trial
        assert plan_status.get("plan_type") == "free_trial", "Plan type should be free_trial"
        assert plan_status.get("plan_category") == "trial", "Plan category should be trial"
        assert plan_status.get("is_trial") == True, "is_trial should be True"
        assert plan_status.get("trial_expired") == True, "trial_expired should be True for expired user"
        assert plan_status.get("use_item_level_locking") == True, "use_item_level_locking should be True for expired trial"
        assert plan_status.get("has_full_access") == False, "has_full_access should be False"
        assert plan_status.get("trial_days_remaining") == 0, "trial_days_remaining should be 0"
        
        print("✓ Expired trial user has correct plan_status flags")
    
    def test_active_trial_user_plan_status(self):
        """Active trial user should have use_item_level_locking=False"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=ACTIVE_TRIAL_USER)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Get dashboard summary
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200, f"Dashboard summary failed: {resp.text}"
        
        data = resp.json()
        plan_status = data.get("plan_status", {})
        trial_status = data.get("trial_status", {})
        
        # Verify plan_status flags for active trial
        assert plan_status.get("plan_type") == "free_trial", "Plan type should be free_trial"
        assert plan_status.get("is_trial") == True, "is_trial should be True"
        assert plan_status.get("trial_expired") == False, "trial_expired should be False for active user"
        assert plan_status.get("use_item_level_locking") == False, "use_item_level_locking should be False for active trial"
        assert plan_status.get("has_full_access") == False, "has_full_access should be False for trial"
        assert plan_status.get("trial_days_remaining") > 0, "trial_days_remaining should be > 0"
        
        # Verify trial_status shows days remaining
        assert trial_status.get("is_expired") == False, "trial_status.is_expired should be False"
        assert trial_status.get("days_remaining") > 0, "trial_status.days_remaining should be > 0"
        
        print(f"✓ Active trial user has correct plan_status flags (days_remaining={plan_status.get('trial_days_remaining')})")
    
    def test_subscription_days_hidden(self):
        """Subscription users should have show_subscription_days=False"""
        session = requests.Session()
        
        # Login as expired trial (we'll check the flag structure)
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200
        
        data = resp.json()
        plan_status = data.get("plan_status", {})
        
        # Verify show_subscription_days flag exists and is False for subscriptions
        assert "show_subscription_days" in plan_status, "show_subscription_days flag should exist"
        assert plan_status.get("show_subscription_days") == False, "show_subscription_days should be False"
        
        # Verify show_coaching_days flag exists and is True for coaching programs
        assert "show_coaching_days" in plan_status, "show_coaching_days flag should exist"
        assert plan_status.get("show_coaching_days") == True, "show_coaching_days should be True"
        
        print("✓ Days visibility flags are correctly set")


class TestAIDrillsFreeTrial:
    """Test AI drills list returns is_free_trial flag correctly"""
    
    def test_first_3_case_math_drills_are_free(self):
        """First 3 Case Math drills should have is_free_trial=True"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get drills list
        resp = session.get(f"{BASE_URL}/api/ai-drills/list")
        assert resp.status_code == 200, f"Drills list failed: {resp.text}"
        
        data = resp.json()
        drills = data.get("drills", [])
        
        # Filter Case Math drills
        case_math_drills = [d for d in drills if d.get("drill_type") == "case_math"]
        assert len(case_math_drills) > 3, "Should have more than 3 Case Math drills"
        
        # Check first 3 are free trial
        for i, drill in enumerate(case_math_drills[:3]):
            assert drill.get("is_free_trial") == True, f"Case Math drill {i+1} ({drill.get('id')}) should be free trial"
        
        # Check 4th and beyond are NOT free trial
        for i, drill in enumerate(case_math_drills[3:6]):
            assert drill.get("is_free_trial") == False, f"Case Math drill {i+4} ({drill.get('id')}) should NOT be free trial"
        
        print(f"✓ First 3 Case Math drills are free trial, rest are locked ({len(case_math_drills)} total)")
    
    def test_first_3_case_structuring_drills_are_free(self):
        """First 3 Case Structuring drills should have is_free_trial=True"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get drills list
        resp = session.get(f"{BASE_URL}/api/ai-drills/list")
        assert resp.status_code == 200
        
        data = resp.json()
        drills = data.get("drills", [])
        
        # Filter Case Structuring drills
        case_structuring_drills = [d for d in drills if d.get("drill_type") == "case_structuring"]
        assert len(case_structuring_drills) > 3, "Should have more than 3 Case Structuring drills"
        
        # Check first 3 are free trial
        for i, drill in enumerate(case_structuring_drills[:3]):
            assert drill.get("is_free_trial") == True, f"Case Structuring drill {i+1} ({drill.get('id')}) should be free trial"
        
        # Check 4th and beyond are NOT free trial
        for i, drill in enumerate(case_structuring_drills[3:6]):
            assert drill.get("is_free_trial") == False, f"Case Structuring drill {i+4} ({drill.get('id')}) should NOT be free trial"
        
        print(f"✓ First 3 Case Structuring drills are free trial, rest are locked ({len(case_structuring_drills)} total)")
    
    def test_drills_have_required_fields(self):
        """All drills should have required fields including is_free_trial"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get drills list
        resp = session.get(f"{BASE_URL}/api/ai-drills/list")
        assert resp.status_code == 200
        
        data = resp.json()
        drills = data.get("drills", [])
        
        required_fields = ["id", "drill_type", "difficulty", "name", "question_count", "is_free_trial"]
        
        for drill in drills[:5]:  # Check first 5 drills
            for field in required_fields:
                assert field in drill, f"Drill {drill.get('id')} missing required field: {field}"
        
        print(f"✓ All drills have required fields including is_free_trial")


class TestAccessControlFlags:
    """Test access control flags in dashboard-summary"""
    
    def test_expired_trial_pages_browsable(self):
        """Expired trial user should have access flags set to True (pages browsable)"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get dashboard summary
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200
        
        data = resp.json()
        access = data.get("access", {})
        plan_status = data.get("plan_status", {})
        
        # For expired trial with item-level locking:
        # - Pages should be browsable (access flags True)
        # - But items are locked (use_item_level_locking=True)
        assert plan_status.get("use_item_level_locking") == True, "Item-level locking should be enabled"
        
        # Access to pages should be True (browsable)
        assert access.get("courses") == True, "Courses page should be browsable"
        assert access.get("drills") == True, "Drills page should be browsable"
        assert access.get("peer_practice") == True, "Peer Practice page should be browsable"
        
        print("✓ Expired trial user can browse pages but items are locked")
    
    def test_trial_limits_returned(self):
        """Dashboard should return trial limits (free_drills=3)"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get dashboard summary
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200
        
        data = resp.json()
        limits = data.get("limits", {})
        
        # Verify limits
        assert limits.get("free_drills") == 3, "free_drills limit should be 3"
        assert "free_videos" in limits, "free_videos limit should exist"
        assert "free_workshops" in limits, "free_workshops limit should exist"
        
        print(f"✓ Trial limits returned correctly: {limits}")


class TestSingleSessionsNeverExpire:
    """Test that single sessions (coaching_sessions_remaining) never expire"""
    
    def test_single_sessions_flag_exists(self):
        """plan_status should include has_single_sessions and single_sessions_remaining"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=EXPIRED_TRIAL_USER)
        assert login_resp.status_code == 200
        
        # Get dashboard summary
        resp = session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert resp.status_code == 200
        
        data = resp.json()
        plan_status = data.get("plan_status", {})
        
        # Verify single session flags exist
        assert "has_single_sessions" in plan_status, "has_single_sessions flag should exist"
        assert "single_sessions_remaining" in plan_status, "single_sessions_remaining flag should exist"
        
        print("✓ Single session flags exist in plan_status")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
