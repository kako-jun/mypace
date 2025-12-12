import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import { parseEmojiTags } from '../ui'
import type { Event, EmojiTag } from '../../types'

interface ReplyCardProps {
  reply: Event
  displayName: string
  avatarUrl: string | null
  isProfileLoading?: boolean
  emojis?: EmojiTag[]
  onClick?: () => void
}

export default function ReplyCard({
  reply,
  displayName,
  avatarUrl,
  isProfileLoading,
  emojis,
  onClick,
}: ReplyCardProps) {
  // Reply cards don't apply theme styling - they inherit from parent post-card's light theme
  return (
    <article className="reply-card" onClick={onClick}>
      <PostHeader
        pubkey={reply.pubkey}
        createdAt={reply.created_at}
        displayName={displayName}
        avatarUrl={avatarUrl}
        isProfileLoading={isProfileLoading}
        emojis={emojis}
      />
      <div className="post-content">
        <PostContent content={reply.content} emojis={parseEmojiTags(reply.tags)} />
      </div>
    </article>
  )
}
