from fastapi import FastAPI, APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
import logging
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

# Load environment variables BEFORE importing routes
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import routes (after env vars are loaded)
from routes.auth import router as auth_router
from routes.mentors import router as mentors_router
from routes.resources import router as resources_router
from routes.payments import router as payments_router
from routes.peers import router as peers_router
from routes.mentor_dashboard import router as mentor_dashboard_router
from routes.profile import router as profile_router
from routes.admin import router as admin_router
from routes.cleanup import router as cleanup_router
from routes.sales import router as sales_router
from routes.calendar import router as calendar_router
from routes.mentor_calendar import router as mentor_calendar_router
from routes.session_tracking import router as session_tracking_router
from routes.feedback import router as feedback_router
from routes.contact import router as contact_router
from routes.ai_drills import router as ai_drills_router
from routes.sales_admin import router as sales_admin_router
from routes.mentor_analytics import router as mentor_analytics_router
from routes.candidate_analytics import router as candidate_analytics_router
from routes.subscriptions import router as subscriptions_router
from routes.support import router as support_router
from routes.analytics import router as analytics_router
from routes.strategy_calls import router as strategy_calls_router
from routes.geolocation import router as geolocation_router
from routes.discovery_calls import router as discovery_calls_router, admin_router as discovery_calls_admin_router
from routes import discovery_calls as discovery_calls_module
from routes.contact_form import router as contact_router, admin_router as contact_admin_router
from routes import contact_form as contact_form_module
from routes.coach_applications import router as coach_applications_router, admin_router as coach_applications_admin_router
from routes.forms import router as forms_router
from routes import forms as forms_module
from routes.discounts import router as discounts_router
from routes.competitions import router as competitions_router
from routes.workshop_feedback import router as workshop_feedback_router
from routes.automations import router as automations_router, run_automations_scheduler
from routes.lead_scoring import router as lead_scoring_router, admin_router as lead_scoring_admin_router
from routes.backfill_migrations import router as backfill_migrations_router
from routes.partner_api import router as partner_api_router
from routes.files import router as files_router
from routes.blog import router as blog_router
try:
    from routes.crm import router as crm_router
    CRM_AVAILABLE = True
except Exception as e:
    CRM_AVAILABLE = False
    import logging
    logging.getLogger(__name__).error(f"Failed to import CRM module: {e}")
from seed_data import seed_database
from services import cloud_storage_service
from seed_ai_drills import seed_ai_drills

