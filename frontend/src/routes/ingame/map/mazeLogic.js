import { createRng } from "../utils/rng.js";

const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
];
const UNREACHABLE = 9999;
const MIN_PLAYER_DOOR_DISTANCE = 5;
const MIN_PLAYER_PLAYER_DISTANCE = 4;
const MAX_GENERATION_ATTEMPTS = 240;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function generateMazeLogic(seed, difficulty, stage, isMultiplayer, viewportWidth = 800, viewportHeight = 600, tileSize = 28) {
    if (isMultiplayer) {
        // Enforce consistent map dimensions for multiplayer regardless of screen size
        viewportWidth = 800;
        viewportHeight = 800;
    }

    // Determine rows/cols (odd numbers)
    let cols = Math.floor(viewportWidth / tileSize);
    if (cols % 2 === 0) cols -= 1;
    let rows = Math.floor(viewportHeight / tileSize);
    if (rows % 2 === 0) rows -= 1;
    cols = Math.max(11, cols);
    rows = Math.max(11, rows);

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const rng = createRng(`${seed}:${attempt}`);
        const result = tryGenerate(rng, cols, rows, difficulty, stage, isMultiplayer);
        if (result) {
            return result;
        }
    }

    throw new Error("Unable to generate a valid BlackHole start state");
}

function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
}

function cellKey(cell) {
    return `${cell.x},${cell.y}`;
}

function isInsideBounds(x, y, cols, rows) {
    return x >= 0 && y >= 0 && x < cols && y < rows;
}

function isValidDoorCell(cell, cols, rows) {
    return cell.x > 1 && cell.y > 1 && cell.x < cols - 2 && cell.y < rows - 2;
}

function hasOpenNeighbor(grid, cols, rows, cell) {
    for (const dir of DIRECTIONS) {
        const nx = cell.x + dir.x;
        const ny = cell.y + dir.y;
        if (isInsideBounds(nx, ny, cols, rows) && grid[ny][nx] === 0) {
            return true;
        }
    }
    return false;
}

function getBfsDistances(grid, cols, rows, start) {
    const dists = Array.from({ length: rows }, () => Array(cols).fill(UNREACHABLE));
    dists[start.y][start.x] = 0;
    const q = [start];
    let head = 0;

    while (head < q.length) {
        const curr = q[head++];
        const d = dists[curr.y][curr.x];
        for (const dir of DIRECTIONS) {
            const nx = curr.x + dir.x;
            const ny = curr.y + dir.y;
            if (!isInsideBounds(nx, ny, cols, rows)) {
                continue;
            }
            if (grid[ny][nx] !== 0) {
                continue;
            }
            if (dists[ny][nx] <= d + 1) {
                continue;
            }
            dists[ny][nx] = d + 1;
            q.push({ x: nx, y: ny });
        }
    }

    return dists;
}

function shuffleInPlace(array, rng) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function pickRandom(array, rng) {
    if (array.length === 0) {
        return null;
    }
    return array[Math.floor(rng() * array.length)];
}

function validateStartState(grid, cols, rows, p1, p2, door, isMultiplayer) {
    // Mandatory checks right before the match starts.
    if (!isValidDoorCell(door, cols, rows)) return false;
    if (!hasOpenNeighbor(grid, cols, rows, door)) return false;

    if (sameCell(p1, door)) return false;

    const distFromP1 = getBfsDistances(grid, cols, rows, p1);
    const p1DoorDistance = distFromP1[door.y][door.x];
    if (p1DoorDistance < MIN_PLAYER_DOOR_DISTANCE || p1DoorDistance >= UNREACHABLE) return false;

    if (isMultiplayer) {
        if (!p2) return false;
        if (sameCell(p1, p2)) return false;
        if (sameCell(p2, door)) return false;

        const distFromP2 = getBfsDistances(grid, cols, rows, p2);
        const p2DoorDistance = distFromP2[door.y][door.x];
        if (p2DoorDistance < MIN_PLAYER_DOOR_DISTANCE || p2DoorDistance >= UNREACHABLE) return false;

        const p1P2Distance = distFromP1[p2.y][p2.x];
        if (p1P2Distance < MIN_PLAYER_PLAYER_DISTANCE || p1P2Distance >= UNREACHABLE) return false;
    }

    return true;
}

