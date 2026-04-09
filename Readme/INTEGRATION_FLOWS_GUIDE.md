# Guide Complet: Intégration Complète - End-to-End Flows

## Table des matières
1. [Auth Flow Complet](#auth-flow)
2. [Single Player Game Flow](#single-player)
3. [Multiplayer Matchmaking Flow](#multiplayer)
4. [Chat & Social Flow](#chat-flow)
5. [Progression & Leaderboard](#progression)

---

## Auth Flow Complet {#auth-flow}

### Signup → Login → Protected Route

```
User                Frontend             Backend              Database
  |                    |                    |                    |
  |--- Click Signup ---|                    |                    |
  |                    |                    |                    |
  |--- Fill Form ----->|                    |                    |
  | email, user, pass  |                    |                    |
  |                    |                    |                    |
  |                    |--- POST /api/auth/signup -->|            |
  |                    | { email, username, pass }   |            |
  |                    |                    |--- Check duplicate ---|
  |                    |                    |    (unique constraint)|
  |                    |                    |<-- OK, unique ------|
  |                    |                    |                    |
  |                    |                    |--- Hash password ---|
  |                    |                    | Argon2(pass) -->    |
  |                    |                    |<-- hashed_pass ---|
  |                    |                    |                    |
  |                    |                    |--- INSERT user ---->|
  |                    |                    | INSERT INTO users  |
  |                    |                    |<-- user_id ---------|
  |                    |                    |                    |
  |                    |                    |--- Create JWT ------|
  |                    |                    | jwt.encode({       |
  |                    |<-- 201 Created ---|  "sub": user_id,   |
  |                    | { access_token,    |  exp: now + 1h    |
  |                    |   refresh_token    | })                |
  |                    |   token_type }     |                    |
  |                    |                    |                    |
  |                    |--- Save token ---| |                    |
  |                    | localStorage     | |                    |
  |                    |                    |                    |
  |--- Redirected to menu ---|              |                    |
  |                    |                    |                    |
  |                    |<-- Load menu -->|  |                    |
  |                    |                    |                    |
  |--- Click a protected route ---|         |                    |
  |                    |                    |                    |
  |                    |--- GET /api/users/me ------>|            |
  |                    | Header: Authorization:      |            |
  |                    |   Bearer eyJ0...            |            |
  |                    |                    |--- Extract token ---|
  |                    |                    |--- Verify JWT --|   |
  |                    |                    | jwt.decode(token, |
  |                    |                    |  secret_key) ---|   |
  |                    |                    |<-- { sub: 123 ---|
  |                    |                    |                    |
  |                    |                    |--- SELECT user ---->|
  |                    |                    | WHERE id = 123     |
  |                    |                    |<-- user data ------|
  |                    |<-- 200 OK --------|  { id, email, ...}|
  |                    | { id, email, ...}  |                    |
  |                    |                    |                    |
  |--- Display profile ---|                |                    |
```

### Backend Implementation

```python
# backend/python/app/api/routes/auth.py

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Signup endpoint
    
    Flow:
    1. Validate input (email format, password strength, username length)
    2. Check email not already registered
    3. Hash password with Argon2
    4. Create user in database
    5. Generate JWT token
    """
    
    # 1. Validate
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters"
        )
    
    # 2. Check uniqueness
    existing_email = db.query(User).filter(
        User.email == user_data.email.lower()
    ).first()
    
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = db.query(User).filter(
        User.username == user_data.username
    ).first()
    
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # 3. Hash password
    hashed_password = hash_password(user_data.password)
    
    # 4. Create user
    new_user = User(
        email=user_data.email.lower(),
        username=user_data.username,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 5. Create token
    access_token = create_access_token(
        data={"sub": new_user.id}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "username": new_user.username
    }

@router.post("/login")
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login endpoint
    
    Flow:
    1. Find user by email
    2. Verify password using Argon2
    3. Generate JWT token
    """
    
    # 1. Find user
    user = db.query(User).filter(
        User.email == login_data.email.lower()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 2. Verify password (constant-time comparison)
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 3. Create token
    access_token = create_access_token(
        data={"sub": user.id}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }

@router.get("/users/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user (protected route)
    
    Dependency: get_current_user
    1. Extract token from Authorization header
    2. Verify JWT signature
    3. Check token not expired
    4. Load user from database
    """
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "created_at": current_user.created_at.isoformat()
    }
```

### Frontend Implementation

```javascript
// frontend/src/routes/auth/auth.js

class AuthService {
  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || '/api'
  }

  async signup(email, username, password) {
    /**
     * Signup flow
     * 1. Validate input client-side
     * 2. POST to backend
     * 3. Save token
     * 4. Redirect to menu
     */
    
    // 1. Validate
    if (!email || !username || !password) {
      throw new Error('All fields required')
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }
    
    if (!email.includes('@')) {
      throw new Error('Invalid email')
    }
    
    // 2. POST
    const response = await fetch(`${this.apiUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Signup failed')
    }
    
    const data = await response.json()
    
    // 3. Save token
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('userId', data.user_id)
    localStorage.setItem('username', data.username)
    
    // 4. Redirect
    return data
  }

  async login(email, password) {
    /**
     * Login flow
     * 1. POST credentials
     * 2. Save token on success
     * 3. Return user data
     */
    
    const response = await fetch(`${this.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }
    
    const data = await response.json()
    
    // Save token
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('userId', data.user_id)
    localStorage.setItem('username', data.username)
    
    return data
  }

  logout() {
    /**
     * Logout flow
     * 1. Clear stored credentials
     * 2. Redirect to login
     */
    
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
  }

  getToken() {
    return localStorage.getItem('token')
  }

  isLoggedIn() {
    const token = this.getToken()
    if (!token) return false
    
    // Check expiration
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000  // Convert to ms
      return Date.now() < exp
    } catch {
      return false
    }
  }
}

export const authService = new AuthService()
```

---

## Single Player Game Flow {#single-player}

```
User                Frontend             Backend              Database
  |                    |                    |                    |
  |--- Click Play -----|                    |                    |
  |                    |                    |                    |
  |--- Select Difficulty = 1 ---|           |                    |
  |                    |                    |                    |
  |                    |--- POST /api/progression/start_stage --->|
  |                    | { difficulty: 1, stage: 1 }             |
  |                    | Authorization: Bearer token              |
  |                    |                    |                    |
  |                    |                    |--- Verify token ---|
  |                    |                    |<-- user_id --------|
  |                    |                    |                    |
  |                    |                    |--- Check progress ----|
  |                    |                    | WHERE user_id=123, |
  |                    |                    | difficulty=1        |
  |                    |                    |<-- stage info ------|
  |                    |                    |                    |
  |                    |                    |--- Generate seed ---|
  |                    |                    | seed = hash(       |
  |                    |                    |  user_id,          |
  |                    |                    |  difficulty,       |
  |                    |                    |  stage,            |
  |                    |<-- 200 OK --------|  timestamp)        |
  |                    | { seed: 12345,     |                    |
  |                    |   maze_width: 50,  |                    |
  |                    |   maze_height: 40} |                    |
  |                    |                    |                    |
  |--- Initialize game ---|                |                    |
  | 1. generateMaze(seed)                   |                    |
  | 2. Create player                        |                    |
  | 3. Start game loop                      |                    |
  |                    |                    |                    |
  |--- Game Loop (60 FPS) ---|              |                    |
  | - Update player position                |                    |
  | - Check collisions                      |                    |
  | - Render maze & player                  |                    |
  |                    |                    |                    |
  |--- Reach exit ---| |                    |                    |
  |                    |                    |                    |
  |                    |--- POST /api/progression/complete_stage -->|
  |                    | { difficulty: 1, stage: 1,               |
  |                    |   score: 5000, time_ms: 45000 }           |
  |                    |                    |                    |
  |                    |                    |--- Verify stage ----|
  |                    |                    | Can user complete?|
  |                    |                    |<-- OK -------------|
  |                    |                    |                    |
  |                    |                    |--- INSERT result --->|
  |                    |                    | INSERT INTO      |
  |                    |                    | game_results     |
  |                    |                    |<-- result_id -----|
  |                    |                    |                    |
  |                    |                    |--- Unlock next ---|
  |                    |                    | UPDATE progress  |
  |                    |                    | SET current_stage=2|
  |                    |<-- 200 OK --------|                    |
  |                    | { success: true,   |                    |
  |                    |   next_stage: 2,   |                    |
  |                    |   score: 5000 }    |                    |
  |                    |                    |                    |
  |--- Show victory screen ---|             |                    |
  | - Display score                         |                    |
  | - Show next stage unlock                |                    |
  | - Allow replay or next stage            |                    |
```

---

## Multiplayer Matchmaking Flow {#multiplayer}

```
Player1              Backend              WebSocket            Player2
  |                    |                    |                    |
  |--- Click "PvP" ---|                    |                    |
  |                    |                    |                    |
  |--- WS Connect -----|                    |                    |
  | /ws?token=JWT1     |                    |                    |
  |                    |--- Accept + Queue ---|                  |
  |                    | manager.connect(p1) |                  |
  |                    |<-- Connected ------|                   |
  |                    |                    |                    |
  |                    |<-- Connected -----|----|                |
  |                    | manager.connect(p2)   |                |
  |                    |                    | WS Connect        |
  |                    |                    | /ws?token=JWT2   |
  |                    |                    |                   |
  |--- send() -------->|                    |                   |
  | { type: join_queue,|                    |                   |
  |   difficulty: 1,   |                    |                   |
  |   mode: pvp }      |                    |                   |
  |                    |                    |                   |
  |                    |--- Queue[p1] ------|                   |
  |                    |                    |                   |
  |                    |                    |<-- send() --------|
  |                    |                    | { type: join_q... |
  |                    |                    |                   |
  |                    |--- try_match() ---|                   |
  |                    | len(queue) >= 2?  |                   |
  |                    |<-- YES -----------|                   |
  |                    |                    |                   |
  |                    |--- Generate Seed ---|                  |
  |                    | seed = random()    |                  |
  |                    | room_id = uuid()   |                  |
  |                    |                    |                   |
  |<-- match_found ----|---- broadcast ---|--- match_found -->|
  | { room_id: abc,    |<--------------| { opponent: p2,   |
  |   opponent: p2,    |                 |   seed: 98765,    |
  |   seed: 98765,     |                 |   room_id: abc }  |
  |   difficulty: 1 }  |                 |                   |
  |                    |                 |                   |
  |--- Redirect /game? ---|              |--- Redirect ------|
  | roomId=abc&seed... |              | /game?roomId...   |
  |                    |                |                   |
  |--- Init Game ------|              |--- Init Game ------|
  | with seed, in room |              | with seed, in room |
  |                    |                |                   |
  |<-- Game Loop ----->|                |<-- Game Loop ----->|
  | player_moved      |                 | player_moved      |
  |  (send updates)   |                 |  (send updates)   |
  |                    |                 |                   |
  |                    |--- broadcast ---|-- player_moved -->|
  |                    | (to room abc)  |                   |
  |                    |                 |                   |
  |<-- player_moved ---|<-- broadcast ---|                   |
  | (from p2)          | (from room)     |                   |
  |                    |                 |                   |
  | ... continue ...   |                 |                   |
  |                    |                 |                   |
  |--- Complete Level ---|              |--- Complete ------|
  |                    |                 |                   |
  |--- send() -------->|                 |                   |
  | { type: game_event,|                 |                   |
  |   event: complete, |                 |                   |
  |   score: 5000,     |                 |                   |
  |   time_ms: 42000 } |                 |                   |
  |                    |                 |                   |
  |                    |--- broadcast ---|-- player_completed |
  |                    | (to room abc)  | { user_id: p1,  |
  |<-- player_complete-|<-- broadcast --|  score: 5000,   |
  | (p1 won)           | (from room)     |  winner: true }  |
  |                    |                 |                   |
  |--- Show Victory ---|              |--- Show Defeat ---|
  | Score: 5000        |              | Score: 4800      |
  | Winner!            |              | Opponent Won!    |
```

---

## Chat & Social Flow {#chat-flow}

```
User1                WebSocket            Backend              User2
  |                    |                    |                    |
  |--- Connect WS ----|                    |                    |
  | /ws?token=JWT1    |                    |                    |
  |                    |--- Accept ------->|                    |
  |                    |                    |                    |
  |                    |                    |                    |
  |                    |                    |<-- Connect --------|
  |                    |                    | /ws?token=JWT2    |
  |                    |                    |--- Accept ------->|
  |                    |                    |                    |
  |--- Send Message --|                    |                    |
  | { type: chat_msg, |                    |                    |
  |   to_user: 2,     |                    |                    |
  |   body: "Hi!" }   |                    |                    |
  |                    |--- Save DB ------>|                    |
  |                    |<-- Saved ---------|                    |
  |                    |                    |                    |
  |                    |--- Send to User2--|-- msg ---------->|
  |                    |<-- Delivered -----|                    |
  |                    | (via manager)     |                    |
  |                    |                    |                    |
  |                    |                    |<-- Display Msg ---|
  |                    |                    | (UI updates)     |
  |                    |                    |                    |
  |--- Send Friend Req-|                    |                    |
  | { type: friend_req,|                    |                    |
  |   to_user: 2 }    |                    |                    |
  |                    |--- Check -------->|                    |
  |                    | Can send?         |                    |
  |                    |<-- Yes -----------|                    |
  |                    |                    |                    |
  |                    |--- INSERT ------->|                    |
  |                    | friend_requests   |                    |
  |                    |<-- Saved ---------|                    |
  |                    |                    |                    |
  |                    |--- Notify ------->|--- friend_request-----|
  |                    |<-- Sent ----------|                    |
  |                    |                    |                    |
  |                    |                    |<-- Show Dialog ---|
  |                    |                    | "User1 wants to  |
  |                    |                    |  be your friend" |
  |                    |                    |                    |
  |                    |                    |--- Accept Req ---|
  |                    |                    | { req_id: 123 }  |
  |                    |                    |                    |
  |                    |--- Check -------->|                    |
  |                    | Valid request?    |                    |
  |                    |<-- Yes -----------|                    |
  |                    |                    |                    |
  |                    |--- INSERT ------->|                    |
  |                    | friendships       |                    |
  |                    |<-- Saved ---------|                    |
  |                    |                    |                    |
  |                    |--- Broadcast ----|-- friendship_created|
  |<-- friendship_created|<-- To both --|  (to both users)   |
  | (User2 is friend)  |                   |                    |
  |                    |                    |<-- Now friends ---|
```

---

## Progression & Leaderboard {#progression}

```
Backend                          Database
  |                                  |
  |--- Complete Stage ----------->|
  |  difficulty=1, stage=1        |
  |  score=5000, time_ms=42000    |
  |                               |
  |--- INSERT game_result ------->|
  |  user_id, difficulty, stage,  |
  |  score, time_ms               |
  |<-- result_id --------|         |
  |                      |         |
  |--- UPDATE progress ->|         |
  |  current_stage = 2   |         |
  |<-- OK --------|      |         |
  |               |      |         |
  |--- CHECK -----|      |         |
  |  All stages   |      |         |
  |  complete?    |      |         |
  |               |      |         |
  |  (If all 5)   |      |         |
  |--- UNLOCK nextDifficulty --->|
  |  difficulty = 2      |         |
  |<-- OK --------|      |         |
  |               |      |         |
  |--- UPDATE stats ----->|        |
  |  Recalculate:        |        |
  |  - win_rate          |        |
  |  - avg_score         |        |
  |  - total_playtime    |        |
  |<-- Updated --|       |        |
  |               |      |        |
  |--- Leaderboard --->|         |
  |  SELECT users with |         |
  |  difficulty >= 2    |         |
  |  ORDER BY score     |         |
  |<-- Top 100 ------|   |        |
  |                  |   |        |
  |--- Cache for 5min---|        |
  |                      |       |
```

**Complete Example: User completing all stages**

```
Day 1: Completes Difficulty 1 (5 stages)
  - Stage 1: 45 seconds, 5000 points
  - Stage 2: 38 seconds, 5500 points
  - Stage 3: 50 seconds, 4800 points
  - Stage 4: 42 seconds, 5200 points
  - Stage 5: 55 seconds, 4600 points
  → Unlocks Difficulty 2

Day 5: Completes Difficulty 2, 3, 4, 5
  → Reaches "Master" tier

Leaderboard:
  1. User with 250,000 total points
  2. Our User with 180,000 points
  3. Another user with 120,000 points
  ...

Personal Stats:
  - Total Games: 50
  - Win Rate: 85% (multiplayer wins)
  - Best Stage: Difficulty 5, Stage 3 (35 seconds)
  - Current Tier: Master
  - Next Goal: Complete all stages < 40 seconds avg
```

