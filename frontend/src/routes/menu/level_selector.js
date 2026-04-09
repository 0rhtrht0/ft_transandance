export class LevelSelector {
    constructor(apiBase, getApiBase, modalContent, modalFooter) {
        this.apiBase = apiBase || getApiBase();
        this.modalContent = modalContent;
        this.modalFooter = modalFooter;
        this.currentDifficulty = null;
        this.progression = null;
        this.maxLevel = 100;
    }

    resolveAuthHeaders() {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            return {};
        }
        return { Authorization: `Bearer ${token}` };
    }

    /**
     * Affiche le sélecteur de niveaux
     * @param {string} difficulty - "facile", "moyen", "difficile"
     * @param {object} progressionData - Les données de progression pour cette difficulté
     */
    async show(difficulty, progressionData) {
        this.currentDifficulty = difficulty;
        this.progression = progressionData;

        if (!this.modalContent || !this.modalFooter) {
            return;
        }

        this.modalContent.innerHTML = "";
        this.modalFooter.innerHTML = "";

        const header = document.createElement("div");
        header.className = "level-selector__header";
        header.innerHTML = `
            <h2>${difficulty.toUpperCase()}</h2>
            <p>Progress: ${progressionData.current_stage} / ${this.maxLevel}</p>
        `;

        const grid = document.createElement("div");
        grid.className = "level-selector__grid";

        for (let level = 1; level <= this.maxLevel; level++) {
            const levelBtn = this.createLevelButton(level, progressionData.current_stage);
            grid.appendChild(levelBtn);
        }

        const closeBtn = document.createElement("button");
        closeBtn.className = "level-selector__close-btn";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", () => {
            this.hide();
        });

        this.modalContent.appendChild(header);
        this.modalContent.appendChild(grid);
        this.modalFooter.appendChild(closeBtn);
    }

    createLevelButton(level, maxLevel) {
        const btn = document.createElement("button");
        btn.className = "level-selector__level-btn";
        btn.textContent = level;

        if (level > maxLevel) {
            btn.classList.add("locked");
            btn.disabled = true;
            btn.title = "Locked";
        } else if (level === maxLevel) {
            btn.classList.add("current");
            btn.title = "Current level";
        } else {
            btn.classList.add("completed");
            btn.innerHTML = `${level} <span class="check-mark">✓</span>`;
            btn.title = "Completed level";
        }

        btn.addEventListener("click", () => {
            if (!btn.disabled) {
                this.selectLevel(level);
            }
        });

        return btn;
    }

    async selectLevel(level) {
        try {
            const response = await fetch(
                `${this.apiBase}/api/progression/start_stage?difficulty=${this.currentDifficulty}&stage=${level}`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: this.resolveAuthHeaders()
                }
            );

            if (response.status === 401 || response.status === 403) {
                alert("Session expired. Please sign in again.");
                window.location.href = "/auth";
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                alert(`Error: ${error.detail}`);
                return;
            }

            const payload = await response.json();
            const stageConfig = payload?.config;
            if (stageConfig) {
                localStorage.setItem("bh_stage_config", JSON.stringify(stageConfig));
            } else {
                localStorage.removeItem("bh_stage_config");
            }

            localStorage.setItem("bh_game_difficulty", this.currentDifficulty);
            localStorage.setItem("bh_game_stage", String(level));
            this.launchGame(this.currentDifficulty, level);
        } catch (error) {
            console.error("Error:", error);
            alert("Unable to launch this level.");
        }
    }

    launchGame(difficulty, level) {
        window.location.href = `/ingame?difficulty=${difficulty}&stage=${level}`;
    }

    hide() {
        if (this.modalContent) {
            this.modalContent.innerHTML = "";
        }
        if (this.modalFooter) {
            this.modalFooter.innerHTML = "";
        }
    }
}
