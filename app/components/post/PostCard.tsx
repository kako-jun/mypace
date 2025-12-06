import type { Event } from 'nostr-tools'
import { renderContent } from '../../lib/content-parser'
import { formatTimestamp, getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import type { ReactionData, ReplyData, RepostData, ProfileCache } from '../../types'
import PostActions from './PostActions'
import ThreadReplies from './ThreadReplies'

interface PostCardProps {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
  isMyPost: boolean
  profiles: ProfileCache
  reaction?: ReactionData
  reply?: ReplyData
  repost?: RepostData

  // UI state
  isEditing: boolean
  editContent: string
  justSaved: boolean
  justDeleted: boolean
  isConfirmingDelete: boolean
  copiedId: string | null
  likingId: string | null
  repostingId: string | null
  isThreadExpanded: boolean

  // Handlers
  onEditChange: (content: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEdit: () => void
  onDelete: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  onLike: () => void
  onReply: () => void
  onRepost: () => void
  onShare: () => void
  onToggleThread: () => void
  onCardClick: (e: MouseEvent) => void

  // Profile helpers
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export default function PostCard({
  event,
  repostedBy,
  isMyPost,
  profiles,
  reaction,
  reply,
  repost,
  isEditing,
  editContent,
  justSaved,
  justDeleted,
  isConfirmingDelete,
  copiedId,
  likingId,
  repostingId,
  isThreadExpanded,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onLike,
  onReply,
  onRepost,
  onShare,
  onToggleThread,
  onCardClick,
  getDisplayName,
  getAvatarUrl
}: PostCardProps) {
  const themeColors = getEventThemeColors(event)
  const themeProps = getThemeCardProps(themeColors)

  return (
    <article
      key={repostedBy ? `repost-${event.id}-${repostedBy.pubkey}` : event.id}
      class={`post-card clickable ${isMyPost ? 'my-post' : ''} ${themeProps.className}`}
      style={themeProps.style}
      onClick={onCardClick}
    >
      {/* Repost label */}
      {repostedBy && (
        <div class="repost-label">
          🔁 {getDisplayName(repostedBy.pubkey)} reposted
        </div>
      )}

      {/* Header */}
      <header class="post-header">
        {getAvatarUrl(event.pubkey) ? (
          <img src={getAvatarUrl(event.pubkey)!} alt="" class="post-avatar" />
        ) : (
          <div class="post-avatar-placeholder" />
        )}
        <div class="post-author-info">
          <span class="author-name">{getDisplayName(event.pubkey)}</span>
          <time class="timestamp">{formatTimestamp(event.created_at)}</time>
        </div>
      </header>

      {/* Editing mode */}
      {isEditing ? (
        <div class="edit-form">
          <textarea
            class="edit-input"
            value={editContent}
            onInput={(e) => onEditChange((e.target as HTMLTextAreaElement).value)}
            rows={3}
            maxLength={280}
          />
          <div class="edit-actions">
            {isConfirmingDelete ? (
              <div class="delete-confirm">
                <span class="delete-confirm-text">Delete?</span>
                <button class="delete-confirm-yes" onClick={onDeleteConfirm}>Yes</button>
                <button class="delete-confirm-no" onClick={onDeleteCancel}>No</button>
              </div>
            ) : (
              <button class="delete-button" onClick={onDelete}>Delete</button>
            )}
            <div class="edit-actions-right">
              <button class="cancel-button" onClick={onCancelEdit}>Cancel</button>
              <button class="save-button" onClick={onSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Content */}
          <div class="post-content">
            {event.content.length > 420 || event.content.split('\n').length > 42 ? (
              <>
                {renderContent(event.content.slice(0, 420) + '...')}
                <span class="read-more-text">続きを読む</span>
              </>
            ) : (
              renderContent(event.content)
            )}
          </div>

          {/* Status messages */}
          {justSaved && <p class="success">Saved!</p>}
          {justDeleted && <p class="success">Deleted!</p>}

          {/* Actions */}
          {!justSaved && !justDeleted && (
            <PostActions
              event={event}
              isMyPost={isMyPost}
              reaction={reaction}
              repost={repost}
              reply={reply}
              copiedId={copiedId}
              likingId={likingId}
              repostingId={repostingId}
              onLike={onLike}
              onReply={onReply}
              onRepost={onRepost}
              onShare={onShare}
              onEdit={onEdit}
              onDelete={onDelete}
              isConfirmingDelete={isConfirmingDelete}
              onDeleteConfirm={onDeleteConfirm}
              onDeleteCancel={onDeleteCancel}
            />
          )}

          {/* Thread replies */}
          {reply && reply.count > 0 && (
            <ThreadReplies
              replies={reply.replies}
              expanded={isThreadExpanded}
              onToggle={onToggleThread}
              getDisplayName={getDisplayName}
              getAvatarUrl={getAvatarUrl}
            />
          )}
        </>
      )}
    </article>
  )
}
