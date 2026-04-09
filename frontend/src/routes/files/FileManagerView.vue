<template>
  <section class="files-view" aria-labelledby="files-title">
    <header class="files-header">
      <div class="files-header__copy">
        <span class="files-eyebrow">Storage</span>
        <h1 id="files-title">
          <AppIcon name="folder" :size="20" />
          File Locker
        </h1>
        <p>
          Manage private uploads with client-side and server-side validation, secure access control,
          previews, and deletion.
        </p>
      </div>
      <div class="files-header__actions">
        <button type="button" class="secondary" @click="goToMenu">
          <AppIcon name="arrow-left" :size="14" />
          Back to menu
        </button>
      </div>
    </header>

    <div class="files-grid">
      <section class="panel" aria-labelledby="upload-title">
        <div class="panel-heading">
          <h2 id="upload-title">
            <AppIcon name="upload" :size="16" />
            Upload files
          </h2>
          <span class="panel-chip">PNG, JPG, GIF, WEBP, PDF, TXT, MD</span>
        </div>

        <p class="panel-copy">
          You can upload multiple images and documents. Each file is validated locally and on the server,
          then stored in your private authenticated space.
        </p>

        <label
          class="dropzone"
          :class="{ 'is-drag-active': dragActive }"
          tabindex="0"
          @dragenter.prevent="dragActive = true"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="handleDrop"
          @keydown.enter.prevent="openFilePicker"
          @keydown.space.prevent="openFilePicker"
        >
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            multiple
            :accept="FILE_INPUT_ACCEPT"
            @change="handleSelectionChange"
          />
          <AppIcon name="keyboard" :size="18" />
          <strong>Drop files here or choose them with the keyboard</strong>
          <span>Maximum size: 10 MB per file.</span>
        </label>

        <ul v-if="validationErrors.length" class="feedback-list" aria-live="polite">
          <li v-for="error in validationErrors" :key="error" class="feedback-error">{{ error }}</li>
        </ul>

        <div v-if="pendingFiles.length" class="pending-list" role="list" aria-label="Selected files">
          <article
            v-for="entry in pendingFiles"
            :key="entry.id"
            class="pending-card"
            role="listitem"
          >
            <div class="pending-thumb" :class="`kind-${entry.previewKind}`">
              <img v-if="entry.previewKind === 'image'" :src="entry.localPreviewUrl" :alt="entry.file.name" />
              <span v-else>{{ entry.previewKind.toUpperCase() }}</span>
            </div>
            <div class="pending-copy">
              <strong>{{ entry.file.name }}</strong>
              <span>{{ entry.sizeLabel }} · {{ entry.category }}</span>
            </div>
            <button type="button" class="ghost-danger" @click="removePending(entry.id)">
              <AppIcon name="trash" :size="14" />
              Remove
            </button>
          </article>
        </div>

        <div class="upload-actions">
          <button type="button" :disabled="!pendingFiles.length || uploading" @click="uploadSelectedFiles">
            <AppIcon name="upload" :size="14" />
            {{ uploading ? 'Uploading…' : 'Upload selection' }}
          </button>
          <button type="button" class="secondary" :disabled="!pendingFiles.length || uploading" @click="clearPending">
            Clear selection
          </button>
        </div>

        <div class="upload-progress" :aria-busy="uploading ? 'true' : 'false'">
          <label for="upload-progress-bar">Upload progress</label>
          <progress id="upload-progress-bar" :value="uploadProgress" max="100">{{ uploadProgress }}%</progress>
          <span>{{ uploadProgress }}%</span>
        </div>

        <p class="status-message" role="status" aria-live="polite">{{ statusMessage }}</p>
      </section>

      <section class="panel" aria-labelledby="library-title">
        <div class="panel-heading">
          <h2 id="library-title">
            <AppIcon name="folder" :size="16" />
            My files
          </h2>
          <button type="button" class="secondary" :disabled="loadingFiles" @click="loadFiles">
            Refresh
          </button>
        </div>

        <p class="panel-copy">
          Stored files remain private and are served through authenticated endpoints only.
        </p>

        <div v-if="loadingFiles" class="empty-state">Loading your files…</div>
        <div v-else-if="!files.length" class="empty-state">No uploaded files yet.</div>
        <div v-else class="file-list" role="list" aria-label="Uploaded files">
          <button
            v-for="file in files"
            :key="file.id"
            type="button"
            class="file-card"
            :class="{ active: selectedFile?.id === file.id }"
            :aria-pressed="selectedFile?.id === file.id ? 'true' : 'false'"
            @click="selectFile(file)"
          >
            <div class="file-card__thumb" :class="`kind-${file.preview_kind}`">
              <img
                v-if="file.preview_kind === 'image'"
                :src="resolveManagedFileUrl(file.preview_url)"
                :alt="file.original_name"
              />
              <span v-else>{{ file.preview_kind.toUpperCase() }}</span>
            </div>
            <div class="file-card__copy">
              <strong>{{ file.original_name }}</strong>
              <span>{{ formatFileSize(file.size_bytes) }} · {{ file.content_type }}</span>
            </div>
          </button>
        </div>
      </section>

      <aside class="panel preview-panel" aria-labelledby="preview-title">
        <div class="panel-heading">
          <h2 id="preview-title">Preview</h2>
          <span v-if="selectedFile" class="panel-chip">{{ selectedFile.preview_kind }}</span>
        </div>

        <template v-if="selectedFile">
          <div class="preview-surface">
            <img
              v-if="selectedFile.preview_kind === 'image'"
              :src="selectedPreviewUrl"
              :alt="selectedFile.original_name"
            />
            <iframe
              v-else-if="selectedFile.preview_kind === 'pdf'"
              :src="selectedPreviewUrl"
              :title="`Preview of ${selectedFile.original_name}`"
            />
            <pre v-else-if="selectedFile.preview_kind === 'text'">{{ textPreview }}</pre>
            <div v-else class="preview-empty">
              Preview is not available for this document type.
            </div>
          </div>

          <dl class="preview-meta">
            <div>
              <dt>Name</dt>
              <dd>{{ selectedFile.original_name }}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{{ selectedFile.content_type }}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{{ formatFileSize(selectedFile.size_bytes) }}</dd>
            </div>
          </dl>

          <div class="preview-actions">
            <a class="secondary-link" :href="selectedDownloadUrl" target="_blank" rel="noopener noreferrer">
              <AppIcon name="download" :size="14" />
              Open or download
            </a>
            <button type="button" class="danger" :disabled="deletingFile" @click="deleteSelectedFile">
              <AppIcon name="trash" :size="14" />
              {{ deletingFile ? 'Deleting…' : 'Delete file' }}
            </button>
          </div>
        </template>

        <div v-else class="empty-state">
          Select a file to preview it.
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'
import { deleteManagedFile, fetchManagedFileTextPreview, listManagedFiles, resolveManagedFileUrl, uploadManagedFiles } from './filesService.js'
import { FILE_INPUT_ACCEPT, formatFileSize, validateSelectedFiles } from './fileValidation.js'

