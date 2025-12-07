import type { D1Database } from '@cloudflare/workers-types'
import type { Event } from 'nostr-tools'
import { unixNow } from '../utils'

const CACHE_TTL = 60 * 5 // 5 minutes

export async function getCachedEvents(
  db: D1Database,
  kind: number,
  limit: number
): Promise<Event[] | null> {
  const cutoff = unixNow() - CACHE_TTL

  const result = await db
    .prepare(
      `SELECT raw_json FROM events
       WHERE kind = ? AND cached_at > ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(kind, cutoff, limit)
    .all()

  if (!result.results || result.results.length === 0) {
    return null
  }

  return result.results.map((row) => JSON.parse(row.raw_json as string))
}

export async function cacheEvents(db: D1Database, events: Event[]): Promise<void> {
  const now = unixNow()

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO events
     (id, pubkey, kind, content, created_at, sig, raw_json, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const batch = events.map((event) =>
    stmt.bind(
      event.id,
      event.pubkey,
      event.kind,
      event.content,
      event.created_at,
      event.sig,
      JSON.stringify(event),
      now
    )
  )

  await db.batch(batch)
}

export async function getCachedProfile(
  db: D1Database,
  pubkey: string
): Promise<Record<string, unknown> | null> {
  const cutoff = unixNow() - CACHE_TTL * 12 // 1 hour for profiles

  const result = await db
    .prepare(
      `SELECT raw_json FROM profiles WHERE pubkey = ? AND cached_at > ?`
    )
    .bind(pubkey, cutoff)
    .first()

  if (!result) return null
  return JSON.parse(result.raw_json as string)
}

export async function cacheProfile(
  db: D1Database,
  pubkey: string,
  profile: Record<string, unknown>
): Promise<void> {
  const now = unixNow()

  await db
    .prepare(
      `INSERT OR REPLACE INTO profiles
       (pubkey, name, display_name, picture, about, nip05, raw_json, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pubkey,
      profile.name || null,
      profile.display_name || null,
      profile.picture || null,
      profile.about || null,
      profile.nip05 || null,
      JSON.stringify(profile),
      now
    )
    .run()
}
