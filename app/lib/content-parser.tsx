import type { JSX } from 'hono/jsx'

// Callback for hashtag clicks
let onHashtagClick: ((tag: string) => void) | null = null

export function setHashtagClickHandler(handler: (tag: string) => void) {
  onHashtagClick = handler
}

export function clearHashtagClickHandler() {
  onHashtagClick = null
}

// URL regex (http/https)
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g

// Image URL extensions
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?$/i

// Hashtag regex (supports ASCII and Japanese characters)
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g

interface ContentPart {
  type: 'text' | 'url' | 'image' | 'hashtag'
  value: string
}

export function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  let lastIndex = 0

  // Combined regex to match URLs and hashtags
  const combinedRegex = new RegExp(
    `(${URL_REGEX.source})|(${HASHTAG_REGEX.source})`,
    'g'
  )

  let match
  while ((match = combinedRegex.exec(content)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.slice(lastIndex, match.index),
      })
    }

    if (match[1]) {
      // URL match
      const url = match[1]
      if (IMAGE_EXTENSIONS.test(url)) {
        parts.push({ type: 'image', value: url })
      } else {
        parts.push({ type: 'url', value: url })
      }
    } else if (match[3]) {
      // Hashtag match (match[3] is the full hashtag, match[4] is the tag without #)
      parts.push({ type: 'hashtag', value: match[3] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      value: content.slice(lastIndex),
    })
  }

  return parts
}

export function renderContent(content: string): JSX.Element {
  const parts = parseContent(content)

  return (
    <>
      {parts.map((part, i) => {
        switch (part.type) {
          case 'url':
            return (
              <a
                key={i}
                href={part.value}
                target="_blank"
                rel="noopener noreferrer"
                class="content-link"
              >
                {part.value}
              </a>
            )
          case 'image':
            return (
              <span key={i} class="content-image-wrapper">
                <a
                  href={part.value}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={part.value}
                    alt=""
                    class="content-image"
                    loading="lazy"
                  />
                </a>
              </span>
            )
          case 'hashtag':
            const tag = part.value.slice(1) // Remove #
            return (
              <button
                key={i}
                class="content-hashtag"
                onClick={() => onHashtagClick?.(tag)}
              >
                {part.value}
              </button>
            )
          default:
            return <span key={i}>{part.value}</span>
        }
      })}
    </>
  )
}
