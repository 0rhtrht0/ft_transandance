import { generateMazeLogic } from "../map/mazeLogic.js";
import Maze from "../map/maze.js";
import BlackHole from "../entities/blackhole.js";
import Player from "../entities/player.js";
import { createRng } from "../utils/rng.js";
import { createMultiplayerStore } from "../state/multiplayerStore.js";
import { getApiBase } from "../../../utils/runtimeEndpoints.js";
import { STORAGE_KEYS, getStoredToken } from "../../auth/auth_storage.js";
import { buildRestartPath } from "../ingame_restart.js";
import { normalizeStage, queuePendingStageCompletion } from "../ingame_progression.js";
import {
    mergeLastResultSnapshot,
    readCachedWalletBalance,
    saveLastResultSnapshot,
    storeCachedWalletBalance,
} from "../../../utils/walletProgression.js";

const DEFAULT_AVATAR_URL = "/assets/images/default-avatar.svg";

export default class GameScene {
    constructor(game, options = {}) {
        this.game = game;
        this.maze = null;
        this.fogTime = 0;
        this.tileSize = 28;
        this.visionRadiusWorld = this.tileSize * 2.2;
        this.blackHole = null;
        this.blackHoleCollisionRadius = this.tileSize * 0.3;
        this.blackHoleDirection = { x: 0, y: 0 };
        this.blackHoleTargetCell = null;
        this.blackHoleTargetPoint = null;
        this.lastPlayerCellKey = "";
        this.player = null;
        this.exit = null;
        this.allowManualZoom = false;
        this.stage = normalizeStage(options.stage) || 1;
        this.level = this.stage;
        this.difficulty = typeof options.difficulty === "string" ? options.difficulty : "moyen";
        this.pace = 12;
        this.paceTimer = 0;
        this.absorbState = "idle";
        this.absorbProgress = 0;
        this.absorbDuration = 4;
        this.absorbStart = null;
        this.absorbMessageProgress = 0;
        this.absorbMessageDuration = 2.8;
        this.absorbNavigateDelayMs = 4600;
        this.absorbStartRadius = 0;
        this.absorbTargetRadius = 0;
        this.absorbNavigateTimeoutId = null;
        this.gravityCanvasElement = null;
        this.gravityDisplacementElement = null;
        this.gravityTurbulenceElement = null;
        this.gravityDistortBaseScale = null;
        this.gravityDistortBaseFrequency = null;
        this.bonusDurationSeconds = 15;
        this.bonusTriggerPace = 24;
        this.bonusTriggerSeconds = 42;
        this.isBonusActive = false;
        this.hasAwardedPaceBonus = false;
        this.bonusRemainingSeconds = 0;
        this.bonusElapsedSeconds = 0;
        this.collectibles = {
            pacGums: new Map(),
            superPacGums: new Map()
        };
        this.superPacInventory = null;
        this.collectibleBonusActive = false;
        this.collectibleBonusRemainingSeconds = 0;
        this.collectibleBonusDurationSeconds = 0;
        this.collectibleBonusType = null;
        this.collectibleBonusSpeedBase = null;
        this.collectibleBonusVisionBase = null;
        this.collectibleTrailActive = false;
        this.timeLimitSeconds = 57;
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.levelClearDuration = 1.1;
        this.absorbedText = "you have been absorbed by the blackhole";
        this.escapedText = "You escaped the Black Hole...";
        if (typeof options.onQuit === "function") {
            this.onQuit = options.onQuit;
        } else {
            this.onQuit = null;
        }
        this.isPaused = false;
        this.pauseUiBound = false;
        this.pauseOverlayElement = null;
        this.topTimeElement = null;
        this.topPaceElement = null;
        this.topBonusButton = null;
        this.pauseToggleButton = null;
        this.pauseRestartButton = null;
        this.pauseQuitButton = null;
        this.boundTogglePauseFromUi = null;
        this.boundRestartFromPause = null;
        this.boundQuitFromPause = null;
        this.topEvaluationPointsElement = null;
        this.walletBalance = readCachedWalletBalance();
        this.walletHydrationRequest = null;
        this.evaluationPoints = 0;
        this.hasReachedExit = false;
        this.finalEvaluationPoints = null;
        this.historyRecorded = false;
        this.resultSubmitted = false;
        this.multiplayerFinishHandled = false;
        this.multiplayerAbsorptionSent = false;

        this.multiplayer = options.multiplayer || { enabled: false };
        this.isMultiplayer = this.multiplayer?.enabled === true;
        this.multiplayerStore = this.multiplayer?.store ?? createMultiplayerStore();
        this.gameClient = this.multiplayer?.client ?? null;
        this.localPlayerId = this.multiplayer?.userId ?? this.readStoredUserId();
        if (Array.isArray(this.multiplayer?.players)) {
            this.playerIds = [...this.multiplayer.players];
        } else {
            this.playerIds = [];
        }
        this.initialPlayersMeta = Array.isArray(this.multiplayer?.playersMeta)
            ? [...this.multiplayer.playersMeta]
            : [];
        this.playersMeta = new Map();
        this.playersMetaRequestRoomId = null;
        this.localPlayerMetaRequest = null;
        this.roomId = this.multiplayer?.roomId ?? null;
        this.seed = this.multiplayer?.seed ?? null;
        this.serverStartState = this.multiplayer?.startState ?? this.multiplayer?.start_state ?? null;
        this.tickRate = this.multiplayer?.tickRate ?? 20;
        this.netSendInterval = 1 / Math.max(1, this.tickRate);
        this.netSendAccumulator = 0;
        this.sessionReady = false;
        this.waitingForMatch = false;
        this.multiplayerBound = false;
        this.remotePlayers = new Map();
        this.remoteBlackHoles = new Map();
        this.remoteInput = { isDown: () => false };
        this.rng = Math.random;
        this.soloRunNonce = 0;
        this.lastSoloDoorKey = null;
    }

    onEnter() {
        this.setupPauseUi();
        this.level = this.stage || 1;
        this.pace = 12;
        this.paceTimer = 0;
        this.isBonusActive = false;
        this.hasAwardedPaceBonus = false;
        this.bonusRemainingSeconds = 0;
        this.bonusElapsedSeconds = 0;
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.paceTable = [
            { label: "12", pace: 12, fromSeconds: 0, visionCm: 6, holeCm: 2 },
            { label: "15", pace: 15, fromSeconds: 18, visionCm: 5, holeCm: 3 },
            { label: "18", pace: 18, fromSeconds: 24, visionCm: 4, holeCm: 4 },
            { label: "22", pace: 22, fromSeconds: 30, visionCm: 3, holeCm: 5 },
            { label: "24", pace: 24, fromSeconds: 42, visionCm: 2, holeCm: 6 },
        ];
        this.setPaused(false);
        this.evaluationPoints = 0;
        this.hasReachedExit = false;
        this.finalEvaluationPoints = null;
        this.historyRecorded = false;
        this.resultSubmitted = false;
        this.multiplayerFinishHandled = false;
        this.multiplayerAbsorptionSent = false;
        this.walletBalance = readCachedWalletBalance();
        this.updateTopHud();
        this.bootstrapPlayersMeta();
        this.hydrateWalletBalance();

        if (this.isMultiplayer) {
            if (!this.gameClient) {
                this.isMultiplayer = false;
                this.waitingForMatch = false;
                this.createLevel();
                return;
            }
            this.bindMultiplayerHandlers();
            if (this.roomId && this.seed && this.playerIds.length > 0) {
                this.startMultiplayerSession({
                    room_id: this.roomId,
                    players: this.playerIds,
                    seed: this.seed,
                    tick_rate: this.tickRate
                });
                return;
            }
            this.waitingForMatch = true;
            if (this.gameClient) {
                this.gameClient.connect();
                if (this.multiplayer?.autoMatchmake !== false) {
                    this.gameClient.joinMatchmaking();
                    if (this.matchmakingTimeout) {
                        clearTimeout(this.matchmakingTimeout);
                    }
                    this.matchmakingTimeout = setTimeout(() => {
                        this.cancelMatchmaking("Option A : No opponent found.");
                    }, 30000);
                }
            }
            return;
        }

        this.createLevel();
    }

    normalizeMultiplayerStartLayout(rawStartState) {
        if (!rawStartState || typeof rawStartState !== "object") {
            return null;
        }

        const cols = Number(rawStartState.cols);
        const rows = Number(rawStartState.rows);
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
            return null;
        }

        if (!Array.isArray(rawStartState.grid) || rawStartState.grid.length !== rows) {
            return null;
        }

        const grid = rawStartState.grid.map((row) => {
            if (!Array.isArray(row) || row.length !== cols) {
                return null;
            }
            const normalizedRow = row.map((cell) => {
                const value = Number(cell);
                if (value === 0 || value === 1) {
                    return value;
                }
                return null;
            });
            if (normalizedRow.some((cell) => cell === null)) {
                return null;
            }
            return normalizedRow;
        });
        if (grid.some((row) => row === null)) {
            return null;
        }

        const normalizeCell = (value) => {
            if (!value || typeof value !== "object") {
                return null;
            }
            const x = Number(value.x);
            const y = Number(value.y);
            if (!Number.isInteger(x) || !Number.isInteger(y)) {
                return null;
            }
            if (x < 0 || y < 0 || x >= cols || y >= rows) {
                return null;
            }
            if (grid[y][x] !== 0) {
                return null;
            }
            return { x, y };
        };

        const p1 = normalizeCell(rawStartState.p1);
        const p2 = normalizeCell(rawStartState.p2);
        const door = normalizeCell(rawStartState.door);
        const bh1 = normalizeCell(rawStartState.bh1);
        const bh2 = normalizeCell(rawStartState.bh2);

        if (!p1 || !door) {
            return null;
        }

