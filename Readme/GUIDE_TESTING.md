# 🧪 Guide Complet Testing - Étapes par Étapes

**Table des matières**
1. [Setup Testing Environment](#setup)
2. [Unit Tests Backend](#backend-tests)
3. [Unit Tests Frontend](#frontend-tests)
4. [Integration Tests](#integration)
5. [E2E Tests](#e2e)
6. [CI/CD Pipeline](#cicd)
7. [Coverage & Reporting](#coverage)
8. [Test Best Practices](#best-practices)

---

## 1. Setup Testing Environment {#setup}

### Étape 1.1: Backend Testing (pytest)

```bash
# Naviguer au backend
cd backend/python

# Vérifier pytest installé
pip list | grep pytest

# Si pas installé:
pip install pytest pytest-asyncio pytest-cov

# Voir version
pytest --version
```

### Étape 1.2: Frontend Testing (Vitest)

```bash
# Naviguer au frontend
cd frontend

# Vitest déjà dans package.json
npm install

# Vérifier
npm list vitest

# Version
npm run test:unit -- --version
```

---

## 2. Unit Tests Backend {#backend-tests}

### Étape 2.1: conftest.py - Test Fixtures

```python
# backend/python/tests/conftest.py
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db, Base
from app.core.security import hash_password, create_access_token
from app.models.user import User

# In-memory SQLite database pour tests
@pytest.fixture(scope="session")
def db_engine():
    """Create test database"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine

@pytest.fixture(scope="function")
def db(db_engine):
    """Create test session"""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(autocommit=False, autoflush=False, bind=connection)()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    """Create TestClient with test database"""
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db):
    """Create test user"""
    user = User(
        email="test@test.com",
        username="testuser",
        hashed_password=hash_password("password123")
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def auth_token(test_user):
    """Generate JWT token for test user"""
    return create_access_token(data={"sub": test_user.id})

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
```

### Étape 2.2: Test Auth Endpoints

```python
# backend/python/tests/test_auth.py
import pytest

def test_signup(client):
    """Test user signup"""
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "newuser@test.com",
            "username": "newuser",
            "password": "password123"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_signup_duplicate_email(client, test_user):
    """Test signup with existing email"""
    response = client.post(
        "/api/auth/signup",
        json={
            "email": test_user.email,
            "username": "different",
            "password": "password123"
        }
    )
    
    assert response.status_code == 400
    assert "already registered" in response.text.lower()

def test_signup_weak_password(client):
    """Test signup with weak password"""
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "test@test.com",
            "username": "testuser",
            "password": "123"  # Too short
        }
    )
    
    assert response.status_code == 422

def test_login(client, test_user):
    """Test user login"""
    response = client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "password123"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

def test_login_invalid_password(client, test_user):
    """Test login with wrong password"""
    response = client.post(
        "/api/auth/login",
        json={
            "email": test_user.email,
            "password": "wrongpassword"
        }
    )
    
    assert response.status_code == 401
    assert "invalid" in response.text.lower()

def test_get_me(client, auth_headers, test_user):
    """Test get current user"""
    response = client.get(
        "/api/users/me",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email

def test_get_me_unauthorized(client):
    """Test get current user without auth"""
    response = client.get("/api/users/me")
    
    assert response.status_code == 401
```

### Étape 2.3: Test Friend Endpoints

```python
# backend/python/tests/test_friends.py
import pytest

def test_send_friend_request(client, db, test_user, auth_headers):
    """Test sending friend request"""
    # Create another user
    friend = User(
        email="friend@test.com",
        username="friend",
        hashed_password=hash_password("password123")
    )
    db.add(friend)
    db.commit()
    
    # Send request
    response = client.post(
        "/api/friends/requests",
        headers=auth_headers,
        json={"to_user_id": friend.id}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["to_user_id"] == friend.id
    assert data["status"] == "pending"

def test_accept_friend_request(client, db, test_user, auth_headers):
    """Test accepting friend request"""
    # Create request
    from app.models.friendship import FriendRequest
    
    friend = User(
        email="friend@test.com",
        username="friend",
        hashed_password=hash_password("password123")
    )
    db.add(friend)
    db.commit()
    
    request = FriendRequest(
        from_user_id=friend.id,
        to_user_id=test_user.id,
        status="pending"
    )
    db.add(request)
    db.commit()
    
    # Accept
    response = client.post(
        f"/api/friends/requests/{request.id}/accept",
        headers=auth_headers
    )
    
    assert response.status_code == 200

def test_list_friends(client, auth_headers):
    """Test listing friends"""
    response = client.get(
        "/api/friends",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
```

### Étape 2.4: Lancer les Tests

```bash
# Tous les tests
pytest

# Tests spécifiques
pytest tests/test_auth.py

# Tests avec output verbose
pytest -v

# Coverage report
pytest --cov=app --cov-report=html

# Only fast tests
pytest -m "not slow"

# Stop at first failure
pytest -x

# Pdb on failure
pytest --pdb
```

---

## 3. Unit Tests Frontend {#frontend-tests}

### Étape 3.1: Vitest Setup

```javascript
// frontend/vitest.config.js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Étape 3.2: Test Setup

```javascript
// frontend/tests/setup.js
import { vi } from 'vitest'

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null
  },
  setItem(key, value) {
    this.data[key] = value
  },
  removeItem(key) {
    delete this.data[key]
  },
  clear() {
    this.data = {}
  }
}

// Mock fetch
global.fetch = vi.fn()
```

### Étape 3.3: Component Tests

```javascript
// frontend/tests/ChatWidget.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatWidget from '@/components/ChatWidget.vue'

describe('ChatWidget.vue', () => {
  let wrapper
  
  beforeEach(() => {
    wrapper = mount(ChatWidget, {
      props: {
        currentUserId: 1,
        jwtToken: 'fake_token',
        apiUrl: 'http://localhost:8000'
      }
    })
  })
  
  it('renders chat widget', () => {
    expect(wrapper.find('.chat-widget').exists()).toBe(true)
  })
  
  it('expands when minimize button clicked', async () => {
    const button = wrapper.find('.minimize-btn')
    await button.trigger('click')
    
    expect(wrapper.find('.chat-expanded').exists()).toBe(true)
  })
  
  it('sends message', async () => {
    const input = wrapper.find('input[type="text"]')
    const button = wrapper.find('.send-btn')
    
    await input.setValue('Hello!')
    await button.trigger('click')
    
    expect(wrapper.emitted('message')).toBeTruthy()
    expect(wrapper.emitted('message')[0]).toEqual(['Hello!'])
  })
  
  it('displays received messages', async () => {
    await wrapper.setData({
      messages: [
        { from: 2, body: 'Hi there!' }
      ]
    })
    
    expect(wrapper.text()).toContain('Hi there!')
  })
})
```

### Étape 3.4: Router Tests

```javascript
// frontend/tests/router.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import routes from '@/router/index'

describe('Router', () => {
  let router
  
  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes
    })
  })
  
  it('redirects to auth when not authenticated', async () => {
    localStorage.clear()
    await router.push('/menu')
    await router.isReady()
    
    expect(router.currentRoute.value.path).toBe('/auth')
  })
  
  it('redirects to menu when authenticated', async () => {
    localStorage.setItem('accessToken', 'fake_token')
    await router.push('/auth')
    await router.isReady()
    
    expect(router.currentRoute.value.path).toBe('/menu')
  })
  
  it('routes to maze view', async () => {
    localStorage.setItem('accessToken', 'fake_token')
    await router.push('/maze')
    await router.isReady()
    
    expect(router.currentRoute.value.name).toBe('Maze')
  })
})
```

### Étape 3.5: Lancer Tests Frontend

```bash
# Tous les tests
npm run test:unit

# Watch mode
npm run test:unit:watch

# Coverage
npm run test:unit -- --coverage

# Vitest UI (interactive)
npm run test:unit -- --ui
```

---

## 4. Integration Tests {#integration}

### Étape 4.1: Test Complete Auth Flow

```python
# backend/python/tests/test_integration_auth.py
def test_auth_flow(client):
    """Test complete auth flow: signup → login → access protected"""
    
    # 1. Signup
    signup_response = client.post(
        "/api/auth/signup",
        json={
            "email": "integration@test.com",
            "username": "integrationuser",
            "password": "password123"
        }
    )
    assert signup_response.status_code == 201
    signup_token = signup_response.json()["access_token"]
    
    # 2. Access protected endpoint with token
    headers = {"Authorization": f"Bearer {signup_token}"}
    me_response = client.get("/api/users/me", headers=headers)
    assert me_response.status_code == 200
    
    user_data = me_response.json()
    user_id = user_data["id"]
    
    # 3. Login with credentials
    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "integration@test.com",
            "password": "password123"
        }
    )
    assert login_response.status_code == 200
    login_token = login_response.json()["access_token"]
    
    # 4. Verify login token works
    headers = {"Authorization": f"Bearer {login_token}"}
    verify_response = client.get("/api/users/me", headers=headers)
    assert verify_response.status_code == 200
    assert verify_response.json()["id"] == user_id
