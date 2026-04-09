/**
 * Chat and Notifications Integration Guide
 * 
 * This guide shows how to integrate the Chat and Notifications components
 * into your Vue app.
 */

// ============= Integration in App.vue =============

/*
<template>
  <div id="app">
    <!-- Your existing app content -->
    <RouterView />

    <!-- Chat Widget (fixed position, bottom-right) -->
    <ChatWidget
      ref="chatWidget"
      :current-user-id="currentUserId"
      :jwt-token="jwtToken"
      :api-url="apiUrl"
      :ws-url="wsUrl"
      @notification="handleChatNotification"
      @user-online="handleUserOnline"
      @user-offline="handleUserOffline"
    />

    <!-- Notifications Widget (fixed position, top-right) -->
    <NotificationsWidget
      ref="notificationsWidget"
      :auto-close-duration="5000"
      :max-notifications="5"
      @notification-click="handleNotificationClick"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import ChatWidget from '@/components/ChatWidget.vue'
import NotificationsWidget from '@/components/NotificationsWidget.vue'

const router = useRouter()
const chatWidget = ref(null)
const notificationsWidget = ref(null)

// Get from localStorage or auth store
const currentUserId = ref(localStorage.getItem('userId') || '')
const jwtToken = ref(localStorage.getItem('accessToken') || '')

// Environment variables
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const wsUrl = import.meta.env.VITE_WS_URL || 'localhost:8000'

const handleChatNotification = (notification) => {
  // Show notification from chat
  notificationsWidget.value?.addNotification({
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data
  })
}

const handleUserOnline = ({ userId, userName }) => {
  notificationsWidget.value?.addNotification({
    type: 'user_online',
    title: `${userName} is online`,
    id: `online_${userId}`
  })
}

const handleUserOffline = ({ userId, userName }) => {
  notificationsWidget.value?.addNotification({
    type: 'user_offline',
    title: `${userName} went offline`,
    id: `offline_${userId}`
  })
}

const handleNotificationClick = (notificationData) => {
  // Handle notification click (navigate, etc.)
  if (notificationData.type === 'new_message') {
    // Open chat with conversation
  } else if (notificationData.type === 'friend_request') {
    // Navigate to friends page
  } else if (notificationData.type === 'match_found') {
    // Navigate to game with match_id
    router.push(`/game/${notificationData.data.match_id}`)
  }
}

onMounted(() => {
  console.log('App initialized with Chat & Notifications')
})

onBeforeUnmount(() => {
  // Clean up subscriptions
})
</script>

<style>
#app {
  min-height: 100vh;
}
</style>
*/

// ============= Environment Setup =============

/*
Create or update your .env.local file with:

VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=localhost:8000
VITE_APP_TITLE=Transcendence

If using Docker:
VITE_API_URL=https://yourdomain.com/api
VITE_WS_URL=yourdomain.com
*/

// ============= Chat Display Placement =============

/*
The Chat Widget is positioned fixed in bottom-right corner.
You can customize the position by editing ChatWidget.vue:

  .chat-container {
    position: fixed;
    bottom: 20px;      // Distance from bottom
    right: 20px;       // Distance from right
    width: 350px;      // Width
    max-height: 600px; // Max height
    z-index: 1000;     // Stack order
  }

If you want a different placement:
- Top-left: Change to top: 20px; left: 20px;
- Side panel: Make it width: 100%; and adjust sizing
- Full screen modal: Remove position: fixed and wrap in modal component
*/

// ============= How Chat Works (Architecture) =============

/*
1. USER CONNECTS
   - Browser loads app
   - App mounts ChatWidget
   - ChatWidget connects to WebSocket: /ws?token=JWT_TOKEN
   - Server accepts connection, registers user as online
   - Server notifies user's friends they're online

2. LOAD CONVERSATIONS
   - ChatWidget loads user's conversations from REST API: GET /messages/conversations
   - Shows list of conversations in left sidebar
   - Displays unread count for each conversation

3. SELECT CONVERSATION
   - User clicks conversation
   - ChatWidget loads messages: GET /messages/conversations/{id}/messages?limit=50
   - Shows chat history in chronological order
   - Marks messages as read via WebSocket

4. SEND MESSAGE
   - User types and presses Enter
   - Message sent via REST API: POST /messages
   - Message also broadcast via WebSocket to all listeners
   - Server saves to database
   - Real-time update for recipients

5. RECEIVE MESSAGE
   - WebSocket receives {type: "message", conversation_id, sender_id, content}
   - Message added to conversation.messages array
   - If conversation not open, create notification
   - Notification sent via WebSocket: {type: "notification", ...}
   - Shows in top-right NotificationsWidget

6. ONLINE STATUS
   - User1 comes online → WebSocket fires user_online event
   - Server notifies User1's friends
   - WebSocket broadcasts {type: "user_online", user_id, user_name}
   - Each friend's NotificationsWidget shows "X is online"
   - ChatWidget updates online indicator in conversation

7. USER GOES OFFLINE
   - WebSocket closes or timeout
   - Server marks user as offline
   - Notifies friends: {type: "user_offline", ...}
   - NotificationsWidget shows "X went offline"
   - ChatWidget removes online indicator
*/

