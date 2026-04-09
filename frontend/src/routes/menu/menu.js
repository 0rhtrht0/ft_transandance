import { getApiBase, readErrorDetail } from "../auth/auth_api.js";
import { LevelSelector } from "./level_selector.js";
import { MultiplayerSelector } from "./multiplayer_selector.js";
import {
    STORAGE_KEYS,
    clearSession,
    getStoredToken,
    storeAuthToken,
    storeSession,
    storeUserId
} from "../auth/auth_storage.js";

import { USERNAME_MAX_LENGTH, getUsernameValidationMessage } from "../../utils/usernameValidation.js";
import {
    formatWalletDelta,
    getWalletAchievementPresentation,
} from "../../utils/walletProgression.js";

function setupGalaxySimulation(scene) {
    if (!scene) {
        return () => {};
    }

    const canvas = scene.querySelector(".galaxy-canvas");
    if (!canvas) {
        return () => {};
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
        return () => {};
    }

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const TAU = Math.PI * 2;
    const armCount = 4;
    const diskAxis = 0.57;
    let backgroundStars = [];
    let bulgeStars = [];
    let diskStars = [];
    let dustLanes = [];
    let width = 0;
    let height = 0;
    let diskRadius = 0;
    let bulgeRadius = 0;
    let rafId = 0;

    const randomBetween = (min, max) => min + Math.random() * (max - min);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const parseRatio = (value) =>
        {
            const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed))
        {
            return parsed;
        }
        return 0;
    };

    const randomNormal = () => {
        let u = 0;
        let v = 0;
        while (u === 0)
        {
            u = Math.random();
        }
        while (v === 0) {
            v = Math.random();
        }
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };

    const getAngularVelocity = (radius) => {
        const normalized = radius / Math.max(diskRadius, 1);
        const flatCurve = 0.22 + Math.sqrt(normalized + 0.02);
        return 0.00018 / flatCurve + 0.00002;
    };

    const createBackgroundStars = () => {
        let starCount;
        if (width < 760) {
            starCount = 170;
        } else {
            starCount = 320;
        }
        backgroundStars = Array.from({ length: starCount }, () => {
            const cool = Math.round(randomBetween(170, 240));
            const blue = Math.round(randomBetween(205, 255));
            return {
                alpha: randomBetween(0.14, 0.52),
                color: `rgb(${Math.round(cool * 0.78)}, ${cool}, ${blue})`,
                parallaxX: randomBetween(-28, 28),
                parallaxY: randomBetween(-18, 18),
                phase: randomBetween(0, TAU),
                size: randomBetween(0.18, 1.15),
                twinkle: randomBetween(0.00045, 0.0012),
                x: Math.random(),
                y: Math.random()
            };
        });
    };

    const createBulgeStars = () => {
        let starCount;
        if (width < 760) {
            starCount = 240;
        } else {
            starCount = 420;
        }
        bulgeStars = Array.from({ length: starCount }, () => {
            const spread = Math.pow(Math.random(), 1.9);
            const radius = spread * bulgeRadius;
            const luminosity = clamp(0.45 + (1 - spread) * 0.55 + randomBetween(-0.08, 0.08), 0.25, 1);
            const gray = Math.round(80 + luminosity * 140);
            const red = gray;
            const green = gray;
            const blue = gray;

            return {
                angle: randomBetween(0, TAU),
                color: `rgb(${red}, ${green}, ${blue})`,
                luminosity,
                phase: randomBetween(0, TAU),
                radialJitter: randomBetween(0.2, 3.4),
                radialOscillation: randomBetween(0.0008, 0.0018),
                radius,
                size: randomBetween(0.22, 1.45) * (1.22 - spread * 0.48),
                spin: getAngularVelocity(radius * 0.8) * randomBetween(1.04, 1.35),
                twinkle: randomBetween(0.0015, 0.0033)
            };
        });
    };

    const createDiskStars = () => {
        let starCount;
        if (width < 760) {
            starCount = 760;
        } else {
            starCount = 1420;
        }
        diskStars = Array.from({ length: starCount }, () => {
            const spread = Math.pow(Math.random(), 0.72);
            const radius = spread * diskRadius;
            const arm = Math.floor(Math.random() * armCount);
            const armBase = (arm / armCount) * TAU;
            const spiralPhase = Math.log1p(spread * 7.2) * 3.1;
            const armScatter = randomNormal() * (0.045 + spread * 0.34);
            const luminosity = clamp(0.28 + (1 - spread) * 0.55 + randomBetween(-0.1, 0.08), 0.12, 0.95);
            const gray = Math.round(60 + luminosity * 150);
            const red = gray;
            const green = gray;
            const blue = gray;

            return {
                angle: armBase + spiralPhase + armScatter,
                color: `rgb(${red}, ${green}, ${blue})`,
                luminosity,
                phase: randomBetween(0, TAU),
                radialJitter: randomBetween(0.5, 6.8) * (0.28 + spread),
                radialOscillation: randomBetween(0.00035, 0.0012),
                radius,
                size: randomBetween(0.14, 1.28) * (1.12 - spread * 0.54),
                spin: getAngularVelocity(radius) * randomBetween(0.86, 1.18),
                twinkle: randomBetween(0.0007, 0.002)
            };
        });
    };

    const createDustLanes = () => {
        let laneCount;
        if (width < 760) {
            laneCount = 120;
        } else {
            laneCount = 220;
        }
        dustLanes = Array.from({ length: laneCount }, () => {
            const spread = randomBetween(0.14, 0.74);
            const radius = spread * diskRadius;
            const arm = Math.floor(Math.random() * armCount);
            const armBase = (arm / armCount) * TAU;
            const spiralPhase = Math.log1p(spread * 7.2) * 3.1;
            const trailingOffset = 0.26 + randomBetween(-0.08, 0.18);

            return {
                alpha: randomBetween(0.06, 0.2) * (1.1 - spread * 0.6),
                angle: armBase + spiralPhase + trailingOffset + randomNormal() * 0.13,
                length: randomBetween(12, 58) * (1.1 - spread * 0.36),
                phase: randomBetween(0, TAU),
                radialJitter: randomBetween(0.4, 5.4),
                radialOscillation: randomBetween(0.00028, 0.0011),
                radius,
                spin: getAngularVelocity(radius) * randomBetween(0.82, 1.08),
                thickness: randomBetween(1.2, 4.6) * (1.16 - spread * 0.42),
                twinkle: randomBetween(0.0005, 0.0016)
            };
        });
    };

    const createGalaxyModel = () => {
        diskRadius = Math.min(width, height) * 0.48;
        bulgeRadius = diskRadius * 0.2;
        createBackgroundStars();
        createBulgeStars();
        createDiskStars();
        createDustLanes();
    };

    const drawBackgroundStars = (time, mx, my) => {
        context.save();
        for (const star of backgroundStars) {
            const pulse = 0.65 + 0.35 * Math.sin(time * star.twinkle + star.phase);
            context.globalAlpha = star.alpha * pulse;
            context.fillStyle = star.color;
            context.beginPath();
            context.arc(
                star.x * width + mx * star.parallaxX,
                star.y * height + my * star.parallaxY,
                star.size * (0.82 + pulse * 0.35),
                0,
                TAU
            );
            context.fill();
        }
        context.restore();
        context.globalAlpha = 1;
    };

    const drawDiffuseDisk = (centerX, centerY, time) => {
        const breathing = 1 + Math.sin(time * 0.00014) * 0.015;

        context.save();
        context.translate(centerX, centerY);
        context.scale(1, diskAxis);

        const halo = context.createRadialGradient(0, 0, 0, 0, 0, diskRadius * 1.16 * breathing);
        halo.addColorStop(0, "rgba(80, 80, 80, 0.24)");
        halo.addColorStop(0.12, "rgba(50, 50, 50, 0.22)");
        halo.addColorStop(0.36, "rgba(255, 255, 255, 0.09)");
        halo.addColorStop(0.68, "rgba(60, 60, 60, 0.06)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = halo;
        context.beginPath();
        context.arc(0, 0, diskRadius * 1.16 * breathing, 0, TAU);
        context.fill();

        const coreHalo = context.createRadialGradient(0, 0, 0, 0, 0, bulgeRadius * 2.8);
        coreHalo.addColorStop(0, "rgba(50, 50, 50, 0.34)");
        coreHalo.addColorStop(0.24, "rgba(70, 70, 70, 0.21)");
        coreHalo.addColorStop(0.58, "rgba(60, 60, 60, 0.08)");
        coreHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = coreHalo;
        context.beginPath();
        context.arc(0, 0, bulgeRadius * 2.8, 0, TAU);
        context.fill();

        context.rotate(0.34);
        const bar = context.createLinearGradient(-bulgeRadius * 2.1, 0, bulgeRadius * 2.1, 0);
        bar.addColorStop(0, "rgba(0, 0, 0, 0)");
        bar.addColorStop(0.24, "rgba(70, 70, 70, 0.14)");
        bar.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
        bar.addColorStop(0.76, "rgba(60, 60, 60, 0.1)");
        bar.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = bar;
        context.fillRect(-bulgeRadius * 2.1, -bulgeRadius * 0.48, bulgeRadius * 4.2, bulgeRadius * 0.96);
        context.restore();
    };

    const drawDustLanes = (time, centerX, centerY) => {
        context.save();
        for (const lane of dustLanes) {
            const radius = lane.radius + Math.sin(time * lane.radialOscillation + lane.phase) * lane.radialJitter;
            const angle = lane.angle + time * lane.spin;
            const pulse = 0.82 + 0.18 * Math.sin(time * lane.twinkle + lane.phase);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * diskAxis;

            context.save();
            context.translate(x, y);
            context.rotate(angle + Math.PI * 0.5);
            context.scale(1, diskAxis);
            context.globalAlpha = lane.alpha * pulse;
            context.fillStyle = "rgba(15, 15, 15, 0.95)";
            context.beginPath();
            context.ellipse(0, 0, lane.length, lane.thickness, 0, 0, TAU);
            context.fill();
            context.restore();
        }
        context.restore();
        context.globalAlpha = 1;
    };

    const drawStarPopulation = (population, time, centerX, centerY, axis) => {
        context.save();
        for (const star of population) {
            const radius = star.radius + Math.sin(time * star.radialOscillation + star.phase) * star.radialJitter;
            const angle = star.angle + time * star.spin;
            const pulse = 0.5 + 0.5 * Math.sin(time * star.twinkle + star.phase);
            const alpha = star.luminosity * (0.32 + pulse * 0.68);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * axis;

            context.globalAlpha = alpha;
            context.fillStyle = star.color;
            context.beginPath();
            context.arc(x, y, star.size * (0.82 + pulse * 0.5), 0, TAU);
            context.fill();
        }
        context.restore();
        context.globalAlpha = 1;
    };

    const drawNucleus = (centerX, centerY) => {
        context.save();
        context.translate(centerX, centerY);
        context.scale(1, 0.72);
        const nucleus = context.createRadialGradient(0, 0, 0, 0, 0, bulgeRadius * 0.95);
        nucleus.addColorStop(0, "rgba(80, 80, 80, 0.48)");
        nucleus.addColorStop(0.28, "rgba(50, 50, 50, 0.28)");
        nucleus.addColorStop(0.62, "rgba(40, 40, 40, 0.12)");
        nucleus.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = nucleus;
        context.beginPath();
        context.arc(0, 0, bulgeRadius * 0.95, 0, TAU);
        context.fill();
        context.restore();
    };

    const drawGalaxy = (time) => {
        const mx = parseRatio(scene.style.getPropertyValue("--mx"));
        const my = parseRatio(scene.style.getPropertyValue("--my"));
        const centerX = width * 0.5 + mx * 44;
        const centerY = height * 0.54 + my * 30;

        context.clearRect(0, 0, width, height);
        drawBackgroundStars(time, mx, my);
        drawDiffuseDisk(centerX, centerY, time);
        drawDustLanes(time, centerX, centerY);
        drawStarPopulation(diskStars, time, centerX, centerY, diskAxis);
        drawStarPopulation(bulgeStars, time, centerX, centerY, 0.84);
        drawNucleus(centerX, centerY);
    };

    const resizeCanvas = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        createGalaxyModel();
        drawGalaxy(performance.now());
    };

    const renderLoop = (time) => {
        drawGalaxy(time);
        rafId = window.requestAnimationFrame(renderLoop);
    };

    const stopAnimation = () => {
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
    };

    const startAnimation = () => {
        if (!rafId && !reduceMotionQuery.matches) {
            rafId = window.requestAnimationFrame(renderLoop);
        }
    };

    const handleMotionPreference = () => {
        stopAnimation();
        drawGalaxy(performance.now());
        startAnimation();
    };

    resizeCanvas();
    startAnimation();

    window.addEventListener("resize", resizeCanvas);
    if (typeof reduceMotionQuery.addEventListener === "function") {
        reduceMotionQuery.addEventListener("change", handleMotionPreference);
    } else if (typeof reduceMotionQuery.addListener === "function") {
        reduceMotionQuery.addListener(handleMotionPreference);
    }

    return () => {
        stopAnimation();
        window.removeEventListener("resize", resizeCanvas);

        if (typeof reduceMotionQuery.removeEventListener === "function") {
            reduceMotionQuery.removeEventListener("change", handleMotionPreference);
        } else if (typeof reduceMotionQuery.removeListener === "function") {
            reduceMotionQuery.removeListener(handleMotionPreference);
        }
    };
}

