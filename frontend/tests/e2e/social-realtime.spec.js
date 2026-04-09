import { test, expect } from "@playwright/test";

test("friends reconnect + social message delivery", async ({ page }) => {
  let notificationsFetchCount = 0;
  let messages = [];

  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "test-token");
    localStorage.setItem("userId", "1");

    const NativeWebSocket = window.WebSocket;

    class FakeSocialWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = FakeSocialWebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
      }

      send() {}

      close() {
        this.readyState = FakeSocialWebSocket.CLOSED;
        if (typeof this.onclose === "function") {
          this.onclose({ code: 1000, reason: "client-close" });
        }
      }
    }

    const sockets = [];

    window.__socialWsControl = {
      sockets,
      getCount() {
        return sockets.length;
      },
      emitOpen(index = 0) {
        const ws = sockets[index];
        if (!ws) return;
        ws.readyState = FakeSocialWebSocket.OPEN;
        if (typeof ws.onopen === "function") {
          ws.onopen({ type: "open" });
        }
      },
      emitMessage(index = 0, payload = {}) {
        const ws = sockets[index];
        if (!ws || typeof ws.onmessage !== "function") return;
        ws.onmessage({ data: JSON.stringify(payload) });
      },
      emitClose(index = 0, code = 1006, reason = "network") {
        const ws = sockets[index];
        if (!ws) return;
        ws.readyState = FakeSocialWebSocket.CLOSED;
        if (typeof ws.onclose === "function") {
          ws.onclose({ code, reason });
        }
      },
    };

    window.WebSocket = function PatchedWebSocket(url, protocols) {
      const target = String(url || "");
      if (target.includes("/ws?token=")) {
        const fake = new FakeSocialWebSocket(url);
        sockets.push(fake);
        return fake;
      }
      return new NativeWebSocket(url, protocols);
    };

    window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    window.WebSocket.OPEN = NativeWebSocket.OPEN;
    window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
    window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
  });

  await page.route("**/api/notifications**", async (route, request) => {
    if (request.method() === "GET") {
      notificationsFetchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unread_count: 0, total_count: 0 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detail: "ok" }),
    });
  });

  await page.route("**/api/messages/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        conversations: [
          {
            id: 1,
            type: "direct",
            participants: [{ id: 2, username: "trinity" }],
            unread_count: 0,
            updated_at: "2026-03-20T10:00:00Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/messages/conversations/1/messages**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages }),
    });
  });

  await page.goto("/friends");

  await expect
    .poll(async () =>
      page.evaluate(() => window.__socialWsControl?.getCount?.() ?? 0)
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => window.__socialWsControl.emitOpen(0));

  await page.getByRole("button", { name: /^Chat/ }).click();
  await page.getByRole("button", { name: "trinity" }).click();
  await expect(page.getByText("No messages yet.")).toBeVisible();

  messages = [
    {
      id: 99,
      sender_id: 2,
      sender_name: "trinity",
      content: "Hello from realtime",
      created_at: "2026-03-20T10:01:00Z",
    },
  ];

  await page.evaluate(() => {
    window.__socialWsControl.emitMessage(0, {
      type: "message",
      event: "conversation.message_created",
      conversation_id: 1,
      sender_id: 2,
      sender_name: "trinity",
      content: "Hello from realtime",
    });
  });

  await expect(page.getByText("Hello from realtime")).toBeVisible();

  const initialFetchCount = notificationsFetchCount;

  await page.evaluate(() => window.__socialWsControl.emitClose(0));

  await expect
    .poll(async () =>
      page.evaluate(() => window.__socialWsControl?.getCount?.() ?? 0)
    )
    .toBe(2);

  await page.evaluate(() => window.__socialWsControl.emitOpen(1));

  await expect.poll(() => notificationsFetchCount).toBeGreaterThan(initialFetchCount);
});
