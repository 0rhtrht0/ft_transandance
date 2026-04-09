import { describe, expect, it } from "vitest";
import {
  buildProfileHighlights,
  normalizeProfilePoints,
  resolveProfileRank,
} from "../routes/friends/utils/profileSummary";

describe("profileSummary", () => {
  it("normalizes points and resolves ranks by threshold", () => {
    expect(normalizeProfilePoints(undefined)).toBe(0);
    expect(normalizeProfilePoints(-4)).toBe(0);
    expect(normalizeProfilePoints(6)).toBe(6);

    expect(resolveProfileRank(0)).toBe("Newcomer");
    expect(resolveProfileRank(3)).toBe("Scout");
    expect(resolveProfileRank(6)).toBe("Runner");
    expect(resolveProfileRank(10)).toBe("Navigator");
    expect(resolveProfileRank(15)).toBe("Blackhole Elite");
  });

  it("builds public profile highlight cards from stats", () => {
    expect(
      buildProfileHighlights({
        stats: {
          evaluation_points: 7,
          wallet_transactions: 12,
          wins: 8,
          losses: 3,
          friends_count: 5,
        },
      })
    ).toEqual([
      { label: "Evaluation points", value: 7 },
      { label: "Wallet transactions", value: 12 },
      { label: "Record", value: "8W / 3L" },
      { label: "Friends", value: 5 },
    ]);
  });
});
