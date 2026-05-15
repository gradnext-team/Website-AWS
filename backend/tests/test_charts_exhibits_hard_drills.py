"""
Test Charts & Exhibits Hard Drills Addition
Verifies that:
1. Charts & Exhibits now has 30 drills (10 Easy, 10 Medium, 10 Hard)
2. All drill types follow consistent time-based labeling
3. Time limits match: Easy=5min(300s), Medium=10min(600s), Hard=15min(900s)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestChartsExhibitsHardDrills:
    """Test Charts & Exhibits Hard drills addition"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for API calls"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mock-login",
            json={"user_type": "full_prep"}
        )
        assert response.status_code == 200, f"Mock login failed: {response.text}"
        self.token = response.json().get("auth_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_total_drills_count(self):
        """Verify total drills is 74"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 74, f"Expected 74 total drills, got {data['total']}"
        print(f"✓ Total drills: {data['total']}")
    
    def test_case_math_count(self):
        """Verify Case Math has 24 drills"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        case_math = [d for d in drills if d["drill_type"] == "case_math"]
        assert len(case_math) == 24, f"Expected 24 Case Math drills, got {len(case_math)}"
        print(f"✓ Case Math drills: {len(case_math)}")
    
    def test_case_structuring_count(self):
        """Verify Case Structuring has 20 drills"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        case_structuring = [d for d in drills if d["drill_type"] == "case_structuring"]
        assert len(case_structuring) == 20, f"Expected 20 Case Structuring drills, got {len(case_structuring)}"
        print(f"✓ Case Structuring drills: {len(case_structuring)}")
    
    def test_charts_exhibits_total_count(self):
        """Verify Charts & Exhibits has 30 drills (was 20, now 30 with Hard added)"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        charts_exhibits = [d for d in drills if d["drill_type"] == "charts_exhibits"]
        assert len(charts_exhibits) == 30, f"Expected 30 Charts & Exhibits drills, got {len(charts_exhibits)}"
        print(f"✓ Charts & Exhibits drills: {len(charts_exhibits)}")
    
    def test_charts_exhibits_easy_count(self):
        """Verify Charts & Exhibits has 10 Easy drills"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        easy = [d for d in drills if d["drill_type"] == "charts_exhibits" and d["difficulty_label"] == "Easy"]
        assert len(easy) == 10, f"Expected 10 Easy Charts & Exhibits drills, got {len(easy)}"
        print(f"✓ Charts & Exhibits Easy drills: {len(easy)}")
    
    def test_charts_exhibits_medium_count(self):
        """Verify Charts & Exhibits has 10 Medium drills"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        medium = [d for d in drills if d["drill_type"] == "charts_exhibits" and d["difficulty_label"] == "Medium"]
        assert len(medium) == 10, f"Expected 10 Medium Charts & Exhibits drills, got {len(medium)}"
        print(f"✓ Charts & Exhibits Medium drills: {len(medium)}")
    
    def test_charts_exhibits_hard_count(self):
        """Verify Charts & Exhibits has 10 Hard drills (NEW)"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        hard = [d for d in drills if d["drill_type"] == "charts_exhibits" and d["difficulty_label"] == "Hard"]
        assert len(hard) == 10, f"Expected 10 Hard Charts & Exhibits drills, got {len(hard)}"
        print(f"✓ Charts & Exhibits Hard drills: {len(hard)}")
    
    def test_charts_exhibits_hard_time_limit(self):
        """Verify Charts & Exhibits Hard drills have 15 min (900s) time limit"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        hard = [d for d in drills if d["drill_type"] == "charts_exhibits" and d["difficulty_label"] == "Hard"]
        for drill in hard:
            assert drill["time_limit"] == 900, f"Expected 900s time limit for Hard drill {drill['id']}, got {drill['time_limit']}"
        print(f"✓ All Charts & Exhibits Hard drills have 900s (15 min) time limit")
    
    def test_case_math_time_labels(self):
        """Verify Case Math follows: Easy=5min, Medium=10min, Hard=15min"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        case_math = [d for d in drills if d["drill_type"] == "case_math"]
        
        for drill in case_math:
            if drill["difficulty_label"] == "Easy":
                assert drill["time_limit"] == 300, f"Easy should be 300s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Medium":
                assert drill["time_limit"] == 600, f"Medium should be 600s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Hard":
                assert drill["time_limit"] == 900, f"Hard should be 900s, got {drill['time_limit']}"
        print("✓ Case Math time labels correct: Easy=5min, Medium=10min, Hard=15min")
    
    def test_case_structuring_time_labels(self):
        """Verify Case Structuring follows: Easy=5min, Medium=10min, Hard=15min"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        case_structuring = [d for d in drills if d["drill_type"] == "case_structuring"]
        
        for drill in case_structuring:
            if drill["difficulty_label"] == "Easy":
                assert drill["time_limit"] == 300, f"Easy should be 300s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Medium":
                assert drill["time_limit"] == 600, f"Medium should be 600s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Hard":
                assert drill["time_limit"] == 900, f"Hard should be 900s, got {drill['time_limit']}"
        print("✓ Case Structuring time labels correct: Easy=5min, Medium=10min, Hard=15min")
    
    def test_charts_exhibits_time_labels(self):
        """Verify Charts & Exhibits follows: Easy=5min, Medium=10min, Hard=15min"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        charts_exhibits = [d for d in drills if d["drill_type"] == "charts_exhibits"]
        
        for drill in charts_exhibits:
            if drill["difficulty_label"] == "Easy":
                assert drill["time_limit"] == 300, f"Easy should be 300s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Medium":
                assert drill["time_limit"] == 600, f"Medium should be 600s, got {drill['time_limit']}"
            elif drill["difficulty_label"] == "Hard":
                assert drill["time_limit"] == 900, f"Hard should be 900s, got {drill['time_limit']}"
        print("✓ Charts & Exhibits time labels correct: Easy=5min, Medium=10min, Hard=15min")
    
    def test_charts_exhibits_hard_drill_ids(self):
        """Verify Charts & Exhibits Hard drills have correct IDs (ce-h-1 to ce-h-10)"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/list", headers=self.headers)
        assert response.status_code == 200
        drills = response.json()["drills"]
        hard = [d for d in drills if d["drill_type"] == "charts_exhibits" and d["difficulty_label"] == "Hard"]
        
        hard_ids = [d["id"] for d in hard]
        expected_ids = [f"ce-h-{i}" for i in range(1, 11)]
        
        for expected_id in expected_ids:
            assert expected_id in hard_ids, f"Missing Hard drill ID: {expected_id}"
        print(f"✓ All Charts & Exhibits Hard drill IDs present: ce-h-1 to ce-h-10")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
