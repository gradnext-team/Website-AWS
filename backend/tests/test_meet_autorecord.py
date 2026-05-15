"""Regression test for Meet REST API auto-record integration.

Validates that:
1. `_create_meet_space_with_recording` posts the correct body to the
   Google Meet API.
2. `_generate_meet_link_separately` correctly attaches the returned URI
   when the Meet API succeeds.
3. The legacy `createRequest` fallback runs when the Meet API returns None.
"""
from unittest.mock import MagicMock, patch
from datetime import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.calendar_service import GoogleCalendarService  # noqa: E402


def _build_svc_with_mock_calendar():
    svc = GoogleCalendarService.__new__(GoogleCalendarService)
    svc.service = MagicMock()
    return svc


def test_meet_space_creation_posts_correct_body():
    svc = _build_svc_with_mock_calendar()

    # Mock the credentials chain
    fake_creds = MagicMock()
    fake_creds.valid = True
    fake_creds.token = "FAKE_TOKEN"
    svc.service._http = MagicMock()
    svc.service._http.credentials = fake_creds

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "name": "spaces/abcdef",
        "meetingUri": "https://meet.google.com/xyz-abcd-efg",
        "meetingCode": "xyz-abcd-efg",
    }

    with patch("requests.post", return_value=fake_response) as mock_post:
        result = svc._create_meet_space_with_recording()

    assert result == {"meeting_uri": "https://meet.google.com/xyz-abcd-efg", "meeting_code": "xyz-abcd-efg"}
    assert mock_post.call_count == 1
    body = mock_post.call_args.kwargs["json"]
    assert body["config"]["accessType"] == "TRUSTED"
    art = body["config"]["artifactConfig"]
    # First tier requests all three artifacts
    assert art["recordingConfig"]["autoRecordingGeneration"] == "ON"
    assert art["transcriptionConfig"]["autoTranscriptionGeneration"] == "ON"
    assert art["smartNotesConfig"]["autoSmartNotesGeneration"] == "ON"
    headers = mock_post.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer FAKE_TOKEN"
    print("✅ test_meet_space_creation_posts_correct_body")


def test_meet_space_tiered_fallback_on_400():
    """Smart notes 400 → drops to record+transcribe; transcribe 400 → drops to record-only; final 200."""
    svc = _build_svc_with_mock_calendar()
    fake_creds = MagicMock()
    fake_creds.valid = True
    fake_creds.token = "FAKE"
    svc.service._http = MagicMock()
    svc.service._http.credentials = fake_creds

    rejection = MagicMock()
    rejection.status_code = 400
    rejection.text = "Smart notes not licensed"

    rejection2 = MagicMock()
    rejection2.status_code = 400
    rejection2.text = "Transcription not licensed"

    success = MagicMock()
    success.status_code = 200
    success.json.return_value = {
        "meetingUri": "https://meet.google.com/aaa-bbb-ccc",
        "meetingCode": "aaa-bbb-ccc",
    }

    with patch("requests.post", side_effect=[rejection, rejection2, success]) as mock_post:
        result = svc._create_meet_space_with_recording()

    assert mock_post.call_count == 3
    assert result == {"meeting_uri": "https://meet.google.com/aaa-bbb-ccc", "meeting_code": "aaa-bbb-ccc"}

    # Tier 1 had all three flags
    tier1 = mock_post.call_args_list[0].kwargs["json"]["config"]["artifactConfig"]
    assert "smartNotesConfig" in tier1 and "transcriptionConfig" in tier1 and "recordingConfig" in tier1
    # Tier 2 dropped smart notes
    tier2 = mock_post.call_args_list[1].kwargs["json"]["config"]["artifactConfig"]
    assert "smartNotesConfig" not in tier2 and "transcriptionConfig" in tier2 and "recordingConfig" in tier2
    # Tier 3 dropped transcription
    tier3 = mock_post.call_args_list[2].kwargs["json"]["config"]["artifactConfig"]
    assert "smartNotesConfig" not in tier3 and "transcriptionConfig" not in tier3 and "recordingConfig" in tier3
    print("✅ test_meet_space_tiered_fallback_on_400")


def test_meet_space_failure_returns_none():
    svc = _build_svc_with_mock_calendar()
    fake_creds = MagicMock()
    fake_creds.valid = True
    fake_creds.token = "FAKE"
    svc.service._http = MagicMock()
    svc.service._http.credentials = fake_creds

    fake_response = MagicMock()
    fake_response.status_code = 403
    fake_response.text = "scopes not granted"

    with patch("requests.post", return_value=fake_response):
        result = svc._create_meet_space_with_recording()
    assert result is None
    print("✅ test_meet_space_failure_returns_none")


def test_generate_meet_link_uses_premade_uri_when_meet_api_succeeds():
    svc = _build_svc_with_mock_calendar()

    # Stub the meet space helper to return a known URI
    svc._create_meet_space_with_recording = MagicMock(return_value={
        "meeting_uri": "https://meet.google.com/qqq-rrr-sss",
        "meeting_code": "qqq-rrr-sss",
    })

    # Fake the calendar event insert response
    insert_call = MagicMock()
    insert_call.execute.return_value = {
        "id": "evt-123",
        "conferenceData": {
            "entryPoints": [
                {"entryPointType": "video", "uri": "https://meet.google.com/qqq-rrr-sss"}
            ]
        },
    }
    svc.service.events.return_value.insert.return_value = insert_call

    result = svc._generate_meet_link_separately(
        session_type="strategy_call",
        start_datetime=datetime(2026, 5, 5, 10, 0),
        duration_minutes=15,
    )
    assert result is not None
    assert result["meet_link"] == "https://meet.google.com/qqq-rrr-sss"

    # Inspect the body the calendar API was called with
    insert_kwargs = svc.service.events.return_value.insert.call_args.kwargs
    body = insert_kwargs["body"]
    # When we have a pre-made space, we should NOT send createRequest
    assert "createRequest" not in body["conferenceData"]
    assert body["conferenceData"]["entryPoints"][0]["uri"] == "https://meet.google.com/qqq-rrr-sss"
    print("✅ test_generate_meet_link_uses_premade_uri_when_meet_api_succeeds")


def test_generate_meet_link_falls_back_when_meet_api_fails():
    svc = _build_svc_with_mock_calendar()
    svc._create_meet_space_with_recording = MagicMock(return_value=None)

    insert_call = MagicMock()
    insert_call.execute.return_value = {
        "id": "evt-456",
        "conferenceData": {
            "entryPoints": [{"entryPointType": "video", "uri": "https://meet.google.com/fallback-aaa-bbb"}]
        },
    }
    svc.service.events.return_value.insert.return_value = insert_call

    result = svc._generate_meet_link_separately(
        session_type="coaching",
        start_datetime=datetime(2026, 5, 6, 11, 0),
        duration_minutes=30,
    )
    assert result is not None
    insert_kwargs = svc.service.events.return_value.insert.call_args.kwargs
    body = insert_kwargs["body"]
    # Fallback path uses createRequest
    assert "createRequest" in body["conferenceData"]
    assert body["conferenceData"]["createRequest"]["conferenceSolutionKey"]["type"] == "hangoutsMeet"
    print("✅ test_generate_meet_link_falls_back_when_meet_api_fails")


if __name__ == "__main__":
    test_meet_space_creation_posts_correct_body()
    test_meet_space_tiered_fallback_on_400()
    test_meet_space_failure_returns_none()
    test_generate_meet_link_uses_premade_uri_when_meet_api_succeeds()
    test_generate_meet_link_falls_back_when_meet_api_fails()
    print("\nAll meet auto-record regression tests passed ✓")
