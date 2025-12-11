import { useState, useEffect } from 'react'
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
  getErrorMessage,
  getUIThemeColors,
  applyThemeColors,
  shareOrCopy,
  copyToClipboard,
} from '../lib/utils'
import { Avatar, Icon } from '../components/ui'
import { TIMEOUTS } from '../lib/constants'
import { setHashtagClickHandler, setImageClickHandler, clearImageClickHandler } from '../lib/content-parser'
import { LightBox, triggerLightBox } from './LightBox'
import { TimelinePostCard } from '../components/timeline'
import { nip19 } from 'nostr-tools'
import type { Event, Profile, ReplyData } from '../types'

interface UserViewProps {
  pubkey: string
}

export function UserView({ pubkey }: UserViewProps) {
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<{ [eventId: string]: { count: number; myReaction: boolean } }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: ReplyData }>({})
  const [reposts, setReposts] = useState<{ [eventId: string]: { count: number; myRepost: boolean } }>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [npubCopied, setNpubCopied] = useState(false)

  const loadUserData = async () => {
    // Clear previous state and show loading
    setError('')
    setEvents([])
    setReactions({})
    setReplies({})
    setReposts({})
    setProfile(null)
    setLoading(true)

    try {
      const currentPubkey = await getCurrentPubkey()
      setMyPubkey(currentPubkey)

      // Fetch profile and posts in parallel from server
      const [userProfile, userPosts] = await Promise.all([fetchUserProfile(pubkey), fetchUserPosts(pubkey)])

      if (userProfile) {
        setProfile(userProfile)
      }
      setEvents(userPosts)
      setLoading(false)

      if (userPosts.length === 0) return

      // Load reactions, replies, reposts in parallel for each event
      const reactionsMap: { [eventId: string]: { count: number; myReaction: boolean } } = {}
      const repliesMap: { [eventId: string]: ReplyData } = {}
      const repostsMap: { [eventId: string]: { count: number; myRepost: boolean } } = {}

      await Promise.all(
        userPosts.map(async (event) => {
          const [reactionData, replyData, repostData] = await Promise.all([
            fetchReactions(event.id, currentPubkey),
            fetchReplies(event.id),
            fetchReposts(event.id, currentPubkey),
          ])
          reactionsMap[event.id] = reactionData
          repliesMap[event.id] = replyData
          repostsMap[event.id] = repostData
        })
      )

      setReactions(reactionsMap)
      setReplies(repliesMap)
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

  const npub = nip19.npubEncode(pubkey)

  const handleCopyNpub = async () => {
    const success = await copyToClipboard(npub)
    if (success) {
      setNpubCopied(true)
      setTimeout(() => setNpubCopied(false), TIMEOUTS.COPY_FEEDBACK)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  if (error) {
    return (
      <div className="error-box">
        <p>{error}</p>
        <button onClick={handleBack}>Back to Timeline</button>
      </div>
    )
  }

  const displayName = getDisplayName(profile, pubkey)
  const avatarUrl = getAvatarUrl(profile)
  const themeColors = profile ? getEventThemeColors({ tags: [] } as unknown as Event) : null
  const themeProps = themeColors ? getThemeCardProps(themeColors) : { className: '', style: {} }

  return (
    <div className="user-view">
      <button className="back-button text-outlined text-outlined-button" onClick={handleBack}>
        BACK
      </button>

      <div className={`user-profile-card ${themeProps.className}`} style={themeProps.style}>
        <div className="user-profile-header">
          <Avatar src={avatarUrl} className="user-avatar" />
          <div className="user-info">
            <h2 className="user-name">{displayName}</h2>
            <div className="user-npub-row">
              <span className="user-npub">{npub}</span>
              <button className="npub-copy-btn" onClick={handleCopyNpub} title="Copy npub">
                {npubCopied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
              </button>
            </div>
          </div>
        </div>
        {profile?.about && <p className="user-about">{profile.about}</p>}
        <div className="user-stats">
          <span>{events.length} posts</span>
        </div>
      </div>

      <div className="timeline">
        {events.map((event) => {
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
        {events.length === 0 && <p className="empty">No posts yet</p>}
      </div>
      <LightBox />
    </div>
  )
}
