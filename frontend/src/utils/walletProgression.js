const RESULT_SNAPSHOT_KEY = "bh_last_result_snapshot";
const WALLET_BALANCE_CACHE_KEY = "bh_wallet_balance_cache";

const ACHIEVEMENT_CATALOG = {
    first_escape: {
        code: "first_escape",
        label: "First Escape",
        description: "Escape the black hole once.",
    },
    steady_orbit: {
        code: "steady_orbit",
        label: "Steady Orbit",
        description: "Reach 5 wallet EP.",
    },
    event_horizon_master: {
        code: "event_horizon_master",
        label: "Event Horizon Master",
        description: "Reach 10 wallet EP.",
    },
    multiplayer_contender: {
        code: "multiplayer_contender",
        label: "Multiplayer Contender",
        description: "Win 3 multiplayer matches.",
    },
    void_wanderer: {
        code: "void_wanderer",
        label: "Void Wanderer",
        description: "Win 5 total matches.",
    },
    stellar_collector: {
        code: "stellar_collector",
        label: "Stellar Collector",
        description: "Reach 25 wallet EP.",
    },
    galactic_champion: {
        code: "galactic_champion",
        label: "Galactic Champion",
        description: "Win 10 multiplayer matches.",
    },
    blackhole_survivor: {
        code: "blackhole_survivor",
        label: "Blackhole Survivor",
        description: "Win 20 total matches.",
    },
    cosmic_legend: {
        code: "cosmic_legend",
        label: "Cosmic Legend",
        description: "Reach 50 wallet EP.",
    },
};

function parseFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function getWalletAchievementPresentation(code) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
        return {
            code: "",
            label: "Achievement",
            description: "Progress milestone unlocked.",
        };
    }
    return ACHIEVEMENT_CATALOG[normalizedCode] || {
        code: normalizedCode,
        label: normalizedCode.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: "Progress milestone unlocked.",
    };
}

export function listWalletAchievementPresentations(codes) {
    if (!Array.isArray(codes)) {
        return [];
    }
    return codes.map((code) => getWalletAchievementPresentation(code));
}

export function formatWalletDelta(value) {
    const delta = Math.trunc(parseFiniteNumber(value, 0));
    if (delta > 0) {
        return `+${delta}`;
    }
    return `${delta}`;
}

export function readCachedWalletBalance() {
    const storage = getStorage();
    if (!storage) {
        return 0;
    }

    const cachedValue = parseFiniteNumber(storage.getItem(WALLET_BALANCE_CACHE_KEY), NaN);
    if (Number.isFinite(cachedValue)) {
        return cachedValue;
    }

    const lastSnapshot = readLastResultSnapshot();
    return parseFiniteNumber(lastSnapshot?.wallet_balance, 0);
}

export function storeCachedWalletBalance(value) {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    const nextValue = Math.trunc(parseFiniteNumber(value, 0));
    storage.setItem(WALLET_BALANCE_CACHE_KEY, String(nextValue));
}

export function readLastResultSnapshot() {
    const storage = getStorage();
    if (!storage) {
        return null;
    }

    try {
        const raw = storage.getItem(RESULT_SNAPSHOT_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function saveLastResultSnapshot(snapshot) {
    const storage = getStorage();
    if (!storage || !snapshot || typeof snapshot !== "object") {
        return null;
    }

    const nextSnapshot = {
        ...snapshot,
        evaluation_points: Math.trunc(parseFiniteNumber(snapshot.evaluation_points, 0)),
        wallet_balance: Math.trunc(parseFiniteNumber(snapshot.wallet_balance, 0)),
        unlocked_achievements: Array.isArray(snapshot.unlocked_achievements)
            ? [...snapshot.unlocked_achievements]
            : [],
        players: Array.isArray(snapshot.players)
            ? snapshot.players.map((player) => ({
                ...player,
                before_points: Math.trunc(parseFiniteNumber(player?.before_points, 0)),
                delta: Math.trunc(parseFiniteNumber(player?.delta, 0)),
                after_points: Math.trunc(parseFiniteNumber(player?.after_points, 0)),
            }))
            : [],
        updated_at: snapshot.updated_at || new Date().toISOString(),
    };

    storage.setItem(RESULT_SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
    storeCachedWalletBalance(nextSnapshot.wallet_balance);
    return nextSnapshot;
}

export function mergeLastResultSnapshot(patch) {
    const previous = readLastResultSnapshot() || {};
    return saveLastResultSnapshot({
        ...previous,
        ...(patch || {}),
    });
}

export function clearLastResultSnapshot() {
    const storage = getStorage();
    if (!storage) {
        return;
    }
    storage.removeItem(RESULT_SNAPSHOT_KEY);
}
