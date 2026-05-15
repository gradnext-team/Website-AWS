"""
Google Sheets Service
Syncs new user sign-up data to a Google Sheet in real-time.
Uses a Service Account for authentication.
"""

import gspread
from google.oauth2.service_account import Credentials
import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Google Sheets config
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "").strip('"')
# Workshop registrations + feedback live on a separate "Workshop" Google Sheet.
# Defaults to the production sheet ID (for backwards-compat with local dev) but
# overridable via env. Service account must be granted Editor access.
WORKSHOP_FEEDBACK_SHEET_ID = os.environ.get(
    "WORKSHOP_FEEDBACK_SHEET_ID",
    "1Xy8X7yt31ph3Q5pWRur1f8vx_ccuN3Axse3IrR6wsmU",
).strip('"')
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "/app/backend/google_service_account.json").strip('"')
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")  # JSON string from env (preferred)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# Sheet headers (Sign-ups tab)
HEADERS = [
    "Name", "Email", "Phone", "UG College", "PG College",
    "Target Firms", "Prep Objective", "Prep Level", "Plan", "Sign-up Date & Time",
    "Upgrade", "Upgrade Date"
]

# Prep objective labels mapping
PREP_OBJECTIVE_LABELS = {
    "passive": "Passively preparing for consulting",
    "applications_submitted": "Applications submitted, waiting for interview invite",
    "interview_invite": "Already have an interview invite",
    "cleared_rounds": "Cleared one or more interview rounds",
}

# Prep level labels mapping
PREP_LEVEL_LABELS = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
}

_client = None


def _get_client():
    """Get or create a gspread client using service account credentials."""
    global _client
    if _client is None:
        try:
            creds = None
            
            # First try to load from environment variable (preferred for production)
            if GOOGLE_SERVICE_ACCOUNT_JSON:
                try:
                    service_account_info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
                    creds = Credentials.from_service_account_info(
                        service_account_info,
                        scopes=SCOPES
                    )
                    logger.info("Google Sheets: Loaded service account from environment variable")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: {e}")
            
            # Fallback to file-based credentials (for local development)
            if creds is None and os.path.exists(GOOGLE_SERVICE_ACCOUNT_FILE):
                creds = Credentials.from_service_account_file(
                    GOOGLE_SERVICE_ACCOUNT_FILE,
                    scopes=SCOPES
                )
                logger.info("Google Sheets: Loaded service account from file")
            
            if creds is None:
                logger.warning("No Google service account credentials found - Google Sheets features will be disabled")
                raise Exception("Google service account credentials not found")
            
            _client = gspread.authorize(creds)
            logger.info("Google Sheets client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets client: {e}")
            raise
    return _client


def _ensure_headers(sheet):
    """Ensure the first row has headers."""
    try:
        first_row = sheet.row_values(1)
        if not first_row or first_row != HEADERS:
            sheet.update(values=[HEADERS], range_name='A1')
            logger.info("Google Sheet headers set")
    except Exception as e:
        logger.error(f"Error setting headers: {e}")


def _append_user_row_sync(user_data: dict):
    """Synchronous function to append a user row to the Google Sheet."""
    if not GOOGLE_SHEET_ID:
        logger.warning("GOOGLE_SHEET_ID not configured, skipping sheet sync")
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet = spreadsheet.sheet1

        # Ensure headers exist
        _ensure_headers(sheet)

        # Format the data
        IST = timezone(timedelta(hours=5, minutes=30))
        created_at = user_data.get("created_at", "")
        if isinstance(created_at, str) and created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                signup_dt = dt.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
            except Exception:
                signup_dt = created_at
        elif isinstance(created_at, datetime):
            signup_dt = created_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
        else:
            signup_dt = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

        # Build full name
        name = user_data.get("name", "")
        if not name:
            first = user_data.get("first_name", "")
            last = user_data.get("last_name", "")
            name = f"{first} {last}".strip()

        # Format target firms
        target_firms = user_data.get("target_firms", [])
        if isinstance(target_firms, list):
            target_firms_str = ", ".join(target_firms) if target_firms else ""
        else:
            target_firms_str = str(target_firms) if target_firms else ""

        # Format prep objective
        prep_obj = user_data.get("prep_objective", "")
        prep_obj_label = PREP_OBJECTIVE_LABELS.get(prep_obj, prep_obj or "")
        if prep_obj == "other":
            prep_obj_label = user_data.get("other_objective", prep_obj)

        # Format prep level
        prep_level = user_data.get("preparation_level", "")
        prep_level_label = PREP_LEVEL_LABELS.get(prep_level, prep_level or "")

        row = [
            name,
            user_data.get("email", ""),
            user_data.get("phone_number", ""),
            user_data.get("ug_college", ""),
            user_data.get("pg_college", ""),
            target_firms_str,
            prep_obj_label,
            prep_level_label,
            user_data.get("plan", ""),
            signup_dt,
            "",  # Upgrade (empty initially)
            "",  # Upgrade Date (empty initially)
        ]

        sheet.append_row(row, value_input_option="RAW")
        logger.info(f"User {user_data.get('email', 'unknown')} added to Google Sheet")

    except Exception as e:
        logger.error(f"Failed to append user to Google Sheet: {e}")
        # Re-initialize client on auth errors
        global _client
        _client = None


