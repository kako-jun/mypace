import { useState, useEffect } from 'hono/jsx'
import {
  fetchUserProfile,
  fetchUserPosts,
  fetchReactions,
  fetchReplies,
  fetchReposts,
  publishEvent,
} from '../lib/nostr/relay'
import {
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  getEventThemeColors,
  getThemeCardProps,
} from '../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  navigateToHome,
  navigateToTag,
  navigateToEdit,
  navigateToReply,
  parseProfile,
  getErrorMessage,
  getUIThemeColors,
  applyThemeColors,
  shareOrCopy,
} from '../lib/utils'
import { isValidReaction, TIMEOUTS } from '../lib/constants'
import { getETagValue, filterRepliesByRoot } from '../lib/nostr/tags'
import { setHashtagClickHandler, setImageClickHandler, clearImageClickHandler } from '../lib/content-parser'
import LightBox, { triggerLightBox } from './LightBox'
import { TimelinePostCard } from '../components/timeline'
import { nip19 } from 'nostr-tools'
import type { Event } from 'nostr-tools'
import type { Profile } from '../types'

interface UserViewProps {
  pubkey: string
}

export default function UserView({ pubkey }: UserViewProps) {
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<{ [eventId: string]: { count: number; myReaction: boolean } }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: { count: number } }>({})
  const [reposts, setReposts] = useState<{ [eventId: string]: { count: number; myRepost: boolean } }>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadUserData = async () => {
    setError('')
    try {
      const currentPubkey = await getCurrentPubkey()
      setMyPubkey(currentPubkey)

      // Fetch profile
      const profileEvent = await fetchUserProfile(pubkey)
      if (profileEvent) {
        setProfile(parseProfile(profileEvent.content))
      }

      // Fetch user posts
      const userPosts = await fetchUserPosts(pubkey)
      setEvents(userPosts)
      setLoading(false)

      if (userPosts.length === 0) return

      const eventIds = userPosts.map((e) => e.id)

      // Load reactions, replies, reposts in parallel
      const [reactionEvents, replyEvents, repostEvents] = await Promise.all([
        fetchReactions(eventIds),
        fetchReplies(eventIds),
        fetchReposts(eventIds),
      ])

      // Process reactions
      const reactionsMap: { [eventId: string]: { count: number; myReaction: boolean } } = {}
      for (const eventId of eventIds) {
        const eventReactions = reactionEvents.filter(
          (r) => getETagValue(r.tags) === eventId && isValidReaction(r.content)
        )
        reactionsMap[eventId] = {
          count: eventReactions.length,
          myReaction: eventReactions.some((r) => r.pubkey === currentPubkey),
        }
      }
      setReactions(reactionsMap)

      // Process replies
      const repliesMap: { [eventId: string]: { count: number } } = {}
      for (const eventId of eventIds) {
        const eventReplies = filterRepliesByRoot(replyEvents, eventId)
        repliesMap[eventId] = { count: eventReplies.length }
      }
      setReplies(repliesMap)

      // Process reposts
      const repostsMap: { [eventId: string]: { count: number; myRepost: boolean } } = {}
      for (const eventId of eventIds) {
        const eventReposts = repostEvents.filter((r) => getETagValue(r.tags) === eventId)
        repostsMap[eventId] = {
          count: eventReposts.length,
          myRepost: eventReposts.some((r) => r.pubkey === currentPubkey),
        }
      }
      setReposts(repostsMap)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load user data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setImageClickHandler(triggerLightBox)
    loadUserData()

    return () => clearImageClickHandler()
  }, [pubkey])

  if (!mounted) {
    return null
  }

  const handleLike = async (event: Event) => {
    if (likingId || !myPubkey || reactions[event.id]?.myReaction || event.pubkey === myPubkey) return
    setLikingId(event.id)
    try {
      await publishEvent(await createReactionEvent(event, '+'))
      setReactions((prev) => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myReaction: true },
      }))
    } finally {
      setLikingId(null)
    }
  }

  const handleRepost = async (event: Event) => {
    if (repostingId || !myPubkey || reposts[event.id]?.myRepost) return
    setRepostingId(event.id)
    try {
      await publishEvent(await createRepostEvent(event))
      setReposts((prev) => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myRepost: true },
      }))
    } finally {
      setRepostingId(null)
    }
  }

  const handleShare = async (eventId: string) => {
    const url = `${window.location.origin}/post/${eventId}`
    const result = await shareOrCopy(url)
    if (result.copied) {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
    }
  }

  const handleDeleteConfirm = async (event: Event) => {
    try {
      await publishEvent(await createDeleteEvent([event.id]))
      setDeletedId(event.id)
      setTimeout(() => {
        setEvents((prev) => prev.filter((e) => e.id !== event.id))
        setDeletedId(null)
      }, TIMEOUTS.POST_ACTION_RELOAD)
    } catch {}
  }

  const handleBack = () => navigateToHome()

  // Format npub for display
  const npub = nip19.npubEncode(pubkey)
  const shortNpub = `${npub.slice(0, 12)}...${npub.slice(-8)}`

  if (loading) return <div class="loading">Loading...</div>

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={handleBack}>Back to Timeline</button>
      </div>
    )
  }

  const displayName = getDisplayName(profile, pubkey)
  const avatarUrl = getAvatarUrl(profile)
  const themeColors = profile ? getEventThemeColors({ tags: [] } as Event) : null
  const themeProps = themeColors ? getThemeCardProps(themeColors) : { className: '', style: {} }

  return (
    <div class="user-view">
      <button class="back-button text-outlined" onClick={handleBack}>
        BACK
      </button>

      <div class={`user-profile-card ${themeProps.className}`} style={themeProps.style}>
        <div class="user-profile-header">
          {avatarUrl ? <img src={avatarUrl} alt="" class="user-avatar" /> : <div class="user-avatar-placeholder" />}
          <div class="user-info">
            <h2 class="user-name">{displayName}</h2>
            <span class="user-npub">{shortNpub}</span>
          </div>
        </div>
        {profile?.about && <p class="user-about">{profile.about}</p>}
        <div class="user-stats">
          <span>{events.length} posts</span>
        </div>
      </div>

      <div class="user-posts">
        <h3 class="user-posts-heading">Posts</h3>
        <div class="timeline-list">
          {events.map((event) => {
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
                key={event.id}
                event={event}
                isMyPost={isMyPost}
                profiles={{ [pubkey]: profile }}
                reactions={reactions[event.id]}
                replies={replies[event.id]}
                reposts={reposts[event.id]}
                likingId={likingId}
                repostingId={repostingId}
                copiedId={copiedId}
                onEdit={() => navigateToEdit(event.id)}
                onDeleteConfirm={() => handleDeleteConfirm(event)}
                onLike={() => handleLike(event)}
                onReply={() => navigateToReply(event.id)}
                onRepost={() => handleRepost(event)}
                onShare={() => handleShare(event.id)}
                getDisplayName={() => displayName}
                getAvatarUrl={() => avatarUrl}
              />
            )
          })}
          {events.length === 0 && <p class="empty">No posts yet</p>}
        </div>
      </div>
      <LightBox />
    </div>
  )
}
