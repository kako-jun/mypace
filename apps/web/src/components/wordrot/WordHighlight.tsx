import { useMemo, type ReactNode } from 'react'
import '../../styles/components/word-highlight.css'

interface WordHighlightProps {
  content: string
  words: string[]
  onWordClick?: (word: string) => void
  collectedWords?: Set<string>
}

/**
 * Highlights collectible words in post content
 * Words are matched case-insensitively but displayed with original casing
 */
export function WordHighlight({ content, words, onWordClick, collectedWords }: WordHighlightProps) {
  const segments = useMemo(() => {
    if (!words || words.length === 0) {
      return [{ type: 'text' as const, content }]
    }

    // Build a regex pattern that matches any of the words
    // Sort by length descending to match longer words first
    const sortedWords = [...words].sort((a, b) => b.length - a.length)

    // Escape special regex characters
    const escapedWords = sortedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    // Create pattern that matches whole words (using word boundaries where possible)
    // For Japanese, we can't use \b, so we use lookahead/lookbehind for word boundaries
    const pattern = escapedWords.map((w) => `(${w})`).join('|')
    const regex = new RegExp(pattern, 'gi')

    const result: Array<{ type: 'text' | 'word'; content: string; word?: string }> = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: content.slice(lastIndex, match.index) })
      }

      // Find which word was matched (case-insensitive)
      const matchedText = match[0]
      const matchedWord = words.find((w) => w.toLowerCase() === matchedText.toLowerCase()) || matchedText

      result.push({
        type: 'word',
        content: matchedText,
        word: matchedWord,
      })

      lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({ type: 'text', content: content.slice(lastIndex) })
    }

    return result.length > 0 ? result : [{ type: 'text' as const, content }]
  }, [content, words])

  const handleWordClick = (word: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onWordClick?.(word)
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>
        }

        const isCollected = collectedWords?.has(segment.word!)
        const className = `wordrot-highlight ${isCollected ? 'collected' : ''}`

        return (
          <button key={index} className={className} onClick={(e) => handleWordClick(segment.word!, e)}>
            {segment.content}
          </button>
        )
      })}
    </>
  )
}

/**
 * Wraps content and applies word highlighting
 * Returns the original children if no words to highlight
 */
export function WordHighlightWrapper({
  children,
  textContent,
  words,
  onWordClick,
  collectedWords,
}: {
  children: ReactNode
  textContent?: string
  words?: string[]
  onWordClick?: (word: string) => void
  collectedWords?: Set<string>
}) {
  // If no words to highlight or no text content, return children as-is
  if (!words || words.length === 0 || !textContent) {
    return <>{children}</>
  }

  // Replace children with highlighted version
  return <WordHighlight content={textContent} words={words} onWordClick={onWordClick} collectedWords={collectedWords} />
}
