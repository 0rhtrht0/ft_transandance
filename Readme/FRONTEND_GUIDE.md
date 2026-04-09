# Guide Frontend

## But
Ce frontend Vue/Vite gere l interface, le menu, le jeu canvas, le multijoueur et le chat.

## Stack
- Vite + Vue 3
- Vue Router
- Canvas 2D pour le gameplay

## Structure rapide
- `frontend/src/router/index.js` : routes SPA
- `frontend/src/views/` : vues route-level (Intro, Auth, Menu, Ingame, Maze, Gameover, Victory, Friends)
- `frontend/src/routes/` : HTML/CSS/JS par page (auth, menu, ingame)
- `frontend/src/components/` : composants Vue (ChatWidget, GameChatHUD, Notifications)
- `frontend/src/routes/ingame/` : moteur de jeu, scenes, map, net

## Etapes - demarrer en local
1. Aller dans `frontend`.
2. Installer les dependances.
3. Lancer Vite.
4. Ouvrir `http://localhost:5173`.

Commandes reference:
```bash
cd frontend
npm install
npm run dev
```

## Configuration
- `VITE_API_URL` : base API backend (ex: http://localhost:8000)
- `VITE_WS_URL` : base WS (ex: ws://localhost:8000)
- Stockage local: `frontend/src/routes/auth/auth_storage.js`

## Flux principaux (etapes)

### Authentification
1. `frontend/src/views/AuthView.vue` charge `frontend/src/routes/auth/auth.html`.
2. `frontend/src/routes/auth/auth.js` gere login/register et appelle `auth_api.js`.
3. En succes, token stocke dans `localStorage` et event `auth:updated`.
4. `frontend/src/views/App.vue` expose `jwtToken` et `currentUserId` via `provide`.

### Selection niveau + difficulte
1. `frontend/src/routes/menu/level_selector.js` appelle `/api/progression/start_stage`.
2. Stocke `bh_game_difficulty` et `bh_game_stage`.
3. Redirige vers `/ingame?difficulty=...&stage=...`.
4. `frontend/src/routes/ingame/ingame_difficulty.js` et `ingame_stage.js` lisent query + localStorage.

### Ingame + maze
1. `frontend/src/views/IngameView.vue` charge `frontend/src/routes/ingame/ingame.html` et appelle `init_ingame`.
2. `frontend/src/views/MazeView.vue` charge `frontend/src/routes/ingame/maze.html` et appelle `init_maze`.
3. `frontend/src/routes/ingame/engine/game.js` gere loop render/update.
4. `frontend/src/routes/ingame/scene/GameScene.js` applique difficulte, stage, seed et logique de jeu.

### Multijoueur
1. `frontend/src/routes/menu/multiplayer_selector.js` appelle `/api/matchmaking` ou `/api/rooms`.
2. `frontend/src/routes/ingame/ingame_multiplayer.js` construit l URL WS et cree `GameClient`.
3. `frontend/src/routes/ingame/game-state-sync.js` gere la synchro temps reel.

### Chat + notifications
1. `frontend/src/views/App.vue` monte `ChatWidget` si token present.
2. `frontend/src/components/ChatWidget.vue` utilise REST + WS avec `Authorization: Bearer`.
3. `frontend/src/components/NotificationsWidget.vue` affiche les alerts.

