import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { Icon } from '../ui'
import { fetchWordDetails } from '../../lib/api'
import type { WordrotWord } from '../../lib/api'
import '../../styles/components/word-collect-celebration.css'

// Context for managing celebration queue
export interface WordCollectResult {
  word: WordrotWord
  isNew: boolean
  isFirstEver: boolean
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

type ToastPhase = 'entering' | 'visible' | 'flying' | 'done'

export function WordCelebrationProvider({ children }: WordCelebrationProviderProps) {
  const [queue, setQueue] = useState<WordCollectResult[]>([])
  const [current, setCurrent] = useState<WordCollectResult | null>(null)
  const [phase, setPhase] = useState<ToastPhase>('done')

  const celebrate = useCallback((result: WordCollectResult) => {
    setQueue((prev) => [...prev, result])
  }, [])

  // Process queue - show next toast
  useEffect(() => {
    if (phase !== 'done' || queue.length === 0) return

    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setCurrent(next)
    setPhase('entering')
  }, [phase, queue])

  // Phase transitions: entering → visible → flying → done
  useEffect(() => {
    if (phase === 'entering') {
      // Short delay then become visible
      const t = setTimeout(() => setPhase('visible'), 50)
      return () => clearTimeout(t)
    }
    if (phase === 'visible') {
      // Show toast for 2 seconds, then fly to INV
      const t = setTimeout(() => setPhase('flying'), 2000)
      return () => clearTimeout(t)
    }
    if (phase === 'flying') {
      // Fly animation takes 500ms, then done
      const t = setTimeout(() => {
        setPhase('done')
        setCurrent(null)
      }, 600)
      return () => clearTimeout(t)
    }
  }, [phase])

  return (
    <WordCelebrationContext.Provider value={{ celebrate }}>
      {children}
      {current && <WordCollectToast result={current} phase={phase} />}
    </WordCelebrationContext.Provider>
  )
}

interface WordCollectToastProps {
  result: WordCollectResult
  phase: ToastPhase
}

function WordCollectToast({ result, phase }: WordCollectToastProps) {
  const { word: initialWord, isNew, isFirstEver } = result
  const toastRef = useRef<HTMLDivElement>(null)
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({})
  const [word, setWord] = useState(initialWord)

  // Poll for image status when not done
  useEffect(() => {
    if (word.image_status === 'done' || word.image_status === 'failed') return

    const poll = setInterval(async () => {
      try {
        const details = await fetchWordDetails(word.text)
        if (details.word && details.word.image_status !== word.image_status) {
          setWord(details.word)
        }
      } catch {
        // ignore
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [word.text, word.image_status])

  const isImageReady = word.image_status === 'done' && word.image_url

  // When entering flying phase, compute target position from INV button
  useEffect(() => {
    if (phase !== 'flying') return

    const invBtn = document.getElementById('inv-button')
    const toast = toastRef.current
    if (!invBtn || !toast) return

    const invRect = invBtn.getBoundingClientRect()
    const toastRect = toast.getBoundingClientRect()

    // Calculate how far toast needs to move to reach INV button center
    const dx = invRect.left + invRect.width / 2 - (toastRect.left + toastRect.width / 2)
    const dy = invRect.top + invRect.height / 2 - (toastRect.top + toastRect.height / 2)

    setFlyStyle({
      transform: `translate(${dx}px, ${dy}px) scale(0.15)`,
      opacity: 0,
      transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease',
    })
  }, [phase])

  const phaseClass = phase === 'visible' || phase === 'flying' ? 'visible' : ''

  return (
    <div ref={toastRef} className={`word-toast ${phaseClass}`} style={phase === 'flying' ? flyStyle : undefined}>
      {/* Word image */}
      <div className={`word-toast-image ${!isImageReady ? 'generating' : ''}`}>
        {isImageReady && <img src={word.image_url} alt={word.text} />}
        {!isImageReady && word.image_status !== 'failed' && (
          <div className="word-toast-loading">
            <Icon name="Loader" size={14} className="spinning" />
          </div>
        )}
      </div>

      {/* Word info */}
      <div className="word-toast-info">
        <span className="word-toast-text">{word.text}</span>
        <span className="word-toast-label">{isFirstEver ? 'First Discovery!' : isNew ? 'NEW' : 'Collected'}</span>
      </div>
    </div>
  )
}

// Simple inline word card for showing word in lists
export function WordCard({
  word: initialWord,
  onClick,
  selected,
  highlight,
  size = 'normal',
  source = 'harvest',
  onRetryImage,
}: {
  word: WordrotWord
  onClick?: () => void
  selected?: boolean
  highlight?: boolean
  size?: 'small' | 'normal' | 'large'
  source?: 'harvest' | 'synthesis'
  onRetryImage?: (wordId: number, source: 'harvest' | 'synthesis') => void
}) {
  const [word, setWord] = useState(initialWord)

  // Sync with prop changes
  useEffect(() => {
    setWord(initialWord)
  }, [initialWord])

  // Always use the single image fields
  const imageUrl = word.image_url
  const imageStatus = word.image_status

  // Poll for image status when pending/generating
  useEffect(() => {
    if (imageStatus === 'done' || imageStatus === 'failed') return

    const poll = setInterval(async () => {
      try {
        const details = await fetchWordDetails(word.text)
        if (details.word) {
          if (details.word.image_status !== imageStatus) {
            setWord(details.word)
          }
        }
      } catch {
        // ignore
      }
    }, 3000)

    return () => clearInterval(poll)
  }, [word.text, imageStatus])

  const isImageReady = imageStatus === 'done' && imageUrl

  const sizeClass = `word-card-${size}`
  // Create anchor ID from word text (sanitized for URL)
  const anchorId = `word-${word.text.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

  // Long-press detection for retry (500ms)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)

  const handlePressStart = useMemo(() => {
    if (!onRetryImage) return undefined
    return () => {
      isLongPress.current = false
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true
        setWord({ ...word, image_status: 'generating' })
        onRetryImage(word.id, source)
      }, 500)
    }
  }, [onRetryImage, word, source])

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  return (
    <button
      id={anchorId}
      className={`word-card ${sizeClass} ${selected ? 'selected' : ''} ${highlight ? 'highlight' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={(e) => {
        if (isLongPress.current) {
          e.preventDefault()
          isLongPress.current = false
          return
        }
        onClick?.()
      }}
      disabled={!onClick && !onRetryImage}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      <div className={`word-card-image ${!isImageReady ? 'generating' : ''}`}>
        {isImageReady && <img src={imageUrl} alt={word.text} />}
        {!isImageReady && imageStatus !== 'failed' && (
          <div className="word-card-loading">
            <Icon name="Loader" size={16} className="spinning" />
          </div>
        )}
      </div>
      <span className="word-card-text">{word.text}</span>
    </button>
  )
}
