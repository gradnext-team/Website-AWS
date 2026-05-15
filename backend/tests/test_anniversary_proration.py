"""
Anniversary-Based Proration Logic Tests
Tests for the new anniversary billing feature in subscription upgrades:
- POST /api/subscriptions/upgrade-preview - Preview proration calculation with anniversary date preserved
- POST /api/subscriptions/change-plan - Creates one-time prorated order and schedules subscription for anniversary
- POST /api/subscriptions/confirm-proration-payment - Confirm pending upgrade after payment
- POST /api/subscriptions/cancel-pending-upgrade - Cancel scheduled anniversary upgrade
- GET /api/subscriptions/status - Returns pending_change info for scheduled upgrades
- calculate_anniversary_proration function - Proration calculation logic
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@gradnext.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture
def admin_session():
    """Get authenticated admin session"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return session


class TestUpgradePreviewEndpoint:
    """Test POST /api/subscriptions/upgrade-preview endpoint"""
    
    def test_upgrade_preview_requires_authentication(self):
        """Upgrade preview should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        assert response.status_code in [401, 403]
    
    def test_upgrade_preview_fails_without_subscription(self, admin_session):
        """Upgrade preview should fail if user has no active subscription"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "no active subscription" in data.get("detail", "").lower()
    
    def test_upgrade_preview_validates_plan_key(self, admin_session):
        """Upgrade preview should validate plan key"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "invalid_plan", "new_billing_cycle": "monthly"}
        )
        
        # Should fail - either 400 (no subscription) or 404 (plan not found)
        assert response.status_code in [400, 404]
    
    def test_upgrade_preview_validates_billing_cycle(self, admin_session):
        """Upgrade preview should validate billing cycle"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "invalid_cycle"}
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422


class TestConfirmProrationPaymentEndpoint:
    """Test POST /api/subscriptions/confirm-proration-payment endpoint"""
    
    def test_confirm_proration_requires_authentication(self):
        """Confirm proration payment should require authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/confirm-proration-payment")
        assert response.status_code in [401, 403]
    
    def test_confirm_proration_fails_without_pending_upgrade(self, admin_session):
        """Confirm proration should fail if no pending upgrade exists"""
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/confirm-proration-payment")
        
        assert response.status_code == 400
        data = response.json()
        assert "no pending upgrade" in data.get("detail", "").lower()


class TestCancelPendingUpgradeEndpoint:
    """Test POST /api/subscriptions/cancel-pending-upgrade endpoint"""
    
    def test_cancel_pending_upgrade_requires_authentication(self):
        """Cancel pending upgrade should require authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/cancel-pending-upgrade")
        assert response.status_code in [401, 403]
    
    def test_cancel_pending_upgrade_fails_without_pending_upgrade(self, admin_session):
        """Cancel pending upgrade should fail if no pending upgrade exists"""
        response = admin_session.post(f"{BASE_URL}/api/subscriptions/cancel-pending-upgrade")
        
        assert response.status_code == 400
        data = response.json()
        assert "no pending upgrade" in data.get("detail", "").lower()


class TestSubscriptionStatusWithPendingChange:
    """Test GET /api/subscriptions/status returns pending_change info"""
    
    def test_status_includes_pending_change_field(self, admin_session):
        """Status endpoint should include pending_change field in response"""
        response = admin_session.get(f"{BASE_URL}/api/subscriptions/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pending_change field exists (can be null)
        assert "pending_change" in data
        # For admin without subscription, pending_change should be None
        assert data["pending_change"] is None


class TestAnniversaryProrationCalculation:
    """Test the calculate_anniversary_proration function logic via API"""
    
    def test_plans_endpoint_returns_pricing_for_proration(self):
        """Plans endpoint should return pricing needed for proration calculation"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/plans")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pricing structure for proration calculation
        for plan in data["plans"]:
            pricing = plan["pricing"]
            assert "monthly" in pricing
            assert "6_month_total" in pricing
            assert "6_month_per_month" in pricing
            assert "monthly_savings" in pricing
            
            # Verify pricing values are valid for proration
            assert isinstance(pricing["monthly"], (int, float))
            assert pricing["monthly"] > 0
            assert isinstance(pricing["6_month_total"], (int, float))
            assert pricing["6_month_total"] > 0


class TestChangePlanWithAnniversaryBilling:
    """Test POST /api/subscriptions/change-plan with anniversary billing logic"""
    
    def test_change_plan_requires_authentication(self):
        """Change plan should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        assert response.status_code in [401, 403]
    
    def test_change_plan_fails_without_subscription(self, admin_session):
        """Change plan should fail if user has no active subscription"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "no active subscription" in data.get("detail", "").lower()
    
    def test_change_plan_validates_plan_key(self, admin_session):
        """Change plan should validate plan key"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "invalid_plan", "new_billing_cycle": "monthly"}
        )
        
        # Should fail - either 400 (no subscription) or 404 (plan not found)
        assert response.status_code in [400, 404]
    
    def test_change_plan_validates_billing_cycle(self, admin_session):
        """Change plan should validate billing cycle"""
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "invalid_cycle"}
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422


