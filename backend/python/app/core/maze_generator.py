import math

DIRECTIONS = ((0, -1), (0, 1), (-1, 0), (1, 0))
UNREACHABLE = 9999
MIN_PLAYER_DOOR_DISTANCE = 5
MIN_PLAYER_PLAYER_DISTANCE = 4
MAX_GENERATION_ATTEMPTS = 240


def clamp(value, min_val, max_val):
    return max(min(value, max_val), min_val)


def normalize_seed(seed):
    if isinstance(seed, (int, float)):
        return int(seed) & 0xFFFFFFFF
    if isinstance(seed, str):
        hash_val = 2166136261
        for char in seed:
            hash_val ^= ord(char)
            hash_val = (hash_val * 16777619) & 0xFFFFFFFF
        return hash_val
    return 1


class LCG:
    def __init__(self, seed):
        val = normalize_seed(seed)
        self.state = val if val else 1

    def random(self):
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 0x100000000


def same_cell(a, b):
    return a['x'] == b['x'] and a['y'] == b['y']


def cell_key(cell):
    return f"{cell['x']},{cell['y']}"


def is_inside_bounds(x, y, cols, rows):
    return 0 <= x < cols and 0 <= y < rows


def is_valid_door_cell(cell, cols, rows):
    return 1 < cell['x'] < cols - 2 and 1 < cell['y'] < rows - 2


def has_open_neighbor(grid, cols, rows, cell):
    for dx, dy in DIRECTIONS:
        nx = cell['x'] + dx
        ny = cell['y'] + dy
        if is_inside_bounds(nx, ny, cols, rows) and grid[ny][nx] == 0:
            return True
    return False


def get_bfs_distances(grid, cols, rows, start):
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
            if not is_inside_bounds(nx, ny, cols, rows):
                continue
            if grid[ny][nx] != 0:
                continue
            if dists[ny][nx] <= curr_dist + 1:
                continue
            dists[ny][nx] = curr_dist + 1
            q.append({'x': nx, 'y': ny})

    return dists


def shuffle_in_place(items, rng):
    for i in range(len(items) - 1, 0, -1):
        j = math.floor(rng.random() * (i + 1))
        items[i], items[j] = items[j], items[i]


def pick_random(items, rng):
    if not items:
        return None
    return items[math.floor(rng.random() * len(items))]


def validate_start_state(grid, cols, rows, p1, p2, door, is_multiplayer):
    # Mandatory checks right before match start.
    if not is_valid_door_cell(door, cols, rows):
        return False
    if not has_open_neighbor(grid, cols, rows, door):
        return False

    if same_cell(p1, door):
        return False

    dist_from_p1 = get_bfs_distances(grid, cols, rows, p1)
    p1_door_distance = dist_from_p1[door['y']][door['x']]
    if p1_door_distance < MIN_PLAYER_DOOR_DISTANCE or p1_door_distance >= UNREACHABLE:
        return False

    if is_multiplayer:
        if p2 is None:
            return False
        if same_cell(p1, p2):
            return False
        if same_cell(p2, door):
            return False

        dist_from_p2 = get_bfs_distances(grid, cols, rows, p2)
        p2_door_distance = dist_from_p2[door['y']][door['x']]
        if p2_door_distance < MIN_PLAYER_DOOR_DISTANCE or p2_door_distance >= UNREACHABLE:
            return False

        p1_p2_distance = dist_from_p1[p2['y']][p2['x']]
        if p1_p2_distance < MIN_PLAYER_PLAYER_DISTANCE or p1_p2_distance >= UNREACHABLE:
            return False

    return True


def generate_maze_logic(seed, difficulty, stage, is_multiplayer, viewport_width=800, viewport_height=600, tile_size=28):
    if is_multiplayer:
        # Same deterministic dimensions as frontend multiplayer generation.
        viewport_width = 800
        viewport_height = 800

    cols = math.floor(viewport_width / tile_size)
    if cols % 2 == 0:
        cols -= 1
    rows = math.floor(viewport_height / tile_size)
    if rows % 2 == 0:
        rows -= 1
    cols = max(11, cols)
    rows = max(11, rows)

    for attempt in range(MAX_GENERATION_ATTEMPTS):
        rng = LCG(f"{seed}:{attempt}")
        result = try_generate(rng, cols, rows, difficulty, stage, is_multiplayer)
        if result:
            return result

    raise RuntimeError("Unable to generate a valid BlackHole start state")


