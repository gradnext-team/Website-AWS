# 🔐 Admin Access Guide

## Admin Login Methods

Your platform has **two ways** to access admin functionality:

---

## Method 1: Mock Login (Quick Access for Testing) ⭐ RECOMMENDED

This is the **easiest and fastest** way to get admin access for testing and development.

### How to Login:

**Option A: Using API Endpoint**
```bash
# Login as admin
curl -X POST "http://localhost:8001/api/auth/mock-login?user_type=admin"

# Or from frontend (in browser console)
fetch('/api/auth/mock-login?user_type=admin', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Option B: Direct URL Access**
```
Navigate to your frontend and login, then use:
POST /api/auth/mock-login?user_type=admin
```

### Available Mock Users:

| User Type | Email | Role | Access |
|-----------|-------|------|--------|
| `admin` | admin@gradnext.co | Admin | Full admin dashboard access |
| `free` | free@gradnext.co | Free Trial | 7-day trial with limited access |
| `subscription` | pro@gradnext.co | Pro Plan | Full subscription features |
| `mentor` | mentor@gradnext.co | Mentor | Can conduct coaching sessions |
| `pinnacle` | pinnacle@gradnext.co | Pinnacle | Unlimited coaching access |

### Usage:
```bash
# Admin access
POST /api/auth/mock-login?user_type=admin

# Free trial user
POST /api/auth/mock-login?user_type=free

# Mentor
POST /api/auth/mock-login?user_type=mentor
```

---

## Method 2: Real User Account (Production Method)

For production, you should create a real admin account in the database.

### Admin User in Database:

Based on the test files, there are references to this admin account:

**Primary Admin Account:**
```
Email: info@gradnext.co
Password: KeiseiConsulting@2025
Role: Admin
```

**Note**: This account exists in the database but may require OTP login or password reset based on the auth configuration.

### Alternative Admin Accounts (from tests):
```
Email: admin@gradnext.com
Password: admin123
```

---

## Admin Dashboard Access

Once logged in as admin, you can access:

### Admin Routes:
```
/admin                    - Main admin dashboard
/admin/users              - User management
/admin/mentors            - Mentor management  
/admin/plans              - Plan management
/admin/sessions           - Session management
/admin/analytics          - Analytics & reports
```

### Admin API Endpoints:

**User Management:**
```
GET    /api/admin/users              - List all users
PUT    /api/admin/users/:id          - Update user details
POST   /api/admin/users/:id/upgrade  - Manually upgrade user plan
DELETE /api/admin/users/:id          - Delete user
```

**Plan Management:**
```
GET    /api/admin/plans              - List all subscription plans
POST   /api/admin/plans              - Create new plan
PUT    /api/admin/plans/:id          - Update plan details
DELETE /api/admin/plans/:id          - Delete plan
```

**Session Management:**
```
GET    /api/admin/sessions           - List all coaching sessions
PUT    /api/admin/sessions/:id       - Update session details
POST   /api/admin/sessions/:id/cancel - Cancel session
```

**Analytics:**
```
GET    /api/admin/analytics          - Platform analytics
GET    /api/admin/revenue            - Revenue reports
GET    /api/admin/users/stats        - User statistics
```

---

## Creating Admin Users

### Option 1: Using Mock Login (Development)
The mock login automatically creates admin users. Just call:
```bash
POST /api/auth/mock-login?user_type=admin
```

### Option 2: Database Insertion (Production)
```javascript
// In MongoDB shell or via script
db.users.insertOne({
  "id": "your-unique-id",
  "email": "youradmin@gradnext.co",
  "name": "Your Name",
  "password_hash": "bcrypt-hashed-password",
  "is_admin": true,
  "is_mentor": false,
  "plan": "free_trial",
  "created_at": new Date().toISOString(),
  "updated_at": new Date().toISOString(),
  "onboarding_completed": true
})
```

### Option 3: Promote Existing User
```javascript
// Update existing user to admin
db.users.updateOne(
  { "email": "user@example.com" },
  { 
    "$set": { 
      "is_admin": true,
      "updated_at": new Date().toISOString()
    } 
  }
)
```

---

## Admin Permissions

When `is_admin: true`, the user gets access to:

✅ **User Management**
- View all users
- Edit user profiles
- Manually upgrade/downgrade plans
- Reset passwords
- Delete accounts

✅ **Content Management**
- Add/edit videos
- Add/edit drills
- Add/edit workshops
- Manage case materials

✅ **Mentor Management**
- Approve/reject mentors
- Edit mentor profiles
- Set mentor availability
- View mentor performance

✅ **Subscription Management**
- View all subscriptions
- Manually extend/modify plans
- Process refunds
- Cancel subscriptions

✅ **Session Management**
- View all coaching sessions
- Reschedule sessions
- Cancel sessions
- Resolve disputes

✅ **Analytics & Reporting**
- User statistics
- Revenue reports
- Engagement metrics
- Churn analysis

---

## Testing Admin Access

### Quick Test (Mock Login):
```bash
# 1. Login as admin
curl -c cookies.txt -X POST "http://localhost:8001/api/auth/mock-login?user_type=admin"

