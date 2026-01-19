import { createPortal } from 'react-dom'
import { CloseButton, Icon } from '../ui'
import { STELLA_COLORS, type StellaColor } from '../../lib/nostr/events'

interface StellaColorPickerProps {
  position: { top: number; left: number }
  walletBalance: number | null // sats balance from wallet, null if not connected
  onSelect: (color: StellaColor) => void
  onClose: (e?: React.MouseEvent) => void
}

// Colors in display order (yellow first, then by sats ascending)
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function StellaColorPicker({ position, walletBalance, onSelect, onClose }: StellaColorPickerProps) {
  const handleSelect = (color: StellaColor) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(color)
  }

  const canAfford = (color: StellaColor): boolean => {
    if (color === 'yellow') return true // Yellow is always free
    if (walletBalance === null) return false // Wallet not connected
    return walletBalance >= STELLA_COLORS[color].sats
  }

  return createPortal(
    <>
      <div className="stella-picker-overlay" onClick={onClose} />
      <div
        className="stella-picker"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stella-picker-header">
          <span className="stella-picker-title">ステラを付ける</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>
        <div className="stella-picker-options">
          {/* Yellow - always available */}
          <button className="stella-picker-option" onClick={handleSelect('yellow')}>
            <span className="stella-picker-star" style={{ color: STELLA_COLORS.yellow.hex }}>
              <Icon name="Star" size={16} fill="currentColor" />
            </span>
            <span className="stella-picker-label">{STELLA_COLORS.yellow.label}</span>
            <span className="stella-picker-price">無料</span>
          </button>

          {/* Divider */}
          <div className="stella-picker-divider">
            <span>カラーステラ</span>
            {walletBalance !== null && (
              <span className="stella-picker-balance">{walletBalance.toLocaleString()} sats</span>
            )}
          </div>

          {/* Colored stellas */}
          {COLOR_ORDER.slice(1).map((color) => {
            const colorInfo = STELLA_COLORS[color]
            const affordable = canAfford(color)
            return (
              <button
                key={color}
                className={`stella-picker-option ${!affordable ? 'stella-picker-option-disabled' : ''}`}
                onClick={handleSelect(color)}
                disabled={!affordable}
              >
                <span className="stella-picker-star" style={{ color: colorInfo.hex }}>
                  <Icon name="Star" size={16} fill="currentColor" />
                </span>
                <span className="stella-picker-label">{colorInfo.label}</span>
                <span className="stella-picker-price">{colorInfo.sats} sats</span>
              </button>
            )
          })}
        </div>

        {walletBalance === null && (
          <div className="stella-picker-hint">※ カラーステラを使うにはウォレット接続が必要です</div>
        )}
      </div>
    </>,
    document.body
  )
}
