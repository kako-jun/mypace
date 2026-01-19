import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CloseButton, Icon } from '../ui'
import { STELLA_COLORS, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'
import { formatNumber } from '../../lib/utils'

interface StellaColorPickerProps {
  position: { top: number; left: number }
  walletBalance: number | null // sats balance from wallet, null if not connected
  currentCounts: StellaCountsByColor // Current stella counts for this post
  onAddStella: (color: StellaColor) => void
  onClose: (e?: React.MouseEvent) => void
  disabled?: boolean // Disable all buttons (for own posts)
}

// Colors in display order
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function StellaColorPicker({
  position,
  walletBalance,
  currentCounts,
  onAddStella,
  onClose,
  disabled = false,
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
            const isDisabled = disabled || maxReached || !affordable

            return (
              <button
                key={color}
                className={`stella-picker-star-btn ${isDisabled ? 'disabled' : ''} ${count > 0 ? 'has-count' : ''}`}
                onClick={handleClick(color)}
                disabled={isDisabled}
                title={`${colorInfo.label} (${colorInfo.sats === 0 ? 'Free' : `${colorInfo.sats} sats`})`}
              >
                <Icon name="Star" size={24} fill={colorInfo.hex} />
                {count > 0 && <span className="stella-picker-star-count">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Inventory info - show how many of each color can be purchased */}
        {walletBalance !== null && (
          <div className="stella-picker-inventory">
            <span className="stella-picker-inventory-label">Inventory:</span>
            {(['green', 'red', 'blue', 'purple'] as const).map((color) => {
              const colorInfo = STELLA_COLORS[color]
              const affordable = Math.floor(walletBalance / colorInfo.sats)
              if (affordable <= 0) return null
              return (
                <span key={color} className="stella-picker-inventory-item">
                  <Icon name="Star" size={14} fill={colorInfo.hex} />
                  <span>×{formatNumber(affordable)}</span>
                </span>
              )
            })}
          </div>
        )}

        {walletBalance === null && (
          <Link to="/inventory" className="stella-picker-hint stella-picker-link" onClick={() => onClose()}>
            Connect wallet for colored stella
          </Link>
        )}
      </div>
    </>,
    document.body
  )
}
