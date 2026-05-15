# 🔒 Security Checklist for Production

## ⚠️ CRITICAL SECURITY ISSUES TO FIX

### 1. Environment Variables
- [ ] **NEVER commit `.env` files to git**
- [ ] All API keys moved to secure vault (AWS Secrets Manager, etc.)
- [ ] `.env.template` files are safe to commit (no actual secrets)
- [ ] Production keys are different from development/test keys

### 2. CORS Configuration
**Current Issue**: `CORS_ORIGINS="*"` allows ANY domain

```bash
# ❌ INSECURE (Current)
CORS_ORIGINS="*"

# ✅ SECURE (Production)
CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

**Action Required**: Update `backend/.env` with your actual domain

### 3. API Keys Exposed
**CRITICAL**: Your current `.env` file contains LIVE Razorpay keys:
- `rzp_live_S75Pm55LYocWaN`

**Immediate Actions**:
1. Rotate these keys immediately in Razorpay dashboard
2. Never commit real keys to git
3. Use environment variable injection in production

### 4. Database Security
```bash
# ❌ INSECURE (Current - no authentication)
MONGO_URL="mongodb://localhost:27017"

# ✅ SECURE (Production)
MONGO_URL="mongodb://username:password@host:port/database?authSource=admin&ssl=true"
```

### 5. HTTPS Enforcement
- [ ] SSL certificate installed and configured
- [ ] All HTTP requests redirect to HTTPS
- [ ] OAuth callbacks use HTTPS only
- [ ] Payment webhooks use HTTPS only

### 6. Rate Limiting
Add rate limiting to prevent abuse:

```python
# In backend/server.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Apply to sensitive endpoints
@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(...):
    ...
```

### 7. Input Validation
- [ ] All user inputs validated on backend
- [ ] SQL injection prevention (using parameterized queries)
- [ ] XSS prevention (React handles this by default)
- [ ] File upload validation (if applicable)

### 8. Session Security
**Good**: Already using httpOnly cookies ✅

**Add**:
```python
# Set secure cookie attributes in production
cookie_secure = True  # Only send over HTTPS
cookie_samesite = "lax"  # CSRF protection
```

### 9. Error Handling
```python
# ❌ INSECURE - Exposes internal details
raise HTTPException(status_code=500, detail=str(error))

# ✅ SECURE - Generic message
logger.error(f"Internal error: {error}")
raise HTTPException(status_code=500, detail="An error occurred. Please try again.")
```

### 10. Dependency Security
```bash
# Check for vulnerabilities
cd /app/backend
pip install safety
safety check

cd /app/frontend
npm audit
```

## 📋 Pre-Launch Security Review

### Authentication & Authorization
- [ ] Password hashing uses bcrypt ✅ (already implemented)
- [ ] JWT tokens have expiration ✅ (already implemented)
- [ ] OAuth tokens refreshed properly
- [ ] Admin routes require admin role ✅ (already implemented)
- [ ] User can only access their own data

### Payment Security
- [ ] Razorpay webhook signature verified ✅ (already implemented)
- [ ] Payment amounts validated on backend
- [ ] No payment data stored locally (use Razorpay vault)
- [ ] PCI DSS compliance maintained (Razorpay handles this)

### Data Protection
- [ ] Personal data encrypted in transit (HTTPS)
- [ ] Sensitive data not logged
- [ ] Regular database backups
- [ ] Data retention policy defined
- [ ] GDPR compliance (if applicable)

### API Security
- [ ] All endpoints require authentication (except public ones)
- [ ] Rate limiting on sensitive endpoints
- [ ] Request size limits enforced
- [ ] Timeout configured for long operations

### Infrastructure
- [ ] Firewall rules configured
- [ ] MongoDB not exposed to public internet
- [ ] SSH keys only (no password auth)
- [ ] Regular security updates applied
- [ ] Monitoring and alerting configured

## 🚨 Incident Response Plan

If you detect a security breach:

1. **Immediately**:
   - Rotate all API keys and secrets
   - Change database passwords
   - Review access logs

2. **Within 24 hours**:
   - Identify scope of breach
   - Notify affected users (if applicable)
   - Document incident

3. **Within 72 hours**:
   - Implement fixes
   - Conduct security audit
   - Update security procedures

## 🔍 Regular Security Maintenance

### Weekly
- Review access logs for suspicious activity
- Check error logs for security-related errors

### Monthly
- Update all dependencies
- Review and rotate API keys
- Check for security patches

### Quarterly
- Full security audit
- Penetration testing (if budget allows)
- Review and update security policies

## 📞 Security Contacts

- Razorpay Security: security@razorpay.com
- Google Cloud Security: https://cloud.google.com/security
- Report vulnerabilities: security@yourdomain.com

## ✅ Sign-Off

Before deploying to production:

- [ ] All items in this checklist completed
- [ ] Security review conducted
- [ ] Team trained on security practices
- [ ] Incident response plan documented
- [ ] Monitoring and alerting configured

**Reviewed by**: _______________  
**Date**: _______________  
**Approved for production**: ☐ Yes ☐ No
