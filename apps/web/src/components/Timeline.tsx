import { useState, useCallback, Fragment, useMemo } from 'react'
import { TIMEOUTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, TimelinePostCard } from '../components/timeline'
import { FilterPanel } from './FilterPanel'
import { Loading } from './ui'
import { useTimeline, useShare } from '../hooks'
import {
  shareOrCopy,
  navigateToHome,
  navigateToEdit,
  navigateTo,
  buildTagUrl,
  buildSearchUrl,
  contentHasTag,
  DEFAULT_SEARCH_FILTERS,
} from '../lib/utils'
import type { Event, SearchFilters } from '../types'

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  filters?: SearchFilters
  showSearchBox?: boolean
}

export function Timeline({
  onEditStart,
  onReplyStart,
  filters = DEFAULT_SEARCH_FILTERS,
  showSearchBox,
}: TimelineProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { copied: filterCopied, share: shareFilter } = useShare()

  // Extract filter values for easier access
  // Note: langFilter is reserved for future language detection feature
  const { query, ngWords, tags: filterTags, mode: filterMode, mypace: mypaceOnly, lang: _langFilter } = filters

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
  } = useTimeline()

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

  const handleShareFilter = useCallback(() => shareFilter(window.location.href), [shareFilter])

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
      if (filterTags.length === 0 && !showSearchBox) {
        // Simple tag filter via /tag/xxx
        navigateTo(`/tag/${encodeURIComponent(tag)}`)
      } else {
        // Add to existing search filters
        if (!filterTags.includes(tag)) {
          navigateTo(buildSearchUrl({ ...filters, tags: [...filterTags, tag] }))
        }
      }
    },
    [filters, filterTags, showSearchBox]
  )

  // Set up hashtag click handler
  useMemo(() => {
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
  let filteredItems = items

  // Filter by mypace tag
  if (mypaceOnly) {
    filteredItems = filteredItems.filter((item) => contentHasTag(item.event.content, 'mypace'))
  }

  // Filter by hashtags
  if (filterTags.length > 0) {
    filteredItems = filteredItems.filter((item) =>
      filterMode === 'and'
        ? filterTags.every((tag) => contentHasTag(item.event.content, tag))
        : filterTags.some((tag) => contentHasTag(item.event.content, tag))
    )
  }

  // Filter by OK word (case-insensitive)
  if (query) {
    const lowerQuery = query.toLowerCase()
    filteredItems = filteredItems.filter((item) => item.event.content.toLowerCase().includes(lowerQuery))
  }

  // Filter by NG words (exclude posts containing any NG word)
  if (ngWords.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const lowerContent = item.event.content.toLowerCase()
      return !ngWords.some((ngWord) => lowerContent.includes(ngWord.toLowerCase()))
    })
  }

  // Determine if we're on search page
  const isSearchPage = showSearchBox

  const clearFilter = () => {
    if (isSearchPage) {
      navigateTo(buildSearchUrl({}))
    } else {
      navigateToHome()
    }
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = filterTags.filter((t) => t !== tagToRemove)
    if (isSearchPage) {
      navigateTo(buildSearchUrl({ ...filters, tags: newTags }))
    } else {
      navigateTo(buildTagUrl(newTags, filterMode))
    }
  }

  const toggleFilterMode = () => {
    const newMode = filterMode === 'and' ? 'or' : 'and'
    if (isSearchPage) {
      navigateTo(buildSearchUrl({ ...filters, mode: newMode }))
    } else {
      navigateTo(buildTagUrl(filterTags, newMode))
    }
  }

  return (
    <div className="timeline">
      {showSearchBox && (
        <FilterPanel isPopup={false} filters={filters} onRemoveTag={removeTag} onToggleMode={toggleFilterMode} />
      )}
      {newEventCount > 0 && (
        <button className="new-posts-banner" onClick={loadNewEvents}>
          {newEventCount}件の新着投稿があります
        </button>
      )}
      {!showSearchBox && filterTags.length > 0 && (
        <FilterBar
          filterTags={filterTags}
          filterMode={filterMode}
          filterCopied={filterCopied}
          onRemoveTag={removeTag}
          onToggleMode={toggleFilterMode}
          onClearAll={clearFilter}
          onShare={handleShareFilter}
        />
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
