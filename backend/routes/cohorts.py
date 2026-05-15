"""
Cohort routes — GitHub-style public cohort program with weekly schedule,
discovery-call CTA, and Razorpay-backed enrolment that mirrors the
existing coaching-payment flow (same coupon/discount system).

Three router groups in one file:
  - public_router    : unauthenticated browsing + discovery-call submit
  - auth_router      : authenticated enrolment (create-order/verify) + dashboard listing
  - admin_router     : full CRUD for cohorts, sessions, enrollments,
                       and discovery-call requests

All admin routes are mounted under `/api/admin/cohorts*` and require
`is_admin=True`. Public + auth routes live under `/api/cohorts`.
"""
from __future__ import annotations

import os
import uuid
import logging
import hmac
import hashlib
import time as _time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Query, Response
from pydantic import BaseModel, EmailStr, Field

from routes.auth import get_current_user, get_db

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────
# In-memory cache for PUBLIC cohort endpoints.
#
# Why: /api/cohorts/featured + /api/cohorts/plans + /api/cohorts/by-slug
# are hit on every cohort-landing-page visit. Each call ran ~150ms against
# Mongo. Now they get served from RAM in ~1ms, freeing the DB for the
# enrolment / dashboard flows. Cache is wiped whenever an admin updates a
# cohort (see invalidate_public_cohorts_cache below).
# ────────────────────────────────────────────────────────────────────────
_PUBLIC_COHORT_CACHE: Dict[str, Dict[str, Any]] = {}
_PUBLIC_COHORT_TTL = 60  # seconds


def _pub_cache_get(key: str):
    entry = _PUBLIC_COHORT_CACHE.get(key)
    if entry and (_time.time() - entry["ts"]) < _PUBLIC_COHORT_TTL:
        return entry["data"]
    return None


def _pub_cache_set(key: str, data):
    _PUBLIC_COHORT_CACHE[key] = {"ts": _time.time(), "data": data}


def invalidate_public_cohorts_cache():
    """Wipe the public cohort cache. Call after any admin write that could
    affect the public landing page (cohort create / update / status flip /
    landing-mentor change / cohort landing settings toggle)."""
    _PUBLIC_COHORT_CACHE.clear()

# Razorpay client — reuse the same singleton the payments router uses.
try:
    import razorpay
    _RZP_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
    _RZP_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
    razorpay_client = (
        razorpay.Client(auth=(_RZP_KEY_ID, _RZP_KEY_SECRET))
        if _RZP_KEY_ID and _RZP_KEY_SECRET else None
    )
except Exception:  # noqa: BLE001
    razorpay_client = None

GST_RATE = 0.18  # GST is added on top of the displayed plan price at checkout.
DEFAULT_COHORT_PLAN_KEY = "cohort_premium"


# Built-in "Case Interview Sprint" landing content. Always served on the
# public /cohort page so the site visitor sees the full curriculum +
# pricing + highlights regardless of whether admin has published a cohort
# in the DB. The ONLY thing admin controls dynamically is whether
# enrolments are open — driven by `db.cohort_landing_settings.accept_enrolments`
# (see admin endpoint below). When admin publishes a real cohort with
# slug=case-interview-sprint, that DB record overrides this template.
DEFAULT_COHORT_TEMPLATE: Dict[str, Any] = {
    "id": "default-case-interview-sprint",
    "name": "Cohort 101",
    "slug": "case-interview-sprint",
    "tagline": "Elevate your consulting preparation",
    "description": (
        "A four-week, cohort-based program designed by ex-MBB consultants. "
        "We strip away the fluff of typical prep courses and focus on the "
        "three things that actually move the needle in consulting interviews: structured "
        "problem solving, clear communication, and reps under pressure."
    ),
    "duration_weeks": 4,
    "price": 25000.0,
    "currency": "INR",
    "plan_key": DEFAULT_COHORT_PLAN_KEY,
    "is_active": True,
    "is_featured": True,
    "seats_total": None,
    "seats_filled": 0,
    "cover_image_url": None,
    "start_date_label": "Starts 23 May 2026",
    "rating": 4.9,
    "rating_count": "2,000+",
    "hero_image_url": "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
    "audience_image_url": "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&w=1200&q=80",
    "description_image_url": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    "highlights": [
        "8 live sessions over 4 weekends (Sat & Sun, 6-8 PM IST)",
        "Live case examples solved end-to-end by ex-MBB consultants",
        "Cohort community + accountability with peer practice partners",
        "Recordings + transcripts available after every session",
        "Frameworks playbook + 50+ practice prompts included",
        "Q&A and personalised feedback on your case approach",
    ],
    "sessions": [
        {"week_number": 1, "topic": "Kick-off, Platform Introduction & Introduction to Consulting"},
        {"week_number": 1, "topic": "How to Approach Cases?"},
        {"week_number": 2, "topic": "Guesstimates + Live Case Example"},
        {"week_number": 2, "topic": "Profitability + Live Case Example"},
        {"week_number": 3, "topic": "Market Entry Cases + Live Case Example"},
        {"week_number": 3, "topic": "Pricing & Growth + Live Case Example"},
        {"week_number": 4, "topic": "M&A + Live Case Example"},
        {"week_number": 4, "topic": "Unconventional Cases + Live Case Example"},
    ],
    "learn_items": [
        {"title": "Case Interview Mastery", "body": "Crack profitability, market sizing, and market entry cases the way McKinsey, BCG and Bain expect.", "span": "lg:col-span-3", "accent": True},
        {"title": "Structured Problem Solving", "body": "MECE thinking, issue trees, and hypothesis-driven analysis applied to real business problems.", "span": "lg:col-span-3", "accent": False},
        {"title": "Mental Math & Estimation", "body": "Build the speed and accuracy that separates strong candidates from average ones.", "span": "lg:col-span-2", "accent": False},
        {"title": "Storyboarding with Slides", "body": "Communicate findings the consulting way — Pyramid Principle, lead-with-answer, exec-ready slides.", "span": "lg:col-span-2", "accent": False},
        {"title": "Client Communication", "body": "Email, stand-ups, and steer-co updates without sounding like a student.", "span": "lg:col-span-2", "accent": False},
        {"title": "Behavioural / Fit Round", "body": "Tell stories that signal leadership, drive, and impact — using the SCAR framework.", "span": "lg:col-span-3", "accent": False},
        {"title": "Networking & Referrals", "body": "How to actually get a callback from a partner — coffee chats, LinkedIn, and warm intros.", "span": "lg:col-span-3", "accent": False},
    ],
    "audience": [
        {"label": "Final-year students", "body": "Targeting consulting full-time roles at MBB, Big 4, and boutique firms."},
        {"label": "Early-career professionals", "body": "1–4 years of experience looking to break into strategy or transition from analyst roles."},
        {"label": "MBA aspirants & students", "body": "Preparing for summer internships or post-MBA consulting placements."},
        {"label": "Career switchers", "body": "Engineers, finance and product folks who want to move into management consulting."},
    ],
    "included_stats": [
        {"stat": "1 month", "label": "Cohort duration"},
        {"stat": "16+", "label": "Live sessions"},
        {"stat": "8+", "label": "Mock case interviews"},
        {"stat": "MBB", "label": "Mentors & coaches"},
        {"stat": "Cohort", "label": "Peer practice group"},
    ],
    "schedule_weeks": [
        {"week": "Week 1", "title": "Foundations", "items": [
            "Consulting industry overview & firm positioning",
            "Case interview anatomy & evaluation rubric",
            "MECE, issue trees & hypothesis-driven thinking",
        ]},
        {"week": "Week 2", "title": "Cracking Cases", "items": [
            "Profitability, market sizing & market entry frameworks",
            "Mental math drills & estimation under pressure",
            "Live case demos with MBB mentors",
        ]},
        {"week": "Week 3", "title": "Communication", "items": [
            "Pyramid Principle & exec-ready storytelling",
            "Slide-writing workshop with real consulting decks",
            "Behavioural / fit round prep using the SCAR method",
        ]},
        {"week": "Week 4", "title": "Game Time", "items": [
            "Full-length mock interviews with feedback",
            "Personalised resume & LinkedIn review",
            "Referral playbook + partner-level networking session",
        ]},
    ],
    "plans": [
        {
            "name": "Self-Paced", "price": "₹25,000", "cadence": "one-time",
            "blurb": "Recordings, frameworks & community access.",
            "features": ["All recorded live sessions", "Frameworks & case bank", "Private community access", "Email support"],
            "cta": "Apply for Self-Paced", "highlight": False, "badge": None,
        },
        {
            "name": "Cohort", "price": "₹25,000", "cadence": "one-time",
            "blurb": "Live cohort with mentors and mock interviews.",
            "features": ["All live cohort sessions", "8+ mock case interviews", "1:1 mentor feedback", "Resume & LinkedIn review", "Referral playbook"],
            "cta": "Apply for Cohort", "highlight": True, "badge": "Most Popular",
        },
        {
            "name": "Cohort + Coaching", "price": "₹25,000", "cadence": "one-time",
            "blurb": "Everything in Cohort plus 1:1 coaching from MBB consultants.",
            "features": ["Everything in Cohort plan", "5x 1:1 coaching sessions", "Personalised mock plan", "Direct partner referrals where possible", "Priority support"],
            "cta": "Apply for Coaching", "highlight": False, "badge": None,
        },
    ],
    "faqs": [
        {"q": "When does Cohort 101 start?", "a": "The cohort begins on 23rd May 2026 and runs for one month with a mix of live sessions, mock interviews, and async practice."},
        {"q": "Who teaches the program?", "a": "Sessions are led by ex-McKinsey, BCG and Bain consultants along with senior coaches who have placed candidates at top consulting firms."},
        {"q": "How much time should I commit each week?", "a": "Plan for roughly 6–8 hours a week: 3–4 hours of live sessions plus practice cases, mock interviews and assignments."},
    ],
}


