import { formatTimestamp } from '../../lib/nostr/events'

interface PostHeaderProps {
  pubkey: string
  createdAt: number
  displayName: string
  avatarUrl: string | null
  avatarClass?: string
}

export default function PostHeader({
  pubkey,
  createdAt,
  displayName,
  avatarUrl,
  avatarClass = 'post-avatar'
}: PostHeaderProps) {
  const placeholderClass = avatarClass === 'reply-avatar'
    ? 'reply-avatar-placeholder'
    : 'post-avatar-placeholder'

  return (
    <header class="post-header">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" class={avatarClass} />
      ) : (
        <div class={placeholderClass} />
      )}
      <div class="post-author-info">
        <span class="author-name">{displayName}</span>
        <time class="timestamp">{formatTimestamp(createdAt)}</time>
      </div>
    </header>
  )
}
