"""
Startup Migrations
These migrations run automatically when the backend starts to ensure database consistency.
This ensures production database matches expected configuration after each deployment.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Default plan configurations - created ONCE on initial deployment
# After creation, these plans are managed via admin panel
# Manual changes from admin panel will persist across deployments
PLAN_CONFIGURATIONS = {
    # SUBSCRIPTION PLANS
    "free_trial": {
        "name": "Free Trial",
        "category": "subscription",
        "is_visible": False,  # Hidden by default
        "features": {
            "peer_sessions_per_month": 1,
            "coaching_sessions": 0,
            "strategy_calls": 0,
        }
    },
    "basic_plan": {
        "name": "Basic Plan",
        "category": "subscription",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 4,
            "coaching_sessions": 0,
            "strategy_calls": 0,
        }
    },
    "pro_plan": {
        "name": "Pro Plan",
        "category": "subscription",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 4,
            "coaching_sessions": 0,
            "strategy_calls": 1,
        }
    },
    "pro_plus": {
        "name": "Pro+",
        "category": "subscription",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": -1,  # Unlimited
            "coaching_sessions": 0,
            "strategy_calls": 2,
        }
    },
    # COACHING PLANS
    "last_mile": {
        "name": "Last Mile",
        "category": "coaching",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 4,
            "coaching_sessions": 5,
            "strategy_calls": 1,
        }
    },
    "mid_mile": {
        "name": "Mid Mile",
        "category": "coaching",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 4,
            "coaching_sessions": 10,
            "strategy_calls": 2,
        }
    },
    "full_prep": {
        "name": "Full Prep",
        "category": "coaching",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": -1,  # Unlimited
            "coaching_sessions": 15,
            "strategy_calls": 3,
        }
    },
    "pinnacle": {
        "name": "Pinnacle",
        "category": "coaching",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": -1,  # Unlimited
            "coaching_sessions": -1,  # Unlimited
            "strategy_calls": 4,
        }
    },
    # COHORT PLANS
    "cohort_premium": {
        "name": "Cohort Premium",
        "category": "cohort",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 8,
            "coaching_sessions": 1,
            "strategy_calls": 1,
        }
    },
    "cohort_elite": {
        "name": "Cohort Elite",
        "category": "cohort",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": 8,
            "coaching_sessions": 3,
            "strategy_calls": 2,
        }
    },
    # ADDON PLANS
    "addon_peer_session": {
        "name": "Peer-to-Peer Sessions",
        "category": "addon",
        "is_visible": True,
        "features": {
            "peer_sessions_per_month": -1,  # Unlimited
            "coaching_sessions": 0,
            "strategy_calls": 0,
        }
    },
}

# Free trial duration in days
FREE_TRIAL_DAYS = 7


async def run_startup_migrations(db):
    """Run all startup migrations to ensure database consistency"""
    logger.info("Running startup migrations...")
    
    try:
        await migrate_plan_configurations(db)
        await sync_plan_pricing(db)  # Ensure all plans have correct pricing
        await sync_plan_additional_features(db)  # Sync industry_primers, knowledge_sessions
        await migrate_pinnacle_users(db)
        await fix_non_pinnacle_unlimited_users(db)  # Clean up incorrect unlimited flags
        await migrate_coaching_plan_users(db)
        await fix_free_trial_duration(db)  # Fix users with incorrect trial duration
        await migrate_images_to_mongodb(db)  # Migrate file-based images to MongoDB
        await setup_partner_api_collections(db)  # Setup Partner API collections and indexes
        await setup_crm_indexes(db)  # P0: CRM indexes for Leads + Reach Outs speed
        await fix_peer_session_stats(db)  # Fix peer session counts and ratings
        await fix_payments_null_order_id(db)  # Heal payments with null order_id (P0 prod fix)
        await normalize_payment_money_fields(db)  # Convert paisa-stored money fields to rupees (P0 prod fix)
        await backfill_old_meet_access_to_open(db)  # P0: heal "Wait for host" gate on legacy bookings
        logger.info("Startup migrations completed successfully")
    except Exception as e:
        logger.error(f"Startup migrations failed: {e}")
        # Don't raise - allow app to start even if migrations fail
        # This prevents deployment failures due to migration issues


async def normalize_payment_money_fields(db):
    """One-shot heal: rewrite `amount` / `base_amount` / `gst` /
    `gst_amount` on `payment_orders` and `payments` collections so they
    are stored in **rupees** (float, ≥ 0).
    
    Key design: we use the `plans` collection as the source of truth.
    For each record we look up the plan's expected rupee price, then
    decide:
      - amount is within ±5% of (plan_price × 1.18)              → rupees, leave alone
      - amount is within ±5% of (plan_price × 1.18 × 100)        → paisa, divide by 100
      - no plan match (e.g. single-session bookings, top-ups,
        legacy records with weird plan_keys):
            • amount > 50,000                                    → paisa
            • amount_in_paise field present AND equals amount    → paisa
            • else                                               → rupees
    
    This avoids the "₹5,900 → ₹59" false-flag we'd get from the
    blanket `amount % 100 == 0` Razorpay-paisa fingerprint.
    
    Safe to re-run: once converted, records won't trigger any of the
    paisa heuristics on a second pass.
    """
    GST_RATE = 0.18

    # Load plan pricing once
    plan_prices: dict = {}
    async for p in db.plans.find({}, {"_id": 0, "plan_key": 1, "pricing": 1}):
        pk = (p.get("plan_key") or "").lower()
        if not pk:
            continue
        prices: list = []
        for v in (p.get("pricing") or {}).values():
            if isinstance(v, (int, float)) and v > 0:
                prices.append(v)
        if prices:
            plan_prices[pk] = prices

    def _looks_like_rupees(amount: float, plan_key: Optional[str]) -> Optional[bool]:
        """True = rupees, False = paisa, None = can't tell from plan."""
        if plan_key:
            prices = plan_prices.get(plan_key.lower())
            if prices:
                # Use ±5% tolerance to allow for discounts/rounding.
                # We test against ALL pricing variants of the plan
                # (one_month, six_month total, one_time, etc.) so any
                # of them counts as a match.
                for base in prices:
                    rupee_target = base * (1 + GST_RATE)
                    paisa_target = rupee_target * 100
                    # Also accept multi-month totals (e.g. 6-month bundle)
                    for multiplier in (1, 6, 12):
                        for tgt, is_rupee in (
                            (rupee_target * multiplier, True),
                            (paisa_target * multiplier, False),
                            (base * multiplier, True),  # discounted/no-gst variants
                            (base * multiplier * 100, False),
                        ):
                            if tgt == 0:
                                continue
                            if abs(amount - tgt) / tgt < 0.05:
                                return is_rupee
        return None

    def _is_paisa(record) -> bool:
        amt = record.get("amount") or 0
        try:
            amt = float(amt)
        except Exception:  # noqa: BLE001
            return False
        if amt <= 0:
            return False
        # Plan-price match wins
        plan_decision = _looks_like_rupees(amt, record.get("plan_key"))
        if plan_decision is True:
            return False
        if plan_decision is False:
            return True
        # No plan match — fall back to weak signals
        paise_field = record.get("amount_in_paise")
        if paise_field and float(paise_field or 0) == amt:
            return True
        if amt > 50000:
            return True
        return False

    total_fixed = 0
    total_seen = 0
    for coll_name in ("payment_orders", "payments"):
        coll = db[coll_name]
        cursor = coll.find({}, {
            "_id": 1, "amount": 1, "amount_in_paise": 1,
            "base_amount": 1, "gst": 1, "gst_amount": 1, "plan_key": 1,
        })
        async for record in cursor:
            total_seen += 1
            if not _is_paisa(record):
                continue
            try:
                amt_paisa = float(record.get("amount") or 0)
                amt_rupees = round(amt_paisa / 100, 2)
                base = round(amt_rupees / (1 + GST_RATE), 2)
                gst = round(amt_rupees - base, 2)
                update = {
                    "amount": amt_rupees,
                    "base_amount": base,
                    "gst": gst,
                }
                if "gst_amount" in record:
                    update["gst_amount"] = gst
                await coll.update_one({"_id": record["_id"]}, {"$set": update})
                total_fixed += 1
            except Exception as e:  # noqa: BLE001
                logger.warning(f"normalize_payment_money_fields: skipping record in {coll_name} due to {e}")

    if total_fixed:
        logger.info(f"[normalize_payment_money_fields] Healed {total_fixed} record(s) (paisa→rupees) out of {total_seen} scanned")
    else:
        logger.info(f"[normalize_payment_money_fields] No paisa-stored records found ({total_seen} scanned).")


