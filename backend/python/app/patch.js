const fs = require('fs');
const file = 'frontend/src/routes/ingame/scene/GameScene.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/normalizeMultiplayerStartLayout\(rawStartState\) \{[\s\S]*?return \{\n\s*grid,[\s\S]*?bh2:[^\n]*\n\s*\};\n\s*\}/, 
`normalizeMultiplayerStartLayout(rawStartState) {
        if (!rawStartState || typeof rawStartState !== "object") {
            return null;
        }
        if (Array.isArray(rawStartState.grid) && rawStartState.cols && rawStartState.rows && rawStartState.p1 && rawStartState.door) {
            return {
                grid: rawStartState.grid,
                cols: Number(rawStartState.cols),
                rows: Number(rawStartState.rows),
                p1: rawStartState.p1,
                p2: rawStartState.p2,
                door: rawStartState.door,
                bh1: rawStartState.bh1 || rawStartState.p1,
                bh2: rawStartState.bh2 || rawStartState.p2 || rawStartState.bh1 || rawStartState.p1,
            };
        }
        return null;
    }`);
fs.writeFileSync(file, content);
