import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { nip19 } from 'nostr-tools'
import { publishEvent, parseRepostEvent } from '../../lib/nostr/relay'
import { KIND_REPOST } from '../../lib/nostr/constants'
import '../../styles/components/post-view.css'
import {
  createDeleteEvent,
  createRepostEvent,
  createReactionEvent,
  getEventThemeColors,
  getThemeCardProps,
  STELLA_COLORS,
} from '../../lib/nostr/events'
import {
  canAddStella,
  addStellaToColor,
  removeStellaColor,
  createEmptyStellaCounts,
  getTotalStellaCount,
  EMPTY_STELLA_COUNTS,
  type StellaColor,
  type StellaCountsByColor,
} from '../../lib/utils/stella'
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
  copyToClipboard,
  downloadAsMarkdown,
  openRawUrl,
  shareOrCopy,
  formatNumber,
} from '../../lib/utils'
import { getThemeColors } from '../../lib/storage'
import { TIMEOUTS, CUSTOM_EVENTS } from '../../lib/constants'
import {
  hasTeaserTag,
  getTeaserContent,
  getTeaserColor,
  removeReadMoreLink,
  parseStickers,
  extractUniqueLocations,
} from '../../lib/nostr/tags'
import {
  setHashtagClickHandler,
  setSuperMentionClickHandler,
  setImageClickHandler,
  clearImageClickHandler,
  setInternalLinkClickHandler,
} from '../../lib/parser'
import { LightBox, triggerLightBox } from '../ui'
import {
  PostHeader,
  ReplyCard,
  PostActions,
  EditDeleteButtons,
  PostContent,
  PostStickers,
  PostLocation,
  PostBarcode,
  OriginalPostCard,
} from './index'
import { parseEmojiTags, Loading, TextButton, BackButton, SuccessMessage, Icon } from '../ui'
import { useDeleteConfirm, usePostViewData } from '../../hooks'
import { collectWord } from '../../lib/api/api'
import { useWordCelebration } from '../wordrot/WordCollectCelebration'
import type { Profile, LoadableProfile, ReactionData } from '../../types'
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
  const [localCollectedWords, setLocalCollectedWords] = useState<Set<string>>(new Set())

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
    views,
    wikidataMap,
    replyProfiles,
    parentEvent,
    parentProfile,
    setReactions,
    setReposts,
    wordrotWords,
    wordrotCollected,
    wordrotImages,
  } = usePostViewData(eventId)

  // Combine prop collected words with locally collected (for instant UI update)
  const combinedCollectedWords = useMemo(() => {
    if (!wordrotCollected) return localCollectedWords
    return new Set([...wordrotCollected, ...localCollectedWords])
  }, [wordrotCollected, localCollectedWords])

  // Stella debounce refs
  const stellaDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStella = useRef<StellaCountsByColor>({ ...EMPTY_STELLA_COUNTS })
  const [likingId, setLikingId] = useState<string | null>(null)

  // Keep refs to latest values for use in callbacks
  const reactionsRef = useRef(reactions)
  reactionsRef.current = reactions

  // リポスト（kind:6）の場合、オリジナルイベントをパース
  const originalEvent = useMemo(() => {
    if (event && event.kind === KIND_REPOST) {
      return parseRepostEvent(event)
    }
    return null
  }, [event])

  const isRepost = event?.kind === KIND_REPOST && originalEvent !== null

  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setSuperMentionClickHandler((path) => navigateToTag(path))
    setInternalLinkClickHandler((path) => navigateTo(path))
    setImageClickHandler(triggerLightBox)
    return () => clearImageClickHandler()
  }, [eventId])

  // Flush pending stella to server
  const flushStella = useCallback(async () => {
    if (!event || !myPubkey) return
    const pending = pendingStella.current
    const totalPending = getTotalStellaCount(pending)
    if (totalPending <= 0) return

    // Reset pending immediately
    pendingStella.current = { ...EMPTY_STELLA_COUNTS }

    // Use ref to get latest reactions
    const currentReactions = reactionsRef.current
    const previousReactions = { ...currentReactions }
    const oldReactionId = currentReactions.myReactionId
    const newMyStella: StellaCountsByColor = currentReactions.myStella

    setLikingId(event.id)

    try {
      const newReaction = await createReactionEvent(event, '+', newMyStella)
      await publishEvent(newReaction)

      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {
          // Ignore delete errors
        }
      }

      setReactions((prev: ReactionData) => {
        const myIndex = prev.reactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prev.reactors.map((r, i) =>
                i === myIndex
                  ? { ...r, stella: newMyStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
                  : r
              )
            : [
                {
                  pubkey: myPubkey,
                  stella: newMyStella,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prev.reactors,
              ]
        return {
          myReaction: true,
          myStella: newMyStella,
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
  }, [event, myPubkey, setReactions])

  // Add stella (with debounce)
  const handleAddStella = useCallback(
    (color: StellaColor) => {
      if (!event || !myPubkey || event.pubkey === myPubkey) return

      const currentReactions = reactionsRef.current
      if (!canAddStella(currentReactions.myStella, pendingStella.current)) return

      // Add to pending
      pendingStella.current = addStellaToColor(pendingStella.current, color)

      // Optimistic UI update - also update reactors to reflect in display
      setReactions((prev: ReactionData) => {
        const newMyStella = addStellaToColor(prev.myStella, color)
        const myIndex = prev.reactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prev.reactors.map((r, i) => (i === myIndex ? { ...r, stella: newMyStella } : r))
            : [...prev.reactors, { pubkey: myPubkey, stella: newMyStella, reactionId: '', createdAt: 0 }]
        return {
          myReaction: true,
          myStella: newMyStella,
          myReactionId: prev.myReactionId,
          reactors: updatedReactors,
        }
      })

      if (stellaDebounceTimer.current) {
        clearTimeout(stellaDebounceTimer.current)
      }
      stellaDebounceTimer.current = setTimeout(() => flushStella(), 500)
    },
    [event, myPubkey, setReactions, flushStella]
  )

  // Wordrot collection
  const { celebrate } = useWordCelebration()
  const handleWordCollect = useCallback(
    async (word: string) => {
      if (!myPubkey || !eventId) return
      console.log('[PostView] Collecting word:', word)
      // Immediately update local state for instant UI feedback
      setLocalCollectedWords((prev) => new Set([...prev, word.toLowerCase()]))
      try {
        const result = await collectWord(myPubkey, word, eventId)
        if (result.word) {
          console.log('[PostView] Word collected successfully:', result)
          // Trigger celebration
          if (celebrate) {
            celebrate({
              word: result.word,
              isNew: result.isNew,
              isFirstEver: result.isFirstEver,
              count: result.count,
            })
          }
        }
      } catch (err) {
        console.error('[PostView] Failed to collect word:', err)
      }
    },
    [myPubkey, eventId, celebrate]
  )

  // Remove stella of a specific color
  const handleUnlike = useCallback(
    async (color: StellaColor) => {
      if (!event || !myPubkey) return
      const currentReactions = reactionsRef.current
      if (!currentReactions.myReactionId) return

      const myStella = currentReactions.myStella
      if (myStella[color] <= 0) return

      if (stellaDebounceTimer.current) {
        clearTimeout(stellaDebounceTimer.current)
        stellaDebounceTimer.current = null
      }
      pendingStella.current = createEmptyStellaCounts()

      const newMyStella = removeStellaColor(myStella, color)
      const remainingTotal = getTotalStellaCount(newMyStella)

      setLikingId(event.id)
      try {
        if (remainingTotal > 0) {
          const newReaction = await createReactionEvent(event, '+', newMyStella)
          await publishEvent(newReaction)
          try {
            await publishEvent(await createDeleteEvent([currentReactions.myReactionId]))
          } catch {
            // Ignore delete errors
          }
          setReactions((prev: ReactionData) => ({
            myReaction: true,
            myStella: newMyStella,
            myReactionId: newReaction.id,
            reactors: prev.reactors.map((r) =>
              r.pubkey === myPubkey
                ? { ...r, stella: newMyStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
                : r
            ),
          }))
        } else {
          await publishEvent(await createDeleteEvent([currentReactions.myReactionId]))
          setReactions((prev: ReactionData) => ({
            myReaction: false,
            myStella: { ...EMPTY_STELLA_COUNTS },
            myReactionId: null,
            reactors: prev.reactors.filter((r) => r.pubkey !== myPubkey),
          }))
        }
      } finally {
        setLikingId(null)
      }
    },
    [event, myPubkey, setReactions]
  )

  if (!mounted) return null

  const getProfileDisplayName = (pubkey: string, profileData?: LoadableProfile): string => {
    const effectiveProfile = profileData ?? (pubkey === event?.pubkey ? profile : undefined)
    return getDisplayName(effectiveProfile, pubkey)
  }

  const getProfileAvatarUrl = (profileData?: Profile | null): string | null => {
    return getAvatarUrl(profileData || profile)
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

  const handleShareOption = async (option: ShareOption, partIndex?: number) => {
    if (!event) return
    const url = window.location.href
    switch (option) {
      case 'url-copy': {
        const success = await copyToClipboard(url)
        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
        }
        break
      }
      case 'url-nostr': {
        try {
          const noteId = nip19.noteEncode(eventId)
          const success = await copyToClipboard(noteId)
          if (success) {
            setCopied(true)
            setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
          }
        } catch (err) {
          console.error('Failed to encode note ID:', err)
        }
        break
      }
      case 'url-share': {
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
      case 'x':
      case 'bluesky':
      case 'threads': {
        const { openSnsShare } = await import('../../lib/utils/sns-share')
        openSnsShare(option, event.content, event.tags, url, partIndex)
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
    const fallbackTheme = getThemeCardProps(getThemeColors())
    const textClass = fallbackTheme.className.includes('light-text') ? 'light-text' : 'dark-text'
    return (
      <div className="post-not-found-page">
        <BackButton onClick={handleBack} icon={isModal ? '×' : '←'} label={isModal ? 'CLOSE' : 'BACK'} />
        <div className={`post-not-found-header ${textClass}`}>
          <h2>Post not found</h2>
          <p>{error || 'The post may have been deleted or is unavailable.'}</p>
        </div>
      </div>
    )
  }

  const isMyPost = myPubkey === event.pubkey
  const themeColors = getEventThemeColors(event)
  const stickers = parseStickers(event.tags)

  // Teaser/unlock logic
  const hasTeaser = hasTeaserTag(event)
  const teaserColor = hasTeaser ? getTeaserColor(event.tags) : undefined
  const hasColorRequirement = !!teaserColor

  // Check if unlocked: own post, no color requirement, or has given the required color stella
  const isUnlocked =
    isMyPost || !hasColorRequirement || (teaserColor && reactions.myStella[teaserColor as StellaColor] > 0)

  // For teaser posts: always remove the READ MORE link from content
  // If unlocked, append the teaser content; if locked, show styled READ MORE button instead
  const fullContent = hasTeaser
    ? removeReadMoreLink(event.content) + (isUnlocked ? getTeaserContent(event.tags) || '' : '')
    : event.content
  const themeProps = getThemeCardProps(themeColors)

  // Extract unique locations from tags (deduplicates hierarchical geohashes)
  const locations = extractUniqueLocations(event.tags)

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
        {/* Back layer stickers (behind content) - only for non-repost */}
        {!isRepost && <PostStickers stickers={stickers} layer="back" />}

        <PostHeader
          pubkey={event.pubkey}
          createdAt={event.created_at}
          displayName={getProfileDisplayName(event.pubkey)}
          avatarUrl={getProfileAvatarUrl()}
          isProfileLoading={!profile}
          emojis={profile?.emojis}
          eventKind={event.kind}
          views={isRepost ? undefined : views}
        />

        {isRepost && originalEvent ? (
          // リポストの場合: 「Reposted」テキスト + オリジナル投稿カード
          <>
            <div className="repost-content">Reposted</div>
            <OriginalPostCard
              event={originalEvent}
              displayName={getProfileDisplayName(originalEvent.pubkey, replyProfiles[originalEvent.pubkey])}
              avatarUrl={getProfileAvatarUrl(replyProfiles[originalEvent.pubkey])}
              isProfileLoading={replyProfiles[originalEvent.pubkey] === undefined}
              emojis={replyProfiles[originalEvent.pubkey]?.emojis}
              profiles={replyProfiles}
              onClick={() => navigateToPost(originalEvent.id)}
            />
          </>
        ) : (
          // 通常の投稿の場合
          <>
            <div className="post-content post-content-full">
              <PostContent
                content={fullContent}
                emojis={parseEmojiTags(event.tags)}
                profiles={{ ...(profile ? { [event.pubkey]: profile } : {}), ...replyProfiles }}
                wikidataMap={wikidataMap}
                enableOgpFallback={true}
                tags={event.tags}
                wordrotWords={wordrotWords}
                wordrotCollected={combinedCollectedWords}
                wordrotImages={wordrotImages}
                onWordClick={handleWordCollect}
              />
              {/* Locked teaser message */}
              {hasTeaser && hasColorRequirement && !isUnlocked && (
                <TextButton variant="primary" className="read-more-btn teaser-read-more">
                  … READ MORE
                  <span
                    style={{
                      marginLeft: '0.25rem',
                      color: STELLA_COLORS[teaserColor as StellaColor]?.hex,
                      display: 'inline-flex',
                    }}
                  >
                    <Icon name="Lock" size={14} />
                  </span>
                  <span style={{ marginLeft: '0.25rem' }}>
                    Requires {STELLA_COLORS[teaserColor as StellaColor]?.label} Stella
                  </span>
                </TextButton>
              )}
            </div>

            {locations.map((loc) => (
              <PostLocation key={loc.geohash} geohashStr={loc.geohash} name={loc.name} />
            ))}
          </>
        )}

        {deletedId === event.id && <SuccessMessage>Deleted!</SuccessMessage>}
        {/* リポストの場合はアクションボタンを非表示 */}
        {deletedId !== event.id && !isRepost && (
          <div className="post-footer">
            <PostActions
              isMyPost={isMyPost}
              reactions={reactions}
              replies={replies}
              reposts={reposts}
              likingId={likingId}
              repostingId={repostingId}
              eventId={event.id}
              content={event.content}
              tags={event.tags}
              url={window.location.href}
              copied={copied}
              myPubkey={myPubkey}
              getDisplayName={(pk) => getProfileDisplayName(pk, replyProfiles[pk])}
              onAddStella={handleAddStella}
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

        {/* Front layer stickers (above content) - only for non-repost */}
        {!isRepost && <PostStickers stickers={stickers} layer="front" />}

        {/* Barcode on right edge - only for non-repost */}
        {!isRepost && <PostBarcode eventId={event.id} />}
      </article>

      {/* リポストの場合はリプライセクションを非表示 */}
      {!isRepost && replies.count > 0 && (
        <div className="replies-section">
          <h3 className="replies-heading">{formatNumber(replies.count)} Replies</h3>
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
