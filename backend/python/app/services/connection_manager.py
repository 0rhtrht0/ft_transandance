"""
WebSocket connection manager for real-time chat and notifications.
Handles multiple concurrent player connections.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for all active players.
    
    Tracks:
    - Who is connected (online status)
    - Their current match
    - Active conversations
    """
    
    def __init__(self):
        self.active_connections: Dict[int, dict] = {}
        self.match_connections: Dict[str, Set[int]] = {}
        self.conversation_listeners: Dict[int, Set[int]] = {}
    
    async def connect(self, user_id: int, websocket, match_id: Optional[str] = None):
        """Register new connection"""
        self.active_connections[user_id] = {
            'connection': websocket,
            'match_id': match_id,
            'connected_at': datetime.utcnow()
        }
        logger.info(f"User {user_id} connected (match: {match_id})")
        
        if match_id:
            if match_id not in self.match_connections:
                self.match_connections[match_id] = set()
            self.match_connections[match_id].add(user_id)
    
    def disconnect(self, user_id: int):
        """Remove disconnected user"""
        if user_id in self.active_connections:
            match_id = self.active_connections[user_id].get('match_id')
            del self.active_connections[user_id]
            
            if match_id and match_id in self.match_connections:
                self.match_connections[match_id].discard(user_id)
                if not self.match_connections[match_id]:
                    del self.match_connections[match_id]
            
            logger.info(f"User {user_id} disconnected")
    
    def is_online(self, user_id: int) -> bool:
        """Check if user is currently connected"""
        return user_id in self.active_connections
    
    def get_online_users(self) -> Set[int]:
        """Get all connected user IDs"""
        return set(self.active_connections.keys())
    
    def subscribe_to_conversation(self, user_id: int, conversation_id: int):
        """Subscribe user to conversation notifications"""
        if conversation_id not in self.conversation_listeners:
            self.conversation_listeners[conversation_id] = set()
        self.conversation_listeners[conversation_id].add(user_id)
    
    def unsubscribe_from_conversation(self, user_id: int, conversation_id: int):
        """Unsubscribe from conversation"""
        if conversation_id in self.conversation_listeners:
            self.conversation_listeners[conversation_id].discard(user_id)
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                ws = self.active_connections[user_id]['connection']
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
    
    async def broadcast_to_conversation(self, conversation_id: int, message: dict):
        """Send message to all users in a conversation"""
        if conversation_id not in self.conversation_listeners:
            return
        
        for user_id in self.conversation_listeners[conversation_id]:
            await self.send_personal_message(message, user_id)
    
    async def broadcast_to_match(self, match_id: str, message: dict):
        """Send message to all players in a match"""
        if match_id not in self.match_connections:
            return
        
        for user_id in self.match_connections[match_id]:
            await self.send_personal_message(message, user_id)
    
    async def broadcast_to_all(self, message: dict):
        """Broadcast to all connected users"""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)
    
    async def notify_user_online(self, user_id: int, user_name: str):
        """Notify online friends when user comes online"""
        message = {
            "type": "user_online",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.utcnow().isoformat()
        }
        # In production: query DB for friends and notify them
        # For now, broadcast to all
        await self.broadcast_to_all(message)
    
    async def notify_user_offline(self, user_id: int, user_name: str):
        """Notify friends when user goes offline"""
        message = {
            "type": "user_offline",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.utcnow().isoformat()
        }
        # In production: query DB for friends and notify them
        # For now, broadcast to all
        await self.broadcast_to_all(message)
    
    def get_match_player_count(self, match_id: str) -> int:
        """Get number of connected players in match"""
        return len(self.match_connections.get(match_id, set()))


# Global instance
manager = ConnectionManager()
