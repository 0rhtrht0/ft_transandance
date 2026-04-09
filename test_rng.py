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

rng = LCG("moyen:42")
print(rng.random())
print(rng.random())
print(rng.random())
