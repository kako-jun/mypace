import { useRef, useState } from 'react'
import { Icon } from '../ui'
import { useImageUpload, useDragDrop } from '../../hooks'
import { ImageCropper } from '../image'

interface ImageDropZoneProps {
  onImageUploaded: (url: string) => void
  onError?: (error: string) => void
}

export default function ImageDropZone({ onImageUploaded, onError }: ImageDropZoneProps) {
  const { uploading, uploadFile } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const processUpload = async (file: File) => {
    const result = await uploadFile(file)
    if (result.url) {
      onImageUploaded(result.url)
    } else if (result.error && onError) {
      onError(result.error)
    }
  }

  const handleFileSelect = (file: File) => {
    // Only show cropper for images, not videos
    if (file.type.startsWith('image/')) {
      setPendingFile(file)
    } else {
      processUpload(file)
    }
  }

  const handleCropComplete = async (croppedFile: File) => {
    setPendingFile(null)
    await processUpload(croppedFile)
  }

  const handleCropCancel = () => {
    setPendingFile(null)
  }

  const { dragging, handlers } = useDragDrop(handleFileSelect)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    handleFileSelect(file)
    input.value = ''
  }

  return (
    <div className="image-drop-zone">
      <button
        type="button"
        className={`drop-area ${dragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handlers.onDragOver}
        onDragLeave={handlers.onDragLeave}
        onDrop={handlers.onDrop}
        aria-label="Upload image"
        disabled={uploading}
      >
        {uploading ? '...' : dragging ? 'Drop' : <Icon name="Camera" size={16} />}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {pendingFile && (
        <ImageCropper file={pendingFile} onCropComplete={handleCropComplete} onCancel={handleCropCancel} />
      )}
    </div>
  )
}
