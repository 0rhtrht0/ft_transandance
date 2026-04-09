import { describe, expect, it, vi } from "vitest";

import { MultiplayerSelector } from "../routes/menu/multiplayer_selector.js";

function createSelector() {
    return new MultiplayerSelector(
        "http://localhost:8000",
        () => "http://localhost:8000",
        null,
        null
    );
}

describe("multiplayer_selector", () => {
    it("routes quick mode entry through the lobby quick-join flow", async () => {
        const selector = createSelector();
        const quickJoinSpy = vi.spyOn(selector, "quickJoinLobby").mockResolvedValue(undefined);

        await selector.startRapidMode();

        expect(quickJoinSpy).toHaveBeenCalledTimes(1);
    });

    it("keeps explicit usernames when newer metadata only has fallback values", () => {
        const selector = createSelector();

        const merged = selector.mergePlayersMeta(
            [1],
            [{ id: 1, username: "Neo", avatar: "uploaded_avatars/neo.png" }],
            [{ id: 1 }]
        );

        expect(merged).toEqual([
            { id: 1, username: "Neo", avatar: "uploaded_avatars/neo.png", evaluation_points: 0 },
        ]);
    });

    it("parses playersMeta camelCase payloads for room events", () => {
        const selector = createSelector();
        selector.difficulty = "moyen";
        selector.stage = 2;

        const normalized = selector.normalizeRoomPayload({
            room_id: "R_TEST",
            players: [1, 2],
            playersMeta: [
                { id: 1, username: "Neo" },
                { id: 2, username: "Trinity", avatar_url: "uploaded_avatars/trinity.png" },
            ],
            ready_players: [1],
            all_ready: false,
            seed: 1234,
            tick_rate: 20,
            stage: 2,
            difficulty: "moyen",
        });

        expect(normalized.room_id).toBe("r_test");
        expect(normalized.players_meta).toEqual([
            { id: 1, username: "Neo", avatar: null, evaluation_points: 0 },
            { id: 2, username: "Trinity", avatar: "uploaded_avatars/trinity.png", evaluation_points: 0 },
        ]);
    });

    it("reads max_players from room payloads", () => {
        const selector = createSelector();

        const normalized = selector.normalizeRoomPayload({
            room_id: "R_MAX",
            players: [1, 2, 3],
            ready_players: [],
            all_ready: false,
            max_players: 4,
            seed: 9876,
        });

        expect(normalized.max_players).toBe(4);
    });

    it("auto launches when match is in progress and at least two players are present", () => {
        const selector = createSelector();
        const launchSpy = vi.spyOn(selector, "launchPrivateGame").mockImplementation(() => {});

        selector.roomState = {
            room_id: "r_wait",
            players: [1],
            max_players: 4,
            status: "in_progress",
            seed: 1234,
        };
        selector.tryAutoLaunchFromState();
        expect(launchSpy).not.toHaveBeenCalled();

        selector.roomState = {
            room_id: "r_wait",
            players: [1, 2],
            max_players: 4,
            status: "in_progress",
            seed: 1234,
        };
        selector.tryAutoLaunchFromState();
        expect(launchSpy).toHaveBeenCalledTimes(1);
    });

    it("enables start for host when joined players are all ready", () => {
        const modalContent = document.createElement("div");
        const modalFooter = document.createElement("div");
        const selector = new MultiplayerSelector(
            "http://localhost:8000",
            () => "http://localhost:8000",
            modalContent,
            modalFooter
        );

        localStorage.setItem("userId", "1");
        selector.difficulty = "moyen";
        selector.stage = 2;
        selector.roomState = {
            room_id: "r_ready",
            host_id: 1,
            max_players: 4,
            players: [1, 2],
            players_meta: [{ id: 1, username: "Host" }, { id: 2, username: "Guest" }],
            ready_players: [1, 2],
            all_ready: true,
            status: "ready",
            seed: 777,
            difficulty: "moyen",
            stage: 2,
            tick_rate: 20,
        };

        selector.renderPrivateLobby(true);
        selector.updateLobbyView();
        expect(selector.lobbyNodes.startBtn.disabled).toBe(false);
        localStorage.removeItem("userId");
    });

    it("applies empty ready_players from server payload", () => {
        const selector = createSelector();
        selector.roomState = {
            room_id: "r_merge",
            host_id: 1,
            max_players: 4,
            players: [1, 2],
            players_meta: [],
            ready_players: [1, 2],
            all_ready: true,
            status: "ready",
            seed: 111,
            difficulty: "moyen",
            stage: 1,
            tick_rate: 20,
        };

        const next = selector.normalizeRoomPayload({
            room_id: "r_merge",
            host_id: 1,
            max_players: 4,
            players: [1, 2],
            ready_players: [],
            all_ready: false,
            status: "waiting",
            seed: 111,
            difficulty: "moyen",
            stage: 1,
            tick_rate: 20,
        });
        const merged = selector.mergeRoomState(next);
        expect(merged.ready_players).toEqual([]);
        expect(merged.all_ready).toBe(false);
    });

    it("does not display room code in the lobby UI", () => {
        const modalContent = document.createElement("div");
        const modalFooter = document.createElement("div");
        const selector = new MultiplayerSelector(
            "http://localhost:8000",
            () => "http://localhost:8000",
            modalContent,
            modalFooter
        );

        selector.difficulty = "moyen";
        selector.stage = 2;
        selector.roomCode = "r_hidden";
        selector.renderPrivateLobby(true);

        expect(modalContent.textContent).not.toContain("Room code:");
        expect(modalContent.textContent).not.toContain("Copy");
    });

    it("normalizes key variants for usernames and avatars", () => {
        const selector = createSelector();

        const normalized = selector.normalizePlayerMeta({
            playerId: 7,
            user_name: "Alice",
            avatarUrl: "uploaded_avatars/alice.png",
        });

        expect(normalized).toEqual({
            id: 7,
            username: "Alice",
            avatar: "uploaded_avatars/alice.png",
            evaluation_points: 0,
            usernameIsExplicit: true,
        });
    });
});
