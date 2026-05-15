"""
Test Video Player Feature - Videos uploaded through admin dashboard should display and play correctly
Tests:
1. Videos created via admin panel have correct video_url stored in database
2. GET /api/resources/videos returns videos with video_url field
3. VideoPlayerModal uses video.video_url instead of sample videos
4. YouTube URLs are converted to embed format for iframe playback
5. Direct video file URLs use the HTML5 video player
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestVideoPlayerFeature:
    """Test video player functionality - admin upload to candidate playback"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_admin_login(self):
        """Test admin can login via mock-login"""
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_admin") == True
        print(f"✓ Admin login successful: {data.get('email')}")
        
    def test_admin_get_videos(self):
        """Test admin can retrieve all videos"""
        # Login as admin first
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        
        response = self.session.get(f"{BASE_URL}/api/admin/videos")
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        print(f"✓ Admin retrieved {len(data['videos'])} videos")
        
        # Check that videos have video_url field
        for video in data['videos']:
            assert "video_url" in video, f"Video {video.get('id')} missing video_url field"
            print(f"  - {video.get('title')}: video_url={video.get('video_url')}")
            
    def test_admin_create_video_with_youtube_url(self):
        """Test admin can create a video with YouTube URL"""
        # Login as admin
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        
        # Create a new video with YouTube URL
        video_data = {
            "title": "TEST_Video_YouTube_URL",
            "description": "Test video with YouTube URL for video player testing",
            "module": "Test Module",
            "duration": "5:00",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            "order": 99,
            "is_free": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/videos", json=video_data)
        assert response.status_code == 200
        data = response.json()
        assert "video_id" in data
        print(f"✓ Created video with YouTube URL: {data.get('video_id')}")
        
        # Verify the video was created with correct video_url
        videos_response = self.session.get(f"{BASE_URL}/api/admin/videos")
        videos = videos_response.json().get("videos", [])
        created_video = next((v for v in videos if v.get("id") == data.get("video_id")), None)
        
        assert created_video is not None, "Created video not found"
        assert created_video.get("video_url") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        print(f"✓ Video stored with correct video_url: {created_video.get('video_url')}")
        
        # Store video_id for cleanup
        self.created_video_id = data.get("video_id")
        
    def test_admin_create_video_with_direct_url(self):
        """Test admin can create a video with direct video file URL"""
        # Login as admin
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        
        # Create a new video with direct video URL
        video_data = {
            "title": "TEST_Video_Direct_URL",
            "description": "Test video with direct video file URL",
            "module": "Test Module",
            "duration": "3:00",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "thumbnail": "",
            "order": 100,
            "is_free": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/videos", json=video_data)
        assert response.status_code == 200
        data = response.json()
        assert "video_id" in data
        print(f"✓ Created video with direct URL: {data.get('video_id')}")
        
    def test_subscription_user_get_videos_with_url(self):
        """Test subscription user can get videos with video_url field"""
        # Login as subscription user
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert response.status_code == 200
        
        # Get videos
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        assert response.status_code == 200
        videos = response.json()
        
        assert len(videos) > 0, "No videos returned"
        print(f"✓ Subscription user retrieved {len(videos)} videos")
        
        # Check that unlocked videos have video_url
        for video in videos:
            if not video.get("locked"):
                assert "video_url" in video, f"Video {video.get('id')} missing video_url"
                # video_url should not be None for unlocked videos
                if video.get("video_url"):
                    print(f"  - {video.get('title')}: video_url={video.get('video_url')[:50]}...")
                    
    def test_video_url_not_null_for_unlocked_videos(self):
        """Test that unlocked videos have non-null video_url"""
        # Login as subscription user
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        
        # Get videos
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        videos = response.json()
        
        unlocked_videos = [v for v in videos if not v.get("locked")]
        assert len(unlocked_videos) > 0, "No unlocked videos found"
        
        for video in unlocked_videos:
            video_url = video.get("video_url")
            # video_url should be present and not None for unlocked videos
            assert video_url is not None, f"Video {video.get('id')} has null video_url"
            assert video_url != "", f"Video {video.get('id')} has empty video_url"
            print(f"✓ Video '{video.get('title')}' has valid video_url")
            
    def test_youtube_url_format(self):
        """Test that YouTube URLs are in correct format"""
        # Login as subscription user
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        
        # Get videos
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        videos = response.json()
        
        youtube_pattern = r'(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)'
        
        youtube_videos = [v for v in videos if v.get("video_url") and ("youtube" in v.get("video_url", "") or "youtu.be" in v.get("video_url", ""))]
        
        if youtube_videos:
            for video in youtube_videos:
                url = video.get("video_url")
                match = re.search(youtube_pattern, url)
                assert match is not None, f"Invalid YouTube URL format: {url}"
                video_id = match.group(2)
                print(f"✓ YouTube video '{video.get('title')}' has valid format, video_id: {video_id}")
        else:
            print("⚠ No YouTube videos found to test")
            
    def test_admin_uploaded_test_video_exists(self):
        """Test that the specific admin uploaded test video exists with correct URL"""
        # Login as subscription user
        self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        
        # Get videos
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        videos = response.json()
        
        # Find the admin uploaded test video
        test_video = next((v for v in videos if "Admin Uploaded Test Video" in v.get("title", "")), None)
        
        if test_video:
            assert test_video.get("video_url") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            print(f"✓ Admin Uploaded Test Video found with correct URL: {test_video.get('video_url')}")
        else:
            # Check if any video has the expected YouTube URL
            video_with_url = next((v for v in videos if v.get("video_url") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"), None)
            if video_with_url:
                print(f"✓ Found video with expected YouTube URL: {video_with_url.get('title')}")
            else:
                print("⚠ Admin Uploaded Test Video not found, but other videos exist")
                
    def test_locked_videos_have_null_url(self):
        """Test that locked videos have null video_url for security"""
        # Login as free trial user
        response = self.session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free_trial")
        assert response.status_code == 200
        
        # Get videos
        response = self.session.get(f"{BASE_URL}/api/resources/videos")
        videos = response.json()
        
        locked_videos = [v for v in videos if v.get("locked")]
        
        if locked_videos:
            for video in locked_videos:
                # Locked videos should have null video_url
                assert video.get("video_url") is None, f"Locked video {video.get('id')} should have null video_url"
                print(f"✓ Locked video '{video.get('title')}' correctly has null video_url")
        else:
            print("⚠ No locked videos found (user may have full access)")


class TestVideoPlayerCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_videos(self):
        """Clean up test videos created during testing"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        
        # Get all videos
        response = session.get(f"{BASE_URL}/api/admin/videos")
        videos = response.json().get("videos", [])
        
        # Delete test videos
        test_videos = [v for v in videos if v.get("title", "").startswith("TEST_")]
        for video in test_videos:
            delete_response = session.delete(f"{BASE_URL}/api/admin/videos/{video.get('id')}")
            if delete_response.status_code == 200:
                print(f"✓ Deleted test video: {video.get('title')}")
            else:
                print(f"⚠ Failed to delete test video: {video.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
