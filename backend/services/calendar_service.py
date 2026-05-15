"""
Google Calendar Service Module
Handles calendar event creation with Google Meet links for session scheduling
Uses Service Account with Domain-Wide Delegation to send invites from info@gradnext.co
"""

import os
import json
import uuid
import pytz
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging

logger = logging.getLogger(__name__)

# Configuration
# Service account can be loaded from file OR from environment variable
SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'credentials', 'google_service_account.json')
SERVICE_ACCOUNT_JSON = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')  # JSON string from env
# Base scopes for calendar + meet operations. Adding scopes here requires
# updating Domain-Wide Delegation in admin.google.com — DON'T add new scopes
# without first whitelisting them, or `credentials.refresh()` will start
# returning `unauthorized_client` for ALL scope requests.
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    # Meet REST API scopes — used to create Meet "spaces" with auto-recording
    # turned on. Granted via Domain-wide Delegation in admin.google.com.
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/meetings.space.settings',
]
# Separate scope list for Drive operations (used to move recording files
# into the Shared Drive folder). Built into a SEPARATE credentials
# object so missing DWD authorization on Drive doesn't break calendar +
# meet flows. Admin must whitelist this scope in DWD for the move feature
# to work — see /api/admin/recordings/self-test for guidance.
DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive',
]
IMPERSONATE_EMAIL = os.environ.get('GOOGLE_IMPERSONATE_EMAIL', 'info@gradnext.co')
DEFAULT_TIMEZONE = 'Asia/Kolkata'

# Toggle for the Meet REST API integration. If anything goes wrong we silently
# fall back to the legacy Calendar conferenceData flow so bookings never break.
MEET_AUTORECORD_ENABLED = os.environ.get('MEET_AUTORECORD_ENABLED', 'true').lower() in ('1', 'true', 'yes')

# Destination Shared Drive folder ID where recordings are organized after the
# Meet API drops them in info@gradnext.co's My Drive. Set to empty to disable
# the move (recordings will stay in the host's "Meet Recordings" folder).
RECORDINGS_DRIVE_FOLDER_ID = os.environ.get('RECORDINGS_DRIVE_FOLDER_ID', '')


