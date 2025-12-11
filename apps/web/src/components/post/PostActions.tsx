import { Icon } from '../ui'

interface PostActionsProps {
  isMyPost: boolean
  reactions: { count: number; myReaction: boolean } | undefined
  replies: { count: number } | undefined
  reposts: { count: number; myRepost: boolean } | undefined
  likingId: string | null
  repostingId: string | null
  eventId: string
  copied: boolean
  onLike: () => void
  onReply: () => void
  onRepost: () => void
  onShare: () => void
}

export default function PostActions({
  isMyPost,
  reactions,
  replies,
  reposts,
  likingId,
  repostingId,
  eventId,
  copied,
  onLike,
  onReply,
  onRepost,
  onShare,
}: PostActionsProps) {
  return (
    <>
      {!isMyPost && (
        <button
          className={`like-button ${reactions?.myReaction ? 'liked' : ''}`}
          onClick={onLike}
          disabled={likingId === eventId || reactions?.myReaction}
          aria-label={reactions?.myReaction ? 'Liked' : 'Like this post'}
        >
          {reactions?.myReaction ? <Icon name="Star" size={20} fill="currentColor" /> : <Icon name="Star" size={20} />}
          {reactions?.count ? <span className="action-count">{reactions.count}</span> : null}
        </button>
      )}
      {isMyPost && (
        <span className="like-count">
          <Icon name="Star" size={20} />
          {reactions?.count ? <span className="action-count">{reactions.count}</span> : null}
        </span>
      )}

      <button className="reply-button" onClick={onReply} aria-label="Reply to this post">
        <Icon name="MessageCircle" size={20} />
        {replies?.count ? <span className="action-count">{replies.count}</span> : null}
      </button>

      <button
        className={`repost-button ${reposts?.myRepost ? 'reposted' : ''}`}
        onClick={onRepost}
        disabled={repostingId === eventId || reposts?.myRepost}
        aria-label={reposts?.myRepost ? 'Reposted' : 'Repost this post'}
      >
        <Icon name="Repeat2" size={20} />
        {reposts?.count ? <span className="action-count">{reposts.count}</span> : null}
      </button>

      <button className={`share-button ${copied ? 'copied' : ''}`} onClick={onShare} aria-label="Share this post">
        {copied ? <Icon name="Check" size={20} /> : <Icon name="Share2" size={20} />}
      </button>
    </>
  )
}
