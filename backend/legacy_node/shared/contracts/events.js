export const GameEvents = Object.freeze({
    JOIN: "join",
    JOIN_ACK: "join_ack",
    STATE_UPDATE: "state_update",
    DISCONNECT: "disconnect"
});

export const ClientToServerEvents = Object.freeze([
    GameEvents.JOIN,
    GameEvents.DISCONNECT
]);

export const ServerToClientEvents = Object.freeze([
    GameEvents.JOIN_ACK,
    GameEvents.STATE_UPDATE,
    GameEvents.DISCONNECT
]);
