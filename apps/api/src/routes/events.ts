import { Hono } from 'hono'
import type { Event } from 'nostr-tools'
import type { Bindings } from '../types'
import { RELAYS, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC, STELLA_TAG } from '../constants'
import { getCachedEventsByIds, cacheEvents } from '../services/cache'
import { SimplePool } from 'nostr-tools/pool'

// Helper: Get stella count from reaction event tags
function getStellaCount(event: Event): number {
  const stellaTag = event.tags.find((t) => t[0] === STELLA_TAG)
  if (stellaTag && stellaTag[1]) {
    const count = parseInt(stellaTag[1], 10)
    return isNaN(count) ? 1 : count
  }
  return 1
}

const events = new Hono<{ Bindings: Bindings }>()

// POST /api/events/batch - 複数イベント一括取得
events.post('/batch', async (c) => {
  const { eventIds } = await c.req.json<{ eventIds: string[] }>()

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return c.json({ error: 'eventIds array is required' }, 400)
  }

  // Limit batch size to prevent abuse
  const limitedIds = eventIds.slice(0, 100)
  const db = c.env.DB
  const result: Record<string, unknown> = {}

  // キャッシュから取得
  try {
    const cached = await getCachedEventsByIds(db, limitedIds)
    for (const [id, event] of cached) {
      result[id] = event
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // キャッシュにないIDをリレーから取得
  const missingIds = limitedIds.filter((id) => !result[id])
  if (missingIds.length > 0) {
    const pool = new SimplePool()
    try {
      const relayEvents = await pool.querySync(RELAYS, { ids: missingIds })
      for (const event of relayEvents) {
        result[event.id] = event
      }
      // キャッシュに保存
      if (relayEvents.length > 0) {
        try {
          await cacheEvents(db, relayEvents)
        } catch (e) {
          console.error('Cache write error:', e)
        }
      }
    } finally {
      pool.close(RELAYS)
    }
  }

  return c.json(result)
})

// POST /api/events/enrich - メタデータ+プロフィール+super-mention一括取得
events.post('/enrich', async (c) => {
  const {
    eventIds = [],
    authorPubkeys = [],
    viewerPubkey,
    superMentionPaths = [],
  } = await c.req.json<{
    eventIds?: string[]
    authorPubkeys?: string[]
    viewerPubkey?: string
    superMentionPaths?: string[]
  }>()

  // eventIds can be empty if only fetching profiles
  if (!Array.isArray(eventIds)) {
    return c.json({ error: 'eventIds must be an array' }, 400)
  }

  // Limit batch sizes
  const limitedIds = eventIds.slice(0, 100)
  const limitedPaths = superMentionPaths.slice(0, 200)
  const db = c.env.DB
  const pool = new SimplePool()

  try {
    // If no eventIds, skip metadata fetching and only fetch profiles
    if (limitedIds.length === 0) {
      const superMentionRows =
        limitedPaths.length > 0
          ? await db
              .prepare(
                `SELECT path, wikidata_id FROM super_mention_paths WHERE path IN (${limitedPaths.map(() => '?').join(',')}) AND wikidata_id IS NOT NULL`
              )
              .bind(...limitedPaths)
              .all()
          : { results: [] }

      const superMentions: Record<string, string> = {}
      for (const row of superMentionRows.results || []) {
        if (row.path && row.wikidata_id) {
          superMentions[row.path as string] = row.wikidata_id as string
        }
      }

      const profiles = await fetchProfilesInternal(db, pool, authorPubkeys)
      pool.close(RELAYS)
      return c.json({ metadata: {}, profiles, superMentions })
    }

    // 並列でNostrクエリとD1クエリを実行
    const [reactionEvents, replyEvents, repostEvents, viewRows, superMentionRows] = await Promise.all([
      // reactions (kind 7)
      pool.querySync(RELAYS, { kinds: [7], '#e': limitedIds }),
      // replies (kind 1, 30023, 42000)
      pool.querySync(RELAYS, { kinds: [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC], '#e': limitedIds }),
      // reposts (kind 6)
      pool.querySync(RELAYS, { kinds: [6], '#e': limitedIds }),
      // views from D1
      db
        .prepare(
          `SELECT event_id, view_type, COUNT(*) as count FROM event_views WHERE event_id IN (${limitedIds.map(() => '?').join(',')}) GROUP BY event_id, view_type`
        )
        .bind(...limitedIds)
        .all(),
      // super-mention lookup from D1
      (async () => {
        if (limitedPaths.length === 0) return { results: [] }
        const placeholders = limitedPaths.map(() => '?').join(',')
        return db
          .prepare(
            `SELECT path, wikidata_id FROM super_mention_paths WHERE path IN (${placeholders}) AND wikidata_id IS NOT NULL`
          )
          .bind(...limitedPaths)
          .all()
      })(),
    ])

    // メタデータ結果を構築
    const metadata: Record<
      string,
      {
        reactions: {
          count: number
          myReaction: boolean
          myStella: number
          myReactionId: string | null
          reactors: Array<{ pubkey: string; stella: number; reactionId: string; createdAt: number }>
        }
        replies: { count: number; replies: Event[] }
        reposts: { count: number; myRepost: boolean }
        views: { detail: number; impression: number }
      }
    > = {}

    // 初期化
    for (const id of limitedIds) {
      metadata[id] = {
        reactions: { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] },
        replies: { count: 0, replies: [] },
        reposts: { count: 0, myRepost: false },
        views: { detail: 0, impression: 0 },
      }
    }

    // プロフィール用のpubkey収集
    const allPubkeys = new Set<string>(authorPubkeys)

    // Reactions処理: 各イベントごとにグループ化し、ユーザーごとに最新のみ保持
    const reactionsByEvent = new Map<
      string,
      Map<string, { pubkey: string; stella: number; reactionId: string; createdAt: number }>
    >()
    for (const e of reactionEvents) {
      const targetEventId = e.tags.find((t) => t[0] === 'e')?.[1]
      if (!targetEventId || !metadata[targetEventId]) continue

      allPubkeys.add(e.pubkey) // reactor pubkey収集

      if (!reactionsByEvent.has(targetEventId)) {
        reactionsByEvent.set(targetEventId, new Map())
      }
      const reactorMap = reactionsByEvent.get(targetEventId)!
      const existing = reactorMap.get(e.pubkey)
      if (!existing || e.created_at > existing.createdAt) {
        reactorMap.set(e.pubkey, {
          pubkey: e.pubkey,
          stella: getStellaCount(e),
          reactionId: e.id,
          createdAt: e.created_at,
        })
      }
    }

    for (const [eventId, reactorMap] of reactionsByEvent) {
      const reactors = Array.from(reactorMap.values()).sort((a, b) => b.createdAt - a.createdAt)
      const count = reactors.reduce((sum, r) => sum + r.stella, 0)
      let myStella = 0
      let myReactionId: string | null = null
      if (viewerPubkey) {
        const myReaction = reactorMap.get(viewerPubkey)
        if (myReaction) {
          myStella = myReaction.stella
          myReactionId = myReaction.reactionId
        }
      }
      metadata[eventId].reactions = { count, myReaction: myStella > 0, myStella, myReactionId, reactors }
    }

    // Replies処理: rootへの返信のみフィルタ
    for (const e of replyEvents) {
      const eTags = e.tags.filter((t) => t[0] === 'e')
      if (eTags.length === 0) continue
      const rootTag = eTags.find((t) => t[3] === 'root') || eTags[0]
      const targetEventId = rootTag[1]
      if (!metadata[targetEventId]) continue
      metadata[targetEventId].replies.replies.push(e)
      allPubkeys.add(e.pubkey) // reply author pubkey収集
    }
    // 各イベントのリプライをソートしてカウント設定
    for (const id of limitedIds) {
      metadata[id].replies.replies.sort((a, b) => a.created_at - b.created_at)
      metadata[id].replies.count = metadata[id].replies.replies.length
    }

    // Reposts処理
    for (const e of repostEvents) {
      const targetEventId = e.tags.find((t) => t[0] === 'e')?.[1]
      if (!targetEventId || !metadata[targetEventId]) continue
      metadata[targetEventId].reposts.count++
      if (viewerPubkey && e.pubkey === viewerPubkey) {
        metadata[targetEventId].reposts.myRepost = true
      }
    }

    // Views処理
    for (const row of viewRows.results) {
      const eventId = row.event_id as string
      const viewType = row.view_type as 'impression' | 'detail'
      if (metadata[eventId]) {
        metadata[eventId].views[viewType] = row.count as number
      }
    }

    // Super-mention mapping構築
    const superMentions: Record<string, string> = {}
    for (const row of superMentionRows.results || []) {
      if (row.path && row.wikidata_id) {
        superMentions[row.path as string] = row.wikidata_id as string
      }
    }

    // プロフィール取得
    const profiles = await fetchProfilesInternal(db, pool, Array.from(allPubkeys))

    return c.json({ metadata, profiles, superMentions })
  } finally {
    pool.close(RELAYS)
  }
})

