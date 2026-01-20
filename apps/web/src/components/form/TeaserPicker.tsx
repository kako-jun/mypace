import { CloseButton, Icon, Portal } from '../ui'
import { STELLA_COLORS, type StellaColor } from '../../lib/nostr/events'

interface TeaserPickerProps {
  selectedColor: StellaColor | null
  onSelect: (color: StellaColor | null) => void
  onClose: () => void
}

// Colors in display order (including yellow for free)
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function TeaserPicker({ selectedColor, onSelect, onClose }: TeaserPickerProps) {
  const handleSelect = (color: StellaColor) => {
    if (selectedColor === color) {
      // Deselect if already selected
      onSelect(null)
    } else {
      onSelect(color)
    }
  }

  return (
    <Portal>
      <div className="teaser-picker-backdrop" onClick={onClose}>
        <div className="teaser-picker" onClick={(e) => e.stopPropagation()}>
          <div className="teaser-picker-header">
            <span className="teaser-picker-title">Teaser</span>
            <CloseButton onClick={onClose} size={20} />
          </div>

          <div className="teaser-picker-stars">
            {COLOR_ORDER.map((color) => {
              const colorInfo = STELLA_COLORS[color]
              const isSelected = selectedColor === color

              return (
                <button
                  key={color}
                  type="button"
                  className={`teaser-picker-star ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(color)}
                >
                  <Icon name="Star" size={32} fill={colorInfo.hex} />
                </button>
              )
            })}
          </div>

          {selectedColor && (
            <button type="button" className="teaser-picker-clear" onClick={() => onSelect(null)}>
              <Icon name="X" size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </Portal>
  )
}
