# Database Implementation Guide

## Overview
This application uses **MongoDB** with **Motor** (async MongoDB driver) for Python. The database connection is initialized in `server.py` and accessed through routes using a `get_db()` helper function.

---

## 1. Database Initialization

### Location: `backend/server.py` (lines 54-65)

```python
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
```

**Key Points:**
- Uses `AsyncIOMotorClient` from `motor.motor_asyncio` for async operations
- Connection URL from `MONGO_URL` environment variable (default: `mongodb://localhost:27017`)
- Database name from `DB_NAME` environment variable (default: `test_database`)
- Connection pooling configured for scalability (100 max, 10 min connections)
- Retry logic enabled for writes and reads

---

## 2. Database Access Pattern

### Stored in FastAPI App State

**Location: `backend/server.py` (lines 68-72)**

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        app.state.db = db  # Store db in app state
        await db.command('ping')  # Test connection
        logging.info("MongoDB connection successful")
```

The database instance is stored in `app.state.db` during application startup.

---

## 3. Accessing Database in Routes

### Helper Function: `get_db()`

**Location: `backend/routes/auth.py` (lines 68-69)**

```python
def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db
```

### Usage in Route Handlers

**Example from `backend/routes/payments.py`:**

```python
from routes.auth import get_current_user, get_db

@router.post("/create-order")
async def create_order(order_data: CreateOrderRequest, request: Request):
    user = await get_current_user(request)
    db = get_db(request)  # Get database instance
    
    # Use db to query collections
    plan = await db.plans.find_one({"plan_key": order_data.plan_key})
    
    # Insert documents
    await db.payment_orders.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "plan_key": order_data.plan_key,
        "status": "created",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"order_id": "..."}
```

**Pattern:**
1. Import `get_db` from `routes.auth`
2. Call `db = get_db(request)` in your route handler
3. Use `db.collection_name` to access collections

---

## 4. Database Collections

### Main Collections Used:

Based on the health check endpoint (`server.py` lines 187-193):

```python
required_collections = [
    "users",              # User accounts and profiles
    "plans",              # Subscription plans
    "videos",             # Video content
    "courses",             # Course content
    "course_sessions",     # Course session data
    "workshops",           # Workshop information
    "mentors",             # Mentor profiles
    "peer_sessions",       # Peer practice sessions
    "coaching_bookings",   # Coaching session bookings
    "drill_sessions",      # AI drill sessions
    "drill_completions",   # Drill completion records
    "user_progress",       # User learning progress
    "payments",            # Payment records
    "payment_orders",      # Payment order records
    "sessions",            # Authentication sessions
    "case_materials"       # Case study materials
]
```

### Additional Collections:

- `peer_profiles` - Peer practice user profiles
- `mentor_availability` - Mentor availability slots
- `coaching_sessions` - Coaching session records
- `otp_codes` - OTP verification codes
- `gmail_credentials` - Gmail OAuth credentials
- `platform_settings` - Platform configuration
- `persistent_images` - Images stored in MongoDB
- `testimonials` - User testimonials
- `discovery_calls` - Discovery call records
- `pinnacle_applications` - Pinnacle program applications
- `scholarship_applications` - Scholarship applications
- `competitions` - Case competition data
- `discounts` - Discount codes
- `automations` - Email automation records
- `lead_scores` - Lead scoring data

---

## 5. Common Database Operations

### Query Examples:

```python
# Find one document
user = await db.users.find_one({"email": "user@example.com"})

# Find multiple documents
plans = await db.plans.find({"is_active": True}).to_list(length=100)

# Count documents
count = await db.users.count_documents({"plan": "pro_plan"})

# Insert one document
result = await db.users.insert_one({
    "id": str(uuid.uuid4()),
    "email": "new@example.com",
    "name": "New User",
    "created_at": datetime.now(timezone.utc).isoformat()
})

# Insert multiple documents
await db.mentors.insert_many([mentor1, mentor2, mentor3])

# Update one document
await db.users.update_one(
    {"id": user_id},
    {"$set": {"plan": "pro_plan", "updated_at": datetime.now(timezone.utc).isoformat()}}
)

# Update multiple documents
await db.users.update_many(
    {"plan": "free_trial"},
    {"$set": {"plan": "basic_plan"}}
)

# Delete one document
await db.sessions.delete_one({"token": expired_token})

# Delete multiple documents
await db.otp_codes.delete_many({"expires_at": {"$lt": datetime.now(timezone.utc)}})
```

---

## 6. Database Indexes

### Location: `backend/seed_data.py` (lines 2250-2289)

Indexes are created automatically on startup for optimal query performance:

```python
# Users collection
await db.users.create_index("id", unique=True)
await db.users.create_index("email", unique=True)
await db.users.create_index("plan")

# Sessions collection
await db.sessions.create_index("token", unique=True)
await db.sessions.create_index("user_id")
await db.sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL index

# Peer profiles
await db.peer_profiles.create_index("user_id", unique=True)
await db.peer_profiles.create_index([("is_listed", 1), ("peer_rating", -1)])

# Peer sessions
await db.peer_sessions.create_index("id", unique=True)
await db.peer_sessions.create_index([("requester_id", 1), ("date", 1)])
```

---

## 7. Database Seeding

### Location: `backend/seed_data.py`

The database is automatically seeded on startup with:
- Default subscription plans
- Discovery call questions
- Persistent images (logos, photos)
- Testimonials
- Initial mentors, videos, workshops, drills, materials
- Mentor availability slots

---

## 8. Database Migrations

### Location: `backend/migrations/startup_migrations.py`

Startup migrations run automatically to ensure:
- Plan configurations are correct
- User data integrity
- Feature access matrix consistency
- Image migrations to MongoDB

---

## 9. Environment Configuration

### Required Environment Variables:

```bash
# In backend/.env
MONGO_URL=mongodb://localhost:27017  # MongoDB connection URL
DB_NAME=gradnext_local              # Database name
```

### Connection String Formats:

- **Local:** `mongodb://localhost:27017`
- **With Auth:** `mongodb://username:password@host:port/database`
- **Replica Set:** `mongodb://host1:port1,host2:port2/database?replicaSet=rs0`
- **Atlas:** `mongodb+srv://username:password@cluster.mongodb.net/database`

---

## 10. Example: Complete Route Handler

```python
from fastapi import APIRouter, HTTPException, Request
from routes.auth import get_current_user, get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/example", tags=["example"])

@router.get("/users/{user_id}")
async def get_user(user_id: str, request: Request):
    """Get user by ID"""
    db = get_db(request)  # Get database instance
    
    # Query database
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.post("/users")
async def create_user(user_data: dict, request: Request):
    """Create a new user"""
    db = get_db(request)
    
    # Check if user exists
    existing = await db.users.find_one({"email": user_data["email"]})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Insert new user
    new_user = {
        "id": str(uuid.uuid4()),
        **user_data,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    return {"id": new_user["id"], "message": "User created"}
```

---

## Summary

1. **Database initialized** in `server.py` using `AsyncIOMotorClient`
2. **Stored** in `app.state.db` during startup
3. **Accessed** via `get_db(request)` helper function in routes
4. **Collections** accessed as `db.collection_name`
5. **All operations** are async using `await`
6. **Indexes** created automatically for performance
7. **Seeding** happens on startup
8. **Migrations** run automatically to ensure data consistency
