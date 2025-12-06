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
  const p = getPool()
  await Promise.allSettled(p.publish(RELAYS, event))
}

export async function fetchEvents(filter: Filter, limit = 50): Promise<Event[]> {
  const p = getPool()
  // Filter by #mypace tag to only show mypace posts
  const mypaceFilter: Filter = {
    ...filter,
    '#t': [MYPACE_TAG],
    limit,
  }
  const events = await p.querySync(RELAYS, mypaceFilter)
  return events.sort((a, b) => b.created_at - a.created_at)
}

// Fetch reposts (kind 6) that repost mypace posts
export async function fetchRepostEvents(limit = 50): Promise<Event[]> {
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    kinds: [6],
    limit,
  })
  return events.sort((a, b) => b.created_at - a.created_at)
}

export async function fetchUserProfile(pubkey: string): Promise<Event | null> {
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    kinds: [0],
    authors: [pubkey],
    limit: 1,
  })
  return events[0] || null
}

// Fetch a single event by ID
export async function fetchEventById(eventId: string): Promise<Event | null> {
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    ids: [eventId],
    limit: 1,
  })
  return events[0] || null
}

// Fetch reactions (kind 7) for given event IDs
export async function fetchReactions(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    kinds: [7],
    '#e': eventIds,
  })
  return events
}

// Fetch replies (kind 1 with e tag) for given event IDs
export async function fetchReplies(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    kinds: [1],
    '#e': eventIds,
    '#t': [MYPACE_TAG],
  })
  return events.sort((a, b) => a.created_at - b.created_at) // Oldest first for threads
}

// Fetch reposts (kind 6) for given event IDs
export async function fetchReposts(eventIds: string[]): Promise<Event[]> {
  if (eventIds.length === 0) return []
  const p = getPool()
  const events = await p.querySync(RELAYS, {
    kinds: [6],
    '#e': eventIds,
  })
  return events
}

export function closePool(): void {
  if (pool) {
    pool.close(RELAYS)
    pool = null
  }
}
