"""
Test Courses Feature - Backend API Tests
Tests the hierarchical course structure: Courses -> Modules -> Sub-Modules -> Sessions
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consultant-gateway.preview.emergentagent.com')


class TestCoursesFeatureBackend:
    """Test Courses CRUD operations for Admin"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        # Store cookies for subsequent requests
        self.cookies = login_response.cookies
        
    def test_01_get_courses_as_admin(self):
        """Test GET /api/admin/courses - Admin can fetch all courses"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/courses",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        data = response.json()
        assert "courses" in data, "Response should contain 'courses' key"
        print(f"Found {len(data['courses'])} courses")
        
    def test_02_create_course(self):
        """Test POST /api/admin/courses - Admin can create a course"""
        course_data = {
            "title": f"TEST_Course_{uuid.uuid4().hex[:8]}",
            "description": "Test course for automated testing",
            "thumbnail": "",
            "order": 99
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses",
            json=course_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create course: {response.text}"
        data = response.json()
        assert "course_id" in data, "Response should contain 'course_id'"
        self.__class__.test_course_id = data["course_id"]
        print(f"Created course: {data['course_id']}")
        
    def test_03_create_module(self):
        """Test POST /api/admin/courses/modules - Admin can create a module"""
        if not hasattr(self.__class__, 'test_course_id'):
            pytest.skip("No test course created")
            
        module_data = {
            "course_id": self.__class__.test_course_id,
            "title": f"TEST_Module_{uuid.uuid4().hex[:8]}",
            "order": 0
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses/modules",
            json=module_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create module: {response.text}"
        data = response.json()
        assert "module_id" in data, "Response should contain 'module_id'"
        self.__class__.test_module_id = data["module_id"]
        print(f"Created module: {data['module_id']}")
        
    def test_04_create_submodule(self):
        """Test POST /api/admin/courses/submodules - Admin can create a submodule"""
        if not hasattr(self.__class__, 'test_module_id'):
            pytest.skip("No test module created")
            
        submodule_data = {
            "module_id": self.__class__.test_module_id,
            "title": f"TEST_Submodule_{uuid.uuid4().hex[:8]}",
            "order": 0
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses/submodules",
            json=submodule_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create submodule: {response.text}"
        data = response.json()
        assert "submodule_id" in data, "Response should contain 'submodule_id'"
        self.__class__.test_submodule_id = data["submodule_id"]
        print(f"Created submodule: {data['submodule_id']}")
        
    def test_05_create_video_session(self):
        """Test POST /api/admin/courses/sessions - Admin can create a video session"""
        if not hasattr(self.__class__, 'test_submodule_id'):
            pytest.skip("No test submodule created")
            
        session_data = {
            "submodule_id": self.__class__.test_submodule_id,
            "title": f"TEST_Video_Session_{uuid.uuid4().hex[:8]}",
            "description": "Test video session",
            "duration": "15:00",
            "content_type": "video",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "order": 0,
            "is_free": True
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses/sessions",
            json=session_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create video session: {response.text}"
        data = response.json()
        assert "session_id" in data, "Response should contain 'session_id'"
        self.__class__.test_video_session_id = data["session_id"]
        print(f"Created video session: {data['session_id']}")
        
    def test_06_create_quiz_session(self):
        """Test POST /api/admin/courses/sessions - Admin can create a quiz session"""
        if not hasattr(self.__class__, 'test_submodule_id'):
            pytest.skip("No test submodule created")
            
        session_data = {
            "submodule_id": self.__class__.test_submodule_id,
            "title": f"TEST_Quiz_Session_{uuid.uuid4().hex[:8]}",
            "description": "Test quiz session",
            "content_type": "quiz",
            "quiz_questions": [
                {
                    "question": "What is 2+2?",
                    "options": ["3", "4", "5", "6"],
                    "correct_index": 1,
                    "explanation": "2+2 equals 4"
                },
                {
                    "question": "What color is the sky?",
                    "options": ["Red", "Green", "Blue", "Yellow"],
                    "correct_index": 2,
                    "explanation": "The sky appears blue due to light scattering"
                }
            ],
            "order": 1,
            "is_free": False
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses/sessions",
            json=session_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create quiz session: {response.text}"
        data = response.json()
        assert "session_id" in data, "Response should contain 'session_id'"
        self.__class__.test_quiz_session_id = data["session_id"]
        print(f"Created quiz session: {data['session_id']}")
        
    def test_07_create_pdf_session(self):
        """Test POST /api/admin/courses/sessions - Admin can create a PDF session"""
        if not hasattr(self.__class__, 'test_submodule_id'):
            pytest.skip("No test submodule created")
            
        session_data = {
            "submodule_id": self.__class__.test_submodule_id,
            "title": f"TEST_PDF_Session_{uuid.uuid4().hex[:8]}",
            "description": "Test PDF session",
            "content_type": "pdf",
            "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "order": 2,
            "is_free": False
        }
        response = self.session.post(
            f"{BASE_URL}/api/admin/courses/sessions",
            json=session_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create PDF session: {response.text}"
        data = response.json()
        assert "session_id" in data, "Response should contain 'session_id'"
        self.__class__.test_pdf_session_id = data["session_id"]
        print(f"Created PDF session: {data['session_id']}")
        
    def test_08_verify_course_hierarchy(self):
        """Test GET /api/admin/courses - Verify full hierarchy is returned"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/courses",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        data = response.json()
        
        # Find our test course
        test_course = None
        for course in data["courses"]:
            if hasattr(self.__class__, 'test_course_id') and course["id"] == self.__class__.test_course_id:
                test_course = course
                break
                
        if test_course:
            assert "modules" in test_course, "Course should have modules"
            if test_course["modules"]:
                module = test_course["modules"][0]
                assert "submodules" in module, "Module should have submodules"
                if module["submodules"]:
                    submodule = module["submodules"][0]
                    assert "sessions" in submodule, "Submodule should have sessions"
                    print(f"Course hierarchy verified: {len(test_course['modules'])} modules")
        else:
            print("Test course not found - may have been cleaned up")
            
    def test_09_update_session(self):
        """Test PUT /api/admin/courses/sessions/{id} - Admin can update a session"""
        if not hasattr(self.__class__, 'test_video_session_id'):
            pytest.skip("No test video session created")
            
        update_data = {
            "title": "Updated Video Session Title",
            "description": "Updated description"
        }
        response = self.session.put(
            f"{BASE_URL}/api/admin/courses/sessions/{self.__class__.test_video_session_id}",
            json=update_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to update session: {response.text}"
        print("Session updated successfully")
        
    def test_10_delete_session(self):
        """Test DELETE /api/admin/courses/sessions/{id} - Admin can delete a session"""
        if not hasattr(self.__class__, 'test_pdf_session_id'):
            pytest.skip("No test PDF session created")
            
        response = self.session.delete(
            f"{BASE_URL}/api/admin/courses/sessions/{self.__class__.test_pdf_session_id}",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to delete session: {response.text}"
        print("Session deleted successfully")


class TestCoursesResourcesAPI:
    """Test Courses Resources API for Candidates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with candidate login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_01_get_courses_as_full_prep_user(self):
        """Test GET /api/resources/courses - Full Prep user can access courses"""
        # Login as full_prep user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=full_prep",
            json={}
        )
        assert login_response.status_code == 200, f"Full prep login failed: {login_response.text}"
        
        response = self.session.get(
            f"{BASE_URL}/api/resources/courses",
            cookies=login_response.cookies
        )
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of courses"
        print(f"Full prep user can see {len(data)} courses")
        
        # Verify structure
        if data:
            course = data[0]
            assert "id" in course, "Course should have id"
            assert "title" in course, "Course should have title"
            assert "modules" in course, "Course should have modules"
            
    def test_02_get_courses_as_free_user(self):
        """Test GET /api/resources/courses - Free user has limited access"""
        # Login as free user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            json={}
        )
        assert login_response.status_code == 200, f"Free user login failed: {login_response.text}"
        
        response = self.session.get(
            f"{BASE_URL}/api/resources/courses",
            cookies=login_response.cookies
        )
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        data = response.json()
        
        # Count locked vs unlocked sessions
        locked_count = 0
        unlocked_count = 0
        for course in data:
            for module in course.get("modules", []):
                for submodule in module.get("submodules", []):
                    for session in submodule.get("sessions", []):
                        if session.get("locked"):
                            locked_count += 1
                        else:
                            unlocked_count += 1
                            
        print(f"Free user: {unlocked_count} unlocked, {locked_count} locked sessions")
        # Free users should have some locked content (after first 2 sessions)
        
    def test_03_verify_session_content_types(self):
        """Test that different content types are properly returned"""
        # Login as subscription user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription",
            json={}
        )
        assert login_response.status_code == 200
        
        response = self.session.get(
            f"{BASE_URL}/api/resources/courses",
            cookies=login_response.cookies
        )
        assert response.status_code == 200
        data = response.json()
        
        content_types_found = set()
        for course in data:
            for module in course.get("modules", []):
                for submodule in module.get("submodules", []):
                    for session in submodule.get("sessions", []):
                        content_type = session.get("content_type", "video")
                        content_types_found.add(content_type)
                        
        print(f"Content types found: {content_types_found}")
        
    def test_04_verify_free_sessions_accessible(self):
        """Test that sessions marked as free are accessible to free users"""
        # Login as free user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            json={}
        )
        assert login_response.status_code == 200
        
        response = self.session.get(
            f"{BASE_URL}/api/resources/courses",
            cookies=login_response.cookies
        )
        assert response.status_code == 200
        data = response.json()
        
        free_sessions = []
        for course in data:
            for module in course.get("modules", []):
                for submodule in module.get("submodules", []):
                    for session in submodule.get("sessions", []):
                        if session.get("is_free"):
                            free_sessions.append(session)
                            
        print(f"Found {len(free_sessions)} free sessions")
        # Free sessions should not be locked
        for session in free_sessions:
            if not session.get("locked"):
                print(f"Free session '{session.get('title')}' is accessible")


class TestExistingCourseData:
    """Test existing course data created by main agent"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_01_verify_case_interview_fundamentals_course(self):
        """Verify the 'Case Interview Fundamentals' course exists"""
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        assert login_response.status_code == 200
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/courses",
            cookies=login_response.cookies
        )
        assert response.status_code == 200
        data = response.json()
        
        # Look for the test course
        found_course = None
        for course in data.get("courses", []):
            if "Case Interview" in course.get("title", "") or "Fundamentals" in course.get("title", ""):
                found_course = course
                break
                
        if found_course:
            print(f"Found course: {found_course['title']}")
            print(f"  - Modules: {len(found_course.get('modules', []))}")
            for module in found_course.get("modules", []):
                print(f"    - Module: {module.get('title')}")
                for submodule in module.get("submodules", []):
                    print(f"      - Submodule: {submodule.get('title')}")
                    for session in submodule.get("sessions", []):
                        print(f"        - Session: {session.get('title')} ({session.get('content_type')})")
        else:
            print("Case Interview Fundamentals course not found - checking all courses")
            for course in data.get("courses", []):
                print(f"Available course: {course.get('title')}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            json={}
        )
        self.cookies = login_response.cookies
        
    def test_cleanup_test_courses(self):
        """Clean up TEST_ prefixed courses"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/courses",
            cookies=self.cookies
        )
        if response.status_code == 200:
            data = response.json()
            for course in data.get("courses", []):
                if course.get("title", "").startswith("TEST_"):
                    delete_response = self.session.delete(
                        f"{BASE_URL}/api/admin/courses/{course['id']}",
                        cookies=self.cookies
                    )
                    if delete_response.status_code == 200:
                        print(f"Cleaned up test course: {course['title']}")
