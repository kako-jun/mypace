import { createNip98AuthEvent } from '../nostr/events'
import { getErrorMessage } from '../utils'
import { LIMITS } from '../constants'

const UPLOAD_URL = 'https://nostr.build/api/v2/upload/files'

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
