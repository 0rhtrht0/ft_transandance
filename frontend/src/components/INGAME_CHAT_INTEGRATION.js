/**
 * EXAMPLE: How to integrate GameChatHUD with IngameView
 * 
 * This file shows how to use the GameChatHUD component during gameplay
 */

// ============= In IngameView.vue =============

/*

<template>
  <div class="ingame-container">
    <!-- Game Canvas -->
    <canvas id="gameCanvas"></canvas>
    
    <!-- Game HUD Elements -->
    <div class="game-hud">
      <div class="score-display">Evaluation points: {{ evaluationPoints }}</div>
      <div class="timer-display">Time: {{ formatTime(timeLeft) }}</div>
      <div class="players-display">
        <div v-for="player in players" :key="player.id" class="player-indicator">
          <span class="player-name">{{ player.name }}</span>
          <span class="player-status" :class="player.status">{{ player.status }}</span>
        </div>
      </div>
    </div>
    
    <!-- In-Game Chat -->
    <GameChatHUD
      ref="gameChat"
      :match-id="matchId"
      :players="players"
    />
    
    <!-- Pause Menu / Game Over Screen -->
    <div v-if="gameState === 'paused'" class="pause-menu">
      <h2>Game Paused</h2>
      <button @click="resumeGame">Resume</button>
      <button @click="quitGame">Quit to Menu</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, inject } from 'vue'
import { useRouter } from 'vue-router'
import GameChatHUD from '@/components/GameChatHUD.vue'
import { GameManager } from '@/game/main.js'

const router = useRouter()
const gameChat = ref(null)

// Injected from App.vue
const currentUserId = inject('currentUserId')
const jwtToken = inject('jwtToken')
const wsUrl = inject('wsUrl')

// Game state
const matchId = ref('') // Set from route param
const evaluationPoints = ref(0)
const timeLeft = ref(300) // 5 minutes
const gameState = ref('playing') // playing, paused, over
const players = ref([])
const gameManager = ref(null)
const ws = ref(null)

// Initialize game
onMounted(async () => {
  // Get match ID from route
  matchId.value = route.params.matchId
  
  // Start game manager
  gameManager.value = new GameManager(canvas)
  gameManager.value.start()
  
  // Connect WebSocket for game updates & chat
  connectWebSocket()
  
  // Listen for incoming chat messages
  setupChatListener()
})

// Connect to WebSocket for real-time updates
const connectWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsEndpoint = `${wsProtocol}//${wsUrl}/ws?token=${jwtToken.value}&match_id=${matchId.value}`
  
  ws.value = new WebSocket(wsEndpoint)
  
  ws.value.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    if (data.type === 'state') {
      // Game state update from server
      handleGameStateUpdate(data)
    } else if (data.type === 'message') {
      // Chat message from another player
      handleChatMessage(data)
    } else if (data.type === 'notification') {
      // Player absorbed, match end, etc
      handleNotification(data.notification)
    }
  }
}

// Handle game state updates (positions, absorptions, etc)
const handleGameStateUpdate = (data) => {
  // Update player positions
  data.players.forEach(player => {
    gameManager.value.updatePlayerPosition(player.id, player.x, player.y)
    
    // Check if player was absorbed
    if (player.status === 'absorbed') {
      gameManager.value.showAbsorptionEffect(player.id)
    }
  })
  
  // Update black hole
  gameManager.value.updateBlackHole(data.black_hole)
  
  // Update evaluation points
  evaluationPoints.value = data.evaluation_points
}

// Handle incoming chat message
const handleChatMessage = (data) => {
  const message = {
    id: `msg_${Date.now()}`,
    sender_id: data.sender_id,
    sender_name: data.sender_name,
    content: data.content
  }
  
  // Add to game chat HUD
  gameChat.value?.addMessage(message)
  
  // Optional: Show floating text above player
  gameManager.value.showPlayerBubble(data.sender_id, data.content)
}

// Handle notifications (player absorbed, etc)
const handleNotification = (notification) => {
  if (notification.type === 'player_absorbed') {
    const absorbedPlayer = notification.data.player_name
    gameManager.value.showNotification(`${absorbedPlayer} was absorbed!`)
  } else if (notification.type === 'match_finished') {
    handleMatchEnd(notification)
  }
}

// Setup WebSocket listener for chat (alternative using event emitter)
const setupChatListener = () => {
  // When user sends message via GameChatHUD
  // The message is sent to backend via REST API
  // Server broadcasts via WebSocket: {type: "message", ...}
  // This onmessage handler above receives it
}

// Send player movement to server
const sendPlayerUpdate = (x, y, vx, vy) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({
      type: 'move',
      x, y, vx, vy
    }))
  }
}

// Format time display
const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`
}

// Game pause
const pauseGame = () => {
  gameState.value = 'paused'
  gameManager.value.pause()
}

const resumeGame = () => {
  gameState.value = 'playing'
  gameManager.value.resume()
}

// End game
const handleMatchEnd = async (notification) => {
  gameState.value = 'over'
  gameManager.value.stop()
  
  // Get match results
  const results = notification.data
  
  // Show results screen
  await router.push({
    name: 'GameOver',
    params: {
      matchId: matchId.value,
      winner: results.winner_id,
      evaluation_points: results.evaluation_points
    }
  })
}

const quitGame = async () => {
  gameManager.value?.stop()
  ws.value?.close()
  await router.push('/menu')
}

// Cleanup
onUnmounted(() => {
  gameManager.value?.stop()
  ws.value?.close()
})

// Export for use in game loop
export { sendPlayerUpdate }
</script>

<style scoped>
.ingame-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

#gameCanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.game-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  font-family: 'Courier New', monospace;
  z-index: 10;
}

.score-display,
.timer-display {
  font-size: 18px;
  font-weight: bold;
  color: #4caf50;
  margin-bottom: 10px;
}

.players-display {
  display: flex;
  gap: 10px;
}

.player-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 4px;
}

.player-name {
  font-weight: bold;
}

.player-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
}

.player-status.active {
  background: #4caf50;
  color: black;
}

.player-status.absorbed {
  background: #f74c31;
  color: white;
}

.pause-menu {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  padding: 40px;
  border-radius: 8px;
  text-align: center;
  color: white;
  z-index: 100;
}

.pause-menu h2 {
  margin-bottom: 20px;
}

.pause-menu button {
  display: block;
  width: 200px;
  margin: 10px auto;
  padding: 10px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.pause-menu button:hover {
  background: #5568d3;
}
</style>

*/

// ============= Update in game/main.js =============

/*
// When player moves locally, send to server
function onPlayerMove(x, y, vx, vy) {
  sendPlayerUpdate(x, y, vx, vy) // Send to backend
}

// When receiving server state update
function onServerStateUpdate(state) {
  // Update all player positions
  state.players.forEach(player => {
    updatePlayerPosition(player.id, player.x, player.y)
    
    // Check if this player was absorbed
    if (player.status === 'absorbed' && !localPlayersAbsorbed.has(player.id)) {
      showAbsorptionAnimation(player.id)
      localPlayersAbsorbed.add(player.id)
      
      // Send chat message
      sendChatToGame(`${player.name} was absorbed!`)
    }
  })
  
  // Check if match is over
  if (state.status === 'finished') {
    endGame(state)
  }
}

// Show floating text above player (for chat messages)
function showPlayerBubble(playerId, text) {
  const player = getPlayer(playerId)
  if (!player) return
  
  const bubble = createTextBubble(text)
  bubble.x = player.x
  bubble.y = player.y - 50
  
  // Float up and fade out over 3 seconds
  animateBubble(bubble)
}
*/

export default {
  // This file is documentation/example only
}
