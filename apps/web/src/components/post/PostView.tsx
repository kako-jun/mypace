import { useState, useEffect, useRef } from 'react'
import { nip19 } from 'nostr-tools'
import { publishEvent } from '../../lib/nostr/relay'
import '../../styles/components/post-view.css'
import {
  createDeleteEvent,
  createRepostEvent,
  getEventThemeColors,
  getThemeCardProps,
  MAX_STELLA_PER_USER,
  createReactionEvent,
} from '../../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  navigateToHome,
  navigateToTag,
  navigateTo,
  navigateToEdit,
  navigateToReply,
  navigateToPost,
  navigateToUser,
  getUIThemeColors,
  applyThemeColors,
  copyToClipboard,
  downloadAsMarkdown,
  openRawUrl,
  shareOrCopy,
} from '../../lib/utils'
import { TIMEOUTS, CUSTOM_EVENTS } from '../../lib/constants'
import { hasTeaserTag, getTeaserContent, removeReadMoreLink, parseStickers } from '../../lib/nostr/tags'
import {
  setHashtagClickHandler,
  setSuperMentionClickHandler,
  setImageClickHandler,
  clearImageClickHandler,
  setInternalLinkClickHandler,
} from '../../lib/parser'
import { LightBox, triggerLightBox } from '../ui'
import { PostHeader, ReplyCard, PostActions, EditDeleteButtons, PostContent, PostStickers, PostLocation } from './index'
import { parseEmojiTags, Loading, TextButton, ErrorMessage, BackButton, SuccessMessage } from '../ui'
import { useDeleteConfirm, usePostViewData } from '../../hooks'
import type { Profile, ReactionData } from '../../types'
import type { ShareOption } from './ShareMenu'

interface PostViewProps {
  eventId: string
  isModal?: boolean
  onClose?: () => void
}

function decodeEventId(id: string): string {
  try {
    if (id.startsWith('note1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'note') {
        const hex = decoded.data as string
        if (hex.length === 64) return hex
      }
    }
    if (id.startsWith('nevent1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'nevent') {
        const hex = (decoded.data as { id: string }).id
        if (hex.length === 64) return hex
      }
    }
  } catch {}
  return id
}

