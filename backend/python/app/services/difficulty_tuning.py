from __future__ import annotations

from app.api.routes.progression_helpers import MAX_STAGES

VALID_DIFFICULTIES = ("facile", "moyen", "difficile")
BONUS_TRIGGER_PACE = 24
BASE_TIME_LIMIT_SECONDS = 57
BASE_PACE_TABLE = (
    {"label": "12", "pace": 12, "from_seconds": 0, "vision_cm": 6, "hole_cm": 2},
    {"label": "15", "pace": 15, "from_seconds": 18, "vision_cm": 5, "hole_cm": 3},
    {"label": "18", "pace": 18, "from_seconds": 24, "vision_cm": 4, "hole_cm": 4},
    {"label": "22", "pace": 22, "from_seconds": 30, "vision_cm": 3, "hole_cm": 5},
    {"label": "24", "pace": 24, "from_seconds": 42, "vision_cm": 2, "hole_cm": 6},
)

DIFFICULTY_PROFILES = {
    "facile": {
        "tile_size": {"start": 34, "end": 30},
        "time_limit": {"start": 90, "end": 70},
        "vision_scale": {"start": 1.25, "end": 1.1},
        "hole_scale": {"start": 0.8, "end": 0.95},
    },
    "moyen": {
        "tile_size": {"start": 30, "end": 26},
        "time_limit": {"start": 70, "end": 55},
        "vision_scale": {"start": 1.0, "end": 0.9},
        "hole_scale": {"start": 1.0, "end": 1.2},
    },
    "difficile": {
        "tile_size": {"start": 26, "end": 22},
        "time_limit": {"start": 55, "end": 40},
        "vision_scale": {"start": 0.9, "end": 0.75},
        "hole_scale": {"start": 1.2, "end": 1.45},
    },
}

def _clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, value))


def _lerp(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def _stage_ratio(stage: int) -> float:
    if MAX_STAGES <= 1:
        return 0.0
    return _clamp((stage - 1) / (MAX_STAGES - 1), 0.0, 1.0)


def build_stage_tuning(difficulty: str, stage: int) -> dict:
    profile = DIFFICULTY_PROFILES.get(difficulty, DIFFICULTY_PROFILES["moyen"])
    t = _stage_ratio(stage)

    tile_size = int(round(_lerp(profile["tile_size"]["start"], profile["tile_size"]["end"], t)))
    tile_size = int(_clamp(tile_size, 22, 40))

    time_limit_seconds = int(
        round(_lerp(profile["time_limit"]["start"], profile["time_limit"]["end"], t))
    )
    time_limit_seconds = int(_clamp(time_limit_seconds, 20, 180))

    vision_scale = _lerp(profile["vision_scale"]["start"], profile["vision_scale"]["end"], t)
    hole_scale = _lerp(profile["hole_scale"]["start"], profile["hole_scale"]["end"], t)
    time_scale = time_limit_seconds / BASE_TIME_LIMIT_SECONDS

    pace_table = []
    max_pace = 0
    for entry in BASE_PACE_TABLE:
        pace = max(1, int(round(entry["pace"])))
        max_pace = max(max_pace, pace)
        pace_table.append(
            {
                "label": str(pace),
                "pace": pace,
                "from_seconds": max(0, int(round(entry["from_seconds"] * time_scale))),
                "vision_cm": round(entry["vision_cm"] * vision_scale, 2),
                "hole_cm": round(entry["hole_cm"] * hole_scale, 2),
            }
        )

    bonus_trigger_pace = min(BONUS_TRIGGER_PACE, max_pace)

    return {
        "difficulty": difficulty,
        "stage": stage,
        "max_stage": MAX_STAGES,
        "tile_size": tile_size,
        "time_limit_seconds": time_limit_seconds,
        "bonus_trigger_pace": bonus_trigger_pace,
        "pace_table": pace_table,
    }