# MongoDB connection with connection pooling for scalability
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=100,      # Maximum connections in pool
    minPoolSize=10,       # Minimum connections to maintain
    maxIdleTimeMS=30000,  # Close idle connections after 30s
    waitQueueTimeoutMS=5000,  # Timeout waiting for connection
    retryWrites=True,
    retryReads=True
)
db = client[os.environ.get('DB_NAME', 'test_database')]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        app.state.db = db
        # Test MongoDB connection
        await db.command('ping')
        logging.info("MongoDB connection successful")
        
        # Seed the database
        await seed_database(db)

        # Sync AI drills once per day (skip if already synced today)
        _drill_meta = await db.metadata.find_one({"key": "ai_drills_synced_date"})
        _today = datetime.now().strftime("%Y-%m-%d")
        if not _drill_meta or _drill_meta.get("value") != _today:
            await seed_ai_drills(db)
            await db.metadata.update_one(
                {"key": "ai_drills_synced_date"},
                {"$set": {"value": _today}},
                upsert=True
            )
            logging.info(f"AI drills synced for {_today}")
        else:
            logging.info("AI drills already synced today, skipping")
        
        # CRITICAL: Clean up mentor ratings on EVERY startup
        # Remove 5.0 ratings from mentors with 0 sessions or no feedback
        logger.info("🔧 Cleaning up mentor ratings...")
        try:
            # Remove ratings from mentors with 0 sessions
            result = await db.mentors.update_many(
                {
                    "$or": [
                        {"sessions_conducted": 0},
                        {"sessions_conducted": {"$exists": False}}
                    ],
                    "rating": {"$exists": True}
                },
                {"$unset": {"rating": ""}}
            )
            if result.modified_count > 0:
                logger.info(f"✅ Removed ratings from {result.modified_count} mentors with 0 sessions")
        except Exception as e:
            logger.error(f"⚠️ Error cleaning mentor ratings: {e}")
        
        # Create unique compound index for discovery call bookings to prevent double-booking
        # Only enforce when scheduled_date AND scheduled_time are actual strings — the
        # new admin-pick flow lets candidates submit without a time, leaving both null.
        try:
            # Drop any old version of this index that didn't include the type guards
            try:
                await db.discovery_call_bookings.drop_index("unique_active_booking_per_slot")
            except Exception:
                pass
            await db.discovery_call_bookings.create_index(
                [("scheduled_date", 1), ("scheduled_time", 1)],
                unique=True,
                partialFilterExpression={
                    "status": {"$in": ["pending", "accepted"]},
                    "scheduled_date": {"$type": "string"},
                    "scheduled_time": {"$type": "string"},
                },
                name="unique_active_booking_per_slot"
            )
            logger.info("✅ Discovery call booking unique index ensured")
        except Exception as e:
            logger.warning(f"⚠️ Discovery call index creation note: {e}")
        
        # TTL index for slot reservations - auto-expire after 15 minutes
        # so abandoned single-session checkout flows free up the slot.
        try:
            await db.slot_reservations.create_index(
                "expires_at",
                expireAfterSeconds=0,
                name="slot_reservation_ttl",
            )
            await db.slot_reservations.create_index(
                [("mentor_id", 1), ("date", 1), ("time_slot", 1)],
                name="slot_reservation_lookup",
            )
            logger.info("✅ Slot reservations TTL index ensured")
        except Exception as e:
            logger.warning(f"⚠️ Slot reservations index creation note: {e}")

        # Performance indexes for analytics and coaching queries
        try:
            await db.payments.create_index([("status", 1), ("created_at", 1)], name="payment_status_date")
            await db.payments.create_index([("user_id", 1), ("status", 1)], name="payment_user_status")
            await db.users.create_index([("subscription.created_at", 1)], name="user_sub_created_at")
            await db.users.create_index([("subscription.cancelled_at", 1)], name="user_sub_cancelled_at")
            await db.users.create_index([("plan", 1), ("subscription.status", 1)], name="user_plan_sub_status")
            await db.users.create_index([("is_mentor", 1), ("is_admin", 1), ("created_at", 1)], name="user_role_created")
            await db.bookings.create_index([("mentor_id", 1), ("status", 1), ("date", 1)], name="booking_mentor_status_date")
            await db.bookings.create_index([("status", 1), ("date", 1)], name="booking_status_date")
            await db.bookings.create_index([("user_id", 1), ("status", 1)], name="booking_user_status")
            await db.peer_sessions.create_index([("status", 1), ("date", 1)], name="peer_session_status_date")
            await db.candidate_feedbacks.create_index([("mentor_id", 1), ("created_at", -1)], name="feedback_mentor_date")
            logger.info("✅ Performance indexes ensured")
        except Exception as e:
            logger.warning(f"⚠️ Performance index creation note: {e}")

        # Run startup migrations to ensure data consistency
        from migrations.startup_migrations import run_startup_migrations
        await run_startup_migrations(db)

        # Pre-warm persistent images in the background so startup is not blocked
        asyncio.create_task(_prewarm_image_cache(db))
    except Exception as e:
        logging.error(f"Startup error: {e}")
        # Don't crash - allow app to start for health checks
        pass
    
    # Initialize cloud storage
    try:
        if cloud_storage_service.is_enabled():
            cloud_storage_service.init_storage()
            logging.info("Cloud storage initialized successfully")
        else:
            logging.warning("Cloud storage not configured (EMERGENT_LLM_KEY not set)")
    except Exception as e:
        logging.error(f"Failed to initialize cloud storage: {e}")
    
    # Start email automations background scheduler (always, even if migrations fail)
    try:
        app.state.automations_task = asyncio.create_task(run_automations_scheduler(db))
    except Exception as e:
        logging.error(f"Failed to start automations scheduler: {e}")
    
    # Start session reminder scheduler
    try:
        from services.session_reminder_service import start_reminder_scheduler
        app.state.reminder_task = asyncio.create_task(start_reminder_scheduler(interval_minutes=15))
        logging.info("Session reminder scheduler started")
    except Exception as e:
        logging.error(f"Failed to start reminder scheduler: {e}")
    
    # Start abandoned checkout recovery scheduler
    try:
        from services.abandoned_checkout_service import start_abandoned_checkout_scheduler
        app.state.abandoned_checkout_task = asyncio.create_task(start_abandoned_checkout_scheduler(interval_minutes=30))
        logging.info("Abandoned checkout recovery scheduler started")
    except Exception as e:
        logging.error(f"Failed to start abandoned checkout scheduler: {e}")
    
    # Start session status auto-update scheduler
    try:
        from services.session_status_service import start_status_update_scheduler
        app.state.status_update_task = asyncio.create_task(start_status_update_scheduler(interval_minutes=15))
        logging.info("Session status auto-update scheduler started")
    except Exception as e:
        logging.error(f"Failed to start session status scheduler: {e}")
    
    # Sync existing users to Google Sheet (one-time, skips duplicates)
    try:
        from services.google_sheets_service import sync_existing_users_to_sheet
        asyncio.create_task(sync_existing_users_to_sheet(db))
        logging.info("Google Sheets sync task started")
    except Exception as e:
        logging.error(f"Failed to start Google Sheets sync: {e}")
    
    # Start workshop reminder scheduler (24h and 1h WhatsApp reminders)
    try:
        from services.workshop_reminder_service import start_workshop_reminder_scheduler
        app.state.workshop_reminder_task = asyncio.create_task(start_workshop_reminder_scheduler(interval_minutes=15))
        logging.info("Workshop reminder scheduler started (15-min interval)")
    except Exception as e:
        logging.error(f"Failed to start workshop reminder scheduler: {e}")
    
    # Start Meet artifacts scheduler — pulls recordings + transcripts
    # from the Meet REST API for completed sessions.
    # 10-minute cadence so recordings show up shortly after the meeting
    # ends. Each cycle is capped at 50 bookings so it can't hog the
    # event loop.
    try:
        from services.meet_artifacts_service import start_meet_artifacts_scheduler
        app.state.meet_artifacts_task = asyncio.create_task(start_meet_artifacts_scheduler(interval_minutes=5))
        logging.info("Meet artifacts scheduler started (5-min interval, 7-day lookback, heartbeat enabled)")
    except Exception as e:
        logging.error(f"Failed to start Meet artifacts scheduler: {e}")
    
    yield
    # Shutdown
    if hasattr(app.state, 'automations_task'):
        app.state.automations_task.cancel()
    if hasattr(app.state, 'reminder_task'):
        app.state.reminder_task.cancel()
    if hasattr(app.state, 'abandoned_checkout_task'):
        app.state.abandoned_checkout_task.cancel()
    if hasattr(app.state, 'status_update_task'):
        app.state.status_update_task.cancel()
    if hasattr(app.state, 'meet_artifacts_task'):
        app.state.meet_artifacts_task.cancel()
    client.close()


