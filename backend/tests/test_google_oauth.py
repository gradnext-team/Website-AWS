"""
Test Google OAuth Integration
Tests:
- POST /api/auth/google/verify endpoint exists
- Google OAuth returns proper error for invalid tokens
- Email/Password login still works
- Mock login still works
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGoogleOAuthEndpoint:
    """Test Google OAuth verify endpoint"""
    
    def test_google_verify_endpoint_exists(self):
        """Test that POST /api/auth/google/verify endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify",
            json={"credential": "test_invalid_token"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 for invalid token, not 404
        assert response.status_code in [401, 500], f"Expected 401 or 500, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"Google verify endpoint response: {data}")
    
    def test_google_verify_invalid_token_format(self):
        """Test that invalid token format returns proper error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify",
            json={"credential": "invalid.token.format"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "Invalid Google token" in data.get("detail", "")
        print(f"Invalid token error: {data['detail']}")
    
    def test_google_verify_missing_credential(self):
        """Test that missing credential returns validation error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 422 for validation error
        assert response.status_code == 422
        print("Missing credential validation works")


class TestEmailPasswordLoginStillWorks:
    """Test that email/password login still works after Google OAuth implementation"""
    
    def test_login_endpoint_exists(self):
        """Test that POST /api/auth/login endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 (no password set) or 401 (invalid credentials), not 404
        assert response.status_code in [400, 401], f"Expected 400 or 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"Login endpoint response: {data}")
    
    def test_login_validation(self):
        """Test login validation for missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 422 for validation error
        assert response.status_code == 422
        print("Login validation works")


class TestMockLoginStillWorks:
    """Test that mock login still works for testing purposes"""
    
    def test_mock_login_free_user(self):
        """Test mock login for free user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "free@gradnext.co"
        assert data.get("role") == "candidate"
        print(f"Mock free user login: {data['name']}")
    
    def test_mock_login_admin_user(self):
        """Test mock login for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=admin",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "admin@gradnext.co"
        assert data.get("role") == "admin"
        print(f"Mock admin user login: {data['name']}")
    
    def test_mock_login_mentor_user(self):
        """Test mock login for mentor user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=mentor",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "mentor@gradnext.co"
        assert data.get("role") == "mentor"
        print(f"Mock mentor user login: {data['name']}")


class TestOTPEndpointsStillWork:
    """Test that OTP endpoints still work"""
    
    def test_send_otp_endpoint(self):
        """Test send OTP endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": "test_google_oauth@example.com", "purpose": "signup"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "is_new_user" in data
        print(f"Send OTP response: {data}")
    
    def test_forgot_password_endpoint(self):
        """Test forgot password endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 200 even for non-existent email (security)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Forgot password response: {data}")


class TestAuthMeEndpoint:
    """Test auth/me endpoint"""
    
    def test_auth_me_without_session(self):
        """Test /api/auth/me without session returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        print("Auth me without session returns 401 as expected")
    
    def test_auth_me_with_mock_session(self):
        """Test /api/auth/me with mock session"""
        # First login with mock
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=free",
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        
        # Now check /me endpoint
        me_response = session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Content-Type": "application/json"}
        )
        assert me_response.status_code == 200
        data = me_response.json()
        assert data.get("email") == "free@gradnext.co"
        print(f"Auth me with session: {data['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