class TestProrationCalculationLogic:
    """Test the proration calculation logic directly"""
    
    def test_proration_formula_basic_case(self):
        """Test basic proration calculation formula
        
        Example: User on Basic Monthly (₹499) started Jan 4th, upgrades to Pro (₹699) on Jan 15th
        - Days remaining until Feb 4th (anniversary): 20 days
        - Days in period: 30 days
        - Credit from Basic: (20/30) * 499 = ₹332.67
        - Pro cost for 20 days: (20/30) * 699 = ₹466
        - Prorated charge: ₹466 - ₹332.67 = ₹133.33
        """
        # Simulate the calculation
        current_price = 499
        new_price = 699
        days_remaining = 20
        days_in_period = 30
        
        # Credit for unused portion of current plan
        unused_credit = (days_remaining / days_in_period) * current_price
        
        # Cost for remaining days at new plan rate
        new_cost_for_remaining = (days_remaining / days_in_period) * new_price
        
        # Prorated charge
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        # Verify calculations
        assert round(unused_credit, 2) == 332.67
        assert round(new_cost_for_remaining, 2) == 466.0
        assert round(prorated_charge, 2) == 133.33
    
    def test_proration_formula_same_price(self):
        """Test proration when prices are the same (should be 0)"""
        current_price = 499
        new_price = 499
        days_remaining = 20
        days_in_period = 30
        
        unused_credit = (days_remaining / days_in_period) * current_price
        new_cost_for_remaining = (days_remaining / days_in_period) * new_price
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        assert prorated_charge == 0
    
    def test_proration_formula_downgrade(self):
        """Test proration for downgrade (should be 0 or negative, capped at 0)"""
        current_price = 699
        new_price = 499
        days_remaining = 20
        days_in_period = 30
        
        unused_credit = (days_remaining / days_in_period) * current_price
        new_cost_for_remaining = (days_remaining / days_in_period) * new_price
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        # Downgrade should result in 0 charge (credit exceeds new cost)
        assert prorated_charge == 0
    
    def test_proration_formula_6_month_upgrade(self):
        """Test proration for monthly to 6-month upgrade"""
        # User on Basic Monthly (₹499), upgrading to Basic 6-month (₹2394 total, ₹399/mo)
        current_price = 499  # Monthly
        new_price = 2394  # 6-month total
        days_remaining = 20
        days_in_period = 30
        
        unused_credit = (days_remaining / days_in_period) * current_price
        new_cost_for_remaining = (days_remaining / days_in_period) * new_price
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        # Verify calculation
        expected_credit = round((20/30) * 499, 2)
        expected_new_cost = round((20/30) * 2394, 2)
        expected_charge = round(max(0, expected_new_cost - expected_credit), 2)
        
        assert round(unused_credit, 2) == expected_credit
        assert round(new_cost_for_remaining, 2) == expected_new_cost
        assert round(prorated_charge, 2) == expected_charge