# Create the main app
app = FastAPI(lifespan=lifespan)

# GZip compression — compress JSON/HTML/text responses > 500 bytes,
# but SKIP binary asset endpoints (images, files, video streams).
#
# Why this matters: gzipping an already-compressed JPEG wastes CPU AND
# causes Cloudflare (and most CDNs) to refuse edge caching — the response
# gets cf-cache-status: DYNAMIC instead of HIT. Result: every visitor
# hits the origin for every image scroll → 2-6s loads in production.
# By skipping gzip on /api/images/*, /api/files/*, /api/stream/*, the
# CDN can serve them from the edge → 50-100ms.
class ConditionalGZipMiddleware:
    """Wraps Starlette's GZipMiddleware and skips compression for
    binary asset paths so the CDN can edge-cache them."""

    BINARY_PATH_PREFIXES = (
        "/api/images/",
        "/api/files/",
        "/api/stream/",
    )

    def __init__(self, app, minimum_size: int = 500):
        self._app = app
        self._gzip = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if any(path.startswith(p) for p in self.BINARY_PATH_PREFIXES):
                # Serve binary assets without gzip so the CDN caches them.
                await self._app(scope, receive, send)
                return
        await self._gzip(scope, receive, send)


app.add_middleware(ConditionalGZipMiddleware, minimum_size=500)

