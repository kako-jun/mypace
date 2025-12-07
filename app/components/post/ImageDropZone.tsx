import { useState, useRef } from 'hono/jsx'
import { useImageUpload } from '../../hooks'

interface ImageDropZoneProps {
  onImageUploaded: (url: string) => void
  onError?: (error: string) => void
}

export default function ImageDropZone({ onImageUploaded, onError }: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const { uploading, error, uploadFile, clearError } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    const file = files[0]
    const url = await uploadFile(file)
    if (url) {
      onImageUploaded(url)
    } else if (error && onError) {
      onError(error)
    }
  }

  const handleFileChange = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const url = await uploadFile(file)
    if (url) {
      onImageUploaded(url)
    } else if (error && onError) {
      onError(error)
    }
    input.value = ''
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <div
        class={`image-drop-area ${dragging ? 'dragging' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {uploading ? '...' : dragging ? 'Drop' : '📷'}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  )
}
