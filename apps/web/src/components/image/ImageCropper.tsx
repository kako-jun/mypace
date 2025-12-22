import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { CloseButton } from '../ui'
import Button from '../ui/Button'
import '../../styles/components/image-cropper.css'

interface ImageCropperProps {
  file: File
  onCropComplete: (croppedFile: File) => void
  onCancel: () => void
}

export function ImageCropper({ file, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Load image when file changes
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImageSrc(reader.result as string)
    reader.readAsDataURL(file)
  }, [file])

  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) {
      // No crop selected, use original
      onCropComplete(file)
      return
    }

    const image = imgRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate scale between displayed image and natural size
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    // Set canvas size to cropped area (natural size)
    canvas.width = completedCrop.width * scaleX
    canvas.height = completedCrop.height * scaleY

    // Draw cropped area
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], file.name, { type: file.type || 'image/png' })
          onCropComplete(croppedFile)
        }
      },
      file.type || 'image/png',
      0.95
    )
  }, [completedCrop, file, onCropComplete])

  if (!imageSrc) {
    return (
      <div className="image-cropper-backdrop">
        <div className="image-cropper-modal">
          <div className="image-cropper-loading">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="image-cropper-backdrop" onClick={onCancel}>
      <div className="image-cropper-modal" onClick={(e) => e.stopPropagation()}>
        <div className="image-cropper-header">
          <h3>Crop Image</h3>
          <CloseButton onClick={onCancel} size={20} />
        </div>

        <div className="image-cropper-content">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={handleCropComplete}
            className="image-cropper-react-crop"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="image-cropper-image"
              onLoad={(e) => {
                const img = e.currentTarget
                // Set initial completedCrop for full image
                setCompletedCrop({
                  unit: 'px',
                  x: 0,
                  y: 0,
                  width: img.width,
                  height: img.height,
                })
              }}
            />
          </ReactCrop>
        </div>

        <div className="image-cropper-hint">Drag to select crop area</div>

        <div className="image-cropper-footer">
          <Button size="md" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="md" variant="primary" onClick={handleConfirm}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
