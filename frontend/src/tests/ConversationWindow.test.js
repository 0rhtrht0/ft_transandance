import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ConversationWindow from "../routes/friends/chat/ConversationWindow.vue";

describe("ConversationWindow", () => {
  it("keeps the composer slot visible when no conversation is selected", () => {
    const wrapper = mount(ConversationWindow, {
      props: {
        conversation: null,
        messages: [],
        currentUserId: 1,
        pendingRecipientId: null,
        pendingRecipient: null,
      },
      slots: {
        composer: '<div class="composer-probe">Composer</div>',
      },
    });

    expect(wrapper.text()).toContain("Select a conversation or search for a player.");
    expect(wrapper.find(".conversation-composer .composer-probe").exists()).toBe(true);
  });

  it("shows the pending recipient hint and composer for a new direct message", () => {
    const wrapper = mount(ConversationWindow, {
      props: {
        conversation: null,
        messages: [],
        currentUserId: 1,
        pendingRecipientId: 9,
        pendingRecipient: {
          username: "Nova",
        },
      },
      slots: {
        composer: '<div class="composer-probe">Composer</div>',
      },
    });

    expect(wrapper.text()).toContain("You can message Nova");
    expect(wrapper.find(".conversation-composer .composer-probe").exists()).toBe(true);
  });

  it("emits the pending recipient when viewing a profile before the first message", async () => {
    const wrapper = mount(ConversationWindow, {
      props: {
        conversation: null,
        messages: [],
        currentUserId: 1,
        pendingRecipientId: 9,
        pendingRecipient: {
          username: "Nova",
          avatar: "uploaded_avatars/nova.png",
        },
      },
    });

    await wrapper.get(".profile-trigger").trigger("click");

    expect(wrapper.emitted("view-profile")).toEqual([
      [
        {
          id: 9,
          username: "Nova",
          avatar: "uploaded_avatars/nova.png",
        },
      ],
    ]);
  });

  it("renders avatars next to messages", () => {
    const wrapper = mount(ConversationWindow, {
      props: {
        currentUserId: 1,
        currentUserAvatar: "uploaded_avatars/me.png",
        conversation: {
          participants: [
            { id: 2, username: "Nova", avatar: "uploaded_avatars/nova.png", is_online: true },
          ],
        },
        messages: [
          {
            id: 1,
            sender_id: 2,
            sender_name: "Nova",
            sender_avatar: "uploaded_avatars/nova-message.png",
            content: "Hello there",
            image_url: "uploaded_messages/nova-photo.png",
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            sender_id: 1,
            sender_name: "Me",
            content: "Hi",
            created_at: new Date().toISOString(),
          },
        ],
        pendingRecipientId: null,
        pendingRecipient: null,
      },
    });

    const avatars = wrapper.findAll(".message-avatar");
    expect(avatars).toHaveLength(2);
    expect(avatars[0].attributes("style")).toContain("nova-message.png");
    expect(avatars[1].attributes("style")).toContain("me.png");
    expect(wrapper.find(".message-image").attributes("src")).toContain("nova-photo.png");
    expect(wrapper.text()).toContain("Nova");
    expect(wrapper.text()).toContain("You");
  });

  it("emits the direct conversation participant when viewing a profile from the header", async () => {
    const wrapper = mount(ConversationWindow, {
      props: {
        currentUserId: 1,
        conversation: {
          participants: [
            { id: 2, username: "Nova", avatar: "uploaded_avatars/nova.png", is_online: true },
          ],
        },
        messages: [],
        pendingRecipientId: null,
        pendingRecipient: null,
      },
    });

    await wrapper.get(".profile-trigger").trigger("click");

    expect(wrapper.emitted("view-profile")).toEqual([
      [
        {
          id: 2,
          username: "Nova",
          avatar: "uploaded_avatars/nova.png",
        },
      ],
    ]);
  });
});
