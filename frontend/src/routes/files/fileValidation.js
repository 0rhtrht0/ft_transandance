export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export const SUPPORTED_FILE_DEFINITIONS = [
  { extension: '.png', mime: 'image/png', category: 'image', previewKind: 'image' },
  { extension: '.jpg', mime: 'image/jpeg', category: 'image', previewKind: 'image' },
  { extension: '.jpeg', mime: 'image/jpeg', category: 'image', previewKind: 'image' },
  { extension: '.gif', mime: 'image/gif', category: 'image', previewKind: 'image' },
  { extension: '.webp', mime: 'image/webp', category: 'image', previewKind: 'image' },
  { extension: '.pdf', mime: 'application/pdf', category: 'document', previewKind: 'pdf' },
  { extension: '.txt', mime: 'text/plain', category: 'document', previewKind: 'text' },
  { extension: '.md', mime: 'text/markdown', category: 'document', previewKind: 'text' }
]

const supportedByExtension = new Map(
  SUPPORTED_FILE_DEFINITIONS.map((entry) => [entry.extension, entry])
)

const getExtension = (filename) => {
  const raw = String(filename || '').trim().toLowerCase()
  const match = raw.match(/\.[a-z0-9]+$/)
  return match ? match[0] : ''
}

export const FILE_INPUT_ACCEPT = SUPPORTED_FILE_DEFINITIONS.map((entry) => entry.extension).join(',')

export const formatFileSize = (value) => {
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const resolveClientPreviewKind = (fileLike) => {
  const extension = getExtension(fileLike?.name || fileLike?.original_name)
  return supportedByExtension.get(extension)?.previewKind || 'generic'
}

export const validateSelectedFiles = (files) => {
  const validFiles = []
  const errors = []

  for (const file of Array.from(files || [])) {
    const extension = getExtension(file?.name)
    const definition = supportedByExtension.get(extension)
    if (!definition) {
      errors.push(`${file?.name || 'Unknown file'}: unsupported file format.`)
      continue
    }

    const fileType = String(file?.type || '').trim().toLowerCase()
    if (fileType && fileType !== definition.mime) {
      errors.push(`${file.name}: unsupported file type.`)
      continue
    }

    const size = Number(file?.size) || 0
    if (size <= 0) {
      errors.push(`${file.name}: empty file upload is not allowed.`)
      continue
    }
    if (size > MAX_UPLOAD_SIZE_BYTES) {
      errors.push(`${file.name}: file exceeds the 10 MB limit.`)
      continue
    }

    validFiles.push({
      file,
      category: definition.category,
      previewKind: definition.previewKind,
      sizeLabel: formatFileSize(size)
    })
  }

  return { validFiles, errors }
}
