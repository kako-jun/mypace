import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Input, CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import DeleteConfirmDialog from '../post/DeleteConfirmDialog'
import '../../styles/components/image-picker.css'
import {
  getStickerHistory,
  saveStickerToHistory,
  deleteStickerFromHistory,
  type StickerHistoryItem,
} from '../../lib/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { useImageUpload, useDragDrop } from '../../hooks'
import { ImageEditor } from '../image'
import { isAnimatedImage } from '../../lib/utils'

interface ImagePickerProps {
  onEmbed: (url: string) => void
  onAddSticker: (sticker: { url: string }) => void
  onError?: (error: string) => void
}

export function ImagePicker({ onEmbed, onAddSticker, onError }: ImagePickerProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState('')
  const [history, setHistory] = useState<StickerHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletePopupPosition, setDeletePopupPosition] = useState<{ top: number; left: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploading, uploadFile } = useImageUpload()

  // Fetch history when popup opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      getStickerHistory(30)
        .then(setHistory)
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  // Close delete popup on scroll
  useEffect(() => {
    if (confirmDelete) {
      const handleScroll = () => handleDeleteCancel()
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [confirmDelete])

  // Reset state when closing
  const handleClose = () => {
    setIsOpen(false)
    setSelectedUrl('')
  }

  const handleEmbed = async () => {
    if (!selectedUrl.trim()) return
    const url = selectedUrl.trim()
    onEmbed(url)
    const pubkey = await getCurrentPubkey()
    saveStickerToHistory(url, pubkey)
    handleClose()
  }

  const handleSticker = async () => {
    if (!selectedUrl.trim()) return
    const url = selectedUrl.trim()
    onAddSticker({ url })
    const pubkey = await getCurrentPubkey()
    saveStickerToHistory(url, pubkey)
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedUrl.trim()) {
      e.preventDefault()
      // Default to embed on Enter
      handleEmbed()
    }
  }

  const handleDelete = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setDeletePopupPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    })
    setConfirmDelete(url)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    handleDeleteCancel()
    const success = await deleteStickerFromHistory(confirmDelete)
    if (success) {
      setHistory((prev) => prev.filter((s) => s.url !== confirmDelete))
    }
  }

  const handleDeleteCancel = () => {
    setConfirmDelete(null)
    setDeletePopupPosition(null)
  }

  const handleHistoryClick = (url: string) => {
    setSelectedUrl(url)
  }

  const handleFileSelect = async (file: File) => {
    // Only show cropper for images, not videos
    if (file.type.startsWith('image/')) {
      // Skip cropper for animated images to preserve animation
      const isAnimated = await isAnimatedImage(file)
      if (isAnimated) {
        const result = await uploadFile(file)
        if (result.url) {
          setSelectedUrl(result.url)
        } else if (result.error && onError) {
          onError(result.error)
        }
      } else {
        setPendingFile(file)
      }
    } else {
      // Video or other file types - upload directly
      const result = await uploadFile(file)
      if (result.url) {
        setSelectedUrl(result.url)
      } else if (result.error && onError) {
        onError(result.error)
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleFileSelect(file)
  }

  const { dragging, handlers } = useDragDrop(handleFileSelect)

  const handleCropComplete = async (croppedFile: File) => {
    setPendingFile(null)
    const result = await uploadFile(croppedFile)
    if (result.url) {
      setSelectedUrl(result.url)
    } else if (result.error && onError) {
      onError(result.error)
    }
  }

  const handleCropCancel = () => {
    setPendingFile(null)
  }

  return (
    <div className="image-picker">
      <button type="button" className="image-picker-toggle" onClick={() => setIsOpen(!isOpen)} title="Add image">
        <img src="/icons/kiss.webp" alt="Image" className="image-picker-toggle-icon" />
      </button>

      {isOpen && (
        <Portal>
          <div className="image-picker-backdrop" onClick={handleClose}>
            <div className="image-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="image-picker-header">
                <h3>Select Image</h3>
                <CloseButton onClick={handleClose} size={20} />
              </div>

              {/* Upload area */}
              <div className="image-picker-upload-section">
                <button
                  type="button"
                  className={`image-picker-upload-area ${dragging ? 'dragging' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handlers.onDragOver}
                  onDragLeave={handlers.onDragLeave}
                  onDrop={handlers.onDrop}
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="image-picker-uploading">Uploading...</span>
                  ) : (
                    <>
                      <Icon name="Upload" size={24} />
                      <span>Click or drag to upload</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* URL input */}
              <div className="image-picker-url-section">
                <Icon name="Image" size={16} className="image-picker-url-icon" />
                <Input
                  value={selectedUrl}
                  onChange={setSelectedUrl}
                  onKeyDown={handleKeyDown}
                  placeholder="Image URL..."
                  className="image-picker-url-input"
                />
              </div>

              {/* Preview */}
              {selectedUrl && (
                <div className="image-picker-preview">
                  <img src={selectedUrl} alt="Preview" />
                </div>
              )}

              {/* History grid */}
              <div className="image-picker-grid">
                {loading && history.length === 0 && <div className="image-picker-loading">Loading...</div>}
                {!loading && history.length === 0 && (
                  <div className="image-picker-empty">No images yet. Upload one above!</div>
                )}
                {history.map((item) => (
                  <div key={item.url} className="image-picker-item-wrapper">
                    <button
                      type="button"
                      className={`image-picker-item ${selectedUrl === item.url ? 'selected' : ''}`}
                      onClick={() => handleHistoryClick(item.url)}
                    >
                      <img src={item.url} alt="history" />
                    </button>
                    <button
                      type="button"
                      className="image-picker-delete"
                      onClick={(e) => handleDelete(e, item.url)}
                      title="Delete"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="image-picker-actions">
                <button
                  type="button"
                  className="image-picker-history-btn"
                  onClick={() => {
                    handleClose()
                    navigate('/upload-history')
                  }}
                  title="Manage uploads"
                >
                  <Icon name="History" size={18} />
                </button>
                <div className="image-picker-actions-right">
                  <Button size="md" variant="secondary" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button size="md" variant="primary" onClick={handleEmbed} disabled={!selectedUrl.trim()}>
                    Embed
                  </Button>
                  <Button size="md" variant="primary" onClick={handleSticker} disabled={!selectedUrl.trim()}>
                    Sticker
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {pendingFile && <ImageEditor file={pendingFile} onComplete={handleCropComplete} onCancel={handleCropCancel} />}
      {confirmDelete && deletePopupPosition && (
        <DeleteConfirmDialog
          position={deletePopupPosition}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  )
}