async def append_user_to_sheet(user_data: dict):
    """Async wrapper to append a user row to Google Sheet without blocking."""
    try:
        await asyncio.to_thread(_append_user_row_sync, user_data)
    except Exception as e:
        logger.error(f"Error in async sheet append: {e}")


# ─── Upgrade Tracking ─────────────────────────────────────────────

# Plan key to display name mapping
PLAN_DISPLAY_NAMES = {
    "basic_plan": "Basic",
    "pro_plan": "Pro",
    "pro_plus_plan": "Pro Plus",
}

def _format_upgrade_label(plan_key: str, billing_cycle: str) -> str:
    """Format upgrade label like 'Pro 6-month' or 'Basic 1-month'."""
    plan_name = PLAN_DISPLAY_NAMES.get(plan_key, plan_key or "")
    if billing_cycle in ("half_yearly", "6_month", "semi_annual"):
        cycle_label = "6-month"
    elif billing_cycle in ("monthly", "1_month"):
        cycle_label = "1-month"
    else:
        cycle_label = billing_cycle or ""
    return f"{plan_name} {cycle_label}".strip()


def _update_user_upgrade_sync(email: str, plan_key: str, billing_cycle: str, user_data: dict = None):
    """Synchronous function to update the Upgrade columns for a user in the sign-up sheet.
    If user is not found in the sheet, adds them as a new row with upgrade info."""
    if not GOOGLE_SHEET_ID or not email:
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet = spreadsheet.sheet1

        # Ensure headers include Upgrade columns
        _ensure_headers(sheet)

        # Find the user's row by email
        all_values = sheet.get_all_values()
        email_col_idx = HEADERS.index("Email")
        upgrade_col_idx = HEADERS.index("Upgrade")  # Column K (index 10, sheet col 11)
        upgrade_date_col_idx = HEADERS.index("Upgrade Date")  # Column L (index 11, sheet col 12)

        target_row = None
        for row_idx, row in enumerate(all_values):
            if row_idx == 0:  # Skip header
                continue
            if len(row) > email_col_idx and row[email_col_idx].lower() == email.lower():
                target_row = row_idx + 1  # gspread uses 1-based indexing
                break

        # Format upgrade info
        _IST = timezone(timedelta(hours=5, minutes=30))
        upgrade_label = _format_upgrade_label(plan_key, billing_cycle)
        upgrade_date = datetime.now(_IST).strftime("%Y-%m-%d %H:%M:%S IST")

        if not target_row:
            # User not in sheet — add them as a new row with whatever data is available
            logger.info(f"User {email} not found in sign-up sheet, adding new row with upgrade info")
            
            if user_data:
                name = user_data.get("name", "")
                if not name:
                    first = user_data.get("first_name", "")
                    last = user_data.get("last_name", "")
                    name = f"{first} {last}".strip()
                
                target_firms = user_data.get("target_firms", [])
                if isinstance(target_firms, list):
                    target_firms_str = ", ".join(target_firms) if target_firms else ""
                else:
                    target_firms_str = str(target_firms) if target_firms else ""
                
                prep_obj = user_data.get("prep_objective", "")
                prep_obj_label = PREP_OBJECTIVE_LABELS.get(prep_obj, prep_obj or "")
                
                prep_level = user_data.get("preparation_level", "")
                prep_level_label = PREP_LEVEL_LABELS.get(prep_level, prep_level or "")
                
                created_at = user_data.get("created_at", "")
                if isinstance(created_at, str) and created_at:
                    try:
                        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        signup_dt = dt.astimezone(_IST).strftime("%Y-%m-%d %H:%M:%S IST")
                    except Exception:
                        signup_dt = created_at
                elif isinstance(created_at, datetime):
                    signup_dt = created_at.astimezone(_IST).strftime("%Y-%m-%d %H:%M:%S IST")
                else:
                    signup_dt = ""
                
                row = [
                    name,
                    email,
                    user_data.get("phone_number", ""),
                    user_data.get("ug_college", ""),
                    user_data.get("pg_college", ""),
                    target_firms_str,
                    prep_obj_label,
                    prep_level_label,
                    user_data.get("plan", plan_key),
                    signup_dt,
                    upgrade_label,
                    upgrade_date,
                ]
            else:
                row = [
                    "", email, "", "", "", "", "", "", plan_key, "",
                    upgrade_label, upgrade_date,
                ]
            
            sheet.append_row(row, value_input_option="RAW")
            logger.info(f"Added new row for {email} with upgrade: {upgrade_label}")
            return

        # Update the Upgrade and Upgrade Date cells
        upgrade_cell = gspread.utils.rowcol_to_a1(target_row, upgrade_col_idx + 1)
        upgrade_date_cell = gspread.utils.rowcol_to_a1(target_row, upgrade_date_col_idx + 1)

        sheet.update(values=[[upgrade_label]], range_name=upgrade_cell)
        sheet.update(values=[[upgrade_date]], range_name=upgrade_date_cell)

        logger.info(f"Updated upgrade for {email}: {upgrade_label} on {upgrade_date}")

    except Exception as e:
        logger.error(f"Failed to update upgrade in Google Sheet for {email}: {e}")
        global _client
        _client = None


