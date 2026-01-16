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

// POST /api/events/metadata - 複数イベントのメタデータ一括取得
events.post('/metadata', async (c) => {
  const { eventIds, pubkey } = await c.req.json<{ eventIds: string[]; pubkey?: string }>()

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return c.json({ error: 'eventIds array is required' }, 400)
  }

  // Limit batch size
  const limitedIds = eventIds.slice(0, 100)
  const db = c.env.DB
  const pool = new SimplePool()

  try {
    // 並列でNostrクエリとD1クエリを実行
    const [reactionEvents, replyEvents, repostEvents, viewRows] = await Promise.all([
      // reactions (kind 7)
      pool.querySync(RELAYS, { kinds: [7], '#e': limitedIds }),
      // replies (kind 1, 30023, 42000)
      pool.querySync(RELAYS, { kinds: [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC], '#e': limitedIds }),
      // reposts (kind 6)
      pool.querySync(RELAYS, { kinds: [6], '#e': limitedIds }),
      // views from D1
      (async () => {
        const placeholders = limitedIds.map(() => '?').join(',')
        return db
          .prepare(
            `SELECT event_id, view_type, COUNT(*) as count FROM event_views WHERE event_id IN (${placeholders}) GROUP BY event_id, view_type`
          )
          .bind(...limitedIds)
          .all()
      })(),
    ])

    // 結果を構築
    const result: Record<
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
      result[id] = {
        reactions: { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] },
        replies: { count: 0, replies: [] },
        reposts: { count: 0, myRepost: false },
        views: { detail: 0, impression: 0 },
      }
    }

    // Reactions処理: 各イベントごとにグループ化し、ユーザーごとに最新のみ保持
    const reactionsByEvent = new Map<
      string,
      Map<string, { pubkey: string; stella: number; reactionId: string; createdAt: number }>
    >()
    for (const e of reactionEvents) {
      const targetEventId = e.tags.find((t) => t[0] === 'e')?.[1]
      if (!targetEventId || !result[targetEventId]) continue

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
      if (pubkey) {
        const myReaction = reactorMap.get(pubkey)
        if (myReaction) {
          myStella = myReaction.stella
          myReactionId = myReaction.reactionId
        }
      }
      result[eventId].reactions = { count, myReaction: myStella > 0, myStella, myReactionId, reactors }
    }

    // Replies処理: rootへの返信のみフィルタ
    for (const e of replyEvents) {
      const eTags = e.tags.filter((t) => t[0] === 'e')
      if (eTags.length === 0) continue
      const rootTag = eTags.find((t) => t[3] === 'root') || eTags[0]
      const targetEventId = rootTag[1]
      if (!result[targetEventId]) continue
      result[targetEventId].replies.replies.push(e)
    }
    // 各イベントのリプライをソートしてカウント設定
    for (const id of limitedIds) {
      result[id].replies.replies.sort((a, b) => a.created_at - b.created_at)
      result[id].replies.count = result[id].replies.replies.length
    }

    // Reposts処理
    for (const e of repostEvents) {
      const targetEventId = e.tags.find((t) => t[0] === 'e')?.[1]
      if (!targetEventId || !result[targetEventId]) continue
      result[targetEventId].reposts.count++
      if (pubkey && e.pubkey === pubkey) {
        result[targetEventId].reposts.myRepost = true
      }
    }

    // Views処理
    for (const row of viewRows.results) {
      const eventId = row.event_id as string
      const viewType = row.view_type as 'impression' | 'detail'
      if (result[eventId]) {
        result[eventId].views[viewType] = row.count as number
      }
    }

    return c.json(result)
  } finally {
    pool.close(RELAYS)
  }
})

export default events
