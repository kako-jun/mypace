import { useState, useRef } from 'hono/jsx'
import { useImageUpload } from '../../hooks'

interface ImageDropZoneProps {
  onImageUploaded: (url: string) => void
  onError?: (error: string) => void
}

export default function ImageDropZone({ onImageUploaded, onError }: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false)
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

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    await processUpload(files[0])
  }

  const handleFileChange = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    await processUpload(file)
    input.value = ''
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <button
        type="button"
        class={`image-drop-area ${dragging ? 'dragging' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
