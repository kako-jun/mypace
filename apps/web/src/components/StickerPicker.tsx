import { useState } from 'react'
import { Icon } from './ui'

interface StickerPickerProps {
  onAddSticker: (sticker: { url: string }) => void
}

// SVG data URL stickers (guaranteed to work)
const SAMPLE_STICKERS = [
  {
    id: 'new',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ff3333" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="28" font-weight="bold">NEW</text></svg>'
      ),
    name: 'NEW',
  },
  {
    id: 'sale',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ffcc00" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="#333" font-size="26" font-weight="bold">SALE</text></svg>'
      ),
    name: 'SALE',
  },
  {
    id: 'limited',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#3366ff" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="28" font-weight="bold">限定</text></svg>'
      ),
    name: '限定',
  },
  {
    id: 'hot',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ff6600" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="28" font-weight="bold">HOT</text></svg>'
      ),
    name: 'HOT',
  },
  {
    id: 'recommended',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#22cc66" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">おすすめ</text></svg>'
      ),
    name: 'おすすめ',
  },
  {
    id: 'important',
    url:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#cc33ff" width="100" height="100" rx="10"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="28" font-weight="bold">重要</text></svg>'
      ),
    name: '重要',
  },
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
