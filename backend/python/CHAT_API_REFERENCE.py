"""
REST API Endpoints for Chat and Notifications

These endpoints work in conjunction with WebSocket for real-time features.
"""

# ============= Messages API =============

"""
GET /api/messages/conversations
  Get all conversations for authenticated user
  
  Query params:
    - limit: int (default: 50)
    - offset: int (default: 0)
  
  Response:
  {
    "conversations": [
      {
        "id": "uuid",
        "type": "direct|room|match",
        "name": "Alice" or null,
        "participants_count": 2,
        "last_message": {
          "id": "uuid",
          "sender_name": "alice",
          "content": "Hey!",
          "created_at": "2024-03-12T10:00:00Z"
        },
        "updated_at": "2024-03-12T10:00:00Z",
        "unread_count": 2
      }
    ],
    "total_count": 10
  }
"""


"""
GET /api/messages/conversations/{conversation_id}
  Get conversation with participants and metadata
  
  Response:
  {
    "id": "uuid",
    "type": "direct",
    "name": null,
    "participants": [
      {
        "id": "uuid",
        "username": "alice",
        "is_online": true
      },
      {
        "id": "uuid",
        "username": "bob",
        "is_online": false
      }
    ]
  }
"""


"""
GET /api/messages/conversations/{conversation_id}/messages
  Get paginated messages from conversation
  
  Query params:
    - limit: int (default: 50, max: 100)
    - offset: int (default: 0)
  
  Response:
  {
    "messages": [
      {
        "id": "uuid",
        "sender_id": "uuid",
        "sender_name": "alice",
        "content": "Hello!",
        "created_at": "2024-03-12T10:00:00Z",
        "is_read": true
      }
    ],
    "total_count": 100
  }
"""


"""
POST /api/messages
  Send a new message to conversation
  
  Body:
  {
    "conversation_id": "uuid",
    "content": "Hello world!"
  }
  
  Response:
  {
    "id": "uuid",
    "sender_id": "uuid",
    "content": "Hello world!",
    "created_at": "2024-03-12T10:00:00Z",
    "is_read": false
  }
  
  Status:
    - 201: Message created
    - 400: Invalid input
    - 401: Not authenticated
    - 403: Not participant in conversation
    - 422: Content too long (max 1000 chars)
"""


"""
POST /api/messages/conversations
  Create new direct conversation with another user
  
  Body:
  {
    "other_user_id": "uuid"
  }
  
  Response:
  {
    "id": "uuid",
    "type": "direct",
    "participants": [
      {"id": "uuid", "username": "alice"},
      {"id": "uuid", "username": "bob"}
    ]
  }
  
  Status:
    - 201: Conversation created
    - 400: Invalid user_id
    - 404: User not found
"""


"""
POST /api/messages/conversations/{conversation_id}/mark-read
  Mark all messages in conversation as read
  
  Response:
  {
    "success": true,
    "marked_count": 5
  }
  
  Status:
    - 200: OK
    - 404: Conversation not found
    - 403: Not participant
"""


# ============= Notifications API =============

"""
GET /api/notifications
  Get notifications for authenticated user
  
  Query params:
    - unread_only: bool (default: false)
    - limit: int (default: 50)
    - offset: int (default: 0)
  
  Response:
  {
    "notifications": [
      {
        "id": "uuid",
        "type": "user_online|new_message|friend_request|match_found",
        "title": "Alice is online",
        "message": "Your friend Alice just came online",
        "actor_id": "uuid",
        "actor_name": "alice",
        "is_read": false,
        "created_at": "2024-03-12T10:00:00Z",
        "data": {
          "user_id": "uuid",
          "user_name": "alice"
        }
      }
    ],
    "unread_count": 3,
    "total_count": 50
  }
"""


"""
POST /api/notifications/{notification_id}/read
  Mark single notification as read
  
  Response:
  {
    "id": "uuid",
    "is_read": true
  }
  
  Status:
    - 200: OK
    - 404: Notification not found
"""


"""
POST /api/notifications/read-all
  Mark all notifications as read for user
  
  Response:
  {
    "success": true,
    "marked_count": 10
  }
  
  Status:
    - 200: OK
"""


"""
DELETE /api/notifications/{notification_id}
  Delete notification (user-level only)
  
  Response:
  {
    "success": true
  }
  
  Status:
    - 204: Deleted
    - 404: Not found
"""


# ============= Friends API (Related) =============

"""
GET /api/friends
  Get user's friend list
  
  Query params:
    - online_only: bool (default: false)
    - search: str (filter by username)
  
  Response:
  {
    "friends": [
      {
        "id": "uuid",
        "username": "alice",
        "avatar": "https://...",
        "is_online": true,
        "last_seen": "2024-03-12T10:00:00Z",
        "status": "Online"
      }
    ],
    "online_count": 5,
    "total_count": 20
  }
"""


