import { useState, useCallback, Fragment, useEffect } from 'react'
import { TIMEOUTS, CUSTOM_EVENTS } from '../lib/constants'
import { setHashtagClickHandler, setSuperMentionClickHandler } from '../lib/content-parser'
import { TimelinePostCard } from '../components/timeline'
import { Loading, Button, ErrorMessage } from './ui'
import { useTimeline } from '../hooks'
import {
  shareOrCopy,
  navigateToEdit,
  navigateTo,
  buildSearchUrl,
  contentHasTag,
  DEFAULT_SEARCH_FILTERS,
  getMutedPubkeys,
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
  const [mutedPubkeys, setMutedPubkeys] = useState<string[]>([])

  // Load muted pubkeys on mount and listen for storage changes
  useEffect(() => {
    setMutedPubkeys(getMutedPubkeys())

    // Listen for storage changes (when mute list is updated in another tab or FilterPanel)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mypace_mute_list') {
        setMutedPubkeys(getMutedPubkeys())
      }
    }
    window.addEventListener('storage', handleStorage)

    // Also listen for custom event from same-tab updates
    const handleMuteListChange = () => setMutedPubkeys(getMutedPubkeys())
    window.addEventListener('mypace:muteListChanged', handleMuteListChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('mypace:muteListChanged', handleMuteListChange)
    }
  }, [])

  // Re-render when app theme changes
  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

  // Extract filter values for easier access
  // Note: mypace/showSNS/showBlog/hideAds/hideNSFW/lang filtering is done server-side
  const {
    query,
    ngWords,
    tags: filterTags,
    ngTags: filterNgTags,
    mode: filterMode,
    showSNS,
    showBlog,
    mypace: mypaceOnly,
    lang = '',
    hideAds = true,
    hideNSFW = true,
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
  } = useTimeline({ mypaceOnly, showSNS, showBlog, hideAds, hideNSFW, lang })

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

  // Handle super mention clicks - add ref path to filter
  const handleSuperMentionClick = useCallback(
    (path: string) => {
      // Add ref path to current search filters (use tags filter for now)
      if (!filterTags.includes(path)) {
        navigateTo(buildSearchUrl({ ...filters, tags: [...filterTags, path] }))
      }
    },
    [filters, filterTags]
  )

  // Set up click handlers
  useEffect(() => {
    setHashtagClickHandler(handleHashtagClick)
    setSuperMentionClickHandler(handleSuperMentionClick)
  }, [handleHashtagClick, handleSuperMentionClick])

  if (loading && events.length === 0) return <Loading />

  if (error) {
    return (
      <ErrorMessage variant="box">
        <p>{error}</p>
        <Button size="md" onClick={reload}>
          Retry
        </Button>
      </ErrorMessage>
    )
  }

  // Client-side filtering (fast, no server request)
  // Note: mypace filtering is done server-side, so we skip it here
  let filteredItems = items

  // Filter by hashtags
  if (filterTags.length > 0) {
    filteredItems = filteredItems.filter((item) =>
      filterMode === 'and'
        ? filterTags.every((tag) => contentHasTag(item.event.content, tag))
        : filterTags.some((tag) => contentHasTag(item.event.content, tag))
    )
  }

  // Filter by OK word (case-insensitive, searches content only)
  if (query) {
    const lowerQuery = query.toLowerCase()
    filteredItems = filteredItems.filter((item) => item.event.content.toLowerCase().includes(lowerQuery))
  }

  // Filter by NG words (exclude posts containing any NG word in content)
  if (ngWords.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const lowerContent = item.event.content.toLowerCase()
      return !ngWords.some((ngWord) => lowerContent.includes(ngWord.toLowerCase()))
    })
  }

  // Filter by NG tags (exclude posts containing any NG tag)
  if (filterNgTags && filterNgTags.length > 0) {
    filteredItems = filteredItems.filter((item) => !filterNgTags.some((tag) => contentHasTag(item.event.content, tag)))
  }

  // Filter by mute list (exclude posts from muted users)
  if (mutedPubkeys.length > 0) {
    filteredItems = filteredItems.filter((item) => !mutedPubkeys.includes(item.event.pubkey))
  }

  return (
    <div className="timeline">
      {newEventCount > 0 && (
        <Button size="md" className="new-posts-banner" onClick={loadNewEvents}>
          {newEventCount}件の新着投稿があります
        </Button>
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
              <Button
                size="md"
                className="timeline-gap-button"
                onClick={() => fillGap(gapAfterThis.id)}
                disabled={loadingGap === gapAfterThis.id}
              >
                {loadingGap === gapAfterThis.id ? 'Loading...' : 'Load More'}
              </Button>
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
        <Button size="md" className="load-more-button" onClick={loadOlderEvents} disabled={loadingMore}>
          {loadingMore ? '読み込み中...' : '過去の投稿を読み込む'}
        </Button>
      )}
      {filteredItems.length > 0 && !hasMore && <p className="timeline-end">これ以上の投稿はありません</p>}
    </div>
  )
}
