import type { Event } from 'nostr-tools'
import { renderContent } from '../../lib/content-parser'
import { formatTimestamp, getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { Avatar } from '../ui'

interface ThreadRepliesProps {
  replies: Event[]
  expanded: boolean
  onToggle: () => void
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export default function ThreadReplies({
  replies,
  expanded,
  onToggle,
  getDisplayName,
  getAvatarUrl,
}: ThreadRepliesProps) {
  if (replies.length === 0) return null

  return (
    <div class="thread-section">
      <button class="thread-toggle" onClick={onToggle}>
        {expanded ? '▼' : '▶'} {replies.length} replies
      </button>

      {expanded && (
        <div class="thread-replies">
          {replies.map((reply) => {
            const themeColors = getEventThemeColors(reply)
            const themeProps = getThemeCardProps(themeColors)

            return (
              <div key={reply.id} class={`reply-card ${themeProps.className}`} style={themeProps.style}>
                <header class="reply-header">
                  <Avatar src={getAvatarUrl(reply.pubkey)} size="small" />
                  <div class="reply-author-info">
                    <span class="author-name">{getDisplayName(reply.pubkey)}</span>
                    <time class="timestamp">{formatTimestamp(reply.created_at)}</time>
                  </div>
                </header>
                <div class="reply-content">{renderContent(reply.content)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
