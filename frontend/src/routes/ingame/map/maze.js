function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export default class Maze {
    constructor(rows, cols, tileSize = 48) {
        this.rows = rows;
        this.cols = cols;
        this.tileSize = tileSize;
        this.grid = [];
    }

    get worldWidth() {
        return this.cols * this.tileSize;
    }

    get worldHeight() {
        return this.rows * this.tileSize;
    }

    generate(rng = Math.random) {
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
        if (this.rows < 3 || this.cols < 3) {
            return;
        }

        const stack = [{ row: 1, col: 1 }];
        this.grid[1][1] = 0;

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(current.row, current.col);

            if (neighbors.length === 0) {
                stack.pop();
                continue;
            }

            const next = neighbors[Math.floor(rng() * neighbors.length)];
            this.grid[next.wallRow][next.wallCol] = 0;
            this.grid[next.row][next.col] = 0;
            stack.push({ row: next.row, col: next.col });
        }
    }

    getUnvisitedNeighbors(row, col) {
        const directions = [
            { dr: -2, dc: 0 },
            { dr: 2, dc: 0 },
            { dr: 0, dc: -2 },
            { dr: 0, dc: 2 }
        ];
        const neighbors = [];

        for (const { dr, dc } of directions) {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (nextRow <= 0 || nextCol <= 0 || nextRow >= this.rows - 1 || nextCol >= this.cols - 1) {
                continue;
            }
            if (this.grid[nextRow][nextCol] === 0) {
                continue;
            }

            neighbors.push({
                row: nextRow,
                col: nextCol,
                wallRow: row + dr / 2,
                wallCol: col + dc / 2
            });
        }

        return neighbors;
    }

    findSpawnPoint() {
        const centerCol = (this.cols - 1) / 2;
        const centerRow = (this.rows - 1) / 2;
        let bestCell = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let y = 1; y < this.rows - 1; y += 1) {
            for (let x = 1; x < this.cols - 1; x += 1) {
                if (this.grid[y][x] === 0) {
                    const dx = x - centerCol;
                    const dy = y - centerRow;
                    const distance = dx * dx + dy * dy;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestCell = { x, y };
                    }
                }
            }
        }

        if (bestCell) {
            return {
                x: (bestCell.x + 0.5) * this.tileSize,
                y: (bestCell.y + 0.5) * this.tileSize
            };
        }

        return {
            x: this.tileSize * 1.5,
            y: this.tileSize * 1.5
        };
    }

    isWallAtCell(col, row) {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
            return true;
        }
        return this.grid[row][col] === 1;
    }

    isWallAtPixel(x, y, padding = 0) {
        const left = Math.floor((x - padding) / this.tileSize);
        const right = Math.floor((x + padding) / this.tileSize);
        const top = Math.floor((y - padding) / this.tileSize);
        const bottom = Math.floor((y + padding) / this.tileSize);

        return (
            this.isWallAtCell(left, top) ||
            this.isWallAtCell(right, top) ||
            this.isWallAtCell(left, bottom) ||
            this.isWallAtCell(right, bottom)
        );
    }

    isColliding(x, y, size) {
        return this.isWallAtPixel(x, y, size / 2);
    }

    render(ctx, camera, timeSeconds = 0) {
        const size = this.tileSize;
        const visibleWidth = camera.viewportWidth / camera.zoom;
        const visibleHeight = camera.viewportHeight / camera.zoom;
        const startCol = clamp(Math.floor(camera.x / size) - 1, 0, this.cols);
        const endCol = clamp(Math.ceil((camera.x + visibleWidth) / size) + 1, 0, this.cols);
        const startRow = clamp(Math.floor(camera.y / size) - 1, 0, this.rows);
        const endRow = clamp(Math.ceil((camera.y + visibleHeight) / size) + 1, 0, this.rows);
        const centerCol = (this.cols - 1) * 0.5;
        const centerRow = (this.rows - 1) * 0.5;
        const maxDistance = Math.hypot(centerCol, centerRow) || 1;

        for (let y = startRow; y < endRow; y += 1) {
            for (let x = startCol; x < endCol; x += 1) {
                const isWall = this.grid[y][x] === 1;
                const parity = (x + y) % 2 === 0;
                const dx = x - centerCol;
                const dy = y - centerRow;
                const normalizedDistance = Math.hypot(dx, dy) / maxDistance;

                if (isWall) {
                    let wallColor;
                    if (normalizedDistance < 0.26) {
                        if (parity) {
                            wallColor = "#231433";
                        } else {
                            wallColor = "#2b183d";
                        }
                    } else if (normalizedDistance < 0.54) {
                        if (parity) {
                            wallColor = "#1d112c";
                        } else {
                            wallColor = "#251636";
                        }
                    } else {
                        if (parity) {
                            wallColor = "#160d22";
                        } else {
                            wallColor = "#1b1029";
                        }
                    }

                    const jitter = Math.sin(timeSeconds * 6.2 + x * 1.3 + y * 1.1) * 0.22;
                    ctx.fillStyle = wallColor;
                    ctx.fillRect(x * size + jitter, y * size, size, size);

                    ctx.strokeStyle = "rgba(172, 122, 255, 0.11)";
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x * size, y * size, size, size);
                } else {
                    let floorColor;
                    if (normalizedDistance < 0.3) {
                        if (parity) {
                            floorColor = "#131313";
                        } else {
                            floorColor = "#171717";
                        }
                    } else {
                        if (parity) {
                            floorColor = "#0d0d0d";
                        } else {
                            floorColor = "#111111";
                        }
                    }

                    ctx.fillStyle = floorColor;
                    ctx.fillRect(x * size, y * size, size, size);
                }
            }
        }
    }
}
