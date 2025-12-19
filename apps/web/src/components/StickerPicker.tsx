import { useState } from 'react'
import { Icon } from './ui'

interface StickerPickerProps {
  onAddSticker: (sticker: { url: string }) => void
}

// サンプル画像
const SAMPLE_STICKERS = [
  { id: 'new', url: 'https://via.placeholder.com/150/ff0000/ffffff?text=NEW', name: 'NEW' },
  { id: 'sale', url: 'https://via.placeholder.com/150/ffff00/000000?text=SALE', name: 'SALE' },
  { id: 'limited', url: 'https://via.placeholder.com/150/0000ff/ffffff?text=限定', name: '限定' },
  { id: 'attention', url: 'https://via.placeholder.com/150/ff8800/ffffff?text=注目', name: '注目' },
  { id: 'discount', url: 'https://via.placeholder.com/150/00ff00/000000?text=100円引き', name: '100円引き' },
]

export function StickerPicker({ onAddSticker }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customUrl, setCustomUrl] = useState('')

  const handleSelectSticker = (url: string) => {
    if (!url.trim()) return
    onAddSticker({ url: url.trim() })
    setIsOpen(false)
    setCustomUrl('')
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSelectSticker(customUrl)
  }

  return (
    <div className="sticker-picker">
      <button type="button" className="sticker-picker-toggle" onClick={() => setIsOpen(!isOpen)} title="シールを貼る">
        <Icon name="Sticker" size={20} />
      </button>

      {isOpen && (
        <>
          <div className="sticker-picker-backdrop" onClick={() => setIsOpen(false)} />
          <div className="sticker-picker-modal">
            <div className="sticker-picker-header">
              <h3>シールを選択</h3>
              <button type="button" className="sticker-picker-close" onClick={() => setIsOpen(false)}>
                <Icon name="X" size={20} />
              </button>
            </div>

            {/* カスタムURL入力 */}
            <form className="sticker-picker-custom" onSubmit={handleCustomSubmit}>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="画像URLを入力..."
                className="sticker-picker-input"
              />
              <button type="submit" className="sticker-picker-add" disabled={!customUrl.trim()}>
                追加
              </button>
            </form>

            <div className="sticker-picker-divider">または</div>

            <div className="sticker-picker-grid">
              {SAMPLE_STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="sticker-picker-item"
                  onClick={() => handleSelectSticker(sticker.url)}
                >
                  <img src={sticker.url} alt={sticker.name} />
                  <span>{sticker.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
