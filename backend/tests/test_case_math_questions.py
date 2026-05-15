"""
Case Math Questions Verification Tests
Tests to verify all case_math questions have proper answers, explanations, and correct_index alignment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Import the pre-generated drills directly for validation
import sys
sys.path.insert(0, '/app/backend')
from routes.ai_drills import PRE_GENERATED_DRILLS, TIME_LIMITS


class TestTimeLimits:
    """Verify time limits are correctly configured"""
    
    def test_beginner_time_limit(self):
        """Beginner (Easy) should have 300 seconds (5 minutes)"""
        assert TIME_LIMITS["beginner"] == 300
    
    def test_intermediate_time_limit(self):
        """Intermediate (Medium) should have 600 seconds (10 minutes)"""
        assert TIME_LIMITS["intermediate"] == 600
    
    def test_advanced_time_limit(self):
        """Advanced (Hard) should have 900 seconds (15 minutes)"""
        assert TIME_LIMITS["advanced"] == 900


class TestCaseMathBeginnerQuestions:
    """Verify all 10 beginner case_math questions have proper structure"""
    
    @pytest.fixture
    def beginner_questions(self):
        """Get beginner case_math questions"""
        return PRE_GENERATED_DRILLS["case_math"]["beginner"][0]["questions"]
    
    def test_has_10_questions(self, beginner_questions):
        """Should have exactly 10 questions"""
        assert len(beginner_questions) == 10
    
    def test_all_questions_have_required_fields(self, beginner_questions):
        """All questions should have id, type, question, correct_answer, explanation"""
        for i, q in enumerate(beginner_questions):
            assert "id" in q, f"Question {i+1} missing 'id'"
            assert "type" in q, f"Question {i+1} missing 'type'"
            assert "question" in q, f"Question {i+1} missing 'question'"
            assert "correct_answer" in q, f"Question {i+1} missing 'correct_answer'"
            assert "explanation" in q, f"Question {i+1} missing 'explanation'"
    
    def test_multiple_choice_correct_index_matches_answer(self, beginner_questions):
        """For multiple choice, correct_index should match position of correct_answer in options"""
        for i, q in enumerate(beginner_questions):
            if q["type"] == "multiple_choice":
                assert "options" in q, f"Question {i+1} missing 'options'"
                assert "correct_index" in q, f"Question {i+1} missing 'correct_index'"
                
                correct_idx = q["correct_index"]
                correct_ans = q["correct_answer"]
                
                assert 0 <= correct_idx < len(q["options"]), f"Question {i+1}: correct_index {correct_idx} out of range"
                assert q["options"][correct_idx] == correct_ans, \
                    f"Question {i+1}: options[{correct_idx}]='{q['options'][correct_idx]}' != correct_answer='{correct_ans}'"
    
    def test_text_input_has_acceptable_answers(self, beginner_questions):
        """Text input questions should have acceptable_answers list"""
        for i, q in enumerate(beginner_questions):
            if q["type"] == "text_input":
                assert "acceptable_answers" in q, f"Question {i+1} missing 'acceptable_answers'"
                assert len(q["acceptable_answers"]) > 0, f"Question {i+1} has empty acceptable_answers"
    
    def test_explanations_not_empty(self, beginner_questions):
        """All explanations should be non-empty"""
        for i, q in enumerate(beginner_questions):
            assert len(q["explanation"]) > 10, f"Question {i+1} has too short explanation"
    
    def test_questions_have_case_context(self, beginner_questions):
        """Questions should have case interview context (not just direct calculations)"""
        context_keywords = ["client", "company", "startup", "firm", "business", "retail", "SaaS", 
                          "manufacturer", "e-commerce", "telecom", "consulting", "market"]
        for i, q in enumerate(beginner_questions):
            question_text = q["question"].lower()
            has_context = any(keyword.lower() in question_text for keyword in context_keywords)
            assert has_context, f"Question {i+1} lacks case context: {q['question'][:50]}..."


class TestCaseMathIntermediateQuestions:
    """Verify all 10 intermediate case_math questions have proper structure"""
    
    @pytest.fixture
    def intermediate_questions(self):
        """Get intermediate case_math questions"""
        return PRE_GENERATED_DRILLS["case_math"]["intermediate"][0]["questions"]
    
    def test_has_10_questions(self, intermediate_questions):
        """Should have exactly 10 questions"""
        assert len(intermediate_questions) == 10
    
    def test_all_questions_have_required_fields(self, intermediate_questions):
        """All questions should have id, type, question, correct_answer, explanation"""
        for i, q in enumerate(intermediate_questions):
            assert "id" in q, f"Question {i+1} missing 'id'"
            assert "type" in q, f"Question {i+1} missing 'type'"
            assert "question" in q, f"Question {i+1} missing 'question'"
            assert "correct_answer" in q, f"Question {i+1} missing 'correct_answer'"
            assert "explanation" in q, f"Question {i+1} missing 'explanation'"
    
    def test_multiple_choice_correct_index_matches_answer(self, intermediate_questions):
        """For multiple choice, correct_index should match position of correct_answer in options"""
        for i, q in enumerate(intermediate_questions):
            if q["type"] == "multiple_choice":
                assert "options" in q, f"Question {i+1} missing 'options'"
                assert "correct_index" in q, f"Question {i+1} missing 'correct_index'"
                
                correct_idx = q["correct_index"]
                correct_ans = q["correct_answer"]
                
                assert 0 <= correct_idx < len(q["options"]), f"Question {i+1}: correct_index {correct_idx} out of range"
                assert q["options"][correct_idx] == correct_ans, \
                    f"Question {i+1}: options[{correct_idx}]='{q['options'][correct_idx]}' != correct_answer='{correct_ans}'"
    
    def test_text_input_has_acceptable_answers(self, intermediate_questions):
        """Text input questions should have acceptable_answers list"""
        for i, q in enumerate(intermediate_questions):
            if q["type"] == "text_input":
                assert "acceptable_answers" in q, f"Question {i+1} missing 'acceptable_answers'"
                assert len(q["acceptable_answers"]) > 0, f"Question {i+1} has empty acceptable_answers"
    
    def test_explanations_not_empty(self, intermediate_questions):
        """All explanations should be non-empty"""
        for i, q in enumerate(intermediate_questions):
            assert len(q["explanation"]) > 10, f"Question {i+1} has too short explanation"


class TestCaseMathAdvancedQuestions:
    """Verify all 10 advanced case_math questions have proper structure"""
    
    @pytest.fixture
    def advanced_questions(self):
        """Get advanced case_math questions"""
        return PRE_GENERATED_DRILLS["case_math"]["advanced"][0]["questions"]
    
    def test_has_10_questions(self, advanced_questions):
        """Should have exactly 10 questions"""
        assert len(advanced_questions) == 10
    
    def test_all_questions_have_required_fields(self, advanced_questions):
        """All questions should have id, type, question, correct_answer, explanation"""
        for i, q in enumerate(advanced_questions):
            assert "id" in q, f"Question {i+1} missing 'id'"
            assert "type" in q, f"Question {i+1} missing 'type'"
            assert "question" in q, f"Question {i+1} missing 'question'"
            assert "correct_answer" in q, f"Question {i+1} missing 'correct_answer'"
            assert "explanation" in q, f"Question {i+1} missing 'explanation'"
    
    def test_multiple_choice_correct_index_matches_answer(self, advanced_questions):
        """For multiple choice, correct_index should match position of correct_answer in options"""
        for i, q in enumerate(advanced_questions):
            if q["type"] == "multiple_choice":
                assert "options" in q, f"Question {i+1} missing 'options'"
                assert "correct_index" in q, f"Question {i+1} missing 'correct_index'"
                
                correct_idx = q["correct_index"]
                correct_ans = q["correct_answer"]
                
                assert 0 <= correct_idx < len(q["options"]), f"Question {i+1}: correct_index {correct_idx} out of range"
                assert q["options"][correct_idx] == correct_ans, \
                    f"Question {i+1}: options[{correct_idx}]='{q['options'][correct_idx]}' != correct_answer='{correct_ans}'"
    
    def test_text_input_has_acceptable_answers(self, advanced_questions):
        """Text input questions should have acceptable_answers list"""
        for i, q in enumerate(advanced_questions):
            if q["type"] == "text_input":
                assert "acceptable_answers" in q, f"Question {i+1} missing 'acceptable_answers'"
                assert len(q["acceptable_answers"]) > 0, f"Question {i+1} has empty acceptable_answers"
    
    def test_explanations_not_empty(self, advanced_questions):
        """All explanations should be non-empty"""
        for i, q in enumerate(advanced_questions):
            assert len(q["explanation"]) > 10, f"Question {i+1} has too short explanation"


class TestAPITimeLimits:
    """Test time limits via API endpoints"""
    
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
    
    def test_api_beginner_time_limit(self, auth_session):
        """API should return 300s for beginner difficulty"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 300
    
    def test_api_intermediate_time_limit(self, auth_session):
        """API should return 600s for intermediate difficulty"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "intermediate"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 600
    
    def test_api_advanced_time_limit(self, auth_session):
        """API should return 900s for advanced difficulty"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "advanced"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 900


class TestAPIQuestionCount:
    """Test question counts via API"""
    
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
    
    def test_api_beginner_has_10_questions(self, auth_session):
        """API should return 10 questions for beginner"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["questions"]) == 10
        assert data["total_questions"] == 10
    
    def test_api_intermediate_has_10_questions(self, auth_session):
        """API should return 10 questions for intermediate"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "intermediate"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["questions"]) == 10
        assert data["total_questions"] == 10
    
    def test_api_advanced_has_10_questions(self, auth_session):
        """API should return 10 questions for advanced"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_math", "difficulty": "advanced"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["questions"]) == 10
        assert data["total_questions"] == 10


class TestDrillTypesEndpoint:
    """Test the /api/ai-drills/types endpoint"""
    
    def test_types_endpoint_returns_correct_time_limits(self):
        """GET /api/ai-drills/types should return correct time limits"""
        response = requests.get(f"{BASE_URL}/api/ai-drills/types")
        assert response.status_code == 200
        
        data = response.json()
        difficulties = {d["id"]: d["time_limit"] for d in data["difficulties"]}
        
        assert difficulties["beginner"] == 300
        assert difficulties["intermediate"] == 600
        assert difficulties["advanced"] == 900
