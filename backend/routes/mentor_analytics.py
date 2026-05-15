"""
Mentor Analytics API Routes
Comprehensive analytics dashboard for mentor performance tracking
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import io
import csv

from routes.auth import get_current_user, get_db

router = APIRouter(prefix="/admin/mentor-analytics", tags=["mentor-analytics"])


async def verify_admin(request: Request):
    """Verify the current user is an admin"""
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/summary")
async def get_mentor_analytics_summary(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "sessions_completed",
    sort_order: str = "desc",
    search: Optional[str] = None
):
    """
    Get aggregated analytics for all mentors with real-time stats
    
    Metrics per mentor:
    - Total sessions (completed, cancelled, no-shows, rescheduled)
    - Average rating from candidate feedback
    - Total earnings (sessions × hourly_rate)
    - Total revenue (sessions × single_session_price)
    - Pending feedbacks count
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Build date filter for bookings
    date_filter = {}
    if date_from:
        date_filter["date"] = {"$gte": date_from}
    if date_to:
        if "date" in date_filter:
            date_filter["date"]["$lte"] = date_to
        else:
            date_filter["date"] = {"$lte": date_to}
    
    # Get all active mentors (not deleted)
    mentor_filter = {"is_deleted": {"$ne": True}}
    if search:
        mentor_filter["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    mentors = await db.mentors.find(mentor_filter, {"_id": 0}).to_list(500)
    
    analytics_data = []
    
    for mentor in mentors:
        mentor_id = mentor.get("id")
        
        # Build booking filter for this mentor
        booking_filter = {"mentor_id": mentor_id}
        if date_filter:
            booking_filter.update(date_filter)
        
        # Get all bookings for this mentor
        bookings = await db.bookings.find(booking_filter, {"_id": 0}).to_list(1000)
        
        # Calculate session counts
        total_sessions = len(bookings)
        completed_sessions = len([b for b in bookings if b.get("status") == "completed"])
        cancelled_sessions = len([b for b in bookings if b.get("status") == "cancelled"])
        no_show_sessions = len([b for b in bookings if b.get("status") == "no_show"])
        rescheduled_sessions = len([b for b in bookings if b.get("was_rescheduled")])
        
        # Get rating directly from mentor document (this is where ratings are stored)
        avg_rating = mentor.get("rating")
        if avg_rating is not None:
            avg_rating = round(float(avg_rating), 2)
        # Use feedback_count for total reviews (this tracks actual review count)
        total_reviews = mentor.get("feedback_count") or mentor.get("total_reviews") or 0
        
        # Calculate pending feedbacks (completed sessions where mentor hasn't given feedback)
        sessions_needing_feedback = [
            b for b in bookings 
            if b.get("status") == "completed" and not b.get("mentor_feedback_given")
        ]
        pending_feedbacks = len(sessions_needing_feedback)
        
        # Get pricing from mentor profile
        hourly_rate = mentor.get("hourly_rate", 0) or 0
        single_session_price = mentor.get("price_per_session", 0) or 0
        
        # Calculate earnings and revenue (based on completed sessions only)
        total_earnings = completed_sessions * hourly_rate
        total_revenue = completed_sessions * single_session_price
        
        analytics_data.append({
            "mentor_id": mentor_id,
            "name": mentor.get("name", ""),
            "email": mentor.get("email", ""),
            "picture": mentor.get("picture", ""),
            "consulting_firm": mentor.get("consulting_firm", mentor.get("specialization", "")),
            "is_hidden": mentor.get("is_hidden", False),
            "hourly_rate": hourly_rate,
            "single_session_price": single_session_price,
            
            # Session metrics
            "total_sessions": total_sessions,
            "sessions_completed": completed_sessions,
            "sessions_cancelled": cancelled_sessions,
            "sessions_no_show": no_show_sessions,
            "sessions_rescheduled": rescheduled_sessions,
            
            # Rating metrics
            "avg_rating": avg_rating,
            "total_reviews": total_reviews,
            "pending_feedbacks": pending_feedbacks,
            
            # Financial metrics
            "total_earnings": total_earnings,
            "total_revenue": total_revenue
        })
    
    # Sort the data
    reverse = sort_order == "desc"
    
    # Define sort key with None handling
    def sort_key(item):
        value = item.get(sort_by, 0)
        if value is None:
            return -float('inf') if reverse else float('inf')
        return value
    
    valid_sort_fields = [
        "sessions_completed", "total_sessions", "avg_rating", 
        "total_earnings", "total_revenue", "pending_feedbacks",
        "sessions_cancelled", "sessions_no_show", "sessions_rescheduled",
        "name", "total_reviews"
    ]
    
    if sort_by in valid_sort_fields:
        analytics_data.sort(key=sort_key, reverse=reverse)
    
    # Calculate overall summary stats
    total_completed = sum(m["sessions_completed"] for m in analytics_data)
    total_cancelled = sum(m["sessions_cancelled"] for m in analytics_data)
    total_no_shows = sum(m["sessions_no_show"] for m in analytics_data)
    total_rescheduled = sum(m["sessions_rescheduled"] for m in analytics_data)
    total_platform_revenue = sum(m["total_revenue"] for m in analytics_data)
    total_mentor_earnings = sum(m["total_earnings"] for m in analytics_data)
    total_pending = sum(m["pending_feedbacks"] for m in analytics_data)
    
    # Calculate platform-wide average rating
    all_ratings = [m["avg_rating"] for m in analytics_data if m["avg_rating"] is not None]
    platform_avg_rating = round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else None
    
    return {
        "mentors": analytics_data,
        "total_mentors": len(analytics_data),
        "summary": {
            "total_sessions_completed": total_completed,
            "total_sessions_cancelled": total_cancelled,
            "total_sessions_no_show": total_no_shows,
            "total_sessions_rescheduled": total_rescheduled,
            "total_platform_revenue": total_platform_revenue,
            "total_mentor_earnings": total_mentor_earnings,
            "total_pending_feedbacks": total_pending,
            "platform_avg_rating": platform_avg_rating
        },
        "filters_applied": {
            "date_from": date_from,
            "date_to": date_to,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "search": search
        }
    }


@router.get("/mentor/{mentor_id}/sessions")
async def get_mentor_session_details(
    mentor_id: str,
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """
    Get detailed session-wise view for a specific mentor
    
    Each session includes:
    - Date, time, candidate info
    - Status (completed, cancelled, no-show)
    - Was rescheduled flag
    - Rating and feedback status
    - Revenue and earnings for that session
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Verify mentor exists
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Build filter
    booking_filter = {"mentor_id": mentor_id}
    
    if date_from:
        booking_filter["date"] = {"$gte": date_from}
    if date_to:
        if "date" in booking_filter:
            booking_filter["date"]["$lte"] = date_to
        else:
            booking_filter["date"] = {"$lte": date_to}
    
    if status:
        booking_filter["status"] = status
    
    # Get total count
    total = await db.bookings.count_documents(booking_filter)
    
    # Get paginated sessions
    skip = (page - 1) * limit
    bookings = await db.bookings.find(
        booking_filter, 
        {"_id": 0}
    ).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get pricing
    hourly_rate = mentor.get("hourly_rate", 0) or 0
    single_session_price = mentor.get("price_per_session", 0) or 0
    
    # Enrich each session with feedback details
    sessions = []
    for booking in bookings:
        session_id = booking.get("id")
        
        # Get candidate feedback for this session
        candidate_feedback = await db.candidate_feedbacks.find_one(
            {"session_id": session_id},
            {"_id": 0, "rating": 1, "feedback": 1, "created_at": 1}
        )
        
        # Get mentor feedback for this session
        mentor_feedback = await db.session_feedbacks.find_one(
            {"session_id": session_id, "mentor_id": mentor_id},
            {"_id": 0, "rating": 1, "feedback": 1, "created_at": 1}
        )
        
        # Calculate session-specific revenue/earnings
        is_completed = booking.get("status") == "completed"
        session_earnings = hourly_rate if is_completed else 0
        session_revenue = single_session_price if is_completed else 0
        
        sessions.append({
            "session_id": session_id,
            "date": booking.get("date"),
            "time_slot": booking.get("time_slot"),
            "session_type": booking.get("session_type", "General"),
            "status": booking.get("status"),
            
            # Candidate info
            "candidate_id": booking.get("candidate_id"),
            "candidate_name": booking.get("candidate_name"),
            "candidate_email": booking.get("candidate_email"),
            
            # Reschedule info
            "was_rescheduled": booking.get("was_rescheduled", False),
            "previous_date": booking.get("previous_date"),
            "previous_time_slot": booking.get("previous_time_slot"),
            "rescheduled_by": booking.get("rescheduled_by"),
            "rescheduled_at": booking.get("rescheduled_at"),
            
            # Feedback status
            "candidate_feedback_given": booking.get("candidate_feedback_given", False),
            "candidate_feedback_rating": candidate_feedback.get("rating") if candidate_feedback else None,
            "candidate_feedback_text": candidate_feedback.get("feedback") if candidate_feedback else None,
            "candidate_feedback_date": candidate_feedback.get("created_at") if candidate_feedback else None,
            
            "mentor_feedback_given": booking.get("mentor_feedback_given", False),
            "mentor_feedback_rating": mentor_feedback.get("rating") if mentor_feedback else None,
            
            # Financial
            "session_earnings": session_earnings,
            "session_revenue": session_revenue,
            
            # Timestamps
            "created_at": booking.get("created_at"),
            "updated_at": booking.get("updated_at")
        })
    
    # Calculate summary for this mentor
    all_bookings = await db.bookings.find({"mentor_id": mentor_id}, {"_id": 0, "status": 1, "was_rescheduled": 1}).to_list(1000)
    
    completed_count = len([b for b in all_bookings if b.get("status") == "completed"])
    cancelled_count = len([b for b in all_bookings if b.get("status") == "cancelled"])
    no_show_count = len([b for b in all_bookings if b.get("status") == "no_show"])
    rescheduled_count = len([b for b in all_bookings if b.get("was_rescheduled")])
    
    # Get rating directly from mentor document
    avg_rating = mentor.get("rating")
    if avg_rating is not None:
        avg_rating = round(float(avg_rating), 2)
    # Use feedback_count for total reviews
    total_reviews = mentor.get("feedback_count") or mentor.get("total_reviews") or 0
    
    return {
        "mentor": {
            "id": mentor_id,
            "name": mentor.get("name"),
            "email": mentor.get("email"),
            "picture": mentor.get("picture"),
            "consulting_firm": mentor.get("consulting_firm", mentor.get("specialization", "")),
            "hourly_rate": hourly_rate,
            "single_session_price": single_session_price
        },
        "summary": {
            "total_sessions": len(all_bookings),
            "sessions_completed": completed_count,
            "sessions_cancelled": cancelled_count,
            "sessions_no_show": no_show_count,
            "sessions_rescheduled": rescheduled_count,
            "avg_rating": avg_rating,
            "total_reviews": total_reviews,
            "total_earnings": completed_count * hourly_rate,
            "total_revenue": completed_count * single_session_price
        },
        "sessions": sessions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/export")
async def export_mentor_analytics(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    format: str = "csv"
):
    """
    Export mentor analytics data to CSV or JSON
    """
    await verify_admin(request)
    
    # Get analytics data
    analytics_response = await get_mentor_analytics_summary(
        request=request,
        date_from=date_from,
        date_to=date_to,
        sort_by="sessions_completed",
        sort_order="desc"
    )
    
    mentors = analytics_response["mentors"]
    
    if format == "json":
        import json
        output = io.BytesIO()
        output.write(json.dumps({
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "filters": analytics_response["filters_applied"],
            "summary": analytics_response["summary"],
            "mentors": mentors
        }, indent=2).encode('utf-8'))
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=mentor_analytics_{datetime.now().strftime('%Y%m%d')}.json"}
        )
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    writer.writerow([
        "Mentor Name", "Email", "Consulting Firm", "Hourly Rate", "Session Price",
        "Total Sessions", "Completed", "Cancelled", "No-Shows", "Rescheduled",
        "Avg Rating", "Total Reviews", "Pending Feedbacks",
        "Total Earnings (INR)", "Total Revenue (INR)", "Hidden"
    ])
    
    # Data rows
    for m in mentors:
        writer.writerow([
            m["name"],
            m["email"],
            m["consulting_firm"],
            m["hourly_rate"],
            m["single_session_price"],
            m["total_sessions"],
            m["sessions_completed"],
            m["sessions_cancelled"],
            m["sessions_no_show"],
            m["sessions_rescheduled"],
            m["avg_rating"] if m["avg_rating"] else "N/A",
            m["total_reviews"],
            m["pending_feedbacks"],
            m["total_earnings"],
            m["total_revenue"],
            "Yes" if m["is_hidden"] else "No"
        ])
    
    # Add summary row
    writer.writerow([])
    writer.writerow(["SUMMARY"])
    summary = analytics_response["summary"]
    writer.writerow(["Total Mentors", len(mentors)])
    writer.writerow(["Total Completed Sessions", summary["total_sessions_completed"]])
    writer.writerow(["Total Cancelled Sessions", summary["total_sessions_cancelled"]])
    writer.writerow(["Total No-Shows", summary["total_sessions_no_show"]])
    writer.writerow(["Total Rescheduled", summary["total_sessions_rescheduled"]])
    writer.writerow(["Platform Avg Rating", summary["platform_avg_rating"] or "N/A"])
    writer.writerow(["Total Mentor Earnings", f"₹{summary['total_mentor_earnings']:,}"])
    writer.writerow(["Total Platform Revenue", f"₹{summary['total_platform_revenue']:,}"])
    writer.writerow(["Total Pending Feedbacks", summary["total_pending_feedbacks"]])
    
    csv_content = output.getvalue()
    output.close()
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=mentor_analytics_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/mentor/{mentor_id}/export-sessions")
async def export_mentor_sessions(
    mentor_id: str,
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """
    Export all sessions for a specific mentor to CSV
    """
    await verify_admin(request)
    db = get_db(request)
    
    # Get mentor details
    mentor = await db.mentors.find_one({"id": mentor_id}, {"_id": 0})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Get all sessions (no pagination for export)
    booking_filter = {"mentor_id": mentor_id}
    if date_from:
        booking_filter["date"] = {"$gte": date_from}
    if date_to:
        if "date" in booking_filter:
            booking_filter["date"]["$lte"] = date_to
        else:
            booking_filter["date"] = {"$lte": date_to}
    
    bookings = await db.bookings.find(booking_filter, {"_id": 0}).sort("date", -1).to_list(5000)
    
    hourly_rate = mentor.get("hourly_rate", 0) or 0
    single_session_price = mentor.get("price_per_session", 0) or 0
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Date", "Time", "Session Type", "Status",
        "Candidate Name", "Candidate Email",
        "Was Rescheduled", "Candidate Feedback", "Rating",
        "Earnings (INR)", "Revenue (INR)"
    ])
    
    for booking in bookings:
        is_completed = booking.get("status") == "completed"
        
        # Get candidate feedback
        candidate_feedback = await db.candidate_feedbacks.find_one(
            {"session_id": booking.get("id")},
            {"_id": 0, "rating": 1}
        )
        
        writer.writerow([
            booking.get("date"),
            booking.get("time_slot"),
            booking.get("session_type", "General"),
            booking.get("status"),
            booking.get("candidate_name"),
            booking.get("candidate_email"),
            "Yes" if booking.get("was_rescheduled") else "No",
            "Given" if booking.get("candidate_feedback_given") else "Pending" if is_completed else "N/A",
            candidate_feedback.get("rating") if candidate_feedback else "N/A",
            hourly_rate if is_completed else 0,
            single_session_price if is_completed else 0
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    mentor_name_slug = mentor.get("name", "mentor").replace(" ", "_").lower()
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={mentor_name_slug}_sessions_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# ============ Detailed Feedback Endpoint ============

@router.get("/{mentor_id}/feedback")
async def get_mentor_detailed_feedback(mentor_id: str, request: Request):
    """Get detailed feedback for all sessions conducted by a specific mentor"""
    await verify_admin(request)
    db = get_db(request)
    
    # Get mentor info
    mentor = await db.mentors.find_one({"id": mentor_id})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    
    # Get all coaching sessions for this mentor
    sessions = await db.bookings.find({
        "mentor_id": mentor_id
    }).sort("date", -1).to_list(100)
    
    # Process sessions with feedback
    session_feedback_list = []
    for session in sessions:
        booking_id = session.get("id")
        
        # Get candidate info
        candidate = await db.users.find_one({"id": session.get("user_id")})
        candidate_name = candidate.get("name", "Unknown Candidate") if candidate else "Unknown Candidate"
        
        # Get feedback FROM mentor (what mentor gave to candidate)
        mentor_feedback = await db.mentor_feedback.find_one({"booking_id": booking_id})
        
        # Get feedback TO mentor (what candidate gave to mentor)
        candidate_feedback = await db.candidate_feedback.find_one({"booking_id": booking_id})
        
        # Build feedback data
        has_given_feedback = bool(mentor_feedback or session.get("mentor_feedback_given"))
        has_received_feedback = bool(candidate_feedback or session.get("candidate_feedback_given"))
        
        feedback_given = mentor_feedback or session.get("mentor_feedback", {})
        feedback_received = candidate_feedback or session.get("candidate_feedback", {})
        
        session_feedback_list.append({
            "session_id": booking_id,
            "date": session.get("date"),
            "time": session.get("time"),
            "candidate_name": candidate_name,
            "case_type": feedback_given.get("case_type", session.get("case_type", "N/A")),
            "status": session.get("status", "pending"),
            "has_given_feedback": has_given_feedback,
            "has_received_feedback": has_received_feedback,
            "feedback_given": {
                "ratings": {
                    "scoping_questions": feedback_given.get("rating_scoping_questions", 0),
                    "case_structure": feedback_given.get("rating_case_structure", 0),
                    "quantitative": feedback_given.get("rating_quantitative", 0) if feedback_given.get("quantitative_tested", True) else None,
                    "communication": feedback_given.get("rating_communication", 0),
                    "business_acumen": feedback_given.get("rating_business_acumen", 0),
                    "overall": feedback_given.get("rating_overall", 0)
                },
                "qualitative_feedback": feedback_given.get("qualitative_feedback", ""),
                "quantitative_tested": feedback_given.get("quantitative_tested", True)
            } if has_given_feedback else None,
            "feedback_received": {
                "mentor_followed_instructions": feedback_received.get("mentor_followed_instructions", None),
                "ratings": {
                    "facilitation_style": feedback_received.get("rating_facilitation_style", 0),
                    "feedback_quality": feedback_received.get("rating_feedback_quality", 0),
                    "overall": feedback_received.get("rating_overall", 0)
                },
                "other_feedback": feedback_received.get("other_feedback", "")
            } if has_received_feedback else None
        })
    
    # Calculate summary statistics
    sessions_with_feedback_given = [s for s in session_feedback_list if s["has_given_feedback"]]
    sessions_with_feedback_received = [s for s in session_feedback_list if s["has_received_feedback"]]
    
    avg_rating_received = 0
    if sessions_with_feedback_received:
        total_ratings = sum([s["feedback_received"]["ratings"]["overall"] for s in sessions_with_feedback_received])
        avg_rating_received = round(total_ratings / len(sessions_with_feedback_received), 2)
    
    return {
        "mentor_id": mentor_id,
        "mentor_name": mentor.get("name"),
        "sessions": session_feedback_list,
        "summary": {
            "total_sessions": len(sessions),
            "sessions_with_feedback_given": len(sessions_with_feedback_given),
            "sessions_with_feedback_received": len(sessions_with_feedback_received),
            "avg_rating_from_candidates": avg_rating_received,
            "feedback_completion_rate": round(
                (len(sessions_with_feedback_given) / len(sessions) * 100) if len(sessions) > 0 else 0, 
                2
            )
        }
    }

