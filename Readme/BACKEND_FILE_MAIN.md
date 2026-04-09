# Guide Détaillé: Backend - Fichiers Clés

## Table des matières
1. [app/main.py - Point d'entrée FastAPI](#main)
2. [app/core/config.py - Configuration & Settings](#config)
3. [app/core/security.py - Authentification & JWT](#security)
4. [app/core/database.py - Connexion PostgreSQL](#database)
5. [app/dependencies.py - Injection de dépendances](#dependencies)
6. [Flux d'Authentification Complet](#auth-flow)

---

## app/main.py - Point d'entrée FastAPI {#main}

### Qu'est-ce que c'est?
Point central où FastAPI est initialisé, tous les middlewares sont configurés, et tous les routers sont enregistrés.

### Structure et Fonctionnement

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. INITIALISATION APP
app = FastAPI(
    title="Blackhole Backend API",
    description="API FastAPI pour authentification...",
    version="1.0.0"
)

# 2. MIDDLEWARES (exécutés pour CHAQUE requête)
app.add_middleware(CORSMiddleware, ...)  # CORS
app.add_middleware(SecurityHeadersMiddleware)  # Security headers

# 3. ROUTES MONITORING
@app.get("/health")
def health():
    return {"status": "ok"}

# 4. INCLUSION DES ROUTERS
app.include_router(auth.router)
app.include_router(friends.router)
app.include_router(messages.router)
```

### Flux d'une Requête

```
Client (Frontend)
    ↓
HTTP Request arrive
    ↓
1. CORS Middleware vérifie origine
    ↓
2. Security Headers Middleware ajoute headers
    ↓
3. Router trouve l'endpoint approprié
    ↓
4. Dépendances injectées (get_db, get_current_user)
    ↓
5. Fonction endpoint exécutée
    ↓
6. Response Pydantic sérialisée en JSON
    ↓
Client reçoit Response
```

### Exemple: Appel Login

```python
# Dans auth/routes/auth_login.py
@router.post("/login")
async def login(
    credentials: LoginRequest,  # ← Pydantic valide automatiquement
    db: Session = Depends(get_db)  # ← Dépendance injectée
):
    # 1. Vérifier user existe
    user = db.query(User).filter(User.email == credentials.email).first()
    
    # 2. Vérifier password
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 3. Générer JWT
    token = create_access_token(user.id)
    
    # 4. Retourner response (FastAPI sérialise automatiquement)
    return {"access_token": token, "token_type": "bearer"}
```

**Comment ça marche dans main.py:**

```python
# main.py inclut le router
app.include_router(auth.router, prefix="/api")

# Donc POST /api/auth/login
# → appelle auth_login.login()
# → avec dépendances automatiquement injectées
```

### Middlewares Expliqués

#### 1. CORS Middleware
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Seulement frontend local
    allow_credentials=True,  # Accepter cookies/auth
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"]
)

# Contrôle QUELS domaines peuvent accéder l'API
# ❌ Si frontend est sur localhost:5173 + backend dit non → blocked
# ✅ Si frontend est sur localhost:5173 + backend accepte → OK
```

**Flux CORS:**
```
Frontend (localhost:5173) fait requête POST /api/auth/login
    ↓
Browser envoie preflight OPTIONS d'abord
    ↓
CORS Middleware reçoit OPTIONS
    ↓
Vérifie: est-ce que localhost:5173 est dans allow_origins?
    ↓
Retourne headers CORS
    ↓
Browser voit c'est OK → envoie requête réelle POST
    ↓
Endpoint exécuté
```

#### 2. Security Headers Middleware
```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Ajoute headers de sécurité à CHAQUE response
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        return response

# Explications:
# X-Content-Type-Options=nosniff
#   → Empêche browser de "deviner" le type de contenu
#   → Si on envoie text/plain, browser doit traiter comme text (pas comme JS)

# X-Frame-Options=DENY
#   → Page ne peut pas être chargée dans une iframe
#   → Protège contre clickjacking attacks

# X-XSS-Protection
#   → Activé mode XSS filter du browser
```

### Stateful vs Stateless

FastAPI est **STATELESS** = pas de session en mémoire serveur.

```python
# ❌ MAUVAIS (stateful)
users_connected = {}  # Global en mémoire

@app.post("/login")
def login(email: str, password: str):
    users_connected[email] = True  # Stocke en RAM
    return {"ok": True}
```

**Problème:** Si serveur redémarre → all users déconnectés. Si 10 serveurs → state désynchronisé.

```python
# ✅ BON (stateless avec JWT)
@app.post("/login")
def login(email: str, password: str, db: Session):
    user = db.query(User).filter(User.email == email).first()
    if verify_password(password, user.hashed_password):
        token = create_access_token(user.id)
        return {"access_token": token}

@app.get("/me")
def get_me(token: str = Depends(oauth2_scheme)):
    # Token peut être envoyé à N'IMPORTE QUEL serveur
    # Chaque serveur peut vérifier token indépendamment
    # Aucun état en RAM → scalable
    return decode_token(token)
```

---

## app/core/config.py - Configuration & Settings {#config}

### Qu'est-ce que c'est?
Centralise TOUTES les configurations (env vars, defaults, etc.). Permet de ne pas avoir de secrets en dur dans le code.

### Structure

```python
import os
from dotenv import load_dotenv

# Charge .env au démarrage
load_dotenv()

class Settings:
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60
    
    # CORS
    CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS").split(",")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

settings = Settings()  # Singleton
```

### Fonctionnement Détaillé

#### 1. Chargement .env

```bash
# .env (NON committé)
DATABASE_URL=postgresql://user:pass@localhost/mydb
SECRET_KEY=super-secret-key-12345
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=INFO
```

```python
# config.py lit le fichier .env
from dotenv import load_dotenv
load_dotenv()

# Puis accède via os.getenv()
DATABASE_URL = os.getenv("DATABASE_URL")
# → "postgresql://user:pass@localhost/mydb"
```

#### 2. Defaults (fallback)

```python
# Si env var n'existe pas → utiliser default
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")  # Default = "INFO"

# Sans default:
SECRET_KEY = os.getenv("SECRET_KEY")  # Peut être None → ERROR en production
```

#### 3. Parsing CSV

```python
def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    """Parse comma-separated values"""
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    
    # "http://localhost:5173,http://localhost:3000"
    # → ["http://localhost:5173", "http://localhost:3000"]
    parsed = [item.strip() for item in raw_value.split(",") if item.strip()]
    return parsed or default

CORS_ALLOW_ORIGINS = _parse_csv_env(
    "CORS_ALLOW_ORIGINS",
    ["http://localhost:5173"]  # default
)
```

### Usage dans le Projet

```python
# Dans main.py
from app.core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,  # ← Lit depuis .env
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS
)

# Dans security.py
def create_access_token(user_id: int):
    payload = {"sub": user_id}
    encoded = jwt.encode(
        payload,
        settings.SECRET_KEY,  # ← Lit depuis .env
        algorithm=settings.ALGORITHM
    )
    return encoded
```

### Pattern: Environnements Différents

```env
# .env.development
DATABASE_URL=postgresql://localhost/mydb_dev
SECRET_KEY=dev-secret-123
DEBUG=true

# .env.production (ex: sur serveur)
DATABASE_URL=postgresql://prod-server/mydb
SECRET_KEY=<really-secure-random-string>
DEBUG=false
```

```python
# Code détecte automatiquement via config
if settings.DEBUG:
    logger.setLevel(logging.DEBUG)
else:
    logger.setLevel(logging.WARNING)
```

---

## app/core/security.py - Authentification & JWT {#security}

### Qu'est-ce que c'est?
Module central pour: hash password, générer JWT, vérifier JWT.

### Fichiers Associés

```
app/core/
├── security.py              # Exports principaux
├── security_password.py     # hash_password, verify_password
├── security_tokens.py       # create_access_token, decode_token
├── security_auth.py         # get_current_user, oauth2_scheme
```

### 1. Password Hashing (security_password.py)

#### Hash Password (au signup)

```python
from passlib.context import CryptContext

# Configuration du hasher Argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Converts plain password → hashed password
    
    Argon2 = algorithme lent + coûteux
    → Rend brute force attaque TRÈS difficile
    """
    return pwd_context.hash(password)

# Utilisation au signup:
@app.post("/auth/signup")
def signup(email: str, password: str, db: Session):
    hashed = hash_password(password)  # "mypassword" → "argon2$..."
    user = User(email=email, hashed_password=hashed)
    db.add(user)
    db.commit()
    return {"user_id": user.id}

# Base de données stocke:
# users.hashed_password = "argon2$ibm$65536$2$MDAyMTcwZWI4ZDQ3MDY4NA$zzr..."
# Original "mypassword" JAMAIS stocké
```

**Pourquoi Argon2?**

```
Algorithme        | Vitesse  | Sécurité
─────────────────┼──────────┼──────────
MD5              | Rapide   | ❌ Faible (attaques GPU)
SHA256           | Rapide   | ⚠️  Moyen (peut être parallélisé)
bcrypt           | Lent     | ✅ Bon (force brute slow)
Argon2 (moderne) | TRÈS len | ✅✅ TRÈS Bon (utilise mémoire)
```

#### Verify Password (au login)

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares plain password with hashed version
    
    Returns True only if they match
    """
    return pwd_context.verify(plain_password, hashed_password)

# Utilisation au login:
@app.post("/auth/login")
def login(email: str, password: str, db: Session):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Argon2 compare "password" avec "argon2$..." et retourne True/False
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Wrong password")
    
    # Password correct → générer JWT
    token = create_access_token(user.id)
    return {"access_token": token}
```

**Sécurité Important:** Argon2 utilise une **salt** unique par user.

```
Même password → hash différent à chaque fois (à cause de la salt)

hash_password("password") → "argon2$ibm$...SALT1...$XXX"
hash_password("password") → "argon2$ibm$...SALT2...$YYY"

Donc attaquant avec DB volée ne peut pas pré-calculer une "rainbow table"
```

### 2. JWT Tokens (security_tokens.py)

#### Create Token (au login)

```python
from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings

def create_access_token(user_id: int, expires_delta: int = None) -> str:
    """
    Crée un JWT token signé avec SECRET_KEY
    
    JWT = Header.Payload.Signature
    """
    if expires_delta is None:
        expires_delta = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    
    # 1. Prépare payload
    expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    payload = {
        "sub": user_id,  # "sub" = subject (user ID)
        "exp": expire    # expiration timestamp
    }
    
    # 2. Encode + signe
    encoded_jwt = jwt.encode(
        payload,
        settings.SECRET_KEY,  # Secret key pour signature
        algorithm=settings.ALGORITHM  # HS256
    )
    
    return encoded_jwt
    # Retourne: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Exemple d'usage:
token = create_access_token(user_id=42)
# Retourne JWT avec expiration = maintenant + 60 minutes
```

**Structure JWT Décodée:**

```
Header (algorithme):
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload (données):
{
  "sub": 42,
  "exp": 1710582000,
  "iat": 1710578400
}

Signature:
HMACSHA256(
  base64(header) + "." + base64(payload),
  SECRET_KEY
) → vérification intégrité
```

#### Decode Token (à chaque requête authentifiée)

```python
def get_user_from_token(token: str) -> int:
    """
    Décode JWT et vérifie signature
    
    Retourne user_id si valide
    Lève exception si expiré/invalide/manipulé
    """
    try:
        # Décode + vérifie signature avec SECRET_KEY
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Exemple d'usage:
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
user_id = get_user_from_token(token)  # → 42
```

**Sécurité Important:** 

```python
# ❌ MAUVAIS: Attaquant peut modifier token
fake_token = {
  "sub": 99,  # Change user ID
  "exp": 9999999999
}
# Mais attaquant ne peut PAS refaire la signature
# Parce qu'il ne connaît pas SECRET_KEY

# ✅ BON: Si token modifié → signature ne match pas
# → jwt.decode() lève JWTError → request rejetée
```

### 3. Authentication Scheme (security_auth.py)

#### OAuth2 Scheme avec Bearer Token

```python
from fastapi.security import HTTPBearer, HTTPAuthenticationCredentials
from fastapi import Depends, HTTPException

oauth2_scheme = HTTPBearer()

# Utilisation:
@app.get("/profile")
def get_profile(credentials: HTTPAuthenticationCredentials = Depends(oauth2_scheme)):
    # FastAPI extrait automatiquement le token du header
    token = credentials.credentials  # "Bearer <token>" → extrait <token>
    
    user_id = get_user_from_token(token)
    return {"user_id": user_id}
```

**Flux HTTP:**

```
Client envoie:
GET /profile
Authorization: Bearer eyJhbGciOi...

FastAPI reçoit → oauth2_scheme extrait token
→ token = "eyJhbGciOi..."
→ passe à fonction endpoint
```

#### get_current_user (Dépendance)

```python
async def get_current_user(
    credentials: HTTPAuthenticationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dépendance réutilisable:
    - Extrait token du header
    - Décode et obtient user_id
    - Charge User de DB
    - Retourne User ou lève 401
    """
    token = credentials.credentials
    user_id = get_user_from_token(token)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Utilisation dans n'importe quel endpoint:
@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    # current_user = User objet, déjà vérifié et chargé de DB
    return {
        "id": current_user.id,
        "email": current_user.email
    }

@app.post("/friends/request")
def send_friend_request(
    target_user_id: int,
    current_user: User = Depends(get_current_user),  # ← Automatique
    db: Session = Depends(get_db)
):
    # current_user est l'utilisateur authentifié
    # target_user_id est qui veut on ajouter
    friend_request = FriendRequest(
        from_user_id=current_user.id,
        to_user_id=target_user_id
    )
    db.add(friend_request)
    db.commit()
    return {"status": "ok"}
```

---

## app/core/database.py - Connexion PostgreSQL {#database}

### Qu'est-ce que c'est?
Setup SQLAlchemy pour connecter FastAPI à PostgreSQL.

### Structure

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Engine = connexion pool
engine = create_engine(
    DATABASE_URL,
    echo=False  # True = log toutes les requêtes SQL
)

# 2. SessionLocal = factory pour créer sessions DB
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# 3. Base = classe parente pour tous les modèles
Base = declarative_base()

# 4. Fonction dependency injection
def get_db():
    """
    Yield une session pour chaque requête
    FastAPI gère automatiquement close après requête
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Fonctionnement Détaillé

#### 1. Engine & Connection Pool

```python
engine = create_engine("postgresql://user:pass@localhost/mydb")

# Engine gère une "pool" de connexions
# Plutôt que créer nouvelle connexion à chaque requête:

# ❌ MAUVAIS (10 requêtes = 10 connexions)
for i in range(10):
    conn = postgresql.connect("user:pass@localhost/mydb")
    # Use conn
    conn.close()

# ✅ BON (engine réutilise connexions)
for i in range(10):
    conn = engine.connect()  # Réutilise connection du pool
    # Use conn
    conn.close()  # Retourne au pool au lieu de fermer
```

#### 2. SessionLocal & Sessions

```python
SessionLocal = sessionmaker(bind=engine)

# Session = "transaction context"
db = SessionLocal()

# À l'intérieur d'une session:
user = db.query(User).filter(User.id == 1).first()
user.email = "newemail@example.com"
db.add(user)  # Mark as modified
db.commit()   # Write to DB (transaction commit)
db.close()    # Retourne connexion au pool
```

**Session Lifecycle:**

```python
def endpoint(db: Session = Depends(get_db)):
    # Dépendance crée Session
    
    # ← Session begun
    user = db.query(User).first()  # SELECT
    user.email = "new"
    db.add(user)
    # ← Session still open, queued changes
    
    db.commit()  # Writes changes
    # ← Transaction committed
    
    return user
# ← Fonction retourne
# ← finally: db.close()
# ← Connection retourné au pool
```

#### 3. Lazy Loading vs Eager Loading

```python
# Lazy loading (default):
user = db.query(User).filter(User.id == 1).first()
print(user.profile)  # ← Fait une AUTRE query SELECT à ce moment

# Problème: N+1 queries
for user in db.query(User).all():  # 1 query pour tous les users
    print(user.profile)  # ← Pour chaque user, 1 query! (N queries)

# Solution 1: Eager loading avec joinedload
from sqlalchemy.orm import joinedload

user = db.query(User).options(joinedload(User.profile)).first()
# 1 query avec JOIN

# Solution 2: Eager loading avec selectinload
user = db.query(User).options(selectinload(User.profile)).first()
# 2 queries (mais optimisé avec IN clause)
```

#### 4. Migrations avec Alembic

```python
# Lors du démarrage (Dockerfile, startup script):
alembic upgrade head

# Applique toutes les migrations
# Crée/modifie tables selon schéma
```

---

## app/dependencies.py - Injection de dépendances {#dependencies}

### Qu'est-ce que c'est?
Centralise les dépendances FastAPI réutilisables.

### Structure

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.models import User

# Dépendance 1: Database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Dépendance 2: Current authenticated user
async def get_current_user_dependency(
    token: str = Depends(oauth2_scheme)
) -> User:
    return get_current_user(token)

# Dépendance 3: Admin user only
async def get_admin_user(
    current_user: User = Depends(get_current_user_dependency)
) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user
```

### Usage dans Endpoints

```python
# Simples dépendances:
@app.get("/users")
def list_users(
    db: Session = Depends(get_db),
    limit: int = 10
):
    return db.query(User).limit(limit).all()

# Dépendances composées:
@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user_dependency),
    admin: User = Depends(get_admin_user),  # ← Vérifie admin
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == user_id).first()
    db.delete(target)
    db.commit()
    return {"deleted": user_id}
```

---

## Flux d'Authentification Complet {#auth-flow}

### Signup

```
User remplit formulaire:
- email: user@example.com
- password: mypassword
    ↓
Frontend POST /auth/signup
{
  "email": "user@example.com",
  "password": "mypassword"
}
    ↓
Backend reçoit (routes/auth_signup.py):
    1. Valide avec Pydantic (email format, password strength)
    2. Vérifie user pas déjà existant
    3. hash_password("mypassword")
       → "argon2$ibm$65536$2$...SALT1...$XXX"
    4. db.add(User(email, hashed_password))
    5. db.commit()
    ↓
Response 201 Created:
{
  "user_id": 42,
  "access_token": "eyJhbGciOiJIUzI1NiI...",
  "token_type": "bearer"
}
    ↓
Frontend:
- localStorage.setItem("access_token", token)
- Redirige vers /menu
```

### Login

```
User remplit formulaire:
- email: user@example.com
- password: mypassword
    ↓
Frontend POST /auth/login
{
  "email": "user@example.com",
  "password": "mypassword"
}
    ↓
Backend (routes/auth_login.py):
    1. db.query(User).filter(User.email == email).first()
       → User(id=42, hashed_password="argon2$...")
    2. verify_password("mypassword", "argon2$...")
       → Argon2 décode + compare
       → True ✓
    3. token = create_access_token(42)
       → jwt.encode({sub: 42, exp: ...}, SECRET_KEY)
       → "eyJhbGciOiJIUzI1NiI..."
    4. Return token
    ↓
Response 200 OK:
{
  "access_token": "eyJhbGciOiJIUzI1NiI...",
  "token_type": "bearer"
}
    ↓
Frontend:
- localStorage.setItem("access_token", token)
- Redirige vers /menu
```

### Get Current User (/me)

```
Frontend GET /auth/me
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiI...
    ↓
Backend (routes/auth_me.py):
    1. oauth2_scheme extrait token du header
       → "eyJhbGciOiJIUzI1NiI..."
    2. get_current_user(token, db) est appelé:
       a. jwt.decode(token, SECRET_KEY)
          → {sub: 42, exp: ...}
       b. Vérifie pas expiré
       c. db.query(User).filter(User.id == 42).first()
          → User(id=42, email="user@example.com")
       d. Return User objet
    3. Fonction endpoint reçoit current_user
    ↓
Response 200 OK:
{
  "id": 42,
  "email": "user@example.com",
  "username": "user"
}
    ↓
Frontend sait que user est authentifié ✓
```

### Erreurs Possibles

#### 1. Token Expiré
```
Requête envoyée après 60+ minutes:

jwt.decode(...) lève JWTError
    ↓
get_current_user() catch et raise HTTPException(401)
    ↓
Frontend reçoit 401 Unauthorized
    ↓
Frontend doit rediriger vers /auth + effacer token
```

#### 2. Token Modifié/Manque
```
Attaquant essaie de modifier token:

payload = {sub: 99}  # Change user ID
# Mais peut pas refaire signature (ne connaît pas SECRET_KEY)

jwt.decode(...) vérifie signature → pas match
    ↓
Lève JWTError
    ↓
Request rejetée (401)
```

#### 3. Token Manque
```
Frontend oublie d'envoyer token:

GET /me
(no Authorization header)
    ↓
oauth2_scheme attend Bearer token
    ↓
Lève HTTPException(403, "Not authenticated")
    ↓
Frontend reçoit 403 → redirige vers /auth
```

---

## Résumé: Sécurité en Place

| Layer | Technologie | Protection |
|-------|-------------|-----------|
| Password Storage | Argon2 | Brute force résistant |
| Authentication | JWT + HS256 | Token signé, attaquant ne peut pas forger |
| CORS | Middleware | Seulement frontend autorisé |
| Headers | Security Middleware | XSS, Clickjacking, MIME sniffing |
| Session Management | Stateless (JWT) | Scalable, pas de session sync |
| Transport | HTTPS (en prod) | Chiffrement en transit |

