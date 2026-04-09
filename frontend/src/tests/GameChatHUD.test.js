import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import { describe, it, expect, vi } from "vitest";
import GameChatHUD from "../components/GameChatHUD.vue";

const provideGlobals = () => ({
  currentUserId: ref(1),
  apiUrl: "http://localhost:8000",
  jwtToken: "token",
  gameClient: null,
});

describe("GameChatHUD", () => {
  it("sends a message via the websocket client", async () => {
    const wsClient = {
      userId: 1,
      sendRoomMessage: vi.fn(),
      onRoomMessage: null,
    };

    const wrapper = mount(GameChatHUD, {
      props: {
        matchId: "room-1",
        players: [],
        wsClient,
      },
      global: {
        provide: provideGlobals(),
      },
    });

    await wrapper.find(".toggle-btn").trigger("click");
    const input = wrapper.find("input");
    await input.setValue("hello");
    await input.trigger("keyup.enter");

    expect(wsClient.sendRoomMessage).toHaveBeenCalledWith("hello");
    expect(input.element.value).toBe("");
  });

  it("renders incoming room messages", async () => {
    const wsClient = {
      userId: 1,
      sendRoomMessage: vi.fn(),
      onRoomMessage: null,
    };

    const wrapper = mount(GameChatHUD, {
      props: {
        matchId: "room-1",
        players: [{ id: 2, username: "Trinity" }],
        wsClient,
      },
      global: {
        provide: provideGlobals(),
      },
    });

    wsClient.onRoomMessage({
      user_id: 2,
      content: "Salut",
    });
    await nextTick();

    expect(wrapper.text()).toContain("Trinity");
    expect(wrapper.text()).toContain("Salut");
  });
});
