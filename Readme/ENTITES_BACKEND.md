# Entites Backend (resume + exemples)

## Authentification
Description: creation de compte, login, login Google, lecture et mise a jour du compte connecte.
Fichiers: `backend/python/app/api/routes/auth_login.py`, `backend/python/app/api/routes/auth_signup.py`, `backend/python/app/api/routes/auth_google.py`, `backend/python/app/api/routes/auth_me.py`, `backend/python/app/api/routes/auth_tokens.py`
Endpoints:
- POST `/auth/signup`
- POST `/auth/login`
- POST `/auth/google`
- GET `/auth/me`
- PATCH `/auth/me`
- POST `/auth/logout`
Exemple (login):
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=neo&password=secret"
```
Reponse:
```json
{"access_token":"<jwt>","token_type":"bearer"}
```

## Utilisateur + Profil
Description: lecture utilisateur, profil public, avatar, statut en ligne.
Fichiers: `backend/python/app/models/user.py`, `backend/python/app/models/profile.py`, `backend/python/app/api/routes/profile_read.py`, `backend/python/app/api/routes/profile_write.py`
Endpoints:
- GET `/users/{user_id}`
- GET `/users/profiles`
- GET `/users/profiles/me`
- GET `/users/profiles/online`
- PATCH `/users/profiles/me`
- POST `/users/profiles/me/avatar`
- DELETE `/users/profiles/me`
Exemple (profil online):
```bash
curl -H "Authorization: Bearer <jwt>" \
  "http://localhost:8000/users/profiles/online"
```

## Progression (niveaux)
Description: progression par difficulte, stage debloque, reset complet.
Fichiers: `backend/python/app/models/stage_progress.py`, `backend/python/app/api/routes/progression_actions.py`, `backend/python/app/api/routes/progression_reads.py`
Endpoints:
- GET `/api/progression/me`
- GET `/api/progression/{difficulty}`
- POST `/api/progression/start_stage?difficulty=facile&stage=3`
- POST `/api/progression/complete`
- POST `/api/progression/reset`
Exemple (complete):
```bash
curl -X POST "http://localhost:8000/api/progression/complete" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"facile","stage":3,"score":1200,"time_ms":55000}'
```

## Resultats + Leaderboard
Description: resultats detaille + score global.
Fichiers: `backend/python/app/api/routes/game_results.py`, `backend/python/app/api/routes/leaderboard.py`
Endpoints:
- POST `/results`
- GET `/results`
- GET `/leaderboard`
- GET `/leaderboard/{user_id}`
- POST `/scores/submit`
Exemple (submit resultat):
```bash
curl -X POST "http://localhost:8000/results" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"score":900,"result":"victory","pace_value":22,"time_ms":42000,"level":4}'
```

## Matchmaking + Rooms
Description: file d attente automatique ou room privee.
Fichiers: `backend/python/app/api/routes/matchmaking.py`, `backend/python/app/api/routes/rooms_actions.py`, `backend/python/app/core/room_manager.py`
Endpoints:
- POST `/api/matchmaking/join`
- POST `/api/matchmaking/leave`
- POST `/api/rooms`
- GET `/api/rooms/{room_id}`
- POST `/api/rooms/{room_id}/join`
- POST `/api/rooms/{room_id}/leave`
- POST `/api/rooms/{room_id}/close`
Exemple (join matchmaking):
```bash
curl -X POST "http://localhost:8000/api/matchmaking/join?difficulty=moyen&stage=1" \
  -H "Authorization: Bearer <jwt>"
```

## Messagerie + Notifications temps reel
Description: conversations, messages, presence en ligne via WebSocket.
Fichiers: `backend/python/app/api/routes/messages.py`, `backend/python/app/api/routes/ws_notifications.py`, `backend/python/app/services/connection_manager.py`
Endpoints:
- POST `/api/messages`
- GET `/api/messages/conversations`
- GET `/api/messages/conversations/{conversation_id}/messages`
- WS `/ws` (token via header Authorization ou query `?token=`)
Exemple (WS):
```text
ws://localhost:8000/ws?token=<jwt>
```

## Amis
Description: demandes d amis, acceptation, liste et suppression.
Fichiers: `backend/python/app/api/routes/friends.py`, `backend/python/app/api/routes/friends_requests.py`, `backend/python/app/api/routes/friends_request_actions.py`, `backend/python/app/api/routes/friends_list.py`
Endpoints:
- GET `/api/friends`
- GET `/api/friends/requests`
- POST `/api/friends/request`
- POST `/api/friends/{id}/accept`
- POST `/api/friends/accept/{id}`
- POST `/api/friends/reject/{id}`
- POST `/api/friends/cancel/{id}`
- DELETE `/api/friends/{friend_id}`

## WebSocket jeu (match realtime)
Description: matchmaking temps reel + updates de jeu.
Fichiers: `backend/python/app/api/routes/ws.py`, `backend/python/app/core/game_loop.py`, `backend/python/app/core/game_state.py`
Endpoint:
- WS `/ws/{user_id}`