async def fix_payments_null_order_id(db):
    """Backfill `order_id` on `payments` rows that ended up with `null`.
    
    There is a unique non-sparse index on `payments.order_id`. A buggy
    code path (verify-session-with-slot before the Feb-2026 fix) inserted
    payments without `order_id`, which writes `order_id: null`. With a
    unique non-sparse index, only the FIRST such doc can exist; every
    subsequent insert without `order_id` fails with E11000 →500 →
    "Booking finalization failed" on the user's screen even though
    payment was captured.
    
    We heal this by replacing every null/missing `order_id` with the
    record's own `razorpay_order_id` (or, as a last resort, a synthetic
    unique value), so the index has unique values and future inserts
    don't collide.
    """
    try:
        cursor = db.payments.find(
            {"$or": [{"order_id": None}, {"order_id": {"$exists": False}}]},
            {"_id": 1, "razorpay_order_id": 1, "id": 1, "razorpay_payment_id": 1},
        )
        fixed = 0
        async for doc in cursor:
            backfill = (
                doc.get("razorpay_order_id")
                or doc.get("razorpay_payment_id")
                or f"backfill_{doc.get('id') or str(doc.get('_id'))}"
            )
            try:
                await db.payments.update_one({"_id": doc["_id"]}, {"$set": {"order_id": backfill}})
                fixed += 1
            except Exception as e:
                # Likely a duplicate against another row — assign a
                # uniquely-suffixed value so the heal still succeeds.
                logger.warning(f"order_id backfill collision for {doc.get('_id')}: {e}; retrying with suffix")
                import uuid as _uuid
                await db.payments.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"order_id": f"{backfill}_{_uuid.uuid4().hex[:8]}"}},
                )
                fixed += 1
        if fixed:
            logger.info(f"[fix_payments_null_order_id] Healed {fixed} payment record(s) with null order_id")
        else:
            logger.info("[fix_payments_null_order_id] No null order_id payments found.")
    except Exception as e:
        logger.error(f"fix_payments_null_order_id failed: {e}")


