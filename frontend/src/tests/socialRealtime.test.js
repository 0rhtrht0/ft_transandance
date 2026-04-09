import { describe, expect, it } from "vitest";

import {
  normalizeSocialRealtimeKind,
  shouldRefreshFriendsPanel
} from "../routes/friends/utils/socialRealtime.js";

describe("socialRealtime", () => {
  it("recognizes websocket sync events", () => {
    expect(normalizeSocialRealtimeKind({ event: "ws.connected" })).toBe("ws_sync");
  });

  it("recognizes friend notifications as refresh triggers", () => {
    const payload = {
      type: "notification",
      event: "notification.created",
      notification: {
        type: "friend_request_received"
      }
    };

    expect(normalizeSocialRealtimeKind(payload)).toBe("notification");
    expect(shouldRefreshFriendsPanel(payload)).toBe(true);
  });

  it("does not refresh friends panel for chat-only notifications", () => {
    const payload = {
      type: "notification",
      event: "notification.created",
      notification: {
        type: "new_message"
      }
    };

    expect(shouldRefreshFriendsPanel(payload)).toBe(false);
  });
});
