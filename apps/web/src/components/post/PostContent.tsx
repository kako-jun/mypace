import { renderContent } from '../../lib/parser'
import { PostEmbeds } from '../embed'
import { TextButton } from '../ui'
import { LIMITS } from '../../lib/constants'
import { hasTeaserTag as checkTeaserTag, removeReadMoreLink } from '../../lib/nostr/tags'
import type { EmojiTag, ProfileMap, Event, OgpData } from '../../types'

interface PostContentProps {
  content: string
  truncate?: boolean
  forceTruncate?: boolean // Always show READ MORE regardless of content length
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  wikidataMap?: Record<string, string> // Super-mention path -> Wikidata ID mapping
  ogpMap?: Record<string, OgpData> // URL -> OGP data mapping
  onReadMore?: () => void
  tags?: string[][] // Event tags for fold detection
}

export function PostContent({
  content,
  truncate = false,
  forceTruncate = false,
  emojis = [],
  profiles = {},
  wikidataMap = {},
  ogpMap = {},
  onReadMore,
  tags,
}: PostContentProps) {
  // If event has teaser tag, content is already properly sized (280 chars + READ MORE link)
  // So we skip GUI truncation for long posts with teaser
  const hasTeaser = tags ? checkTeaserTag({ tags } as Event) : false

  const shouldTruncate =
    truncate &&
    (forceTruncate ||
      (!hasTeaser &&
        (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH ||
          content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)))

  // For teaser posts in timeline, remove the READ MORE URL and show styled button instead
  const displayContent = hasTeaser && truncate ? removeReadMoreLink(content) : content

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
            <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
              … READ MORE
            </TextButton>
          )}
        </>
      )}
      <PostEmbeds content={displayContent} ogpMap={ogpMap} />
    </>
  )
}
