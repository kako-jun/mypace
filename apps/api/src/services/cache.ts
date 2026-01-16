import type { D1Database } from '@cloudflare/workers-types'
import type { Event } from 'nostr-tools'
import { CACHE_TTL_MS, CACHE_CLEANUP_AGE_MS, MYPACE_TAG } from '../constants'
import type { CachedEvent, CachedProfile } from '../types'

// イベントがmypaceタグを持つかチェック
function hasMypaceTag(event: Event): boolean {
  return event.tags.some((t) => t[0] === 't' && t[1] === MYPACE_TAG)
}

// キャッシュからイベントを取得
export async function getCachedEvents(
  db: D1Database,
  options: {
    kinds: number[]
    since?: number
    until?: number
    limit: number
    mypaceOnly?: boolean
  }
): Promise<CachedEvent[]> {
  const cacheThreshold = Date.now() - CACHE_TTL_MS
  const kindPlaceholders = options.kinds.map(() => '?').join(',')

  let query = `
    SELECT id, pubkey, created_at, kind, tags, content, sig
    FROM events
    WHERE kind IN (${kindPlaceholders}) AND created_at > ? AND cached_at > ?
  `
  const params: (number | string)[] = [...options.kinds, options.since || 0, cacheThreshold]

  // mypaceOnlyの場合はhas_mypace_tag=1でフィルタ
  if (options.mypaceOnly) {
    query += ` AND has_mypace_tag = 1`
  }

  if (options.until && options.until > 0) {
    query += ` AND created_at < ?`
    params.push(options.until)
  }

  query += ` ORDER BY created_at DESC LIMIT ?`
  params.push(options.limit)

  const cached = await db
    .prepare(query)
    .bind(...params)
    .all()

  return cached.results.map((row) => ({
    id: row.id as string,
    pubkey: row.pubkey as string,
    created_at: row.created_at as number,
    kind: row.kind as number,
    tags: JSON.parse(row.tags as string) as string[][],
    content: row.content as string,
    sig: row.sig as string,
  }))
}

