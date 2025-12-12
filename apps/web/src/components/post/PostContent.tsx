import { renderContent } from '../../lib/content-parser'
import { PostEmbeds } from '../embed'
import { LIMITS } from '../../lib/constants'
import type { EmojiTag } from '../../types'

interface PostContentProps {
  content: string
  truncate?: boolean
  emojis?: EmojiTag[]
}

export function PostContent({ content, truncate = false, emojis = [] }: PostContentProps) {
  const shouldTruncate =
    truncate &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH) + '...', emojis)}
          <span className="read-more-text">続きを読む</span>
        </>
      ) : (
        renderContent(content, emojis)
      )}
      <PostEmbeds content={content} />
    </>
  )
}
