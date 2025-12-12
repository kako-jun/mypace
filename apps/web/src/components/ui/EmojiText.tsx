import { useMemo } from 'react'
import type { EmojiTag } from '../../types'

interface EmojiTextProps {
  text: string
  emojis?: EmojiTag[]
  className?: string
}

// Parse emoji tags from event tags array
export function parseEmojiTags(tags: string[][] | undefined): EmojiTag[] {
  if (!tags) return []
  return tags.filter((tag) => tag[0] === 'emoji' && tag[1] && tag[2]).map((tag) => ({ shortcode: tag[1], url: tag[2] }))
}

export default function EmojiText({ text, emojis = [], className = '' }: EmojiTextProps) {
  const parts = useMemo(() => {
    if (!emojis.length) return [{ type: 'text' as const, content: text }]

    const emojiMap = new Map(emojis.map((e) => [e.shortcode, e.url]))
    const result: Array<{ type: 'text'; content: string } | { type: 'emoji'; shortcode: string; url: string }> = []

    // Match :shortcode: pattern
    const regex = /:([a-zA-Z0-9_]+):/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      const shortcode = match[1]
      const url = emojiMap.get(shortcode)

      // Add text before this match
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }

      if (url) {
        result.push({ type: 'emoji', shortcode, url })
      } else {
        // No emoji found for this shortcode, keep as text
        result.push({ type: 'text', content: match[0] })
      }

      lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex) })
    }

    return result
  }, [text, emojis])

  return (
    <span className={`emoji-text ${className}`}>
      {parts.map((part, i) =>
        part.type === 'emoji' ? (
          <img key={i} src={part.url} alt={`:${part.shortcode}:`} className="custom-emoji" loading="lazy" />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </span>
  )
}
