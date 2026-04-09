const fs = require('fs');
let content = fs.readFileSync('src/routes/ingame/scene/GameScene.js', 'utf8');
content = content.replace(`        if (reason) {
            alert(reason);
        }`, `        // alert removed to avoid browser popups`);
fs.writeFileSync('src/routes/ingame/scene/GameScene.js', content);
