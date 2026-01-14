import { Hono } from 'hono'
import type { Event } from 'nostr-tools'
import type { Bindings } from '../types'
import type { D1Database } from '@cloudflare/workers-types'
import { publishToRelays } from '../services/relay'
import { cacheEvent } from '../services/cache'
import { registerUserSerial } from './serial'

const publish = new Hono<{ Bindings: Bindings }>()

// Record stella to D1
async function recordStella(
  db: D1Database,
  eventId: string,
  authorPubkey: string,
  reactorPubkey: string,
  stellaCount: number,
  reactionId: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_stella (event_id, author_pubkey, reactor_pubkey, stella_count, reaction_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, reactor_pubkey) DO UPDATE SET
         stella_count = excluded.stella_count,
         reaction_id = excluded.reaction_id,
         updated_at = excluded.updated_at`
    )
    .bind(eventId, authorPubkey, reactorPubkey, stellaCount, reactionId, Math.floor(Date.now() / 1000))
    .run()
}

// Delete stella records when reaction or post is deleted
async function deleteStella(db: D1Database, eventIds: string[], pubkey: string): Promise<void> {
  if (eventIds.length === 0) return

  const placeholders = eventIds.map(() => '?').join(',')

  // Delete if user is the reactor (deleting their reaction by reaction_id)
  await db
    .prepare(`DELETE FROM user_stella WHERE reaction_id IN (${placeholders}) AND reactor_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()

  // Delete if user is the author (deleting their post by event_id)
  await db
    .prepare(`DELETE FROM user_stella WHERE event_id IN (${placeholders}) AND author_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()
}

// POST /api/publish - 署名済みイベントをリレーに投稿
publish.post('/', async (c) => {
  const body = await c.req.json<{ event: Event }>()
  const event = body.event

  if (!event || !event.id || !event.sig) {
    return c.json({ error: 'Invalid event: missing id or sig' }, 400)
  }

  try {
    const result = await publishToRelays(event)

    // Log all results for debugging
    console.log('Publish results:', JSON.stringify(result.details))

    if (!result.success) {
      const failedRelays = result.details.filter((r) => !r.success)
      console.error('All relays rejected:', failedRelays)
      return c.json({ error: 'All relays rejected the event', details: failedRelays }, 500)
    }

    // キャッシュにも保存
    const db = c.env.DB
    try {
      await cacheEvent(db, event)
    } catch (e) {
      console.error('Cache write error:', e)
    }

    const tags = event.tags || []

    // #mypaceタグ付きのkind:1投稿なら通し番号を登録
    if (event.kind === 1) {
      const hasMypaceTag = tags.some((tag: string[]) => tag[0] === 't' && tag[1]?.toLowerCase() === 'mypace')
      if (hasMypaceTag) {
        try {
          await registerUserSerial(db, event.pubkey, event.id, event.created_at)
        } catch (e) {
          console.error('Serial register error:', e)
        }
      }
    }

    // Kind 7 (リアクション) + stellaタグならD1に記録
    if (event.kind === 7) {
      const stellaTag = tags.find((t: string[]) => t[0] === 'stella')
      if (stellaTag && stellaTag[1]) {
        const eTag = tags.find((t: string[]) => t[0] === 'e')
        const pTag = tags.find((t: string[]) => t[0] === 'p')
        if (eTag && eTag[1] && pTag && pTag[1]) {
          try {
            const stellaCount = parseInt(stellaTag[1], 10)
            if (!isNaN(stellaCount) && stellaCount >= 1 && stellaCount <= 10) {
              await recordStella(db, eTag[1], pTag[1], event.pubkey, stellaCount, event.id)
            }
          } catch (e) {
            console.error('Stella record error:', e)
          }
        }
      }
    }

    // Kind 5 (削除) なら関連するステラ記録を削除
    if (event.kind === 5) {
      const eventIds = tags.filter((t: string[]) => t[0] === 'e').map((t: string[]) => t[1])
      if (eventIds.length > 0) {
        try {
          await deleteStella(db, eventIds, event.pubkey)
        } catch (e) {
          console.error('Stella delete error:', e)
        }
      }
    }

    return c.json({
      success: true,
      id: event.id,
      relays: {
        total: result.details.length,
        success: result.successCount,
        details: result.details,
      },
    })
  } catch (e) {
    console.error('Publish error:', e)
    return c.json({ error: `Failed to publish: ${e instanceof Error ? e.message : 'Unknown error'}` }, 500)
  }
})

export default publish
