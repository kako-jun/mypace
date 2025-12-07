import { useRef } from 'hono/jsx'
import { useImageUpload, useDragDrop } from '../../hooks'

interface ImageDropZoneProps {
  onImageUploaded: (url: string) => void
  onError?: (error: string) => void
}

export default function ImageDropZone({ onImageUploaded, onError }: ImageDropZoneProps) {
  const { uploading, uploadFile } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processUpload = async (file: File) => {
    const result = await uploadFile(file)
    if (result.url) {
      onImageUploaded(result.url)
    } else if (result.error && onError) {
      onError(result.error)
    }
  }

  const { dragging, handlers } = useDragDrop(processUpload)

  const handleFileChange = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    await processUpload(file)
    input.value = ''
  }

  return (
    <>
      <button
        type="button"
        class={`image-drop-area ${dragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handlers.onDragOver}
        onDragLeave={handlers.onDragLeave}
        onDrop={handlers.onDrop}
        aria-label="Upload image"
        disabled={uploading}
      >
        {uploading ? '...' : dragging ? 'Drop' : '📷'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </>
  )
}
