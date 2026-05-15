"""
Seed the "30% off on 6-month subscription plans" campaign discount.

Idempotent — safe to re-run. Updates the existing discount in place if it
already exists, so admins can re-run after editing fields below.

Run manually:
    cd /app/backend && python -m scripts.seed_six_month_promo
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load env from /app/backend/.env regardless of CWD
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(HERE, "..", ".env")
load_dotenv(ENV_PATH)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

PROMO_ID = "promo-30-off-six-month-may2026"
PROMO_END = "2026-05-31T23:59:59+05:30"  # IST end of 31st May 2026 — extension
PROMO_CODE = "MAY30"  # admin/ads reference code (discount stays auto-applied)


async def main():
    if not MONGO_URL or not DB_NAME:
        print("ERROR: MONGO_URL or DB_NAME missing in environment.")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now_iso = datetime.now(timezone.utc).isoformat()

    promo = {
        "id": PROMO_ID,
        "name": "30% off on 6-month subscription plans",
        "campaign_label": "30% OFF · 6-month plans · Ends 31 May",
        "type": "automatic",
        "code": PROMO_CODE,  # auto-applied; code is for admin/ads reference
        # Discount value
        "discount_type": "percentage",
        "subscription_discount_value": 30,
        "coaching_discount_value": None,
        # Scope
        "applies_to": ["subscription"],
        "applicable_plans": None,                # all subscription plans
        "applies_to_billing_cycle": ["6-month"], # 6-month commit only
        # Limits
        "max_total_uses": None,
        "max_uses_per_user": None,
        "minimum_order_value": None,
        # Validity
        "start_date": now_iso,
        "end_date": PROMO_END,
        # Stacking & status
        "can_stack_with_automatic": False,
        "is_active": True,
        # Misc
        "razorpay_offer_id": None,
        "current_total_uses": 0,
        "updated_at": now_iso,
    }

    existing = await db.discounts.find_one({"id": PROMO_ID})
    if existing:
        await db.discounts.update_one({"id": PROMO_ID}, {"$set": promo})
        print(f"[OK] Updated existing promo discount: {PROMO_ID}")
    else:
        promo["created_at"] = now_iso
        await db.discounts.insert_one(promo)
        print(f"[OK] Inserted promo discount: {PROMO_ID}")

    print(f"     end_date  = {PROMO_END}")
    print(f"     value     = 30% on 6-month subscription plans")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
