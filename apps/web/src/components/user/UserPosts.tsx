import { Fragment, useCallback } from 'react'
import { TimelinePostCard, TimelineActionButton, TimelineSearch } from '../timeline'
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
  ViewCountData,
  OgpData,
} from '../../types'
import type { ShareOption } from '../post/ShareMenu'
import type { StellaColor } from '../../lib/nostr/events'

interface UserPostsProps {
  items: TimelineItem[]
  profiles: ProfileCache
  wikidataMap: Record<string, string>
  ogpMap: Record<string, OgpData>
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
  views: { [eventId: string]: ViewCountData }
  myPubkey: string | null
  authorPubkey: string
  authorProfile: LoadableProfile
  likingId: string | null
  repostingId: string | null
  copiedId: string | null
  deletedId: string | null
  pinnedEventId: string | null
  pinnedEvent: Event | null
  hasMore: boolean
  loadingMore: boolean
  walletBalance: number | null
  onAddStella: (event: Event, color: StellaColor) => void
  onUnlike: (event: Event) => Promise<void>
  onRepost: (event: Event) => Promise<void>
  onDeleteConfirm: (event: Event) => void
  onShareOption: (eventId: string, content: string, option: ShareOption) => void
  onCopied: (eventId: string) => void
  onPin: (event: Event) => void
  onUnpin: () => void
  loadOlderEvents: () => Promise<void>
  onFiltersChange: (filters: { q: string[]; tags: string[] }) => void
}

export function UserPosts({
  items,
  profiles,
  wikidataMap,
  ogpMap,
  reactions,
  replies,
  reposts,
  views,
  myPubkey,
  authorPubkey,
  authorProfile,
  likingId,
  repostingId,
  copiedId,
  deletedId,
  pinnedEventId,
  pinnedEvent,
  hasMore,
  loadingMore,
  walletBalance,
  onAddStella,
  onUnlike,
  onRepost,
  onDeleteConfirm,
  onShareOption,
  onPin,
  onUnpin,
  loadOlderEvents,
  onFiltersChange,
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

  // Find the TimelineItem for pinned event (for originalEvent)
  const pinnedItem = pinnedEventId ? items.find((item) => item.event.id === pinnedEventId) : undefined

  const renderPostCard = (item: TimelineItem, _isPinnedSection = false) => {
    const event = item.event
    const isMyPost = myPubkey === event.pubkey

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
          originalEvent={item.originalEvent}
          isMyPost={isMyPost}
          myPubkey={myPubkey}
          profiles={{ ...profiles, [authorPubkey]: authorProfile ?? null }}
          wikidataMap={wikidataMap}
          ogpMap={ogpMap}
          reactions={reactions[event.id]}
          replies={replies[event.id]}
          reposts={reposts[event.id]}
          views={views[event.id]}
          likingId={likingId}
          repostingId={repostingId}
          copiedId={copiedId}
          isPinned={pinnedEventId === event.id}
          showPinButton={isMyPost}
          walletBalance={walletBalance}
          onEdit={() => handleEdit(event)}
          onDeleteConfirm={() => onDeleteConfirm(event)}
          onAddStella={(_ev, color) => onAddStella(event, color)}
          onUnlike={() => onUnlike(event)}
          onReply={() => handleReplyClick(event)}
          onRepost={() => onRepost(event)}
          onPin={() => onPin(event)}
          onUnpin={onUnpin}
          onShareOption={onShareOption}
          getDisplayName={getDisplayNameForEvent}
          getAvatarUrl={getAvatarUrlForEvent}
        />
      </Fragment>
    )
  }

  return (
    <div className="timeline">
      <TimelineSearch onFiltersChange={onFiltersChange} disableTags />

      {/* Pinned post section */}
      {pinnedEvent && pinnedItem && (
        <div className="pinned-post-section">
          <div className="pinned-post-label">
            <Icon name="Pin" size={14} /> Pinned
          </div>
          {renderPostCard(pinnedItem, true)}
        </div>
      )}

      {/* Regular posts */}
      {regularItems.map((item) => renderPostCard(item, false))}
      {items.length === 0 && <p className="empty">No posts yet</p>}
      {items.length > 0 && (
        <TimelineActionButton onClick={loadOlderEvents} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : hasMore ? 'Load Older Posts' : 'End of timeline (retry)'}
        </TimelineActionButton>
      )}
    </div>
  )
}
