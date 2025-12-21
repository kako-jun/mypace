import { Fragment, useCallback } from 'react'
import { TimelinePostCard, TimelineActionButton } from '../timeline'
import { SuccessMessage, Icon } from '../ui'
import { navigateToEdit, navigateToReply, getDisplayName, getAvatarUrl } from '../../lib/utils'
import type {
  Event,
  LoadableProfile,
  ProfileCache,
  ReactionData,
  ReplyData,
  RepostData,
  TimelineItem,
} from '../../types'
import type { GapInfo } from '../../hooks/timeline/types'
import type { ShareOption } from '../post/ShareMenu'

interface UserPostsProps {
  items: TimelineItem[]
  profiles: ProfileCache
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
  myPubkey: string | null
  authorPubkey: string
  authorProfile: LoadableProfile
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  deletedId: string | null
  pinnedEventId: string | null
  pinnedEvent: Event | null
  gaps: GapInfo[]
  hasMore: boolean
  loadingMore: boolean
  loadingGap: string | null
  onLike: (event: Event) => void
  onUnlike: (event: Event) => Promise<void>
  onRepost: (event: Event) => Promise<void>
  onDeleteConfirm: (event: Event) => void
  onShareOption: (eventId: string, content: string, option: ShareOption) => void
  onCopied: (eventId: string) => void
  onPin: (event: Event) => void
  onUnpin: () => void
  loadOlderEvents: () => Promise<void>
  fillGap: (gapId: string) => Promise<void>
}

export function UserPosts({
  items,
  profiles,
  reactions,
  replies,
  reposts,
  myPubkey,
  authorPubkey,
  authorProfile,
  likingId,
  repostingId,
  copiedId,
  deletedId,
  pinnedEventId,
  pinnedEvent,
  gaps,
  hasMore,
  loadingMore,
  loadingGap,
  onLike,
  onUnlike,
  onRepost,
  onDeleteConfirm,
  onShareOption,
  onPin,
  onUnpin,
  loadOlderEvents,
  fillGap,
}: UserPostsProps) {
  const handleEdit = useCallback((event: Event) => navigateToEdit(event.id), [])
  const handleReplyClick = useCallback((event: Event) => navigateToReply(event.id), [])

  const displayName = getDisplayName(authorProfile, authorPubkey)
  const avatarUrl = getAvatarUrl(authorProfile)

  const getDisplayNameForEvent = (eventPubkey: string) => {
    if (eventPubkey === authorPubkey) return displayName
    const eventProfile = profiles[eventPubkey]
    return getDisplayName(eventProfile, eventPubkey)
  }

  const getAvatarUrlForEvent = (eventPubkey: string) => {
    if (eventPubkey === authorPubkey) return avatarUrl
    const eventProfile = profiles[eventPubkey]
    return getAvatarUrl(eventProfile)
  }

  // Filter out pinned post from regular timeline
  const regularItems = pinnedEventId ? items.filter((item) => item.event.id !== pinnedEventId) : items

  const renderPostCard = (event: Event, isPinnedSection = false) => {
    const isMyPost = myPubkey === event.pubkey
    const gapAfterThis = gaps.find((g) => g.afterEventId === event.id)

    if (deletedId === event.id) {
      return (
        <article key={event.id} className="post-card">
          <SuccessMessage>Deleted!</SuccessMessage>
        </article>
      )
    }

    return (
      <Fragment key={event.id}>
        <TimelinePostCard
          event={event}
          isMyPost={isMyPost}
          myPubkey={myPubkey}
          profiles={{ ...profiles, [authorPubkey]: authorProfile ?? null }}
          reactions={reactions[event.id]}
          replies={replies[event.id]}
          reposts={reposts[event.id]}
          likingId={likingId}
          repostingId={repostingId}
          copiedId={copiedId}
          isPinned={pinnedEventId === event.id}
          showPinButton={isMyPost}
          onEdit={() => handleEdit(event)}
          onDeleteConfirm={() => onDeleteConfirm(event)}
          onLike={() => onLike(event)}
          onUnlike={() => onUnlike(event)}
          onReply={() => handleReplyClick(event)}
          onRepost={() => onRepost(event)}
          onPin={() => onPin(event)}
          onUnpin={onUnpin}
          onShareOption={onShareOption}
          getDisplayName={getDisplayNameForEvent}
          getAvatarUrl={getAvatarUrlForEvent}
        />
        {!isPinnedSection && gapAfterThis && (
          <TimelineActionButton onClick={() => fillGap(gapAfterThis.id)} disabled={loadingGap === gapAfterThis.id}>
            {loadingGap === gapAfterThis.id ? 'Loading...' : 'Load More'}
          </TimelineActionButton>
        )}
      </Fragment>
    )
  }

  return (
    <div className="timeline">
      {/* Pinned post section */}
      {pinnedEvent && (
        <div className="pinned-post-section">
          <div className="pinned-post-label">
            <Icon name="Pin" size={14} /> Pinned
          </div>
          {renderPostCard(pinnedEvent, true)}
        </div>
      )}

      {/* Regular posts */}
      {regularItems.map((item) => renderPostCard(item.event, false))}
      {items.length === 0 && <p className="empty">No posts yet</p>}
      {items.length > 0 && hasMore && (
        <TimelineActionButton onClick={loadOlderEvents} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load Older Posts'}
        </TimelineActionButton>
      )}
      {items.length > 0 && !hasMore && <p className="timeline-end">End of timeline</p>}
    </div>
  )
}
