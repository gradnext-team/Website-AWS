"""
Tests for:
  1. POST /api/admin/mentors/reorder — accepts {orders:[{id,display_order}]}
     and persists the new display_order in MongoDB.
  2. GET /api/mentors/featured?slim=true and /api/mentors?slim=true —
     returns a smaller payload that omits the `availability` field
     (used by /mentors landing page for performance).
"""

import os
import json
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    """Login as admin via mock-login route. user_type=admin is a query param."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/mock-login?user_type=admin", json={})
    assert r.status_code == 200, f"Mock admin login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    # mock-login returns flat user dict + auth_token
    assert body.get("is_admin") is True, f"Logged-in user not admin: {body}"
    token = body.get("auth_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- /api/admin/mentors/reorder ----------
class TestMentorReorder:
    def test_reorder_persists_new_display_order(self, admin_session):
        # Fetch active mentors via admin endpoint (returns {"mentors":[...]})
        r = admin_session.get(f"{API}/admin/mentors")
        assert r.status_code == 200, r.text[:200]
        mentors = [m for m in r.json().get("mentors", []) if not m.get("is_deleted")]
        if len(mentors) < 3:
            pytest.skip(f"Need at least 3 active mentors; have {len(mentors)}")

        # Take first 3 and reverse their order
        sample = mentors[:3]
        reversed_ids = [m["id"] for m in reversed(sample)]
        orders = [{"id": mid, "display_order": idx} for idx, mid in enumerate(reversed_ids)]

        # POST reorder
        r2 = admin_session.post(f"{API}/admin/mentors/reorder", json={"orders": orders})
        assert r2.status_code == 200, f"Reorder failed: {r2.status_code} {r2.text}"
        body = r2.json()
        assert body.get("count") == len(orders)
        assert "reorder" in body.get("message", "").lower()

        # GET to verify persistence
        r3 = admin_session.get(f"{API}/admin/mentors")
        assert r3.status_code == 200
        by_id = {m["id"]: m for m in r3.json().get("mentors", [])}
        for idx, mid in enumerate(reversed_ids):
            assert by_id[mid].get("display_order") == idx, (
                f"Mentor {mid} expected display_order={idx}, "
                f"got {by_id[mid].get('display_order')}"
            )

    def test_reorder_rejects_empty_orders(self, admin_session):
        r = admin_session.post(f"{API}/admin/mentors/reorder", json={"orders": []})
        assert r.status_code == 400


# ---------- /api/mentors and /api/mentors/featured slim payload ----------
def _as_list(payload):
    """Public mentor endpoints return a list directly; tolerate dict shape."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("mentors", [])
    return []


class TestMentorsSlim:
    def test_featured_slim_omits_availability(self):
        r_full = requests.get(f"{API}/mentors/featured")
        assert r_full.status_code == 200
        full_mentors = _as_list(r_full.json())

        r_slim = requests.get(f"{API}/mentors/featured?slim=true")
        assert r_slim.status_code == 200
        slim_mentors = _as_list(r_slim.json())

        if not slim_mentors:
            pytest.skip("No featured mentors to compare slim payload against")

        for m in slim_mentors:
            assert "availability" not in m, (
                f"slim featured mentor {m.get('id')} unexpectedly has availability"
            )

        # Slim payload should be byte-smaller than full one when full has any
        # availability data populated.
        slim_bytes = len(json.dumps(slim_mentors))
        full_bytes = len(json.dumps(full_mentors))
        any_avail = any((m.get("availability") or []) for m in full_mentors)
        if any_avail:
            assert slim_bytes < full_bytes, (
                f"Expected slim ({slim_bytes}b) < full ({full_bytes}b) "
                f"when availability present"
            )

    def test_mentors_listing_slim(self):
        r_slim = requests.get(f"{API}/mentors?slim=true")
        assert r_slim.status_code == 200
        for m in _as_list(r_slim.json()):
            assert "availability" not in m

    def test_featured_returns_at_least_one(self):
        """Sanity-check seed: at least one mentor flagged is_landing_featured."""
        r = requests.get(f"{API}/mentors/featured?slim=true")
        assert r.status_code == 200
        assert len(_as_list(r.json())) >= 1