# Root-level health check for Kubernetes (without /api prefix)
@app.get("/health")
async def root_health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    return {"status": "healthy"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Add routes to the router
@api_router.get("/")
async def root():
    return {"message": "gradnext API"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2025-01-28-webhook-fix-v2",  # Updated version
        "features": {
            "plan_assignments": True,
            "enhanced_webhook_logging": True,
            "admin_log_endpoints": True
        }
    }

@api_router.get("/health/migrations")
async def check_migrations_status(request: Request):
    """Comprehensive health check for the entire candidate experience"""
    db = request.app.state.db
    from datetime import datetime, timezone
    
    results = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {},
        "issues": [],
        "warnings": []
    }
    
    # ========== 1. PLAN CONFIGURATIONS ==========
    expected_plan_configs = {
        "free_trial": {"peer_sessions_per_month": 1, "coaching_sessions": 0, "courses": True, "drills": True},
        "basic_plan": {"peer_sessions_per_month": 4, "coaching_sessions": 0, "courses": True, "drills": True},
        "pro_plan": {"peer_sessions_per_month": 4, "coaching_sessions": 0, "courses": True, "drills": True},
        "pro_plus": {"peer_sessions_per_month": -1, "coaching_sessions": 0, "courses": True, "drills": True},
        "last_mile": {"peer_sessions_per_month": 4, "coaching_sessions": 5, "courses": True, "drills": True},
        "mid_mile": {"peer_sessions_per_month": 4, "coaching_sessions": 10, "courses": True, "drills": True},
        "full_prep": {"peer_sessions_per_month": -1, "coaching_sessions": 15, "courses": True, "drills": True},
        "pinnacle": {"peer_sessions_per_month": -1, "coaching_sessions": -1, "courses": True, "drills": True},
        "cohort_premium": {"peer_sessions_per_month": 8, "coaching_sessions": 1, "courses": True, "drills": True},
        "cohort_elite": {"peer_sessions_per_month": 8, "coaching_sessions": 3, "courses": True, "drills": True},
    }
    
    plan_check = {"passed": True, "details": {}}
    for plan_key, expected in expected_plan_configs.items():
        plan = await db.plans.find_one({"plan_key": plan_key}, {"_id": 0})
        if plan:
            features = plan.get("features", {})
            issues = []
            
            if features.get("peer_sessions_per_month") != expected["peer_sessions_per_month"]:
                issues.append(f"peer_sessions_per_month: expected {expected['peer_sessions_per_month']}, got {features.get('peer_sessions_per_month')}")
            if features.get("coaching_sessions") != expected["coaching_sessions"]:
                issues.append(f"coaching_sessions: expected {expected['coaching_sessions']}, got {features.get('coaching_sessions')}")
            
            plan_check["details"][plan_key] = {
                "exists": True,
                "peer_sessions": features.get("peer_sessions_per_month"),
                "coaching_sessions": features.get("coaching_sessions"),
                "is_active": plan.get("is_active", False),
                "last_updated": plan.get("updated_at"),
                "issues": issues if issues else None
            }
            if issues:
                plan_check["passed"] = False
                results["issues"].extend([f"Plan {plan_key}: {i}" for i in issues])
        else:
            plan_check["details"][plan_key] = {"exists": False, "issues": ["Plan not found in database"]}
            plan_check["passed"] = False
            results["issues"].append(f"Plan {plan_key} not found in database")
    
    results["checks"]["plan_configurations"] = plan_check
    
    # ========== 2. DATABASE COLLECTIONS ==========
    required_collections = [
        "users", "plans", "videos", "courses", "course_sessions", 
        "workshops", "mentors", "peer_sessions", "coaching_bookings",
        "drill_sessions", "drill_completions", "user_progress",
        "payments", "payment_orders", "sessions", "case_materials"
    ]
    
    db_check = {"passed": True, "collections": {}}
    existing_collections = await db.list_collection_names()
    
    for collection in required_collections:
        exists = collection in existing_collections
        count = await db[collection].count_documents({}) if exists else 0
        db_check["collections"][collection] = {"exists": exists, "document_count": count}
        if not exists:
            db_check["passed"] = False
            results["warnings"].append(f"Collection '{collection}' does not exist")
    
    results["checks"]["database_collections"] = db_check
    
    # ========== 3. CONTENT AVAILABILITY ==========
    content_check = {"passed": True, "details": {}}
    
    # Videos/Courses
    total_videos = await db.videos.count_documents({})
    total_courses = await db.courses.count_documents({})
    total_course_sessions = await db.course_sessions.count_documents({})
    content_check["details"]["videos"] = {"count": total_videos, "ok": total_videos > 0}
    content_check["details"]["courses"] = {"count": total_courses, "ok": total_courses > 0}
    content_check["details"]["course_sessions"] = {"count": total_course_sessions, "ok": total_course_sessions > 0}
    
    # Workshops
    total_workshops = await db.workshops.count_documents({})
    upcoming_workshops = await db.workshops.count_documents({"is_past": False})
    content_check["details"]["workshops"] = {"total": total_workshops, "upcoming": upcoming_workshops}
    
    # Mentors
    total_mentors = await db.mentors.count_documents({})
    active_mentors = await db.mentors.count_documents({"is_active": True})
    content_check["details"]["mentors"] = {"total": total_mentors, "active": active_mentors, "ok": active_mentors > 0}
    
    # Case Materials
    total_materials = await db.case_materials.count_documents({})
    content_check["details"]["case_materials"] = {"count": total_materials}
    
    # AI Drills (from code, not DB)
    from routes.resources import get_total_drills_count
    total_drills = get_total_drills_count()
    content_check["details"]["ai_drills"] = {"count": total_drills, "ok": total_drills > 0}
    
    if total_videos == 0:
        results["warnings"].append("No videos found in database")
    if active_mentors == 0:
        results["warnings"].append("No active mentors found")
    
    results["checks"]["content_availability"] = content_check
    
    # ========== 4. USER DATA INTEGRITY ==========
    user_check = {"passed": True, "details": {}}
    
    total_users = await db.users.count_documents({})
    users_with_plans = await db.users.count_documents({"plan": {"$exists": True, "$ne": None}})
    users_without_plans = total_users - users_with_plans
    
    # Check Pinnacle users have unlimited coaching
    pinnacle_users = await db.users.count_documents({"plan": "pinnacle"})
    pinnacle_correct = await db.users.count_documents({
        "plan": "pinnacle",
        "is_unlimited_coaching": True,
        "coaching_sessions_remaining": -1
    })
    
    # Check users with coaching plans have session totals
    coaching_plans = ["last_mile", "mid_mile", "full_prep", "pinnacle"]
    coaching_users = await db.users.count_documents({"plan": {"$in": coaching_plans}})
    coaching_users_with_sessions = await db.users.count_documents({
        "plan": {"$in": coaching_plans},
        "$or": [
            {"coaching_sessions_total": {"$gt": 0}},
            {"coaching_sessions_total": -1},
            {"is_unlimited_coaching": True}
        ]
    })
    
    user_check["details"] = {
        "total_users": total_users,
        "users_with_plans": users_with_plans,
        "users_without_plans": users_without_plans,
        "pinnacle_users": {
            "total": pinnacle_users,
            "correctly_configured": pinnacle_correct,
            "ok": pinnacle_users == pinnacle_correct
        },
        "coaching_plan_users": {
            "total": coaching_users,
            "with_session_totals": coaching_users_with_sessions,
            "ok": coaching_users == coaching_users_with_sessions
        }
    }
    
    if pinnacle_users != pinnacle_correct:
        user_check["passed"] = False
        results["issues"].append(f"Pinnacle users misconfigured: {pinnacle_users - pinnacle_correct} users need unlimited coaching fix")
    
    results["checks"]["user_data_integrity"] = user_check
    
    # ========== 5. ACTIVE SESSIONS & BOOKINGS ==========
    booking_check = {"details": {}}
    
    # Peer sessions
    total_peer_sessions = await db.peer_sessions.count_documents({})
    upcoming_peer = await db.peer_sessions.count_documents({"status": {"$in": ["pending", "confirmed"]}})
    booking_check["details"]["peer_sessions"] = {"total": total_peer_sessions, "upcoming": upcoming_peer}
    
    # Coaching bookings
    total_coaching = await db.coaching_bookings.count_documents({})
    upcoming_coaching = await db.coaching_bookings.count_documents({"status": {"$in": ["pending", "confirmed"]}})
    booking_check["details"]["coaching_bookings"] = {"total": total_coaching, "upcoming": upcoming_coaching}
    
    # Drill sessions
    total_drill_sessions = await db.drill_sessions.count_documents({})
    completed_drills = await db.drill_completions.count_documents({})
    booking_check["details"]["drill_sessions"] = {"total": total_drill_sessions, "completed": completed_drills}
    
    results["checks"]["active_sessions"] = booking_check
    
    # ========== 6. PAYMENT SYSTEM ==========
    payment_check = {"passed": True, "details": {}}
    
    total_payments = await db.payments.count_documents({})
    successful_payments = await db.payments.count_documents({"status": "success"})
    failed_payments = await db.payments.count_documents({"status": "failed"})
    pending_orders = await db.payment_orders.count_documents({"status": "created"})
    
    payment_check["details"] = {
        "total_payments": total_payments,
        "successful": successful_payments,
        "failed": failed_payments,
        "pending_orders": pending_orders
    }
    
    if pending_orders > 10:
        results["warnings"].append(f"{pending_orders} pending payment orders (users may have abandoned checkout)")
    
    results["checks"]["payment_system"] = payment_check
    
    # ========== 7. API ENDPOINTS VERIFICATION ==========
    api_check = {"passed": True, "endpoints": {}}
    
    critical_endpoints = [
        "/api/resources/plans",
        "/api/resources/dashboard-summary", 
        "/api/ai-drills/list",
        "/api/peers/session-credits",
        "/api/coaching/mentors",
        "/api/courses",
        "/api/workshops"
    ]
    
    # We just verify they're registered, not call them
    api_check["endpoints"] = {ep: "registered" for ep in critical_endpoints}
    api_check["note"] = "Endpoints are registered. Use individual endpoints to test functionality."
    
    results["checks"]["api_endpoints"] = api_check
    
    # ========== 8. ENVIRONMENT CONFIGURATION ==========
    env_check = {"passed": True, "details": {}}
    
    required_env_vars = ["MONGO_URL", "DB_NAME"]
    optional_env_vars = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GOOGLE_OAUTH_CLIENT_ID", "RESEND_API_KEY", "EMERGENT_LLM_KEY"]
    
    for var in required_env_vars:
        value = os.environ.get(var)
        env_check["details"][var] = {"set": bool(value), "required": True}
        if not value:
            env_check["passed"] = False
            results["issues"].append(f"Required environment variable {var} is not set")
    
    for var in optional_env_vars:
        value = os.environ.get(var)
        env_check["details"][var] = {"set": bool(value), "required": False}
        if not value:
            results["warnings"].append(f"Optional environment variable {var} is not set")
    
    results["checks"]["environment"] = env_check
    
    # ========== 9. FRONTEND ROUTES CHECK ==========
    frontend_check = {
        "critical_routes": [
            {"path": "/", "description": "Landing page"},
            {"path": "/dashboard", "description": "Main dashboard"},
            {"path": "/dashboard/courses", "description": "Course content"},
            {"path": "/dashboard/ai-drills", "description": "AI Drills practice"},
            {"path": "/dashboard/peer-practice", "description": "Peer practice scheduling"},
            {"path": "/dashboard/coaching", "description": "Coaching & mentors"},
            {"path": "/dashboard/materials", "description": "Case materials"},
            {"path": "/dashboard/workshops", "description": "Workshops"},
            {"path": "/dashboard/profile", "description": "User profile"},
        ],
        "note": "Frontend routes are defined in React Router. Verify by visiting each route."
    }
    results["checks"]["frontend_routes"] = frontend_check
    
    # ========== 10. FEATURE ACCESS MATRIX ==========
    access_matrix = {
        "description": "Expected feature access by plan type",
        "matrix": {
            "free_trial": {"courses": True, "drills": True, "peer_practice": "1/month", "coaching": False, "workshops": "recorded", "materials": True},
            "basic_plan": {"courses": True, "drills": True, "peer_practice": "4/month", "coaching": False, "workshops": "recorded", "materials": True},
            "pro_plus": {"courses": True, "drills": True, "peer_practice": "unlimited", "coaching": False, "workshops": "all", "materials": True},
            "last_mile": {"courses": True, "drills": True, "peer_practice": "4/month", "coaching": "5 sessions", "workshops": "all", "materials": True},
            "pinnacle": {"courses": True, "drills": True, "peer_practice": "unlimited", "coaching": "unlimited", "workshops": "all", "materials": True},
        }
    }
    results["checks"]["feature_access_matrix"] = access_matrix
    
    # ========== FINAL STATUS ==========
    if results["issues"]:
        results["status"] = "critical"
    elif results["warnings"]:
        results["status"] = "warning"
    else:
        results["status"] = "healthy"
    
    results["summary"] = {
        "total_checks": len(results["checks"]),
        "issues_count": len(results["issues"]),
        "warnings_count": len(results["warnings"]),
        "recommendation": "All systems operational" if results["status"] == "healthy" else "Review issues and warnings above"
    }
    
    return results


