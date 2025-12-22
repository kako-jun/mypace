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

// Snap threshold in percentage
const SNAP_THRESHOLD = 3

// Initial crop: full image
const INITIAL_CROP: Crop = {
  unit: '%',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}

export function ImageCropper({ file, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP)
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Load image when file changes
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImageSrc(reader.result as string)
    reader.readAsDataURL(file)
    // Reset crop when file changes
    setCrop(INITIAL_CROP)
  }, [file])

  // Snap crop to edges
  const snapCrop = useCallback((c: Crop): Crop => {
    const snapped = { ...c }

    // Snap left edge
    if (c.x < SNAP_THRESHOLD) {
      snapped.x = 0
    }
    // Snap top edge
    if (c.y < SNAP_THRESHOLD) {
      snapped.y = 0
    }
    // Snap right edge
    if (c.x + c.width > 100 - SNAP_THRESHOLD) {
      snapped.width = 100 - snapped.x
    }
    // Snap bottom edge
    if (c.y + c.height > 100 - SNAP_THRESHOLD) {
      snapped.height = 100 - snapped.y
    }

    return snapped
  }, [])

  const handleCropChange = useCallback(
    (c: Crop) => {
      setCrop(snapCrop(c))
    },
    [snapCrop]
  )

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
            onChange={handleCropChange}
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

        <div className="image-cropper-hint">Drag to select area. Edges snap automatically.</div>

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
