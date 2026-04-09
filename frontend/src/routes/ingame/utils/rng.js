export function normalizeSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) {
        return seed >>> 0;
    }
    if (typeof seed === "string") {
        let hash = 2166136261;
        for (let i = 0; i < seed.length; i += 1) {
            hash ^= seed.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
    return Math.floor(Math.random() * 0x7fffffff) >>> 0;
}

export function createRng(seed) {
    let state = normalizeSeed(seed) || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
