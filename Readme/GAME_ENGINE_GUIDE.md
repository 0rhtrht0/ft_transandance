# Guide Complet: Game Engine - Maze Generation & Physics

## Table des matières
1. [Maze Generation](#generation)
2. [Collision Detection](#collision)
3. [Game Loop & Physics](#physics)
4. [Level Management](#levels)
5. [Difficulty System](#difficulty)

---

## Maze Generation {#generation}

### Seed-Based Procedural Generation

Qu'est-ce que c'est?
- **Seed** = nombre fixe qui génère toujours le même maze
- Utilisé pour multiplayer (même maze pour tous les joueurs)
- Déterministe (pas d'aléatoire vrai)

### Algorithme: Recursive Backtracking

```javascript
// frontend/src/game/level.js

/**
 * Generate maze using seed (deterministic)
 * @param {number} seed - Random seed
 * @param {number} difficulty - 1-5 (affects complexity)
 * @param {number} width - Tile width
 * @param {number} height - Tile height
 * @returns {object} Maze data
 */
function generateMaze(seed, difficulty, width, height) {
  // Initialize RNG with seed
  const random = seededRandom(seed)
  
  // Calculate grid size based on difficulty
  const gridWidth = 20 + difficulty * 10   // 20-70 tiles wide
  const gridHeight = 15 + difficulty * 8   // 15-55 tiles tall
  
  // Initialize grid (all walls)
  let grid = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill('wall'))
  
  // Carve paths using recursive backtracking
  carvePathsRecursive(grid, 1, 1, random)
  
  // Place player start
  const startX = 1
  const startY = 1
  grid[startY][startX] = 'start'
  
  // Place exit (randomly in bottom-right area)
  const exitX = gridWidth - 2
  const exitY = gridHeight - 2
  grid[exitY][exitX] = 'exit'
  
  // Add enemies (randomly placed)
  const enemyCount = Math.floor(difficulty / 2)
  const enemies = placeEnemies(grid, enemyCount, random)
  
  return {
    grid: grid,
    width: gridWidth,
    height: gridHeight,
    tileSize: 32,
    startX: startX,
    startY: startY,
    endX: exitX,
    endY: exitY,
    enemies: enemies
  }
}

/**
 * Recursive backtracking algorithm
 */
function carvePathsRecursive(grid, x, y, random) {
  // Mark current cell as path
  grid[y][x] = 'path'
  
  // Directions: up, right, down, left
  const directions = [
    [0, -2],  // up
    [2, 0],   // right
    [0, 2],   // down
    [-2, 0]   // left
  ]
  
  // Shuffle directions (with seed)
  shuffleArray(directions, random)
  
  // Try each direction
  for (const [dx, dy] of directions) {
    const nx = x + dx
    const ny = y + dy
    
    // Check if in bounds and unvisited (wall)
    if (isInBounds(nx, ny, grid) && grid[ny][nx] === 'wall') {
      // Carve path between current and next
      const wx = x + dx / 2
      const wy = y + dy / 2
      grid[wy][wx] = 'path'
      
      // Recursively carve from next cell
      carvePathsRecursive(grid, nx, ny, random)
    }
  }
}

/**
 * Seeded random number generator (deterministic)
 */
function seededRandom(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

/**
 * Fisher-Yates shuffle with seed
 */
function shuffleArray(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

/**
 * Place enemies randomly on valid paths
 */
function placeEnemies(grid, count, random) {
  const enemies = []
  const gridHeight = grid.length
  const gridWidth = grid[0].length
  
  let placed = 0
  while (placed < count) {
    const x = Math.floor(random() * gridWidth)
    const y = Math.floor(random() * gridHeight)
    
    // Only place on paths (not walls or start/exit)
    if (grid[y][x] === 'path') {
      enemies.push({
        x: x,
        y: y,
        type: 'patrol',  // 'patrol' or 'hostile'
        direction: 0
      })
      placed++
    }
  }
  
  return enemies
}
```

**Exemple de génération:**

```
Seed 12345, Difficulty 1:
┌──────────────────────┐
│S . . # . . . # . . E│
│# # . # . # . # . # .│
│. . . # . . . . . # .│
│. # . # # . # . # # .│
│. . . . . . . . . . .│
│# . # . # . # . # # .│
│. . . . . . . . . . .│
│# . # . # . # # . # .│
└──────────────────────┘

S = Start
E = Exit
. = Path
# = Wall
```

### Difficulty Scaling

```javascript
function getMazeParameters(difficulty) {
  // difficulty: 1-5
  
  return {
    gridSize: {
      width: 20 + difficulty * 10,    // 20-70
      height: 15 + difficulty * 8     // 15-55
    },
    
    complexity: {
      pathDensity: 0.3 + difficulty * 0.05,  // 0.35-0.55
      wallThickness: 1 + (difficulty > 3 ? 1 : 0)
    },
    
    enemies: {
      count: Math.floor(difficulty / 2),     // 0-2
      speed: 1 + difficulty * 0.2,           // 1.0-2.0
      aggressiveness: difficulty / 5         // 0.2-1.0
    },
    
    timer: {
      maxSeconds: 300 - difficulty * 30,     // 300-150 sec
      penalty: difficulty * 5                 // 5-25 sec per hit
    }
  }
}
```

---

## Collision Detection {#collision}

### Grid-Based Collision

```javascript
// frontend/src/game/Maze.js

class Maze {
  constructor(mazeData) {
    this.grid = mazeData.grid  // 2D array
    this.width = mazeData.width
    this.height = mazeData.height
    this.tileSize = mazeData.tileSize
  }

  /**
   * Check if tile is walkable
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isWalkable(x, y) {
    // Check bounds
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false
    }
    
    // Check if path
    const tile = this.grid[y][x]
    return tile !== 'wall'
  }

  /**
   * Get walkable neighbors (for pathfinding)
   */
  getWalkableNeighbors(x, y) {
    const neighbors = []
    const directions = [
      [0, -1],  // up
      [1, 0],   // right
      [0, 1],   // down
      [-1, 0]   // left
    ]
    
    for (const [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      
      if (this.isWalkable(nx, ny)) {
        neighbors.push({ x: nx, y: ny })
      }
    }
    
    return neighbors
  }

  /**
   * Distance from point to exit
   */
  getDistanceToExit(x, y) {
    // Manhattan distance
    return Math.abs(x - this.endX) + Math.abs(y - this.endY)
  }
}
```

### Player Collision

```javascript
// frontend/src/game/Player.js

class Player {
  constructor(x, y, maze) {
    this.x = x  // Grid position
    this.y = y
    this.maze = maze
    this.lastX = x  // For undo
    this.lastY = y
    this.health = 100
    this.score = 0
  }

  /**
   * Move in direction
   */
  move(dx, dy) {
    const newX = this.x + dx
    const newY = this.y + dy
    
    // Store current position (for undo if collision)
    this.lastX = this.x
    this.lastY = this.y
    
    // Try to move
    if (this.maze.isWalkable(newX, newY)) {
      this.x = newX
      this.y = newY
      return true
    } else {
      return false  // Collision
    }
  }

  /**
   * Revert to last position (undo move)
   */
  revert() {
    this.x = this.lastX
    this.y = this.lastY
  }

  /**
   * Check collision with enemies
   */
  checkEnemyCollision(enemies) {
    for (const enemy of enemies) {
      if (this.x === enemy.x && this.y === enemy.y) {
        return true  // Collision!
      }
    }
    return false
  }

  /**
   * Check if reached exit
   */
  isAtExit(maze) {
    return this.x === maze.endX && this.y === maze.endY
  }
}
```

### Sweep & Prune Optimization

```javascript
// For performance with many entities

class CollisionManager {
  constructor() {
    this.entities = []  // All collidable objects
  }

  /**
   * Get potential collisions (broad phase)
   * @param {Entity} entity
   * @returns {Entity[]} Candidates for collision
   */
  getCollisionCandidates(entity) {
    // Divide world into grid cells
    const cellX = Math.floor(entity.x / 32)
    const cellY = Math.floor(entity.y / 32)
    
    // Get entities in nearby cells
    const candidates = this.entities.filter(other => {
      if (other === entity) return false
      
      const otherCellX = Math.floor(other.x / 32)
      const otherCellY = Math.floor(other.y / 32)
      
      // Within 1 cell distance
      return Math.abs(cellX - otherCellX) <= 1 &&
             Math.abs(cellY - otherCellY) <= 1
    })
    
    return candidates
  }

  /**
   * Narrow phase: precise collision test
   */
  checkCollision(entity1, entity2) {
    // Axis-aligned bounding box (AABB)
    const aabb1 = entity1.getBounds()
    const aabb2 = entity2.getBounds()
    
    return !(aabb1.right < aabb2.left ||
             aabb1.left > aabb2.right ||
             aabb1.bottom < aabb2.top ||
             aabb1.top > aabb2.bottom)
  }
}
```

---

## Game Loop & Physics {#physics}

### Main Game Loop

```javascript
// frontend/src/game/main.js

class Game {
  constructor(canvas, ctx, options = {}) {
    this.canvas = canvas
    this.ctx = ctx
    this.width = options.width
    this.height = options.height
    this.running = false
    
    this.targetFPS = 60
    this.deltaTime = 0  // Time since last frame (ms)
    this.lastFrameTime = 0
  }

  start() {
    this.running = true
    this.lastFrameTime = performance.now()
    this.gameLoop()
  }

  /**
   * Main game loop (60 FPS target)
   */
  gameLoop() {
    if (!this.running) return

    // Calculate delta time
    const now = performance.now()
    this.deltaTime = now - this.lastFrameTime
    this.lastFrameTime = now
    
    // Cap delta time (prevent spiral of death if lag spike)
    const cappedDelta = Math.min(this.deltaTime, 50)  // Max 50ms = 20 FPS minimum

    // Update
    this.update(cappedDelta)

    // Render
    this.render()

    // Schedule next frame
    requestAnimationFrame(() => this.gameLoop())
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // Convert deltaTime to seconds for easier math
    const dt = deltaTime / 1000

    // Update player
    this.player.update(dt)

    // Update enemies
    this.enemies.forEach(enemy => {
      enemy.update(dt, this.maze, this.player)
    })

    // Update projectiles
    this.projectiles.forEach((proj, i) => {
      proj.update(dt)
      
      // Remove if out of bounds
      if (proj.x < 0 || proj.x > this.width ||
          proj.y < 0 || proj.y > this.height) {
        this.projectiles.splice(i, 1)
      }
    })

    // Check collisions
    this.checkCollisions()

    // Update camera (follow player)
    this.camera.follow(this.player)

    // Check win condition
    if (this.player.isAtExit(this.maze)) {
      this.levelComplete()
    }

    // Update elapsed time
    this.elapsedTime += dt
  }

  /**
   * Physics update for entity
   */
  updateEntity(entity, dt) {
    // Velocity → Position
    entity.x += entity.vx * dt
    entity.y += entity.vy * dt

    // Apply gravity (if needed)
    if (entity.useGravity) {
      entity.vy += 9.8 * dt  // 9.8 m/s^2
    }

    // Apply friction (slow down)
    entity.vx *= 0.9
    entity.vy *= 0.9
  }

  /**
   * Check all collisions
   */
  checkCollisions() {
    // Player vs Walls (already handled by move())

    // Player vs Enemies
    if (this.player.checkEnemyCollision(this.enemies)) {
      this.player.health -= 10
      this.emit('playerHit', 10)
      
      if (this.player.health <= 0) {
        this.gameover()
      }
    }

    // Player vs Pickups
    this.pickups.forEach((pickup, i) => {
      if (this.player.x === pickup.x && this.player.y === pickup.y) {
        this.player.score += pickup.value
        this.pickups.splice(i, 1)
        this.emit('scoreUpdated', this.player.score)
      }
    })

    // Projectile vs Enemies
    this.projectiles.forEach((proj, pi) => {
      this.enemies.forEach((enemy, ei) => {
        if (proj.x === enemy.x && proj.y === enemy.y) {
          this.projectiles.splice(pi, 1)
          this.enemies.splice(ei, 1)
          this.player.score += 50
          this.emit('enemyKilled', { score: 50 })
        }
      })
    })
  }

  /**
   * Render everything
   */
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, this.height)

    // Save context (for camera transform)
    this.ctx.save()

    // Apply camera transform
    this.ctx.translate(-this.camera.x, -this.camera.y)

    // Draw maze
    this.drawMaze()

    // Draw pickups
    this.drawPickups()

    // Draw player
    this.drawPlayer()

    // Draw enemies
    this.drawEnemies()

    // Draw projectiles
    this.drawProjectiles()

    // Restore context
    this.ctx.restore()

    // Draw HUD (not transformed)
    this.drawHUD()
  }
}
```

### Camera System

```javascript
class Camera {
  constructor(width, height) {
    this.x = 0          // Camera position
    this.y = 0
    this.width = width   // Viewport size
    this.height = height
  }

  /**
   * Follow entity (keep centered)
   */
  follow(entity, maze) {
    // Target camera position (entity at center)
    const targetX = entity.x - this.width / 2
    const targetY = entity.y - this.height / 2

    // Smooth camera movement
    const smoothness = 0.1
    this.x += (targetX - this.x) * smoothness
    this.y += (targetY - this.y) * smoothness

    // Clamp to world bounds
    const worldWidth = maze.width * maze.tileSize
    const worldHeight = maze.height * maze.tileSize

    this.x = Math.max(0, Math.min(this.x, worldWidth - this.width))
    this.y = Math.max(0, Math.min(this.y, worldHeight - this.height))
  }
}
```

---

## Level Management {#levels}

### Stage Progression

```javascript
// Progressive difficulty

const STAGES = {
  1: {
    difficulty: 1,
    name: "Tutorial",
    timeLimit: 300,
    enemies: 0,
    description: "Learn the basics"
  },
  2: {
    difficulty: 1,
    name: "Easy Maze",
    timeLimit: 240,
    enemies: 1,
    description: "Basic maze with one enemy"
  },
  3: {
    difficulty: 2,
    name: "Medium Maze",
    timeLimit: 180,
    enemies: 2,
    description: "Larger maze, more enemies"
  },
  4: {
    difficulty: 3,
    name: "Hard Maze",
    timeLimit: 120,
    enemies: 3,
    description: "Complex maze"
  },
  5: {
    difficulty: 4,
    name: "Nightmare",
    timeLimit: 60,
    enemies: 4,
    description: "Expert difficulty"
  }
}

function getStageInfo(stage, difficulty) {
  return STAGES[stage] || {
    difficulty: Math.min(5, difficulty + Math.floor(stage / 5)),
    name: `Stage ${stage}`,
    timeLimit: Math.max(30, 300 - stage * 10),
    enemies: Math.floor(stage / 3),
    description: "Advanced level"
  }
}
```

### Scoring System

```javascript
function calculateScore(difficulty, stage, timeMs, enemiesKilled) {
  // Base score
  let score = 1000

  // Difficulty multiplier
  score *= (1 + difficulty * 0.5)  // 1.5x-3.5x

  // Stage bonus
  score += stage * 100

  // Time bonus (faster = more points)
  const maxTime = 300 * 1000  // 5 minutes
  const timeBonus = Math.max(0, (maxTime - timeMs) / 100)
  score += timeBonus

  // Enemies killed bonus
  score += enemiesKilled * 50

  return Math.floor(score)
}
```

---

## Difficulty System {#difficulty}

### Dynamic Difficulty Adjustment

```javascript
class DifficultyManager {
  constructor() {
    this.playerSkill = 0.5  // 0-1 estimate
  }

  /**
   * Analyze game performance
   */
  analyzePerfromance(gameResult) {
    const {
      difficulty,
      stage,
      timeMs,
      enemiesKilled,
      healthLost,
      completed
    } = gameResult

    // Calculate player skill estimate
    if (completed) {
      const speedFactor = Math.min(1, timeMs / (300 * 1000))
      const combatFactor = enemiesKilled / Math.max(1, totalEnemies)
      const survivalFactor = (100 - healthLost) / 100

      this.playerSkill = (speedFactor + combatFactor + survivalFactor) / 3
    } else {
      // Failed level → lower skill estimate
      this.playerSkill *= 0.8
    }

    this.playerSkill = Math.max(0, Math.min(1, this.playerSkill))
  }

  /**
   * Recommend next difficulty
   */
  recommendNextDifficulty(currentDifficulty) {
    if (this.playerSkill > 0.8) {
      // Very good → increase difficulty
      return Math.min(5, currentDifficulty + 1)
    } else if (this.playerSkill < 0.3) {
      // Struggling → decrease difficulty
      return Math.max(1, currentDifficulty - 1)
    } else {
      // Balanced → keep same
      return currentDifficulty
    }
  }
}
```

