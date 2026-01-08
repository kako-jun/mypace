import { Hono } from 'hono'
import type { Filter, Event } from 'nostr-tools'
import type { Bindings } from '../types'
import { RELAYS, MYPACE_TAG, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const userEvents = new Hono<{ Bindings: Bindings }>()

// コンテンツ検索フィルタ
function filterByQuery(events: Event[], query: string): Event[] {
  if (!query) return events
  const queryLower = query.toLowerCase()
  return events.filter((e) => e.content.toLowerCase().includes(queryLower))
}

// GET /api/user/:pubkey/events - ユーザーの投稿取得
userEvents.get('/:pubkey/events', async (c) => {
  const pubkey = c.req.param('pubkey')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  // Optional tags filter (comma-separated)
  const tagsParam = c.req.query('tags') || ''
  const filterTags = tagsParam ? tagsParam.split(',').filter(Boolean) : []
  // Optional text search query
  const query = c.req.query('q') || ''

  const pool = new SimplePool()

  try {
    // Build tag filter: mypace + optional additional tags
    const tagFilter = [MYPACE_TAG, ...filterTags]

    const filter: Filter = {
      kinds: [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC],
      authors: [pubkey],
      '#t': tagFilter,
      limit: query ? limit * 2 : limit, // Get more if we need to filter by query
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }

    let events = await pool.querySync(RELAYS, filter)
    events.sort((a, b) => b.created_at - a.created_at)

    // Apply text search filter
    if (query) {
      events = filterByQuery(events, query)
      events = events.slice(0, limit)
    }

    return c.json({ events })
  } finally {
    pool.close(RELAYS)
  }
})

export default userEvents