# 2. Test admin endpoint
curl -b cookies.txt http://localhost:8001/api/admin/users

# 3. Verify response contains user list
```

### Frontend Test:
```javascript
// 1. Open browser console on your app
// 2. Login as admin
fetch('/api/auth/mock-login?user_type=admin', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(user => {
  console.log('Logged in as:', user.name);
  console.log('Is Admin:', user.is_admin);
});

// 3. Navigate to /admin
window.location.href = '/admin';
```

---

## Security Notes

### ⚠️ IMPORTANT for Production:

1. **Disable Mock Login**: 
   ```python
   # In auth.py, comment out or remove mock-login endpoint
   # OR restrict to localhost only
   if request.client.host != "127.0.0.1":
       raise HTTPException(status_code=403, detail="Mock login not available")
   ```

2. **Change Default Passwords**:
   - Never use `admin123` or test passwords in production
   - Use strong passwords (16+ characters)
   - Enable 2FA for admin accounts

3. **Limit Admin Access**:
   ```python
   # Add IP whitelist for admin endpoints
   ADMIN_ALLOWED_IPS = ["1.2.3.4", "5.6.7.8"]
   ```

4. **Monitor Admin Actions**:
   ```python
   # Log all admin activities
   @app.middleware("http")
   async def log_admin_actions(request: Request, call_next):
       if "/api/admin/" in request.url.path:
           logger.info(f"Admin action: {request.method} {request.url.path}")
       return await call_next(request)
   ```

5. **Rotate Admin Credentials**:
   - Change passwords every 90 days
   - Revoke sessions on password change
   - Review admin user list quarterly

---

## Troubleshooting

### "Not authorized" error
**Solution**: Ensure user has `is_admin: true` in database
```bash
# Check user status
curl http://localhost:8001/api/user/profile -b cookies.txt

# Should show: "is_admin": true
```

### Mock login not working
**Solution**: Check if endpoint is enabled
```bash
# Test endpoint exists
curl -X POST http://localhost:8001/api/auth/mock-login?user_type=admin

# Should return user object with is_admin: true
```

### Cannot access admin dashboard
**Solution**: Check frontend routing
```javascript
// Verify admin route exists in App.js
<Route path="/admin" element={<AdminDashboard />} />
```

### Admin endpoints return 403
**Solution**: 
1. Verify cookie is being sent with requests
2. Check session is still valid
3. Confirm user has admin flag in database

---

## Quick Reference

### Fastest Way to Get Admin Access (Development):
```bash
# Single command
curl -X POST "http://localhost:8001/api/auth/mock-login?user_type=admin"
```

### Production Admin Login:
```
Email: info@gradnext.co
Password: KeiseiConsulting@2025

OR register new account and set is_admin: true in database
```

### Check Current User Role:
```bash
curl http://localhost:8001/api/user/profile
# Look for: "is_admin": true
```

---

## Summary

✅ **Development**: Use `POST /api/auth/mock-login?user_type=admin`  
✅ **Production**: Use real account with `is_admin: true` flag  
✅ **Security**: Disable mock login, use strong passwords, enable monitoring  
✅ **Access**: `/admin` routes and `/api/admin/*` endpoints  

**Questions?** Check the logs at `/var/log/supervisor/backend.err.log`
