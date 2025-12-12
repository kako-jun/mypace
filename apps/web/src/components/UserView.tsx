import { useState, useEffect, useCallback, Fragment } from 'react'
import { fetchUserProfile } from '../lib/nostr/relay'
import { getEventThemeColors, getThemeCardProps } from '../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  navigateToHome,
  navigateToTag,
  navigateToEdit,
  navigateToReply,
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
import { useTimeline } from '../hooks'
import { nip19 } from 'nostr-tools'
import type { Event, Profile } from '../types'

interface UserViewProps {
  pubkey: string
}

export function UserView({ pubkey }: UserViewProps) {
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [npubCopied, setNpubCopied] = useState(false)

  const {
    items,
    profiles,
    reactions,
    replies,
    reposts,
    myPubkey,
    loading,
    error,
    likingId,
    repostingId,
    gaps,
    hasMore,
    loadingMore,
    loadingGap,
    loadOlderEvents,
    fillGap,
    handleLike,
    handleRepost,
    handleDelete,
  } = useTimeline({ authorPubkey: pubkey })

  const loadProfile = async () => {
    setProfileLoading(true)
    try {
      const userProfile = await fetchUserProfile(pubkey)
      setProfile(userProfile)
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setImageClickHandler(triggerLightBox)
    loadProfile()

    return () => clearImageClickHandler()
  }, [pubkey])

  const handleEdit = useCallback((event: Event) => navigateToEdit(event.id), [])
  const handleReplyClick = useCallback((event: Event) => navigateToReply(event.id), [])

  const handleShare = useCallback(async (eventId: string) => {
    const url = `${window.location.origin}/post/${eventId}`
    const result = await shareOrCopy(url)
    if (result.copied) {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
    }
  }, [])

  const handleDeleteConfirm = useCallback(
    async (event: Event) => {
      await handleDelete(event)
      setDeletedId(event.id)
      setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
    },
    [handleDelete]
  )

  const handleBack = () => navigateToHome()

  const npub = nip19.npubEncode(pubkey)

  const handleCopyNpub = async () => {
    const success = await copyToClipboard(npub)
    if (success) {
      setNpubCopied(true)
      setTimeout(() => setNpubCopied(false), TIMEOUTS.COPY_FEEDBACK)
    }
  }

  if (!mounted) {
    return null
  }

  if (loading && items.length === 0) return <div className="loading">Loading...</div>

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

  const getDisplayNameForEvent = (eventPubkey: string) => {
    if (eventPubkey === pubkey) return displayName
    const eventProfile = profiles[eventPubkey]
    return getDisplayName(eventProfile, eventPubkey)
  }

  const getAvatarUrlForEvent = (eventPubkey: string) => {
    if (eventPubkey === pubkey) return avatarUrl
    const eventProfile = profiles[eventPubkey]
    return getAvatarUrl(eventProfile)
  }

  return (
    <div className="user-view">
      <button className="back-button text-outlined text-outlined-button" onClick={handleBack}>
        ← BACK
      </button>

      {profileLoading ? (
        <div className="user-profile-card loading">Loading profile...</div>
      ) : (
        <div className={`user-profile-card ${themeProps.className}`} style={themeProps.style}>
          <div className="user-profile-header">
            <Avatar src={avatarUrl} className="user-avatar" />
            <div className="user-info">
              <h2 className="user-name">{displayName}</h2>
              <div className="user-npub-row">
                <span className="user-npub">{npub}</span>
                <button className="npub-copy-btn" onClick={handleCopyNpub} aria-label="Copy npub">
                  {npubCopied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
                </button>
              </div>
            </div>
          </div>
          {profile?.about && <p className="user-about">{profile.about}</p>}
          <div className="user-stats">
            <span>{items.length} posts</span>
          </div>
        </div>
      )}

      <div className="timeline">
        {items.map((item) => {
          const event = item.event
          const isMyPost = myPubkey === event.pubkey
          const gapAfterThis = gaps.find((g) => g.afterEventId === event.id)

          if (deletedId === event.id) {
            return (
              <article key={event.id} className="post-card">
                <p className="success">Deleted!</p>
              </article>
            )
          }

          return (
            <Fragment key={event.id}>
              <TimelinePostCard
                event={event}
                isMyPost={isMyPost}
                profiles={{ ...profiles, [pubkey]: profile }}
                reactions={reactions[event.id]}
                replies={replies[event.id]}
                reposts={reposts[event.id]}
                likingId={likingId}
                repostingId={repostingId}
                copiedId={copiedId}
                onEdit={() => handleEdit(event)}
                onDeleteConfirm={() => handleDeleteConfirm(event)}
                onLike={() => handleLike(event)}
                onReply={() => handleReplyClick(event)}
                onRepost={() => handleRepost(event)}
                onShare={() => handleShare(event.id)}
                getDisplayName={getDisplayNameForEvent}
                getAvatarUrl={getAvatarUrlForEvent}
              />
              {gapAfterThis && (
                <button
                  className="timeline-gap-button"
                  onClick={() => fillGap(gapAfterThis.id)}
                  disabled={loadingGap === gapAfterThis.id}
                >
                  {loadingGap === gapAfterThis.id ? '読み込み中...' : 'さらに表示'}
                </button>
              )}
            </Fragment>
          )
        })}
        {items.length === 0 && <p className="empty">No posts yet</p>}
        {items.length > 0 && hasMore && (
          <button className="load-more-button" onClick={loadOlderEvents} disabled={loadingMore}>
            {loadingMore ? '読み込み中...' : '過去の投稿を読み込む'}
          </button>
        )}
        {items.length > 0 && !hasMore && <p className="timeline-end">これ以上の投稿はありません</p>}
      </div>
      <LightBox />
    </div>
  )
}
