import { useState } from 'react'
import { Icon } from './ui'

interface StickerPickerProps {
  onAddSticker: (sticker: { url: string }) => void
}

// Sample stickers using Twemoji CDN (short URLs for Nostr relay compatibility)
const SAMPLE_STICKERS = [
  { id: 'fire', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f525.svg', name: '🔥' },
  { id: 'star', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/2b50.svg', name: '⭐' },
  { id: 'heart', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/2764.svg', name: '❤️' },
  { id: 'rocket', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f680.svg', name: '🚀' },
  { id: 'sparkles', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/2728.svg', name: '✨' },
  { id: 'party', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f389.svg', name: '🎉' },
  { id: 'hundred', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f4af.svg', name: '💯' },
  { id: 'eyes', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f440.svg', name: '👀' },
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

  const handleCustomAdd = () => {
    handleSelectSticker(customUrl)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customUrl.trim()) {
      e.preventDefault()
      handleCustomAdd()
    }
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
            <div className="sticker-picker-custom">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="画像URLを入力..."
                className="sticker-picker-input"
              />
              <button
                type="button"
                className="sticker-picker-add"
                onClick={handleCustomAdd}
                disabled={!customUrl.trim()}
              >
                追加
              </button>
            </div>

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
