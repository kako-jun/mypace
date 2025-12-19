import { Hono } from 'hono'
import type { Bindings } from '../types'
import { RELAYS } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const reposts = new Hono<{ Bindings: Bindings }>()

// GET /api/reposts/:eventId - リポスト取得
reposts.get('/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { kinds: [6], '#e': [eventId] })
    const count = events.length
    const myRepost = pubkey ? events.some((e) => e.pubkey === pubkey) : false

    return c.json({ count, myRepost })
  } finally {
    pool.close(RELAYS)
  }
})

export default reposts