async def update_user_upgrade_in_sheet(email: str, plan_key: str, billing_cycle: str, user_data: dict = None):
    """Async wrapper to update upgrade columns in the sign-up sheet."""
    try:
        await asyncio.to_thread(_update_user_upgrade_sync, email, plan_key, billing_cycle, user_data)
    except Exception as e:
        logger.error(f"Error in async upgrade sheet update: {e}")


# ─── Workshop Sign-ups Tab ────────────────────────────────────────

WORKSHOP_HEADERS = [
    "Name", "Email", "Phone", "UG College", "PG College",
    "Target Firms", "Prep Objective", "Prep Level", "Plan",
    "Workshop Name", "Workshop Date", "Registration Date & Time"
]

WORKSHOP_TAB_NAME = "Workshop Sign-ups"


def _get_or_create_workshop_sheet(spreadsheet):
    """Get or create the 'Workshop Sign-ups' tab in the spreadsheet."""
    try:
        sheet = spreadsheet.worksheet(WORKSHOP_TAB_NAME)
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(title=WORKSHOP_TAB_NAME, rows=1000, cols=len(WORKSHOP_HEADERS))
        logger.info(f"Created '{WORKSHOP_TAB_NAME}' tab in Google Sheet")
    
    # Ensure headers
    try:
        first_row = sheet.row_values(1)
        if not first_row or first_row != WORKSHOP_HEADERS:
            sheet.update(values=[WORKSHOP_HEADERS], range_name='A1')
            logger.info(f"Headers set for '{WORKSHOP_TAB_NAME}' tab")
    except Exception as e:
        logger.error(f"Error setting workshop headers: {e}")
    
    return sheet


def _append_workshop_registration_sync(user_data: dict, workshop_data: dict):
    """Synchronous function to append a workshop registration row."""
    if not GOOGLE_SHEET_ID:
        logger.warning("GOOGLE_SHEET_ID not configured, skipping workshop sheet sync")
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet = _get_or_create_workshop_sheet(spreadsheet)

        IST = timezone(timedelta(hours=5, minutes=30))
        registration_dt = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

        # Build full name
        name = user_data.get("name", "")
        if not name:
            first = user_data.get("first_name", "")
            last = user_data.get("last_name", "")
            name = f"{first} {last}".strip()

        # Format target firms
        target_firms = user_data.get("target_firms", [])
        if isinstance(target_firms, list):
            target_firms_str = ", ".join(target_firms) if target_firms else ""
        else:
            target_firms_str = str(target_firms) if target_firms else ""

        # Format prep objective
        prep_obj = user_data.get("prep_objective", "")
        prep_obj_label = PREP_OBJECTIVE_LABELS.get(prep_obj, prep_obj or "")
        if prep_obj == "other":
            prep_obj_label = user_data.get("other_objective", prep_obj)

        # Format prep level
        prep_level = user_data.get("preparation_level", "")
        prep_level_label = PREP_LEVEL_LABELS.get(prep_level, prep_level or "")

        # Workshop info
        workshop_name = workshop_data.get("title", "")
        workshop_date = workshop_data.get("date", "")
        workshop_time = workshop_data.get("time", "")
        if workshop_date and workshop_time:
            workshop_date_str = f"{workshop_date} {workshop_time} IST"
        elif workshop_date:
            workshop_date_str = workshop_date
        else:
            workshop_date_str = ""

        row = [
            name,
            user_data.get("email", ""),
            user_data.get("phone_number", ""),
            user_data.get("ug_college", ""),
            user_data.get("pg_college", ""),
            target_firms_str,
            prep_obj_label,
            prep_level_label,
            user_data.get("plan", ""),
            workshop_name,
            workshop_date_str,
            registration_dt,
        ]

        sheet.append_row(row, value_input_option="RAW")
        logger.info(f"Workshop registration for {user_data.get('email', 'unknown')} - '{workshop_name}' added to Google Sheet")

    except Exception as e:
        logger.error(f"Failed to append workshop registration to Google Sheet: {e}")
        global _client
        _client = None


async def append_workshop_registration_to_sheet(user_data: dict, workshop_data: dict):
    """Async wrapper to append a workshop registration row without blocking."""
    try:
        await asyncio.to_thread(_append_workshop_registration_sync, user_data, workshop_data)
    except Exception as e:
        logger.error(f"Error in async workshop sheet append: {e}")