// ============= Data Flow Diagram =============

/*
Frontend                           Backend                        Database
========                           =======                        ========

App mounts
ChatWidget
    ↓
Connect WebSocket
    ├────────────────────────→ /ws?token=JWT
    │                             ↓
    │                         Verify JWT
    │                         Register connection
    │                         Notify friends online
    │←─────────────────── user_online event
    ↓

Load Conversations
    ├───────────────────────→ GET /conversations
    │                             ↓
    │                         Query DB: conversations
    │                         + participants
    │                         + last message
    │←─────────────────── [{id, name, messages: [], unread_count}]
    ↓

User clicks conversation
    ├───────────────────────→ GET /conversations/{id}/messages
    │                             ↓
    │                         Query DB: messages
    │                         WHERE conversation_id
    │                         ORDER BY created_at
    │←─────────────────── [{id, sender, content, created_at}]
    ↓

User sends message
    ├───────────────────────→ POST /messages
    │                         (also via WebSocket)
    │                             ↓
    │                         Save message to DB
    │                         Query message recipients
    │                         ↓
    │                         For each recipient:
    │                         - If online: WebSocket broadcast
    │                         - If offline: Create notification
    │←─────────────────── {type: "message", ...}
    │
    └─ Other online recipients
        ├─ Receive via WebSocket ──→ Add to messages list
        ├─ Create notification if not subscribed
        └─ Play sound

Conversation listener gets update
    ├─ Show message in chat
    ├─ Scroll to bottom
    └─ Mark as read (send message_read to server)
*/

// ============= Notification Types =============

/*
1. user_online: A friend came online
   {
     type: "user_online",
     user_id: "uuid",
     user_name: "alice",
     timestamp: "2024-03-12T10:00:00Z"
   }

2. user_offline: A friend went offline
   {
     type: "user_offline",
     user_id: "uuid",
     user_name: "alice",
     timestamp: "2024-03-12T10:05:00Z"
   }

3. new_message: Someone sent you a message
   {
     type: "new_message",
     sender_id: "uuid",
     sender_name: "bob",
     conversation_id: "uuid",
     preview: "Hey, how are you?",
     timestamp: "2024-03-12T10:10:00Z"
   }

4. friend_request: New friend request
   {
     type: "friend_request",
     actor_id: "uuid",
     actor_name: "charlie",
     timestamp: "2024-03-12T10:15:00Z"
   }

5. match_found: Match found in matchmaking
   {
     type: "match_found",
     match_id: "uuid",
     opponent_name: "dave",
     timestamp: "2024-03-12T10:20:00Z"
   }
*/

// ============= WebSocket Protocol =============

/*
Client → Server:

// Join specific conversation
{
  "type": "subscribe_conversation",
  "conversation_id": "uuid"
}

// Send message
{
  "type": "chat",
  "conversation_id": "uuid",
  "content": "Hello!"
}

// Mark messages read
{
  "type": "message_read",
  "conversation_id": "uuid"
}

// Mark notification read
{
  "type": "notification_read",
  "notification_id": "uuid"
}

// Keep-alive
{
  "type": "heartbeat"
}

Server → Client:

// New message in conversation
{
  "type": "message",
  "conversation_id": "uuid",
  "sender_id": "uuid",
  "sender_name": "alice",
  "content": "Hello!",
  "timestamp": "2024-03-12T10:00:00Z"
}

// Notification
{
  "type": "notification",
  "notification": {
    "id": "uuid",
    "type": "user_online",
    "title": "Alice is online",
    "actor_id": "uuid",
    "created_at": "2024-03-12T10:00:00Z"
  }
}

// User status
{
  "type": "user_online",
  "user_id": "uuid",
  "user_name": "alice",
  "timestamp": "2024-03-12T10:00:00Z"
}

// Pong (response to heartbeat)
{
  "type": "pong",
  "timestamp": "2024-03-12T10:00:00Z"
}
*/

export default {
  // This file is documentation only
}
