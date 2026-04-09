import { describe, expect, it } from "vitest";

import { generateMazeLogic } from "../routes/ingame/map/mazeLogic.js";

const UNREACHABLE = 9999;
const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
];

function bfsDistances(grid, start) {
    const rows = grid.length;
    const cols = grid[0].length;
    const dists = Array.from({ length: rows }, () => Array(cols).fill(UNREACHABLE));
    const q = [{ x: start.x, y: start.y }];
    let head = 0;
    dists[start.y][start.x] = 0;

    while (head < q.length) {
        const curr = q[head++];
        const d = dists[curr.y][curr.x];
        for (const dir of DIRECTIONS) {
            const nx = curr.x + dir.x;
            const ny = curr.y + dir.y;
            if (nx < 0 || ny < 0 || ny >= rows || nx >= cols) {
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

function isDoorInterior(door, cols, rows) {
    return door.x > 1 && door.y > 1 && door.x < cols - 2 && door.y < rows - 2;
}

function hasOpenNeighbor(grid, cell) {
    for (const dir of DIRECTIONS) {
        const nx = cell.x + dir.x;
        const ny = cell.y + dir.y;
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && grid[ny][nx] === 0) {
            return true;
        }
    }
    return false;
}

describe("mazeLogic start rules", () => {
    it("respects solo start constraints", () => {
        for (let i = 0; i < 32; i += 1) {
            const result = generateMazeLogic(`solo:${i}`, "moyen", 1, false, 800, 600, 28);
            expect(result).toBeTruthy();
            expect(isDoorInterior(result.door, result.cols, result.rows)).toBe(true);
            expect(hasOpenNeighbor(result.grid, result.door)).toBe(true);
            expect(result.p1).not.toEqual(result.door);

            const distFromP1 = bfsDistances(result.grid, result.p1);
            const dDoor = distFromP1[result.door.y][result.door.x];
            expect(dDoor).toBeGreaterThanOrEqual(5);
            expect(dDoor).toBeLessThan(UNREACHABLE);
        }
    });

    it("respects multiplayer start constraints", () => {
        for (let i = 0; i < 32; i += 1) {
            const result = generateMazeLogic(`multi:${i}`, "moyen", 1, true, 1400, 700, 28);
            expect(result).toBeTruthy();
            expect(result.p2).toBeTruthy();
            expect(isDoorInterior(result.door, result.cols, result.rows)).toBe(true);
            expect(hasOpenNeighbor(result.grid, result.door)).toBe(true);

            expect(result.p1).not.toEqual(result.p2);
            expect(result.p1).not.toEqual(result.door);
            expect(result.p2).not.toEqual(result.door);

            const distFromP1 = bfsDistances(result.grid, result.p1);
            const distFromP2 = bfsDistances(result.grid, result.p2);

            expect(distFromP1[result.door.y][result.door.x]).toBeGreaterThanOrEqual(5);
            expect(distFromP1[result.door.y][result.door.x]).toBeLessThan(UNREACHABLE);

            expect(distFromP2[result.door.y][result.door.x]).toBeGreaterThanOrEqual(5);
            expect(distFromP2[result.door.y][result.door.x]).toBeLessThan(UNREACHABLE);

            expect(distFromP1[result.p2.y][result.p2.x]).toBeGreaterThanOrEqual(4);
            expect(distFromP1[result.p2.y][result.p2.x]).toBeLessThan(UNREACHABLE);
        }
    });

    it("changes door position across new game seeds", () => {
        const uniqueDoors = new Set();

        for (let i = 0; i < 24; i += 1) {
            const result = generateMazeLogic(`fresh:${i}`, "moyen", 1, false, 800, 600, 28);
            uniqueDoors.add(`${result.door.x},${result.door.y}`);
        }

        expect(uniqueDoors.size).toBeGreaterThan(1);
    });
});
