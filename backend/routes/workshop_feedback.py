"""
Workshop feedback collection.

Two ingestion paths land here:
1. POST /api/workshops/{workshop_id}/feedback — in-app form submission by an
   authenticated candidate.
2. POST /api/webhooks/wati — inbound WATI WhatsApp reply, parsed and
   associated with the most recent workshop the user attended.

Both paths persist to db.workshop_feedback AND mirror the row into the
'Feedback' tab of the Workshop Google Sheet.
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["workshop-feedback"])

IST = timezone(timedelta(hours=5, minutes=30))


def get_db(request: Request):
    return request.app.state.db


# ─── In-app feedback ─────────────────────────────────────────────


class WorkshopFeedbackBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comments: Optional[str] = ""


async def _persist_feedback(db, feedback_doc: dict, workshop: dict):
    """Save to db + mirror to Google Sheet."""
    await db.workshop_feedback.update_one(
        {"workshop_id": feedback_doc["workshop_id"], "user_id": feedback_doc["user_id"]},
        {"$set": feedback_doc},
        upsert=True,
    )
    try:
        from services.google_sheets_service import append_workshop_feedback_to_sheet
        await append_workshop_feedback_to_sheet({
            "workshop_title": workshop.get("title", ""),
            "workshop_date": workshop.get("date", ""),
            "name": feedback_doc.get("name", ""),
            "email": feedback_doc.get("email", ""),
            "phone": feedback_doc.get("phone", ""),
            "rating": feedback_doc.get("rating"),
            "comments": feedback_doc.get("comments", ""),
            "submitted_at": feedback_doc.get("submitted_at"),
            "source": feedback_doc.get("source", "in_app"),
        })
    except Exception as sheet_err:
        logger.warning(f"Workshop feedback sheet sync failed (non-critical): {sheet_err}")


@router.post("/api/workshops/{workshop_id}/feedback")
async def submit_workshop_feedback(workshop_id: str, body: WorkshopFeedbackBody, request: Request):
    """Authenticated candidate submits feedback for a workshop they attended."""
    from routes.auth import get_current_user
    user = await get_current_user(request)

    db = get_db(request)
    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Workshop not found")

    submitted_at = datetime.now(timezone.utc).isoformat()
    feedback_doc = {
        "workshop_id": workshop_id,
        "user_id": user.get("id"),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone_number", ""),
        "rating": body.rating,
        "comments": body.comments or "",
        "submitted_at": submitted_at,
        "source": "in_app",
    }

    await _persist_feedback(db, feedback_doc, workshop)
    return {"success": True, "message": "Thank you for your feedback!"}


# ─── WATI inbound webhook ────────────────────────────────────────


_RATING_RE = re.compile(r"\b([1-5])\b")


def _normalize_phone(raw: str) -> str:
    """Normalize phone for matching against db.users.phone_number.
    WATI may send '+91...' or '91...' — strip leading '+' to compare both."""
    if not raw:
        return ""
    raw = str(raw).strip()
    if raw.startswith("+"):
        raw = raw[1:]
    return raw


def _parse_feedback_message(text: str) -> tuple[Optional[int], str]:
    """Extract a rating (1-5) from a WhatsApp reply and return remaining text as comments.

    Heuristics:
      - First standalone digit 1-5 in the text is treated as the rating.
      - Everything else (including text before/after) becomes the comment.
    """
    if not text:
        return None, ""
    match = _RATING_RE.search(text)
    rating = int(match.group(1)) if match else None
    if match:
        before = text[:match.start()].strip()
        after = text[match.end():].strip()
        comments = (before + " " + after).strip()
    else:
        comments = text.strip()
    return rating, comments


async def _find_recent_workshop_for_user(db, user_id: str) -> Optional[dict]:
    """Return the most recent workshop the user registered for whose date
    is within the last 48 hours (allows late replies after the thank-you msg).
    """
    cutoff = datetime.now(IST) - timedelta(hours=48)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    registrations = await db.workshop_registrations.find(
        {"user_id": user_id},
        {"_id": 0, "workshop_id": 1},
    ).to_list(50)
    if not registrations:
        return None
    workshop_ids = [r.get("workshop_id") for r in registrations]
    workshops = await db.workshops.find(
        {"id": {"$in": workshop_ids}, "date": {"$gte": cutoff_str}},
        {"_id": 0},
    ).to_list(50)
    if not workshops:
        return None
    workshops.sort(key=lambda w: w.get("date", ""), reverse=True)
    return workshops[0]


@router.post("/api/webhooks/wati")
async def wati_inbound_webhook(request: Request, body: dict = Body(...)):
    """Receive an inbound WATI WhatsApp message and, when it appears to be
    feedback for a recently-attended workshop, persist it.

    WATI sends a JSON payload that varies by event type. We're tolerant of
    the most common shapes (`waId`/`whatsappNumber`/`from` for the sender,
    `text`/`messageBody`/`text.body` for the message). Non-feedback events
    are silently acknowledged so retries from WATI don't pile up.
    """
    db = get_db(request)
    logger.info(f"[WATI webhook] payload keys: {list(body.keys())}")

    # 1) Extract sender phone (normalize)
    raw_phone = (
        body.get("waId")
        or body.get("whatsappNumber")
        or body.get("from")
        or body.get("phone_number")
        or (body.get("contact") or {}).get("waId")
        or ""
    )
    phone = _normalize_phone(raw_phone)

    # 2) Extract message text
    text = (
        body.get("text")
        or body.get("messageBody")
        or body.get("body")
        or (body.get("message") or {}).get("text")
        or (body.get("message") or {}).get("body")
        or ""
    )
    if isinstance(text, dict):
        text = text.get("body") or text.get("value") or ""
    text = (text or "").strip()

    if not phone or not text:
        # Status updates, delivery receipts, template ack events — nothing to do
        return {"ok": True, "ignored": True}

    # 3) Match user. Try multiple normalized phone formats.
    candidates = [phone]
    if not phone.startswith("+"):
        candidates.append("+" + phone)
    if phone.startswith("91") and len(phone) > 10:
        candidates.append(phone[2:])
    user = await db.users.find_one(
        {"phone_number": {"$in": candidates}},
        {"_id": 0},
    )
    if not user:
        logger.info(f"[WATI webhook] no user matched for phone {phone}")
        return {"ok": True, "matched": False}

    # 4) Find the most-recent workshop they attended (last 48h)
    workshop = await _find_recent_workshop_for_user(db, user.get("id"))
    if not workshop:
        logger.info(f"[WATI webhook] no recent workshop for user {user.get('email')}")
        return {"ok": True, "no_workshop": True}

    # 5) Parse rating + comments
    rating, comments = _parse_feedback_message(text)

    # 6) Persist (allow comment-only replies; rating may be None)
    submitted_at = datetime.now(timezone.utc).isoformat()
    feedback_doc = {
        "workshop_id": workshop.get("id"),
        "user_id": user.get("id"),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone_number", ""),
        "rating": rating,
        "comments": comments,
        "raw_message": text,
        "submitted_at": submitted_at,
        "source": "wati_whatsapp",
    }
    await _persist_feedback(db, feedback_doc, workshop)

    # Mark this WhatsApp contact as having engaged with the workshop. We do this
    # ONLY on inbound reply (per ops requirement) so that the WATI
    # `workshop_name` attribute reflects actual engagement, not just delivery.
    try:
        from services.wati_service import wati_service
        wati_phone = user.get("phone_number") or phone
        await wati_service.update_contact_attribute(
            recipient_number=wati_phone,
            attribute_name="workshop_name",
            attribute_value=workshop.get("title", ""),
        )
        logger.info(
            f"[WATI webhook] updated workshop_name='{workshop.get('title')}' "
            f"for {wati_phone}"
        )
    except Exception as attr_error:
        # Non-critical — feedback is already saved.
        logger.warning(f"[WATI webhook] update_contact_attribute failed: {attr_error}")

    return {"ok": True, "feedback_recorded": True, "workshop_id": workshop.get("id")}


# ─── Admin: list & export ────────────────────────────────────────


@router.get("/api/admin/workshops/{workshop_id}/feedback")
async def list_workshop_feedback(workshop_id: str, request: Request):
    """Admin: list all feedback rows for a workshop."""
    from routes.admin import verify_admin
    await verify_admin(request)
    db = get_db(request)

    rows = await db.workshop_feedback.find(
        {"workshop_id": workshop_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(2000)
    return {"feedback": rows, "count": len(rows)}


@router.post("/api/admin/workshops/{workshop_id}/feedback/sync-to-sheet")
async def sync_workshop_feedback_to_sheet(workshop_id: str, request: Request):
    """Admin: backfill all stored feedback for a workshop into the Feedback tab.
    Idempotency note: rows are appended; running this twice will create duplicates.
    """
    from routes.admin import verify_admin
    await verify_admin(request)
    db = get_db(request)

    workshop = await db.workshops.find_one({"id": workshop_id}, {"_id": 0})
    if not workshop:
        raise HTTPException(status_code=404, detail="Workshop not found")

    rows = await db.workshop_feedback.find(
        {"workshop_id": workshop_id}, {"_id": 0}
    ).to_list(5000)

    from services.google_sheets_service import append_workshop_feedback_to_sheet
    synced = 0
    for fb in rows:
        try:
            await append_workshop_feedback_to_sheet({
                "workshop_title": workshop.get("title", ""),
                "workshop_date": workshop.get("date", ""),
                "name": fb.get("name", ""),
                "email": fb.get("email", ""),
                "phone": fb.get("phone", ""),
                "rating": fb.get("rating"),
                "comments": fb.get("comments", ""),
                "submitted_at": fb.get("submitted_at"),
                "source": fb.get("source", "in_app"),
            })
            synced += 1
        except Exception as e:
            logger.warning(f"sync_workshop_feedback row failed: {e}")
    return {"synced": synced, "total": len(rows)}
