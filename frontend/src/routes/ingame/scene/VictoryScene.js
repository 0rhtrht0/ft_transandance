import sceneManager, { SceneType } from './SceneManager.js';

const VICTORY_LINES = [
    "You escaped the Black Hole.",
    "Against all odds, you found the exit.",
    "The void releases you... for now."
];

export class VictoryScene {
    constructor() {
        this.rootElement = null;
        this.lineElement = null;
        this.titleElement = null;
        this.evaluationPointsElement = null;
        this.timeElement = null;
        this.buttonElement = null;
        this.isRunning = false;
        this.currentLineIndex = 0;
        this.intervalId = null;
        
        this.gameData = {};
    }

    async onEnter(options = {}) {
        this.gameData = options || {};
        
        this.rootElement = document.querySelector('.victory');
        this.lineElement = document.getElementById('line');
        this.titleElement = document.getElementById('victory-title');
        this.evaluationPointsElement = document.getElementById('score');
        this.timeElement = document.getElementById('time');
        this.buttonElement = document.getElementById('play-again-btn');

        if (!this.rootElement) {
            console.error('Victory scene root element not found');
            return;
        }

        this._updateStats();
        this._startSequence();
    }


    async onExit() {
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _updateStats() {
        if (this.evaluationPointsElement && this.gameData.evaluation_points !== undefined) {
            this.evaluationPointsElement.textContent = `Evaluation points: ${this.gameData.evaluation_points}`;
        }
        
        if (this.timeElement && this.gameData.time !== undefined) {
            const seconds = Math.floor(this.gameData.time / 1000);
            const minutes = Math.floor(seconds / 60);
            const displaySeconds = seconds % 60;
            this.timeElement.textContent = `Time: ${minutes}:${displaySeconds.toString().padStart(2, '0')}`;
        }
    }


    _startSequence() {
        this.isRunning = true;
        this.currentLineIndex = 0;
        

        if (this.titleElement) {
            this.titleElement.classList.add('fade-in');
        }


        setTimeout(() => {
            if (!this.isRunning) return;
            this._revealLine(VICTORY_LINES[0]);

            this.intervalId = setInterval(() => {
                this.currentLineIndex++;
                
                if (this.currentLineIndex < VICTORY_LINES.length) {
                    this._revealLine(VICTORY_LINES[this.currentLineIndex]);
                } else {
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                    
                    setTimeout(() => {
                        if (this.isRunning && this.buttonElement) {
                            this.buttonElement.classList.add('fade-in');
                            this._setupButton();
                        }
                    }, 500);
                }
            }, 1500);
        }, 800);
    }

    _revealLine(text) {
        if (!this.lineElement) return;

        this.lineElement.classList.remove('fade-in');
        this.lineElement.classList.add('hidden');

        requestAnimationFrame(() => {
            this.lineElement.textContent = text;
            this.lineElement.classList.remove('hidden');
            this.lineElement.classList.add('fade-in');
        });
    }


    _setupButton() {
        if (!this.buttonElement) return;

        this.buttonElement.addEventListener('click', () => {
            sceneManager.setScene(SceneType.GAME);
        });
    }

    update(timestamp) {
    }

    draw(ctx) {

    }
}

export default VictoryScene;
