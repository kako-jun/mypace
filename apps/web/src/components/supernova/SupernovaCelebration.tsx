import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../ui'
import { STELLA_COLORS } from '../../lib/nostr/events'
import { formatNumber } from '../../lib/utils/format'
import type { UserSupernova } from '../../lib/api'
import '../../styles/components/supernova-celebration.css'

// Context for managing celebration queue
interface CelebrationContextType {
  celebrate: (supernovas: UserSupernova[]) => void
}

const CelebrationContext = createContext<CelebrationContextType | null>(null)

export function useCelebration() {
  const context = useContext(CelebrationContext)
  if (!context) {
    throw new Error('useCelebration must be used within CelebrationProvider')
  }
  return context
}

interface CelebrationProviderProps {
  children: ReactNode
}

export function CelebrationProvider({ children }: CelebrationProviderProps) {
  const [queue, setQueue] = useState<UserSupernova[]>([])
  const [current, setCurrent] = useState<UserSupernova | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const celebrate = useCallback((supernovas: UserSupernova[]) => {
    if (supernovas.length === 0) return
    setQueue((prev) => [...prev, ...supernovas])
  }, [])

  // Process queue - show next celebration
  useEffect(() => {
    if (current || queue.length === 0) return

    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setCurrent(next)
    setIsVisible(true)
  }, [current, queue])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    // Wait for animation to finish before clearing current
    setTimeout(() => setCurrent(null), 300)
  }, [])

  // Auto-close after 5 seconds
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(handleClose, 5000)
    return () => clearTimeout(timer)
  }, [current, handleClose])

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {current && <SupernovaCelebrationModal supernova={current} isVisible={isVisible} onClose={handleClose} />}
    </CelebrationContext.Provider>
  )
}

interface SupernovaCelebrationModalProps {
  supernova: UserSupernova
  isVisible: boolean
  onClose: () => void
}

function SupernovaCelebrationModal({ supernova, isVisible, onClose }: SupernovaCelebrationModalProps) {
  const colorHex = STELLA_COLORS[supernova.supernova_color as keyof typeof STELLA_COLORS]?.hex || '#ffd700'

  const hasReward =
    supernova.reward_green > 0 || supernova.reward_red > 0 || supernova.reward_blue > 0 || supernova.reward_purple > 0

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className={`supernova-celebration-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleBackdropClick}>
      {/* Sparkle particles */}
      <div className="supernova-sparkles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="supernova-sparkle"
            style={
              {
                '--delay': `${Math.random() * 2}s`,
                '--x': `${Math.random() * 100}%`,
                '--y': `${Math.random() * 100}%`,
                '--color': colorHex,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={`supernova-celebration-content ${isVisible ? 'visible' : ''}`}>
        {/* Icon with glow effect */}
        <div className="supernova-icon-wrapper" style={{ '--glow-color': colorHex } as React.CSSProperties}>
          <Icon name="Sparkles" size={48} fill={colorHex} />
        </div>

        {/* Title */}
        <h2 className="supernova-title">Supernova Unlocked!</h2>

        {/* Supernova name */}
        <p className="supernova-name" style={{ color: colorHex }}>
          {supernova.name}
        </p>

        {/* Description */}
        {supernova.description !== supernova.name && <p className="supernova-description">{supernova.description}</p>}

        {/* Rewards */}
        {hasReward && (
          <div className="supernova-rewards">
            <span className="supernova-rewards-label">Rewards:</span>
            <div className="supernova-rewards-list">
              {supernova.reward_green > 0 && (
                <span className="supernova-reward">
                  <Icon name="Star" size={18} fill={STELLA_COLORS.green.hex} />
                  <span>+{formatNumber(supernova.reward_green)}</span>
                </span>
              )}
              {supernova.reward_red > 0 && (
                <span className="supernova-reward">
                  <Icon name="Star" size={18} fill={STELLA_COLORS.red.hex} />
                  <span>+{formatNumber(supernova.reward_red)}</span>
                </span>
              )}
              {supernova.reward_blue > 0 && (
                <span className="supernova-reward">
                  <Icon name="Star" size={18} fill={STELLA_COLORS.blue.hex} />
                  <span>+{formatNumber(supernova.reward_blue)}</span>
                </span>
              )}
              {supernova.reward_purple > 0 && (
                <span className="supernova-reward">
                  <Icon name="Star" size={18} fill={STELLA_COLORS.purple.hex} />
                  <span>+{formatNumber(supernova.reward_purple)}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inventory link */}
        <Link to="/inventory" className="supernova-inventory-link" onClick={onClose}>
          View in Inventory
        </Link>

        {/* Tap to dismiss hint */}
        <p className="supernova-hint">Tap anywhere to continue</p>
      </div>
    </div>
  )
}
