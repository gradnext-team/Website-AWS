"""
Test Admin Case Drills Management API
Tests for the new admin panel 'Case Drills' tab functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@gradnext.com"
ADMIN_PASSWORD = "admin123"


class TestAdminCaseDrillsAPI:
    """Test Admin Case Drills Management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        yield
        
        # Cleanup: Reset drill settings to defaults after tests
        try:
            self.session.post(f"{BASE_URL}/api/admin/ai-drills/reset-defaults")
        except:
            pass
    
    def test_get_all_ai_drills(self):
        """Test GET /api/admin/ai-drills returns all 44 AI drills with stats"""
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "drills" in data, "Response should contain 'drills' key"
        assert "stats" in data, "Response should contain 'stats' key"
        assert "total" in data, "Response should contain 'total' key"
        
        drills = data["drills"]
        stats = data["stats"]
        
        # Verify we have 44 drills (as mentioned in requirements)
        assert len(drills) == 44, f"Expected 44 drills, got {len(drills)}"
        
        # Verify drill structure
        first_drill = drills[0]
        assert "id" in first_drill, "Drill should have 'id'"
        assert "drill_type" in first_drill, "Drill should have 'drill_type'"
        assert "is_free_trial" in first_drill, "Drill should have 'is_free_trial'"
        assert "name" in first_drill, "Drill should have 'name'"
        assert "difficulty" in first_drill, "Drill should have 'difficulty'"
        assert "question_count" in first_drill, "Drill should have 'question_count'"
        
        # Verify stats structure
        assert "case_math" in stats, "Stats should have 'case_math'"
        assert "case_structuring" in stats, "Stats should have 'case_structuring'"
        assert "case_math_free" in stats, "Stats should have 'case_math_free'"
        assert "case_structuring_free" in stats, "Stats should have 'case_structuring_free'"
        
        print(f"✓ GET /api/admin/ai-drills returned {len(drills)} drills")
        print(f"  Stats: Case Math={stats['case_math']}, Case Structuring={stats['case_structuring']}")
        print(f"  Free Trial: Case Math={stats['case_math_free']}, Case Structuring={stats['case_structuring_free']}")
    
    def test_default_free_trial_drills(self):
        """Test that first 3 drills of each type are free trial by default"""
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        
        assert response.status_code == 200
        
        data = response.json()
        drills = data["drills"]
        
        # Group drills by type
        case_math_drills = [d for d in drills if d["drill_type"] == "case_math"]
        case_structuring_drills = [d for d in drills if d["drill_type"] == "case_structuring"]
        
        # Check first 3 of each type are free trial
        case_math_free = [d for d in case_math_drills if d["is_free_trial"]]
        case_structuring_free = [d for d in case_structuring_drills if d["is_free_trial"]]
        
        # By default, first 3 of each type should be free
        assert len(case_math_free) >= 3, f"Expected at least 3 free Case Math drills, got {len(case_math_free)}"
        assert len(case_structuring_free) >= 3, f"Expected at least 3 free Case Structuring drills, got {len(case_structuring_free)}"
        
        print(f"✓ Default free trial drills: Case Math={len(case_math_free)}, Case Structuring={len(case_structuring_free)}")
    
    def test_toggle_drill_free_trial(self):
        """Test PUT /api/admin/ai-drills/{id} toggles is_free_trial"""
        # First get all drills
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        
        # Find a drill that is currently free trial
        free_drill = next((d for d in drills if d["is_free_trial"]), None)
        assert free_drill is not None, "Should have at least one free trial drill"
        
        drill_id = free_drill["id"]
        
        # Toggle it to NOT free trial
        toggle_response = self.session.put(
            f"{BASE_URL}/api/admin/ai-drills/{drill_id}",
            json={"is_free_trial": False}
        )
        
        assert toggle_response.status_code == 200, f"Expected 200, got {toggle_response.status_code}: {toggle_response.text}"
        
        toggle_data = toggle_response.json()
        assert toggle_data.get("success") == True, "Toggle should return success=True"
        
        # Verify the change persisted
        verify_response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        assert verify_response.status_code == 200
        
        updated_drills = verify_response.json()["drills"]
        updated_drill = next((d for d in updated_drills if d["id"] == drill_id), None)
        
        assert updated_drill is not None, "Drill should still exist"
        assert updated_drill["is_free_trial"] == False, "Drill should now be NOT free trial"
        assert updated_drill.get("is_custom_setting") == True, "Drill should show 'Custom setting' label"
        
        print(f"✓ Successfully toggled drill {drill_id} to is_free_trial=False")
        print(f"  is_custom_setting={updated_drill.get('is_custom_setting')}")
    
    def test_toggle_drill_back_to_free_trial(self):
        """Test toggling a drill back to free trial"""
        # Get drills
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        
        # Find a drill that is NOT free trial
        paid_drill = next((d for d in drills if not d["is_free_trial"]), None)
        assert paid_drill is not None, "Should have at least one paid drill"
        
        drill_id = paid_drill["id"]
        
        # Toggle it to free trial
        toggle_response = self.session.put(
            f"{BASE_URL}/api/admin/ai-drills/{drill_id}",
            json={"is_free_trial": True}
        )
        
        assert toggle_response.status_code == 200
        
        # Verify the change
        verify_response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        updated_drills = verify_response.json()["drills"]
        updated_drill = next((d for d in updated_drills if d["id"] == drill_id), None)
        
        assert updated_drill["is_free_trial"] == True, "Drill should now be free trial"
        
        print(f"✓ Successfully toggled drill {drill_id} to is_free_trial=True")
    
    def test_reset_defaults(self):
        """Test POST /api/admin/ai-drills/reset-defaults resets all custom settings"""
        # First make a custom change
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        drills = response.json()["drills"]
        
        # Toggle a drill
        drill_id = drills[0]["id"]
        original_value = drills[0]["is_free_trial"]
        
        self.session.put(
            f"{BASE_URL}/api/admin/ai-drills/{drill_id}",
            json={"is_free_trial": not original_value}
        )
        
        # Verify custom setting exists
        verify_response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        updated_drill = next((d for d in verify_response.json()["drills"] if d["id"] == drill_id), None)
        assert updated_drill.get("is_custom_setting") == True, "Should have custom setting"
        
        # Reset to defaults
        reset_response = self.session.post(f"{BASE_URL}/api/admin/ai-drills/reset-defaults")
        
        assert reset_response.status_code == 200, f"Expected 200, got {reset_response.status_code}"
        
        reset_data = reset_response.json()
        assert reset_data.get("success") == True, "Reset should return success=True"
        
        # Verify all custom settings are removed
        final_response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        final_drills = final_response.json()["drills"]
        
        custom_settings_count = sum(1 for d in final_drills if d.get("is_custom_setting"))
        assert custom_settings_count == 0, f"Expected 0 custom settings after reset, got {custom_settings_count}"
        
        print(f"✓ Reset defaults successful, removed all custom settings")
    
    def test_invalid_drill_id(self):
        """Test PUT with invalid drill ID returns 404"""
        response = self.session.put(
            f"{BASE_URL}/api/admin/ai-drills/invalid-drill-id-12345",
            json={"is_free_trial": True}
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid drill ID, got {response.status_code}"
        print("✓ Invalid drill ID correctly returns 404")
    
    def test_changes_persist_to_candidate_api(self):
        """Test that admin changes persist to /api/ai-drills/list endpoint"""
        # Get drills from admin API
        admin_response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        assert admin_response.status_code == 200
        
        admin_drills = admin_response.json()["drills"]
        
        # Find a drill and toggle it
        drill_to_toggle = admin_drills[5]  # Pick a drill that's likely not free by default
        drill_id = drill_to_toggle["id"]
        new_value = not drill_to_toggle["is_free_trial"]
        
        # Toggle it
        toggle_response = self.session.put(
            f"{BASE_URL}/api/admin/ai-drills/{drill_id}",
            json={"is_free_trial": new_value}
        )
        assert toggle_response.status_code == 200
        
        # Now check the candidate-facing API
        candidate_response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert candidate_response.status_code == 200
        
        candidate_drills = candidate_response.json().get("drills", [])
        
        # Find the same drill in candidate API
        candidate_drill = None
        for drill_type_data in candidate_drills:
            for difficulty_data in drill_type_data.get("difficulties", []):
                for drill in difficulty_data.get("drills", []):
                    if drill.get("id") == drill_id:
                        candidate_drill = drill
                        break
        
        if candidate_drill:
            assert candidate_drill.get("is_free_trial") == new_value, \
                f"Candidate API should reflect admin change: expected {new_value}, got {candidate_drill.get('is_free_trial')}"
            print(f"✓ Admin change persisted to candidate API: drill {drill_id} is_free_trial={new_value}")
        else:
            print(f"⚠ Could not find drill {drill_id} in candidate API response (may have different structure)")
    
    def test_non_admin_cannot_access(self):
        """Test that non-admin users cannot access admin AI drills endpoints"""
        # Create a new session without admin auth
        non_admin_session = requests.Session()
        non_admin_session.headers.update({"Content-Type": "application/json"})
        
        # Try to access admin endpoint without auth
        response = non_admin_session.get(f"{BASE_URL}/api/admin/ai-drills")
        
        # Should return 401 (unauthorized) or 403 (forbidden)
        assert response.status_code in [401, 403], \
            f"Expected 401 or 403 for non-admin, got {response.status_code}"
        
        print(f"✓ Non-admin access correctly blocked with status {response.status_code}")


class TestCaseDrillsStats:
    """Test stats calculation for Case Drills"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_stats_accuracy(self):
        """Test that stats accurately reflect drill counts"""
        response = self.session.get(f"{BASE_URL}/api/admin/ai-drills")
        assert response.status_code == 200
        
        data = response.json()
        drills = data["drills"]
        stats = data["stats"]
        
        # Calculate expected stats
        case_math_count = len([d for d in drills if d["drill_type"] == "case_math"])
        case_structuring_count = len([d for d in drills if d["drill_type"] == "case_structuring"])
        case_math_free_count = len([d for d in drills if d["drill_type"] == "case_math" and d["is_free_trial"]])
        case_structuring_free_count = len([d for d in drills if d["drill_type"] == "case_structuring" and d["is_free_trial"]])
        
        # Verify stats match
        assert stats["case_math"] == case_math_count, \
            f"case_math stat mismatch: expected {case_math_count}, got {stats['case_math']}"
        assert stats["case_structuring"] == case_structuring_count, \
            f"case_structuring stat mismatch: expected {case_structuring_count}, got {stats['case_structuring']}"
        assert stats["case_math_free"] == case_math_free_count, \
            f"case_math_free stat mismatch: expected {case_math_free_count}, got {stats['case_math_free']}"
        assert stats["case_structuring_free"] == case_structuring_free_count, \
            f"case_structuring_free stat mismatch: expected {case_structuring_free_count}, got {stats['case_structuring_free']}"
        
        print(f"✓ Stats are accurate:")
        print(f"  Case Math: {case_math_count} total, {case_math_free_count} free")
        print(f"  Case Structuring: {case_structuring_count} total, {case_structuring_free_count} free")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
