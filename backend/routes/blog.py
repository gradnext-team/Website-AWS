"""
Blog API Routes
Handles blog posts, categories, newsletter subscriptions
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re
import logging

from routes.auth import get_current_user, get_db
from routes.admin import verify_admin
from services import cloud_storage_service

router = APIRouter(prefix="/blog", tags=["blog"])
logger = logging.getLogger(__name__)


# ============ Pydantic Models ============

class BlogCategory(BaseModel):
    id: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"  # Default blue color for category badge


class BlogPostCreate(BaseModel):
    title: str
    slug: Optional[str] = None  # Auto-generated if not provided
    excerpt: str = Field(..., max_length=300)  # Short description for cards
    content: str  # Full HTML/Markdown content
    category_id: str
    tags: List[str] = []
    thumbnail_url: Optional[str] = None
    author_name: Optional[str] = None
    author_image: Optional[str] = None
    author_bio: Optional[str] = None
    meta_title: Optional[str] = None  # SEO title
    meta_description: Optional[str] = None  # SEO description
    og_image: Optional[str] = None  # Open Graph image
    is_featured: bool = False
    is_published: bool = False
    published_at: Optional[str] = None
    reading_time_minutes: Optional[int] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None
    author_name: Optional[str] = None
    author_image: Optional[str] = None
    author_bio: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    og_image: Optional[str] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None
    reading_time_minutes: Optional[int] = None


class NewsletterSubscribe(BaseModel):
    email: str
    name: Optional[str] = None
    source: Optional[str] = "blog"  # Where they subscribed from


# ============ Helper Functions ============

def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    slug = title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = slug.strip('-')
    return slug


def calculate_reading_time(content: str) -> int:
    """Calculate estimated reading time in minutes"""
    # Average reading speed: 200 words per minute
    word_count = len(content.split())
    minutes = max(1, round(word_count / 200))
    return minutes


# ============ Public Endpoints ============

@router.get("/posts")
async def get_blog_posts(
    request: Request,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 12
):
    """Get published blog posts with optional filtering"""
    db = get_db(request)
    
    # Build query
    query = {"is_published": True}
    
    if category:
        query["category_slug"] = category
    
    if tag:
        query["tags"] = {"$in": [tag]}
    
    if featured is not None:
        query["is_featured"] = featured
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"excerpt": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.blog_posts.count_documents(query)
    
    # Get paginated posts
    skip = (page - 1) * limit
    posts = await db.blog_posts.find(
        query,
        {"_id": 0, "content": 0}  # Exclude full content for list view
    ).sort("published_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "posts": posts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@router.get("/posts/featured")
async def get_featured_posts(request: Request, limit: int = 3):
    """Get featured blog posts for homepage/hero section"""
    db = get_db(request)
    
    posts = await db.blog_posts.find(
        {"is_published": True, "is_featured": True},
        {"_id": 0, "content": 0}
    ).sort("published_at", -1).limit(limit).to_list(limit)
    
    return {"posts": posts}


@router.get("/posts/{slug}")
async def get_blog_post(request: Request, slug: str):
    """Get a single blog post by slug"""
    db = get_db(request)
    
    post = await db.blog_posts.find_one(
        {"slug": slug, "is_published": True},
        {"_id": 0}
    )
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment view count
    await db.blog_posts.update_one(
        {"slug": slug},
        {"$inc": {"view_count": 1}}
    )
    
    # Get related posts (same category, excluding current)
    related = await db.blog_posts.find(
        {
            "is_published": True,
            "category_id": post.get("category_id"),
            "slug": {"$ne": slug}
        },
        {"_id": 0, "content": 0}
    ).sort("published_at", -1).limit(3).to_list(3)
    
    post["related_posts"] = related
    
    return post


@router.get("/categories")
async def get_blog_categories(request: Request):
    """Get all blog categories with post counts"""
    db = get_db(request)
    
    categories = await db.blog_categories.find({}, {"_id": 0}).to_list(100)
    
    # Add post count for each category
    for cat in categories:
        count = await db.blog_posts.count_documents({
            "category_id": cat["id"],
            "is_published": True
        })
        cat["post_count"] = count
    
    return {"categories": categories}


@router.get("/tags")
async def get_blog_tags(request: Request):
    """Get all unique tags with post counts"""
    db = get_db(request)
    
    # Aggregate tags from all published posts
    pipeline = [
        {"$match": {"is_published": True}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    
    result = await db.blog_posts.aggregate(pipeline).to_list(50)
    tags = [{"name": r["_id"], "count": r["count"]} for r in result]
    
    return {"tags": tags}


# ============ Newsletter Endpoints ============

@router.post("/newsletter/subscribe")
async def subscribe_newsletter(data: NewsletterSubscribe, request: Request):
    """Subscribe to blog newsletter"""
    db = get_db(request)
    
    # Check if already subscribed
    existing = await db.newsletter_subscribers.find_one({"email": data.email.lower()})
    
    if existing:
        if existing.get("is_active"):
            return {"message": "Already subscribed", "already_subscribed": True}
        else:
            # Reactivate subscription
            await db.newsletter_subscribers.update_one(
                {"email": data.email.lower()},
                {"$set": {"is_active": True, "resubscribed_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"message": "Subscription reactivated", "reactivated": True}
    
    # Create new subscription
    subscriber = {
        "id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "name": data.name,
        "source": data.source,
        "is_active": True,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.newsletter_subscribers.insert_one(subscriber)
    
    # Track in Mixpanel if available
    try:
        from services import mixpanel_service
        mixpanel_service.track_event(
            distinct_id=data.email.lower(),
            event_name="newsletter_subscribed",
            properties={"source": data.source}
        )
    except:
        pass
    
    return {"message": "Successfully subscribed", "subscribed": True}


@router.post("/newsletter/unsubscribe")
async def unsubscribe_newsletter(request: Request, email: str):
    """Unsubscribe from blog newsletter"""
    db = get_db(request)
    
    result = await db.newsletter_subscribers.update_one(
        {"email": email.lower()},
        {"$set": {"is_active": False, "unsubscribed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Successfully unsubscribed"}


# ============ Admin Endpoints ============

@router.get("/admin/posts")
async def admin_get_posts(
    request: Request,
    include_drafts: bool = True,
    page: int = 1,
    limit: int = 20
):
    """Admin: Get all blog posts including drafts"""
    await verify_admin(request)
    db = get_db(request)
    
    query = {}
    if not include_drafts:
        query["is_published"] = True
    
    total = await db.blog_posts.count_documents(query)
    skip = (page - 1) * limit
    
    posts = await db.blog_posts.find(
        query,
        {"_id": 0, "content": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "posts": posts,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/admin/posts/{post_id}")
async def admin_get_post(request: Request, post_id: str):
    """Admin: Get full post details for editing"""
    await verify_admin(request)
    db = get_db(request)
    
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return post


@router.post("/admin/posts")
async def admin_create_post(data: BlogPostCreate, request: Request):
    """Admin: Create a new blog post"""
    await verify_admin(request)
    db = get_db(request)
    user = await get_current_user(request)
    
    # Generate slug if not provided
    slug = data.slug or generate_slug(data.title)
    
    # Check for duplicate slug
    existing = await db.blog_posts.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"
    
    # Get category info
    category = await db.blog_categories.find_one({"id": data.category_id})
    
    # Calculate reading time
    reading_time = data.reading_time_minutes or calculate_reading_time(data.content)
    
    post = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "slug": slug,
        "excerpt": data.excerpt,
        "content": data.content,
        "category_id": data.category_id,
        "category_name": category.get("name") if category else None,
        "category_slug": category.get("slug") if category else None,
        "tags": data.tags,
        "thumbnail_url": data.thumbnail_url,
        "author_name": data.author_name or user.get("name"),
        "author_image": data.author_image or user.get("picture"),
        "author_bio": data.author_bio,
        "meta_title": data.meta_title or data.title,
        "meta_description": data.meta_description or data.excerpt,
        "og_image": data.og_image or data.thumbnail_url,
        "is_featured": data.is_featured,
        "is_published": data.is_published,
        "published_at": data.published_at or (datetime.now(timezone.utc).isoformat() if data.is_published else None),
        "reading_time_minutes": reading_time,
        "view_count": 0,
        "created_by": user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.blog_posts.insert_one(post)
    
    return {"message": "Post created successfully", "post": {k: v for k, v in post.items() if k != "_id"}}


@router.put("/admin/posts/{post_id}")
async def admin_update_post(post_id: str, data: BlogPostUpdate, request: Request):
    """Admin: Update a blog post"""
    await verify_admin(request)
    db = get_db(request)
    
    existing = await db.blog_posts.find_one({"id": post_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Post not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Update category info if category changed
    if "category_id" in update_data:
        category = await db.blog_categories.find_one({"id": update_data["category_id"]})
        if category:
            update_data["category_name"] = category.get("name")
            update_data["category_slug"] = category.get("slug")
    
    # Update reading time if content changed
    if "content" in update_data:
        update_data["reading_time_minutes"] = calculate_reading_time(update_data["content"])
    
    # Set published_at if publishing for first time
    if update_data.get("is_published") and not existing.get("published_at"):
        update_data["published_at"] = datetime.now(timezone.utc).isoformat()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.blog_posts.update_one({"id": post_id}, {"$set": update_data})
    
    return {"message": "Post updated successfully"}


@router.delete("/admin/posts/{post_id}")
async def admin_delete_post(request: Request, post_id: str):
    """Admin: Delete a blog post"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.blog_posts.delete_one({"id": post_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"message": "Post deleted successfully"}


