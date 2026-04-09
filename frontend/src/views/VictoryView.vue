<template>
    <div
        class="victory-container"
        :style="parallaxStyle"
        @pointermove="handlePointerMove"
        @pointerleave="resetParallax"
        @pointerdown="handleSkipPointerDown"
    >
        <div class="parallax-layer parallax-stars"></div>
        <div class="parallax-layer parallax-nebula"></div>
        <div class="parallax-layer parallax-grain"></div>

        <transition name="fade-btn">
            <aside v-if="showAchievementPopup && achievementPresentation" class="achievement-popup">
                <span>Achievement Unlocked</span>
                <strong>{{ achievementPresentation.label }}</strong>
                <small>{{ achievementPresentation.description }}</small>
            </aside>
        </transition>

        <div class="blackhole-shell" :class="{ collapse: collapsed }">
            <div class="blackhole"></div>
        </div>

        <div class="content-layer">
            <div class="content">
                <div class="message-stage">
                    <div class="message-panel" :style="messagePanelStyle"></div>
                    <div class="line-stack title-stack">
                        <h1 class="title title-ghost" :style="titleGhostStyle">{{ fullTitle }}</h1>
                        <h1 class="title title-main" :style="titleFrontStyle">{{ fullTitle }}</h1>
                    </div>
                    <div class="line-stack subtitle-stack">
                        <p class="subtitle subtitle-ghost" :style="subtitleGhostStyle">{{ fullSubtitle }}</p>
                        <p class="subtitle subtitle-main" :style="subtitleFrontStyle">{{ fullSubtitle }}</p>
                    </div>

                    <div v-if="hasMultiplayerSummary" class="result-panel">
                        <p class="result-panel__title">Victory</p>
                        <strong class="result-panel__delta">{{ resultDeltaText }}</strong>
                        <span class="result-panel__wallet">{{ walletLine }}</span>

                        <div class="result-panel__players">
                            <article
                                v-for="player in multiplayerPlayers"
                                :key="player.id"
                                class="result-player-card"
                                :class="{ 'is-local': player.is_local }"
                            >
                                <span>{{ player.username }}</span>
                                <strong>{{ player.delta > 0 ? `+${player.delta}` : player.delta }} EP</strong>
                                <small>Wallet {{ player.after_points }} EP</small>
                            </article>
                        </div>
                    </div>
                </div>

                <transition name="fade-btn">
                    <div v-if="showActions" class="victory-actions">
                        <button class="next-btn" @click="goNext">
                            ENTER THE NEXT PHASE
                        </button>
                        <button class="quit-btn" @click="goMenu">
                            QUITTER
                        </button>
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useRouter } from "vue-router"

import { useVictoryScene } from "./victory/useVictoryScene.js"

const router = useRouter()
const {
    achievementPresentation,
    collapsed,
    fullTitle,
    fullSubtitle,
    goMenu,
    goNext,
    handlePointerMove,
    handleSkipPointerDown,
    hasMultiplayerSummary,
    messagePanelStyle,
    multiplayerPlayers,
    parallaxStyle,
    resetParallax,
    resultDeltaText,
    showAchievementPopup,
    showActions,
    subtitleFrontStyle,
    subtitleGhostStyle,
    titleFrontStyle,
    titleGhostStyle,
    walletLine,
} = useVictoryScene(router)
</script>

<style scoped>
.fade-btn-enter-active, .fade-btn-leave-active {
    transition: opacity 0.8s, transform 0.8s;
}

.fade-btn-enter-from, .fade-btn-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.86);
}

.fade-btn-enter-to, .fade-btn-leave-from {
    opacity: 1;
    transform: scale(1);
}

.victory-container {
    --parallax-x: 0;
    --parallax-y: 0;
    position: relative;
    height: 100vh;
    background: radial-gradient(circle at center, #050505 0%, #000 70%);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #e0e0e0;
    font-family: "Orbitron", sans-serif;
    animation: globalBreathe 8s ease-in-out infinite;
}

.parallax-layer {
    position: absolute;
    inset: -12%;
    pointer-events: none;
    z-index: 0;
    will-change: transform;
}

.parallax-stars {
    background:
        radial-gradient(circle at 14% 22%, rgba(255, 255, 255, 0.22) 0 1px, transparent 2px),
        radial-gradient(circle at 78% 34%, rgba(255, 255, 255, 0.18) 0 1px, transparent 2px),
        radial-gradient(circle at 58% 72%, rgba(255, 255, 255, 0.17) 0 1px, transparent 2px),
        radial-gradient(circle at 32% 64%, rgba(255, 255, 255, 0.16) 0 1px, transparent 2px);
    opacity: 0.72;
    transform: translate3d(calc(var(--parallax-x) * -22px), calc(var(--parallax-y) * -18px), 0);
    animation: starsDrift 24s linear infinite;
}

.parallax-nebula {
    background:
        radial-gradient(circle at 24% 20%, rgba(130, 25, 25, 0.24), transparent 52%),
        radial-gradient(circle at 74% 72%, rgba(170, 65, 65, 0.16), transparent 50%),
        radial-gradient(circle at 52% 50%, rgba(255, 255, 255, 0.06), transparent 60%);
    opacity: 0.7;
    mix-blend-mode: screen;
    transform: translate3d(calc(var(--parallax-x) * 16px), calc(var(--parallax-y) * 12px), 0) scale(1.05);
    animation: nebulaPulse 10s ease-in-out infinite;
}

.parallax-grain {
    opacity: 0.2;
    mix-blend-mode: soft-light;
    background:
        repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 4px),
        repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 5px);
    transform: translate3d(calc(var(--parallax-x) * -10px), calc(var(--parallax-y) * 7px), 0);
    animation: grainShift 1s steps(4) infinite;
}

