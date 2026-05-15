"""Tests for CRM Reach Outs grouping + Contact Log endpoints (iteration_72)."""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/mock-login", params={"user_type": "admin"}, timeout=30)
    assert r.status_code == 200, f"mock-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def db_handle():
    """Direct Mongo handle for seeding stage_changed_at."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    yield db, asyncio.get_event_loop() if False else None
    client.close()


# ---------- Reach Outs ----------

class TestReachOutsRouteOrdering:
    def test_reach_outs_returns_200_not_treated_as_lead(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200, f"Route ordering issue (would be 404 if treated as lead id): {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "groups" in body and "totals" in body
        for k in ("overdue", "due_today", "due_tomorrow", "due_this_week"):
            assert k in body["groups"]
            assert k in body["totals"]

    def test_reach_outs_empty_when_no_rules(self, admin_session):
        # We don't delete rules — just verify shape always holds
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body["groups"]["overdue"], list)


class TestReachOutsGrouping:
    """Seed a workflow rule + leads with different stage_changed_at dates,
    verify bucketing logic: <0=overdue, 0=today, 1=tomorrow, 2..7=this_week, >7=ignored."""

    funnel_id = None
    stage_id = None
    rule_id = None
    seeded_lead_ids = []

    def test_seed_workflow_rule_and_leads(self, admin_session):
        # Get a funnel + first stage
        rf = admin_session.get(f"{API}/crm/funnels", timeout=30)
        assert rf.status_code == 200
        body = rf.json()
        funnels = body.get("funnels") if isinstance(body, dict) else body
        assert funnels, "No funnels exist — cannot seed"
        funnel = funnels[0]
        stages = funnel.get("stages", [])
        assert stages, "Funnel has no stages"
        TestReachOutsGrouping.funnel_id = funnel["id"]
        TestReachOutsGrouping.stage_id = stages[0]["id"]

        # Create workflow rule with days_threshold=3
        rule_payload = {
            "name": f"TEST_reach_rule_{uuid.uuid4().hex[:6]}",
            "funnel_id": TestReachOutsGrouping.funnel_id,
            "stage_id": TestReachOutsGrouping.stage_id,
            "days_threshold": 3,
            "description": "test reach out rule",
        }
        rr = admin_session.post(f"{API}/crm/workflow-rules", json=rule_payload, timeout=30)
        assert rr.status_code in (200, 201), f"Create rule failed: {rr.status_code} {rr.text}"
        rule = rr.json().get("rule") or rr.json()
        TestReachOutsGrouping.rule_id = rule.get("id")
        assert TestReachOutsGrouping.rule_id

        # Create 5 leads, with stage_changed_at offsets so due_date - today =
        # overdue (-2), today (0), tomorrow (+1), this_week (+5), future (+10)
        # due_date = stage_changed_at + 3 days. So stage_changed_at = today - 3 + offset
        today = datetime.utcnow().replace(hour=12, minute=0, second=0, microsecond=0)
        cases = {
            "overdue": today - timedelta(days=5),       # due 2 days ago
            "today":   today - timedelta(days=3),       # due today
            "tomorrow": today - timedelta(days=2),      # due tomorrow
            "this_week": today + timedelta(days=2),     # due in 5 days
            "future":   today + timedelta(days=7),      # due in 10 days -> ignored
        }
        for label, sc_dt in cases.items():
            payload = {
                "name": f"TEST_reach_{label}_{uuid.uuid4().hex[:6]}",
                "email": f"test_{label}_{uuid.uuid4().hex[:6]}@example.com",
                "phone": "+10000000000",
                "funnel_id": TestReachOutsGrouping.funnel_id,
                "stage_id": TestReachOutsGrouping.stage_id,
            }
            cr = admin_session.post(f"{API}/crm/leads", json=payload, timeout=30)
            assert cr.status_code in (200, 201), f"Create lead {label} failed: {cr.status_code} {cr.text}"
            lead = cr.json().get("lead") or cr.json()
            lead_id = lead["id"]
            TestReachOutsGrouping.seeded_lead_ids.append((label, lead_id, sc_dt.isoformat()))

        # Directly update stage_changed_at via Mongo (no API for this)
        import pymongo
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017").strip().strip('"').strip("'")
        db_name = os.environ.get("DB_NAME", "test_database").strip().strip('"').strip("'")
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        for label, lid, ts in TestReachOutsGrouping.seeded_lead_ids:
            db.crm_leads.update_one({"id": lid}, {"$set": {"stage_changed_at": ts, "status": "active"}})
        client.close()

    def test_reach_outs_buckets_correctly(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200
        groups = r.json()["groups"]

        id_to_label = {lid: label for label, lid, _ in TestReachOutsGrouping.seeded_lead_ids}

        def label_of(item):
            return id_to_label.get(item["lead_id"])

        overdue_labels = {label_of(x) for x in groups["overdue"] if label_of(x)}
        today_labels = {label_of(x) for x in groups["due_today"] if label_of(x)}
        tomorrow_labels = {label_of(x) for x in groups["due_tomorrow"] if label_of(x)}
        week_labels = {label_of(x) for x in groups["due_this_week"] if label_of(x)}
        all_labels = overdue_labels | today_labels | tomorrow_labels | week_labels

        assert "overdue" in overdue_labels, f"expected overdue lead in overdue group; got buckets={overdue_labels}/{today_labels}/{tomorrow_labels}/{week_labels}"
        assert "today" in today_labels, f"expected today lead in due_today group; today={today_labels}"
        assert "tomorrow" in tomorrow_labels, f"expected tomorrow lead in due_tomorrow group; got {tomorrow_labels}"
        assert "this_week" in week_labels, f"expected this_week lead in due_this_week group; got {week_labels}"
        assert "future" not in all_labels, "future (>7 days) lead should NOT appear in any group"

    def test_reach_outs_admin_filter_by_rep(self, admin_session):
        # Filter to non-existent rep -> 0 results
        r = admin_session.get(f"{API}/crm/leads/reach-outs", params={"assigned_to": "nonexistent-rep"}, timeout=30)
        assert r.status_code == 200
        totals = r.json()["totals"]
        assert sum(totals.values()) == 0, f"filter by nonexistent rep should yield 0; got {totals}"

    def test_cleanup_seeded_data(self, admin_session):
        for _, lid, _ in TestReachOutsGrouping.seeded_lead_ids:
            admin_session.delete(f"{API}/crm/leads/{lid}", timeout=15)
        if TestReachOutsGrouping.rule_id:
            admin_session.delete(f"{API}/crm/workflow-rules/{TestReachOutsGrouping.rule_id}", timeout=15)


# ---------- Contact Logs ----------

class TestContactLogs:
    lead_id = None

    def test_seed_lead(self, admin_session):
        rf = admin_session.get(f"{API}/crm/funnels", timeout=30)
        body = rf.json()
        funnels = body.get("funnels") if isinstance(body, dict) else body
        funnel = funnels[0]
        payload = {
            "name": f"TEST_contactlog_{uuid.uuid4().hex[:6]}",
            "email": f"cl_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+12223334444",
            "funnel_id": funnel["id"],
            "stage_id": funnel["stages"][0]["id"],
        }
        r = admin_session.post(f"{API}/crm/leads", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        TestContactLogs.lead_id = (r.json().get("lead") or r.json())["id"]

    def test_create_contact_log_success(self, admin_session):
        payload = {
            "lead_id": TestContactLogs.lead_id,
            "method": "call",
            "outcome": "reached",
            "reply": "Discussed pricing, will revert.",
            "next_follow_up_date": (datetime.utcnow().date() + timedelta(days=2)).isoformat(),
        }
        r = admin_session.post(f"{API}/crm/contact-logs", json=payload, timeout=30)
        assert r.status_code == 200, f"create contact-log failed: {r.status_code} {r.text}"
        data = r.json()
        assert "log" in data
        log = data["log"]
        assert log["method"] == "call"
        assert log["outcome"] == "reached"
        assert log["reply"] == "Discussed pricing, will revert."
        assert log["lead_id"] == TestContactLogs.lead_id
        assert "_id" not in log

    def test_invalid_method_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/crm/contact-logs", json={
            "lead_id": TestContactLogs.lead_id,
            "method": "fax",
            "outcome": "reached",
        }, timeout=30)
        assert r.status_code == 400, f"expected 400 for invalid method, got {r.status_code} {r.text}"

    def test_invalid_outcome_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/crm/contact-logs", json={
            "lead_id": TestContactLogs.lead_id,
            "method": "call",
            "outcome": "maybe",
        }, timeout=30)
        assert r.status_code == 400

    def test_nonexistent_lead_404(self, admin_session):
        r = admin_session.post(f"{API}/crm/contact-logs", json={
            "lead_id": "nope-" + uuid.uuid4().hex,
            "method": "call",
            "outcome": "reached",
        }, timeout=30)
        assert r.status_code == 404

    def test_lead_last_contacted_at_updated(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/{TestContactLogs.lead_id}", timeout=30)
        assert r.status_code == 200
        lead = r.json().get("lead") or r.json()
        assert lead.get("last_contacted_at"), "last_contacted_at should be set after contact log"

    def test_list_contact_logs_for_lead(self, admin_session):
        r = admin_session.get(f"{API}/crm/contact-logs", params={"lead_id": TestContactLogs.lead_id}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "logs" in body and body["total"] >= 1
        log = body["logs"][0]
        assert log["lead_id"] == TestContactLogs.lead_id

    def test_activity_timeline_contains_contact_logged(self, admin_session):
        # Activities are embedded in GET /api/crm/leads/{id} response
        r = admin_session.get(f"{API}/crm/leads/{TestContactLogs.lead_id}", timeout=20)
        assert r.status_code == 200
        body = r.json()
        acts = body.get("activities", [])
        types = [a.get("activity_type") for a in acts]
        assert "contact_logged" in types, f"contact_logged activity missing. Found types: {types}"

    def test_stage_changed_at_regression(self, admin_session):
        """PUT stage change on a lead still stamps stage_changed_at."""
        rf = admin_session.get(f"{API}/crm/funnels", timeout=30)
        body = rf.json()
        funnels = body.get("funnels") if isinstance(body, dict) else body
        funnel = funnels[0]
        stages = funnel["stages"]
        if len(stages) < 2:
            pytest.skip("need >=2 stages")
        new_stage = stages[1]["id"]
        before = admin_session.get(f"{API}/crm/leads/{TestContactLogs.lead_id}", timeout=15).json()
        before_lead = before.get("lead") or before
        prev_ts = before_lead.get("stage_changed_at")
        r = admin_session.put(f"{API}/crm/leads/{TestContactLogs.lead_id}", json={"stage_id": new_stage}, timeout=15)
        assert r.status_code == 200
        after = admin_session.get(f"{API}/crm/leads/{TestContactLogs.lead_id}", timeout=15).json()
        after_lead = after.get("lead") or after
        assert after_lead.get("stage_changed_at") and after_lead.get("stage_changed_at") != prev_ts

    def test_cleanup(self, admin_session):
        if TestContactLogs.lead_id:
            admin_session.delete(f"{API}/crm/leads/{TestContactLogs.lead_id}", timeout=15)
