import sceneManager, { SceneType } from './SceneManager.js';

const INTRO_LINES = [
    "The darkness is already watching you.",
    "There is an exit. You were never meant to reach it.",
    "Do not turn back.",
    "The Blackhole is closing in."
];

export class IntroScene {
    constructor() {
        this.rootElement = null;
        this.titleElement = null;
        this.subtitleElement = null;
        this.lineElement = null;
        this.questionElement = null;
        this.buttonElement = null;
        this.isRunning = false;
        this.currentLineIndex = 0;
        this.disposeParallax = null;
        this.animationFrameId = null;
    }

    async onEnter(options = {}) {
        this.rootElement = document.querySelector('.intro');
        
        if (!this.rootElement) {
            console.error('Intro root element not found');
            return;
        }

        this.titleElement = document.getElementById('title');
        this.subtitleElement = document.getElementById('subtitle');
        this.lineElement = document.getElementById('line');
        this.questionElement = document.getElementById('question');
        this.buttonElement = document.getElementById('enter-btn');

        this._setupParallax();
        this._startIntroSequence();
    }

    async onExit() {
        this.isRunning = false;
        
        if (this.disposeParallax) {
            this.disposeParallax();
            this.disposeParallax = null;
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _setupParallax() {
        const updateParallax = (event) => {
            const bounds = this.rootElement.getBoundingClientRect();
            const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
            const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

            this.rootElement.style.setProperty('--mx', ratioX.toFixed(3));
            this.rootElement.style.setProperty('--my', ratioY.toFixed(3));
        };

        const resetParallax = () => {
            this.rootElement.style.setProperty('--mx', '0');
            this.rootElement.style.setProperty('--my', '0');
        };

        this.rootElement.addEventListener('pointermove', updateParallax);
        this.rootElement.addEventListener('pointerleave', resetParallax);

        this.disposeParallax = () => {
            this.rootElement.removeEventListener('pointermove', updateParallax);
            this.rootElement.removeEventListener('pointerleave', resetParallax);
        };
    }

    async _startIntroSequence() {
        this.isRunning = true;
        const questionText = this.questionElement?.textContent.trim() || '';

        if (this.buttonElement) {
            this.buttonElement.textContent = '';
        }
        if (this.questionElement) {
            this.questionElement.textContent = '';
            this.questionElement.classList.add('hidden');
        }

        await this._sleep(800);
        if (!this.isRunning) return;

        this.titleElement?.classList.add('fade-in');

        await this._sleep(350);
        if (!this.isRunning) return;

        this.subtitleElement?.classList.add('fade-in');

        await this._sleep(850);
        if (!this.isRunning) return;

        for (const line of INTRO_LINES) {
            if (!this.isRunning) return;
            await this._revealLine(line);
            await this._sleep(780);
        }

        if (!this.isRunning) return;
        await this._revealLine(questionText, 1300);

        await this._sleep(800);
        if (!this.isRunning) return;

        this._setupButton();
    }

    async _revealLine(text, duration = 1100) {
        if (!this.lineElement) return;

        this.lineElement.classList.remove('horror-reveal', 'horror-idle', 'fade-in');
        this.lineElement.classList.add('hidden');
        this.lineElement.removeAttribute('data-echo');

        await this._sleep(80);
        if (!this.isRunning) return false;

        this.lineElement.textContent = text;
        this.lineElement.setAttribute('data-echo', text);
        this.lineElement.classList.remove('hidden');
        this.lineElement.classList.add('horror-reveal');

        await this._sleep(duration);
        if (!this.isRunning) return false;

        this.lineElement.classList.remove('horror-reveal');
        this.lineElement.classList.add('horror-idle');
        return true;
    }

    _setupButton() {
        if (!this.buttonElement) return;

        this.buttonElement.classList.add('fade-in');
        this.buttonElement.addEventListener(
            'click',
            () => {
                sceneManager.setScene(SceneType.GAME);
            },
            { once: true }
        );
    }

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    update(timestamp) {
    }

    draw(ctx) {
    }
}

export default IntroScene;
