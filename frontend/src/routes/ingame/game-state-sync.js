/**
 * GameStateSync - Gère la synchronisation multijoueur
 * Synchronise position, animation et état du jeu en temps réel
 */

export class GameStateSync {
    constructor(ws, gameScene) {
        this.ws = ws;
        this.gameScene = gameScene;
        this.gameId = null;
        this.playerId = null;
        this.opponentId = null;
        this.opponentData = {
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            animationFrame: 0,
            isMoving: false
        };
        this.syncInterval = 50; // ms entre updates
        this.syncTimer = null;
        this.messageQueue = [];
        this.lastSyncTime = Date.now();
    }

    /**
     * Initialise la sync multijoueur
     */
    init(gameId, playerId, opponentId) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.opponentId = opponentId;

        // Écouter les événements WebSocket
        this.setupWebSocketListeners();

        // Démarrer la boucle de sync
        this.startSyncLoop();

        console.log(`[GameStateSync] Initialized: game=${gameId}, player=${playerId}, opponent=${opponentId}`);
    }

    /**
     * Configure les listeners WebSocket
     */
    setupWebSocketListeners() {
        this.ws.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('[GameStateSync] Failed to parse WebSocket message:', error);
            }
        });

        this.ws.addEventListener('close', () => {
            console.warn('[GameStateSync] WebSocket closed');
            this.stop();
            this.gameScene.handleOpponentDisconnect();
        });

        this.ws.addEventListener('error', (error) => {
            console.error('[GameStateSync] WebSocket error:', error);
        });
    }

    /**
     * Traite les messages reçus
     */
    handleMessage(message) {
        switch (message.type) {
            case 'game_state':
                this.handleGameStateUpdate(message);
                break;
            case 'player_won':
                this.handlePlayerWon(message);
                break;
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
            case 'game_error':
                this.handleGameError(message);
                break;
            default:
                console.log('[GameStateSync] Unknown message type:', message.type);
        }
    }

    /**
     * Traite la mise à jour d'état du jeu
     */
    handleGameStateUpdate(message) {
        if (message.player_id === this.opponentId) {
            this.opponentData = {
                position: message.position || this.opponentData.position,
                velocity: message.velocity || this.opponentData.velocity,
                animationFrame: message.animation_frame || this.opponentData.animationFrame,
                isMoving: message.is_moving !== undefined ? message.is_moving : this.opponentData.isMoving
            };

            // Mettre à jour opponent dans le jeu
            this.gameScene.updateOpponent(this.opponentData);
        }
    }

    /**
     * Traite la victoire d'un joueur
     */
    handlePlayerWon(message) {
        if (message.winner_id === this.playerId) {
            console.log('[GameStateSync] You won!');
            this.gameScene.handleVictory(message.duration);
        } else {
            console.log('[GameStateSync] Opponent won!');
            this.gameScene.handleDefeat(message.duration);
        }
        this.stop();
    }

    /**
     * Traite la déconnexion d'un joueur
     */
    handlePlayerLeft(message) {
        if (message.player_id === this.opponentId) {
            console.warn('[GameStateSync] Opponent disconnected');
            this.gameScene.handleOpponentDisconnect();
            this.stop();
        }
    }

    /**
     * Traite les erreurs
     */
    handleGameError(message) {
        console.error('[GameStateSync] Game error:', message.detail);
        alert(`Game error: ${message.detail}`);
    }

    /**
     * Envoie une mise à jour d'état
     */
    sendStateUpdate(playerData) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[GameStateSync] WebSocket not ready');
            return;
        }

        const message = {
            type: 'game_update',
            game_id: this.gameId,
            player_id: this.playerId,
            position: playerData.position,
            velocity: playerData.velocity,
            animation_frame: playerData.animationFrame,
            is_moving: playerData.isMoving,
            timestamp: Date.now()
        };

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('[GameStateSync] Failed to send message:', error);
        }
    }

    /**
     * Envoie la victoire
     */
    sendVictory(duration) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message = {
            type: 'player_finished',
            game_id: this.gameId,
            player_id: this.playerId,
            duration: duration
        };

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('[GameStateSync] Failed to send victory:', error);
        }
    }

    /**
     * Envoie la déconnexion
     */
    sendDisconnect() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message = {
            type: 'player_left',
            game_id: this.gameId,
            player_id: this.playerId
        };

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('[GameStateSync] Failed to send disconnect:', error);
        }
    }

    /**
     * Démarre la boucle de sync
     */
    startSyncLoop() {
        this.syncTimer = setInterval(() => {
            if (this.gameScene && this.gameScene.getPlayerData) {
                const playerData = this.gameScene.getPlayerData();
                this.sendStateUpdate(playerData);
            }
        }, this.syncInterval);

        console.log('[GameStateSync] Sync loop started (interval: ' + this.syncInterval + 'ms)');
    }

    /**
     * Arrête la boucle de sync
     */
    stop() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('[GameStateSync] Sync loop stopped');
        }
    }

    /**
     * Récupère les données de l'opponent
     */
    getOpponentData() {
        return this.opponentData;
    }

    /**
     * Gère le délai réseau (latency compensation)
     */
    interpolateOpponentPosition(timeDelta) {
        if (!this.opponentData.velocity) return this.opponentData.position;

        return {
            x: this.opponentData.position.x + (this.opponentData.velocity.x * timeDelta / 1000),
            y: this.opponentData.position.y + (this.opponentData.velocity.y * timeDelta / 1000)
        };
    }
}

