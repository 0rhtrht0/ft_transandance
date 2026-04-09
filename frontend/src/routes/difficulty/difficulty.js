import { getApiBase } from "../auth/auth_api.js";
import { clearSession, getStoredToken } from "../auth/auth_storage.js";

const VALID_DIFFICULTIES = ["facile", "moyen", "difficile"];

function goToRoute(goTo, route) {
    if (typeof goTo === "function") {
        goTo(route);
        return;
    }
    window.location.href = `/${route}`;
}

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

async function ensureAuthenticated(goTo) {
    const token = getStoredToken();
    if (!token) {
        clearSession();
        goToRoute(goTo, "auth");
        return false;
    }

    try {
        const response = await fetch(`${getApiBase()}/auth/me`, {
            credentials: "include",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
            return true;
        }
        if (response.status === 401 || response.status === 403) {
            clearSession();
            goToRoute(goTo, "auth");
            return false;
        }
        return true;
    } catch {
        return true;
    }
}

export async function init_difficulty(goTo) {
    const allowed = await ensureAuthenticated(goTo);
    if (!allowed) {
        return;
    }

    const scene = document.querySelector(".difficulty-scene");
    setupParallax(scene);

    const choices = Array.from(document.querySelectorAll(".difficulty-choice"));
    const backBtn = document.getElementById("difficulty-back-btn");

    choices.forEach((button) => {
        button.addEventListener("click", () => {
            const difficulty = button.dataset.difficulty || "moyen";
            const normalized = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : "moyen";
            localStorage.setItem("bh_game_difficulty", normalized);
            window.location.href = `/levels?difficulty=${normalized}`;
        });
    });

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            goToRoute(goTo, "menu");
        });
    }
}
