const fs = require('fs');
let content = fs.readFileSync('src/routes/ingame/scene/GameScene.js', 'utf8');
content = content.replace("this.gameClient.disconnect();", `if (this.gameClient.ws) { this.gameClient.ws.close(); }`);
fs.writeFileSync('src/routes/ingame/scene/GameScene.js', content);
