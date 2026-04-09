import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import {
    buildRestartRoute,
    getLastGameMode,
    LAST_GAME_MODE_MULTIPLAYER
} from "../../routes/ingame/ingame_restart.js"
import {
    normalizeDifficulty,
    normalizeStage,
    settleVictoryProgression
} from "../../routes/ingame/ingame_progression.js"
import {
    formatWalletDelta,
    getWalletAchievementPresentation,
    readCachedWalletBalance,
    readLastResultSnapshot,
} from "../../utils/walletProgression.js"

const FULL_TITLE = "YOU ESCAPED THE SINGULARITY."
const FULL_SUBTITLE = "But the void is not done with you..."

const PARALLAX_IDLE_DELAY_MS = 1200
const PARALLAX_IDLE_AMPLITUDE = 0.28
const PARALLAX_LERP = 0.085
const TEXT_REVEAL_DELAY_MS = 5000
const TEXT_REVEAL_DURATION_MS = 2800
const ACTIONS_DELAY_AFTER_REVEAL_MS = 700

export function useVictoryScene(router) {
    const collapsed = ref(false)
    const showActions = ref(false)
    const textRevealProgress = ref(0)
    const textRevealStarted = ref(false)
    const showAchievementPopup = ref(false)
    const resultSnapshot = ref({
        result: "victory",
        evaluation_points: 1,
        wallet_balance: readCachedWalletBalance(),
        is_multiplayer: false,
        players: [],
        unlocked_achievements: []
    })

    const viewportWidth = ref(0)
    const viewportHeight = ref(0)
    const animationClockMs = ref(0)

    const currentParallaxX = ref(0)
    const currentParallaxY = ref(0)
    const targetParallaxX = ref(0)
    const targetParallaxY = ref(0)

    let lastPointerTs = 0
    let textRevealStartTs = 0
    let parallaxRafId = 0
    let progressionPromise = null
    let achievementTimeoutId = 0

    const timeoutIds = []

    const parallaxStyle = computed(() => ({
        "--parallax-x": `${currentParallaxX.value}`,
        "--parallax-y": `${currentParallaxY.value}`
    }))

    const revealEase = computed(() => easeOutCubic(textRevealProgress.value))
    const settleFactor = computed(() => 1 - revealEase.value)
    const revealAlpha = computed(() => (
        textRevealStarted.value ? Math.min(1, 0.24 + revealEase.value * 0.76) : 0
    ))
    const revealScale = computed(() => 0.72 + revealEase.value * 0.28)
    const panelAlpha = computed(() => (
        textRevealStarted.value ? settleFactor.value * 0.34 : 0
    ))
    const ghostAlpha = computed(() => (
        textRevealStarted.value ? settleFactor.value * 0.38 : 0
    ))

    const messagePanelStyle = computed(() => ({
        opacity: panelAlpha.value.toFixed(3)
    }))

    const titleFrontStyle = computed(() => buildFrontTextStyle(1, 1, 0.58))
    const titleGhostStyle = computed(() => buildGhostTextStyle(1, 0.62, 0.42))
    const subtitleFrontStyle = computed(() => buildFrontTextStyle(-1, 0.82, 0.46))
    const subtitleGhostStyle = computed(() => buildGhostTextStyle(-1, 0.5, 0.34))
    const resultDeltaText = computed(() => {
        const delta = Number(resultSnapshot.value?.evaluation_points) || 0
        const suffix = Math.abs(delta) === 1 ? "Evaluation Point" : "Evaluation Points"
        return `${formatWalletDelta(delta)} ${suffix}`
    })
    const walletLine = computed(
        () => `Wallet: ${Math.trunc(Number(resultSnapshot.value?.wallet_balance) || 0)} EP`
    )
    const multiplayerPlayers = computed(() => {
        const rows = Array.isArray(resultSnapshot.value?.players) ? resultSnapshot.value.players : []
        return rows.slice(0, 4)
    })
    const hasMultiplayerSummary = computed(
        () => Boolean(resultSnapshot.value?.is_multiplayer) && multiplayerPlayers.value.length > 1
    )
    const achievementPresentation = computed(() => {
        const firstAchievement = resultSnapshot.value?.unlocked_achievements?.[0]
        return firstAchievement ? getWalletAchievementPresentation(firstAchievement) : null
    })

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value))
    }

    function easeOutCubic(value) {
        return 1 - Math.pow(1 - value, 3)
    }

    function hydrateResultSnapshot() {
        const snapshot = readLastResultSnapshot()
        if (!snapshot) {
            resultSnapshot.value = {
                ...resultSnapshot.value,
                wallet_balance: readCachedWalletBalance(),
            }
            return
        }

        resultSnapshot.value = {
            result: snapshot?.result || "victory",
            evaluation_points: Math.trunc(Number(snapshot?.evaluation_points) || 1),
            wallet_balance: Math.trunc(Number(snapshot?.wallet_balance) || readCachedWalletBalance()),
            is_multiplayer: Boolean(snapshot?.is_multiplayer),
            players: Array.isArray(snapshot?.players) ? snapshot.players : [],
            unlocked_achievements: Array.isArray(snapshot?.unlocked_achievements)
                ? snapshot.unlocked_achievements
                : [],
        }
    }

    function ensureVictoryProgression() {
        if (!progressionPromise) {
            progressionPromise = settleVictoryProgression().catch((error) => {
                console.warn("Unable to update victory progression", error)
                progressionPromise = null
                return null
            })
        }
        return progressionPromise
    }

    function updateViewportSize() {
        viewportWidth.value = window.innerWidth || 1
        viewportHeight.value = window.innerHeight || 1
    }

    function scheduleTimeout(callback, delayMs) {
        const id = window.setTimeout(callback, delayMs)
        timeoutIds.push(id)
        return id
    }

    function tickParallax(nowTs) {
        animationClockMs.value = nowTs

        if (textRevealStarted.value) {
            const progress = (nowTs - textRevealStartTs) / TEXT_REVEAL_DURATION_MS
            textRevealProgress.value = clamp(progress, 0, 1)
        }

        if (nowTs - lastPointerTs > PARALLAX_IDLE_DELAY_MS) {
            targetParallaxX.value = Math.sin(nowTs * 0.00035) * PARALLAX_IDLE_AMPLITUDE
            targetParallaxY.value = Math.cos(nowTs * 0.00029) * PARALLAX_IDLE_AMPLITUDE
        }

        currentParallaxX.value += (targetParallaxX.value - currentParallaxX.value) * PARALLAX_LERP
        currentParallaxY.value += (targetParallaxY.value - currentParallaxY.value) * PARALLAX_LERP
        parallaxRafId = window.requestAnimationFrame(tickParallax)
    }

    function handlePointerMove(event) {
        const width = window.innerWidth || 1
        const height = window.innerHeight || 1
        const normalizedX = (event.clientX / width) * 2 - 1
        const normalizedY = (event.clientY / height) * 2 - 1
        targetParallaxX.value = clamp(normalizedX, -1, 1)
        targetParallaxY.value = clamp(normalizedY, -1, 1)
        lastPointerTs = performance.now()
    }

    function resetParallax() {
        targetParallaxX.value = 0
        targetParallaxY.value = 0
        lastPointerTs = performance.now()
    }

    function handleSkipPointerDown(event) {
        if (showActions.value) {
            return
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return
        }
        void goNext()
    }

    function getTextMotion() {
        const settle = settleFactor.value
        const t = animationClockMs.value / 1000
        const moveBaseX = Math.max(180, viewportWidth.value * 0.52) * settle
        const moveBaseY = Math.max(96, viewportHeight.value * 0.28) * settle
        const driftX = Math.sin(t * 6.4) * settle * Math.max(12, viewportWidth.value * 0.024)
        const driftY = Math.cos(t * 5.1) * settle * Math.max(10, viewportHeight.value * 0.02)
        return { moveBaseX, moveBaseY, driftX, driftY }
    }

    function buildFrontTextStyle(direction, xMultiplier, yMultiplier) {
        if (!textRevealStarted.value) {
            return {
                opacity: "0",
                transform: "translate3d(0px, 0px, 0px) scale(0.72)"
            }
        }

        const { moveBaseX, moveBaseY, driftX, driftY } = getTextMotion()
        const x = direction * moveBaseX * xMultiplier + driftX
        const y = -direction * moveBaseY * yMultiplier + driftY
        return {
            opacity: revealAlpha.value.toFixed(3),
            transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${revealScale.value.toFixed(3)})`
        }
    }

    function buildGhostTextStyle(direction, xMultiplier, yMultiplier) {
        if (!textRevealStarted.value) {
            return {
                opacity: "0",
                transform: "translate3d(0px, 0px, 0px) scale(0.72)"
            }
        }

        const { moveBaseX, moveBaseY, driftX, driftY } = getTextMotion()
        const x = direction * moveBaseX * xMultiplier + driftX * 0.8
        const y = -direction * moveBaseY * yMultiplier + driftY * 0.7
        return {
            opacity: (ghostAlpha.value * revealAlpha.value).toFixed(3),
            transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${revealScale.value.toFixed(3)})`
        }
    }

    onMounted(() => {
        hydrateResultSnapshot()
        updateViewportSize()
        window.addEventListener("resize", updateViewportSize)
        lastPointerTs = performance.now()
        textRevealStartTs = lastPointerTs
        parallaxRafId = window.requestAnimationFrame(tickParallax)

        scheduleTimeout(() => {
            collapsed.value = true
        }, 1000)

        scheduleTimeout(() => {
            textRevealStarted.value = true
            textRevealProgress.value = 0
            textRevealStartTs = performance.now()
            scheduleTimeout(() => {
                showActions.value = true
            }, TEXT_REVEAL_DURATION_MS + ACTIONS_DELAY_AFTER_REVEAL_MS)
        }, TEXT_REVEAL_DELAY_MS)

        if (achievementPresentation.value) {
            showAchievementPopup.value = true
            achievementTimeoutId = window.setTimeout(() => {
                showAchievementPopup.value = false
                achievementTimeoutId = 0
            }, 4200)
        }

        void ensureVictoryProgression()
    })

    onBeforeUnmount(() => {
        window.removeEventListener("resize", updateViewportSize)

        if (parallaxRafId !== 0) {
            window.cancelAnimationFrame(parallaxRafId)
            parallaxRafId = 0
        }

        for (const timeoutId of timeoutIds) {
            window.clearTimeout(timeoutId)
        }
        timeoutIds.length = 0

        if (achievementTimeoutId) {
            window.clearTimeout(achievementTimeoutId)
            achievementTimeoutId = 0
        }
    })

    async function goNext() {
        if (getLastGameMode() === LAST_GAME_MODE_MULTIPLAYER) {
            await router.push(buildRestartRoute())
            return
        }

        const settledProgression = await ensureVictoryProgression()
        const difficulty = settledProgression?.difficulty
            ?? normalizeDifficulty(localStorage.getItem("bh_game_difficulty"))
        const stage = settledProgression?.stage
            ?? normalizeStage(localStorage.getItem("bh_game_stage"))
        if (difficulty && stage) {
            await router.push({ name: "ingame", query: { difficulty, stage: String(stage) } })
            return
        }
        await router.push({ name: "ingame" })
    }

    async function goMenu() {
        await ensureVictoryProgression()
        await router.push({ name: "menu" })
    }

    return {
        achievementPresentation,
        collapsed,
        fullTitle: FULL_TITLE,
        fullSubtitle: FULL_SUBTITLE,
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
    }
}
