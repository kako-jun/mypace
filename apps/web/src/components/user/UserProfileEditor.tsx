import { useState, useRef } from 'react'
import { Avatar, Icon, Button, Input, Textarea, ErrorMessage, SuccessMessage, CloseButton } from '../ui'
import { useImageUpload, useDragDrop, useTemporaryFlag, useWebsiteEditor } from '../../hooks'
import { publishEvent } from '../../lib/nostr/relay'
import { createProfileEvent } from '../../lib/nostr/events'
import { setLocalProfile, getErrorMessage, detectServiceLabel, getWebsites } from '../../lib/utils'
import { CUSTOM_EVENTS } from '../../lib/constants'
import type { Profile, LoadableProfile } from '../../types'

interface UserProfileEditorProps {
  profile: LoadableProfile
  onSave: (profile: Profile) => void
  onCancel: () => void
}

export function UserProfileEditor({ profile, onSave, onCancel }: UserProfileEditorProps) {
  const [editName, setEditName] = useState(profile?.name || profile?.display_name || '')
  const [editAbout, setEditAbout] = useState(profile?.about || '')
  const [editPicture, setEditPicture] = useState(profile?.picture || '')
  const [editBanner, setEditBanner] = useState(profile?.banner || '')
  const [editNip05, setEditNip05] = useState(profile?.nip05 || '')
  const [editLud16, setEditLud16] = useState(profile?.lud16 || '')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaved, triggerEditSaved] = useTemporaryFlag()

  const initialWebsites = getWebsites(profile)
  const websiteEditor = useWebsiteEditor(initialWebsites)

  const editInitialRef = useRef({
    name: profile?.name || profile?.display_name || '',
    about: profile?.about || '',
    picture: profile?.picture || '',
    banner: profile?.banner || '',
    websites: initialWebsites,
    nip05: profile?.nip05 || '',
    lud16: profile?.lud16 || '',
  })

  // Image upload hooks
  const { uploading: uploadingAvatar, uploadFile: uploadAvatar } = useImageUpload()
  const { uploading: uploadingBanner, uploadFile: uploadBanner } = useImageUpload()

  const processAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEditError('Please drop an image file')
      return
    }
    const result = await uploadAvatar(file)
    if (result.url) {
      setEditPicture(result.url)
    } else if (result.error) {
      setEditError(result.error)
    }
  }

  const processBannerUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEditError('Please drop an image file')
      return
    }
    const result = await uploadBanner(file)
    if (result.url) {
      setEditBanner(result.url)
    } else if (result.error) {
      setEditError(result.error)
    }
  }

  const { dragging: avatarDragging, handlers: avatarHandlers } = useDragDrop(processAvatarUpload)
  const { dragging: bannerDragging, handlers: bannerHandlers } = useDragDrop(processBannerUpload)

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processAvatarUpload(file)
    e.target.value = ''
  }

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processBannerUpload(file)
    e.target.value = ''
  }

  // Check if profile has been modified
  const isProfileDirty =
    editName !== editInitialRef.current.name ||
    editAbout !== editInitialRef.current.about ||
    editPicture !== editInitialRef.current.picture ||
    editBanner !== editInitialRef.current.banner ||
    websiteEditor.hasChanged(editInitialRef.current.websites) ||
    editNip05 !== editInitialRef.current.nip05 ||
    editLud16 !== editInitialRef.current.lud16

  // Save profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditError('Name is required')
      return
    }

    setSaving(true)
    setEditError('')

    try {
      const validWebsites = websiteEditor.websites
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
        website: validWebsites[0]?.url || undefined,
        websites: validWebsites.length > 0 ? validWebsites : undefined,
        nip05: editNip05.trim() || undefined,
        lud16: editLud16.trim() || undefined,
      }

      const event = await createProfileEvent(newProfile)
      await publishEvent(event)
      setLocalProfile(newProfile)
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
      triggerEditSaved()
      onSave(newProfile)
    } catch (e) {
      setEditError(getErrorMessage(e, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  return (
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
          <Textarea value={editAbout} onChange={setEditAbout} placeholder="Tell us about yourself" rows={3} />
        </div>
        <div className="edit-field">
          <label>Websites</label>
          {websiteEditor.websites.length < 10 && (
            <div className="website-input-row">
              <Input
                value={websiteEditor.newUrl}
                onChange={websiteEditor.setNewUrl}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') websiteEditor.addWebsite()
                }}
              />
              <Button size="md" onClick={websiteEditor.addWebsite} aria-label="Add URL">
                <Icon name="Plus" size={16} />
              </Button>
            </div>
          )}
          <div className="websites-editor">
            {websiteEditor.websites.map((w, index) => (
              <div key={index} className="website-entry">
                <div className="website-reorder">
                  <button
                    type="button"
                    className="website-move-btn"
                    onClick={() => websiteEditor.moveWebsite(index, 'up')}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <Icon name="ChevronUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className="website-move-btn"
                    onClick={() => websiteEditor.moveWebsite(index, 'down')}
                    disabled={index === websiteEditor.websites.length - 1}
                    aria-label="Move down"
                  >
                    <Icon name="ChevronDown" size={14} />
                  </button>
                </div>
                <Input
                  value={w.url}
                  onChange={(val) => websiteEditor.handleUrlChange(index, val)}
                  placeholder="https://example.com"
                />
                {w.url.trim() && <span className="website-detected-label">{detectServiceLabel(w.url)}</span>}
                <CloseButton
                  onClick={() => websiteEditor.removeWebsite(index)}
                  size={14}
                  className="website-remove-btn"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="edit-field">
          <label>NIP-05</label>
          <Input value={editNip05} onChange={setEditNip05} placeholder="you@example.com" />
        </div>
        <div className="edit-field">
          <label>Lightning Address</label>
          <Input value={editLud16} onChange={setEditLud16} placeholder="you@walletofsatoshi.com" />
        </div>

        <ErrorMessage>{editError}</ErrorMessage>
        {editSaved && <SuccessMessage>Saved!</SuccessMessage>}

        <div className="edit-actions">
          <Button size="md" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            className={`btn-save ${isProfileDirty ? 'is-dirty' : ''}`}
            onClick={handleSaveProfile}
            disabled={saving || !editName.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