# Pricing configurations for all plans
PLAN_PRICING = {
    "free_trial": {"one_month": 0, "six_month": 0, "one_time": 0},
    "basic_plan": {"one_month": 499, "six_month": 399, "one_time": None},
    "pro_plan": {"one_month": 699, "six_month": 549, "one_time": None},
    "pro_plus": {"one_month": 999, "six_month": 799, "one_time": None},
    "last_mile": {"one_month": None, "six_month": None, "one_time": 16999},
    "mid_mile": {"one_month": None, "six_month": None, "one_time": 31999},
    "full_prep": {"one_month": None, "six_month": None, "one_time": 49999},
    "pinnacle": {"one_month": None, "six_month": None, "one_time": 119999},
}

# Additional features for plans (industry_primers, knowledge_sessions)
PLAN_ADDITIONAL_FEATURES = {
    "free_trial": {
        "industry_primers": False,
        "knowledge_sessions": False,
        "peer_sessions_per_month": 0,
    },
    "basic_plan": {
        "industry_primers": False,
        "knowledge_sessions": False,
        "peer_sessions_per_month": 0,
    },
    "pro_plan": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 4,
    },
    "pro_plus": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 8,
    },
    "last_mile": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 999,  # Unlimited
    },
    "mid_mile": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 999,
    },
    "full_prep": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 999,
    },
    "pinnacle": {
        "industry_primers": True,
        "knowledge_sessions": True,
        "peer_sessions_per_month": 999,
    },
}


