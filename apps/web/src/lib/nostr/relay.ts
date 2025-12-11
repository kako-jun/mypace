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

export async function fetchEvents(limit = 50, since = 0, mypaceOnly = true): Promise<Event[]> {
  try {
    const result = await api.fetchTimeline(limit, since, mypaceOnly)
    return result.events
  } catch (e) {
    console.error('Failed to fetch events:', e)
    return []
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

export async function fetchUserPosts(pubkey: string, limit = 50): Promise<Event[]> {
  try {
    const result = await api.fetchUserEvents(pubkey, limit)
    return result.events
  } catch (e) {
    console.error('Failed to fetch user posts:', e)
    return []
  }
}

export async function fetchEventById(eventId: string): Promise<Event | null> {
  try {
    const result = await api.fetchEvent(eventId)
    return result.event
  } catch (e) {
    console.error('Failed to fetch event by ID:', e)
    return null
  }
}

export async function fetchReactions(
  eventId: string,
  myPubkey?: string
): Promise<{ count: number; myReaction: boolean }> {
  try {
    return await api.fetchReactions(eventId, myPubkey)
  } catch (e) {
    console.error('Failed to fetch reactions:', e)
    return { count: 0, myReaction: false }
  }
}

export async function fetchReplies(eventId: string): Promise<{ count: number; replies: Event[] }> {
  try {
    return await api.fetchReplies(eventId)
  } catch (e) {
    console.error('Failed to fetch replies:', e)
    return { count: 0, replies: [] }
  }
}

export async function fetchReposts(eventId: string, myPubkey?: string): Promise<{ count: number; myRepost: boolean }> {
  try {
    return await api.fetchReposts(eventId, myPubkey)
  } catch (e) {
    console.error('Failed to fetch reposts:', e)
    return { count: 0, myRepost: false }
  }
}

// 互換性のために残す（何もしない）
export function closePool(): void {}
export function getPool(): null {
  return null
}
