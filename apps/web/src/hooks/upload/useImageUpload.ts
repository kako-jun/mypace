import { useState } from 'react'
import { uploadImage } from '../../lib/api'

interface UploadFileResult {
  url: string | null
  error: string | null
}

interface UseImageUploadResult {
  uploading: boolean
  uploadFile: (file: File) => Promise<UploadFileResult>
}

export function useImageUpload(): UseImageUploadResult {
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File): Promise<UploadFileResult> => {
    setUploading(true)

    const result = await uploadImage(file)
    setUploading(false)

    if (result.success && result.url) {
      return { url: result.url, error: null }
    } else {
      return { url: null, error: result.error || 'Failed to upload' }
    }
  }

  return { uploading, uploadFile }
}
