import { getApiBase, readErrorDetail } from "../auth/auth_api.js"
import { getStoredToken } from "../auth/auth_storage.js"
import { getGameDifficulty, setGameDifficulty } from "./ingame_difficulty.js"
import { getGameStage, setGameStage } from "./ingame_stage.js"

export const VALID_DIFFICULTIES = ["facile", "moyen", "difficile"]
export const MAX_STAGE = 100
export const PENDING_STAGE_COMPLETION_KEY = "bh_pending_stage_completion"

export function normalizeDifficulty(value) {
    if (typeof value !== "string") {
        return null
    }
    const normalized = value.toLowerCase()
    return VALID_DIFFICULTIES.includes(normalized) ? normalized : null
}

export function normalizeStage(value) {
    if (value === null || typeof value === "undefined") {
        return null
    }
    if (typeof value === "string" && value.trim() === "") {
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

function buildAuthHeaders(includeJson = false) {
    const headers = {}
    const token = getStoredToken()
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }
    if (includeJson) {
        headers["Content-Type"] = "application/json"
    }
    return headers
}

function buildPendingPayload(payload) {
    const difficulty = normalizeDifficulty(payload?.difficulty)
    const stage = normalizeStage(payload?.stage)
    if (!difficulty || !stage) {
        return null
    }

    return {
        difficulty,
        stage,
        evaluation_points: Math.floor(
            Number(payload?.evaluation_points ?? payload?.score) || 0
        ),
        time_ms: Math.max(0, Math.floor(Number(payload?.time_ms) || 0)),
    }
}

export function queuePendingStageCompletion(payload) {
    const normalized = buildPendingPayload(payload)
    if (!normalized) {
        return null
    }
    localStorage.setItem(PENDING_STAGE_COMPLETION_KEY, JSON.stringify(normalized))
    return normalized
}

export function clearPendingStageCompletion() {
    localStorage.removeItem(PENDING_STAGE_COMPLETION_KEY)
}

export function readPendingStageCompletion() {
    const raw = localStorage.getItem(PENDING_STAGE_COMPLETION_KEY)
    if (!raw) {
        return null
    }

    try {
        const parsed = JSON.parse(raw)
        const normalized = buildPendingPayload(parsed)
        if (!normalized) {
            clearPendingStageCompletion()
            return null
        }
        return normalized
    } catch {
        clearPendingStageCompletion()
        return null
    }
}

async function fetchCurrentProgression(difficulty) {
    const response = await fetch(`${getApiBase()}/api/progression/me`, {
        credentials: "include",
        headers: buildAuthHeaders()
    })

    if (!response.ok) {
        const error = new Error(await readErrorDetail(response))
        error.status = response.status
        throw error
    }

    const data = await response.json()
    return normalizeStage(data?.[difficulty]?.current_stage) || 1
}

async function completeStage(payload) {
    const response = await fetch(`${getApiBase()}/api/progression/complete`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        const error = new Error(await readErrorDetail(response))
        error.status = response.status
        throw error
    }

    return response.json()
}

export async function settleVictoryProgression() {
    const pending = readPendingStageCompletion()
    const difficulty = pending?.difficulty ?? normalizeDifficulty(getGameDifficulty())
    const fallbackStage = pending?.stage ?? normalizeStage(getGameStage()) ?? 1

    if (!difficulty) {
        return {
            difficulty: null,
            stage: fallbackStage
        }
    }

    let nextStage = fallbackStage

    if (pending) {
        try {
            const progression = await completeStage(pending)
            nextStage = normalizeStage(progression?.current_stage) || fallbackStage
            clearPendingStageCompletion()
        } catch (error) {
            if (error?.status !== 403) {
                throw error
            }

            nextStage = await fetchCurrentProgression(difficulty)
            if (nextStage >= pending.stage) {
                clearPendingStageCompletion()
            }
        }
    } else {
        nextStage = await fetchCurrentProgression(difficulty)
    }

    setGameDifficulty(difficulty)
    setGameStage(nextStage)

    return {
        difficulty,
        stage: nextStage
    }
}
