import { Hono } from 'hono'
import type { Bindings } from '../types'
import { RELAYS } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const replies = new Hono<{ Bindings: Bindings }>()

// GET /api/replies/:eventId - 返信取得
replies.get('/:eventId', async (c) => {
  const eventId = c.req.param('eventId')

  const pool = new SimplePool()

  try {
    // Kind 1 (short notes) + Kind 30023 (long articles) as replies
    const events = await pool.querySync(RELAYS, { kinds: [1, 30023], '#e': [eventId] })
    // ルートへの返信のみフィルタ
    const replyList = events.filter((e) => {
      const eTags = e.tags.filter((t) => t[0] === 'e')
      if (eTags.length === 0) return false
      const rootTag = eTags.find((t) => t[3] === 'root') || eTags[0]
      return rootTag[1] === eventId
    })

    // 古い順にソート（ツリー表示用）
    replyList.sort((a, b) => a.created_at - b.created_at)

    return c.json({ count: replyList.length, replies: replyList })
  } finally {
    pool.close(RELAYS)
  }
})

export default replies