async def _get_landing_accept_enrolments(db) -> bool:
    """Single global flag controlling the Enrol button on the static
    landing template. Admin toggles via the new admin endpoint
    `/admin/cohort-programs/landing-settings`. Defaults to True
    (enrolments open) when the doc doesn't exist."""
    doc = await db.cohort_landing_settings.find_one({"_id": "default"}, {"_id": 0})
    if not doc:
        return True
    return bool(doc.get("accept_enrolments", True))

public_router = APIRouter(prefix="/api/cohorts", tags=["cohorts-public"])
auth_router = APIRouter(prefix="/api/cohorts", tags=["cohorts-auth"])
admin_router = APIRouter(prefix="/api/admin/cohort-programs", tags=["cohort-programs-admin"])


async def verify_admin(request: Request):
    user = await get_current_user(request)
    user_dict = user if isinstance(user, dict) else (user.dict() if hasattr(user, "dict") else user)
    if not user_dict.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_dict


# ============= Models =============

class CohortSession(BaseModel):
    id: Optional[str] = None
    week_number: int
    day_label: Optional[str] = None  # "Saturday", "Sunday"
    date: Optional[str] = None  # YYYY-MM-DD (admin-only)
    time_slot: Optional[str] = None  # "6:00 PM - 8:00 PM"
    topic: str
    # Free-text label: "Live Session", "Mock Interview", "Workshop", "Q&A", etc.
    session_type: Optional[str] = None
    duration_minutes: int = 120
    mentor_id: Optional[str] = None
    meet_link: Optional[str] = None
    meet_space_name: Optional[str] = None
    recording_url: Optional[str] = None
    transcript_url: Optional[str] = None
    status: str = "scheduled"  # scheduled / completed / cancelled


class CohortPlan(BaseModel):
    """A single pricing tier shown in the Plans section of the cohort
    landing page. Admin can add/remove tiers and edit each tier's
    features (offerings) freely."""
    name: str
    price: Optional[str] = None  # display string e.g. "₹25,000" or "Custom"
    cadence: Optional[str] = None  # "one-time" / "monthly" / "billed yearly"
    blurb: Optional[str] = None
    features: List[str] = Field(default_factory=list)
    cta: Optional[str] = None
    highlight: bool = False  # render with prominent border / "Most popular" feel
    badge: Optional[str] = None  # small tag e.g. "Most Popular"


class Cohort(BaseModel):
    id: Optional[str] = None
    name: str
    slug: str  # URL-safe e.g. "case-interview-sprint-2026"
    tagline: Optional[str] = None
    description: Optional[str] = None
    duration_weeks: int = 4
    price: float = 25000.0  # rupees, charged as-is (no GST added on top)
    currency: str = "INR"
    plan_key: str = DEFAULT_COHORT_PLAN_KEY
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True       # available for enrolment
    is_featured: bool = True     # show on landing page nav/hero
    seats_total: Optional[int] = None
    seats_filled: int = 0
    cover_image_url: Optional[str] = None
    highlights: List[str] = Field(default_factory=list)  # bullet selling points
    sessions: List[CohortSession] = Field(default_factory=list)
    # Pricing tiers shown in the "Plans" section of the landing page.
    # When non-empty, these OVERRIDE the static template plans. Each plan
    # has its own price + features list (offerings) so admin can decide
    # what each tier includes.
    plans: List[CohortPlan] = Field(default_factory=list)
    # Ordered list of mentor IDs to render in the "Past mentors" carousel
    # on the public cohort landing page. Admin manages this list via the
    # Cohort Programs admin > Past Mentors tab. Empty list means the
    # frontend falls back to its global featured/top-rated logic.
    landing_mentor_ids: List[str] = Field(default_factory=list)


class CohortDiscoveryCallRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    cohort_id: Optional[str] = None
    cohort_slug: Optional[str] = None
    message: Optional[str] = None
    preferred_time: Optional[str] = None


class CohortApplicant(BaseModel):
    """Guest applicant info — required when the user isn't already
    logged in. After payment is verified we'll either:
      - find an existing user with this email and enrol them, OR
      - create a new account (random temp password) and enrol them.
    Either way they get a welcome + login email.
    """
    name: str
    email: EmailStr
    phone: Optional[str] = None
    background: Optional[str] = None


class CreateCohortOrderRequest(BaseModel):
    cohort_id: str
    plan_key: Optional[str] = None  # if provided, uses plan's price from Plans Management
    coupon_code: Optional[str] = None
    applicant: Optional[CohortApplicant] = None


class VerifyCohortPaymentRequest(BaseModel):
    cohort_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    applicant: Optional[CohortApplicant] = None


class ScheduleDiscoveryCallRequest(BaseModel):
    scheduled_at: str  # ISO datetime
    meet_link: Optional[str] = None
    notes: Optional[str] = None


# ============= Helpers =============

