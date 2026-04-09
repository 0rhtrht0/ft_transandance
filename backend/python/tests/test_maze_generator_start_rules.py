from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.maze_generator import generate_maze_logic

UNREACHABLE = 9999
DIRECTIONS = ((0, -1), (0, 1), (-1, 0), (1, 0))


def bfs_distances(grid, start):
    rows = len(grid)
    cols = len(grid[0])
    dists = [[UNREACHABLE for _ in range(cols)] for _ in range(rows)]
    dists[start['y']][start['x']] = 0
    q = [start]
    head = 0

    while head < len(q):
        curr = q[head]
        head += 1
        curr_dist = dists[curr['y']][curr['x']]
        for dx, dy in DIRECTIONS:
            nx = curr['x'] + dx
            ny = curr['y'] + dy
            if nx < 0 or ny < 0 or nx >= cols or ny >= rows:
                continue
            if grid[ny][nx] != 0:
                continue
            if dists[ny][nx] <= curr_dist + 1:
                continue
            dists[ny][nx] = curr_dist + 1
            q.append({'x': nx, 'y': ny})

    return dists


def is_door_interior(door, cols, rows):
    return 1 < door['x'] < cols - 2 and 1 < door['y'] < rows - 2


def has_open_neighbor(grid, cell):
    rows = len(grid)
    cols = len(grid[0])
    for dx, dy in DIRECTIONS:
        nx = cell['x'] + dx
        ny = cell['y'] + dy
        if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx] == 0:
            return True
    return False


def test_solo_start_constraints():
    for i in range(32):
        result = generate_maze_logic(
            seed=f"solo:{i}",
            difficulty="moyen",
            stage=1,
            is_multiplayer=False,
        )

        assert is_door_interior(result['door'], result['cols'], result['rows'])
        assert has_open_neighbor(result['grid'], result['door'])
        assert result['p1'] != result['door']

        dist_from_p1 = bfs_distances(result['grid'], result['p1'])
        d_door = dist_from_p1[result['door']['y']][result['door']['x']]
        assert d_door >= 5
        assert d_door < UNREACHABLE


def test_multiplayer_start_constraints():
    for i in range(32):
        result = generate_maze_logic(
            seed=f"multi:{i}",
            difficulty="moyen",
            stage=1,
            is_multiplayer=True,
        )

        assert result['p2'] is not None
        assert is_door_interior(result['door'], result['cols'], result['rows'])
        assert has_open_neighbor(result['grid'], result['door'])

        assert result['p1'] != result['p2']
        assert result['p1'] != result['door']
        assert result['p2'] != result['door']

        dist_from_p1 = bfs_distances(result['grid'], result['p1'])
        dist_from_p2 = bfs_distances(result['grid'], result['p2'])

        assert dist_from_p1[result['door']['y']][result['door']['x']] >= 5
        assert dist_from_p1[result['door']['y']][result['door']['x']] < UNREACHABLE

        assert dist_from_p2[result['door']['y']][result['door']['x']] >= 5
        assert dist_from_p2[result['door']['y']][result['door']['x']] < UNREACHABLE

        assert dist_from_p1[result['p2']['y']][result['p2']['x']] >= 4
        assert dist_from_p1[result['p2']['y']][result['p2']['x']] < UNREACHABLE


def test_door_varies_across_new_seeds():
    unique_doors = set()

    for i in range(24):
        result = generate_maze_logic(
            seed=f"fresh:{i}",
            difficulty="moyen",
            stage=1,
            is_multiplayer=False,
        )
        unique_doors.add((result['door']['x'], result['door']['y']))

    assert len(unique_doors) > 1
