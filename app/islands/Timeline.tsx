import { useState, useEffect, useCallback, useRef } from 'hono/jsx'
import { TIMEOUTS } from '../lib/constants'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, TimelinePostCard } from '../components/timeline'
import { useTimeline, useShare } from '../hooks'
import {
  shareOrCopy,
  navigateToHome,
  navigateToEdit,
  navigateToTag,
  navigateToAddTag,
  buildTagUrl,
  contentHasTag,
} from '../lib/utils'
import type { Event } from 'nostr-tools'
import type { FilterMode } from '../types'

const CARD_WIDTH = 560
const CARD_GAP = 8 // 0.5rem
const CARD_OVERLAP = 24 // -1.5rem overlap
const STAGGER_OFFSET = 48 // 3rem per column

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  initialFilterTags?: string[]
  initialFilterMode?: FilterMode
}

export default function Timeline({ onEditStart, onReplyStart, initialFilterTags, initialFilterMode }: TimelineProps) {
  const [filterTags] = useState<string[]>(initialFilterTags || [])
  const [filterMode] = useState<FilterMode>(initialFilterMode || 'and')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { copied: filterCopied, share: shareFilter } = useShare()
  const timelineRef = useRef<HTMLDivElement>(null)

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

  // Apply diagonal stagger based on column position
  useEffect(() => {
    const applyStagger = () => {
      const timeline = timelineRef.current
      if (!timeline) return

      const cards = timeline.querySelectorAll('.post-card') as NodeListOf<HTMLElement>
      const containerWidth = timeline.clientWidth
      const effectiveCardWidth = CARD_WIDTH + CARD_GAP - CARD_OVERLAP
      const columnsCount = Math.max(1, Math.floor((containerWidth + CARD_GAP) / effectiveCardWidth))

      cards.forEach((card, index) => {
        // In row-reverse, first card is rightmost (column 0)
        // Column increases as we go left
        const columnFromRight = index % columnsCount
        const marginTop = columnFromRight * STAGGER_OFFSET
        card.style.marginTop = `${marginTop}px`
      })
    }

    applyStagger()
    window.addEventListener('resize', applyStagger)
    return () => window.removeEventListener('resize', applyStagger)
  }, [items])

  if (loading && events.length === 0) return <div class="loading">Loading...</div>

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={reload}>Retry</button>
      </div>
    )
  }

  const filteredItems =
    filterTags.length > 0
      ? items.filter((item) =>
          filterMode === 'and'
            ? filterTags.every((tag) => contentHasTag(item.event.content, tag))
            : filterTags.some((tag) => contentHasTag(item.event.content, tag))
        )
      : items

  const clearFilter = () => navigateToHome()
  const removeTag = (tagToRemove: string) => {
    const newTags = filterTags.filter((t) => t !== tagToRemove)
    window.location.href = buildTagUrl(newTags, filterMode)
  }
  const toggleFilterMode = () => {
    const newMode = filterMode === 'and' ? 'or' : 'and'
    window.location.href = buildTagUrl(filterTags, newMode)
  }

  return (
    <div class="timeline" ref={timelineRef}>
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
        <p class="empty">{filterTags.length > 0 ? 'No posts matching filter' : 'No posts yet'}</p>
      )}
    </div>
  )
}
