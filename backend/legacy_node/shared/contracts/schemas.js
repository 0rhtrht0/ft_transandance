export const schemas = Object.freeze({
    join: {
        required: ["v", "playerName", "clientTime"]
    },
    join_ack: {
        required: ["v", "playerId", "matchId", "spawn", "maze", "serverTime"]
    },
    state_update: {
        required: ["v", "matchId", "tick", "players", "serverTime"]
    },
    disconnect: {
        required: ["v", "playerId", "reason"]
    }
});

export function validatePayload(eventName, payload) {
    const schema = schemas[eventName];
    if (!schema || !schema.required) {
        return false;
    }
    if (!payload || typeof payload !== "object") {
        return false;
    }
    for (const key of schema.required) {
        if (!(key in payload)) {
            return false;
        }
    }
    return true;
}
