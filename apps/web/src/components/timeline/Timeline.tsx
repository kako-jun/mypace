import { useState, useCallback, Fragment, useEffect, useRef, useMemo, memo } from 'react'
import { TIMEOUTS, CUSTOM_EVENTS } from '../../lib/constants'
import '../../styles/components/timeline.css'
import '../../styles/components/timeline-search.css'
import { setHashtagClickHandler, setSuperMentionClickHandler, setInternalLinkClickHandler } from '../../lib/parser'
import { TimelinePostCard, TimelineActionButton, TimelineSearch } from './index'
import { Loading, Button, ErrorMessage, SuccessMessage } from '../ui'
import { useTimeline } from '../../hooks'
import { useWordrotContext } from '../wordrot'
import {
  copyToClipboard,
  downloadAsMarkdown,
  openRawUrl,
  shareOrCopy,
  navigateToEdit,
  navigateTo,
  navigateToTag,
  formatNumber,
} from '../../lib/utils'
import { openSnsShare } from '../../lib/utils/sns-share'
import type { Event } from '../../types'
import type { ShareOption } from '../post/ShareMenu'

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
}

export const Timeline = memo(function Timeline({ onEditStart, onReplyStart }: TimelineProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [, setThemeVersion] = useState(0)

  // Search/filter state (public filters from URL)
  const [searchQuery, setSearchQuery] = useState<string[]>([])
  const [searchTags, setSearchTags] = useState<string[]>([])

  // Re-render when app theme changes
  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

  // Handle search filter changes from TimelineSearch component
  const handleFiltersChange = useCallback((filters: { q: string[]; tags: string[] }) => {
    setSearchQuery(filters.q)
    setSearchTags(filters.tags)
  }, [])

  // Wordrot context for word extraction and collection
  const wordrot = useWordrotContext()

  // Memoize wordrot values to prevent unnecessary re-renders of post cards
  const wordrotCollected = useMemo(() => wordrot?.collectedWords, [wordrot?.collectedWords])
  const wordrotImages = useMemo(() => wordrot?.wordImages, [wordrot?.wordImages])
  const wordrotCollect = useMemo(() => wordrot?.collect, [wordrot?.collect])
  const wordrotGetWords = useMemo(() => wordrot?.getWords, [wordrot?.getWords])

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
    views,
    wikidataMap,
    ogpMap,
    likingId,
    repostingId,
    newEventCount,
    hasMore,
    loadingMore,
    reload,
    loadNewEvents,
    loadOlderEvents,
    handleAddStella,
    handleUnlike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  } = useTimeline({
    q: searchQuery.length > 0 ? searchQuery : undefined,
    tags: searchTags.length > 0 ? searchTags : undefined,
  })

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

  const handleShareOption = useCallback(
    async (eventId: string, content: string, tags: string[][], option: ShareOption, partIndex?: number) => {
      const url = `${window.location.origin}/post/${eventId}`
      switch (option) {
        case 'url-copy': {
          const copied = await copyToClipboard(url)
          if (copied) {
            setCopiedId(eventId)
            setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
          }
          break
        }
        case 'url-share': {
          const result = await shareOrCopy(url)
          if (result.copied) {
            setCopiedId(eventId)
            setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
          }
          break
        }
        case 'md-copy': {
          const copied = await copyToClipboard(content)
          if (copied) {
            setCopiedId(eventId)
            setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
          }
          break
        }
        case 'md-download': {
          const filename = `post-${eventId.slice(0, 8)}`
          downloadAsMarkdown(content, filename)
          setCopiedId(eventId)
          setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
          break
        }
        case 'md-open': {
          openRawUrl(eventId)
          break
        }
        case 'x':
        case 'bluesky':
        case 'threads': {
          openSnsShare(option, content, tags, url, partIndex)
          break
        }
      }
    },
    []
  )

  const handleDeleteConfirm = useCallback(
    async (event: Event) => {
      await handleDelete(event)
      setDeletedId(event.id)
      setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
    },
    [handleDelete]
  )

  // Handle internal link clicks - SPA navigation
  const handleInternalLinkClick = useCallback((path: string) => {
    navigateTo(path)
  }, [])

  // Set up click handlers for hashtag/supermention
  useEffect(() => {
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setSuperMentionClickHandler((path) => navigateToTag(path))
    setInternalLinkClickHandler(handleInternalLinkClick)
  }, [handleInternalLinkClick])

  // Extract words for visible posts (wordrot)
  // Use refs to avoid dependency on wordrot object which changes frequently
  const wordrotRef = useRef(wordrot)
  wordrotRef.current = wordrot

  useEffect(() => {
    if (!wordrotRef.current || items.length === 0) return

    // Filter posts that haven't been extracted yet
    const postsToExtract = items
      .filter((item) => !wordrotRef.current!.hasWords(item.event.id))
      .map((item) => ({
        eventId: item.event.id,
        content: item.event.content,
      }))

    if (postsToExtract.length > 0) {
      wordrotRef.current.extractWords(postsToExtract)
    }
  }, [items])

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

  // All filtering is done server-side via API
  return (
    <div className="timeline">
      <TimelineSearch onFiltersChange={handleFiltersChange} />
      {newEventCount > 0 && (
        <TimelineActionButton onClick={loadNewEvents}>{formatNumber(newEventCount)} New Posts</TimelineActionButton>
      )}
      {items.map((item) => {
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
          <Fragment key={item.repostedBy ? `repost-${event.id}-${item.repostedBy.pubkey}` : event.id}>
            <TimelinePostCard
              event={event}
              originalEvent={item.originalEvent}
              repostedBy={item.repostedBy}
              isMyPost={isMyPost}
              myPubkey={myPubkey}
              profiles={profiles}
              wikidataMap={wikidataMap}
              ogpMap={ogpMap}
              reactions={reactions[event.id]}
              replies={replies[event.id]}
              reposts={reposts[event.id]}
              views={views[event.id]}
              likingId={likingId}
              repostingId={repostingId}
              copiedId={copiedId}
              onEdit={handleEdit}
              onDeleteConfirm={handleDeleteConfirm}
              onAddStella={handleAddStella}
              onUnlike={handleUnlike}
              onReply={handleReplyClick}
              onRepost={handleRepost}
              onShareOption={handleShareOption}
              getDisplayName={getDisplayName}
              getAvatarUrl={getAvatarUrl}
              wordrotWords={wordrotGetWords?.(event.id)}
              wordrotCollected={wordrotCollected}
              wordrotImages={wordrotImages}
              onWordCollect={wordrotCollect}
            />
          </Fragment>
        )
      })}
      {items.length === 0 && <p className="empty">No posts yet</p>}
      {!loadingMore && (
        <TimelineActionButton onClick={loadOlderEvents}>
          {hasMore ? 'Load Older Posts' : 'End of timeline (retry)'}
        </TimelineActionButton>
      )}
      {loadingMore && <TimelineActionButton disabled>Loading...</TimelineActionButton>}
    </div>
  )
})
