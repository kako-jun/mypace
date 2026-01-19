import { createPortal } from 'react-dom'
import { CloseButton, Icon } from '../ui'
import { STELLA_COLORS, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'

interface StellaColorPickerProps {
  position: { top: number; left: number }
  walletBalance: number | null // sats balance from wallet, null if not connected
  currentCounts: StellaCountsByColor // Current stella counts for this post
  onAddStella: (color: StellaColor) => void
  onClose: (e?: React.MouseEvent) => void
}

// Colors in display order
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function StellaColorPicker({
  position,
  walletBalance,
  currentCounts,
  onAddStella,
  onClose,
}: StellaColorPickerProps) {
  const handleClick = (color: StellaColor) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddStella(color)
    // Don't close - allow rapid clicking
  }

  const canAfford = (color: StellaColor): boolean => {
    if (color === 'yellow') return true // Yellow is always free
    if (walletBalance === null) return false // Wallet not connected
    return walletBalance >= STELLA_COLORS[color].sats
  }

  // Calculate total stella given
  const totalStella = Object.values(currentCounts).reduce((a, b) => a + b, 0)
  const maxReached = totalStella >= 10

  return createPortal(
    <>
      <div className="stella-picker-overlay" onClick={onClose} />
      <div
        className="stella-picker"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stella-picker-header">
          <span className="stella-picker-title">Add Stella</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>

        {/* 5 colored stars in a row */}
        <div className="stella-picker-stars">
          {COLOR_ORDER.map((color) => {
            const colorInfo = STELLA_COLORS[color]
            const count = currentCounts[color]
            const affordable = canAfford(color)
            const disabled = maxReached || !affordable

            return (
              <button
                key={color}
                className={`stella-picker-star-btn ${disabled ? 'disabled' : ''} ${count > 0 ? 'has-count' : ''}`}
                onClick={handleClick(color)}
                disabled={disabled}
                title={`${colorInfo.label} (${colorInfo.sats === 0 ? 'Free' : `${colorInfo.sats} sats`})`}
              >
                <Icon name="Star" size={24} fill={colorInfo.hex} />
                {count > 0 && <span className="stella-picker-star-count">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Info row */}
        <div className="stella-picker-info">
          <span className="stella-picker-total">Total: {totalStella}/10</span>
          {walletBalance !== null && (
            <span className="stella-picker-balance">{walletBalance.toLocaleString()} sats</span>
          )}
        </div>

        {walletBalance === null && <div className="stella-picker-hint">Connect wallet for colored stella</div>}
      </div>
    </>,
    document.body
  )
}