def try_generate(rng, cols, rows, difficulty, stage, is_multiplayer):
    grid = [[1 for _ in range(cols)] for _ in range(rows)]
    grid[1][1] = 0
    stack = [{'row': 1, 'col': 1}]

    def get_unvisited_neighbors(r, c):
        dirs = [(-2, 0), (2, 0), (0, -2), (0, 2)]
        neighbors = []
        for dr, dc in dirs:
            nr = r + dr
            nc = c + dc
            if 0 < nr < rows - 1 and 0 < nc < cols - 1 and grid[nr][nc] == 1:
                neighbors.append({'row': nr, 'col': nc, 'wallRow': r + dr // 2, 'wallCol': c + dc // 2})
        return neighbors

    while stack:
        current = stack[-1]
        neighbors = get_unvisited_neighbors(current['row'], current['col'])
        if not neighbors:
            stack.pop()
            continue
        next_cell = neighbors[math.floor(rng.random() * len(neighbors))]
        grid[next_cell['wallRow']][next_cell['wallCol']] = 0
        grid[next_cell['row']][next_cell['col']] = 0
        stack.append({'row': next_cell['row'], 'col': next_cell['col']})

    ratio = clamp((stage - 1) / 99.0, 0.0, 1.0)
    if difficulty == "facile":
        remove_fraction = 0.30 - 0.15 * ratio
    elif difficulty == "moyen":
        remove_fraction = 0.15 - 0.10 * ratio
    else:
        remove_fraction = 0.05 - 0.05 * ratio

    removable_walls = []
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            if grid[r][c] != 1:
                continue
            up = grid[r - 1][c] == 0
            down = grid[r + 1][c] == 0
            left = grid[r][c - 1] == 0
            right = grid[r][c + 1] == 0
            if (up and down and not left and not right) or (not up and not down and left and right):
                removable_walls.append({'r': r, 'c': c})

    shuffle_in_place(removable_walls, rng)

    to_remove = math.floor(len(removable_walls) * remove_fraction)
    for i in range(to_remove):
        wall = removable_walls[i]
        grid[wall['r']][wall['c']] = 0

    free_cells = []
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            if grid[r][c] == 0:
                free_cells.append({'x': c, 'y': r})
    if not free_cells:
        return None

    door_candidates = [cell for cell in free_cells if is_valid_door_cell(cell, cols, rows)]
    if not door_candidates:
        return None
    shuffle_in_place(door_candidates, rng)

    for door in door_candidates:
        if not has_open_neighbor(grid, cols, rows, door):
            continue

        dist_from_door = get_bfs_distances(grid, cols, rows, door)
        spawn_candidates = []
        for cell in free_cells:
            if same_cell(cell, door):
                continue
            distance = dist_from_door[cell['y']][cell['x']]
            if MIN_PLAYER_DOOR_DISTANCE <= distance < UNREACHABLE:
                spawn_candidates.append(cell)
        if not spawn_candidates:
            continue

        p1 = pick_random(spawn_candidates, rng)
        if p1 is None:
            continue

        p2 = None
        if is_multiplayer:
            dist_from_p1 = get_bfs_distances(grid, cols, rows, p1)
            p2_candidates = []
            for cell in spawn_candidates:
                if same_cell(cell, p1):
                    continue
                distance = dist_from_p1[cell['y']][cell['x']]
                if MIN_PLAYER_PLAYER_DISTANCE <= distance < UNREACHABLE:
                    p2_candidates.append(cell)
            p2 = pick_random(p2_candidates, rng)
            if p2 is None:
                continue

        if not validate_start_state(grid, cols, rows, p1, p2, door, is_multiplayer):
            continue

        occupied = {cell_key(door), cell_key(p1)}
        if p2 is not None:
            occupied.add(cell_key(p2))

        safe_free_cells = [cell for cell in free_cells if cell_key(cell) not in occupied]
        if not safe_free_cells:
            continue

        bh1 = pick_random(safe_free_cells, rng)
        if bh1 is None:
            continue

        bh2 = None
        if is_multiplayer:
            bh2_candidates = [cell for cell in safe_free_cells if not same_cell(cell, bh1)]
            bh2 = pick_random(bh2_candidates, rng) or bh1

        return {
            'grid': grid,
            'cols': cols,
            'rows': rows,
            'p1': p1,
            'p2': p2,
            'door': door,
            'bh1': bh1,
            'bh2': bh2,
        }

    return None
