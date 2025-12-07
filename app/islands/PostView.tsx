import { useState, useEffect } from 'hono/jsx'
import { fetchEventById, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts, publishEvent } from '../lib/nostr/relay'
import { getCurrentPubkey, createDeleteEvent, createReactionEvent, createRepostEvent, getEventThemeColors, getThemeCardProps } from '../lib/nostr/events'
import { getDisplayName, getAvatarUrl, getCachedPost, getCachedProfile } from '../lib/utils'
import { isValidReaction, TIMEOUTS } from '../lib/constants'
import { getETagValue, filterRepliesByRoot } from '../lib/nostr/tags'
import { renderContent, setHashtagClickHandler } from '../lib/content-parser'
import { PostHeader, ReplyCard } from '../components/post'
import { useShare } from '../hooks'
import type { Event } from 'nostr-tools'
import type { Profile } from '../types'

interface PostViewProps {
  eventId: string
}

export default function PostView({ eventId }: PostViewProps) {
  const [event, setEvent] = useState<Event | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState({ count: 0, myReaction: false })
  const [replies, setReplies] = useState<{ count: number; replies: Event[] }>({ count: 0, replies: [] })
  const [reposts, setReposts] = useState({ count: 0, myRepost: false })
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: Profile | null }>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { copied, share } = useShare()

  useEffect(() => {
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

      // Try cache first
      let eventData: Event | null = getCachedPost(eventId)

      if (eventData) {
        setEvent(eventData)
        setLoading(false)

        const cachedProfileData = getCachedProfile(eventData.pubkey)
        if (cachedProfileData) {
          setProfile(cachedProfileData)
        } else {
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

        const profileEvent = await fetchUserProfile(eventData.pubkey)
        if (profileEvent) {
          setProfile(JSON.parse(profileEvent.content))
        }
      }

      if (!eventData) return

      // Load reactions, replies, reposts
      const [reactionEvents, replyEvents, repostEvents] = await Promise.all([
        fetchReactions([eventId]),
        fetchReplies([eventId]),
        fetchReposts([eventId])
      ])

      const eventReactions = reactionEvents.filter(r => {
        return getETagValue(r.tags) === eventId && isValidReaction(r.content)
      })
      setReactions({
        count: eventReactions.length,
        myReaction: eventReactions.some(r => r.pubkey === pubkey)
      })

      const eventReplies = filterRepliesByRoot(replyEvents, eventId)
      setReplies({ count: eventReplies.length, replies: eventReplies })

      setReposts({
        count: repostEvents.length,
        myRepost: repostEvents.some(r => r.pubkey === pubkey)
      })

      // Load reply profiles
      const profiles: { [pubkey: string]: Profile | null } = {}
      for (const pk of [...new Set(eventReplies.map(r => r.pubkey))]) {
        try {
          const pEvent = await fetchUserProfile(pk)
          if (pEvent) profiles[pk] = JSON.parse(pEvent.content)
        } catch {}
      }
      setReplyProfiles(profiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }

  const getProfileDisplayName = (pubkey: string, profileData?: Profile | null): string => {
    return getDisplayName(profileData || profile, pubkey)
  }

  const getProfileAvatarUrl = (profileData?: Profile | null): string | null => {
    return getAvatarUrl(profileData || profile)
  }

  const handleLike = async () => {
    if (!event || likingId || !myPubkey || reactions.myReaction || event.pubkey === myPubkey) return
    setLikingId(event.id)
    try {
      await publishEvent(await createReactionEvent(event, '+'))
      setReactions(prev => ({ count: prev.count + 1, myReaction: true }))
    } finally {
      setLikingId(null)
    }
  }

  const handleRepost = async () => {
    if (!event || repostingId || !myPubkey || reposts.myRepost) return
    setRepostingId(event.id)
    try {
      await publishEvent(await createRepostEvent(event))
      setReposts(prev => ({ count: prev.count + 1, myRepost: true }))
    } finally {
      setRepostingId(null)
    }
  }

  const handleShare = () => share(window.location.href)
  const handleDeleteClick = () => event && setConfirmDeleteId(event.id)
  const handleDeleteCancel = () => setConfirmDeleteId(null)

  const handleDeleteConfirm = async () => {
    if (!event) return
    try {
      await publishEvent(await createDeleteEvent([event.id]))
      setConfirmDeleteId(null)
      setDeletedId(event.id)
      setTimeout(() => { window.location.href = '/' }, TIMEOUTS.POST_ACTION_RELOAD)
    } catch {}
  }

  const handleBack = () => { window.location.href = '/' }

  if (loading) return <div class="loading">Loading...</div>

  if (error || !event) {
    return (
      <div class="error-box">
        <p>{error || 'Post not found'}</p>
        <button onClick={handleBack}>Back to Timeline</button>
      </div>
    )
  }

  const isMyPost = myPubkey === event.pubkey
  const themeColors = getEventThemeColors(event)
  const themeProps = getThemeCardProps(themeColors)

  return (
    <div class="post-view">
      <button class="back-button" onClick={handleBack}>← Back</button>

      <article class={`post-card post-card-large ${themeProps.className}`} style={themeProps.style}>
        <PostHeader
          pubkey={event.pubkey}
          createdAt={event.created_at}
          displayName={getProfileDisplayName(event.pubkey)}
          avatarUrl={getProfileAvatarUrl()}
        />

        <div class="post-content post-content-full">
          {renderContent(event.content)}
        </div>

        {deletedId === event.id && <p class="success">Deleted!</p>}

        {deletedId !== event.id && (
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
            <button class="reply-button" onClick={() => { window.location.href = `/?reply=${eventId}` }}>
              💬{replies.count > 0 && ` ${replies.count}`}
            </button>
            <button
              class={`repost-button ${reposts.myRepost ? 'reposted' : ''}`}
              onClick={handleRepost}
              disabled={repostingId !== null || reposts.myRepost}
            >
              🔁{reposts.count > 0 && ` ${reposts.count}`}
            </button>
            <button class={`share-button ${copied ? 'copied' : ''}`} onClick={handleShare} title="Share">
              {copied ? '✓' : '↗'}
            </button>
            {isMyPost && (
              confirmDeleteId === event.id ? (
                <div class="delete-confirm">
                  <span class="delete-confirm-text">Delete?</span>
                  <button class="delete-confirm-yes" onClick={handleDeleteConfirm}>Yes</button>
                  <button class="delete-confirm-no" onClick={handleDeleteCancel}>No</button>
                </div>
              ) : (
                <>
                  <button class="edit-button" onClick={() => { window.location.href = `/?edit=${eventId}` }}>Edit</button>
                  <button class="delete-button" onClick={handleDeleteClick}>Delete</button>
                </>
              )
            )}
          </div>
        )}
      </article>

      {replies.count > 0 && (
        <div class="replies-section">
          <h3 class="replies-heading">{replies.count} Replies</h3>
          <div class="replies-list">
            {replies.replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                displayName={getProfileDisplayName(reply.pubkey, replyProfiles[reply.pubkey])}
                avatarUrl={getProfileAvatarUrl(replyProfiles[reply.pubkey])}
                onClick={() => { window.location.href = `/post/${reply.id}` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
