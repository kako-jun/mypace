import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useState, useRef, useCallback, useEffect } from 'react'
import { CloseButton, Icon } from '../ui'
import { STELLA_COLORS, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'
import { fetchStellaBalance, type StellaBalance } from '../../lib/api'
import ReactorsPopup from './ReactorsPopup'

interface Reactor {
  pubkey: string
  stella: StellaCountsByColor
}

interface StellaColorPickerProps {
  position: { top: number; left: number }
  currentCounts: StellaCountsByColor // Current stella counts for this post (my stella)
  totalCounts: StellaCountsByColor // Total stella counts from all reactors
  reactors: Reactor[]
  myPubkey: string | null
  getDisplayName: (pubkey: string) => string
  onNavigateToProfile: (pubkey: string) => void
  onAddStella: (color: StellaColor) => void
  onRemoveStella?: () => void
  onClose: (e?: React.MouseEvent) => void
  disabled?: boolean // Disable all buttons (for own posts)
}

// Colors in display order
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function StellaColorPicker({
  position,
  currentCounts,
  totalCounts,
  reactors,
  myPubkey,
  getDisplayName,
  onNavigateToProfile,
  onAddStella,
  onRemoveStella,
  onClose,
  disabled = false,
}: StellaColorPickerProps) {
  // State for showing reactors popup
  const [showReactorsColor, setShowReactorsColor] = useState<StellaColor | null>(null)
  // State for stella balance
  const [stellaBalance, setStellaBalance] = useState<StellaBalance | null>(null)

  // Fetch stella balance when component mounts
  useEffect(() => {
    if (!myPubkey) return
    fetchStellaBalance(myPubkey).then((res) => {
      if (res) {
        setStellaBalance(res.balance)
      }
    })
  }, [myPubkey])

  // Debounce mechanism to prevent double clicks (100ms, max 10 stellas = 1 sec)
  const lastClickTime = useRef<number>(0)
  const CLICK_DEBOUNCE_MS = 100

  const handleClick = useCallback(
    (color: StellaColor) => (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      // Debounce rapid clicks
      const now = Date.now()
      if (now - lastClickTime.current < CLICK_DEBOUNCE_MS) {
        return
      }
      lastClickTime.current = now

      onAddStella(color)
      // Don't close - allow rapid clicking
    },
    [onAddStella]
  )

  // Check if user has enough stella balance for a color
  const canAfford = (color: StellaColor): boolean => {
    if (!stellaBalance) return false // Loading or no balance
    return stellaBalance[color] > 0
  }

  // Calculate total stella given
  const totalStella = Object.values(currentCounts).reduce((a, b) => a + b, 0)
  const maxReached = totalStella >= 10

  // Get reactors for a specific color
  const getReactorsByColor = (color: StellaColor) => {
    return reactors.filter((r) => r.stella[color] > 0)
  }

  // Handle click on breakdown count
  const handleBreakdownClick = (e: React.MouseEvent, color: StellaColor) => {
    e.stopPropagation()
    if (totalCounts[color] > 0) {
      setShowReactorsColor(color)
    }
  }

  // Handle remove stella (yellow only)
  const handleRemoveStella = () => {
    setShowReactorsColor(null)
    onRemoveStella?.()
  }

  // Check if current user can remove (only when viewing yellow and user has yellow stella)
  const myReactor = reactors.find((r) => r.pubkey === myPubkey)
  const canRemove = onRemoveStella && showReactorsColor === 'yellow' && myReactor && myReactor.stella.yellow > 0

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

        {/* 5 colored stars in a row with breakdown counts */}
        <div className="stella-picker-stars">
          {COLOR_ORDER.map((color) => {
            const colorInfo = STELLA_COLORS[color]
            const myCount = currentCounts[color]
            const totalCount = totalCounts[color]
            const affordable = canAfford(color)
            const isDisabled = disabled || maxReached || !affordable

            return (
              <div key={color} className="stella-picker-star-col">
                <button
                  className={`stella-picker-star-btn ${isDisabled ? 'disabled' : ''} ${myCount > 0 ? 'has-count' : ''}`}
                  onClick={handleClick(color)}
                  disabled={isDisabled}
                  title={`${colorInfo.label} (${colorInfo.sats === 0 ? 'Free' : `${colorInfo.sats} sats`})`}
                >
                  <Icon name="Star" size={24} fill={colorInfo.hex} />
                  <span className="stella-picker-star-count">{myCount > 0 ? myCount : ''}</span>
                </button>
                {/* Breakdown indicator - clickable icon to show reactors */}
                <button
                  className={`stella-picker-breakdown ${totalCount > 0 ? 'has-reactors' : ''}`}
                  onClick={(e) => handleBreakdownClick(e, color)}
                  disabled={totalCount === 0}
                  title={totalCount > 0 ? `View ${totalCount} reactors` : ''}
                >
                  <Icon name="MoreVertical" size={12} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Reactors popup when breakdown is clicked */}
        {showReactorsColor && (
          <ReactorsPopup
            reactors={getReactorsByColor(showReactorsColor)}
            position={{ top: position.top - 100, left: position.left }}
            myPubkey={myPubkey}
            getDisplayName={getDisplayName}
            onNavigateToProfile={(pubkey) => {
              onClose()
              onNavigateToProfile(pubkey)
            }}
            onRemove={canRemove ? handleRemoveStella : undefined}
            onClose={() => setShowReactorsColor(null)}
            filterColor={showReactorsColor}
          />
        )}

        {/* Show stella balance */}
        {stellaBalance && (
          <div className="stella-picker-balance">
            {COLOR_ORDER.map((color) => (
              <span key={color} className="stella-picker-balance-item">
                <Icon name="Star" size={12} fill={STELLA_COLORS[color].hex} />
                {stellaBalance[color]}
              </span>
            ))}
          </div>
        )}
        <Link to="/inventory" className="stella-picker-hint stella-picker-link" onClick={() => onClose()}>
          View Inventory
        </Link>
      </div>
    </>,
    document.body
  )
}
