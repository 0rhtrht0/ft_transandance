import Camera from "./camera.js";
import Input from "./input.js";

export default class Game {
    constructor(canvas, overlayCanvas = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.overlayCanvas = overlayCanvas;
        if (overlayCanvas) {
            this.overlayCtx = overlayCanvas.getContext("2d");
        } else {
            this.overlayCtx = null;
        }
        this.camera = new Camera(canvas, { minZoom: 0.1, maxZoom: 8 });
        this.sceneManager = null;
        this.lastTime = 0;
        this.frameId = null;
        this.isRunning = false;
        this.resizeObserver = null;

        this.boundLoop = this.loop.bind(this);
        this.boundHandleResize = this.resize.bind(this);
        this.boundHandleWheel = this.handleWheel.bind(this);

        this.canvas.addEventListener("wheel", this.boundHandleWheel, { passive: false });
        window.addEventListener("resize", this.boundHandleResize);
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => {
                this.resize();
            });
            this.resizeObserver.observe(this.canvas);
        }
        this.input = new Input();
        this.resize();
    }

    setSceneManager(sceneManager) {
        this.sceneManager = sceneManager;
    }

    start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.lastTime = performance.now();
        this.frameId = requestAnimationFrame(this.boundLoop);
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    destroy() {
        this.stop();
        this.canvas.removeEventListener("wheel", this.boundHandleWheel);
        window.removeEventListener("resize", this.boundHandleResize);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.input && typeof this.input.destroy === "function") {
            this.input.destroy();
        }
    }

    loop(timestamp) {
        if (!this.isRunning) {
            return;
        }

        if (!document.body.contains(this.canvas)) {
            this.destroy();
            return;
        }

        const deltaMs = timestamp - this.lastTime;
        this.lastTime = timestamp;
        const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));

        if (this.sceneManager) {
            this.sceneManager.update(deltaSeconds);
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.camera.applyTransform(this.ctx);
            this.sceneManager.render(this.ctx);
            if (this.overlayCtx && this.overlayCanvas) {
                this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                this.camera.applyTransform(this.overlayCtx);
                const current = this.sceneManager.currentScene;
                if (current && typeof current.renderOverlay === 'function') {
                    current.renderOverlay(this.overlayCtx);
                }
                this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
            }
        }

        this.frameId = requestAnimationFrame(this.boundLoop);
    }

    handleWheel(event) {
        event.preventDefault();

        const scene = this.sceneManager?.currentScene;
        if (!scene || scene.allowManualZoom !== true) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const ratioX = this.canvas.width / Math.max(1, rect.width);
        const ratioY = this.canvas.height / Math.max(1, rect.height);
        const mouseX = (event.clientX - rect.left) * ratioX;
        const mouseY = (event.clientY - rect.top) * ratioY;
        let zoomFactor;
        if (event.deltaY < 0) {
            zoomFactor = 1.1;
        } else {
            zoomFactor = 0.9;
        }

        this.camera.zoomBy(zoomFactor, mouseX, mouseY);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.round(rect.width));
        const nextHeight = Math.max(1, Math.round(rect.height));

        if (this.canvas.width !== nextWidth) {
            this.canvas.width = nextWidth;
        }
        if (this.canvas.height !== nextHeight) {
            this.canvas.height = nextHeight;
        }
        if (this.overlayCanvas) {
            if (this.overlayCanvas.width !== nextWidth) this.overlayCanvas.width = nextWidth;
            if (this.overlayCanvas.height !== nextHeight) this.overlayCanvas.height = nextHeight;
        }
        this.camera.resize(this.canvas.width, this.canvas.height);
        if (this.sceneManager?.currentScene && typeof this.sceneManager.currentScene.onResize === "function") {
            this.sceneManager.currentScene.onResize();
        }
    }
}
