import { Hono } from 'hono'
import type { Filter } from 'nostr-tools'
import type { Bindings } from '../types'
import { RELAYS, MYPACE_TAG } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const userEvents = new Hono<{ Bindings: Bindings }>()

// GET /api/user/:pubkey/events - ユーザーの投稿取得
userEvents.get('/:pubkey/events', async (c) => {
  const pubkey = c.req.param('pubkey')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0

  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds: [1, 30023], // Kind 1 (short notes) + Kind 30023 (long articles)
      authors: [pubkey],
      '#t': [MYPACE_TAG],
      limit,
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }

    const events = await pool.querySync(RELAYS, filter)
    events.sort((a, b) => b.created_at - a.created_at)

    return c.json({ events })
  } finally {
    pool.close(RELAYS)
  }
})

export default userEvents
