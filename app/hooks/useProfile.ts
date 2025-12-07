import { useState } from 'hono/jsx'
import { fetchUserProfile } from '../lib/nostr/relay'
import { getDisplayNameFromCache, getAvatarUrlFromCache, parseProfile } from '../lib/utils'
import type { Profile, ProfileCache } from '../types'

interface UseProfileResult {
  profiles: ProfileCache
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
  fetchProfiles: (pubkeys: string[]) => Promise<void>
  setProfile: (pubkey: string, profile: Profile | null) => void
}

export function useProfile(): UseProfileResult {
  const [profiles, setProfiles] = useState<ProfileCache>({})

  const getDisplayName = (pubkey: string): string => getDisplayNameFromCache(pubkey, profiles)
  const getAvatarUrl = (pubkey: string): string | null => getAvatarUrlFromCache(pubkey, profiles)

  const fetchProfilesData = async (pubkeys: string[]) => {
    const uniquePubkeys = [...new Set(pubkeys)]
    const newProfiles: ProfileCache = { ...profiles }

    for (const pubkey of uniquePubkeys) {
      if (newProfiles[pubkey] !== undefined) continue
      try {
        const profileEvent = await fetchUserProfile(pubkey)
        if (profileEvent) {
          newProfiles[pubkey] = parseProfile(profileEvent.content)
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
