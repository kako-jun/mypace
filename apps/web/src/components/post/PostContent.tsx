import { renderContent } from '../../lib/content-parser'
import { PostEmbeds } from '../embed'
import { LIMITS } from '../../lib/constants'

interface PostContentProps {
  content: string
  truncate?: boolean
}

export function PostContent({ content, truncate = false }: PostContentProps) {
  const shouldTruncate =
    truncate &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH) + '...')}
          <span className="read-more-text">続きを読む</span>
        </>
      ) : (
        renderContent(content)
      )}
      <PostEmbeds content={content} />
    </>
  )
}
