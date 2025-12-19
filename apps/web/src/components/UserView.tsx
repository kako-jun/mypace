import { useState, useEffect, useCallback, Fragment, useRef } from 'react'
import { fetchUserProfile, publishEvent } from '../lib/nostr/relay'
import { getEventThemeColors, getThemeCardProps, createProfileEvent } from '../lib/nostr/events'
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
  setLocalProfile,
  getErrorMessage,
  verifyNip05,
  detectServiceLabel,
  getWebsites,
  getWebsiteIcon,
} from '../lib/utils'
import { Avatar, Icon, Button, Input, Loading } from '../components/ui'
import { TIMEOUTS, CUSTOM_EVENTS } from '../lib/constants'
import { setHashtagClickHandler, setImageClickHandler, clearImageClickHandler } from '../lib/content-parser'
import { LightBox, triggerLightBox } from './LightBox'
import { TimelinePostCard } from '../components/timeline'
import { useTimeline, useDragDrop, useTemporaryFlag } from '../hooks'
import { uploadImage } from '../lib/upload'
import { nip19 } from 'nostr-tools'
import type { Event, Profile, WebsiteEntry } from '../types'

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
  } catch {
    // Invalid bech32, return as-is (might be hex already)
  }
  return id
}

export function UserView({ pubkey: rawPubkey }: UserViewProps) {
  // Decode bech32 to hex if needed
  const pubkey = decodePubkey(rawPubkey)
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [npubCopied, setNpubCopied] = useState(false)
  const [nip05Verified, setNip05Verified] = useState<boolean | null>(null)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAbout, setEditAbout] = useState('')
  const [editPicture, setEditPicture] = useState('')
  const [editBanner, setEditBanner] = useState('')
  const [editWebsites, setEditWebsites] = useState<WebsiteEntry[]>([])
  const [editNip05, setEditNip05] = useState('')
  const [editLud16, setEditLud16] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaved, triggerEditSaved] = useTemporaryFlag()
  const editInitialRef = useRef({
    name: '',
    about: '',
    picture: '',
    banner: '',
    websites: [] as WebsiteEntry[],
    nip05: '',
    lud16: '',
  })
  const [, setThemeVersion] = useState(0)

  // Re-render when app theme changes
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
    setImageClickHandler(triggerLightBox)
    loadProfile()

    return () => clearImageClickHandler()
  }, [pubkey])

  // Verify NIP-05 when profile changes
  useEffect(() => {
    if (profile?.nip05) {
      setNip05Verified(null) // Reset while verifying
      verifyNip05(profile.nip05, pubkey).then(setNip05Verified)
    } else {
      setNip05Verified(null)
    }
  }, [profile?.nip05, pubkey])

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

  const isOwnProfile = myPubkey === pubkey

  // Enter edit mode
  const enterEditMode = () => {
    const initialName = profile?.name || profile?.display_name || ''
    const initialAbout = profile?.about || ''
    const initialPicture = profile?.picture || ''
    const initialBanner = profile?.banner || ''
    const initialWebsites = getWebsites(profile)
    const initialNip05 = profile?.nip05 || ''
    const initialLud16 = profile?.lud16 || ''

    editInitialRef.current = {
      name: initialName,
      about: initialAbout,
      picture: initialPicture,
      banner: initialBanner,
      websites: initialWebsites,
      nip05: initialNip05,
      lud16: initialLud16,
    }

    setEditName(initialName)
    setEditAbout(initialAbout)
    setEditPicture(initialPicture)
    setEditBanner(initialBanner)
    setEditWebsites(initialWebsites.length > 0 ? initialWebsites : [{ url: '', label: '' }])
    setEditNip05(initialNip05)
    setEditLud16(initialLud16)
    setEditError('')
    setEditMode(true)
  }

  // Check if websites have been modified
  const websitesChanged = () => {
    const initial = editInitialRef.current.websites
    const current = editWebsites.filter((w) => w.url.trim())
    if (initial.length !== current.length) return true
    return current.some((w, i) => w.url !== initial[i]?.url || w.label !== initial[i]?.label)
  }

  // Check if profile has been modified
  const isProfileDirty =
    editMode &&
    (editName !== editInitialRef.current.name ||
      editAbout !== editInitialRef.current.about ||
      editPicture !== editInitialRef.current.picture ||
      editBanner !== editInitialRef.current.banner ||
      websitesChanged() ||
      editNip05 !== editInitialRef.current.nip05 ||
      editLud16 !== editInitialRef.current.lud16)

  const cancelEditMode = () => {
    setEditMode(false)
    setEditError('')
  }

  // Save profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditError('Name is required')
      return
    }

    setSaving(true)
    setEditError('')

    try {
      // Filter out empty websites and ensure labels
      const validWebsites = editWebsites
        .filter((w) => w.url.trim())
        .map((w) => ({
          url: w.url.trim(),
          label: w.label?.trim() || detectServiceLabel(w.url.trim()),
        }))

      const newProfile: Profile = {
        name: editName.trim(),
        display_name: editName.trim(),
        picture: editPicture.trim() || undefined,
        banner: editBanner.trim() || undefined,
        about: editAbout.trim() || undefined,
        website: validWebsites[0]?.url || undefined, // 互換性: 最初のURLをwebsiteにも設定
        websites: validWebsites.length > 0 ? validWebsites : undefined,
        nip05: editNip05.trim() || undefined,
        lud16: editLud16.trim() || undefined,
      }

      const event = await createProfileEvent(newProfile)
      await publishEvent(event)
      setLocalProfile(newProfile)
      setProfile(newProfile)
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
      triggerEditSaved()
      setEditMode(false)
    } catch (e) {
      setEditError(getErrorMessage(e, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  // Website editing helpers
  const handleWebsiteUrlChange = (index: number, url: string) => {
    const updated = [...editWebsites]
    updated[index] = { url, label: '' }
    setEditWebsites(updated)
  }

  const addWebsite = () => {
    if (editWebsites.length < 10) {
      setEditWebsites([...editWebsites, { url: '', label: '' }])
    }
  }

  const removeWebsite = (index: number) => {
    if (editWebsites.length > 1) {
      setEditWebsites(editWebsites.filter((_, i) => i !== index))
    } else {
      setEditWebsites([{ url: '', label: '' }])
    }
  }

  const moveWebsite = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= editWebsites.length) return
    const updated = [...editWebsites]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setEditWebsites(updated)
  }

  // Avatar upload
  const processAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEditError('Please drop an image file')
      return
    }
    setUploadingAvatar(true)
    setEditError('')
    const result = await uploadImage(file)
    if (result.success && result.url) {
      setEditPicture(result.url)
    } else {
      setEditError(result.error || 'Failed to upload avatar')
    }
    setUploadingAvatar(false)
  }

  const { dragging: avatarDragging, handlers: avatarHandlers } = useDragDrop(processAvatarUpload)

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processAvatarUpload(file)
    e.target.value = ''
  }

  // Banner upload
  const processBannerUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEditError('Please drop an image file')
      return
    }
    setUploadingBanner(true)
    setEditError('')
    const result = await uploadImage(file)
    if (result.success && result.url) {
      setEditBanner(result.url)
    } else {
      setEditError(result.error || 'Failed to upload banner')
    }
    setUploadingBanner(false)
  }

  const { dragging: bannerDragging, handlers: bannerHandlers } = useDragDrop(processBannerUpload)

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processBannerUpload(file)
    e.target.value = ''
  }

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

  if (!mounted) {
    return null
  }

  if (loading && items.length === 0) return <Loading />

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
      ) : editMode ? (
        /* Edit Mode */
        <div className="user-profile-card user-profile-edit">
          {/* Banner upload */}
          <label
            className={`banner-upload-area ${bannerDragging ? 'dragging' : ''}`}
            onDragOver={bannerHandlers.onDragOver}
            onDragLeave={bannerHandlers.onDragLeave}
            onDrop={bannerHandlers.onDrop}
          >
            {editBanner ? (
              <img src={editBanner} alt="Banner" className="banner-preview" />
            ) : (
              <div className="banner-placeholder">
                <Icon name="Image" size={24} />
                <span>Click or drop to add banner</span>
              </div>
            )}
            {uploadingBanner && <div className="upload-overlay">Uploading...</div>}
            <input type="file" accept="image/*" onChange={handleBannerFileChange} style={{ display: 'none' }} />
          </label>

          {/* Avatar upload */}
          <div className="edit-avatar-section">
            <label
              className={`avatar-upload-area ${avatarDragging ? 'dragging' : ''}`}
              onDragOver={avatarHandlers.onDragOver}
              onDragLeave={avatarHandlers.onDragLeave}
              onDrop={avatarHandlers.onDrop}
            >
              <Avatar src={editPicture} className="user-avatar" />
              <div className="avatar-upload-overlay">{uploadingAvatar ? '...' : <Icon name="Camera" size={20} />}</div>
              <input type="file" accept="image/*" onChange={handleAvatarFileChange} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Form fields */}
          <div className="edit-form">
            <div className="edit-field">
              <label>Name *</label>
              <Input value={editName} onChange={setEditName} placeholder="Your name" maxLength={50} />
            </div>
            <div className="edit-field">
              <label>About</label>
              <textarea
                value={editAbout}
                onChange={(e) => setEditAbout(e.target.value)}
                placeholder="Tell us about yourself"
                rows={3}
                className="edit-textarea"
              />
            </div>
            <div className="edit-field">
              <label>Websites</label>
              <div className="websites-editor">
                {editWebsites.map((w, index) => (
                  <div key={index} className="website-entry">
                    <div className="website-reorder">
                      <button
                        type="button"
                        className="website-move-btn"
                        onClick={() => moveWebsite(index, 'up')}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        <Icon name="ChevronUp" size={14} />
                      </button>
                      <button
                        type="button"
                        className="website-move-btn"
                        onClick={() => moveWebsite(index, 'down')}
                        disabled={index === editWebsites.length - 1}
                        aria-label="Move down"
                      >
                        <Icon name="ChevronDown" size={14} />
                      </button>
                    </div>
                    <Input
                      value={w.url}
                      onChange={(val) => handleWebsiteUrlChange(index, val)}
                      placeholder="https://example.com"
                    />
                    {w.url.trim() && <span className="website-detected-label">{detectServiceLabel(w.url)}</span>}
                    <button
                      type="button"
                      className="website-remove-btn"
                      onClick={() => removeWebsite(index)}
                      aria-label="Remove website"
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))}
                {editWebsites.length < 10 && (
                  <button type="button" className="website-add-btn" onClick={addWebsite} aria-label="Add URL">
                    <Icon name="Plus" size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="edit-field">
              <label>NIP-05</label>
              <Input value={editNip05} onChange={setEditNip05} placeholder="you@example.com" />
            </div>
            <div className="edit-field">
              <label>Lightning Address</label>
              <Input value={editLud16} onChange={setEditLud16} placeholder="you@getalby.com" />
            </div>

            {editError && <p className="error">{editError}</p>}
            {editSaved && <p className="success">Saved!</p>}

            <div className="edit-actions">
              <Button variant="secondary" size="lg" onClick={cancelEditMode} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                className={`btn-save ${isProfileDirty ? 'is-dirty' : ''}`}
                onClick={handleSaveProfile}
                disabled={saving || !editName.trim()}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="user-profile-card-wrapper">
          {/* Banner */}
          {profile?.banner && (
            <div className="user-banner">
              <img src={profile.banner} alt="Banner" />
            </div>
          )}

          <div className={`user-profile-card ${themeProps.className}`} style={themeProps.style}>
            <div className="user-profile-header">
              <Avatar src={avatarUrl} className="user-avatar" />
              <div className="user-info">
                <h2 className="user-name">{displayName}</h2>
                {profile?.nip05 && (
                  <span
                    className={`user-nip05 ${nip05Verified === true ? 'verified' : nip05Verified === false ? 'unverified' : ''}`}
                  >
                    {nip05Verified === true ? (
                      <Icon name="CheckCircle" size={14} />
                    ) : nip05Verified === false ? (
                      <Icon name="XCircle" size={14} />
                    ) : (
                      <span className="verifying">...</span>
                    )}{' '}
                    {profile.nip05}
                  </span>
                )}
              </div>
              {isOwnProfile && (
                <button
                  className="edit-button text-outlined text-outlined-button text-outlined-primary"
                  onClick={enterEditMode}
                >
                  EDIT
                </button>
              )}
            </div>

            {profile?.about && <p className="user-about">{profile.about}</p>}

            <div className="user-links">
              {getWebsites(profile).map((w, i) => (
                <a
                  key={i}
                  href={w.url.match(/^https?:\/\//) ? w.url : `https://${w.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="user-link"
                >
                  <Icon name={getWebsiteIcon(w.label)} size={14} />{' '}
                  {w.label !== 'Website' ? w.label : w.url.replace(/^https?:\/\//, '')}
                </a>
              ))}
              {profile?.lud16 && (
                <span className="user-link user-lightning">
                  <Icon name="Zap" size={14} /> {profile.lud16}
                </span>
              )}
            </div>

            <div className="user-npub-row">
              <span className="user-npub">{npub}</span>
              <button className="npub-copy-btn" onClick={handleCopyNpub} aria-label="Copy npub">
                {npubCopied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
              </button>
            </div>

            <div className="user-stats">
              <span>{items.length} posts</span>
            </div>
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
                myPubkey={myPubkey}
                profiles={{ ...profiles, [pubkey]: profile ?? null }}
                reactions={reactions[event.id]}
                replies={replies[event.id]}
                reposts={reposts[event.id]}
                likingId={likingId}
                repostingId={repostingId}
                copiedId={copiedId}
                onEdit={() => handleEdit(event)}
                onDeleteConfirm={() => handleDeleteConfirm(event)}
                onLike={() => handleLike(event)}
                onUnlike={() => handleUnlike(event)}
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