        return {
            grid,
            cols,
            rows,
            p1,
            p2,
            door,
            bh1: bh1 || p1,
            bh2: bh2 || p2 || bh1 || p1,
        };
    }

    getNormalizedMultiplayerPlayerIds(inputIds = this.playerIds) {
        const normalized = Array.isArray(inputIds)
            ? inputIds
                .map((entry) => Number(entry))
                .filter((entry) => Number.isFinite(entry) && entry > 0)
            : [];

        const dedupedSorted = [...new Set(normalized)].sort((a, b) => a - b);
        return dedupedSorted.slice(0, 4);
    }

    getPerPlayerLayoutCells(rawStartState, allowedPlayerIds, cols, rows, grid) {
        if (!rawStartState || typeof rawStartState !== "object" || !Array.isArray(allowedPlayerIds) || allowedPlayerIds.length === 0) {
            return null;
        }

        const parseCell = (value) => {
            if (!value || typeof value !== "object") {
                return null;
            }
            const x = Number(value.x);
            const y = Number(value.y);
            if (!Number.isInteger(x) || !Number.isInteger(y)) {
                return null;
            }
            if (x < 0 || y < 0 || x >= cols || y >= rows) {
                return null;
            }
            if (grid?.[y]?.[x] !== 0) {
                return null;
            }
            return { x, y };
        };

        const parseMap = (source) => {
            if (!source || typeof source !== "object") {
                return null;
            }
            const map = new Map();
            for (const [rawPlayerId, rawCell] of Object.entries(source)) {
                const playerId = Number(rawPlayerId);
                if (!allowedPlayerIds.includes(playerId)) {
                    continue;
                }
                const cell = parseCell(rawCell);
                if (!cell) {
                    continue;
                }
                map.set(playerId, cell);
            }
            return map;
        };

        const spawnByPlayer = parseMap(rawStartState.spawn_by_player ?? rawStartState.spawnByPlayer);
        const blackHoleByPlayer = parseMap(rawStartState.blackholes_by_player ?? rawStartState.blackholesByPlayer);
        if (!spawnByPlayer || !blackHoleByPlayer) {
            return null;
        }
        if (spawnByPlayer.size === 0 || blackHoleByPlayer.size === 0) {
            return null;
        }

        return { spawnByPlayer, blackHoleByPlayer };
    }


    cancelMatchmaking(reason) {
        if (this.gameClient) {
            if (typeof this.gameClient.leaveMatchmaking === 'function') {
                this.gameClient.leaveMatchmaking();
            }
            if (this.gameClient.ws) { this.gameClient.ws.close(); }
        }
        if (this.matchmakingTimeout) {
            clearTimeout(this.matchmakingTimeout);
            this.matchmakingTimeout = null;
        }
        this.waitingForMatch = false;
        
        
        // alert removed to avoid browser popups
        window.location.href = '/menu';

    }

    createLevel() {

        const tileSize = this.tileSize;
        const cmToPx = (cm) => cm * 10;
        const paceData = this.getCurrentPaceData();
        const blackHoleRadius = cmToPx(paceData.holeCm);

        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        const isMultiplayer = this.isMultiplayer || this.playerIds.length > 1;
        const difficulty = this.difficulty || "moyen";
        const stage = this.stage || 1;

        let logicResult;
        if (isMultiplayer) {
            const startLayout = this.normalizeMultiplayerStartLayout(this.serverStartState);
            if (startLayout) {
                logicResult = startLayout;
            } else {
                const seedStr = this.seed || `${difficulty}:${stage}`;
                logicResult = generateMazeLogic(
                    seedStr,
                    difficulty,
                    stage,
                    true,
                    this.game.camera.viewportWidth,
                    this.game.camera.viewportHeight,
                    tileSize
                );
            }
        } else {
            let attempts = 0;
            do {
                this.soloRunNonce += 1;
                const soloSeed = `${difficulty}:${stage}:${Date.now()}:${this.soloRunNonce}:${Math.floor(Math.random() * 1000000000)}`;
                logicResult = generateMazeLogic(
                    soloSeed,
                    difficulty,
                    stage,
                    false,
                    this.game.camera.viewportWidth,
                    this.game.camera.viewportHeight,
                    tileSize
                );
                attempts += 1;
                if (attempts >= 12) {
                    break;
                }
            } while (this.lastSoloDoorKey === `${logicResult.door.x},${logicResult.door.y}`);
            this.lastSoloDoorKey = `${logicResult.door.x},${logicResult.door.y}`;
        }

        this.maze = new Maze(logicResult.rows, logicResult.cols, tileSize);
        this.maze.grid = logicResult.grid;

        let playerIds = this.getNormalizedMultiplayerPlayerIds(this.playerIds);
        if (playerIds.length === 0) {
            playerIds = [this.localPlayerId ?? 1];
        }
        this.playerIds = [...playerIds];

        const localId = Number(this.localPlayerId ?? playerIds[0]);
        const sortedPlayers = [...playerIds].sort((a, b) => a - b);

        const spawnByPlayer = new Map();
        const bhCellByPlayer = new Map();

        const perPlayerLayout = this.getPerPlayerLayoutCells(
            this.serverStartState,
            sortedPlayers,
            logicResult.cols,
            logicResult.rows,
            logicResult.grid
        );

        if (perPlayerLayout) {
            for (const [playerId, cell] of perPlayerLayout.spawnByPlayer.entries()) {
                spawnByPlayer.set(playerId, cell);
            }
            for (const [playerId, cell] of perPlayerLayout.blackHoleByPlayer.entries()) {
                bhCellByPlayer.set(playerId, cell);
            }
        } else {
            const p1Id = sortedPlayers[0] ?? localId;
            const p2Id = sortedPlayers[1] ?? null;

            spawnByPlayer.set(p1Id, logicResult.p1);
            if (p2Id !== null) {
                spawnByPlayer.set(p2Id, logicResult.p2 || logicResult.p1);
            }

            bhCellByPlayer.set(p1Id, logicResult.bh1 || logicResult.p1);
            if (p2Id !== null) {
                bhCellByPlayer.set(p2Id, logicResult.bh2 || logicResult.bh1 || logicResult.p2 || logicResult.p1);
            }
        }

        if (sortedPlayers.length > 2 && Array.isArray(logicResult.grid)) {
            const cellKey = (cell) => `${cell.x},${cell.y}`;
            const occupied = new Set();
            if (logicResult.door) occupied.add(cellKey(logicResult.door));
            for (const cell of spawnByPlayer.values()) {
                if (cell) occupied.add(cellKey(cell));
            }
            for (const cell of bhCellByPlayer.values()) {
                if (cell) occupied.add(cellKey(cell));
            }

            const freeCells = [];
            for (let y = 0; y < logicResult.rows; y += 1) {
                for (let x = 0; x < logicResult.cols; x += 1) {
                    if (logicResult.grid?.[y]?.[x] === 0) {
                        freeCells.push({ x, y });
                    }
                }
            }

            const missingSpawnPlayers = sortedPlayers.filter((id) => !spawnByPlayer.has(id));
            if (missingSpawnPlayers.length > 0) {
                const spawnCandidates = freeCells.filter((cell) => !occupied.has(cellKey(cell)));
                const selectedSpawns = this.pickSpawnCells(
                    spawnCandidates,
                    logicResult.bh1 || null,
                    logicResult.door || null,
                    missingSpawnPlayers.length
                );
                for (let i = 0; i < missingSpawnPlayers.length; i += 1) {
                    const playerId = missingSpawnPlayers[i];
                    const chosen = selectedSpawns[i] || logicResult.p1;
                    spawnByPlayer.set(playerId, chosen);
                    occupied.add(cellKey(chosen));
                }
            }

            const missingBlackHolePlayers = sortedPlayers.filter((id) => !bhCellByPlayer.has(id));
            if (missingBlackHolePlayers.length > 0) {
                const blackHoleCandidates = freeCells.filter((cell) => !occupied.has(cellKey(cell)));
                const selectedBlackHoles = this.pickSpawnCells(
                    blackHoleCandidates,
                    logicResult.door || null,
                    logicResult.p1 || null,
                    missingBlackHolePlayers.length
                );
                for (let i = 0; i < missingBlackHolePlayers.length; i += 1) {
                    const playerId = missingBlackHolePlayers[i];
                    const chosen = selectedBlackHoles[i]
                        || spawnByPlayer.get(playerId)
                        || logicResult.bh1
                        || logicResult.p1;
                    bhCellByPlayer.set(playerId, chosen);
                    occupied.add(cellKey(chosen));
                }
            }
        }

        const blackHoleCell = bhCellByPlayer.get(localId) || logicResult.bh1;
        const blackHoleX = (blackHoleCell.x + 0.5) * tileSize;
        const blackHoleY = (blackHoleCell.y + 0.5) * tileSize;
        this.blackHole = new BlackHole(blackHoleX, blackHoleY, blackHoleRadius, this.pace);
        this.pace = paceData.pace;
        this.visionRadiusWorld = cmToPx(paceData.visionCm);
        this.baseVisionRadiusWorld = this.visionRadiusWorld;
        this.blackHoleCollisionRadius = Math.max(this.tileSize * 0.3, blackHoleRadius * 0.28);
        this.blackHole._movementCollisionRadius = this.blackHoleCollisionRadius;

        const localSpawn = spawnByPlayer.get(localId) || logicResult.p1;
        this.player = new Player(
            (localSpawn.x + 0.5) * tileSize,
            (localSpawn.y + 0.5) * tileSize,
            this.game.input,
            {
                radius: tileSize * 0.24,
                speed: tileSize * 5.2
            }
        );
        this.collectibles = logicResult.collectibles
            ? this.buildCollectiblesFromLayout(logicResult.collectibles)
            : this.buildDefaultCollectiblesFromLogicResult(logicResult);
        this.syncPlayerBonusVisualState();

        for (const remote of this.remotePlayers.values()) {
            remote.destroy();
        }
        this.remotePlayers.clear();
        this.remoteBlackHoles.clear();
        let remoteIndex = 0;
        for (const id of playerIds) {
            if (id === localId) {
                continue;
            }
            const cell = spawnByPlayer.get(id) || logicResult.p1;
            const player = this.ensureRemotePlayer(
                id,
                {
                    x: (cell.x + 0.5) * tileSize,
                    y: (cell.y + 0.5) * tileSize
                },
                remoteIndex
            );
            player.x = (cell.x + 0.5) * tileSize;
            player.y = (cell.y + 0.5) * tileSize;
            
            const rBhCell = bhCellByPlayer.get(id) || logicResult.bh1;
            this.remoteBlackHoles.set(
                id,
                new BlackHole(
                    (rBhCell.x + 0.5) * tileSize,
                    (rBhCell.y + 0.5) * tileSize,
                    blackHoleRadius,
                    this.pace
                )
            );
            this.remoteBlackHoles.get(id)._movementCollisionRadius = Math.max(this.tileSize * 0.3, blackHoleRadius * 0.28);
            remoteIndex += 1;
        }

        this.exit = {
            x: (logicResult.door.x + 0.5) * tileSize,
            y: (logicResult.door.y + 0.5) * tileSize
        };

        this.absorbState = "idle";
        this.absorbProgress = 0;
        this.absorbStart = null;
        this.absorbMessageProgress = 0;
        this.absorbStartRadius = 0;
        this.absorbTargetRadius = 0;
        this.clearAbsorbNavigationTimeout();
        this.resetGravityDistortion();
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.setPaused(false);
        this.multiplayerFinishHandled = false;
        this.blackHoleDirection = { x: 0, y: 0 };
        this.blackHoleTargetCell = null;
        this.blackHoleTargetPoint = null;
        this.lastPlayerCellKey = "";
        this.game.camera.setWorldSize(this.maze.worldWidth, this.maze.worldHeight);
        this.fitMazeToInterface();
        this.fogTime = 0;
        this.updateMultiplayerPlayersHud();

    }

    getBlackHoleCell() {
        if (!this.blackHole || !this.maze) {
            return { x: 0, y: 0 };
        }
        return {
            x: Math.max(0, Math.min(this.maze.cols - 1, Math.floor(this.blackHole.x / this.tileSize))),
            y: Math.max(0, Math.min(this.maze.rows - 1, Math.floor(this.blackHole.y / this.tileSize)))
        };
    }

    getCellCenter(cellX, cellY) {
        return {
            x: (cellX + 0.5) * this.tileSize,
            y: (cellY + 0.5) * this.tileSize
        };
    }

    getAvailableGhostDirections(cellX, cellY) {
        if (!this.maze) {
            return [];
        }
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];
        return directions.filter((dir) => !this.maze.isWallAtCell(cellX + dir.x, cellY + dir.y));
    }

    pickSpawnCells(freeCells, blackHoleCell, exitCell, count) {
        if (!freeCells || freeCells.length === 0) {
            return [];
        }
        const candidates = [];
        for (const cell of freeCells) {
            if (
                (blackHoleCell && cell.x === blackHoleCell.x && cell.y === blackHoleCell.y) ||
                (exitCell && cell.x === exitCell.x && cell.y === exitCell.y)
            ) {
                continue;
            }
            let distHole;
            if (blackHoleCell) {
                distHole = Math.hypot(cell.x - blackHoleCell.x, cell.y - blackHoleCell.y);
            } else {
                distHole = 0;
            }
            let distExit;
            if (exitCell) {
                distExit = Math.hypot(cell.x - exitCell.x, cell.y - exitCell.y);
            } else {
                distExit = 0;
            }
            const candidateWeight = Math.min(distHole, distExit) * 1000 + distHole + distExit;
            candidates.push({ cell, candidateWeight });
        }

        candidates.sort((a, b) => {
            if (b.candidateWeight !== a.candidateWeight) {
                return b.candidateWeight - a.candidateWeight;
            }
            if (a.cell.y !== b.cell.y) {
                return a.cell.y - b.cell.y;
            }
            return a.cell.x - b.cell.x;
        });

        const selected = [];
        for (const candidate of candidates) {
            if (selected.length >= count) {
                break;
            }
            selected.push(candidate.cell);
        }
        if (selected.length === 0 && exitCell) {
            selected.push(exitCell);
        }
        return selected;
    }

    getPlayerCell() {
        if (!this.player || !this.maze) {
            return { x: 0, y: 0 };
        }
        return {
            x: Math.max(0, Math.min(this.maze.cols - 1, Math.floor(this.player.x / this.tileSize))),
            y: Math.max(0, Math.min(this.maze.rows - 1, Math.floor(this.player.y / this.tileSize)))
        };
    }

    getCurrentPaceIndex() {
        if (!this.paceTable || this.paceTable.length === 0) {
            return 0;
        }
        for (let i = this.paceTable.length - 1; i >= 0; i -= 1) {
            if (this.paceTimer >= this.paceTable[i].fromSeconds) {
                return i;
            }
        }
        return 0;
    }

    getCurrentPaceData() {
        return this.paceTable[this.getCurrentPaceIndex()] ?? this.paceTable[0];
    }

    getTotalElapsedSeconds() {
        return this.paceTimer + this.bonusElapsedSeconds;
    }

    getEffectiveTimeLimitSeconds() {
        return this.timeLimitSeconds;
    }

    isBonusPhaseReady() {
        const paceData = this.getCurrentPaceData();
        return Number(paceData?.pace ?? 0) >= this.bonusTriggerPace;
    }

    startPaceBonus() {
        if (this.hasAwardedPaceBonus || this.isBonusActive) {
            return;
        }

        this.hasAwardedPaceBonus = true;
        this.isBonusActive = true;
        this.bonusRemainingSeconds = this.bonusDurationSeconds;
        this.syncPlayerBonusVisualState();
    }

    updateBonusClock(deltaSeconds) {
        if (!this.isBonusActive) {
            return;
        }

        const elapsed = Math.min(deltaSeconds, this.bonusRemainingSeconds);
        this.bonusRemainingSeconds = Math.max(0, this.bonusRemainingSeconds - deltaSeconds);
        this.bonusElapsedSeconds += elapsed;
        if (this.bonusRemainingSeconds <= 0) {
            this.isBonusActive = false;
            this.bonusRemainingSeconds = 0;
            this.syncPlayerBonusVisualState();
        }
    }

    getCellKey(cell) {
        return `${cell.x},${cell.y}`;
    }

    buildCollectiblesFromLayout(collectibles = {}) {
        const pacGums = new Map();
        const superPacGums = new Map();

        if (Array.isArray(collectibles.pacGums)) {
            for (const cell of collectibles.pacGums) {
                if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
                    continue;
                }
                const normalized = { x: cell.x, y: cell.y };
                pacGums.set(this.getCellKey(normalized), normalized);
            }
        }

        if (Array.isArray(collectibles.superPacGums)) {
            for (const cell of collectibles.superPacGums) {
                if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
                    continue;
                }
                const normalized = { x: cell.x, y: cell.y };
                const key = this.getCellKey(normalized);
                if (pacGums.has(key)) {
                    superPacGums.set(key, normalized);
                }
            }
        }

        return { pacGums, superPacGums };
    }

    buildDefaultCollectiblesFromLogicResult(logicResult) {
        const pacGums = new Map();
        const superPacGums = new Map();

        if (!logicResult || !Array.isArray(logicResult.grid)) {
            return { pacGums, superPacGums };
        }

        const occupied = new Set();
        for (const cell of [logicResult.p1, logicResult.p2, logicResult.door, logicResult.bh1, logicResult.bh2]) {
            if (cell && Number.isInteger(cell.x) && Number.isInteger(cell.y)) {
                occupied.add(this.getCellKey(cell));
            }
        }

        const freeCells = [];
        for (let y = 0; y < logicResult.rows; y += 1) {
            for (let x = 0; x < logicResult.cols; x += 1) {
                if (logicResult.grid?.[y]?.[x] === 0) {
                    const cell = { x, y };
                    freeCells.push(cell);
                    if (!occupied.has(this.getCellKey(cell))) {
                        pacGums.set(this.getCellKey(cell), cell);
                    }
                }
            }
        }

        const shuffledFreeCells = freeCells
            .filter((cell) => !occupied.has(this.getCellKey(cell)))
            .sort(() => Math.random() - 0.5);
        const superCount = Math.min(shuffledFreeCells.length, 1 + Math.floor(Math.random() * 3));
        for (const cell of shuffledFreeCells.slice(0, superCount)) {
            superPacGums.set(this.getCellKey(cell), cell);
        }

        return { pacGums, superPacGums };
    }

    syncPlayerBonusVisualState() {
        if (this.player) {
            this.player.setBonusActive(this.isBonusActive || this.collectibleBonusActive);
        }
    }

    reset_stats() {
        if (this.collectibleBonusSpeedBase !== null && this.player) {
            this.player.speed = this.collectibleBonusSpeedBase;
        }
        if (this.baseVisionRadiusWorld !== null && this.baseVisionRadiusWorld !== undefined) {
            this.visionRadiusWorld = this.baseVisionRadiusWorld;
        }
        this.collectibleBonusActive = false;
        this.collectibleBonusRemainingSeconds = 0;
        this.collectibleBonusDurationSeconds = 0;
        this.collectibleBonusType = null;
        this.collectibleBonusSpeedBase = null;
        this.collectibleBonusVisionBase = null;
        this.collectibleTrailActive = false;
        this.syncPlayerBonusVisualState();
    }

    applyCollectibleBonusEffect() {
        if (!this.player || !this.collectibleBonusActive) {
            return;
        }

        if (this.collectibleBonusType === "speed" && this.collectibleBonusSpeedBase !== null) {
            this.player.speed = this.collectibleBonusSpeedBase * 1.5;
        } else if (this.collectibleBonusType === "vision") {
            const baseVision = this.baseVisionRadiusWorld ?? this.visionRadiusWorld;
            this.visionRadiusWorld = baseVision * 1.5;
        } else if (this.collectibleBonusType === "malus") {
            const baseVision = this.baseVisionRadiusWorld ?? this.visionRadiusWorld;
            this.visionRadiusWorld = Math.max(this.tileSize * 1.2, baseVision * 0.6);
        } else if (this.collectibleBonusType === "trail") {
            this.collectibleTrailActive = true;
            this.visionRadiusWorld = this.baseVisionRadiusWorld ?? this.visionRadiusWorld;
        } else {
            this.visionRadiusWorld = this.baseVisionRadiusWorld ?? this.visionRadiusWorld;
        }

        this.syncPlayerBonusVisualState();
    }

    startRandomCollectibleBonus() {
        if (!this.player || this.collectibleBonusActive || !this.superPacInventory) {
            return false;
        }

        this.collectibleBonusType = ["speed", "vision", "malus", "trail"][Math.floor(Math.random() * 4)];
        this.collectibleBonusDurationSeconds = Math.random() < 0.5 ? 5 : 10;
        this.collectibleBonusRemainingSeconds = this.collectibleBonusDurationSeconds;
        this.collectibleBonusSpeedBase = this.player.speed;
        this.collectibleBonusVisionBase = this.baseVisionRadiusWorld ?? this.visionRadiusWorld;
        this.collectibleBonusActive = true;
        this.superPacInventory = null;
        this.applyCollectibleBonusEffect();
        return true;
    }

    updateCollectibleBonusClock(deltaSeconds) {
        if (!this.collectibleBonusActive) {
            return;
        }

        this.collectibleBonusRemainingSeconds = Math.max(0, this.collectibleBonusRemainingSeconds - deltaSeconds);
        if (this.collectibleBonusRemainingSeconds <= 0) {
            this.reset_stats();
        }
    }

    collectPickupsAtPlayer() {
        if (!this.player || !this.maze) {
            return;
        }

        const cell = this.getPlayerCell();
        const key = this.getCellKey(cell);

        if (this.collectibles.superPacGums.has(key)) {
            if (this.superPacInventory === null) {
                this.superPacInventory = this.collectibles.superPacGums.get(key);
                this.collectibles.superPacGums.delete(key);
                this.collectibles.pacGums.delete(key);
            }
            return;
        }

        if (this.collectibles.pacGums.has(key)) {
            this.collectibles.pacGums.delete(key);
        }
    }

    useStoredSuperPacGum() {
        return this.startRandomCollectibleBonus();
    }

    getBlackHoleShakeOffsets() {
        if (!this.isBonusActive || !this.blackHole) {
            return { x: 0, y: 0, intensity: 0 };
        }

        const bonusProgress = 1 - this.bonusRemainingSeconds / this.bonusDurationSeconds;
        const urgency = 0.55 + 0.45 * this.easeInOutCubic(Math.max(0, Math.min(1, bonusProgress)));
        const amplitude = this.tileSize * (0.015 + 0.11 * urgency);
        const frequency = 14 + urgency * 20 + this.pace * 0.12;
        const phase = this.fogTime * frequency;
        const holeAnchorX = this.blackHole.x * 0.012;
        const holeAnchorY = this.blackHole.y * 0.009;

        return {
            intensity: urgency,
            x: Math.sin(phase + holeAnchorX) * amplitude,
            y: Math.cos(phase * 1.29 + holeAnchorY) * amplitude * 0.84
        };
    }

    formatSeconds(totalSeconds) {
        const total = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    findPathToPlayer(startCell, targetCell) {
        if (!this.maze) {
            return null;
        }
        if (startCell.x === targetCell.x && startCell.y === targetCell.y) {
            return [startCell];
        }

        const queue = [startCell];
        const visited = new Set([`${startCell.x},${startCell.y}`]);
        const previous = new Map();
        let found = false;

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                break;
            }
            if (current.x === targetCell.x && current.y === targetCell.y) {
                found = true;
                break;
            }

            const options = this.getAvailableGhostDirections(current.x, current.y);
            for (const dir of options) {
                const nextX = current.x + dir.x;
                const nextY = current.y + dir.y;
                const key = `${nextX},${nextY}`;
                if (visited.has(key)) {
                    continue;
                }
                visited.add(key);
                previous.set(key, current);
                queue.push({ x: nextX, y: nextY });
            }
        }

        if (!found) {
            return null;
        }

        const path = [{ x: targetCell.x, y: targetCell.y }];
        let cursor = previous.get(`${targetCell.x},${targetCell.y}`);
        while (cursor) {
            path.push(cursor);
            if (cursor.x === startCell.x && cursor.y === startCell.y) {
                break;
            }
            cursor = previous.get(`${cursor.x},${cursor.y}`);
        }

        const last = path[path.length - 1];
        if (!last || last.x !== startCell.x || last.y !== startCell.y) {
            return null;
        }

        return path.reverse();
    }

    isBlackHolePositionValid(nextX, nextY) {
        if (!this.maze) {
            return false;
        }
        return !this.maze.isWallAtPixel(nextX, nextY, this.getBlackHoleMovementCollisionRadius(this.blackHole));
    }

    getBlackHoleMovementCollisionRadius(blackHole) {
        if (Number.isFinite(blackHole?._movementCollisionRadius) && blackHole._movementCollisionRadius > 0) {
            return blackHole._movementCollisionRadius;
        }

        if (Number.isFinite(blackHole?.radius) && blackHole.radius > 0) {
            return Math.max(this.tileSize * 0.3, blackHole.radius * 0.28);
        }

        return Math.max(this.tileSize * 0.3, this.blackHoleCollisionRadius || 0);
    }

    updateBlackHoleGhostMovement(deltaSeconds) {
        if (!this.blackHole || !this.maze || !this.player) return;

        const allPairs = [];
        const localId = Number(this.localPlayerId);
        if (!this.isMultiplayer || !this.isLocalPlayerAbsorbed()) {
            allPairs.push({ bh: this.blackHole, p: this.player });
        } else {
            let localTarget = this.getNearestAbsorbedBlackHoleTarget(localId, this.blackHole);
            if (
                !localTarget &&
                this.isValidBlackHoleTargetPosition(this.blackHole?._lastKnownTarget?.x, this.blackHole?._lastKnownTarget?.y)
            ) {
                localTarget = {
                    x: this.blackHole._lastKnownTarget.x,
                    y: this.blackHole._lastKnownTarget.y,
                };
            }
            if (localTarget) {
                this.blackHole._lastKnownTarget = { x: localTarget.x, y: localTarget.y };
                allPairs.push({ bh: this.blackHole, p: localTarget });
            }
        }

        if (this.isMultiplayer && this.remoteBlackHoles && this.remotePlayers) {
            for (const [id, rBh] of this.remoteBlackHoles.entries()) {
                const isAbsorbed = this.isRemotePlayerAbsorbed(id);
                let targetPlayer = null;

                if (!isAbsorbed) {
                    targetPlayer = this.getNearestLivingPlayerTarget(id, rBh);

                    if (!targetPlayer) {
                        targetPlayer = this.player;
                    } else {
                        const distToTarget = Math.hypot(targetPlayer.x - rBh.x, targetPlayer.y - rBh.y);
                        if (distToTarget < this.tileSize * 0.8) {
                            targetPlayer = this.player;
                        }
                    }
                } else {
                    if (!Number.isFinite(Number(rBh?._absorptionStartedAt))) {
                        rBh._absorptionStartedAt = this.fogTime;
                    }
                    targetPlayer = this.getNearestAbsorbedBlackHoleTarget(id, rBh);
                    if (
                        !targetPlayer &&
                        this.isValidBlackHoleTargetPosition(rBh?._lastKnownTarget?.x, rBh?._lastKnownTarget?.y)
                    ) {
                        targetPlayer = {
                            x: rBh._lastKnownTarget.x,
                            y: rBh._lastKnownTarget.y,
                        };
                    }
                }

                if (targetPlayer) {
                    rBh._lastKnownTarget = { x: targetPlayer.x, y: targetPlayer.y };
                    allPairs.push({ bh: rBh, p: targetPlayer });
                }
            }
        }

        const getCell = (gx, gy) => ({
            x: Math.max(0, Math.min(this.maze.cols - 1, Math.floor(gx / this.tileSize))),
            y: Math.max(0, Math.min(this.maze.rows - 1, Math.floor(gy / this.tileSize)))
        });

        const speed = this.tileSize * (1.55 + this.pace * 0.05);
        const originalRemaining = speed * deltaSeconds;

        for (const pair of allPairs) {
            const bh = pair.bh;
            const targetP = pair.p;
            const colRad = this.getBlackHoleMovementCollisionRadius(bh);

            const playerCell = getCell(targetP.x, targetP.y);
            const playerCellKey = `${playerCell.x},${playerCell.y}`;

            if (playerCellKey !== bh._lastTargetCellKey) {
                bh._lastTargetCellKey = playerCellKey;
                bh._ghostTargetCell = null;
                bh._ghostTargetPoint = null;
            }

            let remaining = originalRemaining;
            let guard = 0;

            while (remaining > 0.0001 && guard < 8) {
                if (!bh._ghostTargetPoint || !bh._ghostTargetCell) {
                    const startCell = getCell(bh.x, bh.y);
                    const path = this.findPathToPlayer(startCell, playerCell);

                    if (!path || path.length <= 1) {
                        const playerPos = this.getCellCenter(playerCell.x, playerCell.y);
                        const toPX = playerPos.x - bh.x;
                        const toPY = playerPos.y - bh.y;
                        const d = Math.hypot(toPX, toPY);
                        if (d > 0.0001) {
                            const fallbackStep = Math.min(remaining, Math.min(d, this.tileSize * 0.6));
                            const nextX = bh.x + (toPX / d) * fallbackStep;
                            const nextY = bh.y + (toPY / d) * fallbackStep;
                            if (!this.maze.isWallAtPixel(nextX, nextY, colRad)) {
                                bh.x = nextX;
                                bh.y = nextY;
                                remaining -= fallbackStep;
                            } else {
                                const c = getCell(bh.x, bh.y);
                                const center = this.getCellCenter(c.x, c.y);
                                bh.x = center.x;
                                bh.y = center.y;
                                remaining = 0;
                            }
                        } else {
                            remaining = 0;
                        }
                        break;
                    }
                    const nextCell = path[1];
                    bh._ghostTargetCell = nextCell;
                    bh._ghostTargetPoint = this.getCellCenter(nextCell.x, nextCell.y);
                }

                const toX = bh._ghostTargetPoint.x - bh.x;
                const toY = bh._ghostTargetPoint.y - bh.y;
                const distance = Math.hypot(toX, toY);

                if (distance <= 0.0001) {
                    bh.x = bh._ghostTargetPoint.x;
                    bh.y = bh._ghostTargetPoint.y;
                    bh._ghostTargetCell = null;
                    bh._ghostTargetPoint = null;
                    guard += 1;
                    continue;
                }

                const step = Math.min(remaining, distance);
                const nextX = bh.x + (toX / distance) * step;
                const nextY = bh.y + (toY / distance) * step;

                if (this.maze.isWallAtPixel(nextX, nextY, colRad)) {
                    let moved = false;
                    const scales = [0.9, 0.7, 0.5, 0.3];
                    for (let s = 0; s < scales.length; s++) {
                        const ok = !this.maze.isWallAtPixel(nextX, nextY, colRad * scales[s]);
                        if (ok) {
                            bh.x = nextX;
                            bh.y = nextY;
                            remaining -= step;
                            moved = true;
                            break;
                        }
                    }

                    if (moved) {
                        if (step >= distance - 0.0001) {
                            bh.x = bh._ghostTargetPoint.x;
                            bh.y = bh._ghostTargetPoint.y;
                            bh._ghostTargetCell = null;
                            bh._ghostTargetPoint = null;
                            guard += 1;
                        }
                        continue;
                    }

                    const c = getCell(bh.x, bh.y);
                    const center = this.getCellCenter(c.x, c.y);
                    bh.x = center.x;
                    bh.y = center.y;
                    bh._ghostTargetCell = null;
                    bh._ghostTargetPoint = null;
                    guard += 1;
                    continue;
                }

                bh.x = nextX;
                bh.y = nextY;
                remaining -= step;

                if (step >= distance - 0.0001) {
                    bh.x = bh._ghostTargetPoint.x;
                    bh.y = bh._ghostTargetPoint.y;
                    bh._ghostTargetCell = null;
                    bh._ghostTargetPoint = null;
                    guard += 1;
                }
            }

        }
    }

    getOddAtMostViewport(value, minimum = 9) {
        let candidate = Math.max(minimum, Math.floor(value));
        if (candidate % 2 === 0) {
            candidate -= 1;
        }
        if (candidate < minimum) {
            candidate = minimum;
        }
        if (candidate % 2 === 0) {
            candidate += 1;
        }
        return candidate;
    }

    fitMazeToInterface() {
        if (!this.maze) {
            return;
        }

        const camera = this.game.camera;
        const fitZoom = Math.min(
            camera.viewportWidth / this.maze.worldWidth,
            camera.viewportHeight / this.maze.worldHeight
        );

        if (Number.isFinite(fitZoom) && fitZoom > 0) {
            camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, fitZoom));
        }

        camera.x = (this.maze.worldWidth - camera.viewWidthWorld) * 0.5;
        camera.y = (this.maze.worldHeight - camera.viewHeightWorld) * 0.5;
        camera.clampToWorld();
    }

    setupPauseUi() {
        if (this.pauseUiBound) {
            return;
        }
        this.pauseOverlayElement = document.getElementById("pauseOverlay");
        this.topTimeElement = document.getElementById("top-time");
        this.topPaceElement = document.getElementById("top-pace");
        this.topEvaluationPointsElement = document.getElementById("top-evaluation-points");
        this.topStageElement = document.getElementById("top-stage");
        this.topBonusButton = document.getElementById("top-bonus-btn");
        this.pauseToggleButton = document.getElementById("pause-toggle-btn");
        this.pauseRestartButton = document.getElementById("pause-restart-btn");
        this.pauseQuitButton = document.getElementById("pause-quit-btn");

        if (!this.pauseOverlayElement || !this.pauseToggleButton || !this.pauseRestartButton || !this.pauseQuitButton) {
            return;
        }

        this.boundTogglePauseFromUi = () => {
            this.togglePause();
        };
        this.boundRestartFromPause = () => {
            this.setPaused(false);
            if (this.isMultiplayer) {
                window.location.href = buildRestartPath();
                return;
            }
            this.game.sceneManager?.setScene("game");
        };
        this.boundQuitFromPause = () => {
            this.setPaused(false);
            if (this.onQuit) {
                this.onQuit();
                return;
            }
            this.game.sceneManager?.setScene("game");
        };

        this.pauseToggleButton.addEventListener("click", this.boundTogglePauseFromUi);
        this.pauseRestartButton.addEventListener("click", this.boundRestartFromPause);
        this.pauseQuitButton.addEventListener("click", this.boundQuitFromPause);
        this.pauseUiBound = true;
    }

    setPaused(value) {
        const nextPaused = value === true;
        this.isPaused = nextPaused;

        if (!this.pauseOverlayElement) {
            return;
        }

        this.pauseOverlayElement.classList.toggle("is-open", nextPaused);
        this.pauseOverlayElement.setAttribute("aria-hidden", "false");
        if (this.pauseToggleButton) {
            if (nextPaused) {
                this.pauseToggleButton.textContent = "Reprendre";
            } else {
                this.pauseToggleButton.textContent = "Pause";
            }
            if (nextPaused) {
                this.pauseToggleButton.setAttribute("aria-pressed", "true");
            } else {
                this.pauseToggleButton.setAttribute("aria-pressed", "false");
            }
        }
    }

    updateTopHud() {
        if (this.topTimeElement) {
            this.topTimeElement.textContent = this.formatSeconds(this.getTotalElapsedSeconds());
        }
        if (this.topPaceElement) {
            let paceData;
            if (this.paceTable && this.paceTable.length > 0) {
                paceData = this.getCurrentPaceData();
            } else {
                paceData = { label: String(this.pace) };
            }
            this.topPaceElement.textContent = String(paceData?.label ?? this.pace);
        }
        if (this.topStageElement) {
            let d = "Medium";
            if (this.difficulty === "facile") {
                d = "Easy";
            } else if (this.difficulty === "moyen") {
                d = "Medium";
            } else if (this.difficulty === "difficile") {
                d = "Hard";
            } else if (typeof this.difficulty === "string" && this.difficulty.trim()) {
                d = this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
            }
            this.topStageElement.textContent = `${d} · Stage ${this.stage}/100`;
        }
        if (this.topEvaluationPointsElement) {
            this.topEvaluationPointsElement.textContent = String(Math.trunc(Number(this.walletBalance) || 0));
        }
        if (this.topBonusButton) {
            this.topBonusButton.classList.remove("is-waiting", "is-active", "is-consumed");
            if (this.waitingForMatch) {
                this.topBonusButton.textContent = "Matchmaking...";
                this.topBonusButton.classList.add("is-waiting");
                return;
            }
            if (this.isBonusActive) {
                this.topBonusButton.textContent = `Bonus ${this.formatSeconds(this.bonusRemainingSeconds)}`;
                this.topBonusButton.classList.add("is-active");
                return;
            }
            if (this.hasAwardedPaceBonus) {
                this.topBonusButton.textContent = "Bonus used";
                this.topBonusButton.classList.add("is-consumed");
                return;
            }
            this.topBonusButton.textContent = `Bonus ${this.formatSeconds(this.bonusDurationSeconds)}`;
            this.topBonusButton.classList.add("is-waiting");
        }
    }

    updateEvaluationPoints() {
        if (!this.hasReachedExit) {
            this.evaluationPoints = 0;
            return;
        }
        if (this.finalEvaluationPoints !== null) {
            this.evaluationPoints = this.finalEvaluationPoints;
            return;
        }
        this.evaluationPoints = this.calculateEvaluationPoints("victory");
        this.finalEvaluationPoints = this.evaluationPoints;
    }

    getApiBase() {
        return getApiBase();
    }

    setWalletBalance(value) {
        this.walletBalance = Math.trunc(Number(value) || 0);
        storeCachedWalletBalance(this.walletBalance);

        const localId = Number(this.localPlayerId);
        if (Number.isFinite(localId) && localId > 0 && this.playersMeta instanceof Map) {
            const previous = this.playersMeta.get(localId);
            if (previous) {
                this.playersMeta.set(localId, {
                    ...previous,
                    evaluation_points: this.walletBalance,
                });
            }
        }

        this.updateTopHud();
        this.updateMultiplayerPlayersHud();
    }

    async hydrateWalletBalance() {
        if (this.walletHydrationRequest) {
            return this.walletHydrationRequest;
        }

        const headers = this.buildAuthHeaders();
        this.walletHydrationRequest = (async () => {
            try {
                const response = await fetch(this.resolveApiUrl("/api/wallet"), {
                    credentials: "include",
                    headers,
                });
                if (!response.ok) {
                    return null;
                }
                const payload = await response.json();
                this.setWalletBalance(payload?.total_evaluation_points);
                return payload;
            } catch (error) {
                console.warn("Failed to hydrate wallet balance", error);
                return null;
            } finally {
                this.walletHydrationRequest = null;
            }
        })();

        return this.walletHydrationRequest;
    }

    getDisplayedPlayerIds() {
        const localId = Number(this.localPlayerId);
        const playerIdsToDisplay = [];
        const seenIds = new Set();

        const pushId = (candidate) => {
            const id = Number(candidate);
            if (!Number.isFinite(id) || id <= 0) return;
            if (seenIds.has(id) || !this.playersMeta.has(id)) return;
            seenIds.add(id);
            playerIdsToDisplay.push(id);
        };

        pushId(localId);
        for (const id of this.playerIds) {
            pushId(id);
        }
        for (const id of this.playersMeta.keys()) {
            pushId(id);
        }

        return playerIdsToDisplay;
    }

    getProjectedWalletBalance(result, confirmedWalletBalance = null, baseWalletBalance = null) {
        const confirmed = Number(confirmedWalletBalance);
        if (Number.isFinite(confirmed)) {
            return Math.trunc(confirmed);
        }
        const baseWallet = Number.isFinite(Number(baseWalletBalance))
            ? Number(baseWalletBalance)
            : (Number(this.walletBalance) || 0);
        return Math.trunc(baseWallet + this.calculateEvaluationPoints(result));
    }

    buildResultPlayers(result, confirmedWalletBalance = null, baseWalletBalance = null) {
        const localDelta = this.calculateEvaluationPoints(result);
        const localId = Number(this.localPlayerId);
        const playerIdsToDisplay = this.getDisplayedPlayerIds();

        if (!playerIdsToDisplay.length) {
            return [];
        }

        return playerIdsToDisplay.slice(0, 4).map((playerId) => {
            const meta = this.getPlayerMeta(playerId);
            const isLocal = playerId === localId;
            const beforePoints = Math.trunc(
                Number(
                    isLocal
                        ? (
                            Number.isFinite(Number(baseWalletBalance))
                                ? Number(baseWalletBalance)
                                : this.walletBalance
                        )
                        : meta?.evaluation_points
                ) || 0
            );
            let delta = 0;
            if (this.isMultiplayer) {
                if (isLocal) {
                    delta = localDelta;
                } else if (this.finalWinnerId === playerId) {
                    delta = 1;
                } else {
                    delta = -1;
                }
            } else if (isLocal) {
                delta = localDelta;
            }

            const afterPoints = isLocal
                ? this.getProjectedWalletBalance(result, confirmedWalletBalance, baseWalletBalance)
                : beforePoints + delta;

            return {
                id: playerId,
                username: meta?.username || `Player #${playerId}`,
                before_points: beforePoints,
                delta,
                after_points: afterPoints,
                is_local: isLocal,
            };
        });
    }

    buildResultSnapshot(result, responsePayload = null, baseWalletBalance = null) {
        const evaluationPoints = Number(
            responsePayload?.evaluation_points ?? this.calculateEvaluationPoints(result)
        ) || 0;
        const walletBalance = this.getProjectedWalletBalance(
            result,
            responsePayload?.wallet_balance,
            baseWalletBalance
        );

        return {
            result,
            is_multiplayer: this.isMultiplayer,
            evaluation_points: evaluationPoints,
            wallet_balance: walletBalance,
            unlocked_achievements: Array.isArray(responsePayload?.unlocked_achievements)
                ? [...responsePayload.unlocked_achievements]
                : [],
            difficulty: this.difficulty || "moyen",
            stage: normalizeStage(this.stage) || normalizeStage(this.level) || 1,
            time_ms: Math.max(0, Math.floor(this.getTotalElapsedSeconds() * 1000)),
            players: this.buildResultPlayers(result, responsePayload?.wallet_balance, baseWalletBalance),
            created_at: new Date().toISOString(),
        };
    }

    submitResult(result) {
        if (this.resultSubmitted) {
            return;
        }
        this.resultSubmitted = true;
        const paceData = this.getCurrentPaceData ? this.getCurrentPaceData() : null;
        const paceValue = Number.isFinite(paceData?.pace) ? paceData.pace : this.pace;
        const paceLabel = paceData?.label ?? String(paceValue ?? this.pace);
        const currentStage = normalizeStage(this.stage) || normalizeStage(this.level) || 1;
        const computedEvaluationPoints = this.calculateEvaluationPoints(result);
        const payload = {
            evaluation_points: computedEvaluationPoints,
            result,
            is_multiplayer: this.isMultiplayer,
            pace_value: Number.isFinite(paceValue) ? paceValue : null,
            pace_label: paceLabel,
            time_ms: Math.max(0, Math.floor(this.getTotalElapsedSeconds() * 1000)),
            level: this.level,
            difficulty: this.difficulty || "moyen",
            stage: currentStage
        };
        if (result === "victory") {
            queuePendingStageCompletion(payload);
        }

        const walletBalanceBeforeResult = Math.trunc(Number(this.walletBalance) || 0);
        saveLastResultSnapshot(this.buildResultSnapshot(result, null, walletBalanceBeforeResult));

        fetch(`${this.getApiBase()}/api/results`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
            keepalive: true
        }).then(async (response) => {
            if (!response.ok) {
                return null;
            }
            const responsePayload = await response.json();
            mergeLastResultSnapshot(
                this.buildResultSnapshot(result, responsePayload, walletBalanceBeforeResult)
            );
            this.setWalletBalance(responsePayload?.wallet_balance);
            return responsePayload;
        }).catch((error) => {
            console.warn("Result submission failed", error);
        });
    }

    maybeSendNetworkState(deltaSeconds) {
        if (!this.isMultiplayer || !this.sessionReady || !this.gameClient || !this.roomId || !this.player) {
            return;
        }
        if (!this.gameClient.isOpen) {
            return;
        }
        this.netSendAccumulator += deltaSeconds;
        if (this.netSendAccumulator < this.netSendInterval) {
            return;
        }
        this.netSendAccumulator = 0;
        this.gameClient.sendPlayerState({
            x: this.player.x,
            y: this.player.y,
            evaluation_points: this.evaluationPoints,
            level: this.level,
            time_ms: Math.floor(this.getTotalElapsedSeconds() * 1000),
            blackhole: this.blackHole
                ? {
                    x: this.blackHole.x,
                    y: this.blackHole.y,
                    radius: this.blackHole.radius
                }
                : null
        });
    }

    sendImmediateMultiplayerFinish() {
        if (!this.isMultiplayer || !this.sessionReady || !this.gameClient || !this.player) {
            return;
        }

        this.gameClient.sendPlayerFinished({
            x: this.player.x,
            y: this.player.y,
            evaluation_points: this.evaluationPoints,
            level: this.level,
            time_ms: Math.floor(this.getTotalElapsedSeconds() * 1000),
            blackhole: this.blackHole
                ? {
                    x: this.blackHole.x,
                    y: this.blackHole.y,
                    radius: this.blackHole.radius
                }
                : null
        });
    }

    sendImmediateMultiplayerAbsorption() {
        if (
            !this.isMultiplayer ||
            !this.sessionReady ||
            !this.gameClient ||
            !this.player ||
            this.multiplayerAbsorptionSent
        ) {
            return;
        }

        this.multiplayerAbsorptionSent = true;
        this.gameClient.sendPlayerAbsorbed({
            x: this.player.x,
            y: this.player.y,
            evaluation_points: this.evaluationPoints,
            level: this.level,
            time_ms: Math.floor(this.getTotalElapsedSeconds() * 1000),
            status: "absorbed",
            blackhole: this.blackHole
                ? {
                    x: this.blackHole.x,
                    y: this.blackHole.y,
                    radius: this.blackHole.radius
                }
                : null
        });
    }

    handleMultiplayerMatchResolved(snapshot) {
        if (!this.isMultiplayer || this.multiplayerFinishHandled) {
            return false;
        }

        const winnerId = Number(snapshot?.winner_id ?? snapshot?.winnerId);
        if (!Number.isFinite(winnerId) || winnerId <= 0) {
            return false;
        }
        this.finalWinnerId = winnerId;

        if (winnerId === Number(this.localPlayerId)) {
            this.hasReachedExit = true;
            if (this.finalEvaluationPoints === null) {
                this.finalEvaluationPoints = this.calculateEvaluationPoints("victory");
            }
            this.evaluationPoints = this.finalEvaluationPoints ?? 0;
            this.finishMultiplayerMatch("victory");
        } else {
            this.finishMultiplayerMatch("defeat");
        }

        return true;
    }

    finishMultiplayerMatch(result) {
        if (!this.isMultiplayer || this.multiplayerFinishHandled) {
            return;
        }

        this.multiplayerFinishHandled = true;
        this.finalEvaluationPoints = this.calculateEvaluationPoints(result);
        this.evaluationPoints = this.finalEvaluationPoints;
        this.setPaused(false);
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.absorbState = "idle";
        this.absorbProgress = 0;
        this.clearAbsorbNavigationTimeout();
        this.resetGravityDistortion();

        if (result === "victory") {
            this.recordHistory("victory");
            this.submitResult("victory");
            window.location.href = "/victory";
            return;
        }

        this.recordHistory("defeat");
        this.submitResult("defeat");
        window.location.href = "/gameover";
    }

    togglePause() {
        if (this.absorbState === "active" || this.levelClearState === "active") {
            return;
        }
        this.setPaused(!this.isPaused);
    }

    onResize() {
        this.fitMazeToInterface();
    }

    onExit() {
        this.setPaused(false);
        this.isBonusActive = false;
        this.hasAwardedPaceBonus = false;
        this.bonusRemainingSeconds = 0;
        this.bonusElapsedSeconds = 0;
        this.collectibles = {
            pacGums: new Map(),
            superPacGums: new Map()
        };
        this.superPacInventory = null;
        this.collectibleBonusActive = false;
        this.collectibleBonusRemainingSeconds = 0;
        this.collectibleBonusDurationSeconds = 0;
        this.collectibleBonusType = null;
        this.collectibleBonusSpeedBase = null;
        this.collectibleBonusVisionBase = null;
        this.collectibleTrailActive = false;
        this.evaluationPoints = 0;
        this.finalEvaluationPoints = null;
        if (this.player) {
            this.player.setBonusActive(false);
            this.player.destroy();
            this.player = null;
        }
        this.blackHole = null;
        this.blackHoleDirection = { x: 0, y: 0 };
        this.blackHoleTargetCell = null;
        this.blackHoleTargetPoint = null;
        this.lastPlayerCellKey = "";
        this.exit = null;
        this.maze = null;
        this.absorbState = "idle";
        this.absorbProgress = 0;
        this.absorbStart = null;
        this.absorbMessageProgress = 0;
        this.absorbStartRadius = 0;
        this.absorbTargetRadius = 0;
        this.clearAbsorbNavigationTimeout();
        this.resetGravityDistortion();
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.waitingForMatch = false;
        this.sessionReady = false;
        this.serverStartState = null;
        this.multiplayerFinishHandled = false;
        this.multiplayerAbsorptionSent = false;
        if (this.isMultiplayer && this.gameClient) {
            this.gameClient.leaveMatchmaking();
        }
        for (const player of this.remotePlayers.values()) {
            player.destroy();
        }
        this.remotePlayers.clear();
        this.remoteBlackHoles.clear();
    }

    bindMultiplayerHandlers() {
        if (!this.gameClient || this.multiplayerBound) {
            return;
        }
        this.gameClient.onMatchFound = (msg) => {
            this.startMultiplayerSession(msg);
        };
        this.gameClient.onStateUpdate = (msg) => {
            this.handleStateUpdate(msg);
        };
        this.gameClient.onClose = () => {
            if (!this.sessionReady) {
                this.waitingForMatch = true;
                this.updateTopHud();
            }
        };
        this.multiplayerBound = true;
    }


    startMultiplayerSession(session) {
        if (this.matchmakingTimeout) {
            clearTimeout(this.matchmakingTimeout);
            this.matchmakingTimeout = null;
        }

        if (!session) {
            return;
        }
        const roomId = session.room_id ?? session.roomId ?? this.roomId;
        let players;
        if (Array.isArray(session.players)) {
            players = session.players;
        } else {
            players = this.playerIds;
        }
        this.roomId = roomId;
        if (Array.isArray(players)) {
            this.playerIds = this.getNormalizedMultiplayerPlayerIds(players);
        } else {
            this.playerIds = this.getNormalizedMultiplayerPlayerIds(this.playerIds);
        }
        if (this.localPlayerId != null && !this.playerIds.includes(this.localPlayerId)) {
            this.playerIds.unshift(this.localPlayerId);
            this.playerIds = this.getNormalizedMultiplayerPlayerIds(this.playerIds);
        }
        if (typeof session.seed !== "undefined") {
            this.seed = session.seed;
        }
        if (typeof session.difficulty !== "undefined") {
            this.difficulty = session.difficulty;
        }
        if (typeof session.stage !== "undefined") {
            this.stage = normalizeStage(session.stage) || 1;
        }
        this.level = this.stage || 1;
        const sessionStartState = session.start_state ?? session.startState;
        if (sessionStartState && typeof sessionStartState === "object") {
            this.serverStartState = sessionStartState;
        }
        if (typeof session.tick_rate === "number") {
            this.tickRate = session.tick_rate;
        } else if (typeof session.tickRate === "number") {
            this.tickRate = session.tickRate;
        }
        this.netSendInterval = 1 / Math.max(1, this.tickRate);
        if (this.gameClient && this.roomId) {
            this.gameClient.setRoomId(this.roomId);
        }
        if (this.multiplayerStore) {
            this.multiplayerStore.localPlayerId = this.localPlayerId;
            this.multiplayerStore.roomId = this.roomId;
        }
        if (this.seed) {
            this.rng = createRng(this.seed);
        } else {
            this.rng = Math.random;
        }
        this.waitingForMatch = false;
        this.sessionReady = true;
        this.updateTopHud();
        this.createLevel();
    }

    handleStateUpdate(snapshot) {
        if (!snapshot) {
            return;
        }
        if (snapshot.players_order && this.playerIds.length === 0) {
            this.playerIds = this.getNormalizedMultiplayerPlayerIds(snapshot.players_order);
        }
        if (this.multiplayerStore) {
            this.multiplayerStore.applySnapshot(snapshot);
        }

        this.syncRemoteBlackHolesFromStore();

        if (snapshot.game_ended && this.handleMultiplayerMatchResolved(snapshot)) {
            return;
        }

        if (!this.multiplayerStore || !this.multiplayerStore.players) {
            return;
        }

        const localId = this.localPlayerId;
        const seen = new Set();
        let index = 0;
        for (const [id, data] of this.multiplayerStore.players.entries()) {
            if (id === localId) {
                continue;
            }
            seen.add(id);
            const player = this.ensureRemotePlayer(id, data, index);
            if (Number.isFinite(data.x)) {
                player.x = data.x;
            }
            if (Number.isFinite(data.y)) {
                player.y = data.y;
            }
            index += 1;
        }

        for (const [id, player] of this.remotePlayers.entries()) {
            if (!seen.has(id)) {
                player.destroy();
                this.remotePlayers.delete(id);
            }
        }
    }

    ensureRemotePlayer(playerId, data, index) {
        const existing = this.remotePlayers.get(playerId);
        if (existing) {
            return existing;
        }
        const palette = ["#7dd3fc", "#a78bfa", "#f472b6", "#facc15", "#34d399"];
        const fill = palette[index % palette.length];
        let spawnX;
        if (Number.isFinite(data?.x)) {
            spawnX = data.x;
        } else {
            spawnX = this.player?.x ?? 0;
        }
        let spawnY;
        if (Number.isFinite(data?.y)) {
            spawnY = data.y;
        } else {
            spawnY = this.player?.y ?? 0;
        }
        const player = new Player(spawnX, spawnY, this.remoteInput, {
            radius: this.tileSize * 0.22,
            speed: this.tileSize * 5.2,
            baseFillColor: fill,
            baseStrokeColor: "#0f172a",
            bonusFillColor: fill,
            bonusStrokeColor: "#0f172a"
        });
        this.remotePlayers.set(playerId, player);
        return player;
    }

    ensureRemoteBlackHole(playerId, data = null, options = {}) {
        const preservePosition = options?.preservePosition === true;
        const existing = this.remoteBlackHoles.get(playerId);
        const fallbackRadius = this.blackHole?.radius ?? this.tileSize * 2.2;
        const nextX = Number.isFinite(data?.x) ? data.x : (existing?.x ?? this.blackHole?.x ?? 0);
        const nextY = Number.isFinite(data?.y) ? data.y : (existing?.y ?? this.blackHole?.y ?? 0);
        const nextRadius = Number.isFinite(data?.radius) && data.radius > 0
            ? data.radius
            : fallbackRadius;
        const nextCollisionRadius = Math.max(this.tileSize * 0.3, nextRadius * 0.28);

        if (existing) {
            existing.setRadius(nextRadius);
            existing._movementCollisionRadius = nextCollisionRadius;
            existing.setPace(this.pace);

            const dx = Math.abs((existing._serverX ?? nextX) - nextX);
            const dy = Math.abs((existing._serverY ?? nextY) - nextY);

            if (!preservePosition && (!existing._serverX || dx > 0.01 || dy > 0.01)) {
                existing.x = nextX;
                existing.y = nextY;
                existing._serverX = nextX;
                existing._serverY = nextY;
            }

            return existing;
        }

        const hole = new BlackHole(nextX, nextY, nextRadius, this.pace);
        hole._movementCollisionRadius = nextCollisionRadius;
        hole._serverX = nextX;
        hole._serverY = nextY;
        this.remoteBlackHoles.set(playerId, hole);
        return hole;
    }

    syncRemoteBlackHolesFromStore() {
        if (!this.isMultiplayer || !this.multiplayerStore?.blackholes) {
            return;
        }

        const localId = Number(this.localPlayerId);
        const seen = new Set();

        for (const [rawId, data] of this.multiplayerStore.blackholes.entries()) {
            const playerId = Number(rawId);
            if (!Number.isFinite(playerId) || playerId <= 0 || playerId === localId) {
                continue;
            }
            if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) {
                continue;
            }
            seen.add(playerId);
            if (this.isRemotePlayerAbsorbed(playerId)) {
                const remoteHole = this.ensureRemoteBlackHole(playerId, data, { preservePosition: true });
                if (!Number.isFinite(remoteHole?._absorptionStartedAt)) {
                    remoteHole._absorptionStartedAt = this.fogTime;
                }
                continue;
            }
            const remoteHole = this.ensureRemoteBlackHole(playerId, data);
            if (remoteHole && Number.isFinite(remoteHole._absorptionStartedAt)) {
                delete remoteHole._absorptionStartedAt;
            }
        }

        for (const [playerId] of this.remoteBlackHoles.entries()) {
            if (!seen.has(playerId) && !this.isRemotePlayerAbsorbed(playerId)) {
                this.remoteBlackHoles.delete(playerId);
            }
        }
    }

    updateBlackHoleAnimations(deltaSeconds) {
        if (this.blackHole) {
            this.blackHole.update(deltaSeconds);
        }
        for (const remoteHole of this.remoteBlackHoles.values()) {
            remoteHole.setPace(this.pace);
            remoteHole.update(deltaSeconds);
        }
    }

    isRemotePlayerAbsorbed(playerId) {
        if (!this.multiplayerStore?.players) {
            return false;
        }
        const playerState = this.multiplayerStore.players.get(Number(playerId));
        return playerState?.status === "absorbed";
    }

    isLocalPlayerAbsorbed() {
        if (this.absorbState === "active") {
            return true;
        }
        if (!this.multiplayerStore?.players) {
            return false;
        }
        const playerState = this.multiplayerStore.players.get(Number(this.localPlayerId));
        return playerState?.status === "absorbed";
    }

    isValidBlackHoleTargetPosition(x, y) {
        return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0;
    }

    getBlackHoleTargetPosition(playerId) {
        const normalizedPlayerId = Number(playerId);
        if (!Number.isFinite(normalizedPlayerId) || normalizedPlayerId <= 0) {
            return null;
        }

        if (normalizedPlayerId === Number(this.localPlayerId)) {
            if (this.player && this.isValidBlackHoleTargetPosition(this.player.x, this.player.y)) {
                return { x: this.player.x, y: this.player.y };
            }
            return null;
        }

        const blackHoleTarget = this.multiplayerStore?.blackholeTargets?.get(normalizedPlayerId);
        if (this.isValidBlackHoleTargetPosition(blackHoleTarget?.x, blackHoleTarget?.y)) {
            return { x: blackHoleTarget.x, y: blackHoleTarget.y };
        }

        const remotePlayer = this.remotePlayers.get(normalizedPlayerId);
        if (this.isValidBlackHoleTargetPosition(remotePlayer?.x, remotePlayer?.y)) {
            return { x: remotePlayer.x, y: remotePlayer.y };
        }

        const playerState = this.multiplayerStore?.players?.get(normalizedPlayerId);
        if (this.isValidBlackHoleTargetPosition(playerState?.x, playerState?.y)) {
            return { x: playerState.x, y: playerState.y };
        }

        return null;
    }

    hasRemoteBlackHoleFinishedAbsorption(playerId, remoteHole) {
        const normalizedPlayerId = Number(playerId);
        const localId = Number(this.localPlayerId);
        const isLocalBlackHole = Number.isFinite(localId) && normalizedPlayerId === localId;
        const isAbsorbed = isLocalBlackHole
            ? this.isLocalPlayerAbsorbed()
            : this.isRemotePlayerAbsorbed(playerId);

        if (!isAbsorbed) {
            return false;
        }

        if (isLocalBlackHole && this.absorbProgress >= 1) {
            return true;
        }

        if (!isLocalBlackHole && remoteHole && !Number.isFinite(Number(remoteHole._absorptionStartedAt))) {
            remoteHole._absorptionStartedAt = this.fogTime;
        }

        const startedAt = Number(remoteHole?._absorptionStartedAt);
        if (!Number.isFinite(startedAt)) {
            return false;
        }

        return this.fogTime - startedAt >= this.absorbDuration;
    }

    getAbsorbedBlackHoleTargets(excludedPlayerId = null) {
        const targets = [];
        const localId = Number(this.localPlayerId);
        const localState = this.multiplayerStore?.players?.get(localId);
        const isLocalAbsorbed = this.absorbState === "active" || localState?.status === "absorbed";

        if (
            !isLocalAbsorbed &&
            this.player &&
            Number.isFinite(this.player.x) &&
            Number.isFinite(this.player.y) &&
            localId !== Number(excludedPlayerId)
        ) {
            targets.push({ x: this.player.x, y: this.player.y });
        }

        if (this.multiplayerStore?.players) {
            for (const [rawPlayerId, playerState] of this.multiplayerStore.players.entries()) {
                const playerId = Number(rawPlayerId);
                if (!Number.isFinite(playerId) || playerId <= 0) {
                    continue;
                }
                if (playerId === localId || playerId === Number(excludedPlayerId)) {
                    continue;
                }
                if (!playerState || playerState.status === "absorbed" || playerState.status === "escaped") {
                    continue;
                }

                const target = this.getBlackHoleTargetPosition(playerId);
                if (!target) {
                    continue;
                }

                targets.push(target);
            }
        }

        // Fallback: in some snapshots, survivor states may be missing.
        // Keep absorbed blackholes moving by reusing visible remote player positions.
        if (this.remotePlayers && this.remotePlayers.size > 0) {
            for (const [rawPlayerId, remotePlayer] of this.remotePlayers.entries()) {
                const playerId = Number(rawPlayerId);
                if (!Number.isFinite(playerId) || playerId <= 0) {
                    continue;
                }
                if (playerId === localId || playerId === Number(excludedPlayerId)) {
                    continue;
                }
                if (this.isRemotePlayerAbsorbed(playerId)) {
                    continue;
                }
                if (!this.isValidBlackHoleTargetPosition(remotePlayer?.x, remotePlayer?.y)) {
                    continue;
                }
                const alreadyPresent = targets.some(
                    (entry) => Math.abs(entry.x - remotePlayer.x) < 0.001 && Math.abs(entry.y - remotePlayer.y) < 0.001
                );
                if (!alreadyPresent) {
                    targets.push({ x: remotePlayer.x, y: remotePlayer.y });
                }
            }
        }

        return targets;
    }

    getNearestAbsorbedBlackHoleTarget(excludedPlayerId, blackHole) {
        if (!blackHole) {
            return null;
        }

        let targetPlayer = null;
        let closestDistance = Infinity;

        for (const target of this.getAbsorbedBlackHoleTargets(excludedPlayerId)) {
            const d = Math.hypot(target.x - blackHole.x, target.y - blackHole.y);
            if (d < closestDistance) {
                closestDistance = d;
                targetPlayer = { x: target.x, y: target.y };
            }
        }

        return targetPlayer;
    }

    getNearestLivingPlayerTarget(excludedPlayerId, blackHole) {
        if (!blackHole) {
            return null;
        }

        let targetPlayer = null;
        let closestDistance = Infinity;

        for (const target of this.getAbsorbedBlackHoleTargets(excludedPlayerId)) {
            const d = Math.hypot(target.x - blackHole.x, target.y - blackHole.y);
            if (d < closestDistance) {
                closestDistance = d;
                targetPlayer = { x: target.x, y: target.y };
            }
        }

        return targetPlayer;
    }

    updateAbsorbedRemoteBlackHolePursuit(deltaSeconds) {
        if (!this.player || this.remoteBlackHoles.size === 0) {
            return;
        }

        const speed = this.tileSize * (1.35 + this.pace * 0.045);
        const maxStep = Math.max(0, speed * deltaSeconds);
        if (maxStep <= 0) {
            return;
        }

        for (const [playerId, remoteHole] of this.remoteBlackHoles.entries()) {
            if (!this.isRemotePlayerAbsorbed(playerId)) {
                continue;
            }
            if (!this.hasRemoteBlackHoleFinishedAbsorption(playerId, remoteHole)) {
                continue;
            }

            let targetX = null;
            let targetY = null;
            let closestDistance = Infinity;

            for (const target of this.getAbsorbedBlackHoleTargets(playerId)) {
                const d = Math.hypot(target.x - remoteHole.x, target.y - remoteHole.y);
                if (d < closestDistance) {
                    closestDistance = d;
                    targetX = target.x;
                    targetY = target.y;
                }
            }

            if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || closestDistance <= 0.0001) {
                continue;
            }

            const toX = targetX - remoteHole.x;
            const toY = targetY - remoteHole.y;

            const step = Math.min(maxStep, closestDistance);
            remoteHole.x += (toX / closestDistance) * step;
            remoteHole.y += (toY / closestDistance) * step;
        }
    }

    isCaughtByAnyBlackHole() {
        if (!this.player) {
            return false;
        }

        if (this.blackHole?.touchesEdge(this.player.x, this.player.y, this.player.radius)) {
            return true;
        }

        for (const remoteHole of this.remoteBlackHoles.values()) {
            if (remoteHole?.touchesEdge?.(this.player.x, this.player.y, this.player.radius)) {
                return true;
            }
        }

        return false;
    }

    update(deltaSeconds) {
        if (this.game.input?.consumePress && this.game.input.consumePress("Escape")) {
            this.togglePause();
        }
        if (this.game.input?.consumePress && this.game.input.consumePress("Space")) {
            this.useStoredSuperPacGum();
        }
        
        if (this.shouldFetchPlayersMetaFromRoom && this.shouldFetchPlayersMetaFromRoom()) {
            this.fetchPlayersMetaFromRoom();
        }

        this.updateEvaluationPoints();
        this.updateTopHud();
        if (this.waitingForMatch) {
            return;
        }
        if (this.isPaused) {
            return;
        }
        if (!this.blackHole || !this.maze || !this.player) {
            return;
        }

        if (this.levelClearState === "active") {
            this.updateBlackHoleAnimations(deltaSeconds);
            this.fogTime += deltaSeconds;
            this.levelClearTimer += deltaSeconds;
            this.updateBlackHoleGhostMovement(deltaSeconds);
            this.updateTopHud();

            if (this.levelClearTimer >= this.levelClearDuration) {
                this.advanceToNextLevel();
            }
            return;
        }

        if (this.absorbState === "active") {
            this.updateBlackHoleAnimations(deltaSeconds);
            this.fogTime += deltaSeconds;
            this.updateAbsorption(deltaSeconds);
            this.updateBlackHoleGhostMovement(deltaSeconds);
            return;
        }

        const cmToPx = (cm) => cm * 10;
        if (this.isBonusActive) {
            this.updateBonusClock(deltaSeconds);
        } else {
            this.paceTimer += deltaSeconds;
        }
        const paceData = this.getCurrentPaceData();

        const targetVisionRadius = cmToPx(paceData.visionCm);
        const targetHoleRadius = cmToPx(paceData.holeCm);
        this.baseVisionRadiusWorld = targetVisionRadius;
        if (
            paceData.pace !== this.pace ||
            (!this.collectibleBonusActive && Math.abs(this.visionRadiusWorld - targetVisionRadius) > 0.001)
        ) {
            this.pace = paceData.pace;
            if (!this.collectibleBonusActive) {
                this.visionRadiusWorld = targetVisionRadius;
            }
            this.blackHole.setRadius(targetHoleRadius);
            this.blackHole._movementCollisionRadius = Math.max(this.tileSize * 0.3, targetHoleRadius * 0.28);
            this.blackHole.setPace(this.pace);
            for (const remoteHole of this.remoteBlackHoles.values()) {
                remoteHole.setRadius(targetHoleRadius);
                remoteHole._movementCollisionRadius = Math.max(this.tileSize * 0.3, targetHoleRadius * 0.28);
                remoteHole.setPace(this.pace);
            }
            this.blackHoleCollisionRadius = this.blackHole._movementCollisionRadius;
        }
        if (!this.hasAwardedPaceBonus && this.isBonusPhaseReady()) {
            this.startPaceBonus();
        }
        if (this.collectibleBonusActive) {
            this.applyCollectibleBonusEffect();
        }
        this.collectPickupsAtPlayer();
        this.updateCollectibleBonusClock(deltaSeconds);
        this.updateTopHud();

        this.updateBlackHoleGhostMovement(deltaSeconds);

        this.updateBlackHoleAnimations(deltaSeconds);
        this.fogTime += deltaSeconds;

        if (this.getTotalElapsedSeconds() >= this.getEffectiveTimeLimitSeconds()) {
            this.startAbsorption();
        }

        if (this.absorbState === "active") {
            this.updateAbsorption(deltaSeconds);
            return;
        }

        const gravity = this.blackHole.getGravityForce(this.player.x, this.player.y, 34);
        this.player.x += gravity.fx * deltaSeconds;
        this.player.y += gravity.fy * deltaSeconds;
        this.player.update(deltaSeconds, this.maze);
        this.maybeSendNetworkState(deltaSeconds);

        if (
            this.exit &&
            this.getTotalElapsedSeconds() < this.getEffectiveTimeLimitSeconds() &&
            Math.hypot(this.player.x - this.exit.x, this.player.y - this.exit.y) <= this.tileSize * 0.45
        ) {
            this.startLevelClear();
            return;
        }

        if (this.isCaughtByAnyBlackHole()) {
            this.startAbsorption();
        }
    }

    advanceToNextLevel() {
        this.setPaused(false);
        this.level += 1;
        this.pace = 12;
        this.paceTimer = 0;
        this.isBonusActive = false;
        this.hasAwardedPaceBonus = false;
        this.bonusRemainingSeconds = 0;
        this.bonusElapsedSeconds = 0;
        this.collectibles = {
            pacGums: new Map(),
            superPacGums: new Map()
        };
        this.superPacInventory = null;
        this.collectibleBonusActive = false;
        this.collectibleBonusRemainingSeconds = 0;
        this.collectibleBonusDurationSeconds = 0;
        this.collectibleBonusType = null;
        this.collectibleBonusSpeedBase = null;
        this.collectibleBonusVisionBase = null;
        this.collectibleTrailActive = false;
        this.levelClearState = "idle";
        this.levelClearTimer = 0;
        this.createLevel();
    }

    startLevelClear() {
        if (this.levelClearState === "active" || this.absorbState === "active" || this.multiplayerFinishHandled) {
            return;
        }
        this.hasReachedExit = true;
        if (this.finalEvaluationPoints === null) {
            this.finalEvaluationPoints = this.calculateEvaluationPoints("victory");
        }
        this.evaluationPoints = this.finalEvaluationPoints ?? 0;
        if (this.isMultiplayer) {
            this.sendImmediateMultiplayerFinish();
            this.finishMultiplayerMatch("victory");
            return;
        }
        this.recordHistory("victory");
        this.submitResult("victory");
        window.location.href = "/victory";
        this.setPaused(false);
        this.levelClearState = "active";
        this.levelClearTimer = 0;
    }

    startAbsorption() {
        if (!this.player || !this.blackHole || this.absorbState === "active") {
            return;
        }
        this.isBonusActive = false;
        this.bonusRemainingSeconds = 0;
        this.reset_stats();
        this.superPacInventory = null;
        this.player.setBonusActive(false);
        this.setPaused(false);
        this.absorbState = "active";
        this.absorbProgress = 0;
        this.absorbMessageProgress = 0;
        this.absorbStart = {
            x: this.player.x,
            y: this.player.y
        };
        this.absorbStartRadius = this.blackHole.radius;
        this.absorbTargetRadius = Math.max(
            this.absorbStartRadius + this.tileSize * 1.4,
            this.getAbsorptionTargetRadius()
        );
        this.clearAbsorbNavigationTimeout();
        this.setGravityDistortionStrength(0);
        this.blackHole._absorptionStartedAt = this.fogTime;
        this.sendImmediateMultiplayerAbsorption();
    }

    updateAbsorption(deltaSeconds) {
        this.absorbProgress = Math.min(1, this.absorbProgress + deltaSeconds / this.absorbDuration);
        const growthT = this.easeInOutQuad(this.absorbProgress);

        if (this.blackHole) {
            const newRadius = this.absorbStartRadius + (this.absorbTargetRadius - this.absorbStartRadius) * growthT;
            this.blackHole.setRadius(newRadius);
            this.blackHoleCollisionRadius = this.getBlackHoleMovementCollisionRadius(this.blackHole);
        }

        if (this.absorbStart && this.player && this.blackHole) {
            const pullT = this.easeInCubic(this.absorbProgress);
            this.player.x = this.absorbStart.x + (this.blackHole.x - this.absorbStart.x) * pullT;
            this.player.y = this.absorbStart.y + (this.blackHole.y - this.absorbStart.y) * pullT;
        }
        this.setGravityDistortionStrength(this.absorbProgress);
        if (this.absorbProgress >= 1) {
            this.absorbMessageProgress = Math.min(
                1,
                this.absorbMessageProgress + deltaSeconds / this.absorbMessageDuration
            );
        }

        if (this.absorbProgress >= 1 && this.absorbNavigateTimeoutId === null) {
            this.absorbNavigateTimeoutId = setTimeout(() => {
                this.absorbNavigateTimeoutId = null;
                this.resetGravityDistortion();
                this.recordHistory("defeat");
                this.submitResult("defeat");
                window.location.href = "/gameover";
            }, this.absorbNavigateDelayMs);
        }
    }

    clearAbsorbNavigationTimeout() {
        if (this.absorbNavigateTimeoutId !== null) {
            clearTimeout(this.absorbNavigateTimeoutId);
            this.absorbNavigateTimeoutId = null;
        }
    }

    getAbsorptionTargetRadius() {
        if (!this.blackHole || !this.maze) {
            return this.blackHole?.radius ?? 0;
        }

        const corners = [
            { x: 0, y: 0 },
            { x: this.maze.worldWidth, y: 0 },
            { x: 0, y: this.maze.worldHeight },
            { x: this.maze.worldWidth, y: this.maze.worldHeight }
        ];
        let farthestDistance = 0;

        for (const corner of corners) {
            const distance = Math.hypot(corner.x - this.blackHole.x, corner.y - this.blackHole.y);
            if (distance > farthestDistance) {
                farthestDistance = distance;
            }
        }

        return farthestDistance + this.tileSize * 1.25;
    }

    calculateEvaluationPoints(result) {
        if (result === "victory") {
            return 1;
        }
        if (result === "defeat" && this.isMultiplayer) {
            return -1;
        }
        return 0;
    }

    recordHistory(result) {
        if (this.historyRecorded) {
            return;
        }
        this.historyRecorded = true;
        const paceData = this.getCurrentPaceData ? this.getCurrentPaceData() : null;
        const paceValue = Number.isFinite(paceData?.pace) ? paceData.pace : this.pace;
        const paceLabel = paceData?.label ?? String(paceValue ?? this.pace);
        const paceSuccess = result === "victory" ? paceValue : null;
        const paceFail = result === "defeat" ? paceValue : null;
        const evaluationPoints = this.calculateEvaluationPoints(result);
        const entry = {
            id: Date.now(),
            result,
            evaluation_points: evaluationPoints,
            wallet_balance: this.getProjectedWalletBalance(
                result,
                null,
                Number(this.walletBalance) || 0
            ),
            time_ms: Math.max(0, Math.floor(this.getTotalElapsedSeconds() * 1000)),
            level: this.level,
            stage: normalizeStage(this.stage) || normalizeStage(this.level) || 1,
            reached_exit: this.hasReachedExit,
            multiplayer: this.isMultiplayer,
            difficulty: this.difficulty || "moyen",
            pace_label: paceLabel,
            pace_value: paceValue,
            pace_success: paceSuccess,
            pace_fail: paceFail,
            created_at: new Date().toISOString()
        };
        const historyKey = "bh_history";
        try {
            const raw = localStorage.getItem(historyKey);
            const parsed = raw ? JSON.parse(raw) : [];
            const list = Array.isArray(parsed) ? parsed : [];
            list.unshift(entry);
            const trimmed = list.slice(0, 50);
            localStorage.setItem(historyKey, JSON.stringify(trimmed));
        } catch (error) {
            console.warn("Unable to store local history", error);
        }
    }

    ensureGravityDistortionElements() {
        if (!this.gravityCanvasElement || !this.gravityCanvasElement.isConnected) {
            this.gravityCanvasElement = document.getElementById("gameCanvas");
        }
        if (!this.gravityDisplacementElement || !this.gravityDisplacementElement.isConnected) {
            this.gravityDisplacementElement = document.querySelector("#grav-distort feDisplacementMap");
        }
        if (!this.gravityTurbulenceElement || !this.gravityTurbulenceElement.isConnected) {
            this.gravityTurbulenceElement = document.querySelector("#grav-distort feTurbulence");
        }

        if (this.gravityDisplacementElement && this.gravityDistortBaseScale === null) {
            const rawScale = Number(this.gravityDisplacementElement.getAttribute("scale"));
            if (Number.isFinite(rawScale)) {
                this.gravityDistortBaseScale = rawScale;
            } else {
                this.gravityDistortBaseScale = 8;
            }
        }
        if (this.gravityTurbulenceElement && this.gravityDistortBaseFrequency === null) {
            const rawFrequency = Number(this.gravityTurbulenceElement.getAttribute("baseFrequency"));
            if (Number.isFinite(rawFrequency)) {
                this.gravityDistortBaseFrequency = rawFrequency;
            } else {
                this.gravityDistortBaseFrequency = 0.008;
            }
        }
    }

    setGravityDistortionStrength(progress) {
        this.ensureGravityDistortionElements();
        const clamped = Math.max(0, Math.min(1, progress));
        const intensity = this.easeInOutCubic(clamped);

        if (this.gravityCanvasElement) {
            this.gravityCanvasElement.classList.add("gravity-distort");
        }
        if (this.gravityDisplacementElement) {
            const baseScale = this.gravityDistortBaseScale ?? 8;
            const boostedScale = baseScale + intensity * 22;
            this.gravityDisplacementElement.setAttribute("scale", boostedScale.toFixed(2));
        }
        if (this.gravityTurbulenceElement) {
            const baseFrequency = this.gravityDistortBaseFrequency ?? 0.008;
            const boostedFrequency = baseFrequency + intensity * 0.01;
            this.gravityTurbulenceElement.setAttribute("baseFrequency", boostedFrequency.toFixed(4));
        }
    }

    resetGravityDistortion() {
        this.ensureGravityDistortionElements();

        if (this.gravityCanvasElement) {
            this.gravityCanvasElement.classList.remove("gravity-distort");
        }
        if (this.gravityDisplacementElement && this.gravityDistortBaseScale !== null) {
            this.gravityDisplacementElement.setAttribute("scale", String(this.gravityDistortBaseScale));
        }
        if (this.gravityTurbulenceElement && this.gravityDistortBaseFrequency !== null) {
            this.gravityTurbulenceElement.setAttribute("baseFrequency", String(this.gravityDistortBaseFrequency));
        }
    }

    easeInCubic(value) {
        return value * value * value;
    }

    easeInOutCubic(value) {
        if (value < 0.5) {
            return 4 * value * value * value;
        }
        return 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    easeInOutQuad(value) {
        if (value < 0.5) {
            return 2 * value * value;
        }
        return 1 - Math.pow(-2 * value + 2, 2) / 2;
    }

    easeOutCubic(value) {
        return 1 - Math.pow(1 - value, 3);
    }

    render(ctx) {
        if (!this.maze || !this.blackHole || !this.player) {
            return;
        }
        const absorbCompleted = this.absorbState === "active" && this.absorbProgress >= 1;
        const spectatingAfterAbsorption = this.isMultiplayer && absorbCompleted;

        if (absorbCompleted && !spectatingAfterAbsorption) {
            const canvasWidth = this.game.canvas?.width ?? 0;
            const canvasHeight = this.game.canvas?.height ?? 0;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.restore();
            this.renderOutcomeMessage(ctx);
            return;
        }

        const centerX = this.maze.worldWidth * 0.5;
        const centerY = this.maze.worldHeight * 0.5;
        const baseGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            this.maze.worldWidth * 0.06,
            centerX,
            centerY,
            this.maze.worldWidth * 0.78
        );
        baseGradient.addColorStop(0, "#070707");
        baseGradient.addColorStop(0.54, "#020202");
        baseGradient.addColorStop(1, "#000000");
        ctx.fillStyle = baseGradient;
        ctx.fillRect(
            this.game.camera.x,
            this.game.camera.y,
            this.game.camera.viewWidthWorld,
            this.game.camera.viewHeightWorld
        );

        const shake = this.getBlackHoleShakeOffsets();
        let absorbT;
        if (this.absorbState === "active") {
            if (spectatingAfterAbsorption) {
                absorbT = 0;
            } else {
                absorbT = this.easeInOutCubic(this.absorbProgress);
            }
        } else {
            absorbT = 0;
        }
        let mazeScale;
        if (this.absorbState === "active") {
            mazeScale = Math.max(0.03, 1 - absorbT * 0.97);
        } else {
            mazeScale = 1;
        }
        let mazeAlpha;
        if (this.absorbState === "active") {
            mazeAlpha = Math.max(0.04, 1 - absorbT * 0.94);
        } else {
            mazeAlpha = 1;
        }

        ctx.save();
        if (shake.intensity > 0.0001) {
            ctx.translate(shake.x, shake.y);
        }

        ctx.save();
        if (this.absorbState === "active") {
            ctx.translate(this.blackHole.x, this.blackHole.y);
            ctx.scale(mazeScale, mazeScale);
            ctx.translate(-this.blackHole.x, -this.blackHole.y);
            ctx.globalAlpha = mazeAlpha;
        }

        this.maze.render(ctx, this.game.camera, this.fogTime + absorbT * 1.2);
        this.renderCollectibles(ctx);
        this.renderExitDoor(ctx);
        this.renderPlayer(ctx, absorbT);
        ctx.restore();

        if (this.absorbState !== "active") {
            this.renderVisionMask(ctx);
        }
        ctx.restore();

        this.renderOutcomeMessage(ctx);
    }

    renderCollectibles(ctx) {
        if (!this.maze) {
            return;
        }

        const size = this.tileSize;

        ctx.save();
        for (const cell of this.collectibles.pacGums.values()) {
            const x = cell.x * size + size * 0.5;
            const y = cell.y * size + size * 0.5;
            ctx.fillStyle = "rgba(255, 233, 140, 0.9)";
            ctx.beginPath();
            ctx.arc(x, y, Math.max(2.2, size * 0.08), 0, Math.PI * 2);
            ctx.fill();
        }

        for (const cell of this.collectibles.superPacGums.values()) {
            const x = cell.x * size + size * 0.5;
            const y = cell.y * size + size * 0.5;
            ctx.fillStyle = "rgba(190, 120, 255, 0.95)";
            ctx.beginPath();
            ctx.arc(x, y, Math.max(4.5, size * 0.16), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    renderOverlay(ctx) {
        if (!this.blackHole) return;
        const absorbCompleted = this.absorbState === "active" && this.absorbProgress >= 1;
        const spectatingAfterAbsorption = this.isMultiplayer && absorbCompleted;
        if (absorbCompleted && !spectatingAfterAbsorption) return;

        const isAbsorbing = this.absorbState === "active" && !spectatingAfterAbsorption;
        let overlayAlpha;
        if (spectatingAfterAbsorption) {
            overlayAlpha = 0.32;
        } else if (isAbsorbing) {
            overlayAlpha = 0.86;
        } else {
            overlayAlpha = 0.22;
        }

        ctx.save();
        ctx.globalAlpha = overlayAlpha;
        if (spectatingAfterAbsorption) {
            const originalRadius = this.blackHole.radius;
            const cappedRadius = Math.min(
                originalRadius,
                Math.max(this.tileSize * 2.2, this.absorbStartRadius * 1.35 || this.tileSize * 2.2)
            );
            if (typeof this.blackHole.setRadius === "function") {
                this.blackHole.setRadius(cappedRadius);
                this.blackHole.render(ctx);
                this.blackHole.setRadius(originalRadius);
            } else {
                this.blackHole.render(ctx);
            }
        } else {
            this.blackHole.render(ctx);
        }
        ctx.restore();

        if (!this.isMultiplayer) {
            return;
        }

        for (const remoteHole of this.remoteBlackHoles.values()) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, overlayAlpha * 0.94 + 0.04);
            remoteHole.render(ctx);
            ctx.restore();
        }
    }

    renderPlayer(ctx, absorbT = 0) {
        const absorbCompleted = this.absorbState === "active" && this.absorbProgress >= 1;
        let scale;
        if (this.absorbState === "active") {
            scale = Math.max(0.08, 1 - absorbT * 0.92);
        } else {
            scale = 1;
        }
        const renderOne = (player, isLocal = false) => {
            if (!player) {
                return;
            }
            if (isLocal && this.isMultiplayer && absorbCompleted) {
                return;
            }
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.scale(scale, scale);
            ctx.translate(-player.x, -player.y);
            player.render(ctx);
            ctx.restore();
        };
        renderOne(this.player, true);
        if (!this.isMultiplayer) {
            for (const remote of this.remotePlayers.values()) {
                renderOne(remote);
            }
        }
    }

    renderVisionMask(ctx) {
        if (!this.player || !this.maze) {
            return;
        }

        const camera = this.game.camera;
        const viewX = camera.x;
        const viewY = camera.y;
        const viewW = camera.viewWidthWorld;
        const viewH = camera.viewHeightWorld;
        const radius = Math.max(this.tileSize * 1.8, this.visionRadiusWorld);
        const visibleCells = this.getVisibleCellsInRadius(radius);

        ctx.save();
        ctx.beginPath();
        ctx.rect(viewX, viewY, viewW, viewH);
        for (const cell of visibleCells) {
            const x = cell.col * this.tileSize;
            const y = cell.row * this.tileSize;
            ctx.rect(x, y, this.tileSize, this.tileSize);
        }
        ctx.clip("evenodd");
        ctx.fillStyle = "rgba(0, 0, 0, 0.94)";
        ctx.fillRect(viewX, viewY, viewW, viewH);
        ctx.restore();
    }

    getVisibleCellsInRadius(radius) {
        if (!this.player || !this.maze) {
            return [];
        }

        const tileSize = this.tileSize;
        const maxCol = this.maze.cols - 1;
        const maxRow = this.maze.rows - 1;
        const playerCol = Math.floor(this.player.x / tileSize);
        const playerRow = Math.floor(this.player.y / tileSize);
        const radiusCells = Math.ceil(radius / tileSize);
        const minCol = Math.max(0, playerCol - radiusCells);
        const maxVisibleCol = Math.min(maxCol, playerCol + radiusCells);
        const minRow = Math.max(0, playerRow - radiusCells);
        const maxVisibleRow = Math.min(maxRow, playerRow + radiusCells);
        const visible = [];

        for (let row = minRow; row <= maxVisibleRow; row += 1) {
            for (let col = minCol; col <= maxVisibleCol; col += 1) {
                const centerX = (col + 0.5) * tileSize;
                const centerY = (row + 0.5) * tileSize;
                const dx = centerX - this.player.x;
                const dy = centerY - this.player.y;
                if (dx * dx + dy * dy > radius * radius) {
                    continue;
                }
                if (!this.hasDirectLineOfSightToCell(col, row)) {
                    continue;
                }
                visible.push({ col, row });
            }
        }

        if (!visible.some((cell) => cell.col === playerCol && cell.row === playerRow)) {
            visible.push({ col: playerCol, row: playerRow });
        }

        return visible;
    }

    hasDirectLineOfSightToCell(targetCol, targetRow) {
        if (!this.player || !this.maze) {
            return false;
        }

        if (targetCol < 0 || targetRow < 0 || targetCol >= this.maze.cols || targetRow >= this.maze.rows) {
            return false;
        }

        const tileSize = this.tileSize;
        const startX = this.player.x;
        const startY = this.player.y;
        const endX = (targetCol + 0.5) * tileSize;
        const endY = (targetRow + 0.5) * tileSize;
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.hypot(dx, dy);

        if (distance <= 0.0001) {
            return true;
        }

        const sampleStep = Math.max(3, tileSize * 0.2);
        const steps = Math.max(1, Math.ceil(distance / sampleStep));

        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const sampleX = startX + dx * t;
            const sampleY = startY + dy * t;
            const sampleCol = Math.floor(sampleX / tileSize);
            const sampleRow = Math.floor(sampleY / tileSize);

            if (sampleCol < 0 || sampleRow < 0 || sampleCol >= this.maze.cols || sampleRow >= this.maze.rows) {
                return false;
            }

            if (sampleCol === targetCol && sampleRow === targetRow) {
                return true;
            }

            if (this.maze.isWallAtCell(sampleCol, sampleRow)) {
                return false;
            }
        }

        return true;
    }

    renderOutcomeMessage(ctx) {
        let text = "";
        let textColor = "#ffffff";
        const absorbCompleted = this.absorbState === "active" && this.absorbProgress >= 1;

        if (absorbCompleted) {
            text = this.absorbedText;
            textColor = "#ffffff";
        } else if (this.levelClearState === "active") {
            text = this.escapedText;
            textColor = "#ffffff";
        }

        if (!text) {
            return;
        }

        const canvasWidth = this.game.canvas?.width ?? 0;
        const canvasHeight = this.game.canvas?.height ?? 0;
        if (canvasWidth <= 0 || canvasHeight <= 0) {
            return;
        }
        const x = canvasWidth * 0.5;
        const y = canvasHeight * 0.5;
        const lines = String(text).split("\n");
        let fontSize;
        if (absorbCompleted) {
            fontSize = Math.max(24, Math.min(48, canvasWidth * 0.06));
        } else {
            fontSize = Math.max(22, Math.min(34, canvasWidth * 0.05));
        }
        if (absorbCompleted) {
            const maxTextWidth = canvasWidth * 0.9;
            let fittedFontSize = fontSize;
            while (fittedFontSize > 18) {
                ctx.font = `900 ${fittedFontSize}px Space Grotesk, Rajdhani, sans-serif`;
                const widestLine = lines.reduce((maxWidth, line) => Math.max(maxWidth, ctx.measureText(line).width), 0);
                if (widestLine <= maxTextWidth) {
                    break;
                }
                fittedFontSize -= 1;
            }
            fontSize = fittedFontSize;
        }
        const lineHeight = fontSize * 1.1;
        const firstLineY = y - ((lines.length - 1) * lineHeight) * 0.5;
        let pulse;
        if (absorbCompleted) {
            pulse = 0.94 + 0.06 * Math.sin(this.fogTime * 8.2);
        } else {
            pulse = 0.9 + 0.1 * Math.sin(this.fogTime * 6.5);
        }
        let parallaxEase;
        if (absorbCompleted) {
            parallaxEase = this.easeOutCubic(Math.max(0, Math.min(1, this.absorbMessageProgress)));
        } else {
            parallaxEase = 0;
        }
        let settleFactor;
        if (absorbCompleted) {
            settleFactor = 1 - parallaxEase;
        } else {
            settleFactor = 0;
        }
        let moveBaseX;
        if (absorbCompleted) {
            moveBaseX = canvasWidth * 1.3 * settleFactor;
        } else {
            moveBaseX = 0;
        }
        let moveBaseY;
        if (absorbCompleted) {
            moveBaseY = canvasHeight * 0.86 * settleFactor;
        } else {
            moveBaseY = 0;
        }
        let driftX;
        if (absorbCompleted) {
            driftX = Math.sin(this.fogTime * 6.4) * settleFactor * Math.max(12, canvasWidth * 0.024);
        } else {
            driftX = 0;
        }
        let driftY;
        if (absorbCompleted) {
            driftY = Math.cos(this.fogTime * 5.1) * settleFactor * Math.max(10, canvasHeight * 0.02);
        } else {
            driftY = 0;
        }
        let revealAlpha;
        if (absorbCompleted) {
            revealAlpha = Math.min(1, 0.24 + parallaxEase * 0.76);
        } else {
            revealAlpha = 1;
        }
        let revealScale;
        if (absorbCompleted) {
            revealScale = 0.72 + parallaxEase * 0.28;
        } else {
            revealScale = 1;
        }
        let panelAlpha;
        if (absorbCompleted) {
            panelAlpha = settleFactor * 0.34;
        } else {
            panelAlpha = 0;
        }
        let ghostAlpha;
        if (absorbCompleted) {
            ghostAlpha = settleFactor * 0.38;
        } else {
            ghostAlpha = 0;
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (absorbCompleted && panelAlpha > 0.001) {
            const padY = Math.max(24, canvasHeight * 0.03);
            const panelWidth = Math.min(canvasWidth * 0.92, canvasWidth - 40);
            const panelHeight = lines.length * lineHeight + padY * 2;
            const panelX = x - panelWidth * 0.5;
            const panelY = y - panelHeight * 0.5;
            const radius = Math.min(26, panelHeight * 0.18);

            ctx.globalAlpha = panelAlpha;
            ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
            if (typeof ctx.roundRect === "function") {
                ctx.beginPath();
                ctx.roundRect(panelX, panelY, panelWidth, panelHeight, radius);
                ctx.fill();
            } else {
                ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
            }

            ctx.globalAlpha = panelAlpha;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
            if (typeof ctx.roundRect === "function") {
                ctx.beginPath();
                ctx.roundRect(panelX, panelY, panelWidth, panelHeight, radius);
                ctx.stroke();
            } else {
                ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
            }
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let fontWeight;
        if (absorbCompleted) {
            fontWeight = 900;
        } else {
            fontWeight = 700;
        }
        ctx.font = `${fontWeight} ${fontSize}px Space Grotesk, Rajdhani, sans-serif`;
        if (absorbCompleted) {
            ctx.lineWidth = 9;
        } else {
            ctx.lineWidth = 5;
        }
        if (absorbCompleted) {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.98)";
        } else {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        }
        if (absorbCompleted) {
            ctx.shadowColor = "rgba(255, 64, 64, 0.5)";
            ctx.shadowBlur = 18;
        }
        ctx.fillStyle = textColor;
        for (let i = 0; i < lines.length; i += 1) {
            const lineY = firstLineY + i * lineHeight;
            if (absorbCompleted && ghostAlpha > 0.001) {
                let direction;
                if (i % 2 === 0) {
                    direction = 1;
                } else {
                    direction = -1;
                }
                const backX = x + direction * moveBaseX * 0.62 + driftX * 0.8;
                const backY = lineY - direction * moveBaseY * 0.42 + driftY * 0.7;
                ctx.globalAlpha = ghostAlpha * revealAlpha;
                ctx.fillStyle = "rgba(255, 76, 76, 0.92)";
                ctx.fillText(lines[i], backX, backY);
            }

            let direction;
            if (i % 2 === 0) {
                direction = 1;
            } else {
                direction = -1;
            }
            const frontX = x + direction * moveBaseX + driftX;
            const frontY = lineY - direction * moveBaseY * 0.58 + driftY;
            ctx.fillStyle = textColor;
            ctx.save();
            ctx.translate(frontX, frontY);
            ctx.scale(revealScale, revealScale);
            ctx.globalAlpha = revealAlpha;
            ctx.strokeText(lines[i], 0, 0);
            ctx.globalAlpha = pulse * revealAlpha;
            ctx.fillText(lines[i], 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    renderExitDoor(ctx) {
        if (!this.exit || !this.maze) {
            return;
        }

        const baseSize = this.maze.tileSize * 0.78;
        const halfW = baseSize * 0.36;
        const halfH = baseSize * 0.48;
        const x = this.exit.x;
        const y = this.exit.y;
        const pulse = 0.92 + 0.08 * Math.sin(this.fogTime * 2.4);

        ctx.save();

        const glow = ctx.createRadialGradient(x, y, baseSize * 0.22, x, y, baseSize * 1.3);
        glow.addColorStop(0, "rgba(210, 210, 210, 0.24)");
        glow.addColorStop(0.6, "rgba(150, 150, 150, 0.12)");
        glow.addColorStop(1, "rgba(90, 90, 90, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, baseSize * 1.3 * pulse, 0, Math.PI * 2);
        ctx.fill();

        const frameGradient = ctx.createLinearGradient(x, y - halfH, x, y + halfH);
        frameGradient.addColorStop(0, "#c9c9c9");
        frameGradient.addColorStop(0.5, "#9a9a9a");
        frameGradient.addColorStop(1, "#5f5f5f");
        ctx.fillStyle = frameGradient;
        ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);

        const panelGradient = ctx.createLinearGradient(x - halfW * 0.65, y, x + halfW * 0.65, y);
        panelGradient.addColorStop(0, "#2b2b2b");
        panelGradient.addColorStop(0.5, "#5c5c5c");
        panelGradient.addColorStop(1, "#232323");
        ctx.fillStyle = panelGradient;
        ctx.fillRect(x - halfW * 0.65, y - halfH * 0.78, halfW * 1.3, halfH * 1.56);

        ctx.strokeStyle = "rgba(235, 235, 235, 0.42)";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x - halfW, y - halfH, halfW * 2, halfH * 2);

        ctx.restore();
    }

    escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    firstNonEmptyString(...values) {
        for (const value of values) {
            if (typeof value !== "string") {
                continue;
            }
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
        }
        return "";
    }

    readStoredUserId() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.userId);
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        } catch {
            return null;
        }
        return null;
    }

    readStoredUsername() {
        try {
            return this.firstNonEmptyString(
                localStorage.getItem(STORAGE_KEYS.username),
                localStorage.getItem(STORAGE_KEYS.sessionName)
            );
        } catch {
            return "";
        }
    }

    buildAuthHeaders() {
        const headers = {};
        const token = getStoredToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    resolveApiUrl(path = "") {
        const base = this.getApiBase();
        const normalizedPath = String(path || "");
        if (!normalizedPath) {
            return base;
        }
        if (normalizedPath.startsWith("/")) {
            return `${base}${normalizedPath}`;
        }
        return `${base}/${normalizedPath}`;
    }

    getDefaultAvatarUrl() {
        return DEFAULT_AVATAR_URL;
    }

    resolveAvatarUrl(avatarPath) {
        if (typeof avatarPath !== "string") {
            return this.getDefaultAvatarUrl();
        }

        const trimmed = avatarPath.trim();
        if (!trimmed) {
            return this.getDefaultAvatarUrl();
        }

        if (/^(?:https?:|data:)/i.test(trimmed)) {
            return trimmed;
        }

        const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
        return this.resolveApiUrl(normalized);
    }

    normalizePlayerMetaEntry(entry) {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const id = Number(
            entry.id
            ?? entry.user_id
            ?? entry.userId
            ?? entry.player_id
            ?? entry.playerId
            ?? entry.user?.id
            ?? entry.profile?.id
        );
        if (!Number.isFinite(id) || id <= 0) {
            return null;
        }

        const explicitUsername = this.firstNonEmptyString(
            entry.username,
            entry.user_name,
            entry.userName,
            entry.display_name,
            entry.displayName,
            entry.name,
            entry.user?.username,
            entry.user?.name,
            entry.profile?.username,
            entry.profile?.name
        );
        const avatar = this.firstNonEmptyString(
            entry.avatar,
            entry.avatar_url,
            entry.avatarUrl,
            entry.profile_avatar,
            entry.profileAvatar,
            entry.user?.avatar,
            entry.user?.avatar_url,
            entry.user?.avatarUrl,
            entry.profile?.avatar,
            entry.profile?.avatar_url,
            entry.profile?.avatarUrl
        ) || null;

        const evaluationPoints = Math.trunc(
            Number(
                entry.evaluation_points
                ?? entry.evaluationPoints
                ?? entry.wallet_points
                ?? entry.walletPoints
                ?? entry.profile?.evaluation_points
            ) || 0
        );

        return {
            id,
            username: explicitUsername || `Player #${id}`,
            avatar,
            evaluation_points: evaluationPoints,
            usernameIsExplicit: Boolean(explicitUsername),
        };
    }

    mergePlayerMetaEntry(previous, next) {
        const id = Number(next?.id ?? previous?.id);
        if (!Number.isFinite(id) || id <= 0) {
            return null;
        }

        const previousUsername = this.firstNonEmptyString(previous?.username);
        const nextUsername = this.firstNonEmptyString(next?.username);
        const usernameIsExplicit = Boolean(previous?.usernameIsExplicit || next?.usernameIsExplicit);

        let resolvedUsername = nextUsername;
        if (!next?.usernameIsExplicit && previousUsername) {
            resolvedUsername = previousUsername;
        }
        if (!resolvedUsername) {
            resolvedUsername = previousUsername || `Player #${id}`;
        }

        return {
            id,
            username: resolvedUsername,
            avatar: next?.avatar ?? previous?.avatar ?? null,
            evaluation_points: Math.trunc(
                Number(next?.evaluation_points ?? previous?.evaluation_points) || 0
            ),
            usernameIsExplicit,
        };
    }

    getPlayerMeta(playerId) {
        if (!this.playersMeta) {
            return null;
        }

        const id = Number(playerId);
        if (!Number.isFinite(id) || id <= 0) {
            return null;
        }

        const meta = this.playersMeta.get(id);
        if (!meta) {
            return null;
        }

        return {
            id: meta.id,
            username: meta.username,
            avatar: meta.avatar ?? null,
            evaluation_points: Math.trunc(Number(meta.evaluation_points) || 0),
        };
    }

    buildLocalPlayerMetaFallback() {
        const playerId = Number(this.localPlayerId ?? this.readStoredUserId() ?? 1);
        if (!Number.isFinite(playerId) || playerId <= 0) {
            return null;
        }

        const username = this.readStoredUsername();
        return {
            id: playerId,
            username: username || `Player #${playerId}`,
            avatar: null,
            evaluation_points: Math.trunc(Number(this.walletBalance) || 0),
            usernameIsExplicit: Boolean(username),
        };
    }

    bootstrapPlayersMeta() {
        if (!(this.playersMeta instanceof Map)) {
            this.playersMeta = new Map();
        }

        if (this.initialPlayersMeta.length > 0) {
            this.applyPlayersMeta(this.initialPlayersMeta);
        }

        const localFallback = this.buildLocalPlayerMetaFallback();
        if (localFallback) {
            this.applyPlayersMeta([localFallback]);
        }

        this.updateMultiplayerPlayersHud();
        this.fetchCurrentUserMeta();
    }

    async fetchCurrentUserMeta() {
        if (this.localPlayerMetaRequest) {
            return this.localPlayerMetaRequest;
        }

        const fallbackMeta = this.buildLocalPlayerMetaFallback();
        if (!fallbackMeta) {
            return null;
        }

        const headers = this.buildAuthHeaders();
        this.localPlayerMetaRequest = (async () => {
            try {
                const [userResponse, profileResponse] = await Promise.all([
                    fetch(this.resolveApiUrl("/auth/me"), {
                        credentials: "include",
                        headers,
                    }),
                    fetch(this.resolveApiUrl("/users/profiles/me"), {
                        credentials: "include",
                        headers,
                    }),
                ]);

                let userPayload = null;
                let profilePayload = null;

                if (userResponse.ok) {
                    userPayload = await userResponse.json();
                }
                if (profileResponse.ok) {
                    profilePayload = await profileResponse.json();
                }

                const playerId = Number(userPayload?.id ?? fallbackMeta.id);
                if (!Number.isFinite(playerId) || playerId <= 0) {
                    return null;
                }

                this.localPlayerId = playerId;
                this.applyPlayersMeta([
                    {
                        id: playerId,
                        username: this.firstNonEmptyString(
                            userPayload?.username,
                            fallbackMeta.username
                        ) || `Player #${playerId}`,
                        avatar: this.firstNonEmptyString(profilePayload?.avatar) || null,
                        evaluation_points: Number(profilePayload?.stats?.evaluation_points) || 0,
                    },
                ]);
            } catch (error) {
                console.warn("Failed to load current player meta", error);
            } finally {
                this.localPlayerMetaRequest = null;
            }
            return null;
        })();

        return this.localPlayerMetaRequest;
    }

    shouldFetchPlayersMetaFromRoom() {
        if (!this.isMultiplayer) return false;
        if (!this.roomId) return false;
        if (this.playersMetaRequestRoomId === this.roomId) return false;
        return true;
    }

    async fetchPlayersMetaFromRoom() {
        if (!this.roomId) return;
        this.playersMetaRequestRoomId = this.roomId;
        try {
            const res = await fetch(this.resolveApiUrl(`/api/rooms/${this.roomId}`), {
                credentials: "include",
                headers: this.buildAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.players_meta)) {
                    this.applyPlayersMeta(data.players_meta);
                }
            }
        } catch (e) {
            console.warn("Failed to fetch meta from room", e);
        }
    }

    applyPlayersMeta(metaList) {
        if (!(this.playersMeta instanceof Map)) {
            this.playersMeta = new Map();
        }
        for (const meta of metaList) {
            const normalized = this.normalizePlayerMetaEntry(meta);
            if (!normalized) {
                continue;
            }
            const previous = this.playersMeta.get(normalized.id);
            const merged = this.mergePlayerMetaEntry(previous, normalized);
            if (merged) {
                this.playersMeta.set(normalized.id, merged);
            }
        }
        this.updateMultiplayerPlayersHud();
    }

    updateMultiplayerPlayersHud() {
        this.topPlayersElement = document.getElementById("top-players");
        if (!this.topPlayersElement) return;

        if (!this.playersMeta || this.playersMeta.size === 0) {
            this.topPlayersElement.style.display = "none";
            return;
        }

        const localId = Number(this.localPlayerId);
        const playerIdsToDisplay = this.getDisplayedPlayerIds();

        let html = "";
        const participants = [];
        for (let i = 0; i < playerIdsToDisplay.length; i++) {
            const id = playerIdsToDisplay[i];
            const meta = this.getPlayerMeta(id);
            if (!meta) continue;

            const name = meta.username || "Player";
            const fullAvatarUrl = this.resolveAvatarUrl(meta.avatar);
            const isLocal = String(id) === String(localId);
            const displayName = name.length > 15 ? name.substring(0, 15) + "..." : name;
            participants.push(displayName);
            
            const matchScore = meta.matchScore || this.multiplayer?.players?.[id]?.matchScore || 0;

            html += `
                <div class="hud-player-card ${isLocal ? 'local-player' : 'remote-player'}">
                    <img src="${fullAvatarUrl}" class="hud-player-avatar" alt="${displayName}" onerror="this.src='${this.getDefaultAvatarUrl()}'" />
                    <div class="hud-player-copy" style="display:flex; justify-content:space-between; flex-direction:column;">
                        <span class="hud-player-name">${displayName}</span>
                        <div style="display:flex; gap:10px; font-size: 0.85em; opacity: 0.9;">
                            <span class="hud-player-match">Match: ${matchScore}</span>
                            <span class="hud-player-points">EP: ${Math.trunc(Number(meta.evaluation_points) || 0)}</span>
                        </div>
                    </div>
                </div>
            `;

            if (i < playerIdsToDisplay.length - 1) {
                html += `<div class="hud-vs-badge">VS</div>`;
            }
        }

        let waitingOverlay = document.getElementById("waiting-match-overlay");
        
        if (this.waitingForMatch) {
            if (!waitingOverlay) {
                const canvasWrapper = document.querySelector(".canvas-wrapper");
                if (canvasWrapper) {
                    waitingOverlay = document.createElement("div");
                    waitingOverlay.id = "waiting-match-overlay";
                    waitingOverlay.className = "matchmaking-waiting-overlay";
                    canvasWrapper.appendChild(waitingOverlay);
                }
            }
            if (waitingOverlay) {
                const partsText = participants.join(" vs ");
                waitingOverlay.innerHTML = `
                    <div class="matchmaking-status">Waiting for players...</div>
                    <div style="font-size:0.95em; color:#cccccc; margin-bottom: 12px; letter-spacing: 1px;">Players connected: ${participants.length}</div>
                    <div class="matchmaking-participants">${partsText}</div>
                `;
                waitingOverlay.style.display = "block";
            }
        } else {
            if (waitingOverlay) {
                waitingOverlay.style.display = "none";
            }
        }

        this.topPlayersElement.innerHTML = html;
        this.topPlayersElement.style.display = "flex";
        this.topPlayersElement.classList.add("is-visible");
    }


}
