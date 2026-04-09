export default class GameClient {
    constructor(wsUrl, userId) {
        this.wsUrl = wsUrl;
        this.userId = userId;
        this.ws = null;
        this.roomId = null;
        this.isOpen = false;
        this.pending = [];
        this.onStateUpdate = null;
        this.onMatchFound = null;
        this.onRoomMessage = null;
        this.onClose = null;
    }

    connect() {
        if (this.ws) {
            return;
        }
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = () => {
            this.isOpen = true;
            this.flushPending();
        };
        this.ws.onclose = () => {
            this.isOpen = false;
            if (this.onClose) {
                this.onClose();
            }
        };
        this.ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === "state_update" && this.onStateUpdate) {
                this.onStateUpdate(msg);
            }
            if ((msg.type === "match_found" || msg.type === "match_start") && this.onMatchFound) {
                this.onMatchFound(msg);
            }
            if (msg.type === "room_message" && this.onRoomMessage) {
                this.onRoomMessage(msg);
            }
        };
    }

    setRoomId(roomId) {
        this.roomId = roomId;
    }

    send(type, payload = {}) {
        const message = JSON.stringify({ type, ...payload });
        if (this.isOpen && this.ws) {
            this.ws.send(message);
            return;
        }
        this.pending.push(message);
    }

    flushPending() {
        if (!this.isOpen || !this.ws) {
            return;
        }
        while (this.pending.length > 0) {
            const message = this.pending.shift();
            if (message) {
                this.ws.send(message);
            }
        }
    }

    joinMatchmaking() {
        this.send("join_matchmaking", {});
    }

    leaveMatchmaking() {
        this.send("leave_matchmaking", {});
    }

    sendPlayerState(state) {
        if (!this.roomId) {
            return;
        }
        this.send("player_state", {
            room_id: this.roomId,
            ...state
        });
    }

    sendPlayerFinished(state = {}) {
        if (!this.roomId) {
            return;
        }
        this.send("player_finished", {
            room_id: this.roomId,
            ...state
        });
    }

    sendPlayerAbsorbed(state = {}) {
        if (!this.roomId) {
            return;
        }
        this.send("player_absorbed", {
            room_id: this.roomId,
            ...state
        });
    }

    sendRoomMessage(content) {
        if (!this.roomId) {
            return;
        }
        this.send("room_message", {
            room_id: this.roomId,
            content
        });
    }
}
