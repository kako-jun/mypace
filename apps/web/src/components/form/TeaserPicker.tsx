import { createPortal } from 'react-dom'
import { CloseButton, Icon } from '../ui'
import { STELLA_COLORS, type StellaColor } from '../../lib/nostr/events'

interface TeaserPickerProps {
  position: { top: number; left: number }
  selectedColor: StellaColor | null
  onSelect: (color: StellaColor | null) => void
  onClose: () => void
}

// Colors in display order (including yellow for free)
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function TeaserPicker({ position, selectedColor, onSelect, onClose }: TeaserPickerProps) {
  const handleSelect = (color: StellaColor) => {
    if (selectedColor === color) {
      // Deselect if already selected
      onSelect(null)
    } else {
      onSelect(color)
    }
  }

  return createPortal(
    <>
      <div className="teaser-picker-overlay" onClick={onClose} />
      <div
        className="teaser-picker"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="teaser-picker-header">
          <span className="teaser-picker-title">Teaser</span>
          <CloseButton onClick={onClose} size={16} />
        </div>

        <p className="teaser-picker-description">続きを読むにはステラが必要になります</p>

        <div className="teaser-picker-options">
          {COLOR_ORDER.map((color) => {
            const colorInfo = STELLA_COLORS[color]
            const isSelected = selectedColor === color

            return (
              <button
                key={color}
                className={`teaser-picker-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(color)}
              >
                <Icon name="Star" size={20} fill={colorInfo.hex} />
                <span className="teaser-picker-option-label">{colorInfo.label}</span>
                <span className="teaser-picker-option-sats">
                  {colorInfo.sats === 0 ? 'Free' : `${colorInfo.sats} sats`}
                </span>
                {isSelected && <Icon name="Check" size={16} className="teaser-picker-check" />}
              </button>
            )
          })}
        </div>

        {selectedColor && (
          <button className="teaser-picker-clear" onClick={() => onSelect(null)}>
            <Icon name="X" size={14} />
            <span>解除</span>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}
