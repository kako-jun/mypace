import type { Event, Profile, ReactionData, RepostData, ViewCountData } from '../../../types'

const CACHE_KEYS = {
  POST: 'post_',
  PROFILE: 'profile_',
  POST_METADATA: 'post_meta_',
} as const

// Post metadata structure (from timeline)
export interface CachedPostMetadata {
  reactions: ReactionData
  replies: { count: number; replies: Event[] }
  reposts: RepostData
  views: ViewCountData
  superMentions?: Record<string, string>
}

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

// Post metadata cache (reactions, replies, reposts, views from timeline)
export function cachePostMetadata(eventId: string, metadata: CachedPostMetadata): void {
  try {
    sessionStorage.setItem(`${CACHE_KEYS.POST_METADATA}${eventId}`, JSON.stringify(metadata))
  } catch {
    // sessionStorage may be full or unavailable
  }
}

export function getCachedPostMetadata(eventId: string): CachedPostMetadata | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEYS.POST_METADATA}${eventId}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // Parse error or unavailable
  }
  return null
}

export function clearCachedPostMetadata(eventId: string): void {
  try {
    sessionStorage.removeItem(`${CACHE_KEYS.POST_METADATA}${eventId}`)
  } catch {
    // Ignore
  }
}

// Cache post with all its metadata at once (convenience function for timeline → detail transition)
export function cachePostWithMetadata(event: Event, profile: Profile | null, metadata: CachedPostMetadata): void {
  cachePost(event)
  if (profile) {
    cacheProfile(event.pubkey, profile)
  }
  cachePostMetadata(event.id, metadata)
}
