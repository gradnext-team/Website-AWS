"""
Tests for Abandoned Cart Google Sheet integration.

Verifies:
- Row builder produces the exact 12 columns in the right order with
  correct mapping (name fallback, target_firms join, prep label mapping,
  IST formatting).
- _upsert_abandoned_cart_sync calls append_row when the email isn't in
  the sheet, and update on the existing row when it is.
- _remove_abandoned_cart_sync deletes the matched row by email.
- payments.py wires append/remove correctly (structural assertions).

Run: cd /app/backend && python -m pytest tests/test_abandoned_cart_sheet.py -v
"""
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch


def _make_user():
    return {
        "id": "u1",
        "email": "candidate@example.com",
        "name": "Candy Date",
        "phone_number": "+919999999999",
        "ug_college": "IIT Delhi",
        "pg_college": "IIM Ahmedabad",
        "target_firms": ["McKinsey", "BCG", "Bain"],
        "prep_objective": "interview_invite",
        "preparation_level": "intermediate",
        "plan": "free",
        "created_at": "2026-04-01T08:00:00+00:00",
    }


def _make_plan():
    return {
        "plan_attempted_key": "pro_plan",
        "plan_attempted_name": "Pro",
        "attempted_at": "2026-04-26T11:30:00+00:00",
    }


def test_row_builder_produces_13_columns_with_correct_mapping():
    from services.google_sheets_service import (
        _build_abandoned_cart_row,
        ABANDONED_CART_HEADERS,
    )

    plan_with_type = dict(_make_plan(), plan_attempted_type="Subscription")
    row = _build_abandoned_cart_row(_make_user(), plan_with_type)

    assert len(row) == len(ABANDONED_CART_HEADERS) == 13

    mapped = dict(zip(ABANDONED_CART_HEADERS, row))
    assert mapped["Name"] == "Candy Date"
    assert mapped["Email"] == "candidate@example.com"
    assert mapped["Phone"] == "+919999999999"
    assert mapped["UG College"] == "IIT Delhi"
    assert mapped["PG College"] == "IIM Ahmedabad"
    assert mapped["Target Firms"] == "McKinsey, BCG, Bain"
    assert mapped["Prep Objective"] == "Already have an interview invite"
    assert mapped["Prep Level"] == "Intermediate"
    assert mapped["Current Plan"] == "free"
    assert mapped["Sign-up Date & Time"] == "2026-04-01 13:30:00 IST"
    assert mapped["Plan Purchase Attempted"] == "Pro"
    assert mapped["Date Attempted"] == "2026-04-26 17:00:00 IST"
    assert mapped["Purchase Type"] == "Subscription"


def test_row_builder_purchase_type_defaults_to_subscription_when_missing():
    """Backwards-compat: legacy callers without 'plan_attempted_type' still
    produce a valid row tagged as Subscription (the historical default)."""
    from services.google_sheets_service import _build_abandoned_cart_row, ABANDONED_CART_HEADERS
    row = _build_abandoned_cart_row(_make_user(), _make_plan())
    mapped = dict(zip(ABANDONED_CART_HEADERS, row))
    assert mapped["Purchase Type"] == "Subscription"


def test_row_builder_supports_all_purchase_types():
    from services.google_sheets_service import _build_abandoned_cart_row, ABANDONED_CART_HEADERS
    for ptype in ["Subscription", "Coaching", "Top-up", "Strategy Call"]:
        plan = dict(_make_plan(), plan_attempted_type=ptype)
        row = _build_abandoned_cart_row(_make_user(), plan)
        mapped = dict(zip(ABANDONED_CART_HEADERS, row))
        assert mapped["Purchase Type"] == ptype, f"Expected {ptype}, got {mapped['Purchase Type']}"


def test_row_builder_falls_back_to_first_last_name():
    from services.google_sheets_service import _build_abandoned_cart_row

    user = _make_user()
    user.pop("name")
    user["first_name"] = "Foo"
    user["last_name"] = "Bar"
    row = _build_abandoned_cart_row(user, _make_plan())
    assert row[0] == "Foo Bar"


def test_row_builder_target_firms_string_input():
    from services.google_sheets_service import _build_abandoned_cart_row

    user = _make_user()
    user["target_firms"] = "McKinsey"
    row = _build_abandoned_cart_row(user, _make_plan())
    assert row[5] == "McKinsey"