.achievement-popup {
    position: absolute;
    top: 26px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    min-width: min(340px, calc(100vw - 32px));
    padding: 14px 18px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    background: rgba(8, 8, 8, 0.88);
    box-shadow:
        0 18px 42px rgba(0, 0, 0, 0.48),
        0 0 22px rgba(255, 255, 255, 0.08);
    display: grid;
    gap: 4px;
    text-align: center;
}

.achievement-popup span,
.achievement-popup small {
    color: rgba(255, 255, 255, 0.72);
}

.achievement-popup strong {
    color: #ffffff;
}

.blackhole-shell {
    position: absolute;
    width: 300px;
    height: 300px;
    z-index: 1;
    transform: translate3d(calc(var(--parallax-x) * 20px), calc(var(--parallax-y) * 16px), 0) scale(1);
    transition: transform 0.35s ease-out, opacity 4s ease-in-out;
    will-change: transform, opacity;
}

.blackhole {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, #000 30%, #111 70%, #000 10%);
    border-radius: 50%;
    animation: breathe 6s ease-in-out infinite;
}

.blackhole-shell.collapse {
    transform: translate3d(calc(var(--parallax-x) * 6px), calc(var(--parallax-y) * 5px), 0) scale(0);
    opacity: 0;
}

.content-layer {
    position: relative;
    z-index: 2;
    transform: translate3d(calc(var(--parallax-x) * -18px), calc(var(--parallax-y) * -12px), 0);
    transition: transform 0.22s ease-out;
    will-change: transform;
}

.content {
    position: relative;
    width: min(92vw, 980px);
    text-align: center;
    opacity: 0;
    animation: fadeInUp 2.4s forwards 2s;
}

.message-stage {
    position: relative;
    width: 100%;
    padding: clamp(14px, 2.8vw, 24px) clamp(18px, 3.5vw, 34px);
    margin-bottom: 2rem;
}

.message-panel {
    position: absolute;
    inset: 6% 3%;
    border-radius: 26px;
    border: 2px solid rgba(255, 255, 255, 0.22);
    background: rgba(0, 0, 0, 0.72);
    pointer-events: none;
    z-index: 0;
}

.line-stack {
    position: relative;
    display: grid;
    place-items: center;
    z-index: 1;
}

.line-stack > * {
    grid-area: 1 / 1;
    margin: 0;
    text-align: center;
    will-change: transform, opacity;
}

.title-stack {
    min-height: clamp(64px, 9vw, 92px);
    margin-bottom: 12px;
}

.subtitle-stack {
    min-height: clamp(36px, 5vw, 50px);
}

.title {
    font-size: clamp(1.45rem, 4.7vw, 2.95rem);
    font-weight: 900;
    letter-spacing: 0.08em;
    line-height: 1.08;
}

.subtitle {
    font-size: clamp(0.92rem, 2.1vw, 1.22rem);
    letter-spacing: 0.03em;
    line-height: 1.4;
}

.title-main {
    color: #ffffff;
    text-shadow:
        0 0 0 rgba(0, 0, 0, 0.98),
        0 3px 0 rgba(0, 0, 0, 0.96),
        0 0 18px rgba(255, 64, 64, 0.4);
    animation: textBreathe 5s ease-in-out infinite;
}

.title-ghost {
    color: rgba(255, 76, 76, 0.92);
}

.subtitle-main {
    color: rgba(235, 235, 235, 0.9);
    text-shadow:
        0 2px 0 rgba(0, 0, 0, 0.88),
        0 0 14px rgba(255, 64, 64, 0.24);
}

.subtitle-ghost {
    color: rgba(255, 150, 150, 0.8);
}

.result-panel {
    position: relative;
    z-index: 1;
    width: min(420px, 92%);
    margin: 28px auto 0;
    padding: 16px 18px;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(0, 0, 0, 0.7);
    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.42);
    display: grid;
    gap: 8px;
}

.result-panel__title {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.68);
}

.result-panel__delta {
    font-size: clamp(1.2rem, 2.8vw, 1.5rem);
    color: #ffffff;
}

.result-panel__wallet {
    font-size: 0.94rem;
    color: rgba(255, 255, 255, 0.82);
}

.result-panel__players {
    display: grid;
    gap: 10px;
    margin-top: 4px;
}

