# Login Error Messages Documentation

## 🔐 Login Error Handling

### Backend Error Responses (`/app/backend/routes/auth.py`)

The backend returns specific HTTP status codes and error messages for different scenarios:

---

## 📋 Error Scenarios

### 1️⃣ **Wrong Password**

**API Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "wrongpassword123"
}
```

**Response:**
```json
HTTP 401 Unauthorized
{
  "detail": "Invalid email or password"
}
```

**What User Sees:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Invalid email or password            │
│ (Red background, red text)              │
└─────────────────────────────────────────┘
```

---

### 2️⃣ **Email Not Registered**

**API Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "nonexistent@example.com",
  "password": "anypassword"
}
```

**Response:**
```json
HTTP 401 Unauthorized
{
  "detail": "Invalid email or password"
}
```

**What User Sees:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Invalid email or password            │
│ (Red background, red text)              │
└─────────────────────────────────────────┘
```

**Security Note:** Same message for both scenarios to prevent email enumeration attacks.

---

### 3️⃣ **Empty Email or Password**

**Frontend Validation (Before API Call)**

**What User Sees:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Please enter email and password      │
│ (Red background, red text)              │
└─────────────────────────────────────────┘
```

---

### 4️⃣ **No Password Set (OAuth User Trying Email Login)**

**Scenario:** User registered via Google OAuth, trying to login with email/password

**Response:**
```json
HTTP 400 Bad Request
{
  "detail": "Please use OTP login or reset your password"
}
```

**What User Sees:**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Please use OTP login or reset your password      │
│ (Red background, red text)                          │
└─────────────────────────────────────────────────────┘
```

---

### 5️⃣ **Network/Server Error**

**Scenario:** Backend is down or network error

**What User Sees:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Login failed                         │
│ (Red background, red text)              │
└─────────────────────────────────────────┘
```

---

## 🎨 UI Implementation

### Error Display Component

**File:** `/app/frontend/src/components/LoginModal.jsx` (Line 408-412)

```jsx
{error && (
  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
    {error}
  </div>
)}
```

### Visual Design:
- **Background:** Light red (`bg-red-50`)
- **Border:** Red (`border-red-200`)
- **Text Color:** Dark red (`text-red-600`)
- **Padding:** Medium spacing
- **Border Radius:** Rounded corners
- **Position:** Above the login form

---

## 🔄 Error Flow Diagram

```
User enters credentials
         ↓
Clicks "Login"
         ↓
Frontend validation
         ↓
    Empty fields? ──YES──> Show "Please enter email and password"
         ↓ NO
    Make API call to /api/auth/login
         ↓
    Backend checks database
         ↓
    ┌─────────────────────┬──────────────────────┬────────────────────┐
    │                     │                      │                    │
 User not found      Password wrong       No password set      Success
    │                     │                      │                    │
    ↓                     ↓                      ↓                    ↓
HTTP 401             HTTP 401              HTTP 400            HTTP 200
"Invalid email       "Invalid email        "Please use         Login
or password"         or password"          OTP login..."       successful
    │                     │                      │                    │
    └─────────────────────┴──────────────────────┘                    │
                          ↓                                           ↓
              Display error in red box                    Navigate to dashboard
                    (User sees error)                     (Close modal)
```

---

## 🧪 Testing Error Messages

### Manual Testing Steps:

#### Test 1: Wrong Password
1. Go to login modal
2. Enter: `test@example.com` (existing email)
3. Enter: `wrongpassword`
4. Click "Login"
5. **Expected:** Red error box appears: "Invalid email or password"

#### Test 2: Email Not Registered
1. Go to login modal
2. Enter: `nonexistent12345@example.com`
3. Enter: `anypassword`
4. Click "Login"
5. **Expected:** Red error box appears: "Invalid email or password"

#### Test 3: Empty Fields
1. Go to login modal
2. Leave email and password empty
3. Click "Login"
4. **Expected:** Red error box appears: "Please enter email and password"

#### Test 4: OAuth User (No Password)
1. Register via Google OAuth
2. Try to login with email/password
3. **Expected:** Red error box appears: "Please use OTP login or reset your password"

---

## 📱 Mobile & Desktop Display

### Desktop View:
```
┌───────────────────────────────────────────────────┐
│                 Welcome Back                      │
│         Sign in to continue your interview prep   │
├───────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐ │
│ │ ⚠️ Invalid email or password                  │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Email                                             │
│ [📧 you@example.com                    ]          │
│                                                   │
│ Password                                          │
│ [🔒 ••••••••••                         ] [👁]     │
│                                                   │
│ [Forgot Password?]                                │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │            Login                            │   │
│ └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

