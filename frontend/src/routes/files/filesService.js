import { getApiBase } from '../../utils/runtimeEndpoints.js'
import { clearSessionAndNotify, getStoredToken } from '../auth/auth_storage.js'
import { requestJson } from '../friends/services/httpClient.js'

const buildAuthHeaders = () => {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const parseJsonSafe = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const listManagedFiles = async () => {
  const data = await requestJson('/api/files')
  return Array.isArray(data?.files) ? data.files : []
}

export const deleteManagedFile = async (fileId) => {
  return requestJson(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE'
  })
}

export const fetchManagedFileTextPreview = async (previewUrl) => {
  const response = await fetch(resolveManagedFileUrl(previewUrl), {
    credentials: 'include',
    headers: buildAuthHeaders()
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearSessionAndNotify()
    }
    throw new Error(`Unable to preview the selected file (${response.status}).`)
  }

  return response.text()
}

export const uploadManagedFiles = (files, onProgress = () => {}) =>
  new Promise((resolve, reject) => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${getApiBase()}/api/files`)
    xhr.withCredentials = true

    const headers = buildAuthHeaders()
    for (const [header, value] of Object.entries(headers)) {
      xhr.setRequestHeader(header, value)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      onProgress(progress)
    }

    xhr.onerror = () => reject(new Error('Network error while uploading files.'))
    xhr.onload = () => {
      const payload = parseJsonSafe(xhr.responseText)
      if (xhr.status === 401) {
        clearSessionAndNotify()
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(typeof payload?.detail === 'string' ? payload.detail : `Upload failed (${xhr.status}).`))
        return
      }
      onProgress(100)
      resolve(payload)
    }

    xhr.send(formData)
  })

export const resolveManagedFileUrl = (path) => {
  const raw = String(path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return `${getApiBase()}${normalized}`
}
