"""
Test Case Competition Feature
Tests for the new Case Competition quiz system including:
- Admin competition management (create, list, update, delete)
- Question management (add, bulk add, seed questions)
- User quiz flow (start, answer, submit)
- Scoring and results
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCaseCompetitionAdmin:
    """Admin competition management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        # Login as admin using mock login
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_user = response.json().get('user', {})
        print(f"Logged in as admin: {self.admin_user.get('email')}")
        yield
        # Cleanup - logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_create_competition(self):
        """Test creating a new competition"""
        now = datetime.utcnow()
        nav_visible = now - timedelta(hours=1)  # Already visible
        quiz_start = now - timedelta(minutes=5)  # Already started
        
        competition_data = {
            "name": f"TEST_Competition_{uuid.uuid4().hex[:8]}",
            "description": "Test competition for automated testing",
            "nav_visible_from": nav_visible.isoformat() + "Z",
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 10,
            "questions_per_user": 10,
            "scoring": {"correct": 3, "wrong": -1, "skip": 0},
            "is_active": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        assert response.status_code == 200, f"Create competition failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert 'competition' in data
        assert data['competition']['name'] == competition_data['name']
        
        # Store competition ID for cleanup
        self.competition_id = data['competition']['id']
        print(f"Created competition: {self.competition_id}")
        
        return self.competition_id
    
    def test_list_competitions(self):
        """Test listing all competitions"""
        response = self.session.get(
            f"{BASE_URL}/api/competitions/admin/competitions"
        )
        
        assert response.status_code == 200, f"List competitions failed: {response.text}"
        data = response.json()
        assert 'competitions' in data
        assert isinstance(data['competitions'], list)
        print(f"Found {len(data['competitions'])} competitions")
    
    def test_create_and_add_questions_bulk(self):
        """Test creating competition and adding questions in bulk"""
        # First create a competition
        now = datetime.utcnow()
        nav_visible = now - timedelta(hours=1)
        quiz_start = now - timedelta(minutes=5)
        
        competition_data = {
            "name": f"TEST_QuizComp_{uuid.uuid4().hex[:8]}",
            "description": "Competition for question testing",
            "nav_visible_from": nav_visible.isoformat() + "Z",
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 10,
            "questions_per_user": 5,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        competition_id = create_response.json()['competition']['id']
        
        # Add questions in bulk
        questions = [
            {
                "question": "What is 2 + 2?",
                "question_type": "multiple_choice",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4",
                "category": "case_math",
                "difficulty": "easy"
            },
            {
                "question": "What is the capital of France?",
                "question_type": "multiple_choice",
                "options": ["London", "Paris", "Berlin", "Madrid"],
                "correct_answer": "Paris",
                "category": "guesstimate",
                "difficulty": "easy"
            },
            {
                "question": "Calculate 10% of 500",
                "question_type": "text_input",
                "correct_answer": "50",
                "acceptable_answers": ["50", "$50", "50.0"],
                "category": "case_math",
                "difficulty": "medium"
            },
            {
                "question": "What is 5 x 5?",
                "question_type": "multiple_choice",
                "options": ["20", "25", "30", "35"],
                "correct_answer": "25",
                "category": "case_math",
                "difficulty": "easy"
            },
            {
                "question": "What is 100 / 4?",
                "question_type": "text_input",
                "correct_answer": "25",
                "category": "case_math",
                "difficulty": "easy"
            }
        ]
        
        bulk_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions/{competition_id}/questions/bulk",
            json={"questions": questions}
        )
        
        assert bulk_response.status_code == 200, f"Bulk add questions failed: {bulk_response.text}"
        bulk_data = bulk_response.json()
        assert bulk_data.get('success') == True
        assert bulk_data.get('count') == 5
        print(f"Added {bulk_data['count']} questions to competition {competition_id}")
        
        # Verify questions were added
        questions_response = self.session.get(
            f"{BASE_URL}/api/competitions/admin/competitions/{competition_id}/questions"
        )
        assert questions_response.status_code == 200
        questions_data = questions_response.json()
        assert len(questions_data['questions']) == 5
        
        return competition_id
    
    def test_get_competition_stats(self):
        """Test getting competition statistics"""
        # First create a competition
        now = datetime.utcnow()
        competition_data = {
            "name": f"TEST_StatsComp_{uuid.uuid4().hex[:8]}",
            "description": "Competition for stats testing",
            "nav_visible_from": (now - timedelta(hours=1)).isoformat() + "Z",
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 10,
            "questions_per_user": 5,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        competition_id = create_response.json()['competition']['id']
        
        # Get stats
        stats_response = self.session.get(
            f"{BASE_URL}/api/competitions/admin/competitions/{competition_id}/stats"
        )
        
        assert stats_response.status_code == 200, f"Get stats failed: {stats_response.text}"
        stats = stats_response.json()
        assert 'total_participants' in stats
        assert 'submitted_count' in stats
        assert 'average_score' in stats
        print(f"Competition stats: {stats}")
    
    def test_update_competition(self):
        """Test updating a competition"""
        # Create competition first
        now = datetime.utcnow()
        competition_data = {
            "name": f"TEST_UpdateComp_{uuid.uuid4().hex[:8]}",
            "description": "Competition for update testing",
            "nav_visible_from": (now - timedelta(hours=1)).isoformat() + "Z",
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 10,
            "questions_per_user": 5,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        competition_id = create_response.json()['competition']['id']
        
        # Update competition
        update_data = {
            "name": "Updated Competition Name",
            "duration_minutes": 15,
            "is_active": False
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/competitions/admin/competitions/{competition_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        assert update_response.json().get('success') == True
        print(f"Updated competition {competition_id}")
    
    def test_delete_competition(self):
        """Test deleting a competition"""
        # Create competition first
        now = datetime.utcnow()
        competition_data = {
            "name": f"TEST_DeleteComp_{uuid.uuid4().hex[:8]}",
            "description": "Competition for delete testing",
            "nav_visible_from": (now - timedelta(hours=1)).isoformat() + "Z",
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 10,
            "questions_per_user": 5,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        competition_id = create_response.json()['competition']['id']
        
        # Delete competition
        delete_response = self.session.delete(
            f"{BASE_URL}/api/competitions/admin/competitions/{competition_id}"
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert delete_response.json().get('success') == True
        print(f"Deleted competition {competition_id}")


class TestCaseCompetitionUser:
    """User quiz flow tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup user session and create test competition"""
        self.admin_session = requests.Session()
        self.user_session = requests.Session()
        
        # Login as admin to create competition
        admin_response = self.admin_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert admin_response.status_code == 200, f"Admin login failed: {admin_response.text}"
        
        # Create a live competition with questions
        now = datetime.utcnow()
        self.competition_data = {
            "name": f"TEST_UserQuiz_{uuid.uuid4().hex[:8]}",
            "description": "Competition for user testing",
            "nav_visible_from": (now - timedelta(hours=1)).isoformat() + "Z",
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 60,  # Long duration for testing
            "questions_per_user": 3,  # Small number for testing
            "is_active": True
        }
        
        create_response = self.admin_session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=self.competition_data
        )
        assert create_response.status_code == 200
        self.competition_id = create_response.json()['competition']['id']
        
        # Add questions
        questions = [
            {
                "question": "What is 2 + 2?",
                "question_type": "multiple_choice",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4",
                "category": "case_math",
                "difficulty": "easy"
            },
            {
                "question": "What is 3 x 3?",
                "question_type": "multiple_choice",
                "options": ["6", "9", "12", "15"],
                "correct_answer": "9",
                "category": "case_math",
                "difficulty": "easy"
            },
            {
                "question": "What is 10 - 5?",
                "question_type": "text_input",
                "correct_answer": "5",
                "acceptable_answers": ["5", "five"],
                "category": "case_math",
                "difficulty": "easy"
            },
            {
                "question": "What is 20 / 4?",
                "question_type": "multiple_choice",
                "options": ["4", "5", "6", "7"],
                "correct_answer": "5",
                "category": "case_math",
                "difficulty": "easy"
            }
        ]
        
        bulk_response = self.admin_session.post(
            f"{BASE_URL}/api/competitions/admin/competitions/{self.competition_id}/questions/bulk",
            json={"questions": questions}
        )
        assert bulk_response.status_code == 200
        
        # Login as free user
        user_response = self.user_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            json={}
        )
        assert user_response.status_code == 200, f"User login failed: {user_response.text}"
        self.user = user_response.json().get('user', {})
        print(f"Logged in as user: {self.user.get('email')}")
        
        yield
        
        # Cleanup
        self.admin_session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{self.competition_id}")
        self.admin_session.post(f"{BASE_URL}/api/auth/logout")
        self.user_session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_get_active_competitions(self):
        """Test getting active competitions as user"""
        response = self.user_session.get(
            f"{BASE_URL}/api/competitions/competitions/active"
        )
        
        assert response.status_code == 200, f"Get active competitions failed: {response.text}"
        data = response.json()
        assert 'competitions' in data
        
        # Find our test competition
        test_comp = next((c for c in data['competitions'] if c['id'] == self.competition_id), None)
        assert test_comp is not None, "Test competition not found in active competitions"
        assert test_comp['status'] == 'live', f"Expected status 'live', got '{test_comp['status']}'"
        print(f"Found active competition: {test_comp['name']} with status {test_comp['status']}")
    
    def test_start_quiz(self):
        """Test starting a quiz"""
        response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        
        assert response.status_code == 200, f"Start quiz failed: {response.text}"
        data = response.json()
        
        assert 'attempt' in data
        assert 'questions' in data
        assert 'time_remaining' in data
        assert len(data['questions']) == 3  # questions_per_user
        assert data['time_remaining'] > 0
        
        # Questions should not have correct_answer exposed
        for q in data['questions']:
            assert 'correct_answer' not in q
            assert 'acceptable_answers' not in q
        
        print(f"Started quiz with {len(data['questions'])} questions, {data['time_remaining']}s remaining")
        return data
    
    def test_submit_answer_correct(self):
        """Test submitting a correct answer"""
        # Start quiz first
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        # Find a multiple choice question and submit correct answer
        question = quiz_data['questions'][0]
        
        # Submit answer
        answer_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
            json={
                "question_id": question['id'],
                "answer": question['options'][1] if question.get('options') else "4",  # Assuming correct answer
                "time_taken_seconds": 10
            }
        )
        
        assert answer_response.status_code == 200, f"Submit answer failed: {answer_response.text}"
        data = answer_response.json()
        assert 'is_correct' in data
        assert 'points' in data
        assert 'correct_answer' in data
        print(f"Answer result: correct={data['is_correct']}, points={data['points']}")
    
    def test_cannot_resubmit_same_question(self):
        """Test that user cannot resubmit answer for same question"""
        # Start quiz
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        question = quiz_data['questions'][0]
        
        # Submit first answer
        first_answer = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
            json={
                "question_id": question['id'],
                "answer": "4",
                "time_taken_seconds": 5
            }
        )
        assert first_answer.status_code == 200
        
        # Try to submit again - should fail
        second_answer = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
            json={
                "question_id": question['id'],
                "answer": "5",
                "time_taken_seconds": 5
            }
        )
        
        assert second_answer.status_code == 400, "Should not allow resubmitting same question"
        assert "already answered" in second_answer.json().get('detail', '').lower()
        print("Correctly prevented resubmission of same question")
    
    def test_skip_question(self):
        """Test skipping a question"""
        # Start quiz
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        question = quiz_data['questions'][0]
        
        # Skip question (answer = None)
        skip_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
            json={
                "question_id": question['id'],
                "answer": None,
                "time_taken_seconds": 2
            }
        )
        
        assert skip_response.status_code == 200, f"Skip failed: {skip_response.text}"
        data = skip_response.json()
        assert data['is_correct'] is None  # Skipped
        assert data['points'] == 0  # No points for skip
        print("Successfully skipped question with 0 points")
    
    def test_submit_quiz(self):
        """Test submitting the entire quiz"""
        # Start quiz
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        # Answer all questions
        for question in quiz_data['questions']:
            answer = question['options'][0] if question.get('options') else "5"
            self.user_session.post(
                f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
                json={
                    "question_id": question['id'],
                    "answer": answer,
                    "time_taken_seconds": 5
                }
            )
        
        # Submit quiz
        submit_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/submit",
            json={}
        )
        
        assert submit_response.status_code == 200, f"Submit quiz failed: {submit_response.text}"
        data = submit_response.json()
        assert data.get('success') == True
        assert 'score' in data
        assert 'correct_count' in data
        assert 'wrong_count' in data
        assert 'total_questions' in data
        print(f"Quiz submitted: score={data['score']}, correct={data['correct_count']}, wrong={data['wrong_count']}")
    
    def test_get_results_after_submit(self):
        """Test getting results after quiz submission"""
        # Start and complete quiz
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        # Answer all questions
        for question in quiz_data['questions']:
            answer = question['options'][0] if question.get('options') else "5"
            self.user_session.post(
                f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
                json={
                    "question_id": question['id'],
                    "answer": answer,
                    "time_taken_seconds": 5
                }
            )
        
        # Submit quiz
        self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/submit",
            json={}
        )
        
        # Get results
        results_response = self.user_session.get(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/results"
        )
        
        assert results_response.status_code == 200, f"Get results failed: {results_response.text}"
        data = results_response.json()
        assert 'attempt' in data
        assert 'questions' in data
        
        # Questions should now include correct answers for review
        for q in data['questions']:
            assert 'correct_answer' in q
            assert 'user_answer' in q
            assert 'is_correct' in q
        
        print(f"Results retrieved with {len(data['questions'])} questions")
    
    def test_resume_quiz(self):
        """Test resuming a quiz after disconnection"""
        # Start quiz
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        first_data = start_response.json()
        
        # Answer one question
        question = first_data['questions'][0]
        self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
            json={
                "question_id": question['id'],
                "answer": question['options'][0] if question.get('options') else "5",
                "time_taken_seconds": 5
            }
        )
        
        # "Disconnect" and start again - should resume
        resume_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        
        assert resume_response.status_code == 200, f"Resume failed: {resume_response.text}"
        resume_data = resume_response.json()
        assert resume_data.get('resumed') == True
        assert len(resume_data['attempt']['answers']) == 1  # One question already answered
        print("Successfully resumed quiz with previous progress")


