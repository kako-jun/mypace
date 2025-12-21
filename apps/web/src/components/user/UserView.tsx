import { useState, useEffect, useCallback } from 'react'
import { fetchUserProfile } from '../../lib/nostr/relay'
import '../../styles/components/user-view.css'
import {
  fetchPinnedPost,
  setPinnedPost,
  unpinPost,
  fetchEvent,
  fetchUserSerial,
  type UserSerialData,
} from '../../lib/api'
import { getEventThemeColors } from '../../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  navigateToHome,
  navigateToTag,
  navigateTo,
  getUIThemeColors,
  applyThemeColors,
  copyToClipboard,
  downloadAsMarkdown,
  openRawUrl,
  shareOrCopy,
  verifyNip05,
} from '../../lib/utils'
import { Button, Loading, BackButton, ErrorMessage } from '../ui'
import { TIMEOUTS, CUSTOM_EVENTS } from '../../lib/constants'
import {
  setHashtagClickHandler,
  setSuperMentionClickHandler,
  setImageClickHandler,
  clearImageClickHandler,
  setInternalLinkClickHandler,
} from '../../lib/parser'
import { LightBox, triggerLightBox } from '../ui'
import { UserProfile } from './UserProfile'
import { UserProfileEditor } from './UserProfileEditor'
import { UserPosts } from './UserPosts'
import { useTimeline } from '../../hooks'
import { nip19 } from 'nostr-tools'
import type { Event, LoadableProfile, Profile } from '../../types'
import type { ShareOption } from '../post/ShareMenu'

interface UserViewProps {
  pubkey: string
}

// Decode bech32 pubkey (npub1...) to hex
function decodePubkey(id: string): string {
  try {
    if (id.startsWith('npub1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'npub') {
        const hex = decoded.data as string
        if (hex.length === 64) return hex
      }
    }
    if (id.startsWith('nprofile1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'nprofile') {
        const hex = (decoded.data as { pubkey: string }).pubkey
        if (hex.length === 64) return hex
      }
    }
  } catch {}
  return id
}