async def sync_plan_pricing(db):
    """
    Set default pricing for plans that don't have pricing configured.
    Does NOT overwrite existing pricing (preserves manual changes).
    """
    logger.info("Checking plan pricing configurations...")
    
    updated_count = 0
    for plan_key, pricing in PLAN_PRICING.items():
        # Only update if plan exists and doesn't have pricing set
        existing_plan = await db.plans.find_one({"plan_key": plan_key})
        
        if not existing_plan:
            # Plan doesn't exist - skip it
            continue
        
        # Check if pricing is already configured
        if existing_plan.get("pricing"):
            # Pricing already set - preserve manual changes
            continue
        
        # Set default pricing only if not configured
        result = await db.plans.update_one(
            {"plan_key": plan_key},
            {
                "$set": {
                    "pricing": pricing,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        if result.modified_count > 0:
            updated_count += 1
            logger.info(f"Set default pricing for {plan_key}: {pricing}")
    
    if updated_count > 0:
        logger.info(f"Plan pricing: {updated_count} plans configured with default pricing")
    else:
        logger.info("All plans already have pricing configured - no changes made")


async def sync_plan_additional_features(db):
    """
    Set default additional features for plans that don't have them configured.
    Does NOT overwrite existing features (preserves manual changes).
    """
    logger.info("Checking plan additional features...")
    
    updated_count = 0
    for plan_key, features in PLAN_ADDITIONAL_FEATURES.items():
        # Only update if plan exists
        existing_plan = await db.plans.find_one({"plan_key": plan_key})
        
        if not existing_plan:
            # Plan doesn't exist - skip it
            continue
        
        # Check if these features are already configured
        existing_features = existing_plan.get("features", {})
        has_industry_primers = "industry_primers" in existing_features
        has_knowledge_sessions = "knowledge_sessions" in existing_features
        
        if has_industry_primers and has_knowledge_sessions:
            # Features already configured - preserve manual changes
            continue
        
        # Set default features only if not configured
        update_fields = {}
        if not has_industry_primers:
            update_fields["features.industry_primers"] = features["industry_primers"]
        if not has_knowledge_sessions:
            update_fields["features.knowledge_sessions"] = features["knowledge_sessions"]
        
        if update_fields:
            update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            result = await db.plans.update_one(
                {"plan_key": plan_key},
                {"$set": update_fields}
            )
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"Set default additional features for {plan_key}")
    
    if updated_count > 0:
        logger.info(f"Plan additional features: {updated_count} plans configured")
    else:
        logger.info("All plans already have additional features configured - no changes made")


async def migrate_plan_configurations(db):
    """
    Create default plans on first deployment ONLY.
    - Does NOT recreate deleted plans
    - Does NOT overwrite existing plans (preserves manual changes from admin panel)
    - Only creates plans that don't exist in the database
    """
    logger.info("Checking for missing default plans...")
    
    import uuid
    created_count = 0
    
    for plan_key, config in PLAN_CONFIGURATIONS.items():
        # Check if plan already exists (or was deleted)
        existing_plan = await db.plans.find_one({"plan_key": plan_key})
        
        if existing_plan:
            # Plan exists - skip it completely (preserves manual changes)
            continue
        
        # Check if plan was previously deleted (soft delete check)
        deleted_plan = await db.plans.find_one({
            "plan_key": plan_key,
            "is_active": False
        })
        
        if deleted_plan:
            # Plan was soft deleted - don't recreate it
            logger.info(f"Skipping {plan_key} - plan was previously deactivated")
            continue
        
        # Plan doesn't exist - create it with default configuration
        new_plan = {
            "id": str(uuid.uuid4()),
            "plan_key": plan_key,
            "name": config["name"],
            "category": config.get("category", "subscription"),
            "is_visible": config.get("is_visible", True),
            "is_active": True,
            "is_hidden": not config.get("is_visible", True),
            "features": config["features"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.plans.insert_one(new_plan)
        created_count += 1
        logger.info(f"Created default plan: {plan_key} ({config['name']})")
    
    if created_count > 0:
        logger.info(f"Plan configurations: {created_count} new plans created")
    else:
        logger.info("All default plans already exist - no changes made")


async def migrate_pinnacle_users(db):
    """Ensure Pinnacle plan users have unlimited coaching sessions"""
    logger.info("Migrating Pinnacle users...")
    
    result = await db.users.update_many(
        {"plan": "pinnacle"},
        {
            "$set": {
                "coaching_sessions_remaining": -1,
                "coaching_sessions_total": -1,
                "is_unlimited_coaching": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Pinnacle users: {result.modified_count} users updated")


async def fix_non_pinnacle_unlimited_users(db):
    """Fix users who incorrectly have unlimited coaching but are NOT on pinnacle plan"""
    logger.info("Fixing non-pinnacle users with incorrect unlimited coaching...")
    
    # Fix users who have is_unlimited_coaching=True but are NOT pinnacle
    result1 = await db.users.update_many(
        {
            "is_unlimited_coaching": True,
            "plan": {"$nin": ["pinnacle", "Pinnacle"]}
        },
        {
            "$set": {
                "is_unlimited_coaching": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Fix users who have coaching_sessions_remaining=-1 but are NOT pinnacle
    result2 = await db.users.update_many(
        {
            "coaching_sessions_remaining": -1,
            "plan": {"$nin": ["pinnacle", "Pinnacle"]}
        },
        {
            "$set": {
                "coaching_sessions_remaining": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Fix users who have coaching_sessions_total=-1 but are NOT pinnacle
    result3 = await db.users.update_many(
        {
            "coaching_sessions_total": -1,
            "plan": {"$nin": ["pinnacle", "Pinnacle"]}
        },
        {
            "$set": {
                "coaching_sessions_total": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    total_fixed = result1.modified_count + result2.modified_count + result3.modified_count
    if total_fixed > 0:
        logger.info(f"Fixed {total_fixed} non-pinnacle users with incorrect unlimited coaching")
    else:
        logger.info("No non-pinnacle users needed fixing")


async def migrate_coaching_plan_users(db):
    """Ensure users with coaching plans have correct session counts"""
    logger.info("Migrating coaching plan users...")
    
    # Plans that include coaching sessions
    coaching_plans = {
        "last_mile": 5,
        "mid_mile": 10,
        "full_prep": 15,
        "cohort_premium": 1,
        "cohort_elite": 3,
    }
    
    total_updated = 0
    for plan_key, sessions in coaching_plans.items():
        # Only update users who don't have coaching_sessions_total set
        # This preserves any admin-granted extra sessions
        result = await db.users.update_many(
            {
                "plan": plan_key,
                "$or": [
                    {"coaching_sessions_total": {"$exists": False}},
                    {"coaching_sessions_total": None},
                    {"coaching_sessions_total": 0}
                ]
            },
            {
                "$set": {
                    "coaching_sessions_total": sessions,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        total_updated += result.modified_count
    
    logger.info(f"Coaching plan users: {total_updated} users updated")


async def fix_free_trial_duration(db):
    """Fix free trial users who have incorrect plan_end_date (e.g., 30 days instead of 7)"""
    logger.info("Checking free trial duration for all free trial users...")
    
    from datetime import timedelta
    
    # Find all free trial users
    free_trial_users = await db.users.find(
        {"plan": "free_trial"},
        {"_id": 0, "id": 1, "created_at": 1, "plan_start_date": 1, "plan_end_date": 1}
    ).to_list(None)
    
    fixed_count = 0
    
    for user in free_trial_users:
        user_id = user.get("id")
        
        # Determine the start date for the trial
        start_date_str = user.get("plan_start_date") or user.get("created_at")
        if not start_date_str:
            continue
            
        # Parse start date
        if isinstance(start_date_str, str):
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            except:
                continue
        else:
            start_date = start_date_str
        
        # Ensure timezone aware
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        
        # Calculate the correct end date (7 days from start)
        correct_end_date = start_date + timedelta(days=FREE_TRIAL_DAYS)
        
        # Get the current plan_end_date
        current_end_date_str = user.get("plan_end_date")
        
        needs_update = False
        
        if not current_end_date_str:
            # No end date set - set it to correct value
            needs_update = True
        else:
            # Parse current end date
            if isinstance(current_end_date_str, str):
                try:
                    current_end_date = datetime.fromisoformat(current_end_date_str.replace('Z', '+00:00'))
                except:
                    needs_update = True
                    current_end_date = None
            else:
                current_end_date = current_end_date_str
            
            if current_end_date:
                # Ensure timezone aware for comparison
                if current_end_date.tzinfo is None:
                    current_end_date = current_end_date.replace(tzinfo=timezone.utc)
                
                # Check if current end date is significantly different from correct (more than 1 day off)
                diff = abs((current_end_date - correct_end_date).days)
                if diff > 1:
                    needs_update = True
        
        if needs_update:
            # Update the user with correct trial end date
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "plan_end_date": correct_end_date.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            fixed_count += 1
    
    if fixed_count > 0:
        logger.info(f"Fixed free trial duration for {fixed_count} users (set to {FREE_TRIAL_DAYS} days)")
    else:
        logger.info("All free trial users have correct trial duration")


async def migrate_images_to_mongodb(db):
    """
    Migrate file-based images (testimonials, logos) to MongoDB for persistence.
    This allows images to persist across deployments.
    """
    import base64
    
    UPLOAD_DIR = "/app/uploads"
    
    # Content type mapping
    content_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.avif': 'image/avif'
    }
    
    migrated_count = 0
    
    # Collections that may have image URLs
    collections_to_check = [
        ('testimonials', ['image_url', 'company_joined_logo', 'college_logo', 'current_company_logo']),
        ('logo_repository', ['logo_url']),
        ('mentors', ['picture', 'photo']),
    ]
    
    for collection_name, image_fields in collections_to_check:
        try:
            docs = await db[collection_name].find({}).to_list(None)
            
            for doc in docs:
                doc_id = doc.get('id') or str(doc.get('_id'))
                updates = {}
                
                for field in image_fields:
                    url = doc.get(field)
                    if not url:
                        continue
                    
                    # Skip if already migrated (starts with /api/images/) or is external URL
                    if url.startswith('/api/images/') or url.startswith('http://') or url.startswith('https://'):
                        continue
                    
                    # Parse the file path from URL
                    # URLs look like: /api/uploads/testimonials/abc123.jpg
                    if url.startswith('/api/uploads/'):
                        relative_path = url.replace('/api/uploads/', '')
                    elif url.startswith('/uploads/'):
                        relative_path = url.replace('/uploads/', '')
                    else:
                        continue
                    
                    file_path = os.path.join(UPLOAD_DIR, relative_path)
                    
                    if not os.path.exists(file_path):
                        logger.debug(f"File not found for migration: {file_path}")
                        continue
                    
                    # Read file and check size (max 5MB for MongoDB storage)
                    file_size = os.path.getsize(file_path)
                    if file_size > 5 * 1024 * 1024:
                        logger.warning(f"File too large for MongoDB migration: {file_path} ({file_size} bytes)")
                        continue
                    
                    # Get content type
                    ext = os.path.splitext(file_path)[1].lower()
                    content_type = content_types.get(ext)
                    if not content_type:
                        continue
                    
                    # Read file content
                    with open(file_path, 'rb') as f:
                        file_content = f.read()
                    
                    # Generate unique ID
                    import uuid
                    file_id = f"img_{uuid.uuid4().hex[:12]}"
                    
                    # Check if already exists in persistent_images
                    existing = await db.persistent_images.find_one({
                        "original_path": url,
                        "source_collection": collection_name
                    })
                    
                    if existing:
                        # Use existing migrated image
                        updates[field] = f"/api/images/{existing['id']}"
                        continue
                    
                    # Store in MongoDB
                    image_doc = {
                        "id": file_id,
                        "filename": os.path.basename(file_path),
                        "category": collection_name,
                        "content_type": content_type,
                        "data": base64.b64encode(file_content).decode('utf-8'),
                        "size": file_size,
                        "original_path": url,
                        "source_collection": collection_name,
                        "source_doc_id": doc_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.persistent_images.insert_one(image_doc)
                    updates[field] = f"/api/images/{file_id}"
                    migrated_count += 1
                
                # Update document with new image URLs
                if updates:
                    await db[collection_name].update_one(
                        {"id": doc_id} if doc.get('id') else {"_id": doc.get('_id')},
                        {"$set": updates}
                    )
        
        except Exception as e:
            logger.warning(f"Error migrating images from {collection_name}: {e}")
            continue
    
    if migrated_count > 0:
        logger.info(f"Migrated {migrated_count} images to MongoDB for persistence")
    else:
        logger.info("No file-based images found to migrate")


async def setup_partner_api_collections(db):
    """
    Setup Partner API collections and indexes.
    Creates indexes for efficient querying of partner data.
    """
    logger.info("Setting up Partner API collections...")
    
    try:
        # Create indexes for partners collection
        await db.partners.create_index("id", unique=True)
        await db.partners.create_index("api_key_hash", unique=True)
        await db.partners.create_index("api_key_prefix")  # For quick identification
        await db.partners.create_index("is_active")
        await db.partners.create_index("contact_email")
        logger.info("Created indexes for partners collection")
        
        # Create indexes for partner_bookings collection
        await db.partner_bookings.create_index("id", unique=True)
        await db.partner_bookings.create_index("partner_id")
        await db.partner_bookings.create_index("mentor_id")
        await db.partner_bookings.create_index("date")
        await db.partner_bookings.create_index("status")
        await db.partner_bookings.create_index([("mentor_id", 1), ("date", 1)])  # Compound for availability
        await db.partner_bookings.create_index([("partner_id", 1), ("created_at", -1)])  # Partner's recent bookings
        await db.partner_bookings.create_index("candidate_email")
        logger.info("Created indexes for partner_bookings collection")
        
        logger.info("Partner API collections setup completed")
        
    except Exception as e:
        # Indexes may already exist, which is fine
        if "already exists" not in str(e).lower():
            logger.warning(f"Error setting up Partner API collections: {e}")


async def setup_crm_indexes(db):
    """Create MongoDB indexes for CRM collections to speed up Leads + Reach
    Outs queries. Without these, the leads.find() + reach-outs aggregation
    do COLLSCAN on every request — which is the root cause of the slow CRM
    pages in production.
    """
    logger.info("Setting up CRM indexes...")
    try:
        # crm_leads — primary query collection (read-heavy)
        await db.crm_leads.create_index("id", unique=True)
        await db.crm_leads.create_index("assigned_to")
        await db.crm_leads.create_index("funnel_id")
        await db.crm_leads.create_index("stage_id")
        await db.crm_leads.create_index("status")
        await db.crm_leads.create_index("source")
        await db.crm_leads.create_index("email")
        await db.crm_leads.create_index("phone")
        await db.crm_leads.create_index([("created_at", -1)])  # default sort
        await db.crm_leads.create_index([("updated_at", -1)])
        await db.crm_leads.create_index([("stage_changed_at", -1)])
        # Compound indexes for the most common filter combinations
        await db.crm_leads.create_index([("status", 1), ("assigned_to", 1)])
        await db.crm_leads.create_index([("assigned_to", 1), ("created_at", -1)])
        await db.crm_leads.create_index([("funnel_id", 1), ("stage_id", 1)])

        # crm_contact_logs — joined on lead_id in /reach-outs
        await db.crm_contact_logs.create_index("id", unique=True)
        await db.crm_contact_logs.create_index("lead_id")
        await db.crm_contact_logs.create_index([("lead_id", 1), ("created_at", -1)])  # compound for aggregation
        await db.crm_contact_logs.create_index([("performed_by", 1), ("created_at", -1)])

        # crm_activities — used in lead detail modal
        await db.crm_activities.create_index("lead_id")
        await db.crm_activities.create_index([("lead_id", 1), ("created_at", -1)])

        # crm_call_logs — used in lead detail modal
        await db.crm_call_logs.create_index("lead_id")
        await db.crm_call_logs.create_index([("lead_id", 1), ("called_at", -1)])

        # crm_sales_reps + crm_funnels + crm_sessions + crm_workflow_rules
        await db.crm_sales_reps.create_index("id", unique=True)
        await db.crm_sales_reps.create_index("email")
        await db.crm_sales_reps.create_index("is_active")
        await db.crm_funnels.create_index("id", unique=True)
        await db.crm_sessions.create_index("token", unique=True)
        await db.crm_sessions.create_index("rep_id")
        await db.crm_sessions.create_index("is_active")
        await db.crm_workflow_rules.create_index("funnel_id")
        await db.crm_workflow_rules.create_index([("funnel_id", 1), ("stage_id", 1)])

        logger.info("CRM indexes setup completed")
    except Exception as e:
        if "already exists" not in str(e).lower():
            logger.warning(f"Error setting up CRM indexes: {e}")


# Standalone runner for manual execution
async def main():
    """Run migrations manually"""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Running startup migrations manually...")
    await run_startup_migrations(db)
    print("Done!")
    
    client.close()



async def fix_peer_session_stats(db):
    """Fix peer_sessions_done and peer_rating for all peer profiles.
    
    Logic:
    - peer_sessions_done = total number of completed sessions
    - peer_rating = Total Rating / total sessions where rating was given
    """
    try:
        profiles = await db.peer_profiles.find({}, {"_id": 0, "user_id": 1}).to_list(None)
        
        if not profiles:
            logger.info("[Peer Stats] No peer profiles found, skipping")
            return
        
        updated = 0
        for profile in profiles:
            user_id = profile.get("user_id")
            if not user_id:
                continue
            
            # Count ALL completed sessions for this user
            completed_sessions = await db.peer_sessions.find({
                "$or": [
                    {"requester_id": user_id},
                    {"partner_id": user_id}
                ],
                "status": "completed"
            }).to_list(500)
            
            total_completed = len(completed_sessions)
            
            # Calculate average rating from sessions where feedback was given ABOUT this user
            total_rating = 0
            rated_sessions = 0
            
            for s in completed_sessions:
                if s["requester_id"] == user_id:
                    fb = s.get("partner_feedback")
                    if fb:
                        rating = fb.get("average_rating") or fb.get("rating_overall")
                        if rating is not None:
                            total_rating += rating
                            rated_sessions += 1
                elif s["partner_id"] == user_id:
                    fb = s.get("requester_feedback")
                    if fb:
                        rating = fb.get("average_rating") or fb.get("rating_overall")
                        if rating is not None:
                            total_rating += rating
                            rated_sessions += 1
            
            update_doc = {"peer_sessions_done": total_completed}
            if rated_sessions > 0:
                update_doc["peer_rating"] = round(total_rating / rated_sessions, 1)
            elif total_completed == 0:
                update_doc["peer_rating"] = None
            
            await db.peer_profiles.update_one(
                {"user_id": user_id},
                {"$set": update_doc}
            )
            updated += 1
        
        logger.info(f"[Peer Stats] Updated {updated} peer profiles with correct session stats")
    except Exception as e:
        logger.warning(f"[Peer Stats] Migration failed: {e}")


async def backfill_old_meet_access_to_open(db):
    """One-shot heal for production "host should let you in" gate on
    meetings booked BEFORE the OPEN-access fix shipped.

    For every upcoming session (date >= today UTC) across `bookings`,
    `strategy_call_sessions` and `case_competition_sessions`, where we
    haven't already backfilled and a Meet link exists:

      * If `meet_space_name` is persisted → PATCH the space's
        `accessType` to OPEN via the Meet REST API (existing meet_link
        stays valid; email links work too).
      * If `meet_space_name` is missing → regenerate a fresh Meet space
        (also OPEN + auto-record) and overwrite `meet_link` +
        `meet_space_name`. Old emails will still contain the legacy
        link, but the dashboard "Join" button reads from `meet_link`
        in the DB so candidates/mentors who join from the dashboard
        will land directly in the new OPEN room.

    Each processed doc is stamped with `meet_access_backfilled_at` so
    we never re-process on subsequent restarts. Idempotent — safe to
    run on every deploy.
    """
    try:
        from services.calendar_service import get_calendar_service
        cal = get_calendar_service()
        if not cal.is_available():
            logger.info("[Meet Backfill] Calendar service unavailable — skipping")
            return

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        collections = ["bookings", "strategy_call_sessions", "case_competition_sessions"]

        patched = 0
        regenerated = 0
        skipped = 0
        failed = 0

        for coll_name in collections:
            coll = db[coll_name]
            cursor = coll.find(
                {
                    "date": {"$gte": today_str},
                    "meet_link": {"$exists": True, "$ne": ""},
                    "meet_access_backfilled_at": {"$exists": False},
                    # Don't touch sessions already cancelled/no-shown
                    "status": {
                        "$nin": [
                            "mentor_cancelled",
                            "candidate_cancelled",
                            "admin_cancelled",
                            "mentor_no_show",
                            "candidate_no_show",
                            "both_no_show",
                            "completed",
                        ]
                    },
                },
                {"_id": 0, "id": 1, "meet_space_name": 1, "meet_link": 1},
            )
            docs = await cursor.to_list(length=2000)
            if not docs:
                continue

            logger.info(
                f"[Meet Backfill] {coll_name}: {len(docs)} upcoming sessions to backfill"
            )

            for doc in docs:
                doc_id = doc.get("id")
                space_name = doc.get("meet_space_name")
                if not doc_id:
                    skipped += 1
                    continue

                ok = False
                update_fields = {
                    "meet_access_backfilled_at": datetime.now(timezone.utc).isoformat()
                }

                if space_name:
                    # Path 1: patch existing space — keeps the same meet
                    # link, so old confirmation emails still work.
                    try:
                        ok = cal.update_meet_space_access_open(space_name)
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            f"[Meet Backfill] patch raised for {doc_id}: {e}"
                        )
                        ok = False
                    if ok:
                        patched += 1
                        update_fields["meet_access_backfill_method"] = "patched"
                else:
                    # Path 2: regenerate a brand-new Meet space (OPEN +
                    # auto-record). The calendar event still references
                    # the legacy link; dashboard "Join" button reads
                    # from DB so users joining from there land in the
                    # new OPEN room.
                    try:
                        meet_space = cal._create_meet_space_with_recording()
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            f"[Meet Backfill] regenerate raised for {doc_id}: {e}"
                        )
                        meet_space = None
                    if meet_space and meet_space.get("meeting_uri"):
                        update_fields["meet_link"] = meet_space["meeting_uri"]
                        update_fields["meet_space_name"] = meet_space.get("space_name")
                        update_fields["meet_access_backfill_method"] = "regenerated"
                        ok = True
                        regenerated += 1

                if not ok:
                    failed += 1
                    # Still stamp the timestamp so we don't hammer the
                    # API for an irreparable doc on every restart.
                    update_fields["meet_access_backfill_method"] = "failed"

                await coll.update_one({"id": doc_id}, {"$set": update_fields})

        logger.info(
            f"[Meet Backfill] Done — patched={patched}, "
            f"regenerated={regenerated}, failed={failed}, skipped={skipped}"
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Meet Backfill] Migration failed: {e}")



if __name__ == "__main__":
    asyncio.run(main())
