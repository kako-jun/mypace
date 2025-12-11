import { useState, useEffect } from 'react'
import { getCurrentPubkey, createProfileEvent } from '../lib/nostr/events'
import type { Profile } from '../types'
import { publishEvent, fetchUserProfile } from '../lib/nostr/relay'
import { Button, Input } from '../components/ui'
import { getLocalProfile, setLocalProfile, getErrorMessage } from '../lib/utils'

interface Props {
  onProfileSet?: () => void
}

export function ProfileSetup({ onProfileSet }: Props) {
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
        const hasName = localProfile.name || localProfile.display_name
        if (hasName) {
          // Already has a name, immediately signal profile is set
          setLoading(false)
          onProfileSet?.()
          return
        }
        setCurrentProfile(localProfile)
        setName(localProfile.name || localProfile.display_name || '')
        setLoading(false)
        return
      }

      // Fallback to relay
      try {
        const pubkey = await getCurrentPubkey()
        const profile = await fetchUserProfile(pubkey)
        if (profile) {
          setCurrentProfile(profile)
          setName(profile.name || profile.display_name || '')
          // Store locally for next time
          setLocalProfile(profile)

          // If profile has name, signal immediately
          const hasName = profile.name || profile.display_name
          if (hasName) {
            setLoading(false)
            onProfileSet?.()
            return
          }
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
      setError(getErrorMessage(e, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="profile-setup loading">Loading...</div>
  }

  const hasName = currentProfile?.name || currentProfile?.display_name

  return (
    <div className="profile-setup">
      {!hasName && <p className="profile-notice">Set your name to start posting</p>}
      <div className="profile-form">
        <Input placeholder="Your name" value={name} onChange={setName} maxLength={50} />
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : hasName ? 'Update' : 'Set Name'}
        </Button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
