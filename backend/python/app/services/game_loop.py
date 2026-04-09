"""
Server-side game loop manager for real-time multiplayer matches.
Handles tick-based updates, collision detection, and state synchronization.
"""
import asyncio
import time
from typing import Dict, Callable, Optional, List
from datetime import datetime
import logging

from .game_state import GameState, MatchStatus


logger = logging.getLogger(__name__)


class GameLoopManager:
    """
    Server-authoritative game loop.
    
    Runs at fixed tick rate (default 20 Hz = 50ms per tick).
    Responsibilities:
    - Update game state each tick
    - Detect collisions (black hole absorption)
    - Broadcast state to connected clients
    - Handle match lifecycle
    - Persist final state to database
    """
    
    def __init__(self, match_id: str, tick_rate: float = 20.0):
        """
        Initialize game loop.
        
        Args:
            match_id: Unique match identifier
            tick_rate: Game ticks per second (Hz)
        """
        self.match_id = match_id
        self.game_state = GameState(match_id=match_id)
        self.game_state.tick_rate = tick_rate
        
        self.tick_interval = 1.0 / tick_rate  # Time per tick in seconds
        self.is_running = False
        self.loop_task: Optional[asyncio.Task] = None
        
        # Callbacks for client communication
        self.on_state_update: Optional[Callable] = None  # Called each tick to broadcast
        self.on_player_absorbed: Optional[Callable] = None  # Called when player absorbed
        self.on_match_finished: Optional[Callable] = None  # Called when match ends
        self.on_error: Optional[Callable] = None
        
        # Timing
        self.start_time: Optional[float] = None
        self.paused_time: float = 0.0
        self.paused_at: Optional[float] = None
    
    async def start(self) -> None:
        """Start the game loop"""
        if self.is_running:
            logger.warning(f"Game loop {self.match_id} already running")
            return
        
        self.is_running = True
        self.start_time = time.time()
        self.game_state.status = MatchStatus.IN_PROGRESS
        self.game_state.started_at = self.start_time
        
        logger.info(f"Starting game loop for match {self.match_id}")
        
        try:
            self.loop_task = asyncio.create_task(self._game_loop())
        except Exception as e:
            logger.error(f"Error starting game loop: {e}")
            self.is_running = False
            if self.on_error:
                await self.on_error(str(e))
    
    async def stop(self) -> None:
        """Stop the game loop"""
        self.is_running = False
        
        if self.loop_task:
            await self.loop_task
        
        logger.info(f"Game loop stopped for match {self.match_id}")
    
    async def _game_loop(self) -> None:
        """Main game loop - runs at fixed tick rate"""
        try:
            while self.is_running:
                tick_start = time.time()
                
                # Execute one game tick
                await self._tick()
                
                # Sleep to maintain tick rate
                elapsed = time.time() - tick_start
                sleep_time = self.tick_interval - elapsed
                
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                else:
                    # Tick took too long, warn but continue
                    logger.warning(
                        f"Tick {self.game_state.tick_count} exceeded interval: "
                        f"{elapsed:.3f}s (max {self.tick_interval:.3f}s)"
                    )
        
        except asyncio.CancelledError:
            logger.info(f"Game loop cancelled for match {self.match_id}")
        except Exception as e:
            logger.error(f"Game loop error for match {self.match_id}: {e}", exc_info=True)
            if self.on_error:
                await self.on_error(str(e))
            self.is_running = False
    
    async def _tick(self) -> None:
        """Execute one game tick"""
        current_time = time.time()
        
        # Check collisions with black hole
        newly_absorbed = self.game_state.check_collisions(current_time)
        
        # Notify of absorption events
        if newly_absorbed and self.on_player_absorbed:
            for player_id in newly_absorbed:
                await self.on_player_absorbed(player_id)
        
        # Increment tick counter
        self.game_state.tick_count += 1
        
        # Check if match is finished
        if self.game_state.is_match_finished():
            await self._finish_match()
        else:
            # Broadcast state update to all clients
            if self.on_state_update:
                await self.on_state_update(self.game_state.get_state_for_client(None))
    
    async def _finish_match(self) -> None:
        """Handle match completion"""
        current_time = time.time()
        
        self.game_state.status = MatchStatus.FINISHED
        self.game_state.finished_at = current_time
        self.game_state.winner_id = self.game_state.determine_winner()
        
        self.is_running = False
        
        logger.info(
            f"Match {self.match_id} finished. "
            f"Winner: {self.game_state.winner_id}, "
            f"Duration: {current_time - self.game_state.started_at:.1f}s"
        )
        
        # Notify match finished
        if self.on_match_finished:
            await self.on_match_finished(self.game_state.get_state_for_client(None))
    
    def add_player(self, user_id: str, player_id: str, x: float = 0.0, y: float = 0.0) -> None:
        """Add player to match"""
        self.game_state.add_player(user_id, player_id, x, y)
        logger.info(f"Player {player_id} (user {user_id}) added to match {self.match_id}")
    
    def remove_player(self, player_id: str) -> None:
        """Remove player from match"""
        self.game_state.remove_player(player_id)
        logger.warning(f"Player {player_id} disconnected from match {self.match_id}")
    
    def update_player_position(self, player_id: str, x: float, y: float, vx: float = 0.0, vy: float = 0.0) -> None:
        """Update player position (called when receiving client input)"""
        self.game_state.update_player_position(player_id, x, y, vx, vy)
    
    def get_match_state(self, player_id: Optional[str] = None) -> dict:
        """Get current match state"""
        return self.game_state.get_state_for_client(player_id)
    
    def get_players_count(self) -> int:
        """Get number of active players"""
        return self.game_state.get_player_count()
    
    def is_match_active(self) -> bool:
        """Check if match is still running"""
        return self.is_running and self.game_state.status == MatchStatus.IN_PROGRESS


class GameLoopRegistry:
    """Registry for active game loops"""
    
    def __init__(self):
        self.active_loops: Dict[str, GameLoopManager] = {}
    
    async def create_loop(self, match_id: str, tick_rate: float = 20.0) -> GameLoopManager:
        """Create and start new game loop"""
        if match_id in self.active_loops:
            raise ValueError(f"Game loop for match {match_id} already exists")
        
        loop = GameLoopManager(match_id, tick_rate)
        self.active_loops[match_id] = loop
        
        return loop
    
    async def start_loop(self, match_id: str) -> None:
        """Start an existing game loop"""
        if match_id not in self.active_loops:
            raise ValueError(f"Game loop for match {match_id} not found")
        
        await self.active_loops[match_id].start()
    
    async def stop_loop(self, match_id: str) -> None:
        """Stop and remove game loop"""
        if match_id in self.active_loops:
            await self.active_loops[match_id].stop()
            del self.active_loops[match_id]
    
    def get_loop(self, match_id: str) -> Optional[GameLoopManager]:
        """Get game loop by match ID"""
        return self.active_loops.get(match_id)
    
    def get_active_matches(self) -> List[str]:
        """List all active match IDs"""
        return list(self.active_loops.keys())


# Global registry instance
game_loop_registry = GameLoopRegistry()
