import re

with open("../backend/python/app/api/routes/matchmaking.py", "r") as f:
    content = f.read()

content_old = """    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]

        # Verifier si joueur deja en attente
        if any(p["user_id"] == current_user.id for p in queue):
            return MatchmakingJoinResponse(status="already in queue")

        queue.append({"user_id": current_user.id, "stage": stage})

        if len(queue) >= 2:
            # We can expand to match up to 4 players if they are in queue, or fallback to 2
            # For a timer approach, we'd need background tasks. We'll start instantly if queue reaches 4.
            # If 2 to 3 players are there, we could start after a short delay via an asyncio task, but currently the endpoint blocks or returns "waiting".
            # For simplicity, we just extract all currently queued players (up to 4) when len >= 2
            
            # Start matchmaking when we have 2 players minimum, gathering all up to 4.
            num_players_to_match = min(len(queue), 4)
            # Create a matched players tuple from the popped elements
            matched_players = tuple(queue.pop(0)["user_id"] for _ in range(num_players_to_match))
        else:
            matched_players = None

    if matched_players is None:
        return MatchmakingJoinResponse(status="waiting for another player")"""
        
content_new = """    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]

        if any(p["user_id"] == current_user.id for p in queue):
            return MatchmakingJoinResponse(status="already in queue")

        queue.append({"user_id": current_user.id, "stage": stage})
        
        # When 2 players join, start a 10s timer to gather more players. Max is 4.
        if len(queue) == 2:
            asyncio.create_task(_flush_queue_after_delay(difficulty, 10))

        if len(queue) >= 4:
            matched_players = tuple(queue.pop(0)["user_id"] for _ in range(4))
        else:
            matched_players = None

    if matched_players is None:
        return MatchmakingJoinResponse(status="waiting for another player")"""
        
content = content.replace(content_old, content_new)

content_old_game = """    # Creer la partie avec seed et difficulty
    new_game = GameHistory(
        duration=0,
        winner_id=None,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )
    db.add(new_game)
    db.flush()

    db.add_all(
        [
            GamePlayers(game_id=new_game.id, user_id=pid) for pid in matched_players
        ]
    )
    db.commit()
    db.refresh(new_game)

    players_meta = build_players_meta(list(matched_players), db)
    start_layout = generate_maze_logic(
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )
    start_state = build_start_state_payload(
        layout=start_layout,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )

    base_message = {
        "type": "match_found",
        "game_id": new_game.id,
        "players": list(matched_players),
        "players_meta": players_meta,
        "playersMeta": players_meta,
        "seed": seed,
        "difficulty": difficulty,
        "stage": stage,
        "start_state": start_state,
        "startState": start_state,
    }
    
    # Notify all matched players
    tasks = []
    for pid in matched_players:
        tasks.append(
            send_to_user(
                pid,
                {
                    **base_message,
                    "player_id": pid,
                    "playerId": pid,
                }
            )
        )
    await asyncio.gather(*tasks)

    return MatchmakingJoinResponse(
        match=list(matched_players),
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )"""

content_new_game = """    await _create_and_notify_match(matched_players, seed, difficulty, stage, db)

    return MatchmakingJoinResponse(
        match=list(matched_players),
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )"""

content = content.replace(content_old_game, content_new_game)

flush_block = """

async def _flush_queue_after_delay(difficulty: str, delay: int):
    await asyncio.sleep(delay)
    matched_players = None
    seed = generate_seed()
    
    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]
        if len(queue) >= 2:
            num = min(len(queue), 4)
            # Remove them from the queue
            matched_players = tuple(queue.pop(0)["user_id"] for _ in range(num))
            stage = 1
            
    if matched_players:
        from app.dependencies import get_db
        db_generator = get_db()
        db = next(db_generator)
        try:
            await _create_and_notify_match(matched_players, seed, difficulty, stage, db)
        finally:
            db.close()

async def _create_and_notify_match(matched_players, seed, difficulty, stage, db):
    new_game = GameHistory(
        duration=0,
        winner_id=None,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )
    db.add(new_game)
    db.flush()

    db.add_all(
        [
            GamePlayers(game_id=new_game.id, user_id=pid) for pid in matched_players
        ]
    )
    db.commit()
    db.refresh(new_game)

    players_meta = build_players_meta(list(matched_players), db)
    start_layout = generate_maze_logic(
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )
    start_state = build_start_state_payload(
        layout=start_layout,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )

    base_message = {
        "type": "match_found",
        "game_id": new_game.id,
        "players": list(matched_players),
        "players_meta": players_meta,
        "playersMeta": players_meta,
        "seed": seed,
        "difficulty": difficulty,
        "stage": stage,
        "start_state": start_state,
        "startState": start_state,
    }
    
    tasks = [
        send_to_user(pid, {**base_message, "player_id": pid, "playerId": pid})
        for pid in matched_players
    ]
    await asyncio.gather(*tasks)

"""

if flush_block not in content:
    content += flush_block

with open("../backend/python/app/api/routes/matchmaking.py", "w") as f:
    f.write(content)
print("done!")
