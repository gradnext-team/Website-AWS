# Scalability Report: gradnext Platform

## Current Architecture Assessment

### Current Setup
| Component | Current Config | Max Capacity (Est.) |
|-----------|---------------|---------------------|
| Backend Workers | 1 worker (--workers 1) | ~100-200 concurrent |
| MongoDB | Single instance, no pooling config | ~500-1000 connections |
| Frontend | Development server (yarn start) | Not production-ready |
| Caching | Minimal (only calendar cache) | No request caching |
| CPU Cores | 4 available | Underutilized |
| Memory | 15GB (5.6GB used) | Sufficient headroom |

### Current Bottlenecks

1. **Single Worker Process**
   - Backend runs with only 1 uvicorn worker
   - Cannot utilize multiple CPU cores
   - Single point of failure

2. **No Connection Pooling**
   - MongoDB client has default pool settings
   - May exhaust connections under load

3. **Development Frontend Server**
   - React dev server not optimized for production
   - No static file optimization

4. **386 Database Queries**
   - Multiple endpoints make numerous DB calls
   - No query result caching

5. **No Redis/Caching Layer**
   - Every request hits the database
   - Session data stored in cookies only

---

## Recommendations for 5,000 Concurrent Users

### Phase 1: Quick Wins (Can handle ~1,000 users)

#### 1.1 Increase Backend Workers
```bash
# Change from:
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1

# To:
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

#### 1.2 Configure MongoDB Connection Pooling
```python
# In server.py, update MongoDB client:
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=100,
    minPoolSize=10,
    maxIdleTimeMS=30000,
    waitQueueTimeoutMS=5000
)
```

#### 1.3 Build Frontend for Production
```bash
cd /app/frontend
yarn build
# Serve with nginx instead of yarn start
```

### Phase 2: Caching Layer (Can handle ~2,500 users)

#### 2.1 Add Redis for Caching
```python
# Install: pip install redis aioredis

# Cache frequently accessed data:
# - Plans (changes rarely)
# - Logos (changes rarely)
# - Testimonials (changes rarely)
# - User session data
# - Peer availability (with short TTL)
```

#### 2.2 API Response Caching
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@router.get("/plans")
@cache(expire=300)  # 5 minute cache
async def get_plans():
    ...
```

### Phase 3: Database Optimization (Can handle ~4,000 users)

#### 3.1 Add MongoDB Indexes
```javascript
// Critical indexes for performance
db.users.createIndex({ "id": 1 }, { unique: true })
db.users.createIndex({ "email": 1 }, { unique: true })
db.peer_profiles.createIndex({ "user_id": 1 })
db.peer_profiles.createIndex({ "is_listed": 1, "peer_rating": -1 })
db.peer_sessions.createIndex({ "requester_id": 1, "date": 1 })
db.peer_sessions.createIndex({ "partner_id": 1, "date": 1 })
db.sessions.createIndex({ "token": 1 })
db.sessions.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
```

#### 3.2 Query Optimization
- Use projections to fetch only needed fields
- Batch related queries
- Use aggregation pipelines for complex queries

### Phase 4: Horizontal Scaling (5,000+ users)

#### 4.1 Load Balancer Configuration
```nginx
upstream backend {
    least_conn;
    server backend1:8001;
    server backend2:8001;
    server backend3:8001;
    keepalive 32;
}
```

#### 4.2 MongoDB Replica Set
- Primary + 2 Secondary nodes
- Read preference: secondaryPreferred for read-heavy endpoints

#### 4.3 Container Orchestration (Kubernetes)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gradnext-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

---

## Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 🔴 HIGH | Increase workers to 4 | 4x capacity | 5 min |
| 🔴 HIGH | MongoDB connection pooling | 2x stability | 10 min |
| 🔴 HIGH | Production frontend build | 3x faster loads | 15 min |
| 🟠 MED | Add Redis caching | 3x DB load reduction | 2 hours |
| 🟠 MED | Add MongoDB indexes | 5x query speed | 30 min |
| 🟢 LOW | Horizontal scaling | Unlimited scale | 1 day |

---

## Quick Implementation

To immediately improve capacity from ~200 to ~1,000 concurrent users:

### 1. Update MongoDB Client (server.py)
```python
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=100,
    minPoolSize=10,
    maxIdleTimeMS=30000
)
```

### 2. Add Database Indexes
Run in MongoDB shell or via script.

### 3. For Production Deployment
The Emergent platform handles worker scaling automatically during deployment.
Ensure your production MongoDB (Atlas/managed) has proper indexing.

---

## Estimated Capacity After Optimizations

| Optimization Level | Concurrent Users | Response Time |
|-------------------|------------------|---------------|
| Current | ~200 | 200-500ms |
| Phase 1 | ~1,000 | 100-200ms |
| Phase 1+2 | ~2,500 | 50-150ms |
| Phase 1+2+3 | ~4,000 | 30-100ms |
| Full (Phase 4) | 5,000+ | <50ms |