const router = useRouter()

const fileInput = ref(null)
const dragActive = ref(false)
const loadingFiles = ref(false)
const uploading = ref(false)
const deletingFile = ref(false)
const uploadProgress = ref(0)
const statusMessage = ref('Ready to upload private files.')
const validationErrors = ref([])
const pendingFiles = ref([])
const files = ref([])
const selectedFile = ref(null)
const textPreview = ref('')

let nextPendingId = 1

const selectedPreviewUrl = computed(() =>
  selectedFile.value ? resolveManagedFileUrl(selectedFile.value.preview_url) : ''
)
const selectedDownloadUrl = computed(() =>
  selectedFile.value ? resolveManagedFileUrl(selectedFile.value.download_url) : ''
)

const revokePendingUrls = (entries) => {
  for (const entry of entries) {
    if (entry?.localPreviewUrl) {
      URL.revokeObjectURL(entry.localPreviewUrl)
    }
  }
}

const syncSelectedFile = () => {
  if (!files.value.length) {
    selectedFile.value = null
    textPreview.value = ''
    return
  }

  if (!selectedFile.value) {
    selectedFile.value = files.value[0]
    return
  }

  const refreshed = files.value.find((entry) => entry.id === selectedFile.value.id)
  selectedFile.value = refreshed || files.value[0]
}

