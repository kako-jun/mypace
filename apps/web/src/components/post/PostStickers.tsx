import { useState, useRef, useEffect, useCallback } from 'react'
import type { Sticker } from '../../types'

interface PostStickersProps {
  stickers: Sticker[]
  editable?: boolean
  onStickerMove?: (index: number, x: number, y: number) => void
  onStickerResize?: (index: number, size: number) => void
  onStickerRotate?: (index: number, rotation: number) => void
}

type DragMode = 'move' | 'resize' | 'rotate' | null

export function PostStickers({
  stickers,
  editable = false,
  onStickerMove,
  onStickerResize,
  onStickerRotate,
}: PostStickersProps) {
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
        const x = ((clientX - rect.left) / rect.width) * 100
        const y = ((clientY - rect.top) / rect.height) * 100
        const clampedX = Math.max(0, Math.min(100, x))
        const clampedY = Math.max(0, Math.min(100, y))
        onStickerMove(selectedIndex, clampedX, clampedY)
      } else if (dragMode === 'resize' && onStickerResize && dragStartRef.current) {
        const sticker = stickers[selectedIndex]
        const stickerCenterX = rect.left + (sticker.x / 100) * rect.width
        const stickerCenterY = rect.top + (sticker.y / 100) * rect.height
        const distStart = Math.sqrt(
          Math.pow(dragStartRef.current.x - stickerCenterX, 2) + Math.pow(dragStartRef.current.y - stickerCenterY, 2)
        )
        const distCurrent = Math.sqrt(Math.pow(clientX - stickerCenterX, 2) + Math.pow(clientY - stickerCenterY, 2))
        const scale = distCurrent / distStart
        const newSize = Math.max(5, Math.min(100, dragStartRef.current.value * scale))
        onStickerResize(selectedIndex, newSize)
      } else if (dragMode === 'rotate' && onStickerRotate) {
        const sticker = stickers[selectedIndex]
        const stickerCenterX = rect.left + (sticker.x / 100) * rect.width
        const stickerCenterY = rect.top + (sticker.y / 100) * rect.height
        const angle = Math.atan2(clientY - stickerCenterY, clientX - stickerCenterX)
        const degrees = ((angle * 180) / Math.PI + 90 + 360) % 360
        onStickerRotate(selectedIndex, Math.round(degrees))
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
  }, [dragMode, selectedIndex, stickers, onStickerMove, onStickerResize, onStickerRotate, getPointerPosition])

  if (stickers.length === 0) return null

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
    dragStartRef.current = { x: clientX, y: clientY, value: stickers[index].size }
    setDragMode('resize')
  }

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!editable || !onStickerRotate) return
    e.preventDefault()
    e.stopPropagation()
    setDragMode('rotate')
  }

  return (
    <div
      ref={containerRef}
      className="sticker-container"
      style={{ position: 'absolute', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
    >
      {stickers.map((sticker, index) => {
        const isSelected = selectedIndex === index
        const isDragging = isSelected && dragMode !== null

        return (
          <div
            key={index}
            className={`sticker-wrapper ${isSelected ? 'sticker-selected' : ''} ${isDragging ? 'sticker-dragging' : ''}`}
            style={{
              position: 'absolute',
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              width: `${sticker.size}%`,
              zIndex: isSelected ? 100 : 10,
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
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
