/**
 * MultiplayerSelector - Gere les modes multijoueur
 * - Mode Rapide (lobby public)
 * - Le premier entrant devient host et controle le demarrage
 */

export class MultiplayerSelector {
    constructor(apiBase, getApiBase, modalContent, modalFooter) {
        this.apiBase = apiBase || getApiBase();
        this.modalContent = modalContent;
        this.modalFooter = modalFooter;

        this.difficulty = null;
        this.stage = null;

        this.roomCode = null;
        this.roomState = null;
        this.isLaunching = false;

        this.ws = null;
        this.wsReconnectTimer = null;
        this.wsReconnectAttempts = 0;
        this.manualWsClose = false;
        this.pollTimer = null;

        this.lobbyNodes = null;
    }

    resolveAuthHeaders() {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            return {};
        }
        return { Authorization: "Bearer " + token };
    }

    getCurrentUserId() {
        const parsed = Number(localStorage.getItem("userId"));
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
        return null;
    }

    resolveRoomCapacity(roomState = this.roomState) {
        const capacityValue = roomState && typeof roomState === "object" ? roomState.max_players : null;
        const parsed = Math.floor(Number(capacityValue));
        if (Number.isFinite(parsed) && parsed >= 2) {
            return parsed;
        }
        return 2;
    }

    resolveWsEndpoint() {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            return null;
        }

        try {
            const apiUrl = new URL(this.apiBase);
            const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${apiUrl.host}/ws?token=${encodeURIComponent(token)}`;
        } catch {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
        }
    }

    resolveAvatarUrl(avatarPath) {
        if (!avatarPath || typeof avatarPath !== "string") {
            return null;
        }
        if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
            return avatarPath;
        }
        const normalized = avatarPath.startsWith("/") ? avatarPath : "/" + avatarPath;
        return this.apiBase + normalized;
    }

    formatDifficultyLabel(difficulty) {
        if (difficulty === "facile") return "Easy";
        if (difficulty === "difficile") return "Hard";
        return "Medium";
    }

    firstNonEmptyString(...values) {
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

    normalizePlayerMeta(entry) {
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

        const username = this.firstNonEmptyString(
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
        );
        const usernameIsExplicit = Boolean(username);

        const avatar = this.firstNonEmptyString(
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
            username: username || "Unknown",
            avatar,
            evaluation_points: evaluationPoints,
            usernameIsExplicit,
        };
    }

    mergePlayersMeta(playerIds, previousMeta, nextMeta) {
        const safePlayerIds = Array.isArray(playerIds)
            ? playerIds.map((entry) => Number(entry)).filter((id) => Number.isFinite(id) && id > 0)
            : [];

        const cache = new Map();
        for (const source of [previousMeta, nextMeta]) {
            if (!Array.isArray(source)) {
                continue;
            }
            for (const entry of source) {
                const normalized = this.normalizePlayerMeta(entry);
                if (!normalized) {
                    continue;
                }
                const fallbackUsername = "Unknown";
                const existing = cache.get(normalized.id) || {
                    id: normalized.id,
                    username: fallbackUsername,
                    avatar: null,
                };

                cache.set(normalized.id, {
                    id: normalized.id,
                    username: normalized.usernameIsExplicit
                        ? normalized.username
                        : (existing.username || normalized.username || fallbackUsername),
                    avatar: normalized.avatar || existing.avatar || null,
                    evaluation_points: Math.trunc(
                        Number(
                            normalized.evaluation_points
                            ?? existing.evaluation_points
                        ) || 0
                    ),
                });
            }
        }

        return safePlayerIds.map((playerId) => {
            const existing = cache.get(playerId);
            return {
                id: playerId,
                username: existing?.username || "Unknown",
                avatar: existing?.avatar || null,
                evaluation_points: Math.trunc(Number(existing?.evaluation_points) || 0),
            };
        });
    }

    getPlayerMeta(playerId) {
        if (!this.roomState || !Array.isArray(this.roomState.players_meta)) {
            return null;
        }
        return this.roomState.players_meta.find((entry) => Number(entry.id) === Number(playerId)) || null;
    }

    normalizeRoomCode(rawCode) {
        if (typeof rawCode !== "string") {
            return "";
        }
        return rawCode.trim().toLowerCase();
    }

    async readErrorDetail(response) {
        let detail = `Error ${response.status}`;
        try {
            const payload = await response.json();
            if (payload && typeof payload.detail === "string") {
                detail = payload.detail;
            }
        } catch {
            // Ignore malformed error body.
        }
        return detail;
    }

    /**
     * Affiche le selecteur de mode multijoueur
     */
    async show(difficulty, stage) {
        this.cleanupRealtime();
        this.roomCode = null;
        this.roomState = null;
        this.isLaunching = false;
        this.lobbyNodes = null;

        this.difficulty = difficulty;
        this.stage = stage;

        if (!this.modalContent || !this.modalFooter) {
            return;
        }

        const modal = document.getElementById("menu-modal");
        if (modal) {
            modal.classList.add("multiplayer-mode");
        }

        this.modalContent.innerHTML = "";
        this.modalFooter.innerHTML = "";

        const header = document.createElement("div");
        header.className = "multiplayer-selector__header";
        header.innerHTML = `
            <h2>Multiplayer Mode</h2>
            <p>${this.formatDifficultyLabel(difficulty).toUpperCase()} - Stage ${stage}</p>
        `;

        const modeContainer = document.createElement("div");
        modeContainer.className = "multiplayer-selector__modes";

        const rapidMode = this.createRapidModePanel();
        modeContainer.appendChild(rapidMode);

        const closeBtn = document.createElement("button");
        closeBtn.className = "multiplayer-selector__btn-secondary";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", () => this.requestClose());

        this.modalContent.appendChild(header);
        this.modalContent.appendChild(modeContainer);
        this.modalFooter.appendChild(closeBtn);
    }

    createRapidModePanel() {
        const panel = document.createElement("div");
        panel.className = "multiplayer-selector__panel";

        const title = document.createElement("h3");
        title.textContent = "Quick Match";

        const desc = document.createElement("p");
        desc.className = "multiplayer-selector__description";
        desc.textContent = "Join the shared lobby. First player becomes host and starts when everyone is ready.";

        const startBtn = document.createElement("button");
        startBtn.className = "multiplayer-selector__btn-primary";
        startBtn.textContent = "Join Lobby";
        startBtn.addEventListener("click", () => this.startRapidMode());

        panel.appendChild(title);
        panel.appendChild(desc);
        panel.appendChild(startBtn);

        return panel;
    }

    createPrivateModePanel() {
        const panel = document.createElement("div");
        panel.className = "multiplayer-selector__panel";

        const title = document.createElement("h3");
        title.textContent = "Private Room";

        const desc = document.createElement("p");
        desc.className = "multiplayer-selector__description";
        desc.textContent = "Create or join a room, then confirm your ready status.";

        const tabsContainer = document.createElement("div");
        tabsContainer.className = "multiplayer-selector__tabs";

        const createTab = document.createElement("button");
        createTab.className = "multiplayer-selector__tab active";
        createTab.textContent = "Create";

        const joinTab = document.createElement("button");
        joinTab.className = "multiplayer-selector__tab";
        joinTab.textContent = "Join";

        const createContent = document.createElement("div");
        createContent.className = "multiplayer-selector__tab-content active";

        const createDesc = document.createElement("p");
        createDesc.className = "multiplayer-selector__small-text";
        createDesc.textContent = "You will receive a room code to share.";

        const createBtn = document.createElement("button");
        createBtn.className = "multiplayer-selector__btn-primary";
        createBtn.textContent = "Create room";
        createBtn.addEventListener("click", () => this.createRoom());

        createContent.appendChild(createDesc);
        createContent.appendChild(createBtn);

        const joinContent = document.createElement("div");
        joinContent.className = "multiplayer-selector__tab-content";

        const codeInput = document.createElement("input");
        codeInput.type = "text";
        codeInput.className = "multiplayer-selector__code-input";
        codeInput.placeholder = "Room code (e.g. r_ab12cd34)";
        codeInput.maxLength = 24;

        const joinBtn = document.createElement("button");
        joinBtn.className = "multiplayer-selector__btn-primary";
        joinBtn.textContent = "Join";
        joinBtn.addEventListener("click", () => {
            const code = this.normalizeRoomCode(codeInput.value);
            if (code.length >= 3) {
                this.joinRoom(code);
            } else {
                alert("Invalid room code.");
            }
        });

        joinContent.appendChild(codeInput);
        joinContent.appendChild(joinBtn);

        createTab.addEventListener("click", () => {
            createTab.classList.add("active");
            joinTab.classList.remove("active");
            createContent.classList.add("active");
            joinContent.classList.remove("active");
        });

        joinTab.addEventListener("click", () => {
            joinTab.classList.add("active");
            createTab.classList.remove("active");
            joinContent.classList.add("active");
            createContent.classList.remove("active");
        });

        tabsContainer.appendChild(createTab);
        tabsContainer.appendChild(joinTab);

        panel.appendChild(title);
        panel.appendChild(desc);
        panel.appendChild(tabsContainer);
        panel.appendChild(createContent);
        panel.appendChild(joinContent);

        return panel;
    }

    async startRapidMode() {
        await this.quickJoinLobby();
    }

    async quickJoinLobby() {
        try {
            const url = new URL(`${this.apiBase}/api/rooms/quick-join`);
            url.searchParams.set("difficulty", this.difficulty || "moyen");
            url.searchParams.set("stage", String(this.stage || 1));

            const response = await fetch(url.toString(), {
                method: "POST",
                credentials: "include",
                headers: this.resolveAuthHeaders(),
            });

            if (!response.ok) {
                alert(await this.readErrorDetail(response));
                return;
            }

            const data = await response.json();
            const roomState = this.normalizeRoomPayload(data);
            const currentUserId = this.getCurrentUserId();
            const isHost = Number(roomState?.host_id) === Number(currentUserId);
            const isFirstPlayer = Array.isArray(roomState?.players) && roomState.players.length === 1;
            this.openPrivateLobby(data, { justCreated: Boolean(isHost && isFirstPlayer) });
        } catch (error) {
            console.error("quickJoinLobby error", error);
            alert("Unable to join the multiplayer lobby.");
        }
    }

    async createRoom() {
        try {
            const url = new URL(`${this.apiBase}/api/rooms`);
            url.searchParams.set("difficulty", this.difficulty || "moyen");
            url.searchParams.set("stage", String(this.stage || 1));

            const response = await fetch(url.toString(), {
                method: "POST",
                credentials: "include",
                headers: this.resolveAuthHeaders(),
            });

            if (!response.ok) {
                alert(await this.readErrorDetail(response));
                return;
            }

            const data = await response.json();
            this.openPrivateLobby(data, { justCreated: true });
        } catch (error) {
            console.error("createRoom error", error);
            alert("Unable to create the room.");
        }
    }

    async joinRoom(roomCode) {
        try {
            const response = await fetch(`${this.apiBase}/api/rooms/${encodeURIComponent(roomCode)}/join`, {
                method: "POST",
                credentials: "include",
                headers: this.resolveAuthHeaders(),
            });

            if (!response.ok) {
                alert(await this.readErrorDetail(response));
                return;
            }

            const data = await response.json();
            this.openPrivateLobby(data, { justCreated: false });
        } catch (error) {
            console.error("joinRoom error", error);
            alert("Unable to join this room.");
        }
    }

    openPrivateLobby(roomPayload, { justCreated = false } = {}) {
        this.roomCode = this.normalizeRoomCode(roomPayload?.room_id || this.roomCode || "");
        this.roomState = this.mergeRoomState(this.normalizeRoomPayload(roomPayload));
        this.isLaunching = false;

        this.renderPrivateLobby(justCreated);
        this.updateLobbyView();

        this.connectRealtime();
        this.startRoomPolling();
        this.tryAutoLaunchFromState();
    }

    renderPrivateLobby(justCreated) {
        if (!this.modalContent || !this.modalFooter) {
            return;
        }

        this.modalContent.innerHTML = "";
        this.modalFooter.innerHTML = "";

        const header = document.createElement("div");
        header.className = "multiplayer-selector__header";
        header.innerHTML = `
            <h2>Multiplayer Lobby</h2>
            <p>${this.formatDifficultyLabel(this.difficulty || "moyen").toUpperCase()} - Stage ${this.stage || 1}</p>
        `;

        const createdHint = document.createElement("p");
        createdHint.className = "multiplayer-selector__small-text";
        createdHint.textContent = justCreated
            ? "You are host. Wait for players, then start when all joined players are ready."
            : "Lobby joined. Mark yourself ready and wait for host to start.";

        const status = document.createElement("div");
        status.className = "multiplayer-selector__status";

        const players = document.createElement("ul");
        players.className = "multiplayer-selector__players";

        const hint = document.createElement("p");
        hint.className = "multiplayer-selector__small-text";

        const actions = document.createElement("div");
        actions.className = "multiplayer-selector__actions";

        const readyBtn = document.createElement("button");
        readyBtn.className = "multiplayer-selector__btn-primary";
        readyBtn.textContent = "I'm ready";
        readyBtn.addEventListener("click", () => {
            const currentReady = this.isCurrentPlayerReady();
            this.setReady(!currentReady);
        });

        const startBtn = document.createElement("button");
        startBtn.className = "multiplayer-selector__btn-primary";
        startBtn.textContent = "Start match";
        startBtn.addEventListener("click", () => this.startMatch());

        const refreshBtn = document.createElement("button");
        refreshBtn.className = "multiplayer-selector__btn-secondary";
        refreshBtn.textContent = "Refresh";
        refreshBtn.addEventListener("click", () => this.fetchRoomState());

        actions.appendChild(readyBtn);
        actions.appendChild(startBtn);
        actions.appendChild(refreshBtn);

        this.modalContent.appendChild(header);
        this.modalContent.appendChild(createdHint);
        this.modalContent.appendChild(status);
        this.modalContent.appendChild(players);
        this.modalContent.appendChild(hint);
        this.modalContent.appendChild(actions);

        const leaveBtn = document.createElement("button");
        leaveBtn.className = "multiplayer-selector__btn-secondary";
        leaveBtn.textContent = "Leave room";
        leaveBtn.addEventListener("click", () => {
            this.leaveRoomAndClose();
        });

        this.modalFooter.appendChild(leaveBtn);

        this.lobbyNodes = {
            status,
            players,
            hint,
            readyBtn,
            startBtn,
        };
    }

    normalizeRoomPayload(payload) {
        if (!payload || typeof payload !== "object") {
            return null;
        }

        const rawPlayers = Array.isArray(payload.players) ? payload.players : [];
        const players = rawPlayers
            .map((entry) => Number(entry))
            .filter((id) => Number.isFinite(id) && id > 0);

        const rawPlayersMeta = Array.isArray(payload.players_meta)
            ? payload.players_meta
            : (Array.isArray(payload.playersMeta) ? payload.playersMeta : []);
        const playersMeta = rawPlayersMeta
            .map((entry) => this.normalizePlayerMeta(entry))
            .filter((entry) => entry !== null);

        const normalizedPlayers = players.length > 0
            ? players
            : playersMeta.map((entry) => entry.id);

        const rawReady = Array.isArray(payload.ready_players) ? payload.ready_players : [];
        const readyPlayers = rawReady
            .map((entry) => Number(entry))
            .filter((id) => Number.isFinite(id) && id > 0 && normalizedPlayers.includes(id));

        const seedValue = Number(payload.seed);
        const seed = Number.isFinite(seedValue) && seedValue > 0 ? Math.floor(seedValue) : null;

        const stageValue = Number(payload.stage);
        const stage = Number.isFinite(stageValue) && stageValue > 0 ? Math.floor(stageValue) : (this.stage || 1);
        const maxPlayersValue = Number(payload.max_players ?? payload.maxPlayers);
        const maxPlayers = Number.isFinite(maxPlayersValue) && maxPlayersValue >= 2
            ? Math.floor(maxPlayersValue)
            : this.resolveRoomCapacity();

        return {
            room_id: this.normalizeRoomCode(payload.room_id || this.roomCode || ""),
            host_id: Number.isFinite(Number(payload.host_id)) ? Number(payload.host_id) : null,
            max_players: maxPlayers,
            players: normalizedPlayers,
            players_meta: this.mergePlayersMeta(normalizedPlayers, [], playersMeta),
            ready_players: [...new Set(readyPlayers)],
            status: typeof payload.status === "string" ? payload.status : null,
            all_ready: Boolean(payload.all_ready),
            seed,
            difficulty: typeof payload.difficulty === "string" ? payload.difficulty : (this.difficulty || "moyen"),
            stage,
            tick_rate: Number(payload.tick_rate) || null,
        };
    }

    mergeRoomState(nextState) {
        if (!nextState) {
            return this.roomState;
        }
        const previous = this.roomState || {};
        const mergedPlayers = nextState.players.length > 0 ? nextState.players : (previous.players || []);
        const mergedReady = Array.isArray(nextState.ready_players)
            ? nextState.ready_players
            : (previous.ready_players || []);

        const allReadyFromPlayers = mergedPlayers.length > 0
            && mergedPlayers.every((playerId) => mergedReady.includes(playerId));

        return {
            room_id: nextState.room_id || previous.room_id || this.roomCode,
            host_id: nextState.host_id ?? previous.host_id ?? null,
            max_players: this.resolveRoomCapacity(nextState),
            players: mergedPlayers,
            players_meta: this.mergePlayersMeta(
                mergedPlayers,
                previous.players_meta || [],
                nextState.players_meta || []
            ),
            ready_players: mergedReady,
            status: nextState.status || previous.status || "waiting",
            all_ready: Boolean(nextState.all_ready || allReadyFromPlayers),
            seed: nextState.seed || previous.seed || null,
            difficulty: nextState.difficulty || previous.difficulty || this.difficulty,
            stage: nextState.stage || previous.stage || this.stage,
            tick_rate: nextState.tick_rate || previous.tick_rate || null,
        };
    }

    isCurrentPlayerReady() {
        if (!this.roomState) {
            return false;
        }
        const currentUserId = this.getCurrentUserId();
        if (!currentUserId) {
            return false;
        }
        return this.roomState.ready_players.includes(currentUserId);
    }

    updateLobbyView() {
        if (!this.lobbyNodes || !this.roomState) {
            return;
        }

        const { status, players, hint, readyBtn, startBtn } = this.lobbyNodes;
        const playerIds = this.roomState.players || [];
        const readyPlayers = this.roomState.ready_players || [];
        const currentUserId = this.getCurrentUserId();
        const hostId = Number(this.roomState.host_id);
        const roomCapacity = this.resolveRoomCapacity(this.roomState);

        const hasEnoughPlayers = playerIds.length >= 2;
        const missingPlayers = Math.max(0, 2 - playerIds.length);
        const allReady = Boolean(this.roomState.all_ready);
        const currentReady = this.isCurrentPlayerReady();
        const isHost = Number.isFinite(hostId) && Number(currentUserId) === hostId;
        const roomStarted = this.roomState.status === "in_progress";

        let statusText = "";
        if (roomStarted) {
            statusText = "Match is starting...";
            status.classList.add("is-ready");
        } else if (!hasEnoughPlayers) {
            statusText = missingPlayers === 1
                ? "Waiting for 1 more player..."
                : `Waiting for ${missingPlayers} more players...`;
            status.classList.remove("is-ready");
        } else if (!allReady) {
            statusText = `Players connected (${playerIds.length}/${roomCapacity}). Each player must confirm readiness.`;
            status.classList.remove("is-ready");
        } else if (isHost) {
            statusText = "All joined players are ready. You can start the match.";
            status.classList.add("is-ready");
        } else {
            statusText = "All joined players are ready. Waiting for host to start.";
            status.classList.add("is-ready");
        }
        status.textContent = statusText;

        players.innerHTML = "";
        for (const playerId of playerIds) {
            const item = document.createElement("li");
            item.className = "multiplayer-selector__player";

            const playerMain = document.createElement("div");
            playerMain.className = "multiplayer-selector__player-main";

            const playerMeta = this.getPlayerMeta(playerId);
            const avatar = document.createElement("span");
            avatar.className = "multiplayer-selector__player-avatar";

            const avatarUrl = this.resolveAvatarUrl(playerMeta?.avatar || "");
            if (avatarUrl) {
                avatar.style.backgroundImage = `url("${avatarUrl}")`;
                avatar.classList.add("has-image");
                avatar.textContent = "";
            } else {
                avatar.style.backgroundImage = "";
                avatar.classList.remove("has-image");
                avatar.textContent = "◎";
            }

            const name = document.createElement("span");
            name.className = "multiplayer-selector__player-name";
            const displayName = playerMeta?.username || "Unknown";
            const tags = [];
            if (playerId === hostId) {
                tags.push("host");
            }
            if (playerId === currentUserId) {
                tags.push("you");
            }
            if (tags.length > 0) {
                name.textContent = `${displayName} (${tags.join(", ")})`;
            } else {
                name.textContent = displayName;
            }

            const points = document.createElement("span");
            points.className = "multiplayer-selector__player-points";
            points.textContent = `EP ${Math.trunc(Number(playerMeta?.evaluation_points) || 0)}`;

            playerMain.appendChild(avatar);
            playerMain.appendChild(name);
            playerMain.appendChild(points);

            const badge = document.createElement("span");
            const ready = readyPlayers.includes(playerId);
            badge.className = `multiplayer-selector__player-badge ${ready ? "is-ready" : ""}`;
            badge.textContent = ready ? "Ready" : "Waiting";

            item.appendChild(playerMain);
            item.appendChild(badge);
            players.appendChild(item);
        }

        readyBtn.textContent = currentReady ? "Cancel ready" : "I'm ready";
        readyBtn.classList.toggle("is-ready", currentReady);
        readyBtn.disabled = this.isLaunching || roomStarted;
        if (startBtn) {
            startBtn.disabled = this.isLaunching || roomStarted || !isHost || !hasEnoughPlayers || !allReady;
        }

        if (roomStarted) {
            hint.textContent = "Synchronizing game state...";
        } else if (!hasEnoughPlayers) {
            hint.textContent = missingPlayers === 1
                ? "Waiting for 1 more player to join the lobby."
                : `Waiting for ${missingPlayers} more players to join the lobby.`;
        } else if (!currentReady) {
            hint.textContent = "Click I'm ready to confirm that you are ready to play.";
        } else if (!allReady) {
            hint.textContent = "You are ready. Waiting for the other players' confirmation.";
        } else if (isHost) {
            hint.textContent = "All players are ready. Click Start match.";
        } else {
            hint.textContent = "All players are ready. Waiting for host to start.";
        }
    }

    async setReady(ready) {
        if (!this.roomCode) {
            return;
        }

        try {
            const response = await fetch(
                `${this.apiBase}/api/rooms/${encodeURIComponent(this.roomCode)}/ready?ready=${ready ? "true" : "false"}`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: this.resolveAuthHeaders(),
                }
            );

            if (!response.ok) {
                alert(await this.readErrorDetail(response));
                return;
            }

            const data = await response.json();
            this.roomState = this.mergeRoomState(this.normalizeRoomPayload(data));
            this.updateLobbyView();
            this.tryAutoLaunchFromState();
        } catch (error) {
            console.error("setReady error", error);
            alert("Unable to update your ready status.");
        }
    }

    async startMatch() {
        if (!this.roomCode || this.isLaunching) {
            return;
        }

        this.isLaunching = true;
        this.updateLobbyView();

        try {
            const response = await fetch(
                `${this.apiBase}/api/rooms/${encodeURIComponent(this.roomCode)}/start`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: this.resolveAuthHeaders(),
                }
            );

            if (!response.ok) {
                this.isLaunching = false;
                this.updateLobbyView();
                alert(await this.readErrorDetail(response));
                return;
            }

            const payload = await response.json();
            this.handleRealtimeEvent(payload);
        } catch (error) {
            this.isLaunching = false;
            this.updateLobbyView();
            console.error("startMatch error", error);
            alert("Unable to start this match.");
        }
    }

    async fetchRoomState(silent = false) {
        if (!this.roomCode) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/rooms/${encodeURIComponent(this.roomCode)}`, {
                method: "GET",
                credentials: "include",
                headers: this.resolveAuthHeaders(),
            });

            if (!response.ok) {
                if (!silent) {
                    alert(await this.readErrorDetail(response));
                }
                return;
            }

            const payload = await response.json();
            this.roomState = this.mergeRoomState(this.normalizeRoomPayload(payload));
            this.updateLobbyView();
            this.tryAutoLaunchFromState();
        } catch (error) {
            if (!silent) {
                console.error("fetchRoomState error", error);
            }
        }
    }

    connectRealtime() {
        const endpoint = this.resolveWsEndpoint();
        if (!endpoint) {
            return;
        }

        this.disconnectRealtimeSocket();
        this.manualWsClose = false;

        this.ws = new WebSocket(endpoint);

        this.ws.onopen = () => {
            this.wsReconnectAttempts = 0;
            this.fetchRoomState(true);
        };

        this.ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                this.handleRealtimeEvent(payload);
            } catch {
                // Ignore malformed websocket payload.
            }
        };

        this.ws.onclose = () => {
            this.ws = null;
            if (this.manualWsClose || !this.roomCode || this.isLaunching) {
                return;
            }
            this.wsReconnectAttempts += 1;
            const delay = Math.min(12000, 500 * 2 ** this.wsReconnectAttempts);
            this.wsReconnectTimer = window.setTimeout(() => {
                this.connectRealtime();
            }, delay);
        };
    }

    handleRealtimeEvent(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }

        const roomId = this.normalizeRoomCode(payload.room_id || "");
        if (roomId && this.roomCode && roomId !== this.roomCode) {
            return;
        }

        const eventType = payload.event || payload.type;

        if (eventType === "room.match_start" || payload.type === "match_start") {
            const nextState = this.mergeRoomState(this.normalizeRoomPayload(payload));
            this.launchPrivateGame(nextState);
            return;
        }

        if (eventType === "room.closed" || payload.type === "room_closed") {
            this.roomCode = null;
            this.roomState = null;
            this.cleanupRealtime();
            this.requestClose();
            return;
        }

        const nextState = this.normalizeRoomPayload(payload);
        if (!nextState) {
            return;
        }

        this.roomState = this.mergeRoomState(nextState);
        this.updateLobbyView();
        this.tryAutoLaunchFromState();
    }

    startRoomPolling() {
        this.stopRoomPolling();
        this.pollTimer = window.setInterval(() => {
            this.fetchRoomState(true);
        }, 2500);
    }

    stopRoomPolling() {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    disconnectRealtimeSocket() {
        if (this.wsReconnectTimer !== null) {
            window.clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }

        if (this.ws) {
            this.manualWsClose = true;
            this.ws.close();
            this.ws = null;
        }
    }

    cleanupRealtime() {
        this.stopRoomPolling();
        this.disconnectRealtimeSocket();
    }

    tryAutoLaunchFromState() {
        if (!this.roomState || this.isLaunching) {
            return;
        }

        const hasEnoughPlayers = Array.isArray(this.roomState.players) && this.roomState.players.length >= 2;
        const started = this.roomState.status === "in_progress";
        if (!hasEnoughPlayers || !started || !this.roomState.seed) {
            return;
        }

        this.launchPrivateGame(this.roomState);
    }

    launchPrivateGame(state) {
        if (!state) {
            return;
        }

        const roomCode = this.normalizeRoomCode(state.room_id || this.roomCode || "");
        const players = Array.isArray(state.players) ? state.players : [];
        const seed = Number(state.seed);
        if (!roomCode || players.length < 2 || !Number.isFinite(seed) || seed <= 0) {
            return;
        }

        this.isLaunching = true;

        this.launchGame({
            roomCode,
            players,
            playersMeta: Array.isArray(state.players_meta) ? state.players_meta : null,
            seed,
            difficulty: state.difficulty || this.difficulty,
            stage: state.stage || this.stage,
            tickRate: Number(state.tick_rate) || null,
            autoMatchmake: false,
        });
    }

    async leaveRoomAndClose() {
        await this.leaveRoom();
        this.roomCode = null;
        this.roomState = null;
        this.isLaunching = false;
        this.cleanupRealtime();
        this.requestClose();
    }

    async leaveRoom() {
        if (!this.roomCode) {
            return;
        }

        try {
            await fetch(`${this.apiBase}/api/rooms/${encodeURIComponent(this.roomCode)}/leave`, {
                method: "POST",
                credentials: "include",
                headers: this.resolveAuthHeaders(),
            });
        } catch {
            // Ignore leave errors on close/redirect.
        }
    }

    handleModalClosed() {
        if (this.roomCode && !this.isLaunching) {
            this.leaveRoom();
        }
        this.cleanupRealtime();
        this.roomCode = null;
        this.roomState = null;
        this.isLaunching = false;
        this.lobbyNodes = null;
    }

    requestClose() {
        this.handleModalClosed();
        this.hide();

        const modal = document.getElementById("menu-modal");
        if (modal) {
            modal.classList.remove("is-open");
            modal.classList.remove("profile-mode");
            modal.classList.remove("history-mode");
            modal.classList.remove("leaderboard-mode");
            modal.classList.remove("multiplayer-mode");
            modal.setAttribute("aria-hidden", "true");
        }
    }

    launchGame({
        roomCode = null,
        players = null,
        playersMeta = null,
        seed = null,
        difficulty = null,
        stage = null,
        tickRate = null,
        autoMatchmake = true,
    } = {}) {
        const params = new URLSearchParams();
        params.set("mp", "1");
        params.set("difficulty", String(difficulty || this.difficulty || "moyen"));
        params.set("stage", String(stage || this.stage || 1));
        params.set("auto_matchmake", autoMatchmake ? "1" : "0");

        if (roomCode) {
            params.set("room_id", roomCode);
        }
        if (Array.isArray(players) && players.length > 0) {
            params.set("players", players.join(","));
        }
        if (Array.isArray(playersMeta) && playersMeta.length > 0) {
            params.set("players_meta", JSON.stringify(playersMeta));
        }
        if (Number.isFinite(Number(seed)) && Number(seed) > 0) {
            params.set("seed", String(Math.floor(Number(seed))));
        }
        if (Number.isFinite(Number(tickRate)) && Number(tickRate) > 0) {
            params.set("tick_rate", String(Math.floor(Number(tickRate))));
        }

        this.cleanupRealtime();
        this.hide();
        window.location.href = `/ingame?${params.toString()}`;
    }

    hide() {
        const modal = document.getElementById("menu-modal");
        if (modal) {
            modal.classList.remove("multiplayer-mode");
        }
        if (this.modalContent) {
            this.modalContent.innerHTML = "";
        }
        if (this.modalFooter) {
            this.modalFooter.innerHTML = "";
        }
    }
}
