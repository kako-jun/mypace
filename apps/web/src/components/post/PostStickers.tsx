import { useState, useRef } from 'react'
import type { Sticker } from '../../types'

interface PostStickersProps {
  stickers: Sticker[]
  editable?: boolean
  onStickerMove?: (index: number, x: number, y: number) => void
}

export function PostStickers({ stickers, editable = false, onStickerMove }: PostStickersProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (stickers.length === 0) return null

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if (!editable || !onStickerMove) return
    e.preventDefault()
    setDraggingIndex(index)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIndex === null || !editable || !onStickerMove || !containerRef.current) return

    const container = containerRef.current.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // 範囲制限: 0-100%
    const clampedX = Math.max(0, Math.min(100, x))
    const clampedY = Math.max(0, Math.min(100, y))

    onStickerMove(draggingIndex, clampedX, clampedY)
  }

  const handleMouseUp = () => {
    setDraggingIndex(null)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ position: 'absolute', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}
    >
      {stickers.map((sticker, index) => (
        <img
          key={index}
          src={sticker.url}
          alt=""
          className={`post-sticker ${editable ? 'post-sticker-editable' : ''} ${draggingIndex === index ? 'post-sticker-dragging' : ''}`}
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            width: `${sticker.size}%`,
          }}
          loading="lazy"
          onMouseDown={(e) => handleMouseDown(e, index)}
          draggable={false}
        />
      ))}
    </div>
  )
}