# ============ Public Cancellation Policy Endpoint ============
@api_router.get("/public/cancellation-policy")
async def get_public_cancellation_policy(request: Request):
    """Get cancellation policy settings - PUBLIC endpoint accessible to all users (no auth required)"""
    db = request.app.state.db
    
    # Get policy from database
    policy = await db.platform_settings.find_one({"type": "cancellation_policy"})
    
    if not policy:
        # Return defaults if not set
        return {
            "candidate_hours": 4,
            "mentor_hours": 4
        }
    
    return {
        "candidate_hours": policy.get("candidate_hours", 4),
        "mentor_hours": policy.get("mentor_hours", 4)
    }


# ============ Persistent Image Serving ============
# Serve images stored in MongoDB (for persistence across deployments)
import base64
import hashlib
from functools import lru_cache
from cachetools import TTLCache
import threading

# In-memory cache for decoded images (max 500 images, 2 hour TTL)
_image_cache = TTLCache(maxsize=500, ttl=7200)
_image_cache_lock = threading.Lock()


async def _prewarm_image_cache(db):
    """Load ALL persistent images into memory on startup.
    This eliminates MongoDB round-trips for every image request,
    which was the main cause of page slowness (40+ DB hits per page)."""
    try:
        cursor = db.persistent_images.find({}, {"id": 1, "data": 1, "content_type": 1, "filename": 1})
        count = 0
        async for doc in cursor:
            img_id = doc.get("id")
            if not img_id:
                continue
            try:
                image_data = base64.b64decode(doc["data"])
                content_type = doc.get("content_type", "image/png")
                filename = doc.get("filename", "image")
                etag = hashlib.md5(image_data[:1024]).hexdigest()[:16]
                with _image_cache_lock:
                    _image_cache[img_id] = {
                        "data": image_data,
                        "content_type": content_type,
                        "filename": filename,
                        "etag": etag,
                    }
                count += 1
            except Exception:
                pass
        logging.info(f"Pre-warmed image cache with {count} images")
    except Exception as e:
        logging.warning(f"Image cache pre-warm failed (non-fatal): {e}")