# ─── Workshop Feedback Tab (separate sheet) ──────────────────────

WORKSHOP_FEEDBACK_TAB = "Feedback"
WORKSHOP_FEEDBACK_HEADERS = [
    "Submitted At", "Workshop Title", "Workshop Date",
    "Name", "Email", "Phone", "Rating", "Comments", "Source",
]


def _get_or_create_workshop_feedback_sheet(spreadsheet):
    """Get or create the 'Feedback' tab in the workshop spreadsheet.
    Preserves an admin-defined header row if columns already match."""
    try:
        sheet = spreadsheet.worksheet(WORKSHOP_FEEDBACK_TAB)
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(
            title=WORKSHOP_FEEDBACK_TAB,
            rows=2000,
            cols=len(WORKSHOP_FEEDBACK_HEADERS),
        )
        logger.info(f"Created '{WORKSHOP_FEEDBACK_TAB}' tab in Workshop sheet")

    try:
        first_row = sheet.row_values(1)
        if not first_row or first_row != WORKSHOP_FEEDBACK_HEADERS:
            sheet.update(values=[WORKSHOP_FEEDBACK_HEADERS], range_name='A1')
            logger.info(f"Headers set for '{WORKSHOP_FEEDBACK_TAB}' tab")
    except Exception as e:
        logger.error(f"Error setting workshop feedback headers: {e}")

    return sheet


def _build_workshop_feedback_row(feedback_data: dict) -> list:
    """Build a row aligned to WORKSHOP_FEEDBACK_HEADERS."""
    IST = timezone(timedelta(hours=5, minutes=30))

    submitted_at = feedback_data.get("submitted_at")
    if isinstance(submitted_at, str) and submitted_at:
        try:
            dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
            submitted_str = dt.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
        except Exception:
            submitted_str = submitted_at
    elif isinstance(submitted_at, datetime):
        submitted_str = submitted_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    else:
        submitted_str = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

    rating = feedback_data.get("rating", "")
    if rating not in (None, ""):
        try:
            rating = str(int(rating))
        except (ValueError, TypeError):
            rating = str(rating)

    return [
        submitted_str,
        feedback_data.get("workshop_title", ""),
        feedback_data.get("workshop_date", ""),
        feedback_data.get("name", ""),
        feedback_data.get("email", ""),
        feedback_data.get("phone", ""),
        rating or "",
        feedback_data.get("comments", ""),
        feedback_data.get("source", "in_app"),
    ]


def _append_workshop_feedback_sync(feedback_data: dict):
    """Append a single feedback row to the Workshop sheet > Feedback tab."""
    if not WORKSHOP_FEEDBACK_SHEET_ID:
        logger.warning("WORKSHOP_FEEDBACK_SHEET_ID not configured, skipping workshop feedback sync")
        return
    try:
        client = _get_client()
        spreadsheet = client.open_by_key(WORKSHOP_FEEDBACK_SHEET_ID)
        sheet = _get_or_create_workshop_feedback_sheet(spreadsheet)
        row = _build_workshop_feedback_row(feedback_data)
        sheet.append_row(row, value_input_option="RAW")
        logger.info(
            f"Workshop Feedback: appended row "
            f"(workshop={feedback_data.get('workshop_title','')!r}, "
            f"email={feedback_data.get('email','')!r}, "
            f"rating={feedback_data.get('rating','')!r})"
        )
    except Exception as e:
        logger.error(f"Failed to append workshop feedback row: {e}")
        global _client
        _client = None


async def append_workshop_feedback_to_sheet(feedback_data: dict):
    """Async wrapper: write a workshop feedback row to the sheet."""
    try:
        await asyncio.to_thread(_append_workshop_feedback_sync, feedback_data)
    except Exception as e:
        logger.error(f"Error in async workshop feedback append: {e}")


# ─── Discovery Calls Tab ──────────────────────────────────────────

DISCOVERY_CALLS_TAB_NAME = "Discovery Calls"

# Fixed (non-Q&A) columns, in display order. Any notification questions configured
# in the admin panel are appended after these as their own columns.
DISCOVERY_CALLS_BASE_HEADERS = [
    "Booking ID",
    "Booked At (IST)",
    "Status",
    "Scheduled Date (IST)",
    "Scheduled Time (IST)",
    "Meet Link",
    "Name",
    "Email",
    "Phone",
]

# Question answers we always promote to their own columns so admin can scan at a
# glance, regardless of whether the question still exists in the current set.
_CORE_QA_KEYS = {
    "name": ["name", "your name", "full name"],
    "email": ["email", "e-mail"],
    "phone": ["phone", "mobile", "whatsapp"],
}


