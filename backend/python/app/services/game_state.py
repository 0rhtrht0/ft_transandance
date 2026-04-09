"""
Game state management for multiplayer matches.
Handles player absorption by black hole and match lifecycle.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, List
from enum import Enum
import math


class PlayerStatus(str, Enum):
    """Player states during a match"""
    ACTIVE = "active"
    ABSORBED = "absorbed"
    DISCONNECTED = "disconnected"


class MatchStatus(str, Enum):
    """Match lifecycle states"""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


@dataclass
class PlayerState:
    """Individual player state in a match"""
    user_id: str
    player_id: str  # Unique ID for this match session
    x: float = 0.0
    y: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    radius: float = 10.0
    status: PlayerStatus = PlayerStatus.ACTIVE
    absorbed_at: Optional[float] = None  # Timestamp when absorbed
    evaluation_points: int = 0
    
    def is_active(self) -> bool:
        """Check if player is still in game"""
        return self.status == PlayerStatus.ACTIVE


@dataclass
class GameState:
    """Complete game state for a match
    
    Rules:
    - Each player absorbed by black hole is eliminated individually
    - Match continues until ALL players are absorbed
    - Winner: last player to survive (lowest absorption time)
    """
    match_id: str
    players: Dict[str, PlayerState] = field(default_factory=dict)
    status: MatchStatus = MatchStatus.WAITING
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    winner_id: Optional[str] = None  # user_id of last survivor
    
    # Game parameters
    black_hole_x: float = 512.0
    black_hole_y: float = 384.0
    black_hole_radius: float = 50.0
    absorption_threshold: float = 65.0  # Distance to absorb player
    
    # Timing
    tick_count: int = 0
    tick_rate: float = 20.0  # Hz (50ms per tick)
    
    def add_player(self, user_id: str, player_id: str, x: float = 0.0, y: float = 0.0) -> None:
        """Add player to match"""
        self.players[player_id] = PlayerState(
            user_id=user_id,
            player_id=player_id,
            x=x,
            y=y
        )
    
    def remove_player(self, player_id: str) -> None:
        """Remove player from match (disconnection)"""
        if player_id in self.players:
            self.players[player_id].status = PlayerStatus.DISCONNECTED
    
    def update_player_position(self, player_id: str, x: float, y: float, vx: float, vy: float) -> None:
        """Update player position and velocity from client"""
        if player_id in self.players and self.players[player_id].is_active():
            self.players[player_id].x = x
            self.players[player_id].y = y
            self.players[player_id].vx = vx
            self.players[player_id].vy = vy
    
    def check_collisions(self, current_time: float) -> List[str]:
        """
        Check which players collide with black hole.
        Returns list of newly absorbed player IDs.
        """
        absorbed = []
        
        for player_id, player in self.players.items():
            if not player.is_active():
                continue
            
            # Calculate distance to black hole center
            dx = player.x - self.black_hole_x
            dy = player.y - self.black_hole_y
            distance = math.sqrt(dx * dx + dy * dy)
            
            # Check absorption
            if distance < self.absorption_threshold:
                player.status = PlayerStatus.ABSORBED
                player.absorbed_at = current_time
                absorbed.append(player_id)
        
        return absorbed
    
    def get_active_players(self) -> List[PlayerState]:
        """Get list of players still in game"""
        return [p for p in self.players.values() if p.is_active()]
    
    def get_player_count(self) -> int:
        """Count active players"""
        return len(self.get_active_players())
    
    def is_match_finished(self) -> bool:
        """Check if match should end (all players absorbed or only 1 left)"""
        active_count = self.get_player_count()
        return active_count == 0
    
    def determine_winner(self) -> Optional[str]:
        """
        Determine match winner.
        Winner = last player to be absorbed (highest survival time)
        Returns user_id of winner or None if match ongoing
        """
        if not self.is_match_finished():
            return None
        
        # Find player with latest absorption time
        absorbed_players = [
            p for p in self.players.values() 
            if p.status == PlayerStatus.ABSORBED
        ]
        
        if not absorbed_players:
            return None
        
        winner = max(absorbed_players, key=lambda p: p.absorbed_at or 0)
        return winner.user_id
    
    def get_state_for_client(self, player_id: str) -> dict:
        """
        Get game state snapshot for client.
        Includes all player positions and statuses.
        """
        return {
            "match_id": self.match_id,
            "status": self.status.value,
            "tick": self.tick_count,
            "black_hole": {
                "x": self.black_hole_x,
                "y": self.black_hole_y,
                "radius": self.black_hole_radius
            },
            "players": {
                pid: {
                    "user_id": p.user_id,
                    "x": p.x,
                    "y": p.y,
                    "vx": p.vx,
                    "vy": p.vy,
                    "radius": p.radius,
                    "status": p.status.value,
                    "absorbed_at": p.absorbed_at
                }
                for pid, p in self.players.items()
            },
            "winner": self.winner_id,
            "finished_at": self.finished_at
        }
    
    def to_dict(self) -> dict:
        """Serialize game state to dict (for DB storage)"""
        return {
            "match_id": self.match_id,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "winner_id": self.winner_id,
            "tick_count": self.tick_count,
            "players": [
                {
                    "user_id": p.user_id,
                    "player_id": p.player_id,
                    "status": p.status.value,
                    "absorbed_at": p.absorbed_at,
                    "evaluation_points": p.evaluation_points,
                    "final_x": p.x,
                    "final_y": p.y
                }
                for p in self.players.values()
            ]
        }
