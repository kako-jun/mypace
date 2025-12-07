import { useState } from 'hono/jsx'
import { getEventThemeColors, getThemeCardProps, formatTimestamp } from '../../lib/nostr/events'
import { renderContent } from '../../lib/content-parser'
import { PostHeader } from '../post'
import { cachePost, cacheProfile } from '../../lib/utils'
import { LIMITS } from '../../lib/constants'
import type { Event } from 'nostr-tools'
import type { ReactionData, ReplyData, RepostData, ProfileCache } from '../../types'

interface TimelinePostCardProps {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
  isMyPost: boolean
  myPubkey: string | null
  profiles: ProfileCache
  reactions: ReactionData | undefined
  replies: ReplyData | undefined
  reposts: RepostData | undefined
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  onEdit: (event: Event) => void
  onDelete: (eventId: string) => void
  onDeleteConfirm: (event: Event) => void
  onLike: (event: Event) => void
  onReply: (event: Event) => void
  onRepost: (event: Event) => void
  onShare: (eventId: string) => void
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export default function TimelinePostCard({
  event,
  repostedBy,
  isMyPost,
  profiles,
  reactions,
  replies,
  reposts,
  likingId,
  repostingId,
  copiedId,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onLike,
  onReply,
  onRepost,
  onShare,
  getDisplayName,
  getAvatarUrl,
}: TimelinePostCardProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [expandedThread, setExpandedThread] = useState(false)

  const themeProps = getThemeCardProps(getEventThemeColors(event))

  const handleCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('.post-footer') || target.closest('.thread-section')) return
    cachePost(event)
    if (profiles[event.pubkey]) cacheProfile(event.pubkey, profiles[event.pubkey])
    window.location.href = `/post/${event.id}`
  }

  const handleDeleteClick = () => setConfirmDeleteId(event.id)
  const handleDeleteCancel = () => setConfirmDeleteId(null)
  const handleDeleteConfirmClick = () => {
    onDeleteConfirm(event)
    setConfirmDeleteId(null)
  }

  return (
    <article
      class={`post-card clickable ${isMyPost ? 'my-post' : ''} ${themeProps.className}`}
      style={themeProps.style}
      onClick={handleCardClick}
    >
      {repostedBy && <div class="repost-label">🔁 {getDisplayName(repostedBy.pubkey)} reposted</div>}

      <PostHeader
        pubkey={event.pubkey}
        createdAt={event.created_at}
        displayName={getDisplayName(event.pubkey)}
        avatarUrl={getAvatarUrl(event.pubkey)}
      />

      <div class="post-content">
        {event.content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || event.content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD ? (
          <>{renderContent(event.content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH) + '...')}<span class="read-more-text">続きを読む</span></>
        ) : renderContent(event.content)}
      </div>

      <div class="post-footer">
        {!isMyPost && (
          <button
            class={`like-button ${reactions?.myReaction ? 'liked' : ''}`}
            onClick={() => onLike(event)}
            disabled={likingId === event.id || reactions?.myReaction}
          >
            {reactions?.myReaction ? '★' : '☆'}{reactions?.count ? ` ${reactions.count}` : ''}
          </button>
        )}
        {isMyPost && reactions?.count && reactions.count > 0 && <span class="like-count">★ {reactions.count}</span>}

        <button class="reply-button" onClick={() => onReply(event)}>
          💬{replies?.count ? ` ${replies.count}` : ''}
        </button>

        <button
          class={`repost-button ${reposts?.myRepost ? 'reposted' : ''}`}
          onClick={() => onRepost(event)}
          disabled={repostingId === event.id || reposts?.myRepost}
        >
          🔁{reposts?.count ? ` ${reposts.count}` : ''}
        </button>

        <button
          class={`share-button ${copiedId === event.id ? 'copied' : ''}`}
          onClick={() => onShare(event.id)}
          title="Share"
        >
          {copiedId === event.id ? '✓' : '↗'}
        </button>

        {isMyPost && (
          confirmDeleteId === event.id ? (
            <div class="delete-confirm">
              <span class="delete-confirm-text">Delete?</span>
              <button class="delete-confirm-yes" onClick={handleDeleteConfirmClick}>Yes</button>
              <button class="delete-confirm-no" onClick={handleDeleteCancel}>No</button>
            </div>
          ) : (
            <>
              <button class="edit-button" onClick={() => onEdit(event)}>Edit</button>
              <button class="delete-button" onClick={handleDeleteClick}>Delete</button>
            </>
          )
        )}
      </div>

      {replies?.count && replies.count > 0 && (
        <div class="thread-section">
          <button class="thread-toggle" onClick={() => setExpandedThread(!expandedThread)}>
            {expandedThread ? '▼' : '▶'} {replies.count} replies
          </button>
          {expandedThread && (
            <div class="thread-replies">
              {replies.replies.map((reply) => {
                const replyThemeProps = getThemeCardProps(getEventThemeColors(reply))
                return (
                  <div key={reply.id} class={`reply-card ${replyThemeProps.className}`} style={replyThemeProps.style}>
                    <header class="reply-header">
                      {getAvatarUrl(reply.pubkey) ? (
                        <img src={getAvatarUrl(reply.pubkey)!} alt="" class="reply-avatar" />
                      ) : (
                        <div class="reply-avatar-placeholder" />
                      )}
                      <div class="reply-author-info">
                        <span class="author-name">{getDisplayName(reply.pubkey)}</span>
                        <time class="timestamp">{formatTimestamp(reply.created_at)}</time>
                      </div>
                    </header>
                    <div class="reply-content">{renderContent(reply.content)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