const loadFiles = async () => {
  loadingFiles.value = true
  try {
    files.value = await listManagedFiles()
    syncSelectedFile()
    if (selectedFile.value?.preview_kind === 'text') {
      try {
        textPreview.value = await fetchManagedFileTextPreview(selectedFile.value.preview_url)
      } catch (error) {
        textPreview.value = error instanceof Error ? error.message : 'Unable to load the preview.'
      }
    } else {
      textPreview.value = ''
    }
    statusMessage.value = files.value.length
      ? `${files.value.length} private file(s) loaded.`
      : 'No uploaded files yet.'
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Unable to load your files.'
  } finally {
    loadingFiles.value = false
  }
}

const clearPending = () => {
  revokePendingUrls(pendingFiles.value)
  pendingFiles.value = []
  validationErrors.value = []
  uploadProgress.value = 0
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const registerPendingFiles = (fileList) => {
  const { validFiles, errors } = validateSelectedFiles(fileList)
  validationErrors.value = errors
  if (!validFiles.length) {
    return
  }

  const nextEntries = validFiles.map((entry) => ({
    id: `pending_${nextPendingId++}`,
    ...entry,
    localPreviewUrl: entry.previewKind === 'image' ? URL.createObjectURL(entry.file) : ''
  }))

  pendingFiles.value = [...pendingFiles.value, ...nextEntries]
  statusMessage.value = `${pendingFiles.value.length} file(s) ready to upload.`
}

const handleSelectionChange = (event) => {
  registerPendingFiles(event.target.files)
}

const handleDrop = (event) => {
  dragActive.value = false
  registerPendingFiles(event.dataTransfer?.files)
}

const openFilePicker = () => {
  fileInput.value?.click()
}

const removePending = (pendingId) => {
  const target = pendingFiles.value.find((entry) => entry.id === pendingId)
  if (target?.localPreviewUrl) {
    URL.revokeObjectURL(target.localPreviewUrl)
  }
  pendingFiles.value = pendingFiles.value.filter((entry) => entry.id !== pendingId)
  statusMessage.value = pendingFiles.value.length
    ? `${pendingFiles.value.length} file(s) still selected.`
    : 'Selection cleared.'
}

const uploadSelectedFiles = async () => {
  if (!pendingFiles.value.length || uploading.value) {
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  validationErrors.value = []

  try {
    await uploadManagedFiles(
      pendingFiles.value.map((entry) => entry.file),
      (progress) => {
        uploadProgress.value = progress
      }
    )
    statusMessage.value = `${pendingFiles.value.length} file(s) uploaded successfully.`
    clearPending()
    await loadFiles()
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Unable to upload the selected files.'
  } finally {
    uploading.value = false
  }
}

const selectFile = async (file) => {
  selectedFile.value = file
  if (file.preview_kind !== 'text') {
    textPreview.value = ''
    return
  }

  try {
    textPreview.value = await fetchManagedFileTextPreview(file.preview_url)
  } catch (error) {
    textPreview.value = error instanceof Error ? error.message : 'Unable to load the preview.'
  }
}

const deleteSelectedFile = async () => {
  if (!selectedFile.value || deletingFile.value) {
    return
  }

  const confirmed = window.confirm(`Delete ${selectedFile.value.original_name}?`)
  if (!confirmed) {
    return
  }

  deletingFile.value = true
  try {
    await deleteManagedFile(selectedFile.value.id)
    statusMessage.value = `${selectedFile.value.original_name} deleted.`
    await loadFiles()
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Unable to delete the selected file.'
  } finally {
    deletingFile.value = false
  }
}

const goToMenu = () => {
  router.push({ name: 'menu' })
}

onMounted(async () => {
  await loadFiles()
  if (files.value[0]) {
    await selectFile(files.value[0])
  }
})

onBeforeUnmount(() => {
  revokePendingUrls(pendingFiles.value)
})
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.files-view {
  min-height: 100vh;
  padding: clamp(18px, 3vw, 32px);
  color: #f5f5f5;
  background:
    radial-gradient(circle at 14% 14%, rgba(255, 255, 255, 0.08), transparent 44%),
    radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.05), transparent 36%),
    linear-gradient(165deg, #090909, #020202 78%);
}

.files-header,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: linear-gradient(160deg, rgba(28, 28, 28, 0.94), rgba(10, 10, 10, 0.96));
  box-shadow: 0 24px 44px rgba(0, 0, 0, 0.46);
}

