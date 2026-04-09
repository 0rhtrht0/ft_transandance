const VALID_DIFFICULTIES = ["facile", "moyen", "difficile"]

function normalizeDifficulty(value) {
    if (typeof value !== "string") {
        return null
    }
    const normalized = value.toLowerCase()
    if (VALID_DIFFICULTIES.includes(normalized)) {
        return normalized
    }
    return null
}

export function getGameDifficulty() {
    const params = new URLSearchParams(window.location.search)
    const queryDifficulty = normalizeDifficulty(params.get("difficulty"))
    if (queryDifficulty) {
        localStorage.setItem("bh_game_difficulty", queryDifficulty)
        return queryDifficulty
    }
    const stored = normalizeDifficulty(localStorage.getItem("bh_game_difficulty"))
    return stored ?? "moyen"
}

export function setGameDifficulty(difficulty) {
    const normalized = normalizeDifficulty(difficulty)
    if (normalized) {
        localStorage.setItem("bh_game_difficulty", normalized)
    }
}
