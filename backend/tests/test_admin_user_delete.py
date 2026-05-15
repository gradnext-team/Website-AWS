"""
Tests for admin user deletion (single + bulk).

The bug: production users got "Failed to delete user" when trying to
delete candidates. Two issues:
  1. The /users/bulk-delete POST endpoint did not exist on the backend
     (frontend was calling it, getting 405 Method Not Allowed, alerting
     a generic failure).
  2. The single delete /users/{user_id} did limited cascade cleanup,
     leaving orphaned rows that could break re-signups.

These tests confirm both endpoints work for any role (candidate /
mentor / admin), with proper cascade and graceful failure reporting.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=10)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def db():
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


def _seed_user(db, role="candidate", with_associated=True):
    """Insert a test user + a few rows in associated collections so we
    can verify cascade cleanup."""
    uid = f"test_user_{uuid.uuid4().hex[:10]}"
    email = f"{uid}@test.local"
    now = datetime.now(timezone.utc).isoformat()
    db.users.insert_one({
        "id": uid,
        "email": email,
        "name": f"Test {role.title()}",
        "role": role,
        "is_admin": role == "admin",
        "is_mentor": role == "mentor",
        "created_at": now,
    })
    if with_associated:
        db.bookings.insert_one({"id": f"bk_{uid}", "user_id": uid, "created_at": now})
        db.payments.insert_one({"id": f"pay_{uid}", "user_id": uid, "amount": 100, "order_id": f"ord_{uid}", "razorpay_payment_id": f"rp_{uid}"})
        db.payment_orders.insert_one({"id": f"po_{uid}", "user_id": uid, "amount": 100, "order_id": f"po_ord_{uid}"})
        db.notifications.insert_one({"id": f"n_{uid}", "user_id": uid, "message": "x"})
        db.slot_reservations.insert_one({"id": f"sr_{uid}", "user_id": uid})
    return uid, email


def test_single_delete_works_for_candidate(admin_session, db):
    uid, email = _seed_user(db, role="candidate")
    r = admin_session.delete(f"{API}/admin/users/{uid}", timeout=15)
    assert r.status_code == 200, r.text
    assert db.users.find_one({"id": uid}) is None
    # Cascade should have cleaned up associated rows
    assert db.bookings.find_one({"user_id": uid}) is None
    assert db.payments.find_one({"user_id": uid}) is None
    assert db.payment_orders.find_one({"user_id": uid}) is None
    assert db.notifications.find_one({"user_id": uid}) is None
    assert db.slot_reservations.find_one({"user_id": uid}) is None


def test_single_delete_works_for_mentor(admin_session, db):
    uid, _ = _seed_user(db, role="mentor")
    r = admin_session.delete(f"{API}/admin/users/{uid}", timeout=15)
    assert r.status_code == 200, r.text
    assert db.users.find_one({"id": uid}) is None


def test_single_delete_works_for_admin(admin_session, db):
    uid, _ = _seed_user(db, role="admin")
    r = admin_session.delete(f"{API}/admin/users/{uid}", timeout=15)
    assert r.status_code == 200, r.text
    assert db.users.find_one({"id": uid}) is None


def test_single_delete_returns_404_for_unknown(admin_session):
    r = admin_session.delete(f"{API}/admin/users/does_not_exist_123", timeout=15)
    assert r.status_code == 404, r.text


def test_bulk_delete_endpoint_exists(admin_session):
    """Was 405 (Method Not Allowed) before the fix — endpoint didn't exist."""
    r = admin_session.post(f"{API}/admin/users/bulk-delete", json={"user_ids": []}, timeout=15)
    # Empty list → 400 Bad Request now (not 405)
    assert r.status_code != 405, "bulk-delete endpoint is still missing"
    assert r.status_code == 400, r.text


def test_bulk_delete_succeeds_for_mixed_roles(admin_session, db):
    candidate_id, _ = _seed_user(db, role="candidate")
    mentor_id, _ = _seed_user(db, role="mentor")
    admin_id, _ = _seed_user(db, role="admin")
    
    r = admin_session.post(
        f"{API}/admin/users/bulk-delete",
        json={"user_ids": [candidate_id, mentor_id, admin_id]},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted_count"] == 3, body
    assert body["failed_count"] == 0, body
    
    for uid in [candidate_id, mentor_id, admin_id]:
        assert db.users.find_one({"id": uid}) is None
        assert db.bookings.find_one({"user_id": uid}) is None


def test_bulk_delete_reports_per_user_failures(admin_session, db):
    """A non-existent user must NOT poison the whole batch — others
    should still be deleted, and the bad one reported in `failed`."""
    good_id, _ = _seed_user(db, role="candidate")
    bad_id = "definitely_not_a_user_id"
    
    r = admin_session.post(
        f"{API}/admin/users/bulk-delete",
        json={"user_ids": [good_id, bad_id]},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted_count"] == 1, body
    assert body["failed_count"] == 1, body
    assert body["deleted"] == [good_id]
    assert body["failed"][0]["user_id"] == bad_id
    assert "Not found" in body["failed"][0]["error"]
    assert db.users.find_one({"id": good_id}) is None


def test_bulk_delete_rejects_empty_request(admin_session):
    r = admin_session.post(f"{API}/admin/users/bulk-delete", json={"user_ids": []}, timeout=15)
    assert r.status_code == 400, r.text
