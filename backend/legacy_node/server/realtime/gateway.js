export function createRealtimeGateway(options = {}) {
    let tickRateHz;
    if (Number.isFinite(options.tickRateHz)) {
        tickRateHz = options.tickRateHz;
    } else {
        tickRateHz = 20;
    }

    let onTick;
    if (typeof options.onTick === "function") {
        onTick = options.onTick;
    } else {
        onTick = null;
    }
    let intervalId = null;
    let running = false;

    function start() {
        if (running) {
            return;
        }
        running = true;
        if (!onTick) {
            return;
        }
        const intervalMs = Math.max(1, Math.floor(1000 / tickRateHz));
        intervalId = setInterval(() => {
            onTick(Date.now());
        }, intervalMs);
    }

    function stop() {
        if (!running) {
            return;
        }
        running = false;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    return {
        start,
        stop,
        get running() {
            return running;
        }
    };
}
