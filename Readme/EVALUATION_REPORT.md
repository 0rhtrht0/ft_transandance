# Evaluation ft_transcendence (estimation)

## Sources
- Sujet: `/home/rorandri/Downloads/ft_transcendence.pdf`
- Feuille eval: `/home/rorandri/Downloads/feuille_eval_transc/eval_trans.html`

## Regles de points (resume)
- Minimum requis: 14 points de modules valides.
- Module major: 2 points.
- Module minor: 1 point.
- Bonus: modules valides au-dela de 14, cap 5 points.

## Modules detectes dans le depot (statut et preuves)
| Module (sujet) | Points | Statut | Preuves (exemples) | Notes |
| --- | --- | --- | --- | --- |
| Web: Framework frontend + backend | 2 | OK | `frontend/package.json`, `backend/python/app/main.py` | Vue + FastAPI |
| Web: Real-time (WebSockets) | 2 | OK | `backend/python/app/api/routes/ws.py`, `backend/python/app/api/routes/ws_notifications.py`, `frontend/src/components/ChatWidget.vue` | WS pour jeu + chat |
| Web: ORM | 1 | OK | `backend/python/app/core/database.py`, `backend/python/app/models/user.py` | SQLAlchemy |
| User Mgmt: OAuth2 | 1 | OK | `backend/python/app/api/routes/auth_google.py`, `frontend/src/routes/auth/auth_google.js` | Google login |
| Gaming: Web-based game | 2 | OK | `frontend/src/routes/ingame/engine/game.js`, `frontend/src/routes/ingame/scene/GameScene.js` | Jeu maze |
| Gaming: Remote players | 2 | A verifier | `backend/python/app/core/game_loop.py`, `frontend/src/routes/ingame/net/gameClient.js` | Requiert test multi-machines |
| Web: User interaction (chat+profile+friends) | 2 | Partiel | `backend/python/app/api/routes/messages.py`, `backend/python/app/api/routes/friends.py`, `backend/python/app/api/routes/profile.py`, `frontend/src/components/ChatWidget.vue`, `frontend/src/views/FriendsView.vue` | UI amis/profil incomplet |
| User Mgmt: Standard user management | 2 | Partiel | `backend/python/app/api/routes/auth_me.py`, `backend/python/app/api/routes/profile_write.py` | Manque page profil + avatar par defaut |
| User Mgmt: Game stats + history | 1 | Partiel | `backend/python/app/api/routes/game_results.py`, `backend/python/app/api/routes/game_history.py`, `backend/python/app/api/routes/leaderboard.py` | Pas d UI |

## Modules manquants (exemples)
- Web: Public API avec cle + rate limit + doc -> pas present.
- Web: Notification system CRUD -> pas present (notifications uniquement chat/presence).
- Web: File upload management complet -> avatar seulement.
- Gaming: Tournament, Multiplayer 3+, Spectator, Advanced chat -> pas present.
- User Mgmt: 2FA, permissions avancees, organizations -> pas present.
- Devops, Data/Analytics, AI, Blockchain -> pas present.

## Estimation points (scenario)
- Conservateur (OK seulement): 8 points.
  - Frameworks (2) + WebSockets (2) + ORM (1) + OAuth2 (1) + Game (2).
- Probable si "A verifier" est valide: 10 points.
  - + Remote players (2).
- Si les modules "Partiel" sont finalises: 15 points.
  - + User interaction (2) + Standard user management (2) + Game stats/history (1).

## Bonus possible
- Bonus = total valide - 14, cap 5.
- Avec 15 points valides: bonus 1.
- Avec 16 points valides: bonus 2.
- Avec 17 points valides: bonus 3.
- Pour bonus max 5, viser 19 points valides.

## Manques prioritaires pour atteindre 14+
- UI profil + gestion amis (2-4 jours): finalise User interaction + Standard user management.
- UI stats + match history (1-2 jours): valide Game stats/history.
- Validation remote players (2-4 jours): tests multi-machines + robustesse reconnection.
- README conforme sujet (1-2 jours): obligatoire pour l eval.

