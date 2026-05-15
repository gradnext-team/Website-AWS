"""
Discounts Management API Routes
Handles automatic discounts and coupon codes for subscriptions and coaching
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter()

# Pydantic Models
class DiscountCreate(BaseModel):
    name: str = Field(..., description="Discount name")
    type: str = Field(..., description="'automatic' or 'coupon'")
    code: Optional[str] = Field(None, description="Coupon code (required for coupon type)")
    
    # Discount values
    discount_type: str = Field(..., description="'percentage' or 'fixed_amount'")
    subscription_discount_value: Optional[float] = Field(None, description="Discount value for subscriptions")
    coaching_discount_value: Optional[float] = Field(None, description="Discount value for coaching")
    cohort_discount_value: Optional[float] = Field(None, description="Discount value for cohort programs")
    
    # What it applies to
    applies_to: List[str] = Field(..., description="['subscription', 'coaching', 'cohort']")
    applicable_plans: Optional[List[str]] = Field(None, description="Specific plan keys (null = all plans)")
    
    # Usage limits
    max_total_uses: Optional[int] = Field(None, description="Total times discount can be used (null = unlimited)")
    max_uses_per_user: Optional[int] = Field(None, description="Times per user (null = unlimited)")
    
    # Validity period
    start_date: str = Field(..., description="Start date (ISO format)")
    end_date: str = Field(..., description="End date (ISO format)")
    
    # Conditions
    minimum_order_value: Optional[float] = Field(None, description="Minimum order value in INR")
    
    # Stacking option (for coupon codes)
    can_stack_with_automatic: bool = Field(False, description="Can this coupon stack with automatic discounts")
    
    # Status
    is_active: bool = Field(True, description="Is discount active")
    
    # Razorpay offer mapping (for subscription discounts)
    razorpay_offer_id: Optional[str] = Field(None, description="Razorpay Offer ID for subscription discounts")


class DiscountUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    discount_type: Optional[str] = None
    subscription_discount_value: Optional[float] = None
    coaching_discount_value: Optional[float] = None
    cohort_discount_value: Optional[float] = None
    applies_to: Optional[List[str]] = None
    applicable_plans: Optional[List[str]] = None
    max_total_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    minimum_order_value: Optional[float] = None
    can_stack_with_automatic: Optional[bool] = None
    is_active: Optional[bool] = None
    razorpay_offer_id: Optional[str] = None


class ValidateDiscountRequest(BaseModel):
    code: str = Field(..., description="Coupon code to validate")
    order_type: str = Field(..., description="'subscription' or 'coaching'")
    plan_key: str = Field(..., description="Plan key being purchased")
    order_amount: float = Field(..., description="Order amount before discount")


class ApplyDiscountRequest(BaseModel):
    discount_id: str = Field(..., description="Discount ID to apply")
    order_type: str = Field(..., description="'subscription' or 'coaching'")
    plan_key: str = Field(..., description="Plan key being purchased")
    order_amount: float = Field(..., description="Order amount before discount")


# Helper function to get database
def get_db():
    from server import app
    return app.state.db


# Helper function to validate discount applicability
def validate_discount_applicability(discount: dict, order_type: str, plan_key: str, order_amount: float, user_id: str = None, user_usage_count: int = 0, billing_cycle: str = None) -> dict:
    """
    Validate if a discount can be applied to an order.
    Returns: {"valid": bool, "error": str or None, "discount_amount": float}
    """
    now = datetime.now(timezone.utc)
    
    # Check if discount is active
    if not discount.get("is_active", False):
        return {"valid": False, "error": "This discount is not active", "discount_amount": 0}
    
    # Check date validity
    start_date = datetime.fromisoformat(discount["start_date"].replace("Z", "+00:00")) if discount.get("start_date") else None
    end_date = datetime.fromisoformat(discount["end_date"].replace("Z", "+00:00")) if discount.get("end_date") else None
    
    if start_date and now < start_date:
        return {"valid": False, "error": "This discount is not yet active", "discount_amount": 0}
    
    if end_date and now > end_date:
        return {"valid": False, "error": "This discount has expired", "discount_amount": 0}
    
    # Check if order type is applicable
    applies_to = discount.get("applies_to", [])
    if order_type not in applies_to:
        return {"valid": False, "error": f"This discount doesn't apply to {order_type}", "discount_amount": 0}
    
    # Check if plan is applicable.
    # IMPORTANT: the admin UI's "Applicable Plans" checkbox group only
    # exposes subscription + coaching plan keys (no cohort plan keys are
    # selectable). Coupons that explicitly apply to cohort therefore must
    # NOT fail this check just because the admin couldn't select a cohort
    # plan in the UI. Skip the per-plan check for cohort orders so any
    # cohort plan_key is accepted as long as the coupon's applies_to
    # includes 'cohort'.
    applicable_plans = discount.get("applicable_plans")
    if order_type != "cohort" and applicable_plans and len(applicable_plans) > 0 and plan_key not in applicable_plans:
        return {"valid": False, "error": "This discount is not applicable to the selected plan", "discount_amount": 0}
    
    # Check if billing cycle is applicable (e.g. campaign limited to 6-month plans only)
    applies_to_billing_cycle = discount.get("applies_to_billing_cycle")
    if applies_to_billing_cycle and len(applies_to_billing_cycle) > 0:
        if not billing_cycle or billing_cycle not in applies_to_billing_cycle:
            return {"valid": False, "error": "This discount is not applicable to the selected billing cycle", "discount_amount": 0}
    
    # Check minimum order value
    min_order = discount.get("minimum_order_value")
    if min_order and order_amount < min_order:
        return {"valid": False, "error": f"Minimum order of ₹{min_order} required for this discount", "discount_amount": 0}
    
    # Check total usage limit
    max_total = discount.get("max_total_uses")
    current_total = discount.get("current_total_uses", 0)
    if max_total and current_total >= max_total:
        return {"valid": False, "error": "This discount has reached its usage limit", "discount_amount": 0}
    
    # Check per-user usage limit
    max_per_user = discount.get("max_uses_per_user")
    if max_per_user and user_usage_count >= max_per_user:
        return {"valid": False, "error": "You have already used this discount the maximum number of times", "discount_amount": 0}
    
    # Calculate discount amount
    discount_type = discount.get("discount_type", "percentage")
    
    if order_type == "subscription":
        discount_value = discount.get("subscription_discount_value", 0)
    elif order_type == "cohort":
        discount_value = discount.get("cohort_discount_value", 0)
    else:  # coaching
        discount_value = discount.get("coaching_discount_value", 0)
    
    if not discount_value:
        return {"valid": False, "error": f"No discount value set for {order_type}", "discount_amount": 0}
    
    if discount_type == "percentage":
        discount_amount = round(order_amount * (discount_value / 100), 2)
    else:  # fixed_amount
        discount_amount = min(discount_value, order_amount)  # Can't discount more than order amount
    
    return {"valid": True, "error": None, "discount_amount": discount_amount}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/discounts")
async def list_discounts(
    type: Optional[str] = Query(None, description="Filter by type: 'automatic' or 'coupon'"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    applies_to: Optional[str] = Query(None, description="Filter by applies_to: 'subscription' or 'coaching'")
):
    """List all discounts with optional filters"""
    db = get_db()
    
    # Build query
    query = {}
    if type:
        query["type"] = type
    if is_active is not None:
        query["is_active"] = is_active
    if applies_to:
        query["applies_to"] = applies_to
    
    discounts = await db.discounts.find(query).sort("created_at", -1).to_list(None)
    
    # Calculate stats
    total_discounts = len(discounts)
    active_discounts = len([d for d in discounts if d.get("is_active")])
    automatic_count = len([d for d in discounts if d.get("type") == "automatic"])
    coupon_count = len([d for d in discounts if d.get("type") == "coupon"])
    
    # Get total savings given
    usage_pipeline = [
        {"$group": {"_id": None, "total_savings": {"$sum": "$discount_applied"}}}
    ]
    usage_stats = await db.discount_usage.aggregate(usage_pipeline).to_list(None)
    total_savings = usage_stats[0]["total_savings"] if usage_stats else 0
    
    # Clean up MongoDB _id
    for discount in discounts:
        if "_id" in discount:
            del discount["_id"]
    
    return {
        "discounts": discounts,
        "stats": {
            "total": total_discounts,
            "active": active_discounts,
            "automatic": automatic_count,
            "coupons": coupon_count,
            "total_savings_given": total_savings
        }
    }


@router.post("/admin/discounts")
async def create_discount(discount_data: DiscountCreate):
    """Create a new discount"""
    db = get_db()
    
    # Validate type-specific requirements
    if discount_data.type == "coupon":
        if not discount_data.code:
            raise HTTPException(status_code=400, detail="Coupon code is required for coupon type discounts")
        
        # Check if code already exists
        existing = await db.discounts.find_one({"code": discount_data.code.upper()})
        if existing:
            raise HTTPException(status_code=400, detail="A discount with this code already exists")
    
    # Validate discount values
    if "subscription" in discount_data.applies_to and not discount_data.subscription_discount_value:
        raise HTTPException(status_code=400, detail="Subscription discount value is required when applying to subscriptions")
    
    if "coaching" in discount_data.applies_to and not discount_data.coaching_discount_value:
        raise HTTPException(status_code=400, detail="Coaching discount value is required when applying to coaching")
    
    if "cohort" in discount_data.applies_to and not discount_data.cohort_discount_value:
        raise HTTPException(status_code=400, detail="Cohort discount value is required when applying to cohort programs")
    
    # Validate dates
    try:
        start_date = datetime.fromisoformat(discount_data.start_date.replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(discount_data.end_date.replace("Z", "+00:00"))
        if end_date <= start_date:
            raise HTTPException(status_code=400, detail="End date must be after start date")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    
    # Create discount document
    discount_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    discount_doc = {
        "id": discount_id,
        "name": discount_data.name,
        "type": discount_data.type,
        "code": discount_data.code.upper() if discount_data.code else None,
        "discount_type": discount_data.discount_type,
        "subscription_discount_value": discount_data.subscription_discount_value,
        "coaching_discount_value": discount_data.coaching_discount_value,
        "cohort_discount_value": discount_data.cohort_discount_value,
        "applies_to": discount_data.applies_to,
        "applicable_plans": discount_data.applicable_plans,
        "max_total_uses": discount_data.max_total_uses,
        "max_uses_per_user": discount_data.max_uses_per_user,
        "current_total_uses": 0,
        "start_date": discount_data.start_date,
        "end_date": discount_data.end_date,
        "minimum_order_value": discount_data.minimum_order_value,
        "can_stack_with_automatic": discount_data.can_stack_with_automatic,
        "is_active": discount_data.is_active,
        "razorpay_offer_id": discount_data.razorpay_offer_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.discounts.insert_one(discount_doc)
    
    # If razorpay_offer_id is provided, create the offer mapping
    if discount_data.razorpay_offer_id and "subscription" in discount_data.applies_to:
        mapping_doc = {
            "id": str(uuid.uuid4()),
            "discount_id": discount_id,
            "discount_code": discount_data.code.upper() if discount_data.code else None,
            "razorpay_offer_id": discount_data.razorpay_offer_id,
            "payment_method": "upi",  # Default to UPI as preferred
            "description": f"Offer mapping for {discount_data.name}",
            "created_at": now,
            "updated_at": now
        }
        await db.discount_offer_mappings.insert_one(mapping_doc)
    
    del discount_doc["_id"]
    return {"message": "Discount created successfully", "discount": discount_doc}


@router.get("/admin/discounts/{discount_id}")
async def get_discount(discount_id: str):
    """Get a specific discount by ID"""
    db = get_db()
    
    discount = await db.discounts.find_one({"id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    # Get usage stats for this discount
    usage_count = await db.discount_usage.count_documents({"discount_id": discount_id})
    usage_pipeline = [
        {"$match": {"discount_id": discount_id}},
        {"$group": {"_id": None, "total_savings": {"$sum": "$discount_applied"}}}
    ]
    usage_stats = await db.discount_usage.aggregate(usage_pipeline).to_list(None)
    total_savings = usage_stats[0]["total_savings"] if usage_stats else 0
    
    # Get Razorpay offer mapping if exists
    offer_mapping = await db.discount_offer_mappings.find_one({"discount_id": discount_id})
    if offer_mapping and not discount.get("razorpay_offer_id"):
        discount["razorpay_offer_id"] = offer_mapping.get("razorpay_offer_id")
    
    del discount["_id"]
    discount["usage_stats"] = {
        "total_uses": usage_count,
        "total_savings": total_savings
    }
    
    return discount


@router.put("/admin/discounts/{discount_id}")
async def update_discount(discount_id: str, discount_data: DiscountUpdate):
    """Update a discount"""
    db = get_db()
    
    discount = await db.discounts.find_one({"id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    # Build update document
    update_doc = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in discount_data.model_dump(exclude_unset=True).items():
        if field == "code" and value:
            # Check if new code already exists (excluding current discount)
            existing = await db.discounts.find_one({"code": value.upper(), "id": {"$ne": discount_id}})
            if existing:
                raise HTTPException(status_code=400, detail="A discount with this code already exists")
            update_doc["code"] = value.upper()
        elif field == "applicable_plans":
            # Allow setting applicable_plans to null (meaning "all plans")
            update_doc[field] = value
        elif value is not None:
            update_doc[field] = value
    
    await db.discounts.update_one({"id": discount_id}, {"$set": update_doc})
    
    # If razorpay_offer_id is being updated, also update the offer mapping
    if "razorpay_offer_id" in update_doc:
        razorpay_offer_id = update_doc["razorpay_offer_id"]
        now = datetime.now(timezone.utc).isoformat()
        
        # Get the current discount to check if subscription is in applies_to
        current_discount = await db.discounts.find_one({"id": discount_id})
        applies_to = current_discount.get("applies_to", [])
        
        if razorpay_offer_id and "subscription" in applies_to:
            # Create or update the mapping
            existing_mapping = await db.discount_offer_mappings.find_one({"discount_id": discount_id})
            if existing_mapping:
                await db.discount_offer_mappings.update_one(
                    {"discount_id": discount_id},
                    {"$set": {
                        "razorpay_offer_id": razorpay_offer_id,
                        "updated_at": now
                    }}
                )
            else:
                mapping_doc = {
                    "id": str(uuid.uuid4()),
                    "discount_id": discount_id,
                    "discount_code": current_discount.get("code"),
                    "razorpay_offer_id": razorpay_offer_id,
                    "payment_method": "upi",
                    "description": f"Offer mapping for {current_discount.get('name')}",
                    "created_at": now,
                    "updated_at": now
                }
                await db.discount_offer_mappings.insert_one(mapping_doc)
        elif not razorpay_offer_id:
            # If clearing the offer ID, remove the mapping
            await db.discount_offer_mappings.delete_many({"discount_id": discount_id})
    
    updated_discount = await db.discounts.find_one({"id": discount_id})
    del updated_discount["_id"]
    
    return {"message": "Discount updated successfully", "discount": updated_discount}


@router.delete("/admin/discounts/{discount_id}")
async def delete_discount(discount_id: str):
    """Delete a discount"""
    db = get_db()
    
    discount = await db.discounts.find_one({"id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    await db.discounts.delete_one({"id": discount_id})
    
    return {"message": "Discount deleted successfully"}


# ==================== RAZORPAY OFFER MAPPING ====================

class RazorpayOfferMapping(BaseModel):
    discount_id: str
    razorpay_offer_id: str
    billing_cycle: Optional[str] = None  # "monthly", "6_month", or None for all
    description: Optional[str] = None


@router.post("/admin/discounts/{discount_id}/razorpay-offer")
async def set_razorpay_offer_mapping(discount_id: str, mapping: RazorpayOfferMapping):
    """
    Map a discount/coupon to a Razorpay Subscription Offer.
    
    Razorpay Offers must be created in Razorpay Dashboard first:
    1. Go to Razorpay Dashboard → Subscriptions → Offers
    2. Create a new offer with the desired discount
    3. Copy the offer_id (starts with 'offer_')
    4. Use this endpoint to map the offer to your discount/coupon
    
    You can create separate mappings for monthly and 6-month billing cycles
    by specifying the billing_cycle parameter.
    
    This enables proper subscription flow with discounted first payment.
    """
    db = get_db()
    
    # Verify discount exists
    discount = await db.discounts.find_one({"id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    # Create or update the mapping
    mapping_data = {
        "discount_id": discount_id,
        "discount_code": discount.get("code"),
        "razorpay_offer_id": mapping.razorpay_offer_id,
        "billing_cycle": mapping.billing_cycle,
        "description": mapping.description or f"Offer for {discount.get('code')} ({mapping.billing_cycle or 'all cycles'})",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check for existing mapping with same discount_id and billing_cycle
    query = {"discount_id": discount_id}
    if mapping.billing_cycle:
        query["billing_cycle"] = mapping.billing_cycle
    else:
        query["$or"] = [{"billing_cycle": None}, {"billing_cycle": {"$exists": False}}]
    
    existing = await db.discount_offer_mappings.find_one(query)
    if existing:
        await db.discount_offer_mappings.update_one(
            {"_id": existing["_id"]},
            {"$set": mapping_data}
        )
    else:
        mapping_data["id"] = str(uuid.uuid4())
        mapping_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.discount_offer_mappings.insert_one(mapping_data)
    
    return {
        "message": "Razorpay offer mapping saved successfully",
        "discount_code": discount.get("code"),
        "razorpay_offer_id": mapping.razorpay_offer_id,
        "billing_cycle": mapping.billing_cycle or "all"
    }


@router.get("/admin/discounts/{discount_id}/razorpay-offer")
async def get_razorpay_offer_mapping(discount_id: str):
    """Get the Razorpay offer mapping for a discount"""
    db = get_db()
    
    mapping = await db.discount_offer_mappings.find_one({"discount_id": discount_id})
    if not mapping:
        return {"has_mapping": False, "message": "No Razorpay offer mapped to this discount"}
    
    if "_id" in mapping:
        del mapping["_id"]
    
    return {"has_mapping": True, "mapping": mapping}


@router.delete("/admin/discounts/{discount_id}/razorpay-offer")
async def delete_razorpay_offer_mapping(discount_id: str):
    """Remove the Razorpay offer mapping for a discount"""
    db = get_db()
    
    result = await db.discount_offer_mappings.delete_one({"discount_id": discount_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No mapping found")
    
    return {"message": "Razorpay offer mapping removed"}


@router.get("/admin/razorpay-offer-mappings")
async def list_all_razorpay_offer_mappings():
    """List all discount-to-Razorpay-offer mappings"""
    db = get_db()
    
    mappings = await db.discount_offer_mappings.find({}).to_list(None)
    for m in mappings:
        if "_id" in m:
            del m["_id"]
    
    return {"mappings": mappings, "count": len(mappings)}


@router.get("/admin/discounts/{discount_id}/usage")
async def get_discount_usage(
    discount_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get usage history for a discount"""
    db = get_db()
    
    discount = await db.discounts.find_one({"id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    skip = (page - 1) * limit
    
    usage_records = await db.discount_usage.find({"discount_id": discount_id}).sort("used_at", -1).skip(skip).limit(limit).to_list(None)
    total_count = await db.discount_usage.count_documents({"discount_id": discount_id})
    
    for record in usage_records:
        if "_id" in record:
            del record["_id"]
    
    return {
        "usage": usage_records,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    }


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/discounts/automatic")
async def get_automatic_discounts(
    order_type: Optional[str] = Query(None, description="Filter by order type: 'subscription' or 'coaching'")
):
    """Get all active automatic discounts for displaying strikethrough pricing"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    
    query = {
        "type": "automatic",
        "is_active": True
    }
    
    if order_type:
        query["applies_to"] = order_type
    
    discounts = await db.discounts.find(query).to_list(None)
    
    # Filter by date validity
    valid_discounts = []
    for discount in discounts:
        start_date = datetime.fromisoformat(discount["start_date"].replace("Z", "+00:00")) if discount.get("start_date") else None
        end_date = datetime.fromisoformat(discount["end_date"].replace("Z", "+00:00")) if discount.get("end_date") else None
        
        if start_date and now < start_date:
            continue
        if end_date and now > end_date:
            continue
        
        # Check usage limits
        max_total = discount.get("max_total_uses")
        current_total = discount.get("current_total_uses", 0)
        if max_total and current_total >= max_total:
            continue
        
        if "_id" in discount:
            del discount["_id"]
        valid_discounts.append(discount)
    
    return {"discounts": valid_discounts}


@router.post("/discounts/validate")
async def validate_coupon_code(request: ValidateDiscountRequest, user_id: Optional[str] = None):
    """Validate a coupon code before applying"""
    db = get_db()
    
    # Find discount by code
    discount = await db.discounts.find_one({"code": request.code.upper(), "type": "coupon"})
    
    if not discount:
        raise HTTPException(status_code=400, detail="Invalid discount code")
    
    # Get user's usage count for this discount
    user_usage_count = 0
    if user_id:
        user_usage_count = await db.discount_usage.count_documents({
            "discount_id": discount["id"],
            "user_id": user_id
        })
    
    # Validate applicability
    validation = validate_discount_applicability(
        discount=discount,
        order_type=request.order_type,
        plan_key=request.plan_key,
        order_amount=request.order_amount,
        user_id=user_id,
        user_usage_count=user_usage_count
    )
    
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])
    
    # Check if there's an active automatic discount
    automatic_discounts = await db.discounts.find({
        "type": "automatic",
        "is_active": True,
        "applies_to": request.order_type
    }).to_list(None)
    
    has_automatic_discount = False
    automatic_discount_amount = 0
    
    for auto_discount in automatic_discounts:
        auto_validation = validate_discount_applicability(
            discount=auto_discount,
            order_type=request.order_type,
            plan_key=request.plan_key,
            order_amount=request.order_amount
        )
        if auto_validation["valid"]:
            has_automatic_discount = True
            automatic_discount_amount = auto_validation["discount_amount"]
            break
    
    # Check stacking rules
    can_stack = discount.get("can_stack_with_automatic", False)
    
    response = {
        "valid": True,
        "discount_id": discount["id"],
        "discount_name": discount["name"],
        "discount_type": discount["discount_type"],
        "discount_amount": validation["discount_amount"],
        "can_stack_with_automatic": can_stack,
        "has_automatic_discount": has_automatic_discount,
        "automatic_discount_amount": automatic_discount_amount if can_stack else 0,
        "total_discount": validation["discount_amount"] + (automatic_discount_amount if can_stack and has_automatic_discount else 0),
        "message": f"Coupon applied! You save ₹{validation['discount_amount']}"
    }
    
    if has_automatic_discount and can_stack:
        response["message"] = f"Coupon applied! You save ₹{validation['discount_amount']} + ₹{automatic_discount_amount} (automatic discount)"
    elif has_automatic_discount and not can_stack:
        response["message"] = f"Coupon applied! You save ₹{validation['discount_amount']} (replaces automatic discount of ₹{automatic_discount_amount})"
    
    return response


@router.post("/discounts/apply")
async def apply_discount(request: ApplyDiscountRequest, user_id: str, user_email: str):
    """
    Apply a discount to an order and record usage.
    Called when payment is being processed.
    """
    db = get_db()
    
    discount = await db.discounts.find_one({"id": request.discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    # Get user's usage count
    user_usage_count = await db.discount_usage.count_documents({
        "discount_id": request.discount_id,
        "user_id": user_id
    })
    
    # Validate one more time
    validation = validate_discount_applicability(
        discount=discount,
        order_type=request.order_type,
        plan_key=request.plan_key,
        order_amount=request.order_amount,
        user_id=user_id,
        user_usage_count=user_usage_count
    )
    
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])
    
    # Record usage
    usage_doc = {
        "id": str(uuid.uuid4()),
        "discount_id": request.discount_id,
        "discount_code": discount.get("code"),
        "discount_name": discount.get("name"),
        "user_id": user_id,
        "user_email": user_email,
        "order_type": request.order_type,
        "plan_key": request.plan_key,
        "original_amount": request.order_amount,
        "discount_applied": validation["discount_amount"],
        "final_amount": request.order_amount - validation["discount_amount"],
        "used_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.discount_usage.insert_one(usage_doc)
    
    # Increment usage count
    await db.discounts.update_one(
        {"id": request.discount_id},
        {"$inc": {"current_total_uses": 1}}
    )
    
    return {
        "success": True,
        "discount_applied": validation["discount_amount"],
        "final_amount": request.order_amount - validation["discount_amount"]
    }


@router.get("/discounts/check-automatic")
async def check_automatic_discount(
    order_type: str = Query(..., description="'subscription' or 'coaching'"),
    plan_key: str = Query(..., description="Plan key"),
    order_amount: float = Query(..., description="Order amount"),
    billing_cycle: Optional[str] = Query(None, description="'monthly' or '6-month'")
):
    """Check if there's an applicable automatic discount for the order"""
    db = get_db()
    
    discounts = await db.discounts.find({
        "type": "automatic",
        "is_active": True,
        "applies_to": order_type
    }).to_list(None)
    
    for discount in discounts:
        validation = validate_discount_applicability(
            discount=discount,
            order_type=order_type,
            plan_key=plan_key,
            order_amount=order_amount,
            billing_cycle=billing_cycle
        )
        
        if validation["valid"]:
            return {
                "has_discount": True,
                "discount_id": discount["id"],
                "discount_name": discount["name"],
                "discount_type": discount["discount_type"],
                "discount_amount": validation["discount_amount"],
                "discount_percentage": discount.get("subscription_discount_value") if order_type == "subscription" else discount.get("coaching_discount_value"),
                "end_date": discount.get("end_date"),
                "campaign_label": discount.get("campaign_label")
            }
    
    return {"has_discount": False}