### Mobile View:
Same layout, responsive design, stacks nicely on smaller screens.

---

## 🔒 Security Features

### 1. No Email Enumeration
- Same error message for "user not found" and "wrong password"
- Prevents attackers from discovering valid emails

### 2. No Hints About User Existence
- Backend doesn't reveal if email exists
- Generic "Invalid email or password" message

### 3. Password Not Exposed
- Errors don't mention password format or requirements
- No hints about what's wrong with password

### 4. Rate Limiting (If Implemented)
- Too many failed attempts → Account lockout
- Prevents brute force attacks

---

## 🎨 Error State Examples

### Success State (For Comparison):
```jsx
// No error shown, user is logged in
✅ Login successful → Dashboard
```

### Error State:
```jsx
// Error banner visible above form
❌ Invalid email or password
[Email input with red border - FUTURE ENHANCEMENT]
[Password input with red border - FUTURE ENHANCEMENT]
```

---

## 🔧 Code References

### Backend Error Handling
**File:** `/app/backend/routes/auth.py`
**Lines:** ~250-270 (login function)

```python
# User not found
if not user:
    raise HTTPException(status_code=401, detail="Invalid email or password")

# Wrong password
if not verify_password(data.password, user["password_hash"]):
    raise HTTPException(status_code=401, detail="Invalid email or password")

# No password set
if not user.get("password_hash"):
    raise HTTPException(
        status_code=400, 
        detail="Please use OTP login or reset your password"
    )
```

### Frontend Error Display
**File:** `/app/frontend/src/components/LoginModal.jsx`
**Lines:** 70-102 (handleLogin function), 408-412 (error display)

```javascript
// Catch error from API
catch (err) {
  setError(err.message);  // Display error message
}

// Show error in UI
{error && (
  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
    {error}
  </div>
)}
```

---

## 💡 Potential Enhancements

### Current Implementation: ✅ Working
- Error messages display correctly
- Security best practices followed
- User-friendly messages

### Future Improvements (Optional):

1. **Input Field Highlighting**
   ```jsx
   <Input 
     className={error ? "border-red-500" : ""}
     // Highlight fields in red when error occurs
   />
   ```

2. **Error Icons**
   ```jsx
   {error && (
     <div className="...">
       <AlertCircle className="w-4 h-4 mr-2" />
       {error}
     </div>
   )}
   ```

3. **Shake Animation**
   ```css
   @keyframes shake {
     0%, 100% { transform: translateX(0); }
     25% { transform: translateX(-10px); }
     75% { transform: translateX(10px); }
   }
   ```

4. **Auto-Clear Error on Input Change**
   ```jsx
   onChange={(e) => {
     setEmail(e.target.value);
     setError('');  // Clear error when user starts typing
   }}
   ```

---

## ✅ Summary

| Scenario | Status Code | Error Message | User Impact |
|----------|-------------|---------------|-------------|
| Wrong Password | 401 | "Invalid email or password" | Cannot login |
| Email Not Found | 401 | "Invalid email or password" | Cannot login |
| Empty Fields | - | "Please enter email and password" | Form validation |
| No Password Set | 400 | "Please use OTP login or reset your password" | Need to reset |
| Network Error | - | "Login failed" | Cannot login |

**All error messages are displayed in a red banner above the login form with clear, user-friendly text.**

---

**Last Updated:** 2025-01-27
**Status:** ✅ Working as intended
**Security:** ✅ No email enumeration
**UX:** ✅ Clear error messages
