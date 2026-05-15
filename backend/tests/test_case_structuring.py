"""
Case Structuring Questions Tests
Tests for case_structuring drill type with MECE focus, case contexts, and multi-select questions
"""
import pytest
import requests
import os
import sys

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Import the pre-generated drills directly for validation
sys.path.insert(0, '/app/backend')
from routes.ai_drills import PRE_GENERATED_DRILLS, TIME_LIMITS


class TestCaseStructuringQuestionStructure:
    """Verify case_structuring questions have proper structure"""
    
    @pytest.fixture
    def beginner_questions(self):
        """Get beginner case_structuring questions"""
        return PRE_GENERATED_DRILLS["case_structuring"]["beginner"][0]["questions"]
    
    @pytest.fixture
    def intermediate_questions(self):
        """Get intermediate case_structuring questions"""
        return PRE_GENERATED_DRILLS["case_structuring"]["intermediate"][0]["questions"]
    
    @pytest.fixture
    def advanced_questions(self):
        """Get advanced case_structuring questions"""
        return PRE_GENERATED_DRILLS["case_structuring"]["advanced"][0]["questions"]
    
    def test_beginner_has_10_questions(self, beginner_questions):
        """Beginner should have exactly 10 questions"""
        assert len(beginner_questions) == 10
    
    def test_intermediate_has_10_questions(self, intermediate_questions):
        """Intermediate should have exactly 10 questions"""
        assert len(intermediate_questions) == 10
    
    def test_advanced_has_10_questions(self, advanced_questions):
        """Advanced should have exactly 10 questions"""
        assert len(advanced_questions) == 10


class TestCaseStructuringCaseContext:
    """Verify case_structuring questions have case context"""
    
    @pytest.fixture
    def all_questions(self):
        """Get all case_structuring questions"""
        questions = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            questions.extend(PRE_GENERATED_DRILLS["case_structuring"][difficulty][0]["questions"])
        return questions
    
    def test_all_questions_have_case_context(self, all_questions):
        """All questions should start with 'Case:' to provide context"""
        for i, q in enumerate(all_questions):
            question_text = q["question"]
            assert question_text.startswith("Case:"), \
                f"Question {i+1} should start with 'Case:': {question_text[:50]}..."


class TestCaseStructuringMECEFocus:
    """Verify case_structuring questions focus on MECE structuring"""
    
    @pytest.fixture
    def all_questions(self):
        """Get all case_structuring questions"""
        questions = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            questions.extend(PRE_GENERATED_DRILLS["case_structuring"][difficulty][0]["questions"])
        return questions
    
    def test_questions_focus_on_structuring(self, all_questions):
        """Questions should ask about structuring, not conceptual framework questions"""
        structuring_keywords = ["structure", "breakdown", "MECE", "buckets", "diagnostic", 
                               "analysis", "first level", "second level", "levers", "evaluate"]
        for i, q in enumerate(all_questions):
            question_text = q["question"].lower()
            has_structuring_focus = any(keyword.lower() in question_text for keyword in structuring_keywords)
            assert has_structuring_focus, \
                f"Question {i+1} should focus on structuring: {q['question'][:80]}..."
    
    def test_explanations_mention_mece(self, all_questions):
        """Explanations should reference MECE principles"""
        mece_keywords = ["MECE", "mutually exclusive", "collectively exhaustive", "overlap", 
                        "comprehensive", "without overlap", "covers all"]
        mece_count = 0
        for q in all_questions:
            explanation = q.get("explanation", "").lower()
            if any(keyword.lower() in explanation for keyword in mece_keywords):
                mece_count += 1
        # At least 50% of explanations should mention MECE concepts
        assert mece_count >= len(all_questions) * 0.5, \
            f"Only {mece_count}/{len(all_questions)} explanations mention MECE concepts"


class TestMultiSelectQuestions:
    """Verify multi_select questions have correct structure"""
    
    @pytest.fixture
    def all_questions(self):
        """Get all case_structuring questions"""
        questions = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            questions.extend(PRE_GENERATED_DRILLS["case_structuring"][difficulty][0]["questions"])
        return questions
    
    def test_multi_select_questions_exist(self, all_questions):
        """There should be multi_select questions in case_structuring"""
        multi_select_count = sum(1 for q in all_questions if q.get("type") == "multi_select")
        assert multi_select_count > 0, "No multi_select questions found in case_structuring"
        print(f"Found {multi_select_count} multi_select questions")
    
    def test_multi_select_has_correct_answers_array(self, all_questions):
        """Multi-select questions should have correct_answers array with indices"""
        for i, q in enumerate(all_questions):
            if q.get("type") == "multi_select":
                assert "correct_answers" in q, \
                    f"Multi-select question {i+1} missing 'correct_answers' array"
                assert isinstance(q["correct_answers"], list), \
                    f"Multi-select question {i+1} 'correct_answers' should be a list"
                assert len(q["correct_answers"]) > 0, \
                    f"Multi-select question {i+1} 'correct_answers' should not be empty"
                
                # Verify indices are valid
                for idx in q["correct_answers"]:
                    assert isinstance(idx, int), \
                        f"Multi-select question {i+1} correct_answers should contain integers"
                    assert 0 <= idx < len(q["options"]), \
                        f"Multi-select question {i+1} has invalid index {idx} for {len(q['options'])} options"
    
    def test_multi_select_has_options(self, all_questions):
        """Multi-select questions should have options array"""
        for i, q in enumerate(all_questions):
            if q.get("type") == "multi_select":
                assert "options" in q, f"Multi-select question {i+1} missing 'options'"
                assert len(q["options"]) >= 3, \
                    f"Multi-select question {i+1} should have at least 3 options"


