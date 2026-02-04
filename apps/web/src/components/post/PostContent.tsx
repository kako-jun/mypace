import { renderContent } from '../../lib/parser'
import { PostEmbeds } from '../embed'
import { TextButton, Icon } from '../ui'
import { LIMITS } from '../../lib/constants'
import { hasTeaserTag as checkTeaserTag, removeReadMoreLink, getTeaserColor } from '../../lib/nostr/tags'
import { STELLA_COLORS } from '../../lib/nostr/events'
import type { EmojiTag, ProfileMap, Event, OgpData } from '../../types'
import '../../styles/components/word-highlight.css'

interface PostContentProps {
  content: string
  truncate?: boolean
  forceTruncate?: boolean // Always show READ MORE regardless of content length
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  wikidataMap?: Record<string, string> // Super-mention path -> Wikidata ID mapping
  ogpMap?: Record<string, OgpData> // URL -> OGP data mapping
  enableOgpFallback?: boolean // Enable OGP fetching for direct page access
  onReadMore?: () => void
  tags?: string[][] // Event tags for fold detection
  // Wordrot props
  wordrotWords?: string[]
  wordrotCollected?: Set<string>
  onWordClick?: (word: string) => void
}

export function PostContent({
  content,
  truncate = false,
  forceTruncate = false,
  emojis = [],
  profiles = {},
  wikidataMap = {},
  ogpMap = {},
  enableOgpFallback = false,
  onReadMore,
  tags,
  wordrotWords,
  wordrotCollected,
  onWordClick,
}: PostContentProps) {
  // If event has teaser tag, content is already properly sized (280 chars + READ MORE link)
  // So we skip GUI truncation for long posts with teaser
  const hasTeaser = tags ? checkTeaserTag({ tags } as Event) : false
  const teaserColor = tags ? getTeaserColor(tags) : undefined
  const hasColorRequirement = !!teaserColor

  const shouldTruncate =
    truncate &&
    (forceTruncate ||
      (!hasTeaser &&
        (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH ||
          content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)))

  // For teaser posts in timeline, remove the READ MORE URL and show styled button instead
  const displayContent = hasTeaser && truncate ? removeReadMoreLink(content) : content

  // Get lock icon color based on teaser color
  const getLockColor = () => {
    if (!teaserColor) return undefined
    const colorInfo = STELLA_COLORS[teaserColor as keyof typeof STELLA_COLORS]
    return colorInfo?.hex
  }

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH), emojis, profiles, wikidataMap)}
          <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
            … READ MORE
          </TextButton>
        </>
      ) : (
        <>
          {renderContent(displayContent, emojis, profiles, wikidataMap)}
          {hasTeaser && truncate && (
            <TextButton variant="primary" className="read-more-btn teaser-read-more" onClick={onReadMore}>
              … READ MORE
              {hasColorRequirement && (
                <>
                  <span style={{ marginLeft: '0.25rem', color: getLockColor(), display: 'inline-flex' }}>
                    <Icon name="Lock" size={14} />
                  </span>
                  <span style={{ marginLeft: '0.25rem' }}>
                    Requires {STELLA_COLORS[teaserColor as keyof typeof STELLA_COLORS]?.label} Stella
                  </span>
                </>
              )}
            </TextButton>
          )}
        </>
      )}
      <PostEmbeds content={displayContent} ogpMap={ogpMap} enableOgpFallback={enableOgpFallback} />

      {/* Wordrot collectible words */}
      {wordrotWords && wordrotWords.length > 0 && onWordClick && (
        <div className="wordrot-collect-section">
          {wordrotWords.map((word) => {
            const isCollected = wordrotCollected?.has(word)
            return (
              <button
                key={word}
                className={`wordrot-highlight ${isCollected ? 'collected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onWordClick(word)
                }}
                title={isCollected ? `${word} (collected)` : `Collect: ${word}`}
              >
                {word}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