export function PostView({ eventId: rawEventId, isModal, onClose }: PostViewProps) {
  const eventId = decodeEventId(rawEventId)
  const [mounted, setMounted] = useState(false)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [, setThemeVersion] = useState(0)
  const [copied, setCopied] = useState(false)

  const { isConfirming, showConfirm, hideConfirm } = useDeleteConfirm()

  const {
    event,
    profile,
    myPubkey,
    loading,
    error,
    reactions,
    replies,
    reposts,
    replyProfiles,
    parentEvent,
    parentProfile,
    setReactions,
    setReposts,
  } = usePostViewData(eventId)

  // Stella debounce
  const stellaDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStella = useRef(0)
  const [likingId, setLikingId] = useState<string | null>(null)

  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setSuperMentionClickHandler((path) => navigateToTag(path))
    setInternalLinkClickHandler((path) => navigateTo(path))
    setImageClickHandler(triggerLightBox)
    return () => clearImageClickHandler()
  }, [eventId])

  if (!mounted) return null

  const getProfileDisplayName = (pubkey: string, profileData?: Profile | null): string => {
    const effectiveProfile = profileData ?? (pubkey === event?.pubkey ? profile : null)
    return getDisplayName(effectiveProfile, pubkey)
  }

  const getProfileAvatarUrl = (profileData?: Profile | null): string | null => {
    return getAvatarUrl(profileData || profile)
  }

  const flushStella = async () => {
    if (!event) return
    const stellaToSend = pendingStella.current
    if (stellaToSend <= 0) return
    pendingStella.current = 0

    const previousReactions = { ...reactions }
    const oldReactionId = reactions.myReactionId
    const currentMyStella = reactions.myStella

    setLikingId(event.id)
    try {
      const newTotalStella = Math.min(currentMyStella + stellaToSend, MAX_STELLA_PER_USER)
      const newReaction = await createReactionEvent(event, '+', newTotalStella)
      await publishEvent(newReaction)

      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {}
      }

      setReactions((prev: ReactionData) => {
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
    setReactions((prev: ReactionData) => ({
      count: prev.count + 1,
      myReaction: true,
      myStella: currentMyStella + pending + 1,
      myReactionId: prev.myReactionId,
      reactors: prev.reactors,
    }))

    if (stellaDebounceTimer.current) clearTimeout(stellaDebounceTimer.current)
    stellaDebounceTimer.current = setTimeout(() => flushStella(), 300)
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
      setReactions((prev: ReactionData) => ({
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

  const handleShareOption = async (option: ShareOption) => {
    if (!event) return
    switch (option) {
      case 'url': {
        const url = window.location.href
        const result = await shareOrCopy(url)
        if (result.copied) {
          setCopied(true)
          setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
        }
        break
      }
      case 'md-copy': {
        const success = await copyToClipboard(event.content)
        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
        }
        break
      }
      case 'md-download': {
        const filename = `post-${eventId.slice(0, 8)}`
        downloadAsMarkdown(event.content, filename)
        setCopied(true)
        setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
        break
      }
      case 'md-open': {
        openRawUrl(eventId)
        break
      }
    }
  }

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
    if (isModal && onClose) onClose()
    else navigateToHome()
  }

  if (loading) return <Loading />

  if (error || !event) {
    return (
      <div className={`post-view ${isModal ? 'post-view-modal' : ''}`}>
        <ErrorMessage variant="box">
          <p>{error || 'Post not found'}</p>
          <TextButton onClick={handleBack}>Back to Timeline</TextButton>
        </ErrorMessage>
      </div>
    )
  }

  const isMyPost = myPubkey === event.pubkey
  const themeColors = getEventThemeColors(event)
  const stickers = parseStickers(event.tags)
  const fullContent = hasTeaserTag(event)
    ? removeReadMoreLink(event.content) + (getTeaserContent(event.tags) || '')
    : event.content
  const themeProps = getThemeCardProps(themeColors)

  // Extract locations from tags
  const gTags = event.tags.filter((tag) => tag[0] === 'g')
  const locationTags = event.tags.filter((tag) => tag[0] === 'location')
  const locations = gTags.map((gTag, i) => ({
    geohash: gTag[1],
    name: locationTags[i]?.[1],
  }))

  // Parent post theme props
  const parentThemeColors = parentEvent ? getEventThemeColors(parentEvent) : null
  const parentThemeProps = getThemeCardProps(parentThemeColors)

  return (
    <div className={`post-view ${isModal ? 'post-view-modal' : ''}`}>
      <BackButton onClick={handleBack} icon={isModal ? '×' : '←'} label={isModal ? 'CLOSE' : 'BACK'} />

      {/* Parent post (if this is a reply) */}
      {parentEvent && (
        <div className="parent-post-section">
          <h3 className="parent-post-heading">Reply to</h3>
          <div
            className={`parent-post-card ${parentThemeProps.className}`}
            style={parentThemeProps.style}
            onClick={() => navigateToPost(parentEvent.id)}
            onKeyDown={(e) => e.key === 'Enter' && navigateToPost(parentEvent.id)}
            role="button"
            tabIndex={0}
          >
            <PostHeader
              pubkey={parentEvent.pubkey}
              createdAt={parentEvent.created_at}
              displayName={getDisplayName(parentProfile, parentEvent.pubkey)}
              avatarUrl={getAvatarUrl(parentProfile)}
              isProfileLoading={!parentProfile}
              emojis={parentProfile?.emojis}
              eventKind={parentEvent.kind}
              avatarSize="small"
            />
            <div className="post-content parent-post-content">
              <PostContent content={parentEvent.content} emojis={parseEmojiTags(parentEvent.tags)} />
            </div>
          </div>
        </div>
      )}

      <article className={`post-card post-card-large ${themeProps.className}`} style={themeProps.style}>
        {/* Back layer stickers (behind content) */}
        <PostStickers stickers={stickers} layer="back" />

        <PostHeader
          pubkey={event.pubkey}
          createdAt={event.created_at}
          displayName={getProfileDisplayName(event.pubkey)}
          avatarUrl={getProfileAvatarUrl()}
          isProfileLoading={!profile}
          emojis={profile?.emojis}
          eventKind={event.kind}
        />
        <div className="post-content post-content-full">
          <PostContent
            content={fullContent}
            emojis={parseEmojiTags(event.tags)}
            profiles={{ ...(profile ? { [event.pubkey]: profile } : {}), ...replyProfiles }}
          />
        </div>

        {locations.map((loc) => (
          <PostLocation key={loc.geohash} geohashStr={loc.geohash} name={loc.name} />
        ))}

        {deletedId === event.id && <SuccessMessage>Deleted!</SuccessMessage>}
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
              onShareOption={handleShareOption}
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

        {/* Front layer stickers (above content) */}
        <PostStickers stickers={stickers} layer="front" />
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
