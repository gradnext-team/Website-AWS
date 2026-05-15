"""
Subscription Proration and Access Control Tests
Tests for:
1. GET /api/subscriptions/status - Returns correct status for paid users, manual upgrades, and free trial
2. POST /api/subscriptions/upgrade-preview - Monthly upgrade: preserves monthly anniversary, gives credit for paid users, zero credit for manual upgrades
3. POST /api/subscriptions/upgrade-preview - 6-month upgrade: anniversary = 6 months from original start date
4. GET /api/resources/dashboard-summary - Returns correct access flags (all pages browsable, including coaching)
5. Coaching page access should be TRUE for all users (browsable with items locked inside)
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_SUBSCRIBER_EMAIL = "testsubscriber@gradnext.com"
TEST_SUBSCRIBER_PASSWORD = "test123"
KASHISH_EMAIL = "kashishm0144@gmail.com"
KASHISH_PASSWORD = "test123"
ADMIN_EMAIL = "admin@gradnext.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture
def test_subscriber_session():
    """Get authenticated session for paid test subscriber"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_SUBSCRIBER_EMAIL, "password": TEST_SUBSCRIBER_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Test subscriber login failed")
    return session


@pytest.fixture
def kashish_session():
    """Get authenticated session for manual upgrade user (kashish)"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": KASHISH_EMAIL, "password": KASHISH_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Kashish login failed")
    return session


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


class TestSubscriptionStatus:
    """Test GET /api/subscriptions/status endpoint"""
    
    def test_paid_user_status(self, test_subscriber_session):
        """Paid user should have is_manual_upgrade=false and proper subscription data"""
        response = test_subscriber_session.get(f"{BASE_URL}/api/subscriptions/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify paid user status
        assert data["has_subscription"] == True
        assert data["status"] == "active"
        assert data["plan_key"] == "basic_plan"
        assert data["is_manual_upgrade"] == False
        assert data["has_access"] == True
        assert data["current_period_start"] is not None
        assert data["current_period_end"] is not None
    
    def test_manual_upgrade_user_status(self, kashish_session):
        """Manual upgrade user should have is_manual_upgrade=true"""
        response = kashish_session.get(f"{BASE_URL}/api/subscriptions/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify manual upgrade user status
        assert data["has_subscription"] == True
        assert data["status"] == "active"
        assert data["is_manual_upgrade"] == True
        assert data["has_access"] == True


class TestUpgradePreviewProration:
    """Test POST /api/subscriptions/upgrade-preview endpoint"""
    
    def test_paid_user_gets_credit(self, test_subscriber_session):
        """Paid user should get credit for unused portion of current plan"""
        response = test_subscriber_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify proration calculation
        assert data["success"] == True
        assert data["is_upgrade"] == True
        assert data["is_manual_upgrade"] == False
        
        proration = data["proration"]
        assert proration["unused_credit"] > 0  # Paid user gets credit
        assert proration["daily_rate_current"] > 0  # Has daily rate
        assert proration["prorated_charge"] >= 0
        assert proration["anniversary_date"] is not None
    
    def test_manual_upgrade_user_gets_zero_credit(self, kashish_session):
        """Manual upgrade user should get ZERO credit (goodwill upgrade)"""
        response = kashish_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify manual upgrade gets zero credit
        assert data["success"] == True
        assert data["is_upgrade"] == True
        assert data["is_manual_upgrade"] == True
        
        proration = data["proration"]
        assert proration["unused_credit"] == 0  # ZERO credit for manual upgrades
        assert proration["daily_rate_current"] == 0  # No daily rate (goodwill)
        assert proration["prorated_charge"] > 0  # Still has to pay for new plan
    
    def test_6_month_upgrade_anniversary_calculation(self, test_subscriber_session):
        """6-month upgrade should set anniversary to 6 months from original start date"""
        response = test_subscriber_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "6_month"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        proration = data["proration"]
        
        # Verify 6-month anniversary calculation
        # Anniversary should be 6 months from original start date
        anniversary_date = datetime.fromisoformat(proration["anniversary_date"].replace("Z", "+00:00"))
        
        # Get current period start from status
        status_response = test_subscriber_session.get(f"{BASE_URL}/api/subscriptions/status")
        status_data = status_response.json()
        period_start = datetime.fromisoformat(status_data["current_period_start"].replace("Z", "+00:00"))
        
        # Anniversary should be approximately 6 months from period_start
        # (allowing for some variance in month lengths)
        days_diff = (anniversary_date - period_start).days
        assert 175 <= days_diff <= 185  # Approximately 6 months (180 days)
        
        # Verify days_until_new_anniversary is calculated correctly
        assert proration["days_until_new_anniversary"] > proration["days_remaining_current_period"]
    
    def test_monthly_upgrade_preserves_anniversary(self, test_subscriber_session):
        """Monthly upgrade should preserve the original monthly anniversary"""
        response = test_subscriber_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        proration = data["proration"]
        
        # Get current period end from status
        status_response = test_subscriber_session.get(f"{BASE_URL}/api/subscriptions/status")
        status_data = status_response.json()
        
        # For monthly upgrade, anniversary should be the current period_end
        anniversary_date = proration["anniversary_date"]
        current_period_end = status_data["current_period_end"]
        
        # They should be the same (anniversary preserved)
        assert anniversary_date == current_period_end


class TestDashboardSummaryAccess:
    """Test GET /api/resources/dashboard-summary access flags"""
    
    def test_coaching_access_is_true_for_all_users(self, test_subscriber_session, kashish_session, admin_session):
        """Coaching page access should be TRUE for all users (browsable with items locked inside)"""
        
        # Test for paid subscriber
        response = test_subscriber_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert response.status_code == 200
        data = response.json()
        assert data["access"]["coaching"] == True, "Coaching should be accessible for paid subscriber"
        
        # Test for manual upgrade user
        response = kashish_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert response.status_code == 200
        data = response.json()
        assert data["access"]["coaching"] == True, "Coaching should be accessible for manual upgrade user"
        
        # Test for admin
        response = admin_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        assert response.status_code == 200
        data = response.json()
        assert data["access"]["coaching"] == True, "Coaching should be accessible for admin"
    
    def test_all_pages_browsable_for_paid_users(self, test_subscriber_session):
        """All pages should be browsable for paid users"""
        response = test_subscriber_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        access = data["access"]
        assert access["subscription"] == True
        assert access["coaching"] == True
        assert access["courses"] == True
        assert access["drills"] == True
        assert access["workshops"] == True
        assert access["materials"] == True
        assert access["peer_practice"] == True
    
    def test_plan_status_for_paid_user(self, test_subscriber_session):
        """Paid user should have correct plan_status"""
        response = test_subscriber_session.get(f"{BASE_URL}/api/resources/dashboard-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        plan_status = data["plan_status"]
        assert plan_status["plan_type"] == "basic_plan"
        assert plan_status["plan_category"] == "subscription"
        assert plan_status["has_full_access"] == True
        assert plan_status["use_item_level_locking"] == False
        assert plan_status["is_trial"] == False
        assert plan_status["has_subscription"] == True
        assert plan_status["subscription_expired"] == False


class TestProrationCalculationLogic:
    """Test the proration calculation logic"""
    
    def test_proration_formula_basic_case(self):
        """Test basic proration calculation formula
        
        Example: User on Basic Monthly (₹499) started Jan 4th, upgrades to Pro (₹699) on Jan 15th
        - Days remaining until Feb 4th (anniversary): 20 days
        - Days in period: 30 days
        - Credit from Basic: (20/30) * 499 = ₹332.67
        - Pro cost for 20 days: (20/30) * 699 = ₹466
        - Prorated charge: ₹466 - ₹332.67 = ₹133.33
        """
        current_price = 499
        new_price = 699
        days_remaining = 20
        days_in_period = 30
        
        unused_credit = (days_remaining / days_in_period) * current_price
        new_cost_for_remaining = (days_remaining / days_in_period) * new_price
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        assert round(unused_credit, 2) == 332.67
        assert round(new_cost_for_remaining, 2) == 466.0
        assert round(prorated_charge, 2) == 133.33
    
    def test_manual_upgrade_zero_credit(self):
        """Test that manual upgrades get zero credit"""
        current_price = 499
        new_price = 699
        days_remaining = 20
        days_in_period = 30
        is_manual_upgrade = True
        
        # Manual upgrade: daily_rate_current = 0, unused_credit = 0
        if is_manual_upgrade:
            daily_rate_current = 0
            unused_credit = 0
        else:
            daily_rate_current = current_price / days_in_period
            unused_credit = days_remaining * daily_rate_current
        
        daily_rate_new = new_price / days_in_period
        new_cost_for_remaining = days_remaining * daily_rate_new
        prorated_charge = max(0, new_cost_for_remaining - unused_credit)
        
        assert unused_credit == 0
        assert daily_rate_current == 0
        assert round(prorated_charge, 2) == round(new_cost_for_remaining, 2)


class TestFrontendProrationDisplay:
    """Test that frontend receives correct proration data from backend"""
    
    def test_upgrade_preview_returns_all_required_fields(self, test_subscriber_session):
        """Upgrade preview should return all fields needed for frontend display"""
        response = test_subscriber_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields are present
        assert "success" in data
        assert "is_upgrade" in data
        assert "is_manual_upgrade" in data
        assert "current_plan" in data
        assert "new_plan" in data
        assert "proration" in data
        assert "message" in data
        
        # Verify proration structure
        proration = data["proration"]
        assert "days_used" in proration
        assert "days_remaining_current_period" in proration
        assert "days_until_new_anniversary" in proration
        assert "daily_rate_current" in proration
        assert "daily_rate_new" in proration
        assert "unused_credit" in proration
        assert "new_cost_for_remaining" in proration
        assert "prorated_charge" in proration
        assert "anniversary_date" in proration
        assert "new_period_start" in proration
        assert "new_period_end" in proration
        assert "new_full_price" in proration
    
    def test_manual_upgrade_note_in_response(self, kashish_session):
        """Manual upgrade user should have is_manual_upgrade=true for frontend to show 'complimentary upgrade' note"""
        response = kashish_session.post(
            f"{BASE_URL}/api/subscriptions/upgrade-preview",
            json={"new_plan_key": "pro_plan", "new_billing_cycle": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Frontend uses is_manual_upgrade to show "complimentary upgrade" note
        assert data["is_manual_upgrade"] == True


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
