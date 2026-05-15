# 🚀 Production Deployment Guide

## ⚠️ CRITICAL: Complete This Checklist Before Deploying

### 1. Environment Variables (MUST DO)

#### Backend `.env` File
**SECURITY CRITICAL**: The current `.env` file contains LIVE API keys. You MUST:

```bash
# ❌ NEVER commit these to git
# ❌ NEVER share these publicly
# ✅ Store in secure environment variable manager (AWS Secrets Manager, etc.)

# Required Environment Variables:
MONGO_URL=mongodb://your-production-mongodb:27017
DB_NAME=gradnext_production
CORS_ORIGINS=https://yourdomain.com
RAZORPAY_KEY_ID=your_production_key
RAZORPAY_KEY_SECRET=your_production_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_oauth_client_secret
REACT_APP_BACKEND_URL=https://api.yourdomain.com
GOOGLE_SERVICE_ACCOUNT_JSON='{"type": "service_account", ...}'
GOOGLE_IMPERSONATE_EMAIL=your_admin_email@domain.com
EMERGENT_LLM_KEY=your_emergent_key
```

#### Frontend `.env` File
```bash
REACT_APP_BACKEND_URL=https://api.yourdomain.com
REACT_APP_GOOGLE_CLIENT_ID=your_oauth_client_id
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
GENERATE_SOURCEMAP=false
FAST_REFRESH=false
```

### 2. Security Checklist

- [ ] **Change all API keys to production keys**
- [ ] **Update CORS_ORIGINS** from `*` to your actual domain
- [ ] **Enable HTTPS** (required for OAuth and payments)
- [ ] **Set secure MongoDB connection** with authentication
- [ ] **Add rate limiting** to prevent abuse
- [ ] **Enable request validation** on all endpoints
- [ ] **Set up monitoring** (error tracking, performance)

### 3. Database Setup

```bash
# Production MongoDB should have:
# - Authentication enabled
# - Replica set for high availability
# - Regular backups configured
# - Indexes created (done automatically on first run)

# Connection string format:
mongodb://username:password@host:port/database?authSource=admin&replicaSet=rs0
```

### 4. Payment Gateway (Razorpay)

- [ ] Switch from **test keys** to **live keys**
- [ ] Configure **webhook endpoint**: `https://api.yourdomain.com/api/subscriptions/webhook`
- [ ] Add webhook secret to environment variables
- [ ] Test webhook signature verification
- [ ] Configure payment success/failure URLs

### 5. Google OAuth Setup

- [ ] Add production domain to **Authorized JavaScript origins**
- [ ] Add redirect URIs: `https://yourdomain.com`
- [ ] Update **Google Cloud Console** OAuth consent screen
- [ ] Verify Google Calendar API is enabled
- [ ] Test OAuth flow in production

### 6. Build & Deployment

#### Frontend Build
```bash
cd /app/frontend
yarn install --production
yarn build

# This creates /app/frontend/build directory
# Serve this with nginx or your CDN
```

#### Backend Deployment
```bash
cd /app/backend
pip install -r requirements.txt

# Run with production WSGI server (already configured with uvicorn)
# supervisord will manage the process
```

### 7. Nginx Configuration (if using nginx)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /app/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8. Health Checks & Monitoring

Test these endpoints before going live:

```bash
# Backend health
curl https://api.yourdomain.com/api/health
# Expected: {"status":"healthy"}

# Migration status
curl https://api.yourdomain.com/api/health/migrations
# Should return comprehensive system status

# Frontend
curl https://yourdomain.com
# Should return HTML
```

### 9. Pre-Launch Testing

- [ ] Test user registration flow
- [ ] Test Google OAuth login
- [ ] Test Razorpay payment flow (with test card)
- [ ] Test subscription activation
- [ ] Test upgrade/downgrade flows
- [ ] Test coaching session booking
- [ ] Test peer practice booking
- [ ] Test video/drill access control
- [ ] Test email notifications
- [ ] Test mobile responsiveness

### 10. Post-Launch Monitoring

Set up alerts for:
- Server errors (500s)
- Payment failures
- Database connection issues
- High response times (>1s)
- Failed login attempts
- Webhook delivery failures

### 11. Backup Strategy

```bash
# Daily MongoDB backups
mongodump --uri="mongodb://..." --out=/backups/$(date +%Y%m%d)

# Keep last 30 days of backups
# Store offsite (S3, Google Cloud Storage)
```

### 12. Performance Optimization

- [ ] Enable **gzip compression** on nginx
- [ ] Set proper **cache headers** for static assets
- [ ] Use **CDN** for frontend assets
- [ ] Enable **database query indexing** (auto-created on startup)
- [ ] Configure **connection pooling** (already set to 100 max connections)

## 🔒 Security Best Practices

1. **Never expose `.env` files** in git or public repositories
2. **Use HTTPS everywhere** - no HTTP endpoints
3. **Validate all user inputs** on backend
4. **Rate limit API endpoints** to prevent abuse
5. **Log security events** (failed logins, suspicious activity)
6. **Keep dependencies updated** regularly
7. **Use secure session management** (already implemented with httponly cookies)

## 📊 Scaling Considerations

Current configuration supports:
- **100 concurrent database connections**
- **Connection pooling** with automatic retry
- **MongoDB indexes** for fast queries
- **Async I/O** for high throughput

For >1000 concurrent users, consider:
- Load balancer with multiple backend instances
- Redis for session storage
- CDN for static assets
- Database read replicas

## 🆘 Troubleshooting

### Services not starting
```bash
sudo supervisorctl status
sudo supervisorctl restart all
tail -f /var/log/supervisor/backend.err.log
```

### Database connection issues
```bash
# Check MongoDB is running
sudo systemctl status mongodb

# Test connection
mongo $MONGO_URL --eval "db.adminCommand('ping')"
```

### Frontend not loading
```bash
# Check nginx
sudo systemctl status nginx
sudo nginx -t

# Check build
ls -la /app/frontend/build
```

## ✅ Final Checklist

Before going live:
- [ ] All environment variables configured
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database backups scheduled
- [ ] Payment gateway in live mode
- [ ] OAuth configured for production domain
- [ ] All tests passing
- [ ] Error monitoring configured
- [ ] Team has access to logs and monitoring
- [ ] Rollback plan documented
- [ ] Support team trained

## 🎉 You're Ready!

Once all checkboxes are complete, you can deploy to production with confidence.

**Support**: If you encounter issues, check:
1. Backend logs: `/var/log/supervisor/backend.err.log`
2. Frontend logs: Browser console
3. Database logs: `/var/log/mongodb/mongod.log`
4. Health check: `https://api.yourdomain.com/api/health/migrations`
