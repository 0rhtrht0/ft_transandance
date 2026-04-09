const fs = require('fs');
const file = 'frontend/src/routes/ingame/scene/GameScene.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /normalizeMultiplayerStartLayout\(rawStartState\) \{[\s\S]*? \n    cancelMatchmaking\(reason\) \{/m;

const replacement = `normalizeMultiplayerStartLayout(rawStartState) {
        if (!rawStartState || typeof rawStartState !== "object") return null;
        if (!rawStartState.grid || !rawStartState.door || !rawStartState.p1) return null;
        
        return {
            grid: rawStartState.grid,
            cols: rawStartState.cols || rawStartState.grid[0]?.length || 31,
            rows: rawStartState.rows || rawStartState.grid.length || 31,
            p1: rawStartState.p1,
            p2: rawStartState.p2,
            door: rawStartState.door,
            bh1: rawStartState.bh1 || rawStartState.p1,
            bh2: rawStartState.bh2 || rawStartState.p2 || rawStartState.bh1 || rawStartState.p1,
        };
    }

    cancelMatchmaking(reason) {`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
