# 🚀 Guide Complet DevOps - Étapes par Étapes

**Table des matières**
1. [Docker Setup](#docker)
2. [Docker Compose](#compose)
3. [PostgreSQL Configuration](#postgres)
4. [Caddy Reverse Proxy](#caddy)
5. [Environment Variables](#env)
6. [Deployment](#deploy)
7. [Monitoring & Logs](#monitoring)
8. [Troubleshooting](#troubleshoot)

---

## 1. Docker Setup {#docker}

### Étape 1.1: Installer Docker

```bash
# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Vérifier installation
docker --version
docker-compose --version

# Ajouter user au groupe docker (optionnel)
sudo usermod -aG docker $USER
newgrp docker
```

### Étape 1.2: Comprendre Docker

```
Docker = Conteneur léger
- Isolé du système
- Même config partout
- Facile à partager
```

**Dockerfile = Recette pour créer une image**

```dockerfile
# backend/python/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Installer dépendances système
RUN apt-get update && apt-get install -y \
    gcc postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements et installer pip packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier code app
COPY . .

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Démarrer l'app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Étape 1.3: Build Docker Image

```bash
# Build l'image backend
cd backend/python
docker build -t blackhole-backend:latest .

# Vérifier image
docker images

# Output:
# REPOSITORY             TAG        IMAGE ID       SIZE
# blackhole-backend      latest     abc123def456   250MB
```

### Étape 1.4: Lancer Container

```bash
# Lancer un container
docker run -d \
  --name backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:pass@localhost/db \
  blackhole-backend:latest

# Vérifier status
docker ps

# Logs
docker logs backend

# Arrêter
docker stop backend

# Supprimer
docker rm backend
```

---

## 2. Docker Compose {#compose}

### Étape 2.1: Docker Compose - Multi-container Orchestration

```yaml
# docker-compose.yml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    environment:
      POSTGRES_USER: ${DB_USER:-user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-transcendence}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/postgres/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend
  
  # Backend API
  backend:
    build:
      context: ./backend/python
      dockerfile: Dockerfile
    container_name: backend
    environment:
      DATABASE_URL: postgresql://${DB_USER:-user}:${DB_PASSWORD:-password}@postgres:5432/${DB_NAME:-transcendence}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: HS256
      JWT_EXPIRE_MINUTES: 60
      CORS_ORIGINS: http://localhost:5173,http://localhost:3000
      ENVIRONMENT: ${ENVIRONMENT:-development}
    volumes:
      - ./backend/python:/app
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    networks:
      - backend
  
  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: frontend
    environment:
      VITE_API_URL: http://backend:8000
      VITE_WS_URL: ws://backend:8000
    volumes:
      - ./frontend:/app
    ports:
      - "5173:5173"
    depends_on:
      - backend
    command: npm run dev -- --host 0.0.0.0
    networks:
      - backend
  
  # Caddy Reverse Proxy
  caddy:
    image: caddy:alpine
    container_name: caddy
    volumes:
      - ./backend/caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
    networks:
      - backend

volumes:
  postgres_data:
  caddy_data:
  caddy_config:

networks:
  backend:
    driver: bridge
```

### Étape 2.2: Démarrer Tous les Services

```bash
# Naviguer à la racine du projet
cd /home/rorandri/Music/transcendence_labyrinthe

# Démarrer tous les services
docker-compose up -d

# Vérifier status
docker-compose ps

# Output:
# NAME        STATUS              PORTS
# postgres    Up 5 seconds        5432/tcp
# backend     Up 3 seconds        8000/tcp
# frontend    Up 2 seconds        5173/tcp
# caddy       Up 1 second         80/tcp, 443/tcp

# Logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Arrêter tous
docker-compose down

# Arrêter et supprimer volumes
docker-compose down -v
```

### Étape 2.3: Rebuild après Code Changes

```bash
# Rebuild une image
docker-compose build backend

# Redémarrer un service
docker-compose up -d backend

# Ou one-liner
docker-compose up -d --build backend
```

---

## 3. PostgreSQL Configuration {#postgres}

### Étape 3.1: Init Scripts

```sql
-- backend/postgres/init/01_create_extensions.sql
-- Créé automatiquement au premier démarrage

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

GRANT USAGE ON SCHEMA public TO ${DB_USER};
GRANT CREATE ON SCHEMA public TO ${DB_USER};
```

### Étape 3.2: Connexion à PostgreSQL

```bash
# Depuis le container
docker exec -it postgres psql -U user -d transcendence

# Commandes utiles
\dt                    # Voir toutes les tables
\d users               # Décrire table 'users'
SELECT * FROM users;   # Requête
\q                     # Quitter

# Depuis local (si PostgreSQL installé)
psql -h localhost -U user -d transcendence
```

### Étape 3.3: Backup & Restore

```bash
# Backup
docker exec postgres pg_dump -U user transcendence > backup.sql

# Restore
docker exec -i postgres psql -U user transcendence < backup.sql

# Backup avec compression
docker exec postgres pg_dump -U user transcendence | gzip > backup.sql.gz

# Restore depuis gz
gunzip < backup.sql.gz | docker exec -i postgres psql -U user transcendence
```

---

## 4. Caddy Reverse Proxy {#caddy}

### Étape 4.1: Caddy Caddyfile

```
# backend/caddy/Caddyfile
# Configuration pour développement local

localhost {
  # Frontend
  handle /api/* {
    reverse_proxy backend:8000
  }
  
  handle /ws {
    reverse_proxy backend:8000 {
      header_uri -X-Forwarded-For
      header_up X-Forwarded-For {http.request.remote}
    }
  }
  
  # Tous les autres → Frontend
  reverse_proxy frontend:5173
}

# Production example avec HTTPS
# api.transcendence.com {
#   reverse_proxy backend:8000
# }
# 
# transcendence.com {
#   reverse_proxy frontend:3000
#   tls admin@transcendence.com
# }
```

### Étape 4.2: Redirection HTTP → HTTPS (Production)

```
# Production Caddyfile
transcendence.com www.transcendence.com {
  # Redirect www to non-www
  @www host www.transcendence.com
  handle @www {
    redir https://transcendence.com{uri} permanent
  }
  
  # Serve frontend
  reverse_proxy frontend:3000
  
  # TLS via Let's Encrypt
  tls admin@transcendence.com
}

api.transcendence.com {
  # Backend API
  reverse_proxy backend:8000
  
  # TLS
  tls admin@transcendence.com
}
```

---

## 5. Environment Variables {#env}

### Étape 5.1: .env File

```env
# .env.example (commit to repo)
# .env (never commit!)

# Database
DB_USER=user
DB_PASSWORD=secure_password_here
DB_NAME=transcendence
DATABASE_URL=postgresql://user:password@postgres:5432/transcendence

# JWT
JWT_SECRET_KEY=your_super_secret_key_minimum_32_characters_long_please
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://transcendence.com

# Environment
ENVIRONMENT=development

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Étape 5.2: Load Environment Variables

**Python (FastAPI):**
```python
# app/core/config.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: List[str] = ["http://localhost:5173"]
    environment: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**JavaScript (Frontend):**
```javascript
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env': JSON.stringify({
      VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:8000',
      VITE_WS_URL: process.env.VITE_WS_URL || 'ws://localhost:8000'
    })
  }
})

// Usage dans composant
const apiUrl = import.meta.env.VITE_API_URL
```

---

## 6. Deployment {#deploy}

### Étape 6.1: VPS Setup (Ubuntu 22.04)

```bash
# 1. Créer VPS sur Linode/DigitalOcean/AWS
# 2. SSH into server
ssh root@your_server_ip

# 3. Update système
apt-get update && apt-get upgrade -y

# 4. Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 5. Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 6. Créer user deploy
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

### Étape 6.2: Clone & Deploy

```bash
# En tant que deploy user
sudo -u deploy -s

# Clone repo
git clone https://github.com/your_org/transcendence.git
cd transcendence

# Créer .env pour production
nano .env
# Remplir avec production values

# Lancer services
docker-compose -f docker-compose.prod.yml up -d

# Vérifier
docker-compose ps
```

### Étape 6.3: Systemd Service (Auto-restart)

```ini
# /etc/systemd/system/transcendence.service
[Unit]
Description=Transcendence Game
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/deploy/transcendence
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=deploy

[Install]
WantedBy=multi-user.target
```

**Utilisation:**
```bash
sudo systemctl start transcendence
sudo systemctl stop transcendence
sudo systemctl restart transcendence
sudo systemctl enable transcendence  # Auto-start on reboot
```

---

## 7. Monitoring & Logs {#monitoring}

### Étape 7.1: Voir les Logs

```bash
# Backend logs
docker-compose logs backend

# Follow logs (-f)
docker-compose logs -f backend

# Dernières 100 lignes
docker-compose logs backend --tail=100

# Tous les services
docker-compose logs -f

# Timestamp
docker-compose logs -f --timestamps backend
```

### Étape 7.2: Health Checks

```bash
# Check backend health
curl http://localhost:8000/health

# Check database
docker exec postgres pg_isready -U user

# Check all services
docker-compose ps

# Detailed info
docker inspect backend | jq '.State.Health'
```

### Étape 7.3: Performance Monitoring

```bash
# CPU et Memory usage
docker stats

# Container stats (non-interactive)
docker stats --no-stream

# Disk usage
docker system df

# Network usage
docker exec backend netstat -tnap
```

---

## 8. Troubleshooting {#troubleshoot}

### Problème: "Connection refused"

```bash
# Vérifier si service est running
docker-compose ps

# Vérifier logs
docker-compose logs backend

# Redémarrer le service
docker-compose restart backend

# Rebuild et redémarrer
docker-compose up -d --build backend
```

### Problème: "Database connection error"

```bash
# Vérifier PostgreSQL status
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connexion
docker exec backend psql -h postgres -U user -d transcendence -c "SELECT 1"

# Restart database
docker-compose restart postgres
```

### Problème: "Port already in use"

```bash
# Voir quel process utilise le port
lsof -i :8000
lsof -i :5173
lsof -i :5432

# Terminer le process
kill -9 PID

# Ou change le port dans docker-compose.yml
# Puis redémarrer
docker-compose up -d
```

### Problème: "Out of memory"

```bash
# Voir la limite de mémoire
docker stats

# Limiter la mémoire d'un container
# Dans docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

# Appliquer
docker-compose up -d
```

### Problème: WebSocket timeout

```bash
# Vérifier Caddy config
docker exec caddy cat /etc/caddy/Caddyfile

# WebSocket headers manquants:
handle /ws {
  reverse_proxy backend:8000 {
    header_up Connection "upgrade"
    header_up Upgrade "websocket"
  }
}

# Restart Caddy
docker-compose restart caddy
```

---

## Résumé des Étapes

```
✅ 1. Docker: Installation et basics
✅ 2. Compose: Multi-container setup
✅ 3. PostgreSQL: Configuration et migrations
✅ 4. Caddy: Reverse proxy et routing
✅ 5. Environment: Variables et config
✅ 6. Deploy: VPS setup et service
✅ 7. Monitoring: Logs et health checks
✅ 8. Troubleshooting: Common issues
```

**DevOps prêt! ✅**
