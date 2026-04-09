import { buildRestartRoute } from "../ingame/ingame_restart.js";
import {
    formatWalletDelta,
    getWalletAchievementPresentation,
    readCachedWalletBalance,
    readLastResultSnapshot,
} from "../../utils/walletProgression.js";

export function init_gameover(goTo) {
    const gameoverRoot = document.querySelector(".gameover");
    const lineElement = document.getElementById("line");
    const resultSummaryElement = document.getElementById("result-summary");
    const achievementPopupElement = document.getElementById("achievement-popup");
    const actionsElement = document.getElementById("gameover-actions");
    const restartButton = document.getElementById("restart-btn");
    const quitButton = document.getElementById("quit-btn");
    
    let actionsTimeoutId = null;
    let achievementTimeoutId = null;

    const username = localStorage.getItem("playerName") || localStorage.getItem("bh_username") || "Player";
    const deathLine = `> ${username} has been consumed by the singularity`;

    const clearTimers = () => {
        if (actionsTimeoutId !== null) {
            clearTimeout(actionsTimeoutId);
            actionsTimeoutId = null;
        }
        if (achievementTimeoutId !== null) {
            clearTimeout(achievementTimeoutId);
            achievementTimeoutId = null;
        }
    };

    const cleanup = () => {
        clearTimers();
        gameoverRoot?.removeEventListener("pointerdown", handleSkipPointerDown);
    };

    function restartGame() {
        cleanup();
        if (typeof goTo === "function") {
            goTo(buildRestartRoute());
        }
    }

    function handleSkipPointerDown(event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        if (event.target.closest('button')) {
            return;
        }
        restartGame();
    }

    gameoverRoot?.addEventListener("pointerdown", handleSkipPointerDown);

    const snapshot = readLastResultSnapshot() || {
        result: "defeat",
        evaluation_points: 0,
        wallet_balance: readCachedWalletBalance(),
        is_multiplayer: false,
        players: [],
        unlocked_achievements: []
    };

    if (resultSummaryElement) {
        // ... (keep original logic)
        const players = Array.isArray(snapshot?.players) ? snapshot.players.slice(0, 4) : [];
        const playersMarkup = Boolean(snapshot?.is_multiplayer) && players.length > 1
            ? `
                <div class="result-summary__players">
                    ${players.map((player) => `
                        <article class="result-player-card${player?.is_local ? " is-local" : ""}">
                            <span>${player?.username || "Player"}</span>
                            <strong>${(Number(player?.delta) || 0) > 0 ? `+${player.delta}` : (Number(player?.delta) || 0)} EP</strong>
                            <small>Wallet ${Math.trunc(Number(player?.after_points) || 0)} EP</small>
                        </article>
                    `).join("")}
                </div>
            `
            : "";

        const content = playersMarkup ? `${playersMarkup}` : "";

        if (content) {
            resultSummaryElement.innerHTML = content;
            resultSummaryElement.classList.remove("hidden");
            resultSummaryElement.classList.add("fade-in");
        }
    }

    // ... (achievement setup)

    if (lineElement) {
        lineElement.textContent = deathLine;
        lineElement.classList.remove("hidden");
        lineElement.classList.add("fade-in");
        lineElement.classList.add("delay-fade-in"); // We can handle the delay in CSS maybe
    }

    actionsTimeoutId = setTimeout(() => {
        if (actionsElement) {
            actionsElement.classList.remove("hidden");
            actionsElement.classList.add("fade-in");
        }
    }, 3000);

    restartButton?.addEventListener("click", () => {
        restartGame();
    });

    quitButton?.addEventListener("click", () => {
        cleanup();
        if (typeof goTo === "function") {
            goTo("menu");
        }
    });
}
