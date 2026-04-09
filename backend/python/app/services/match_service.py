import uuid

class MatchService:

    def __init__(self):
        self.queue = []

    def join_queue(self, user_id: int):
        if user_id not in self.queue:
            self.queue.append(user_id)

    def leave_queue(self, user_id: int):
        if user_id in self.queue:
            self.queue.remove(user_id)

    def try_match(self):
        if len(self.queue) >= 2:
            player1 = self.queue.pop(0)
            player2 = self.queue.pop(0)
            room_id = f"room_{uuid.uuid4().hex[:6]}"

            return room_id, [player1, player2]

        return None