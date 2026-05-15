"""
Test Admin Panel Features - Time Slot Picker and Chunked File Upload
Tests for gradnext Admin Panel P0 features:
1. Admin login via mock-login endpoint
2. Admin dashboard stats
3. Peer Practice section with availability management
4. Chunked upload endpoints (init, chunk, finalize)
5. Videos and Materials CRUD with file upload
6. Sales & Invoices section
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin authentication via mock-login"""
    
    def test_admin_mock_login(self):
        """Test admin can login via mock-login endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_admin") == True
        assert data.get("email") == "admin@gradnext.co"
        print(f"SUCCESS: Admin login works - user: {data.get('name')}")


class TestAdminDashboard:
    """Test admin dashboard endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_admin_stats(self):
        """Test admin dashboard stats endpoint"""
        response = self.session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected stats are present
        expected_keys = ["users", "mentors", "videos", "workshops", "drills", "materials", "bookings", "peer_sessions"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], int), f"{key} should be an integer"
        
        print(f"SUCCESS: Admin stats - Users: {data['users']}, Mentors: {data['mentors']}, Videos: {data['videos']}")


class TestPeerPracticeSection:
    """Test Peer Practice management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_get_peer_practice_users(self):
        """Test getting peer practice users list"""
        response = self.session.get(f"{BASE_URL}/api/admin/peer-practice/users")
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert isinstance(data["users"], list)
        
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user
            assert "name" in user
            assert "email" in user
        
        print(f"SUCCESS: Got {len(data['users'])} peer practice users")
    
    def test_update_peer_availability(self):
        """Test updating user's peer practice availability with time slots"""
        # First get a user
        users_response = self.session.get(f"{BASE_URL}/api/admin/peer-practice/users")
        users = users_response.json().get("users", [])
        
        if len(users) == 0:
            pytest.skip("No users available for testing")
        
        user_id = users[0]["id"]
        
        # Update availability with From/To time slots
        availability = [
            {"day": "Monday", "slots": [{"from": "09:00", "to": "17:00"}]},
            {"day": "Tuesday", "slots": [{"from": "10:00", "to": "18:00"}]},
            {"day": "Wednesday", "slots": [{"from": "09:00", "to": "12:00"}, {"from": "14:00", "to": "17:00"}]}
        ]
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/peer-practice/users/{user_id}/availability",
            json={"availability": availability}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"SUCCESS: Updated peer availability for user {user_id}")
    
    def test_update_peer_practice_status(self):
        """Test updating user's peer practice status (active/paused/removed)"""
        # First get a user
        users_response = self.session.get(f"{BASE_URL}/api/admin/peer-practice/users")
        users = users_response.json().get("users", [])
        
        if len(users) == 0:
            pytest.skip("No users available for testing")
        
        user_id = users[0]["id"]
        
        # Test pausing
        response = self.session.put(
            f"{BASE_URL}/api/admin/peer-practice/users/{user_id}/status",
            json={"status": "paused"}
        )
        assert response.status_code == 200
        
        # Test reactivating
        response = self.session.put(
            f"{BASE_URL}/api/admin/peer-practice/users/{user_id}/status",
            json={"status": "active"}
        )
        assert response.status_code == 200
        print(f"SUCCESS: Updated peer practice status for user {user_id}")


