# Testimonials Persistence Fix

## Problem
Testimonials disappear after deployment because:
1. The MongoDB database connection might be different between environments
2. Images stored in `/app/uploads/` directory get deleted on deployment (ephemeral storage)

## Root Cause Analysis

### How Testimonials Work
1. **Data Storage**: Testimonials are stored in MongoDB `testimonials` collection ✅
2. **Image Storage**: Images uploaded via admin panel are stored in `/app/uploads/testimonials/` ❌
3. **Problem**: The `/app/uploads/` directory is ephemeral and gets wiped on each deployment

### Why This Happens
- Container file systems are ephemeral in Kubernetes/Docker
- On deployment, a new container is created with a fresh file system
- Only data in MongoDB persists between deployments
- Files in `/app/uploads/` are lost

## Solution

The codebase already has a migration (`migrate_images_to_mongodb`) that should:
1. Find all testimonial images in `/app/uploads/testimonials/`
2. Convert them to base64
3. Store them in MongoDB `persistent_images` collection
4. Update testimonial records to reference MongoDB images via `/api/images/{id}`

However, this only works for EXISTING images. New testimonials created after migration need proper handling.

## Implementation

### Step 1: Verify Image Migration

The startup migration at `/app/backend/migrations/startup_migrations.py` includes `migrate_images_to_mongodb()` which:
- Scans testimonials collection for image URLs pointing to `/app/uploads/`
- Migrates those images to MongoDB
- Updates URLs to `/api/images/{image_id}`

### Step 2: Ensure Upload Endpoint Uses MongoDB

Check that the testimonial upload endpoint stores images in MongoDB instead of file system.

Location: `/app/backend/routes/admin.py`

### Step 3: Verify Image Serving Endpoint

Ensure `/api/images/{image_id}` endpoint serves images from MongoDB.

Location: Needs to be in a route file (likely `/app/backend/routes/resources.py` or `/app/backend/server.py`)

## Recommendations

### Option 1: Use MongoDB for All Images (RECOMMENDED)
✅ Images persist across deployments
✅ No file system dependencies
✅ Already partially implemented
❌ Slightly larger database size
❌ Max 16MB per document (MongoDB limit)

### Option 2: Use Cloud Storage (S3, Google Cloud Storage)
✅ Unlimited storage
✅ Better for large files
✅ CDN integration possible
❌ Requires external service setup
❌ Additional costs
❌ More complex implementation

### Option 3: Use Persistent Volume
✅ Traditional file storage
❌ Requires Kubernetes PV setup
❌ Not portable
❌ Backup complexity

## Current Status

Based on code inspection:
- ✅ MongoDB storage for testimonial data
- ✅ Image migration utility exists
- ❓ Need to verify image upload endpoint
- ❓ Need to verify image serving endpoint
- ❓ Need to ensure all existing testimonials have migrated images

## Action Items

1. Check if testimonials exist but images are lost
2. Verify image upload endpoint stores in MongoDB
3. Verify image serving endpoint works
4. Add documentation for admin users
5. Test full workflow: Upload testimonial → Deploy → Verify persistence

## MongoDB vs Environment Issue

If testimonials disappear completely (not just images), the issue might be:
- Different database connections between dev/staging/production
- Database name mismatch (check `DB_NAME` environment variable)
- MongoDB connection string pointing to different instances

Check environment variables:
```bash
# Backend .env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="gradnext"
```

Ensure these are consistent across all environments.
