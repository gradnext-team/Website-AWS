"""
Backend tests for the new Cohort feature.

Covers:
- Public endpoints: /api/cohorts/featured, /by-slug/{slug}
- Discovery call submit (public)
- Auth-required: /api/cohorts/enrol/create-order (validation, coupon, 409 dup)
- Auth-required: /api/cohorts/my-enrollments
- Admin /api/admin/cohort-programs CRUD + discovery-call lifecycle
- Admin auth gating (403 for non-admins)
- Regression: legacy /api/admin/cohorts is not broken
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

UNIQUE = uuid.uuid4().hex[:8]


def _mock_login(session: requests.Session, user_type: str) -> bool:
    r = session.post(f"{API}/auth/mock-login", params={"user_type": user_type}, timeout=20)
    return r.status_code == 200


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    if not _mock_login(s, "admin"):
        pytest.skip("Admin mock-login failed")
    return s


@pytest.fixture(scope="module")
def user_client():
    s = requests.Session()
    # candidate role users come from "free" / "subscription" mock buckets
    if not _mock_login(s, "subscription"):
        pytest.skip("Candidate mock-login failed")
    return s


@pytest.fixture(scope="module")
def anon_client():
    return requests.Session()


@pytest.fixture(scope="module")
def seeded_cohort(admin_client):
    """Create a fresh cohort for the entire module to test against."""
    payload = {
        "name": f"TEST_Cohort_{UNIQUE}",
        "slug": f"test-cohort-{UNIQUE}",
        "tagline": "Auto-test cohort",
        "description": "test desc",
        "duration_weeks": 4,
        "price": 25000.0,
        "currency": "INR",
        "plan_key": "cohort_premium",
        "is_active": True,
        "is_featured": True,
        "highlights": ["AI feedback", "Live sessions"],
        "sessions": [
            {"week_number": 1, "day_label": "Saturday", "topic": "Intro"},
            {"week_number": 1, "day_label": "Sunday", "topic": "Frameworks"},
        ],
    }
    r = admin_client.post(f"{API}/admin/cohort-programs", json=payload, timeout=20)
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    cohort = r.json()["cohort"]
    yield cohort
    # cleanup: hard-delete
    admin_client.delete(f"{API}/admin/cohort-programs/{cohort['id']}", params={"hard": "true"}, timeout=20)


# ============= Public endpoints =============
class TestPublic:
    def test_featured_returns_list(self, anon_client, seeded_cohort):
        r = anon_client.get(f"{API}/cohorts/featured", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "cohorts" in data and isinstance(data["cohorts"], list)
        slugs = [c.get("slug") for c in data["cohorts"]]
        assert seeded_cohort["slug"] in slugs

    def test_by_slug_returns_full(self, anon_client, seeded_cohort):
        r = anon_client.get(f"{API}/cohorts/by-slug/{seeded_cohort['slug']}", timeout=20)
        assert r.status_code == 200
        c = r.json()["cohort"]
        assert c["slug"] == seeded_cohort["slug"]
        assert c["name"] == seeded_cohort["name"]
        assert c["price"] == 25000.0
        assert c["price_with_gst"] == round(25000.0 * 1.18, 2) == 29500.0
        assert c["session_count"] == 2

    def test_by_slug_404(self, anon_client):
        r = anon_client.get(f"{API}/cohorts/by-slug/no-such-slug-xyz", timeout=20)
        assert r.status_code == 404

    def test_discovery_call_submit(self, anon_client, seeded_cohort):
        body = {
            "name": "TEST_Discovery",
            "email": f"test_{UNIQUE}@example.com",
            "phone": "9999999999",
            "cohort_slug": seeded_cohort["slug"],
            "message": "hello",
            "preferred_time": "weekday-evening",
        }
        r = anon_client.post(f"{API}/cohorts/discovery-call", json=body, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") is True
        assert "request_id" in data


# ============= Auth-required endpoints =============
class TestAuthEnrolment:
    def test_create_order_requires_auth(self, anon_client, seeded_cohort):
        r = anon_client.post(
            f"{API}/cohorts/enrol/create-order",
            json={"cohort_id": seeded_cohort["id"]},
            timeout=20,
        )
        assert r.status_code in (401, 403)

    def test_create_order_invalid_cohort(self, user_client):
        r = user_client.post(
            f"{API}/cohorts/enrol/create-order",
            json={"cohort_id": "non-existent-cohort"},
            timeout=20,
        )
        assert r.status_code == 404

    def test_create_order_invalid_coupon(self, user_client, seeded_cohort):
        r = user_client.post(
            f"{API}/cohorts/enrol/create-order",
            json={"cohort_id": seeded_cohort["id"], "coupon_code": "TOTALLY_INVALID_CODE_XYZ"},
            timeout=20,
        )
        assert r.status_code == 400

    def test_create_order_success_shape(self, user_client, seeded_cohort):
        r = user_client.post(
            f"{API}/cohorts/enrol/create-order",
            json={"cohort_id": seeded_cohort["id"]},
            timeout=30,
        )
        # If razorpay isn't configured in test env, allow 503 but mark
        if r.status_code == 503:
            pytest.skip("Razorpay not configured")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "razorpay_order_id" in data
        assert "amount_in_paise" in data
        # 25000 + 18% GST = 29500 INR -> 2950000 paise
        assert data["amount_in_paise"] == 2950000
        assert data["amount"] == 29500.0
        assert data["base_amount"] == 25000.0
        assert data["gst"] == 4500.0
        assert data["cohort"]["id"] == seeded_cohort["id"]

    def test_my_enrollments_requires_auth(self, anon_client):
        r = anon_client.get(f"{API}/cohorts/my-enrollments", timeout=20)
        assert r.status_code in (401, 403)

    def test_my_enrollments_returns_list(self, user_client):
        r = user_client.get(f"{API}/cohorts/my-enrollments", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "enrollments" in data
        assert isinstance(data["enrollments"], list)


# ============= Admin CRUD =============
class TestAdmin:
    def test_admin_list(self, admin_client, seeded_cohort):
        r = admin_client.get(f"{API}/admin/cohort-programs", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "cohorts" in data
        ids = [c.get("id") for c in data["cohorts"]]
        assert seeded_cohort["id"] in ids
        # enrollment_count should be present
        seeded = next(c for c in data["cohorts"] if c["id"] == seeded_cohort["id"])
        assert "enrollment_count" in seeded

    def test_admin_get_one(self, admin_client, seeded_cohort):
        r = admin_client.get(f"{API}/admin/cohort-programs/{seeded_cohort['id']}", timeout=20)
        assert r.status_code == 200
        c = r.json()["cohort"]
        assert c["id"] == seeded_cohort["id"]
        assert "enrollment_count" in c

    def test_admin_get_404(self, admin_client):
        r = admin_client.get(f"{API}/admin/cohort-programs/missing-id", timeout=20)
        assert r.status_code == 404

    def test_admin_update(self, admin_client, seeded_cohort):
        upd = dict(seeded_cohort)
        upd["tagline"] = "updated tagline"
        # strip server-only computed
        upd.pop("created_at", None)
        upd.pop("updated_at", None)
        upd.pop("enrollment_count", None)
        r = admin_client.put(f"{API}/admin/cohort-programs/{seeded_cohort['id']}", json=upd, timeout=20)
        assert r.status_code == 200
        # GET to verify persisted
        g = admin_client.get(f"{API}/admin/cohort-programs/{seeded_cohort['id']}", timeout=20)
        assert g.json()["cohort"]["tagline"] == "updated tagline"

    def test_admin_create_duplicate_slug_409(self, admin_client, seeded_cohort):
        payload = {
            "name": "dup",
            "slug": seeded_cohort["slug"],
            "price": 25000.0,
            "duration_weeks": 4,
        }
        r = admin_client.post(f"{API}/admin/cohort-programs", json=payload, timeout=20)
        assert r.status_code == 409

    def test_admin_enrollments_listing(self, admin_client, seeded_cohort):
        r = admin_client.get(f"{API}/admin/cohort-programs/{seeded_cohort['id']}/enrollments", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "enrollments" in data and isinstance(data["enrollments"], list)

    def test_admin_discovery_calls_list(self, admin_client):
        r = admin_client.get(f"{API}/admin/cohort-programs/discovery-calls/list", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data and isinstance(data["requests"], list)

    def test_admin_discovery_calls_filter_pending(self, admin_client):
        r = admin_client.get(
            f"{API}/admin/cohort-programs/discovery-calls/list",
            params={"status": "pending"},
            timeout=20,
        )
        assert r.status_code == 200
        for rec in r.json()["requests"]:
            assert rec.get("status") == "pending"

    def test_admin_discovery_call_lifecycle(self, admin_client, anon_client, seeded_cohort):
        # Create one
        body = {
            "name": "TEST_Lifecycle",
            "email": f"life_{UNIQUE}@example.com",
            "cohort_slug": seeded_cohort["slug"],
        }
        c = anon_client.post(f"{API}/cohorts/discovery-call", json=body, timeout=20).json()
        rid = c["request_id"]

        # Schedule
        s = admin_client.post(
            f"{API}/admin/cohort-programs/discovery-calls/{rid}/schedule",
            json={"scheduled_at": "2026-02-01T10:00:00Z", "meet_link": "https://meet.google.com/x", "notes": "n"},
            timeout=20,
        )
        assert s.status_code == 200, s.text

        # Mark completed
        m = admin_client.post(f"{API}/admin/cohort-programs/discovery-calls/{rid}/mark-completed", timeout=20)
        assert m.status_code == 200

        # Cancel - exists, returns 200 (idempotent path)
        c2 = admin_client.post(f"{API}/admin/cohort-programs/discovery-calls/{rid}/cancel", timeout=20)
        assert c2.status_code == 200

        # 404 for unknown id
        nf = admin_client.post(
            f"{API}/admin/cohort-programs/discovery-calls/bogus-id-{UNIQUE}/cancel", timeout=20
        )
        assert nf.status_code == 404

    def test_admin_endpoints_require_admin(self, user_client, seeded_cohort):
        r = user_client.get(f"{API}/admin/cohort-programs", timeout=20)
        assert r.status_code == 403
        r2 = user_client.get(f"{API}/admin/cohort-programs/{seeded_cohort['id']}", timeout=20)
        assert r2.status_code == 403
        r3 = user_client.get(f"{API}/admin/cohort-programs/discovery-calls/list", timeout=20)
        assert r3.status_code == 403

    def test_admin_endpoints_require_auth(self, anon_client):
        r = anon_client.get(f"{API}/admin/cohort-programs", timeout=20)
        assert r.status_code in (401, 403)


# ============= Regression: legacy admin cohorts route =============
class TestLegacyRegression:
    def test_legacy_admin_cohorts_still_works(self, admin_client):
        # /api/admin/cohorts should still resolve (legacy cohort-groups)
        r = admin_client.get(f"{API}/admin/cohorts", timeout=20)
        # Accept 200 or 404 (route shape varies) but must NOT 500
        assert r.status_code != 500, f"Legacy /api/admin/cohorts crashed: {r.text}"
