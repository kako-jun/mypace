import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { fetchMagazineBySlug, fetchEventsByIds, fetchUserProfile, publishEvent } from '../../lib/nostr/relay'
import {
  createMagazineEvent,
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  type MagazineInput,
} from '../../lib/nostr/events'
import {
  navigateToHome,
  navigateTo,
  navigateToEdit,
  copyToClipboard,
  downloadAsMarkdown,
  openRawUrl,
  shareOrCopy,
  getDisplayNameFromCache,
  getAvatarUrlFromCache,
} from '../../lib/utils'
import { openSnsShare } from '../../lib/utils/sns-share'
import { getSnsIntentUrl } from '../../lib/utils/sns-share'
import { BackButton, Loading, Icon, Button, SuccessMessage } from '../ui'
import { TimelinePostCard } from '../timeline'
import { MagazineEditor } from './MagazineEditor'
import { loadEnrichForEvents, loadOgpForEvents } from '../../hooks/timeline/useTimelineData'
import { TIMEOUTS } from '../../lib/constants'
import {
  canAddStella,
  addStellaToColor,
  removeStellaColor,
  createEmptyStellaCounts,
  getTotalStellaCount,
  EMPTY_STELLA_COUNTS,
  type StellaColor,
} from '../../lib/utils/stella'
import type {
  Magazine,
  Event,
  ProfileCache,
  ReactionData,
  ReplyData,
  RepostData,
  ViewCountData,
  OgpData,
} from '../../types'
import type { ShareOption } from '../post/ShareMenu'
import '../../styles/components/magazine.css'

function decodePubkey(id: string): string {
  try {
    if (id.startsWith('npub1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'npub') {
        return decoded.data as string
      }
    }
  } catch {}
  return id
}

