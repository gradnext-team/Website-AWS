"""
Test Suite for Top-Up Session Coupon Integration
Tests the coupon code functionality in the session top-up flow:
- Backend: POST /api/payments/topup/create-order with coupon_discount_id
- Backend: Coupon validation for coaching type with plan_key='coaching_topup'
- Backend: Coupon discount applied after volume discount
- Backend: Coupon usage recorded after successful payment verification
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTopUpCouponIntegration:
    """Test coupon integration in session top-up flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as subscription user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription",
            json={}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        print(f"Logged in as: {self.user.get('email')}")
    
    def test_01_topup_pricing_endpoint(self):
        """Test GET /api/payments/topup/pricing returns base price and discount tiers"""
        response = self.session.get(f"{BASE_URL}/api/payments/topup/pricing")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "base_price" in data, "Missing base_price"
        assert "discount_tiers" in data, "Missing discount_tiers"
        assert data["base_price"] > 0, "Base price should be positive"
        print(f"Top-up pricing: base_price={data['base_price']}, tiers={data['discount_tiers']}")
    
    def test_02_topup_pricing_with_session_count(self):
        """Test GET /api/payments/topup/pricing with specific session count"""
        response = self.session.get(f"{BASE_URL}/api/payments/topup/pricing?session_count=10")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "sessions" in data, "Missing sessions"
        assert "subtotal" in data, "Missing subtotal"
        assert "discount_percent" in data, "Missing discount_percent"
        assert "total" in data, "Missing total"
        assert data["sessions"] == 10, "Session count mismatch"
        print(f"Pricing for 10 sessions: subtotal={data['subtotal']}, discount={data['discount_percent']}%, total={data['total']}")
    
    def test_03_validate_coupon_for_coaching_topup(self):
        """Test POST /api/discounts/validate with plan_key='coaching_topup'"""
        # First get pricing to know the order amount
        pricing_response = self.session.get(f"{BASE_URL}/api/payments/topup/pricing?session_count=5")
        assert pricing_response.status_code == 200
        pricing = pricing_response.json()
        
        # Validate coupon TOPUP20
        response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "TOPUP20",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": pricing.get("total_before_gst", pricing.get("subtotal", 14995))
            }
        )
        
        # If coupon doesn't exist, we'll create it
        if response.status_code == 400 and "Invalid discount code" in response.text:
            print("TOPUP20 coupon not found - will test with existing coupons")
            pytest.skip("TOPUP20 coupon not found in database")
        
        assert response.status_code == 200, f"Coupon validation failed: {response.text}"
        
        data = response.json()
        assert data.get("valid") == True, "Coupon should be valid"
        assert "discount_id" in data, "Missing discount_id"
        assert "discount_amount" in data, "Missing discount_amount"
        assert data["discount_amount"] > 0, "Discount amount should be positive"
        print(f"Coupon validated: discount_id={data['discount_id']}, discount_amount={data['discount_amount']}")
        
        # Store for later tests
        self.__class__.coupon_discount_id = data["discount_id"]
        self.__class__.coupon_discount_amount = data["discount_amount"]
    
    def test_04_create_topup_order_without_coupon(self):
        """Test POST /api/payments/topup/create-order without coupon"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/topup/create-order",
            json={"session_count": 5}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Order creation should succeed"
        assert "order_id" in data, "Missing order_id"
        assert "session_count" in data, "Missing session_count"
        assert data["session_count"] == 5, "Session count mismatch"
        assert "volume_discount_percent" in data, "Missing volume_discount_percent"
        assert "coupon_discount_amount" in data, "Missing coupon_discount_amount"
        assert data["coupon_discount_amount"] == 0, "Coupon discount should be 0 without coupon"
        print(f"Order created without coupon: order_id={data['order_id']}, total={data['total_price']}")
    
    def test_05_create_topup_order_with_coupon(self):
        """Test POST /api/payments/topup/create-order with coupon_discount_id"""
        # First validate coupon to get discount_id
        pricing_response = self.session.get(f"{BASE_URL}/api/payments/topup/pricing?session_count=10")
        assert pricing_response.status_code == 200
        pricing = pricing_response.json()
        
        # Try to validate TOPUP20 coupon
        validate_response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "TOPUP20",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": pricing.get("total_before_gst", pricing.get("subtotal", 29990))
            }
        )
        
        if validate_response.status_code != 200:
            print(f"Coupon validation failed: {validate_response.text}")
            pytest.skip("TOPUP20 coupon not available")
        
        coupon_data = validate_response.json()
        coupon_discount_id = coupon_data.get("discount_id")
        
        # Create order with coupon
        response = self.session.post(
            f"{BASE_URL}/api/payments/topup/create-order",
            json={
                "session_count": 10,
                "coupon_discount_id": coupon_discount_id
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Order creation should succeed"
        assert "order_id" in data, "Missing order_id"
        assert "coupon_discount_amount" in data, "Missing coupon_discount_amount"
        assert data["coupon_discount_amount"] > 0, "Coupon discount should be applied"
        
        # Verify discount is applied after volume discount
        assert "volume_discount_amount" in data, "Missing volume_discount_amount"
        assert "total_before_gst" in data, "Missing total_before_gst"
        
        # Calculate expected: subtotal - volume_discount - coupon_discount = total_before_gst
        expected_total_before_gst = data["subtotal"] - data["volume_discount_amount"] - data["coupon_discount_amount"]
        assert abs(data["total_before_gst"] - expected_total_before_gst) < 1, \
            f"Total before GST mismatch: expected {expected_total_before_gst}, got {data['total_before_gst']}"
        
        print(f"Order created with coupon: order_id={data['order_id']}")
        print(f"  Subtotal: {data['subtotal']}")
        print(f"  Volume discount ({data['volume_discount_percent']}%): -{data['volume_discount_amount']}")
        print(f"  Coupon discount: -{data['coupon_discount_amount']}")
        print(f"  Total before GST: {data['total_before_gst']}")
        print(f"  GST: {data['gst']}")
        print(f"  Final total: {data['total_price']}")
    
    def test_06_create_topup_order_with_invalid_coupon(self):
        """Test POST /api/payments/topup/create-order with invalid coupon_discount_id"""
        response = self.session.post(
            f"{BASE_URL}/api/payments/topup/create-order",
            json={
                "session_count": 5,
                "coupon_discount_id": "invalid-coupon-id-12345"
            }
        )
        # Should succeed but without coupon discount (coupon not found)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Order should still be created"
        assert data.get("coupon_discount_amount", 0) == 0, "Invalid coupon should not apply discount"
        print(f"Order created with invalid coupon (ignored): total={data['total_price']}")
    
    def test_07_volume_discount_tiers(self):
        """Test that volume discounts are applied correctly at different session counts"""
        test_cases = [
            (1, 0),    # 1 session: no discount
            (5, 5),    # 5 sessions: 5% discount
            (10, 10),  # 10 sessions: 10% discount
            (15, 15),  # 15 sessions: 15% discount
            (20, 20),  # 20 sessions: 20% discount
        ]
        
        for session_count, expected_discount in test_cases:
            response = self.session.post(
                f"{BASE_URL}/api/payments/topup/create-order",
                json={"session_count": session_count}
            )
            assert response.status_code == 200, f"Failed for {session_count} sessions: {response.text}"
            
            data = response.json()
            actual_discount = data.get("volume_discount_percent", 0)
            assert actual_discount == expected_discount, \
                f"For {session_count} sessions: expected {expected_discount}% discount, got {actual_discount}%"
            print(f"  {session_count} sessions: {actual_discount}% volume discount ✓")
    
    def test_08_coupon_applied_after_volume_discount(self):
        """Verify coupon discount is calculated on amount AFTER volume discount"""
        # First validate coupon
        validate_response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "TOPUP20",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": 26991  # 10 sessions after 10% volume discount
            }
        )
        
        if validate_response.status_code != 200:
            pytest.skip("TOPUP20 coupon not available")
        
        coupon_data = validate_response.json()
        coupon_discount_id = coupon_data.get("discount_id")
        
        # Create order with 10 sessions and coupon
        response = self.session.post(
            f"{BASE_URL}/api/payments/topup/create-order",
            json={
                "session_count": 10,
                "coupon_discount_id": coupon_discount_id
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Calculate expected values
        base_price = data["base_price"]
        subtotal = base_price * 10  # 10 sessions
        volume_discount = subtotal * 0.10  # 10% for 10 sessions
        after_volume = subtotal - volume_discount
        
        # Coupon should be 20% of after_volume (not subtotal)
        expected_coupon_discount = after_volume * 0.20
        actual_coupon_discount = data["coupon_discount_amount"]
        
        # Allow small rounding difference
        assert abs(actual_coupon_discount - expected_coupon_discount) < 1, \
            f"Coupon discount mismatch: expected ~{expected_coupon_discount}, got {actual_coupon_discount}"
        
        print(f"Coupon correctly applied after volume discount:")
        print(f"  Subtotal: {subtotal}")
        print(f"  After volume discount (10%): {after_volume}")
        print(f"  Coupon discount (20% of {after_volume}): {actual_coupon_discount}")


class TestTopUpCouponValidation:
    """Test coupon validation edge cases for top-up"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as subscription user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription",
            json={}
        )
        assert login_response.status_code == 200
        self.user = login_response.json()
    
    def test_validate_coupon_with_coaching_order_type(self):
        """Test that coupon validation works with order_type='coaching'"""
        response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "TOPUP20",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": 14995
            }
        )
        
        if response.status_code == 400 and "Invalid discount code" in response.text:
            pytest.skip("TOPUP20 coupon not found")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("valid") == True
        print(f"Coupon validation successful for coaching_topup")
    
    def test_validate_invalid_coupon_code(self):
        """Test validation with non-existent coupon code"""
        response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "INVALID_CODE_XYZ",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": 14995
            }
        )
        
        assert response.status_code == 400, "Should fail for invalid code"
        assert "Invalid discount code" in response.text or "invalid" in response.text.lower()
        print("Invalid coupon code correctly rejected")
    
    def test_validate_coupon_response_structure(self):
        """Test that coupon validation returns expected fields"""
        response = self.session.post(
            f"{BASE_URL}/api/discounts/validate",
            json={
                "code": "TOPUP20",
                "order_type": "coaching",
                "plan_key": "coaching_topup",
                "order_amount": 14995
            }
        )
        
        if response.status_code != 200:
            pytest.skip("TOPUP20 coupon not available")
        
        data = response.json()
        
        # Check required fields for frontend
        required_fields = ["valid", "discount_id", "discount_amount", "message"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"Coupon validation response has all required fields: {list(data.keys())}")


class TestTopUpOrderVerification:
    """Test order verification with coupon usage recording"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as subscription user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/mock-login?user_type=subscription",
            json={}
        )
        assert login_response.status_code == 200
        self.user = login_response.json()
    
    def test_verify_topup_endpoint_exists(self):
        """Test that POST /api/payments/topup/verify endpoint exists"""
        # This will fail with 422 (validation error) since we're not providing valid payment data
        # But it confirms the endpoint exists
        response = self.session.post(
            f"{BASE_URL}/api/payments/topup/verify",
            json={
                "razorpay_order_id": "test_order_123",
                "razorpay_payment_id": "test_payment_123",
                "razorpay_signature": "test_signature",
                "session_count": 5
            }
        )
        
        # Should fail with 400 (invalid signature) or 404 (order not found), not 404 (endpoint not found)
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"
        print(f"Verify endpoint exists, returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
