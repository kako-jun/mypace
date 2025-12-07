import { useState, useEffect } from 'hono/jsx'
import { fetchUserProfile } from '../lib/nostr/relay'
import { exportNpub } from '../lib/nostr/keys'
import type { Profile } from '../types'

interface ProfileCache {
  [pubkey: string]: Profile | null
}

interface UseProfileResult {
  profiles: ProfileCache
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
  fetchProfiles: (pubkeys: string[]) => Promise<void>
  setProfile: (pubkey: string, profile: Profile | null) => void
}

export function useProfile(): UseProfileResult {
  const [profiles, setProfiles] = useState<ProfileCache>({})

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles[pubkey]
    if (profile?.display_name) return profile.display_name
    if (profile?.name) return profile.name
    return exportNpub(pubkey).slice(0, 12) + '...'
  }

  const getAvatarUrl = (pubkey: string): string | null => {
    const profile = profiles[pubkey]
    return profile?.picture || null
  }

  const fetchProfilesData = async (pubkeys: string[]) => {
    const uniquePubkeys = [...new Set(pubkeys)]
    const newProfiles: ProfileCache = { ...profiles }

    for (const pubkey of uniquePubkeys) {
      if (newProfiles[pubkey] !== undefined) continue
      try {
        const profileEvent = await fetchUserProfile(pubkey)
        if (profileEvent) {
          newProfiles[pubkey] = JSON.parse(profileEvent.content)
        } else {
          newProfiles[pubkey] = null
        }
      } catch {
        newProfiles[pubkey] = null
      }
    }

    setProfiles(newProfiles)
  }

  const setProfile = (pubkey: string, profile: Profile | null) => {
    setProfiles(prev => ({ ...prev, [pubkey]: profile }))
  }

  return {
    profiles,
    getDisplayName,
    getAvatarUrl,
    fetchProfiles: fetchProfilesData,
    setProfile
  }
}