"""
POST /api/friends/request
  Send friend request
  
  Body:
  {
    "recipient_id": "uuid"
  }
  
  Response:
  {
    "id": "uuid",
    "recipient_id": "uuid",
    "status": "pending",
    "created_at": "2024-03-12T10:00:00Z"
  }
  
  Status:
    - 201: Request sent
    - 400: Already friends or request exists
    - 404: User not found
"""


"""
POST /api/friends/{friend_id}/accept
  Accept friend request
  
  Response:
  {
    "id": "uuid",
    "user_id": "uuid",
    "friend_id": "uuid",
    "created_at": "2024-03-12T10:00:00Z"
  }
  
  Status:
    - 200: Accepted
    - 404: Request not found
"""


"""
DELETE /api/friends/{friend_id}
  Remove friend or reject request
  
  Response:
  {
    "success": true
  }
  
  Status:
    - 204: Removed
    - 404: Not found
"""


# ============= User Search API =============

"""
GET /api/users/search
  Search for users to add as friends
  
  Query params:
    - q: str (username search)
    - limit: int (default: 20)
  
  Response:
  {
    "users": [
      {
        "id": "uuid",
        "username": "alice",
        "avatar": "https://...",
        "is_online": true,
        "mutual_friends": 3
      }
    ]
  }
  
  Status:
    - 200: OK
    - 400: Query too short (min 1 char)
"""


# ============= Online Status API =============

"""
GET /api/users/{user_id}/online-status
  Get user's online status
  
  Response:
  {
    "user_id": "uuid",
    "is_online": true,
    "last_seen": "2024-03-12T10:00:00Z"
  }
  
  Status:
    - 200: OK
    - 404: User not found
"""


"""
GET /api/users/online-status/batch
  Get online status for multiple users
  
  Query params:
    - ids: str (comma-separated UUIDs)
  
  Response:
  {
    "users": [
      {
        "user_id": "uuid",
        "is_online": true
      }
    ]
  }
  
  Status:
    - 200: OK
"""


# ============= Error Responses =============

"""
All errors follow this format:

{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {...}  # Optional
  }
}

Common error codes:
- VALIDATION_ERROR: Input validation failed
- NOT_FOUND: Resource not found
- UNAUTHORIZED: Missing or invalid token
- FORBIDDEN: User not authorized for this action
- CONFLICT: Resource conflict (e.g., already friends)
- RATE_LIMITED: Too many requests
- SERVER_ERROR: Internal server error
"""


# ============= Rate Limiting =============

"""
All endpoints have rate limits:

- GET /conversations: 60 requests/minute
- POST /messages: 100 requests/minute (1 per 100ms minimum)
- POST /friends/request: 10 requests/minute
- GET /notifications: 60 requests/minute

Rate limit headers in response:
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 45
  X-RateLimit-Reset: 1234567890
"""


# ============= Authentication =============

"""
All endpoints require JWT token in header:

Authorization: Bearer {access_token}

Token should be obtained via:
  POST /auth/login
  POST /auth/refresh

Token expires in 1 hour (access_token)
Refresh token expires in 7 days
"""


# ============= Example: Complete Chat Flow =============

"""
1. Get conversations
   GET /api/messages/conversations
   Response: [{id, participants, unread_count}, ...]

2. Select conversation and load messages
   GET /api/messages/conversations/{id}/messages?limit=50
   Response: {messages: [...]}

3. Mark as read
   POST /api/messages/conversations/{id}/mark-read
   Response: {success: true}

4. Send message
   POST /api/messages
   Body: {conversation_id, content}
   Response: {id, content, created_at}
   
   Broadcast via WebSocket:
   {type: "message", conversation_id, sender_id, content, ...}

5. Get notifications
   GET /api/notifications
   Response: {notifications: [...], unread_count}

6. Mark notification read
   POST /api/notifications/{id}/read
   Response: {is_read: true}
"""


# ============= Example: Friend Request Flow =============

"""
1. Search for user
   GET /api/users/search?q=alice
   Response: {users: [{id, username, is_online}]}

2. Send friend request
   POST /api/friends/request
   Body: {recipient_id}
   Response: {id, status: "pending"}
   
   Recipient gets notification:
   {type: "friend_request", actor_id, actor_name, ...}

3. Recipient accepts
   POST /api/friends/{friend_id}/accept
   Response: {id, created_at}
   
   Now both can see each other in friends list
   Can open direct conversation

4. Get friends list
   GET /api/friends
   Response: {friends: [...]}

5. Open chat with friend
   POST /api/messages/conversations
   Body: {other_user_id}
   Response: {id, type: "direct", ...}
"""
