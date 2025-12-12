import { renderContent } from '../../lib/content-parser'
import { PostEmbeds } from '../embed'
import { LIMITS } from '../../lib/constants'
import type { EmojiTag, Profile } from '../../types'

interface PostContentProps {
  content: string
  truncate?: boolean
  emojis?: EmojiTag[]
  profiles?: Record<string, Profile | null | undefined>
}

export function PostContent({ content, truncate = false, emojis = [], profiles = {} }: PostContentProps) {
  const shouldTruncate =
    truncate &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH) + '...', emojis, profiles)}
          <span className="read-more-text">続きを読む</span>
        </>
      ) : (
        renderContent(content, emojis, profiles)
      )}
      <PostEmbeds content={content} />
    </>
  )
}
