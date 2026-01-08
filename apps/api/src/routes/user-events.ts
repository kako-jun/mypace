import { Hono } from 'hono'
import type { Filter, Event } from 'nostr-tools'
import type { Bindings } from '../types'
import { RELAYS, MYPACE_TAG, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const userEvents = new Hono<{ Bindings: Bindings }>()

// コンテンツ検索フィルタ（AND検索）
function filterByQuery(events: Event[], queries: string[]): Event[] {
  if (!queries || queries.length === 0) return events
  return events.filter((e) => {
    const contentLower = e.content.toLowerCase()
    const queriesLower = queries.map((q) => q.toLowerCase())
    return queriesLower.every((query) => contentLower.includes(query))
  })
}

// GET /api/user/:pubkey/events - ユーザーの投稿取得
userEvents.get('/:pubkey/events', async (c) => {
  const pubkey = c.req.param('pubkey')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  // Optional tags filter (+ separated)
  const tagsParam = c.req.query('tags') || ''
  const filterTags = tagsParam ? tagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Optional text search query (+ separated for AND search, Google-style)
  const queryParam = c.req.query('q') || ''
  const queries = queryParam ? queryParam.split('+').map(decodeURIComponent).filter(Boolean) : []

  const pool = new SimplePool()

  try {
    // Build tag filter: mypace + optional additional tags
    const tagFilter = [MYPACE_TAG, ...filterTags]

    const filter: Filter = {
      kinds: [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC],
      authors: [pubkey],
      '#t': tagFilter,
      limit: queries.length > 0 ? limit * 2 : limit, // Get more if we need to filter by query
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
    if (queries.length > 0) {
      events = filterByQuery(events, queries)
      events = events.slice(0, limit)
    }

    return c.json({ events })
  } finally {
    pool.close(RELAYS)
  }
})

export default userEvents