def _format_answer(answer) -> str:
    """Render an answer (string / list / dict) as a readable cell value."""
    if answer is None:
        return ""
    if isinstance(answer, list):
        return ", ".join(str(a) for a in answer if a is not None and str(a).strip() != "")
    if isinstance(answer, dict):
        # Label-keyed options: prefer 'label' → 'value' → str repr
        label = answer.get("label") or answer.get("value")
        if label is not None:
            return str(label)
        return ", ".join(f"{k}: {v}" for k, v in answer.items())
    return str(answer)


def _build_question_columns(questions: list) -> list:
    """Return ordered question column headers built from the current question set."""
    if not questions:
        return []
    ordered = sorted(questions, key=lambda q: q.get("order", 999))
    seen = set()
    cols = []
    for q in ordered:
        label = (q.get("question") or "").strip()
        if not label:
            continue
        if label in seen:
            continue
        seen.add(label)
        cols.append(label)
    return cols


def _get_or_create_discovery_calls_sheet(spreadsheet, questions: list):
    """Get or create the 'Discovery Calls' tab. If it exists, respect whatever
    headers are already there and append new question-columns at the end so
    existing admin rearrangements are preserved."""
    question_cols = _build_question_columns(questions or [])
    desired_headers = DISCOVERY_CALLS_BASE_HEADERS + question_cols

    try:
        sheet = spreadsheet.worksheet(DISCOVERY_CALLS_TAB_NAME)
        existing = sheet.row_values(1)
        if not existing:
            sheet.update(values=[desired_headers], range_name="A1")
            logger.info(f"Initialized headers for '{DISCOVERY_CALLS_TAB_NAME}' tab")
            return sheet, desired_headers

        # Keep existing order; append any missing question columns at the end so
        # past rows don't shift.
        missing = [h for h in desired_headers if h not in existing]
        if missing:
            combined = existing + missing
            # Make sure we have enough columns in the grid
            if len(combined) > sheet.col_count:
                sheet.add_cols(len(combined) - sheet.col_count)
            sheet.update(values=[combined], range_name="A1")
            logger.info(
                f"Extended headers for '{DISCOVERY_CALLS_TAB_NAME}' tab with: {missing}"
            )
            return sheet, combined
        return sheet, existing
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(
            title=DISCOVERY_CALLS_TAB_NAME,
            rows=2000,
            cols=max(len(desired_headers), 15),
        )
        sheet.update(values=[desired_headers], range_name="A1")
        logger.info(f"Created '{DISCOVERY_CALLS_TAB_NAME}' tab in Google Sheet")
        return sheet, desired_headers


def _build_discovery_call_answer_map(
    booking_record: dict, questions: list
) -> dict:
    """Map {question_label: answer_string} for the current question set.
    Missing answers render as empty strings."""
    answers = booking_record.get("answers") or {}
    out = {}
    for q in questions or []:
        qid = q.get("id") or str(q.get("_id", ""))
        label = (q.get("question") or "").strip()
        if not label:
            continue
        raw = answers.get(qid) if qid else None
        if raw is None and q.get("_id"):
            raw = answers.get(str(q.get("_id")))
        out[label] = _format_answer(raw)
    return out


def _format_booked_at(booking_record: dict) -> str:
    """Format created_at in IST for readability."""
    created = booking_record.get("created_at")
    if not created:
        return ""
    IST = timezone(timedelta(hours=5, minutes=30))
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except Exception:
            return created
    if isinstance(created, datetime):
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    return str(created)


def _append_discovery_call_sync(booking_record: dict, questions: list):
    """Synchronous: append a discovery-call booking row to the 'Discovery Calls' tab."""
    if not GOOGLE_SHEET_ID:
        logger.warning("GOOGLE_SHEET_ID not configured, skipping discovery call sheet sync")
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet, headers = _get_or_create_discovery_calls_sheet(spreadsheet, questions)

        qa_map = _build_discovery_call_answer_map(booking_record, questions)

        fixed = {
            "Booking ID": booking_record.get("id", ""),
            "Booked At (IST)": _format_booked_at(booking_record),
            "Status": booking_record.get("status", ""),
            "Scheduled Date (IST)": booking_record.get("scheduled_date", ""),
            "Scheduled Time (IST)": booking_record.get("scheduled_time", ""),
            "Meet Link": booking_record.get("meet_link") or "",
            "Name": booking_record.get("name", ""),
            "Email": booking_record.get("email", ""),
            "Phone": booking_record.get("phone") or "",
        }

        row = []
        for h in headers:
            if h in fixed:
                row.append(fixed[h])
            elif h in qa_map:
                row.append(qa_map[h])
            else:
                row.append("")

        sheet.append_row(row, value_input_option="RAW")
        logger.info(
            f"Discovery call {booking_record.get('id')} for "
            f"{booking_record.get('email', 'unknown')} added to Google Sheet"
        )
    except Exception as e:
        logger.error(f"Failed to append discovery call to Google Sheet: {e}")
        global _client
        _client = None


async def append_discovery_call_to_sheet(booking_record: dict, questions: list):
    """Async wrapper: fire-and-forget append of a discovery-call booking."""
    try:
        await asyncio.to_thread(_append_discovery_call_sync, booking_record, questions)
    except Exception as e:
        logger.error(f"Error in async discovery call sheet append: {e}")


