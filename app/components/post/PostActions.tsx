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
          class={`like-button ${reactions?.myReaction ? 'liked' : ''}`}
          onClick={onLike}
          disabled={likingId === eventId || reactions?.myReaction}
          aria-label={reactions?.myReaction ? 'Liked' : 'Like this post'}
        >
          {reactions?.myReaction ? <Icon name="Star" size={20} fill="currentColor" /> : <Icon name="Star" size={20} />}
          {reactions?.count ? ` ${reactions.count}` : ''}
        </button>
      )}
      {isMyPost && (
        <span class="like-count">
          <Icon name="Star" size={20} />
          {reactions?.count ? ` ${reactions.count}` : ''}
        </span>
      )}

      <button class="reply-button" onClick={onReply} aria-label="Reply to this post">
        <Icon name="MessageCircle" size={20} />
        {replies?.count ? ` ${replies.count}` : ''}
      </button>

      <button
        class={`repost-button ${reposts?.myRepost ? 'reposted' : ''}`}
        onClick={onRepost}
        disabled={repostingId === eventId || reposts?.myRepost}
        aria-label={reposts?.myRepost ? 'Reposted' : 'Repost this post'}
      >
        <Icon name="Repeat2" size={20} />
        {reposts?.count ? ` ${reposts.count}` : ''}
      </button>

      <button class={`share-button ${copied ? 'copied' : ''}`} onClick={onShare} aria-label="Share this post">
        {copied ? <Icon name="Check" size={20} /> : <Icon name="Share2" size={20} />}
      </button>
    </>
  )
}
