import { useState, useEffect } from 'react'
import { fetchUserProfile } from '../lib/nostr/relay'
import { getEventThemeColors } from '../lib/nostr/events'
import {
  getDisplayName,
  getAvatarUrl,
  navigateToHome,
  navigateToTag,
  getUIThemeColors,
  applyThemeColors,
  shareOrCopy,
  copyToClipboard,
  verifyNip05,
} from '../lib/utils'
import { Button, Loading } from '../components/ui'
import { TIMEOUTS, CUSTOM_EVENTS } from '../lib/constants'
import {
  setHashtagClickHandler,
  setSuperMentionClickHandler,
  setImageClickHandler,
  clearImageClickHandler,
} from '../lib/content-parser'
import { LightBox, triggerLightBox } from './LightBox'
import { UserProfile } from './user/UserProfile'
import { UserProfileEditor } from './user/UserProfileEditor'
import { UserPosts } from './user/UserPosts'
import { useTimeline } from '../hooks'
import { nip19 } from 'nostr-tools'
import type { Event, Profile } from '../types'

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
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [npubCopied, setNpubCopied] = useState(false)
  const [nip05Verified, setNip05Verified] = useState<boolean | null>(null)
  const [editMode, setEditMode] = useState(false)
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

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    applyThemeColors(getUIThemeColors())
    setHashtagClickHandler((tag) => navigateToTag(tag))
    setSuperMentionClickHandler((path) => navigateToTag(path))
    setImageClickHandler(triggerLightBox)
    loadProfile()
    return () => clearImageClickHandler()
  }, [pubkey])

  useEffect(() => {
    if (profile?.nip05) {
      setNip05Verified(null)
      verifyNip05(profile.nip05, pubkey).then(setNip05Verified)
    } else {
      setNip05Verified(null)
    }
  }, [profile?.nip05, pubkey])

  const handleShare = async (eventId: string) => {
    const url = `${window.location.origin}/post/${eventId}`
    const result = await shareOrCopy(url)
    if (result.copied) {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId(null), TIMEOUTS.COPY_FEEDBACK)
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
      <div className="error-box">
        <p>{error}</p>
        <Button size="md" onClick={handleBack}>
          Back to Timeline
        </Button>
      </div>
    )
  }

  const displayName = getDisplayName(profile, pubkey)
  const avatarUrl = getAvatarUrl(profile)
  const themeColors = profile ? getEventThemeColors({ tags: [] } as unknown as Event) : null

  return (
    <div className="user-view">
      <button className="back-button text-outlined text-outlined-button" onClick={handleBack}>
        ← BACK
      </button>

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
        gaps={gaps}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadingGap={loadingGap}
        onLike={handleLike}
        onUnlike={handleUnlike}
        onRepost={handleRepost}
        onDeleteConfirm={handleDeleteConfirm}
        onShare={handleShare}
        onCopied={(id) => setCopiedId(id)}
        loadOlderEvents={loadOlderEvents}
        fillGap={fillGap}
      />
      <LightBox />
    </div>
  )
}