function tryGenerate(rng, cols, rows, difficulty, stage, isMultiplayer) {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
    grid[1][1] = 0;
    const stack = [{ row: 1, col: 1 }];

    const getUnvisitedNeighbors = (r, c) => {
        const dirs = [
            { dr: -2, dc: 0 },
            { dr: 2, dc: 0 },
            { dr: 0, dc: -2 },
            { dr: 0, dc: 2 }
        ];
        const n = [];
        for (const { dr, dc } of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr > 0 && nc > 0 && nr < rows - 1 && nc < cols - 1 && grid[nr][nc] === 1) {
                n.push({ row: nr, col: nc, wallRow: r + dr / 2, wallCol: c + dc / 2 });
            }
        }
        return n;
    };

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = getUnvisitedNeighbors(current.row, current.col);
        if (neighbors.length === 0) {
            stack.pop();
            continue;
        }
        const next = neighbors[Math.floor(rng() * neighbors.length)];
        grid[next.wallRow][next.wallCol] = 0;
        grid[next.row][next.col] = 0;
        stack.push({ row: next.row, col: next.col });
    }

    const ratio = clamp((stage - 1) / 99, 0, 1);
    let removeFraction = 0;

    if (difficulty === "facile") {
        removeFraction = 0.30 - 0.15 * ratio;
    } else if (difficulty === "moyen") {
        removeFraction = 0.15 - 0.10 * ratio;
    } else {
        removeFraction = 0.05 - 0.05 * ratio;
    }

    // Removable walls
    const removableWalls = [];
    for (let r = 1; r < rows - 1; r += 1) {
        for (let c = 1; c < cols - 1; c += 1) {
            if (grid[r][c] !== 1) {
                continue;
            }
            const up = grid[r - 1][c] === 0;
            const down = grid[r + 1][c] === 0;
            const left = grid[r][c - 1] === 0;
            const right = grid[r][c + 1] === 0;
            if ((up && down && !left && !right) || (!up && !down && left && right)) {
                removableWalls.push({ r, c });
            }
        }
    }

    shuffleInPlace(removableWalls, rng);

    const toRemove = Math.floor(removableWalls.length * removeFraction);
    for (let i = 0; i < toRemove; i += 1) {
        const w = removableWalls[i];
        grid[w.r][w.c] = 0;
    }

    const freeCells = [];
    for (let r = 1; r < rows - 1; r += 1) {
        for (let c = 1; c < cols - 1; c += 1) {
            if (grid[r][c] === 0) {
                freeCells.push({ x: c, y: r });
            }
        }
    }
    if (freeCells.length === 0) {
        return null;
    }

    const doorCandidates = freeCells.filter((cell) => isValidDoorCell(cell, cols, rows));
    if (doorCandidates.length === 0) {
        return null;
    }
    shuffleInPlace(doorCandidates, rng);

    for (const door of doorCandidates) {
        if (!hasOpenNeighbor(grid, cols, rows, door)) {
            continue;
        }

        const distFromDoor = getBfsDistances(grid, cols, rows, door);
        const spawnCandidates = freeCells.filter((cell) => {
            if (sameCell(cell, door)) {
                return false;
            }
            const distance = distFromDoor[cell.y][cell.x];
            return distance >= MIN_PLAYER_DOOR_DISTANCE && distance < UNREACHABLE;
        });
        if (spawnCandidates.length === 0) {
            continue;
        }

        const p1 = pickRandom(spawnCandidates, rng);
        if (!p1) {
            continue;
        }

        let p2 = null;
        if (isMultiplayer) {
            const distFromP1 = getBfsDistances(grid, cols, rows, p1);
            const p2Candidates = spawnCandidates.filter((cell) => {
                if (sameCell(cell, p1)) {
                    return false;
                }
                const distance = distFromP1[cell.y][cell.x];
                return distance >= MIN_PLAYER_PLAYER_DISTANCE && distance < UNREACHABLE;
            });
            p2 = pickRandom(p2Candidates, rng);
            if (!p2) {
                continue;
            }
        }

        if (!validateStartState(grid, cols, rows, p1, p2, door, isMultiplayer)) {
            continue;
        }

        const occupied = new Set([cellKey(door), cellKey(p1)]);
        if (p2) {
            occupied.add(cellKey(p2));
        }

        const safeFreeCells = freeCells.filter((cell) => !occupied.has(cellKey(cell)));
        if (safeFreeCells.length === 0) {
            continue;
        }

        const bh1 = pickRandom(safeFreeCells, rng);
        if (!bh1) {
            continue;
        }

        let bh2 = null;
        if (isMultiplayer) {
            const bh2Candidates = safeFreeCells.filter((cell) => !sameCell(cell, bh1));
            bh2 = pickRandom(bh2Candidates, rng) || bh1;
        }

        return { grid, cols, rows, p1, p2, door, bh1, bh2 };
    }

    return null;
}
