import { useState } from 'react'
import { Icon } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { PostHeader, PostActions, EditDeleteButtons, ThreadReplies, PostContent } from '../post'
import { cachePost, cacheProfile, navigateToPost } from '../../lib/utils'
import { useDeleteConfirm } from '../../hooks'
import type { Event, ReactionData, ReplyData, RepostData, ProfileCache } from '../../types'

interface TimelinePostCardProps {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
  isMyPost: boolean
  profiles: ProfileCache
  reactions: ReactionData | undefined
  replies: ReplyData | undefined
  reposts: RepostData | undefined
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  onEdit: (event: Event) => void
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
  onDeleteConfirm,
  onLike,
  onReply,
  onRepost,
  onShare,
  getDisplayName,
  getAvatarUrl,
}: TimelinePostCardProps) {
  const [expandedThread, setExpandedThread] = useState(false)
  const { isConfirming, showConfirm, hideConfirm } = useDeleteConfirm()

  const themeProps = getThemeCardProps(getEventThemeColors(event))

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('.post-footer') ||
      target.closest('.thread-section')
    )
      return
    cachePost(event)
    const profile = profiles[event.pubkey]
    if (profile) cacheProfile(event.pubkey, profile)
    navigateToPost(event.id)
  }

  const handleDeleteConfirmClick = () => {
    onDeleteConfirm(event)
    hideConfirm()
  }

  return (
    <article
      className={`post-card clickable ${isMyPost ? 'my-post' : ''} ${themeProps.className}`}
      style={themeProps.style}
      onClick={handleCardClick}
    >
      {repostedBy && (
        <div className="repost-label">
          <Icon name="Repeat2" size={14} /> {getDisplayName(repostedBy.pubkey)} reposted
        </div>
      )}

      <PostHeader
        pubkey={event.pubkey}
        createdAt={event.created_at}
        displayName={getDisplayName(event.pubkey)}
        avatarUrl={getAvatarUrl(event.pubkey)}
        isProfileLoading={profiles[event.pubkey] === undefined}
      />

      <div className="post-content">
        <PostContent content={event.content} truncate />
      </div>

      <div className="post-footer">
        <PostActions
          isMyPost={isMyPost}
          reactions={reactions}
          replies={replies}
          reposts={reposts}
          likingId={likingId}
          repostingId={repostingId}
          eventId={event.id}
          copied={copiedId === event.id}
          onLike={() => onLike(event)}
          onReply={() => onReply(event)}
          onRepost={() => onRepost(event)}
          onShare={() => onShare(event.id)}
        />

        {isMyPost && (
          <EditDeleteButtons
            isConfirming={isConfirming(event.id)}
            onEdit={() => onEdit(event)}
            onDelete={() => showConfirm(event.id)}
            onDeleteConfirm={handleDeleteConfirmClick}
            onDeleteCancel={hideConfirm}
          />
        )}
      </div>

      {replies?.replies && replies.replies.length > 0 && (
        <ThreadReplies
          replies={replies.replies}
          expanded={expandedThread}
          onToggle={() => setExpandedThread(!expandedThread)}
          profiles={profiles}
          getDisplayName={getDisplayName}
          getAvatarUrl={getAvatarUrl}
        />
      )}
    </article>
  )
}