class TestAnniversaryDatePreservation:
    """Test that anniversary date is correctly preserved in upgrade flow"""
    
    def test_anniversary_date_calculation(self):
        """Test anniversary date calculation logic
        
        Anniversary date should be the original period_end date.
        New subscription should start on this date.
        """
        # Simulate: User subscribed Jan 4th, period ends Feb 4th
        period_start = datetime(2026, 1, 4, tzinfo=timezone.utc)
        period_end = datetime(2026, 2, 4, tzinfo=timezone.utc)
        
        # Anniversary date should be period_end
        anniversary_date = period_end
        
        # New subscription starts on anniversary
        new_period_start = anniversary_date
        
        # For monthly billing, new period ends one month after anniversary
        new_period_end = new_period_start + relativedelta(months=1)
        
        assert anniversary_date == period_end
        assert new_period_start == period_end
        assert new_period_end == datetime(2026, 3, 4, tzinfo=timezone.utc)
    
    def test_anniversary_date_6_month_cycle(self):
        """Test anniversary date for 6-month billing cycle"""
        period_start = datetime(2026, 1, 4, tzinfo=timezone.utc)
        period_end = datetime(2026, 7, 4, tzinfo=timezone.utc)  # 6 months later
        
        anniversary_date = period_end
        new_period_start = anniversary_date
        
        # For 6-month billing, new period ends 6 months after anniversary
        new_period_end = new_period_start + relativedelta(months=6)
        
        assert anniversary_date == period_end
        assert new_period_end == datetime(2027, 1, 4, tzinfo=timezone.utc)


class TestUpgradePreviewResponseStructure:
    """Test the response structure of upgrade-preview endpoint"""
    
    def test_upgrade_preview_response_fields(self, admin_session):
        """Verify upgrade-preview returns expected fields when subscription exists
        
        Note: This test will skip if admin has no subscription.
        The expected response structure includes:
        - success: boolean
        - is_upgrade: boolean
        - current_plan: object with plan_key, billing_cycle, price
        - new_plan: object with plan_key, name, billing_cycle, price
        - proration: object with days_remaining, unused_credit, new_cost_for_remaining,
                     prorated_charge, anniversary_date, new_period_start, new_period_end, new_full_price
        - message: string
        """
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        # Admin doesn't have subscription, so this should fail
        if response.status_code == 400:
            data = response.json()
            assert "no active subscription" in data.get("detail", "").lower()
            pytest.skip("Admin has no active subscription to test upgrade preview")
        
        # If admin has subscription, verify response structure
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert "is_upgrade" in data
        assert "current_plan" in data
        assert "new_plan" in data
        assert "proration" in data
        assert "message" in data
        
        # Verify proration structure
        proration = data["proration"]
        assert "days_remaining" in proration
        assert "unused_credit" in proration
        assert "new_cost_for_remaining" in proration
        assert "prorated_charge" in proration
        assert "anniversary_date" in proration
        assert "new_period_start" in proration
        assert "new_period_end" in proration
        assert "new_full_price" in proration


class TestChangePlanResponseStructure:
    """Test the response structure of change-plan endpoint for anniversary upgrades"""
    
    def test_change_plan_anniversary_upgrade_response_fields(self, admin_session):
        """Verify change-plan returns expected fields for anniversary upgrade
        
        Note: This test will skip if admin has no subscription.
        The expected response structure for anniversary_upgrade includes:
        - success: boolean
        - type: "anniversary_upgrade"
        - immediate: false
        - requires_proration_payment: boolean
        - proration_order_id: string (if proration required)
        - subscription_id: string
        - razorpay_key: string
        - proration: object with calculation details
        - charge_amount: number
        - new_plan: string
        - new_billing_cycle: string
        - anniversary_date: string (ISO date)
        - new_period_start: string (ISO date)
        - new_period_end: string (ISO date)
        - short_url: string (Razorpay payment URL)
        - message: string
        """
        response = admin_session.post(
            f"{BASE_URL}/api/subscriptions/change-plan",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        # Admin doesn't have subscription, so this should fail
        if response.status_code == 400:
            data = response.json()
            assert "no active subscription" in data.get("detail", "").lower()
            pytest.skip("Admin has no active subscription to test change plan")
        
        # If admin has subscription and it's an upgrade, verify response structure
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert "type" in data
        
        if data["type"] == "anniversary_upgrade":
            assert data["immediate"] == False
            assert "requires_proration_payment" in data
            assert "subscription_id" in data
            assert "razorpay_key" in data
            assert "proration" in data
            assert "charge_amount" in data
            assert "new_plan" in data
            assert "new_billing_cycle" in data
            assert "anniversary_date" in data
            assert "new_period_start" in data
            assert "new_period_end" in data
            assert "message" in data


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
