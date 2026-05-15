"""
Test Suite for Unified Authentication System
Tests: Email+OTP, Google OAuth, Mock Login, Session Management, Role-based Access
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")


class TestSendOTP:
    """Test POST /api/auth/send-otp endpoint"""
    
    def test_send_otp_new_user(self):
        """Send OTP to a new email - should indicate new user"""
        test_email = f"test_new_{int(time.time())}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "OTP sent" in data["message"]
        assert data["is_new_user"] == True
        print(f"✓ Send OTP to new user passed - email: {test_email}")
    
    def test_send_otp_invalid_email(self):
        """Send OTP with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": "invalid-email"}
        )
        assert response.status_code == 422  # Validation error
        print("✓ Invalid email validation passed")
    
    def test_send_otp_missing_email(self):
        """Send OTP without email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={}
        )
        assert response.status_code == 422  # Validation error
        print("✓ Missing email validation passed")


class TestVerifyOTP:
    """Test POST /api/auth/verify-otp endpoint"""
    
    def test_verify_otp_no_otp_sent(self):
        """Verify OTP when no OTP was sent"""
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={
                "email": f"no_otp_{int(time.time())}@example.com",
                "otp": "123456"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "No OTP found" in data["detail"]
        print("✓ Verify OTP without sending first - correctly rejected")
    
    def test_verify_otp_invalid_format(self):
        """Verify OTP with invalid format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={
                "email": "test@example.com",
                "otp": "12345"  # Only 5 digits
            }
        )
        # Should either be 400 (no OTP) or validation error
        assert response.status_code in [400, 422]
        print("✓ Invalid OTP format handled")
    
    def test_verify_otp_new_user_without_name(self):
        """New user verification without name should fail"""
        # First send OTP
        test_email = f"test_noname_{int(time.time())}@example.com"
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        assert send_response.status_code == 200
        
        # Try to verify without name (for new user)
        # Note: We can't get the actual OTP in tests, so this tests the flow
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={
                "email": test_email,
                "otp": "000000"  # Wrong OTP
            }
        )
        # Should fail with invalid OTP
        assert response.status_code == 400
        print("✓ New user without name validation flow tested")


class TestMockLogin:
    """Test POST /api/auth/mock-login endpoint for backward compatibility"""
    
    def test_mock_login_free_user(self):
        """Mock login as free trial user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        assert data["id"] == "mock-user-free"
        assert data["email"] == "free@gradnext.co"
        assert data["name"] == "Free Trial User"
        assert data["role"] == "candidate"
        assert data["is_mentor"] == False
        assert data["is_admin"] == False
        print("✓ Mock login as free user passed")
        return session
    
    def test_mock_login_mentor(self):
        """Mock login as mentor"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == "mock-mentor-1"
        assert data["email"] == "mentor@gradnext.co"
        assert data["role"] == "mentor"
        assert data["is_mentor"] == True
        assert data["is_admin"] == False
        print("✓ Mock login as mentor passed")
        return session
    
    def test_mock_login_admin(self):
        """Mock login as admin"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == "mock-admin-1"
        assert data["email"] == "admin@gradnext.co"
        assert data["role"] == "admin"
        assert data["is_mentor"] == False
        assert data["is_admin"] == True
        print("✓ Mock login as admin passed")
        return session
    
    def test_mock_login_subscription_user(self):
        """Mock login as subscription user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == "mock-user-sub"
        assert data["email"] == "pro@gradnext.co"
        assert data["plan"] == "pro"
        print("✓ Mock login as subscription user passed")
    
    def test_mock_login_invalid_type(self):
        """Mock login with invalid user type defaults to free"""
        response = requests.post(f"{BASE_URL}/api/auth/mock-login?user_type=invalid")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "mock-user-free"  # Defaults to free
        print("✓ Mock login with invalid type defaults to free")


class TestGetCurrentUser:
    """Test GET /api/auth/me endpoint"""
    
    def test_get_me_unauthenticated(self):
        """Get current user without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated /me request correctly rejected")
    
    def test_get_me_after_mock_login(self):
        """Get current user after mock login"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert login_response.status_code == 200
        
        # Get current user
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        
        assert data["email"] == "free@gradnext.co"
        assert data["role"] == "candidate"
        assert "id" in data
        assert "name" in data
        print("✓ Get current user after login passed")
    
    def test_get_me_admin_role(self):
        """Verify admin role is returned correctly"""
        session = requests.Session()
        
        # Login as admin
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert login_response.status_code == 200
        
        # Get current user
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        
        assert data["role"] == "admin"
        print("✓ Admin role returned correctly in /me")
    
    def test_get_me_mentor_role(self):
        """Verify mentor role is returned correctly"""
        session = requests.Session()
        
        # Login as mentor
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        assert login_response.status_code == 200
        
        # Get current user
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        
        assert data["role"] == "mentor"
        print("✓ Mentor role returned correctly in /me")


class TestLogout:
    """Test POST /api/auth/logout endpoint"""
    
    def test_logout_clears_session(self):
        """Logout should clear session"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert login_response.status_code == 200
        
        # Verify logged in
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert data["success"] == True
        
        # Verify logged out - should be 401
        me_after_logout = session.get(f"{BASE_URL}/api/auth/me")
        assert me_after_logout.status_code == 401
        print("✓ Logout clears session correctly")
    
    def test_logout_without_session(self):
        """Logout without active session should still succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✓ Logout without session succeeds gracefully")


class TestGoogleOAuthSession:
    """Test POST /api/auth/google/session endpoint"""
    
    def test_google_session_invalid_id(self):
        """Google session with invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/session",
            json={"session_id": "invalid_session_id"}
        )
        # Should fail with 401 or 500 (auth service error)
        assert response.status_code in [401, 500]
        print("✓ Invalid Google session_id correctly rejected")
    
    def test_google_session_missing_id(self):
        """Google session without session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/session",
            json={}
        )
        assert response.status_code == 422  # Validation error
        print("✓ Missing session_id validation passed")


class TestRoleBasedRedirect:
    """Test role-based redirect paths"""
    
    def test_candidate_redirect_path(self):
        """Candidate should redirect to /dashboard"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "candidate"
        # Note: redirect path is determined by frontend based on role
        print("✓ Candidate role set correctly for /dashboard redirect")
    
    def test_mentor_redirect_path(self):
        """Mentor should redirect to /mentor-dashboard"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "mentor"
        print("✓ Mentor role set correctly for /mentor-dashboard redirect")
    
    def test_admin_redirect_path(self):
        """Admin should redirect to /admin"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        print("✓ Admin role set correctly for /admin redirect")


class TestOTPFlow:
    """End-to-end OTP flow test (without actual OTP verification)"""
    
    def test_otp_flow_existing_user(self):
        """Test OTP flow for existing user"""
        # Use a known mock user email
        test_email = "free@gradnext.co"
        
        # Send OTP
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        # Existing user should have is_new_user = False
        assert data["is_new_user"] == False
        print(f"✓ OTP flow for existing user - is_new_user=False")
    
    def test_otp_flow_new_user(self):
        """Test OTP flow for new user"""
        test_email = f"brand_new_{int(time.time())}@example.com"
        
        # Send OTP
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["is_new_user"] == True
        print(f"✓ OTP flow for new user - is_new_user=True")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
