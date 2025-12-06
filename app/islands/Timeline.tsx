import { useState, useEffect } from 'hono/jsx'
import { fetchEvents, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts, fetchRepostEvents, publishEvent } from '../lib/nostr/relay'
import { formatTimestamp, getCurrentPubkey, createTextNote, createDeleteEvent, createReactionEvent, createRepostEvent, getEventThemeColors, getThemeCardProps, MYPACE_TAG, type Profile } from '../lib/nostr/events'
import { exportNpub } from '../lib/nostr/keys'
import { renderContent, setHashtagClickHandler } from '../lib/content-parser'
import type { Event } from 'nostr-tools'

interface ProfileCache {
  [pubkey: string]: Profile | null
}

interface ReactionData {
  count: number
  myReaction: boolean
}

interface ReplyData {
  count: number
  replies: Event[]
}

interface RepostData {
  count: number
  myRepost: boolean
}

// Timeline item can be original post or repost
interface TimelineItem {
  event: Event
  repostedBy?: {
    pubkey: string
    timestamp: number
  }
}

interface TimelineProps {
  onEditStart?: (event: Event) => void
  onReplyStart?: (event: Event) => void
  initialFilterTag?: string
}

export default function Timeline({ onEditStart, onReplyStart, initialFilterTag }: TimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [profiles, setProfiles] = useState<ProfileCache>({})
  const [reactions, setReactions] = useState<{ [eventId: string]: ReactionData }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: ReplyData }>({})
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(initialFilterTag || null)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [reposts, setReposts] = useState<{ [eventId: string]: RepostData }>({})
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [editPreview, setEditPreview] = useState(false)

  const loadTimeline = async () => {
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let notes: Event[] = []
      // Try API first (uses D1 cache on server)
      const res = await fetch('/api/timeline?limit=50')
      if (res.ok) {
        const data = await res.json()
        notes = data.events
      } else {
        // Fallback to direct relay connection
        notes = await fetchEvents({ kinds: [1] }, 50)
      }

      // Fetch reposts and merge into timeline
      const repostEvents = await fetchRepostEvents(50)
      const items: TimelineItem[] = []
      const allOriginalEvents: Event[] = [...notes]

      // Add original posts
      for (const note of notes) {
        items.push({ event: note })
      }

      // Add reposts (parse original event from content)
      for (const repost of repostEvents) {
        try {
          // NIP-18: content should contain the stringified original event
          if (!repost.content || repost.content.trim() === '') {
            continue
          }
          const originalEvent = JSON.parse(repost.content) as Event
          // Only include if it's a mypace post
          const hasMypaceTag = originalEvent.tags?.some(
            t => t[0] === 't' && t[1] === MYPACE_TAG
          )
          if (hasMypaceTag) {
            // Add repost as a separate timeline item (with repost label)
            items.push({
              event: originalEvent,
              repostedBy: {
                pubkey: repost.pubkey,
                timestamp: repost.created_at
              }
            })
            if (!allOriginalEvents.some(e => e.id === originalEvent.id)) {
              allOriginalEvents.push(originalEvent)
            }
          }
        } catch {
          // Invalid repost content, skip
        }
      }

      // Sort by timestamp (use repost timestamp if available)
      items.sort((a, b) => {
        const aTime = a.repostedBy?.timestamp || a.event.created_at
        const bTime = b.repostedBy?.timestamp || b.event.created_at
        return bTime - aTime
      })

      setTimelineItems(items)
      setEvents(allOriginalEvents)
      loadProfiles(allOriginalEvents)
      loadReactions(allOriginalEvents, pubkey)
      loadRepliesData(allOriginalEvents)
      loadRepostsData(allOriginalEvents, pubkey)

      // Load profiles for reposters
      const reposterPubkeys = items
        .filter(item => item.repostedBy)
        .map(item => item.repostedBy!.pubkey)
      for (const pk of reposterPubkeys) {
        if (profiles[pk] === undefined) {
          try {
            const profileEvent = await fetchUserProfile(pk)
            if (profileEvent) {
              setProfiles(prev => ({ ...prev, [pk]: JSON.parse(profileEvent.content) }))
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }

  const loadReactions = async (events: Event[], myPubkey: string) => {
    const eventIds = events.map(e => e.id)
    try {
      const reactionEvents = await fetchReactions(eventIds)
      const reactionMap: { [eventId: string]: ReactionData } = {}

      for (const eventId of eventIds) {
        const eventReactions = reactionEvents.filter(r => {
          const eTag = r.tags.find(t => t[0] === 'e')
          return eTag && eTag[1] === eventId && (r.content === '+' || r.content === '')
        })
        reactionMap[eventId] = {
          count: eventReactions.length,
          myReaction: eventReactions.some(r => r.pubkey === myPubkey)
        }
      }

      setReactions(reactionMap)
    } catch (err) {
      console.error('Failed to load reactions:', err)
    }
  }

  const loadRepliesData = async (events: Event[]) => {
    const eventIds = events.map(e => e.id)
    try {
      const replyEvents = await fetchReplies(eventIds)
      const replyMap: { [eventId: string]: ReplyData } = {}

      for (const eventId of eventIds) {
        const eventReplies = replyEvents.filter(r => {
          // Find e tag with root marker pointing to this event
          const rootTag = r.tags.find(t => t[0] === 'e' && t[3] === 'root')
          return rootTag && rootTag[1] === eventId
        })
        replyMap[eventId] = {
          count: eventReplies.length,
          replies: eventReplies
        }
      }

      setReplies(replyMap)

      // Also load profiles for reply authors
      const replyPubkeys = [...new Set(replyEvents.map(r => r.pubkey))]
      for (const pubkey of replyPubkeys) {
        if (profiles[pubkey] === undefined) {
          try {
            const profileEvent = await fetchUserProfile(pubkey)
            if (profileEvent) {
              setProfiles(prev => ({ ...prev, [pubkey]: JSON.parse(profileEvent.content) }))
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load replies:', err)
    }
  }

  const loadRepostsData = async (events: Event[], myPubkey: string) => {
    const eventIds = events.map(e => e.id)
    try {
      const repostEvents = await fetchReposts(eventIds)
      const repostMap: { [eventId: string]: RepostData } = {}

      for (const eventId of eventIds) {
        const eventReposts = repostEvents.filter(r => {
          const eTag = r.tags.find(t => t[0] === 'e')
          return eTag && eTag[1] === eventId
        })
        repostMap[eventId] = {
          count: eventReposts.length,
          myRepost: eventReposts.some(r => r.pubkey === myPubkey)
        }
      }

      setReposts(repostMap)
    } catch (err) {
      console.error('Failed to load reposts:', err)
    }
  }

  const loadProfiles = async (events: Event[]) => {
    const pubkeys = [...new Set(events.map(e => e.pubkey))]
    const newProfiles: ProfileCache = { ...profiles }

    for (const pubkey of pubkeys) {
      if (newProfiles[pubkey] !== undefined) continue
      try {
        const profileEvent = await fetchUserProfile(pubkey)
        if (profileEvent) {
          newProfiles[pubkey] = JSON.parse(profileEvent.content)
        } else {
          newProfiles[pubkey] = null
        }
      } catch {
        newProfiles[pubkey] = null
      }
    }

    setProfiles(newProfiles)
  }

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles[pubkey]
    if (profile?.display_name) return profile.display_name
    if (profile?.name) return profile.name
    return exportNpub(pubkey).slice(0, 12) + '...'
  }

  const handleEdit = (event: Event) => {
    if (onEditStart) {
      // Use new editing flow via PostForm
      onEditStart(event)
    } else {
      // Fallback to inline editing
      setEditingId(event.id)
      setEditContent(event.content)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (originalEvent: Event) => {
    if (!editContent.trim()) return

    try {
      // Create delete request for original
      const deleteEvent = await createDeleteEvent([originalEvent.id])
      await publishEvent(deleteEvent)

      // Create new post with updated content
      const newEvent = await createTextNote(editContent.trim())
      await publishEvent(newEvent)

      setEditingId(null)
      setEditContent('')
      setSavedId(originalEvent.id)
      setTimeout(() => setSavedId(null), 2000)

      // Reload timeline
      setTimeout(loadTimeline, 1000)
    } catch (err) {
      console.error('Failed to edit:', err)
    }
  }

  const handleDeleteClick = (eventId: string) => {
    setConfirmDeleteId(eventId)
  }

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null)
  }

  const handleDeleteConfirm = async (event: Event) => {
    try {
      const deleteEvent = await createDeleteEvent([event.id])
      await publishEvent(deleteEvent)

      setConfirmDeleteId(null)
      setEditingId(null)
      setDeletedId(event.id)
      setTimeout(() => {
        setDeletedId(null)
        loadTimeline()
      }, 1500)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleLike = async (event: Event) => {
    if (likingId || !myPubkey) return
    const reactionData = reactions[event.id]
    if (reactionData?.myReaction) return // Already liked

    setLikingId(event.id)
    try {
      const reactionEvent = await createReactionEvent(event, '+')
      await publishEvent(reactionEvent)

      // Optimistic update
      setReactions(prev => ({
        ...prev,
        [event.id]: {
          count: (prev[event.id]?.count || 0) + 1,
          myReaction: true
        }
      }))
    } catch (err) {
      console.error('Failed to like:', err)
    } finally {
      setLikingId(null)
    }
  }

  const handleReplyClick = (event: Event) => {
    if (onReplyStart) {
      onReplyStart(event)
    }
  }

  const toggleThread = (eventId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  const handleRepost = async (event: Event) => {
    if (repostingId || !myPubkey) return
    const repostData = reposts[event.id]
    if (repostData?.myRepost) return // Already reposted

    setRepostingId(event.id)
    try {
      const repostEvent = await createRepostEvent(event)
      await publishEvent(repostEvent)

      // Optimistic update
      setReposts(prev => ({
        ...prev,
        [event.id]: {
          count: (prev[event.id]?.count || 0) + 1,
          myRepost: true
        }
      }))
    } catch (err) {
      console.error('Failed to repost:', err)
    } finally {
      setRepostingId(null)
    }
  }

  useEffect(() => {
    loadTimeline()

    const handleNewPost = () => {
      setTimeout(loadTimeline, 1000)
    }
    window.addEventListener('newpost', handleNewPost)

    // Set up hashtag click handler - navigate to tag URL
    setHashtagClickHandler((tag) => {
      window.location.href = `/tag/${encodeURIComponent(tag)}`
    })

    return () => {
      window.removeEventListener('newpost', handleNewPost)
    }
  }, [])

  if (loading && events.length === 0) {
    return <div class="loading">Loading...</div>
  }

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={loadTimeline}>Retry</button>
      </div>
    )
  }

  // Filter timeline items by hashtag (check content for #tag)
  const filteredItems = filterTag
    ? timelineItems.filter((item) => {
        // Use word boundary that works with Japanese characters
        const escapedTag = filterTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const tagRegex = new RegExp(`#${escapedTag}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'i')
        return tagRegex.test(item.event.content)
      })
    : timelineItems

  const clearFilter = () => {
    window.location.href = '/'
  }

  return (
    <div class="timeline">
      {filterTag && (
        <div class="filter-bar">
          <span class="filter-label">#{filterTag}</span>
          <button class="filter-clear" onClick={clearFilter}>×</button>
        </div>
      )}
      {filteredItems.map((item) => {
        const event = item.event
        const isMyPost = myPubkey === event.pubkey
        const isEditing = editingId === event.id
        const justSaved = savedId === event.id
        const justDeleted = deletedId === event.id
        const isConfirmingDelete = confirmDeleteId === event.id
        const themeColors = getEventThemeColors(event)
        const themeProps = getThemeCardProps(themeColors)

        const handleCardClick = (e: MouseEvent) => {
          // Don't navigate if clicking on buttons or links
          const target = e.target as HTMLElement
          if (target.closest('button') || target.closest('a') || target.closest('.post-footer') || target.closest('.thread-section')) {
            return
          }
          window.location.href = `/post/${event.id}`
        }

        return (
          <article
            key={item.repostedBy ? `repost-${event.id}-${item.repostedBy.pubkey}` : event.id}
            class={`post-card clickable ${isMyPost ? 'my-post' : ''} ${themeProps.className}`}
            style={themeProps.style}
            onClick={handleCardClick}
          >
            {item.repostedBy && (
              <div class="repost-label">
                🔁 {getDisplayName(item.repostedBy.pubkey)} reposted
              </div>
            )}
            <header class="post-header">
              <span class="author-name">{getDisplayName(event.pubkey)}</span>
              <time class="timestamp">{formatTimestamp(event.created_at)}</time>
            </header>

            {isEditing ? (
              <div class="edit-form">
                <textarea
                  class="edit-input"
                  value={editContent}
                  onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  maxLength={280}
                />
                <div class="edit-actions">
                  {isConfirmingDelete ? (
                    <div class="delete-confirm">
                      <span class="delete-confirm-text">Delete?</span>
                      <button class="delete-confirm-yes" onClick={() => handleDeleteConfirm(event)}>Yes</button>
                      <button class="delete-confirm-no" onClick={handleDeleteCancel}>No</button>
                    </div>
                  ) : (
                    <button class="delete-button" onClick={() => handleDeleteClick(event.id)}>Delete</button>
                  )}
                  <div class="edit-actions-right">
                    <button class="cancel-button" onClick={handleCancelEdit}>Cancel</button>
                    <button class="save-button" onClick={() => handleSaveEdit(event)}>Save</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div class="post-content">
                  {event.content.length > 420 || event.content.split('\n').length > 42 ? (
                    <>
                      {renderContent(event.content.slice(0, 420) + '...')}
                      <span class="read-more-text">続きを読む</span>
                    </>
                  ) : (
                    renderContent(event.content)
                  )}
                </div>
                {justSaved && <p class="success">Saved!</p>}
                {justDeleted && <p class="success">Deleted!</p>}
                {!justSaved && !justDeleted && (
                  <div class="post-footer">
                    {!isMyPost && (
                      <button
                        class={`like-button ${reactions[event.id]?.myReaction ? 'liked' : ''}`}
                        onClick={() => handleLike(event)}
                        disabled={likingId === event.id || reactions[event.id]?.myReaction}
                      >
                        {reactions[event.id]?.myReaction ? '★' : '☆'}
                        {reactions[event.id]?.count ? ` ${reactions[event.id].count}` : ''}
                      </button>
                    )}
                    {isMyPost && reactions[event.id]?.count > 0 && (
                      <span class="like-count">★ {reactions[event.id].count}</span>
                    )}
                    <button
                      class="reply-button"
                      onClick={() => handleReplyClick(event)}
                    >
                      💬{replies[event.id]?.count ? ` ${replies[event.id].count}` : ''}
                    </button>
                    <button
                      class={`repost-button ${reposts[event.id]?.myRepost ? 'reposted' : ''}`}
                      onClick={() => handleRepost(event)}
                      disabled={repostingId === event.id || reposts[event.id]?.myRepost}
                    >
                      🔁{reposts[event.id]?.count ? ` ${reposts[event.id].count}` : ''}
                    </button>
                    {isMyPost && (
                      <>
                        {isConfirmingDelete ? (
                          <div class="delete-confirm">
                            <span class="delete-confirm-text">Delete?</span>
                            <button class="delete-confirm-yes" onClick={() => handleDeleteConfirm(event)}>Yes</button>
                            <button class="delete-confirm-no" onClick={handleDeleteCancel}>No</button>
                          </div>
                        ) : (
                          <>
                            <button class="edit-button" onClick={() => handleEdit(event)}>Edit</button>
                            <button class="delete-button" onClick={() => handleDeleteClick(event.id)}>Delete</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Thread replies */}
                {replies[event.id]?.count > 0 && (
                  <div class="thread-section">
                    <button
                      class="thread-toggle"
                      onClick={() => toggleThread(event.id)}
                    >
                      {expandedThreads.has(event.id) ? '▼' : '▶'} {replies[event.id].count} replies
                    </button>
                    {expandedThreads.has(event.id) && (
                      <div class="thread-replies">
                        {replies[event.id].replies.map((reply) => {
                          const replyThemeColors = getEventThemeColors(reply)
                          const replyThemeProps = getThemeCardProps(replyThemeColors)
                          return (
                            <div
                              key={reply.id}
                              class={`reply-card ${replyThemeProps.className}`}
                              style={replyThemeProps.style}
                            >
                              <header class="reply-header">
                                <span class="author-name">{getDisplayName(reply.pubkey)}</span>
                                <time class="timestamp">{formatTimestamp(reply.created_at)}</time>
                              </header>
                              <div class="reply-content">{renderContent(reply.content)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </article>
        )
      })}
      {filteredItems.length === 0 && (
        <p class="empty">
          {filterTag ? `No posts with #${filterTag}` : 'No posts yet'}
        </p>
      )}
    </div>
  )
}
