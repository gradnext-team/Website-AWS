"""
Test for the Google Meet "Please wait until a meeting host brings you
into the call" production bug.

Root cause: `create_meeting_event` was calling
`_generate_meet_link_separately` which builds the Meet-hosting hidden
event with `attendees: []`. Since the Meet link is owned by that hidden
event, Google Meet treats joiners as external/uninvited and gates them
behind host approval.

Fix: route `create_meeting_event` to `_generate_meet_link_with_attendees`,
which builds the hidden event WITH the actual attendees attached. Also
flipped the Meet REST API space `accessType` from TRUSTED → OPEN as a
belt-and-suspenders fallback for joiners arriving from a different
email than the one on the calendar invite.

We can't actually exercise the live Google API in a unit test, but we
can verify:
  1. `create_meeting_event` calls `_generate_meet_link_with_attendees`
     (not `_generate_meet_link_separately`) and forwards the attendee
     emails through.
  2. The Meet REST API request body uses `accessType: "OPEN"`.
"""
from unittest.mock import patch, MagicMock
from datetime import datetime


def test_create_meeting_event_uses_with_attendees_path():
    from services.calendar_service import GoogleCalendarService
    
    svc = GoogleCalendarService.__new__(GoogleCalendarService)
    svc.service = MagicMock()
    svc.service.events.return_value.insert.return_value.execute.return_value = {
        "id": "ev_123", "htmlLink": "x", "start": {"dateTime": "x"}, "end": {"dateTime": "x"},
        "status": "confirmed", "attendees": [{"email": "a@a"}, {"email": "b@b"}],
    }
    
    with patch.object(svc, "_generate_meet_link_with_attendees") as mock_with, \
         patch.object(svc, "_generate_meet_link_separately") as mock_without:
        mock_with.return_value = {"meet_link": "https://meet.google.com/xxx-yyyy-zzz", "hidden_event_id": "hid_42"}
        mock_without.return_value = None
        
        result = svc.create_meeting_event(
            title="t", description="d",
            start_datetime=datetime(2026, 1, 1, 10, 0),
            duration_minutes=45,
            attendee_emails=["mentor@example.com", "candidate@example.com"],
            session_type="coaching",
        )
    
    # The fixed path should use _with_attendees, never _separately
    assert mock_with.called, "create_meeting_event must route to _generate_meet_link_with_attendees"
    assert not mock_without.called, "create_meeting_event must NOT call _generate_meet_link_separately for the visible event"
    
    # Attendees must be forwarded to the hidden event
    args, kwargs = mock_with.call_args
    forwarded_attendees = args[3] if len(args) > 3 else kwargs.get("attendee_emails")
    assert forwarded_attendees == ["mentor@example.com", "candidate@example.com"], (
        f"Attendee emails must be forwarded; got {forwarded_attendees!r}"
    )
    
    # Result should expose the meet link and hidden_event_id
    assert result is not None
    assert result["meet_link"] == "https://meet.google.com/xxx-yyyy-zzz"
    assert result["hidden_event_id"] == "hid_42"


def test_meet_space_request_uses_access_type_open():
    """Confirm the Meet REST API request body now uses accessType=OPEN.
    The actual Google API call is mocked; we only check the request body."""
    import services.calendar_service as cal_mod
    
    captured_bodies = []
    
    class _MockResp:
        status_code = 200
        def json(self):
            return {"meetingUri": "https://meet.google.com/abc-defg-hij", "meetingCode": "abc-defg-hij"}
    
    def _fake_post(url, json=None, headers=None, timeout=None, **_):
        captured_bodies.append(json)
        return _MockResp()
    
    svc = cal_mod.GoogleCalendarService.__new__(cal_mod.GoogleCalendarService)
    svc.service = MagicMock()
    
    fake_creds = MagicMock()
    fake_creds.valid = True
    fake_creds.token = "fake_token"
    
    with patch.object(svc, "_build_delegated_credentials", return_value=fake_creds), \
         patch.object(cal_mod, "MEET_AUTORECORD_ENABLED", True), \
         patch("requests.post", side_effect=_fake_post):
        result = svc._create_meet_space_with_recording()
    
    assert result is not None
    assert result["meeting_uri"] == "https://meet.google.com/abc-defg-hij"
    
    assert len(captured_bodies) >= 1
    body = captured_bodies[0]
    assert body["config"]["accessType"] == "OPEN", (
        f"Meet space accessType must be OPEN to avoid the host-approval gate; got {body['config']!r}"
    )
