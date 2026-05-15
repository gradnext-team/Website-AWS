"""Iteration 69: cohort dynamic plans + session_type field tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend env file
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

COHORT_ID = "da572c95-ffa5-4899-bd8a-6717c552116b"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/mock-login?user_type=admin", timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/mock-login?user_type=subscription", timeout=20)
    assert r.status_code == 200, r.text
    return s


# ---- Public landing default fallback (plans:[] => default 3 tiers) ----
def test_featured_default_plans_fallback(admin_session):
    # Reset to plans:[] and sessions:[] first
    g = admin_session.get(f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", timeout=15)
    assert g.status_code == 200, g.text
    cohort = g.json()["cohort"]
    payload = {**cohort, "plans": [], "sessions": []}
    payload.pop("_id", None)
    payload.pop("enrollment_count", None)
    p = admin_session.put(
        f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", json=payload, timeout=20
    )
    assert p.status_code == 200, p.text

    r = requests.get(f"{BASE_URL}/api/cohorts/featured", timeout=15)
    assert r.status_code == 200
    cohorts = r.json()["cohorts"]
    assert len(cohorts) >= 1
    target = next((c for c in cohorts if c.get("id") == COHORT_ID), cohorts[0])
    plans = target.get("plans", [])
    assert len(plans) == 3, f"Expected default 3 tiers, got {len(plans)}"
    names = [p["name"] for p in plans]
    assert "Self-Paced" in names
    assert "Cohort" in names
    assert "Cohort + Coaching" in names


# ---- Admin PUT accepts plans + session_type and persists ----
def test_admin_put_with_custom_plans_and_session_type(admin_session):
    custom_plans = [
        {
            "name": "Test Plan A",
            "price": "₹10,000",
            "cadence": "one-time",
            "blurb": "Test blurb",
            "features": ["feat A", "feat B"],
            "cta": "Apply A",
            "highlight": True,
            "badge": "Custom Test Badge",
        },
        {
            "name": "Test Plan B",
            "price": "₹20,000",
            "cadence": "monthly",
            "blurb": "Plan B blurb",
            "features": ["only one"],
            "cta": "Apply B",
            "highlight": False,
            "badge": None,
        },
    ]
    sessions = [
        {"week_number": 1, "topic": "Kickoff topic", "session_type": "Workshop"},
        {"week_number": 2, "topic": "Mock interview topic", "session_type": "Mock Interview"},
    ]
    g = admin_session.get(f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", timeout=15)
    cohort = g.json()["cohort"]
    payload = {**cohort, "plans": custom_plans, "sessions": sessions}
    payload.pop("_id", None)
    payload.pop("enrollment_count", None)
    p = admin_session.put(
        f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", json=payload, timeout=20
    )
    assert p.status_code == 200, p.text
    saved = p.json()["cohort"]
    assert len(saved["plans"]) == 2
    assert saved["plans"][0]["badge"] == "Custom Test Badge"
    assert saved["plans"][0]["features"] == ["feat A", "feat B"]
    assert saved["plans"][0]["highlight"] is True
    assert saved["sessions"][0]["session_type"] == "Workshop"
    assert saved["sessions"][1]["session_type"] == "Mock Interview"


# ---- Public landing exposes admin-saved plans + session_type ----
def test_featured_returns_admin_plans_and_session_types():
    r = requests.get(f"{BASE_URL}/api/cohorts/featured", timeout=15)
    assert r.status_code == 200
    cohorts = r.json()["cohorts"]
    target = next((c for c in cohorts if c.get("id") == COHORT_ID), None)
    assert target is not None, "featured cohort missing"
    plans = target["plans"]
    assert len(plans) == 2
    # Check custom badge on highlighted plan
    hl = [p for p in plans if p.get("highlight")]
    assert hl and hl[0]["badge"] == "Custom Test Badge"
    assert hl[0]["features"] == ["feat A", "feat B"]
    # Sessions expose session_type
    types = [s.get("session_type") for s in target["sessions"]]
    assert "Workshop" in types
    assert "Mock Interview" in types


# ---- Regression: enrol create-order still works ----
def test_create_cohort_order_regression(user_session):
    r = user_session.post(
        f"{BASE_URL}/api/cohorts/enrol/create-order",
        json={"cohort_id": COHORT_ID},
        timeout=20,
    )
    # Expect 200 or 409 (already enrolled). Should NOT 500.
    assert r.status_code in (200, 409), r.text
    if r.status_code == 200:
        body = r.json()
        assert "razorpay_order_id" in body
        assert body["base_amount"] > 0
        assert body["gst"] > 0


# ---- Regression: coupon validation ----
def test_create_cohort_order_invalid_coupon(user_session):
    r = user_session.post(
        f"{BASE_URL}/api/cohorts/enrol/create-order",
        json={"cohort_id": COHORT_ID, "coupon_code": "TOTALLY_FAKE_NOPE"},
        timeout=20,
    )
    # 409 if already enrolled blocks before coupon check; otherwise 400
    assert r.status_code in (400, 409), r.text


def test_create_cohort_order_valid_coupon(user_session):
    r = user_session.post(
        f"{BASE_URL}/api/cohorts/enrol/create-order",
        json={"cohort_id": COHORT_ID, "coupon_code": "COHORT20"},
        timeout=20,
    )
    assert r.status_code in (200, 409), r.text
    if r.status_code == 200:
        body = r.json()
        assert body["discount_amount"] > 0


# ---- Cleanup: reset cohort to plans:[] sessions:[] ----
def test_zz_cleanup_reset_cohort(admin_session):
    g = admin_session.get(f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", timeout=15)
    cohort = g.json()["cohort"]
    payload = {**cohort, "plans": [], "sessions": []}
    payload.pop("_id", None)
    payload.pop("enrollment_count", None)
    p = admin_session.put(
        f"{BASE_URL}/api/admin/cohort-programs/{COHORT_ID}", json=payload, timeout=20
    )
    assert p.status_code == 200
    assert p.json()["cohort"]["plans"] == []
    assert p.json()["cohort"]["sessions"] == []
