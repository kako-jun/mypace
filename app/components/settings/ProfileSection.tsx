import { useState } from 'hono/jsx'
import { uploadImage } from '../../lib/upload'
import { createProfileEvent, type Profile } from '../../lib/nostr/events'
import { publishEvent } from '../../lib/nostr/relay'
import { getLocalProfile, setLocalProfile } from '../../lib/utils'
import { CUSTOM_EVENTS, TIMEOUTS } from '../../lib/constants'
import { Button, Input } from '../ui'

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
  onPictureUrlChange
}: ProfileSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const [avatarDragging, setAvatarDragging] = useState(false)

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
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), TIMEOUTS.COPY_FEEDBACK)
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarUpload = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setUploading(true)
    setNameError('')

    const result = await uploadImage(file)

    if (result.success && result.url) {
      onPictureUrlChange(result.url)

      try {
        const localProfile = getLocalProfile()
        const profile: Profile = {
          ...localProfile,
          name: displayName.trim() || localProfile?.name || '',
          display_name: displayName.trim() || localProfile?.display_name || '',
          picture: result.url,
        }
        const event = await createProfileEvent(profile)
        await publishEvent(event)
        setLocalProfile(profile)
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
      } catch (e) {
        setNameError(e instanceof Error ? e.message : 'Failed to save profile')
      }
    } else {
      setNameError(result.error || 'Failed to upload')
    }

    setUploading(false)
    input.value = ''
  }

  const handleRemoveAvatar = async () => {
    onPictureUrlChange('')

    const localProfile = getLocalProfile()
    const profile: Profile = {
      ...localProfile,
      name: displayName.trim() || localProfile?.name || '',
      display_name: displayName.trim() || localProfile?.display_name || '',
      picture: undefined,
    }
    try {
      const event = await createProfileEvent(profile)
      await publishEvent(event)
      setLocalProfile(profile)
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to remove avatar')
    }
  }

  const handleAvatarDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAvatarDragging(true)
  }

  const handleAvatarDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAvatarDragging(false)
  }

  const handleAvatarDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAvatarDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const file = files[0]
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
        const localProfile = getLocalProfile()
        const profile: Profile = {
          ...localProfile,
          name: displayName.trim() || localProfile?.name || '',
          display_name: displayName.trim() || localProfile?.display_name || '',
          picture: result.url,
        }
        const event = await createProfileEvent(profile)
        await publishEvent(event)
        setLocalProfile(profile)
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
      } catch (e) {
        setNameError(e instanceof Error ? e.message : 'Failed to save profile')
      }
    } else {
      setNameError(result.error || 'Failed to upload')
    }

    setUploading(false)
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
            class={`avatar-drop-area ${avatarDragging ? 'dragging' : ''}`}
            onDragOver={handleAvatarDragOver}
            onDragLeave={handleAvatarDragLeave}
            onDrop={handleAvatarDrop}
          >
            {uploading ? '...' : avatarDragging ? 'Drop' : '📷'}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          {pictureUrl && (
            <Button onClick={handleRemoveAvatar}>Remove</Button>
          )}
        </div>
      </div>
      <div class="input-row">
        <Input
          placeholder="Your name"
          value={displayName}
          onChange={onDisplayNameChange}
          maxLength={50}
        />
        <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}>
          {savingName ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {nameError && <p class="error">{nameError}</p>}
      {nameSaved && <p class="success">Updated!</p>}
    </div>
  )
}
