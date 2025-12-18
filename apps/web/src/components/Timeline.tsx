import { useState, useCallback, Fragment, useEffect } from 'react'
import { TIMEOUTS, CUSTOM_EVENTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { TimelinePostCard } from '../components/timeline'
import { Loading } from './ui'
import { useTimeline } from '../hooks'
import {
  shareOrCopy,
  navigateToEdit,
  navigateTo,
  buildSearchUrl,
  contentHasTag,
  DEFAULT_SEARCH_FILTERS,
} from '../lib/utils'
import type { Event, SearchFilters } from '../types'

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  filters?: SearchFilters
}

export function Timeline({ onEditStart, onReplyStart, filters = DEFAULT_SEARCH_FILTERS }: TimelineProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [, setThemeVersion] = useState(0)

  // Re-render when app theme changes
  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

  // Extract filter values for easier access
  // Note: mypace filtering is done server-side, langFilter is reserved for future
  const {
    query,
    ngWords,
    tags: filterTags,
    ngTags: filterNgTags,
    mode: filterMode,
    mypace: mypaceOnly,
    lang: _langFilter,
  } = filters

  const {
    items,
    events,
    profiles,
    reactions,
    replies,
    reposts,
    myPubkey,
    loading,
    error,
    likingId,
    repostingId,
    newEventCount,
    gaps,
    hasMore,
    loadingMore,
    loadingGap,
    reload,
    loadNewEvents,
    loadOlderEvents,
    fillGap,
    handleLike,
    handleUnlike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  } = useTimeline({ mypaceOnly })

  const handleEdit = useCallback(
    (event: Event) => {
      if (onEditStart) {
        onEditStart(event)
      } else {
        navigateToEdit(event.id)
      }
    },
    [onEditStart]
  )

  const handleReplyClick = useCallback((event: Event) => onReplyStart?.(event), [onReplyStart])

  const handleShare = useCallback(async (eventId: string) => {
    const url = `${window.location.origin}/post/${eventId}`
    const result = await shareOrCopy(url)
    if (result.copied) {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
    }
  }, [])

  const handleDeleteConfirm = useCallback(
    async (event: Event) => {
      await handleDelete(event)
      setDeletedId(event.id)
      setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
    },
    [handleDelete]
  )

  // Handle hashtag clicks - add tag to filter
  const handleHashtagClick = useCallback(
    (tag: string) => {
      // Add tag to current search filters
      if (!filterTags.includes(tag)) {
        navigateTo(buildSearchUrl({ ...filters, tags: [...filterTags, tag] }))
      }
    },
    [filters, filterTags]
  )

  // Set up hashtag click handler
  useEffect(() => {
    setHashtagClickHandler(handleHashtagClick)
  }, [handleHashtagClick])

  if (loading && events.length === 0) return <Loading />

  if (error) {
    return (
      <div className="error-box">
        <p>{error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    )
  }

  // Client-side filtering (fast, no server request)
  // Note: mypace filtering is done server-side, so we skip it here
  let filteredItems = items

  // Helper to get searchable text (content + display name)
  const getSearchableText = (item: (typeof items)[0]): string => {
    const displayName = getDisplayName(item.event.pubkey)
    return `${item.event.content} ${displayName}`.toLowerCase()
  }

  // Filter by hashtags
  if (filterTags.length > 0) {
    filteredItems = filteredItems.filter((item) =>
      filterMode === 'and'
        ? filterTags.every((tag) => contentHasTag(item.event.content, tag))
        : filterTags.some((tag) => contentHasTag(item.event.content, tag))
    )
  }

  // Filter by OK word (case-insensitive, searches content + username)
  if (query) {
    const lowerQuery = query.toLowerCase()
    filteredItems = filteredItems.filter((item) => getSearchableText(item).includes(lowerQuery))
  }

  // Filter by NG words (exclude posts containing any NG word in content or username)
  if (ngWords.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const searchableText = getSearchableText(item)
      return !ngWords.some((ngWord) => searchableText.includes(ngWord.toLowerCase()))
    })
  }

  // Filter by NG tags (exclude posts containing any NG tag)
  if (filterNgTags && filterNgTags.length > 0) {
    filteredItems = filteredItems.filter((item) => !filterNgTags.some((tag) => contentHasTag(item.event.content, tag)))
  }

  return (
    <div className="timeline">
      {newEventCount > 0 && (
        <button className="new-posts-banner" onClick={loadNewEvents}>
          {newEventCount}件の新着投稿があります
        </button>
      )}
      {filteredItems.map((item) => {
        const event = item.event
        const isMyPost = myPubkey === event.pubkey

        // このイベントの後にギャップがあるか確認
        const gapAfterThis = gaps.find((g) => g.afterEventId === event.id)

        if (deletedId === event.id) {
          return (
            <article key={event.id} className="post-card">
              <p className="success">Deleted!</p>
            </article>
          )
        }

        return (
          <Fragment key={item.repostedBy ? `repost-${event.id}-${item.repostedBy.pubkey}` : event.id}>
            <TimelinePostCard
              event={event}
              repostedBy={item.repostedBy}
              isMyPost={isMyPost}
              myPubkey={myPubkey}
              profiles={profiles}
              reactions={reactions[event.id]}
              replies={replies[event.id]}
              reposts={reposts[event.id]}
              likingId={likingId}
              repostingId={repostingId}
              copiedId={copiedId}
              onEdit={handleEdit}
              onDeleteConfirm={handleDeleteConfirm}
              onLike={handleLike}
              onUnlike={handleUnlike}
              onReply={handleReplyClick}
              onRepost={handleRepost}
              onShare={handleShare}
              getDisplayName={getDisplayName}
              getAvatarUrl={getAvatarUrl}
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
      {filteredItems.length === 0 && (
        <p className="empty">
          {query || filterTags.length > 0 || ngWords.length > 0 ? 'No posts matching filter' : 'No posts yet'}
        </p>
      )}
      {filteredItems.length > 0 && hasMore && (
        <button className="load-more-button" onClick={loadOlderEvents} disabled={loadingMore}>
          {loadingMore ? '読み込み中...' : '過去の投稿を読み込む'}
        </button>
      )}
      {filteredItems.length > 0 && !hasMore && <p className="timeline-end">これ以上の投稿はありません</p>}
    </div>
  )
}
