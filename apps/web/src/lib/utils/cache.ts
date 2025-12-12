import type { Event, Profile } from '../../types'

const CACHE_KEYS = {
  POST: 'post_',
  PROFILE: 'profile_',
} as const

// Post cache
export function cachePost(event: Event): void {
  try {
    sessionStorage.setItem(`${CACHE_KEYS.POST}${event.id}`, JSON.stringify(event))
  } catch {
    // sessionStorage may be full or unavailable
  }
}

export function getCachedPost(eventId: string): Event | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEYS.POST}${eventId}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // Parse error or unavailable
  }
  return null
}

export function clearCachedPost(eventId: string): void {
  try {
    sessionStorage.removeItem(`${CACHE_KEYS.POST}${eventId}`)
  } catch {
    // Ignore
  }
}

// Profile cache
export function cacheProfile(pubkey: string, profile: Profile): void {
  try {
    sessionStorage.setItem(`${CACHE_KEYS.PROFILE}${pubkey}`, JSON.stringify(profile))
  } catch {
    // sessionStorage may be full or unavailable
  }
}

export function getCachedProfile(pubkey: string): Profile | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEYS.PROFILE}${pubkey}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // Parse error or unavailable
  }
  return null
}

export function clearCachedProfile(pubkey: string): void {
  try {
    sessionStorage.removeItem(`${CACHE_KEYS.PROFILE}${pubkey}`)
  } catch {
    // Ignore
  }
}
