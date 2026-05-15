"""
Backend tests for CRM Workflow Rules, Plans, Overdue leads, and Won-plan fields.
Covers:
- GET /api/crm/plans
- GET/POST/PUT/DELETE /api/crm/workflow-rules
- GET /api/crm/leads/overdue (route ordering vs /leads/{id})
- PUT /api/crm/leads/{id} won_plan_key/won_plan_name/won_amount
- PUT /api/crm/leads/{id} stamps stage_changed_at on stage change
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/mock-login", params={"user_type": "admin"})
    assert r.status_code == 200, f"mock-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def funnel_and_stage(admin_session):
    """Find or create a funnel with at least one stage."""
    r = admin_session.get(f"{BASE_URL}/api/crm/funnels")
    assert r.status_code == 200, r.text
    data = r.json()
    funnels = data.get("funnels") or data.get("data") or []
    funnel = None
    for f in funnels:
        if f.get("stages"):
            funnel = f
            break
    if not funnel:
        # Create a funnel
        payload = {
            "name": f"TEST_funnel_{uuid.uuid4().hex[:6]}",
            "description": "test funnel",
            "stages": [
                {"name": "New", "color": "#999"},
                {"name": "Contacted", "color": "#888"},
            ],
        }
        cr = admin_session.post(f"{BASE_URL}/api/crm/funnels", json=payload)
        assert cr.status_code in (200, 201), cr.text
        funnel = cr.json().get("funnel") or cr.json()
    return funnel["id"], funnel["stages"][0]["id"], funnel["stages"]


# ---------- Plans ----------
class TestPlans:
    def test_get_plans_returns_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/crm/plans")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)

    def test_get_plans_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/crm/plans")
        assert r.status_code in (401, 403)


# ---------- Workflow Rules CRUD ----------
class TestWorkflowRules:
    created_id = None

    def test_list_rules_initially(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/crm/workflow-rules")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rules" in body
        assert isinstance(body["rules"], list)

    def test_create_rule(self, admin_session, funnel_and_stage):
        funnel_id, stage_id, _ = funnel_and_stage
        payload = {
            "name": f"TEST_rule_{uuid.uuid4().hex[:6]}",
            "funnel_id": funnel_id,
            "stage_id": stage_id,
            "days_threshold": 3,
            "description": "auto",
        }
        r = admin_session.post(f"{BASE_URL}/api/crm/workflow-rules", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rule" in body
        rule = body["rule"]
        assert rule["name"] == payload["name"]
        assert rule["funnel_id"] == funnel_id
        assert rule["stage_id"] == stage_id
        assert rule["days_threshold"] == 3
        assert rule.get("id")
        TestWorkflowRules.created_id = rule["id"]

        # GET to verify persistence
        r2 = admin_session.get(f"{BASE_URL}/api/crm/workflow-rules")
        ids = [ru["id"] for ru in r2.json()["rules"]]
        assert rule["id"] in ids

    def test_create_rule_bad_funnel(self, admin_session, funnel_and_stage):
        _, stage_id, _ = funnel_and_stage
        r = admin_session.post(
            f"{BASE_URL}/api/crm/workflow-rules",
            json={"name": "x", "funnel_id": "nope", "stage_id": stage_id, "days_threshold": 2},
        )
        assert r.status_code == 404

    def test_create_rule_bad_stage(self, admin_session, funnel_and_stage):
        funnel_id, _, _ = funnel_and_stage
        r = admin_session.post(
            f"{BASE_URL}/api/crm/workflow-rules",
            json={"name": "x", "funnel_id": funnel_id, "stage_id": "nope", "days_threshold": 2},
        )
        assert r.status_code == 400

    def test_create_rule_zero_threshold_rejected(self, admin_session, funnel_and_stage):
        funnel_id, stage_id, _ = funnel_and_stage
        r = admin_session.post(
            f"{BASE_URL}/api/crm/workflow-rules",
            json={"name": "x", "funnel_id": funnel_id, "stage_id": stage_id, "days_threshold": 0},
        )
        assert r.status_code == 400

    def test_update_rule(self, admin_session):
        assert TestWorkflowRules.created_id
        r = admin_session.put(
            f"{BASE_URL}/api/crm/workflow-rules/{TestWorkflowRules.created_id}",
            json={"days_threshold": 7, "name": "TEST_updated_name"},
        )
        assert r.status_code == 200, r.text
        # Verify persistence
        r2 = admin_session.get(f"{BASE_URL}/api/crm/workflow-rules")
        match = next(ru for ru in r2.json()["rules"] if ru["id"] == TestWorkflowRules.created_id)
        assert match["days_threshold"] == 7
        assert match["name"] == "TEST_updated_name"

    def test_delete_rule(self, admin_session):
        assert TestWorkflowRules.created_id
        r = admin_session.delete(f"{BASE_URL}/api/crm/workflow-rules/{TestWorkflowRules.created_id}")
        assert r.status_code == 200, r.text
        # Verify removal
        r2 = admin_session.get(f"{BASE_URL}/api/crm/workflow-rules")
        ids = [ru["id"] for ru in r2.json()["rules"]]
        assert TestWorkflowRules.created_id not in ids

    def test_delete_nonexistent_rule(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/crm/workflow-rules/does-not-exist")
        assert r.status_code == 404


# ---------- Overdue leads route ordering + behavior ----------
class TestOverdueLeads:
    def test_overdue_route_returns_200_not_404(self, admin_session):
        """Critical: /leads/overdue must NOT be matched by /leads/{lead_id}."""
        r = admin_session.get(f"{BASE_URL}/api/crm/leads/overdue")
        assert r.status_code == 200, f"Route ordering issue! Got {r.status_code}: {r.text}"
        body = r.json()
        assert "count" in body
        assert "leads" in body
        assert isinstance(body["leads"], list)
        assert isinstance(body["count"], int)

    def test_overdue_zero_when_no_rules(self, admin_session):
        """With no workflow rules, count should be 0."""
        # Ensure no rules exist (in test class state we deleted; double-check)
        rules = admin_session.get(f"{BASE_URL}/api/crm/workflow-rules").json()["rules"]
        # Skip if other rules already exist (don't bulk delete shared state)
        if rules:
            pytest.skip("Pre-existing workflow rules; skipping zero-rule assertion.")
        r = admin_session.get(f"{BASE_URL}/api/crm/leads/overdue")
        assert r.status_code == 200
        assert r.json()["count"] == 0


# ---------- Lead update: won_plan + stage_changed_at ----------
class TestLeadUpdates:
    def test_won_plan_fields_and_stage_changed_at(self, admin_session, funnel_and_stage):
        funnel_id, stage_id, stages = funnel_and_stage
        # Create lead
        cr = admin_session.post(
            f"{BASE_URL}/api/crm/leads",
            json={
                "name": f"TEST_lead_{uuid.uuid4().hex[:6]}",
                "email": f"test_{uuid.uuid4().hex[:6]}@x.com",
                "source": "manual",
                "funnel_id": funnel_id,
                "stage_id": stage_id,
            },
        )
        assert cr.status_code == 200, cr.text
        lead = cr.json()["lead"]
        lead_id = lead["id"]
        original_stage_ts = lead.get("stage_changed_at")
        assert original_stage_ts, "Lead should have stage_changed_at on creation"

        # Update with won_plan fields
        up = admin_session.put(
            f"{BASE_URL}/api/crm/leads/{lead_id}",
            json={
                "status": "won",
                "won_plan_key": "full_prep",
                "won_plan_name": "Full Prep",
                "won_amount": 49999.0,
            },
        )
        assert up.status_code == 200, up.text

        # GET back and verify
        gr = admin_session.get(f"{BASE_URL}/api/crm/leads/{lead_id}")
        assert gr.status_code == 200
        ld = gr.json()["lead"]
        assert ld["status"] == "won"
        assert ld["won_plan_key"] == "full_prep"
        assert ld["won_plan_name"] == "Full Prep"
        assert ld["won_amount"] == 49999.0

        # Change stage and verify stage_changed_at updates
        if len(stages) >= 2:
            new_stage_id = stages[1]["id"]
            import time
            time.sleep(1.1)
            sr = admin_session.put(
                f"{BASE_URL}/api/crm/leads/{lead_id}",
                json={"stage_id": new_stage_id},
            )
            assert sr.status_code == 200, sr.text
            gr2 = admin_session.get(f"{BASE_URL}/api/crm/leads/{lead_id}")
            new_ts = gr2.json()["lead"].get("stage_changed_at")
            assert new_ts and new_ts != original_stage_ts, (
                f"stage_changed_at should update on stage change. old={original_stage_ts} new={new_ts}"
            )

        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/crm/leads/{lead_id}")
