import fs from "fs";

const path = "frontend/src/routes/ingame/scene/GameScene.js";
let content = fs.readFileSync(path, 'utf8');

const regex = /    createLevel\(\) \{[\s\S]*?fitMazeToInterface\(\);\n    \}/;

const newCreateLevel = `    createLevel() {
        const tileSize = this.tileSize;
        const cmToPx = (cm) => cm * 10;
        const paceData = this.getCurrentPaceData();
        const blackHoleRadius = cmToPx(paceData.holeCm);

        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        const isMultiplayer = this.playerIds.length > 1 || this.multiplayer !== null;
        
        let difficulty = this.difficulty || "moyen";
        let stage = this.stage || 1;
        let seedStr = this.seed || \`\${difficulty}:\${stage}\`;
        
        const logicResult = generateMazeLogic(
            seedStr,
            difficulty,
            stage,
            isMultiplayer,
            this.game.camera.viewportWidth,
            this.game.camera.viewportHeight,
            tileSize
        );

        this.maze = new Maze(logicResult.rows, logicResult.cols, tileSize);
        this.maze.grid = logicResult.grid;

        let playerIds;
        if (this.playerIds.length > 0) {
            playerIds = this.playerIds;
        } else {
            playerIds = [this.localPlayerId ?? 1];
        }

        const localId = this.localPlayerId ?? playerIds[0];
        
        let p1Id, p2Id;
        if (playerIds.length > 1) {
            const sorted = [...playerIds].sort();
            p1Id = sorted[0];
            p2Id = sorted[1];
        } else {
            p1Id = localId;
        }

        const spawnByPlayer = new Map();
        spawnByPlayer.set(p1Id, logicResult.p1);
        if (playerIds.length > 1) {
            spawnByPlayer.set(p2Id, logicResult.p2 || logicResult.p1);
        }

        const bhCellByPlayer = new Map();
        bhCellByPlayer.set(p1Id, logicResult.bh1);
        if (playerIds.length > 1) {
            bhCellByPlayer.set(p2Id, logicResult.bh2 || logicResult.bh1);
        }

        const blackHoleCell = bhCellByPlayer.get(localId) || logicResult.bh1;
        const blackHoleX = (blackHoleCell.x + 0.5) * tileSize;
        const blackHoleY = (blackHoleCell.y + 0.5) * tileSize;
        this.blackHole = new BlackHole(blackHoleX, blackHoleY, blackHoleRadius, this.pace);
        
        this.pace = paceData.pace;
        this.visionRadiusWorld = cmToPx(paceData.visionCm);
        this.blackHoleCollisionRadius = Math.max(this.tileSize * 0.3, blackHoleRadius * 0.28);
        
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
        this.player.setBonusActive(this.isBonusActive);

        for (const remote of this.remotePlayers.values()) {
            remote.destroy();
        }
        this.remotePlayers.clear();
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
            this.remoteBlackHoles.set(id, {
                x: (rBhCell.x + 0.5) * tileSize,
                y: (rBhCell.y + 0.5) * tileSize,
                opacity: 0,
                radius: blackHoleRadius
            });
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
        this.blackHoleDirection = { x: 0, y: 0 };
        this.blackHoleTargetCell = null;
        this.blackHoleTargetPoint = null;
        this.lastPlayerCellKey = "";
        this.game.camera.setWorldSize(this.maze.worldWidth, this.maze.worldHeight);
        this.fitMazeToInterface();
    }`;

content = content.replace(regex, newCreateLevel);
fs.writeFileSync(path, content, 'utf8');
