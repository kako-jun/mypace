import type { Event } from '../../types'
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
    <div className="thread-section">
      <button className="thread-toggle" onClick={onToggle}>
        {expanded ? '▼' : '▶'} {replies.length} replies
      </button>

      {expanded && (
        <div className="thread-replies">
          {replies.map((reply) => {
            const themeColors = getEventThemeColors(reply)
            const themeProps = getThemeCardProps(themeColors)

            return (
              <div key={reply.id} className={`reply-card ${themeProps.className}`} style={themeProps.style}>
                <header className="reply-header">
                  <Avatar src={getAvatarUrl(reply.pubkey)} size="small" />
                  <div className="reply-author-info">
                    <span className="author-name">{getDisplayName(reply.pubkey)}</span>
                    <time className="timestamp">{formatTimestamp(reply.created_at)}</time>
                  </div>
                </header>
                <div className="reply-content">{renderContent(reply.content)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
