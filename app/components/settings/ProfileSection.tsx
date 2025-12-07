import { useState } from 'hono/jsx'
import { Camera } from 'lucide-react'
import { uploadImage } from '../../lib/upload'
import { createProfileEvent } from '../../lib/nostr/events'
import type { Profile } from '../../types'
import { publishEvent } from '../../lib/nostr/relay'
import { getLocalProfile, setLocalProfile, getErrorMessage } from '../../lib/utils'
import { CUSTOM_EVENTS } from '../../lib/constants'
import { Button, Input } from '../ui'
import { useTemporaryFlag, useDragDrop } from '../../hooks'

interface ProfileSectionProps {
  displayName: string
  pictureUrl: string
  onDisplayNameChange: (name: string) => void
  onPictureUrlChange: (url: string) => void
}

export default function ProfileSection({
  displayName,
  pictureUrl,
  onDisplayNameChange,
  onPictureUrlChange,
}: ProfileSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, triggerNameSaved] = useTemporaryFlag()

  const saveProfileWithAvatar = async (avatarUrl: string | undefined) => {
    const localProfile = getLocalProfile() ?? {}
    const profile: Profile = {
      ...localProfile,
      name: displayName.trim() || localProfile.name || '',
      display_name: displayName.trim() || localProfile.display_name || '',
      picture: avatarUrl,
    }
    const event = await createProfileEvent(profile)
    await publishEvent(event)
    setLocalProfile(profile)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
  }

  const processAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNameError('Please drop an image file')
      return
    }

    setUploading(true)
    setNameError('')

    const result = await uploadImage(file)

    if (result.success && result.url) {
      onPictureUrlChange(result.url)
      try {
        await saveProfileWithAvatar(result.url)
      } catch (e) {
        setNameError(getErrorMessage(e, 'Failed to save profile'))
      }
    } else {
      setNameError(result.error || 'Failed to upload')
    }

    setUploading(false)
  }

  const { dragging, handlers } = useDragDrop(processAvatarUpload)

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setNameError('Name is required')
      return
    }

    setSavingName(true)
    setNameError('')

    try {
      const localProfile = getLocalProfile()
      const profile: Profile = {
        ...localProfile,
        name: displayName.trim(),
        display_name: displayName.trim(),
        picture: pictureUrl.trim() || localProfile?.picture || undefined,
      }
      const event = await createProfileEvent(profile)
      await publishEvent(event)

      setLocalProfile(profile)
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
      triggerNameSaved()
    } catch (e) {
      setNameError(getErrorMessage(e, 'Failed to save'))
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarUpload = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    await processAvatarUpload(file)
    input.value = ''
  }

  const handleRemoveAvatar = async () => {
    onPictureUrlChange('')
    try {
      await saveProfileWithAvatar(undefined)
    } catch (e) {
      setNameError(getErrorMessage(e, 'Failed to remove avatar'))
    }
  }

  return (
    <div class="settings-section">
      <h3>Profile</h3>
      <div class="profile-avatar-section">
        <div class="profile-avatar-preview">
          {pictureUrl ? (
            <img src={pictureUrl} alt="Avatar" class="avatar-preview" />
          ) : (
            <div class="avatar-placeholder">No image</div>
          )}
        </div>
        <div class="avatar-upload-buttons">
          <label
            class={`avatar-drop-area ${dragging ? 'dragging' : ''}`}
            onDragOver={handlers.onDragOver}
            onDragLeave={handlers.onDragLeave}
            onDrop={handlers.onDrop}
          >
            {uploading ? '...' : dragging ? 'Drop' : <Camera size={16} />}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          {pictureUrl && <Button onClick={handleRemoveAvatar}>Remove</Button>}
        </div>
      </div>
      <div class="input-row">
        <Input placeholder="Your name" value={displayName} onChange={onDisplayNameChange} maxLength={50} />
        <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}>
          {savingName ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {nameError && <p class="error">{nameError}</p>}
      {nameSaved && <p class="success">Updated!</p>}
    </div>
  )
}
