import { useState } from 'react'
import { navigateTo } from '../../lib/utils'

interface WordrotImagesProps {
  words: string[]
  collected: Set<string>
  images: Record<string, string | null>
}

export function WordrotImages({ words, collected, images }: WordrotImagesProps) {
  const [tooltip, setTooltip] = useState<{ word: string; x: number; y: number } | null>(null)
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Filter words that are collected and have images
  const displayWords = words.filter((word) => collected.has(word) && images[word])

  // Don't render anything if there are no words to display
  if (displayWords.length === 0) return null

  const handleWordClick = (word: string) => {
    // Create anchor ID from word text (sanitized for URL)
    const anchorId = `word-${word.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    // Navigate to inventory page with the word as query parameter, wordrot tab, and anchor
    navigateTo(`/inventory?tab=wordrot&word=${encodeURIComponent(word)}#${anchorId}`)
  }

  const handleLongPressStart = (word: string, e: React.TouchEvent | React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top - 10

    const timer = setTimeout(() => {
      setTooltip({ word, x, y })
    }, 500)

    setLongPressTimer(timer)
  }

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handleTooltipClose = () => {
    setTooltip(null)
  }

  return (
    <>
      <div className="wordrot-images-container">
        {displayWords.map((word) => (
          <button
            key={word}
            className="wordrot-image-button"
            onClick={(e) => {
              e.stopPropagation()
              handleWordClick(word)
            }}
            onTouchStart={(e) => handleLongPressStart(word, e)}
            onTouchEnd={handleLongPressEnd}
            onTouchCancel={handleLongPressEnd}
            onMouseDown={(e) => handleLongPressStart(word, e)}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img src={images[word]!} alt={word} className="wordrot-image" draggable={false} />
          </button>
        ))}
      </div>

      {/* Custom tooltip */}
      {tooltip && (
        <div
          className="wordrot-image-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
          onClick={handleTooltipClose}
        >
          {tooltip.word}
        </div>
      )}
    </>
  )
}