def _strip_id(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _public_cohort(cohort: dict) -> dict:
    """Strip the cohort doc to a shape safe for public/landing rendering.
    Sessions on the public landing carry ONLY week_number + topic — no
    specific dates, day labels, time slots, or duration. Exact session
    info (date, time, mentor, Meet link, recording) is surfaced ONLY on
    the candidate dashboard after the user has enrolled and paid.
    """
    if not cohort:
        return cohort
    sessions_public: List[Dict[str, Any]] = []
    for s in cohort.get("sessions") or []:
        sessions_public.append({
            "week_number": s.get("week_number"),
            "topic": s.get("topic"),
            "session_type": s.get("session_type") or None,
        })
    sessions_public.sort(key=lambda x: (x.get("week_number") or 0, x.get("topic") or ""))
    return {
        "id": cohort.get("id"),
        "name": cohort.get("name"),
        "slug": cohort.get("slug"),
        "tagline": cohort.get("tagline"),
        "description": cohort.get("description"),
        "duration_weeks": cohort.get("duration_weeks"),
        "price": cohort.get("price"),
        "price_with_gst": round(float(cohort.get("price") or 0) * (1 + GST_RATE), 2),
        "gst_amount": round(float(cohort.get("price") or 0) * GST_RATE, 2),
        "currency": cohort.get("currency", "INR"),
        "plan_key": cohort.get("plan_key", DEFAULT_COHORT_PLAN_KEY),
        "highlights": cohort.get("highlights") or [],
        "cover_image_url": cohort.get("cover_image_url"),
        "is_active": cohort.get("is_active", True),
        "is_featured": cohort.get("is_featured", True),
        "seats_total": cohort.get("seats_total"),
        "seats_filled": cohort.get("seats_filled", 0),
        "sessions": sessions_public,
        "session_count": len(sessions_public),
        # Rich landing-page sections — provided by template defaults
        # if admin hasn't customised; falls through transparently from
        # the DB if admin has set their own values.
        "start_date_label": cohort.get("start_date_label") or DEFAULT_COHORT_TEMPLATE["start_date_label"],
        "rating": cohort.get("rating") or DEFAULT_COHORT_TEMPLATE["rating"],
        "rating_count": cohort.get("rating_count") or DEFAULT_COHORT_TEMPLATE["rating_count"],
        "hero_image_url": cohort.get("hero_image_url") or DEFAULT_COHORT_TEMPLATE["hero_image_url"],
        "audience_image_url": cohort.get("audience_image_url") or DEFAULT_COHORT_TEMPLATE["audience_image_url"],
        "description_image_url": cohort.get("description_image_url") or DEFAULT_COHORT_TEMPLATE["description_image_url"],
        "learn_items": cohort.get("learn_items") or DEFAULT_COHORT_TEMPLATE["learn_items"],
        "audience": cohort.get("audience") or DEFAULT_COHORT_TEMPLATE["audience"],
        "included_stats": cohort.get("included_stats") or DEFAULT_COHORT_TEMPLATE["included_stats"],
        "schedule_weeks": cohort.get("schedule_weeks") or DEFAULT_COHORT_TEMPLATE["schedule_weeks"],
        "plans": cohort.get("plans") or DEFAULT_COHORT_TEMPLATE["plans"],
        "faqs": cohort.get("faqs") or DEFAULT_COHORT_TEMPLATE["faqs"],
        # Ordered list of mentor IDs surfaced on the cohort landing page's
        # "Past mentors" carousel. Public — clients use this to fetch the
        # corresponding mentor cards in the right order.
        "landing_mentor_ids": cohort.get("landing_mentor_ids") or [],
    }


def _build_ics_calendar(cohort: dict, sessions: list, user_email: str, user_name: str) -> str:
    """Build a single .ics calendar file containing one VEVENT per
    cohort session that has both a `date` and parseable `time_slot`.
    Sessions without firm dates are skipped — they get sent as a
    follow-up invite once admin schedules them.
    
    Returns the .ics file content as a string (always at least a valid
    VCALENDAR even if no sessions qualify, so the consumer can attach
    it without checking).
    """
    import re
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//gradnext//Cohort Enrolment//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    def _format_dt(dt_str: str) -> str:
        # "20260523T180000Z"
        return dt_str.replace("-", "").replace(":", "").split(".")[0]

    def _parse_time_slot(slot: str):
        """Best-effort parse of a free-text time_slot like '6:00 PM - 8:00 PM'
        or '18:00 - 20:00'. Returns (start_HHMM, end_HHMM) or None."""
        if not slot:
            return None
        m = re.match(
            r"\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?",
            slot,
            re.IGNORECASE,
        )
        if not m:
            return None
        sh, sm, sap, eh, em, eap = m.groups()
        sh, sm = int(sh), int(sm or 0)
        eh, em = int(eh), int(em or 0)
        if sap and sap.upper() == "PM" and sh < 12:
            sh += 12
        if sap and sap.upper() == "AM" and sh == 12:
            sh = 0
        if eap and eap.upper() == "PM" and eh < 12:
            eh += 12
        if eap and eap.upper() == "AM" and eh == 12:
            eh = 0
        if not eap and not sap and eh < sh:  # ambiguous — skip
            return None
        return (f"{sh:02d}{sm:02d}00", f"{eh:02d}{em:02d}00")

    valid_sessions = 0
    for s in sessions or []:
        date = s.get("date")
        slot = s.get("time_slot")
        if not date:
            continue
        parsed = _parse_time_slot(slot or "")
        if not parsed:
            continue
        start_hm, end_hm = parsed
        # Treat all times as Asia/Kolkata → convert to UTC by subtracting 5:30
        # (simple math good enough for an invite; users' clients will display
        # in local time anyway).
        try:
            local_start = datetime.strptime(f"{date}T{start_hm[:2]}:{start_hm[2:4]}:00", "%Y-%m-%dT%H:%M:%S")
            local_end = datetime.strptime(f"{date}T{end_hm[:2]}:{end_hm[2:4]}:00", "%Y-%m-%dT%H:%M:%S")
        except Exception:  # noqa: BLE001
            continue
        utc_start = local_start - timedelta(hours=5, minutes=30)
        utc_end = local_end - timedelta(hours=5, minutes=30)
        uid = f"cohort-{cohort.get('id')}-w{s.get('week_number')}-{s.get('id') or valid_sessions}@gradnext.co"
        summary = f"gradnext: {s.get('topic')}"
        description_text = (
            f"Week {s.get('week_number')} session of {cohort.get('name')}.\\n"
            f"{s.get('topic')}\\n\\n"
            f"Join link will be shared on the gradnext dashboard before the session."
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART:{_format_dt(utc_start.strftime('%Y%m%dT%H%M%SZ'))}",
            f"DTEND:{_format_dt(utc_end.strftime('%Y%m%dT%H%M%SZ'))}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description_text}",
            "ORGANIZER;CN=gradnext:mailto:info@gradnext.co",
            f"ATTENDEE;CN={user_name};RSVP=TRUE:mailto:{user_email}",
            "STATUS:CONFIRMED",
            "TRANSP:OPAQUE",
            "END:VEVENT",
        ]
        valid_sessions += 1

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines), valid_sessions


