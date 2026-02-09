import { navigateTo } from '../../lib/utils'

interface WordrotImagesProps {
  words: string[]
  collected: Set<string>
  images: Record<string, string | null>
}

export function WordrotImages({ words, collected, images }: WordrotImagesProps) {
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

  return (
    <div className="wordrot-images-container">
      {displayWords.map((word) => (
        <button
          key={word}
          className="wordrot-image-button"
          onClick={(e) => {
            e.stopPropagation()
            handleWordClick(word)
          }}
          title={word}
        >
          <img src={images[word]!} alt={word} className="wordrot-image" />
        </button>
      ))}
    </div>
  )
}
