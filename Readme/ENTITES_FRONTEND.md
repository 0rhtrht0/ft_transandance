# Entites Frontend (resume + exemples)

## Authentification UI
Description: ecran login/register + Google login, stockage token.
Fichiers: `frontend/src/views/AuthView.vue`, `frontend/src/routes/auth/auth.js`, `frontend/src/routes/auth/auth_api.js`, `frontend/src/routes/auth/auth_storage.js`, `frontend/src/routes/auth/auth_google.js`
Exemple (login flow):
1. Saisie user/pass dans `auth.html`.
2. `auth.js` appelle `loginBackend` (POST `/auth/login`).
3. Token stocke via `auth_storage.js`.
4. Event `auth:updated` declenche, redirection vers menu.

## Session globale + injection
Description: partage du token et du userId via `provide`.
Fichiers: `frontend/src/views/App.vue`
Exemple:
1. Lit `accessToken` et `userId` depuis localStorage.
2. `provide('jwtToken', token)` pour les composants.

## Menu + selection de niveau
Description: UI menu + selection difficulty/stage + progression.
Fichiers: `frontend/src/routes/menu/menu.js`, `frontend/src/routes/menu/level_selector.js`, `frontend/src/routes/ingame/ingame_difficulty.js`, `frontend/src/routes/ingame/ingame_stage.js`
Exemple (choix niveau):
1. `LevelSelector.show()` affiche les niveaux.
2. `selectLevel()` appelle `/api/progression/start_stage`.
3. Stocke `bh_game_difficulty` et `bh_game_stage`.
4. Redirige vers `/ingame?difficulty=...&stage=...`.

## Ingame + Maze (moteur)
Description: loop de jeu canvas + scene principale.
Fichiers: `frontend/src/routes/ingame/ingame.js`, `frontend/src/routes/ingame/engine/game.js`, `frontend/src/routes/ingame/scene/GameScene.js`, `frontend/src/views/IngameView.vue`, `frontend/src/views/MazeView.vue`
Exemple (chargement):
1. `IngameView` charge `ingame.html` et lance `init_ingame`.
2. `MazeView` charge `maze.html` et lance `init_maze`.
3. `Game` demarre la loop et `GameScene` applique difficulte/stage.

## Multijoueur
Description: matchmaking, rooms, seed, WS client.
Fichiers: `frontend/src/routes/menu/multiplayer_selector.js`, `frontend/src/routes/ingame/ingame_multiplayer.js`, `frontend/src/routes/ingame/game-state-sync.js`
Exemple (mode rapide):
1. `MultiplayerSelector.startRapidMode()` appelle `/api/matchmaking/join`.
2. Redirige vers `/ingame?mp=1&difficulty=...&stage=...`.
3. `ingame_multiplayer.js` construit `ws://.../ws/{userId}`.

## Chat + notifications
Description: chat global et notifications temps reel.
Fichiers: `frontend/src/components/ChatWidget.vue`, `frontend/src/components/GameChatHUD.vue`, `frontend/src/components/NotificationsWidget.vue`
Exemple:
1. `ChatWidget` utilise `Authorization: Bearer <jwt>`.
2. Connexion WS via `ws://.../ws?token=<jwt>`.

## Friends (placeholder UI)
Description: vue simple pour liste d amis.
Fichiers: `frontend/src/views/FriendsView.vue`

