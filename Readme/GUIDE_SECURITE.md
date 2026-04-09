# 🔒 Guide Complet Sécurité - Étapes par Étapes

**Table des matières**
1. [Authentication](#auth)
2. [Password Hashing](#passwords)
3. [JWT Tokens](#jwt)
4. [Authorization & RBAC](#authorization)
5. [API Security](#api-security)
6. [Data Protection](#data)
7. [Frontend Security](#frontend)
8. [Deployment Security](#deployment)
9. [Security Checklist](#checklist)

---

## 1. Authentication {#auth}

### Étape 1.1: Signup Flow

```python
# app/api/routes/auth.py
from fastapi import APIRouter, HTTPException, status
from app.core.security import hash_password, create_access_token
from app.schemas.user import UserCreate
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Secure signup flow:
    1. Validate input (no SQL injection possible with Pydantic)
    2. Check email uniqueness
    3. Hash password with Argon2
    4. Store in database
    5. Create JWT token
    """
    
    # 1. Input validation (Pydantic handles this)
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters"
        )
    
    # 2. Check uniqueness
    if db.query(User).filter(User.email == user_data.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # 3. Hash password (NEVER store plain text!)
    hashed = hash_password(user_data.password)
    
    # 4. Create user
    user = User(
        email=user_data.email.lower(),  # Normalize email
        username=user_data.username,
        hashed_password=hashed
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 5. Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
```

### Étape 1.2: Login Security

```python
@router.post("/login")
async def login(email: str, password: str, db: Session = Depends(get_db)):
    """
    Secure login:
    1. Find user by email
    2. Constant-time password comparison (prevent timing attacks)
    3. Generate JWT if valid
    """
    
    # 1. Find user
    user = db.query(User).filter(
        User.email == email.lower()
    ).first()
    
    # 2. Use generic error (don't reveal if email exists)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"  # Generic!
        )
    
    # 3. Verify password (constant-time comparison via passlib)
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"  # Same message
        )
    
    # 4. Token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
```

---

## 2. Password Hashing {#passwords}

### Étape 2.1: Argon2 Configuration

```python
# app/core/security_hash.py
from passlib.context import CryptContext
from passlib.exc import InvalidTokenError

# Argon2 best practices (OWASP recommendations)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,    # 64 MB (high!)
    argon2__time_cost=3,          # 3 iterations
    argon2__parallelism=4         # 4 threads
)

def hash_password(password: str) -> str:
    """
    Hash password with Argon2.
    
    Why Argon2?
    - Memory-hard (resistant to GPU/ASIC attacks)
    - Time-consuming (slow = better security)
    - Configurable cost parameters
    - Won the Password Hashing Competition (2015)
    """
    
    # Validate password strength
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    # Hash (slow operation ~ 2-3 seconds)
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password with constant-time comparison.
    
    Prevents timing attacks:
    - Early return if lengths differ = timing leak
    - Use constant-time comparison for all bytes
    """
    
    try:
        # Passlib handles constant-time comparison internally
        return pwd_context.verify(plain_password, hashed_password)
    except (InvalidTokenError, ValueError):
        return False

# Example hashes (never the same!)
# hash_password("password123") → $argon2id$v=19$m=65536,t=3,p=4$...
# hash_password("password123") → $argon2id$v=19$m=65536,t=3,p=4$... (different!)
```

### Étape 2.2: Password Requirements

```python
# Enforce password requirements

def validate_password(password: str) -> bool:
    """Validate password strength"""
    
    checks = {
        "length": len(password) >= 8,
        "uppercase": any(c.isupper() for c in password),
        "lowercase": any(c.islower() for c in password),
        "digit": any(c.isdigit() for c in password),
        "special": any(c in "!@#$%^&*" for c in password)
    }
    
    # Require at least 3 of 5 checks
    score = sum(checks.values())
    return score >= 3

# Alternative: Use password-validator
from password_validator import PasswordValidator

schema = PasswordValidator()
schema.min(8) \
    .has().uppercase() \
    .has().lowercase() \
    .has().digits() \
    .has().symbols()

# Usage in signup
if not schema.validate(user_data.password):
    raise HTTPException(
        status_code=422,
        detail="Password must have 8+ chars, uppercase, lowercase, digit, symbol"
    )
```

---

## 3. JWT Tokens {#jwt}

### Étape 3.1: Token Creation

```python
# app/core/security_tokens.py
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.core.config import settings

def create_access_token(data: dict, expires_delta: timedelta = None):
    """
    Create JWT access token.
    
    Claims:
    - "sub" (subject): User ID
    - "exp" (expiration): Token expiry time
    - "iat" (issued at): Token creation time
    """
    
    to_encode = data.copy()
    
    # Set expiration (short-lived: 15-60 minutes)
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    
    # Encode JWT
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM  # HS256
    )
    
    return encoded_jwt

def create_refresh_token(user_id: int):
    """
    Create long-lived refresh token (7 days).
    
    Refresh pattern:
    - Access token: 15 minutes (short, logged out on reopen)
    - Refresh token: 7 days (long, persistent login)
    """
    
    expire = datetime.utcnow() + timedelta(days=7)
    
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
```

### Étape 3.2: Token Verification

```python
def verify_token(token: str):
    """
    Verify JWT token signature and expiration.
    
    Returns user_id if valid, None otherwise.
    """
    
    try:
        # Decode and verify
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id = payload.get("sub")
        
        if user_id is None:
            return None
        
        return user_id
    
    except JWTError as e:
        # Could be expired, invalid signature, etc
        print(f"Token verification failed: {e}")
        return None

def get_current_user(
    credentials: HTTPAuthCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency: Verify token and return current user.
    
    Used on protected routes:
    @router.get("/api/users/me")
    async def get_me(current_user: User = Depends(get_current_user)):
        ...
    """
    
    token = credentials.credentials
    user_id = verify_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Fetch user from database
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user
```

### Étape 3.3: Token Storage (Frontend)

```javascript
// ⚠️ Security Trade-offs

// Option 1: localStorage (convenient, vulnerable to XSS)
localStorage.setItem('token', jwtToken)
const token = localStorage.getItem('token')

// Option 2: sessionStorage (cleared on tab close)
sessionStorage.setItem('token', jwtToken)

// Option 3: Memory variable (lost on refresh, secure)
let token = null
// Pro: Not vulnerable to XSS
// Con: Lost on page refresh

// Option 4: httpOnly cookie (most secure, requires backend)
// Cookie set by backend: Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict
// Pro: Can't be stolen by XSS (JavaScript can't read)
// Con: Requires CSRF protection

// RECOMMENDED: httpOnly cookie + CSRF token
// Backend sends JWT in httpOnly cookie
// JavaScript sends CSRF token in header
```

---

## 4. Authorization & RBAC {#authorization}

### Étape 4.1: Role-Based Access Control

```python
# app/models/enums.py
from enum import Enum

class Role(str, Enum):
    """User roles"""
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"

class Permission(str, Enum):
    """Granular permissions"""
    CREATE_POST = "create_post"
    DELETE_POST = "delete_post"
    BAN_USER = "ban_user"
    VIEW_STATS = "view_stats"
    MANAGE_USERS = "manage_users"

# Role → Permission mapping
ROLE_PERMISSIONS = {
    Role.USER: [
        Permission.CREATE_POST,
        Permission.VIEW_STATS
    ],
    Role.MODERATOR: [
        Permission.CREATE_POST,
        Permission.DELETE_POST,
        Permission.BAN_USER,
        Permission.VIEW_STATS
    ],
    Role.ADMIN: [
        Permission.CREATE_POST,
        Permission.DELETE_POST,
        Permission.BAN_USER,
        Permission.VIEW_STATS,
        Permission.MANAGE_USERS
    ]
}
```

### Étape 4.2: Permission Checking

```python
# app/core/security_rbac.py
from fastapi import Depends, HTTPException, status
from functools import wraps

def require_permission(permission: Permission):
    """Dependency: Check user has permission"""
    
    async def check_permission(
        current_user: User = Depends(get_current_user)
    ):
        user_permissions = ROLE_PERMISSIONS.get(current_user.role, [])
        
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}"
            )
        
        return current_user
    
    return check_permission

def require_role(role: Role):
    """Dependency: Check user has role"""
    
    async def check_role(
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Admin role required"
            )
        
        return current_user
    
    return check_role
```

### Étape 4.3: Using RBAC

```python
# app/api/routes/admin.py
from app.core.security_rbac import require_role, require_permission

@router.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: User = Depends(require_permission(Permission.MANAGE_USERS))
):
    """Delete user - only admins with MANAGE_USERS permission"""
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted"}
```

---

## 5. API Security {#api-security}

### Étape 5.1: SQL Injection Prevention

```python
# ❌ VULNERABLE - String concatenation
user = db.query(User).filter(f"email = '{email}'").first()  # NO!

# ✅ SAFE - Parameterized queries (SQLAlchemy native)
user = db.query(User).filter(User.email == email).first()  # YES!

# ✅ SAFE - Text with bindparams
from sqlalchemy import text
user = db.query(User).filter(
    text("email = :email")
).params(email=email).first()
```

### Étape 5.2: CORS Configuration

```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

# ❌ INSECURE - Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"]  # NEVER!
)

# ✅ SECURE - Whitelist specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Dev
        "https://transcendence.com",  # Production
        "https://www.transcendence.com"
    ],
    allow_credentials=True,  # Allow cookies
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600
)
```

### Étape 5.3: Rate Limiting

```python
# app/middleware/rate_limit.py
from time import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting: 100 requests per minute per IP
    """
    
    def __init__(self, app, requests_per_minute=100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests = {}  # {ip: [timestamp, timestamp, ...]}
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host
        
        # Get current timestamp
        now = time()
        
        # Clean old requests (> 1 minute)
        if client_ip in self.requests:
            self.requests[client_ip] = [
                ts for ts in self.requests[client_ip]
                if now - ts < 60
            ]
        else:
            self.requests[client_ip] = []
        
        # Check rate limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )
        
        # Add this request
        self.requests[client_ip].append(now)
        
        return await call_next(request)

# Register in app
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
```

### Étape 5.4: Security Headers

```python
# app/middleware/security_headers.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' ws: wss:"
        )
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response
```

---

## 6. Data Protection {#data}

### Étape 6.1: Encryption at Rest

```python
# app/core/encryption.py
from cryptography.fernet import Fernet
import os

# Generate key (save securely!)
key = Fernet.generate_key()  # Store in .env
cipher = Fernet(key)

def encrypt_data(data: str) -> str:
    """Encrypt sensitive data"""
    return cipher.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data"""
    return cipher.decrypt(encrypted_data.encode()).decode()

# Usage: Encrypt sensitive user data
@router.post("/api/users/ssn")
async def set_ssn(
    ssn: str,
    current_user: User = Depends(get_current_user)
):
    encrypted_ssn = encrypt_data(ssn)
    current_user.encrypted_ssn = encrypted_ssn
    db.commit()
    return {"message": "SSN stored"}
```

### Étape 6.2: Secrets Management

```python
# ✅ .env file (never commit!)
JWT_SECRET_KEY=super_secret_key_generated_securely
DATABASE_PASSWORD=secure_db_password
API_KEY=third_party_api_key

# ❌ Never do this
SECRET_KEY = "hardcoded_secret"  # NO!

# ✅ Load from environment
import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY not set or too short!")
```

---

## 7. Frontend Security {#frontend}

### Étape 7.1: XSS Prevention

```javascript
// ❌ VULNERABLE - innerHTML allows script injection
element.innerHTML = userInput  // NO!

// ✅ SAFE - textContent (plain text only)
element.textContent = userInput

// ✅ SAFE - Vue auto-escapes
<div>{{ userInput }}</div>  <!-- Auto-escaped -->

// ❌ UNSAFE - Vue doesn't escape v-html
<div v-html="userInput"></div>  <!-- NEVER! -->

// ✅ Use DOMPurify for rich HTML
import DOMPurify from 'dompurify'

const clean = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: []
})
element.innerHTML = clean
```

### Étape 7.2: CSRF Protection

```javascript
// Get CSRF token from server
const csrfToken = document.querySelector('meta[name="csrf-token"]').content

// Include in POST/PUT/DELETE requests
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
})
```

### Étape 7.3: Secure Storage

```javascript
// ❌ localStorage (vulnerable to XSS)
localStorage.setItem('token', jwtToken)

// ✅ httpOnly cookie (can't be read by JavaScript)
// Set by backend with:
// Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict

// ✅ Memory + CSRF for sensitive operations
let authToken = null

function setToken(token) {
  authToken = token  // In memory only
}

// For page refresh, use refresh token endpoint
async function restoreSession() {
  const response = await fetch('/api/auth/refresh')
  if (response.ok) {
    const { access_token } = await response.json()
    setToken(access_token)
  }
}
```

---

## 8. Deployment Security {#deployment}

### Étape 8.1: HTTPS/TLS

```yaml
# docker-compose.prod.yml
caddy:
  image: caddy:alpine
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data  # Persist certificates
  ports:
    - "443:443"  # HTTPS
    - "80:80"    # Redirect to HTTPS

# Caddyfile (auto HTTPS)
transcendence.com {
  reverse_proxy backend:8000
  # Caddy automatically gets SSL cert from Let's Encrypt
}
```

### Étape 8.2: Environment Secrets

```bash
# On production server, create .env
ssh deploy@server
cd /app
cat > .env << EOF
JWT_SECRET_KEY=$(openssl rand -hex 32)
DATABASE_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EOF

chmod 600 .env  # Only owner can read
docker-compose up -d
```

### Étape 8.3: Firewall

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

---

## 9. Security Checklist {#checklist}

### Backend Checklist

- [ ] Passwords hashed with Argon2
- [ ] JWT tokens with expiration
- [ ] CORS configured (not wildcard)
- [ ] Rate limiting middleware
- [ ] SQL parameterized queries
- [ ] Security headers (CSP, X-Frame-Options, etc.)
- [ ] HTTPS/TLS enabled
- [ ] Secrets in .env (not hardcoded)
- [ ] Input validation (Pydantic)
- [ ] RBAC implemented
- [ ] Logging security events
- [ ] Database backups encrypted
- [ ] Error messages don't leak info

### Frontend Checklist

- [ ] XSS prevention (no innerHTML with user data)
- [ ] CSRF tokens on mutations
- [ ] Tokens stored securely (httpOnly or memory)
- [ ] No sensitive data in localStorage
- [ ] CSP headers enforced
- [ ] Dependencies audited (npm audit)
- [ ] No console.logs with secrets
- [ ] SVG/image sanitization
- [ ] Click-jacking protection (X-Frame-Options)

### Deployment Checklist

- [ ] HTTPS/TLS certificate valid
- [ ] Firewall configured
- [ ] SSH key-based auth only
- [ ] Database password strong
- [ ] Regular backups tested
- [ ] Monitoring & alerts setup
- [ ] Log aggregation (ELK/Datadog)
- [ ] Secrets not in docker images
- [ ] Container scanning (Trivy)
- [ ] OWASP Top 10 reviewed

---

## Résumé des Étapes

```
✅ 1. Auth: Signup/Login flow
✅ 2. Passwords: Argon2 hashing
✅ 3. JWT: Tokens with exp
✅ 4. RBAC: Role-based access
✅ 5. API: SQL injection + CORS + rate limit
✅ 6. Data: Encryption + secrets
✅ 7. Frontend: XSS + CSRF + storage
✅ 8. Deploy: HTTPS + firewall
✅ 9. Checklist: Security review
```

**Sécurité en place! ✅**
