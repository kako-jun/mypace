import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import { PostStickers } from '../post/PostStickers'
import { getStickerHistory, type StickerHistoryItem } from '../../lib/api'
import type { Sticker, StickerQuadrant } from '../../types'
import '../../styles/components/image-editor.css'

interface ImageEditorProps {
  file: File
  onComplete: (editedFile: File) => void
  onCancel: () => void
}

export function ImageEditor({ file, onComplete, onCancel }: ImageEditorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Store original filename to preserve it through async operations
  const originalFilename = useRef(file.name)
  const originalFileType = useRef(file.type)

  // Crop state
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Sticker state
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [stickerHistory, setStickerHistory] = useState<StickerHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Processing state
  const [processing, setProcessing] = useState(false)

  // Create object URL for file
  useEffect(() => {
    setImageLoaded(false)
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Load sticker history on mount
  useEffect(() => {
    setHistoryLoading(true)
    getStickerHistory(30)
      .then(setStickerHistory)
      .finally(() => setHistoryLoading(false))
  }, [])

  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c)
  }, [])

  // Add sticker
  const handleAddSticker = (url: string) => {
    const newSticker: Sticker = {
      url,
      x: 50,
      y: 50,
      size: 25,
      rotation: 0,
      quadrant: 'top-left',
    }
    setStickers((prev) => [...prev, newSticker])
  }

  // Sticker callbacks
  const handleStickerMove = useCallback((index: number, x: number, y: number, quadrant: StickerQuadrant) => {
    setStickers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], x, y, quadrant }
      return updated
    })
  }, [])

  const handleStickerResize = useCallback((index: number, size: number) => {
    setStickers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], size }
      return updated
    })
  }, [])

  const handleStickerRotate = useCallback((index: number, rotation: number) => {
    setStickers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], rotation }
      return updated
    })
  }, [])

  const handleStickerRemove = useCallback((index: number) => {
    setStickers((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Convert sticker position to global percentage
  const getGlobalPosition = (sticker: Sticker): { x: number; y: number } => {
    const halfX = (sticker.x / 100) * 50
    const halfY = (sticker.y / 100) * 50

    switch (sticker.quadrant) {
      case 'top-left':
        return { x: halfX, y: halfY }
      case 'top-right':
        return { x: 100 - halfX, y: halfY }
      case 'bottom-left':
        return { x: halfX, y: 100 - halfY }
      case 'bottom-right':
        return { x: 100 - halfX, y: 100 - halfY }
      default:
        return { x: sticker.x, y: sticker.y }
    }
  }

  // Confirm and composite
  const handleConfirm = useCallback(async () => {
    const image = imgRef.current
    if (!image) return

    setProcessing(true)
    // Wait for UI to update before heavy canvas work
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Determine crop area
    let cropX = 0
    let cropY = 0
    let cropW = image.naturalWidth
    let cropH = image.naturalHeight

    if (completedCrop) {
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      const isFullImage =
        completedCrop.x <= 1 &&
        completedCrop.y <= 1 &&
        Math.abs(completedCrop.width - image.width) <= 2 &&
        Math.abs(completedCrop.height - image.height) <= 2

      if (!isFullImage) {
        cropX = completedCrop.x * scaleX
        cropY = completedCrop.y * scaleY
        cropW = completedCrop.width * scaleX
        cropH = completedCrop.height * scaleY
      }
    }

    canvas.width = cropW
    canvas.height = cropH

    // Draw cropped image
    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    // Draw stickers
    for (const sticker of stickers) {
      try {
        // Fetch as blob to bypass CORS for canvas
        const response = await fetch(sticker.url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)

        const stickerImg = new Image()
        await new Promise<void>((resolve, reject) => {
          stickerImg.onload = () => resolve()
          stickerImg.onerror = () => reject()
          stickerImg.src = blobUrl
        })

        const globalPos = getGlobalPosition(sticker)
        const centerX = (globalPos.x / 100) * image.naturalWidth - cropX
        const centerY = (globalPos.y / 100) * image.naturalHeight - cropY
        const sw = (sticker.size / 100) * image.naturalWidth
        const sh = (sw * stickerImg.naturalHeight) / stickerImg.naturalWidth

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate((sticker.rotation * Math.PI) / 180)
        ctx.drawImage(stickerImg, -sw / 2, -sh / 2, sw, sh)
        ctx.restore()

        URL.revokeObjectURL(blobUrl)
      } catch {
        // Skip stickers that fail to load
        console.warn('Failed to load sticker:', sticker.url)
      }
    }

    const fileType = originalFileType.current || 'image/png'
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const editedFile = new File([blob], originalFilename.current, { type: fileType })
          onComplete(editedFile)
        }
      },
      fileType,
      0.95
    )
  }, [completedCrop, stickers, onComplete])

  // No stickers and no crop = use original
  const handleConfirmWrapper = useCallback(async () => {
    if (stickers.length === 0) {
      if (!completedCrop) {
        onComplete(file)
        return
      }
      const image = imgRef.current
      if (image) {
        const isFullImage =
          completedCrop.x <= 1 &&
          completedCrop.y <= 1 &&
          Math.abs(completedCrop.width - image.width) <= 2 &&
          Math.abs(completedCrop.height - image.height) <= 2
        if (isFullImage) {
          onComplete(file)
          return
        }
      }
    }
    await handleConfirm()
  }, [stickers.length, completedCrop, file, onComplete, handleConfirm])

  return (
    <Portal>
      <div className="image-editor-backdrop" onClick={onCancel}>
        <div className="image-editor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="image-editor-header">
            <h3>Edit Image</h3>
            <CloseButton onClick={onCancel} size={20} />
          </div>

          {!imageLoaded && <div className="image-editor-loading">Loading...</div>}

          <div className="image-editor-content" style={{ display: imageLoaded ? 'flex' : 'none' }}>
            {imageSrc && (
              <div className="image-editor-canvas-area">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={handleCropComplete}
                  className="image-editor-react-crop"
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Edit preview"
                    className="image-editor-image"
                    onLoad={() => {
                      requestAnimationFrame(() => {
                        setCrop({
                          unit: '%',
                          x: 0,
                          y: 0,
                          width: 100,
                          height: 100,
                        })
                        setImageLoaded(true)
                      })
                    }}
                  />
                </ReactCrop>
                {/* Stickers overlay on top of crop */}
                <PostStickers
                  stickers={stickers}
                  editable={true}
                  onStickerMove={handleStickerMove}
                  onStickerResize={handleStickerResize}
                  onStickerRotate={handleStickerRotate}
                  onStickerRemove={handleStickerRemove}
                />
              </div>
            )}
          </div>

          {/* Sticker palette */}
          {imageLoaded && (
            <div className="image-editor-sticker-palette">
              {historyLoading && <span className="image-editor-palette-loading">...</span>}
              {!historyLoading && stickerHistory.length === 0 && (
                <span className="image-editor-palette-empty">No stickers</span>
              )}
              {stickerHistory.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  className="image-editor-palette-item"
                  onClick={() => handleAddSticker(item.url)}
                >
                  <img src={item.url} alt="" />
                </button>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {processing && (
            <div className="image-editor-progress">
              <span className="image-editor-progress-text">Processing...</span>
            </div>
          )}

          <div className="image-editor-footer">
            <Button size="md" variant="secondary" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button size="md" variant="primary" onClick={handleConfirmWrapper} disabled={!imageLoaded || processing}>
              {processing ? 'Processing...' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
