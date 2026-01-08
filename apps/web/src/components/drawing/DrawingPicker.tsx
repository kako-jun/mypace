import { useState, useRef, useEffect, useCallback } from 'react'
import { Icon, CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import { uploadImage, saveUploadToHistory, saveStickerToHistory } from '../../lib/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import '../../styles/components/drawing.css'

interface DrawingPickerProps {
  onEmbed: (url: string) => void
  onAddSticker: (sticker: { url: string }) => void
}

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 120
const TIME_LIMIT = 42

const COLORS = {
  black: '#000000',
  gray: '#808080',
  white: '#ffffff',
}

const PEN_SIZES = {
  small: 2,
  medium: 6,
  large: 14,
}

type ColorKey = keyof typeof COLORS
type SizeKey = keyof typeof PEN_SIZES

interface DrawPoint {
  x: number
  y: number
}

interface DrawAction {
  type: 'stroke'
  color: string
  size: number
  points: DrawPoint[]
}

export function DrawingPicker({ onEmbed, onAddSticker }: DrawingPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [color, setColor] = useState<ColorKey>('black')
  const [size, setSize] = useState<SizeKey>('medium')
  const [, setIsDrawing] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [historyLength, setHistoryLength] = useState(0)

  // Undo history
  const historyRef = useRef<DrawAction[]>([])
  const currentStrokeRef = useRef<DrawPoint[]>([])

  // Reset state when opening
  const handleOpen = () => {
    setIsOpen(true)
    setColor('black')
    setSize('medium')
    setTimeLeft(TIME_LIMIT)
    setIsTimerRunning(false)
    setHasDrawn(false)
    setHistoryLength(0)
    setError('')
    historyRef.current = []
    currentStrokeRef.current = []
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsTimerRunning(false)
    setIsDrawing(false)
  }

  // Initialize canvas with white background
  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = COLORS.white
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }, [isOpen])

  // Timer
  useEffect(() => {
    if (!isTimerRunning) return
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsTimerRunning(false)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isTimerRunning, timeLeft])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with white
    ctx.fillStyle = COLORS.white
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Redraw all actions
    for (const action of historyRef.current) {
      // Fill action (size === 0)
      if (action.size === 0) {
        ctx.fillStyle = action.color
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        continue
      }

      if (action.points.length < 2) continue
      ctx.strokeStyle = action.color
      ctx.lineWidth = action.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(action.points[0].x, action.points[0].y)

      // Use quadratic bezier curves for smooth lines
      for (let i = 1; i < action.points.length; i++) {
        const prevPoint = action.points[i - 1]
        const currentPoint = action.points[i]
        const midPoint = {
          x: (prevPoint.x + currentPoint.x) / 2,
          y: (prevPoint.y + currentPoint.y) / 2,
        }
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midPoint.x, midPoint.y)
      }

      // Draw line to the last point
      const lastPoint = action.points[action.points.length - 1]
      ctx.lineTo(lastPoint.x, lastPoint.y)
      ctx.stroke()
    }
  }, [])

  const getCanvasPoint = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
    clamp = false
  ): DrawPoint | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height

    let clientX: number
    let clientY: number

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    let x = (clientX - rect.left) * scaleX
    let y = (clientY - rect.top) * scaleY

    if (clamp) {
      x = Math.max(0, Math.min(CANVAS_WIDTH, x))
      y = Math.max(0, Math.min(CANVAS_HEIGHT, y))
    }

    return { x, y }
  }

  const drawWithPoint = useCallback(
    (point: DrawPoint) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const points = currentStrokeRef.current
      points.push(point)

      // Use quadratic bezier curve for smooth lines
      if (points.length >= 2) {
        const lastPoint = points[points.length - 2]
        const midPoint = {
          x: (lastPoint.x + point.x) / 2,
          y: (lastPoint.y + point.y) / 2,
        }

        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y)
        ctx.stroke()

        // Start new path from midpoint for next segment
        ctx.beginPath()
        ctx.moveTo(midPoint.x, midPoint.y)
      }
    },
    [color, size]
  )

  const handleDocumentMouseMove = useCallback(
    (e: MouseEvent) => {
      if (timeLeft <= 0) return
      const point = getCanvasPoint(e, true)
      if (!point) return
      drawWithPoint(point)
    },
    [timeLeft, drawWithPoint]
  )

  const handleDocumentMouseUp = useCallback(() => {
    setIsDrawing(false)

    // Save stroke to history
    if (currentStrokeRef.current.length > 0) {
      historyRef.current.push({
        type: 'stroke',
        color: COLORS[color],
        size: PEN_SIZES[size],
        points: [...currentStrokeRef.current],
      })
      setHistoryLength(historyRef.current.length)
      currentStrokeRef.current = []
    }

    document.removeEventListener('mousemove', handleDocumentMouseMove)
    document.removeEventListener('mouseup', handleDocumentMouseUp)
  }, [color, size, handleDocumentMouseMove])

  const handleDocumentTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault()
      if (timeLeft <= 0) return
      const point = getCanvasPoint(e, true)
      if (!point) return
      drawWithPoint(point)
    },
    [timeLeft, drawWithPoint]
  )

  const handleDocumentTouchEnd = useCallback(() => {
    setIsDrawing(false)

    // Save stroke to history
    if (currentStrokeRef.current.length > 0) {
      historyRef.current.push({
        type: 'stroke',
        color: COLORS[color],
        size: PEN_SIZES[size],
        points: [...currentStrokeRef.current],
      })
      setHistoryLength(historyRef.current.length)
      currentStrokeRef.current = []
    }

    document.removeEventListener('touchmove', handleDocumentTouchMove)
    document.removeEventListener('touchend', handleDocumentTouchEnd)
  }, [color, size, handleDocumentTouchMove])

  const startDrawingFromEvent = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (timeLeft <= 0) return

      // Check if click is within container
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      let clientX: number
      let clientY: number
      if ('touches' in e) {
        const touch = e.touches[0]
        if (!touch) return
        clientX = touch.clientX
        clientY = touch.clientY
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      // Only start drawing if click is within container bounds
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return
      }

      e.preventDefault()

      // Start timer on first draw
      if (!isTimerRunning && !hasDrawn) {
        setIsTimerRunning(true)
        setHasDrawn(true)
      }

      const point = getCanvasPoint(e, true)
      if (!point) return

      setIsDrawing(true)
      currentStrokeRef.current = [point]

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.strokeStyle = COLORS[color]
      ctx.lineWidth = PEN_SIZES[size]
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)

      // Add document-level listeners
      if ('touches' in e) {
        document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
        document.addEventListener('touchend', handleDocumentTouchEnd)
      } else {
        document.addEventListener('mousemove', handleDocumentMouseMove)
        document.addEventListener('mouseup', handleDocumentMouseUp)
      }
    },
    [
      timeLeft,
      isTimerRunning,
      hasDrawn,
      color,
      size,
      handleDocumentMouseMove,
      handleDocumentMouseUp,
      handleDocumentTouchMove,
      handleDocumentTouchEnd,
    ]
  )

  // Document-level mousedown/touchstart listeners
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => startDrawingFromEvent(e)
    const handleTouchStart = (e: TouchEvent) => startDrawingFromEvent(e)

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('touchstart', handleTouchStart, { passive: false })

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('touchstart', handleTouchStart)
    }
  }, [isOpen, startDrawingFromEvent])

  const handleUndo = () => {
    if (historyRef.current.length === 0) return
    historyRef.current.pop()
    setHistoryLength(historyRef.current.length)
    redrawCanvas()
  }

  const handleFill = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill with current color
    ctx.fillStyle = COLORS[color]
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Add fill action to history
    historyRef.current.push({
      type: 'stroke',
      color: COLORS[color],
      size: 0,
      points: [
        { x: 0, y: 0 },
        { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
      ],
    })
    setHistoryLength(historyRef.current.length)
    if (!hasDrawn) setHasDrawn(true)
    if (!isTimerRunning) setIsTimerRunning(true)
  }

  const uploadDrawing = async (): Promise<string | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null

    setUploading(true)
    setError('')

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create image'))
          },
          'image/webp',
          0.9
        )
      })

      const file = new File([blob], 'drawing.webp', { type: 'image/webp' })
      const result = await uploadImage(file)
      if (!result.success || !result.url) {
        throw new Error(result.error || 'Upload failed')
      }
      // Save to upload history (D1)
      try {
        const pubkey = await getCurrentPubkey()
        saveUploadToHistory(pubkey, result.url, file.name, 'image')
      } catch {
        // Silently fail
      }
      return result.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleEmbed = async () => {
    const url = await uploadDrawing()
    if (!url) return
    const pubkey = await getCurrentPubkey()
    saveStickerToHistory(url, pubkey)
    onEmbed(url)
    setIsOpen(false)
  }

  const handleSticker = async () => {
    const url = await uploadDrawing()
    if (!url) return
    const pubkey = await getCurrentPubkey()
    saveStickerToHistory(url, pubkey)
    onAddSticker({ url })
    setIsOpen(false)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const formatTime = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="drawing-picker">
      <button type="button" className="drawing-picker-button" onClick={handleOpen} title="Draw">
        <Icon name="Pencil" size={16} />
      </button>

      {isOpen && (
        <Portal>
          <div className="drawing-picker-backdrop" onClick={handleBackdropClick}>
            <div className="drawing-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="drawing-picker-header">
                <h3>Draw</h3>
                <div className={`drawing-picker-timer ${timeLeft <= 10 ? 'warning' : ''}`}>{formatTime(timeLeft)}</div>
                <CloseButton onClick={handleClose} size={20} />
              </div>

              <div className="drawing-picker-toolbar">
                <div className="drawing-picker-colors">
                  {(Object.keys(COLORS) as ColorKey[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`drawing-color-button ${c} ${color === c ? 'active' : ''}`}
                      onClick={() => setColor(c)}
                      title={c}
                    />
                  ))}
                </div>
                <div className="drawing-picker-sizes">
                  {(Object.keys(PEN_SIZES) as SizeKey[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`drawing-size-button ${s} ${size === s ? 'active' : ''}`}
                      onClick={() => setSize(s)}
                      title={s}
                    >
                      <span className={`drawing-size-dot ${s}`} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="drawing-action-button"
                  onClick={handleFill}
                  disabled={timeLeft <= 0}
                  title="Fill"
                >
                  <Icon name="Droplet" size={18} />
                </button>
                <button
                  type="button"
                  className="drawing-action-button"
                  onClick={handleUndo}
                  disabled={historyLength === 0 || timeLeft <= 0}
                  title="Undo"
                >
                  <Icon name="Undo2" size={18} />
                </button>
              </div>

              <div ref={containerRef} className="drawing-picker-canvas-container">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className={`drawing-picker-canvas ${timeLeft <= 0 ? 'disabled' : ''}`}
                />
                {!hasDrawn && timeLeft > 0 && <div className="drawing-picker-overlay">Draw here to start</div>}
                {timeLeft <= 0 && <div className="drawing-picker-overlay">Time's up</div>}
              </div>

              {error && <div className="drawing-picker-error">{error}</div>}

              <div className="drawing-picker-footer">
                <Button size="md" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button size="md" variant="primary" onClick={handleEmbed} disabled={uploading || !hasDrawn}>
                  {uploading ? 'Uploading...' : 'Embed'}
                </Button>
                <Button size="md" variant="primary" onClick={handleSticker} disabled={uploading || !hasDrawn}>
                  {uploading ? 'Uploading...' : 'Sticker'}
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
