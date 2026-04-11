export default class Input {
    constructor() {
        this.keys = Object.create(null);
        this.justPressed = Object.create(null);
        this.controlKeys = new Set([
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "KeyW",
            "KeyZ",
            "KeyA",
            "KeyQ",
            "KeyS",
            "KeyD",
            "ShiftLeft",
            "ShiftRight",
            "Escape",
            "Space"
        ]);

        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        window.addEventListener("keydown", this.boundKeyDown);
        window.addEventListener("keyup", this.boundKeyUp);
    }

    handleKeyDown(event) {
        if (this.controlKeys.has(event.code)) {
            event.preventDefault();
        }
        if (this.keys[event.code] !== true) {
            this.justPressed[event.code] = true;
        }
        this.keys[event.code] = true;
    }

    handleKeyUp(event) {
        if (this.controlKeys.has(event.code)) {
            event.preventDefault();
        }
        this.keys[event.code] = false;
    }

    isDown(key) {
        return this.keys[key] === true;
    }

    consumePress(key) {
        if (this.justPressed[key] !== true) {
            return false;
        }
        this.justPressed[key] = false;
        return true;
    }

    destroy() {
        window.removeEventListener("keydown", this.boundKeyDown);
        window.removeEventListener("keyup", this.boundKeyUp);
        this.keys = Object.create(null);
        this.justPressed = Object.create(null);
    }
}
