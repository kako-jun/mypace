import { renderContent } from '../../lib/content-parser'
import { PostEmbeds } from '../embed'
import { TextButton } from '../ui'
import { LIMITS } from '../../lib/constants'
import { hasTeaserTag as checkTeaserTag, removeReadMoreLink } from '../../lib/nostr/tags'
import type { EmojiTag, ProfileMap, Event } from '../../types'

interface PostContentProps {
  content: string
  truncate?: boolean
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  onReadMore?: () => void
  tags?: string[][] // Event tags for fold detection
}

export function PostContent({
  content,
  truncate = false,
  emojis = [],
  profiles = {},
  onReadMore,
  tags,
}: PostContentProps) {
  // If event has teaser tag, content is already properly sized (280 chars + READ MORE link)
  // So we skip GUI truncation for long posts with teaser
  const hasTeaser = tags ? checkTeaserTag({ tags } as Event) : false

  const shouldTruncate =
    truncate &&
    !hasTeaser &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  // For teaser posts in timeline, remove the READ MORE URL and show styled button instead
  const displayContent = hasTeaser && truncate ? removeReadMoreLink(content) : content

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH), emojis, profiles)}
          <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
            … READ MORE
          </TextButton>
        </>
      ) : (
        <>
          {renderContent(displayContent, emojis, profiles)}
          {hasTeaser && truncate && (
            <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
              … READ MORE
            </TextButton>
          )}
        </>
      )}
      <PostEmbeds content={displayContent} />
    </>
  )
}
