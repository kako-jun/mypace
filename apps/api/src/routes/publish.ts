import { Hono } from 'hono'
import type { Event } from 'nostr-tools'
import type { Bindings } from '../types'
import { publishToRelays } from '../services/relay'
import { cacheEvent } from '../services/cache'

const publish = new Hono<{ Bindings: Bindings }>()

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
