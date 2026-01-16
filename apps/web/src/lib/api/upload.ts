import { createNip98AuthEvent } from '../nostr/events'
import { getErrorMessage } from '../utils'
import { LIMITS } from '../constants'

const UPLOAD_URL = 'https://nostr.build/api/v2/upload/files'
const DELETE_API_BASE = 'https://nostr.build/api/v2/nip96/upload'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

interface NostrBuildResponse {
  status: string
  message?: string
  data?: Array<{ url?: string }>
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const isAudio = file.type.startsWith('audio/')

  // Validate file type
  if (!isImage && !isVideo && !isAudio) {
    return { success: false, error: 'Please select an image, video, or audio file' }
  }

  // Validate file size
  const maxSize = isVideo ? LIMITS.MAX_VIDEO_SIZE : isAudio ? LIMITS.MAX_AUDIO_SIZE : LIMITS.MAX_IMAGE_SIZE
  const sizeLabel = isVideo ? '10MB' : isAudio ? '1MB' : '10MB'
  if (file.size > maxSize) {
    return { success: false, error: `File must be less than ${sizeLabel}` }
  }

  try {
    // Create NIP-98 auth event
    const authEvent = await createNip98AuthEvent(UPLOAD_URL, 'POST')
    const authHeader = btoa(JSON.stringify(authEvent))

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Nostr ${authHeader}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Upload response:', text)
      throw new Error('Upload failed')
    }

    const data = (await response.json()) as NostrBuildResponse
    if (data.status === 'success' && data.data?.[0]?.url) {
      return { success: true, url: data.data[0].url }
    } else {
      throw new Error(data.message || 'Invalid response from server')
    }
  } catch (e) {
    return { success: false, error: getErrorMessage(e, 'Failed to upload') }
  }
}

/**
 * Extract SHA-256 hash from nostr.build URL
 * URL format: https://image.nostr.build/<hash>.<ext> or https://nostr.build/i/<hash>.<ext>
 */
function extractHashFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Get the last path segment (e.g., "abc123.png")
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    if (!filename) return null

    // Remove extension to get hash
    const hash = filename.replace(/\.[^.]+$/, '')

    // Validate it looks like a SHA-256 hash (64 hex characters)
    if (/^[a-f0-9]{64}$/i.test(hash)) {
      return hash
    }
    return null
  } catch {
    return null
  }
}

export interface DeleteResult {
  success: boolean
  error?: string
  message?: string
}

export async function deleteFromNostrBuild(url: string): Promise<DeleteResult> {
  const hash = extractHashFromUrl(url)
  if (!hash) {
    return { success: false, error: 'Could not extract file hash from URL' }
  }

  const deleteUrl = `${DELETE_API_BASE}/${hash}`

  try {
    // Create NIP-98 auth event for DELETE
    const authEvent = await createNip98AuthEvent(deleteUrl, 'DELETE')
    const authHeader = btoa(JSON.stringify(authEvent))

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Nostr ${authHeader}`,
      },
    })

    if (response.status === 403) {
      return { success: false, error: '403: Permission denied' }
    }
    if (response.status === 404) {
      return { success: false, error: '404: File not found' }
    }
    if (response.status === 401) {
      return { success: false, error: '401: Unauthorized' }
    }

    if (response.ok) {
      return { success: true, message: 'File deleted successfully' }
    }

    return { success: false, error: `Delete failed with status ${response.status}` }
  } catch (e) {
    return { success: false, error: getErrorMessage(e, 'Failed to delete') }
  }
}