.files-header {
  width: min(1200px, 100%);
  margin: 0 auto 18px;
  padding: 18px;
  border-radius: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.files-eyebrow,
.panel-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.files-header__copy {
  display: grid;
  gap: 8px;
}

.files-header__copy h1,
.panel-heading h2 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.files-header__copy p,
.panel-copy {
  margin: 0;
  color: #c7c7c7;
  line-height: 1.6;
}

.files-grid {
  width: min(1200px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 18px;
}

.panel {
  border-radius: 20px;
  padding: 18px;
  display: grid;
  gap: 14px;
  min-height: 0;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dropzone {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 18px;
  border-radius: 18px;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.dropzone.is-drag-active {
  border-color: rgba(255, 255, 255, 0.52);
  background: rgba(255, 255, 255, 0.09);
}

.pending-list,
.file-list {
  display: grid;
  gap: 10px;
}

.pending-card,
.file-card {
  width: 100%;
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
}

.file-card {
  cursor: pointer;
  text-align: left;
}

.file-card.active {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.1);
}

.pending-thumb,
.file-card__thumb {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}

.pending-thumb img,
.file-card__thumb img,
.preview-surface img,
.preview-surface iframe {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 0;
}

.pending-copy,
.file-card__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.pending-copy strong,
.file-card__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-copy span,
.file-card__copy span,
.status-message,
.empty-state {
  color: #c7c7c7;
  line-height: 1.5;
}

.upload-actions,
.preview-actions,
.files-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

button,
.secondary-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: linear-gradient(160deg, rgba(62, 62, 62, 0.92), rgba(18, 18, 18, 0.96));
  color: #f4f4f4;
  cursor: pointer;
  text-decoration: none;
}

button.secondary,
.secondary-link {
  background: rgba(255, 255, 255, 0.08);
}

button.danger,
button.ghost-danger {
  background: linear-gradient(160deg, rgba(82, 40, 40, 0.86), rgba(28, 10, 10, 0.96));
}

button.ghost-danger {
  min-height: 36px;
  padding: 8px 10px;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.upload-progress {
  display: grid;
  gap: 8px;
}

progress {
  width: 100%;
  height: 14px;
}

.feedback-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.feedback-error {
  color: #ffc7c7;
}

.preview-panel {
  align-content: start;
}

.preview-surface {
  min-height: 280px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
}

.preview-surface iframe,
.preview-surface pre {
  min-height: 280px;
}

.preview-surface pre {
  margin: 0;
  padding: 16px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #ededed;
}

.preview-empty {
  min-height: 280px;
  display: grid;
  place-items: center;
  color: #c7c7c7;
}

.preview-meta {
  margin: 0;
  display: grid;
  gap: 10px;
}

.preview-meta div {
  display: grid;
  gap: 4px;
}

.preview-meta dt {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #b3b3b3;
}

.preview-meta dd {
  margin: 0;
}

@media (max-width: 1080px) {
  .files-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .files-header,
  .panel-heading,
  .pending-card,
  .file-card {
    grid-template-columns: 1fr;
  }

  .files-header {
    flex-direction: column;
  }
}
</style>
