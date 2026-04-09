import Game from "./engine/game.js"
import SceneManager from "./scene/SceneManager.js"
import GameScene from "./scene/GameScene.js"

import { initMissionFeed } from "./ingame_mission.js"
import { buildMultiplayerOptions } from "./ingame_multiplayer.js"
import { getGameDifficulty, setGameDifficulty } from "./ingame_difficulty.js"
import { getGameStage, setGameStage } from "./ingame_stage.js"
import { rememberGameMode } from "./ingame_restart.js"

export { getGameDifficulty, setGameDifficulty } from "./ingame_difficulty.js"
export { getGameStage, setGameStage } from "./ingame_stage.js"

export function init_ingame(options = {}) {
    const ingameRoot = document.querySelector(".ingame")
    initMissionFeed(ingameRoot, options.onComplete)
}

export function init_maze(options = {}) {
    const canvas = document.getElementById("gameCanvas")
    const overlay = document.getElementById("overlayCanvas")
    if (!canvas) {
        console.error("Game canvas not found")
        return
    }

    const difficulty = options.difficulty ?? getGameDifficulty()
    const stage = options.stage ?? getGameStage()
    setGameDifficulty(difficulty)
    setGameStage(stage)
    const game = new Game(canvas, overlay)
    const sceneManager = new SceneManager(game)
    const multiplayer = buildMultiplayerOptions(options)
    rememberGameMode(multiplayer.enabled === true)
    sceneManager.addScene(
        "game",
        new GameScene(game, { onQuit: options.onQuit, multiplayer, difficulty, stage })
    )
    game.setSceneManager(sceneManager)
    sceneManager.setScene("game")
    game.start()
}
