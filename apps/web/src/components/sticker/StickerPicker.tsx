import { useState, useEffect, useRef } from 'react'
import { Icon, Input, CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import '../../styles/components/sticker-picker.css'
import {
  getStickerHistory,
  saveStickerToHistory,
  deleteStickerFromHistory,
  type StickerHistoryItem,
} from '../../lib/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { useImageUpload } from '../../hooks'
import { ImageCropper } from '../image'
import { isAnimatedImage } from '../../lib/utils'

interface StickerPickerProps {
  onAddSticker: (sticker: { url: string }) => void
}

export function StickerPicker({ onAddSticker }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [history, setHistory] = useState<StickerHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
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

  const handleSelectSticker = async (url: string) => {
    if (!url.trim()) return
    const trimmedUrl = url.trim()
    onAddSticker({ url: trimmedUrl })
    const pubkey = await getCurrentPubkey()
    saveStickerToHistory(trimmedUrl, pubkey)
    setIsOpen(false)
    setCustomUrl('')
  }

  const handleCustomAdd = () => {
    handleSelectSticker(customUrl)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customUrl.trim()) {
      e.preventDefault()
      handleCustomAdd()
    }
  }

  const handleDelete = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    const success = await deleteStickerFromHistory(url)
    if (success) {
      setHistory((prev) => prev.filter((s) => s.url !== url))
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Skip cropper for animated images to preserve animation
    const isAnimated = await isAnimatedImage(file)
    if (isAnimated) {
      const result = await uploadFile(file)
      if (result.url) {
        handleSelectSticker(result.url)
      }
    } else {
      setPendingFile(file)
    }
  }

  const handleCropComplete = async (croppedFile: File) => {
    setPendingFile(null)
    const result = await uploadFile(croppedFile)
    if (result.url) {
      handleSelectSticker(result.url)
    }
  }

  const handleCropCancel = () => {
    setPendingFile(null)
  }

  return (
    <div className="sticker-picker">
      <button type="button" className="sticker-picker-toggle" onClick={() => setIsOpen(!isOpen)} title="Add sticker">
        <img src="/icons/kiss.webp" alt="Sticker" className="sticker-picker-toggle-icon" />
      </button>

      {isOpen && (
        <Portal>
          <div className="sticker-picker-backdrop" onClick={() => setIsOpen(false)}>
            <div className="sticker-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sticker-picker-header">
                <h3>Select Sticker</h3>
                <CloseButton onClick={() => setIsOpen(false)} size={20} />
              </div>

              <div className="sticker-picker-custom">
                <div className="sticker-picker-input-row">
                  <Icon name="Image" size={16} className="sticker-picker-icon" />
                  <Input
                    value={customUrl}
                    onChange={setCustomUrl}
                    onKeyDown={handleKeyDown}
                    placeholder="Image URL..."
                    className="sticker-picker-input"
                  />
                </div>
                <Button size="sm" variant="primary" onClick={handleCustomAdd} disabled={!customUrl.trim()}>
                  Add
                </Button>
                <button
                  type="button"
                  className="sticker-picker-upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Upload from file"
                >
                  {uploading ? '...' : <Icon name="Upload" size={16} />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="sticker-picker-grid">
                {loading && history.length === 0 && <div className="sticker-picker-loading">Loading...</div>}
                {!loading && history.length === 0 && (
                  <div className="sticker-picker-empty">No stickers yet. Add one above!</div>
                )}
                {history.map((sticker) => (
                  <div key={sticker.url} className="sticker-picker-item-wrapper">
                    <button
                      type="button"
                      className="sticker-picker-item"
                      onClick={() => handleSelectSticker(sticker.url)}
                    >
                      <img src={sticker.url} alt="sticker" />
                    </button>
                    <button
                      type="button"
                      className="sticker-picker-delete"
                      onClick={(e) => handleDelete(e, sticker.url)}
                      title="Delete"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Portal>
      )}
      {pendingFile && (
        <ImageCropper file={pendingFile} onCropComplete={handleCropComplete} onCancel={handleCropCancel} />
      )}
    </div>
  )
}
