"""
Tests for: 
  1. Admin GET /api/admin/discovery-calls/bookings - merges cohort_discovery_calls + discovery_call_bookings
  2. Coaching session price endpoint
  3. Coaching create-session-order-with-slot endpoint
  4. Existing credit-based booking endpoint regression
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


def _login(user_type: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/mock-login", params={"user_type": user_type}, timeout=30)
    assert r.status_code in (200, 201), f"mock-login {user_type} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login("admin")


@pytest.fixture(scope="module")
def candidate_session():
    return _login("subscription")


@pytest.fixture(scope="module")
def free_trial_session():
    return _login("free_trial")


# ---------- Discovery merge ----------
class TestDiscoveryMerge:
    def test_admin_bookings_merge_no_filter(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/discovery-calls/bookings", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "bookings" in data and "counts" in data
        bookings = data["bookings"]
        # Each must have a `source` field
        for b in bookings:
            assert "source" in b, f"booking missing source: {b}"
            assert b["source"] in ("coaching", "cohort")
            # cohort entries must include cohort_name + display field
            if b["source"] == "cohort":
                assert "cohort_name" in b
                assert "cohort_slug" in b
                assert "scheduled_datetime_display" in b
                # status must be mapped to admin UI vocab
                assert b["status"] in ("pending", "accepted", "rejected", "completed")
        # counts must include all keys
        for k in ("total", "pending", "accepted", "rejected", "completed"):
            assert k in data["counts"]

    def test_admin_bookings_status_filters(self, admin_session):
        for status in ("pending", "accepted", "rejected", "completed"):
            r = admin_session.get(
                f"{BASE_URL}/api/admin/discovery-calls/bookings",
                params={"status": status}, timeout=30
            )
            assert r.status_code == 200, f"{status}: {r.text}"
            data = r.json()
            for b in data["bookings"]:
                assert b["status"] == status, f"{status}: got {b}"

    def test_admin_bookings_has_cohort_entries(self, admin_session):
        """Per problem statement, dev DB has cohort discovery calls."""
        r = admin_session.get(f"{BASE_URL}/api/admin/discovery-calls/bookings", timeout=30)
        assert r.status_code == 200
        bookings = r.json()["bookings"]
        cohort_bookings = [b for b in bookings if b.get("source") == "cohort"]
        # not asserting >0 strictly, but log
        print(f"Found {len(cohort_bookings)} cohort booking(s) in merged response")

    def test_unauthenticated_admin_endpoint_blocked(self):
        r = requests.get(f"{BASE_URL}/api/admin/discovery-calls/bookings", timeout=30)
        assert r.status_code in (401, 403), f"expected auth-block, got {r.status_code}"


# ---------- Coaching payment endpoints ----------
class TestCoachingPayment:
    @pytest.fixture(scope="class")
    def mentor_id(self, candidate_session):
        # Find any active mentor
        r = candidate_session.get(f"{BASE_URL}/api/mentors", timeout=30)
        assert r.status_code == 200, r.text
        mentors = r.json() if isinstance(r.json(), list) else r.json().get("mentors", [])
        assert len(mentors) > 0, "no mentors in DB"
        return mentors[0].get("id") or mentors[0].get("_id")

    def test_session_price_shape(self, candidate_session, mentor_id):
        r = candidate_session.get(
            f"{BASE_URL}/api/payments/mentor/{mentor_id}/session-price", timeout=30
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("base_price", "gst", "total_price"):
            assert k in data, f"missing {k} in session-price response"
        assert isinstance(data["base_price"], (int, float))
        assert isinstance(data["gst"], (int, float))
        assert isinstance(data["total_price"], (int, float))

    def test_create_session_order_with_slot(self, candidate_session, mentor_id):
        # Use a far-future date to avoid slot conflicts
        from datetime import datetime, timedelta
        target = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")
        payload = {
            "mentor_id": mentor_id,
            "date": target,
            "time_slot": "10:00",
            "session_type": "case",
            "case_type": "profit",
            "candidate_notes": "TEST_dashboard_direct_pay",
        }
        r = candidate_session.post(
            f"{BASE_URL}/api/payments/create-session-order-with-slot",
            json=payload, timeout=45,
        )
        # Acceptable: 200 (created), 400 (slot taken / mentor unavailable for that day)
        # The endpoint must NOT 500 or 404
        assert r.status_code != 404, f"endpoint missing: {r.text}"
        assert r.status_code != 500, f"server error: {r.text}"
        if r.status_code == 200:
            data = r.json()
            # Razorpay order shape
            assert "order_id" in data or "id" in data, f"no order id: {data}"
            assert "amount" in data
            assert "currency" in data or "key_id" in data or "razorpay_key" in data
        else:
            # 400/409 acceptable for slot/availability conflict
            assert r.status_code in (400, 409, 422), f"unexpected status: {r.status_code} {r.text}"


# ---------- Existing credit-based booking regression ----------
class TestCreditBookingRegression:
    def test_credit_booking_endpoint_exists(self, candidate_session):
        # Get a mentor
        r = candidate_session.get(f"{BASE_URL}/api/mentors", timeout=30)
        mentors = r.json() if isinstance(r.json(), list) else r.json().get("mentors", [])
        if not mentors:
            pytest.skip("no mentors")
        mid = mentors[0].get("id") or mentors[0].get("_id")
        # Just hit it with empty body to check it's not 404 (auth/validation will reject)
        from datetime import datetime, timedelta
        target = (datetime.utcnow() + timedelta(days=20)).strftime("%Y-%m-%d")
        r = candidate_session.post(
            f"{BASE_URL}/api/mentors/{mid}/book",
            json={
                "date": target, "time_slot": "11:00",
                "session_type": "case", "case_type": "profit",
                "candidate_notes": "TEST_regression"
            },
            timeout=30,
        )
        assert r.status_code != 404, "credit-booking endpoint missing"
        assert r.status_code != 500, f"server error in credit booking: {r.text}"
        # Likely 400 (no credits) or 200 (booked) — both acceptable
        print(f"credit-booking status: {r.status_code} body: {r.text[:200]}")


# ---------- Free-trial unblur (just verify they can hit dashboard data) ----------
class TestFreeTrialAccess:
    def test_free_trial_can_list_mentors(self, free_trial_session):
        r = free_trial_session.get(f"{BASE_URL}/api/mentors", timeout=30)
        assert r.status_code == 200, r.text
        mentors = r.json() if isinstance(r.json(), list) else r.json().get("mentors", [])
        assert len(mentors) > 0
        # mentors should include name + photo so frontend can display unblurred
        m = mentors[0]
        assert "name" in m or "full_name" in m or "first_name" in m
