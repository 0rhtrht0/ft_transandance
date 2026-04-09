import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MessageInput from "../routes/friends/chat/MessageInput.vue";

describe("MessageInput", () => {
  it("opens the emoji picker and inserts an emoji into the draft", async () => {
    const wrapper = mount(MessageInput);

    await wrapper.find('button[aria-label="Open emoji picker"]').trigger("click");
    await wrapper.find(".emoji-button").trigger("click");

    expect(wrapper.find("textarea").element.value.length).toBeGreaterThan(0);
  });

  it("emits the message content and selected image file", async () => {
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();

    const wrapper = mount(MessageInput);
    await wrapper.find("textarea").setValue("Photo drop");

    const file = new File(["image"], "photo.png", { type: "image/png" });
    const fileInput = wrapper.find('input[type="file"]');
    Object.defineProperty(fileInput.element, "files", {
      value: [file],
      configurable: true,
    });
    await fileInput.trigger("change");
    await wrapper.find("form").trigger("submit.prevent");

    const payload = wrapper.emitted("send")[0][0];
    expect(payload.content).toBe("Photo drop");
    expect(payload.imageFile.name).toBe("photo.png");
  });
});
