import { formatTimestamp } from '../../lib/nostr/events'
import { navigateToUser } from '../../lib/utils'
import { Avatar } from '../ui'

interface PostHeaderProps {
  pubkey: string
  createdAt: number
  displayName: string
  avatarUrl: string | null
  avatarSize?: 'small' | 'medium'
  clickable?: boolean
}

export default function PostHeader({
  pubkey,
  createdAt,
  displayName,
  avatarUrl,
  avatarSize = 'medium',
  clickable = true,
}: PostHeaderProps) {
  const handleUserClick = (e: Event) => {
    e.stopPropagation()
    navigateToUser(pubkey)
  }

  return (
    <header class="post-header">
      {clickable ? (
        <button class="post-header-user" onClick={handleUserClick}>
          <Avatar src={avatarUrl} size={avatarSize} />
          <div class="post-author-info">
            <span class="author-name">{displayName}</span>
            <time class="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </button>
      ) : (
        <>
          <Avatar src={avatarUrl} size={avatarSize} />
          <div class="post-author-info">
            <span class="author-name">{displayName}</span>
            <time class="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </>
      )}
    </header>
  )
}
