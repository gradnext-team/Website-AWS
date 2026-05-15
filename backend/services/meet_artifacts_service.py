"""
Meet Artifacts Service
======================

Fetches Google Meet recording / transcript / Smart-Notes URLs for a Meet
space (created via the Meet REST API in `calendar_service`). Only scope
is to surface the artifacts that Google has already produced — we do
NOT mirror them into our own storage. The Drive/Docs URLs returned here
are stored on the `bookings` document and rendered in the admin
dashboard; the candidate-facing read endpoint authorizes per booking.

Why a separate service?
- Keeps `calendar_service.py` focused on event/space *creation*.
- The artifact-fetch flow is poll-based (Google produces files some
  minutes AFTER the meeting ends), so it has its own retry semantics
  separate from the create-time flow.

API used
--------
Meet REST API v2 — `conferenceRecords` collection. Each conference
record has `recordings`, `transcripts` and `participants` subresources.
We surface recording + transcript URLs (Smart-Notes shows up as a
transcript of type SMART_NOTES on supported plans).

Scope: `https://www.googleapis.com/auth/meetings.space.created` — same
scope already configured for `_create_meet_space_with_recording`. We
re-use the delegated credentials minted there.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import requests

from services.calendar_service import GoogleCalendarService, get_calendar_service

logger = logging.getLogger(__name__)

_MEET_API_BASE = "https://meet.googleapis.com/v2"


def _get_access_token(svc: GoogleCalendarService) -> Optional[str]:
    """Borrow the calendar service's delegated credentials so we don't
    re-auth. The Meet REST API just needs an OAuth bearer token."""
    try:
        creds = svc._build_delegated_credentials()  # type: ignore[attr-defined]
        if creds is None:
            return None
        if not creds.valid:
            from google.auth.transport.requests import Request as _GReq
            creds.refresh(_GReq())
        return creds.token
    except Exception as e:  # noqa: BLE001
        logger.warning(f"meet_artifacts: could not mint access token: {e}")
        return None


def _meet_api_get(token: str, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Thin GET helper. Returns parsed JSON or None on any error."""
    try:
        resp = requests.get(
            f"{_MEET_API_BASE}{path}",
            params=params or {},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"meet_artifacts: GET {path} failed: {e}")
        return None
    if resp.status_code >= 400:
        # 404 here means "no records yet" — common before Google has
        # finalised the artifacts. Don't log that as an error.
        if resp.status_code == 404:
            return None
        logger.warning(
            f"meet_artifacts: GET {path} returned {resp.status_code}: {resp.text[:200]}"
        )
        return None
    try:
        return resp.json() or {}
    except ValueError:
        return None


