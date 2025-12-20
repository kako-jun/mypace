import { useState, useEffect } from 'react'
import { Icon, Input, CloseButton } from '../ui'
import Button from '../ui/Button'
import { getStickerHistory, saveStickerToHistory, type StickerHistoryItem } from '../../lib/api'

interface StickerPickerProps {
  onAddSticker: (sticker: { url: string }) => void
}

export function StickerPicker({ onAddSticker }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [history, setHistory] = useState<StickerHistoryItem[]>([])
  const [loading, setLoading] = useState(false)

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
    saveStickerToHistory(trimmedUrl)
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

  return (
    <div className="sticker-picker">
      <button type="button" className="sticker-picker-toggle" onClick={() => setIsOpen(!isOpen)} title="Add sticker">
        <img src="/icons/kiss.webp" alt="Sticker" className="sticker-picker-toggle-icon" />
      </button>

      {isOpen && (
        <>
          <div className="sticker-picker-backdrop" onClick={() => setIsOpen(false)} />
          <div className="sticker-picker-modal">
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
            </div>

            <div className="sticker-picker-grid">
              {loading && history.length === 0 && <div className="sticker-picker-loading">Loading...</div>}
              {!loading && history.length === 0 && (
                <div className="sticker-picker-empty">No stickers yet. Add one above!</div>
              )}
              {history.map((sticker) => (
                <button
                  key={sticker.url}
                  type="button"
                  className="sticker-picker-item"
                  onClick={() => handleSelectSticker(sticker.url)}
                >
                  <img src={sticker.url} alt="sticker" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