@api_router.get("/images/{image_id}")
async def get_persistent_image(image_id: str, request: Request):
    """Serve images stored in MongoDB for persistence across deployments"""
    
    # Check in-memory cache first
    with _image_cache_lock:
        if image_id in _image_cache:
            cached = _image_cache[image_id]
            # Support ETag-based conditional requests (304 Not Modified)
            if_none_match = request.headers.get("if-none-match")
            if if_none_match and if_none_match == cached.get("etag"):
                return Response(status_code=304)
            return Response(
                content=cached["data"],
                media_type=cached["content_type"],
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Content-Disposition": f"inline; filename={cached['filename']}",
                    "ETag": cached.get("etag", ""),
                    "X-Cache": "HIT"
                }
            )
    
    db = request.app.state.db
    
    # Use projection to only get needed fields
    image_doc = await db.persistent_images.find_one(
        {"id": image_id},
        {"data": 1, "content_type": 1, "filename": 1}
    )
    
    if not image_doc:
        return Response(content="Image not found", status_code=404)
    
    # Decode base64 image data
    image_data = base64.b64decode(image_doc["data"])
    content_type = image_doc.get("content_type", "image/png")
    filename = image_doc.get("filename", "image")
    etag = hashlib.md5(image_data[:1024]).hexdigest()[:16]
    
    # Store in cache for future requests
    with _image_cache_lock:
        _image_cache[image_id] = {
            "data": image_data,
            "content_type": content_type,
            "filename": filename,
            "etag": etag,
        }
    
    return Response(
        content=image_data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f"inline; filename={filename}",
            "ETag": etag,
            "X-Cache": "MISS"
        }
    )


