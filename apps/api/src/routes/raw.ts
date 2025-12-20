import { Hono } from 'hono'
import type { Bindings } from '../types'
import { RELAYS } from '../constants'
import { getCachedEventById } from '../services/cache'
import { SimplePool } from 'nostr-tools/pool'

const raw = new Hono<{ Bindings: Bindings }>()

// teaserタグの内容を取得
function getTeaserContent(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'teaser')?.[1]
}

// READ MOREリンクを削除
function removeReadMoreLink(content: string): string {
  return content.replace(/\n\n\.\.\.READ MORE → https?:\/\/[^\s]+$/i, '')
}

// 完全なコンテンツを取得（teaser展開）
function getFullContent(content: string, tags: string[][]): string {
  const teaserContent = getTeaserContent(tags)
  if (!teaserContent) {
    return content
  }
  return removeReadMoreLink(content) + teaserContent
}

// GET /raw/:id - イベント本文をプレーンテキストで取得
raw.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  // キャッシュから
  try {
    const cached = await getCachedEventById(db, id)
    if (cached) {
      const fullContent = getFullContent(cached.content, cached.tags || [])
      return c.text(fullContent, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // リレーから
  const pool = new SimplePool()

  try {
    const relayEvents = await pool.querySync(RELAYS, { ids: [id] })
    if (relayEvents.length > 0) {
      const event = relayEvents[0]
      const fullContent = getFullContent(event.content, event.tags || [])
      return c.text(fullContent, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
    return c.text('Event not found', 404)
  } finally {
    pool.close(RELAYS)
  }
})

export default raw
