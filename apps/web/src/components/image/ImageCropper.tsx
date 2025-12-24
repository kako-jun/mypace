import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import '../../styles/components/image-cropper.css'

interface ImageCropperProps {
  file: File
  onCropComplete: (croppedFile: File) => void
  onCancel: () => void
}

export function ImageCropper({ file, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Create object URL for file (faster than FileReader + base64)
  useEffect(() => {
    setImageLoaded(false)
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => URL.revokeObjectURL(url)
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

    // Check if crop covers the full image (no actual cropping)
    // Use a small tolerance for floating point comparison
    const isFullImage =
      completedCrop.x <= 1 &&
      completedCrop.y <= 1 &&
      Math.abs(completedCrop.width - image.width) <= 2 &&
      Math.abs(completedCrop.height - image.height) <= 2

    if (isFullImage) {
      // No cropping needed, preserve original (keeps animation for GIF/APNG/WEBP)
      onCropComplete(file)
      return
    }

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

  return (
    <Portal>
      <div className="image-cropper-backdrop" onClick={onCancel}>
        <div className="image-cropper-modal" onClick={(e) => e.stopPropagation()}>
          <div className="image-cropper-header">
            <h3>Crop Image</h3>
            <CloseButton onClick={onCancel} size={20} />
          </div>

          {!imageLoaded && <div className="image-cropper-loading">Loading...</div>}

          <div className="image-cropper-content" style={{ display: imageLoaded ? 'flex' : 'none' }}>
            {imageSrc && (
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
                  onLoad={() => {
                    // Use percentage-based crop for initial 100% selection
                    // This works correctly regardless of image layout timing
                    // react-image-crop will calculate correct pixel values via onComplete
                    setCrop({
                      unit: '%',
                      x: 0,
                      y: 0,
                      width: 100,
                      height: 100,
                    })
                    setImageLoaded(true)
                  }}
                />
              </ReactCrop>
            )}
          </div>

          {imageLoaded && <div className="image-cropper-hint">Drag to select crop area</div>}

          <div className="image-cropper-footer">
            <Button size="md" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="md" variant="primary" onClick={handleConfirm} disabled={!imageLoaded}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
