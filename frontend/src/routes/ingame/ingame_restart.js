import { getGameDifficulty } from "./ingame_difficulty.js"
import { getGameStage } from "./ingame_stage.js"

export const LAST_GAME_MODE_KEY = "bh_last_game_mode"
export const LAST_GAME_MODE_MULTIPLAYER = "multiplayer"
export const LAST_GAME_MODE_SOLO = "solo"

export function rememberGameMode(isMultiplayer) {
    localStorage.setItem(
        LAST_GAME_MODE_KEY,
        isMultiplayer ? LAST_GAME_MODE_MULTIPLAYER : LAST_GAME_MODE_SOLO
    )
}

export function getLastGameMode() {
    const stored = localStorage.getItem(LAST_GAME_MODE_KEY)
    if (stored === LAST_GAME_MODE_MULTIPLAYER || stored === LAST_GAME_MODE_SOLO) {
        return stored
    }
    return LAST_GAME_MODE_SOLO
}

export function buildRestartRoute() {
    const difficulty = getGameDifficulty()
    const stage = getGameStage()
    const baseQuery = {
        difficulty,
        stage: String(stage),
    }

    if (getLastGameMode() === LAST_GAME_MODE_MULTIPLAYER) {
        return {
            name: "menu",
            query: {
                multiplayer: "1",
                auto_join: "1",
                difficulty,
                stage: String(stage),
            },
        }
    }

    return {
        name: "ingame",
        query: baseQuery,
    }
}

export function buildRestartPath() {
    const target = buildRestartRoute()
    const query = new URLSearchParams(target.query || {}).toString()
    return query ? `/${target.name}?${query}` : `/${target.name}`
}
