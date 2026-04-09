# Guide Complet: Security Deep Dive & Best Practices

## Table des matières
1. [Authentication Security](#auth)
2. [Authorization & Access Control](#authz)
3. [Data Protection](#data)
4. [API Security](#api)
5. [Frontend Security](#frontend)
6. [Security Checklist](#checklist)

---

## Authentication Security {#auth}

### Password Hashing (Argon2)

```python
# backend/python/app/core/security/security_password.py

from passlib.context import CryptContext
from passlib.exc import InvalidHash

# Configure Argon2 (winner of Password Hashing Competition 2015)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    # Argon2 parameters (memory, time, parallelism)
    argon2__memory_cost=65536,      # 64 MB
    argon2__time_cost=3,             # 3 iterations
    argon2__parallelism=4            # 4 threads
)

def hash_password(plain_password: str) -> str:
    """
    Hash password using Argon2
    
    Why Argon2?
    - Resistant to GPU/ASIC attacks (memory hard)
    - Winner of Password Hashing Competition
    - Slow enough to resist brute force (1-2 seconds per hash)
    - Safe against timing attacks
    """
    if not plain_password or len(plain_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against hash
    Constant-time comparison (resistant to timing attacks)
    """
    try:
        # pwd_context.verify() uses constant-time comparison
        return pwd_context.verify(plain_password, hashed_password)
    except InvalidHash:
        return False

# Example password hashing flow
# Plain: "MyPassword123!"
# Hashed: "$argon2id$v=19$m=65536,t=3,p=4$salt16bytes$hashedpasswordhex"
```

**Why Argon2 over others?**
- ❌ MD5: Cryptographically broken
- ❌ SHA-256: Fast (bad for passwords - can be brute forced)
- ❌ bcrypt: Slower than Argon2, less parallelizable
- ✅ Argon2: Memory-hard, GPU resistant, configurable parameters

### JWT Tokens

```python
# backend/python/app/core/security/security_tokens.py

from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.core.config import settings

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Create JWT token
    
    Structure:
    - Header: { "alg": "HS256", "typ": "JWT" }
    - Payload: { "sub": user_id, "exp": expiration_time, ... }
    - Signature: HMAC-SHA256(header.payload, SECRET_KEY)
    """
    
    to_encode = data.copy()
    
    # Set expiration
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    
    # Sign with SECRET_KEY
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM  # HS256
    )
    
    return encoded_jwt

def verify_token(token: str) -> dict:
    """
    Verify JWT token and return payload
    
    Raises JWTError if:
    - Signature invalid (tampering)
    - Token expired
    - Token malformed
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: int = payload.get("sub")
        
        if user_id is None:
            raise JWTError("No user_id in token")
        
        return payload
    
    except JWTError as e:
        raise JWTError(f"Invalid token: {str(e)}")

# Example JWT flow
# 1. User logs in with password
# 2. create_access_token({"sub": user_id}) → JWT
# 3. User includes JWT in header: "Authorization: Bearer eyJ0..."
# 4. Backend: verify_token(token) → {"sub": 123, "exp": ...}
# 5. Extract user_id = 123 from token
```

**JWT Security Best Practices:**
- ✅ Use strong SECRET_KEY (50+ random characters)
- ✅ Use HS256 for symmetric (backend only) or RS256 for asymmetric (multi-service)
- ✅ Set reasonable expiration (15-60 minutes)
- ✅ Use HTTPS (prevents token interception)
- ✅ Store in `Authorization` header, not cookies
- ❌ Don't store sensitive data in payload (it's base64 encoded, not encrypted)
- ❌ Don't use short expiration times (causes more token refreshes = attack surface)

### Token Refresh

```python
# backend/python/app/core/security/security_auth.py

from datetime import timedelta

def create_tokens(user_id: int):
    """Create both access and refresh tokens"""
    
    # Short-lived access token (15 minutes)
    access_token = create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(minutes=15)
    )
    
    # Long-lived refresh token (7 days)
    refresh_token = create_access_token(
        data={"sub": user_id, "type": "refresh"},
        expires_delta=timedelta(days=7)
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 900  # 15 minutes in seconds
    }

# API routes
@app.post("/api/auth/token/refresh")
async def refresh_token(refresh_token: str):
    """Get new access token using refresh token"""
    try:
        payload = verify_token(refresh_token)
        
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        
        # Create new access token
        new_access_token = create_access_token(
            data={"sub": user_id},
            expires_delta=timedelta(minutes=15)
        )
        
        return {"access_token": new_access_token}
    
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
```

---

## Authorization & Access Control {#authz}

### Role-Based Access Control (RBAC)

```python
# backend/python/app/core/security/rbac.py

from enum import Enum
from typing import List

class Role(str, Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"

class Permission(str, Enum):
    PLAY_GAME = "play:game"
    CHAT = "chat:message"
    MANAGE_FRIENDS = "friends:manage"
    BAN_USERS = "users:ban"
    MANAGE_SYSTEM = "system:manage"

# Role → Permissions mapping
ROLE_PERMISSIONS = {
    Role.USER: [
        Permission.PLAY_GAME,
        Permission.CHAT,
        Permission.MANAGE_FRIENDS
    ],
    Role.MODERATOR: [
        Permission.PLAY_GAME,
        Permission.CHAT,
        Permission.MANAGE_FRIENDS,
        Permission.BAN_USERS
    ],
    Role.ADMIN: [
        Permission.PLAY_GAME,
        Permission.CHAT,
        Permission.MANAGE_FRIENDS,
        Permission.BAN_USERS,
        Permission.MANAGE_SYSTEM
    ]
}

def get_user_permissions(role: Role) -> List[Permission]:
    """Get permissions for role"""
    return ROLE_PERMISSIONS.get(role, [])

def has_permission(user_role: Role, required_permission: Permission) -> bool:
    """Check if user has permission"""
    permissions = get_user_permissions(user_role)
    return required_permission in permissions
```

### Dependency Injection (FastAPI)

```python
# backend/python/app/dependencies.py

from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.core.security.rbac import has_permission, Permission, Role
from app.models.user import User

async def get_current_user_with_permission(
    permission: Permission,
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency: Get current user AND verify has permission
    
    Usage: @app.post("/api/users/{id}/ban")
           async def ban_user(id: int, current_user: User = Depends(
               lambda cu=Depends(get_current_user_with_permission, 
                                 permission=Permission.BAN_USERS): ...
           ))
    """
    
    if not has_permission(current_user.role, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {permission.value}"
        )
    
    return current_user

# Simpler usage with decorator
def require_permission(permission: Permission):
    """Decorator for requiring permission"""
    async def verify_permission(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission.value}"
            )
        return current_user
    
    return verify_permission

# Usage
@app.post("/api/users/{id}/ban")
async def ban_user(
    id: int,
    current_user: User = Depends(require_permission(Permission.BAN_USERS))
):
    # User must have BAN_USERS permission or 403 error
    pass
```

---

## Data Protection {#data}

### Encryption at Rest

```python
# backend/python/services/encryption.py

from cryptography.fernet import Fernet
from app.core.config import settings

class EncryptionService:
    def __init__(self, key: str):
        """Initialize with encryption key"""
        self.cipher = Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(ciphertext.encode()).decode()

# Generate key once
def generate_encryption_key():
    return Fernet.generate_key().decode()

# Usage for sensitive data
encryption_service = EncryptionService(settings.ENCRYPTION_KEY)

# Encrypt phone number
encrypted_phone = encryption_service.encrypt("+33612345678")

# Decrypt when needed
phone = encryption_service.decrypt(encrypted_phone)
```

### Secrets Management

```python
# .env.example (commit this, not secrets)
DATABASE_PASSWORD=CHANGE_ME
SECRET_KEY=CHANGE_ME
JWT_SECRET=CHANGE_ME

# .env (never commit)
DATABASE_PASSWORD=actual_password
SECRET_KEY=very-long-random-string
JWT_SECRET=another-random-string

# In production, use:
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
# - Environment variables from CI/CD

# NOT in Git, NOT in config files!
```

### SQL Injection Prevention

```python
# ❌ DANGEROUS - SQL Injection vulnerability
def find_user_bad(email: str):
    query = f"SELECT * FROM users WHERE email = '{email}'"
    return db.execute(query)

# Attacker: email = "' OR '1'='1"
# Query becomes: "SELECT * FROM users WHERE email = '' OR '1'='1'"
# Returns ALL users!

# ✅ SAFE - Parameterized query
def find_user_good(email: str):
    query = "SELECT * FROM users WHERE email = ?"
    return db.execute(query, (email,))

# SQLAlchemy uses parameterized queries by default
user = db.query(User).filter(User.email == email).first()
# Equivalent to: SELECT * FROM users WHERE email = ? (safe)
```

---

## API Security {#api}

### CORS (Cross-Origin Resource Sharing)

```python
# backend/python/app/main.py

from fastapi.middleware.cors import CORSMiddleware

# Whitelist specific origins (NOT *)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.example.com",
        "https://www.example.com",
        # NOT "http://localhost:3000" in production!
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600
)

# ❌ INSECURE:
allow_origins=["*"]  # Allows ANY website to call your API

# ✅ SECURE:
allow_origins=["https://app.example.com"]  # Only your frontend
```

### Rate Limiting

```python
# backend/python/app/middleware/rate_limit.py

from fastapi import Request, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)  # IP → [timestamps]
    
    def is_allowed(self, ip: str) -> bool:
        """Check if request from IP is allowed"""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=self.window_seconds)
        
        # Remove old requests
        self.requests[ip] = [
            t for t in self.requests[ip] if t > cutoff
        ]
        
        # Check limit
        if len(self.requests[ip]) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[ip].append(now)
        return True

rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limit: 100 requests per minute per IP"""
    
    client_ip = request.client.host
    
    if not rate_limiter.is_allowed(client_ip):
        return HTTPException(
            status_code=429,  # Too Many Requests
            detail="Rate limit exceeded"
        )
    
    return await call_next(request)
```

### Security Headers

```python
# backend/python/app/middleware/security_headers.py

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions policy (formerly Feature-Policy)
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Content Security Policy (prevent inline scripts, etc)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.example.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self' wss: https:"
    )
    
    return response
```

---

## Frontend Security {#frontend}

### XSS Prevention

```javascript
// ❌ VULNERABLE - Direct HTML injection
const userComment = getUserComment()  // "<script>alert('hacked')</script>"
element.innerHTML = userComment      // Executes script!

// ✅ SAFE - Text content (no HTML parsing)
element.textContent = userComment    // Renders literally

// ✅ SAFE - Vue escaping (automatic)
<template>
  <p>{{ userComment }}</p>  <!-- Automatically escaped -->
</template>

// ✅ SAFE - DOMPurify library (if HTML needed)
import DOMPurify from 'dompurify'
element.innerHTML = DOMPurify.sanitize(userComment)
```

### CSRF Protection

```javascript
// Backend sends CSRF token with form
const token = document.querySelector('input[name="csrf_token"]').value

// Frontend includes token in requests
fetch('/api/action', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
})

// Backend verifies token matches session
```

### Secure Storage

```javascript
// ❌ DON'T store sensitive data in localStorage (XSS accessible)
localStorage.setItem('password', password)  // Bad!
localStorage.setItem('private_key', key)   // Bad!

// ✅ DO store tokens in httpOnly cookies (XSS cannot access)
// (set by backend via Set-Cookie header)
// Cookie with httpOnly + Secure flags

// ✅ DO store non-sensitive data in sessionStorage
sessionStorage.setItem('ui_theme', 'dark')  // OK

// ✅ DO use memory for sensitive data (lost on page reload)
let userSession = {
  token: null,
  userId: null,
  expiresAt: null
}
```

---

## Security Checklist {#checklist}

### Backend Security

```
✅ Authentication
  - [ ] Using Argon2 for password hashing
  - [ ] JWT tokens with reasonable expiration (15-60 min)
  - [ ] Token validation on every protected route
  - [ ] Refresh token mechanism
  - [ ] HTTPS only (no HTTP)

✅ Authorization
  - [ ] Role-based access control implemented
  - [ ] Permission checks on all sensitive operations
  - [ ] Admin operations require explicit permission
  - [ ] User can only access their own data

✅ Data Protection
  - [ ] Sensitive data encrypted at rest
  - [ ] Database credentials in .env (not code)
  - [ ] No plain-text passwords in logs
  - [ ] SQL injection prevention (parameterized queries)
  - [ ] Backup encryption

✅ API Security
  - [ ] CORS whitelist configured (not *)
  - [ ] Rate limiting enabled
  - [ ] Security headers set (CSP, X-Frame-Options, etc)
  - [ ] HTTPS/TLS enforced
  - [ ] No sensitive data in URLs
  - [ ] Validate all user inputs

✅ Secrets Management
  - [ ] SECRET_KEY is 50+ random characters
  - [ ] .env file in .gitignore
  - [ ] No credentials in code
  - [ ] Rotation policy for tokens/keys
  - [ ] Separate keys for dev/prod
```

### Frontend Security

```
✅ Client-Side
  - [ ] XSS prevention (escape user input)
  - [ ] CSRF tokens on forms
  - [ ] No sensitive data in localStorage
  - [ ] Content Security Policy headers
  - [ ] Dependencies updated regularly
  - [ ] Secure cookies (httpOnly, Secure, SameSite)

✅ Network
  - [ ] HTTPS only
  - [ ] Certificate pinning (if high security needed)
  - [ ] WSS for WebSocket (not WS)
  - [ ] Prevent Man-in-the-Middle attacks
```

### Deployment Security

```
✅ Infrastructure
  - [ ] Firewall rules configured
  - [ ] Only necessary ports open
  - [ ] Database not publicly accessible
  - [ ] Regular security updates
  - [ ] Monitoring/alerting enabled
  - [ ] Logs retention and rotation
  - [ ] Backup strategy tested
  - [ ] Disaster recovery plan

✅ CI/CD
  - [ ] Secrets not in build logs
  - [ ] Signed commits/releases
  - [ ] Automated security scanning
  - [ ] Code review required
  - [ ] Zero-trust deployment
```