function setupMenuParallax(scene) {
    if (!scene) {
        return () => {};
    }

    const updateParallax = (event) => {
        const bounds = scene.getBoundingClientRect();
        const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

        scene.style.setProperty("--mx", ratioX.toFixed(3));
        scene.style.setProperty("--my", ratioY.toFixed(3));
    };

    const resetParallax = () => {
        scene.style.setProperty("--mx", "0");
        scene.style.setProperty("--my", "0");
    };

    scene.addEventListener("pointermove", updateParallax);
    scene.addEventListener("pointerleave", resetParallax);

    return () => {
        scene.removeEventListener("pointermove", updateParallax);
        scene.removeEventListener("pointerleave", resetParallax);
    };
}

export function init_menu(goTo) {
    const menuScene = document.querySelector(".menu-scene");
    const playBtn = document.getElementById("play-btn");
    const multiplayerBtn = document.getElementById("multiplayer-btn");
    const leaderboardBtn = document.getElementById("leaderboard-btn");
    const difficultyBtn = document.getElementById("difficulty-btn");
    const historyBtn = document.getElementById("history-btn");
    const socialBtn = document.getElementById("social-btn");
    const rewardsBtn = document.getElementById("rewards-btn");
    const editProfileBtn = document.getElementById("edit-profile-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const playerNameNode = document.getElementById("player-name");
    const playerBioNode = document.getElementById("player-bio");
    const playerEvaluationPointsNode = document.getElementById("player-ep");
    const playerWalletSummaryNode = document.getElementById("player-wallet-summary");
    const playerAvatarNode = document.getElementById("player-avatar");
    const toastNode = document.getElementById("menu-toast");
    let profileModalBusy = false;
    let toastTimeoutId = null;
    let releaseHistoryChartParallax = null;
    let releaseHistoryModalParallax = null;
    let releaseLeaderboardModalParallax = null;
    let lastModalFocusedElement = null;

    const PROFILE_TOAST_KEY = "bh_profile_toast";
    const modalFocusableSelector = [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    const resolveModalNodes = () => {
        const modal = document.getElementById("menu-modal");
        return {
            modal,
            modalContent: document.getElementById("menu-modal-content"),
            modalFooter: document.getElementById("menu-modal-footer"),
            modalTitle: document.getElementById("menu-modal-title"),
            modalClose: document.getElementById("menu-modal-close"),
            modalBackdrop: modal ? modal.querySelector("[data-modal-close]") : null
        };
    };

    const { modal, modalContent, modalFooter, modalTitle, modalClose, modalBackdrop } = resolveModalNodes();

    const getModalFocusableElements = () => {
        const { modal } = resolveModalNodes();
        if (!modal) {
            return [];
        }
        return Array.from(modal.querySelectorAll(modalFocusableSelector));
    };

    const focusModalShell = () => {
        lastModalFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.requestAnimationFrame(() => {
            const { modalClose } = resolveModalNodes();
            if (modalClose instanceof HTMLElement) {
                modalClose.focus();
                return;
            }
            const [firstFocusable] = getModalFocusableElements();
            firstFocusable?.focus?.();
        });
    };


    const levelSelector = new LevelSelector(
        null,
        getApiBase,
        modalContent,
        modalFooter
    );

    const multiplayerSelector = new MultiplayerSelector(
        null,
        getApiBase,
        modalContent,
        modalFooter
    );

    const notifyAuthUpdated = () => {
        window.dispatchEvent(new CustomEvent("auth:updated"));
    };

    const buildAuthHeaders = () => {
        const headers = {};
        const token = getStoredToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    };

    const resolveAvatarUrl = (avatarPath) => {
        if (!avatarPath) return null;
        if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
            return avatarPath;
        }
        const normalized = avatarPath.startsWith("/") ? avatarPath : `/${avatarPath}`;
        return `${getApiBase()}${normalized}`;
    };

    const formatDifficultyLabel = (difficulty) => {
        if (difficulty === "facile") return "Easy";
        if (difficulty === "difficile") return "Hard";
        return "Medium";
    };

    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatHistoryDuration = (timeMs) => {
        const value = Number(timeMs);
        if (!Number.isFinite(value) || value < 0) {
            return "—";
        }
        const totalSeconds = Math.floor(value / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes <= 0) {
            return `${seconds}s`;
        }
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    const formatHistoryDate = (value) => {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return "Unknown date";
        }
        return date.toLocaleString();
    };

    const readProfileEvaluationPoints = (profile, wallet) => Math.trunc(
        Number(
            profile?.stats?.evaluation_points
            ?? profile?.stats?.points
            ?? wallet?.total_evaluation_points
        ) || 0
    );

    const readProfileWalletAmount = (profile, wallet) => Math.trunc(
        Number(
            wallet?.total_evaluation_points
            ?? profile?.stats?.evaluation_points
            ?? profile?.stats?.points
        ) || 0
    );

    const formatWalletAmount = (value) => `${Math.trunc(Number(value) || 0)} ₳`;

    const REWARD_ACHIEVEMENT_DEFINITIONS = [
        {
            code: "first_escape",
            icon: "🏆",
            visualLabel: "Escape Vector",
            goal: 1,
            getCurrent: ({ wins, walletAmount }) => Math.max(wins > 0 ? 1 : 0, walletAmount > 0 ? 1 : 0),
        },
        {
            code: "steady_orbit",
            icon: "⭐",
            visualLabel: "Orbit Relay",
            goal: 5,
            getCurrent: ({ walletAmount }) => walletAmount,
        },
        {
            code: "event_horizon_master",
            icon: "☄️",
            visualLabel: "Singularity Core",
            goal: 10,
            getCurrent: ({ walletAmount }) => walletAmount,
        },
        {
            code: "multiplayer_contender",
            icon: "⚡",
            visualLabel: "Arena Uplink",
            goal: 3,
            getCurrent: ({ multiplayerWins }) => multiplayerWins,
        },
        {
            code: "void_wanderer",
            icon: "🌌",
            visualLabel: "Void Wanderer",
            goal: 5,
            getCurrent: ({ wins }) => wins,
        },
        {
            code: "stellar_collector",
            icon: "🌟",
            visualLabel: "Stellar Collector",
            goal: 25,
            getCurrent: ({ walletAmount }) => walletAmount,
        },
        {
            code: "galactic_champion",
            icon: "🏆",
            visualLabel: "Galactic Champion",
            goal: 10,
            getCurrent: ({ multiplayerWins }) => multiplayerWins,
        },
        {
            code: "blackhole_survivor",
            icon: "🖤",
            visualLabel: "Blackhole Survivor",
            goal: 20,
            getCurrent: ({ wins }) => wins,
        },
        {
            code: "cosmic_legend",
            icon: "🌠",
            visualLabel: "Cosmic Legend",
            goal: 50,
            getCurrent: ({ walletAmount }) => walletAmount,
        }
    ];

    const REWARD_BADGE_DEFINITIONS = [
        {
            code: "bronze_survivor",
            icon: "🛡️",
            label: "Bronze Survivor",
            description: "Secure 3 victories in the Blackhole.",
            unlockHint: "3 total victories",
            isUnlocked: ({ wins }) => wins >= 3,
        },
        {
            code: "orbit_collector",
            icon: "💠",
            label: "Orbit Collector",
            description: "Unlock multiple reward milestones.",
            unlockHint: "2 unlocked achievements",
            isUnlocked: ({ unlockedAchievementsCount }) => unlockedAchievementsCount >= 2,
        },
        {
            code: "signal_link",
            icon: "🛰️",
            label: "Signal Link",
            description: "Build a strong social relay in the void.",
            unlockHint: "3 friends connected",
            isUnlocked: ({ friendsCount }) => friendsCount >= 3,
        },
        {
            code: "event_horizon_elite",
            icon: "👑",
            label: "Event Horizon Elite",
            description: "Maintain a premium wallet balance.",
            unlockHint: "Wallet reaches 10 ₳",
            isUnlocked: ({ walletAmount }) => walletAmount >= 10,
        },
        {
            code: "silver_survivor",
            icon: "🥈",
            label: "Silver Survivor",
            description: "Secure 10 victories in the Blackhole.",
            unlockHint: "10 total victories",
            isUnlocked: ({ wins }) => wins >= 10,
        },
        {
            code: "gold_survivor",
            icon: "🥇",
            label: "Gold Survivor",
            description: "Secure 25 victories in the Blackhole.",
            unlockHint: "25 total victories",
            isUnlocked: ({ wins }) => wins >= 25,
        },
        {
            code: "deep_space_network",
            icon: "📡",
            label: "Deep Space Network",
            description: "Establish a vast network of allies.",
            unlockHint: "10 friends connected",
            isUnlocked: ({ friendsCount }) => friendsCount >= 10,
        },
        {
            code: "achievement_hunter",
            icon: "🎯",
            label: "Achievement Hunter",
            description: "Collect half of the milestones.",
            unlockHint: "5 unlocked achievements",
            isUnlocked: ({ unlockedAchievementsCount }) => unlockedAchievementsCount >= 5,
        },
        {
            code: "wealthy_pilot",
            icon: "💰",
            label: "Wealthy Pilot",
            description: "Fill your wallet to the brim.",
            unlockHint: "Wallet reaches 50 ₳",
            isUnlocked: ({ walletAmount }) => walletAmount >= 50,
        }
    ];

    const normalizeWalletTransactions = (rows) => {
        if (!Array.isArray(rows)) {
            return [];
        }
        return rows.map((row, index) => ({
            id: row?.id ?? `wallet_${index}`,
            evaluation_points_delta: Math.trunc(Number(row?.evaluation_points_delta) || 0),
            balance_after: Math.trunc(Number(row?.balance_after) || 0),
            description: String(row?.description || row?.transaction_type || "Wallet update"),
            created_at: row?.created_at || null
        }));
    };

    const buildProfileTransactionsMarkup = (rows) => {
        const safeRows = normalizeWalletTransactions(rows);
        if (!safeRows.length) {
            return `<div class="profile-empty-state">No wallet movement recorded yet.</div>`;
        }

        return `
            <div class="profile-history-list">
                ${safeRows.map((row) => `
                    <div class="profile-history-row">
                        <div class="profile-history-copy">
                            <strong>${escapeHtml(row.description)}</strong>
                            <span>${escapeHtml(formatHistoryDate(row.created_at))}</span>
                        </div>
                        <div class="profile-history-values">
                            <strong>${escapeHtml(formatWalletDelta(row.evaluation_points_delta))} EP</strong>
                            <span>Wallet ${row.balance_after} EP</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    };

    const buildProfileProgressionMarkup = (progression) => {
        const safeRows = Array.isArray(progression) ? progression : [];
        if (!safeRows.length) {
            return `<div class="profile-empty-state">No progression unlocked yet.</div>`;
        }

        return `
            <div class="profile-progression-grid">
                ${safeRows.map((entry) => `
                    <article class="profile-progress-pill">
                        <span>${escapeHtml(formatDifficultyLabel(entry?.difficulty))}</span>
                        <strong>Stage ${Number(entry?.current_stage) || 1}</strong>
                    </article>
                `).join("")}
            </div>
        `;
    };

    const buildProfileHeroMarkup = ({
        username,
        bio,
        avatarUrl,
        evaluationPoints,
        walletAmount
    }) => {
        const safeUsername = escapeHtml(username || "Unknown pilot");
        const safeBio = escapeHtml(
            bio || "No signal logged yet. This pilot keeps a low profile near the event horizon."
        );
        const safeAvatarUrl = avatarUrl ? avatarUrl.replace(/'/g, "%27") : null;

        return `
            <section class="profile-hero-card" aria-label="Player identity">
                <div class="profile-hero-core">
                    <div class="profile-hero-avatar${safeAvatarUrl ? " has-image" : ""}"${safeAvatarUrl ? ` style="background-image: url('${safeAvatarUrl}')"` : ""}>
                        ${safeAvatarUrl ? "" : "◎"}
                    </div>
                    <div class="profile-hero-copy">
                        <span class="profile-hero-overline">Blackhole Identity</span>
                        <h3 class="profile-hero-name">${safeUsername}</h3>
                        <p class="profile-hero-bio">${safeBio}</p>
                    </div>
                </div>
                <div class="profile-hero-metrics">
                    <article class="profile-hero-metric">
                        <span>Evaluation Points</span>
                        <strong>${Math.trunc(Number(evaluationPoints) || 0)}</strong>
                    </article>
                    <article class="profile-hero-metric">
                        <span>Wallet</span>
                        <strong>${escapeHtml(formatWalletAmount(walletAmount))}</strong>
                    </article>
                </div>
            </section>
        `;
    };

    const clampRewardProgress = (value, goal) => {
        const safeGoal = Math.max(1, Math.trunc(Number(goal) || 1));
        const safeValue = Math.max(0, Math.trunc(Number(value) || 0));
        return Math.min(safeGoal, safeValue);
    };

    const buildRewardsSnapshot = ({ profile, wallet, historyRows }) => {
        const wins = Math.trunc(Number(profile?.stats?.wins) || 0);
        const friendsCount = Math.trunc(Number(profile?.stats?.friends_count) || 0);
        const walletAmount = readProfileWalletAmount(profile, wallet);
        const evaluationPoints = readProfileEvaluationPoints(profile, wallet);
        const unlockedAchievementCodes = Array.isArray(wallet?.unlocked_achievements)
            ? wallet.unlocked_achievements
            : (profile?.stats?.unlocked_achievements || []);
        const unlockedAchievementSet = new Set(unlockedAchievementCodes);
        const multiplayerWins = (Array.isArray(historyRows) ? historyRows : [])
            .filter((row) => row.multiplayer && row.result === "victory")
            .length;

        const rewardContext = {
            wins,
            friendsCount,
            walletAmount,
            evaluationPoints,
            multiplayerWins,
            unlockedAchievementsCount: unlockedAchievementSet.size,
        };

        const achievements = REWARD_ACHIEVEMENT_DEFINITIONS.map((definition) => {
            const presentation = getWalletAchievementPresentation(definition.code);
            const progressCurrent = clampRewardProgress(definition.getCurrent(rewardContext), definition.goal);
            const unlocked = unlockedAchievementSet.has(definition.code) || progressCurrent >= definition.goal;

            return {
                code: definition.code,
                description: presentation.description,
                icon: definition.icon,
                progressCurrent,
                progressGoal: definition.goal,
                progressPercent: Math.round((progressCurrent / definition.goal) * 100),
                title: presentation.label,
                unlocked,
                visualLabel: definition.visualLabel || presentation.label,
            };
        });

        const badges = REWARD_BADGE_DEFINITIONS.map((definition) => ({
            code: definition.code,
            description: definition.description,
            icon: definition.icon,
            label: definition.label,
            unlockHint: definition.unlockHint,
            unlocked: Boolean(definition.isUnlocked(rewardContext)),
        }));

        return {
            achievements,
            badges,
            evaluationPoints,
            friendsCount,
            multiplayerWins,
            walletAmount,
            wins,
        };
    };

    const buildRewardsMarkup = (snapshot) => {
        const safeSnapshot = snapshot || {};
        const achievements = Array.isArray(safeSnapshot.achievements) ? safeSnapshot.achievements : [];
        const badges = Array.isArray(safeSnapshot.badges) ? safeSnapshot.badges : [];
        const unlockedAchievementsCount = achievements.filter((achievement) => achievement.unlocked).length;
        const lockedAchievementsCount = Math.max(0, achievements.length - unlockedAchievementsCount);
        const earnedBadgesCount = badges.filter((badge) => badge.unlocked).length;

        const achievementsMarkup = achievements.length
            ? achievements.map((achievement) => `
                <article
                    class="rewards-achievement-card ${achievement.unlocked ? "is-unlocked" : "is-locked"}"
                    data-reward-code="${achievement.code}"
                >
                    <div class="rewards-achievement-visual" aria-hidden="true">
                        <span class="rewards-achievement-visual__tag">${achievement.unlocked ? "Recovered" : "Tracking"}</span>
                        <div class="rewards-achievement-icon">${achievement.icon}</div>
                        <span class="rewards-achievement-visual__label">${escapeHtml(achievement.visualLabel)}</span>
                    </div>
                    <div class="rewards-achievement-card__body">
                        <div class="rewards-achievement-card__header">
                            <span class="rewards-achievement-status-dot" aria-hidden="true"></span>
                            <span class="rewards-achievement-status">${achievement.unlocked ? "Unlocked" : "🔒 Locked"}</span>
                        </div>
                        <strong class="rewards-achievement-title">${escapeHtml(achievement.title)}</strong>
                        <p class="rewards-achievement-description">${escapeHtml(achievement.description)}</p>
                        <div class="rewards-achievement-progress">
                            <div class="rewards-achievement-progress__bar" aria-hidden="true">
                                <span style="width: ${achievement.progressPercent}%"></span>
                            </div>
                            <span>${achievement.unlocked ? "Complete" : `${achievement.progressCurrent}/${achievement.progressGoal}`}</span>
                        </div>
                    </div>
                </article>
            `).join("")
            : `<div class="profile-empty-state">No achievements detected yet.</div>`;

        const badgesMarkup = badges.length
            ? badges.map((badge) => `
                <article
                    class="rewards-badge-card ${badge.unlocked ? "is-earned" : "is-locked"}"
                    data-badge-code="${badge.code}"
                >
                    <div class="rewards-badge-emblem-wrap">
                        <div class="rewards-badge-emblem" aria-hidden="true">${badge.icon}</div>
                        <span class="rewards-badge-state">${badge.unlocked ? "Earned" : "Locked"}</span>
                    </div>
                    <div class="rewards-badge-copy">
                        <strong>${escapeHtml(badge.label)}</strong>
                        <p>${escapeHtml(badge.description)}</p>
                        <span>${badge.unlocked ? "Earned" : `Unlock: ${escapeHtml(badge.unlockHint)}`}</span>
                    </div>
                </article>
            `).join("")
            : `<div class="profile-empty-state">No badges earned yet.</div>`;

        return `
            <div class="rewards-shell">
                <section class="rewards-summary-grid">
                    <article class="rewards-summary-card">
                        <span>Unlocked achievements</span>
                        <strong>${unlockedAchievementsCount}/${achievements.length || 0}</strong>
                        <small>${lockedAchievementsCount} remaining in the void</small>
                    </article>
                    <article class="rewards-summary-card">
                        <span>Earned badges</span>
                        <strong>${earnedBadgesCount}/${badges.length || 0}</strong>
                        <small>Collectible honors recovered</small>
                    </article>
                    <article class="rewards-summary-card">
                        <span>Wallet</span>
                        <strong>${escapeHtml(formatWalletAmount(safeSnapshot.walletAmount))}</strong>
                        <small>Premium balance fuel</small>
                    </article>
                    <article class="rewards-summary-card">
                        <span>Victories</span>
                        <strong>${Math.trunc(Number(safeSnapshot.wins) || 0)}</strong>
                        <small>Confirmed escapes logged</small>
                    </article>
                </section>

                <section class="rewards-section rewards-section--achievements">
                    <div class="rewards-section-headline">
                        <div>
                            <span class="rewards-section-eyebrow">Progression grid</span>
                            <h3>Achievements</h3>
                        </div>
                        <span>${unlockedAchievementsCount} unlocked · ${lockedAchievementsCount} locked</span>
                    </div>
                    <div class="rewards-achievement-grid">${achievementsMarkup}</div>
                </section>

                <section class="rewards-section rewards-section--badges">
                    <div class="rewards-section-headline">
                        <div>
                            <span class="rewards-section-eyebrow">Collectible gallery</span>
                            <h3>Badges</h3>
                        </div>
                        <span>Prestige medals earned across the Blackhole</span>
                    </div>
                    <div class="rewards-badge-grid">${badgesMarkup}</div>
                </section>
            </div>
        `;
    };

    const normalizeHistoryDifficulty = (value) => {
        const raw = String(value || "").toLowerCase();
        if (["facile", "easy"].includes(raw)) return "facile";
        if (["moyen", "medium", "normal"].includes(raw)) return "moyen";
        if (["difficile", "hard"].includes(raw)) return "difficile";
        return "unknown";
    };

    const normalizeHistoryRows = (rows) => {
        if (!Array.isArray(rows)) return [];
        return rows.map((row, index) => ({
            id: row?.id ?? `api_${index}_${Math.random()}`,
            evaluation_points: Math.floor(
                Number(row?.evaluation_points ?? row?.score) || 0
            ),
            wallet_balance: Math.floor(Number(row?.wallet_balance) || 0),
            result: row?.result === "victory" ? "victory" : "defeat",
            pace_value: Number(row?.pace_value) || null,
            pace_label: row?.pace_label || null,
            time_ms: Number(row?.time_ms) || 0,
            level: Number(row?.level) || 1,
            stage: Number(row?.stage) || Number(row?.level) || 1,
            difficulty: normalizeHistoryDifficulty(row?.difficulty),
            multiplayer: Boolean(row?.multiplayer ?? row?.is_multiplayer),
            created_at: row?.created_at || null
        }));
    };

    const mapStoredLocalHistory = () => {
        try {
            const raw = localStorage.getItem("bh_history");
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.map((entry) => ({
                id: entry?.id ?? `local_${Math.random()}`,
                evaluation_points: Math.floor(
                    Number(entry?.evaluation_points ?? entry?.score) || 0
                ),
                wallet_balance: Math.floor(Number(entry?.wallet_balance) || 0),
                result: entry?.result === "victory" ? "victory" : "defeat",
                pace_value: Number(entry?.pace_value) || null,
                pace_label: entry?.pace_label || null,
                time_ms: Number(entry?.time_ms) || 0,
                level: Number(entry?.level) || 1,
                stage: Number(entry?.stage) || Number(entry?.level) || 1,
                difficulty: normalizeHistoryDifficulty(entry?.difficulty),
                multiplayer: Boolean(entry?.multiplayer ?? entry?.is_multiplayer),
                created_at: entry?.created_at || null
            }));
        } catch {
            return [];
        }
    };

    const updatePlayerHeader = ({
        username,
        avatar,
        bio,
        evaluationPoints,
        walletAmount
    } = {}) => {
        if (playerNameNode && username) {
            playerNameNode.textContent = username;
        }
        if (playerBioNode) {
            playerBioNode.textContent = bio || "";
        }
        if (playerEvaluationPointsNode) {
            playerEvaluationPointsNode.textContent = `${Math.trunc(Number(evaluationPoints) || 0)}`;
        }
        if (playerWalletSummaryNode) {
            playerWalletSummaryNode.textContent = formatWalletAmount(walletAmount);
        }
        if (!playerAvatarNode) return;
        const resolvedAvatar = resolveAvatarUrl(avatar);
        if (resolvedAvatar) {
            playerAvatarNode.style.backgroundImage = `url("${resolvedAvatar}")`;
            playerAvatarNode.classList.add("has-image");
            playerAvatarNode.textContent = "";
            playerAvatarNode.setAttribute("aria-label", `${username || "player"} avatar`);
        } else {
            playerAvatarNode.style.backgroundImage = "";
            playerAvatarNode.classList.remove("has-image");
            playerAvatarNode.textContent = "◎";
            playerAvatarNode.setAttribute("aria-label", "Default avatar");
        }
    };

    const showToast = (message, type = "success") => {
        if (!toastNode) return;
        toastNode.textContent = message || "";
        toastNode.dataset.type = type;
        toastNode.classList.add("is-visible");
        if (toastTimeoutId) {
            clearTimeout(toastTimeoutId);
        }
        toastTimeoutId = setTimeout(() => {
            toastNode.classList.remove("is-visible");
        }, 3200);
    };

    const readPendingToast = () => {
        const message = localStorage.getItem(PROFILE_TOAST_KEY);
        if (!message) return;
        localStorage.removeItem(PROFILE_TOAST_KEY);
        showToast(message, "success");
    };

    const redirectToAuth = () => {
        closeModal();
        if (typeof goTo === "function") {
            goTo("auth");
            return;
        }
        window.location.href = "/auth";
    };

    const closeModal = () => {
        const { modal, modalContent, modalFooter } = resolveModalNodes();
        if (!modal) return;
        if (typeof multiplayerSelector.handleModalClosed === "function") {
            multiplayerSelector.handleModalClosed();
        }
        if (typeof releaseHistoryChartParallax === "function") {
            releaseHistoryChartParallax();
            releaseHistoryChartParallax = null;
        }
        if (typeof releaseHistoryModalParallax === "function") {
            releaseHistoryModalParallax();
            releaseHistoryModalParallax = null;
        }
        if (typeof releaseLeaderboardModalParallax === "function") {
            releaseLeaderboardModalParallax();
            releaseLeaderboardModalParallax = null;
        }
        modal.classList.remove("is-open");
        modal.classList.remove("profile-mode");
        modal.classList.remove("history-mode");
        modal.classList.remove("leaderboard-mode");
        modal.classList.remove("rewards-mode");
        modal.classList.remove("multiplayer-mode");
        modal.setAttribute("aria-hidden", "true");
        if (modalContent) modalContent.innerHTML = "";
        if (modalFooter) modalFooter.innerHTML = "";
        if (lastModalFocusedElement?.focus) {
            lastModalFocusedElement.focus();
        }
    };

    const applyDifficultySelection = (difficulty) => {
        const normalized = ["facile", "moyen", "difficile"].includes(difficulty) ? difficulty : "moyen";
        localStorage.setItem("bh_game_difficulty", normalized);
        if (difficultyBtn) {
            difficultyBtn.textContent = "NIVEAU";
        }
    };

    const openLevelSelectorForDifficulty = async (difficulty) => {
        const normalized = ["facile", "moyen", "difficile"].includes(difficulty) ? difficulty : "moyen";
        const response = await fetch(getApiBase() + "/api/progression/me", {
                credentials: "include",
                headers: buildAuthHeaders()
            });
        if (response.status === 401 || response.status === 403) {
            clearSession();
            notifyAuthUpdated();
            redirectToAuth();
            return;
        }
        if (!response.ok) {
            throw new Error("Failed to load progression");
        }

        const progressions = await response.json();
        const currentStage = Number(progressions?.[normalized]?.current_stage) || 1;

        const { modal, modalTitle } = resolveModalNodes();
        if (!modal || !modalTitle) {
            throw new Error("Menu modal unavailable");
        }

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = "Level Selector";
        focusModalShell();
        levelSelector.show(normalized, { current_stage: currentStage });
    };

    const openInfoModal = ({ title, message }) => {
        const { modal, modalContent, modalFooter, modalTitle } = resolveModalNodes();
        if (!modal || !modalContent || !modalFooter || !modalTitle) {
            alert(message);
            return;
        }

        modal.classList.remove("profile-mode");
        modal.classList.remove("history-mode");
        modal.classList.remove("leaderboard-mode");
        modal.classList.remove("rewards-mode");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = title;
        focusModalShell();
        modalContent.innerHTML = `<div class="menu-modal__message">${message}</div>`;
        modalFooter.innerHTML = "";

        const closeBtn = document.createElement("button");
        closeBtn.className = "menu-modal__button";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", closeModal);
        modalFooter.appendChild(closeBtn);
    };

    const formatLeaderboardPoints = (value) => {
        const points = Math.trunc(Number(value) || 0);
        return new Intl.NumberFormat().format(points);
    };

    const formatLeaderboardAverage = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return "0";
        }
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }).format(numeric);
    };

    const normalizeLeaderboardRows = (rows) => {
        if (!Array.isArray(rows)) {
            return [];
        }

        const normalized = rows.map((row, index) => ({
            username: String(row?.username ?? "").trim() || `Player ${index + 1}`,
            evaluation_points: Math.floor(
                Number(row?.evaluation_points ?? row?.points) || 0
            )
        }));

        normalized.sort((a, b) => {
            if (b.evaluation_points !== a.evaluation_points) {
                return b.evaluation_points - a.evaluation_points;
            }
            return a.username.localeCompare(b.username);
        });

        return normalized.map((row, index) => ({
            ...row,
            rank: index + 1
        }));
    };

    const buildLeaderboardMarkup = ({ rows, currentUsername, userEvaluation }) => {
        const safeRows = Array.isArray(rows) ? rows : [];
        const normalizedCurrent = String(currentUsername || "").trim().toLowerCase();
        const localHistory = mapStoredLocalHistory();
        const localWalletPoints = localHistory.reduce(
            (sum, row) => sum + (Number(row.evaluation_points) || 0),
            0
        );
        const currentRow = safeRows.find((row) => row.username.toLowerCase() === normalizedCurrent) || null;
        const highestPoints = safeRows.length ? safeRows[0].evaluation_points : 0;
        const activeRows = safeRows.filter((row) => row.evaluation_points !== 0);
        const averagePoints = activeRows.length
            ? activeRows.reduce((sum, row) => sum + row.evaluation_points, 0) / activeRows.length
            : 0;
        const topThree = safeRows.slice(0, 3);
        const rankLabels = ["TOP 1", "TOP 2", "TOP 3"];

        if (!safeRows.length) {
            const userPoints = Number(userEvaluation?.evaluation_points) || 0;
            const bestFallback = Math.max(localWalletPoints, userPoints);
            return `
                <div class="leaderboard-modal">
                    <div class="menu-modal__message">
                        No global evaluation points yet.
                    </div>
                    <div class="leaderboard-empty">
                        <div class="leaderboard-empty__title">How to appear on the leaderboard</div>
                        <div class="leaderboard-empty__text">
                            The wallet follows the rule <strong>solo win = +1, multiplayer win = +1, multiplayer loss = -1</strong>.
                            Finish matches to appear here.
                        </div>
                        <div class="leaderboard-empty__hint">
                            Your current local wallet: <strong>${formatLeaderboardPoints(bestFallback)} EP</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        const podiumMarkup = topThree
            .map((row, index) => {
                const isCurrent = normalizedCurrent && row.username.toLowerCase() === normalizedCurrent;
                return `
                    <article class="leaderboard-podium-card${isCurrent ? " is-current" : ""}">
                        <span class="leaderboard-podium-rank">${rankLabels[index]}</span>
                        <strong class="leaderboard-podium-name">${escapeHtml(row.username)}</strong>
                        <span class="leaderboard-podium-points">${formatLeaderboardPoints(row.evaluation_points)} EP</span>
                    </article>
                `;
            })
            .join("");

        const listMarkup = safeRows
            .map((row) => {
                const isCurrent = normalizedCurrent && row.username.toLowerCase() === normalizedCurrent;
                const initials = escapeHtml(row.username.slice(0, 2).toUpperCase() || "??");
                return `
                    <div class="leaderboard-row${isCurrent ? " is-current" : ""}">
                        <div class="leaderboard-row__left">
                            <span class="leaderboard-rank">#${row.rank}</span>
                            <span class="leaderboard-avatar">${initials}</span>
                            <span class="leaderboard-name">${escapeHtml(row.username)}</span>
                        </div>
                        <span class="leaderboard-points">${formatLeaderboardPoints(row.evaluation_points)} EP</span>
                    </div>
                `;
            })
            .join("");

        const currentUserHint = currentRow
            ? `<div class="leaderboard-user-chip">Your rank: #${currentRow.rank} · ${formatLeaderboardPoints(currentRow.evaluation_points)} EP</div>`
            : Number(userEvaluation?.evaluation_points) !== 0
                ? `<div class="leaderboard-user-chip">Your wallet: ${formatLeaderboardPoints(userEvaluation.evaluation_points)} EP · not visible in the current list</div>`
                : `<div class="leaderboard-user-chip">Your wallet: 0 EP · finish a match to enter the leaderboard</div>`;

        return `
            <div class="leaderboard-modal">
                <div class="leaderboard-summary-grid">
                    <div class="leaderboard-stat">
                        <span>All players</span>
                        <strong>${safeRows.length}</strong>
                    </div>
                    <div class="leaderboard-stat">
                        <span>Top wallet</span>
                        <strong>${formatLeaderboardPoints(highestPoints)}</strong>
                    </div>
                    <div class="leaderboard-stat">
                        <span>Average wallet</span>
                        <strong>${formatLeaderboardAverage(averagePoints)}</strong>
                    </div>
                </div>

                <div class="leaderboard-podium-grid">${podiumMarkup}</div>
                ${currentUserHint}

                <div class="menu-modal__section-title">Global leaderboard</div>
                <div class="leaderboard-list">${listMarkup}</div>
            </div>
        `;
    };

    const requestLeaderboardSnapshot = async ({ limit = 100 } = {}) => {
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
        const maxPages = 200;
        const headers = buildAuthHeaders();
        const userId = Number.parseInt(localStorage.getItem(STORAGE_KEYS.userId) || "", 10);
        const currentUsername = (
            playerNameNode?.textContent
            || localStorage.getItem(STORAGE_KEYS.sessionName)
            || ""
        ).trim();
        const userEvaluationRequest = Number.isFinite(userId)
            ? fetch(`${getApiBase()}/api/leaderboard/${userId}`, {
                credentials: "include",
                headers
            })
            : Promise.resolve(null);

        const rawRows = [];
        for (let page = 0; page < maxPages; page += 1) {
            const offset = page * safeLimit;
            const leaderboardResponse = await fetch(
                `${getApiBase()}/api/leaderboard?limit=${safeLimit}&offset=${offset}`,
                {
                    credentials: "include",
                    headers
                }
            );

            if (leaderboardResponse.status === 401 || leaderboardResponse.status === 403) {
                clearSession();
                notifyAuthUpdated();
                redirectToAuth();
                return null;
            }

            if (!leaderboardResponse.ok) {
                const detail = await readErrorDetail(leaderboardResponse);
                throw new Error(detail || "Unable to load the leaderboard.");
            }

            const pageRows = await leaderboardResponse.json();
            if (!Array.isArray(pageRows) || pageRows.length === 0) {
                break;
            }
            rawRows.push(...pageRows);
            if (pageRows.length < safeLimit) {
                break;
            }
        }

        const userEvaluationResponse = await userEvaluationRequest;
        if (userEvaluationResponse && (userEvaluationResponse.status === 401 || userEvaluationResponse.status === 403)) {
            clearSession();
            notifyAuthUpdated();
            redirectToAuth();
            return null;
        }
        let userEvaluation = null;
        if (userEvaluationResponse?.ok) {
            userEvaluation = await userEvaluationResponse.json();
        }

        return {
            rows: normalizeLeaderboardRows(rawRows),
            currentUsername,
            userEvaluation
        };
    };

    const openLeaderboardModal = async () => {
        const { modal, modalContent, modalFooter, modalTitle } = resolveModalNodes();
        if (!modal || !modalContent || !modalFooter || !modalTitle) {
            throw new Error("Menu modal unavailable");
        }

        modal.classList.remove("profile-mode");
        modal.classList.remove("history-mode");
        modal.classList.remove("rewards-mode");
        modal.classList.add("leaderboard-mode");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = "Global Leaderboard";
        focusModalShell();
        modalContent.innerHTML = `<div class="menu-modal__message">Loading leaderboard...</div>`;

        modalFooter.innerHTML = "";
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "menu-modal__button";
        refreshBtn.textContent = "Refresh";

        const closeBtn = document.createElement("button");
        closeBtn.className = "menu-modal__button";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", closeModal);

        modalFooter.appendChild(refreshBtn);
        modalFooter.appendChild(closeBtn);

        const loadLeaderboard = async () => {
            refreshBtn.disabled = true;
            if (typeof releaseLeaderboardModalParallax === "function") {
                releaseLeaderboardModalParallax();
                releaseLeaderboardModalParallax = null;
            }
            modalContent.innerHTML = `<div class="menu-modal__message">Loading leaderboard...</div>`;
            try {
                const snapshot = await requestLeaderboardSnapshot({ limit: 100 });
                if (!snapshot) {
                    return;
                }
                modalContent.innerHTML = buildLeaderboardMarkup(snapshot);
                const leaderboardModalNode = modalContent.querySelector(".leaderboard-modal");
                if (leaderboardModalNode) {
                    releaseLeaderboardModalParallax = setupHistoryModalParallax(leaderboardModalNode);
                }
            } catch (error) {
                const message = escapeHtml(error?.message || "Unable to load the leaderboard.");
                modalContent.innerHTML = `
                    <div class="menu-modal__message">
                        ${message}
                    </div>
                    <div class="menu-modal__message">
                        Make sure the backend is running and that evaluation-point results have been recorded.
                    </div>
                `;
            } finally {
                refreshBtn.disabled = false;
            }
        };

        refreshBtn.addEventListener("click", () => {
            void loadLeaderboard();
        });

        await loadLeaderboard();
    };

    const formatHistoryDifficultyLabel = (value) => {
        if (value === "facile") return "Easy";
        if (value === "moyen") return "Medium";
        if (value === "difficile") return "Hard";
        return "Unknown";
    };

    const getHistoryPeriodCutoff = (period) => {
        const now = Date.now();
        if (period === "7") return now - 7 * 24 * 60 * 60 * 1000;
        if (period === "30") return now - 30 * 24 * 60 * 60 * 1000;
        if (period === "90") return now - 90 * 24 * 60 * 60 * 1000;
        return null;
    };

    const applyHistoryFilters = (rows, filters) => {
        const difficulty = filters?.difficulty || "all";
        const result = filters?.result || "all";
        const period = filters?.period || "all";
        const cutoff = getHistoryPeriodCutoff(period);

        return rows
            .filter((row) => {
                if (difficulty !== "all" && (row.difficulty || "unknown") !== difficulty) {
                    return false;
                }
                if (result !== "all" && row.result !== result) {
                    return false;
                }
                if (cutoff !== null) {
                    const createdAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
                    if (!Number.isFinite(createdAt) || createdAt < cutoff) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                return tb - ta;
            });
    };

    const buildHistorySummaryMarkup = (rows) => {
        const totalGames = rows.length;
        const victories = rows.filter((row) => row.result === "victory").length;
        const defeats = totalGames - victories;
        const netEvaluationPoints = rows.reduce(
            (sum, row) => sum + (Number(row.evaluation_points) || 0),
            0
        );
        const bestLevel = rows.reduce((max, row) => Math.max(max, Number(row.level) || 1), 1);
        const bestPace = rows.reduce((max, row) => Math.max(max, Number(row.pace_value) || 0), 0);
        const averageTimeMs = totalGames > 0
            ? Math.round(rows.reduce((sum, row) => sum + (Number(row.time_ms) || 0), 0) / totalGames)
            : 0;
        const winRate = totalGames > 0 ? Math.round((victories / totalGames) * 100) : 0;

        return `
            <div class="history-summary-grid">
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Matches</span>
                        <span class="menu-modal__row-subtitle">Total played</span>
                    </div>
                    <span class="menu-modal__row-value">${totalGames}</span>
                </div>
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Victories</span>
                        <span class="menu-modal__row-subtitle">Defeats: ${defeats} · Win rate: ${winRate}%</span>
                    </div>
                    <span class="menu-modal__row-value">${victories}</span>
                </div>
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Highest Level</span>
                        <span class="menu-modal__row-subtitle">Pace max: ${bestPace || "—"}</span>
                    </div>
                    <span class="menu-modal__row-value">Niv. ${bestLevel}</span>
                </div>
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Net evaluation points</span>
                        <span class="menu-modal__row-subtitle">Average time: ${formatHistoryDuration(averageTimeMs)}</span>
                    </div>
                    <span class="menu-modal__row-value">${netEvaluationPoints} EP</span>
                </div>
            </div>
        `;
    };

    const buildProgressionMarkup = (progression) => {
        const stageFacile = Number(progression?.facile?.current_stage) || 1;
        const stageMoyen = Number(progression?.moyen?.current_stage) || 1;
        const stageDifficile = Number(progression?.difficile?.current_stage) || 1;

        return `
            <div class="menu-modal__section-title">Unlocked Progress</div>
            <div class="history-progress-grid">
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Easy</span>
                    </div>
                    <span class="menu-modal__row-value">Stage ${stageFacile}</span>
                </div>
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Medium</span>
                    </div>
                    <span class="menu-modal__row-value">Stage ${stageMoyen}</span>
                </div>
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Hard</span>
                    </div>
                    <span class="menu-modal__row-value">Stage ${stageDifficile}</span>
                </div>
            </div>
        `;
    };

    const buildHistoryChartMarkup = (rows) => {
        if (!rows.length) {
            return `<div class="menu-modal__message">Not enough data to draw the chart.</div>`;
        }

        const ordered = [...rows].reverse();
        const width = 820;
        const height = 260;
        const paddingLeft = 52;
        const paddingRight = 54;
        const paddingTop = 18;
        const paddingBottom = 44;
        const usableWidth = width - paddingLeft - paddingRight;
        const usableHeight = height - paddingTop - paddingBottom;
        const baselineY = height - paddingBottom;
        const maxLevel = Math.max(1, ...ordered.map((row) => Number(row.level) || 1), 1);
        const maxPace = Math.max(1, ...ordered.map((row) => Number(row.pace_value) || 0), 1);
        const pointCount = ordered.length;
        const formatShortDate = (value, fallbackIndex) => {
            const date = value ? new Date(value) : null;
            if (!date || Number.isNaN(date.getTime())) {
                return `Partie ${fallbackIndex + 1}`;
            }
            return date.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "2-digit"
            });
        };
        const signedValue = (value) => {
            const numeric = Number(value) || 0;
            if (numeric > 0) {
                return `+${numeric}`;
            }
            return `${numeric}`;
        };
        const toY = (value, maxValue) => {
            const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / maxValue));
            return paddingTop + (1 - ratio) * usableHeight;
        };
        const points = ordered.map((row, index) => {
            const levelValue = Math.max(0, Number(row.level) || 1);
            const paceValue = Math.max(0, Number(row.pace_value) || 0);
            const x = pointCount === 1
                ? width / 2
                : paddingLeft + (index / (pointCount - 1)) * usableWidth;

            return {
                index,
                row,
                x,
                yLevel: toY(levelValue, maxLevel),
                yPace: toY(paceValue, maxPace),
                levelValue,
                paceValue
            };
        });

        const buildSmoothPath = (coords) => {
            if (!coords.length) return "";
            if (coords.length === 1) {
                const p = coords[0];
                return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
            }
            let path = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
            for (let index = 0; index < coords.length - 1; index += 1) {
                const p0 = coords[index - 1] || coords[index];
                const p1 = coords[index];
                const p2 = coords[index + 1];
                const p3 = coords[index + 2] || p2;
                const c1x = p1.x + (p2.x - p0.x) / 6;
                const c1y = p1.y + (p2.y - p0.y) / 6;
                const c2x = p2.x - (p3.x - p1.x) / 6;
                const c2y = p2.y - (p3.y - p1.y) / 6;
                path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
            }
            return path;
        };

        const buildAreaPath = (coords, path) => {
            if (coords.length < 2 || !path) return "";
            const first = coords[0];
            const last = coords[coords.length - 1];
            return `${path} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
        };

        const levelCoords = points.map((point) => ({ x: point.x, y: point.yLevel }));
        const paceCoords = points.map((point) => ({ x: point.x, y: point.yPace }));
        const levelPath = buildSmoothPath(levelCoords);
        const pacePath = buildSmoothPath(paceCoords);
        const levelAreaPath = buildAreaPath(levelCoords, levelPath);
        const paceAreaPath = buildAreaPath(paceCoords, pacePath);

        const horizontalGrid = Array.from({ length: 5 }, (_, step) => {
            const ratio = step / 4;
            const y = paddingTop + ratio * usableHeight;
            const levelValue = Math.round((1 - ratio) * maxLevel);
            const paceValue = Math.round((1 - ratio) * maxPace);
            const isBase = step === 4 ? " is-base" : "";
            return `
                <line x1="${paddingLeft}" y1="${y.toFixed(2)}" x2="${width - paddingRight}" y2="${y.toFixed(2)}" class="history-chart-grid${isBase}" />
                <text x="${paddingLeft - 12}" y="${(y + 3).toFixed(2)}" class="history-chart-label history-chart-label-left">${levelValue}</text>
                <text x="${width - paddingRight + 12}" y="${(y + 3).toFixed(2)}" class="history-chart-label history-chart-label-right">${paceValue}</text>
            `;
        }).join("");

        const markerStep = Math.max(1, Math.floor(pointCount / 6));
        const markerIndexes = [...new Set([
            0,
            pointCount - 1,
            ...Array.from({ length: pointCount }, (_, index) => index).filter((index) => index % markerStep === 0)
        ])].sort((a, b) => a - b);

        const verticalGrid = markerIndexes.map((index) => {
            const point = points[index];
            const label = escapeHtml(formatShortDate(point.row.created_at, index));
            return `
                <line x1="${point.x.toFixed(2)}" y1="${paddingTop}" x2="${point.x.toFixed(2)}" y2="${baselineY.toFixed(2)}" class="history-chart-axis" />
                <text x="${point.x.toFixed(2)}" y="${(height - 16).toFixed(2)}" class="history-chart-label history-chart-label-bottom">${label}</text>
            `;
        }).join("");

        const levelDotStride = pointCount > 24 ? 2 : 1;
        const paceDotStride = pointCount > 20 ? 3 : 1;
        const levelDots = points
            .filter((point) => point.index === pointCount - 1 || point.index % levelDotStride === 0)
            .map((point) => {
                const resultClass = point.row.result === "victory" ? "is-victory" : "is-defeat";
                const details = escapeHtml(
                    `${formatHistoryDate(point.row.created_at)} · Stage ${Number(point.row.stage) || Number(point.row.level) || 1} · ${point.row.result === "victory" ? "Victory" : "Defeat"} · ${formatHistoryDuration(point.row.time_ms)}`
                );
                return `
                    <circle cx="${point.x.toFixed(2)}" cy="${point.yLevel.toFixed(2)}" r="3.2" class="history-chart-point history-chart-point-level ${resultClass}">
                        <title>${details}</title>
                    </circle>
                `;
            })
            .join("");
        const paceDots = points
            .filter((point) => point.index === pointCount - 1 || point.index % paceDotStride === 0)
            .map((point) => `
                <circle cx="${point.x.toFixed(2)}" cy="${point.yPace.toFixed(2)}" r="2.4" class="history-chart-point history-chart-point-pace">
                    <title>${escapeHtml(`Pace ${point.paceValue || "—"} · ${formatHistoryDate(point.row.created_at)}`)}</title>
                </circle>
            `)
            .join("");

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const levelDelta = Math.round((lastPoint.levelValue - firstPoint.levelValue) * 10) / 10;
        const paceDelta = Math.round((lastPoint.paceValue - firstPoint.paceValue) * 10) / 10;

        return `
            <div class="history-chart-wrap">
                <div class="history-chart-parallax">
                    <div class="history-chart-glow" aria-hidden="true"></div>
                    <svg class="history-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolution niveau et pace">
                        <defs>
                            <linearGradient id="historyLevelStroke" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="rgba(255,255,255,1)" />
                                <stop offset="100%" stop-color="rgba(190,190,190,0.92)" />
                            </linearGradient>
                            <linearGradient id="historyPaceStroke" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="rgba(220,220,220,0.9)" />
                                <stop offset="100%" stop-color="rgba(128,128,128,0.82)" />
                            </linearGradient>
                            <linearGradient id="historyLevelFill" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
                                <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
                            </linearGradient>
                            <linearGradient id="historyPaceFill" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="rgba(186,186,186,0.15)" />
                                <stop offset="100%" stop-color="rgba(186,186,186,0.02)" />
                            </linearGradient>
                        </defs>

                        ${horizontalGrid}
                        ${verticalGrid}
                        <line x1="${paddingLeft}" y1="${baselineY.toFixed(2)}" x2="${width - paddingRight}" y2="${baselineY.toFixed(2)}" class="history-chart-axis history-chart-axis-base" />

                        ${levelAreaPath ? `<path d="${levelAreaPath}" class="history-chart-area history-chart-area-level" />` : ""}
                        ${paceAreaPath ? `<path d="${paceAreaPath}" class="history-chart-area history-chart-area-pace" />` : ""}

                        ${levelPath ? `<path d="${levelPath}" class="history-chart-line history-chart-line-level" />` : ""}
                        ${pacePath ? `<path d="${pacePath}" class="history-chart-line history-chart-line-pace" />` : ""}

                        ${paceDots}
                        ${levelDots}
                    </svg>
                </div>

                <div class="history-chart-meta">
                    <span class="history-chart-chip">Sessions: ${pointCount}</span>
                    <span class="history-chart-chip">Highest level: ${maxLevel}</span>
                    <span class="history-chart-chip">Δ Level: ${signedValue(levelDelta)}</span>
                    <span class="history-chart-chip">Δ Pace: ${signedValue(paceDelta)}</span>
                </div>
                <div class="history-chart-legend">
                    <span><i class="legend-dot level"></i>Level</span>
                    <span><i class="legend-dot pace"></i>Pace</span>
                </div>
            </div>
        `;
    };

    const setupHistoryChartParallax = (container) => {
        if (!container) {
            return () => {};
        }
        const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const setPosition = (x, y) => {
            container.style.setProperty("--hx", x.toFixed(3));
            container.style.setProperty("--hy", y.toFixed(3));
        };
        let rafId = 0;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        const epsilon = 0.002;

        const animate = () => {
            currentX += (targetX - currentX) * 0.14;
            currentY += (targetY - currentY) * 0.14;
            setPosition(currentX, currentY);

            if (Math.abs(targetX - currentX) < epsilon && Math.abs(targetY - currentY) < epsilon) {
                currentX = targetX;
                currentY = targetY;
                setPosition(currentX, currentY);
                rafId = 0;
                return;
            }
            rafId = window.requestAnimationFrame(animate);
        };
        const requestAnimate = () => {
            if (!rafId) {
                rafId = window.requestAnimationFrame(animate);
            }
        };
        const resetPosition = () => {
            targetX = 0;
            targetY = 0;
            requestAnimate();
        };

        if (reduceMotionQuery.matches) {
            resetPosition();
            return () => {};
        }

        const onPointerMove = (event) => {
            const bounds = container.getBoundingClientRect();
            if (!bounds.width || !bounds.height) {
                resetPosition();
                return;
            }
            targetX = clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -0.85, 0.85);
            targetY = clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -0.85, 0.85);
            requestAnimate();
        };

        container.addEventListener("pointermove", onPointerMove);
        container.addEventListener("pointerleave", resetPosition);
        container.addEventListener("pointercancel", resetPosition);

        return () => {
            container.removeEventListener("pointermove", onPointerMove);
            container.removeEventListener("pointerleave", resetPosition);
            container.removeEventListener("pointercancel", resetPosition);
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
            targetX = 0;
            targetY = 0;
            currentX = 0;
            currentY = 0;
            setPosition(0, 0);
        };
    };

    const setupHistoryModalParallax = (container) => {
        if (!container) {
            return () => {};
        }

        const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const setPosition = (x, y) => {
            container.style.setProperty("--mx", x.toFixed(3));
            container.style.setProperty("--my", y.toFixed(3));
        };

        let rafId = 0;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        const epsilon = 0.002;

        const animate = () => {
            currentX += (targetX - currentX) * 0.13;
            currentY += (targetY - currentY) * 0.13;
            setPosition(currentX, currentY);

            if (Math.abs(targetX - currentX) < epsilon && Math.abs(targetY - currentY) < epsilon) {
                currentX = targetX;
                currentY = targetY;
                setPosition(currentX, currentY);
                rafId = 0;
                return;
            }

            rafId = window.requestAnimationFrame(animate);
        };

        const requestAnimate = () => {
            if (!rafId) {
                rafId = window.requestAnimationFrame(animate);
            }
        };

        const resetPosition = () => {
            targetX = 0;
            targetY = 0;
            requestAnimate();
        };

        if (reduceMotionQuery.matches) {
            setPosition(0, 0);
            return () => {};
        }

        const onPointerMove = (event) => {
            const bounds = container.getBoundingClientRect();
            if (!bounds.width || !bounds.height) {
                resetPosition();
                return;
            }

            targetX = clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -0.75, 0.75);
            targetY = clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -0.75, 0.75);
            requestAnimate();
        };

        container.addEventListener("pointermove", onPointerMove);
        container.addEventListener("pointerleave", resetPosition);
        container.addEventListener("pointercancel", resetPosition);

        return () => {
            container.removeEventListener("pointermove", onPointerMove);
            container.removeEventListener("pointerleave", resetPosition);
            container.removeEventListener("pointercancel", resetPosition);
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
            targetX = 0;
            targetY = 0;
            currentX = 0;
            currentY = 0;
            setPosition(0, 0);
        };
    };

    const buildSpeedKpiMarkup = (rows) => {
        if (!rows.length) {
            return `<div class="menu-modal__message">No speed data available yet.</div>`;
        }

        const levelStats = new Map();
        const stageBest = new Map();

        for (const row of rows) {
            const level = Number(row.level) || 1;
            const stage = Number(row.stage) || level;
            const time = Math.max(0, Number(row.time_ms) || 0);

            const levelEntry = levelStats.get(level) || { total: 0, count: 0 };
            levelEntry.total += time;
            levelEntry.count += 1;
            levelStats.set(level, levelEntry);

            const best = stageBest.get(stage);
            if (best === undefined || time < best) {
                stageBest.set(stage, time);
            }
        }

        const avgByLevelRows = [...levelStats.entries()]
            .sort((a, b) => a[0] - b[0])
            .slice(0, 8)
            .map(([level, stat]) => `
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Level ${level}</span>
                        <span class="menu-modal__row-subtitle">${stat.count} partie(s)</span>
                    </div>
                    <span class="menu-modal__row-value">${formatHistoryDuration(stat.total / stat.count)}</span>
                </div>
            `)
            .join("");

        const bestByStageRows = [...stageBest.entries()]
            .sort((a, b) => a[0] - b[0])
            .slice(0, 8)
            .map(([stage, bestTime]) => `
                <div class="menu-modal__row">
                    <div class="menu-modal__row-meta">
                        <span class="menu-modal__row-title">Stage ${stage}</span>
                        <span class="menu-modal__row-subtitle">Best time</span>
                    </div>
                    <span class="menu-modal__row-value">${formatHistoryDuration(bestTime)}</span>
                </div>
            `)
            .join("");

        return `
            <div class="history-kpi-grid">
                <div>
                    <div class="menu-modal__section-title">Average time by level</div>
                    <div class="menu-modal__list">${avgByLevelRows || `<div class="menu-modal__message">—</div>`}</div>
                </div>
                <div>
                    <div class="menu-modal__section-title">Best time by stage</div>
                    <div class="menu-modal__list">${bestByStageRows || `<div class="menu-modal__message">—</div>`}</div>
                </div>
            </div>
        `;
    };

    const buildFailureHeatmapMarkup = (rows) => {
        const defeats = rows.filter((row) => row.result === "defeat");
        if (!defeats.length) {
            return `<div class="menu-modal__message">No defeats in the current selection. Nice work.</div>`;
        }

        const counts = new Map();
        for (const row of defeats) {
            const stage = Number(row.stage) || Number(row.level) || 1;
            counts.set(stage, (counts.get(stage) || 0) + 1);
        }

        const maxCount = Math.max(1, ...counts.values());
        const cells = [...counts.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([stage, count]) => {
                const intensity = Math.max(0.12, count / maxCount);
                return `
                    <div class="history-heatmap-cell" style="--intensity:${intensity.toFixed(3)}" title="Stage ${stage}: ${count} defeat(s)">
                        <span>Stage ${stage}</span>
                        <strong>${count}</strong>
                    </div>
                `;
            })
            .join("");

        return `<div class="history-heatmap-grid">${cells}</div>`;
    };

    const buildHistoryRowsMarkup = (rows) => {
        if (!rows.length) {
            return `<div class="menu-modal__message">No matches found for the selected filters.</div>`;
        }

        return `
            <div class="menu-modal__list">
                ${rows.slice(0, 50).map((row) => {
                    const resultLabel = row.result === "victory" ? "Victory" : "Defeat";
                    const pace = row.pace_label || row.pace_value || "—";
                    const walletBalance = Math.trunc(Number(row.wallet_balance) || 0);
                    return `
                        <div class="menu-modal__row">
                            <div class="menu-modal__row-meta">
                                <span class="menu-modal__row-title">
                                    ${resultLabel} · Level ${Number(row.level) || 1} · ${formatHistoryDifficultyLabel(row.difficulty)}
                                </span>
                                <span class="menu-modal__row-subtitle">
                                    ${escapeHtml(formatHistoryDate(row.created_at))}
                                </span>
                            </div>
                            <span class="menu-modal__row-value">
                                ${formatWalletDelta(row.evaluation_points)} EP · Wallet ${walletBalance} EP · ${formatHistoryDuration(row.time_ms)} · pace ${escapeHtml(pace)}
                            </span>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    };

    const exportHistoryCsv = (rows) => {
        const headers = [
            "id",
            "created_at",
            "result",
            "difficulty",
            "stage",
            "level",
            "evaluation_points",
            "wallet_balance",
            "time_ms",
            "pace_value",
            "pace_label",
            "multiplayer"
        ];
        const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
        const lines = [
            headers.join(","),
            ...rows.map((row) => [
                row.id,
                row.created_at,
                row.result,
                row.difficulty,
                row.stage,
                row.level,
                row.evaluation_points,
                row.wallet_balance,
                row.time_ms,
                row.pace_value,
                row.pace_label,
                row.multiplayer
            ].map(csvEscape).join(","))
        ];

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const dateTag = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `historique_${dateTag}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const renderHistoryModal = ({ rows, progression, source }) => {
        const { modalContent, modalFooter } = resolveModalNodes();
        if (!modalContent || !modalFooter) {
            return;
        }

        const safeRows = Array.isArray(rows) ? rows : [];
        const sourceHint = source === "local"
            ? `<div class="menu-modal__message">Affichage depuis l'historique local (backend vide ou indisponible).</div>`
            : "";

        modalContent.innerHTML = `
            <div class="history-modal">
                ${sourceHint}
                <div class="history-filter-grid">
                    <label class="history-filter">
                        <span>Difficulty</span>
                        <select id="history-filter-difficulty">
                            <option value="all">All</option>
                            <option value="facile">Easy</option>
                            <option value="moyen">Medium</option>
                            <option value="difficile">Hard</option>
                            <option value="unknown">Unknown</option>
                        </select>
                    </label>
                    <label class="history-filter">
                        <span>Result</span>
                        <select id="history-filter-result">
                            <option value="all">All</option>
                            <option value="victory">Victories</option>
                            <option value="defeat">Defeats</option>
                        </select>
                    </label>
                    <label class="history-filter">
                        <span>Period</span>
                        <select id="history-filter-period">
                            <option value="all">All time</option>
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                        </select>
                    </label>
                </div>

                <div id="history-summary"></div>
                ${buildProgressionMarkup(progression)}

                <div class="menu-modal__section-title">Progress curve (level / pace)</div>
                <div id="history-chart"></div>

                <div class="menu-modal__section-title">Speed KPIs</div>
                <div id="history-kpi"></div>

                <div class="menu-modal__section-title">Failure heatmap</div>
                <div id="history-heatmap"></div>

                <div class="menu-modal__section-title">Detailed history</div>
                <div id="history-list"></div>
            </div>
        `;

        if (typeof releaseHistoryModalParallax === "function") {
            releaseHistoryModalParallax();
            releaseHistoryModalParallax = null;
        }
        const historyModalNode = modalContent.querySelector(".history-modal");
        if (historyModalNode) {
            releaseHistoryModalParallax = setupHistoryModalParallax(historyModalNode);
        }

        modalFooter.innerHTML = "";
        const exportBtn = document.createElement("button");
        exportBtn.className = "menu-modal__button";
        exportBtn.textContent = "Export CSV";

        const closeBtn = document.createElement("button");
        closeBtn.className = "menu-modal__button";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", closeModal);

        modalFooter.appendChild(exportBtn);
        modalFooter.appendChild(closeBtn);

        const difficultySelect = modalContent.querySelector("#history-filter-difficulty");
        const resultSelect = modalContent.querySelector("#history-filter-result");
        const periodSelect = modalContent.querySelector("#history-filter-period");
        const summaryNode = modalContent.querySelector("#history-summary");
        const chartNode = modalContent.querySelector("#history-chart");
        const kpiNode = modalContent.querySelector("#history-kpi");
        const heatmapNode = modalContent.querySelector("#history-heatmap");
        const listNode = modalContent.querySelector("#history-list");

        const filters = {
            difficulty: "all",
            result: "all",
            period: "all"
        };
        let currentRows = safeRows;

        const refresh = () => {
            currentRows = applyHistoryFilters(safeRows, filters);
            if (summaryNode) summaryNode.innerHTML = buildHistorySummaryMarkup(currentRows);
            if (chartNode) {
                if (typeof releaseHistoryChartParallax === "function") {
                    releaseHistoryChartParallax();
                    releaseHistoryChartParallax = null;
                }
                chartNode.innerHTML = buildHistoryChartMarkup(currentRows);
                const chartParallaxNode = chartNode.querySelector(".history-chart-parallax");
                if (chartParallaxNode) {
                    releaseHistoryChartParallax = setupHistoryChartParallax(chartParallaxNode);
                }
            }
            if (kpiNode) kpiNode.innerHTML = buildSpeedKpiMarkup(currentRows);
            if (heatmapNode) heatmapNode.innerHTML = buildFailureHeatmapMarkup(currentRows);
            if (listNode) listNode.innerHTML = buildHistoryRowsMarkup(currentRows);
        };

        const onFilterChange = () => {
            filters.difficulty = difficultySelect?.value || "all";
            filters.result = resultSelect?.value || "all";
            filters.period = periodSelect?.value || "all";
            refresh();
        };

        if (difficultySelect) difficultySelect.addEventListener("change", onFilterChange);
        if (resultSelect) resultSelect.addEventListener("change", onFilterChange);
        if (periodSelect) periodSelect.addEventListener("change", onFilterChange);

        exportBtn.addEventListener("click", () => {
            exportHistoryCsv(currentRows);
        });

        refresh();
    };

    const openHistoryModal = async () => {
        const { modal, modalContent, modalFooter, modalTitle } = resolveModalNodes();
        if (!modal || !modalContent || !modalFooter || !modalTitle) {
            throw new Error("Menu modal unavailable");
        }

        modal.classList.remove("profile-mode");
        modal.classList.remove("leaderboard-mode");
        modal.classList.remove("rewards-mode");
        modal.classList.add("history-mode");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = "History";
        focusModalShell();
        modalContent.innerHTML = `<div class="menu-modal__message">Loading history...</div>`;
        modalFooter.innerHTML = "";

        const headers = buildAuthHeaders();
        const [resultsResponse, progressionResponse] = await Promise.all([
            fetch(`${getApiBase()}/api/results?limit=50`, {
                credentials: "include",
                headers
            }),
            fetch(`${getApiBase()}/api/progression/me`, {
                credentials: "include",
                headers
            })
        ]);

        const unauthorized = [resultsResponse, progressionResponse]
            .some((response) => response.status === 401 || response.status === 403);
        if (unauthorized) {
            clearSession();
            notifyAuthUpdated();
            redirectToAuth();
            return;
        }

        if (!resultsResponse.ok) {
            const detail = await readErrorDetail(resultsResponse);
            throw new Error(detail || "Unable to load history.");
        }

        if (!progressionResponse.ok) {
            const detail = await readErrorDetail(progressionResponse);
            throw new Error(detail || "Unable to load progression.");
        }

        let apiRows = [];
        let source = "backend";
        const payload = await resultsResponse.json();
        apiRows = normalizeHistoryRows(payload);

        if (apiRows.length === 0) {
            const localRows = mapStoredLocalHistory();
            if (localRows.length > 0) {
                apiRows = localRows;
                source = "local";
            }
        }

        const progression = await progressionResponse.json();

        renderHistoryModal({ rows: apiRows, progression, source });
    };

    const ensureAuthenticated = () => {
        const token = getStoredToken();
        if (token) {
            return true;
        }

        openInfoModal({
            title: "Sign-in required",
            message: "Please sign in."
        });
        return false;
    };

    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }
    if (modalBackdrop) {
        modalBackdrop.addEventListener("click", closeModal);
    }
    if (typeof window.__menuModalKeyboardHandler === "function") {
        document.removeEventListener("keydown", window.__menuModalKeyboardHandler);
    }
    window.__menuModalKeyboardHandler = (event) => {
        const { modal } = resolveModalNodes();
        if (!modal || !modal.classList.contains("is-open")) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const focusable = getModalFocusableElements();
        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };
    document.addEventListener("keydown", window.__menuModalKeyboardHandler);

    const loadProfileSnapshot = async () => {
        const headers = buildAuthHeaders();
        const apiBase = getApiBase();
        let user = null;
        let profile = null;
        let authState = "unknown";

        try {
            const userResponse = await fetch(`${apiBase}/auth/me`, {
                credentials: "include",
                headers
            });
            if (userResponse.ok) {
                user = await userResponse.json();
                authState = "ok";
                if (user?.username) {
                    storeSession(user.username);
                    localStorage.setItem(STORAGE_KEYS.sessionName, user.username);
                }
                if (user?.id) {
                    storeUserId(user.id);
                }
            } else if (userResponse.status === 401 || userResponse.status === 403) {
                authState = "unauthorized";
                clearSession();
                notifyAuthUpdated();
            } else {
                authState = "http_error";
            }
        } catch {
            user = null;
            authState = "network";
        }

        if (authState !== "ok" || !user) {
            return { user, profile, authState, apiBase };
        }

        let wallet = null;
        try {
            const [profileResponse, walletResponse] = await Promise.all([
                fetch(`${apiBase}/users/profiles/${user.id}`, {
                    credentials: "include",
                    headers
                }),
                fetch(`${apiBase}/api/wallet`, {
                    credentials: "include",
                    headers
                })
            ]);
            if (profileResponse.ok) {
                profile = await profileResponse.json();
            }
            if (walletResponse && walletResponse.ok) {
                wallet = await walletResponse.json();
            }
        } catch {
            profile = null;
            wallet = null;
        }

        return { user, profile, wallet, authState, apiBase };
    };

    const loadRewardHistoryRows = async () => {
        const headers = buildAuthHeaders();

        try {
            const resultsResponse = await fetch(`${getApiBase()}/api/results?limit=80`, {
                credentials: "include",
                headers
            });

            if (resultsResponse.status === 401 || resultsResponse.status === 403) {
                return {
                    rows: [],
                    unauthorized: true
                };
            }

            if (resultsResponse.ok) {
                const rows = normalizeHistoryRows(await resultsResponse.json());
                if (rows.length) {
                    return {
                        rows,
                        unauthorized: false
                    };
                }
            }
        } catch {
            return {
                rows: mapStoredLocalHistory(),
                unauthorized: false
            };
        }

        return {
            rows: mapStoredLocalHistory(),
            unauthorized: false
        };
    };

    const openRewardsModal = async () => {
        const { modal, modalContent, modalFooter, modalTitle } = resolveModalNodes();
        if (!modal || !modalContent || !modalFooter || !modalTitle) {
            throw new Error("Menu modal unavailable");
        }

        modal.classList.remove("profile-mode");
        modal.classList.remove("history-mode");
        modal.classList.remove("leaderboard-mode");
        modal.classList.add("rewards-mode");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = "Rewards";
        focusModalShell();
        modalContent.innerHTML = `<div class="menu-modal__message">Loading rewards...</div>`;
        modalFooter.innerHTML = "";

        const refreshBtn = document.createElement("button");
        refreshBtn.className = "menu-modal__button";
        refreshBtn.textContent = "Refresh";

        const closeBtn = document.createElement("button");
        closeBtn.className = "menu-modal__button";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", closeModal);

        modalFooter.appendChild(refreshBtn);
        modalFooter.appendChild(closeBtn);

        const renderRewards = async () => {
            refreshBtn.disabled = true;
            modalContent.innerHTML = `<div class="menu-modal__message">Loading rewards...</div>`;

            try {
                const { user, profile, wallet, authState } = await loadProfileSnapshot();
                if (!user) {
                    if (authState === "unauthorized") {
                        redirectToAuth();
                        return;
                    }

                    let message = "Please sign in to view rewards.";
                    if (authState === "network") {
                        message = "Unable to reach the backend to load rewards.";
                    } else if (authState === "http_error") {
                        message = "The server returned an error while loading rewards.";
                    }
                    modalContent.innerHTML = `<div class="menu-modal__message">${escapeHtml(message)}</div>`;
                    return;
                }

                const historyPayload = await loadRewardHistoryRows();
                if (historyPayload.unauthorized) {
                    clearSession();
                    notifyAuthUpdated();
                    redirectToAuth();
                    return;
                }

                const rewardsSnapshot = buildRewardsSnapshot({
                    profile,
                    wallet,
                    historyRows: historyPayload.rows
                });

                modalContent.innerHTML = buildRewardsMarkup(rewardsSnapshot);
            } catch (error) {
                modalContent.innerHTML = `
                    <div class="menu-modal__message">
                        ${escapeHtml(error?.message || "Unable to load rewards right now.")}
                    </div>
                `;
            } finally {
                refreshBtn.disabled = false;
            }
        };

        refreshBtn.addEventListener("click", () => {
            void renderRewards();
        });

        await renderRewards();
    };

    const hydrateHeader = async () => {
        const storedName = localStorage.getItem(STORAGE_KEYS.sessionName);
        if (playerNameNode && storedName) {
            playerNameNode.textContent = storedName;
        }

        const { user, profile, wallet, authState } = await loadProfileSnapshot();
        if (authState === "unauthorized") {
            if (storedName === "Guest" || storedName === "Invited") {
                updatePlayerHeader({
                    username: "Guest",
                    avatar: null,
                    bio: "",
                    evaluationPoints: 0,
                    walletAmount: 0
                });
                return;
            }
            updatePlayerHeader({
                username: "",
                avatar: null,
                bio: "",
                evaluationPoints: 0,
                walletAmount: 0
            });
            redirectToAuth();
            return;
        }

        updatePlayerHeader({
            username: user?.username || storedName,
            avatar: profile?.avatar || null,
            bio: profile?.bio || "",
            evaluationPoints: readProfileEvaluationPoints(profile, wallet),
            walletAmount: readProfileWalletAmount(profile, wallet)
        });
    };

    const openProfileModal = async () => {
        if (profileModalBusy) {
            return;
        }
        profileModalBusy = true;
        const { modal, modalContent, modalFooter, modalTitle } = resolveModalNodes();
        if (!modal || !modalContent || !modalFooter || !modalTitle) {
            profileModalBusy = false;
            return;
        }

        modal.classList.add("is-open");
        modal.classList.remove("history-mode");
        modal.classList.remove("leaderboard-mode");
        modal.classList.remove("rewards-mode");
        modal.classList.add("profile-mode");
        modal.setAttribute("aria-hidden", "false");
        modalTitle.textContent = "User Profile";
        focusModalShell();
        modalContent.innerHTML = `<div class="profile-loading">Loading profile...</div>`;
        modalFooter.innerHTML = "";

        try {
            const {
                user,
                profile,
                wallet: walletSnapshot,
                authState,
                apiBase
            } = await loadProfileSnapshot();
            if (!user) {
                if (authState === "unauthorized") {
                    redirectToAuth();
                    return;
                }
                let message = "Please sign in to edit your profile.";
                if (authState === "network") {
                    message = `Unable to reach the backend (${apiBase}). Make sure the backend is running and that VITE_API_URL is correct.`;
                } else if (authState === "http_error") {
                    message = "The server returned an error. Please try again in a few seconds.";
                }
                modalContent.innerHTML = `<div class="menu-modal__message">${message}</div>`;
                const closeBtn = document.createElement("button");
                closeBtn.className = "menu-modal__button";
                closeBtn.textContent = "Close";
                closeBtn.addEventListener("click", closeModal);
                modalFooter.appendChild(closeBtn);
                return;
            }

            const headers = buildAuthHeaders();
            const [walletTransactionsResponse, historyPayload] = await Promise.all([
                fetch(`${getApiBase()}/api/wallet/transactions?limit=8`, {
                    credentials: "include",
                    headers
                }),
                loadRewardHistoryRows()
            ]);

            const unauthorizedResponses = [walletTransactionsResponse]
                .some((response) => response.status === 401 || response.status === 403);
            if (unauthorizedResponses || historyPayload.unauthorized) {
                clearSession();
                notifyAuthUpdated();
                redirectToAuth();
                return;
            }

            const walletPayload = walletSnapshot || null;
            const walletTransactions = walletTransactionsResponse.ok
                ? normalizeWalletTransactions(await walletTransactionsResponse.json())
                : [];
            const rewardsSnapshot = buildRewardsSnapshot({
                profile,
                wallet: walletPayload,
                historyRows: historyPayload.rows
            });

            const profileStats = profile?.stats || {};
            const unlockedAchievements = Array.isArray(walletPayload?.unlocked_achievements)
                ? walletPayload.unlocked_achievements
                : (profileStats?.unlocked_achievements || []);
            const walletTransactionsCount = Math.trunc(
                Number(walletPayload?.transactions_count ?? profileStats?.wallet_transactions ?? walletTransactions.length) || 0
            );
            const wins = Math.trunc(Number(profileStats?.wins) || 0);
            const losses = Math.trunc(Number(profileStats?.losses) || 0);
            const friendsCount = Math.trunc(Number(profileStats?.friends_count) || 0);
            const evaluationPoints = readProfileEvaluationPoints(profile, walletPayload);
            const walletAmount = readProfileWalletAmount(profile, walletPayload);

            const username = user?.username || "";
            const email = user?.email || "";
            const bio = profile?.bio || "";
            const avatarUrl = resolveAvatarUrl(profile?.avatar);
            const safeUsername = escapeHtml(username);
            const safeEmail = escapeHtml(email);
            const safeBio = escapeHtml(bio);
            const safeAvatarUrl = avatarUrl ? avatarUrl.replace(/'/g, "%27") : null;

            modalContent.innerHTML = `
            <div class="profile-modal">
                <section class="profile-section-block">
                    <div class="profile-section-headline">
                        <h3>Profile settings</h3>
                        <span>Update public identity and account data</span>
                    </div>
                    <div class="profile-grid">
                        <div class="profile-avatar-block">
                            <div class="profile-avatar-preview" style="${safeAvatarUrl ? `background-image: url('${safeAvatarUrl}')` : ""}">
                                ${safeAvatarUrl ? "" : "◎"}
                            </div>
                            <label class="profile-upload">
                                <input type="file" id="profile-avatar-input" accept="image/*" />
                                <span>Choose a photo</span>
                            </label>
                            <div class="profile-hint">JPG/PNG · 5 MB max</div>
                        </div>
                        <div class="profile-fields">
                            <label class="profile-field">
                                <span>Username</span>
                                <input type="text" id="profile-username" value="${safeUsername}" autocomplete="username" maxlength="${USERNAME_MAX_LENGTH}" />
                            </label>
                            <label class="profile-field">
                                <span>Email</span>
                                <input type="email" id="profile-email" value="${safeEmail}" autocomplete="email" />
                            </label>
                            <label class="profile-field">
                                <span>New password</span>
                                <input type="password" id="profile-password" placeholder="••••••••" autocomplete="new-password" />
                            </label>
                            <label class="profile-field">
                                <span>Confirm password</span>
                                <input type="password" id="profile-password-confirm" placeholder="••••••••" autocomplete="new-password" />
                            </label>
                        </div>
                    </div>
                    <label class="profile-field">
                        <span>Bio</span>
                        <textarea id="profile-bio" rows="4" placeholder="Tell us about yourself...">${safeBio}</textarea>
                    </label>
                </section>

                <div class="profile-feedback" id="profile-feedback"></div>
            </div>
        `;

            const avatarPreview = modalContent.querySelector(".profile-avatar-preview");
            const avatarInput = modalContent.querySelector("#profile-avatar-input");
            const usernameInput = modalContent.querySelector("#profile-username");
            const emailInput = modalContent.querySelector("#profile-email");
            const passwordInput = modalContent.querySelector("#profile-password");
            const passwordConfirmInput = modalContent.querySelector("#profile-password-confirm");
            const bioInput = modalContent.querySelector("#profile-bio");
            const feedbackNode = modalContent.querySelector("#profile-feedback");

            let pendingAvatarFile = null;
            let latestAvatarPath = profile?.avatar || null;

            const setFeedback = (message, type = "info") => {
                if (!feedbackNode) return;
                feedbackNode.textContent = message || "";
                feedbackNode.dataset.type = type;
            };

            if (avatarInput) {
                avatarInput.addEventListener("change", (event) => {
                    const file = event.target.files?.[0] || null;
                    pendingAvatarFile = file;
                    if (!avatarPreview) return;
                    if (!file) {
                        avatarPreview.style.backgroundImage = avatarUrl ? `url('${avatarUrl}')` : "";
                        avatarPreview.textContent = avatarUrl ? "" : "◎";
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        avatarPreview.style.backgroundImage = `url('${reader.result}')`;
                        avatarPreview.textContent = "";
                    };
                    reader.readAsDataURL(file);
                });
            }

            const saveBtn = document.createElement("button");
            saveBtn.className = "menu-modal__button";
            saveBtn.textContent = "Save";

            const closeBtn = document.createElement("button");
            closeBtn.className = "menu-modal__button is-danger";
            closeBtn.textContent = "Close";
            closeBtn.addEventListener("click", closeModal);

            saveBtn.addEventListener("click", async () => {
                setFeedback("");
                saveBtn.disabled = true;
                closeBtn.disabled = true;

                const headers = buildAuthHeaders();
                let updatedUser = null;

                try {
                    if (pendingAvatarFile) {
                        const formData = new FormData();
                        formData.append("file", pendingAvatarFile);
                        const uploadResponse = await fetch(`${getApiBase()}/users/profiles/me/avatar`, {
                            method: "POST",
                            body: formData,
                            credentials: "include",
                            headers
                        });
                        if (uploadResponse.status === 401 || uploadResponse.status === 403) {
                            clearSession();
                            notifyAuthUpdated();
                            redirectToAuth();
                            return;
                        }
                        if (!uploadResponse.ok) {
                            const detail = await readErrorDetail(uploadResponse);
                            throw new Error(detail);
                        }
                        const uploadPayload = await uploadResponse.json();
                        latestAvatarPath = uploadPayload?.avatar || latestAvatarPath;
                    }

                    const nextUsername = usernameInput?.value.trim() || "";
                    const nextEmail = emailInput?.value.trim() || "";
                    const nextPassword = passwordInput?.value || "";
                    const nextPasswordConfirm = passwordConfirmInput?.value || "";
                    const nextBio = bioInput?.value.trim() || "";

                    const usernameValidationMessage = getUsernameValidationMessage(nextUsername);
                    if (usernameValidationMessage) {
                        throw new Error(usernameValidationMessage);
                    }

                    if (nextPassword || nextPasswordConfirm) {
                        if (nextPassword.length < 8) {
                            throw new Error("Password must contain at least 8 characters.");
                        }
                        if (nextPassword !== nextPasswordConfirm) {
                            throw new Error("Passwords do not match.");
                        }
                    }

                    const authPayload = {};
                    if (nextUsername && nextUsername !== username) {
                        authPayload.username = nextUsername;
                    }
                    if (nextEmail && nextEmail !== email) {
                        authPayload.email = nextEmail;
                    }
                    if (nextPassword) {
                        authPayload.password = nextPassword;
                    }

                    if (Object.keys(authPayload).length > 0) {
                        const authResponse = await fetch(`${getApiBase()}/auth/me`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                ...headers
                            },
                            credentials: "include",
                            body: JSON.stringify(authPayload)
                        });
                        if (authResponse.status === 401 || authResponse.status === 403) {
                            clearSession();
                            notifyAuthUpdated();
                            redirectToAuth();
                            return;
                        }
                        if (!authResponse.ok) {
                            const detail = await readErrorDetail(authResponse);
                            throw new Error(detail);
                        }
                        const authData = await authResponse.json();
                        updatedUser = authData?.user || null;
                        if (authData?.access_token) {
                            storeAuthToken(authData.access_token);
                        }
                        if (updatedUser?.username) {
                            storeSession(updatedUser.username);
                        }
                        if (updatedUser?.id) {
                            storeUserId(updatedUser.id);
                        }
                        notifyAuthUpdated();
                    }

                    if (nextBio !== bio || latestAvatarPath) {
                        const profilePayload = {};
                        if (nextBio !== bio) {
                            profilePayload.bio = nextBio;
                        }
                        if (latestAvatarPath) {
                            profilePayload.avatar = latestAvatarPath;
                        }
                        const profileResponse = await fetch(`${getApiBase()}/users/profiles/me`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                ...headers
                            },
                            credentials: "include",
                            body: JSON.stringify(profilePayload)
                        });
                        if (profileResponse.status === 401 || profileResponse.status === 403) {
                            clearSession();
                            notifyAuthUpdated();
                            redirectToAuth();
                            return;
                        }
                        if (!profileResponse.ok) {
                            const detail = await readErrorDetail(profileResponse);
                            throw new Error(detail);
                        }
                    }

                    updatePlayerHeader({
                        username: updatedUser?.username || nextUsername || username,
                        avatar: latestAvatarPath || profile?.avatar,
                        bio: nextBio,
                        evaluationPoints,
                        walletAmount
                    });
                    setFeedback("Profile updated.", "success");
                    pendingAvatarFile = null;
                    const toastMessage = "Profile updated.";
                    showToast(toastMessage, "success");
                    closeModal();
                    if (typeof goTo === "function" && window.location.pathname !== "/menu") {
                        localStorage.setItem(PROFILE_TOAST_KEY, toastMessage);
                        goTo("menu");
                    }
                } catch (error) {
                    const message = error?.message || "Unable to update the profile.";
                    setFeedback(message, "error");
                } finally {
                    saveBtn.disabled = false;
                    closeBtn.disabled = false;
                }
            });

            modalFooter.appendChild(saveBtn);
            modalFooter.appendChild(closeBtn);
        } catch (error) {
            const { modalContent, modalFooter } = resolveModalNodes();
            const message = escapeHtml(error?.message || "Unable to open the profile right now.");
            if (modalContent) {
                modalContent.innerHTML = `<div class="menu-modal__message">${message}</div>`;
            }
            if (modalFooter) {
                modalFooter.innerHTML = "";
                const closeBtn = document.createElement("button");
                closeBtn.className = "menu-modal__button";
                closeBtn.textContent = "Close";
                closeBtn.addEventListener("click", closeModal);
                modalFooter.appendChild(closeBtn);
            }
            console.error("openProfileModal failed", error);
        } finally {
            profileModalBusy = false;
        }
    };

    if (editProfileBtn) {
        editProfileBtn.addEventListener("click", (event) => {
            event.preventDefault();
            void openProfileModal();
        });
    }


    // Keep a single delegated listener alive across route remounts/HMR.
    if (typeof window.__menuProfileModalHandler === "function") {
        document.removeEventListener("click", window.__menuProfileModalHandler);
    }
    window.__menuProfileModalHandler = (event) => {
        const target = event.target.closest("#edit-profile-btn");
        if (!target) return;
        event.preventDefault();
        void openProfileModal();
    };
    document.addEventListener("click", window.__menuProfileModalHandler);

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                const headers = buildAuthHeaders();
                await fetch(`${getApiBase()}/auth/logout`, {
                    method: "POST",
                    credentials: "include",
                    headers
                });
            } catch (error) {
                console.warn("Logout failed", error);
            } finally {
                clearSession();
                notifyAuthUpdated();
                if (typeof goTo === "function") {
                    goTo("auth");
                } else {
                    window.location.href = "/auth";
                }
            }
        });
    }

    applyDifficultySelection(localStorage.getItem("bh_game_difficulty") || "moyen");

    if (difficultyBtn) {
        difficultyBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (!ensureAuthenticated()) {
                return;
            }
            if (typeof goTo === "function") {
                goTo("difficulty");
            } else {
                window.location.href = "/difficulty";
            }
        });
    }

    if (socialBtn) {
        socialBtn.addEventListener("click", (event) => {
            event.preventDefault();
            if (!ensureAuthenticated()) {
                return;
            }
            if (typeof goTo === "function") {
                goTo("friends");
            } else {
                window.location.href = "/friends";
            }
        });
    }

    if (rewardsBtn) {
        rewardsBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            if (!ensureAuthenticated()) {
                return;
            }
            try {
                await openRewardsModal();
            } catch (error) {
                console.error("Failed to open rewards modal", error);
                openInfoModal({
                    title: "Rewards unavailable",
                    message: error?.message || "Unable to load rewards right now."
                });
            }
        });
    }

    if (leaderboardBtn) {
        leaderboardBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            if (!ensureAuthenticated()) {
                return;
            }
            try {
                await openLeaderboardModal();
            } catch (error) {
                console.error("Failed to open leaderboard modal", error);
                openInfoModal({
                    title: "Leaderboard unavailable",
                    message: error?.message || "Unable to load the leaderboard right now."
                });
            }
        });
    }

    if (historyBtn) {
        historyBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            if (!ensureAuthenticated()) {
                return;
            }
            try {
                await openHistoryModal();
            } catch (error) {
                console.error("Failed to open history modal", error);
                openInfoModal({
                    title: "History unavailable",
                    message: error?.message || "Unable to load the history right now."
                });
            }
        });
    }


    if (playBtn) {
        playBtn.addEventListener('click', async () => {
        if (!ensureAuthenticated()) {
            return;
        }

        const difficulty = localStorage.getItem("bh_game_difficulty") || "moyen";

        try {
            await openLevelSelectorForDifficulty(difficulty);
        } catch (error) {
            console.error("Error:", error);
            alert(error?.message || "Unable to load progression.");
        }
        });
    }

    const openMultiplayerMenu = async ({
        autoJoin = false,
        preferredDifficulty = null,
        preferredStage = null,
    } = {}) => {
        if (!ensureAuthenticated()) {
            return;
        }

        const difficulty = preferredDifficulty || localStorage.getItem("bh_game_difficulty") || "moyen";

        try {
            let stage = Number(preferredStage);
            if (!Number.isFinite(stage) || stage <= 0) {
                const response = await fetch(getApiBase() + "/api/progression/me", {
                    credentials: "include",
                    headers: buildAuthHeaders()
                });

                if (response.status === 401 || response.status === 403) {
                    clearSession();
                    notifyAuthUpdated();
                    redirectToAuth();
                    return;
                }
                if (!response.ok) {
                    stage = 1;
                } else {
                    const progressions = await response.json();
                    stage = Number(progressions?.[difficulty]?.current_stage) || 1;
                }
            }

            if (!modal || !modalTitle) {
                throw new Error("Menu modal unavailable");
            }

            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            modalTitle.textContent = "Multiplayer Mode";
            focusModalShell();

            await multiplayerSelector.show(difficulty, stage);
            if (autoJoin) {
                await multiplayerSelector.quickJoinLobby();
            }
        } catch (error) {
            console.error("Error:", error);
            alert(error?.message || "Unable to load multiplayer mode.");
        }
    };

    // Bouton Multijoueur
    if (multiplayerBtn) {
        multiplayerBtn.addEventListener('click', async () => {
            await openMultiplayerMenu();
        });
    }

    hydrateHeader();
    readPendingToast();

    const startupParams = new URLSearchParams(window.location.search);
    if (startupParams.get("multiplayer") === "1" || startupParams.get("mp") === "1") {
        const preferredDifficulty = startupParams.get("difficulty");
        const preferredStage = Number(startupParams.get("stage"));
        const autoJoin = startupParams.get("auto_join") === "1" || startupParams.get("auto_join") === "true";
        window.history.replaceState({}, "", "/menu");
        openMultiplayerMenu({
            autoJoin,
            preferredDifficulty,
            preferredStage,
        });
    }
}
