import { useState, useRef, useEffect, useCallback } from 'react'
import { Icon } from '../ui'
import { uploadImage } from '../../lib/api'

interface DrawingPickerProps {
  onComplete: (url: string) => void
  onClose: () => void
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

export function DrawingPicker({ onComplete, onClose }: DrawingPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState<ColorKey>('black')
  const [size, setSize] = useState<SizeKey>('medium')
  const [isDrawing, setIsDrawing] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [historyLength, setHistoryLength] = useState(0)

  // Undo history
  const historyRef = useRef<DrawAction[]>([])
  const currentStrokeRef = useRef<DrawPoint[]>([])

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = COLORS.white
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }, [])

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

    // Redraw all strokes
    for (const action of historyRef.current) {
      if (action.points.length < 2) continue
      ctx.strokeStyle = action.color
      ctx.lineWidth = action.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(action.points[0].x, action.points[0].y)
      for (let i = 1; i < action.points.length; i++) {
        ctx.lineTo(action.points[i].x, action.points[i].y)
      }
      ctx.stroke()
    }
  }, [])

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): DrawPoint | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (timeLeft <= 0) return

    // Start timer on first draw
    if (!isTimerRunning && !hasDrawn) {
      setIsTimerRunning(true)
      setHasDrawn(true)
    }

    const point = getCanvasPoint(e)
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
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || timeLeft <= 0) return

    const point = getCanvasPoint(e)
    if (!point) return

    currentStrokeRef.current.push(point)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
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
  }

  const handleUndo = () => {
    if (historyRef.current.length === 0) return
    historyRef.current.pop()
    setHistoryLength(historyRef.current.length)
    redrawCanvas()
  }

  const handleClear = () => {
    historyRef.current = []
    setHistoryLength(0)
    redrawCanvas()
  }

  const handleComplete = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

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
      onComplete(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatTime = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="drawing-picker-backdrop" onClick={handleBackdropClick}>
      <div className="drawing-picker-modal">
        <div className="drawing-picker-header">
          <h3>Draw</h3>
          <div className={`drawing-picker-timer ${timeLeft <= 10 ? 'warning' : ''}`}>{formatTime(timeLeft)}</div>
          <button type="button" className="drawing-picker-close" onClick={onClose}>
            <Icon name="X" size={20} />
          </button>
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
          <div className="drawing-picker-actions">
            <button
              type="button"
              className="drawing-action-button"
              onClick={handleUndo}
              disabled={historyLength === 0}
              title="Undo"
            >
              <Icon name="Undo2" size={18} />
            </button>
            <button type="button" className="drawing-action-button" onClick={handleClear} title="Clear">
              <Icon name="Trash2" size={18} />
            </button>
          </div>
        </div>

        <div className="drawing-picker-canvas-container">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="drawing-picker-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {error && <div className="drawing-picker-error">{error}</div>}

        <div className="drawing-picker-footer">
          <button type="button" className="drawing-picker-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="drawing-picker-complete"
            onClick={handleComplete}
            disabled={uploading || !hasDrawn}
          >
            {uploading ? 'Uploading...' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
