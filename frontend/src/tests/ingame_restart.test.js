import { beforeEach, describe, expect, it } from "vitest";

import {
    buildRestartPath,
    buildRestartRoute,
    rememberGameMode,
} from "../routes/ingame/ingame_restart.js";


describe("ingame_restart", () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.replaceState({}, "", "/ingame?difficulty=difficile&stage=4");
    });

    it("restarts multiplayer sessions in fresh matchmaking mode", () => {
        rememberGameMode(true);

        expect(buildRestartRoute()).toEqual({
            name: "menu",
            query: {
                multiplayer: "1",
                auto_join: "1",
                difficulty: "difficile",
                stage: "4",
            },
        });
        expect(buildRestartPath()).toBe("/menu?multiplayer=1&auto_join=1&difficulty=difficile&stage=4");
    });

    it("keeps solo restarts in solo mode", () => {
        rememberGameMode(false);

        expect(buildRestartRoute()).toEqual({
            name: "ingame",
            query: {
                difficulty: "difficile",
                stage: "4",
            },
        });
    });
});
