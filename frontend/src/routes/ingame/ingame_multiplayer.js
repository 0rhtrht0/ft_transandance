import { getApiBase, getWsBase } from "../auth/auth_api.js";
import { resolveWsBase } from "../../utils/runtimeEndpoints.js";
import GameClient from "./net/gameClient.js";
import { createMultiplayerStore } from "./state/multiplayerStore.js";

const PLAYER_ID_KEY = "bh_player_id";
const TRUE_STRINGS = new Set(["1", "true", "yes", "on"]);
const FALSE_STRINGS = new Set(["0", "false", "no", "off"]);

function parseBoolean(value, fallback) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    if (TRUE_STRINGS.has(normalized)) {
        return true;
    }
    if (FALSE_STRINGS.has(normalized)) {
        return false;
    }
    return fallback;
}

function parsePlayerList(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return [];
    }
    const players = value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((id) => Number.isFinite(id) && id > 0);
    return [...new Set(players)];
}

function firstNonEmptyString(...values) {
    for (const value of values) {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }
    return "";
}

function normalizePlayerMeta(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const id = Number(
        entry.id
        ?? entry.user_id
        ?? entry.userId
        ?? entry.player_id
        ?? entry.playerId
        ?? entry.user?.id
        ?? entry.profile?.id
    );
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const username = firstNonEmptyString(
        entry.username,
        entry.user_name,
        entry.userName,
        entry.display_name,
        entry.displayName,
        entry.name,
        entry.user?.username,
        entry.user?.name,
        entry.profile?.username,
        entry.profile?.name
    ) || "Unknown";

    const avatar = firstNonEmptyString(
        entry.avatar,
        entry.avatar_url,
        entry.avatarUrl,
        entry.profile_avatar,
        entry.profileAvatar,
        entry.user?.avatar,
        entry.user?.avatar_url,
        entry.user?.avatarUrl,
        entry.profile?.avatar,
        entry.profile?.avatar_url,
        entry.profile?.avatarUrl
    ) || null;

    const hasEvaluationPoints =
        entry.evaluation_points != null
        || entry.evaluationPoints != null
        || entry.wallet_points != null
        || entry.walletPoints != null
        || entry.profile?.evaluation_points != null;

    const evaluationPoints = Math.trunc(
        Number(
            entry.evaluation_points
            ?? entry.evaluationPoints
            ?? entry.wallet_points
            ?? entry.walletPoints
            ?? entry.profile?.evaluation_points
        ) || 0
    );

    return {
        id,
        username,
        avatar,
        ...(hasEvaluationPoints ? { evaluation_points: evaluationPoints } : {}),
    };
}

function parsePlayersMeta(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return [];
    }

    let parsed = value;
    try {
        parsed = JSON.parse(parsed);
        // Accept accidental double-serialization in query params.
        if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
        }
    } catch {
        return [];
    }

    if (!Array.isArray(parsed)) {
        if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.players_meta)) {
                parsed = parsed.players_meta;
            } else if (Array.isArray(parsed.playersMeta)) {
                parsed = parsed.playersMeta;
            } else {
                return [];
            }
        } else {
            return [];
        }
    }

    const byId = new Map();
    for (const entry of parsed) {
        const normalized = normalizePlayerMeta(entry);
        if (!normalized) {
            continue;
        }
        byId.set(normalized.id, normalized);
    }
    return [...byId.values()];
}

function resolveStoredUserId() {
    const candidates = [localStorage.getItem("userId"), localStorage.getItem(PLAYER_ID_KEY)];
    for (const raw of candidates) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
}

function appendTokenQuery(urlValue) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
        return urlValue;
    }

    try {
        const url = new URL(urlValue);
        if (!url.searchParams.get("token")) {
            url.searchParams.set("token", token);
        }
        return url.toString();
    } catch {
        if (/(?:^|[?&])token=/.test(urlValue)) {
            return urlValue;
        }
        const separator = urlValue.includes("?") ? "&" : "?";
        return `${urlValue}${separator}token=${encodeURIComponent(token)}`;
    }
}