def _update_discovery_call_status_sync(
    booking_id: str,
    status: str | None = None,
    meet_link: str | None = None,
    scheduled_date: str | None = None,
    scheduled_time: str | None = None,
):
    """Synchronous: update an existing discovery-call row by Booking ID."""
    if not GOOGLE_SHEET_ID or not booking_id:
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        try:
            sheet = spreadsheet.worksheet(DISCOVERY_CALLS_TAB_NAME)
        except gspread.exceptions.WorksheetNotFound:
            logger.info(
                "Discovery Calls tab not yet created; skipping status update for "
                f"{booking_id}"
            )
            return

        headers = sheet.row_values(1)
        if not headers:
            logger.info("Discovery Calls tab has no headers; skipping status update")
            return

        try:
            id_col_idx = headers.index("Booking ID")
        except ValueError:
            logger.warning("'Booking ID' column missing in Discovery Calls tab")
            return

        all_values = sheet.get_all_values()
        target_row_num = None
        for row_idx, row in enumerate(all_values):
            if row_idx == 0:
                continue
            if len(row) > id_col_idx and row[id_col_idx] == booking_id:
                target_row_num = row_idx + 1  # 1-based
                break

        if not target_row_num:
            logger.info(
                f"Booking {booking_id} not found in Discovery Calls sheet; "
                "skipping status update"
            )
            return

        updates = []
        field_to_value = {
            "Status": status,
            "Meet Link": meet_link,
            "Scheduled Date (IST)": scheduled_date,
            "Scheduled Time (IST)": scheduled_time,
        }
        for header_name, value in field_to_value.items():
            if value is None:
                continue
            try:
                col_idx = headers.index(header_name)
            except ValueError:
                continue
            # gspread expects A1 notation
            col_letter = gspread.utils.rowcol_to_a1(1, col_idx + 1)[0:-1]
            updates.append({
                "range": f"{col_letter}{target_row_num}",
                "values": [[value]],
            })

        if updates:
            sheet.batch_update(updates, value_input_option="RAW")
            logger.info(
                f"Updated Discovery Calls sheet for booking {booking_id}: "
                + ", ".join(f"{k}={v}" for k, v in field_to_value.items() if v is not None)
            )
    except Exception as e:
        logger.error(f"Failed to update discovery call status in Google Sheet: {e}")
        global _client
        _client = None


async def update_discovery_call_status_in_sheet(
    booking_id: str,
    status: str | None = None,
    meet_link: str | None = None,
    scheduled_date: str | None = None,
    scheduled_time: str | None = None,
):
    """Async wrapper: fire-and-forget update of an existing discovery-call row."""
    try:
        await asyncio.to_thread(
            _update_discovery_call_status_sync,
            booking_id,
            status,
            meet_link,
            scheduled_date,
            scheduled_time,
        )
    except Exception as e:
        logger.error(f"Error in async discovery call sheet status update: {e}")


# ─── Abandoned Cart Tab ───────────────────────────────────────────
ABANDONED_CART_TAB = "Abandoned Cart"
ABANDONED_CART_HEADERS = [
    "Name", "Email", "Phone", "UG College", "PG College",
    "Target Firms", "Prep Objective", "Prep Level", "Current Plan",
    "Sign-up Date & Time", "Plan Purchase Attempted", "Date Attempted",
    "Purchase Type",
]

# Allowed Purchase Type values (for filter consistency in Sheets)
PURCHASE_TYPE_SUBSCRIPTION = "Subscription"
PURCHASE_TYPE_COACHING = "Coaching"
PURCHASE_TYPE_TOPUP = "Top-up"
PURCHASE_TYPE_STRATEGY_CALL = "Strategy Call"


def _get_or_create_abandoned_cart_sheet(spreadsheet):
    """Get or create the 'Abandoned Cart' tab in the spreadsheet."""
    try:
        sheet = spreadsheet.worksheet(ABANDONED_CART_TAB)
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(
            title=ABANDONED_CART_TAB,
            rows=2000,
            cols=len(ABANDONED_CART_HEADERS),
        )
        logger.info(f"Created '{ABANDONED_CART_TAB}' tab in Google Sheet")

    try:
        first_row = sheet.row_values(1)
        if not first_row or first_row != ABANDONED_CART_HEADERS:
            sheet.update(values=[ABANDONED_CART_HEADERS], range_name='A1')
            logger.info(f"Headers set for '{ABANDONED_CART_TAB}' tab")
    except Exception as e:
        logger.error(f"Error setting abandoned cart headers: {e}")

    return sheet


def _format_user_signup_dt(user_data: dict) -> str:
    """Render user.created_at as IST string. Fallback to empty when missing."""
    IST = timezone(timedelta(hours=5, minutes=30))
    created_at = user_data.get("created_at", "")
    if isinstance(created_at, str) and created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            return dt.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
        except Exception:
            return created_at
    if isinstance(created_at, datetime):
        return created_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    return ""