// 内部用: プロフィール一括取得（既存のprofilesテーブルを使用）
async function fetchProfilesInternal(
  db: D1Database,
  pool: SimplePool,
  pubkeys: string[]
): Promise<
  Record<
    string,
    {
      name?: string
      display_name?: string
      picture?: string
      about?: string
      nip05?: string
      emojis?: Array<{ shortcode: string; url: string }>
    }
  >
> {
  if (pubkeys.length === 0) return {}

  const result: Record<
    string,
    {
      name?: string
      display_name?: string
      picture?: string
      about?: string
      nip05?: string
      emojis?: Array<{ shortcode: string; url: string }>
    }
  > = {}
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
  const cacheThreshold = Date.now() - CACHE_TTL_MS

  // キャッシュから取得
  try {
    const placeholders = pubkeys.map(() => '?').join(',')
    const cached = await db
      .prepare(
        `SELECT pubkey, name, display_name, picture, about, nip05, emojis FROM profiles WHERE pubkey IN (${placeholders}) AND cached_at > ?`
      )
      .bind(...pubkeys, cacheThreshold)
      .all()

    for (const row of cached.results || []) {
      const pk = row.pubkey as string
      result[pk] = {
        name: row.name as string | undefined,
        display_name: row.display_name as string | undefined,
        picture: row.picture as string | undefined,
        about: row.about as string | undefined,
        nip05: row.nip05 as string | undefined,
        emojis: row.emojis ? JSON.parse(row.emojis as string) : undefined,
      }
    }
  } catch (e) {
    console.error('Profile cache read error:', e)
  }

  // キャッシュにないものをリレーから取得
  const cachedPubkeys = Object.keys(result)
  const missingPubkeys = pubkeys.filter((pk) => !cachedPubkeys.includes(pk))

  if (missingPubkeys.length > 0) {
    try {
      const events = await pool.querySync(RELAYS, { kinds: [0], authors: missingPubkeys })

      // Group by pubkey and keep only the most recent event
      const latestEvents = new Map<string, (typeof events)[0]>()
      for (const event of events) {
        const existing = latestEvents.get(event.pubkey)
        if (!existing || event.created_at > existing.created_at) {
          latestEvents.set(event.pubkey, event)
        }
      }

      const now = Date.now()

      for (const event of latestEvents.values()) {
        try {
          const profile = JSON.parse(event.content)
          const emojis = event.tags
            .filter((t: string[]) => t[0] === 'emoji' && t[1] && t[2])
            .map((t: string[]) => ({ shortcode: t[1], url: t[2] }))
          result[event.pubkey] = { ...profile, emojis }

          // キャッシュに保存
          await db
            .prepare(
              `INSERT OR REPLACE INTO profiles (pubkey, name, display_name, picture, about, nip05, emojis, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              event.pubkey,
              profile.name || null,
              profile.display_name || null,
              profile.picture || null,
              profile.about || null,
              profile.nip05 || null,
              emojis.length > 0 ? JSON.stringify(emojis) : null,
              now
            )
            .run()
        } catch (e) {
          console.error('Profile parse error:', e)
        }
      }
    } catch (e) {
      console.error('Profile fetch error:', e)
    }
  }

  return result
}

export default events