def fetch_artifacts_for_space(space_name: str) -> Optional[Dict[str, Any]]:
    """List all conference records for a Meet space, then for each
    record pull its recordings + transcripts. Aggregates into a single
    dict ready to merge onto a booking document.

    Args:
        space_name: e.g. "spaces/abc123" — what the Meet REST API
                    returned when we created the space.

    Returns:
        {
          "recording_url": <first recording exportUri or None>,
          "transcript_url": <first transcript exportUri or None>,
          "recordings": [{exportUri, drive_file_id, state}, ...],
          "transcripts": [{exportUri, doc_id, state, type}, ...],
          "conference_record_names": [...],  # for debugging
          "checked_at": iso8601 utc,
        }
        or None if the Meet API call(s) all failed.
    """
    if not space_name or not space_name.startswith("spaces/"):
        return None

    svc = get_calendar_service()
    if not svc.is_available():
        return None

    token = _get_access_token(svc)
    if not token:
        return None

    # Step 1 — list conference records for this space.
    # Filter syntax per Meet REST API docs:
    #   filter='space.name="spaces/abc123"'
    list_resp = _meet_api_get(
        token,
        "/conferenceRecords",
        params={"filter": f'space.name="{space_name}"'},
    )
    if not list_resp:
        return None

    conference_records = list_resp.get("conferenceRecords") or []
    if not conference_records:
        # No records yet — meeting may not have happened or Google is
        # still finalizing.
        return None

    recordings: List[Dict[str, Any]] = []
    transcripts: List[Dict[str, Any]] = []

    for cr in conference_records:
        cr_name = cr.get("name")
        if not cr_name:
            continue

        # Step 2 — recordings under this conference record
        rec_resp = _meet_api_get(token, f"/{cr_name}/recordings")
        for rec in (rec_resp or {}).get("recordings", []) or []:
            drive = rec.get("driveDestination") or {}
            recordings.append({
                "name": rec.get("name"),
                "state": rec.get("state"),
                "exportUri": drive.get("exportUri"),
                "drive_file_id": drive.get("file"),
                "start_time": rec.get("startTime"),
                "end_time": rec.get("endTime"),
            })

        # Step 3 — transcripts under this conference record
        tr_resp = _meet_api_get(token, f"/{cr_name}/transcripts")
        for tr in (tr_resp or {}).get("transcripts", []) or []:
            docs = tr.get("docsDestination") or {}
            transcripts.append({
                "name": tr.get("name"),
                "state": tr.get("state"),
                "exportUri": docs.get("exportUri"),
                "doc_id": docs.get("document"),
                "start_time": tr.get("startTime"),
                "end_time": tr.get("endTime"),
            })

    # Pick the first ready URL of each type for convenience storage.
    def _first_ready(items: List[Dict[str, Any]]) -> Optional[str]:
        for item in items:
            if item.get("exportUri") and (item.get("state") in (None, "FILE_GENERATED")):
                return item["exportUri"]
        # Fall back to the first item regardless of state — better than nothing
        for item in items:
            if item.get("exportUri"):
                return item["exportUri"]
        return None

    from datetime import datetime, timezone
    return {
        "recording_url": _first_ready(recordings),
        "transcript_url": _first_ready(transcripts),
        "recordings": recordings,
        "transcripts": transcripts,
        "conference_record_names": [cr.get("name") for cr in conference_records if cr.get("name")],
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# Sync helpers — write fetched artifact URLs onto the booking document.
# ============================================================================

async def sync_artifacts_for_booking(db, booking: Dict[str, Any]) -> Dict[str, Any]:
    """Pull the artifacts for `booking.meet_space_name` and persist them
    on the booking. Idempotent — safe to call repeatedly. Returns the
    artifacts dict written (or `{"skipped": reason}`).
    
    Wrapper around `sync_artifacts_for_record` for backward compat.
    """
    return await sync_artifacts_for_record(db.bookings, booking)


async def sync_pending_recordings(db, max_per_run: int = 50, hours_lookback: int = 72) -> Dict[str, int]:
    """Find recently-completed bookings/strategy-calls that have a
    `meet_space_name` but no `recording_url` yet, and try to pull the
    artifacts for them.
    
    `hours_lookback` caps how far back we look — Google's records are
    available for 30 days but most calls produce artifacts within an
    hour, so 72 h covers retries comfortably.
    """
    from datetime import datetime, timezone, timedelta
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    since = (datetime.now(timezone.utc) - timedelta(hours=hours_lookback)).isoformat()
    
    found = 0
    synced = 0
    skipped = 0
    
    # Sync across BOTH collections that hold meet_space_name on session
    # records: regular coaching bookings and strategy calls.
    for collection_name in ("bookings", "strategy_call_sessions"):
        coll = db[collection_name]
        cursor = coll.find(
            {
                "meet_space_name": {"$nin": [None, ""], "$exists": True},
                # Pick records that EITHER haven't fetched a recording_url
                # yet OR haven't been moved to the destination Shared Drive.
                "$and": [
                    {"$or": [
                        {"recording_url": {"$exists": False}},
                        {"recording_url": {"$in": [None, ""]}},
                        {"recording_drive_moved": {"$ne": True}},
                    ]},
                ],
                # Best-effort: only sessions that are past their scheduled time
                "$or": [
                    {"date": {"$lte": today}},
                    {"created_at": {"$gte": since}},
                ],
            },
            {"_id": 0, "id": 1, "meet_space_name": 1, "recording_url": 1, "transcript_url": 1, "date": 1, "recording_drive_moved": 1},
        ).limit(max_per_run)
        async for booking in cursor:
            found += 1
            try:
                # Pass the collection so sync_artifacts_for_booking can
                # write back to the right one.
                res = await sync_artifacts_for_record(coll, booking)
                if isinstance(res, dict) and res.get("skipped"):
                    skipped += 1
                else:
                    synced += 1
            except Exception as e:  # noqa: BLE001
                logger.warning(f"[meet_artifacts] sync failed for {collection_name}/{booking.get('id')}: {e}")
    return {"found": found, "synced": synced, "skipped": skipped}


async def sync_artifacts_for_record(coll, record: Dict[str, Any]) -> Dict[str, Any]:
    """Pull artifacts for a session record from any collection (bookings
    or strategy_call_sessions). Same shape as `sync_artifacts_for_booking`
    but takes the collection explicitly so we can write back to the
    right one.
    """
    record_id = record.get("id")
    space_name = record.get("meet_space_name")
    if not space_name:
        return {"skipped": "no meet_space_name"}
    if record.get("recording_url") and record.get("transcript_url") and record.get("recording_drive_moved"):
        return {"skipped": "already synced"}

    artifacts = fetch_artifacts_for_space(space_name)
    if not artifacts:
        return {"skipped": "no artifacts available yet"}

    update: Dict[str, Any] = {
        "meet_artifacts_checked_at": artifacts.get("checked_at"),
        "meet_artifacts": {
            "recordings": artifacts.get("recordings", []),
            "transcripts": artifacts.get("transcripts", []),
            "conference_record_names": artifacts.get("conference_record_names", []),
        },
    }
    if artifacts.get("recording_url"):
        update["recording_url"] = artifacts["recording_url"]
    if artifacts.get("transcript_url"):
        update["transcript_url"] = artifacts["transcript_url"]

    # Move the recording's Drive file into the configured Shared Drive
    # folder so the admin team has a central place to find recordings.
    # This is best-effort — never fails the artifact sync.
    try:
        from services.calendar_service import RECORDINGS_DRIVE_FOLDER_ID, get_calendar_service
        recordings_list = artifacts.get("recordings") or []
        if RECORDINGS_DRIVE_FOLDER_ID and recordings_list and not record.get("recording_drive_moved"):
            cal = get_calendar_service()
            move_results: List[Dict[str, Any]] = []
            new_recording_url: Optional[str] = None
            for rec in recordings_list:
                drive_file_id = rec.get("drive_file_id")
                if not drive_file_id:
                    continue
                move_res = cal.move_drive_file_to_folder(
                    drive_file_id, RECORDINGS_DRIVE_FOLDER_ID
                )
                move_results.append({
                    "drive_file_id": drive_file_id,
                    "result": move_res,
                })
                if move_res.get("success") and move_res.get("web_view_link"):
                    # Prefer the post-move webViewLink (cleaner Drive URL
                    # in the destination Shared Drive). Fall back to the
                    # original exportUri otherwise.
                    if new_recording_url is None:
                        new_recording_url = move_res["web_view_link"]
            if move_results:
                update["recording_drive_moved"] = any(
                    r["result"].get("success") for r in move_results
                )
                update["recording_drive_move_results"] = move_results
                update["recording_drive_folder_id"] = RECORDINGS_DRIVE_FOLDER_ID
                if new_recording_url:
                    update["recording_url"] = new_recording_url
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[meet_artifacts] drive-move failed for {record_id}: {e}")

    await coll.update_one({"id": record_id}, {"$set": update})
    logger.info(
        f"[meet_artifacts] Synced {coll.name}/{record_id}: "
        f"recording={'Y' if update.get('recording_url') else 'N'}, "
        f"transcript={'Y' if update.get('transcript_url') else 'N'}, "
        f"drive_moved={update.get('recording_drive_moved', False)}"
    )
    return artifacts


async def start_meet_artifacts_scheduler(interval_minutes: int = 5):
    """Long-running scheduler: every `interval_minutes`, sync artifacts
    for any bookings still missing recordings/transcripts.
    
    Runs every 5 minutes by default — Google finalises Meet recordings
    typically within 5–15 minutes of meeting end, so a 5-min cadence
    means a recording is available on the dashboard within 10 minutes
    of the session ending in the worst case.
    
    Writes a heartbeat to `db.system_status` on every cycle so the admin
    health-check UI can prove the scheduler is alive.
    """
    import asyncio
    import os
    from datetime import datetime, timezone
    from motor.motor_asyncio import AsyncIOMotorClient

    logger.info(f"[meet_artifacts] Scheduler starting with {interval_minutes} min interval")
    # Brief startup delay so we don't fight the boot-time migrations
    await asyncio.sleep(60)

    while True:
        cycle_start = datetime.now(timezone.utc)
        stats: Dict[str, Any] = {}
        last_error: Optional[str] = None
        try:
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            db_name = os.environ.get("DB_NAME", "gradnext")
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            # Wider lookback (7 days) so a deferred/late-finalised recording
            # still gets caught even if the scheduler missed earlier cycles.
            stats = await sync_pending_recordings(db, max_per_run=100, hours_lookback=168)
            logger.info(f"[meet_artifacts] cycle done: {stats}")
        except Exception as e:  # noqa: BLE001
            last_error = repr(e)
            logger.error(f"[meet_artifacts] scheduler cycle error: {last_error}")
        # Heartbeat — best-effort write so admin health check can see
        # the scheduler is alive even if the cycle failed.
        try:
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            db_name = os.environ.get("DB_NAME", "gradnext")
            hb_client = AsyncIOMotorClient(mongo_url)
            hb_db = hb_client[db_name]
            await hb_db.system_status.update_one(
                {"_id": "recording_scheduler"},
                {"$set": {
                    "last_run_at": cycle_start.isoformat(),
                    "last_completed_at": datetime.now(timezone.utc).isoformat(),
                    "last_stats": stats,
                    "last_error": last_error,
                    "interval_minutes": interval_minutes,
                }},
                upsert=True,
            )
            hb_client.close()
        except Exception as hb_err:  # noqa: BLE001
            logger.warning(f"[meet_artifacts] heartbeat write failed: {hb_err}")
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(interval_minutes * 60)
