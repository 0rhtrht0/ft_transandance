import {
    ClientToServerEvents,
    GameEvents,
    ServerToClientEvents
} from "./events.js";

export const PROTOCOL_VERSION = 1;

export const DISCONNECT_REASONS = Object.freeze([
    "quit",
    "timeout",
    "network"
]);

export const DEFAULT_MATCH_CONFIG = Object.freeze({
    tickRateHz: 20,
    maze: {
        rows: 61,
        cols: 61,
        tileSize: 28
    }
});

export const PROTOCOL = Object.freeze({
    version: PROTOCOL_VERSION,
    events: GameEvents,
    flow: {
        clientToServer: ClientToServerEvents,
        serverToClient: ServerToClientEvents
    },
    defaults: DEFAULT_MATCH_CONFIG
});
