import { useState } from 'react'
import { Icon, parseEmojiTags } from '../ui'
import '../../styles/components/post-card.css'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import {
  PostHeader,
  PostActions,
  EditDeleteButtons,
  ThreadReplies,
  PostContent,
  PostStickers,
  PostLocation,
  PostBarcode,
} from '../post'
import { cachePostWithMetadata, navigateToPostModal, navigateToUser } from '../../lib/utils'
import { parseStickers, hasTeaserTag } from '../../lib/nostr/tags'
import { useDeleteConfirm } from '../../hooks'
import type { Event, ReactionData, ReplyData, RepostData, ViewCountData, ProfileCache } from '../../types'
import type { ShareOption } from '../post/ShareMenu'

interface TimelinePostCardProps {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
  isMyPost: boolean
  myPubkey: string | null
  profiles: ProfileCache
  reactions: ReactionData | undefined
  replies: ReplyData | undefined
  reposts: RepostData | undefined
  views: ViewCountData | undefined
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  isPinned?: boolean
  showPinButton?: boolean
  onEdit: (event: Event) => void
  onDeleteConfirm: (event: Event) => void
  onLike: (event: Event) => void
  onUnlike: (event: Event) => void
  onReply: (event: Event) => void
  onRepost: (event: Event) => void
  onPin?: (event: Event) => void
  onUnpin?: () => void
  onShareOption: (eventId: string, content: string, option: ShareOption) => void
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
  views,
  likingId,
  repostingId,
  copiedId,
  isPinned = false,
  showPinButton = false,
  onEdit,
  onDeleteConfirm,
  onLike,
  onUnlike,
  onReply,
  onRepost,
  onPin,
  onUnpin,
  onShareOption,
  getDisplayName,
  getAvatarUrl,
}: TimelinePostCardProps) {
  const [expandedThread, setExpandedThread] = useState(false)
  const { isConfirming, showConfirm, hideConfirm } = useDeleteConfirm()

  const themeProps = getThemeCardProps(getEventThemeColors(event))
  const stickers = parseStickers(event.tags)

  // Extract locations from tags
  const gTags = event.tags.filter((tag) => tag[0] === 'g')
  const locationTags = event.tags.filter((tag) => tag[0] === 'location')
  const locations = gTags.map((gTag, i) => ({
    geohash: gTag[1],
    name: locationTags[i]?.[1],
  }))

  // Replies - filtering is done server-side
  const replyList = replies?.replies || []

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('.post-footer') ||
      target.closest('.thread-section')
    )
      return
    // Cache event, profile, and metadata from timeline for instant display in detail view
    const profile = profiles[event.pubkey] || null
    const metadata = {
      reactions: reactions || { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] },
      replies: replies || { count: 0, replies: [] },
      reposts: reposts || { count: 0, myRepost: false },
      views: views || { detail: 0, impression: 0 },
    }
    cachePostWithMetadata(event, profile, metadata)
    navigateToPostModal(event.id)
  }

  const handleDeleteConfirmClick = () => {
    onDeleteConfirm(event)
    hideConfirm()
  }

  const isTruncated = hasTeaserTag(event)

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinned) {
      onUnpin?.()
    } else {
      onPin?.(event)
    }
  }

  return (
    <div className="post-card-wrapper">
      <article
        className={`post-card clickable ${isMyPost ? 'my-post' : ''} ${themeProps.className}`}
        style={themeProps.style}
        onClick={handleCardClick}
      >
        {/* Sticker area: contains everything except ThreadReplies so stickers don't shift when replies expand */}
        <div className="post-card-sticker-area">
          {/* Pin indicator/button at top center */}
          {/* Pinned: visible to everyone (clickable only for owner) */}
          {/* Not pinned + owner: visible only to owner */}
          {(isPinned || showPinButton) && (
            <button
              type="button"
              className={`post-pin-button ${isPinned ? 'pinned' : ''}`}
              onClick={showPinButton ? handlePinClick : undefined}
              disabled={!showPinButton}
              aria-label={isPinned ? 'Pinned post' : 'Pin this post'}
              title={isPinned ? (showPinButton ? 'Unpin' : 'Pinned') : 'Pin to profile'}
            >
              <Icon name="Pin" size={16} />
            </button>
          )}

          {/* Back layer stickers (behind content) */}
          <PostStickers stickers={stickers} truncated={isTruncated} layer="back" />

          {repostedBy && (
            <div className="repost-label">
              <Icon name="Repeat2" size={14} /> {getDisplayName(repostedBy.pubkey)} reposted
            </div>
          )}

          {/* Reply-to indicator */}
          {(() => {
            // Check if this is a reply by looking for 'e' tags with 'root' or 'reply' marker
            const replyTag = event.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))
            if (!replyTag) return null

            // Get the first 'p' tag as the reply target
            const pTag = event.tags.find((tag) => tag[0] === 'p')
            if (!pTag) return null

            const replyToPubkey = pTag[1]
            return (
              <div className="reply-to-label">
                <span>Reply</span>
                <span>→ @{getDisplayName(replyToPubkey)}</span>
              </div>
            )
          })()}

          <PostHeader
            pubkey={event.pubkey}
            createdAt={event.created_at}
            displayName={getDisplayName(event.pubkey)}
            avatarUrl={getAvatarUrl(event.pubkey)}
            isProfileLoading={profiles[event.pubkey] === undefined}
            emojis={profiles[event.pubkey]?.emojis}
            eventKind={event.kind}
            views={views}
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

          {locations.map((loc) => (
            <PostLocation key={loc.geohash} geohashStr={loc.geohash} name={loc.name} />
          ))}

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
              onShareOption={(option) => onShareOption(event.id, event.content, option)}
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

          {/* Front layer stickers (above content) */}
          <PostStickers stickers={stickers} truncated={isTruncated} layer="front" />
        </div>

        {/* Barcode on right edge */}
        <PostBarcode eventId={event.id} />

        {replyList.length > 0 && (
          <ThreadReplies
            replies={replyList}
            expanded={expandedThread}
            onToggle={() => setExpandedThread(!expandedThread)}
            profiles={profiles}
            getDisplayName={getDisplayName}
            getAvatarUrl={getAvatarUrl}
          />
        )}
      </article>
    </div>
  )
}
