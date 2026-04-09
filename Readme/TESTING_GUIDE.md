# Guide Complet: Testing & Quality Assurance

## Table des matières
1. [Backend Testing](#backend)
2. [Frontend Testing](#frontend)
3. [Integration Tests](#integration)
4. [E2E Tests](#e2e)
5. [CI/CD](#cicd)

---

## Backend Testing {#backend}

### Setup pytest

```bash
# backend/python/requirements.txt
pytest==7.4.0
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.24.1
```

### Test Structure

```
backend/python/tests/
├── conftest.py                    # Fixtures globales
├── test_auth_notifications.py     # Auth tests
├── test_cors.py                   # CORS tests
├── test_friend_endpoints.py       # Friend endpoints
├── test_game_endpoints.py         # Game endpoints
├── test_message_endpoints.py      # Message endpoints
├── test_room_manager.py           # WebSocket manager
├── test_room_routes.py            # Room endpoints
└── __pycache__/
```

### conftest.py (Global Fixtures)

```python
# backend/python/tests/conftest.py

import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.core.security import hash_password

# Test database (in-memory SQLite)
TEST_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def test_db():
    """Create test database"""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield SessionLocal()
    
    # Cleanup
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

@pytest.fixture
def client(test_db):
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def test_user(test_db):
    """Create test user"""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=hash_password("password123")
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user

@pytest.fixture
def auth_token(test_user):
    """Get JWT token for test user"""
    from app.core.security import create_access_token
    return create_access_token(data={"sub": test_user.id})

@pytest.fixture
def auth_headers(auth_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}
```

### Example: Auth Tests

```python
# backend/python/tests/test_auth_notifications.py

import pytest
from app.models.user import User
from app.core.security import hash_password, verify_password

class TestAuthSignup:
    """Test user signup"""
    
    def test_signup_success(self, client, test_db):
        """Test successful signup"""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "securepass123"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify user created in DB
        user = test_db.query(User).filter_by(
            email="newuser@example.com"
        ).first()
        assert user is not None
        assert user.username == "newuser"
        assert verify_password("securepass123", user.hashed_password)

    def test_signup_duplicate_email(self, client, test_user):
        """Test signup with duplicate email"""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": test_user.email,
                "username": "different",
                "password": "password123"
            }
        )
        
        assert response.status_code == 400
        assert "email already registered" in response.json()["detail"]

    def test_signup_weak_password(self, client):
        """Test signup with weak password"""
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "user@example.com",
                "username": "user",
                "password": "123"  # Too short
            }
        )
        
        assert response.status_code == 422  # Validation error

class TestAuthLogin:
    """Test user login"""
    
    def test_login_success(self, client, test_user):
        """Test successful login"""
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
        assert data["token_type"] == "bearer"

    def test_login_invalid_email(self, client):
        """Test login with non-existent email"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_invalid_password(self, client, test_user):
        """Test login with wrong password"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

class TestAuthMe:
    """Test get current user"""
    
    def test_get_current_user(self, client, auth_headers, test_user):
        """Test fetching current user"""
        response = client.get(
            "/api/users/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    def test_get_current_user_no_token(self, client):
        """Test without authentication"""
        response = client.get("/api/users/me")
        
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]

    def test_get_current_user_invalid_token(self, client):
        """Test with invalid token"""
        response = client.get(
            "/api/users/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
```

### Example: Friend Tests

```python
# backend/python/tests/test_friend_endpoints.py

import pytest
from app.models.friendship import FriendRequest, Friendship

class TestFriendRequests:
    """Test friend request workflow"""
    
    def test_send_friend_request(self, client, auth_headers, test_db):
        """Test sending friend request"""
        # Create second user
        user2 = User(
            email="friend@example.com",
            username="friend",
            hashed_password="hashed"
        )
        test_db.add(user2)
        test_db.commit()
        
        response = client.post(
            "/api/friends/request",
            headers=auth_headers,
            json={"to_user_id": user2.id}
        )
        
        assert response.status_code == 201
        
        # Verify request created
        request = test_db.query(FriendRequest).first()
        assert request.from_user_id == test_user.id
        assert request.to_user_id == user2.id
        assert request.status == "pending"

    def test_accept_friend_request(self, client, auth_headers, test_db, test_user):
        """Test accepting friend request"""
        # Setup: create second user and request
        user2 = User(
            email="friend@example.com",
            username="friend",
            hashed_password="hashed"
        )
        test_db.add(user2)
        test_db.commit()
        
        friend_request = FriendRequest(
            from_user_id=user2.id,
            to_user_id=test_user.id,
            status="pending"
        )
        test_db.add(friend_request)
        test_db.commit()
        
        # Accept request
        response = client.post(
            f"/api/friends/request/{friend_request.id}/accept",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify friendship created
        friendship = test_db.query(Friendship).first()
        assert friendship is not None
        assert {friendship.user_id_1, friendship.user_id_2} == {test_user.id, user2.id}

    def test_list_friends(self, client, auth_headers, test_db, test_user):
        """Test listing friends"""
        # Setup friendships
        user2 = User(email="friend@example.com", username="friend", hashed_password="x")
        test_db.add(user2)
        test_db.commit()
        
        friendship = Friendship(
            user_id_1=min(test_user.id, user2.id),
            user_id_2=max(test_user.id, user2.id)
        )
        test_db.add(friendship)
        test_db.commit()
        
        response = client.get(
            "/api/friends",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["friends"]) == 1
        assert data["friends"][0]["username"] == "friend"
```

### Run Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_auth_notifications.py

# Run specific test
pytest tests/test_auth_notifications.py::TestAuthSignup::test_signup_success

# With coverage
pytest --cov=app tests/

# Verbose output
pytest -v

# Watch mode (auto-run on file change)
pytest-watch
```

---

## Frontend Testing {#frontend}

### Setup Vitest & Vue Test Utils

```bash
npm install -D vitest @vitest/ui @vue/test-utils jsdom
```

### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Example: Component Tests

```javascript
// frontend/src/components/ChatWidget.vue.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatWidget from './ChatWidget.vue'

describe('ChatWidget.vue', () => {
  let wrapper

  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => 'mock-token'),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }

    wrapper = mount(ChatWidget)
  })

  it('renders minimized by default', () => {
    expect(wrapper.find('.chat-header').exists()).toBe(true)
    expect(wrapper.find('.messages').exists()).toBe(false)
  })

  it('expands on header click', async () => {
    await wrapper.find('.chat-header').trigger('click')
    expect(wrapper.find('.messages').exists()).toBe(true)
  })

  it('sends message on enter key', async () => {
    await wrapper.find('.chat-header').trigger('click')
    
    const input = wrapper.find('input')
    await input.setValue('Hello!')
    await input.trigger('keyup.enter')
    
    expect(wrapper.vm.messageInput).toBe('')
  })

  it('displays incoming messages', async () => {
    const message = {
      id: 1,
      from_user_id: 2,
      from_username: 'friend',
      body: 'Hi there!',
      created_at: new Date().toISOString()
    }
    
    await wrapper.vm.messages.push(message)
    await wrapper.vm.$nextTick()
    
    expect(wrapper.text()).toContain('Hi there!')
    expect(wrapper.text()).toContain('friend')
  })
})
```

### Example: Router Tests

```javascript
// frontend/src/router/index.test.js

import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import router from './index.js'

describe('Router', () => {
  beforeEach(() => {
    router.currentRoute.value.path = '/'
  })

  it('redirects unauthenticated users from protected routes', async () => {
    // Clear token
    localStorage.removeItem('token')
    
    await router.push('/menu')
    expect(router.currentRoute.value.path).toBe('/auth')
  })

  it('allows authenticated users to access protected routes', async () => {
    localStorage.setItem('token', 'mock-token')
    
    await router.push('/menu')
    expect(router.currentRoute.value.path).toBe('/menu')
  })

  it('navigates between routes', async () => {
    localStorage.setItem('token', 'mock-token')
    
    await router.push('/menu')
    expect(router.currentRoute.value.path).toBe('/menu')
    
    await router.push('/friends')
    expect(router.currentRoute.value.path).toBe('/friends')
  })
})
```

### Run Tests

```bash
# Run all tests
npm run test:unit

# Watch mode
npm run test:unit:watch

# With UI
npm run test:unit -- --ui

# Coverage
npm run test:unit -- --coverage
```

---

## Integration Tests {#integration}

### Testing Complete Flows

```python
# backend/python/tests/test_integration_auth_to_game.py

import pytest
from app.models.user import User
from app.models.progression import StageProgress
from app.core.security import hash_password

class TestAuthToGameFlow:
    """Test complete flow: signup → login → select stage → complete stage"""
    
    def test_complete_game_flow(self, client, test_db):
        """Test full game flow"""
        
        # 1. Signup
        signup_response = client.post(
            "/api/auth/signup",
            json={
                "email": "player@example.com",
                "username": "player",
                "password": "pass123"
            }
        )
        assert signup_response.status_code == 201
        token = signup_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get current user
        me_response = client.get("/api/users/me", headers=headers)
        assert me_response.status_code == 200
        user_id = me_response.json()["id"]
        
        # 3. Start game (difficulty 1, stage 1)
        start_response = client.post(
            "/api/progression/start_stage",
            headers=headers,
            json={"difficulty": 1, "stage": 1}
        )
        assert start_response.status_code == 200
        seed = start_response.json()["seed"]
        assert seed is not None
        
        # 4. Complete game
        complete_response = client.post(
            "/api/progression/complete_stage",
            headers=headers,
            json={
                "difficulty": 1,
                "stage": 1,
                "score": 5000,
                "time_ms": 45000
            }
        )
        assert complete_response.status_code == 200
        
        # 5. Verify stage unlocked next
        progress = test_db.query(StageProgress).filter_by(
            user_id=user_id,
            difficulty=1
        ).first()
        assert progress.current_stage == 2  # Next stage unlocked

class TestMultiplayerFlow:
    """Test multiplayer matchmaking and game"""
    
    def test_matchmaking_flow(self, client, test_db):
        """Test matchmaking: join queue → find match → play → end"""
        
        # Create two users
        user1 = User(
            email="player1@example.com",
            username="player1",
            hashed_password="x"
        )
        user2 = User(
            email="player2@example.com",
            username="player2",
            hashed_password="x"
        )
        test_db.add_all([user1, user2])
        test_db.commit()
        
        token1 = create_access_token(data={"sub": user1.id})
        token2 = create_access_token(data={"sub": user2.id})
        
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # Both join matchmaking queue
        response1 = client.post(
            "/api/matchmaking/join",
            headers=headers1,
            json={"difficulty": 1, "mode": "pvp"}
        )
        
        response2 = client.post(
            "/api/matchmaking/join",
            headers=headers2,
            json={"difficulty": 1, "mode": "pvp"}
        )
        
        # Should get matched (via WebSocket in real app)
        assert response1.status_code == 200
        assert response2.status_code == 200
```

---

## E2E Tests {#e2e}

### Setup Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### playwright.config.js

```javascript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Example: Auth E2E Test

```javascript
// frontend/tests/e2e/auth.spec.js

import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should signup and login', async ({ page }) => {
    // Visit signup page
    await page.goto('/auth')
    
    // Fill signup form
    await page.fill('input[type="email"]', 'newuser@example.com')
    await page.fill('input[type="text"]', 'newuser')
    await page.fill('input[type="password"]:first-of-type', 'password123')
    await page.fill('input[type="password"]:last-of-type', 'password123')
    
    // Submit signup
    await page.click('button:has-text("Sign up")')
    
    // Should redirect to menu
    await expect(page).toHaveURL('/menu')
    await expect(page.locator('h1')).toContainText('Transcendence')
  })

  test('should login with valid credentials', async ({ page }) => {
    // Visit auth page
    await page.goto('/auth')
    
    // Click login tab (if needed)
    await page.click('a:has-text("Login")')
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
    // Submit login
    await page.click('button:has-text("Login")')
    
    // Should redirect to menu
    await expect(page).toHaveURL('/menu')
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth')
    
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpass')
    
    await page.click('button:has-text("Login")')
    
    // Should see error message
    await expect(page.locator('.error')).toContainText('Invalid credentials')
  })
})
```

### Example: Game E2E Test

```javascript
// frontend/tests/e2e/game.spec.js

import { test, expect } from '@playwright/test'

test.describe('Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("Login")')
    await page.waitForURL('/menu')
  })

  test('should start and play a game', async ({ page }) => {
    // From menu, click play
    await page.click('a:has-text("Play Game")')
    
    // Should show difficulty selector
    await expect(page.locator('h2')).toContainText('Select Difficulty')
    
    // Select difficulty 1
    await page.click('button:has-text("Easy")')
    
    // Should be in game
    await page.waitForSelector('canvas')
    const canvas = await page.locator('canvas')
    await expect(canvas).toBeVisible()
    
    // Simulate movement (arrow key)
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
    
    // Wait a bit (simulate playing)
    await page.waitForTimeout(1000)
  })

  test('should show game over on completion', async ({ page }) => {
    // Start game
    await page.click('a:has-text("Play Game")')
    await page.click('button:has-text("Easy")')
    
    // Wait for game to load
    await page.waitForSelector('canvas')
    
    // Simulate completing (in real test, would need API mock)
    // For now just check canvas is visible
    await expect(page.locator('canvas')).toBeVisible()
  })
})
```

### Run E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# With UI
npm run test:e2e:ui

# Specific test
npx playwright test tests/e2e/auth.spec.js

# Debug mode
npx playwright test --debug
```

---

## CI/CD {#cicd}

### GitHub Actions Workflow

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
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: password
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
      run: |
        cd backend/python
        pytest --cov=app tests/
    
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
        npm ci
    
    - name: Run unit tests
      run: |
        cd frontend
        npm run test:unit
    
    - name: Run E2E tests
      run: |
        cd frontend
        npm run test:e2e
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  lint-backend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install linters
      run: |
        pip install flake8 black
    - name: Lint with flake8
      run: |
        flake8 backend/python/app --max-line-length=100
    - name: Format check with black
      run: |
        black --check backend/python/app

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install linters
      run: |
        cd frontend
        npm install -D eslint prettier
    - name: Lint
      run: |
        cd frontend
        npm run lint
```

### Test Coverage Goals

```
Backend:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

Frontend:
- Statements: > 75%
- Branches: > 70%
- Functions: > 75%
- Lines: > 75%

Critical paths (Auth, Matchmaking, Chat): 100%
```

### Local Testing Checklist

```
Before commit:
✅ All unit tests pass
✅ All E2E tests pass
✅ No lint errors
✅ Coverage thresholds met

Before merging PR:
✅ All CI checks pass
✅ Code review approved
✅ No breaking changes
✅ Documentation updated
```
