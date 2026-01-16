// API経由でリレーと通信する（直接リレーには接続しない）
import * as api from '../api'
import type { Event, Profile } from '../../types'

export async function publishEvent(event: Event): Promise<void> {
  try {
    await api.publishEvent(event)
  } catch (e) {
    console.error('Failed to publish event:', e)
    throw e
  }
}

interface FetchEventsOptions {
  limit?: number
  since?: number
  until?: number
  q?: string[]
  tags?: string[]
}

interface FetchEventsResult {
  events: Event[]
  searchedUntil: number | null
}

export async function fetchEvents(options: FetchEventsOptions = {}): Promise<FetchEventsResult> {
  const { limit = 50, since = 0, until = 0, q, tags } = options
  try {
    const result = await api.fetchTimeline({ limit, since, until, q, tags })
    return { events: result.events, searchedUntil: result.searchedUntil ?? null }
  } catch (e) {
    console.error('Failed to fetch events:', e)
    return { events: [], searchedUntil: null }
  }
}

export async function fetchUserProfile(pubkey: string): Promise<Profile | null> {
  try {
    const result = await api.fetchProfiles([pubkey])
    return result.profiles[pubkey] || null
  } catch (e) {
    console.error('Failed to fetch user profile:', e)
    return null
  }
}

export async function fetchProfiles(pubkeys: string[]): Promise<Record<string, Profile>> {
  try {
    const result = await api.fetchProfiles(pubkeys)
    return result.profiles
  } catch (e) {
    console.error('Failed to fetch profiles:', e)
    return {}
  }
}

interface FetchUserPostsOptions {
  limit?: number
  since?: number
  until?: number
  tags?: string[]
  q?: string[]
}

interface FetchUserPostsResult {
  events: Event[]
  searchedUntil: number | null
}

export async function fetchUserPosts(
  pubkey: string,
  options: FetchUserPostsOptions = {}
): Promise<FetchUserPostsResult> {
  const { limit = 50, since = 0, until = 0, tags = [], q = [] } = options
  try {
    const result = await api.fetchUserEvents(pubkey, { limit, since, until, tags, q })
    return { events: result.events, searchedUntil: result.searchedUntil ?? null }
  } catch (e) {
    console.error('Failed to fetch user posts:', e)
    return { events: [], searchedUntil: null }
  }
}

export async function fetchEventById(eventId: string): Promise<Event | null> {
  try {
    const result = await api.fetchEventsBatch([eventId])
    return result[eventId] || null
  } catch (e) {
    console.error('Failed to fetch event by ID:', e)
    return null
  }
}

// 互換性のために残す（何もしない）
export function closePool(): void {}
export function getPool(): null {
  return null
}