class TestChunkedUpload:
    """Test chunked file upload endpoints for large files (2GB+)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_chunked_upload_init(self):
        """Test initializing a chunked upload session"""
        upload_id = f"test-{str(uuid.uuid4())[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/upload/init",
            json={
                "filename": "test_video.mp4",
                "filesize": 104857600,  # 100MB
                "filetype": "video/mp4",
                "total_chunks": 20,
                "upload_id": upload_id,
                "category": "videos"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("upload_id") == upload_id
        assert "message" in data
        
        print(f"SUCCESS: Chunked upload initialized with ID: {upload_id}")
        return upload_id
    
    def test_chunked_upload_full_flow(self):
        """Test full chunked upload flow: init -> chunk -> finalize"""
        upload_id = f"test-full-{str(uuid.uuid4())[:8]}"
        
        # Step 1: Initialize upload
        init_response = self.session.post(
            f"{BASE_URL}/api/admin/upload/init",
            json={
                "filename": "test_small.txt",
                "filesize": 1024,  # 1KB
                "filetype": "text/plain",
                "total_chunks": 1,
                "upload_id": upload_id,
                "category": "materials"
            }
        )
        assert init_response.status_code == 200
        assert init_response.json().get("success") == True
        print(f"Step 1: Upload initialized - {upload_id}")
        
        # Step 2: Upload a chunk
        chunk_data = b"Test file content for chunked upload testing"
        files = {"chunk": ("chunk_0", chunk_data, "application/octet-stream")}
        data = {
            "upload_id": upload_id,
            "chunk_index": 0,
            "total_chunks": 1
        }
        
        chunk_response = self.session.post(
            f"{BASE_URL}/api/admin/upload/chunk",
            files=files,
            data=data
        )
        assert chunk_response.status_code == 200
        chunk_result = chunk_response.json()
        assert chunk_result.get("success") == True
        assert chunk_result.get("chunk_index") == 0
        print(f"Step 2: Chunk uploaded - received {chunk_result.get('received')}/{chunk_result.get('total')}")
        
        # Step 3: Finalize upload
        finalize_response = self.session.post(
            f"{BASE_URL}/api/admin/upload/finalize",
            json={
                "upload_id": upload_id,
                "filename": "test_small.txt",
                "total_chunks": 1,
                "category": "materials"
            }
        )
        assert finalize_response.status_code == 200
        finalize_result = finalize_response.json()
        assert finalize_result.get("success") == True
        assert "url" in finalize_result
        
        print(f"SUCCESS: Full chunked upload completed - URL: {finalize_result.get('url')}")


class TestVideosSection:
    """Test Videos CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_get_all_videos(self):
        """Test getting all videos"""
        response = self.session.get(f"{BASE_URL}/api/admin/videos")
        assert response.status_code == 200
        data = response.json()
        
        assert "videos" in data
        assert isinstance(data["videos"], list)
        
        if len(data["videos"]) > 0:
            video = data["videos"][0]
            assert "id" in video
            assert "title" in video
            assert "module" in video
        
        print(f"SUCCESS: Got {len(data['videos'])} videos")
    
    def test_create_video(self):
        """Test creating a new video"""
        video_data = {
            "title": "TEST_Video_" + str(uuid.uuid4())[:8],
            "description": "Test video description",
            "module": "Getting Started",
            "duration": "10:00",
            "video_url": "https://example.com/test-video.mp4",
            "thumbnail": "https://example.com/thumbnail.jpg",
            "order": 99,
            "is_free": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/videos", json=video_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "video_id" in data
        print(f"SUCCESS: Created video with ID: {data['video_id']}")
        
        # Cleanup - delete the test video
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/videos/{data['video_id']}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test video")


class TestMaterialsSection:
    """Test Materials CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_get_all_materials(self):
        """Test getting all materials"""
        response = self.session.get(f"{BASE_URL}/api/admin/materials")
        assert response.status_code == 200
        data = response.json()
        
        assert "materials" in data
        assert isinstance(data["materials"], list)
        
        if len(data["materials"]) > 0:
            material = data["materials"][0]
            assert "id" in material
            assert "title" in material
            assert "category" in material
        
        print(f"SUCCESS: Got {len(data['materials'])} materials")
    
    def test_create_material(self):
        """Test creating a new material"""
        material_data = {
            "title": "TEST_Material_" + str(uuid.uuid4())[:8],
            "category": "Template",
            "description": "Test material description",
            "file_type": "pdf",
            "file_url": "https://example.com/test-material.pdf",
            "is_free": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/materials", json=material_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "material_id" in data
        print(f"SUCCESS: Created material with ID: {data['material_id']}")
        
        # Cleanup - delete the test material
        delete_response = self.session.delete(f"{BASE_URL}/api/admin/materials/{data['material_id']}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test material")


class TestSalesSection:
    """Test Sales & Invoices endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        
    def test_get_sales_metrics(self):
        """Test getting sales metrics"""
        response = self.session.get(f"{BASE_URL}/api/sales/metrics")
        assert response.status_code == 200
        data = response.json()
        
        expected_keys = ["total_revenue", "this_month_revenue", "paid_invoices", "average_order_value"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
        
        print(f"SUCCESS: Sales metrics - Total Revenue: ₹{data.get('total_revenue', 0)}")
    
    def test_get_invoices(self):
        """Test getting invoices list"""
        response = self.session.get(f"{BASE_URL}/api/sales/invoices")
        assert response.status_code == 200
        data = response.json()
        
        assert "invoices" in data
        assert isinstance(data["invoices"], list)
        
        print(f"SUCCESS: Got {len(data['invoices'])} invoices")
    
    def test_get_pnl(self):
        """Test getting P&L summary"""
        response = self.session.get(f"{BASE_URL}/api/sales/pnl")
        assert response.status_code == 200
        data = response.json()
        
        expected_keys = ["gross_profit", "operating_expenses", "net_profit"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
        
        print(f"SUCCESS: P&L - Gross Profit: ₹{data.get('gross_profit', 0)}, Net Profit: ₹{data.get('net_profit', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
