import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import type { Sticker, StickerQuadrant, StickerLayer } from '../../types'

interface PostStickersProps {
  stickers: Sticker[]
  editable?: boolean
  truncated?: boolean // When true, only show top quadrant stickers
  layer?: StickerLayer // Filter by layer: 'front' (default), 'back'
  onStickerMove?: (index: number, x: number, y: number, quadrant: StickerQuadrant) => void
  onStickerResize?: (index: number, size: number) => void
  onStickerRotate?: (index: number, rotation: number) => void
  onStickerLayerChange?: (index: number, layer: StickerLayer) => void
  onStickerRemove?: (index: number) => void
}

// Get CSS position style based on quadrant
// x, y are 0-100% within each quadrant (each quadrant is half the card)
// For left/top anchored positions: translate(-50%) centers the element
// For right/bottom anchored positions: translate(50%) centers the element
function getPositionStyle(sticker: Sticker): React.CSSProperties {
  const { x, y, quadrant, size, rotation } = sticker
  const base: React.CSSProperties = {
    position: 'absolute',
    width: `${size}%`,
  }

  // Convert quadrant-local % to card-global %
  // Each quadrant is 50% of the card, so: globalPos = (localPos / 100) * 50
  const halfX = (x / 100) * 50
  const halfY = (y / 100) * 50

  switch (quadrant) {
    case 'top-left':
      return {
        ...base,
        left: `${halfX}%`,
        top: `${halfY}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
    case 'top-right':
      return {
        ...base,
        right: `${halfX}%`,
        top: `${halfY}%`,
        transform: `translate(50%, -50%) rotate(${rotation}deg)`,
      }
    case 'bottom-left':
      return {
        ...base,
        left: `${halfX}%`,
        bottom: `${halfY}%`,
        transform: `translate(-50%, 50%) rotate(${rotation}deg)`,
      }
    case 'bottom-right':
      return {
        ...base,
        right: `${halfX}%`,
        bottom: `${halfY}%`,
        transform: `translate(50%, 50%) rotate(${rotation}deg)`,
      }
    default:
      // Fallback for old stickers without quadrant (treat as top-left with original %)
      return {
        ...base,
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
  }
}

type DragMode = 'move' | 'resize' | 'rotate' | null

export function PostStickers({
  stickers,
  editable = false,
  truncated = false,
  layer,
  onStickerMove,
  onStickerResize,
  onStickerRotate,
  onStickerLayerChange,
  onStickerRemove,
}: PostStickersProps) {
  // Filter stickers based on truncated mode and layer, preserving original indices
  const visibleStickers = stickers
    .map((sticker, originalIndex) => ({ sticker, originalIndex }))
    .filter(({ sticker }) => {
      // Filter by layer if specified
      if (layer) {
        const stickerLayer = sticker.layer || 'front' // default to front
        if (stickerLayer !== layer) return false
      }
      // Filter by truncated mode
      if (truncated) {
        if (sticker.quadrant !== 'top-left' && sticker.quadrant !== 'top-right' && sticker.quadrant) {
          return false
        }
      }
      return true
    })

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; value: number } | null>(null)

  // Get pointer position from mouse or touch event
  const getPointerPosition = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { clientX: touch.clientX, clientY: touch.clientY }
    }
    return { clientX: e.clientX, clientY: e.clientY }
  }, [])

  // Handle click outside to deselect
  useEffect(() => {
    if (!editable || selectedIndex === null) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.sticker-wrapper') && !target.closest('.sticker-handle')) {
        setSelectedIndex(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editable, selectedIndex])

  // Global move/resize/rotate handlers
  useEffect(() => {
    if (!dragMode || selectedIndex === null || !containerRef.current) return

    const container = containerRef.current.parentElement
    if (!container) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const { clientX, clientY } = getPointerPosition(e)
      const rect = container.getBoundingClientRect()

      if (dragMode === 'move' && onStickerMove) {
        const { originalIndex: moveOriginalIndex } = visibleStickers[selectedIndex]
        // Calculate position as percentage from edges
        const xFromLeft = ((clientX - rect.left) / rect.width) * 100
        const yFromTop = ((clientY - rect.top) / rect.height) * 100

        // Determine quadrant based on position (which half)
        const isRight = xFromLeft > 50
        const isBottom = yFromTop > 50

        let quadrant: StickerQuadrant
        let x: number // 0-100% within quadrant
        let y: number // 0-100% within quadrant

        if (!isRight && !isBottom) {
          quadrant = 'top-left'
          // xFromLeft is 0-50, convert to 0-100 within quadrant
          x = Math.max(0, Math.min(100, (xFromLeft / 50) * 100))
          y = Math.max(0, Math.min(100, (yFromTop / 50) * 100))
        } else if (isRight && !isBottom) {
          quadrant = 'top-right'
          // Distance from right edge: 100 - xFromLeft, which is 0-50
          x = Math.max(0, Math.min(100, ((100 - xFromLeft) / 50) * 100))
          y = Math.max(0, Math.min(100, (yFromTop / 50) * 100))
        } else if (!isRight && isBottom) {
          quadrant = 'bottom-left'
          x = Math.max(0, Math.min(100, (xFromLeft / 50) * 100))
          // Distance from bottom edge: 100 - yFromTop, which is 0-50
          y = Math.max(0, Math.min(100, ((100 - yFromTop) / 50) * 100))
        } else {
          quadrant = 'bottom-right'
          x = Math.max(0, Math.min(100, ((100 - xFromLeft) / 50) * 100))
          y = Math.max(0, Math.min(100, ((100 - yFromTop) / 50) * 100))
        }

        onStickerMove(moveOriginalIndex, x, y, quadrant)
      } else if (dragMode === 'resize' && onStickerResize && dragStartRef.current) {
        const { sticker, originalIndex } = visibleStickers[selectedIndex]
        // Calculate sticker center based on quadrant (x, y are 0-100% within quadrant)
        // Convert to global position: halfPos = (localPos / 100) * 50% of card
        const halfX = (sticker.x / 100) * 0.5
        const halfY = (sticker.y / 100) * 0.5
        let stickerCenterX: number
        let stickerCenterY: number
        switch (sticker.quadrant) {
          case 'top-right':
            stickerCenterX = rect.right - halfX * rect.width
            stickerCenterY = rect.top + halfY * rect.height
            break
          case 'bottom-left':
            stickerCenterX = rect.left + halfX * rect.width
            stickerCenterY = rect.bottom - halfY * rect.height
            break
          case 'bottom-right':
            stickerCenterX = rect.right - halfX * rect.width
            stickerCenterY = rect.bottom - halfY * rect.height
            break
          default: // top-left
            stickerCenterX = rect.left + halfX * rect.width
            stickerCenterY = rect.top + halfY * rect.height
        }
        const distStart = Math.sqrt(
          Math.pow(dragStartRef.current.x - stickerCenterX, 2) + Math.pow(dragStartRef.current.y - stickerCenterY, 2)
        )
        const distCurrent = Math.sqrt(Math.pow(clientX - stickerCenterX, 2) + Math.pow(clientY - stickerCenterY, 2))
        const scale = distCurrent / distStart
        const newSize = Math.max(5, Math.min(100, dragStartRef.current.value * scale))
        onStickerResize(originalIndex, newSize)
      } else if (dragMode === 'rotate' && onStickerRotate) {
        const { sticker, originalIndex: rotateOriginalIndex } = visibleStickers[selectedIndex]
        // Calculate sticker center based on quadrant (x, y are 0-100% within quadrant)
        const halfX = (sticker.x / 100) * 0.5
        const halfY = (sticker.y / 100) * 0.5
        let stickerCenterX: number
        let stickerCenterY: number
        switch (sticker.quadrant) {
          case 'top-right':
            stickerCenterX = rect.right - halfX * rect.width
            stickerCenterY = rect.top + halfY * rect.height
            break
          case 'bottom-left':
            stickerCenterX = rect.left + halfX * rect.width
            stickerCenterY = rect.bottom - halfY * rect.height
            break
          case 'bottom-right':
            stickerCenterX = rect.right - halfX * rect.width
            stickerCenterY = rect.bottom - halfY * rect.height
            break
          default: // top-left
            stickerCenterX = rect.left + halfX * rect.width
            stickerCenterY = rect.top + halfY * rect.height
        }
        const angle = Math.atan2(clientY - stickerCenterY, clientX - stickerCenterX)
        const degrees = ((angle * 180) / Math.PI + 90 + 360) % 360
        onStickerRotate(rotateOriginalIndex, Math.round(degrees))
      }
    }

    const handleEnd = () => {
      setDragMode(null)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [dragMode, selectedIndex, visibleStickers, onStickerMove, onStickerResize, onStickerRotate, getPointerPosition])

  if (visibleStickers.length === 0) return null

  const handleStickerClick = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    if (!editable) return
    e.stopPropagation()
    setSelectedIndex(index)
  }

  const handleMoveStart = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    if (!editable || !onStickerMove) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedIndex(index)
    setDragMode('move')
  }

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    if (!editable || !onStickerResize || !containerRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const { clientX, clientY } = getPointerPosition(e)
    dragStartRef.current = { x: clientX, y: clientY, value: visibleStickers[index].sticker.size }
    setDragMode('resize')
  }

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!editable || !onStickerRotate) return
    e.preventDefault()
    e.stopPropagation()
    setDragMode('rotate')
  }

  // Determine base z-index based on layer prop
  // back layer: 0 (behind content), front layer: 10 (above content)
  const baseZIndex = layer === 'back' ? 0 : 10

  return (
    <div
      ref={containerRef}
      className="sticker-container"
      style={{ position: 'absolute', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
    >
      {visibleStickers.map(({ sticker, originalIndex }, index) => {
        const isSelected = selectedIndex === index
        const isDragging = isSelected && dragMode !== null
        const positionStyle = getPositionStyle(sticker)

        return (
          <div
            key={index}
            className={`sticker-wrapper ${isSelected ? 'sticker-selected' : ''} ${isDragging ? 'sticker-dragging' : ''}`}
            style={{
              ...positionStyle,
              zIndex: isSelected ? 100 : baseZIndex,
            }}
            onClick={(e) => handleStickerClick(e, index)}
            onTouchEnd={(e) => handleStickerClick(e, index)}
          >
            <img
              src={sticker.url}
              alt=""
              className="post-sticker"
              style={{ width: '100%', height: 'auto' }}
              loading="lazy"
              draggable={false}
              onMouseDown={(e) => handleMoveStart(e, index)}
              onTouchStart={(e) => handleMoveStart(e, index)}
            />

            {editable && isSelected && (
              <>
                {/* Bounding box */}
                <div className="sticker-bbox" />

                {/* Resize handles (corners) */}
                <div
                  className="sticker-handle sticker-handle-resize sticker-handle-se"
                  onMouseDown={(e) => handleResizeStart(e, index)}
                  onTouchStart={(e) => handleResizeStart(e, index)}
                />
                <div
                  className="sticker-handle sticker-handle-resize sticker-handle-sw"
                  onMouseDown={(e) => handleResizeStart(e, index)}
                  onTouchStart={(e) => handleResizeStart(e, index)}
                />
                <div
                  className="sticker-handle sticker-handle-resize sticker-handle-ne"
                  onMouseDown={(e) => handleResizeStart(e, index)}
                  onTouchStart={(e) => handleResizeStart(e, index)}
                />
                <div
                  className="sticker-handle sticker-handle-resize sticker-handle-nw"
                  onMouseDown={(e) => handleResizeStart(e, index)}
                  onTouchStart={(e) => handleResizeStart(e, index)}
                />

                {/* Rotate handle (top center) */}
                <div className="sticker-rotate-line" />
                <div
                  className="sticker-handle sticker-handle-rotate"
                  onMouseDown={handleRotateStart}
                  onTouchStart={handleRotateStart}
                />

                {/* Layer toggle switch (bottom center) - iOS style vertical */}
                {onStickerLayerChange && (
                  <>
                    <div className="sticker-layer-line" />
                    <div
                      className={`sticker-layer-toggle ${sticker.layer === 'back' ? 'sticker-layer-back' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const newLayer = sticker.layer === 'back' ? 'front' : 'back'
                        onStickerLayerChange(originalIndex, newLayer)
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        const newLayer = sticker.layer === 'back' ? 'front' : 'back'
                        onStickerLayerChange(originalIndex, newLayer)
                      }}
                      title={sticker.layer === 'back' ? 'Move to front' : 'Move to back'}
                    >
                      <div className="sticker-layer-knob" />
                    </div>
                  </>
                )}

                {/* Delete button (top-left outside) */}
                {onStickerRemove && (
                  <button
                    type="button"
                    className="sticker-handle sticker-handle-delete"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStickerRemove(originalIndex)
                      setSelectedIndex(null)
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onStickerRemove(originalIndex)
                      setSelectedIndex(null)
                    }}
                    title="Delete sticker"
                  >
                    <X size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
