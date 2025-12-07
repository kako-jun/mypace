import { useState, useEffect } from 'hono/jsx'
import { getCurrentPubkey, createProfileEvent, type Profile } from '../lib/nostr/events'
import { publishEvent, fetchUserProfile } from '../lib/nostr/relay'
import { Button, Input } from '../components/ui'
import { getLocalProfile, setLocalProfile, hasLocalProfile } from '../lib/utils'

interface Props {
  onProfileSet?: () => void
}

export default function ProfileSetup({ onProfileSet }: Props) {
  const [name, setName] = useState('')
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      // Check local storage first (more recent than relay cache)
      const localProfile = getLocalProfile()
      if (localProfile) {
        setCurrentProfile(localProfile)
        setName(localProfile.name || localProfile.display_name || '')
        setLoading(false)
        return
      }

      // Fallback to relay
      try {
        const pubkey = await getCurrentPubkey()
        const profileEvent = await fetchUserProfile(pubkey)
        if (profileEvent) {
          const profile = JSON.parse(profileEvent.content) as Profile
          setCurrentProfile(profile)
          setName(profile.name || profile.display_name || '')
          // Store locally for next time
          setLocalProfile(profile)
        }
      } catch (e) {
        console.error('Failed to load profile:', e)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const profile: Profile = {
        ...currentProfile,
        name: name.trim(),
        display_name: name.trim(),
      }
      const event = await createProfileEvent(profile)
      await publishEvent(event)
      setCurrentProfile(profile)

      // Store locally for immediate access
      setLocalProfile(profile)

      onProfileSet?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div class="profile-setup loading">Loading...</div>
  }

  const hasName = currentProfile?.name || currentProfile?.display_name

  return (
    <div class="profile-setup">
      {!hasName && (
        <p class="profile-notice">Set your name to start posting</p>
      )}
      <div class="profile-form">
        <Input
          placeholder="Your name"
          value={name}
          onChange={setName}
          maxLength={50}
        />
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : hasName ? 'Update' : 'Set Name'}
        </Button>
      </div>
      {error && <p class="error">{error}</p>}
    </div>
  )
}