export function UserView({ pubkey: rawPubkey }: UserViewProps) {
  const pubkey = decodePubkey(rawPubkey)
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<LoadableProfile>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [npubCopied, setNpubCopied] = useState(false)
  const [nip05Verified, setNip05Verified] = useState<boolean | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [pinnedEventId, setPinnedEventId] = useState<string | null>(null)
  const [pinnedEvent, setPinnedEvent] = useState<Event | null>(null)
  const [serialData, setSerialData] = useState<UserSerialData | null>(null)
  const [, setThemeVersion] = useState(0)

  useEffect(() => {
    const handleAppThemeChange = () => setThemeVersion((v) => v + 1)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
  }, [])

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
    handleUnlike,
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

  const loadPinnedPost = useCallback(async () => {
    try {
      const data = await fetchPinnedPost(pubkey)
      setPinnedEventId(data.eventId)
      // Fetch the actual event data if pinned
      if (data.eventId) {
        try {
          const eventData = await fetchEvent(data.eventId)
          setPinnedEvent(eventData.event)
        } catch {
          // Event might be deleted or unavailable
          setPinnedEvent(null)
        }
      } else {
        setPinnedEvent(null)
      }
    } catch (err) {
      console.error('Failed to fetch pinned post:', err)
    }
  }, [pubkey])

  const loadSerial = useCallback(async () => {
    try {
      const data = await fetchUserSerial(pubkey)
      setSerialData(data)
    } catch (err) {
      console.error('Failed to fetch serial:', err)
    }
  }, [pubkey])

  const handlePin = useCallback(
    async (event: Event) => {
      const success = await setPinnedPost(pubkey, event.id)
      if (success) {
        setPinnedEventId(event.id)
        setPinnedEvent(event)
      }
    },
    [pubkey]
  )

  const handleUnpin = useCallback(async () => {
    const success = await unpinPost(pubkey)
    if (success) {
      setPinnedEventId(null)
      setPinnedEvent(null)
    }
  }, [pubkey])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setSuperMentionClickHandler((path) => navigateToTag(path))
    setInternalLinkClickHandler((path) => navigateTo(path))
    setImageClickHandler(triggerLightBox)
    loadProfile()
    loadPinnedPost()
    loadSerial()
    return () => clearImageClickHandler()
  }, [pubkey, loadPinnedPost, loadSerial])

  useEffect(() => {
    if (profile?.nip05) {
      setNip05Verified(null)
      verifyNip05(profile.nip05, pubkey).then(setNip05Verified)
    } else {
      setNip05Verified(null)
    }
  }, [profile?.nip05, pubkey])

  const handleShareOption = async (eventId: string, content: string, option: ShareOption) => {
    switch (option) {
      case 'url': {
        const url = `${window.location.origin}/post/${eventId}`
        const result = await shareOrCopy(url)
        if (result.copied) {
          setCopiedId(eventId)
          setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
        }
        break
      }
      case 'md-copy': {
        const copied = await copyToClipboard(content)
        if (copied) {
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
    }
  }

  const handleDeleteConfirm = async (event: Event) => {
    await handleDelete(event)
    setDeletedId(event.id)
    setTimeout(() => setDeletedId(null), TIMEOUTS.DELETE_CONFIRMATION)
  }

  const handleBack = () => navigateToHome()
  const isOwnProfile = myPubkey === pubkey

  // Safely encode pubkey to npub
  let npub: string
  try {
    npub = pubkey.length === 64 ? nip19.npubEncode(pubkey) : pubkey
  } catch {
    npub = pubkey
  }

  const handleCopyNpub = async () => {
    const success = await copyToClipboard(npub)
    if (success) {
      setNpubCopied(true)
      setTimeout(() => setNpubCopied(false), TIMEOUTS.COPY_FEEDBACK)
    }
  }

  const handleProfileSave = (newProfile: Profile) => {
    setProfile(newProfile)
    setEditMode(false)
  }

  if (!mounted) return null
  if (loading && items.length === 0) return <Loading />

  if (error) {
    return (
      <ErrorMessage variant="box">
        <p>{error}</p>
        <Button size="md" onClick={handleBack}>
          Back to Timeline
        </Button>
      </ErrorMessage>
    )
  }

  const displayName = getDisplayName(profile, pubkey)
  const avatarUrl = getAvatarUrl(profile)
  const themeColors = profile ? getEventThemeColors({ tags: [] } as unknown as Event) : null

  return (
    <div className="user-view">
      <BackButton onClick={handleBack} />

      {profileLoading ? (
        <div className="user-profile-card loading">Loading profile...</div>
      ) : editMode ? (
        <UserProfileEditor profile={profile} onSave={handleProfileSave} onCancel={() => setEditMode(false)} />
      ) : (
        <UserProfile
          profile={profile}
          pubkey={pubkey}
          displayName={displayName}
          avatarUrl={avatarUrl}
          themeColors={themeColors}
          isOwnProfile={isOwnProfile}
          nip05Verified={nip05Verified}
          npubCopied={npubCopied}
          postsCount={items.length}
          serialData={serialData}
          onCopyNpub={handleCopyNpub}
          onEditClick={() => setEditMode(true)}
        />
      )}

      <UserPosts
        items={items}
        profiles={profiles}
        reactions={reactions}
        replies={replies}
        reposts={reposts}
        myPubkey={myPubkey}
        authorPubkey={pubkey}
        authorProfile={profile}
        likingId={likingId}
        repostingId={repostingId}
        copiedId={copiedId}
        deletedId={deletedId}
        pinnedEventId={pinnedEventId}
        pinnedEvent={pinnedEvent}
        gaps={gaps}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadingGap={loadingGap}
        onLike={handleLike}
        onUnlike={handleUnlike}
        onRepost={handleRepost}
        onDeleteConfirm={handleDeleteConfirm}
        onShareOption={handleShareOption}
        onCopied={(id) => setCopiedId(id)}
        onPin={handlePin}
        onUnpin={handleUnpin}
        loadOlderEvents={loadOlderEvents}
        fillGap={fillGap}
      />
      <LightBox />
    </div>
  )
}
