import { describe, expect, it } from "vitest";

import {
  buildAchievementBadges,
  buildActivityFeed,
  buildOverviewCards,
  buildSocialRank
} from "../routes/friends/utils/socialGamification.js";

describe("socialGamification", () => {
  it("builds a stable social rank from metrics", () => {
    const rank = buildSocialRank({
      friendsCount: 6,
      onlineCount: 3,
      conversationsCount: 4,
      unreadMessagesCount: 2
    });

    expect(rank.level).toBeGreaterThanOrEqual(1);
    expect(rank.progress).toBeGreaterThan(0);
    expect(rank.title.length).toBeGreaterThan(0);
  });

  it("builds four overview cards", () => {
    const cards = buildOverviewCards({
      friendsCount: 5,
      onlineCount: 2,
      conversationsCount: 3,
      unreadMessagesCount: 1,
      unreadNotificationsCount: 2
    });

    expect(cards).toHaveLength(4);
    expect(cards[0].label).toBe("Friends");
    expect(cards[3].value).toBe(3);
  });

  it("returns fallback achievement when the network is empty", () => {
    expect(buildAchievementBadges({})).toEqual(["Getting started"]);
  });

  it("maps notifications into an activity feed", () => {
    const items = buildActivityFeed([
      {
        id: 1,
        type: "chat.message",
        title: "New message",
        message: "Ping from squad",
        created_at: "2026-03-30T10:00:00Z",
        read: false
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].chip).toBe("Message");
    expect(items[0].tone).toBe("chat");
  });
});
