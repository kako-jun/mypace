import { createStore } from 'zustand/vanilla'
import { fetchUserProfile } from '../lib/nostr/relay'
import { exportNpub } from '../lib/nostr/keys'
import { parseProfile } from '../lib/utils'
import type { Profile, ProfileCache } from '../types'

interface ProfileState {
  profiles: ProfileCache
  loading: Set<string>

  // Actions
  getProfile: (pubkey: string) => Profile | null
  fetchProfile: (pubkey: string) => Promise<void>
  fetchProfiles: (pubkeys: string[]) => Promise<void>
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
  setProfile: (pubkey: string, profile: Profile | null) => void
}

export const profileStore = createStore<ProfileState>()((set, get) => ({
  profiles: {},
  loading: new Set(),

  getProfile: (pubkey: string) => {
    return get().profiles[pubkey] || null
  },

  fetchProfile: async (pubkey: string) => {
    const { profiles, loading } = get()
    if (profiles[pubkey] !== undefined || loading.has(pubkey)) return

    set(state => ({ loading: new Set([...state.loading, pubkey]) }))

    try {
      const profileEvent = await fetchUserProfile(pubkey)
      if (profileEvent) {
        set(state => ({
          profiles: { ...state.profiles, [pubkey]: parseProfile(profileEvent.content) },
          loading: new Set([...state.loading].filter(p => p !== pubkey))
        }))
      } else {
        set(state => ({
          profiles: { ...state.profiles, [pubkey]: null },
          loading: new Set([...state.loading].filter(p => p !== pubkey))
        }))
      }
    } catch {
      set(state => ({
        profiles: { ...state.profiles, [pubkey]: null },
        loading: new Set([...state.loading].filter(p => p !== pubkey))
      }))
    }
  },

  fetchProfiles: async (pubkeys: string[]) => {
    const { profiles, loading } = get()
    const toFetch = pubkeys.filter(pk => profiles[pk] === undefined && !loading.has(pk))

    for (const pubkey of toFetch) {
      await get().fetchProfile(pubkey)
    }
  },

  getDisplayName: (pubkey: string) => {
    const profile = get().profiles[pubkey]
    if (profile?.display_name) return profile.display_name
    if (profile?.name) return profile.name
    return exportNpub(pubkey).slice(0, 12) + '...'
  },

  getAvatarUrl: (pubkey: string) => {
    const profile = get().profiles[pubkey]
    return profile?.picture || null
  },

  setProfile: (pubkey: string, profile: Profile | null) => {
    set(state => ({
      profiles: { ...state.profiles, [pubkey]: profile }
    }))
  }
}))
