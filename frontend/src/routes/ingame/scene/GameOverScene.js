import sceneManager, { SceneType } from './SceneManager.js';

const GAME_OVER_LINES = [
    "The Blackhole never lets anyone go.",
    "They are hunting you. They will find you.",
    "The light fades. The game is over."
];

export class GameOverScene {
    constructor() {
        this.rootElement = null;
        this.lineElement = null;
        this.buttonElement = null;
        this.isRunning = false;
        this.currentLineIndex = 0;
        this.intervalId = null;
        this.gameData = {};
    }

    async onEnter(options = {}) {
        this.gameData = options || {};

        this.rootElement = document.querySelector('.gameover');
        this.lineElement = document.getElementById('line');
        this.buttonElement = document.getElementById('restart-btn');

        if (!this.rootElement) {
            console.error('Game over scene root element not found');
            return;
        }

        this._startSequence();
    }

    async onExit() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _startSequence() {
        this.isRunning = true;
        this.currentLineIndex = 0;

        this._revealLine(GAME_OVER_LINES[0]);

        this.intervalId = setInterval(() => {
            if (!this.isRunning) {
                return;
            }

            this.currentLineIndex += 1;
            if (this.currentLineIndex < GAME_OVER_LINES.length) {
                this._revealLine(GAME_OVER_LINES[this.currentLineIndex]);
                return;
            }

            clearInterval(this.intervalId);
            this.intervalId = null;

            setTimeout(() => {
                if (!this.isRunning || !this.buttonElement) {
                    return;
                }

                this.buttonElement.classList.remove('hidden');
                this.buttonElement.classList.add('fade-in');
                this.buttonElement.addEventListener(
                    'click',
                    () => {
                        sceneManager.setScene(SceneType.INTRO);
                    },
                    { once: true }
                );
            }, 500);
        }, 1500);
    }

    _revealLine(text) {
        if (!this.lineElement) {
            return;
        }

        this.lineElement.classList.remove('fade-in');
        this.lineElement.classList.add('hidden');

        requestAnimationFrame(() => {
            this.lineElement.textContent = text;
            this.lineElement.classList.remove('hidden');
            this.lineElement.classList.add('fade-in');
        });
    }

    update(timestamp) {
    }

    draw(ctx) {
    }
}

export default GameOverScene;
