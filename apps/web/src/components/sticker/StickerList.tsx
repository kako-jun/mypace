import type { Sticker } from '../../types'

interface StickerListProps {
  stickers: Sticker[]
  onRemove: (index: number) => void
}

export function StickerList({ stickers, onRemove }: StickerListProps) {
  if (stickers.length === 0) return null

  return (
    <div className="sticker-list">
      <div className="sticker-list-label">Stickers ({stickers.length})</div>
      <div className="sticker-list-items">
        {stickers.map((sticker, index) => (
          <div key={index} className="sticker-list-item">
            <img src={sticker.url} alt={`Sticker ${index + 1}`} />
            <button type="button" className="sticker-list-remove" onClick={() => onRemove(index)} title="Remove">
              ×
            </button>
            <div className="sticker-list-info">
              <span>
                {Math.round(sticker.x)}%, {Math.round(sticker.y)}%
              </span>
              <span>
                {Math.round(sticker.size)}% / {Math.round(sticker.rotation)}°
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