function buildUserWsEndpoint(base, userId) {
    if (!base) {
        return "";
    }

    try {
        const url = new URL(base);
        const currentPath = url.pathname || "";
        let nextPath;
        if (currentPath.includes("{userId}")) {
            nextPath = currentPath.replaceAll("{userId}", String(userId));
        } else if (/\/ws\/?$/i.test(currentPath)) {
            nextPath = `${currentPath.replace(/\/+$/, "")}/${userId}`;
        } else {
            nextPath = `${currentPath.replace(/\/+$/, "")}/ws/${userId}`;
        }
        url.pathname = nextPath;
        return appendTokenQuery(url.toString());
    } catch {
        const trimmed = base.replace(/\/+$/, "");

        let endpoint;
        if (trimmed.includes("{userId}")) {
            endpoint = trimmed.replaceAll("{userId}", String(userId));
        } else if (/\/ws$/i.test(trimmed)) {
            endpoint = `${trimmed}/${userId}`;
        } else {
            endpoint = `${trimmed}/ws/${userId}`;
        }

        return appendTokenQuery(endpoint);
    }
}

export function getOrCreatePlayerId() {
    const stored = resolveStoredUserId();
    if (stored) {
        return stored;
    }
    const generated = Math.floor(Math.random() * 900000) + 100000;
    localStorage.setItem(PLAYER_ID_KEY, String(generated));
    return generated;
}

export function resolveWsUrl(explicitUrl, userId) {
    if (explicitUrl) {
        return buildUserWsEndpoint(resolveWsBase(explicitUrl), userId);
    }
    return buildUserWsEndpoint(getWsBase() || getApiBase(), userId);
}

export function buildMultiplayerOptions(options) {
    const params = new URLSearchParams(window.location.search);
    const enabledFromQuery = parseBoolean(params.get("mp"), params.get("mp") === "1");
    const enabled = options?.multiplayer?.enabled ?? enabledFromQuery;
    if (!enabled) {
        return { enabled: false };
    }

    const userId = options?.multiplayer?.userId ?? getOrCreatePlayerId();
    const wsUrl = resolveWsUrl(options?.multiplayer?.wsUrl ?? params.get("ws"), userId);
    const client = options?.multiplayer?.client ?? new GameClient(wsUrl, userId);
    const store = options?.multiplayer?.store ?? createMultiplayerStore();

    const roomId = options?.multiplayer?.roomId ?? params.get("room_id") ?? null;
    const parsedPlayers = parsePlayerList(params.get("players") ?? params.get("match"));
    const players = Array.isArray(options?.multiplayer?.players)
        ? [...options.multiplayer.players]
        : parsedPlayers;

    const parsedPlayersMeta = parsePlayersMeta(params.get("players_meta") ?? params.get("playersMeta"));
    const playersMeta = Array.isArray(options?.multiplayer?.playersMeta)
        ? options.multiplayer.playersMeta
            .map((entry) => normalizePlayerMeta(entry))
            .filter((entry) => entry !== null)
        : parsedPlayersMeta;

    const seedParam = Number(params.get("seed"));
    const parsedSeed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : null;
    const seed = options?.multiplayer?.seed ?? parsedSeed;

    const tickRateParam = Number(params.get("tick_rate"));
    const parsedTickRate = Number.isFinite(tickRateParam) && tickRateParam > 0 ? tickRateParam : null;
    const tickRate = options?.multiplayer?.tickRate ?? parsedTickRate ?? 20;

    const startState = options?.multiplayer?.startState
        ?? options?.multiplayer?.start_state
        ?? null;

    const autoMatchmakeStored = localStorage.getItem("bh_auto_matchmake");
    const autoMatchmakeDefault = parseBoolean(autoMatchmakeStored, true);
    const autoMatchmakeQuery = params.get("auto_matchmake") ?? params.get("auto");
    const autoMatchmake = options?.multiplayer?.autoMatchmake
        ?? parseBoolean(autoMatchmakeQuery, autoMatchmakeDefault);

    return {
        enabled: true,
        userId,
        wsUrl,
        client,
        store,
        roomId,
        players,
        playersMeta,
        seed,
        tickRate,
        startState,
        start_state: startState,
        autoMatchmake,
    };
}
