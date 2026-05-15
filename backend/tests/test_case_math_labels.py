"""
Test Case Math Drill Labels Fix
Verifies that Case Math drills have correct difficulty labels (normal mapping)
while Case Structuring keeps swapped labels.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDrillDifficultyLabels:
    """Test drill difficulty labels are correct per drill type"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for authenticated requests"""
        self.session = requests.Session()
        # Login as full_prep user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=full_prep",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        print(f"Logged in as: {self.user.get('name')} ({self.user.get('email')})")
    
    def test_drills_list_endpoint_returns_data(self):
        """Test that drills list endpoint returns drills"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200, f"Failed to get drills: {response.text}"
        
        data = response.json()
        assert "drills" in data, "Response missing 'drills' key"
        assert len(data["drills"]) > 0, "No drills returned"
        print(f"Total drills returned: {len(data['drills'])}")
    
    def test_case_math_beginner_has_easy_label(self):
        """Case Math beginner difficulty should have 'Easy' label"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        case_math_beginner = [d for d in drills if d["drill_type"] == "case_math" and d["difficulty"] == "beginner"]
        
        assert len(case_math_beginner) > 0, "No Case Math beginner drills found"
        
        for drill in case_math_beginner:
            assert drill["difficulty_label"] == "Easy", \
                f"Case Math beginner drill '{drill['name']}' has wrong label: {drill['difficulty_label']}"
            assert drill["time_limit"] == 300, \
                f"Case Math beginner drill '{drill['name']}' has wrong time: {drill['time_limit']} (expected 300)"
        
        print(f"✓ All {len(case_math_beginner)} Case Math beginner drills have 'Easy' label and 5 min time")
    
    def test_case_math_intermediate_has_medium_label(self):
        """Case Math intermediate difficulty should have 'Medium' label"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        case_math_intermediate = [d for d in drills if d["drill_type"] == "case_math" and d["difficulty"] == "intermediate"]
        
        assert len(case_math_intermediate) > 0, "No Case Math intermediate drills found"
        
        for drill in case_math_intermediate:
            assert drill["difficulty_label"] == "Medium", \
                f"Case Math intermediate drill '{drill['name']}' has wrong label: {drill['difficulty_label']}"
            assert drill["time_limit"] == 600, \
                f"Case Math intermediate drill '{drill['name']}' has wrong time: {drill['time_limit']} (expected 600)"
        
        print(f"✓ All {len(case_math_intermediate)} Case Math intermediate drills have 'Medium' label and 10 min time")
    
    def test_case_math_advanced_has_hard_label(self):
        """Case Math advanced difficulty should have 'Hard' label"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        case_math_advanced = [d for d in drills if d["drill_type"] == "case_math" and d["difficulty"] == "advanced"]
        
        assert len(case_math_advanced) > 0, "No Case Math advanced drills found"
        
        for drill in case_math_advanced:
            assert drill["difficulty_label"] == "Hard", \
                f"Case Math advanced drill '{drill['name']}' has wrong label: {drill['difficulty_label']}"
            assert drill["time_limit"] == 900, \
                f"Case Math advanced drill '{drill['name']}' has wrong time: {drill['time_limit']} (expected 900)"
        
        print(f"✓ All {len(case_math_advanced)} Case Math advanced drills have 'Hard' label and 15 min time")
    
    def test_case_structuring_has_swapped_labels(self):
        """Case Structuring should have swapped labels (advanced=Easy, beginner=Medium, intermediate=Hard)"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        case_structuring = [d for d in drills if d["drill_type"] == "case_structuring"]
        
        assert len(case_structuring) > 0, "No Case Structuring drills found"
        
        # Check swapped mappings
        for drill in case_structuring:
            if drill["difficulty"] == "advanced":
                assert drill["difficulty_label"] == "Easy", \
                    f"Case Structuring advanced drill should have 'Easy' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 300, \
                    f"Case Structuring advanced drill should have 5 min time, got: {drill['time_limit']}"
            elif drill["difficulty"] == "beginner":
                assert drill["difficulty_label"] == "Medium", \
                    f"Case Structuring beginner drill should have 'Medium' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 600, \
                    f"Case Structuring beginner drill should have 10 min time, got: {drill['time_limit']}"
            elif drill["difficulty"] == "intermediate":
                assert drill["difficulty_label"] == "Hard", \
                    f"Case Structuring intermediate drill should have 'Hard' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 900, \
                    f"Case Structuring intermediate drill should have 15 min time, got: {drill['time_limit']}"
        
        print(f"✓ All {len(case_structuring)} Case Structuring drills have correct swapped labels")
    
    def test_charts_exhibits_has_normal_labels(self):
        """Charts & Exhibits should have normal labels (beginner=Easy, intermediate=Medium)"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        charts_exhibits = [d for d in drills if d["drill_type"] == "charts_exhibits"]
        
        assert len(charts_exhibits) > 0, "No Charts & Exhibits drills found"
        
        for drill in charts_exhibits:
            if drill["difficulty"] == "beginner":
                assert drill["difficulty_label"] == "Easy", \
                    f"Charts & Exhibits beginner drill should have 'Easy' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 300, \
                    f"Charts & Exhibits beginner drill should have 5 min time, got: {drill['time_limit']}"
            elif drill["difficulty"] == "intermediate":
                assert drill["difficulty_label"] == "Medium", \
                    f"Charts & Exhibits intermediate drill should have 'Medium' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 600, \
                    f"Charts & Exhibits intermediate drill should have 10 min time, got: {drill['time_limit']}"
            elif drill["difficulty"] == "advanced":
                assert drill["difficulty_label"] == "Hard", \
                    f"Charts & Exhibits advanced drill should have 'Hard' label, got: {drill['difficulty_label']}"
                assert drill["time_limit"] == 900, \
                    f"Charts & Exhibits advanced drill should have 15 min time, got: {drill['time_limit']}"
        
        print(f"✓ All {len(charts_exhibits)} Charts & Exhibits drills have correct normal labels")
    
    def test_drill_counts_per_type(self):
        """Verify expected drill counts per type"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        drills = response.json()["drills"]
        
        # Count by type
        counts = {}
        for drill in drills:
            dt = drill["drill_type"]
            counts[dt] = counts.get(dt, 0) + 1
        
        print(f"Drill counts: {counts}")
        
        # Verify Case Math has 24 drills (8 per difficulty)
        assert counts.get("case_math", 0) == 24, f"Expected 24 Case Math drills, got {counts.get('case_math', 0)}"
        
        # Verify Case Structuring has 20 drills
        assert counts.get("case_structuring", 0) == 20, f"Expected 20 Case Structuring drills, got {counts.get('case_structuring', 0)}"
        
        # Verify Charts & Exhibits has 20 drills
        assert counts.get("charts_exhibits", 0) == 20, f"Expected 20 Charts & Exhibits drills, got {counts.get('charts_exhibits', 0)}"
        
        print("✓ All drill type counts are correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
