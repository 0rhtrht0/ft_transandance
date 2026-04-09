import { afterEach, describe, expect, it, vi } from "vitest";

import GameScene from "../routes/ingame/scene/GameScene.js";
import { PENDING_STAGE_COMPLETION_KEY } from "../routes/ingame/ingame_progression.js";

describe("GameScene players meta", () => {
    const createScene = () => new GameScene({}, { multiplayer: { enabled: false } });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("normalizes username/avatar key variants", () => {
        const scene = createScene();

        const normalized = scene.normalizePlayerMetaEntry({
            playerId: 12,
            user_name: "Neo",
            avatarUrl: "uploaded_avatars/neo.png",
        });

        expect(normalized).toEqual({
            id: 12,
            username: "Neo",
            avatar: "uploaded_avatars/neo.png",
            evaluation_points: 0,
            usernameIsExplicit: true,
        });
    });

    it("keeps explicit username when later payload only has fallback data", () => {
        const scene = createScene();

        scene.applyPlayersMeta([
            { id: 12, username: "Neo", avatar_url: "uploaded_avatars/neo.png" },
        ]);

        scene.applyPlayersMeta([
            { id: 12 },
        ]);

        expect(scene.getPlayerMeta(12)).toEqual({
            id: 12,
            username: "Neo",
            avatar: "uploaded_avatars/neo.png",
            evaluation_points: 0,
        });
    });

    it("uses a default avatar when none is provided", () => {
        const scene = createScene();

        expect(scene.resolveAvatarUrl(null)).toBe("/assets/images/default-avatar.svg");
        expect(scene.resolveAvatarUrl("")).toBe("/assets/images/default-avatar.svg");
    });

    it("builds uploaded avatar URLs against the API base", () => {
        const scene = createScene();

        expect(scene.resolveAvatarUrl("uploaded_avatars/neo.png")).toBe(
            `${scene.getApiBase()}/uploaded_avatars/neo.png`
        );
    });

    it("does not render remote player sprites in multiplayer mode", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });
        const localRender = vi.fn();
        const remoteRender = vi.fn();
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
        };

        scene.player = { x: 10, y: 20, render: localRender };
        scene.remotePlayers.set(9, { x: 30, y: 40, render: remoteRender });

        scene.renderPlayer(ctx);

        expect(localRender).toHaveBeenCalledTimes(1);
        expect(remoteRender).not.toHaveBeenCalled();
    });

    it("syncs remote blackholes from multiplayer snapshots", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.localPlayerId = 7;
        scene.blackHole = { radius: 64, x: 0, y: 0 };
        scene.multiplayerStore.blackholes = new Map([
            [7, { x: 14, y: 28, radius: 64 }],
            [9, { x: 140, y: 196, radius: 72 }],
        ]);

        scene.syncRemoteBlackHolesFromStore();

        const remoteHole = scene.remoteBlackHoles.get(9);
        expect(remoteHole).toBeTruthy();
        expect(remoteHole.x).toBe(140);
        expect(remoteHole.y).toBe(196);
        expect(remoteHole.radius).toBe(72);
        expect(scene.remoteBlackHoles.has(7)).toBe(false);
    });

    it("does not snap absorbed remote blackhole back to server coordinates", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.localPlayerId = 1;
        scene.tileSize = 28;
        scene.blackHole = { radius: 64, x: 0, y: 0 };
        scene.multiplayerStore.players = new Map([
            [9, { status: "absorbed" }],
        ]);

        scene.remoteBlackHoles.set(9, {
            x: 190,
            y: 100,
            radius: 72,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
            _serverX: 190,
            _serverY: 100,
        });

        scene.multiplayerStore.blackholes = new Map([
            [9, { x: 140, y: 100, radius: 72 }],
        ]);

        scene.syncRemoteBlackHolesFromStore();

        const remoteHole = scene.remoteBlackHoles.get(9);
        expect(remoteHole.x).toBe(190);
        expect(remoteHole.y).toBe(100);
    });

    it("moves an absorbed remote blackhole toward the remaining player", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = { x: 240, y: 80, radius: 10 };
        scene.multiplayerStore.players = new Map([
            [9, { status: "absorbed" }],
        ]);

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            _absorptionStartedAt: 0,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(9, remoteHole);
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.updateAbsorbedRemoteBlackHolePursuit(1);

        expect(remoteHole.x).toBeGreaterThan(80);
        expect(remoteHole.y).toBe(80);
    });

    it("targets surviving remote players with world coordinates after absorption", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = { x: 400, y: 80, radius: 10 };
        scene.multiplayerStore.players = new Map([
            [9, { status: "absorbed" }],
            [11, { status: "active", x: 100, y: 80 }],
        ]);

        scene.remoteBlackHoles.set(11, {
            x: 220,
            y: 80,
            radius: 60,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        });

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            _absorptionStartedAt: 0,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(9, remoteHole);
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.updateAbsorbedRemoteBlackHolePursuit(1);

        expect(remoteHole.x).toBe(100);
        expect(remoteHole.y).toBe(80);
    });

    it("uses dedicated blackhole target positions when multiplayer player coordinates are hidden", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = { x: 400, y: 80, radius: 10 };
        scene.multiplayerStore.applySnapshot({
            players: {
                1: { status: "active", x: 400, y: 80 },
                9: { status: "absorbed", x: -1000, y: -1000 },
                11: { status: "active", x: -1000, y: -1000 },
            },
            blackhole_targets: {
                9: { status: "absorbed", x: 80, y: 80 },
                11: { status: "active", x: 100, y: 80 },
            },
        });

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            _absorptionStartedAt: 0,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(9, remoteHole);
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.updateAbsorbedRemoteBlackHolePursuit(1);

        expect(remoteHole.x).toBe(100);
        expect(remoteHole.y).toBe(80);
    });

    it("waits for remote absorption to finish before chasing another player", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = { x: 400, y: 80, radius: 10 };
        scene.multiplayerStore.players = new Map([
            [9, { status: "absorbed" }],
            [11, { status: "active", x: 160, y: 80 }],
        ]);

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            _absorptionStartedAt: 0,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(9, remoteHole);

        scene.fogTime = scene.absorbDuration - 0.1;
        scene.updateAbsorbedRemoteBlackHolePursuit(1);
        expect(remoteHole.x).toBe(80);
        expect(remoteHole.y).toBe(80);

        scene.fogTime = scene.absorbDuration + 0.1;
        scene.updateAbsorbedRemoteBlackHolePursuit(1);
        expect(remoteHole.x).toBeGreaterThan(80);
        expect(remoteHole.y).toBe(80);
    });

    it("keeps absorbed remote blackholes moving during the local absorption animation", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 40,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 56,
            y: 56,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
        };
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.updateEvaluationPoints = vi.fn();
        scene.updateTopHud = vi.fn();
        scene.updateAbsorption = vi.fn();
        scene.multiplayerStore.players = new Map([
            [9, { status: "absorbed" }],
            [11, { status: "active", x: 160, y: 80 }],
        ]);
        scene.remotePlayers.set(11, {
            x: 160,
            y: 80,
        });

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            _absorptionStartedAt: 0,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(9, remoteHole);
        scene.absorbState = "active";
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.update(1);

        expect(remoteHole.x).toBeGreaterThan(80);
        expect(remoteHole.y).toBeGreaterThanOrEqual(70);
        expect(remoteHole.y).toBeLessThanOrEqual(80);
    });

    it("keeps unabsorbed remote blackholes moving during the local absorption animation", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 40,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 56,
            y: 56,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
            _absorptionStartedAt: 0,
        };
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.updateEvaluationPoints = vi.fn();
        scene.updateTopHud = vi.fn();
        scene.updateAbsorption = vi.fn();
        scene.multiplayerStore.players = new Map([
            [1, { status: "absorbed" }],
            [11, { status: "active", x: 160, y: 80 }],
        ]);
        scene.remotePlayers.set(11, {
            x: 160,
            y: 80,
        });

        const remoteHole = {
            x: 80,
            y: 80,
            radius: 60,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        };
        scene.remoteBlackHoles.set(11, remoteHole);
        scene.absorbState = "active";
        scene.fogTime = 0.5;

        scene.update(1);

        expect(remoteHole.x).toBeLessThan(80);
        expect(remoteHole.y).toBeGreaterThanOrEqual(70);
        expect(remoteHole.y).toBeLessThanOrEqual(80);
    });

    it("lets the local blackhole chase survivors after the local absorption completes", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 40,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 80,
            y: 80,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
            _absorptionStartedAt: 0,
        };
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.multiplayerStore.players = new Map([
            [1, { status: "absorbed" }],
            [11, { status: "active", x: 160, y: 80 }],
        ]);
        scene.remotePlayers.set(11, {
            x: 160,
            y: 80,
        });
        scene.absorbState = "active";
        scene.absorbProgress = 1;
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.updateBlackHoleGhostMovement(1);

        expect(scene.blackHole.x).toBeGreaterThan(80);
        expect(scene.blackHole.y).toBeGreaterThanOrEqual(70);
        expect(scene.blackHole.y).toBeLessThanOrEqual(80);
    });

    it("lets an absorbed remote player's blackhole chase the survivor without pre-set absorption timestamp", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 160,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 40,
            y: 80,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
        };
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.multiplayerStore.players = new Map([
            [1, { status: "active", x: 160, y: 80 }],
            [11, { status: "absorbed" }],
        ]);
        scene.remotePlayers.set(11, {
            x: 80,
            y: 80,
        });
        scene.remoteBlackHoles.set(11, {
            x: 80,
            y: 80,
            radius: 64,
            setPace: vi.fn(),
            update: vi.fn(),
            touchesEdge: vi.fn(() => false),
        });
        scene.fogTime = 10;

        scene.updateBlackHoleGhostMovement(1);

        const remoteHole = scene.remoteBlackHoles.get(11);
        expect(remoteHole._absorptionStartedAt).toBe(10);

        scene.fogTime = 10 + scene.absorbDuration + 0.1;
        scene.updateBlackHoleGhostMovement(1);

        expect(remoteHole.x).toBeGreaterThan(80);
        expect(remoteHole.y).toBeGreaterThanOrEqual(70);
        expect(remoteHole.y).toBeLessThanOrEqual(80);
    });

    it("keeps absorbed blackholes moving when players map is temporarily missing", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 80,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 120,
            y: 80,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
        };
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.absorbState = "active";
        scene.absorbProgress = 0.4;
        scene.multiplayerStore.players = null;
        scene.remotePlayers.set(11, { x: 200, y: 80 });

        scene.updateBlackHoleGhostMovement(1);

        expect(scene.blackHole.x).toBeGreaterThan(120);
        expect(scene.blackHole.y).toBeGreaterThanOrEqual(70);
        expect(scene.blackHole.y).toBeLessThanOrEqual(80);
    });

    it("uses last known target when absorption targets disappear temporarily", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 80,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 120,
            y: 80,
            radius: 64,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
            _lastKnownTarget: { x: 220, y: 80 },
        };
        scene.maze = {
            cols: 30,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn(() => false),
        };
        scene.absorbState = "active";
        scene.absorbProgress = 1;
        scene.multiplayerStore.players = new Map([
            [1, { status: "absorbed" }],
            [11, { status: "absorbed" }],
        ]);
        scene.remotePlayers.clear();

        scene.updateBlackHoleGhostMovement(1);

        expect(scene.blackHole.x).toBeGreaterThan(120);
        expect(scene.blackHole.y).toBeGreaterThanOrEqual(70);
        expect(scene.blackHole.y).toBeLessThanOrEqual(80);
    });

    it("keeps moving after absorption even if the local blackhole visual radius becomes huge", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.localPlayerId = 1;
        scene.pace = 18;
        scene.tileSize = 28;
        scene.player = {
            x: 40,
            y: 80,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 80,
            y: 80,
            radius: 220,
            _movementCollisionRadius: 12,
            setRadius: vi.fn(),
            setPace: vi.fn(),
            update: vi.fn(),
            _absorptionStartedAt: 0,
        };
        scene.blackHoleCollisionRadius = 80;
        scene.maze = {
            cols: 20,
            rows: 20,
            isWallAtCell: vi.fn(() => false),
            isWallAtPixel: vi.fn((x, y, radius) => radius > 20),
        };
        scene.multiplayerStore.players = new Map([
            [1, { status: "absorbed" }],
            [11, { status: "active", x: 160, y: 80 }],
        ]);
        scene.multiplayerStore.blackholeTargets = new Map([
            [11, { status: "active", x: 160, y: 80 }],
        ]);
        scene.absorbState = "active";
        scene.absorbProgress = 1;
        scene.fogTime = scene.absorbDuration + 0.1;

        scene.updateBlackHoleGhostMovement(1);

        expect(scene.blackHole.x).toBeGreaterThan(80);
        expect(scene.blackHole.y).toBeGreaterThanOrEqual(70);
        expect(scene.blackHole.y).toBeLessThanOrEqual(80);
    });

    it("keeps rendering blackholes after local absorption completes in multiplayer", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
        };

        scene.isMultiplayer = true;
        scene.absorbState = "active";
        scene.absorbProgress = 1;
        scene.blackHole = {
            render: vi.fn(),
        };
        const remoteHole = {
            render: vi.fn(),
        };
        scene.remoteBlackHoles.set(9, remoteHole);

        scene.renderOverlay(ctx);

        expect(scene.blackHole.render).toHaveBeenCalledTimes(1);
        expect(remoteHole.render).toHaveBeenCalledTimes(1);
    });

    it("treats remote blackholes as lethal during multiplayer", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.player = { x: 120, y: 160, radius: 8 };
        scene.blackHole = { touchesEdge: vi.fn(() => false) };
        scene.remoteBlackHoles.set(9, {
            touchesEdge: vi.fn(() => true),
        });

        expect(scene.isCaughtByAnyBlackHole()).toBe(true);
    });

    it("notifies the server immediately when the local player is absorbed", () => {
        const scene = new GameScene({}, { multiplayer: { enabled: true } });

        scene.isMultiplayer = true;
        scene.sessionReady = true;
        scene.evaluationPoints = 0;
        scene.level = 3;
        scene.player = {
            x: 110,
            y: 210,
            radius: 10,
            setBonusActive: vi.fn(),
        };
        scene.blackHole = {
            x: 90,
            y: 180,
            radius: 64,
        };
        scene.gameClient = {
            sendPlayerAbsorbed: vi.fn(),
        };
        scene.setPaused = vi.fn();
        scene.clearAbsorbNavigationTimeout = vi.fn();
        scene.setGravityDistortionStrength = vi.fn();

        scene.startAbsorption();

        expect(scene.gameClient.sendPlayerAbsorbed).toHaveBeenCalledTimes(1);
        expect(scene.gameClient.sendPlayerAbsorbed).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "absorbed",
                evaluation_points: 0,
                level: 3,
                x: 110,
                y: 210,
            })
        );
    });

    it("keeps the selected difficulty and stage for solo runs", () => {
        const scene = new GameScene({}, {
            multiplayer: { enabled: false },
            difficulty: "difficile",
            stage: 7,
        });

        scene.setupPauseUi = vi.fn();
        scene.updateTopHud = vi.fn();
        scene.bootstrapPlayersMeta = vi.fn();
        scene.createLevel = vi.fn();
        scene.onEnter();

        expect(scene.difficulty).toBe("difficile");
        expect(scene.stage).toBe(7);
        expect(scene.level).toBe(7);
    });

    it("submits the selected stage and queues progression on victory", () => {
        localStorage.clear();
        const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
        vi.stubGlobal("fetch", fetchMock);

        const scene = new GameScene({}, {
            multiplayer: { enabled: false },
            difficulty: "moyen",
            stage: 4,
        });
        scene.evaluationPoints = 1;
        scene.pace = 18;
        scene.getCurrentPaceData = () => ({ pace: 18, label: "18" });
        scene.getTotalElapsedSeconds = () => 42;

        scene.submitResult("victory");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, request] = fetchMock.mock.calls[0];
        const payload = JSON.parse(request.body);
        expect(payload).toMatchObject({
            evaluation_points: 1,
            result: "victory",
            difficulty: "moyen",
            stage: 4,
            level: 4,
        });
        expect(JSON.parse(localStorage.getItem(PENDING_STAGE_COMPLETION_KEY))).toMatchObject({
            difficulty: "moyen",
            stage: 4,
            evaluation_points: 1,
            time_ms: 42000,
        });
    });
});
