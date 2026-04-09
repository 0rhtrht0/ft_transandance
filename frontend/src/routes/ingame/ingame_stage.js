const MAX_STAGE = 100

function normalizeStage(value) {
    if (typeof value === "string" && value.trim() === "") {
        return null
    }
    if (value === null || typeof value === "undefined") {
        return null
    }
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return null
    }
    const stage = Math.floor(numeric)
    if (stage < 1) {
        return 1
    }
    if (stage > MAX_STAGE) {
        return MAX_STAGE
    }
    return stage
}

export function getGameStage() {
    const params = new URLSearchParams(window.location.search)
    const queryStage = normalizeStage(params.get("stage"))
    if (queryStage) {
        localStorage.setItem("bh_game_stage", String(queryStage))
        return queryStage
    }
    const storedStage = normalizeStage(localStorage.getItem("bh_game_stage"))
    return storedStage ?? 1
}

export function setGameStage(stage) {
    const normalized = normalizeStage(stage)
    if (normalized) {
        localStorage.setItem("bh_game_stage", String(normalized))
    }
}
