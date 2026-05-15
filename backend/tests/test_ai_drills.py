"""
AI Drills API Tests
Tests for the Case Drills feature - pre-generated quiz questions for consulting interview practice
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDrillTypes:
    """Test drill types endpoint"""
    
    def test_get_drill_types(self):
        """GET /api/ai-drills/types - should return available drill types and difficulties"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/types")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check drill types
        assert "drill_types" in data
        drill_types = data["drill_types"]
        assert len(drill_types) == 3
        
        # Verify drill type IDs
        type_ids = [dt["id"] for dt in drill_types]
        assert "case_math" in type_ids
        assert "case_structuring" in type_ids
        assert "market_sizing" in type_ids
        
        # Check difficulties
        assert "difficulties" in data
        difficulties = data["difficulties"]
        assert len(difficulties) == 3
        
        # Verify difficulty time limits
        difficulty_map = {d["id"]: d["time_limit"] for d in difficulties}
        assert difficulty_map["beginner"] == 300  # 5 minutes
        assert difficulty_map["intermediate"] == 600  # 10 minutes
        assert difficulty_map["advanced"] == 900  # 15 minutes


class TestDrillGeneration:
    """Test drill generation endpoint - requires authentication"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        # Login with admin credentials
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "info@gradnext.co",
                "password": "KeiseiConsulting@2025"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return session
    
    def test_generate_case_math_beginner(self, auth_session):
        """POST /api/ai-drills/generate - Case Math Easy drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "drill_session_id" in data
        assert "drill_type" in data
        assert "difficulty" in data
        assert "questions" in data
        assert "time_limit" in data
        assert "total_questions" in data
        
        # Verify time limit for Easy (beginner) = 300 seconds (5 min)
        assert data["time_limit"] == 300
        
        # Verify questions
        assert len(data["questions"]) == 10
        
        # Verify question structure
        for q in data["questions"]:
            assert "id" in q
            assert "type" in q
            assert "question" in q
            assert q["type"] in ["multiple_choice", "text_input"]
    
    def test_generate_case_math_intermediate(self, auth_session):
        """POST /api/ai-drills/generate - Case Math Medium drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "intermediate"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify time limit for Medium (intermediate) = 600 seconds (10 min)
        assert data["time_limit"] == 600
        assert len(data["questions"]) == 10
    
    def test_generate_case_math_advanced(self, auth_session):
        """POST /api/ai-drills/generate - Case Math Hard drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "advanced"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify time limit for Hard (advanced) = 900 seconds (15 min)
        assert data["time_limit"] == 900
        assert len(data["questions"]) == 10
    
    def test_generate_case_structuring_beginner(self, auth_session):
        """POST /api/ai-drills/generate - Case Structuring Easy drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["time_limit"] == 300
        assert len(data["questions"]) == 10
    
    def test_generate_market_sizing_beginner(self, auth_session):
        """POST /api/ai-drills/generate - Market Sizing Easy drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "market_sizing", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["time_limit"] == 300
        assert len(data["questions"]) == 10
    
    def test_generate_invalid_drill_type(self, auth_session):
        """POST /api/ai-drills/generate - Invalid drill type should return 400"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "invalid_type", "difficulty": "beginner"}
        )
        assert response.status_code == 400
    
    def test_generate_invalid_difficulty(self, auth_session):
        """POST /api/ai-drills/generate - Invalid difficulty should return 400"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "invalid"}
        )
        assert response.status_code == 400
    
    def test_generate_without_auth(self):
        """POST /api/ai-drills/generate - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "beginner"}
        )
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403]


class TestDrillEvaluation:
    """Test drill answer evaluation endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "info@gradnext.co",
                "password": "KeiseiConsulting@2025"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return session
    
    def test_evaluate_multiple_choice_correct(self, auth_session):
        """POST /api/ai-drills/evaluate - Correct multiple choice answer"""
        question = {
            "id": "q1",
            "type": "multiple_choice",
            "question": "What is 20% of 100?",
            "options": ["10", "15", "20", "25"],
            "correct_answer": "20",
            "explanation": "20% of 100 = 0.20 × 100 = 20"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": "20",
                "drill_type": "case_math"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == True
        assert "correct_answer" in data
        assert "explanation" in data
    
    def test_evaluate_multiple_choice_incorrect(self, auth_session):
        """POST /api/ai-drills/evaluate - Incorrect multiple choice answer"""
        question = {
            "id": "q1",
            "type": "multiple_choice",
            "question": "What is 20% of 100?",
            "options": ["10", "15", "20", "25"],
            "correct_answer": "20",
            "explanation": "20% of 100 = 0.20 × 100 = 20"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": "15",
                "drill_type": "case_math"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == False
        assert data["correct_answer"] == "20"
    
    def test_evaluate_text_input_correct(self, auth_session):
        """POST /api/ai-drills/evaluate - Correct text input answer"""
        question = {
            "id": "q3",
            "type": "text_input",
            "question": "What is 500 × 20?",
            "acceptable_answers": ["$10,000", "10000", "$10000", "10,000"],
            "correct_answer": "$10,000",
            "explanation": "500 × 20 = 10,000"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": "10000",
                "drill_type": "case_math"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == True


class TestDrillCompletion:
    """Test drill completion endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "info@gradnext.co",
                "password": "KeiseiConsulting@2025"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return session
    
    def test_complete_drill_flow(self, auth_session):
        """Full drill flow: generate -> complete"""
        # Generate a drill
        gen_response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "beginner"}
        )
        assert gen_response.status_code == 200
        
        drill_data = gen_response.json()
        session_id = drill_data["drill_session_id"]
        
        # Complete the drill
        complete_response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/complete/{session_id}",
            json={
                "score": 8,
                "total": 10,
                "time_taken": 240
            }
        )
        assert complete_response.status_code == 200
        
        data = complete_response.json()
        assert data["score"] == 8
        assert data["total"] == 10
        assert data["percentage"] == 80
    
    def test_complete_invalid_session(self, auth_session):
        """POST /api/ai-drills/complete - Invalid session should return 404"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/complete/invalid-session-id",
            json={
                "score": 5,
                "total": 10,
                "time_taken": 300
            }
        )
        assert response.status_code == 404


class TestDrillHistory:
    """Test drill history endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "info@gradnext.co",
                "password": "KeiseiConsulting@2025"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return session
    
    def test_get_drill_history(self, auth_session):
        """GET /api/ai-drills/history - Should return user's drill history"""
        response = auth_session.get(f"{BASE_URL}/api/ai-drills/history")
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        
        # If there's history, verify structure
        if len(data["history"]) > 0:
            entry = data["history"][0]
            assert "drill_type" in entry
            assert "difficulty" in entry
            assert "score" in entry
            assert "total" in entry
    
    def test_history_without_auth(self):
        """GET /api/ai-drills/history - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/history")
        assert response.status_code in [401, 403]


class TestTimeLimits:
    """Verify time limits are correctly set based on difficulty"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "info@gradnext.co",
                "password": "KeiseiConsulting@2025"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return session
    
    def test_easy_time_limit_5_minutes(self, auth_session):
        """Easy (beginner) drills should have 5 minute (300s) time limit"""
        for drill_type in ["case_math", "case_structuring", "market_sizing"]:
            response = auth_session.post(
                f"{BASE_URL}/api/ai-drills/generate",
                json={"drill_type": drill_type, "difficulty": "beginner"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["time_limit"] == 300, f"Easy {drill_type} should have 300s time limit"
    
    def test_medium_time_limit_10_minutes(self, auth_session):
        """Medium (intermediate) drills should have 10 minute (600s) time limit"""
        for drill_type in ["case_math", "case_structuring", "market_sizing"]:
            response = auth_session.post(
                f"{BASE_URL}/api/ai-drills/generate",
                json={"drill_type": drill_type, "difficulty": "intermediate"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["time_limit"] == 600, f"Medium {drill_type} should have 600s time limit"
    
    def test_hard_time_limit_15_minutes(self, auth_session):
        """Hard (advanced) drills should have 15 minute (900s) time limit"""
        for drill_type in ["case_math", "case_structuring", "market_sizing"]:
            response = auth_session.post(
                f"{BASE_URL}/api/ai-drills/generate",
                json={"drill_type": drill_type, "difficulty": "advanced"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["time_limit"] == 900, f"Hard {drill_type} should have 900s time limit"