class TestCaseCompetitionLeaderboard:
    """Leaderboard tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup sessions"""
        self.admin_session = requests.Session()
        self.user_session = requests.Session()
        
        # Login as admin
        admin_response = self.admin_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert admin_response.status_code == 200
        
        # Create competition
        now = datetime.utcnow()
        create_response = self.admin_session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json={
                "name": f"TEST_Leaderboard_{uuid.uuid4().hex[:8]}",
                "description": "Competition for leaderboard testing",
                "nav_visible_from": (now - timedelta(hours=1)).isoformat() + "Z",
                "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
                "duration_minutes": 60,
                "questions_per_user": 2,
                "is_active": True
            }
        )
        assert create_response.status_code == 200
        self.competition_id = create_response.json()['competition']['id']
        
        # Add questions
        self.admin_session.post(
            f"{BASE_URL}/api/competitions/admin/competitions/{self.competition_id}/questions/bulk",
            json={"questions": [
                {"question": "Q1", "question_type": "multiple_choice", "options": ["A", "B"], "correct_answer": "A", "category": "case_math"},
                {"question": "Q2", "question_type": "multiple_choice", "options": ["C", "D"], "correct_answer": "C", "category": "case_math"}
            ]}
        )
        
        # Login as user
        user_response = self.user_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            json={}
        )
        assert user_response.status_code == 200
        
        yield
        
        # Cleanup
        self.admin_session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{self.competition_id}")
        self.admin_session.post(f"{BASE_URL}/api/auth/logout")
        self.user_session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_get_leaderboard(self):
        """Test getting competition leaderboard"""
        # Complete quiz first
        start_response = self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/start",
            json={}
        )
        assert start_response.status_code == 200
        quiz_data = start_response.json()
        
        for question in quiz_data['questions']:
            self.user_session.post(
                f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/answer",
                json={"question_id": question['id'], "answer": question['options'][0], "time_taken_seconds": 5}
            )
        
        self.user_session.post(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/submit",
            json={}
        )
        
        # Get leaderboard
        leaderboard_response = self.user_session.get(
            f"{BASE_URL}/api/competitions/competitions/{self.competition_id}/leaderboard"
        )
        
        assert leaderboard_response.status_code == 200, f"Get leaderboard failed: {leaderboard_response.text}"
        data = leaderboard_response.json()
        assert 'leaderboard' in data
        assert len(data['leaderboard']) >= 1
        
        # Check leaderboard entry structure
        entry = data['leaderboard'][0]
        assert 'rank' in entry
        assert 'user_name' in entry
        assert 'score' in entry
        print(f"Leaderboard has {len(data['leaderboard'])} entries")


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_competitions():
    """Cleanup TEST_ prefixed competitions after all tests"""
    yield
    
    session = requests.Session()
    try:
        # Login as admin
        session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin", json={})
        
        # Get all competitions
        response = session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        if response.status_code == 200:
            competitions = response.json().get('competitions', [])
            for comp in competitions:
                if comp.get('name', '').startswith('TEST_'):
                    session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{comp['id']}")
                    print(f"Cleaned up test competition: {comp['name']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
    finally:
        session.post(f"{BASE_URL}/api/auth/logout")
