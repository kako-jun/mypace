import type { Event, ProfileCache } from '../../types'
import '../../styles/components/thread.css'
import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import { parseEmojiTags } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { navigateToPost } from '../../lib/utils'

interface ThreadRepliesProps {
  replies: Event[]
  expanded: boolean
  onToggle: () => void
  profiles: ProfileCache
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export default function ThreadReplies({
  replies,
  expanded,
  onToggle,
  profiles,
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
            const themeProps = getThemeCardProps(getEventThemeColors(reply))
            return (
              <div key={reply.id} className={`reply-card ${themeProps.className}`} style={themeProps.style}>
                <PostHeader
                  pubkey={reply.pubkey}
                  createdAt={reply.created_at}
                  displayName={getDisplayName(reply.pubkey)}
                  avatarUrl={getAvatarUrl(reply.pubkey)}
                  avatarSize="small"
                  clickable={false}
                  isProfileLoading={profiles[reply.pubkey] === undefined}
                  emojis={profiles[reply.pubkey]?.emojis}
                  eventKind={reply.kind}
                />
                <div className="post-content">
                  <PostContent
                    content={reply.content}
                    emojis={parseEmojiTags(reply.tags)}
                    profiles={profiles}
                    truncate={true}
                    tags={reply.tags}
                    onReadMore={() => navigateToPost(reply.id)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
