import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    PENDING_STAGE_COMPLETION_KEY,
    queuePendingStageCompletion,
    settleVictoryProgression
} from "../routes/ingame/ingame_progression.js"

describe("ingame_progression", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("completes the pending victory stage and stores the next unlocked stage", async () => {
        localStorage.setItem("accessToken", "token-123")
        localStorage.setItem("bh_game_difficulty", "moyen")
        localStorage.setItem("bh_game_stage", "4")
        queuePendingStageCompletion({
            difficulty: "moyen",
            stage: 4,
            evaluation_points: 1,
            time_ms: 51000,
        })

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                current_stage: 5,
            }),
        }))
        vi.stubGlobal("fetch", fetchMock)

        const result = await settleVictoryProgression()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, request] = fetchMock.mock.calls[0]
        expect(url).toContain("/api/progression/complete")
        expect(request).toMatchObject({
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer token-123",
            },
        })
        expect(JSON.parse(request.body)).toEqual({
            difficulty: "moyen",
            stage: 4,
            evaluation_points: 1,
            time_ms: 51000,
        })
        expect(result).toEqual({
            difficulty: "moyen",
            stage: 5,
        })
        expect(localStorage.getItem("bh_game_stage")).toBe("5")
        expect(localStorage.getItem(PENDING_STAGE_COMPLETION_KEY)).toBeNull()
    })

    it("falls back to the current progression when the stage was already completed", async () => {
        localStorage.setItem("bh_game_difficulty", "facile")
        localStorage.setItem("bh_game_stage", "3")
        queuePendingStageCompletion({
            difficulty: "facile",
            stage: 3,
        })

        const fetchMock = vi.fn()
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({
                detail: "Tu dois d'abord compléter l'épreuve 4",
            }),
        })
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                facile: { current_stage: 4 },
            }),
        })
        vi.stubGlobal("fetch", fetchMock)

        const result = await settleVictoryProgression()

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[1][0]).toContain("/api/progression/me")
        expect(result).toEqual({
            difficulty: "facile",
            stage: 4,
        })
        expect(localStorage.getItem("bh_game_stage")).toBe("4")
        expect(localStorage.getItem(PENDING_STAGE_COMPLETION_KEY)).toBeNull()
    })
})