export function MagazineView() {
  const { npub, slug } = useParams<{ npub: string; slug: string }>()
  const pubkey = npub ? decodePubkey(npub) : ''

  const [magazine, setMagazine] = useState<Magazine | null>(null)
  const [posts, setPosts] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  // Timeline data states
  const [profiles, setProfiles] = useState<ProfileCache>({})
  const [reactions, setReactions] = useState<{ [eventId: string]: ReactionData }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: ReplyData }>({})
  const [reposts, setReposts] = useState<{ [eventId: string]: RepostData }>({})
  const [views, setViews] = useState<{ [eventId: string]: ViewCountData }>({})
  const [wikidataMap, setWikidataMap] = useState<Record<string, string>>({})
  const [ogpMap, setOgpMap] = useState<Record<string, OgpData>>({})
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)

  const loadMagazine = useCallback(async () => {
    if (!pubkey || !slug) return

    setLoading(true)
    try {
      const [mag, profile, currentPubkey] = await Promise.all([
        fetchMagazineBySlug(pubkey, slug),
        fetchUserProfile(pubkey),
        getCurrentPubkey().catch(() => null),
      ])

      setMagazine(mag)
      setMyPubkey(currentPubkey)

      // Pre-seed author profile into profiles cache (avoids redundant fetch in loadEnrichForEvents)
      // nullの場合も設定する（プロフィール未設定と確認済み→再取得不要）
      const initialProfiles: ProfileCache = { [pubkey]: profile }
      setProfiles(initialProfiles)

      if (mag && mag.eventIds.length > 0) {
        const eventsMap = await fetchEventsByIds(mag.eventIds)
        // Preserve order from magazine.eventIds
        const orderedPosts = mag.eventIds.map((id) => eventsMap[id]).filter((e): e is Event => !!e)
        setPosts(orderedPosts)

        // Load enrich data for timeline post cards
        if (orderedPosts.length > 0) {
          await loadEnrichForEvents(
            orderedPosts,
            currentPubkey || '',
            setReactions,
            setReplies,
            setReposts,
            setViews,
            setProfiles,
            setWikidataMap,
            initialProfiles
          )
          // Load OGP data asynchronously
          loadOgpForEvents(orderedPosts, setOgpMap)
        }
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Failed to load magazine:', err)
    } finally {
      setLoading(false)
    }
  }, [pubkey, slug])

  useEffect(() => {
    loadMagazine()
  }, [loadMagazine])

  // Record view when magazine is loaded
  useEffect(() => {
    if (!magazine || !pubkey || !slug) return

    const recordView = async () => {
      try {
        const viewerPubkey = await import('../../lib/nostr/events')
          .then(({ getCurrentPubkey }) => getCurrentPubkey())
          .catch(() => null)

        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/magazine/views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey,
            slug,
            viewerPubkey: viewerPubkey || '',
          }),
        })
      } catch {
        // Silently fail - view recording is not critical
      }
    }

    recordView()
  }, [magazine, pubkey, slug])

  const handleBack = () => navigateToHome()
  const handleAuthorClick = () => navigateTo(`/user/${npub}`)

  const isOwner = myPubkey === pubkey

  // Helper functions for TimelinePostCard
  const getDisplayNameForEvent = useCallback(
    (eventPubkey: string) => getDisplayNameFromCache(eventPubkey, profiles),
    [profiles]
  )

  const getAvatarUrlForEvent = useCallback(
    (eventPubkey: string) => getAvatarUrlFromCache(eventPubkey, profiles),
    [profiles]
  )

  // Empty reaction data
  const emptyReaction: ReactionData = {
    myReaction: false,
    myStella: { ...EMPTY_STELLA_COUNTS },
    myReactionId: null,
    reactors: [],
  }

  // Add stella handler
  const handleAddStella = useCallback(
    async (event: Event, color: StellaColor) => {
      if (!myPubkey || event.pubkey === myPubkey) return
      const eventId = event.id

      const currentReaction = reactions[eventId] || emptyReaction
      if (!canAddStella(currentReaction.myStella, createEmptyStellaCounts())) return

      // Optimistic update
      setReactions((prev) => {
        const prevData = prev[eventId] || emptyReaction
        const newMyStella = addStellaToColor(prevData.myStella, color)
        return {
          ...prev,
          [eventId]: {
            myReaction: true,
            myStella: newMyStella,
            myReactionId: prevData.myReactionId,
            reactors: prevData.reactors,
          },
        }
      })

      setLikingId(eventId)
      try {
        const currentData = reactions[eventId] || emptyReaction
        const newMyStella = addStellaToColor(currentData.myStella, color)
        const newReaction = await createReactionEvent(event, '+', newMyStella)
        await publishEvent(newReaction)

        if (currentData.myReactionId) {
          try {
            await publishEvent(await createDeleteEvent([currentData.myReactionId]))
          } catch {}
        }

        setReactions((prev) => ({
          ...prev,
          [eventId]: {
            myReaction: true,
            myStella: newMyStella,
            myReactionId: newReaction.id,
            reactors: prev[eventId]?.reactors || [],
          },
        }))
      } catch (error) {
        console.error('Failed to add stella:', error)
      } finally {
        setLikingId(null)
      }
    },
    [myPubkey, reactions]
  )

  // Unlike handler
  const handleUnlike = useCallback(
    async (event: Event, color: StellaColor) => {
      if (!myPubkey) return
      const eventId = event.id
      const currentReaction = reactions[eventId]
      if (!currentReaction?.myReactionId) return

      const myStella = currentReaction.myStella
      if (myStella[color] <= 0) return

      const newMyStella = removeStellaColor(myStella, color)
      const remainingTotal = getTotalStellaCount(newMyStella)

      setLikingId(eventId)
      try {
        if (remainingTotal > 0) {
          const newReaction = await createReactionEvent(event, '+', newMyStella)
          await publishEvent(newReaction)
          try {
            await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))
          } catch {}
          setReactions((prev) => ({
            ...prev,
            [eventId]: {
              myReaction: true,
              myStella: newMyStella,
              myReactionId: newReaction.id,
              reactors: prev[eventId]?.reactors || [],
            },
          }))
        } else {
          await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))
          setReactions((prev) => ({
            ...prev,
            [eventId]: {
              myReaction: false,
              myStella: { ...EMPTY_STELLA_COUNTS },
              myReactionId: null,
              reactors: (prev[eventId]?.reactors || []).filter((r) => r.pubkey !== myPubkey),
            },
          }))
        }
      } finally {
        setLikingId(null)
      }
    },
    [myPubkey, reactions]
  )

  // Repost handler
  const handleRepost = useCallback(
    async (event: Event) => {
      if (repostingId || !myPubkey || reposts[event.id]?.myRepost) return
      setRepostingId(event.id)
      try {
        await publishEvent(await createRepostEvent(event))
        setReposts((prev) => ({ ...prev, [event.id]: { count: (prev[event.id]?.count || 0) + 1, myRepost: true } }))
      } finally {
        setRepostingId(null)
      }
    },
    [myPubkey, repostingId, reposts]
  )

  // Delete handler
  const handleDeleteConfirm = useCallback(async (event: Event) => {
    try {
      await publishEvent(await createDeleteEvent([event.id]))
      setDeletedId(event.id)
      setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
    } catch {}
  }, [])

  // Share handler
  const handleShareOption = useCallback(
    async (eventId: string, content: string, tags: string[][], option: ShareOption, partIndex?: number) => {
      const url = `${window.location.origin}/post/${eventId}`
      switch (option) {
        case 'url-copy': {
          const success = await copyToClipboard(url)
          if (success) {
            setCopiedId(eventId)
            setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
          }
          break
        }
        case 'url-nostr': {
          try {
            const noteId = nip19.noteEncode(eventId)
            const success = await copyToClipboard(noteId)
            if (success) {
              setCopiedId(eventId)
              setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
            }
          } catch (err) {
            console.error('Failed to encode note ID:', err)
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
          const success = await copyToClipboard(content)
          if (success) {
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

  // Edit handler
  const handleEdit = useCallback((event: Event) => navigateToEdit(event.id), [])

  // Reply handler
  const handleReplyClick = useCallback((event: Event) => navigateTo(`/reply/${event.id}`), [])

  const handleUpdateMagazine = async (input: MagazineInput) => {
    try {
      const event = await createMagazineEvent(input)
      await publishEvent(event)
      setShowEditor(false)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to update magazine:', err)
    }
  }

  const handleRemovePost = async (eventId: string) => {
    if (!magazine) return

    const newEventIds = magazine.eventIds.filter((id) => id !== eventId)
    try {
      const event = await createMagazineEvent({
        slug: magazine.slug,
        title: magazine.title,
        description: magazine.description,
        image: magazine.image,
        eventIds: newEventIds,
      })
      await publishEvent(event)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to remove post:', err)
    }
  }

  const handleMovePost = async (eventId: string, direction: 'up' | 'down') => {
    if (!magazine) return

    const index = magazine.eventIds.indexOf(eventId)
    if (index === -1) return

    const newEventIds = [...magazine.eventIds]
    const newIndex = direction === 'up' ? index - 1 : index + 1

    if (newIndex < 0 || newIndex >= newEventIds.length) return // Swap
    ;[newEventIds[index], newEventIds[newIndex]] = [newEventIds[newIndex], newEventIds[index]]

    try {
      const event = await createMagazineEvent({
        slug: magazine.slug,
        title: magazine.title,
        description: magazine.description,
        image: magazine.image,
        eventIds: newEventIds,
      })
      await publishEvent(event)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to reorder posts:', err)
    }
  }

  const shareUrl = `${window.location.origin}/user/${npub}/magazine/${slug}`

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setShowShareMenu(false)
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: magazine?.title || 'Magazine',
          url: shareUrl,
        })
      } catch {
        // User cancelled or error
      }
    }
    setShowShareMenu(false)
  }

  const handleSnsShare = (sns: 'x' | 'bluesky' | 'threads') => {
    const text = `📚 ${magazine?.title || 'Magazine'} by @${getDisplayNameFromCache(pubkey, profiles)}\n${shareUrl}`
    const intentUrl = getSnsIntentUrl(sns, text)
    window.open(intentUrl, '_blank', 'noopener,noreferrer')
    setShowShareMenu(false)
  }

  if (loading) {
    return <Loading />
  }

  if (!magazine) {
    return (
      <div className="magazine-view">
        <BackButton onClick={handleBack} />
        <div className="magazine-view-header">
          <p>Magazine not found</p>
          <Button size="md" onClick={handleBack}>
            Back to Timeline
          </Button>
        </div>
      </div>
    )
  }

  const authorName = getDisplayNameFromCache(pubkey, profiles)

  return (
    <div className="magazine-view">
      <BackButton onClick={handleBack} />

      <div className="magazine-view-header">
        <div className="magazine-view-label">
          <Icon name="BookOpen" size={14} /> Magazine
        </div>

        <div className="magazine-view-image">
          {magazine.image ? (
            <img src={magazine.image} alt={magazine.title} />
          ) : (
            <div className="magazine-view-image-placeholder">
              <Icon name="BookOpen" size={48} />
            </div>
          )}
        </div>

        <h1 className="magazine-view-title">{magazine.title || 'Untitled'}</h1>

        <div className="magazine-view-author">
          by{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handleAuthorClick()
            }}
          >
            @{authorName}
          </a>
        </div>

        {magazine.description && <p className="magazine-view-description">{magazine.description}</p>}

        <div className="magazine-view-actions">
          <div className="magazine-share-wrapper">
            <Button size="sm" variant="secondary" onClick={() => setShowShareMenu(!showShareMenu)}>
              <Icon name={copied ? 'Check' : 'Share2'} size={14} /> {copied ? 'Copied!' : 'Share'}
            </Button>
            {showShareMenu && (
              <div className="magazine-share-menu">
                <button className="magazine-share-option" onClick={handleCopyUrl}>
                  <Icon name="Link" size={14} /> Copy URL
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button className="magazine-share-option" onClick={handleWebShare}>
                    <Icon name="Share2" size={14} /> Share to Apps
                  </button>
                )}
                <div className="magazine-share-divider" />
                <button className="magazine-share-option" onClick={() => handleSnsShare('x')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X
                </button>
                <button className="magazine-share-option" onClick={() => handleSnsShare('bluesky')}>
                  <Icon name="Cloud" size={14} /> Bluesky
                </button>
                <button className="magazine-share-option" onClick={() => handleSnsShare('threads')}>
                  <Icon name="AtSign" size={14} /> Threads
                </button>
              </div>
            )}
          </div>
          {isOwner && (
            <Button size="sm" variant="secondary" onClick={() => setShowEditor(true)}>
              <Icon name="Edit2" size={14} /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="magazine-view-posts timeline">
        <div className="magazine-view-posts-header">
          <Icon name="FileText" size={14} /> {posts.length} posts
        </div>

        {posts.length === 0 ? (
          <div className="magazine-view-empty">No posts in this magazine yet</div>
        ) : (
          posts.map((post, index) => {
            const isMyPost = myPubkey === post.pubkey

            if (deletedId === post.id) {
              return (
                <article key={post.id} className="post-card">
                  <SuccessMessage>Deleted!</SuccessMessage>
                </article>
              )
            }

            // Render magazine controls for top controls (right-aligned)
            const magazineControls = isOwner ? (
              <div className="post-card-top-controls right">
                <button
                  className="post-card-top-control-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMovePost(post.id, 'up')
                  }}
                  disabled={index === 0}
                  title="Move up"
                >
                  <Icon name="ChevronUp" size={14} />
                </button>
                <button
                  className="post-card-top-control-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMovePost(post.id, 'down')
                  }}
                  disabled={index === posts.length - 1}
                  title="Move down"
                >
                  <Icon name="ChevronDown" size={14} />
                </button>
                <button
                  className="post-card-top-control-btn danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemovePost(post.id)
                  }}
                  title="Remove from magazine"
                >
                  <Icon name="X" size={14} />
                </button>
              </div>
            ) : null

            return (
              <TimelinePostCard
                key={post.id}
                event={post}
                isMyPost={isMyPost}
                myPubkey={myPubkey}
                profiles={profiles}
                wikidataMap={wikidataMap}
                ogpMap={ogpMap}
                reactions={reactions[post.id]}
                replies={replies[post.id]}
                reposts={reposts[post.id]}
                views={views[post.id]}
                likingId={likingId}
                repostingId={repostingId}
                copiedId={copiedId}
                topControls={magazineControls}
                onEdit={handleEdit}
                onDeleteConfirm={handleDeleteConfirm}
                onAddStella={handleAddStella}
                onUnlike={handleUnlike}
                onReply={handleReplyClick}
                onRepost={handleRepost}
                onShareOption={handleShareOption}
                getDisplayName={getDisplayNameForEvent}
                getAvatarUrl={getAvatarUrlForEvent}
              />
            )
          })
        )}
      </div>

      {showEditor && (
        <MagazineEditor magazine={magazine} onSave={handleUpdateMagazine} onClose={() => setShowEditor(false)} />
      )}
    </div>
  )
}
