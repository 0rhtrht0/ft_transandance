from app.core.maze_generator import generate_maze_logic

def compute_exit_position(seed: str, difficulty: str, stage: int) -> dict: # Update signature
    result = generate_maze_logic(
        seed=str(seed),
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )
    
    # We only care about the door coordinate
    door = result['door']
    return {
        "x": door['x'] * 28 + 14,
        "y": door['y'] * 28 + 14
    }
