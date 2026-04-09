import { getApiBase, readErrorDetail } from "../auth/auth_api.js";
import { clearSession, getStoredToken } from "../auth/auth_storage.js";

const VALID_DIFFICULTIES = ["facile", "moyen", "difficile"];
const MAX_STAGE = 100;

function setupParallax(scene) {
    if (!scene) {
        return () => {};
    }

    const update = (event) => {
        const bounds = scene.getBoundingClientRect();
        const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        scene.style.setProperty("--mx", ratioX.toFixed(3));
        scene.style.setProperty("--my", ratioY.toFixed(3));
    };

    const reset = () => {
        scene.style.setProperty("--mx", "0");
        scene.style.setProperty("--my", "0");
    };

    scene.addEventListener("pointermove", update);
    scene.addEventListener("pointerleave", reset);

    return () => {
        scene.removeEventListener("pointermove", update);
        scene.removeEventListener("pointerleave", reset);
    };
}

function resolveDifficulty() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("difficulty");
    if (fromQuery && VALID_DIFFICULTIES.includes(fromQuery)) {
        return fromQuery;
    }
    const fromStorage = localStorage.getItem("bh_game_difficulty");
    if (fromStorage && VALID_DIFFICULTIES.includes(fromStorage)) {
        return fromStorage;
    }
    return "moyen";
}

function difficultyLabel(difficulty) {
    if (difficulty === "facile") return "Easy";
    if (difficulty === "difficile") return "Hard";
    return "Medium";
}

function redirectToAuth(goTo) {
    clearSession();
    if (typeof goTo === "function") {
        goTo("auth");
        return;
    }
    window.location.href = "/auth";
}

function buildAuthHeaders() {
    const token = getStoredToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

async function fetchProgression(difficulty, goTo) {
    const response = await fetch(`${getApiBase()}/api/progression/me`, {
        credentials: "include",
        headers: buildAuthHeaders()
    });
    if (response.status === 401 || response.status === 403) {
        redirectToAuth(goTo);
        return null;
    }
    if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(detail || "Unable to load progression");
    }
    const data = await response.json();
    return Number(data?.[difficulty]?.current_stage) || 1;
}

async function startStage({ difficulty, stage, goTo }) {
    const response = await fetch(
        `${getApiBase()}/api/progression/start_stage?difficulty=${difficulty}&stage=${stage}`,
        {
            method: "POST",
            credentials: "include",
            headers: buildAuthHeaders()
        }
    );

    if (response.status === 401 || response.status === 403) {
        redirectToAuth(goTo);
        return;
    }
    if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(detail);
    }
    const payload = await response.json();
    if (payload?.config) {
        localStorage.setItem("bh_stage_config", JSON.stringify(payload.config));
    } else {
        localStorage.removeItem("bh_stage_config");
    }

    localStorage.setItem("bh_game_difficulty", difficulty);
    localStorage.setItem("bh_game_stage", String(stage));
    window.location.href = `/ingame?difficulty=${difficulty}&stage=${stage}`;
}

function createLevelButton({ stage, currentStage, onClick }) {
    const button = document.createElement("button");
    button.className = "level-btn";
    button.textContent = String(stage);

    if (stage < currentStage) {
        button.classList.add("completed");
    } else if (stage === currentStage) {
        button.classList.add("current");
    } else {
        button.classList.add("locked");
        button.disabled = true;
    }

    button.addEventListener("click", onClick);
    return button;
}

export async function init_levels(goTo) {
    const scene = document.querySelector(".levels-scene");
    setupParallax(scene);

    const grid = document.getElementById("levels-grid");
    const title = document.getElementById("levels-title");
    const progress = document.getElementById("levels-progress");
    const backMenuBtn = document.getElementById("levels-back-menu");
    const changeDifficultyBtn = document.getElementById("levels-change-difficulty");

    if (!grid || !title || !progress) {
        return;
    }

    const difficulty = resolveDifficulty();
    localStorage.setItem("bh_game_difficulty", difficulty);

    title.textContent = `${difficultyLabel(difficulty)} Levels`;

    try {
        const currentStage = await fetchProgression(difficulty, goTo);
        if (!currentStage) {
            return;
        }

        progress.textContent = `Current progress: ${currentStage} / ${MAX_STAGE}`;
        grid.innerHTML = "";

        for (let stage = 1; stage <= MAX_STAGE; stage += 1) {
            const button = createLevelButton({
                stage,
                currentStage,
                onClick: async () => {
                    if (stage > currentStage) {
                        return;
                    }
                    try {
                        await startStage({ difficulty, stage, goTo });
                    } catch (error) {
                        alert(error?.message || "Unable to start this stage.");
                    }
                }
            });
            grid.appendChild(button);
        }
    } catch (error) {
        console.error(error);
        progress.textContent = error?.message || "Unable to load progression.";
        grid.innerHTML = "";
    }

    if (changeDifficultyBtn) {
        changeDifficultyBtn.addEventListener("click", () => {
            if (typeof goTo === "function") {
                goTo("difficulty");
                return;
            }
            window.location.href = "/difficulty";
        });
    }

    if (backMenuBtn) {
        backMenuBtn.addEventListener("click", () => {
            if (typeof goTo === "function") {
                goTo("menu");
                return;
            }
            window.location.href = "/menu";
        });
    }
}
