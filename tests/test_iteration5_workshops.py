"""
Test suite for gradnext Iteration 5 - Workshop, Videos, and Materials features
Tests:
1. Workshop creation from admin panel
2. Workshop form fields (instructor, instructor_title, meeting_link)
3. Workshop retrieval for candidates with instructor->mentor_name mapping
4. Videos display on candidate dashboard
5. Materials display on candidate dashboard
6. Workshop edit functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminWorkshopCRUD:
    """Test Admin Workshop Create/Read/Update/Delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        # Login as admin
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_user = response.json()
        yield
        # Cleanup - delete test workshops
        try:
            workshops_res = self.session.get(f"{BASE_URL}/api/admin/workshops")
            if workshops_res.status_code == 200:
                workshops = workshops_res.json().get('workshops', [])
                for w in workshops:
                    if w.get('title', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/admin/workshops/{w['id']}")
        except:
            pass
    
    def test_admin_login_success(self):
        """Test admin mock login returns admin user"""
        assert self.admin_user.get('is_admin') == True
        assert 'id' in self.admin_user
        print(f"Admin login successful: {self.admin_user.get('email')}")
    
    def test_get_admin_workshops(self):
        """Test GET /api/admin/workshops returns workshop list"""
        response = self.session.get(f"{BASE_URL}/api/admin/workshops")
        assert response.status_code == 200
        data = response.json()
        assert 'workshops' in data
        print(f"Found {len(data['workshops'])} workshops")
    
    def test_create_workshop_with_instructor_fields(self):
        """Test creating workshop with instructor, instructor_title, and meeting_link"""
        workshop_data = {
            "title": "TEST_Workshop_Instructor_Fields",
            "description": "Test workshop with instructor fields",
            "date": "2025-01-15",
            "time": "10:00",
            "duration": "2 hours",
            "instructor": "John Doe",
            "instructor_title": "Ex-McKinsey Partner",
            "meeting_link": "https://zoom.us/j/123456789",
            "topics": ["Case Interview", "Profitability"],
            "is_past": False,
            "is_free": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/workshops",
            json=workshop_data
        )
        assert response.status_code == 200, f"Workshop creation failed: {response.text}"
        data = response.json()
        assert 'workshop_id' in data
        print(f"Created workshop: {data['workshop_id']}")
        
        # Verify workshop was created with correct fields
        workshops_res = self.session.get(f"{BASE_URL}/api/admin/workshops")
        workshops = workshops_res.json().get('workshops', [])
        created_workshop = next((w for w in workshops if w.get('id') == data['workshop_id']), None)
        
        assert created_workshop is not None, "Created workshop not found"
        assert created_workshop.get('instructor') == "John Doe"
        assert created_workshop.get('instructor_title') == "Ex-McKinsey Partner"
        assert created_workshop.get('meeting_link') == "https://zoom.us/j/123456789"
        print("Workshop fields verified: instructor, instructor_title, meeting_link")
        
        return data['workshop_id']
    
    def test_create_completed_workshop_with_recording(self):
        """Test creating completed workshop with video_url"""
        workshop_data = {
            "title": "TEST_Completed_Workshop",
            "description": "Test completed workshop with recording",
            "date": "2024-12-01",
            "time": "14:00",
            "duration": "1.5 hours",
            "instructor": "Jane Smith",
            "instructor_title": "BCG Manager",
            "video_url": "https://youtube.com/watch?v=test123",
            "topics": ["Market Entry", "Growth Strategy"],
            "is_past": True,
            "is_free": False
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/workshops",
            json=workshop_data
        )
        assert response.status_code == 200, f"Workshop creation failed: {response.text}"
        data = response.json()
        print(f"Created completed workshop: {data['workshop_id']}")
        return data['workshop_id']
    
    def test_update_workshop(self):
        """Test updating workshop details"""
        # First create a workshop
        workshop_data = {
            "title": "TEST_Workshop_To_Update",
            "description": "Original description",
            "date": "2025-02-01",
            "time": "09:00",
            "duration": "2 hours",
            "instructor": "Original Instructor",
            "instructor_title": "Original Title",
            "topics": ["Test Topic"],
            "is_past": False,
            "is_free": True
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/admin/workshops", json=workshop_data)
        assert create_res.status_code == 200
        workshop_id = create_res.json()['workshop_id']
        
        # Update the workshop
        update_data = {
            "title": "TEST_Workshop_Updated",
            "instructor": "Updated Instructor",
            "instructor_title": "Updated Title",
            "meeting_link": "https://meet.google.com/abc-def-ghi"
        }
        
        update_res = self.session.put(
            f"{BASE_URL}/api/admin/workshops/{workshop_id}",
            json=update_data
        )
        assert update_res.status_code == 200, f"Workshop update failed: {update_res.text}"
        print(f"Workshop {workshop_id} updated successfully")
        
        # Verify update
        workshops_res = self.session.get(f"{BASE_URL}/api/admin/workshops")
        workshops = workshops_res.json().get('workshops', [])
        updated_workshop = next((w for w in workshops if w.get('id') == workshop_id), None)
        
        assert updated_workshop is not None
        assert updated_workshop.get('title') == "TEST_Workshop_Updated"
        assert updated_workshop.get('instructor') == "Updated Instructor"
        print("Workshop update verified")
    
    def test_delete_workshop(self):
        """Test deleting a workshop"""
        # Create a workshop to delete
        workshop_data = {
            "title": "TEST_Workshop_To_Delete",
            "description": "Will be deleted",
            "date": "2025-03-01",
            "time": "11:00",
            "duration": "1 hour",
            "instructor": "Delete Test",
            "instructor_title": "Test Title",
            "topics": ["Delete Test"],
            "is_past": False,
            "is_free": True
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/admin/workshops", json=workshop_data)
        assert create_res.status_code == 200
        workshop_id = create_res.json()['workshop_id']
        
        # Delete the workshop
        delete_res = self.session.delete(f"{BASE_URL}/api/admin/workshops/{workshop_id}")
        assert delete_res.status_code == 200, f"Workshop delete failed: {delete_res.text}"
        print(f"Workshop {workshop_id} deleted successfully")
        
        # Verify deletion
        workshops_res = self.session.get(f"{BASE_URL}/api/admin/workshops")
        workshops = workshops_res.json().get('workshops', [])
        deleted_workshop = next((w for w in workshops if w.get('id') == workshop_id), None)
        assert deleted_workshop is None, "Workshop should be deleted"
        print("Workshop deletion verified")


class TestCandidateWorkshopView:
    """Test candidate view of workshops with instructor->mentor_name mapping"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin and candidate sessions"""
        self.admin_session = requests.Session()
        self.candidate_session = requests.Session()
        
        # Login as admin
        admin_res = self.admin_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert admin_res.status_code == 200
        
        # Login as candidate with subscription
        candidate_res = self.candidate_session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription"
        )
        assert candidate_res.status_code == 200
        self.candidate_user = candidate_res.json()
        yield
        
        # Cleanup test workshops
        try:
            workshops_res = self.admin_session.get(f"{BASE_URL}/api/admin/workshops")
            if workshops_res.status_code == 200:
                workshops = workshops_res.json().get('workshops', [])
                for w in workshops:
                    if w.get('title', '').startswith('TEST_'):
                        self.admin_session.delete(f"{BASE_URL}/api/admin/workshops/{w['id']}")
        except:
            pass
    
    def test_candidate_login_success(self):
        """Test candidate mock login"""
        assert 'id' in self.candidate_user
        print(f"Candidate login successful: {self.candidate_user.get('email')}")
    
    def test_workshop_instructor_to_mentor_name_mapping(self):
        """Test that instructor field maps to mentor_name for candidates"""
        # Create workshop as admin with instructor field
        workshop_data = {
            "title": "TEST_Instructor_Mapping_Workshop",
            "description": "Testing instructor to mentor_name mapping",
            "date": "2025-01-20",
            "time": "15:00",
            "duration": "2 hours",
            "instructor": "Test Instructor Name",
            "instructor_title": "Senior Consultant",
            "meeting_link": "https://zoom.us/j/mapping-test",
            "topics": ["Mapping Test"],
            "is_past": False,
            "is_free": True
        }
        
        create_res = self.admin_session.post(
            f"{BASE_URL}/api/admin/workshops",
            json=workshop_data
        )
        assert create_res.status_code == 200
        workshop_id = create_res.json()['workshop_id']
        print(f"Created test workshop: {workshop_id}")
        
        # Fetch workshops as candidate
        candidate_workshops_res = self.candidate_session.get(
            f"{BASE_URL}/api/resources/workshops"
        )
        assert candidate_workshops_res.status_code == 200, f"Failed to get workshops: {candidate_workshops_res.text}"
        
        workshops = candidate_workshops_res.json()
        test_workshop = next((w for w in workshops if w.get('id') == workshop_id), None)
        
        assert test_workshop is not None, "Test workshop not found in candidate view"
        
        # Verify mentor_name is populated from instructor
        assert test_workshop.get('mentor_name') == "Test Instructor Name", \
            f"Expected mentor_name='Test Instructor Name', got '{test_workshop.get('mentor_name')}'"
        
        # Verify meeting_link is present
        assert test_workshop.get('meeting_link') == "https://zoom.us/j/mapping-test", \
            f"Expected meeting_link, got '{test_workshop.get('meeting_link')}'"
        
        print("instructor->mentor_name mapping verified!")
        print(f"Workshop data for candidate: mentor_name={test_workshop.get('mentor_name')}, meeting_link={test_workshop.get('meeting_link')}")


class TestAdminVideos:
    """Test Admin Videos CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert response.status_code == 200
        yield
        # Cleanup
        try:
            videos_res = self.session.get(f"{BASE_URL}/api/admin/videos")
            if videos_res.status_code == 200:
                videos = videos_res.json().get('videos', [])
                for v in videos:
                    if v.get('title', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/admin/videos/{v['id']}")
        except:
            pass
    
    def test_get_admin_videos(self):
        """Test GET /api/admin/videos"""
        response = self.session.get(f"{BASE_URL}/api/admin/videos")
        assert response.status_code == 200
        data = response.json()
        assert 'videos' in data
        print(f"Found {len(data['videos'])} videos")
    
    def test_create_video(self):
        """Test creating a video"""
        video_data = {
            "title": "TEST_Video_Creation",
            "description": "Test video description",
            "module": "Case Fundamentals",
            "video_url": "https://youtube.com/watch?v=testvideo",
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": "45 min",
            "order": 1,
            "is_free": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/videos",
            json=video_data
        )
        assert response.status_code == 200, f"Video creation failed: {response.text}"
        data = response.json()
        assert 'video_id' in data
        print(f"Created video: {data['video_id']}")


class TestAdminMaterials:
    """Test Admin Materials CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin"
        )
        assert response.status_code == 200
        yield
        # Cleanup
        try:
            materials_res = self.session.get(f"{BASE_URL}/api/admin/materials")
            if materials_res.status_code == 200:
                materials = materials_res.json().get('materials', [])
                for m in materials:
                    if m.get('title', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/admin/materials/{m['id']}")
        except:
            pass
    
    def test_get_admin_materials(self):
        """Test GET /api/admin/materials"""
        response = self.session.get(f"{BASE_URL}/api/admin/materials")
        assert response.status_code == 200
        data = response.json()
        assert 'materials' in data
        print(f"Found {len(data['materials'])} materials")
    
    def test_create_material(self):
        """Test creating a material"""
        material_data = {
            "title": "TEST_Material_Creation",
            "description": "Test material description",
            "category": "Frameworks",
            "file_url": "https://example.com/test.pdf",
            "file_type": "pdf",
            "is_free": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/materials",
            json=material_data
        )
        assert response.status_code == 200, f"Material creation failed: {response.text}"
        data = response.json()
        assert 'material_id' in data
        print(f"Created material: {data['material_id']}")


class TestCandidateResourcesView:
    """Test candidate view of videos and materials"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup candidate session"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription"
        )
        assert response.status_code == 200
        yield
    
    def test_get_candidate_videos(self):
        """Test GET /api/resources/videos for candidates"""
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        assert response.status_code == 200, f"Failed to get videos: {response.text}"
        videos = response.json()
        assert isinstance(videos, list)
        print(f"Candidate can see {len(videos)} videos")
        
        # Check video structure
        if videos:
            video = videos[0]
            assert 'id' in video
            assert 'title' in video
            print(f"Sample video: {video.get('title')}")
    
    def test_get_candidate_materials(self):
        """Test GET /api/resources/materials for candidates"""
        response = self.session.get(f"{BASE_URL}/api/resources/materials")
        assert response.status_code == 200, f"Failed to get materials: {response.text}"
        materials = response.json()
        assert isinstance(materials, list)
        print(f"Candidate can see {len(materials)} materials")
        
        # Check material structure
        if materials:
            material = materials[0]
            assert 'id' in material
            assert 'title' in material
            print(f"Sample material: {material.get('title')}")
    
    def test_get_candidate_workshops(self):
        """Test GET /api/resources/workshops for candidates"""
        response = self.session.get(f"{BASE_URL}/api/resources/workshops")
        assert response.status_code == 200, f"Failed to get workshops: {response.text}"
        workshops = response.json()
        assert isinstance(workshops, list)
        print(f"Candidate can see {len(workshops)} workshops")
        
        # Check workshop structure
        if workshops:
            workshop = workshops[0]
            assert 'id' in workshop
            assert 'title' in workshop
            assert 'mentor_name' in workshop  # Should have mentor_name mapped from instructor
            print(f"Sample workshop: {workshop.get('title')}, mentor: {workshop.get('mentor_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
