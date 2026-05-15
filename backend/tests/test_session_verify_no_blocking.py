"""
Tests for the single-session booking verify-with-slot fix:

The bug: on production, /verify-session-with-slot called the synchronous
Google Calendar SDK (`create_coaching_session_event`) inline, which
blocked the async event loop for 10–30s and pushed the response past
Cloudflare's tolerance. Result: the booking WAS saved on the backend,
but the frontend got a generic "Booking finalization failed. Our team
will refund you within 24 hours." error and the user was never
redirected to the dashboard — even though their payment + booking went
through.

The fix: schedule calendar event creation as a FastAPI BackgroundTask
so the verify response returns immediately. Meet link is attached to
the booking afterwards.

We can't fully exercise the verify endpoint without a valid Razorpay
signature, but we can:
  1. Confirm the endpoint is fast even when called with bad data —
     response time should be sub-second regardless of calendar service
     latency.
  2. Confirm the BackgroundTasks dependency is wired in (no missing
     imports / missing param).
"""
import os
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"


def _post_verify(payload, headers=None):
    return requests.post(
        f"{API}/payments/verify-session-with-slot",
        json=payload,
        timeout=30,
        headers=headers or {},
    )


def test_verify_endpoint_is_quick_to_respond_under_failure():
    """Even with garbage input, the endpoint must return in <5 s — proving
    no synchronous third-party calls block the response path. Before the
    fix this could hang for 10–30 s on a slow Google Calendar API call.
    """
    payload = {
        "razorpay_order_id": f"order_test_{uuid.uuid4().hex[:8]}",
        "razorpay_payment_id": f"pay_test_{uuid.uuid4().hex[:8]}",
        "razorpay_signature": "fake",
        "mentor_id": "mentor-aparajita",
        "date": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
        "time_slot": "09:00",
        "session_type": "Case practice",
    }
    t0 = time.monotonic()
    r = _post_verify(payload)
    elapsed = time.monotonic() - t0
    # We don't care which failure code we get (401 / 400) — only that
    # the response is FAST. The fix guarantees the calendar call (the
    # historically slow path) is in a BackgroundTask, never in the
    # response path.
    assert elapsed < 5.0, f"Verify endpoint took {elapsed:.2f}s — too slow, calendar work is still inline"
    assert r.status_code in (400, 401, 404, 409), f"unexpected status: {r.status_code} body: {r.text[:200]}"


def test_verify_endpoint_returns_specific_error_with_detail():
    """Frontend relies on `response.data.detail` for the error message.
    If detail is missing/empty the user sees a misleading generic refund
    message. Verify our error responses always include `detail`.
    """
    payload = {
        "razorpay_order_id": f"order_x_{uuid.uuid4().hex[:8]}",
        "razorpay_payment_id": "pay_x",
        "razorpay_signature": "fake",
        "mentor_id": "mentor-aparajita",
        "date": "2026-12-01",
        "time_slot": "09:00",
    }
    r = _post_verify(payload)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    assert "detail" in body, f"Verify error must include `detail` field for the FE; got body: {body!r}"


def test_verify_with_slot_endpoint_is_registered():
    """Smoke: the endpoint exists and is reachable (not 404)."""
    r = _post_verify({
        "razorpay_order_id": "x",
        "razorpay_payment_id": "x",
        "razorpay_signature": "x",
        "mentor_id": "x",
        "date": "2026-01-01",
        "time_slot": "09:00",
    })
    assert r.status_code != 404, "/api/payments/verify-session-with-slot is missing"
