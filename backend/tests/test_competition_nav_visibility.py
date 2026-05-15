"""
Test Competition Navigation Visibility Feature
Tests for the refactored competition admin settings:
- show_in_nav checkbox replaces nav_visible_from datetime field
- quiz_end_time is auto-calculated from quiz_start_time + duration_minutes
- Visibility toggle button in competition list
- Public API filters by show_in_nav=true
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCompetitionNavVisibility:
    """Tests for show_in_nav feature"""
    
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
        self.admin_user = response.json()
        print(f"Logged in as admin: {self.admin_user.get('email')}")
        self.created_competition_ids = []
        yield
        # Cleanup created competitions
        for comp_id in self.created_competition_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{comp_id}")
            except:
                pass
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_create_competition_with_show_in_nav_true(self):
        """Test creating competition with show_in_nav=true (visible in navigation)"""
        now = datetime.utcnow()
        quiz_start = now - timedelta(minutes=5)  # Already started
        
        competition_data = {
            "name": f"TEST_NavVisible_{uuid.uuid4().hex[:8]}",
            "description": "Competition visible in navigation",
            "show_in_nav": True,  # NEW: Boolean instead of datetime
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 30,
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
        
        comp = data['competition']
        self.created_competition_ids.append(comp['id'])
        
        # Verify show_in_nav is set correctly
        assert comp['show_in_nav'] == True, f"Expected show_in_nav=True, got {comp.get('show_in_nav')}"
        
        # Verify quiz_end_time is auto-calculated
        assert 'quiz_end_time' in comp, "quiz_end_time should be auto-calculated"
        
        print(f"Created competition with show_in_nav=True: {comp['id']}")
        return comp['id']
    
    def test_create_competition_with_show_in_nav_false(self):
        """Test creating competition with show_in_nav=false (hidden from navigation)"""
        now = datetime.utcnow()
        quiz_start = now - timedelta(minutes=5)
        
        competition_data = {
            "name": f"TEST_NavHidden_{uuid.uuid4().hex[:8]}",
            "description": "Competition hidden from navigation",
            "show_in_nav": False,  # Hidden
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 30,
            "questions_per_user": 10,
            "is_active": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        assert response.status_code == 200, f"Create competition failed: {response.text}"
        data = response.json()
        comp = data['competition']
        self.created_competition_ids.append(comp['id'])
        
        assert comp['show_in_nav'] == False, f"Expected show_in_nav=False, got {comp.get('show_in_nav')}"
        print(f"Created competition with show_in_nav=False: {comp['id']}")
        return comp['id']
    
    def test_create_competition_without_nav_visible_from(self):
        """Test that nav_visible_from is NOT required (old field removed)"""
        now = datetime.utcnow()
        quiz_start = now - timedelta(minutes=5)
        
        # Create without nav_visible_from - should work
        competition_data = {
            "name": f"TEST_NoNavFrom_{uuid.uuid4().hex[:8]}",
            "description": "Competition without nav_visible_from",
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 30,
            "questions_per_user": 10,
            "is_active": True
            # Note: No nav_visible_from field
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        assert response.status_code == 200, f"Create should succeed without nav_visible_from: {response.text}"
        data = response.json()
        comp = data['competition']
        self.created_competition_ids.append(comp['id'])
        
        # show_in_nav should default to True
        assert comp.get('show_in_nav', True) == True, "show_in_nav should default to True"
        print(f"Created competition without nav_visible_from - show_in_nav defaults to True")
    
    def test_quiz_end_time_auto_calculated(self):
        """Test that quiz_end_time is automatically calculated from start_time + duration"""
        now = datetime.utcnow()
        quiz_start = now + timedelta(hours=1)  # Future start
        duration_minutes = 45
        
        competition_data = {
            "name": f"TEST_EndTimeCalc_{uuid.uuid4().hex[:8]}",
            "description": "Test end time calculation",
            "show_in_nav": True,
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": duration_minutes,
            "questions_per_user": 10,
            "is_active": True
            # Note: No quiz_end_time provided - should be auto-calculated
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        comp = data['competition']
        self.created_competition_ids.append(comp['id'])
        
        # Verify end time is calculated correctly
        assert 'quiz_end_time' in comp, "quiz_end_time should be present"
        
        # Parse and verify the calculation
        start_time = datetime.fromisoformat(comp['quiz_start_time'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(comp['quiz_end_time'].replace('Z', '+00:00'))
        expected_end = start_time + timedelta(minutes=duration_minutes)
        
        # Allow 1 second tolerance for timing
        time_diff = abs((end_time - expected_end).total_seconds())
        assert time_diff < 2, f"End time calculation off by {time_diff} seconds"
        
        print(f"Quiz end time correctly calculated: start={comp['quiz_start_time']}, end={comp['quiz_end_time']}, duration={duration_minutes}min")
    
    def test_toggle_nav_visibility(self):
        """Test toggling show_in_nav via update endpoint"""
        # Create competition with show_in_nav=True
        now = datetime.utcnow()
        competition_data = {
            "name": f"TEST_Toggle_{uuid.uuid4().hex[:8]}",
            "description": "Test toggle visibility",
            "show_in_nav": True,
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 30,
            "questions_per_user": 10,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        comp_id = create_response.json()['competition']['id']
        self.created_competition_ids.append(comp_id)
        
        # Toggle to False
        update_response = self.session.put(
            f"{BASE_URL}/api/competitions/admin/competitions/{comp_id}",
            json={"show_in_nav": False}
        )
        assert update_response.status_code == 200, f"Toggle to False failed: {update_response.text}"
        
        # Verify the change
        list_response = self.session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        assert list_response.status_code == 200
        competitions = list_response.json()['competitions']
        updated_comp = next((c for c in competitions if c['id'] == comp_id), None)
        assert updated_comp is not None
        assert updated_comp['show_in_nav'] == False, "show_in_nav should be False after toggle"
        
        # Toggle back to True
        update_response2 = self.session.put(
            f"{BASE_URL}/api/competitions/admin/competitions/{comp_id}",
            json={"show_in_nav": True}
        )
        assert update_response2.status_code == 200, f"Toggle to True failed: {update_response2.text}"
        
        # Verify again
        list_response2 = self.session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        competitions2 = list_response2.json()['competitions']
        updated_comp2 = next((c for c in competitions2 if c['id'] == comp_id), None)
        assert updated_comp2['show_in_nav'] == True, "show_in_nav should be True after second toggle"
        
        print(f"Successfully toggled show_in_nav: True -> False -> True")
    
    def test_public_api_filters_by_show_in_nav(self):
        """Test that /competitions/active only returns competitions with show_in_nav=true"""
        now = datetime.utcnow()
        
        # Create visible competition
        visible_comp_data = {
            "name": f"TEST_Visible_{uuid.uuid4().hex[:8]}",
            "description": "Should appear in public API",
            "show_in_nav": True,
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 60,
            "questions_per_user": 10,
            "is_active": True
        }
        
        visible_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=visible_comp_data
        )
        assert visible_response.status_code == 200
        visible_id = visible_response.json()['competition']['id']
        self.created_competition_ids.append(visible_id)
        
        # Create hidden competition
        hidden_comp_data = {
            "name": f"TEST_Hidden_{uuid.uuid4().hex[:8]}",
            "description": "Should NOT appear in public API",
            "show_in_nav": False,
            "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
            "duration_minutes": 60,
            "questions_per_user": 10,
            "is_active": True
        }
        
        hidden_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=hidden_comp_data
        )
        assert hidden_response.status_code == 200
        hidden_id = hidden_response.json()['competition']['id']
        self.created_competition_ids.append(hidden_id)
        
        # Check public API
        public_response = self.session.get(f"{BASE_URL}/api/competitions/competitions/active")
        assert public_response.status_code == 200, f"Public API failed: {public_response.text}"
        
        active_competitions = public_response.json()['competitions']
        active_ids = [c['id'] for c in active_competitions]
        
        # Visible competition should be in the list
        assert visible_id in active_ids, f"Visible competition {visible_id} should appear in public API"
        
        # Hidden competition should NOT be in the list
        assert hidden_id not in active_ids, f"Hidden competition {hidden_id} should NOT appear in public API"
        
        print(f"Public API correctly filters: visible={visible_id} in list, hidden={hidden_id} not in list")
    
    def test_update_duration_recalculates_end_time(self):
        """Test that updating duration_minutes recalculates quiz_end_time"""
        now = datetime.utcnow()
        quiz_start = now + timedelta(hours=1)
        
        # Create with 30 min duration
        competition_data = {
            "name": f"TEST_DurationUpdate_{uuid.uuid4().hex[:8]}",
            "description": "Test duration update",
            "show_in_nav": True,
            "quiz_start_time": quiz_start.isoformat() + "Z",
            "duration_minutes": 30,
            "questions_per_user": 10,
            "is_active": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        assert create_response.status_code == 200
        comp = create_response.json()['competition']
        comp_id = comp['id']
        self.created_competition_ids.append(comp_id)
        
        original_end = comp['quiz_end_time']
        
        # Update duration to 60 minutes
        update_response = self.session.put(
            f"{BASE_URL}/api/competitions/admin/competitions/{comp_id}",
            json={"duration_minutes": 60}
        )
        assert update_response.status_code == 200, f"Update duration failed: {update_response.text}"
        
        # Fetch updated competition
        list_response = self.session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        competitions = list_response.json()['competitions']
        updated_comp = next((c for c in competitions if c['id'] == comp_id), None)
        
        assert updated_comp is not None
        new_end = updated_comp['quiz_end_time']
        
        # End time should have changed
        assert new_end != original_end, "quiz_end_time should change when duration is updated"
        
        # Verify new end time is correct (start + 60 min)
        start_time = datetime.fromisoformat(updated_comp['quiz_start_time'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(new_end.replace('Z', '+00:00'))
        expected_end = start_time + timedelta(minutes=60)
        
        time_diff = abs((end_time - expected_end).total_seconds())
        assert time_diff < 2, f"New end time calculation off by {time_diff} seconds"
        
        print(f"Duration update correctly recalculated end time: {original_end} -> {new_end}")
    
    def test_admin_list_shows_all_competitions(self):
        """Test that admin list shows both visible and hidden competitions"""
        now = datetime.utcnow()
        
        # Create one visible and one hidden
        for show_in_nav in [True, False]:
            comp_data = {
                "name": f"TEST_AdminList_{show_in_nav}_{uuid.uuid4().hex[:8]}",
                "description": f"show_in_nav={show_in_nav}",
                "show_in_nav": show_in_nav,
                "quiz_start_time": (now - timedelta(minutes=5)).isoformat() + "Z",
                "duration_minutes": 30,
                "questions_per_user": 10,
                "is_active": True
            }
            response = self.session.post(
                f"{BASE_URL}/api/competitions/admin/competitions",
                json=comp_data
            )
            assert response.status_code == 200
            self.created_competition_ids.append(response.json()['competition']['id'])
        
        # Admin list should show both
        list_response = self.session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        assert list_response.status_code == 200
        
        competitions = list_response.json()['competitions']
        test_comps = [c for c in competitions if c['name'].startswith('TEST_AdminList_')]
        
        assert len(test_comps) >= 2, "Admin should see both visible and hidden competitions"
        
        visible_count = sum(1 for c in test_comps if c.get('show_in_nav', True) == True)
        hidden_count = sum(1 for c in test_comps if c.get('show_in_nav', True) == False)
        
        assert visible_count >= 1, "Should have at least one visible competition"
        assert hidden_count >= 1, "Should have at least one hidden competition"
        
        print(f"Admin list shows all competitions: {visible_count} visible, {hidden_count} hidden")


class TestCompetitionFormValidation:
    """Tests for form validation - Name and Quiz Start Time required, nav_visible_from NOT required"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert response.status_code == 200
        self.created_competition_ids = []
        yield
        for comp_id in self.created_competition_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{comp_id}")
            except:
                pass
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_create_with_only_required_fields(self):
        """Test creating competition with only name and quiz_start_time (minimum required)"""
        now = datetime.utcnow()
        
        # Minimum required fields
        competition_data = {
            "name": f"TEST_MinFields_{uuid.uuid4().hex[:8]}",
            "quiz_start_time": (now + timedelta(hours=1)).isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        assert response.status_code == 200, f"Create with minimum fields failed: {response.text}"
        comp = response.json()['competition']
        self.created_competition_ids.append(comp['id'])
        
        # Verify defaults are applied
        assert comp.get('show_in_nav', True) == True, "show_in_nav should default to True"
        assert comp.get('duration_minutes', 10) == 10, "duration_minutes should have default"
        assert 'quiz_end_time' in comp, "quiz_end_time should be auto-calculated"
        
        print(f"Created competition with minimum fields - defaults applied correctly")
    
    def test_create_fails_without_name(self):
        """Test that creation fails without name"""
        now = datetime.utcnow()
        
        competition_data = {
            "quiz_start_time": (now + timedelta(hours=1)).isoformat() + "Z",
            "duration_minutes": 30
            # Missing name
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        # Should fail validation
        assert response.status_code in [400, 422], f"Should fail without name, got {response.status_code}"
        print("Correctly rejected creation without name")
    
    def test_create_fails_without_quiz_start_time(self):
        """Test that creation fails without quiz_start_time"""
        competition_data = {
            "name": f"TEST_NoStartTime_{uuid.uuid4().hex[:8]}",
            "duration_minutes": 30
            # Missing quiz_start_time
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/competitions/admin/competitions",
            json=competition_data
        )
        
        # Should fail validation
        assert response.status_code in [400, 422], f"Should fail without quiz_start_time, got {response.status_code}"
        print("Correctly rejected creation without quiz_start_time")


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_competitions():
    """Cleanup TEST_ prefixed competitions after all tests"""
    yield
    
    session = requests.Session()
    try:
        session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin", json={})
        response = session.get(f"{BASE_URL}/api/competitions/admin/competitions")
        if response.status_code == 200:
            competitions = response.json().get('competitions', [])
            for comp in competitions:
                if comp.get('name', '').startswith('TEST_'):
                    session.delete(f"{BASE_URL}/api/competitions/admin/competitions/{comp['id']}")
                    print(f"Cleaned up: {comp['name']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
    finally:
        session.post(f"{BASE_URL}/api/auth/logout")
