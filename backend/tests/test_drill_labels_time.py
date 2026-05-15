"""
Test drill labels and time limits for all drill types
Verifies that /drill endpoint returns correct difficulty_label and time_limit
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDrillLabelsAndTime:
    """Test drill labels and time limits for all drill types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Use mock login session
        self.session.cookies.set("session_token", "session_df6b9795500a4da5b0ffd181d0d6b872")
    
    # Case Structuring Tests - Labels are swapped (Easy=advanced, Medium=beginner, Hard=intermediate)
    def test_case_structuring_easy_label_and_time(self):
        """Case Structuring Easy should have 'Easy' label and 5 min (300s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_structuring",
            "difficulty": "advanced"  # advanced = Easy for case_structuring
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Easy", f"Expected 'Easy', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 300, f"Expected 300s (5 min), got {data['time_limit']}s"
    
    def test_case_structuring_medium_label_and_time(self):
        """Case Structuring Medium should have 'Medium' label and 10 min (600s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_structuring",
            "difficulty": "beginner"  # beginner = Medium for case_structuring
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Medium", f"Expected 'Medium', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 600, f"Expected 600s (10 min), got {data['time_limit']}s"
    
    def test_case_structuring_hard_label_and_time(self):
        """Case Structuring Hard should have 'Hard' label and 15 min (900s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_structuring",
            "difficulty": "intermediate"  # intermediate = Hard for case_structuring
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Hard", f"Expected 'Hard', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 900, f"Expected 900s (15 min), got {data['time_limit']}s"
    
    # Case Math Tests - Normal labels (Easy=beginner, Medium=intermediate, Hard=advanced)
    def test_case_math_easy_label_and_time(self):
        """Case Math Easy should have 'Easy' label and 5 min (300s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_math",
            "difficulty": "beginner"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Easy", f"Expected 'Easy', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 300, f"Expected 300s (5 min), got {data['time_limit']}s"
    
    def test_case_math_medium_label_and_time(self):
        """Case Math Medium should have 'Medium' label and 10 min (600s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_math",
            "difficulty": "intermediate"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Medium", f"Expected 'Medium', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 600, f"Expected 600s (10 min), got {data['time_limit']}s"
    
    def test_case_math_hard_label_and_time(self):
        """Case Math Hard should have 'Hard' label and 15 min (900s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "case_math",
            "difficulty": "advanced"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Hard", f"Expected 'Hard', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 900, f"Expected 900s (15 min), got {data['time_limit']}s"
    
    # Charts & Exhibits Tests - Normal labels (Easy=beginner, Medium=intermediate, Hard=advanced)
    def test_charts_exhibits_easy_label_and_time(self):
        """Charts & Exhibits Easy should have 'Easy' label and 5 min (300s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "charts_exhibits",
            "difficulty": "beginner"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Easy", f"Expected 'Easy', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 300, f"Expected 300s (5 min), got {data['time_limit']}s"
    
    def test_charts_exhibits_medium_label_and_time(self):
        """Charts & Exhibits Medium should have 'Medium' label and 10 min (600s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "charts_exhibits",
            "difficulty": "intermediate"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Medium", f"Expected 'Medium', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 600, f"Expected 600s (10 min), got {data['time_limit']}s"
    
    def test_charts_exhibits_hard_label_and_time(self):
        """Charts & Exhibits Hard should have 'Hard' label and 15 min (900s) time"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "charts_exhibits",
            "difficulty": "advanced"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["difficulty_label"] == "Hard", f"Expected 'Hard', got '{data['difficulty_label']}'"
        assert data["time_limit"] == 900, f"Expected 900s (15 min), got {data['time_limit']}s"
    
    # Charts & Exhibits Hard Drills (ce-h-1 to ce-h-10) - Specific drill tests
    @pytest.mark.parametrize("drill_id", [f"ce-h-{i}" for i in range(1, 11)])
    def test_charts_exhibits_hard_drills_load(self, drill_id):
        """Charts & Exhibits Hard drills (ce-h-1 to ce-h-10) should load without error"""
        response = self.session.post(f"{BASE_URL}/api/ai-drills/generate", json={
            "drill_type": "charts_exhibits",
            "difficulty": "advanced",
            "drill_id": drill_id
        })
        assert response.status_code == 200, f"Drill {drill_id} failed to load: {response.text}"
        data = response.json()
        assert data["drill_id"] == drill_id
        assert data["difficulty_label"] == "Hard"
        assert data["time_limit"] == 900
        assert len(data["questions"]) > 0, f"Drill {drill_id} has no questions"
