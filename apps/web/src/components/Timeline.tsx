import { useState, useEffect, useCallback } from 'react'
import { TIMEOUTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, SearchBox, TimelinePostCard } from '../components/timeline'
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
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { copied: filterCopied, share: shareFilter } = useShare()

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
    reload,
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

  if (loading && events.length === 0) return <div className="loading">Loading...</div>

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
  const handleSearch = () => {
    navigateTo(buildSearchUrl(searchQuery, filterTags, filterMode))
  }

  return (
    <div className="timeline">
      {showSearchBox && (
        <SearchBox
          searchQuery={searchQuery}
          filterTags={filterTags}
          filterMode={filterMode}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
        />
      )}
      {filterTags.length > 0 && (
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

        if (deletedId === event.id) {
          return (
            <article key={event.id} className="post-card">
              <p className="success">Deleted!</p>
            </article>
          )
        }

        return (
          <TimelinePostCard
            key={item.repostedBy ? `repost-${event.id}-${item.repostedBy.pubkey}` : event.id}
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
        )
      })}
      {filteredItems.length === 0 && (
        <p className="empty">
          {currentSearchQuery || filterTags.length > 0 ? 'No posts matching filter' : 'No posts yet'}
        </p>
      )}
    </div>
  )
}
