"""
Test Charts & Exhibits Drill Feature
Tests the new drill type with chart visualizations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChartsExhibitsDrills:
    """Test Charts & Exhibits drill type"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@gradnext.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_charts_exhibits_in_drill_list(self):
        """Test that Charts & Exhibits drills appear in the drill list"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        data = response.json()
        drills = data.get('drills', [])
        
        # Filter for charts_exhibits drills
        charts_drills = [d for d in drills if d.get('drill_type') == 'charts_exhibits']
        
        # Should have exactly 3 drills (1 Easy, 1 Medium, 1 Hard)
        assert len(charts_drills) == 3, f"Expected 3 Charts & Exhibits drills, got {len(charts_drills)}"
        
        # Verify drill IDs
        drill_ids = [d['id'] for d in charts_drills]
        assert 'ce-b-1' in drill_ids, "Missing Easy drill ce-b-1"
        assert 'ce-i-1' in drill_ids, "Missing Medium drill ce-i-1"
        assert 'ce-a-1' in drill_ids, "Missing Hard drill ce-a-1"
    
    def test_charts_exhibits_drill_difficulties(self):
        """Test that drills have correct difficulty levels"""
        response = self.session.get(f"{BASE_URL}/api/ai-drills/list")
        assert response.status_code == 200
        
        data = response.json()
        drills = data.get('drills', [])
        charts_drills = {d['id']: d for d in drills if d.get('drill_type') == 'charts_exhibits'}
        
        # Verify difficulty levels
        assert charts_drills['ce-b-1']['difficulty'] == 'beginner'
        assert charts_drills['ce-b-1']['difficulty_label'] == 'Easy'
        
        assert charts_drills['ce-i-1']['difficulty'] == 'intermediate'
        assert charts_drills['ce-i-1']['difficulty_label'] == 'Medium'
        
        assert charts_drills['ce-a-1']['difficulty'] == 'advanced'
        assert charts_drills['ce-a-1']['difficulty_label'] == 'Hard'
    
    def test_easy_drill_has_simple_charts(self):
        """Test Easy drill has simple chart types (table, bar, line)"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        questions = data.get('questions', [])
        
        assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}"
        
        # Check chart types - Easy should have simple charts
        chart_types = set(q.get('chart_type') for q in questions)
        simple_types = {'table', 'bar', 'line'}
        
        # All chart types should be simple
        assert chart_types.issubset(simple_types), f"Easy drill has complex charts: {chart_types - simple_types}"
        
        # Verify each question has chart_data
        for q in questions:
            assert q.get('chart_type'), f"Question {q['id']} missing chart_type"
            assert q.get('chart_data'), f"Question {q['id']} missing chart_data"
    
    def test_medium_drill_has_combined_charts(self):
        """Test Medium drill has combined/stacked charts"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "intermediate", "drill_id": "ce-i-1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        questions = data.get('questions', [])
        
        assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}"
        
        # Check chart types - Medium should have combined charts
        chart_types = set(q.get('chart_type') for q in questions)
        medium_types = {'combined_bar', 'stacked_bar', 'multi_line', 'area', 'combo', 'waterfall'}
        
        # Should have at least some medium-complexity charts
        assert len(chart_types & medium_types) > 0, f"Medium drill missing combined charts: {chart_types}"
    
    def test_hard_drill_has_advanced_charts(self):
        """Test Hard drill has advanced chart types"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "advanced", "drill_id": "ce-a-1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        questions = data.get('questions', [])
        
        assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}"
        
        # Check chart types - Hard should have advanced charts
        chart_types = set(q.get('chart_type') for q in questions)
        advanced_types = {'bubble', 'scatter', 'radar', 'marimekko', 'heatmap', 'treemap', 'boxplot', 'sankey', 'bubble_matrix', 'dashboard'}
        
        # Should have advanced charts
        assert len(chart_types & advanced_types) > 0, f"Hard drill missing advanced charts: {chart_types}"
    
    def test_drill_question_structure(self):
        """Test that drill questions have correct structure"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        assert response.status_code == 200
        
        data = response.json()
        questions = data.get('questions', [])
        
        for q in questions:
            # Required fields
            assert 'id' in q, "Question missing id"
            assert 'type' in q, "Question missing type"
            assert 'question' in q, "Question missing question text"
            assert 'chart_type' in q, "Question missing chart_type"
            assert 'chart_data' in q, "Question missing chart_data"
            
            # Type-specific fields
            if q['type'] == 'multiple_choice':
                assert 'options' in q, "MCQ missing options"
                assert 'correct_answer' in q, "MCQ missing correct_answer"
            elif q['type'] == 'text_input':
                assert 'acceptable_answers' in q, "Text input missing acceptable_answers"
    
    def test_drill_completion_recording(self):
        """Test that drill completion is recorded"""
        # Start a drill
        start_response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        assert start_response.status_code == 200
        
        data = start_response.json()
        session_id = data.get('drill_session_id')
        assert session_id, "Missing drill_session_id"
        
        # Complete the drill
        complete_response = self.session.post(
            f"{BASE_URL}/api/ai-drills/complete/{session_id}",
            json={"score": 8, "total": 10, "time_taken": 180}
        )
        assert complete_response.status_code == 200
        
        # Verify in history
        history_response = self.session.get(f"{BASE_URL}/api/ai-drills/history")
        assert history_response.status_code == 200
        
        history = history_response.json().get('history', [])
        # Find our completion
        our_completion = [h for h in history if h.get('drill_id') == 'ce-b-1']
        assert len(our_completion) > 0, "Drill completion not recorded in history"
    
    def test_evaluate_answer(self):
        """Test answer evaluation for Charts & Exhibits questions"""
        # Get a question
        drill_response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        assert drill_response.status_code == 200
        
        questions = drill_response.json().get('questions', [])
        mcq = next((q for q in questions if q['type'] == 'multiple_choice'), None)
        assert mcq, "No MCQ found"
        
        # Test correct answer
        eval_response = self.session.post(
            f"{BASE_URL}/api/ai-drills/evaluate",
            json={
                "question": mcq,
                "user_answer": mcq['correct_answer'],
                "drill_type": "charts_exhibits"
            }
        )
        assert eval_response.status_code == 200
        
        result = eval_response.json()
        assert result.get('is_correct') == True, "Correct answer marked as incorrect"


class TestChartsExhibitsChartData:
    """Test chart data structure for different chart types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@gradnext.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_table_chart_data_structure(self):
        """Test table chart data has headers and rows"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        questions = response.json().get('questions', [])
        
        table_q = next((q for q in questions if q.get('chart_type') == 'table'), None)
        assert table_q, "No table chart found"
        
        chart_data = table_q['chart_data']
        assert 'headers' in chart_data, "Table missing headers"
        assert 'rows' in chart_data, "Table missing rows"
        assert len(chart_data['headers']) > 0, "Table has no headers"
        assert len(chart_data['rows']) > 0, "Table has no rows"
    
    def test_bar_chart_data_structure(self):
        """Test bar chart data has labels and datasets"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "beginner", "drill_id": "ce-b-1"}
        )
        questions = response.json().get('questions', [])
        
        bar_q = next((q for q in questions if q.get('chart_type') == 'bar'), None)
        assert bar_q, "No bar chart found"
        
        chart_data = bar_q['chart_data']
        assert 'labels' in chart_data, "Bar chart missing labels"
        assert 'datasets' in chart_data, "Bar chart missing datasets"
        assert len(chart_data['datasets']) > 0, "Bar chart has no datasets"
        assert 'data' in chart_data['datasets'][0], "Dataset missing data array"
    
    def test_bubble_chart_data_structure(self):
        """Test bubble chart data has x, y, z coordinates"""
        response = self.session.post(
            f"{BASE_URL}/api/ai-drills/generate",
            json={"drill_type": "charts_exhibits", "difficulty": "advanced", "drill_id": "ce-a-1"}
        )
        questions = response.json().get('questions', [])
        
        bubble_q = next((q for q in questions if q.get('chart_type') == 'bubble'), None)
        assert bubble_q, "No bubble chart found"
        
        chart_data = bubble_q['chart_data']
        assert 'datasets' in chart_data, "Bubble chart missing datasets"
        
        for ds in chart_data['datasets']:
            assert 'x' in ds, "Bubble dataset missing x"
            assert 'y' in ds, "Bubble dataset missing y"
            assert 'z' in ds, "Bubble dataset missing z"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