```

### Étape 4.2: Test Friend System

```python
# backend/python/tests/test_integration_friends.py
def test_complete_friend_flow(client, db):
    """Test: signup → friend request → accept"""
    
    # User 1 signup
    user1_response = client.post("/api/auth/signup", json={
        "email": "user1@test.com",
        "username": "user1",
        "password": "pass123"
    })
    user1_token = user1_response.json()["access_token"]
    user1_headers = {"Authorization": f"Bearer {user1_token}"}
    
    # User 2 signup
    user2_response = client.post("/api/auth/signup", json={
        "email": "user2@test.com",
        "username": "user2",
        "password": "pass123"
    })
    user2_token = user2_response.json()["access_token"]
    user2_headers = {"Authorization": f"Bearer {user2_token}"}
    user2_data = client.get("/api/users/me", headers=user2_headers).json()
    
    # User 1 sends friend request to User 2
    request_response = client.post(
        "/api/friends/requests",
        headers=user1_headers,
        json={"to_user_id": user2_data["id"]}
    )
    assert request_response.status_code == 201
    request_id = request_response.json()["id"]
    
    # User 2 accepts request
    accept_response = client.post(
        f"/api/friends/requests/{request_id}/accept",
        headers=user2_headers
    )
    assert accept_response.status_code == 200
    
    # Verify friendship
    friends_response = client.get(
        "/api/friends",
        headers=user1_headers
    )
    friends = friends_response.json()
    assert any(f["id"] == user2_data["id"] for f in friends)
