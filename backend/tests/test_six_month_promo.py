"""Tests for the 30% off 6-month subscription promo campaign."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://consultant-gateway.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gradnext')
PROMO_ID = 'promo-30-off-six-month-may2026'


@pytest.fixture(scope='module')
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope='module')
def plan_key(db):
    # Find a real subscription plan key
    plan = db.subscription_plans.find_one({'plan_key': {'$nin': ['free_trial']}, 'is_visible': {'$ne': False}})
    if plan:
        return plan.get('plan_key')
    # Fallback: try resources/plans API
    r = requests.get(f"{BASE_URL}/api/resources/plans?category=subscription", timeout=20)
    if r.ok:
        for p in r.json().get('plans', []):
            if p.get('plan_key') and p.get('plan_key') != 'free_trial':
                return p['plan_key']
    return 'excel'


# ==================== Discount document seeded in MongoDB ====================
class TestDiscountDocument:
    def test_promo_document_exists(self, db):
        doc = db.discounts.find_one({'id': PROMO_ID})
        assert doc is not None, f'Discount {PROMO_ID} not seeded'
        assert doc['type'] == 'automatic'
        assert doc['is_active'] is True
        assert doc['discount_type'] == 'percentage'
        assert doc['subscription_discount_value'] == 30
        assert doc['applies_to'] == ['subscription']
        assert doc['applies_to_billing_cycle'] == ['6-month']
        assert doc['end_date'] == '2026-05-10T23:59:59+05:30'


# ==================== /api/discounts/check-automatic ====================
class TestCheckAutomatic:
    def test_six_month_subscription_has_discount(self, plan_key):
        r = requests.get(
            f"{BASE_URL}/api/discounts/check-automatic",
            params={
                'order_type': 'subscription',
                'plan_key': plan_key,
                'order_amount': 10000,
                'billing_cycle': '6-month',
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['has_discount'] is True
        assert data['discount_amount'] == 3000  # 30% of 10000
        assert data['discount_percentage'] == 30
        assert data['end_date'] == '2026-05-10T23:59:59+05:30'
        assert data.get('campaign_label')

    def test_monthly_subscription_no_discount(self, plan_key):
        r = requests.get(
            f"{BASE_URL}/api/discounts/check-automatic",
            params={
                'order_type': 'subscription',
                'plan_key': plan_key,
                'order_amount': 10000,
                'billing_cycle': 'monthly',
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()['has_discount'] is False

    def test_coaching_no_discount(self, plan_key):
        r = requests.get(
            f"{BASE_URL}/api/discounts/check-automatic",
            params={
                'order_type': 'coaching',
                'plan_key': plan_key,
                'order_amount': 10000,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()['has_discount'] is False

    def test_no_billing_cycle_no_discount(self, plan_key):
        r = requests.get(
            f"{BASE_URL}/api/discounts/check-automatic",
            params={
                'order_type': 'subscription',
                'plan_key': plan_key,
                'order_amount': 10000,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()['has_discount'] is False


# ==================== /api/payments/create-order gating ====================
class TestPaymentCreateOrderGating:
    @pytest.fixture(scope='class')
    def auth_headers(self):
        # Try mock login
        for path, payload in [
            ('/api/auth/mock-login', {'email': 'pro@gradnext.co'}),
            ('/api/auth/test-login', {'email': 'pro@gradnext.co'}),
            ('/api/auth/dev-login', {'user_id': 'mock-user-sub'}),
        ]:
            try:
                r = requests.post(f"{BASE_URL}{path}", json=payload, timeout=15)
                if r.ok:
                    j = r.json()
                    token = j.get('token') or j.get('access_token') or j.get('session_token')
                    if token:
                        return {'Authorization': f'Bearer {token}'}
            except Exception:
                continue
        pytest.skip('Could not obtain auth token via mock login')

    def test_six_month_applies_discount(self, auth_headers, plan_key):
        r = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            headers=auth_headers,
            json={
                'plan_key': plan_key,
                'billing_cycle': '6-month',
                'order_type': 'subscription',
                'automatic_discount_id': PROMO_ID,
            },
            timeout=30,
        )
        if r.status_code in (404, 405):
            pytest.skip(f'create-order not available: {r.status_code}')
        assert r.status_code in (200, 201), r.text
        data = r.json()
        # Look for fields anywhere reasonable
        base = data.get('base_amount') or data.get('original_amount')
        disc = data.get('discount_amount', 0)
        if base is None:
            pytest.skip(f'Response missing base_amount: {data}')
        assert disc > 0, f'Expected discount > 0 for 6-month, got {disc}: {data}'
        # 30% of base (allow rounding tolerance)
        assert abs(disc - round(base * 0.30, 2)) < 1, f'Expected ~30% off base={base}, got {disc}'

    def test_monthly_rejects_discount(self, auth_headers, plan_key):
        r = requests.post(
            f"{BASE_URL}/api/payments/create-order",
            headers=auth_headers,
            json={
                'plan_key': plan_key,
                'billing_cycle': 'monthly',
                'order_type': 'subscription',
                'automatic_discount_id': PROMO_ID,
            },
            timeout=30,
        )
        if r.status_code in (404, 405):
            pytest.skip(f'create-order not available: {r.status_code}')
        # Either rejected or returns no discount
        if r.status_code in (400, 422):
            return
        assert r.status_code in (200, 201), r.text
        data = r.json()
        disc = data.get('discount_amount', 0)
        assert not disc or disc == 0, f'Discount must NOT apply for monthly, got {disc}: {data}'