def test_row_builder_other_objective():
    from services.google_sheets_service import _build_abandoned_cart_row

    user = _make_user()
    user["prep_objective"] = "other"
    user["other_objective"] = "Switching from product to consulting"
    row = _build_abandoned_cart_row(user, _make_plan())
    assert row[6] == "Switching from product to consulting"


def test_upsert_appends_new_row_when_email_absent():
    """Each call appends a fresh row — no upsert by email."""
    from services.google_sheets_service import _upsert_abandoned_cart_sync

    fake_sheet = MagicMock()
    fake_sheet.row_values.return_value = []
    fake_sheet.get_all_values.return_value = [
        ["Name", "Email", "Phone"],
    ]

    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet

    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _upsert_abandoned_cart_sync(_make_user(), _make_plan())

    assert fake_sheet.append_row.called
    appended_row = fake_sheet.append_row.call_args.args[0]
    assert appended_row[1] == "candidate@example.com"


def test_upsert_appends_separate_row_per_attempt_for_same_email():
    """Same user attempting two different purchases should produce TWO rows
    in the sheet (no upsert/in-place update)."""
    from services.google_sheets_service import (
        _upsert_abandoned_cart_sync,
        ABANDONED_CART_HEADERS,
    )

    fake_sheet = MagicMock()
    fake_sheet.row_values.return_value = ABANDONED_CART_HEADERS
    fake_sheet.get_all_values.return_value = [
        ABANDONED_CART_HEADERS,
        ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 2),
    ]
    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet
    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    plan_subscription = dict(_make_plan(), plan_attempted_type="Subscription")
    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _upsert_abandoned_cart_sync(_make_user(), plan_subscription)

    # Even though the email already exists, we APPEND a new row
    assert fake_sheet.append_row.called, "must append, not update, on second attempt"
    fake_sheet.update.assert_not_called()


def test_remove_only_clears_matching_purchase_type():
    """Removing a 'Subscription' purchase row must NOT touch a different-type
    row for the same user."""
    from services.google_sheets_service import (
        _remove_abandoned_cart_sync,
        ABANDONED_CART_HEADERS,
    )

    coaching_row = ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 3) + ["Coaching"]
    sub_row = ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 3) + ["Subscription"]

    fake_sheet = MagicMock()
    fake_sheet.get_all_values.return_value = [
        ABANDONED_CART_HEADERS,
        coaching_row,  # row 2
        sub_row,       # row 3
    ]
    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet
    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _remove_abandoned_cart_sync("candidate@example.com", purchase_type="Subscription")

    # Only the subscription row (row 3) should be deleted; coaching row stays
    fake_sheet.delete_rows.assert_called_once_with(3)


def test_remove_without_purchase_type_falls_back_to_latest_for_email():
    """Backwards-compat: legacy callers without purchase_type still remove
    the most recent row for that email."""
    from services.google_sheets_service import (
        _remove_abandoned_cart_sync,
        ABANDONED_CART_HEADERS,
    )

    fake_sheet = MagicMock()
    coaching_row = ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 3) + ["Coaching"]
    sub_row = ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 3) + ["Subscription"]
    fake_sheet.get_all_values.return_value = [ABANDONED_CART_HEADERS, coaching_row, sub_row]
    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet
    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _remove_abandoned_cart_sync("candidate@example.com", purchase_type=None)

    # Latest matching row = row 3 (subscription)
    fake_sheet.delete_rows.assert_called_once_with(3)


def test_remove_deletes_existing_row():
    from services.google_sheets_service import (
        _remove_abandoned_cart_sync,
        ABANDONED_CART_HEADERS,
    )

    fake_sheet = MagicMock()
    existing = ["Candy Date", "candidate@example.com"] + [""] * (len(ABANDONED_CART_HEADERS) - 3) + ["Subscription"]
    fake_sheet.get_all_values.return_value = [ABANDONED_CART_HEADERS, existing]
    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet
    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _remove_abandoned_cart_sync("candidate@example.com", "Subscription")

    fake_sheet.delete_rows.assert_called_once_with(2)