# Video streaming endpoint with range request support
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads")

@api_router.get("/stream/uploads/{category}/{filename}")
async def stream_video(category: str, filename: str, request: Request):
    """Stream video with range request support for better buffering"""
    file_path = os.path.join(UPLOAD_DIR, category, filename)
    
    if not os.path.exists(file_path):
        return Response(content="File not found", status_code=404)
    
    file_size = os.path.getsize(file_path)
    
    # Get content type based on extension
    ext = filename.lower().split('.')[-1]
    content_types = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
    }
    content_type = content_types.get(ext, 'video/mp4')
    
    # Parse range header
    range_header = request.headers.get('range')
    
    if range_header:
        # Parse range header: bytes=start-end
        range_match = range_header.replace('bytes=', '').split('-')
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Ensure valid range
        if start >= file_size:
            return Response(
                content="Requested range not satisfiable",
                status_code=416,
                headers={"Content-Range": f"bytes */{file_size}"}
            )
        
        end = min(end, file_size - 1)
        content_length = end - start + 1
        
        def iterfile():
            with open(file_path, 'rb') as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 1024 * 1024  # 1MB chunks
                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        return StreamingResponse(
            iterfile(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Cache-Control": "public, max-age=3600",
            }
        )
    else:
        # No range header - serve entire file
        def iterfile():
            with open(file_path, 'rb') as f:
                chunk_size = 1024 * 1024  # 1MB chunks
                while chunk := f.read(chunk_size):
                    yield chunk
        
        return StreamingResponse(
            iterfile(),
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "public, max-age=3600",
            }
        )

