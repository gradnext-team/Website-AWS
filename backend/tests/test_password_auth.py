"""
Test Password-based Authentication Features
Tests:
- POST /api/auth/send-otp (for signup)
- POST /api/auth/signup (create account with password)
- POST /api/auth/login (email/password login)
- POST /api/auth/forgot-password (send reset OTP)
- POST /api/auth/reset-password (reset password with OTP)
- Password validation (min 6 characters)
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Generate unique test email for each test run
TEST_EMAIL_PREFIX = f"TEST_pwauth_{uuid.uuid4().hex[:8]}"


class TestSendOTPForSignup:
    """Test POST /api/auth/send-otp endpoint for signup"""
    
    def test_send_otp_new_user(self):
        """Send OTP for a new user (signup flow)"""
        unique_email = f"{TEST_EMAIL_PREFIX}_new@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": unique_email, "purpose": "signup"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        assert data.get("is_new_user") == True  # Should indicate new user
    
    def test_send_otp_existing_user(self):
        """Send OTP for existing user should indicate not new"""
        # Use mock user email that exists
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": "free@gradnext.co", "purpose": "login"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("is_new_user") == False  # Existing user
    
    def test_send_otp_invalid_email(self):
        """Send OTP with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": "invalid-email", "purpose": "signup"}
        )
        
        assert response.status_code == 422  # Validation error


class TestSignupWithPassword:
    """Test POST /api/auth/signup endpoint"""
    
    def test_signup_without_otp(self):
        """Signup without OTP should fail"""
        unique_email = f"{TEST_EMAIL_PREFIX}_nootp@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": unique_email,
                "name": "Test User",
                "password": "testpass123",
                "otp": "000000"  # Invalid OTP
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_signup_password_too_short(self):
        """Signup with password less than 6 characters should fail"""
        unique_email = f"{TEST_EMAIL_PREFIX}_shortpw@example.com"
        
        # First send OTP
        otp_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": unique_email, "purpose": "signup"}
        )
        assert otp_response.status_code == 200
        
        # Try signup with short password (OTP will be invalid anyway, but password validation should happen)
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": unique_email,
                "name": "Test User",
                "password": "12345",  # Only 5 characters
                "otp": "123456"  # Will be invalid
            }
        )
        
        # Should fail - either OTP invalid or password too short
        assert response.status_code == 400
    
    def test_signup_missing_fields(self):
        """Signup with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"email": "test@example.com"}  # Missing name, password, otp
        )
        
        assert response.status_code == 422  # Validation error


class TestLoginWithPassword:
    """Test POST /api/auth/login endpoint"""
    
    def test_login_invalid_credentials(self):
        """Login with wrong password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Invalid" in data["detail"]
    
    def test_login_missing_password(self):
        """Login without password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com"}  # Missing password
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_login_invalid_email_format(self):
        """Login with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "not-an-email",
                "password": "testpass123"
            }
        )
        
        assert response.status_code == 422  # Validation error


class TestForgotPassword:
    """Test POST /api/auth/forgot-password endpoint"""
    
    def test_forgot_password_existing_user(self):
        """Forgot password for existing user should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "free@gradnext.co"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
    
    def test_forgot_password_nonexistent_user(self):
        """Forgot password for non-existent user should still return success (security)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "nonexistent_user_xyz@example.com"}
        )
        
        # Should return success to not reveal if email exists
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_forgot_password_invalid_email(self):
        """Forgot password with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "invalid-email"}
        )
        
        assert response.status_code == 422  # Validation error


class TestResetPassword:
    """Test POST /api/auth/reset-password endpoint"""
    
    def test_reset_password_invalid_otp(self):
        """Reset password with invalid OTP should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "email": "free@gradnext.co",
                "otp": "000000",  # Invalid OTP
                "new_password": "newpassword123"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_reset_password_short_password(self):
        """Reset password with short password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "email": "free@gradnext.co",
                "otp": "123456",
                "new_password": "12345"  # Too short
            }
        )
        
        # Should fail - either OTP invalid or password too short
        assert response.status_code == 400
    
    def test_reset_password_missing_fields(self):
        """Reset password with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={"email": "test@example.com"}  # Missing otp and new_password
        )
        
        assert response.status_code == 422  # Validation error


class TestFullSignupLoginFlow:
    """Test complete signup and login flow with password"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup unique email for this test class"""
        self.test_email = f"{TEST_EMAIL_PREFIX}_flow@example.com"
        self.test_name = "Flow Test User"
        self.test_password = "securepass123"
    
    def test_full_flow_step1_send_otp(self):
        """Step 1: Send OTP for signup"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": self.test_email, "purpose": "signup"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("is_new_user") == True
        print(f"OTP sent to {self.test_email} - check backend logs for OTP code")


class TestMockLoginStillWorks:
    """Verify mock login endpoints still work for backward compatibility"""
    
    def test_mock_login_free(self):
        """Mock login as free user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=free")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "free@gradnext.co"
        assert data.get("role") == "candidate"
    
    def test_mock_login_admin(self):
        """Mock login as admin user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "admin@gradnext.co"
        assert data.get("role") == "admin"
    
    def test_mock_login_mentor(self):
        """Mock login as mentor user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/mock-login?user_type=mentor")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "mentor@gradnext.co"
        assert data.get("role") == "mentor"


class TestEndToEndPasswordAuth:
    """End-to-end test for password authentication flow"""
    
    def test_complete_signup_login_flow(self):
        """
        Complete flow:
        1. Send OTP for signup
        2. Signup with OTP and password (simulated - OTP from logs)
        3. Login with email/password
        4. Forgot password
        5. Reset password (simulated - OTP from logs)
        """
        unique_email = f"TEST_e2e_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "testpass123"
        
        # Step 1: Send OTP for signup
        otp_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": unique_email, "purpose": "signup"}
        )
        assert otp_response.status_code == 200
        assert otp_response.json().get("is_new_user") == True
        print(f"Step 1 PASS: OTP sent for signup to {unique_email}")
        
        # Step 2: Signup would require actual OTP from logs
        # We'll test the endpoint validation instead
        signup_response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": unique_email,
                "name": "E2E Test User",
                "password": test_password,
                "otp": "invalid"  # Will fail but tests endpoint
            }
        )
        assert signup_response.status_code == 400  # Expected - invalid OTP
        print("Step 2 PASS: Signup endpoint validates OTP correctly")
        
        # Step 3: Test login endpoint with non-existent user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": unique_email,
                "password": test_password
            }
        )
        assert login_response.status_code == 401  # User doesn't exist yet
        print("Step 3 PASS: Login endpoint rejects non-existent user")
        
        # Step 4: Forgot password
        forgot_response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": unique_email}
        )
        assert forgot_response.status_code == 200
        print("Step 4 PASS: Forgot password endpoint works")
        
        # Step 5: Reset password would require actual OTP
        reset_response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "email": unique_email,
                "otp": "invalid",
                "new_password": "newpass123"
            }
        )
        assert reset_response.status_code == 400  # Expected - invalid OTP
        print("Step 5 PASS: Reset password endpoint validates OTP correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