// イベントをキャッシュに保存
export async function cacheEvents(db: D1Database, events: Event[]): Promise<void> {
  const now = Date.now()
  for (const event of events) {
    try {
      const hasMypace = hasMypaceTag(event) ? 1 : 0
      await db
        .prepare(
          `
        INSERT OR REPLACE INTO events (id, pubkey, created_at, kind, tags, content, sig, cached_at, has_mypace_tag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig,
          now,
          hasMypace
        )
        .run()
    } catch (e) {
      console.error('Cache write error:', e)
    }
  }
}

// 単一イベントをキャッシュに保存
export async function cacheEvent(db: D1Database, event: Event): Promise<void> {
  // kind 5 (delete) イベントの場合、参照されているイベントをキャッシュから削除
  if (event.kind === 5) {
    const eventIdsToDelete = event.tags.filter((t) => t[0] === 'e').map((t) => t[1])
    if (eventIdsToDelete.length > 0) {
      await deleteEventsFromCache(db, eventIdsToDelete)
    }
    return // 削除イベント自体はキャッシュしない
  }
  await cacheEvents(db, [event])
}

// イベントをキャッシュから削除
export async function deleteEventsFromCache(db: D1Database, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return
  const placeholders = eventIds.map(() => '?').join(',')
  try {
    await db
      .prepare(`DELETE FROM events WHERE id IN (${placeholders})`)
      .bind(...eventIds)
      .run()
  } catch (e) {
    console.error('Cache delete error:', e)
  }
}

// 全キャッシュを一括クリーンアップ（events, profiles, ogp_cache）
export async function cleanupAllCaches(db: D1Database): Promise<void> {
  const threshold = Date.now() - CACHE_CLEANUP_AGE_MS
  const nowSeconds = Math.floor(Date.now() / 1000)

  try {
    await Promise.all([
      // events: cached_atベース
      db.prepare('DELETE FROM events WHERE cached_at < ?').bind(threshold).run(),
      // profiles: cached_atベース
      db.prepare('DELETE FROM profiles WHERE cached_at < ?').bind(threshold).run(),
      // ogp_cache: expires_atベース（秒単位）
      db.prepare('DELETE FROM ogp_cache WHERE expires_at < ?').bind(nowSeconds).run(),
    ])
  } catch (e) {
    console.error('Cache cleanup error:', e)
  }
}

// IDでイベントを取得
export async function getCachedEventById(db: D1Database, id: string): Promise<CachedEvent | null> {
  const cached = await db.prepare(`SELECT * FROM events WHERE id = ?`).bind(id).first()
  if (!cached) return null

  return {
    id: cached.id as string,
    pubkey: cached.pubkey as string,
    created_at: cached.created_at as number,
    kind: cached.kind as number,
    tags: JSON.parse(cached.tags as string) as string[][],
    content: cached.content as string,
    sig: cached.sig as string,
  }
}

// 複数IDでイベントを一括取得
export async function getCachedEventsByIds(db: D1Database, ids: string[]): Promise<Map<string, CachedEvent>> {
  if (ids.length === 0) return new Map()

  const placeholders = ids.map(() => '?').join(',')
  const cached = await db
    .prepare(`SELECT id, pubkey, created_at, kind, tags, content, sig FROM events WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all()

  const result = new Map<string, CachedEvent>()
  for (const row of cached.results) {
    result.set(row.id as string, {
      id: row.id as string,
      pubkey: row.pubkey as string,
      created_at: row.created_at as number,
      kind: row.kind as number,
      tags: JSON.parse(row.tags as string) as string[][],
      content: row.content as string,
      sig: row.sig as string,
    })
  }
  return result
}

// キャッシュからプロフィールを取得
export async function getCachedProfiles(db: D1Database, pubkeys: string[]): Promise<Map<string, CachedProfile>> {
  const cacheThreshold = Date.now() - CACHE_TTL_MS
  const placeholders = pubkeys.map(() => '?').join(',')

  const cached = await db
    .prepare(
      `
    SELECT pubkey, name, display_name, picture, about, nip05, banner, website, websites, lud16, emojis
    FROM profiles WHERE pubkey IN (${placeholders}) AND cached_at > ?
  `
    )
    .bind(...pubkeys, cacheThreshold)
    .all()

  const profiles = new Map<string, CachedProfile>()
  for (const row of cached.results) {
    profiles.set(row.pubkey as string, {
      pubkey: row.pubkey as string,
      name: row.name as string | undefined,
      display_name: row.display_name as string | undefined,
      picture: row.picture as string | undefined,
      about: row.about as string | undefined,
      nip05: row.nip05 as string | undefined,
      banner: row.banner as string | undefined,
      website: row.website as string | undefined,
      websites: row.websites ? JSON.parse(row.websites as string) : undefined,
      lud16: row.lud16 as string | undefined,
      emojis: row.emojis ? JSON.parse(row.emojis as string) : [],
    })
  }

  return profiles
}

// プロフィールをキャッシュに保存
export async function cacheProfile(
  db: D1Database,
  pubkey: string,
  profile: Record<string, unknown>,
  emojis: Array<{ shortcode: string; url: string }>
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `
    INSERT OR REPLACE INTO profiles (pubkey, name, display_name, picture, about, nip05, banner, website, websites, lud16, emojis, cached_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      pubkey,
      profile.name as string | null,
      profile.display_name as string | null,
      profile.picture as string | null,
      profile.about as string | null,
      profile.nip05 as string | null,
      profile.banner as string | null,
      profile.website as string | null,
      profile.websites ? JSON.stringify(profile.websites) : null,
      profile.lud16 as string | null,
      JSON.stringify(emojis),
      now
    )
    .run()
}
