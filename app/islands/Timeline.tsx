import { useState, useEffect, useCallback } from 'hono/jsx'
import { TIMEOUTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, TimelinePostCard } from '../components/timeline'
import { useTimeline, useShare } from '../hooks'
import { shareOrCopy, navigateToHome, navigateToEdit, navigateToTag, navigateToAddTag, buildTagUrl } from '../lib/utils'
import type { Event } from 'nostr-tools'

// Helper function moved outside component to prevent recreation on each render
const contentHasTag = (content: string, tag: string): boolean => {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`#${escapedTag}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'i').test(content)
}

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  initialFilterTags?: string[]
  initialFilterMode?: 'and' | 'or'
}

export default function Timeline({ onEditStart, onReplyStart, initialFilterTags, initialFilterMode }: TimelineProps) {
  const [filterTags] = useState<string[]>(initialFilterTags || [])
  const [filterMode] = useState<'and' | 'or'>(initialFilterMode || 'and')
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

  const handleEdit = useCallback((event: Event) => {
    if (onEditStart) {
      onEditStart(event)
    } else {
      navigateToEdit(event.id)
    }
  }, [onEditStart])

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

  const handleDeleteConfirm = useCallback(async (event: Event) => {
    await handleDelete(event)
    setDeletedId(event.id)
    setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
  }, [handleDelete])

  useEffect(() => {
    setHashtagClickHandler((tag) => {
      if (filterTags.length === 0) {
        navigateToTag(tag)
      } else if (!filterTags.includes(tag)) {
        navigateToAddTag(filterTags, tag, filterMode)
      }
    })
  }, [filterTags, filterMode])

  if (loading && events.length === 0) return <div class="loading">Loading...</div>

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    )
  }

  const filteredItems = filterTags.length > 0
    ? items.filter(item => filterMode === 'and'
        ? filterTags.every(tag => contentHasTag(item.event.content, tag))
        : filterTags.some(tag => contentHasTag(item.event.content, tag)))
    : items

  const clearFilter = () => navigateToHome()
  const removeTag = (tagToRemove: string) => {
    const newTags = filterTags.filter(t => t !== tagToRemove)
    window.location.href = buildTagUrl(newTags, filterMode)
  }
  const toggleFilterMode = () => {
    const newMode = filterMode === 'and' ? 'or' : 'and'
    window.location.href = buildTagUrl(filterTags, newMode)
  }

  return (
    <div class="timeline">
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
            <article key={event.id} class="post-card">
              <p class="success">Deleted!</p>
            </article>
          )
        }

        return (
          <TimelinePostCard
            key={item.repostedBy ? `repost-${event.id}-${item.repostedBy.pubkey}` : event.id}
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
            onDelete={() => {}}
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
      {filteredItems.length === 0 && <p class="empty">{filterTags.length > 0 ? 'No posts matching filter' : 'No posts yet'}</p>}
    </div>
  )
}
