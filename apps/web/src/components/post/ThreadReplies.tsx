import type { Event, ProfileCache } from '../../types'
import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import { parseEmojiTags } from '../ui'

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
          {replies.map((reply) => (
            // Reply cards don't apply theme styling - they inherit from parent post-card's light theme
            <div key={reply.id} className="reply-card">
              <PostHeader
                pubkey={reply.pubkey}
                createdAt={reply.created_at}
                displayName={getDisplayName(reply.pubkey)}
                avatarUrl={getAvatarUrl(reply.pubkey)}
                avatarSize="small"
                clickable={false}
                isProfileLoading={profiles[reply.pubkey] === undefined}
                emojis={profiles[reply.pubkey]?.emojis}
              />
              <div className="reply-content">
                <PostContent content={reply.content} emojis={parseEmojiTags(reply.tags)} profiles={profiles} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