class TestMultipleChoiceQuestions:
    """Verify multiple_choice questions have correct structure"""
    
    @pytest.fixture
    def all_questions(self):
        """Get all case_structuring questions"""
        questions = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            questions.extend(PRE_GENERATED_DRILLS["case_structuring"][difficulty][0]["questions"])
        return questions
    
    def test_multiple_choice_correct_index_matches_answer(self, all_questions):
        """For multiple choice, correct_index should match position of correct_answer in options"""
        for i, q in enumerate(all_questions):
            if q.get("type") == "multiple_choice":
                assert "options" in q, f"Question {i+1} missing 'options'"
                assert "correct_index" in q, f"Question {i+1} missing 'correct_index'"
                
                correct_idx = q["correct_index"]
                correct_ans = q["correct_answer"]
                
                assert 0 <= correct_idx < len(q["options"]), \
                    f"Question {i+1}: correct_index {correct_idx} out of range"
                assert q["options"][correct_idx] == correct_ans, \
                    f"Question {i+1}: options[{correct_idx}]='{q['options'][correct_idx]}' != correct_answer='{correct_ans}'"


class TestCaseStructuringAPIGenerate:
    """Test case_structuring drill generation via API"""
    
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
    
    def test_generate_case_structuring_beginner(self, auth_session):
        """POST /api/ai-drills/generate - Case Structuring Easy drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "drill_session_id" in data
        assert "questions" in data
        assert "time_limit" in data
        
        # Verify time limit for Easy (beginner) = 300 seconds (5 min)
        assert data["time_limit"] == 300
        
        # Verify 10 questions
        assert len(data["questions"]) == 10
        
        # Verify questions have case context
        for q in data["questions"]:
            assert q["question"].startswith("Case:"), \
                f"Question should start with 'Case:': {q['question'][:50]}..."
    
    def test_generate_case_structuring_intermediate(self, auth_session):
        """POST /api/ai-drills/generate - Case Structuring Medium drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "intermediate"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify time limit for Medium (intermediate) = 600 seconds (10 min)
        assert data["time_limit"] == 600
        assert len(data["questions"]) == 10
    
    def test_generate_case_structuring_advanced(self, auth_session):
        """POST /api/ai-drills/generate - Case Structuring Hard drill"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "advanced"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify time limit for Hard (advanced) = 900 seconds (15 min)
        assert data["time_limit"] == 900
        assert len(data["questions"]) == 10
    
    def test_case_structuring_has_multi_select_questions(self, auth_session):
        """Case structuring drills should include multi_select questions"""
        # Check all difficulties
        multi_select_found = False
        for difficulty in ["beginner", "intermediate", "advanced"]:
            response = auth_session.post(
                f"{BASE_URL}/api/ai-drills/generate",
                json={"drill_type": "case_structuring", "difficulty": difficulty}
            )
            assert response.status_code == 200
            
            data = response.json()
            for q in data["questions"]:
                if q.get("type") == "multi_select":
                    multi_select_found = True
                    # Verify multi_select structure
                    assert "correct_answers" in q, "Multi-select should have correct_answers"
                    assert isinstance(q["correct_answers"], list), "correct_answers should be a list"
                    break
            if multi_select_found:
                break
        
        assert multi_select_found, "No multi_select questions found in case_structuring drills"


class TestMultiSelectEvaluation:
    """Test multi_select question evaluation via API"""
    
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
    
    def test_evaluate_multi_select_correct(self, auth_session):
        """POST /api/ai-drills/evaluate - Correct multi-select answer"""
        question = {
            "id": "q3",
            "type": "multi_select",
            "question": "Case: A furniture manufacturer's margins are shrinking. To analyze their Cost structure, which buckets are MECE? (Select all that apply)",
            "options": ["Fixed Costs", "Variable Costs", "Semi-variable Costs", "Direct Costs", "Indirect Costs"],
            "correct_answers": [0, 1],
            "correct_answer": "Fixed Costs, Variable Costs",
            "explanation": "Fixed + Variable is the cleanest MECE split for costs."
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": [0, 1],  # Correct indices
                "drill_type": "case_structuring"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == True
        assert "correct_answer" in data
        assert "explanation" in data
    
    def test_evaluate_multi_select_incorrect(self, auth_session):
        """POST /api/ai-drills/evaluate - Incorrect multi-select answer"""
        question = {
            "id": "q3",
            "type": "multi_select",
            "question": "Case: A furniture manufacturer's margins are shrinking. To analyze their Cost structure, which buckets are MECE? (Select all that apply)",
            "options": ["Fixed Costs", "Variable Costs", "Semi-variable Costs", "Direct Costs", "Indirect Costs"],
            "correct_answers": [0, 1],
            "correct_answer": "Fixed Costs, Variable Costs",
            "explanation": "Fixed + Variable is the cleanest MECE split for costs."
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": [0, 2],  # Wrong - includes Semi-variable instead of Variable
                "drill_type": "case_structuring"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == False
        assert "Fixed Costs" in data["correct_answer"]
        assert "Variable Costs" in data["correct_answer"]
    
    def test_evaluate_multi_select_partial(self, auth_session):
        """POST /api/ai-drills/evaluate - Partial multi-select answer (should be incorrect)"""
        question = {
            "id": "q3",
            "type": "multi_select",
            "question": "Case: A furniture manufacturer's margins are shrinking. To analyze their Cost structure, which buckets are MECE? (Select all that apply)",
            "options": ["Fixed Costs", "Variable Costs", "Semi-variable Costs", "Direct Costs", "Indirect Costs"],
            "correct_answers": [0, 1],
            "correct_answer": "Fixed Costs, Variable Costs",
            "explanation": "Fixed + Variable is the cleanest MECE split for costs."
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": [0],  # Only selected Fixed Costs, missing Variable Costs
                "drill_type": "case_structuring"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == False  # Partial answer should be incorrect
    
    def test_evaluate_multi_select_empty(self, auth_session):
        """POST /api/ai-drills/evaluate - Empty multi-select answer"""
        question = {
            "id": "q3",
            "type": "multi_select",
            "question": "Case: A furniture manufacturer's margins are shrinking. To analyze their Cost structure, which buckets are MECE? (Select all that apply)",
            "options": ["Fixed Costs", "Variable Costs", "Semi-variable Costs", "Direct Costs", "Indirect Costs"],
            "correct_answers": [0, 1],
            "correct_answer": "Fixed Costs, Variable Costs",
            "explanation": "Fixed + Variable is the cleanest MECE split for costs."
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": question,
                "user_answer": [],  # No selection
                "drill_type": "case_structuring"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_correct"] == False


class TestCaseStructuringCaseTypes:
    """Verify case_structuring covers various case types"""
    
    @pytest.fixture
    def all_questions(self):
        """Get all case_structuring questions"""
        questions = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            questions.extend(PRE_GENERATED_DRILLS["case_structuring"][difficulty][0]["questions"])
        return questions
    
    def test_covers_profitability_cases(self, all_questions):
        """Should have profitability case questions"""
        profitability_keywords = ["profit", "revenue", "cost", "margin", "profitability"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in profitability_keywords))
        assert count >= 3, f"Only {count} profitability questions found"
    
    def test_covers_market_entry_cases(self, all_questions):
        """Should have market entry case questions"""
        market_entry_keywords = ["market entry", "enter", "launch", "new market"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in market_entry_keywords))
        assert count >= 1, f"Only {count} market entry questions found"
    
    def test_covers_growth_cases(self, all_questions):
        """Should have growth case questions"""
        growth_keywords = ["growth", "grow", "increase", "expand"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in growth_keywords))
        assert count >= 2, f"Only {count} growth questions found"
    
    def test_covers_diagnostic_cases(self, all_questions):
        """Should have diagnostic case questions"""
        diagnostic_keywords = ["diagnostic", "decline", "dropped", "fallen", "decreased", 
                              "worsened", "underperforming", "problem"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in diagnostic_keywords))
        assert count >= 3, f"Only {count} diagnostic questions found"
    
    def test_covers_ma_cases(self, all_questions):
        """Should have M&A case questions"""
        ma_keywords = ["acquiring", "acquisition", "merger", "due diligence", "PE firm", 
                      "private equity", "integration"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in ma_keywords))
        assert count >= 2, f"Only {count} M&A questions found"
    
    def test_covers_pricing_cases(self, all_questions):
        """Should have pricing case questions"""
        pricing_keywords = ["pricing", "price", "raising prices"]
        count = sum(1 for q in all_questions 
                   if any(kw in q["question"].lower() for kw in pricing_keywords))
        assert count >= 1, f"Only {count} pricing questions found"


class TestTimeLimitsForCaseStructuring:
    """Verify time limits for case_structuring drills"""
    
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
    
    def test_beginner_time_limit_300s(self, auth_session):
        """Beginner case_structuring should have 300s (5 min) time limit"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "beginner"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 300
    
    def test_intermediate_time_limit_600s(self, auth_session):
        """Intermediate case_structuring should have 600s (10 min) time limit"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "intermediate"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 600
    
    def test_advanced_time_limit_900s(self, auth_session):
        """Advanced case_structuring should have 900s (15 min) time limit"""
        response = auth_session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "case_structuring", "difficulty": "advanced"}
        )
        assert response.status_code == 200
        assert response.json()["time_limit"] == 900