class GoogleCalendarService:
    """Service for managing Google Calendar events with Google Meet integration"""
    
    def __init__(self):
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Initialize the Google Calendar service with service account credentials"""
        try:
            credentials = None
            
            # First try to load from environment variable (preferred for production)
            if SERVICE_ACCOUNT_JSON:
                try:
                    service_account_info = json.loads(SERVICE_ACCOUNT_JSON)
                    credentials = service_account.Credentials.from_service_account_info(
                        service_account_info,
                        scopes=SCOPES
                    )
                    logger.info("Loaded Google service account from environment variable")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: {e}")
            
            # Fallback to file-based credentials (for local development)
            if credentials is None and os.path.exists(SERVICE_ACCOUNT_FILE):
                credentials = service_account.Credentials.from_service_account_file(
                    SERVICE_ACCOUNT_FILE,
                    scopes=SCOPES
                )
                logger.info("Loaded Google service account from file")
            
            if credentials is None:
                logger.warning("No Google service account credentials found - calendar features will be disabled")
                return
            
            # Delegate to impersonate info@gradnext.co
            delegated_credentials = credentials.with_subject(IMPERSONATE_EMAIL)
            
            # Build the calendar service
            self.service = build('calendar', 'v3', credentials=delegated_credentials)
            logger.info(f"Google Calendar service initialized, impersonating {IMPERSONATE_EMAIL}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Calendar service: {str(e)}")
            self.service = None
    
    def is_available(self) -> bool:
        """Check if the calendar service is available"""
        return self.service is not None

    def _create_meet_space_with_recording(self, return_diagnostics: bool = False) -> Optional[Dict[str, Any]]:
        """Create a Google Meet "space" via the Meet REST API with
        auto-recording, auto-transcription, and Gemini Smart Notes turned on.

        Tiered fallback: if the host lacks the Gemini for Workspace license,
        the API rejects Smart Notes — we retry without it. If transcription
        is also not licensed, we retry with just recording. If even that
        fails, the caller falls back to the legacy Calendar `createRequest`.

        Returns dict with `meeting_uri` + `meeting_code`, or None.

        When `return_diagnostics=True`, returns a richer dict that also
        includes `tier`, `attempts` (per-tier status_code + error_body) and
        `error` so admin diagnostics can see exactly why a tier failed.

        Requires DWD scopes:
          - https://www.googleapis.com/auth/meetings.space.created
          - https://www.googleapis.com/auth/meetings.space.settings
        """
        attempts: List[Dict[str, Any]] = []

        def _diag_failure(error: str) -> Optional[Dict[str, Any]]:
            if return_diagnostics:
                return {"meeting_uri": None, "error": error, "attempts": attempts}
            return None

        if not MEET_AUTORECORD_ENABLED:
            return _diag_failure("MEET_AUTORECORD_ENABLED is false")
        if not self.service:
            return _diag_failure("Calendar service not initialized")

        try:
            creds = getattr(self.service, '_http', None)
            credentials = getattr(creds, 'credentials', None) if creds else None
            if credentials is None:
                credentials = self._build_delegated_credentials()
            if credentials is None:
                logger.warning("Meet API: no delegated credentials available, skipping auto-record")
                return _diag_failure("No delegated credentials")

            try:
                from google.auth.transport.requests import Request as _GReq
                if not credentials.valid:
                    credentials.refresh(_GReq())
            except Exception as refresh_err:  # noqa: BLE001
                logger.warning(f"Meet API: could not refresh creds ({refresh_err}); proceeding")

            access_token = getattr(credentials, 'token', None)
            if not access_token:
                logger.warning("Meet API: no access token after refresh, skipping auto-record")
                return _diag_failure("No access token")

            import requests as _requests

            # Tiered fallback — drop the most license-restricted artifact
            # generation flag at each step so we still get *something* on
            # plans without Gemini / transcription.
            tiers = [
                {
                    "label": "record+transcribe+smart_notes",
                    "artifact_config": {
                        "recordingConfig": {"autoRecordingGeneration": "ON"},
                        "transcriptionConfig": {"autoTranscriptionGeneration": "ON"},
                        "smartNotesConfig": {"autoSmartNotesGeneration": "ON"},
                    },
                },
                {
                    "label": "record+transcribe",
                    "artifact_config": {
                        "recordingConfig": {"autoRecordingGeneration": "ON"},
                        "transcriptionConfig": {"autoTranscriptionGeneration": "ON"},
                    },
                },
                {
                    "label": "record_only",
                    "artifact_config": {
                        "recordingConfig": {"autoRecordingGeneration": "ON"},
                    },
                },
            ]

            for tier in tiers:
                body = {
                    "config": {
                        "accessType": "OPEN",
                        "artifactConfig": tier["artifact_config"],
                    }
                }
                resp = _requests.post(
                    "https://meet.googleapis.com/v2/spaces",
                    json=body,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )

                attempts.append({
                    "tier": tier["label"],
                    "status_code": resp.status_code,
                    "error_body": (None if resp.status_code < 400 else resp.text[:500]),
                })

                if resp.status_code < 400:
                    data = resp.json() or {}
                    meeting_uri = data.get('meetingUri')
                    meeting_code = data.get('meetingCode')
                    space_name = data.get('name')
                    if meeting_uri:
                        logger.info(
                            f"Meet API: created space [{tier['label']}] "
                            f"{meeting_code} -> {meeting_uri} ({space_name})"
                        )
                        result = {
                            "meeting_uri": meeting_uri,
                            "meeting_code": meeting_code,
                            "space_name": space_name,
                        }
                        if return_diagnostics:
                            result["tier"] = tier["label"]
                            result["attempts"] = attempts
                        return result
                    logger.warning(f"Meet API returned no meetingUri at tier {tier['label']}: {data}")
                    return _diag_failure(f"No meetingUri at tier {tier['label']}")

                # Retry only on 400 (license / config rejected) — for any
                # other error (401/403/5xx) bail to caller's fallback.
                if resp.status_code != 400:
                    logger.warning(
                        f"Meet API space creation failed ({resp.status_code}) at tier "
                        f"{tier['label']}: {resp.text[:300]}"
                    )
                    return _diag_failure(
                        f"HTTP {resp.status_code} at tier {tier['label']}: {resp.text[:200]}"
                    )

                logger.info(
                    f"Meet API: tier '{tier['label']}' rejected (400), trying next tier. "
                    f"Body: {resp.text[:200]}"
                )

            # All tiers exhausted
            logger.warning("Meet API: all auto-record tiers rejected, caller will fall back")
            return _diag_failure("All artifact-generation tiers rejected (400)")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Meet API space creation raised: {e}")
            return _diag_failure(f"Exception: {e}")

    def move_drive_file_to_folder(
        self,
        file_id: str,
        dest_folder_id: str,
    ) -> Dict[str, Any]:
        """Move a Drive file (e.g. a Meet recording) into the destination
        Shared Drive folder. Returns a status dict for diagnostic UI:
          {"success": bool, "moved": bool, "already_in_folder": bool,
           "web_view_link": Optional[str], "error": Optional[str]}

        Uses a SEPARATE credentials object (DRIVE_SCOPES only) so that
        a missing-DWD-authorization on the drive scope doesn't break the
        calendar/meet flows that share the main service object.

        The impersonated user (info@gradnext.co) must be a Manager or
        Content Manager of the destination Shared Drive — otherwise the
        request 403s. Idempotent: if the file is already a child of the
        destination folder, returns moved=False, already_in_folder=True.
        """
        if not file_id or not dest_folder_id:
            return {"success": False, "error": "Missing file_id or dest_folder_id"}
        try:
            credentials = self._build_delegated_credentials(scopes=DRIVE_SCOPES)
            if credentials is None:
                return {"success": False, "error": "No delegated credentials for Drive scope"}
            from google.auth.transport.requests import Request as _GReq
            try:
                if not credentials.valid:
                    credentials.refresh(_GReq())
            except Exception as refresh_err:  # noqa: BLE001
                return {
                    "success": False,
                    "error": (
                        f"Drive scope not authorized via Domain-Wide Delegation. "
                        f"Add 'https://www.googleapis.com/auth/drive' to the service "
                        f"account's allowed scopes in admin.google.com → Security → "
                        f"API Controls → Domain-wide Delegation. Refresh error: {refresh_err}"
                    ),
                }
            access_token = getattr(credentials, 'token', None)
            if not access_token:
                return {"success": False, "error": "No access token"}

            import requests as _requests
            # Step 1 — get current parents + webViewLink
            meta_resp = _requests.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                params={
                    "fields": "id,parents,webViewLink,name,driveId",
                    "supportsAllDrives": "true",
                },
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15,
            )
            if meta_resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"GET file metadata failed ({meta_resp.status_code}): {meta_resp.text[:200]}",
                }
            meta = meta_resp.json() or {}
            current_parents = meta.get("parents") or []
            web_view_link = meta.get("webViewLink")

            if dest_folder_id in current_parents:
                return {
                    "success": True,
                    "moved": False,
                    "already_in_folder": True,
                    "web_view_link": web_view_link,
                    "name": meta.get("name"),
                }

            # Step 2 — move file (add new parent, remove old parents)
            patch_resp = _requests.patch(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                params={
                    "addParents": dest_folder_id,
                    "removeParents": ",".join(current_parents) if current_parents else "",
                    "supportsAllDrives": "true",
                    "fields": "id,parents,webViewLink,name",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={},
                timeout=15,
            )
            if patch_resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"PATCH file failed ({patch_resp.status_code}): {patch_resp.text[:300]}",
                    "web_view_link": web_view_link,
                }
            new_meta = patch_resp.json() or {}
            logger.info(
                f"[drive_move] Moved file {file_id} ({new_meta.get('name')}) "
                f"to folder {dest_folder_id}"
            )
            return {
                "success": True,
                "moved": True,
                "already_in_folder": False,
                "web_view_link": new_meta.get("webViewLink") or web_view_link,
                "name": new_meta.get("name"),
            }
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[drive_move] Exception moving {file_id}: {e}")
            return {"success": False, "error": f"Exception: {e}"}

    def check_drive_folder_access(self, folder_id: str) -> Dict[str, Any]:
        """Verify the impersonated user can read+write the destination Shared
        Drive folder. Used by the admin recording self-test."""
        if not folder_id:
            return {"ok": False, "detail": "No folder_id provided"}
        try:
            credentials = self._build_delegated_credentials(scopes=DRIVE_SCOPES)
            if credentials is None:
                return {"ok": False, "detail": "No delegated credentials for Drive scope"}
            from google.auth.transport.requests import Request as _GReq
            try:
                if not credentials.valid:
                    credentials.refresh(_GReq())
            except Exception as refresh_err:  # noqa: BLE001
                return {
                    "ok": False,
                    "detail": (
                        f"Drive scope NOT authorized via Domain-Wide Delegation. "
                        f"Action required: in admin.google.com → Security → API Controls → "
                        f"Domain-wide Delegation, edit the service account's allowed scopes "
                        f"and add 'https://www.googleapis.com/auth/drive'. Refresh error: {refresh_err}"
                    ),
                }
            token = getattr(credentials, "token", None)
            if not token:
                return {"ok": False, "detail": "No access token after refresh"}
            import requests as _req
            resp = _req.get(
                f"https://www.googleapis.com/drive/v3/files/{folder_id}",
                params={
                    "fields": "id,name,mimeType,driveId,capabilities",
                    "supportsAllDrives": "true",
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if resp.status_code >= 400:
                return {
                    "ok": False,
                    "detail": f"GET folder {folder_id} returned {resp.status_code}: {resp.text[:200]}",
                }
            data = resp.json() or {}
            caps = data.get("capabilities") or {}
            if not caps.get("canAddChildren", False):
                return {
                    "ok": False,
                    "detail": (
                        f"Folder is reachable but the impersonated user cannot add files to it "
                        f"(canAddChildren=false). Add {IMPERSONATE_EMAIL} as Manager or Content "
                        f"Manager of the Shared Drive."
                    ),
                    "name": data.get("name"),
                }
            return {
                "ok": True,
                "detail": f"Folder reachable and writable by impersonated user.",
                "name": data.get("name"),
            }
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "detail": f"Exception: {e}"}

    def update_meet_space_access_open(self, space_name: str) -> bool:
        """PATCH an existing Meet space's `accessType` to OPEN so external
        joiners (mentor/candidate on personal Gmail) bypass the
        "Wait for the host" gate.

        `space_name` is the canonical Meet space resource name returned by
        the spaces API at creation time, e.g. ``spaces/abc123def`` — we
        persist this on each booking as `meet_space_name`.

        Returns True on success, False otherwise. Idempotent — patching a
        space that's already OPEN is a no-op on Google's side.
        """
        if not space_name:
            return False
        if not self.service:
            return False
        try:
            credentials = self._build_delegated_credentials()
            if credentials is None:
                return False
            try:
                from google.auth.transport.requests import Request as _GReq
                if not credentials.valid:
                    credentials.refresh(_GReq())
            except Exception:  # noqa: BLE001
                return False
            access_token = getattr(credentials, 'token', None)
            if not access_token:
                return False

            import requests as _requests
            # `space_name` is already in form "spaces/<id>" — append directly.
            url = (
                f"https://meet.googleapis.com/v2/{space_name}"
                f"?updateMask=config.accessType"
            )
            resp = _requests.patch(
                url,
                json={"config": {"accessType": "OPEN"}},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            if resp.status_code < 400:
                logger.info(
                    f"Meet API: patched {space_name} accessType=OPEN"
                )
                return True
            logger.warning(
                f"Meet API: failed to patch {space_name} accessType "
                f"({resp.status_code}): {resp.text[:200]}"
            )
            return False
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Meet API space patch raised: {e}")
            return False

    def _build_delegated_credentials(self, scopes: Optional[List[str]] = None):
        """Re-build a delegated credentials object — used as a safety net by
        `_create_meet_space_with_recording`. Accepts an optional `scopes`
        override so Drive operations can mint a *separate* token that
        only requests Drive scope (keeping calendar/meet flows isolated
        from missing-DWD errors on Drive scope)."""
        try:
            credentials = None
            effective_scopes = scopes if scopes is not None else SCOPES
            if SERVICE_ACCOUNT_JSON:
                info = json.loads(SERVICE_ACCOUNT_JSON)
                credentials = service_account.Credentials.from_service_account_info(info, scopes=effective_scopes)
            elif os.path.exists(SERVICE_ACCOUNT_FILE):
                credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=effective_scopes)
            if credentials is None:
                return None
            return credentials.with_subject(IMPERSONATE_EMAIL)
        except Exception:  # noqa: BLE001
            return None
    
    def _generate_meet_link_separately(
        self,
        session_type: str,
        start_datetime: datetime,
        duration_minutes: int
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a Google Meet link by creating a hidden calendar event with conferenceData.
        The event is created on a different calendar or marked as private to keep it hidden.
        
        Args:
            session_type: Type of session for unique ID
            start_datetime: When the meeting starts
            duration_minutes: Duration in minutes
            
        Returns:
            Dict with meet_link and hidden_event_id, or None if failed
        """
        if not self.service:
            logger.error("Calendar service not initialized - cannot generate meet link")
            return None

        # Try the Meet REST API first so the meeting auto-records. We still
        # need to create a calendar event so the meet link has a host on
        # gradnext's calendar — but we attach the existing meet URI rather
        # than letting Calendar API mint a new one.
        meet_space = self._create_meet_space_with_recording()

        try:
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)

            # Create a hidden event just to generate the meet link
            hidden_event = {
                'summary': f'[HIDDEN] gradnext {session_type} Meeting Link Generator',
                'description': 'This event was created to generate a Google Meet link. It should not be visible to attendees.',
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                # No attendees - this is just for link generation
                'attendees': [],
                # Make it private/hidden
                'visibility': 'private',
                'transparency': 'transparent',  # Shows as "free" not "busy"
                'reminders': {
                    'useDefault': False,
                    'overrides': [],  # No reminders for hidden event
                },
                'sendUpdates': 'none',  # Don't send any notifications
            }

            if meet_space and meet_space.get('meeting_uri'):
                # Attach the pre-created Meet space (auto-record ON) instead
                # of having Calendar mint a fresh one.
                hidden_event['conferenceData'] = {
                    'conferenceSolution': {
                        'key': {'type': 'hangoutsMeet'}
                    },
                    'entryPoints': [{
                        'entryPointType': 'video',
                        'uri': meet_space['meeting_uri'],
                        'label': meet_space.get('meeting_code') or meet_space['meeting_uri'],
                    }],
                }
            else:
                # Fallback to legacy Calendar-minted Meet link
                hidden_event['conferenceData'] = {
                    'createRequest': {
                        'requestId': f"gradnext-hidden-{session_type}-{datetime.now().timestamp()}",
                        'conferenceSolutionKey': {
                            'type': 'hangoutsMeet'
                        }
                    }
                }

            # Create the hidden event with conference data
            created_event = self.service.events().insert(
                calendarId='primary',
                body=hidden_event,
                conferenceDataVersion=1,  # Required for Google Meet link
                sendNotifications=False  # Don't notify anyone
            ).execute()
            
            # Extract the meet link
            meet_link = None
            if 'conferenceData' in created_event:
                entry_points = created_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            # IMPORTANT: Do NOT delete the hidden event!
            # If we delete it, the Google Meet link becomes orphaned and 
            # participants will be stuck in "waiting for host" screen.
            # The hidden event stays on the service account's calendar,
            # making the service account the host of the meeting.
            hidden_event_id = created_event.get('id')
            if hidden_event_id:
                logger.info(f"Created host event {hidden_event_id} for meet link - keeping it active so meeting has a host")
            
            if meet_link:
                logger.info(f"Generated meet link separately: {meet_link}")
            else:
                logger.warning("Failed to extract meet link from hidden event")
            
            # Return dict to match _generate_meet_link_with_attendees format
            return {
                "meet_link": meet_link,
                "hidden_event_id": hidden_event_id,
                "meet_space_name": (meet_space or {}).get("space_name"),
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error generating meet link: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error generating meet link: {str(e)}")
            return None
    
    def _generate_meet_link_with_attendees(
        self,
        session_type: str,
        start_datetime: datetime,
        duration_minutes: int,
        attendee_emails: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a Google Meet link by creating a hidden calendar event WITH attendees.
        This ensures attendees are recognized as participants and can join without 
        waiting for host, while keeping the Meet link hidden from their calendar.
        
        Returns:
            { "meet_link": str, "hidden_event_id": str } or None on failure.
        """
        if not self.service:
            logger.error("Calendar service not initialized - cannot generate meet link")
            return None

        # Try to mint an auto-record Meet space first
        meet_space = self._create_meet_space_with_recording()

        try:
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            
            # Build attendees list - these will be recognized as meeting participants
            attendees = [{"email": email} for email in attendee_emails]
            
            # Create a hidden event WITH attendees to generate the meet link
            # Attendees will be part of the Meet but won't see this event
            hidden_event = {
                'summary': f'[MEET] gradnext {session_type}',
                'description': 'This is a hidden event for Google Meet link generation. Attendees can join without waiting for host.',
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                # Include attendees so they are recognized as meeting participants
                'attendees': attendees,
                # Make it private/hidden from attendees' calendars
                'visibility': 'private',
                'transparency': 'transparent',  # Shows as "free" not "busy"
                'reminders': {
                    'useDefault': False,
                    'overrides': [],  # No reminders for hidden event
                },
                'sendUpdates': 'none',  # Don't send notifications for this hidden event
            }

            if meet_space and meet_space.get('meeting_uri'):
                # Attach the pre-created Meet space (auto-record ON) instead
                # of having Calendar mint a fresh one.
                hidden_event['conferenceData'] = {
                    'conferenceSolution': {
                        'key': {'type': 'hangoutsMeet'}
                    },
                    'entryPoints': [{
                        'entryPointType': 'video',
                        'uri': meet_space['meeting_uri'],
                        'label': meet_space.get('meeting_code') or meet_space['meeting_uri'],
                    }],
                }
            else:
                # Fallback to legacy Calendar-minted Meet link
                hidden_event['conferenceData'] = {
                    'createRequest': {
                        'requestId': f"gradnext-meet-{session_type}-{datetime.now().timestamp()}",
                        'conferenceSolutionKey': {
                            'type': 'hangoutsMeet'
                        }
                    }
                }

            # Create the hidden event with conference data
            created_event = self.service.events().insert(
                calendarId='primary',
                body=hidden_event,
                conferenceDataVersion=1,  # Required for Google Meet link
                sendNotifications=False  # Don't notify attendees about this hidden event
            ).execute()
            
            # Extract the meet link
            meet_link = None
            if 'conferenceData' in created_event:
                entry_points = created_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            # Keep the hidden event active so attendees remain as participants
            hidden_event_id = created_event.get('id')
            if hidden_event_id:
                logger.info(f"Created hidden meet event {hidden_event_id} with {len(attendees)} attendees - keeping active for participant recognition")
            
            if meet_link:
                logger.info(f"Generated meet link with attendees: {meet_link}")
            else:
                logger.warning("Failed to extract meet link from hidden event with attendees")
            
            # Return both meet link, hidden event ID and the originating
            # Meet space name (used later to fetch recordings/transcripts
            # via the Meet REST conferenceRecords API).
            return {
                "meet_link": meet_link,
                "hidden_event_id": hidden_event_id,
                "meet_space_name": (meet_space or {}).get("space_name"),
            }
            
        except HttpError as e:
            logger.error(f"Google Calendar API error generating meet link with attendees: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error generating meet link with attendees: {str(e)}")
            return None
    
    def create_meeting_event(
        self,
        title: str,
        description: str,
        start_datetime: datetime,
        duration_minutes: int,
        attendee_emails: List[str],
        session_type: str = "coaching",  # "coaching", "peer_practice", "workshop"
        additional_info: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a calendar event with Google Meet link
        
        The Meet link is NOT included in the visible calendar invite.
        Instead, we create a hidden event with the same attendees to generate
        the Meet link, which makes attendees recognized participants who can
        join without waiting for host.
        
        Args:
            title: Event title
            description: Event description
            start_datetime: Start time (will be converted to Asia/Kolkata timezone)
            duration_minutes: Duration in minutes
            attendee_emails: List of attendee email addresses
            session_type: Type of session for tracking
            additional_info: Any additional info to include
            
        Returns:
            Dict with event details including meet_link, event_id, etc.
        """
        if not self.service:
            logger.error("Calendar service not initialized")
            return None
        
        try:
            # Calculate end time
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            
            # Build attendees list
            attendees = [{"email": email} for email in attendee_emails]
            
            # Build description - DO NOT include meet link
            full_description = description
            if additional_info:
                full_description += "\n\n---\nSession Details:\n"
                for key, value in additional_info.items():
                    if 'meet' not in key.lower() and 'link' not in key.lower():
                        full_description += f"• {key}: {value}\n"
            
            full_description += f"\n---\nSession Type: {session_type.replace('_', ' ').title()}"
            full_description += "\nOrganized by gradnext (info@gradnext.co)"
            
            # Get frontend URL for dashboard link
            frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "").rstrip("/")
            if not frontend_url:
                frontend_url = os.environ.get("FRONTEND_URL", "https://app.gradnext.co")
            
            # Instructions to join via dashboard
            full_description += "\n\n" + "="*50
            full_description += "\n🎯 HOW TO JOIN THIS SESSION"
            full_description += "\n" + "="*50
            full_description += "\n\nTo join your session:"
            full_description += "\n1️⃣ Log in to your gradnext Dashboard"
            full_description += "\n2️⃣ Go to your upcoming sessions"
            full_description += "\n3️⃣ Click the 'Join Now' button when the session opens"
            full_description += "\n   (Available 10 minutes before your scheduled time)"
            full_description += f"\n\n🔗 Dashboard: {frontend_url}/dashboard"
            full_description += "\n" + "="*50
            
            # Create VISIBLE event WITHOUT Google Meet link
            visible_event = {
                'summary': title,
                'description': full_description,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'attendees': attendees,
                # NO conferenceData - Meet link not visible in invite
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},
                        {'method': 'email', 'minutes': 60},
                        {'method': 'popup', 'minutes': 15},
                    ],
                },
                'guestsCanModify': False,
                'guestsCanInviteOthers': False,
                'guestsCanSeeOtherGuests': True,
                'sendUpdates': 'all',
            }
            
            # Create the visible event
            created_event = self.service.events().insert(
                calendarId='primary',
                body=visible_event,
                sendNotifications=True
            ).execute()
            
            # Now create a HIDDEN event to host the Meet link.
            # CRITICAL: We must include the attendees on this hidden event
            # too. The Meet link is owned by the hidden event; if its
            # attendees list is empty, Google Meet treats joiners as
            # external/uninvited and shows them "Please wait until a
            # meeting host brings you into the call". By passing the
            # mentor + candidate emails through, they're recognized as
            # invited participants and can join directly without anyone
            # admitting them. The event itself stays hidden because we
            # set visibility=private and sendUpdates=none in
            # `_generate_meet_link_with_attendees`.
            meet_result = self._generate_meet_link_with_attendees(
                session_type,
                start_datetime,
                duration_minutes,
                attendee_emails,
            )

            # `_generate_meet_link_with_attendees` returns a string OR the
            # newer dict shape; normalize so the rest of this function
            # can read .get(...) consistently.
            if isinstance(meet_result, str):
                meet_result = {"meet_link": meet_result, "hidden_event_id": None}
            elif meet_result is None:
                meet_result = {}

            meet_link = meet_result.get("meet_link") if meet_result else None
            hidden_event_id = meet_result.get("hidden_event_id") if meet_result else None
            meet_space_name = meet_result.get("meet_space_name") if meet_result else None
            
            result = {
                'event_id': created_event.get('id'),
                'hidden_event_id': hidden_event_id,  # Store this to delete when cancelling
                'meet_link': meet_link,
                'meet_space_name': meet_space_name,  # for later artifact polling
                'html_link': created_event.get('htmlLink'),
                'start': created_event['start'].get('dateTime'),
                'end': created_event['end'].get('dateTime'),
                'status': created_event.get('status'),
                'attendees': [a.get('email') for a in created_event.get('attendees', [])],
                'organizer': IMPERSONATE_EMAIL
            }
            
            logger.info(f"Created calendar event: {result['event_id']} with hidden meet link: {meet_link}")
            return result
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating calendar event: {str(e)}")
            return None
    
    def update_event(
        self,
        event_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update an existing calendar event
        
        Args:
            event_id: The Google Calendar event ID
            updates: Dictionary of fields to update (title, description, start, end, attendees)
        """
        if not self.service:
            return None
        
        try:
            # Get current event
            event = self.service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()
            
            # Apply updates
            if 'title' in updates:
                event['summary'] = updates['title']
            if 'description' in updates:
                event['description'] = updates['description']
            if 'start' in updates:
                event['start']['dateTime'] = updates['start'].isoformat()
            if 'end' in updates:
                event['end']['dateTime'] = updates['end'].isoformat()
            if 'attendees' in updates:
                event['attendees'] = [{"email": email} for email in updates['attendees']]
            
            # Update the event
            updated_event = self.service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event,
                sendNotifications=True
            ).execute()
            
            return {
                'event_id': updated_event.get('id'),
                'status': 'updated',
                'html_link': updated_event.get('htmlLink')
            }
            
        except HttpError as e:
            logger.error(f"Error updating event: {str(e)}")
            return None
    
    def cancel_event(self, event_id: str, notify_attendees: bool = True) -> bool:
        """
        Cancel/delete a calendar event
        
        Args:
            event_id: The Google Calendar event ID
            notify_attendees: Whether to send cancellation emails
        """
        if not self.service:
            return False
        
        try:
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id,
                sendNotifications=notify_attendees
            ).execute()
            
            logger.info(f"Cancelled calendar event: {event_id}")
            return True
            
        except HttpError as e:
            logger.error(f"Error cancelling event: {str(e)}")
            return False
    
    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get details of a specific event"""
        if not self.service:
            return None
        
        try:
            event = self.service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()
            
            meet_link = None
            if 'conferenceData' in event:
                entry_points = event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            return {
                'event_id': event.get('id'),
                'title': event.get('summary'),
                'description': event.get('description'),
                'meet_link': meet_link,
                'html_link': event.get('htmlLink'),
                'start': event['start'].get('dateTime'),
                'end': event['end'].get('dateTime'),
                'status': event.get('status'),
                'attendees': [a.get('email') for a in event.get('attendees', [])]
            }
            
        except HttpError as e:
            logger.error(f"Error getting event: {str(e)}")
            return None

    def create_discovery_call_event(
        self,
        candidate_name: str,
        candidate_email: str,
        candidate_phone: str,
        admin_email: str,
        start_datetime: datetime,
        duration_minutes: int = 15
    ) -> Optional[Dict[str, Any]]:
        """
        Create a discovery call event WITH Google Meet link included in the invite.
        Unlike regular sessions, discovery calls include the Meet link directly.
        
        Args:
            candidate_name: Name of the candidate
            candidate_email: Email of the candidate
            candidate_phone: Phone number of the candidate
            admin_email: Admin email to receive the invite
            start_datetime: When the call is scheduled
            duration_minutes: Duration of the call (default 15 minutes)
            
        Returns:
            Dict with event details including meet_link, event_id, etc.
        """
        if not self.service:
            logger.error("Calendar service not initialized for discovery call")
            return None
        
        try:
            # Calculate end time
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            
            # Build attendees list
            attendees = [
                {"email": candidate_email},
                {"email": admin_email}
            ]
            
            # Build description WITH meeting info
            description = f"""Discovery Call with {candidate_name}

📞 Candidate Details:
• Name: {candidate_name}
• Email: {candidate_email}
• Phone: {candidate_phone}

⏱️ Duration: {duration_minutes} minutes

---
This is a free discovery call to discuss your consulting preparation goals and how gradnext can help you succeed.

Organized by gradnext
Website: https://www.gradnext.co
Email: info@gradnext.co
"""
            
            # Create event body WITH Google Meet
            event = {
                'summary': f"gradnext Discovery Call - {candidate_name}",
                'description': description,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'attendees': attendees,
                # Include Google Meet conference data
                'conferenceData': {
                    'createRequest': {
                        'requestId': f"discovery-{candidate_email}-{start_datetime.timestamp()}",
                        'conferenceSolutionKey': {
                            'type': 'hangoutsMeet'
                        }
                    }
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 24 hours before
                        {'method': 'email', 'minutes': 60},       # 1 hour before
                        {'method': 'popup', 'minutes': 15},       # 15 minutes before
                    ],
                },
                'guestsCanModify': False,
                'guestsCanInviteOthers': False,
                'guestsCanSeeOtherGuests': True,
                'sendUpdates': 'all',
            }
            
            # Create the event WITH Google Meet
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,  # Required to create Google Meet
                sendNotifications=True
            ).execute()
            
            # Extract the Google Meet link
            meet_link = None
            if 'conferenceData' in created_event:
                entry_points = created_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            result = {
                'event_id': created_event.get('id'),
                'meet_link': meet_link,
                'html_link': created_event.get('htmlLink'),
                'start': created_event['start'].get('dateTime'),
                'end': created_event['end'].get('dateTime'),
                'status': created_event.get('status'),
                'attendees': [a.get('email') for a in created_event.get('attendees', [])],
                'organizer': IMPERSONATE_EMAIL
            }
            
            logger.info(f"Created discovery call event: {result['event_id']} with Meet link: {meet_link}")
            return result
            
        except HttpError as e:
            logger.error(f"Google Calendar API error for discovery call: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating discovery call event: {str(e)}")
            return None

    def create_workshop_event(
        self,
        workshop_title: str,
        workshop_description: str,
        instructor_name: str,
        workshop_date: str,
        workshop_time: str,
        duration_minutes: int,
        attendee_email: str,
        attendee_name: str
    ) -> Optional[Dict]:
        """
        Create a Google Calendar event for workshop registration with Google Meet link.
        
        Args:
            workshop_title: Title of the workshop
            workshop_description: Workshop description
            instructor_name: Name of the instructor
            workshop_date: Date in YYYY-MM-DD format
            workshop_time: Time in HH:MM format (IST)
            duration_minutes: Duration in minutes
            attendee_email: Email of the attendee
            attendee_name: Name of the attendee
        
        Returns:
            Dict with event_id, meet_link, html_link or None if failed
        """
        if not self.is_available():
            logger.warning("Calendar service not available for workshop event")
            return None
        
        try:
            # Parse date and time
            start_datetime = datetime.strptime(f"{workshop_date} {workshop_time}", "%Y-%m-%d %H:%M")
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            
            # Make timezone aware (IST)
            ist = pytz.timezone(DEFAULT_TIMEZONE)
            start_datetime = ist.localize(start_datetime)
            end_datetime = ist.localize(end_datetime)
            
            event = {
                'summary': f"gradnext Workshop: {workshop_title}",
                'description': f"""Workshop: {workshop_title}

Instructor: {instructor_name}

{workshop_description}

---
This is a live workshop session. Please join on time.

If you have any questions, contact us at hi@gradnext.co""",
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'attendees': [
                    {'email': attendee_email, 'displayName': attendee_name}
                ],
                'conferenceData': {
                    'createRequest': {
                        'requestId': f"workshop-{uuid.uuid4().hex[:10]}",
                        'conferenceSolutionKey': {
                            'type': 'hangoutsMeet'
                        }
                    }
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 30},       # 30 minutes before
                        {'method': 'popup', 'minutes': 15}        # 15 minutes before
                    ],
                },
                'guestsCanModify': False,
                'guestsCanInviteOthers': False,
            }
            
            # Create the event WITH Google Meet
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,
                sendNotifications=True
            ).execute()
            
            # Extract the Google Meet link
            meet_link = None
            if 'conferenceData' in created_event:
                entry_points = created_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            result = {
                'event_id': created_event.get('id'),
                'meet_link': meet_link,
                'html_link': created_event.get('htmlLink'),
                'start': created_event['start'].get('dateTime'),
                'end': created_event['end'].get('dateTime'),
            }
            
            logger.info(f"Created workshop event for {attendee_email}: {result['event_id']} with Meet link: {meet_link}")
            return result
            
        except HttpError as e:
            logger.error(f"Google Calendar API error for workshop: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating workshop event: {str(e)}")
            return None

    def create_workshop_event_with_link(
        self,
        workshop_title: str,
        workshop_description: str,
        instructor_name: str,
        workshop_date: str,
        workshop_time: str,
        duration_minutes: int,
        attendee_email: str,
        attendee_name: str,
        meeting_link: str = None
    ) -> Optional[Dict]:
        """
        Create a Google Calendar event for workshop registration using a pre-set meeting link.
        All registrants get the SAME meeting link (set by admin in workshop details).
        
        Args:
            workshop_title: Title of the workshop
            workshop_description: Workshop description
            instructor_name: Name of the instructor
            workshop_date: Date in YYYY-MM-DD format
            workshop_time: Time in HH:MM format (IST)
            duration_minutes: Duration in minutes
            attendee_email: Email of the attendee
            attendee_name: Name of the attendee
            meeting_link: Pre-set meeting link (from workshop details)
        
        Returns:
            Dict with event_id, html_link or None if failed
        """
        if not self.is_available():
            logger.warning("Calendar service not available for workshop event")
            return None
        
        try:
            # Parse date and time
            start_datetime = datetime.strptime(f"{workshop_date} {workshop_time}", "%Y-%m-%d %H:%M")
            end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            
            # Make timezone aware (IST)
            ist = pytz.timezone(DEFAULT_TIMEZONE)
            start_datetime = ist.localize(start_datetime)
            end_datetime = ist.localize(end_datetime)
            
            # Build description with meeting link
            description = f"""Workshop: {workshop_title}

Instructor: {instructor_name}

{workshop_description}

---"""
            
            if meeting_link:
                description += f"""

📹 JOIN WORKSHOP HERE:
{meeting_link}

Please join using the link above at the scheduled time."""
            
            description += """

---
This is a live workshop session. Please join on time.

If you have any questions, contact us at hi@gradnext.co"""

            event = {
                'summary': f"gradnext Workshop: {workshop_title}",
                'description': description,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': DEFAULT_TIMEZONE,
                },
                'attendees': [
                    {'email': attendee_email, 'displayName': attendee_name}
                ],
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 30},       # 30 minutes before
                        {'method': 'popup', 'minutes': 15}        # 15 minutes before
                    ],
                },
                'guestsCanModify': False,
                'guestsCanInviteOthers': False,
            }
            
            # Add meeting link as location if available
            if meeting_link:
                event['location'] = meeting_link
            
            # Create the event WITHOUT auto-generating Google Meet
            # (No conferenceData - using the pre-set meeting link instead)
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                sendNotifications=True
            ).execute()
            
            result = {
                'event_id': created_event.get('id'),
                'html_link': created_event.get('htmlLink'),
                'start': created_event['start'].get('dateTime'),
                'end': created_event['end'].get('dateTime'),
                'meeting_link': meeting_link
            }
            
            logger.info(f"Created workshop event for {attendee_email}: {result['event_id']} with pre-set link: {meeting_link}")
            return result
            
        except HttpError as e:
            logger.error(f"Google Calendar API error for workshop: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating workshop event with link: {str(e)}")
            return None

    def delete_event(self, event_id: str) -> bool:
        """Delete a calendar event by ID"""
        if not self.is_available():
            return False
        
        try:
            self.service.events().delete(calendarId='primary', eventId=event_id).execute()
            logger.info(f"Deleted calendar event: {event_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete calendar event {event_id}: {e}")
            return False


