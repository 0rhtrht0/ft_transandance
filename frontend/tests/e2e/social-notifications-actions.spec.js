import { test, expect } from "@playwright/test";

test("social actions each create a visible notification", async ({ page }) => {
  const state = {
    currentUserId: 1,
    nextRequestId: 300,
    nextNotificationId: 1,
    users: {
      1: "Player",
      5: "Sandy",
      9: "Nova",
      11: "Neo",
      12: "Trinity",
      13: "Morpheus",
    },
    friends: [
      { id: 5, username: "Sandy", is_online: true, avatar: null, evaluation_points: 0 },
    ],
    requests: [
      { id: 101, requester_id: 11, addressee_id: 1, status: "pending" },
      { id: 102, requester_id: 12, addressee_id: 1, status: "pending" },
      { id: 201, requester_id: 1, addressee_id: 13, status: "pending" },
    ],
    notifications: [],
  };

  const userFromId = (id) => ({
    id,
    username: state.users[id] || `User #${id}`,
    avatar: null,
    is_online: false,
    evaluation_points: 0,
  });

  const serializeRequest = (row) => ({
    ...row,
    requester: userFromId(row.requester_id),
    addressee: userFromId(row.addressee_id),
  });

  const summaryPayload = () => {
    const requests = state.requests.map(serializeRequest);
    const pendingIncoming = requests.filter(
      (row) => row.addressee_id === state.currentUserId && row.status === "pending"
    ).length;
    const pendingOutgoing = requests.filter(
      (row) => row.requester_id === state.currentUserId && row.status === "pending"
    ).length;

    return {
      friends: state.friends,
      requests,
      counts: {
        friends: state.friends.length,
        online: state.friends.filter((row) => row.is_online).length,
        pending_incoming: pendingIncoming,
        pending_outgoing: pendingOutgoing,
      },
    };
  };

  const addNotification = (type, title, message) => {
    state.notifications.unshift({
      id: state.nextNotificationId++,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    });
  };

  const requestIdFromPath = (url) => {
    const raw = url.pathname.split("/").pop();
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  };

  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "test-token");
    localStorage.setItem("userId", "1");

    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      constructor() {
        this.readyState = FakeWebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN;
          if (typeof this.onopen === "function") {
            this.onopen({ type: "open" });
          }
        }, 0);
      }
      send() {}
      close() {
        this.readyState = FakeWebSocket.CLOSED;
        if (typeof this.onclose === "function") {
          this.onclose({ code: 1000, reason: "client-close" });
        }
      }
    }

    window.WebSocket = FakeWebSocket;
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.route("**/users/profiles/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ avatar: null }),
    });
  });

  await page.route("**/api/users/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: 9,
            username: "Nova",
            avatar: null,
            is_online: false,
            evaluation_points: 120,
          },
        ],
      }),
    });
  });

  await page.route("**/api/notifications**", async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: state.notifications,
          unread_count: state.notifications.filter((row) => !row.read).length,
          total_count: state.notifications.length,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detail: "ok" }),
    });
  });

  await page.route("**/api/friends/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(summaryPayload()),
    });
  });

  await page.route("**/api/friends/requests", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requests: state.requests.map(serializeRequest),
      }),
    });
  });

  await page.route("**/api/friends/request", async (route, request) => {
    const payload = request.postDataJSON() || {};
    const targetId = Number(payload.user_id);
    const userId = Number.isFinite(targetId) ? targetId : 9;
    const created = {
      id: state.nextRequestId++,
      requester_id: state.currentUserId,
      addressee_id: userId,
      status: "pending",
    };
    state.requests.unshift(created);
    addNotification(
      "friend_request_sent_self",
      userFromId(userId).username,
      `Friend request sent to ${userFromId(userId).username}.`
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(created),
    });
  });

  await page.route("**/api/friends/accept/*", async (route) => {
    const requestId = requestIdFromPath(new URL(route.request().url()));
    const target = state.requests.find((row) => row.id === requestId) || null;
    if (!target) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Friend request not found" }),
      });
      return;
    }

    state.requests = state.requests.filter((row) => row.id !== target.id);
    const requester = userFromId(target.requester_id);
    if (!state.friends.some((row) => row.id === requester.id)) {
      state.friends.unshift({
        id: requester.id,
        username: requester.username,
        avatar: null,
        is_online: false,
        evaluation_points: 0,
      });
    }
    addNotification(
      "friend_request_accepted_self",
      requester.username,
      `${requester.username} is now your friend.`
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: target.id,
        requester_id: target.requester_id,
        addressee_id: target.addressee_id,
        status: "accepted",
      }),
    });
  });

  await page.route("**/api/friends/reject/*", async (route) => {
    const requestId = requestIdFromPath(new URL(route.request().url()));
    const target = state.requests.find((row) => row.id === requestId) || null;
    if (!target) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Friend request not found" }),
      });
      return;
    }

    state.requests = state.requests.filter((row) => row.id !== target.id);
    const requester = userFromId(target.requester_id);
    addNotification(
      "friend_request_rejected_self",
      requester.username,
      `You rejected ${requester.username}'s friend request.`
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Friend request rejected" }),
    });
  });

  await page.route("**/api/friends/cancel/*", async (route) => {
    const requestId = requestIdFromPath(new URL(route.request().url()));
    const target = state.requests.find((row) => row.id === requestId) || null;
    if (!target) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Friend request not found" }),
      });
      return;
    }

    state.requests = state.requests.filter((row) => row.id !== target.id);
    const addressee = userFromId(target.addressee_id);
    addNotification(
      "friend_request_cancelled_self",
      addressee.username,
      `Friend request to ${addressee.username} cancelled.`
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Friend request cancelled" }),
    });
  });

  await page.route("**/api/friends/*", async (route, request) => {
    const url = new URL(request.url());
    if (request.method() !== "DELETE" || url.pathname.endsWith("/summary")) {
      await route.fallback();
      return;
    }

    const friendId = requestIdFromPath(url);
    const target = state.friends.find((row) => row.id === friendId) || null;
    if (!target) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Friend not found" }),
      });
      return;
    }

    state.friends = state.friends.filter((row) => row.id !== target.id);
    addNotification(
      "friend_removed_self",
      target.username,
      `You removed ${target.username} from your friends.`
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Friend removed" }),
    });
  });

  await page.goto("/friends");

  await expect(page.locator(".friends-header__copy h2")).toHaveText("Friends");

  await page.getByPlaceholder("Search players...").fill("Nova");
  const novaRow = page.locator(".search-result").filter({ hasText: "Nova" });
  await expect(novaRow).toBeVisible();
  await novaRow.getByRole("button", { name: "Add Friend" }).click();
  await expect(novaRow.getByRole("button", { name: "Cancel" })).toBeVisible();

  const neoIncoming = page.locator(".request-card").filter({ hasText: "Neo" });
  await neoIncoming.getByRole("button", { name: "Accept" }).click();

  const trinityIncoming = page.locator(".request-card").filter({ hasText: "Trinity" });
  await trinityIncoming.getByRole("button", { name: "Reject" }).click();

  const morpheusOutgoing = page.locator(".request-card").filter({ hasText: "Morpheus" });
  await morpheusOutgoing.getByRole("button", { name: "Cancel" }).click();

  const sandyFriend = page.locator(".friend-card").filter({ hasText: "Sandy" });
  await sandyFriend.getByRole("button", { name: "Remove" }).click();

  await page.getByRole("tab", { name: /Notifications/ }).click();

  const cards = page.locator(".notification-card");
  await expect(cards).toHaveCount(5);

  await expect(page.getByText("Friend request sent to Nova")).toBeVisible();
  await expect(page.getByText("Neo is now your friend")).toBeVisible();
  await expect(page.getByText("You rejected Trinity's friend request")).toBeVisible();
  await expect(page.getByText("Friend request to Morpheus cancelled")).toBeVisible();
  await expect(page.getByText("You removed Sandy from your friends")).toBeVisible();
});
