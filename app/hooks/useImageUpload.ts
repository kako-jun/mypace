import { useState } from 'hono/jsx'
import { uploadImage } from '../lib/upload'

interface UseImageUploadResult {
  uploading: boolean
  error: string
  uploadFile: (file: File) => Promise<string | null>
  clearError: () => void
}

export function useImageUpload(): UseImageUploadResult {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return null
    }

    setUploading(true)
    setError('')

    const result = await uploadImage(file)
    setUploading(false)

    if (result.success && result.url) {
      return result.url
    } else {
      setError(result.error || 'Failed to upload')
      return null
    }
  }

  const clearError = () => setError('')

  return { uploading, error, uploadFile, clearError }
}
