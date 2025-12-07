import { useState, useEffect } from 'hono/jsx'
import { setHashtagClickHandler } from '../lib/content-parser'
import { FilterBar, TimelinePostCard } from '../components/timeline'
import { useTimeline, useShare } from '../hooks'
import { shareOrCopy } from '../lib/utils'
import type { Event } from 'nostr-tools'

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

  const handleEdit = (event: Event) => {
    if (onEditStart) {
      onEditStart(event)
    } else {
      window.location.href = `/?edit=${event.id}`
    }
  }

  const handleReplyClick = (event: Event) => onReplyStart?.(event)

  const handleShare = async (eventId: string) => {
    const url = `${window.location.origin}/post/${eventId}`
    const result = await shareOrCopy(url)
    if (result.copied) {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleShareFilter = () => shareFilter(window.location.href)

  const handleDeleteConfirm = async (event: Event) => {
    await handleDelete(event)
    setDeletedId(event.id)
    setTimeout(() => setDeletedId(null), 1500)
  }

  useEffect(() => {
    setHashtagClickHandler((tag) => {
      if (filterTags.length === 0) {
        window.location.href = `/tag/${encodeURIComponent(tag)}`
      } else if (!filterTags.includes(tag)) {
        const sep = filterMode === 'and' ? '+' : ','
        window.location.href = `/tag/${[...filterTags, tag].map(t => encodeURIComponent(t)).join(sep)}`
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

  const contentHasTag = (content: string, tag: string): boolean => {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`#${escapedTag}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'i').test(content)
  }

  const filteredItems = filterTags.length > 0
    ? items.filter(item => filterMode === 'and'
        ? filterTags.every(tag => contentHasTag(item.event.content, tag))
        : filterTags.some(tag => contentHasTag(item.event.content, tag)))
    : items

  const clearFilter = () => { window.location.href = '/' }
  const removeTag = (tagToRemove: string) => {
    const newTags = filterTags.filter(t => t !== tagToRemove)
    window.location.href = newTags.length === 0 ? '/' : `/tag/${newTags.map(t => encodeURIComponent(t)).join(filterMode === 'and' ? '+' : ',')}`
  }
  const toggleFilterMode = () => {
    const newMode = filterMode === 'and' ? 'or' : 'and'
    window.location.href = `/tag/${filterTags.map(t => encodeURIComponent(t)).join(newMode === 'and' ? '+' : ',')}`
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
