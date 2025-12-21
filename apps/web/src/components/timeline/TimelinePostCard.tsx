import { useState } from 'react'
import { Icon, parseEmojiTags } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import {
  PostHeader,
  PostActions,
  EditDeleteButtons,
  ThreadReplies,
  PostContent,
  PostStickers,
  PostLocation,
} from '../post'
import { cachePost, cacheProfile, navigateToPostModal, navigateToUser, contentHasTag } from '../../lib/utils'
import { parseStickers, hasTeaserTag } from '../../lib/nostr/tags'
import { useDeleteConfirm } from '../../hooks'
import type { Event, ReactionData, ReplyData, RepostData, ProfileCache } from '../../types'
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
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  isPinned?: boolean
  showPinButton?: boolean
  ngWords?: string[]
  ngTags?: string[]
  mutedPubkeys?: string[]
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
  likingId,
  repostingId,
  copiedId,
  isPinned = false,
  showPinButton = false,
  ngWords = [],
  ngTags = [],
  mutedPubkeys = [],
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

  // Extract location from tags
  const gTag = event.tags.find((tag) => tag[0] === 'g')
  const locationTag = event.tags.find((tag) => tag[0] === 'location')
  const locationGeohash = gTag?.[1]
  const locationName = locationTag?.[1]

  // Filter replies by NG words, NG tags, and muted users
  const filteredReplies = replies?.replies
    ? replies.replies.filter((reply) => {
        // Filter by muted users
        if (mutedPubkeys.includes(reply.pubkey)) return false
        // Filter by NG words
        if (ngWords.length > 0) {
          const lowerContent = reply.content.toLowerCase()
          if (ngWords.some((ngWord) => lowerContent.includes(ngWord.toLowerCase()))) return false
        }
        // Filter by NG tags
        if (ngTags.length > 0) {
          if (ngTags.some((tag) => contentHasTag(reply.content, tag))) return false
        }
        return true
      })
    : []

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

        {locationGeohash && <PostLocation geohashStr={locationGeohash} name={locationName} />}

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

        {filteredReplies.length > 0 && (
          <ThreadReplies
            replies={filteredReplies}
            expanded={expandedThread}
            onToggle={() => setExpandedThread(!expandedThread)}
            profiles={profiles}
            getDisplayName={getDisplayName}
            getAvatarUrl={getAvatarUrl}
          />
        )}

        {/* Front layer stickers (above content) */}
        <PostStickers stickers={stickers} truncated={isTruncated} layer="front" />
      </article>
    </div>
  )
}