# Singleton instance
_calendar_service = None

def get_calendar_service() -> GoogleCalendarService:
    """Get the singleton calendar service instance"""
    global _calendar_service
    if _calendar_service is None:
        _calendar_service = GoogleCalendarService()
    return _calendar_service


# Helper functions for common use cases

def create_coaching_session_event(
    mentor_name: str,
    mentor_email: str,
    candidate_name: str,
    candidate_email: str,
    session_date: str,  # YYYY-MM-DD
    session_time: str,  # HH:MM
    duration_minutes: int = 60,
    session_notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a 1:1 coaching session event
    
    Returns dict with meet_link, event_id, etc. or None if failed
    """
    service = get_calendar_service()
    if not service.is_available():
        return None
    
    # Parse datetime - handle different time formats
    # Time might be "14:00" or "Mon 14:00" format
    time_part = session_time
    if ' ' in session_time:
        # Extract just the time portion (e.g., "Mon 14:00" -> "14:00")
        time_part = session_time.split(' ')[-1]
    
    start_dt = datetime.strptime(f"{session_date} {time_part}", "%Y-%m-%d %H:%M")
    
    title = f"gradnext 1:1 Coaching: {candidate_name} with {mentor_name}"
    description = f"""1:1 Coaching Session

Candidate: {candidate_name}
Mentor: {mentor_name}

Please join via the Google Meet link below. Make sure to:
• Be on time
• Have a stable internet connection
• Prepare any questions or cases you'd like to discuss

{session_notes or ''}
"""
    
    return service.create_meeting_event(
        title=title,
        description=description,
        start_datetime=start_dt,
        duration_minutes=duration_minutes,
        attendee_emails=[mentor_email, candidate_email],
        session_type="coaching",
        additional_info={
            "Mentor": mentor_name,
            "Candidate": candidate_name,
            "Duration": f"{duration_minutes} minutes"
        }
    )


def create_peer_practice_event(
    user1_name: str,
    user1_email: str,
    user2_name: str,
    user2_email: str,
    session_date: str,  # YYYY-MM-DD
    session_time: str,  # HH:MM
    duration_minutes: int = 45,
    practice_type: str = "Case Interview"
) -> Optional[Dict[str, Any]]:
    """
    Create a peer practice session event
    
    Returns dict with meet_link, event_id, etc. or None if failed
    """
    service = get_calendar_service()
    if not service.is_available():
        return None
    
    # Parse datetime - handle different time formats
    # Time might be "14:00" or "Mon 14:00" format
    time_part = session_time
    if ' ' in session_time:
        # Extract just the time portion (e.g., "Mon 14:00" -> "14:00")
        time_part = session_time.split(' ')[-1]
    
    start_dt = datetime.strptime(f"{session_date} {time_part}", "%Y-%m-%d %H:%M")
    
    title = f"gradnext Peer Practice: {user1_name} & {user2_name}"
    description = f"""Peer-to-Peer Practice Session

Partners: {user1_name} & {user2_name}
Practice Type: {practice_type}

Session Structure (suggested):
• First 20 mins: {user1_name} leads as interviewer
• Next 20 mins: {user2_name} leads as interviewer
• Last 5 mins: Mutual feedback

Tips:
• Be constructive with feedback
• Focus on both strengths and areas for improvement
• Take notes during the session
"""
    
    return service.create_meeting_event(
        title=title,
        description=description,
        start_datetime=start_dt,
        duration_minutes=duration_minutes,
        attendee_emails=[user1_email, user2_email],
        session_type="peer_practice",
        additional_info={
            "Partner 1": user1_name,
            "Partner 2": user2_name,
            "Practice Type": practice_type,
            "Duration": f"{duration_minutes} minutes"
        }
    )


def create_workshop_event(
    workshop_title: str,
    instructor_name: str,
    attendee_emails: List[str],
    workshop_date: str,  # YYYY-MM-DD
    workshop_time: str,  # HH:MM
    duration_minutes: int = 120,
    description: str = "",
    topics: List[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a workshop event (for cohort or subscription workshops)
    
    Returns dict with meet_link, event_id, etc. or None if failed
    """
    service = get_calendar_service()
    if not service.is_available():
        return None
    
    # Parse datetime
    start_dt = datetime.strptime(f"{workshop_date} {workshop_time}", "%Y-%m-%d %H:%M")
    
    title = f"gradnext Workshop: {workshop_title}"
    full_description = f"""Live Workshop

{workshop_title}
Instructor: {instructor_name}

{description}

"""
    if topics:
        full_description += "Topics covered:\n"
        for topic in topics:
            full_description += f"• {topic}\n"
    
    full_description += """
Please join via the Google Meet link. Have your questions ready!
"""
    
    return service.create_meeting_event(
        title=title,
        description=full_description,
        start_datetime=start_dt,
        duration_minutes=duration_minutes,
        attendee_emails=attendee_emails,
        session_type="workshop",
        additional_info={
            "Instructor": instructor_name,
            "Duration": f"{duration_minutes} minutes"
        }
    )


def create_strategy_call_event(
    user_name: str,
    user_email: str,
    mentor_name: str,
    mentor_email: str,
    start_datetime_ist: datetime,
    duration_minutes: int = 30,
    notes: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Create a strategy call calendar event with Google Meet link
    - Sends calendar invite to both user and mentor (NO meet link in invite)
    - Generates hidden Google Meet link for Join button access only
    
    Returns dict with meet_link, event_id or None if failed
    """
    service = get_calendar_service()
    if not service.is_available():
        logger.warning("Calendar service not available - skipping event creation")
        return {"meet_link": "", "event_id": ""}
    
    # Generate meet link separately (hidden). This call returns
    # `meet_link`, `hidden_event_id`, AND `meet_space_name` — the latter
    # is required so the artifacts scheduler can fetch the recording +
    # transcript after the strategy call ends.
    meet_result = service._generate_meet_link_separately(
        session_type="strategy-call",
        start_datetime=start_datetime_ist,
        duration_minutes=duration_minutes
    )
    
    meet_link = (meet_result or {}).get("meet_link") or ""
    meet_space_name = (meet_result or {}).get("meet_space_name")
    
    if not meet_link:
        logger.warning("Could not generate meet link for strategy call")
    
    # Create calendar invite WITHOUT the meet link
    title = f"gradnext Strategy Call - {user_name} with {mentor_name}"
    description = f"""Strategy Call Session

Student: {user_name}
Mentor: {mentor_name}

Duration: {duration_minutes} minutes

{f"Notes: {notes}" if notes else ""}

To join: Go to your gradnext dashboard and click the "Join Call" button at session time.
"""
    
    try:
        event_result = service.create_meeting_event(
            title=title,
            description=description,
            start_datetime=start_datetime_ist,
            duration_minutes=duration_minutes,
            attendee_emails=[user_email, mentor_email],
            session_type="strategy_call",
            additional_info={
                "Student": user_name,
                "Mentor": mentor_name
            }
        )
        
        if event_result:
            # Replace the meet link from invite with our hidden one,
            # AND override `meet_space_name` to point at the actual
            # meet link we're using (the separately-generated one).
            event_result["meet_link"] = meet_link
            event_result["meet_space_name"] = meet_space_name
            logger.info(f"Created strategy call event: {event_result.get('event_id')}")
            return event_result
        
    except Exception as e:
        logger.error(f"Failed to create strategy call event: {e}")
    
    # Fallback: return at least the meet link even if invite fails
    return {"meet_link": meet_link, "event_id": "", "meet_space_name": meet_space_name}
