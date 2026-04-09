const MOVEMENT_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyZ",
    "KeyA",
    "KeyQ",
    "KeyS",
    "KeyD"
]);

export default class Player {
    constructor(x, y, inputOrOptions = {}, maybeOptions = {}) {
        this.x = x;
        this.y = y;

        const hasInput = inputOrOptions && typeof inputOrOptions.isDown === "function";
        if (hasInput) {
            this.input = inputOrOptions;
        } else {
            this.input = null;
        }
        let options;
        if (hasInput) {
            options = maybeOptions;
        } else {
            options = inputOrOptions;
        }

        this.radius = Math.max(3, options.radius ?? 10);
        this.speed = Math.max(40, options.speed ?? 260);
        this.sprintMultiplier = Math.max(1, options.sprintMultiplier ?? 1.45);
        this.baseFillColor = options.baseFillColor ?? "#f4f4f4";
        this.baseStrokeColor = options.baseStrokeColor ?? "#111";
        this.bonusFillColor = options.bonusFillColor ?? "#ff3f3f";
        this.bonusStrokeColor = options.bonusStrokeColor ?? "#260404";
        this.isBonusActive = false;
        this.activeKeys = new Set();

        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleKeyUp = this.handleKeyUp.bind(this);

        if (!this.input) {
            window.addEventListener("keydown", this.boundHandleKeyDown);
            window.addEventListener("keyup", this.boundHandleKeyUp);
        }
    }

    destroy() {
        if (!this.input) {
            window.removeEventListener("keydown", this.boundHandleKeyDown);
            window.removeEventListener("keyup", this.boundHandleKeyUp);
        }
    }

    handleKeyDown(event) {
        if (MOVEMENT_KEYS.has(event.code)) {
            event.preventDefault();
            this.activeKeys.add(event.code);
        }
    }

    handleKeyUp(event) {
        this.activeKeys.delete(event.code);
    }

    isDown(code) {
        if (this.input) {
            return this.input.isDown(code);
        }
        return this.activeKeys.has(code);
    }

    update(deltaSeconds, maze) {
        let rightPressed;
        if (this.isDown("KeyD") || this.isDown("ArrowRight")) {
            rightPressed = 1;
        } else {
            rightPressed = 0;
        }
        let leftPressed;
        if (this.isDown("KeyA") || this.isDown("KeyQ") || this.isDown("ArrowLeft")) {
            leftPressed = 1;
        } else {
            leftPressed = 0;
        }
        const inputX = rightPressed - leftPressed;
        let downPressed;
        if (this.isDown("KeyS") || this.isDown("ArrowDown")) {
            downPressed = 1;
        } else {
            downPressed = 0;
        }
        let upPressed;
        if (this.isDown("KeyW") || this.isDown("KeyZ") || this.isDown("ArrowUp")) {
            upPressed = 1;
        } else {
            upPressed = 0;
        }
        const inputY = downPressed - upPressed;

        if (inputX === 0 && inputY === 0) {
            return;
        }

        const length = Math.hypot(inputX, inputY);
        const dirX = inputX / length;
        const dirY = inputY / length;
        const isSprinting = this.isDown("ShiftLeft") || this.isDown("ShiftRight");
        let movementSpeed;
        if (isSprinting) {
            movementSpeed = this.speed * this.sprintMultiplier;
        } else {
            movementSpeed = this.speed;
        }
        const moveX = dirX * movementSpeed * deltaSeconds;
        const moveY = dirY * movementSpeed * deltaSeconds;

        this.tryMove(moveX, moveY, maze);
    }

    tryMove(moveX, moveY, maze) {
        const nextX = this.x + moveX;
        const nextY = this.y + moveY;

        if (!maze.isWallAtPixel(nextX, this.y, this.radius)) {
            this.x = nextX;
        }
        if (!maze.isWallAtPixel(this.x, nextY, this.radius)) {
            this.y = nextY;
        }
    }

    setBonusActive(value) {
        this.isBonusActive = value === true;
    }

    render(ctx) {
        if (this.isBonusActive) {
            ctx.fillStyle = this.bonusFillColor;
        } else {
            ctx.fillStyle = this.baseFillColor;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.isBonusActive) {
            ctx.strokeStyle = this.bonusStrokeColor;
        } else {
            ctx.strokeStyle = this.baseStrokeColor;
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}
