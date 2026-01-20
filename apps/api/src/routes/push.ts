import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getCurrentTimestamp } from '../utils'

const push = new Hono<{ Bindings: Bindings }>()

interface SubscribeRequest {
  pubkey: string
  subscription: {
    endpoint: string
    keys: {
      auth: string
      p256dh: string
    }
  }
  preference?: 'all' | 'replies_only'
}

interface PreferenceRequest {
  pubkey: string
  endpoint: string
  preference: 'all' | 'replies_only'
}

interface UnsubscribeRequest {
  pubkey: string
  endpoint: string
}

// GET /api/push/vapid-public-key - Get VAPID public key for client
push.get('/vapid-public-key', (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY

  if (!publicKey) {
    return c.json({ error: 'VAPID not configured' }, 500)
  }

  return c.json({ publicKey })
})

// POST /api/push/subscribe - Register push subscription
push.post('/subscribe', async (c) => {
  const body = await c.req.json<SubscribeRequest>()

  if (
    !body.pubkey ||
    !body.subscription?.endpoint ||
    !body.subscription?.keys?.auth ||
    !body.subscription?.keys?.p256dh
  ) {
    return c.json({ error: 'Invalid subscription data' }, 400)
  }

  const now = getCurrentTimestamp()
  const preference = body.preference || 'all'

  // Upsert: if endpoint exists, update; otherwise insert
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (pubkey, endpoint, auth, p256dh, preference, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       pubkey = excluded.pubkey,
       auth = excluded.auth,
       p256dh = excluded.p256dh,
       preference = excluded.preference,
       updated_at = excluded.updated_at`
  )
    .bind(
      body.pubkey,
      body.subscription.endpoint,
      body.subscription.keys.auth,
      body.subscription.keys.p256dh,
      preference,
      now,
      now
    )
    .run()

  return c.json({ success: true })
})

// DELETE /api/push/unsubscribe - Unregister push subscription
push.delete('/unsubscribe', async (c) => {
  const body = await c.req.json<UnsubscribeRequest>()

  if (!body.pubkey || !body.endpoint) {
    return c.json({ error: 'pubkey and endpoint are required' }, 400)
  }

  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE pubkey = ? AND endpoint = ?`)
    .bind(body.pubkey, body.endpoint)
    .run()

  return c.json({ success: true })
})

// PUT /api/push/preference - Update notification preference
push.put('/preference', async (c) => {
  const body = await c.req.json<PreferenceRequest>()

  if (!body.pubkey || !body.endpoint || !body.preference) {
    return c.json({ error: 'pubkey, endpoint, and preference are required' }, 400)
  }

  if (body.preference !== 'all' && body.preference !== 'replies_only') {
    return c.json({ error: 'preference must be "all" or "replies_only"' }, 400)
  }

  const now = getCurrentTimestamp()

  await c.env.DB.prepare(
    `UPDATE push_subscriptions SET preference = ?, updated_at = ? WHERE pubkey = ? AND endpoint = ?`
  )
    .bind(body.preference, now, body.pubkey, body.endpoint)
    .run()

  return c.json({ success: true })
})

// GET /api/push/status?pubkey=xxx&endpoint=xxx - Check subscription status
push.get('/status', async (c) => {
  const pubkey = c.req.query('pubkey')
  const endpoint = c.req.query('endpoint')

  if (!pubkey) {
    return c.json({ error: 'pubkey is required' }, 400)
  }

  // If endpoint is provided, check specific subscription
  if (endpoint) {
    const row = await c.env.DB.prepare(`SELECT preference FROM push_subscriptions WHERE pubkey = ? AND endpoint = ?`)
      .bind(pubkey, endpoint)
      .first<{ preference: string }>()

    if (!row) {
      return c.json({ subscribed: false })
    }

    return c.json({ subscribed: true, preference: row.preference })
  }

  // Otherwise, check if user has any subscription
  const row = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM push_subscriptions WHERE pubkey = ?`)
    .bind(pubkey)
    .first<{ count: number }>()

  return c.json({ subscribed: (row?.count ?? 0) > 0 })
})

export default push
