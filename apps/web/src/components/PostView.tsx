import { useState, useEffect, useRef } from 'react'
import {
  fetchEventById,
  fetchUserProfile,
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
  MAX_STELLA_PER_USER,
} from '../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  getCachedPost,
  getCachedProfile,
  navigateToHome,
  navigateToTag,
  navigateToEdit,
  navigateToReply,
  navigateToPost,
  navigateToUser,
  getErrorMessage,
  getUIThemeColors,
  applyThemeColors,
} from '../lib/utils'
import { TIMEOUTS } from '../lib/constants'
import { hasTeaserTag, getTeaserContent, removeReadMoreLink } from '../lib/nostr/tags'
import { setHashtagClickHandler, setImageClickHandler, clearImageClickHandler } from '../lib/content-parser'
import { LightBox, triggerLightBox } from './LightBox'
import { PostHeader, ReplyCard, PostActions, EditDeleteButtons, PostContent } from '../components/post'
import { parseEmojiTags, Loading } from '../components/ui'
import { useShare, useDeleteConfirm } from '../hooks'
import type { Event, Profile, ReactionData } from '../types'

interface PostViewProps {
  eventId: string
  isModal?: boolean
  onClose?: () => void
}

export function PostView({ eventId, isModal, onClose }: PostViewProps) {
  const [mounted, setMounted] = useState(false)
  const [event, setEvent] = useState<Event | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<ReactionData>({
    count: 0,
    myReaction: false,
    myStella: 0,
    myReactionId: null,
    reactors: [],
  })
  const [replies, setReplies] = useState<{ count: number; replies: Event[] }>({ count: 0, replies: [] })
  const [reposts, setReposts] = useState({ count: 0, myRepost: false })
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: Profile | null }>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { copied, share } = useShare()
  const { isConfirming, showConfirm, hideConfirm } = useDeleteConfirm()

  // Debounce refs for stella clicks
  const stellaDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStella = useRef(0)

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
          fetchUserProfile(eventData.pubkey).then((userProfile) => {
            if (userProfile) setProfile(userProfile)
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

        const userProfile = await fetchUserProfile(eventData.pubkey)
        if (userProfile) {
          setProfile(userProfile)
        }
      }

      if (!eventData) return

      // Load reactions, replies, reposts (now API returns aggregated data)
      const [reactionData, replyData, repostData] = await Promise.all([
        fetchReactions(eventId, pubkey),
        fetchReplies(eventId),
        fetchReposts(eventId, pubkey),
      ])

      setReactions(reactionData)
      setReplies(replyData)
      setReposts(repostData)

      // Load reply and reactor profiles
      const profiles: { [pubkey: string]: Profile | null } = {}
      const replyPubkeys = replyData.replies.map((r) => r.pubkey)
      const reactorPubkeys = reactionData.reactors.map((r) => r.pubkey)
      const allPubkeys = [...new Set([...replyPubkeys, ...reactorPubkeys])]
      for (const pk of allPubkeys) {
        try {
          const userProfile = await fetchUserProfile(pk)
          if (userProfile) profiles[pk] = userProfile
        } catch {}
      }
      setReplyProfiles(profiles)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load post'))
    } finally {
      setLoading(false)
    }
  }

  // Set mounted to true on client (skip SSR rendering)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setImageClickHandler(triggerLightBox)
    loadPost()

    return () => clearImageClickHandler()
  }, [eventId])

  // Skip rendering on server (SSR phase)
  if (!mounted) {
    return null
  }

  const getProfileDisplayName = (pubkey: string, profileData?: Profile | null): string => {
    // Use post author's profile if pubkey matches and no specific profile provided
    const effectiveProfile = profileData ?? (pubkey === event?.pubkey ? profile : null)
    return getDisplayName(effectiveProfile, pubkey)
  }

  const getProfileAvatarUrl = (profileData?: Profile | null): string | null => {
    return getAvatarUrl(profileData || profile)
  }

  // Send accumulated stella to the network
  const flushStella = async () => {
    if (!event) return
    const stellaToSend = pendingStella.current
    if (stellaToSend <= 0) return

    pendingStella.current = 0

    // Save previous state for rollback on error
    const previousReactions = { ...reactions }
    const oldReactionId = reactions.myReactionId
    const currentMyStella = reactions.myStella

    setLikingId(event.id)
    try {
      const newTotalStella = Math.min(currentMyStella + stellaToSend, MAX_STELLA_PER_USER)

      // Create new reaction FIRST (before deleting old one)
      const newReaction = await createReactionEvent(event, '+', newTotalStella)
      await publishEvent(newReaction)

      // Delete old reaction AFTER new one is successfully published
      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {
          // Ignore delete errors - old reaction will eventually be overridden
        }
      }

      setReactions((prev) => {
        const myIndex = prev.reactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prev.reactors.map((r, i) =>
                i === myIndex
                  ? { ...r, stella: newTotalStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newTotalStella,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prev.reactors,
              ]

        return {
          count: prev.count - currentMyStella + newTotalStella,
          myReaction: true,
          myStella: newTotalStella,
          myReactionId: newReaction.id,
          reactors: updatedReactors,
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      // Rollback UI state to previous state
      setReactions(previousReactions)
    } finally {
      setLikingId(null)
    }
  }

  const handleLike = () => {
    if (!event || !myPubkey || event.pubkey === myPubkey) return

    const currentMyStella = reactions.myStella
    const pending = pendingStella.current

    if (currentMyStella + pending >= MAX_STELLA_PER_USER) return

    pendingStella.current = pending + 1

    setReactions((prev) => ({
      count: prev.count + 1,
      myReaction: true,
      myStella: currentMyStella + pending + 1,
      myReactionId: prev.myReactionId,
      reactors: prev.reactors,
    }))

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
    }
    stellaDebounceTimer.current = setTimeout(() => {
      flushStella()
    }, 300)
  }

  const handleUnlike = async () => {
    if (!event || !myPubkey || !reactions.myReactionId) return

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
      stellaDebounceTimer.current = null
    }
    pendingStella.current = 0

    setLikingId(event.id)
    try {
      await publishEvent(await createDeleteEvent([reactions.myReactionId]))

      setReactions((prev) => ({
        count: Math.max(0, prev.count - prev.myStella),
        myReaction: false,
        myStella: 0,
        myReactionId: null,
        reactors: prev.reactors.filter((r) => r.pubkey !== myPubkey),
      }))
    } finally {
      setLikingId(null)
    }
  }

  const handleRepost = async () => {
    if (!event || repostingId || !myPubkey || reposts.myRepost) return
    setRepostingId(event.id)
    try {
      await publishEvent(await createRepostEvent(event))
      setReposts((prev) => ({ count: prev.count + 1, myRepost: true }))
    } finally {
      setRepostingId(null)
    }
  }

  const handleShare = () => share(window.location.href)

  const handleDeleteConfirm = async () => {
    if (!event) return
    try {
      await publishEvent(await createDeleteEvent([event.id]))
      hideConfirm()
      setDeletedId(event.id)
      setTimeout(() => navigateToHome(), TIMEOUTS.POST_ACTION_RELOAD)
    } catch {}
  }

  const handleBack = () => {
    if (isModal && onClose) {
      onClose()
    } else {
      navigateToHome()
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error || !event) {
    return (
      <div className={`post-view ${isModal ? 'post-view-modal' : ''}`}>
        <div className="error-box">
          <p>{error || 'Post not found'}</p>
          <button onClick={handleBack}>Back to Timeline</button>
        </div>
      </div>
    )
  }

  const isMyPost = myPubkey === event.pubkey
  const themeColors = getEventThemeColors(event)

  // Merge fold tag content for full display
  const fullContent = hasTeaserTag(event)
    ? removeReadMoreLink(event.content) + (getTeaserContent(event.tags) || '')
    : event.content
  const themeProps = getThemeCardProps(themeColors)

  return (
    <div className={`post-view ${isModal ? 'post-view-modal' : ''}`}>
      <button className="back-button text-outlined text-outlined-button" onClick={handleBack}>
        <span className="back-button-icon">{isModal ? '×' : '←'}</span>
        <span>{isModal ? 'CLOSE' : 'BACK'}</span>
      </button>

      <article className={`post-card post-card-large ${themeProps.className}`} style={themeProps.style}>
        <PostHeader
          pubkey={event.pubkey}
          createdAt={event.created_at}
          displayName={getProfileDisplayName(event.pubkey)}
          avatarUrl={getProfileAvatarUrl()}
          isProfileLoading={!profile}
          emojis={profile?.emojis}
        />

        <div className="post-content post-content-full">
          <PostContent
            content={fullContent}
            emojis={parseEmojiTags(event.tags)}
            profiles={{ ...(profile ? { [event.pubkey]: profile } : {}), ...replyProfiles }}
          />
        </div>

        {deletedId === event.id && <p className="success">Deleted!</p>}

        {deletedId !== event.id && (
          <div className="post-footer">
            <PostActions
              isMyPost={isMyPost}
              reactions={reactions}
              replies={replies}
              reposts={reposts}
              likingId={likingId}
              repostingId={repostingId}
              eventId={event.id}
              copied={copied}
              myPubkey={myPubkey}
              getDisplayName={(pk) => getProfileDisplayName(pk, replyProfiles[pk])}
              onLike={handleLike}
              onUnlike={handleUnlike}
              onReply={() => navigateToReply(eventId)}
              onRepost={handleRepost}
              onShare={handleShare}
              onNavigateToProfile={navigateToUser}
            />
            {isMyPost && (
              <EditDeleteButtons
                isConfirming={isConfirming(event.id)}
                onEdit={() => navigateToEdit(eventId)}
                onDelete={() => showConfirm(event.id)}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={hideConfirm}
              />
            )}
          </div>
        )}
      </article>

      {replies.count > 0 && (
        <div className="replies-section">
          <h3 className="replies-heading">{replies.count} Replies</h3>
          <div className="replies-list">
            {replies.replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                displayName={getProfileDisplayName(reply.pubkey, replyProfiles[reply.pubkey])}
                avatarUrl={getProfileAvatarUrl(replyProfiles[reply.pubkey])}
                isProfileLoading={replyProfiles[reply.pubkey] === undefined}
                emojis={replyProfiles[reply.pubkey]?.emojis}
                profiles={replyProfiles}
                onClick={() => navigateToPost(reply.id)}
              />
            ))}
          </div>
        </div>
      )}
      <LightBox />
    </div>
  )
}