def _build_cohort_welcome_html(cohort: dict, user_name: str, sessions: list) -> str:
    name = cohort.get("name") or "your cohort"
    duration = cohort.get("duration_weeks") or 0
    tagline = cohort.get("tagline") or ""
    rows = []
    for s in sorted(sessions or [], key=lambda x: ((x.get("week_number") or 0), (x.get("date") or ""), (x.get("time_slot") or ""))):
        when_bits = []
        if s.get("date"):
            when_bits.append(s["date"])
        if s.get("day_label"):
            when_bits.append(s["day_label"])
        if s.get("time_slot"):
            when_bits.append(s["time_slot"])
        when = " · ".join(when_bits) if when_bits else "Schedule TBD"
        rows.append(f"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#475569;">Week {s.get('week_number') or '–'}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">{s.get('topic') or ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b;">{when}</td>
            </tr>
        """)
    table = "".join(rows) or '<tr><td colspan="3" style="padding:12px;color:#64748b;font-size:13px;">Your session schedule will appear here as soon as we lock the dates.</td></tr>'
    return f"""
    <!DOCTYPE html>
    <html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 8px 0;">Welcome to {name} 🎉</h2>
      <p style="color:#64748b;margin:0 0 20px 0;">{tagline}</p>
      <p>Hey {user_name},</p>
      <p>You're officially in. Over the next {duration} weeks we'll be covering everything you need to crack a consulting case interview, live, with real cases, alongside other ambitious candidates.</p>

      <h3 style="margin-top:28px;font-size:16px;">Your session schedule</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Week</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Topic</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">When</th>
          </tr>
        </thead>
        <tbody>{table}</tbody>
      </table>

      <p style="margin-top:24px;">A calendar invite (.ics) for any sessions that already have firm dates is attached to this email. As soon as we lock the remaining dates, you'll get follow-up invites.</p>
      <p>You can also see your full session list any time at <a href="https://app.gradnext.co/dashboard/cohort" style="color:#7c3aed;">your cohort dashboard</a>. Each session's Google Meet link will appear there closer to the session time.</p>

      <p style="margin-top:32px;">See you in week 1,<br/><strong>Team gradnext</strong></p>
    </body></html>
    """


async def _send_cohort_welcome_email(cohort: dict, user_name: str, user_email: str, sessions: list):
    """Best-effort welcome email + ICS attachment. Failures are
    logged and never break the enrolment response."""
    try:
        from services.email_service import send_email
        ics_content, ics_event_count = _build_ics_calendar(cohort, sessions, user_email, user_name)
        html = _build_cohort_welcome_html(cohort, user_name, sessions)
        subject = f"Welcome to {cohort.get('name') or 'your cohort'} - You're enrolled!"
        # send_email accepts a single HTML payload; we pass the .ics as
        # a Resend attachment when available. If the underlying send_email
        # signature doesn't accept attachments, fall back to a sentence in
        # the body that the schedule is on the dashboard.
        attachments = [{
            "filename": "cohort-sessions.ics",
            "content": ics_content,
        }] if ics_event_count > 0 else None
        try:
            # Attempt with attachments kw — supported by Resend path.
            await send_email(
                user_email, subject, html,
                sender_name="Team gradnext",
                attachments=attachments,
            )
        except TypeError:
            # send_email doesn't support attachments yet — send the email
            # without the .ics so the welcome message still goes out.
            await send_email(user_email, subject, html, sender_name="Team gradnext")
        logger.info(f"Sent cohort welcome email to {user_email} (cohort={cohort.get('slug')}, ics_events={ics_event_count})")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Cohort welcome email failed for {user_email} (non-fatal): {e}")


# ============= Public routes =============

def _project_cohort_plan_offerings(features: dict) -> List[str]:
    """Convert a structured Plans-Management features dict into a list of
    human-readable bullet points for the cohort landing page. Mirrors how
    Subscription/Coaching plans surface their offerings on the marketing
    pages.

    Empty/`none`/0 features are skipped so the bullet list stays clean.
    """
    if not isinstance(features, dict):
        return []
    bullets: List[str] = []

    coaching = features.get("coaching_sessions")
    if isinstance(coaching, (int, float)) and coaching:
        bullets.append("Unlimited 1:1 coaching sessions" if coaching == -1 else f"{int(coaching)} 1:1 coaching session{'s' if coaching != 1 else ''}")

    strategy = features.get("strategy_calls")
    if isinstance(strategy, (int, float)) and strategy:
        bullets.append("Unlimited strategy calls" if strategy == -1 else f"{int(strategy)} strategy call{'s' if strategy != 1 else ''}")

    peer = features.get("peer_sessions_per_month")
    if isinstance(peer, (int, float)) and peer:
        if peer == -1:
            bullets.append("Unlimited peer practice sessions / month")
        else:
            bullets.append(f"{int(peer)} peer practice sessions / month")
    elif features.get("peer_to_peer") and features.get("peer_to_peer") != "none":
        bullets.append("Peer practice sessions included")

    workshops = features.get("workshops")
    if workshops == "recorded_and_live":
        bullets.append("Live + recorded workshops access")
    elif workshops == "only_recorded":
        bullets.append("Recorded workshops access")

    if features.get("course_recordings"):
        bullets.append("Full course recordings library")
    elif features.get("course_recordings_limited"):
        bullets.append("Limited course recordings access")

    if features.get("drills_exercises"):
        bullets.append("All drills & practice exercises")
    elif features.get("drills_limited"):
        bullets.append("Limited drills access")

    if features.get("case_materials"):
        bullets.append("Full case interview materials")
    elif features.get("case_materials_limited"):
        bullets.append("Limited case materials")

    if features.get("dedicated_coach"):
        bullets.append("Dedicated coach assigned")

    return bullets


# Default plan-card features that ALWAYS appear at the top of every cohort
# plan's bullet list. Admin-managed features (display_features[] or auto-
# projected from the structured features dict) are appended below these,
# deduped. Empty admin config => only these three render on every plan.
COHORT_DEFAULT_PLAN_FEATURES: List[str] = [
    "20+ Hours of Live Sessions",
    "15+ Live Cases",
    "1:1 Practice Sessions with Global Peers",
]


def _merge_with_default_features(*lists: List[str]) -> List[str]:
    """Prepend `COHORT_DEFAULT_PLAN_FEATURES` to the supplied bullet lists,
    flattening + de-duplicating while preserving order. Whitespace and
    case-insensitive comparisons are used to dedupe so an admin entering
    "20+ hours of live sessions" doesn't double up with the canonical
    default."""
    seen: set = set()
    out: List[str] = []
    for source in (COHORT_DEFAULT_PLAN_FEATURES, *lists):
        for item in source or []:
            if not isinstance(item, str):
                continue
            text = item.strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(text)
    return out


@public_router.get("/plans")
async def get_public_cohort_plans(request: Request):
    """Return all active cohort plans (managed via Plans Management) with
    their structured offerings projected into human-readable bullets so
    the cohort landing page can render them like Subscription/Coaching
    pricing tiles.
    """
    cached = _pub_cache_get("plans")
    if cached is not None:
        return cached

    db = get_db(request)
    plans = await db.plans.find(
        {"category": "cohort", "is_active": True},
        {"_id": 0},
    ).sort("order", 1).to_list(50)

    out = []
    for p in plans:
        features = p.get("features") or {}
        display_features = [
            str(s).strip()
            for s in (p.get("display_features") or [])
            if isinstance(s, str) and str(s).strip()
        ]
        auto_offerings = _project_cohort_plan_offerings(features)
        admin_bullets = display_features if display_features else auto_offerings
        offerings = _merge_with_default_features(admin_bullets)
        pricing_obj = p.get("pricing") or {}
        price_one_time = pricing_obj.get("one_time") or p.get("price_inr")
        out.append({
            "id": p.get("id"),
            "plan_key": p.get("plan_key"),
            "name": p.get("name"),
            "description": p.get("description") or p.get("blurb"),
            "price": price_one_time,
            "price_inr": price_one_time,
            "billing_cycle": p.get("billing_cycle") or "one_time",
            "is_featured": bool(p.get("is_featured") or p.get("highlight")),
            "badge": p.get("badge"),
            "order": p.get("order", 0),
            "features": features,
            "offerings": offerings,
            "display_features": display_features,
        })
    result = {"plans": out}
    _pub_cache_set("plans", result)
    return result


@public_router.get("/featured")
async def get_featured_cohorts(request: Request):
    """Always returns at least one cohort. If admin has published a real
    cohort in the DB, that wins. Otherwise the built-in static
    `Case Interview Sprint` template is served — its `is_active` flag is
    overridden by the global `cohort_landing_settings.accept_enrolments`
    toggle so admin can open/close enrolments without touching content."""
    cached = _pub_cache_get("featured")
    if cached is not None:
        return cached

    db = get_db(request)
    cohorts = await db.cohorts.find(
        {"is_featured": True},
        {"_id": 0},
    ).sort([("created_at", -1)]).to_list(50)
    if not cohorts:
        accept = await _get_landing_accept_enrolments(db)
        template = {**DEFAULT_COHORT_TEMPLATE, "is_active": accept}
        result = {"cohorts": [_public_cohort(template)]}
    else:
        result = {"cohorts": [_public_cohort(c) for c in cohorts]}
    _pub_cache_set("featured", result)
    return result


@public_router.get("/by-slug/{slug}")
async def get_cohort_by_slug(slug: str, request: Request):
    """Public cohort detail by slug. Falls back to the static template
    when slug matches and no DB record exists yet."""
    cache_key = f"by-slug:{slug}"
    cached = _pub_cache_get(cache_key)
    if cached is not None:
        return cached

    db = get_db(request)
    cohort = await db.cohorts.find_one({"slug": slug, "is_featured": True}, {"_id": 0})
    if not cohort:
        if slug == DEFAULT_COHORT_TEMPLATE["slug"]:
            accept = await _get_landing_accept_enrolments(db)
            template = {**DEFAULT_COHORT_TEMPLATE, "is_active": accept}
            result = {"cohort": _public_cohort(template)}
            _pub_cache_set(cache_key, result)
            return result
        raise HTTPException(status_code=404, detail="Cohort not found")
    result = {"cohort": _public_cohort(cohort)}
    _pub_cache_set(cache_key, result)
    return result


@public_router.get("/{cohort_id}/landing-mentors")
async def get_cohort_landing_mentors(cohort_id: str, request: Request):
    """Public — returns the cohort's "Past mentors" carousel content.

    Resolves the admin-curated `landing_mentor_ids[]` array on the cohort
    document into a list of mentor cards in the configured order. Mentors
    that have been hidden or deleted in the mentor directory are silently
    skipped so a stale cohort lineup never shows broken cards.

    Returns `{ "mentors": [...] }`. Empty list means the admin hasn't
    configured a lineup yet — the frontend then falls back to its global
    featured/top-rated logic.
    """
    db = get_db(request)
    cohort = await db.cohorts.find_one(
        {"id": cohort_id},
        {"_id": 0, "landing_mentor_ids": 1},
    )
    ids = (cohort or {}).get("landing_mentor_ids") or []
    if not ids:
        return {"mentors": []}

    # Fetch all referenced mentors in a single query, then re-order
    # client-side to honour the admin's ordering (Mongo's $in doesn't
    # preserve list order).
    cursor = db.mentors.find(
        {
            "id": {"$in": ids},
            "is_hidden": {"$ne": True},
            "is_deleted": {"$ne": True},
        },
        {
            "_id": 0,
            "profile_picture": 0,
            "availability": 0,
            "bio": 0,
            "email": 0,
            "phone": 0,
            "linkedin": 0,
            "expertise": 0,
            "consulting_firm_logo": 0,
            "current_company_logo": 0,
            "blocked_days": 0,
        },
    )
    fetched = await cursor.to_list(200)
    by_id = {m["id"]: m for m in fetched if m.get("id")}
    ordered = [by_id[i] for i in ids if i in by_id]
    return {"mentors": ordered}


@public_router.post("/discovery-call")
async def submit_cohort_discovery_call(body: CohortDiscoveryCallRequest, request: Request):
    """Public endpoint — anyone (logged in or not) can request a discovery
    call for a cohort. Admin schedules it later from the admin panel."""
    db = get_db(request)
    cohort: Optional[dict] = None
    if body.cohort_id:
        cohort = await db.cohorts.find_one({"id": body.cohort_id}, {"_id": 0})
    if not cohort and body.cohort_slug:
        cohort = await db.cohorts.find_one({"slug": body.cohort_slug}, {"_id": 0})
    record = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "cohort_id": cohort.get("id") if cohort else body.cohort_id,
        "cohort_name": cohort.get("name") if cohort else None,
        "cohort_slug": cohort.get("slug") if cohort else body.cohort_slug,
        "message": body.message,
        "preferred_time": body.preferred_time,
        "status": "pending",  # pending / scheduled / completed / cancelled
        "scheduled_at": None,
        "meet_link": None,
        "admin_notes": None,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cohort_discovery_calls.insert_one(record)
    logger.info(f"Cohort discovery call request from {body.email} for cohort {record['cohort_slug']}")
    return {"success": True, "request_id": record["id"]}


# ============= Enrolment (guest-friendly) =============
# These endpoints accept BOTH logged-in users (session cookie) AND
# anonymous guests (require an `applicant` block in the body). After the
# payment is verified, guest applicants are auto-onboarded: an account is
# created (or an existing one matched by email is reused), the cohort
# enrolment is recorded, and an auth/session token is returned so the
# frontend can immediately drop them into the dashboard.

@public_router.post("/enrol/create-order")
async def create_cohort_order(body: CreateCohortOrderRequest, request: Request):
    """Create a Razorpay order for cohort enrolment. Mirrors the coaching
    create-order flow — supports an optional coupon code, applies 18% GST
    on the discounted price, and writes a `payment_orders` doc so the
    Sales dashboard picks it up automatically.
    """
    try:
        return await _create_cohort_order_impl(body, request)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Catch-all so we never return a malformed response (which causes
        # Cloudflare 520 in front of the production deployment). Surface
        # the error message in the JSON response so admins can diagnose.
        logger.exception(f"Cohort create-order unhandled error for cohort_id={getattr(body, 'cohort_id', None)}")
        raise HTTPException(
            status_code=500,
            detail=f"Could not create payment order: {type(e).__name__}: {str(e)[:200]}",
        )


async def _create_cohort_order_impl(body: CreateCohortOrderRequest, request: Request):
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    db = get_db(request)

    # Try to identify the user — prefer logged-in session, fall back to
    # the applicant block in the body. This makes the flow guest-friendly:
    # users can pay before signing in, and we'll onboard them after the
    # payment is verified.
    try:
        user = await get_current_user(request)
        user_dict = user if isinstance(user, dict) else (user.dict() if hasattr(user, "dict") else user)
    except HTTPException:
        user_dict = None

    if not user_dict:
        if not body.applicant or not body.applicant.email:
            raise HTTPException(
                status_code=400,
                detail="Please share your name, email and phone to enrol.",
            )
        # If there's already a user with this email, reference their id
        # so the enrolment naturally attaches to their account post-pay.
        existing_user = await db.users.find_one(
            {"email": body.applicant.email.lower()},
            {"_id": 0, "id": 1, "email": 1, "name": 1},
        )
        if existing_user:
            user_dict = existing_user
        else:
            # Stub user dict — the real account will be created in /verify
            user_dict = {
                "id": None,
                "email": body.applicant.email.lower(),
                "name": body.applicant.name,
            }

    cohort = await db.cohorts.find_one({"id": body.cohort_id}, {"_id": 0})
    if not cohort:
        # Fall back to the built-in static template so the default /cohort
        # landing page can process payments even before admin publishes a
        # real cohort record in the database.
        if body.cohort_id == DEFAULT_COHORT_TEMPLATE["id"]:
            accept = await _get_landing_accept_enrolments(db)
            cohort = {**DEFAULT_COHORT_TEMPLATE, "is_active": accept}
            logger.info("create-order: using DEFAULT_COHORT_TEMPLATE fallback for cohort_id=%s", body.cohort_id)
        else:
            raise HTTPException(status_code=404, detail="Cohort not found")
    if not cohort.get("is_active"):
        raise HTTPException(status_code=400, detail="Enrolments are currently closed for this cohort")

    # Already enrolled? — friendly 409 instead of duplicate order.
    if user_dict.get("id"):
        existing = await db.cohort_enrollments.find_one(
            {"user_id": user_dict["id"], "cohort_id": cohort["id"], "status": "active"},
            {"_id": 0, "id": 1},
        )
        if existing:
            raise HTTPException(status_code=409, detail="You are already enrolled in this cohort")

    base_price = float(cohort.get("price") or 0)

    # If caller specified a plan_key (user selected a specific plan tier),
    # look up that plan's one_time price and use it instead of the cohort default.
    effective_plan_key = body.plan_key or cohort.get("plan_key", DEFAULT_COHORT_PLAN_KEY)
    if body.plan_key:
        plan_doc = await db.plans.find_one(
            {"plan_key": body.plan_key, "category": "cohort", "is_active": True},
            {"_id": 0, "pricing": 1, "price_inr": 1, "name": 1},
        )
        if plan_doc:
            pricing_obj = plan_doc.get("pricing") or {}
            plan_price = pricing_obj.get("one_time") or plan_doc.get("price_inr")
            if plan_price and float(plan_price) > 0:
                base_price = float(plan_price)

    if base_price <= 0:
        raise HTTPException(status_code=400, detail="Cohort price not configured")

    # Coupon resolution — looks up by code and validates is_active +
    # applicability for "cohort" / its plan_key. Reuses the discounts
    # collection so the same coupons admin already manages work here.
    total_discount = 0.0
    applied_discounts: List[Dict[str, Any]] = []
    coupon_code = (body.coupon_code or "").strip().upper() or None
    if coupon_code:
        coupon = await db.discounts.find_one({"code": coupon_code, "is_active": True}, {"_id": 0})
        if not coupon:
            raise HTTPException(status_code=400, detail=f"Invalid or inactive coupon: {coupon_code}")
        # Coupon must explicitly apply to "cohort" OR be a legacy coupon
        # that only has coaching/subscription values (we still honor those
        # so existing coupons keep working until the admin updates them).
        applies_to = coupon.get("applies_to") or []
        cohort_value = coupon.get("cohort_discount_value")
        legacy_coaching = coupon.get("coaching_discount_value")
        legacy_subscription = coupon.get("subscription_discount_value")
        if applies_to and "cohort" not in applies_to and not cohort_value:
            raise HTTPException(
                status_code=400,
                detail=f"Coupon '{coupon_code}' is not valid for cohort programs",
            )
        # Pick the applicable discount value
        discount_value = (
            cohort_value
            or (legacy_coaching if "coaching" in applies_to or not applies_to else None)
            or (legacy_subscription if "subscription" in applies_to or not applies_to else None)
            or 0
        )
        if discount_value:
            if coupon.get("discount_type") == "percentage":
                total_discount = base_price * (float(discount_value) / 100)
            else:
                total_discount = min(float(discount_value), base_price)
            applied_discounts.append({
                "discount_id": coupon.get("id"),
                "discount_code": coupon.get("code"),
                "discount_name": coupon.get("name"),
                "discount_type": "coupon",
                "amount": total_discount,
            })

    discounted_price = max(0.0, base_price - total_discount)
    gst = round(discounted_price * GST_RATE, 2)
    total_amount = round(discounted_price + gst, 2)
    amount_in_paise = int(round(total_amount * 100))

    try:
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": cohort.get("currency", "INR"),
            "payment_capture": 1,
            "notes": {
                "purpose": "cohort_enrolment",
                "cohort_id": cohort["id"],
                "cohort_slug": cohort.get("slug"),
                "user_id": user_dict.get("id", ""),
                "user_email": user_dict.get("email", ""),
                "plan_key": effective_plan_key,
                "base_amount": base_price,
                "discount_amount": total_discount,
                "gst": gst,
                "total_amount": total_amount,
            },
        })
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Razorpay order create failed for cohort {cohort['id']}")
        raise HTTPException(status_code=502, detail=f"Razorpay error: {e}")

    order_doc = {
        "id": str(uuid.uuid4()),
        "razorpay_order_id": razorpay_order["id"],
        "user_id": user_dict.get("id"),
        "user_email": user_dict.get("email"),
        "user_name": user_dict.get("name"),
        # Persist guest applicant info so /verify can onboard them even
        # if they refresh the page between create-order and verify.
        "applicant": body.applicant.dict() if body.applicant else None,
        "is_guest_payment": user_dict.get("id") is None,
        "type": "cohort_enrolment",
        "cohort_id": cohort["id"],
        "cohort_slug": cohort.get("slug"),
        "cohort_name": cohort.get("name"),
        "plan_key": effective_plan_key,
        "plan_name": cohort.get("name"),
        "billing_cycle": "one_time",
        "base_amount": base_price,
        "discount_amount": total_discount,
        "applied_discounts": applied_discounts,
        "discounted_price": discounted_price,
        "gst": gst,
        "amount": total_amount,
        "amount_in_paise": amount_in_paise,
        "currency": cohort.get("currency", "INR"),
        "coupon_code": coupon_code,
        "status": "created",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_orders.insert_one(order_doc)

    return {
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id": _RZP_KEY_ID,
        "amount": total_amount,
        "amount_in_paise": amount_in_paise,
        "currency": cohort.get("currency", "INR"),
        "base_amount": base_price,
        "discount_amount": total_discount,
        "discounted_price": discounted_price,
        "gst": gst,
        "applied_discounts": applied_discounts,
        "cohort": {"id": cohort["id"], "name": cohort.get("name"), "slug": cohort.get("slug")},
        "user_email": user_dict.get("email"),
        "user_name": user_dict.get("name"),
    }


@public_router.post("/enrol/verify")
async def verify_cohort_payment(body: VerifyCohortPaymentRequest, request: Request, response: Response):
    """Verify Razorpay signature → mark order paid → create cohort_enrollments
    record → bump cohort.seats_filled. Idempotent: re-verifying the same
    payment returns success without creating duplicate enrollments.

    GUEST onboarding: if the order was created by an unauthenticated
    visitor (is_guest_payment=True), this endpoint will:
      1. Find or create a user account for the applicant's email,
      2. Set the cohort enrolment under that user_id,
      3. Issue a JWT session cookie so the user is auto-logged-in,
      4. Email them a welcome + login link (best-effort).
    The frontend can then redirect them straight into the dashboard.
    """
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    db = get_db(request)

    # Resolve user — prefer session, fall back to applicant
    try:
        user = await get_current_user(request)
        user_dict = user if isinstance(user, dict) else (user.dict() if hasattr(user, "dict") else user)
    except HTTPException:
        user_dict = None

    # Verify signature
    message = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected_sig = hmac.new(_RZP_KEY_SECRET.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, body.razorpay_signature):
        # As a fallback verify by fetching payment status
        try:
            pay = razorpay_client.payment.fetch(body.razorpay_payment_id)
            if not (pay.get("status") in ("captured", "authorized") and pay.get("order_id") == body.razorpay_order_id):
                raise HTTPException(status_code=400, detail="Payment signature mismatch")
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Payment signature mismatch")

    order = await db.payment_orders.find_one(
        {"razorpay_order_id": body.razorpay_order_id, "type": "cohort_enrolment"},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Auto-onboard for guest payments: ensure a user record exists for the
    # applicant email, then attach the enrolment to that user.
    auto_login_token = None  # JWT to set as cookie if we just created the user
    if not user_dict:
        applicant_data = (body.applicant.dict() if body.applicant else None) or order.get("applicant") or {}
        email = (applicant_data.get("email") or order.get("user_email") or "").lower().strip()
        name = applicant_data.get("name") or order.get("user_name") or "Cohort Member"
        phone = applicant_data.get("phone")
        if not email:
            raise HTTPException(status_code=400, detail="Applicant email missing — cannot complete onboarding")

        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        if existing_user:
            user_dict = existing_user
        else:
            # Create a fresh account. We DON'T set a password — the user
            # will set one via the welcome email magic link. Until then
            # they're auto-logged-in via the cookie we set below.
            from routes.auth import hash_password as _hash, create_jwt_token as _make_jwt
            random_pwd = uuid.uuid4().hex
            new_user = {
                "id": f"user_{uuid.uuid4().hex[:12]}",
                "email": email,
                "name": name,
                "phone": phone,
                "password_hash": _hash(random_pwd),
                "picture": None,
                "role": "candidate",
                "plan": "free_trial",
                "plan_start_date": datetime.now(timezone.utc).isoformat(),
                "plan_end_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "coaching_sessions_total": 0,
                "coaching_sessions_used": 0,
                "is_mentor": False,
                "is_admin": False,
                "timezone": "Asia/Kolkata",
                "onboarded_via": "cohort_payment",
                "needs_password_setup": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(new_user)
            user_dict = new_user
            auto_login_token = _make_jwt(new_user["id"])
        # Ensure the order references this user_id going forward
        await db.payment_orders.update_one(
            {"razorpay_order_id": body.razorpay_order_id},
            {"$set": {"user_id": user_dict["id"], "user_email": user_dict["email"], "user_name": user_dict.get("name")}},
        )
    else:
        # Authenticated user — order must belong to them
        if order.get("user_id") and order.get("user_id") != user_dict.get("id"):
            raise HTTPException(status_code=403, detail="Order belongs to another user")

    cohort = await db.cohorts.find_one({"id": body.cohort_id}, {"_id": 0})
    _cohort_is_template = False
    if not cohort:
        # Fall back to the built-in static template so we can complete
        # payments for the default /cohort landing page before admin
        # publishes a real cohort record in the database.
        if body.cohort_id == DEFAULT_COHORT_TEMPLATE["id"]:
            cohort = {**DEFAULT_COHORT_TEMPLATE}
            _cohort_is_template = True
            logger.info("verify: using DEFAULT_COHORT_TEMPLATE fallback for cohort_id=%s", body.cohort_id)
        else:
            raise HTTPException(status_code=404, detail="Cohort not found")

    # Idempotency — if an active enrolment for this user+cohort already
    # exists with this razorpay_order_id, just return success.
    existing = await db.cohort_enrollments.find_one(
        {"user_id": user_dict.get("id"), "cohort_id": cohort["id"]},
        {"_id": 0},
    )
    if existing and existing.get("status") == "active":
        return {"success": True, "enrollment_id": existing["id"], "already_enrolled": True}

    now = datetime.now(timezone.utc).isoformat()

    # Mark order paid
    await db.payment_orders.update_one(
        {"razorpay_order_id": body.razorpay_order_id},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": body.razorpay_payment_id,
            "paid_at": now,
            "updated_at": now,
        }},
    )

    enrollment = {
        "id": str(uuid.uuid4()),
        "user_id": user_dict.get("id"),
        "user_email": user_dict.get("email"),
        "user_name": user_dict.get("name"),
        "cohort_id": cohort["id"],
        "cohort_slug": cohort.get("slug"),
        "cohort_name": cohort.get("name"),
        # Use plan_key from the payment order (set during create-order from user's
        # plan selection). Fall back to cohort default only if not present.
        "plan_key": order.get("plan_key") or cohort.get("plan_key", DEFAULT_COHORT_PLAN_KEY),
        "razorpay_order_id": body.razorpay_order_id,
        "razorpay_payment_id": body.razorpay_payment_id,
        "amount_paid": order.get("amount"),
        "base_amount": order.get("base_amount"),
        "discount_amount": order.get("discount_amount"),
        "coupon_code": order.get("coupon_code"),
        "applied_discounts": order.get("applied_discounts"),
        "gst": order.get("gst"),
        "currency": order.get("currency", "INR"),
        "status": "active",
        "enrolled_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await db.cohort_enrollments.insert_one(enrollment)
    # Only increment seats_filled on real DB cohorts (not the static template)
    if not _cohort_is_template:
        await db.cohorts.update_one(
            {"id": cohort["id"]},
            {"$inc": {"seats_filled": 1}, "$set": {"updated_at": now}},
        )
    # Grant the user access to the cohort by updating their plan.
    # This ensures access.cohort=true in the dashboard so the Cohort tab is visible.
    enrolled_plan_key = enrollment.get("plan_key") or DEFAULT_COHORT_PLAN_KEY
    await db.users.update_one(
        {"id": user_dict["id"]},
        {"$set": {"plan": enrolled_plan_key, "updated_at": now}},
    )

    # ── Assign plan credits (coaching sessions + strategy calls) ──────────────
    # Look up the DB plan to get the feature counts promised by this tier.
    plan_doc = await db.plans.find_one(
        {"plan_key": enrolled_plan_key, "category": "cohort"},
        {"_id": 0, "features": 1},
    )
    plan_features = (plan_doc.get("features") or {}) if plan_doc else {}
    coaching_credits = int(plan_features.get("coaching_sessions") or 0)
    strategy_credits = int(plan_features.get("strategy_calls") or 0)
    if coaching_credits > 0 or strategy_credits > 0:
        credit_update: dict = {"updated_at": now}
        if coaching_credits > 0:
            credit_update["coaching_sessions_total"] = (user_dict.get("coaching_sessions_total") or 0) + coaching_credits
        if strategy_credits > 0:
            credit_update["strategy_calls_total"] = (user_dict.get("strategy_calls_total") or 0) + strategy_credits
        await db.users.update_one(
            {"id": user_dict["id"]},
            {"$set": credit_update},
        )
        logger.info(
            "verify: credited %d coaching + %d strategy to user %s for plan %s",
            coaching_credits, strategy_credits, user_dict.get("email"), enrolled_plan_key,
        )

    # Mark coupon usage if applicable (mirrors coaching path)
    if order.get("coupon_code"):
        try:
            await db.discount_usage.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_dict.get("id"),
                "discount_code": order.get("coupon_code"),
                "context": "cohort_enrolment",
                "cohort_id": cohort["id"],
                "amount_saved": order.get("discount_amount"),
                "created_at": now,
            })
        except Exception as e:  # noqa: BLE001
            logger.warning(f"discount_usage insert failed for cohort enrolment: {e}")

    # Fire-and-forget welcome email + .ics calendar invite. Failures are
    # logged inside the helper and never break the enrolment response.
    import asyncio as _asyncio
    _asyncio.create_task(
        _send_cohort_welcome_email(
            cohort=cohort,
            user_name=user_dict.get("name") or user_dict.get("email") or "there",
            user_email=user_dict.get("email"),
            sessions=cohort.get("sessions") or [],
        )
    )

    # If we just auto-created a guest user, drop a session cookie so
    # the frontend can redirect them straight into the dashboard
    # without forcing a login step.
    if auto_login_token:
        # 30 days, lax samesite so the cookie sticks across the
        # Razorpay redirect dance.
        response.set_cookie(
            "session_token",
            auto_login_token,
            max_age=60 * 60 * 24 * 30,
            httponly=True,
            samesite="lax",
            secure=True,
        )

    return {
        "success": True,
        "enrollment_id": enrollment["id"],
        "cohort": {"id": cohort["id"], "name": cohort.get("name"), "slug": cohort.get("slug")},
        "amount_paid": enrollment["amount_paid"],
        # When a brand-new account was created, the frontend can use the
        # token to set localStorage / Authorization header and route
        # the user into the dashboard immediately.
        "auto_login_token": auto_login_token,
        "is_new_user": auto_login_token is not None,
        "user_email": user_dict.get("email"),
        "needs_password_setup": user_dict.get("needs_password_setup", False),
    }

@auth_router.get("/my-enrollments")
async def get_my_cohort_enrollments(request: Request):
    """Returns all cohorts the current user is enrolled in, with the
    full session list (date, time, topic, meet_link) for each. The
    candidate dashboard's Cohort tab renders this."""
    user = await get_current_user(request)
    db = get_db(request)
    user_dict = user if isinstance(user, dict) else (user.dict() if hasattr(user, "dict") else user)

    enrollments = await db.cohort_enrollments.find(
        {"user_id": user_dict.get("id"), "status": "active"},
        {"_id": 0},
    ).sort([("enrolled_at", -1)]).to_list(50)

    out: List[Dict[str, Any]] = []
    for enr in enrollments:
        cohort = await db.cohorts.find_one({"id": enr.get("cohort_id")}, {"_id": 0})
        if not cohort:
            # Fall back to the static template for the default cohort.
            # This is the common case when the admin hasn't published a DB
            # cohort record yet but users have enrolled via the landing page.
            if enr.get("cohort_id") == DEFAULT_COHORT_TEMPLATE["id"]:
                cohort = {**DEFAULT_COHORT_TEMPLATE}
            else:
                continue  # Unknown cohort — skip
        sessions = sorted(
            cohort.get("sessions") or [],
            key=lambda s: (s.get("week_number") or 0, s.get("date") or "", s.get("time_slot") or ""),
        )
        out.append({
            "enrollment_id": enr.get("id"),
            "enrolled_at": enr.get("enrolled_at"),
            "plan_key": enr.get("plan_key"),
            "cohort": {
                "id": cohort.get("id"),
                "name": cohort.get("name"),
                "slug": cohort.get("slug"),
                "tagline": cohort.get("tagline"),
                "duration_weeks": cohort.get("duration_weeks"),
                "start_date": cohort.get("start_date"),
                "start_date_label": cohort.get("start_date_label"),
                "end_date": cohort.get("end_date"),
                "cover_image_url": cohort.get("cover_image_url"),
                "hero_image_url": cohort.get("hero_image_url"),
            },
            "sessions": sessions,
        })
    return {"enrollments": out}


# ============= Admin routes =============

class LandingSettingsRequest(BaseModel):
    accept_enrolments: bool


# IMPORTANT: declare these BEFORE the `/{cohort_id}` routes — otherwise
# FastAPI matches `landing-settings` as the cohort_id path param.
@admin_router.get("/landing-settings")
async def admin_get_landing_settings(request: Request):
    """Read the global toggle controlling whether the static landing
    page (when no DB cohort is published) shows the Enrol button as
    active. Returns `{accept_enrolments: bool}` — defaults to True
    when no doc exists."""
    await verify_admin(request)
    db = get_db(request)
    accept = await _get_landing_accept_enrolments(db)
    return {"accept_enrolments": accept}


@admin_router.put("/landing-settings")
async def admin_update_landing_settings(body: LandingSettingsRequest, request: Request):
    """Admin toggle for whether the static landing template accepts
    enrolments. Has NO effect once a real DB cohort with slug
    `case-interview-sprint` is published — at that point the DB record's
    own `is_active` flag takes over."""
    await verify_admin(request)
    db = get_db(request)
    await db.cohort_landing_settings.update_one(
        {"_id": "default"},
        {"$set": {
            "accept_enrolments": bool(body.accept_enrolments),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    invalidate_public_cohorts_cache()
    return {"success": True, "accept_enrolments": bool(body.accept_enrolments)}


@admin_router.get("")
async def admin_list_cohorts(request: Request):
    await verify_admin(request)
    db = get_db(request)
    cohorts = await db.cohorts.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    # Attach enrolment counts
    for c in cohorts:
        c["enrollment_count"] = await db.cohort_enrollments.count_documents(
            {"cohort_id": c.get("id"), "status": "active"}
        )
    return {"cohorts": cohorts}


@admin_router.post("")
async def admin_create_cohort(body: Cohort, request: Request):
    await verify_admin(request)
    db = get_db(request)
    payload = body.dict(exclude_none=False)
    # Slug must be unique
    if await db.cohorts.find_one({"slug": payload["slug"]}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=409, detail=f"A cohort with slug '{payload['slug']}' already exists")
    payload["id"] = str(uuid.uuid4())
    payload["seats_filled"] = 0
    now = datetime.now(timezone.utc).isoformat()
    payload["created_at"] = now
    payload["updated_at"] = now
    # Assign IDs to any sessions provided at create time
    for s in payload.get("sessions") or []:
        if not s.get("id"):
            s["id"] = str(uuid.uuid4())
    await db.cohorts.insert_one(payload)
    invalidate_public_cohorts_cache()
    return {"success": True, "cohort": _strip_id(await db.cohorts.find_one({"id": payload["id"]}, {"_id": 0}))}


@admin_router.get("/{cohort_id}")
async def admin_get_cohort(cohort_id: str, request: Request):
    await verify_admin(request)
    db = get_db(request)
    cohort = await db.cohorts.find_one({"id": cohort_id}, {"_id": 0})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    cohort["enrollment_count"] = await db.cohort_enrollments.count_documents(
        {"cohort_id": cohort_id, "status": "active"}
    )
    return {"cohort": cohort}


@admin_router.put("/{cohort_id}")
async def admin_update_cohort(cohort_id: str, body: Cohort, request: Request):
    await verify_admin(request)
    db = get_db(request)
    existing = await db.cohorts.find_one({"id": cohort_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cohort not found")
    payload = body.dict(exclude_none=False)
    payload["id"] = cohort_id
    payload["created_at"] = existing.get("created_at")
    payload["seats_filled"] = existing.get("seats_filled", 0)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Slug uniqueness check (allow same cohort to keep its slug)
    if payload.get("slug") and payload["slug"] != existing.get("slug"):
        clash = await db.cohorts.find_one({"slug": payload["slug"], "id": {"$ne": cohort_id}}, {"_id": 0, "id": 1})
        if clash:
            raise HTTPException(status_code=409, detail=f"Slug '{payload['slug']}' is already used by another cohort")
    # Preserve session IDs / fill missing
    for s in payload.get("sessions") or []:
        if not s.get("id"):
            s["id"] = str(uuid.uuid4())
    await db.cohorts.update_one({"id": cohort_id}, {"$set": payload})
    invalidate_public_cohorts_cache()
    return {"success": True, "cohort": _strip_id(await db.cohorts.find_one({"id": cohort_id}, {"_id": 0}))}


@admin_router.delete("/{cohort_id}")
async def admin_delete_cohort(cohort_id: str, request: Request):
    """Soft-delete: mark inactive (preserves enrollments + history).
    Admin can pass `?hard=true` to hard-delete only when there are zero
    enrollments — guards against accidental data loss."""
    await verify_admin(request)
    db = get_db(request)
    cohort = await db.cohorts.find_one({"id": cohort_id}, {"_id": 0})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    hard = (request.query_params.get("hard") or "").lower() in ("1", "true", "yes")
    if hard:
        count = await db.cohort_enrollments.count_documents({"cohort_id": cohort_id})
        if count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot hard-delete: {count} enrollment(s) exist. Use soft-delete (default) instead.",
            )
        await db.cohorts.delete_one({"id": cohort_id})
        invalidate_public_cohorts_cache()
        return {"success": True, "deleted": "hard"}
    await db.cohorts.update_one(
        {"id": cohort_id},
        {"$set": {"is_active": False, "is_featured": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    invalidate_public_cohorts_cache()
    return {"success": True, "deleted": "soft"}


@admin_router.get("/{cohort_id}/enrollments")
async def admin_list_enrollments(cohort_id: str, request: Request):
    await verify_admin(request)
    db = get_db(request)
    enrollments = await db.cohort_enrollments.find(
        {"cohort_id": cohort_id},
        {"_id": 0},
    ).sort([("enrolled_at", -1)]).to_list(1000)
    # Enrich with user current state
    for e in enrollments:
        u = await db.users.find_one(
            {"id": e.get("user_id")},
            {"_id": 0, "name": 1, "email": 1, "phone_number": 1, "phone_country_code": 1, "picture": 1},
        ) or {}
        e["user"] = u
    return {"enrollments": enrollments}


# ----- Cohort "Past mentors" admin (per-cohort lineup for the public landing) -----

class CohortLandingMentorsBody(BaseModel):
    mentor_ids: List[str] = Field(default_factory=list)


@admin_router.get("/{cohort_id}/landing-mentors")
async def admin_get_cohort_landing_mentors(cohort_id: str, request: Request):
    """Return the cohort's saved Past-mentors lineup as `{ mentor_ids: [...] }`
    plus a slim `mentor_directory` payload (id/name/firm/picture/college) so
    the admin tab can render search-and-pick without a second round-trip.
    Mentors that are hidden / deleted are filtered out of `mentor_directory`."""
    await verify_admin(request)
    db = get_db(request)
    cohort = await db.cohorts.find_one(
        {"id": cohort_id},
        {"_id": 0, "id": 1, "landing_mentor_ids": 1},
    )
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    directory_cursor = db.mentors.find(
        {"is_hidden": {"$ne": True}, "is_deleted": {"$ne": True}},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "firm": 1,
            "consulting_firm": 1,
            "consulting_position": 1,
            "title": 1,
            "college": 1,
            "picture": 1,
            "picture_thumbnail": 1,
            "is_top_coach": 1,
        },
    ).sort([("name", 1)])
    directory = await directory_cursor.to_list(500)

    return {
        "cohort_id": cohort_id,
        "mentor_ids": cohort.get("landing_mentor_ids") or [],
        "mentor_directory": directory,
    }


@admin_router.put("/{cohort_id}/landing-mentors")
async def admin_set_cohort_landing_mentors(
    cohort_id: str,
    body: CohortLandingMentorsBody,
    request: Request,
):
    """Persist the cohort's ordered list of Past-mentor IDs. Order matters.
    Sending an empty list clears the lineup (frontend then falls back to
    its default featured/top-rated logic)."""
    await verify_admin(request)
    db = get_db(request)
    cohort = await db.cohorts.find_one({"id": cohort_id}, {"_id": 0, "id": 1})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")

    # De-duplicate while preserving order.
    seen: set = set()
    cleaned: List[str] = []
    for mid in body.mentor_ids:
        if mid and mid not in seen:
            seen.add(mid)
            cleaned.append(mid)

    await db.cohorts.update_one(
        {"id": cohort_id},
        {
            "$set": {
                "landing_mentor_ids": cleaned,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    invalidate_public_cohorts_cache()
    return {"success": True, "mentor_ids": cleaned}



# ----- Cohort discovery calls (admin) -----

@admin_router.get("/discovery-calls/list")
async def admin_list_discovery_calls(request: Request, status: Optional[str] = Query(default=None)):
    await verify_admin(request)
    db = get_db(request)
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    calls = await db.cohort_discovery_calls.find(q, {"_id": 0}).sort([("requested_at", -1)]).to_list(500)
    return {"requests": calls}


@admin_router.post("/discovery-calls/{request_id}/schedule")
async def admin_schedule_discovery_call(request_id: str, body: ScheduleDiscoveryCallRequest, request: Request):
    await verify_admin(request)
    db = get_db(request)
    existing = await db.cohort_discovery_calls.find_one({"id": request_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Discovery call request not found")
    update = {
        "status": "scheduled",
        "scheduled_at": body.scheduled_at,
        "meet_link": body.meet_link,
        "admin_notes": body.notes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cohort_discovery_calls.update_one({"id": request_id}, {"$set": update})
    return {"success": True}


@admin_router.post("/discovery-calls/{request_id}/mark-completed")
async def admin_mark_discovery_call_completed(request_id: str, request: Request):
    await verify_admin(request)
    db = get_db(request)
    res = await db.cohort_discovery_calls.update_one(
        {"id": request_id},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discovery call request not found")
    return {"success": True}


@admin_router.post("/discovery-calls/{request_id}/cancel")
async def admin_cancel_discovery_call(request_id: str, request: Request):
    await verify_admin(request)
    db = get_db(request)
    res = await db.cohort_discovery_calls.update_one(
        {"id": request_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discovery call request not found")
    return {"success": True}
