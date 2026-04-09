# Feature: Remote Multiplayer & Matchmaking

The multiplayer module allows operators to engage in synchronized maze escape matches across the network.

## Technical Core
Multiplayer is built on **Procedural Consistency**: the server generates a single seed that all clients use to build the exact same maze structure.

## Technical Details

### Frontend (Vue 3 / Canvas)
- **View**: `MazeView.vue` (In-game).
- **Engine**: Custom Canvas 2D engine.
- **Synchronization**: `GameScene.js` listens to WebSocket state updates and interpolates movement/events from remote operators.

### Backend (FastAPI / WebSockets)
- **Room Manager**: Orchestrates player sessions in unique `room_id` bins.
- **Matchmaking**: A ticket-based queue system (`MatchmakingService`) that pairs operators based on difficulty preference.
- **Game Engine**: A Python-side loop (`game_loop.py`) that processes authoritative state and broadcasts snapshots to all connected clients in a room.

## Key Features
- **Real-time Synchronization**: Low-latency state updates for positions, collectibles, and collisions.
- **Matchmaking Queue**: Automatic pairing for competitive逃脱 (escape).
- **Asymmetric Victory**: In multiplayer matches, if one player escapes the singularity, they are declared the winner, while other trailing players are absorbed by the black hole.
- **Reconnection Logic**: Handles temporary signal drops gracefully via room persistence.
