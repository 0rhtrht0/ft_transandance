import re

with open("src/routes/ingame/scene/GameScene.js", "r") as f:
    content = f.read()

old_block = """        let html = "";
        for (let i = 0; i < playerIdsToDisplay.length; i++) {
            const id = playerIdsToDisplay[i];
            const meta = this.getPlayerMeta(id);
            if (!meta) continue;

            const name = meta.username || "Player";
            const fullAvatarUrl = this.resolveAvatarUrl(meta.avatar);
            const isLocal = String(id) === String(localId);
            const displayName = name.length > 15 ? name.substring(0, 15) + "..." : name;

            html += `
                <div class="hud-player-card ${isLocal ? 'local-player' : 'remote-player'}">
                    <img src="${fullAvatarUrl}" class="hud-player-avatar" alt="${displayName}" onerror="this.src='${this.getDefaultAvatarUrl()}'" />
                    <div class="hud-player-copy">
                        <span class="hud-player-name">${displayName}</span>
                        <span class="hud-player-points">EP ${Math.trunc(Number(meta.evaluation_points) || 0)}</span>
                    </div>
                </div>
            `;

            if (i < playerIdsToDisplay.length - 1) {
                html += `<div class="hud-vs-badge">VS</div>`;
            }
        }

        this.topPlayersElement.innerHTML = html;
        this.topPlayersElement.style.display = "flex";
        this.topPlayersElement.classList.add("is-visible");
    }"""

new_block = """        let html = "";
        const participants = [];
        for (let i = 0; i < playerIdsToDisplay.length; i++) {
            const id = playerIdsToDisplay[i];
            const meta = this.getPlayerMeta(id);
            if (!meta) continue;

            const name = meta.username || "Player";
            const fullAvatarUrl = this.resolveAvatarUrl(meta.avatar);
            const isLocal = String(id) === String(localId);
            const displayName = name.length > 15 ? name.substring(0, 15) + "..." : name;
            participants.push(displayName);
            
            const matchScore = meta.matchScore || this.multiplayer?.players?.[id]?.matchScore || 0;

            html += `
                <div class="hud-player-card ${isLocal ? 'local-player' : 'remote-player'}">
                    <img src="${fullAvatarUrl}" class="hud-player-avatar" alt="${displayName}" onerror="this.src='${this.getDefaultAvatarUrl()}'" />
                    <div class="hud-player-copy" style="display:flex; justify-content:space-between; flex-direction:column;">
                        <span class="hud-player-name">${displayName}</span>
                        <div style="display:flex; gap:10px; font-size: 0.85em; opacity: 0.9;">
                            <span class="hud-player-match">Match: ${matchScore}</span>
                            <span class="hud-player-points">EP: ${Math.trunc(Number(meta.evaluation_points) || 0)}</span>
                        </div>
                    </div>
                </div>
            `;

            if (i < playerIdsToDisplay.length - 1) {
                html += `<div class="hud-vs-badge">VS</div>`;
            }
        }

        let waitingOverlay = document.getElementById("waiting-match-overlay");
        
        if (this.waitingForMatch) {
            if (!waitingOverlay) {
                const canvasWrapper = document.querySelector(".canvas-wrapper");
                if (canvasWrapper) {
                    waitingOverlay = document.createElement("div");
                    waitingOverlay.id = "waiting-match-overlay";
                    waitingOverlay.className = "matchmaking-waiting-overlay";
                    canvasWrapper.appendChild(waitingOverlay);
                }
            }
            if (waitingOverlay) {
                const partsText = participants.join(" vs ");
                waitingOverlay.innerHTML = `
                    <div class="matchmaking-status">Waiting for players...</div>
                    <div style="font-size:0.95em; color:#cccccc; margin-bottom: 12px; letter-spacing: 1px;">Players connected: ${participants.length}</div>
                    <div class="matchmaking-participants">${partsText}</div>
                `;
                waitingOverlay.style.display = "block";
            }
        } else {
            if (waitingOverlay) {
                waitingOverlay.style.display = "none";
            }
        }

        this.topPlayersElement.innerHTML = html;
        this.topPlayersElement.style.display = "flex";
        this.topPlayersElement.classList.add("is-visible");
    }"""

if old_block in content:
    with open("src/routes/ingame/scene/GameScene.js", "w") as f:
        f.write(content.replace(old_block, new_block))
    print("Patched!")
else:
    print("Block not found!")
