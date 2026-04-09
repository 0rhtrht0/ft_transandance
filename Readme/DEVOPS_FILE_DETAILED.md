# Guide Détaillé: DevOps & Infrastructure

## Table des matières
1. [Docker & Docker Compose](#docker)
2. [PostgreSQL Setup](#postgres)
3. [Caddy Reverse Proxy](#caddy)
4. [Environment Variables](#env)
5. [Deployment](#deploy)

---

## Docker & Docker Compose {#docker}

### Qu'est-ce que c'est?

Docker = "conteneur léger" pour votre app
- Contient: OS, Python, dépendances, code
- Avantage: "Works on my machine" → "Works everywhere"

Docker Compose = orchestrate plusieurs containers (backend, db, proxy)

### Dockerfile (Backend)

```dockerfile
# backend/python/Dockerfile

# 1. Base image (lightweight Python)
FROM python:3.11-slim

# 2. Set working directory
WORKDIR /app

# 3. Copy requirements
COPY requirements.txt .

# 4. Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy app code
COPY . .

# 6. Expose port
EXPOSE 8000

# 7. Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -m requests http://localhost:8000/health || exit 1

# 8. Run command
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**Explication:**
- `FROM python:3.11-slim` - Base: Python 3.11, minimal OS
- `COPY requirements.txt` - Copie fichier dépendances
- `RUN pip install` - Installe packages (dans container)
- `COPY . .` - Copie code source
- `EXPOSE 8000` - Expose port 8000
- `CMD` - Commande au lancement

**Build & Run:**
```bash
# Build image
docker build -t backend:latest backend/python

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e SECRET_KEY="..." \
  backend:latest

# Accès: http://localhost:8000
```

### Docker Compose (All Services)

```yaml
# backend/docker-compose.yml
version: '3.9'

services:
  # 1. PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: transcendence_db
    environment:
      POSTGRES_DB: transcendence
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. Backend API
  backend:
    build:
      context: ./python
      dockerfile: Dockerfile
    container_name: transcendence_backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/transcendence
      SECRET_KEY: ${SECRET_KEY:-change-me}
      CORS_ALLOW_ORIGINS: http://localhost:5173,http://localhost:80
      LOG_LEVEL: INFO
    ports:
      - "8000:8000"
    volumes:
      - ./python:/app  # Live reload
    command: >
      sh -c "
        alembic upgrade head &&
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
      "

  # 3. Frontend (optional in compose)
  frontend:
    build:
      context: ./..  # ../frontend
      dockerfile: Dockerfile
    container_name: transcendence_frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost/api
      VITE_WS_URL: ws://localhost/ws
    volumes:
      - ../frontend:/app

  # 4. Caddy Reverse Proxy
  caddy:
    image: caddy:latest
    container_name: transcendence_caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
    environment:
      BACKEND_URL: http://backend:8000
      FRONTEND_URL: http://frontend:5173

volumes:
  postgres_data:
  caddy_data:
  caddy_config:

networks:
  default:
    name: transcendence_network
```

**Utilisation:**
```bash
# Start all services
docker-compose up --build

# In logs, see:
# - postgres ready
# - backend migrations
# - caddy proxy configured
# - frontend running

# Test:
curl http://localhost/api/health
curl http://localhost/  # Frontend

# Stop
docker-compose down

# Remove volumes (reset DB)
docker-compose down -v
```

### Container Networking

```
┌─────────────────────────────────────────┐
│        Docker Network (transcendence)    │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────┐  │
│  │ postgres │  │ backend  │  │caddy │  │
│  │:5432    │  │:8000    │  │:80  │  │
│  └──────────┘  └──────────┘  └──────┘  │
│                                          │
│  Names resolved automatically:           │
│  - postgres:5432 (from backend)         │
│  - backend:8000 (from caddy)            │
│  - caddy:80 (from outside)              │
│                                          │
└─────────────────────────────────────────┘

Outside world:
localhost:80 → caddy:80 → proxies to backend:8000
```

**Connection string (inside container):**
```
DATABASE_URL = postgresql://postgres:postgres@postgres:5432/transcendence
              ↑
              Service name = postgres (resolved by Docker DNS)
```

---

## PostgreSQL Setup {#postgres}

### Docker PostgreSQL

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: transcendence      # Database name
    POSTGRES_USER: postgres         # Admin user
    POSTGRES_PASSWORD: postgres     # Admin password
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data      # Data persistence
    - ./postgres/init:/docker-entrypoint-initdb.d # Initialization scripts
```

### Init Script (postgres/init/01_create_extensions.sql)

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Text search

-- Example: Create extra schema/roles if needed
CREATE ROLE transcendence_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE transcendence TO transcendence_user;
```

**Scripts are run automatically when container starts for first time.**

### Connection from Backend

```python
# app/core/config.py
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@postgres:5432/transcendence"
)

# Via docker-compose environment:
# DATABASE_URL: postgresql://postgres:postgres@postgres:5432/transcendence
```

### Backup & Restore

```bash
# Backup
docker exec transcendence_db pg_dump \
  -U postgres transcendence > backup.sql

# Restore
docker exec -i transcendence_db psql \
  -U postgres transcendence < backup.sql

# Export CSV
docker exec transcendence_db psql \
  -U postgres -d transcendence \
  -c "\COPY users TO STDOUT WITH CSV HEADER" > users.csv
```

### Accessing Database

```bash
# From inside container
docker exec -it transcendence_db psql -U postgres -d transcendence

# From outside (if port exposed)
psql postgresql://postgres:postgres@localhost:5432/transcendence

# Queries
SELECT * FROM users;
SELECT COUNT(*) FROM game_results;
\dt  -- List tables
\d users  -- Describe users table
```

---

## Caddy Reverse Proxy {#caddy}

### Qu'est-ce que c'est?

Caddy = reverse proxy (routes requêtes HTTP vers services)

```
Client (localhost:80)
    ↓
Caddy (listening on :80)
    ├─ /api/* → backend:8000
    ├─ /ws* → backend:8000 (WebSocket)
    └─ /* → frontend:5173
```

### Caddyfile Configuration

```
# backend/caddy/Caddyfile

http://localhost {
    # API routes to backend
    route /api/* {
        reverse_proxy backend:8000
    }
    
    # WebSocket route
    route /ws* {
        reverse_proxy backend:8000 {
            # Preserve connection for WebSocket
            header_uri X-Forwarded-For {http.request.header.X-Forwarded-For}
            header_uri X-Forwarded-Proto http
        }
    }
    
    # Health check
    route /health {
        reverse_proxy backend:8000
    }
    
    # Static files & frontend
    route /* {
        reverse_proxy frontend:5173
    }
}
```

**Explications:**

```
route /api/* { ... }
├─ Matches: /api/auth/login, /api/friends, etc
└─ Proxies to backend:8000

route /ws* { ... }
├─ Matches: /ws, /ws?token=...
└─ Proxies with WebSocket support (special headers)

route /* { ... }
├─ Default route (frontend)
└─ Catch-all
```

### HTTPS (Production)

```
# backend/caddy/Caddyfile
https://example.com {
    # Caddy automatically gets Let's Encrypt certificate
    
    route /api/* {
        reverse_proxy backend:8000
    }
    # ...
}

# In docker-compose.yml
caddy:
    ports:
      - "80:80"      # HTTP (redirects to HTTPS)
      - "443:443"    # HTTPS
    volumes:
      - caddy_data:/data      # Stores certificates
      - caddy_config:/config
```

### Local HTTPS Development

```
# Caddyfile
localhost {
    # Caddy generates self-signed cert for localhost
    
    route /api/* {
        reverse_proxy backend:8000
    }
    # ...
}

# Browser: https://localhost (self-signed warning)
# Accept exception in browser
```

### Debugging Caddy

```bash
# Check logs
docker logs transcendence_caddy

# Enter container
docker exec -it transcendence_caddy sh

# Reload config (without restart)
docker exec transcendence_caddy caddy reload -c /etc/caddy/Caddyfile

# Validate config
docker exec transcendence_caddy caddy validate -c /etc/caddy/Caddyfile
```

---

## Environment Variables {#env}

### .env.example (Commit this)

```bash
# backend/python/.env.example

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transcendence

# Security
SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=INFO

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### .env (Local Development)

```bash
# .env
# Copy from .env.example and modify

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transcendence
SECRET_KEY=dev-secret-123-change-for-production
LOG_LEVEL=DEBUG  # More verbose in dev
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80
```

### .env Production

```bash
# On production server (NOT in git!)

DATABASE_URL=postgresql://user:securepass@db-prod.example.com/transcendence
SECRET_KEY=<very-long-random-string>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS (only production domain)
CORS_ALLOW_ORIGINS=https://app.example.com

LOG_LEVEL=WARNING  # Less verbose

VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

### Loading in Code

```python
# app/core/config.py
from dotenv import load_dotenv
import os

load_dotenv()  # Reads .env

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    SECRET_KEY = os.getenv("SECRET_KEY")
    # etc.

# Usage
from app.core.config import settings
print(settings.DATABASE_URL)
```

### In Docker Compose

```yaml
# docker-compose.yml
backend:
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/transcendence
      SECRET_KEY: ${SECRET_KEY:-default-dev-key}
      # ${VAR:-default} = use VAR or default
```

**Set at runtime:**
```bash
# Inline
SECRET_KEY=mykey docker-compose up

# Or from .env file (docker-compose reads automatically)
# .env at root, contains: SECRET_KEY=mykey
docker-compose up
```

---

## Deployment {#deploy}

### Deployment Checklist

```
✅ Before Pushing to Production

1. Security
   - [ ] Change SECRET_KEY to random string
   - [ ] Set CORS_ALLOW_ORIGINS to production domain only
   - [ ] Enable HTTPS (Caddy with Let's Encrypt)
   - [ ] Set LOG_LEVEL=WARNING (less info leakage)

2. Database
   - [ ] Backup database before deploy
   - [ ] Run migrations (alembic upgrade head)
   - [ ] Verify schema matches code

3. Performance
   - [ ] Enable caching headers (Caddy)
   - [ ] Optimize database queries (check slow logs)
   - [ ] Monitor CPU/memory usage

4. Monitoring
   - [ ] Setup logging (centralized logs?)
   - [ ] Setup alerts (if service down)
   - [ ] Health check monitoring

5. Testing
   - [ ] Test all critical endpoints
   - [ ] Test WebSocket connections
   - [ ] Test database operations
```

### Deployment Flow

#### Step 1: Prepare Server

```bash
# SSH into server
ssh ubuntu@example.com

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Step 2: Clone & Setup

```bash
# Clone repo
git clone https://github.com/yourrepo/transcendence.git
cd transcendence

# Create .env for production
# (Edit with actual values)
cat > .env << EOF
DATABASE_URL=postgresql://postgres:securepass@postgres:5432/transcendence
SECRET_KEY=<generate-random-string>
CORS_ALLOW_ORIGINS=https://app.example.com
LOG_LEVEL=WARNING
EOF

chmod 600 .env  # Only owner can read
```

#### Step 3: Launch Services

```bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Verify all services running
docker-compose ps
# Should show: postgres (healthy), backend (running), caddy (running)
```

#### Step 4: Test Deployment

```bash
# Health check
curl https://app.example.com/health
# Expected: {"status": "ok"}

# Test API
curl -X POST https://app.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com", "password":"password"}'

# Test WebSocket
wscat -c wss://app.example.com/ws?token=<token>
```

#### Step 5: Monitor

```bash
# Watch logs
docker-compose logs -f backend

# Container stats
docker stats

# Database
docker exec postgres psql -U postgres -d transcendence -c "SELECT COUNT(*) FROM users;"

# Restart if needed
docker-compose restart backend
```

### Scaling (Multiple Servers)

```yaml
# For multiple backend instances

# Option 1: Load Balancer
backend1:
  build: ./python
  expose: 8001

backend2:
  build: ./python
  expose: 8002

caddy:
  # Routes to both
  route /api/* {
      reverse_proxy backend1:8001 backend2:8002
  }

# Option 2: Kubernetes
# (More complex, but auto-scaling)
# Use: Docker images + Helm charts
```

### Rollback (If Deploy Fails)

```bash
# See container history
docker-compose ps

# Stop current version
docker-compose down

# Revert code
git checkout <previous-commit>

# Restart old version
docker-compose up -d --build

# Manually rollback database
# (If needed: alembic downgrade -1)
```

---

## Common Issues & Fixes

### Issue 1: "Connection refused" from Backend to DB

```
Error: psycopg2.OperationalError: could not connect to server

Solution:
- Check docker-compose.yml: postgres service exists
- Check environment DATABASE_URL is correct
- Check postgres container is running: docker-compose ps
- Check health: docker-compose exec postgres pg_isready -U postgres
```

### Issue 2: CORS Error in Browser

```
Error: Access to XMLHttpRequest from origin 'http://localhost:5173' 
       has been blocked by CORS policy

Solution:
- Check CORS_ALLOW_ORIGINS includes your frontend URL
- Restart backend: docker-compose restart backend
- Check Caddy isn't blocking: docker logs caddy
```

### Issue 3: Database Connection Pool Exhausted

```
Error: sqlalchemy.pool.NullPool.checkout

Solution:
- Increase pool_size in database.py
- Check for connection leaks (not closing sessions)
- Restart backend: docker-compose restart backend
```

### Issue 4: WebSocket Timeout

```
Error: WebSocket connection closed

Solution:
- Check Caddy Caddyfile has WebSocket support
- Check firewall allows WebSocket (port 443 for WSS)
- Implement reconnect logic in frontend
```

---

## Monitoring & Health Checks

### Health Endpoints

```python
# Backend provides
GET /health           → {"status": "ok"}
GET /ready            → {"status": "ready"} (includes DB check)
```

### Docker Health Check

```yaml
backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Container Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs postgres

# Follow (tail)
docker-compose logs -f backend

# Last N lines
docker-compose logs --tail=50 backend
```

### Performance Monitoring

```bash
# CPU/Memory/Network
docker stats

# Database queries (slow log)
docker exec postgres psql -U postgres -d transcendence \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;"
```