def _build_abandoned_cart_row(user_data: dict, plan_data: dict) -> list:
    """Build a single Abandoned Cart row aligned to ABANDONED_CART_HEADERS."""
    IST = timezone(timedelta(hours=5, minutes=30))

    name = user_data.get("name", "")
    if not name:
        first = user_data.get("first_name", "")
        last = user_data.get("last_name", "")
        name = f"{first} {last}".strip()

    target_firms = user_data.get("target_firms", [])
    target_firms_str = ", ".join(target_firms) if isinstance(target_firms, list) else str(target_firms or "")

    prep_obj = user_data.get("prep_objective", "")
    prep_obj_label = PREP_OBJECTIVE_LABELS.get(prep_obj, prep_obj or "")
    if prep_obj == "other":
        prep_obj_label = user_data.get("other_objective", prep_obj)

    prep_level = user_data.get("preparation_level", "")
    prep_level_label = PREP_LEVEL_LABELS.get(prep_level, prep_level or "")

    attempted_at = plan_data.get("attempted_at")
    if isinstance(attempted_at, str) and attempted_at:
        try:
            dt = datetime.fromisoformat(attempted_at.replace("Z", "+00:00"))
            attempted_str = dt.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
        except Exception:
            attempted_str = attempted_at
    elif isinstance(attempted_at, datetime):
        attempted_str = attempted_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    else:
        attempted_str = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

    return [
        name,
        user_data.get("email", ""),
        user_data.get("phone_number", ""),
        user_data.get("ug_college", ""),
        user_data.get("pg_college", ""),
        target_firms_str,
        prep_obj_label,
        prep_level_label,
        user_data.get("plan", ""),
        _format_user_signup_dt(user_data),
        plan_data.get("plan_attempted_name", "") or plan_data.get("plan_attempted_key", ""),
        attempted_str,
        plan_data.get("plan_attempted_type", "") or PURCHASE_TYPE_SUBSCRIPTION,
    ]


def _find_email_row(sheet, email: str, headers: list) -> int | None:
    """Return 1-based row number for the given email in the sheet, or None."""
    if not email:
        return None
    try:
        all_values = sheet.get_all_values()
    except Exception as e:
        logger.error(f"Failed to read sheet to find email {email}: {e}")
        return None
    email_col_idx = headers.index("Email")
    for row_idx, row in enumerate(all_values):
        if row_idx == 0:
            continue
        if len(row) > email_col_idx and row[email_col_idx].lower() == email.lower():
            return row_idx + 1
    return None


def _upsert_abandoned_cart_sync(user_data: dict, plan_data: dict):
    """Append a new row to the Abandoned Cart tab for every checkout attempt.

    Behaviour: each abandoned purchase attempt creates its own row — even if
    the user already has prior abandoned attempts on file. This gives the
    business team a chronological log of every drop-off (coaching attempt,
    subscription attempt, top-up attempt etc.) per user.

    A row is removed only when the matching purchase TYPE is completed
    successfully — see ``_remove_abandoned_cart_sync``.
    """
    if not GOOGLE_SHEET_ID:
        logger.warning("GOOGLE_SHEET_ID not configured, skipping abandoned cart sync")
        return
    email = (user_data.get("email") or "").strip()
    if not email:
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet = _get_or_create_abandoned_cart_sheet(spreadsheet)

        row = _build_abandoned_cart_row(user_data, plan_data)
        sheet.append_row(row, value_input_option="RAW")
        logger.info(
            f"Abandoned Cart: appended row for {email} "
            f"(type={plan_data.get('plan_attempted_type', 'Subscription')}, "
            f"plan={plan_data.get('plan_attempted_name', '')})"
        )

    except Exception as e:
        logger.error(f"Failed to append abandoned cart row for {email}: {e}")
        global _client
        _client = None


def _remove_abandoned_cart_sync(email: str, purchase_type: str | None = None):
    """Remove abandoned-cart rows for a user.

    - When ``purchase_type`` is provided (the typical case), removes only the
      MOST RECENT row matching that email + Purchase Type combo. This way,
      completing a coaching purchase only clears the coaching row, leaving
      any pending subscription/top-up rows intact.
    - When ``purchase_type`` is None (or empty), behaves like the legacy
      single-row remove and only removes the most recent row for that email.
    """
    if not GOOGLE_SHEET_ID or not email:
        return

    try:
        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        try:
            sheet = spreadsheet.worksheet(ABANDONED_CART_TAB)
        except gspread.exceptions.WorksheetNotFound:
            return

        try:
            all_values = sheet.get_all_values()
        except Exception as e:
            logger.error(f"Failed to read sheet to remove email {email}: {e}")
            return

        if not all_values:
            return
        headers = all_values[0]
        try:
            email_col = headers.index("Email")
        except ValueError:
            return
        type_col = headers.index("Purchase Type") if "Purchase Type" in headers else None

        # Walk rows top → bottom, find ALL matches, delete the LAST one
        match_row_nums: list[int] = []
        for row_idx, row in enumerate(all_values):
            if row_idx == 0:
                continue
            if len(row) <= email_col:
                continue
            if row[email_col].strip().lower() != email.strip().lower():
                continue
            if purchase_type and type_col is not None:
                row_type = row[type_col] if len(row) > type_col else ""
                if row_type.strip().lower() != purchase_type.strip().lower():
                    continue
            match_row_nums.append(row_idx + 1)  # 1-based for sheet API

        if not match_row_nums:
            return
        target_row = match_row_nums[-1]
        sheet.delete_rows(target_row)
        logger.info(
            f"Abandoned Cart: removed row {target_row} for {email} "
            f"(type={purchase_type or 'any'}, total matches found={len(match_row_nums)})"
        )

    except Exception as e:
        logger.error(f"Failed to remove abandoned cart row for {email}: {e}")
        global _client
        _client = None