.result-player-card {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
}

.result-player-card.is-local {
    border-color: rgba(255, 255, 255, 0.34);
}

.result-player-card span,
.result-player-card small {
    color: rgba(255, 255, 255, 0.72);
}

.result-player-card strong {
    color: #ffffff;
}

.victory-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
}

.next-btn,
.quit-btn {
    padding: 13px 24px;
    border-radius: 999px;
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    cursor: pointer;
    transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease;
}

.next-btn {
    min-width: 220px;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    background: linear-gradient(145deg, rgba(40, 40, 40, 0.94), rgba(25, 25, 25, 0.84));
    color: #f5f5f5;
    box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.74),
        0 0 22px rgba(255, 255, 255, 0.1);
}

.next-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.5);
    background: linear-gradient(145deg, rgba(60, 60, 60, 0.92), rgba(40, 40, 40, 0.88));
    box-shadow:
        0 22px 42px rgba(0, 0, 0, 0.84),
        0 0 28px rgba(255, 255, 255, 0.15);
}

.quit-btn {
    min-width: 170px;
    border: 1.5px solid rgba(255, 165, 165, 0.44);
    background: linear-gradient(145deg, rgba(74, 24, 24, 0.9), rgba(36, 14, 14, 0.86));
    color: #f5f5f5;
    box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.74),
        0 0 22px rgba(255, 120, 120, 0.14);
}

.quit-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 185, 185, 0.72);
    background: linear-gradient(145deg, rgba(90, 30, 30, 0.94), rgba(44, 16, 16, 0.9));
    box-shadow:
        0 22px 42px rgba(0, 0, 0, 0.84),
        0 0 28px rgba(255, 140, 140, 0.2);
}

.next-btn:active,
.quit-btn:active {
    transform: translateY(0);
}

@keyframes fadeInUp {
    0% {
        opacity: 0;
        transform: translateY(22px) scale(0.98);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes breathe {
    0% {
        transform: scale(1);
        box-shadow: 0 0 60px rgba(120, 0, 0, 0.25);
    }
    50% {
        transform: scale(1.05);
        box-shadow: 0 0 120px rgba(150, 0, 0, 0.4);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 0 60px rgba(120, 0, 0, 0.25);
    }
}

@keyframes starsDrift {
    0% {
        transform: translate3d(calc(var(--parallax-x) * -22px), calc(var(--parallax-y) * -18px), 0);
    }
    50% {
        transform: translate3d(calc(var(--parallax-x) * -26px), calc(var(--parallax-y) * -14px), 0);
    }
    100% {
        transform: translate3d(calc(var(--parallax-x) * -22px), calc(var(--parallax-y) * -18px), 0);
    }
}

@keyframes nebulaPulse {
    0% {
        transform: translate3d(calc(var(--parallax-x) * 16px), calc(var(--parallax-y) * 12px), 0) scale(1.05);
        opacity: 0.64;
    }
    50% {
        transform: translate3d(calc(var(--parallax-x) * 20px), calc(var(--parallax-y) * 16px), 0) scale(1.1);
        opacity: 0.82;
    }
    100% {
        transform: translate3d(calc(var(--parallax-x) * 16px), calc(var(--parallax-y) * 12px), 0) scale(1.05);
        opacity: 0.64;
    }
}

@keyframes grainShift {
    0% {
        transform: translate3d(calc(var(--parallax-x) * -10px), calc(var(--parallax-y) * 7px), 0);
    }
    25% {
        transform: translate3d(calc(var(--parallax-x) * -8px), calc(var(--parallax-y) * 9px), 0);
    }
    50% {
        transform: translate3d(calc(var(--parallax-x) * -12px), calc(var(--parallax-y) * 5px), 0);
    }
    75% {
        transform: translate3d(calc(var(--parallax-x) * -9px), calc(var(--parallax-y) * 8px), 0);
    }
    100% {
        transform: translate3d(calc(var(--parallax-x) * -10px), calc(var(--parallax-y) * 7px), 0);
    }
}

@keyframes textBreathe {
    0% { opacity: 0.9; letter-spacing: 2px; }
    50% { opacity: 1; letter-spacing: 3px; }
    100% { opacity: 0.9; letter-spacing: 2px; }
}

@keyframes globalBreathe {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.1); }
    100% { filter: brightness(1); }
}

@media (max-width: 680px) {
    .blackhole-shell {
        width: 240px;
        height: 240px;
    }

    .content-layer {
        transform: translate3d(calc(var(--parallax-x) * -10px), calc(var(--parallax-y) * -7px), 0);
    }

    .message-stage {
        padding-inline: 12px;
    }

    .message-panel {
        inset: 7% 1%;
        border-radius: 18px;
    }

    .achievement-popup {
        top: 18px;
        min-width: calc(100vw - 24px);
    }

    .victory-actions {
        width: 100%;
        flex-direction: column;
    }

    .next-btn,
    .quit-btn {
        width: 100%;
        max-width: 420px;
    }
}
</style>
