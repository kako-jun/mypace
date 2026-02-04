import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../ui'
import type { AlchemyWord } from '../../lib/api'
import '../../styles/components/word-collect-celebration.css'

// Context for managing celebration queue
export interface WordCollectResult {
  word: AlchemyWord
  isNew: boolean
  isFirstEver: boolean
  count: number
}

interface WordCelebrationContextType {
  celebrate: (result: WordCollectResult) => void
}

const WordCelebrationContext = createContext<WordCelebrationContextType | null>(null)

export function useWordCelebration() {
  const context = useContext(WordCelebrationContext)
  if (!context) {
    throw new Error('useWordCelebration must be used within WordCelebrationProvider')
  }
  return context
}

interface WordCelebrationProviderProps {
  children: ReactNode
}

export function WordCelebrationProvider({ children }: WordCelebrationProviderProps) {
  const [queue, setQueue] = useState<WordCollectResult[]>([])
  const [current, setCurrent] = useState<WordCollectResult | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const celebrate = useCallback((result: WordCollectResult) => {
    setQueue((prev) => [...prev, result])
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

  // Auto-close after 3 seconds
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(handleClose, 3000)
    return () => clearTimeout(timer)
  }, [current, handleClose])

  return (
    <WordCelebrationContext.Provider value={{ celebrate }}>
      {children}
      {current && <WordCollectCelebrationModal result={current} isVisible={isVisible} onClose={handleClose} />}
    </WordCelebrationContext.Provider>
  )
}

interface WordCollectCelebrationModalProps {
  result: WordCollectResult
  isVisible: boolean
  onClose: () => void
}

function WordCollectCelebrationModal({ result, isVisible, onClose }: WordCollectCelebrationModalProps) {
  const { word, isNew, isFirstEver, count } = result

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

  // Default placeholder image for words without generated image
  const defaultImage =
    'data:image/svg+xml,' +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" fill="#1a1a2e"/>
      <text x="64" y="72" font-size="48" text-anchor="middle" fill="#6366f1">?</text>
    </svg>
  `)

  const imageUrl = word.image_url || defaultImage
  const isImageReady = word.image_status === 'done' && word.image_url

  return (
    <div className={`word-celebration-backdrop ${isVisible ? 'visible' : ''}`} onClick={handleBackdropClick}>
      {/* Sparkle particles */}
      <div className="word-sparkles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="word-sparkle"
            style={
              {
                '--delay': `${Math.random() * 1.5}s`,
                '--x': `${Math.random() * 100}%`,
                '--y': `${Math.random() * 100}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={`word-celebration-content ${isVisible ? 'visible' : ''}`}>
        {/* Badge for special discoveries */}
        {isFirstEver && (
          <div className="word-first-discovery-badge">
            <Icon name="Sparkles" size={14} />
            <span>First Ever Discovery!</span>
          </div>
        )}
        {isNew && !isFirstEver && (
          <div className="word-new-badge">
            <span>NEW!</span>
          </div>
        )}

        {/* Word image */}
        <div className={`word-image-wrapper ${!isImageReady ? 'generating' : ''}`}>
          <img src={imageUrl} alt={word.text} className="word-image" />
          {!isImageReady && (
            <div className="word-image-generating">
              <Icon name="Loader" size={24} className="spinning" />
              <span>Generating...</span>
            </div>
          )}
        </div>

        {/* Word text */}
        <h2 className="word-text">{word.text}</h2>

        {/* Count */}
        <p className="word-count">{count === 1 ? 'Added to collection!' : `x${count} in collection`}</p>

        {/* Inventory link */}
        <Link to="/inventory?tab=alchemy" className="word-inventory-link" onClick={onClose}>
          View in Inventory
        </Link>

        {/* Tap to dismiss hint */}
        <p className="word-hint">Tap anywhere to continue</p>
      </div>
    </div>
  )
}

// Simple inline word card for showing word in lists
export function WordCard({
  word,
  count,
  onClick,
  selected,
  size = 'normal',
}: {
  word: AlchemyWord
  count?: number
  onClick?: () => void
  selected?: boolean
  size?: 'small' | 'normal' | 'large'
}) {
  const defaultImage =
    'data:image/svg+xml,' +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="#1a1a2e"/>
      <text x="32" y="40" font-size="24" text-anchor="middle" fill="#6366f1">?</text>
    </svg>
  `)

  const imageUrl = word.image_url || defaultImage
  const isImageReady = word.image_status === 'done' && word.image_url

  const sizeClass = `word-card-${size}`

  return (
    <button
      className={`word-card ${sizeClass} ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className={`word-card-image ${!isImageReady ? 'generating' : ''}`}>
        <img src={imageUrl} alt={word.text} />
        {!isImageReady && word.image_status !== 'failed' && (
          <div className="word-card-loading">
            <Icon name="Loader" size={16} className="spinning" />
          </div>
        )}
      </div>
      <span className="word-card-text">{word.text}</span>
      {count !== undefined && count > 1 && <span className="word-card-count">x{count}</span>}
    </button>
  )
}
