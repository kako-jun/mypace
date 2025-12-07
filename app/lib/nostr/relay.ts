import { SimplePool, type Filter, type Event } from 'nostr-tools'
import { MYPACE_TAG } from './events'

export const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
]

let pool: SimplePool | null = null

export function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool()
  }
  return pool
}

export async function publishEvent(event: Event): Promise<void> {
  try {
    const p = getPool()
    await Promise.allSettled(p.publish(RELAYS, event))
  } catch (e) {
    console.error('Failed to publish event:', e)
    throw e
  }
}

export async function fetchEvents(filter: Filter, limit = 50): Promise<Event[]> {
  try {
    const p = getPool()
    // Filter by #mypace tag to only show mypace posts
    const mypaceFilter: Filter = {
      ...filter,
      '#t': [MYPACE_TAG],
      limit,
    }
    const events = await p.querySync(RELAYS, mypaceFilter)
    return events.sort((a, b) => b.created_at - a.created_at)
  } catch (e) {
    console.error('Failed to fetch events:', e)
    return []
  }
}

// Fetch reposts (kind 6) that repost mypace posts
export async function fetchRepostEvents(limit = 50): Promise<Event[]> {
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      kinds: [6],
      limit,
    })
    return events.sort((a, b) => b.created_at - a.created_at)
  } catch (e) {
    console.error('Failed to fetch repost events:', e)
    return []
  }
}

export async function fetchUserProfile(pubkey: string): Promise<Event | null> {
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      kinds: [0],
      authors: [pubkey],
      limit: 1,
    })
    return events[0] || null
  } catch (e) {
    console.error('Failed to fetch user profile:', e)
    return null
  }
}

// Fetch a single event by ID
export async function fetchEventById(eventId: string): Promise<Event | null> {
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      ids: [eventId],
      limit: 1,
    })
    return events[0] || null
  } catch (e) {
    console.error('Failed to fetch event by ID:', e)
    return null
  }
}

// Fetch reactions (kind 7) for given event IDs
export async function fetchReactions(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      kinds: [7],
      '#e': eventIds,
    })
    return events
  } catch (e) {
    console.error('Failed to fetch reactions:', e)
    return []
  }
}

// Fetch replies (kind 1 with e tag) for given event IDs
export async function fetchReplies(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      kinds: [1],
      '#e': eventIds,
      '#t': [MYPACE_TAG],
    })
    return events.sort((a, b) => a.created_at - b.created_at) // Oldest first for threads
  } catch (e) {
    console.error('Failed to fetch replies:', e)
    return []
  }
}

// Fetch reposts (kind 6) for given event IDs
export async function fetchReposts(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  try {
    const p = getPool()
    const events = await p.querySync(RELAYS, {
      kinds: [6],
      '#e': eventIds,
    })
    return events
  } catch (e) {
    console.error('Failed to fetch reposts:', e)
    return []
  }
}

export function closePool(): void {
  if (pool) {
    pool.close(RELAYS)
    pool = null
  }
}
