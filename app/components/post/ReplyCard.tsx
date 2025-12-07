import { renderContent } from '../../lib/content-parser'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import PostHeader from './PostHeader'
import type { Event } from 'nostr-tools'

interface ReplyCardProps {
  reply: Event
  displayName: string
  avatarUrl: string | null
  onClick?: () => void
}

export default function ReplyCard({ reply, displayName, avatarUrl, onClick }: ReplyCardProps) {
  const themeColors = getEventThemeColors(reply)
  const themeProps = getThemeCardProps(themeColors)

  return (
    <article class={`post-card reply-card ${themeProps.className}`} style={themeProps.style} onClick={onClick}>
      <PostHeader
        pubkey={reply.pubkey}
        createdAt={reply.created_at}
        displayName={displayName}
        avatarUrl={avatarUrl}
        avatarClass="post-avatar"
      />
      <div class="post-content">{renderContent(reply.content)}</div>
    </article>
  )
}