```

---

## 5. E2E Tests {#e2e}

### Étape 5.1: Playwright Setup

```bash
# Tests E2E déjà configurés
npm run test:e2e

# Mode UI
npm run test:e2e:ui

# Debug mode
npx playwright test --debug
```

### Étape 5.2: Basic E2E Test

```javascript
// frontend/tests/e2e/auth.spec.js
import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })
  
  test('complete signup and login', async ({ page }) => {
    // Fill signup form
    await page.fill('input[name="email"]', 'e2e@test.com')
    await page.fill('input[name="username"]', 'e2euser')
    await page.fill('input[name="password"]', 'password123')
    
    // Submit
    await page.click('button:has-text("Sign Up")')
    
    // Wait for redirect to menu
    await page.waitForURL('/menu')
    expect(page.url()).toContain('/menu')
  })
  
  test('login with existing user', async ({ page }) => {
    // Assume user exists from previous test
    await page.fill('input[name="email"]', 'e2e@test.com')
    await page.fill('input[name="password"]', 'password123')
    
    await page.click('button:has-text("Log In")')
    
    await page.waitForURL('/menu')
    expect(page.url()).toContain('/menu')
  })
})
```

### Étape 5.3: Game E2E Test

```javascript
// frontend/tests/e2e/game.spec.js
test('play single player game', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:5173/auth')
  await page.fill('input[name="email"]', 'e2e@test.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button:has-text("Log In")')
  
  // Wait for menu
  await page.waitForURL('/menu')
  
  // Click Play
  await page.click('button:has-text("Play")')
  
  // Select difficulty
  await page.click('button:has-text("Easy")')
  
  // Game should start
  await page.waitForURL(/\/game/)
  
  // Check canvas is rendered
  const canvas = await page.$('canvas')
  expect(canvas).not.toBeNull()
  
  // Move player
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  
  // Wait a bit
  await page.waitForTimeout(1000)
  
  // Should still be in game
  expect(page.url()).toContain('/game')
})
```

---

## 6. CI/CD Pipeline {#cicd}

### Étape 6.1: GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd backend/python
        pip install -r requirements.txt
    
    - name: Run tests
      env:
        DATABASE_URL: postgresql://user:password@localhost:5432/test_db
      run: |
        cd backend/python
        pytest --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd frontend
        npm install
    
    - name: Run unit tests
      run: |
        cd frontend
        npm run test:unit
    
    - name: Run E2E tests
      run: |
        cd frontend
        npm run test:e2e
```

---

## 7. Coverage & Reporting {#coverage}

### Étape 7.1: Backend Coverage

```bash
# Generate coverage report
pytest --cov=app --cov-report=html --cov-report=term

# Open report
open htmlcov/index.html

# Set minimum coverage threshold
pytest --cov=app --cov-fail-under=80
```

### Étape 7.2: Frontend Coverage

```bash
# Generate coverage
npm run test:unit -- --coverage

# View report
open coverage/index.html
```

---

## 8. Test Best Practices {#best-practices}

### Principles

```
1. AAA Pattern: Arrange → Act → Assert
2. One assertion per test (ideally)
3. Descriptive test names
4. DRY: Use fixtures and helpers
5. Isolate tests (no dependencies)
6. Test behavior, not implementation
7. Keep tests fast
```

### Example Good Test

```python
# ✅ Good
def test_user_can_send_friend_request_to_another_user(client, db):
    """Scenario: User A sends friend request to User B"""
    
    # Arrange
    user_a = User(email="a@test.com", username="a", hashed_password="...")
    user_b = User(email="b@test.com", username="b", hashed_password="...")
    db.add_all([user_a, user_b])
    db.commit()
    
    # Act
    response = client.post(
        "/api/friends/requests",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"to_user_id": user_b.id}
    )
    
    # Assert
    assert response.status_code == 201
    assert response.json()["status"] == "pending"

# ❌ Bad
def test_friends(client):
    # Unclear what's being tested
    resp = client.post("/api/friends/requests", json={...})
    assert resp.status_code == 201
    assert "pending" in resp.text
```

---

## Résumé des Étapes

```
✅ 1. Setup: pytest + Vitest
✅ 2. Backend: Unit tests avec fixtures
✅ 3. Frontend: Component + Router tests
✅ 4. Integration: Complete flows
✅ 5. E2E: Playwright scenarios
✅ 6. CI/CD: GitHub Actions
✅ 7. Coverage: Metrics and reports
✅ 8. Best Practices: Quality standards
```

**Testing en place! ✅**
