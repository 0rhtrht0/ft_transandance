"""Realtime event contract constants.

`type` can remain legacy for backward compatibility, while `event` carries
the canonical namespaced contract for new consumers.
"""

EVENT_ROOM_PLAYER_JOINED = "room.player_joined"
EVENT_ROOM_PLAYER_LEFT = "room.player_left"
EVENT_ROOM_STATE_UPDATED = "room.state_updated"
EVENT_ROOM_READY_STATE = "room.ready_state"
EVENT_ROOM_MATCH_START = "room.match_start"
EVENT_ROOM_CLOSED = "room.closed"

EVENT_CONVERSATION_MESSAGE_CREATED = "conversation.message_created"
EVENT_NOTIFICATION_CREATED = "notification.created"
EVENT_PRESENCE_ONLINE = "presence.online"
EVENT_PRESENCE_OFFLINE = "presence.offline"