async def append_abandoned_cart_to_sheet(user_data: dict, plan_data: dict):
    """Async wrapper: record an abandoned subscription checkout attempt."""
    try:
        await asyncio.to_thread(_upsert_abandoned_cart_sync, user_data, plan_data)
    except Exception as e:
        logger.error(f"Error in async abandoned cart append: {e}")


async def remove_abandoned_cart_from_sheet(email: str, purchase_type: str | None = None):
    """Async wrapper: clear a user's matching abandoned-cart row on payment success.

    Pass ``purchase_type`` (e.g. ``"Subscription"``, ``"Coaching"``,
    ``"Top-up"``, ``"Strategy Call"``) so we only clear the row for the
    purchase the user just completed and leave their other pending abandons
    untouched.
    """
    try:
        await asyncio.to_thread(_remove_abandoned_cart_sync, email, purchase_type)
    except Exception as e:
        logger.error(f"Error in async abandoned cart remove: {e}")


async def sync_existing_users_to_sheet(db):
    """One-time sync of all existing users with completed onboarding to the sheet."""
    if not GOOGLE_SHEET_ID:
        logger.warning("GOOGLE_SHEET_ID not configured, skipping sync")
        return

    try:
        users = await db.users.find(
            {"onboarding_completed": True},
            {"_id": 0}
        ).sort("created_at", 1).to_list(10000)

        if not users:
            logger.info("No existing users to sync")
            return

        client = _get_client()
        spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
        sheet = spreadsheet.sheet1

        # Set headers
        _ensure_headers(sheet)

        # Check existing emails in sheet to avoid duplicates
        existing_emails = set()
        try:
            all_values = sheet.get_all_values()
            if len(all_values) > 1:
                email_col_idx = HEADERS.index("Email")
                for row in all_values[1:]:
                    if len(row) > email_col_idx and row[email_col_idx]:
                        existing_emails.add(row[email_col_idx].lower())
        except Exception:
            pass

        IST = timezone(timedelta(hours=5, minutes=30))
        rows_to_add = []

        for user in users:
            email = user.get("email", "")
            if email.lower() in existing_emails:
                continue

            created_at = user.get("created_at", "")
            if isinstance(created_at, str) and created_at:
                try:
                    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    signup_dt = dt.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
                except Exception:
                    signup_dt = created_at
            elif isinstance(created_at, datetime):
                signup_dt = created_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S IST")
            else:
                signup_dt = ""

            name = user.get("name", "")
            if not name:
                first = user.get("first_name", "")
                last = user.get("last_name", "")
                name = f"{first} {last}".strip()

            target_firms = user.get("target_firms", [])
            if isinstance(target_firms, list):
                target_firms_str = ", ".join(target_firms) if target_firms else ""
            else:
                target_firms_str = str(target_firms) if target_firms else ""

            prep_obj = user.get("prep_objective", "")
            prep_obj_label = PREP_OBJECTIVE_LABELS.get(prep_obj, prep_obj or "")
            if prep_obj == "other":
                prep_obj_label = user.get("other_objective", prep_obj)

            prep_level = user.get("preparation_level", "")
            prep_level_label = PREP_LEVEL_LABELS.get(prep_level, prep_level or "")

            rows_to_add.append([
                name,
                email,
                user.get("phone_number", ""),
                user.get("ug_college", ""),
                user.get("pg_college", ""),
                target_firms_str,
                prep_obj_label,
                prep_level_label,
                user.get("plan", ""),
                signup_dt,
                "",  # Upgrade
                "",  # Upgrade Date
            ])

        if rows_to_add:
            sheet.append_rows(rows_to_add, value_input_option="RAW")
            logger.info(f"Synced {len(rows_to_add)} existing users to Google Sheet")
        else:
            logger.info("All existing users already in Google Sheet")

    except Exception as e:
        logger.error(f"Failed to sync existing users to Google Sheet: {e}")
        global _client
        _client = None
