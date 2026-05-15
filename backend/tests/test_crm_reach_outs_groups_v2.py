"""iteration_73: CRM Reach-Outs new shape {to_be_reached_out, follow_up, closed}
+ funnel source_mappings auto-routing for new leads.
"""
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
def funnel(admin_session):
    rf = admin_session.get(f"{API}/crm/funnels", timeout=30)
    assert rf.status_code == 200
    body = rf.json()
    funnels = body.get("funnels") if isinstance(body, dict) else body
    assert funnels and funnels[0].get("stages")
    return funnels[0]


# -------- Reach-outs new shape --------

class TestReachOutsShape:
    def test_shape_has_three_groups(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "groups" in body and "totals" in body
        for k in ("to_be_reached_out", "follow_up", "closed"):
            assert k in body["groups"], f"missing group {k}"
            assert k in body["totals"], f"missing total {k}"
            assert isinstance(body["groups"][k], list)
            assert isinstance(body["totals"][k], int)

    def test_old_keys_absent(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        groups = r.json()["groups"]
        for old in ("overdue", "due_today", "due_tomorrow", "due_this_week"):
            assert old not in groups, f"old key {old} still present"


class TestReachOutsGrouping:
    seeded = []  # list of (label, lead_id)

    def test_seed_three_leads(self, admin_session, funnel):
        stage_id = funnel["stages"][0]["id"]
        for label in ("fresh", "followup", "won"):
            payload = {
                "name": f"TEST_ro73_{label}_{uuid.uuid4().hex[:6]}",
                "email": f"ro73_{label}_{uuid.uuid4().hex[:6]}@example.com",
                "phone": "+15551112222",
                "funnel_id": funnel["id"],
                "stage_id": stage_id,
            }
            r = admin_session.post(f"{API}/crm/leads", json=payload, timeout=30)
            assert r.status_code in (200, 201), r.text
            lead = r.json().get("lead") or r.json()
            TestReachOutsGrouping.seeded.append((label, lead["id"]))

        ids = dict(((lbl, lid) for lbl, lid in TestReachOutsGrouping.seeded))

        # Add 1 contact log to the followup lead
        cl = admin_session.post(f"{API}/crm/contact-logs", json={
            "lead_id": ids["followup"],
            "method": "call",
            "outcome": "reached",
            "reply": "test",
        }, timeout=20)
        assert cl.status_code == 200, cl.text

        # Mark won lead as won
        wn = admin_session.put(
            f"{API}/crm/leads/{ids['won']}",
            json={"status": "won", "won_plan_name": "TEST_Plan_Pro", "won_amount": 999.0},
            timeout=20,
        )
        assert wn.status_code == 200, wn.text

    def test_grouping_assignment(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200
        groups = r.json()["groups"]
        id_by_label = dict(TestReachOutsGrouping.seeded)
        to_ids = {x["id"] for x in groups["to_be_reached_out"]}
        fu_ids = {x["id"] for x in groups["follow_up"]}
        cl_ids = {x["id"] for x in groups["closed"]}

        assert id_by_label["fresh"] in to_ids, "fresh lead (no contact logs, active) should be in to_be_reached_out"
        assert id_by_label["followup"] in fu_ids, "lead with contact log + active should be in follow_up"
        assert id_by_label["won"] in cl_ids, "won lead should be in closed"

        # mutual exclusivity
        assert id_by_label["fresh"] not in fu_ids and id_by_label["fresh"] not in cl_ids
        assert id_by_label["followup"] not in to_ids and id_by_label["followup"] not in cl_ids
        assert id_by_label["won"] not in to_ids and id_by_label["won"] not in fu_ids

    def test_each_item_has_required_fields(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        groups = r.json()["groups"]
        required = {"id", "name", "email", "phone", "created_at",
                    "last_contacted_at", "next_follow_up_date", "source",
                    "stage_name", "funnel_name", "assigned_to",
                    "assigned_to_name", "status", "won_plan_name",
                    "won_amount", "company"}
        id_by_label = dict(TestReachOutsGrouping.seeded)
        seeded_ids = set(id_by_label.values())
        checked = 0
        for grp in groups.values():
            for item in grp:
                if item["id"] in seeded_ids:
                    missing = required - set(item.keys())
                    assert not missing, f"missing fields {missing} in {item}"
                    checked += 1
        assert checked == 3, f"expected to validate 3 seeded items, got {checked}"

    def test_won_plan_name_present_on_closed(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        groups = r.json()["groups"]
        id_by_label = dict(TestReachOutsGrouping.seeded)
        won_item = next((x for x in groups["closed"] if x["id"] == id_by_label["won"]), None)
        assert won_item is not None
        assert won_item.get("won_plan_name") == "TEST_Plan_Pro"
        assert won_item.get("won_amount") == 999.0
        assert won_item.get("status") == "won"

    def test_admin_filter_nonexistent_rep(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs",
                              params={"assigned_to": "no-such-rep"}, timeout=30)
        assert r.status_code == 200
        totals = r.json()["totals"]
        assert sum(totals.values()) == 0

    def test_cleanup(self, admin_session):
        for _, lid in TestReachOutsGrouping.seeded:
            admin_session.delete(f"{API}/crm/leads/{lid}", timeout=15)


# -------- Route ordering still correct --------

class TestRouteOrdering:
    def test_reach_outs_not_caught_as_lead_id(self, admin_session):
        r = admin_session.get(f"{API}/crm/leads/reach-outs", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "groups" in body  # would be {"lead": ..., "call_logs": ...} otherwise


# -------- Source-routing via funnel.source_mappings --------

class TestSourceRouting:
    funnel_id = None
    mapped_stage_id = None
    created_lead_id = None
    source_key = f"TEST_src_{uuid.uuid4().hex[:6]}"

    def test_create_funnel_with_source_mapping(self, admin_session):
        # Build a funnel with 3 stages and a source_mappings pointing to stage[1]
        stages = [
            {"id": str(uuid.uuid4()), "name": "Intake", "color": "#000", "order": 0},
            {"id": str(uuid.uuid4()), "name": "TEST_MappedStage", "color": "#111", "order": 1},
            {"id": str(uuid.uuid4()), "name": "Done", "color": "#222", "order": 2},
        ]
        TestSourceRouting.mapped_stage_id = stages[1]["id"]
        payload = {
            "name": f"TEST_funnel_{uuid.uuid4().hex[:6]}",
            "stages": stages,
            "is_default": False,
            "source_mappings": [
                {"source": TestSourceRouting.source_key, "stage_id": stages[1]["id"]}
            ],
        }
        r = admin_session.post(f"{API}/crm/funnels", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        fn = r.json().get("funnel") or r.json()
        TestSourceRouting.funnel_id = fn["id"]
        assert fn.get("source_mappings"), "source_mappings not persisted on create"
        assert fn["source_mappings"][0]["source"] == TestSourceRouting.source_key
        assert fn["source_mappings"][0]["stage_id"] == stages[1]["id"]

    def test_funnel_update_persists_source_mappings(self, admin_session):
        # PUT with updated mappings (same key, but tests round-trip)
        r = admin_session.put(
            f"{API}/crm/funnels/{TestSourceRouting.funnel_id}",
            json={"source_mappings": [
                {"source": TestSourceRouting.source_key, "stage_id": TestSourceRouting.mapped_stage_id}
            ]},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        # Re-fetch and assert
        gf = admin_session.get(f"{API}/crm/funnels", timeout=15).json()
        funnels = gf.get("funnels") if isinstance(gf, dict) else gf
        match = next((f for f in funnels if f["id"] == TestSourceRouting.funnel_id), None)
        assert match is not None
        assert match.get("source_mappings"), "source_mappings missing after PUT"
        assert match["source_mappings"][0]["source"] == TestSourceRouting.source_key

    def test_new_lead_with_matching_source_routes_to_mapping(self, admin_session):
        payload = {
            "name": f"TEST_routed_{uuid.uuid4().hex[:6]}",
            "email": f"routed_{uuid.uuid4().hex[:6]}@example.com",
            "source": TestSourceRouting.source_key,
            # NO funnel_id, NO stage_id
        }
        r = admin_session.post(f"{API}/crm/leads", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        lead = r.json().get("lead") or r.json()
        TestSourceRouting.created_lead_id = lead["id"]
        assert lead.get("funnel_id") == TestSourceRouting.funnel_id, (
            f"lead.funnel_id should auto-route to mapped funnel, got {lead.get('funnel_id')}"
        )
        assert lead.get("stage_id") == TestSourceRouting.mapped_stage_id, (
            f"lead.stage_id should be mapped stage, got {lead.get('stage_id')}"
        )

    def test_new_lead_without_matching_source_uses_default(self, admin_session):
        # Source not in any mapping -> goes to default funnel
        unique_source = f"TEST_unmapped_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": f"TEST_default_{uuid.uuid4().hex[:6]}",
            "email": f"default_{uuid.uuid4().hex[:6]}@example.com",
            "source": unique_source,
        }
        r = admin_session.post(f"{API}/crm/leads", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        lead = r.json().get("lead") or r.json()
        # Default funnel id
        gf = admin_session.get(f"{API}/crm/funnels", timeout=15).json()
        funnels = gf.get("funnels") if isinstance(gf, dict) else gf
        default = next((f for f in funnels if f.get("is_default")), None)
        assert default is not None, "no default funnel in system"
        assert lead.get("funnel_id") == default["id"], (
            f"unmapped source should fall back to default funnel; got {lead.get('funnel_id')}"
        )
        # cleanup
        admin_session.delete(f"{API}/crm/leads/{lead['id']}", timeout=15)

    def test_cleanup(self, admin_session):
        if TestSourceRouting.created_lead_id:
            admin_session.delete(f"{API}/crm/leads/{TestSourceRouting.created_lead_id}", timeout=15)
        if TestSourceRouting.funnel_id:
            admin_session.delete(f"{API}/crm/funnels/{TestSourceRouting.funnel_id}", timeout=15)
