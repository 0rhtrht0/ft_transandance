const TAU = Math.PI * 2;

export default class BlackHole {
    constructor(x, y, radius = 80, pace = 12) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.rotationAngle = 0;
        this.breathePhase = 0;
        this.pulsePhase = 0;
        this.darkness = 0.62;
        this.setPace(pace);
    }

    setRadius(r) {
        this.radius = r;
    }

    setPace(pace) {
        this.pace = pace;

        if (pace >= 24) this.targetDarkness = 1.0;
        else if (pace >= 22) this.targetDarkness = 0.96;
        else if (pace >= 18) this.targetDarkness = 0.9;
        else if (pace >= 15) this.targetDarkness = 0.82;
        else this.targetDarkness = 0.74;
    }

    update(deltaSeconds) {

        let targetDarkness = this.targetDarkness ?? 0.74;
        this.darkness += (targetDarkness - this.darkness) * 0.08;
        this.rotationAngle += (TAU / 12) * deltaSeconds;
        if (this.rotationAngle > TAU) {
            this.rotationAngle -= TAU;
        }

        this.breathePhase += (TAU / 4.2) * deltaSeconds;
        if (this.breathePhase > TAU) {
            this.breathePhase -= TAU;
        }

        this.pulsePhase += (TAU / 3.4) * deltaSeconds;
        if (this.pulsePhase > TAU) {
            this.pulsePhase -= TAU;
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const breatheScale = 0.99 + 0.04 * Math.sin(this.breathePhase);
        ctx.scale(breatheScale, breatheScale);

        this.drawOuterGlow(ctx);
        this.drawAccretionRing(ctx);
        this.drawPhotonRing(ctx);
        this.drawSingularity(ctx);

        ctx.restore();
    }

    drawOuterGlow(ctx) {

        const outerGlow = ctx.createRadialGradient(0, 0, this.radius * 0.24, 0, 0, this.radius * 2.1);
        outerGlow.addColorStop(0, `rgba(0, 0, 0, ${0.92 + 0.05 * this.darkness})`);
        outerGlow.addColorStop(0.38, `rgba(8, 8, 12, ${0.74 + 0.2 * this.darkness})`);
        outerGlow.addColorStop(0.66, `rgba(58, 58, 66, ${0.24 + 0.1 * (1 - this.darkness)})`);
        outerGlow.addColorStop(0.84, `rgba(188, 188, 196, ${0.13 + 0.09 * (1 - this.darkness)})`);
        outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2.1, 0, TAU);
        ctx.fill();
    }

    drawAccretionRing(ctx) {
        const ringRadius = this.radius * 0.94;
        const ringWidth = this.radius * 0.28;
        ctx.save();
        ctx.rotate(this.rotationAngle);
        const segments = 84;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * TAU;
            const nextAngle = ((i + 1) / segments) * TAU;

            const turbulence = 0.65 + 0.35 * Math.sin(this.pulsePhase * 1.6 + angle * 3.1);
            const doppler = 0.55 + 0.45 * Math.cos(angle - this.rotationAngle * 1.7);
            const intensity = Math.min(1, turbulence * doppler + 0.2);
            const shade = Math.floor(112 + 135 * intensity);
            const tint = Math.floor(8 * Math.sin(angle * 5.2 + this.rotationAngle));
            const alpha = 0.24 + 0.55 * intensity;
            ctx.fillStyle = `rgba(${shade + tint}, ${shade + tint}, ${Math.min(255, shade + 8 + tint)}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius + ringWidth / 2, angle, nextAngle);
            ctx.arc(0, 0, ringRadius - ringWidth / 2, nextAngle, angle, true);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    drawPhotonRing(ctx) {
        const photonRadius = this.radius * 0.71;
        const pulseAlpha = 0.45 + 0.35 * Math.sin(this.pulsePhase);
        const pulseScale = 0.98 + 0.03 * Math.sin(this.pulsePhase);
        ctx.save();
        ctx.scale(pulseScale, pulseScale);
        const glowGradient = ctx.createRadialGradient(0, 0, photonRadius * 0.88, 0, 0, photonRadius * 1.38);
        glowGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        glowGradient.addColorStop(0.45, `rgba(248, 248, 255, ${pulseAlpha * 0.28})`);
        glowGradient.addColorStop(0.8, `rgba(198, 198, 214, ${pulseAlpha * 0.2})`);
        glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, photonRadius * 1.38, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.58 + pulseAlpha * 0.3})`;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.arc(0, 0, photonRadius, 0, TAU);
        ctx.stroke();

        const innerGlow = ctx.createRadialGradient(0, 0, photonRadius * 0.62, 0, 0, photonRadius);
        innerGlow.addColorStop(0, "rgba(0, 0, 0, 0)");
        innerGlow.addColorStop(0.78, `rgba(240, 240, 255, ${pulseAlpha * 0.15})`);
        innerGlow.addColorStop(1, "rgba(240, 240, 255, 0)");
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, photonRadius, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    drawSingularity(ctx) {
        const coreRadius = this.radius * 0.4;
        const singularity = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
        singularity.addColorStop(0, "rgba(0, 0, 0, 1)");
        singularity.addColorStop(0.48, "rgba(0, 0, 0, 1)");
        singularity.addColorStop(0.82, "rgba(4, 4, 6, 0.98)");
        singularity.addColorStop(1, "rgba(14, 14, 18, 0.96)");
        ctx.fillStyle = singularity;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius, 0, TAU);
        ctx.fill();

        const eventHorizonShadow = ctx.createRadialGradient(0, 0, coreRadius * 0.3, 0, 0, coreRadius * 1.6);
        eventHorizonShadow.addColorStop(0, "rgba(0, 0, 0, 0)");
        eventHorizonShadow.addColorStop(0.65, `rgba(0, 0, 0, ${0.76 + 0.2 * this.darkness})`);
        eventHorizonShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = eventHorizonShadow;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius * 1.6, 0, TAU);
        ctx.fill();
    }

    contains(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.radius * 0.36;
    }

    touchesEdge(px, py, playerRadius = 0) {
        const dx = px - this.x;
        const dy = py - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + playerRadius;
    }

    getGravityForce(px, py, strength = 50) {
        const dx = this.x - px;
        const dy = this.y - py;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 10) return { fx: 0, fy: 0 };

        const force = strength / (distance * distance) * 100;
        return {
            fx: (dx / distance) * force,
            fy: (dy / distance) * force
        };
    }
}
