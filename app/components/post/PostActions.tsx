import type { Event } from 'nostr-tools'
import type { ReactionData, RepostData, ReplyData } from '../../types'

interface PostActionsProps {
  event: Event
  isMyPost: boolean
  reaction?: ReactionData
  repost?: RepostData
  reply?: ReplyData
  copiedId: string | null
  likingId: string | null
  repostingId: string | null
  onLike: () => void
  onReply: () => void
  onRepost: () => void
  onShare: () => void
  onEdit: () => void
  onDelete: () => void
  isConfirmingDelete: boolean
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

export default function PostActions({
  event,
  isMyPost,
  reaction,
  repost,
  reply,
  copiedId,
  likingId,
  repostingId,
  onLike,
  onReply,
  onRepost,
  onShare,
  onEdit,
  onDelete,
  isConfirmingDelete,
  onDeleteConfirm,
  onDeleteCancel
}: PostActionsProps) {
  return (
    <div class="post-footer">
      {/* Like button - only for others' posts */}
      {!isMyPost && (
        <button
          class={`like-button ${reaction?.myReaction ? 'liked' : ''}`}
          onClick={onLike}
          disabled={likingId === event.id || reaction?.myReaction}
        >
          {reaction?.myReaction ? '★' : '☆'}
          {reaction?.count ? ` ${reaction.count}` : ''}
        </button>
      )}

      {/* Like count for own posts */}
      {isMyPost && reaction?.count ? (
        <span class="like-count">★ {reaction.count}</span>
      ) : null}

      {/* Reply button */}
      <button class="reply-button" onClick={onReply}>
        💬{reply?.count ? ` ${reply.count}` : ''}
      </button>

      {/* Repost button */}
      <button
        class={`repost-button ${repost?.myRepost ? 'reposted' : ''}`}
        onClick={onRepost}
        disabled={repostingId === event.id || repost?.myRepost}
      >
        🔁{repost?.count ? ` ${repost.count}` : ''}
      </button>

      {/* Share button */}
      <button
        class={`share-button ${copiedId === event.id ? 'copied' : ''}`}
        onClick={onShare}
        title="Share"
      >
        {copiedId === event.id ? '✓' : '↗'}
      </button>

      {/* Edit/Delete for own posts */}
      {isMyPost && (
        <>
          {isConfirmingDelete ? (
            <div class="delete-confirm">
              <span class="delete-confirm-text">Delete?</span>
              <button class="delete-confirm-yes" onClick={onDeleteConfirm}>Yes</button>
              <button class="delete-confirm-no" onClick={onDeleteCancel}>No</button>
            </div>
          ) : (
            <>
              <button class="edit-button" onClick={onEdit}>Edit</button>
              <button class="delete-button" onClick={onDelete}>Delete</button>
            </>
          )}
        </>
      )}
    </div>
  )
}
