import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildMultiplayerOptions } from "../routes/ingame/ingame_multiplayer.js";


describe("ingame_multiplayer", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("userId", "7");
        window.history.replaceState({}, "", "/ingame");
    });

    afterEach(() => {
        window.history.replaceState({}, "", "/");
    });

    it("parses avatar_url from players_meta query payload", () => {
        const serializedMeta = JSON.stringify([
            { id: 7, username: "Alice", avatar_url: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar_url: "uploaded_avatars/bob.png" },
        ]);

        const params = new URLSearchParams();
        params.set("mp", "1");
        params.set("players", "7,9");
        params.set("players_meta", serializedMeta);

        window.history.replaceState({}, "", `/ingame?${params.toString()}`);

        const multiplayer = buildMultiplayerOptions();
        expect(multiplayer.enabled).toBe(true);
        expect(multiplayer.playersMeta).toEqual([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);
    });

    it("accepts playersMeta query alias", () => {
        const serializedMeta = JSON.stringify([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);

        const params = new URLSearchParams();
        params.set("mp", "1");
        params.set("players", "7,9");
        params.set("playersMeta", serializedMeta);

        window.history.replaceState({}, "", `/ingame?${params.toString()}`);

        const multiplayer = buildMultiplayerOptions();
        expect(multiplayer.enabled).toBe(true);
        expect(multiplayer.playersMeta).toEqual([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);
    });

    it("parses username/avatar key variants from players_meta query payload", () => {
        const serializedMeta = JSON.stringify([
            { user_id: 7, user_name: "Alice", avatarUrl: "uploaded_avatars/alice.png" },
            { playerId: 9, display_name: "Bob", profile_avatar: "uploaded_avatars/bob.png" },
        ]);

        const params = new URLSearchParams();
        params.set("mp", "1");
        params.set("players", "7,9");
        params.set("players_meta", serializedMeta);

        window.history.replaceState({}, "", `/ingame?${params.toString()}`);

        const multiplayer = buildMultiplayerOptions();
        expect(multiplayer.enabled).toBe(true);
        expect(multiplayer.playersMeta).toEqual([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);
    });

    it("parses double-serialized players_meta query payload", () => {
        const payload = JSON.stringify([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);

        const params = new URLSearchParams();
        params.set("mp", "1");
        params.set("players", "7,9");
        params.set("players_meta", JSON.stringify(payload));

        window.history.replaceState({}, "", `/ingame?${params.toString()}`);

        const multiplayer = buildMultiplayerOptions();
        expect(multiplayer.enabled).toBe(true);
        expect(multiplayer.playersMeta).toEqual([
            { id: 7, username: "Alice", avatar: "uploaded_avatars/alice.png" },
            { id: 9, username: "Bob", avatar: "uploaded_avatars/bob.png" },
        ]);
    });
});
