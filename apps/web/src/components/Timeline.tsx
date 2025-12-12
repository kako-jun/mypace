import { useState, useEffect, useCallback, Fragment } from 'react'
import { TIMEOUTS, STORAGE_KEYS, CUSTOM_EVENTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, TimelinePostCard } from '../components/timeline'
import { FilterPanel } from './FilterPanel'
import { Loading } from './ui'
import { useTimeline, useShare } from '../hooks'
import {
  shareOrCopy,
  navigateToHome,
  navigateToEdit,
  navigateToTag,
  navigateToAddTag,
  navigateTo,
  buildTagUrl,
  buildSearchUrl,
  contentHasTag,
} from '../lib/utils'
import type { Event, FilterMode } from '../types'

// Helper to get NG words from storage
function getNgWords(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.NG_WORDS)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  initialFilterTags?: string[]
  initialFilterMode?: FilterMode
  initialSearchQuery?: string
  showSearchBox?: boolean
}

export function Timeline({
  onEditStart,
  onReplyStart,
  initialFilterTags,
  initialFilterMode,
  initialSearchQuery,
  showSearchBox,
}: TimelineProps) {
  const [filterTags] = useState<string[]>(initialFilterTags || [])
  const [filterMode] = useState<FilterMode>(initialFilterMode || 'and')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [ngWords, setNgWords] = useState<string[]>(getNgWords)
  const { copied: filterCopied, share: shareFilter } = useShare()

  // Listen for NG words changes
  useEffect(() => {
    const handleNgWordsChange = () => setNgWords(getNgWords())
    window.addEventListener(CUSTOM_EVENTS.NG_WORDS_CHANGED, handleNgWordsChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.NG_WORDS_CHANGED, handleNgWordsChange)
  }, [])

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

  useEffect(() => {
    setHashtagClickHandler((tag) => {
      if (filterTags.length === 0) {
        navigateToTag(tag)
      } else if (!filterTags.includes(tag)) {
        navigateToAddTag(filterTags, tag, filterMode)
      }
    })
  }, [filterTags, filterMode])

  if (loading && events.length === 0) return <Loading />

  if (error) {
    return (
      <div className="error-box">
        <p>{error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    )
  }

  // Filter by tags
  let filteredItems =
    filterTags.length > 0
      ? items.filter((item) =>
          filterMode === 'and'
            ? filterTags.every((tag) => contentHasTag(item.event.content, tag))
            : filterTags.some((tag) => contentHasTag(item.event.content, tag))
        )
      : items

  // Filter by search query (case-insensitive)
  const currentSearchQuery = initialSearchQuery || ''
  if (currentSearchQuery) {
    const lowerQuery = currentSearchQuery.toLowerCase()
    filteredItems = filteredItems.filter((item) => item.event.content.toLowerCase().includes(lowerQuery))
  }

  // Filter by NG words (exclude posts containing any NG word)
  if (ngWords.length > 0) {
    filteredItems = filteredItems.filter((item) => {
      const lowerContent = item.event.content.toLowerCase()
      return !ngWords.some((ngWord) => lowerContent.includes(ngWord.toLowerCase()))
    })
  }

  // Determine if we're on search page (has query or tags via search)
  const isSearchPage = showSearchBox

  const clearFilter = () => {
    if (isSearchPage) {
      navigateTo(buildSearchUrl('', [], 'and'))
    } else {
      navigateToHome()
    }
  }
  const removeTag = (tagToRemove: string) => {
    const newTags = filterTags.filter((t) => t !== tagToRemove)
    if (isSearchPage) {
      navigateTo(buildSearchUrl(currentSearchQuery, newTags, filterMode))
    } else {
      navigateTo(buildTagUrl(newTags, filterMode))
    }
  }
  const toggleFilterMode = () => {
    const newMode = filterMode === 'and' ? 'or' : 'and'
    if (isSearchPage) {
      navigateTo(buildSearchUrl(currentSearchQuery, filterTags, newMode))
    } else {
      navigateTo(buildTagUrl(filterTags, newMode))
    }
  }

  return (
    <div className="timeline">
      {showSearchBox && (
        <FilterPanel
          isPopup={false}
          initialSearchQuery={initialSearchQuery}
          filterTags={filterTags}
          filterMode={filterMode}
          onRemoveTag={removeTag}
          onToggleMode={toggleFilterMode}
          onClearTags={clearFilter}
        />
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
          {currentSearchQuery || filterTags.length > 0 ? 'No posts matching filter' : 'No posts yet'}
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
