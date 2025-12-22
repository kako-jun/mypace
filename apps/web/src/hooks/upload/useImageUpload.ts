import { useState } from 'react'
import { uploadImage, saveUploadToHistory } from '../../lib/api'
import { getCurrentPubkey } from '../../lib/nostr/events'

interface UploadFileResult {
  url: string | null
  error: string | null
}

interface UseImageUploadResult {
  uploading: boolean
  uploadFile: (file: File) => Promise<UploadFileResult>
}

function getUploadType(mimeType: string): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'image'
}

export function useImageUpload(): UseImageUploadResult {
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File): Promise<UploadFileResult> => {
    setUploading(true)

    const result = await uploadImage(file)
    setUploading(false)

    if (result.success && result.url) {
      // Save to upload history (D1) for later deletion if needed
      try {
        const pubkey = await getCurrentPubkey()
        saveUploadToHistory(pubkey, result.url, file.name, getUploadType(file.type))
      } catch {
        // Silently fail - upload still succeeded
      }
      return { url: result.url, error: null }
    } else {
      return { url: null, error: result.error || 'Failed to upload' }
    }
  }

  return { uploading, uploadFile }
}
