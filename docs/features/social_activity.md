# Feature: Social & Activity Feed

Blackhole provides a robust real-time social platform, renamed and upgraded into a persistent **Activity Feed** for better immersion and user engagement.

## Architecture
The social module relies on a hybrid approach:
- **REST (FastAPI)**: For persistent data (Friends list, search, history).
- **WebSocket**: For real-time signal relay (Messages, Presence, Live notifications).

## Technical Details

### Frontend (Vue 3)
- **View**: `FriendsView.vue`.
- **Components**:
    - `SocialFriendsTab.vue`: Player discovery (fuzzy search), friend lists, and status indicators.
    - `SocialNotificationsTab.vue` (**The Activity Feed**): Persistent journal of all system and social events.
    - `ConversationWindow.vue`: Real-time chat interface with history.
- **Logics**:
    - `useFriendSearch.js`: Handles backend communication for player discovery.
    - `NotificationsWidget.vue`: Global listener for incoming signals during gameplay.

### Backend (FastAPI / PostgreSQL)
- **Routes**: `/api/friends/*`, `/api/messages/*`.
- **Models**: `Friendship`, `FriendRequest`, `Notification`, `Message`, `Conversation`.
- **WebSocket Manager**: Broadcasts events like `message.received`, `friend_request.new`, and `presence.update`.

## Key Features
- **Activity Feed**: Persistent, themed journal of interactions. Read items are muted but stay in the log.
- **Direct Messaging**: Secured, persistent chat between friends.
- **Player Discovery**: Multi-criteria search for other operators in the singularity.
- **Presence Tracking**: Real-time "Online" status detection.
- **Neon UI**: Unread activities feature dynamic glows color-coded by event type (Message: Blue, Friend: Green, Alert: Amber).
