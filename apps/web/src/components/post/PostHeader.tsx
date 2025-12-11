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
  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigateToUser(pubkey)
  }

  return (
    <header className="post-header">
      {clickable ? (
        <button className="post-header-user" onClick={handleUserClick}>
          <Avatar src={avatarUrl} size={avatarSize} />
          <div className="post-author-info">
            <span className="author-name">{displayName}</span>
            <time className="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </button>
      ) : (
        <>
          <Avatar src={avatarUrl} size={avatarSize} />
          <div className="post-author-info">
            <span className="author-name">{displayName}</span>
            <time className="timestamp">{formatTimestamp(createdAt)}</time>
          </div>
        </>
      )}
    </header>
  )
}
