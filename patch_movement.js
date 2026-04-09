const fs = require('fs');
const file = 'frontend/src/routes/ingame/scene/GameScene.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /updateBlackHoleGhostMovement\s*\(\s*deltaSeconds\s*\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*setupPauseUi\(\)\s*\{/m;

if (!regex.test(content)) {
    console.error("Regex did not match");
    process.exit(1);
}

const replacement = `updateBlackHoleGhostMovement(deltaSeconds) {
        if (!this.blackHole || !this.maze || !this.player) return;

        const allPairs = [{ bh: this.blackHole, p: this.player }];
        if (this.isMultiplayer && this.remoteBlackHoles && this.remotePlayers) {
            for (const [id, rBh] of this.remoteBlackHoles.entries()) {
                const rp = this.remotePlayers.get(id);
                if (rp && !this.isRemotePlayerAbsorbed(id)) {
                    allPairs.push({ bh: rBh, p: rp });
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

            const playerCell = getCell(targetP.x, targetP.y);
            const playerCellKey = \`\${playerCell.x},\${playerCell.y}\`;

            if (playerCellKey !== bh._lastTargetCellKey) {
                bh._lastTargetCellKey = playerCellKey;
                bh._ghostTargetCell = null;
                bh._ghostTargetPoint = null;
            }

            let remaining = originalRemaining;
            let guard = 0;
            const colRad = this.blackHoleCollisionRadius || this.tileSize * 0.3;

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

    setupPauseUi() {`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log("Patched successfully");
