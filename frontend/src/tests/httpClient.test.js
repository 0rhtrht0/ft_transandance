import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../routes/friends/services/httpClient.js";

describe("httpClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("clears the local session when the API returns 401", async () => {
    localStorage.setItem("accessToken", "stale-token");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Could not validate credentials" }),
      }),
    );

    await expect(requestJson("/api/messages/conversations")).rejects.toThrow(
      "Could not validate credentials",
    );

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not clear the session for non-auth authorization errors", async () => {
    localStorage.setItem("accessToken", "valid-token");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Forbidden" }),
      }),
    );

    await expect(requestJson("/api/messages/conversations/4/messages")).rejects.toThrow(
      "Forbidden",
    );

    expect(localStorage.getItem("accessToken")).toBe("valid-token");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("surfaces network failures instead of returning empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(requestJson("/api/friends")).rejects.toThrow(
      "Unable to reach the server.",
    );
  });
});