def test_remove_is_noop_when_email_absent():
    from services.google_sheets_service import (
        _remove_abandoned_cart_sync,
        ABANDONED_CART_HEADERS,
    )

    fake_sheet = MagicMock()
    fake_sheet.get_all_values.return_value = [ABANDONED_CART_HEADERS]
    fake_spreadsheet = MagicMock()
    fake_spreadsheet.worksheet.return_value = fake_sheet
    fake_client = MagicMock()
    fake_client.open_by_key.return_value = fake_spreadsheet

    with patch("services.google_sheets_service._get_client", return_value=fake_client), \
         patch.object(__import__("services.google_sheets_service", fromlist=["GOOGLE_SHEET_ID"]),
                       "GOOGLE_SHEET_ID", "fake-sheet-id"):
        _remove_abandoned_cart_sync("nobody@example.com", "Subscription")

    fake_sheet.delete_rows.assert_not_called()


def test_payments_route_wires_append_and_remove():
    """Structural assertion that payments.py:
       - appends to abandoned cart on subscription order create
       - removes from abandoned cart on subscription payment success
    """
    with open("/app/backend/routes/payments.py") as f:
        src = f.read()
    assert "append_abandoned_cart_to_sheet" in src
    assert "remove_abandoned_cart_from_sheet" in src
    create_call = src.find("append_abandoned_cart_to_sheet")
    remove_call = src.find("remove_abandoned_cart_from_sheet")
    assert create_call < remove_call, "append must be wired before remove in source order"


def test_subscriptions_route_wires_append_and_remove():
    """The actual 'Subscribe Now' button calls /api/subscriptions/create.
    This must trigger the Abandoned Cart APPEND, and all subscription
    activation paths (immediate /activate-discounted + /activate, and the
    Razorpay webhook) must trigger REMOVE."""
    with open("/app/backend/routes/subscriptions.py") as f:
        src = f.read()

    # Append must be in /create endpoint right after pending_subscription save
    create_idx = src.index("async def create_subscription")
    next_async = src.index("async def ", create_idx + 10)
    create_body = src[create_idx:next_async]
    assert "append_abandoned_cart_to_sheet" in create_body, \
        "/api/subscriptions/create MUST append to Abandoned Cart sheet"

    # Remove must occur in the activate-discounted / activate / webhook paths
    assert src.count("remove_abandoned_cart_from_sheet") >= 3, \
        "Expected at least 3 remove hooks (activate-discounted, activate webhook standard, anniversary)"


def test_all_purchase_flows_wire_abandoned_cart_append():
    """Every purchase entry point — subscriptions, one-time orders, single
    coaching session, session top-up, strategy-call addon — must write to
    the Abandoned Cart sheet. This guards against future endpoints being
    added without the tracking hook."""
    expected_files = [
        "/app/backend/routes/subscriptions.py",   # Subscribe Now
        "/app/backend/routes/payments.py",         # subscription one-time + coaching session + topup
        "/app/backend/routes/strategy_calls.py",   # strategy call addon
    ]
    for fp in expected_files:
        with open(fp) as f:
            src = f.read()
        assert "append_abandoned_cart_to_sheet" in src, \
            f"{fp} must wire the Abandoned Cart append hook"
        assert "remove_abandoned_cart_from_sheet" in src, \
            f"{fp} must wire the Abandoned Cart remove hook"

    # Specifically the 5 purchase entry-point endpoints in source
    with open("/app/backend/routes/payments.py") as f:
        pay_src = f.read()
    # subscription order
    assert "/create-order" in pay_src
    # single coaching session
    assert "/create-session-order" in pay_src
    # session topup
    assert "/topup/create-order" in pay_src

    # All 3 endpoints must have the append hook in their body (large
    # window because order setup logic varies in length)
    for endpoint in ['"/create-order"', '"/create-session-order"', '"/topup/create-order"']:
        idx = pay_src.find(endpoint)
        assert idx != -1, f"endpoint {endpoint} missing"
        # Look at the next 12000 chars for the append call
        body = pay_src[idx:idx + 12000]
        assert "append_abandoned_cart_to_sheet" in body, \
            f"endpoint {endpoint} missing append hook in body"

    with open("/app/backend/routes/strategy_calls.py") as f:
        sc_src = f.read()
    assert "/purchase-addon" in sc_src
    addon_idx = sc_src.find('"/purchase-addon"')
    addon_body = sc_src[addon_idx:addon_idx + 8000]
    assert "append_abandoned_cart_to_sheet" in addon_body, \
        "/purchase-addon must have the append hook"
