import { useState, useEffect } from 'hono/jsx'
import { fetchEventById, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts, publishEvent } from '../lib/nostr/relay'
import { formatTimestamp, getCurrentPubkey, createDeleteEvent, createReactionEvent, createRepostEvent, getEventThemeColors, getThemeCardProps, type Profile } from '../lib/nostr/events'
import { exportNpub } from '../lib/nostr/keys'
import { renderContent, setHashtagClickHandler } from '../lib/content-parser'
import type { Event } from 'nostr-tools'

interface PostViewProps {
  eventId: string
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

export default function PostView({ eventId }: PostViewProps) {
  const [event, setEvent] = useState<Event | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<ReactionData>({ count: 0, myReaction: false })
  const [replies, setReplies] = useState<ReplyData>({ count: 0, replies: [] })
  const [reposts, setReposts] = useState<RepostData>({ count: 0, myRepost: false })
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: Profile | null }>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)

  useEffect(() => {
    // Set up hashtag click handler to navigate to tag page
    setHashtagClickHandler((tag) => {
      window.location.href = `/tag/${encodeURIComponent(tag)}`
    })

    loadPost()
  }, [eventId])

  const loadPost = async () => {
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      // Try to load from cache first (from timeline navigation)
      let eventData: Event | null = null
      const cachedEvent = sessionStorage.getItem(`post_${eventId}`)
      const cachedProfile = sessionStorage.getItem(`profile_${eventId}_profile`)

      if (cachedEvent) {
        eventData = JSON.parse(cachedEvent)
        setEvent(eventData)
        setLoading(false) // Show content immediately
        sessionStorage.removeItem(`post_${eventId}`)

        // Load cached profile
        const profileKey = `profile_${eventData.pubkey}`
        const cachedProfileData = sessionStorage.getItem(profileKey)
        if (cachedProfileData) {
          setProfile(JSON.parse(cachedProfileData))
          sessionStorage.removeItem(profileKey)
        } else {
          // Load profile in background
          fetchUserProfile(eventData.pubkey).then(profileEvent => {
            if (profileEvent) setProfile(JSON.parse(profileEvent.content))
          })
        }
      } else {
        setLoading(true)
        eventData = await fetchEventById(eventId)
        if (!eventData) {
          setError('Post not found')
          setLoading(false)
          return
        }
        setEvent(eventData)
        setLoading(false)

        // Load profile
        const profileEvent = await fetchUserProfile(eventData.pubkey)
        if (profileEvent) {
          setProfile(JSON.parse(profileEvent.content))
        }
      }

      if (!eventData) return

      // Load reactions
      const reactionEvents = await fetchReactions([eventId])
      const eventReactions = reactionEvents.filter(r => {
        const eTag = r.tags.find(t => t[0] === 'e')
        return eTag && eTag[1] === eventId && (r.content === '+' || r.content === '')
      })
      setReactions({
        count: eventReactions.length,
        myReaction: eventReactions.some(r => r.pubkey === pubkey)
      })

      // Load replies
      const replyEvents = await fetchReplies([eventId])
      const eventReplies = replyEvents.filter(r => {
        const rootTag = r.tags.find(t => t[0] === 'e' && t[3] === 'root')
        return rootTag && rootTag[1] === eventId
      })
      setReplies({
        count: eventReplies.length,
        replies: eventReplies
      })

      // Load reply profiles
      const replyPubkeys = [...new Set(eventReplies.map(r => r.pubkey))]
      const profiles: { [pubkey: string]: Profile | null } = {}
      for (const pk of replyPubkeys) {
        try {
          const pEvent = await fetchUserProfile(pk)
          if (pEvent) {
            profiles[pk] = JSON.parse(pEvent.content)
          }
        } catch {}
      }
      setReplyProfiles(profiles)

      // Load reposts
      const repostEvents = await fetchReposts([eventId])
      setReposts({
        count: repostEvents.length,
        myRepost: repostEvents.some(r => r.pubkey === pubkey)
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }

  const getDisplayName = (pubkey: string, profileData?: Profile | null): string => {
    const p = profileData || profile
    if (p?.display_name) return p.display_name
    if (p?.name) return p.name
    return exportNpub(pubkey).slice(0, 12) + '...'
  }

  const getAvatarUrl = (pubkey: string, profileData?: Profile | null): string | null => {
    const p = profileData || profile
    return p?.picture || null
  }

  const handleLike = async () => {
    if (!event || likingId || !myPubkey || reactions.myReaction) return
    if (event.pubkey === myPubkey) return // Can't like own post

    setLikingId(event.id)
    try {
      const reactionEvent = await createReactionEvent(event, '+')
      await publishEvent(reactionEvent)
      setReactions(prev => ({
        count: prev.count + 1,
        myReaction: true
      }))
    } catch (err) {
      console.error('Failed to like:', err)
    } finally {
      setLikingId(null)
    }
  }

  const handleRepost = async () => {
    if (!event || repostingId || !myPubkey || reposts.myRepost) return

    setRepostingId(event.id)
    try {
      const repostEvent = await createRepostEvent(event)
      await publishEvent(repostEvent)
      setReposts(prev => ({
        count: prev.count + 1,
        myRepost: true
      }))
    } catch (err) {
      console.error('Failed to repost:', err)
    } finally {
      setRepostingId(null)
    }
  }

  const handleDeleteClick = () => {
    if (event) setConfirmDeleteId(event.id)
  }

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!event) return
    try {
      const deleteEvent = await createDeleteEvent([event.id])
      await publishEvent(deleteEvent)
      setConfirmDeleteId(null)
      setDeletedId(event.id)
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleEdit = () => {
    // Navigate to home with edit mode - we'll use a query param
    window.location.href = `/?edit=${eventId}`
  }

  const handleReply = () => {
    // Navigate to home with reply mode
    window.location.href = `/?reply=${eventId}`
  }

  const handleBack = () => {
    window.location.href = '/'
  }

  if (loading) {
    return <div class="loading">Loading...</div>
  }

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={handleBack}>Back to Timeline</button>
      </div>
    )
  }

  if (!event) {
    return (
      <div class="error-box">
        <p>Post not found</p>
        <button onClick={handleBack}>Back to Timeline</button>
      </div>
    )
  }

  const isMyPost = myPubkey === event.pubkey
  const themeColors = getEventThemeColors(event)
  const themeProps = getThemeCardProps(themeColors)
  const isConfirmingDelete = confirmDeleteId === event.id
  const justDeleted = deletedId === event.id

  return (
    <div class="post-view">
      <button class="back-button" onClick={handleBack}>
        ← Back
      </button>

      <article
        class={`post-card post-card-large ${themeProps.className}`}
        style={themeProps.style}
      >
        <header class="post-header">
          {getAvatarUrl(event.pubkey) ? (
            <img src={getAvatarUrl(event.pubkey)!} alt="" class="post-avatar" />
          ) : (
            <div class="post-avatar-placeholder" />
          )}
          <div class="post-author-info">
            <span class="author-name">{getDisplayName(event.pubkey)}</span>
            <time class="timestamp">{formatTimestamp(event.created_at)}</time>
          </div>
        </header>

        <div class="post-content post-content-full">
          {renderContent(event.content)}
        </div>

        {justDeleted && <p class="success">Deleted!</p>}

        {!justDeleted && (
          <div class="post-footer">
            {!isMyPost && (
              <button
                class={`like-button ${reactions.myReaction ? 'liked' : ''}`}
                onClick={handleLike}
                disabled={likingId !== null || reactions.myReaction}
              >
                {reactions.myReaction ? '★' : '☆'}
                {reactions.count > 0 && ` ${reactions.count}`}
              </button>
            )}
            {isMyPost && reactions.count > 0 && (
              <span class="like-count">★ {reactions.count}</span>
            )}
            <button class="reply-button" onClick={handleReply}>
              💬{replies.count > 0 && ` ${replies.count}`}
            </button>
            <button
              class={`repost-button ${reposts.myRepost ? 'reposted' : ''}`}
              onClick={handleRepost}
              disabled={repostingId !== null || reposts.myRepost}
            >
              🔁{reposts.count > 0 && ` ${reposts.count}`}
            </button>
            {isMyPost && (
              <>
                {isConfirmingDelete ? (
                  <div class="delete-confirm">
                    <span class="delete-confirm-text">Delete?</span>
                    <button class="delete-confirm-yes" onClick={handleDeleteConfirm}>Yes</button>
                    <button class="delete-confirm-no" onClick={handleDeleteCancel}>No</button>
                  </div>
                ) : (
                  <>
                    <button class="edit-button" onClick={handleEdit}>Edit</button>
                    <button class="delete-button" onClick={handleDeleteClick}>Delete</button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </article>

      {/* Replies section */}
      {replies.count > 0 && (
        <div class="replies-section">
          <h3 class="replies-heading">{replies.count} Replies</h3>
          <div class="replies-list">
            {replies.replies.map((reply) => {
              const replyThemeColors = getEventThemeColors(reply)
              const replyThemeProps = getThemeCardProps(replyThemeColors)
              return (
                <article
                  key={reply.id}
                  class={`post-card reply-card ${replyThemeProps.className}`}
                  style={replyThemeProps.style}
                  onClick={() => window.location.href = `/post/${reply.id}`}
                >
                  <header class="post-header">
                    {getAvatarUrl(reply.pubkey, replyProfiles[reply.pubkey]) ? (
                      <img src={getAvatarUrl(reply.pubkey, replyProfiles[reply.pubkey])!} alt="" class="post-avatar" />
                    ) : (
                      <div class="post-avatar-placeholder" />
                    )}
                    <div class="post-author-info">
                      <span class="author-name">{getDisplayName(reply.pubkey, replyProfiles[reply.pubkey])}</span>
                      <time class="timestamp">{formatTimestamp(reply.created_at)}</time>
                    </div>
                  </header>
                  <div class="post-content">{renderContent(reply.content)}</div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
