import { formatTimestamp } from '../../lib/nostr/events'
import { navigateToUser } from '../../lib/utils'

interface PostHeaderProps {
  pubkey: string
  createdAt: number
  displayName: string
  avatarUrl: string | null
  avatarClass?: string
  clickable?: boolean
}

export default function PostHeader({
  pubkey,
  createdAt,
  displayName,
  avatarUrl,
  avatarClass = 'post-avatar',
  clickable = true,
}: PostHeaderProps) {
  const placeholderClass = avatarClass === 'reply-avatar' ? 'reply-avatar-placeholder' : 'post-avatar-placeholder'

  const handleUserClick = (e: Event) => {
    e.stopPropagation()
    navigateToUser(pubkey)
  }

  return (
    <header class="post-header">
      {clickable ? (
        <button class="post-header-user" onClick={handleUserClick}>
          {avatarUrl ? <img src={avatarUrl} alt="" class={avatarClass} /> : <div class={placeholderClass} />}
          <div class="post-author-info">
            <span class="author-name">{displayName}</span>
            <time class="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </button>
      ) : (
        <>
          {avatarUrl ? <img src={avatarUrl} alt="" class={avatarClass} /> : <div class={placeholderClass} />}
          <div class="post-author-info">
            <span class="author-name">{displayName}</span>
            <time class="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </>
      )}
    </header>
  )
}