/**
 * SeededRandom - Générateur RNG déterministe basé sur seed
 * Assure que 2 joueurs avec le même seed générent le même maze
 */
export class SeededRandom {
    constructor(seed) {
        this.seed = this.hashSeed(seed);
    }

    hashSeed(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    next() {
        // Linear Congruential Generator (LCG)
        const a = 1664525;
        const c = 1013904223;
        const m = 2147483647; // 2^31 - 1

        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }

    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }

    shuffle(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
}

/**
 * Générateur de Maze déterministe
 */
export class SeededMazeGenerator {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.rng = new SeededRandom(seed);
        this.maze = null;
    }

    generate() {
        // Initialiser la grille (1 = mur, 0 = passage)
        this.maze = Array(this.height).fill(null).map(() =>
            Array(this.width).fill(1)
        );

        // Récursive backtracking avec seed
        const startX = 1;
        const startY = 1;
        this.carve(startX, startY);

        return this.maze;
    }

    carve(x, y) {
        this.maze[y][x] = 0; // Passage

        // Voisins possibles dans ordre aléatoire
        const directions = [
            { dx: 0, dy: -2, name: 'up' },
            { dx: 2, dy: 0, name: 'right' },
            { dx: 0, dy: 2, name: 'down' },
            { dx: -2, dy: 0, name: 'left' }
        ];

        const shuffled = this.rng.shuffle(directions);

        for (const dir of shuffled) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            if (this.isValid(nx, ny) && this.maze[ny][nx] === 1) {
                // Créer passage entre cellules
                this.maze[y + dir.dy / 2][x + dir.dx / 2] = 0;
                this.carve(nx, ny);
            }
        }
    }

    isValid(x, y) {
        return x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1;
    }

    getMaze() {
        return this.maze;
    }
}

/**
 * Exemple d'utilisation dans GameScene
 */
/*
import { GameStateSync, SeededMazeGenerator } from './game-state-sync.js';

class GameScene {
    constructor(options) {
        this.isMultiplayer = options.isMultiplayer;
        this.seed = options.seed;
        this.gameStateSync = null;
        
        if (this.isMultiplayer && options.ws) {
            this.gameStateSync = new GameStateSync(options.ws, this);
            this.gameStateSync.init(options.gameId, options.playerId, options.opponentId);
        }
    }

    initializeMaze() {
        if (this.seed) {
            // Générer le maze de manière déterministe
            const generator = new SeededMazeGenerator(100, 100, this.seed);
            const maze = generator.generate();
            this.loadMazeData(maze);
        } else {
            // Générer aléatoirement
            this.generateRandomMaze();
        }
    }

    update() {
        // Appeler chaque frame
        if (this.gameStateSync) {
            // Les données d'opponent sont mises à jour automatiquement
            const opponentPos = this.gameStateSync.getOpponentData().position;
            this.renderOpponent(opponentPos);
        }
    }

    getPlayerData() {
        return {
            position: this.player.position,
            velocity: this.player.velocity,
            animationFrame: this.player.currentFrame,
            isMoving: this.player.isMoving
        };
    }

    handleVictory(opponentDuration) {
        console.log('Victory!');
        this.gameStateSync?.stop();
    }

    handleDefeat(winnerDuration) {
        console.log('Defeat!');
        this.gameStateSync?.stop();
    }

    handleOpponentDisconnect() {
        console.log('Opponent disconnected');
        // Auto-win après 5 secondes
        setTimeout(() => {
            if (!this.hasWon) {
                this.triggerAutoWin();
            }
        }, 5000);
    }

    destroy() {
        this.gameStateSync?.sendDisconnect();
        this.gameStateSync?.stop();
    }
}
*/