@router.post("/admin/posts/{post_id}/publish")
async def admin_publish_post(request: Request, post_id: str):
    """Admin: Publish a draft post"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.blog_posts.update_one(
        {"id": post_id},
        {"$set": {
            "is_published": True,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"message": "Post published successfully"}


@router.post("/admin/posts/{post_id}/unpublish")
async def admin_unpublish_post(request: Request, post_id: str):
    """Admin: Unpublish a post (make it draft)"""
    await verify_admin(request)
    db = get_db(request)
    
    result = await db.blog_posts.update_one(
        {"id": post_id},
        {"$set": {
            "is_published": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"message": "Post unpublished successfully"}


# ============ Category Admin Endpoints ============

@router.post("/admin/categories")
async def admin_create_category(data: BlogCategory, request: Request):
    """Admin: Create a blog category"""
    await verify_admin(request)
    db = get_db(request)
    
    category = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "slug": data.slug or generate_slug(data.name),
        "description": data.description,
        "color": data.color,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.blog_categories.insert_one(category)
    
    return {"message": "Category created", "category": {k: v for k, v in category.items() if k != "_id"}}


@router.put("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, data: BlogCategory, request: Request):
    """Admin: Update a blog category"""
    await verify_admin(request)
    db = get_db(request)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None and k != "id"}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.blog_posts.update_one({"id": category_id}, {"$set": update_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category updated"}


@router.delete("/admin/categories/{category_id}")
async def admin_delete_category(request: Request, category_id: str):
    """Admin: Delete a blog category"""
    await verify_admin(request)
    db = get_db(request)
    
    # Check if category has posts
    post_count = await db.blog_posts.count_documents({"category_id": category_id})
    if post_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {post_count} posts")
    
    result = await db.blog_categories.delete_one({"id": category_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category deleted"}


# ============ Thumbnail Upload ============

@router.post("/admin/upload-thumbnail")
async def upload_blog_thumbnail(
    request: Request,
    file: UploadFile = File(...)
):
    """Admin: Upload a blog post thumbnail to cloud storage"""
    await verify_admin(request)
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    content = await file.read()
    
    # Validate file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
    
    # Upload to cloud storage
    if not cloud_storage_service.is_enabled():
        raise HTTPException(status_code=503, detail="Cloud storage not configured")
    
    try:
        result = cloud_storage_service.upload_file(
            data=content,
            filename=file.filename or "thumbnail.jpg",
            folder="blog_thumbnails"
        )
        
        thumbnail_url = f"/api/files/{result['storage_path']}"
        
        return {
            "url": thumbnail_url,
            "storage_path": result['storage_path'],
            "size": result['size']
        }
    except Exception as e:
        logger.error(f"Failed to upload blog thumbnail: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")


# ============ Newsletter Admin ============

@router.get("/admin/newsletter/subscribers")
async def admin_get_subscribers(
    request: Request,
    active_only: bool = True,
    page: int = 1,
    limit: int = 50
):
    """Admin: Get newsletter subscribers"""
    await verify_admin(request)
    db = get_db(request)
    
    query = {}
    if active_only:
        query["is_active"] = True
    
    total = await db.newsletter_subscribers.count_documents(query)
    skip = (page - 1) * limit
    
    subscribers = await db.newsletter_subscribers.find(
        query,
        {"_id": 0}
    ).sort("subscribed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "subscribers": subscribers,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/admin/newsletter/export")
async def admin_export_subscribers(request: Request):
    """Admin: Export newsletter subscribers as CSV"""
    await verify_admin(request)
    db = get_db(request)
    
    subscribers = await db.newsletter_subscribers.find(
        {"is_active": True},
        {"_id": 0, "email": 1, "name": 1, "subscribed_at": 1}
    ).to_list(10000)
    
    # Generate CSV
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["email", "name", "subscribed_at"])
    writer.writeheader()
    writer.writerows(subscribers)
    
    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=newsletter_subscribers.csv"}
    )