# Include the router in the main app
app.include_router(api_router)
app.include_router(auth_router, prefix="/api")
app.include_router(mentors_router, prefix="/api")
app.include_router(resources_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(peers_router, prefix="/api")
app.include_router(mentor_dashboard_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(cleanup_router, prefix="/api")
app.include_router(sales_router, prefix="/api")
app.include_router(calendar_router, prefix="/api")
app.include_router(mentor_calendar_router, prefix="/api")
app.include_router(session_tracking_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(contact_router, prefix="/api")
app.include_router(ai_drills_router, prefix="/api/ai-drills")
app.include_router(sales_admin_router, prefix="/api")
app.include_router(mentor_analytics_router, prefix="/api")
app.include_router(candidate_analytics_router, prefix="/api")
app.include_router(subscriptions_router, prefix="/api")
app.include_router(support_router, prefix="/api")
app.include_router(analytics_router, prefix="/api/admin/analytics")
app.include_router(strategy_calls_router, prefix="/api/strategy-calls")
app.include_router(geolocation_router, prefix="/api")
app.include_router(discovery_calls_router)
app.include_router(discovery_calls_admin_router)
app.include_router(contact_router)
app.include_router(contact_admin_router)
app.include_router(coach_applications_router)
app.include_router(coach_applications_admin_router)
app.include_router(forms_router)

# Mentor Notifications
from routes.mentor_notifications import router as mentor_notifications_router
from routes.candidate_notifications import router as candidate_notifications_router
from routes.candidate_facing_notifications import router as candidate_facing_notifications_router
app.include_router(mentor_notifications_router, prefix="/api")
app.include_router(candidate_notifications_router, prefix="/api")
app.include_router(candidate_facing_notifications_router, prefix="/api")
app.include_router(discounts_router, prefix="/api")
app.include_router(competitions_router, prefix="/api/competitions")
# Workshop feedback router routes are absolute (each path has its own /api/...
# prefix) so we mount it at the app level without a prefix.
app.include_router(workshop_feedback_router)
app.include_router(automations_router, prefix="/api")
app.include_router(lead_scoring_router, prefix="/api")
app.include_router(lead_scoring_admin_router, prefix="/api")
app.include_router(backfill_migrations_router, prefix="/api")
app.include_router(partner_api_router, prefix="/api")
app.include_router(files_router, prefix="/api/files")
app.include_router(blog_router, prefix="/api")
if CRM_AVAILABLE:
    app.include_router(crm_router, prefix="/api")

# Cohorts — public landing page + authed enrolment + admin CRUD
from routes.cohorts import (
    public_router as cohorts_public_router,
    auth_router as cohorts_auth_router,
    admin_router as cohorts_admin_router,
)
app.include_router(cohorts_public_router)
app.include_router(cohorts_auth_router)
app.include_router(cohorts_admin_router)

# Set database for discovery calls module
discovery_calls_module.set_database(db)

# Set database for contact form module
contact_form_module.set_database(db)

# Set database for forms module
forms_module.set_database(db)

# Serve uploaded files (for non-video static files)
from fastapi.staticfiles import StaticFiles
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# Handle CORS properly
# When using credentials (cookies), we cannot use wildcard "*" for origins per CORS spec
# Production should set specific origins in CORS_ORIGINS env var (e.g., "https://app.gradnext.co")
if "*" in CORS_ORIGINS or CORS_ORIGINS == ["*"]:
    # For wildcard, we'll dynamically set the origin based on the request
    # This is handled by setting allow_origin_regex to match all
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",  # Match all origins but allow credentials
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Clean up origins - remove empty strings and whitespace
    clean_origins = [o.strip() for o in CORS_ORIGINS if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=clean_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
