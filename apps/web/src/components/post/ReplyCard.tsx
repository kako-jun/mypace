import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import type { Event } from '../../types'

interface ReplyCardProps {
  reply: Event
  displayName: string
  avatarUrl: string | null
  isProfileLoading?: boolean
  onClick?: () => void
}

export default function ReplyCard({ reply, displayName, avatarUrl, isProfileLoading, onClick }: ReplyCardProps) {
  const themeColors = getEventThemeColors(reply)
  const themeProps = getThemeCardProps(themeColors)

  return (
    <article className={`post-card reply-card ${themeProps.className}`} style={themeProps.style} onClick={onClick}>
      <PostHeader
        pubkey={reply.pubkey}
        createdAt={reply.created_at}
        displayName={displayName}
        avatarUrl={avatarUrl}
        isProfileLoading={isProfileLoading}
      />
      <div className="post-content">
        <PostContent content={reply.content} />
      </div>
    </article>
  )
}
