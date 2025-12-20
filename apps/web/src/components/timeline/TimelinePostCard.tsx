import { useState } from 'react'
import { Icon, parseEmojiTags } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { PostHeader, PostActions, EditDeleteButtons, ThreadReplies, PostContent, PostStickers } from '../post'
import { cachePost, cacheProfile, navigateToPostModal, navigateToUser } from '../../lib/utils'
import { parseStickers } from '../../lib/nostr/tags'
import { useDeleteConfirm } from '../../hooks'
import type { Event, ReactionData, ReplyData, RepostData, ProfileCache } from '../../types'

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
  onDeleteConfirm: (event: Event) => void
  onLike: (event: Event) => void
  onUnlike: (event: Event) => void
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
  myPubkey,
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
  onUnlike,
  onReply,
  onRepost,
  onShare,
  getDisplayName,
  getAvatarUrl,
}: TimelinePostCardProps) {
  const [expandedThread, setExpandedThread] = useState(false)
  const { isConfirming, showConfirm, hideConfirm } = useDeleteConfirm()

  const themeProps = getThemeCardProps(getEventThemeColors(event))
  const stickers = parseStickers(event.tags)

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
    navigateToPostModal(event.id)
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
        emojis={profiles[event.pubkey]?.emojis}
        eventKind={event.kind}
      />

      <div className="post-content">
        <PostContent
          content={event.content}
          truncate
          emojis={parseEmojiTags(event.tags)}
          profiles={profiles}
          onReadMore={() => navigateToPostModal(event.id)}
          tags={event.tags}
        />
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
          myPubkey={myPubkey}
          getDisplayName={getDisplayName}
          onLike={() => onLike(event)}
          onUnlike={() => onUnlike(event)}
          onReply={() => onReply(event)}
          onRepost={() => onRepost(event)}
          onShare={() => onShare(event.id)}
          onNavigateToProfile={navigateToUser}
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

      <PostStickers stickers={stickers} truncated />
    </article>
  )
}
