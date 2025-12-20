import { Fragment, useCallback } from 'react'
import { TimelinePostCard } from '../timeline'
import { SuccessMessage } from '../ui'
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
  gaps: GapInfo[]
  hasMore: boolean
  loadingMore: boolean
  loadingGap: string | null
  onLike: (event: Event) => void
  onUnlike: (event: Event) => Promise<void>
  onRepost: (event: Event) => Promise<void>
  onDeleteConfirm: (event: Event) => void
  onShare: (eventId: string) => void
  onCopied: (eventId: string) => void
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
  gaps,
  hasMore,
  loadingMore,
  loadingGap,
  onLike,
  onUnlike,
  onRepost,
  onDeleteConfirm,
  onShare,
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

  return (
    <div className="timeline">
      {items.map((item) => {
        const event = item.event
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
              onEdit={() => handleEdit(event)}
              onDeleteConfirm={() => onDeleteConfirm(event)}
              onLike={() => onLike(event)}
              onUnlike={() => onUnlike(event)}
              onReply={() => handleReplyClick(event)}
              onRepost={() => onRepost(event)}
              onShare={() => onShare(event.id)}
              getDisplayName={getDisplayNameForEvent}
              getAvatarUrl={getAvatarUrlForEvent}
            />
            {gapAfterThis && (
              <button
                className="timeline-gap-button"
                onClick={() => fillGap(gapAfterThis.id)}
                disabled={loadingGap === gapAfterThis.id}
              >
                {loadingGap === gapAfterThis.id ? '読み込み中...' : 'さらに表示'}
              </button>
            )}
          </Fragment>
        )
      })}
      {items.length === 0 && <p className="empty">No posts yet</p>}
      {items.length > 0 && hasMore && (
        <button className="load-more-button" onClick={loadOlderEvents} disabled={loadingMore}>
          {loadingMore ? '読み込み中...' : '過去の投稿を読み込む'}
        </button>
      )}
      {items.length > 0 && !hasMore && <p className="timeline-end">これ以上の投稿はありません</p>}
    </div>
  )
}
