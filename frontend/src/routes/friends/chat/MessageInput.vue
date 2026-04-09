<template>
  <form class="message-input-form" @submit.prevent="onSubmit">
    <div class="input-container">
      <div v-if="selectedImagePreview" class="attachment-preview">
        <div class="preview-thumb">
          <img v-if="isImageFile" :src="selectedImagePreview" />
          <AppIcon v-else name="file" :size="20" />
        </div>
        <span class="file-name">{{ selectedImageName }}</span>
        <button type="button" class="remove-btn" @click="clearSelectedImage">
          <AppIcon name="x" :size="14" />
        </button>
      </div>

      <div class="composer-row">
        <div class="tool-buttons">
          <button
            type="button"
            class="tool-btn"
            aria-label="Open emoji picker"
            @click="toggleEmojiPicker"
            :class="{ active: showEmojiPicker }"
          >
            <AppIcon name="smile" :size="18" />
          </button>
          <button type="button" class="tool-btn" @click="openImagePicker">
            <AppIcon name="image" :size="18" />
          </button>
          <button type="button" class="tool-btn" @click="openFilePicker">
            <AppIcon name="folder" :size="18" />
          </button>
        </div>

        <div class="textarea-box">
          <textarea
            ref="draftInput"
            v-model="draft"
            maxlength="1000"
            :placeholder="placeholder"
            :disabled="disabled"
            @keydown.enter.exact.prevent="onSubmit"
          />
        </div>

        <button type="submit" class="send-btn" :disabled="disabled || !canSend">
          <AppIcon name="send" :size="18" />
        </button>
      </div>

      <div v-if="showEmojiPicker" ref="pickerRef" class="emoji-picker-popover">
        <div v-for="group in EMOJI_GROUPS" :key="group.label" class="emoji-group">
          <h6>{{ group.label }}</h6>
          <div class="emoji-list">
            <button
              v-for="emoji in group.items"
              :key="emoji"
              type="button"
              class="emoji-button"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <input ref="fileInput" class="visually-hidden" type="file" @change="onFileChange" />
    <input ref="imageInput" class="visually-hidden" type="file" accept="image/*" @change="onFileChange" />
  </form>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const EMOJI_GROUPS = [
  { label: 'Smileys', items: ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤩', '🥳', '😭', '😡', '🤯'] },
  { label: 'People', items: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👀', '🫶', '🤟', '🫡', '🔥'] },
  { label: 'Symbols', items: ['❤️', '💛', '💚', '💙', '💜', '🖤', '💯', '✨', '⚡', '✅', '❌', '💬'] }
]

const props = defineProps({
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Message...' }
})

const emit = defineEmits(['send'])

const draft = ref('')
const fileInput = ref(null)
const imageInput = ref(null)
const draftInput = ref(null)
const pickerRef = ref(null)
const showEmojiPicker = ref(false)
const selectedImageFile = ref(null)
const selectedImageName = ref('')
const selectedImagePreview = ref('')

const isImageFile = computed(() => selectedImageFile.value?.type?.startsWith('image/'))
const canSend = computed(() => Boolean(draft.value.trim() || selectedImageFile.value))

const revokePreviewUrl = () => {
  if (selectedImagePreview.value?.startsWith('blob:')) URL.revokeObjectURL(selectedImagePreview.value)
}

const clearSelectedImage = () => {
  revokePreviewUrl()
  selectedImageFile.value = null
  selectedImageName.value = ''
  selectedImagePreview.value = ''
  if (fileInput.value) fileInput.value.value = ''
  if (imageInput.value) imageInput.value.value = ''
}

const openFilePicker = () => fileInput.value?.click()
const openImagePicker = () => imageInput.value?.click()

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) {
    clearSelectedImage()
    return
  }
  revokePreviewUrl()
  selectedImageFile.value = file
  selectedImageName.value = file.name
  selectedImagePreview.value = URL.createObjectURL(file)
}

const toggleEmojiPicker = () => { showEmojiPicker.value = !showEmojiPicker.value }

const insertEmoji = async (emoji) => {
  const input = draftInput.value
  if (!input) {
    draft.value += emoji
    return
  }
  const start = input.selectionStart || draft.value.length
  const end = input.selectionEnd || draft.value.length
  draft.value = draft.value.slice(0, start) + emoji + draft.value.slice(end)
  showEmojiPicker.value = false
  await nextTick()
  input.focus()
}

const onSubmit = () => {
  const content = draft.value.trim()
  if ((!content && !selectedImageFile.value) || props.disabled) return
  emit('send', { content, imageFile: selectedImageFile.value })
  draft.value = ''
  showEmojiPicker.value = false
  clearSelectedImage()
}

const handleDocumentClick = (e) => {
  if (showEmojiPicker.value && !pickerRef.value?.contains(e.target) && !e.target.closest('.tool-btn')) {
    showEmojiPicker.value = false
  }
}

watch(() => props.disabled, (val) => {
  if (val) {
    draft.value = ''
    showEmojiPicker.value = false
    clearSelectedImage()
  }
})

onMounted(() => document.addEventListener('click', handleDocumentClick))
onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  revokePreviewUrl()
})
</script>

<style scoped>
.message-input-form { width: 100%; }
.input-container {
  display: flex;
  flex-direction: column;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  position: relative;
  overflow: visible;
}

.attachment-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: #1a1a1a;
  border-bottom: 1px solid #222;
}

.preview-thumb { width: 32px; height: 32px; background: #222; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.preview-thumb img { width: 100%; height: 100%; object-fit: cover; }
.file-name { flex: 1; font-size: 12px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.remove-btn { background: transparent; border: none; color: #555; cursor: pointer; }
.remove-btn:hover { color: #fff; }

.composer-row { display: flex; align-items: center; padding: 8px; gap: 8px; }
.tool-buttons { display: flex; gap: 4px; }
.tool-btn {
  background: transparent;
  border: none;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
}
.tool-btn:hover { background: #222; color: #fff; }
.tool-btn.active { color: var(--social-accent); }

.textarea-box { flex: 1; }
textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 14px;
  resize: none;
  padding: 6px;
  outline: none;
  height: 32px;
  font-family: inherit;
}

.send-btn {
  background: var(--social-accent);
  border: none;
  color: #000;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.emoji-picker-popover {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 250px;
  background: #181818;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.emoji-group h6 { margin: 0 0 8px; font-size: 11px; color: #555; text-transform: uppercase; }
.emoji-list { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
.emoji-list button { background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 4px; }
.emoji-list button:hover { background: #222; border-radius: 4px; }

.visually-hidden { display: none; }
</style>
