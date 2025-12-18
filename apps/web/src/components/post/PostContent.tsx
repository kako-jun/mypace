import { renderContent } from '../../lib/content-parser'
import { PostEmbeds } from '../embed'
import { LIMITS } from '../../lib/constants'
import { hasFoldTag as checkFoldTag } from '../../lib/nostr/tags'
import type { EmojiTag, Profile, Event } from '../../types'

interface PostContentProps {
  content: string
  truncate?: boolean
  emojis?: EmojiTag[]
  profiles?: Record<string, Profile | null | undefined>
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
  // If event has fold tag, content is already properly sized (280 chars + READ MORE link)
  // So we skip GUI truncation for mypace long posts
  const hasFold = tags ? checkFoldTag({ tags } as Event) : false

  const shouldTruncate =
    truncate &&
    !hasFold &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH), emojis, profiles)}
          <button
            className="read-more-btn text-outlined text-outlined-button text-outlined-primary"
            onClick={onReadMore}
          >
            … READ MORE
          </button>
        </>
      ) : (
        renderContent(content, emojis, profiles)
      )}
      <PostEmbeds content={content} />
    </>
  )
}
