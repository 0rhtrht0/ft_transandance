function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export default class Camera {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 3;
        this.smoothStrength = options.smoothStrength ?? 10;
        this.viewportWidth = Math.max(1, canvas.width);
        this.viewportHeight = Math.max(1, canvas.height);
        this.worldWidth = this.viewportWidth;
        this.worldHeight = this.viewportHeight;
    }

    get viewWidthWorld() {
        return this.viewportWidth / this.zoom;
    }

    get viewHeightWorld() {
        return this.viewportHeight / this.zoom;
    }

    setWorldSize(width, height) {
        this.worldWidth = Math.max(1, width);
        this.worldHeight = Math.max(1, height);
        this.clampToWorld();
    }

    resize(width, height) {
        this.viewportWidth = Math.max(1, width);
        this.viewportHeight = Math.max(1, height);
        this.clampToWorld();
    }

    snapTo(target) {
        if (!target) {
            return;
        }

        this.x = target.x - this.viewWidthWorld / 2;
        this.y = target.y - this.viewHeightWorld / 2;
        this.clampToWorld();
    }

    follow(target, deltaSeconds = 1 / 60) {
        if (!target) {
            return;
        }

        const desiredX = target.x - this.viewWidthWorld / 2;
        const desiredY = target.y - this.viewHeightWorld / 2;
        const lerpFactor = 1 - Math.exp(-this.smoothStrength * Math.max(0, deltaSeconds));

        this.x += (desiredX - this.x) * lerpFactor;
        this.y += (desiredY - this.y) * lerpFactor;
        this.clampToWorld();
    }

    zoomBy(factor, screenX, screenY) {
        if (!Number.isFinite(factor) || factor <= 0) {
            return;
        }
        this.zoomAt(screenX, screenY, this.zoom * factor);
    }

    zoomAt(screenX, screenY, nextZoom) {
        const clampedZoom = clamp(nextZoom, this.minZoom, this.maxZoom);
        if (clampedZoom === this.zoom) {
            return;
        }

        const worldX = this.x + screenX / this.zoom;
        const worldY = this.y + screenY / this.zoom;

        this.zoom = clampedZoom;
        this.x = worldX - screenX / this.zoom;
        this.y = worldY - screenY / this.zoom;
        this.clampToWorld();
    }

    clampToWorld() {
        const extraX = this.viewWidthWorld - this.worldWidth;
        if (extraX >= 0) {
            this.x = -extraX / 2;
        } else {
            this.x = clamp(this.x, 0, this.worldWidth - this.viewWidthWorld);
        }

        const extraY = this.viewHeightWorld - this.worldHeight;
        if (extraY >= 0) {
            this.y = -extraY / 2;
        } else {
            this.y = clamp(this.y, 0, this.worldHeight - this.viewHeightWorld);
        }
    }

    applyTransform(ctx) {
        ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
    }
}
