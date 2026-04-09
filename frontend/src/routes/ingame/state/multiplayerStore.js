export function createMultiplayerStore() {
    return {
        localPlayerId: null,
        roomId: null,
        players: new Map(),
        blackholes: new Map(),
        blackholeTargets: new Map(),
        tick: 0,

        applySnapshot(snapshot) {
            if (typeof snapshot.tick === "number") {
                this.tick = snapshot.tick;
            }
            const rawBlackholeTargets = snapshot.blackhole_targets ?? snapshot.blackholeTargets ?? snapshot.players;
            if (rawBlackholeTargets && typeof rawBlackholeTargets === "object") {
                const nextTargets = new Map();
                for (const [id, target] of Object.entries(rawBlackholeTargets)) {
                    nextTargets.set(Number(id), target);
                }
                this.blackholeTargets = nextTargets;
            } else {
                this.blackholeTargets = new Map();
            }
            if (snapshot.blackholes && typeof snapshot.blackholes === "object") {
                const nextBH = new Map();
                for (const [id, bh] of Object.entries(snapshot.blackholes)) {
                    nextBH.set(Number(id), bh);
                }
                this.blackholes = nextBH;
            } else if (snapshot.blackhole) {
                // Retro-compat
                this.blackholes.set(0, snapshot.blackhole);
            }
            if (snapshot.players && typeof snapshot.players === "object") {
                const nextPlayers = new Map();
                for (const [id, data] of Object.entries(snapshot.players)) {
                    nextPlayers.set(Number(id), data);
                }
                this.players = nextPlayers;
            }
        }
    };
}
