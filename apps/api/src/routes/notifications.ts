import { Hono } from 'hono'
import type { Bindings } from '../types'

const notifications = new Hono<{ Bindings: Bindings }>()

// Max notifications per user
const MAX_NOTIFICATIONS = 50

interface NotificationRow {
  id: number
  recipient_pubkey: string
  actor_pubkey: string
  type: 'stella' | 'reply' | 'repost'
  target_event_id: string
  source_event_id: string | null
  stella_count: number | null
  stella_color: string | null
  created_at: number
  read_at: number | null
}

interface AggregatedNotification {
  ids: number[]
  type: 'stella' | 'reply' | 'repost'
  targetEventId: string
  sourceEventId: string | null
  actors: Array<{
    pubkey: string
    stellaCount?: number
    stellaColor?: string
  }>
  createdAt: number
  readAt: number | null
}

// GET /api/notifications?pubkey=xxx - Get notifications (aggregated)
notifications.get('/', async (c) => {
  const pubkey = c.req.query('pubkey')

  if (!pubkey) {
    return c.json({ error: 'pubkey is required' }, 400)
  }

  // Get latest notifications for this user
  const rows = await c.env.DB.prepare(
    `SELECT id, recipient_pubkey, actor_pubkey, type, target_event_id, source_event_id, stella_count, stella_color, created_at, read_at
     FROM notifications
     WHERE recipient_pubkey = ?
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(pubkey, MAX_NOTIFICATIONS)
    .all<NotificationRow>()

  if (!rows.results) {
    return c.json({ notifications: [], hasUnread: false })
  }

  // Aggregate notifications
  const aggregated = aggregateNotifications(rows.results)

  // Check if there are any unread
  const hasUnread = rows.results.some((r) => r.read_at === null)

  return c.json({
    notifications: aggregated,
    hasUnread,
  })
})

// POST /api/notifications/read - Mark multiple notifications as read
notifications.post('/read', async (c) => {
  const { ids } = await c.req.json<{ ids: number[] }>()

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'ids array is required' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)
  const placeholders = ids.map(() => '?').join(',')

  await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE id IN (${placeholders}) AND read_at IS NULL`)
    .bind(now, ...ids)
    .run()

  return c.json({ success: true })
})

// POST /api/notifications/:id/read - Mark single notification as read
notifications.post('/:id/read', async (c) => {
  const id = parseInt(c.req.param('id'), 10)

  if (isNaN(id)) {
    return c.json({ error: 'Invalid notification id' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)

  await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL`).bind(now, id).run()

  return c.json({ success: true })
})

// GET /api/notifications/unread-count?pubkey=xxx - Get unread count (for bell icon)
notifications.get('/unread-count', async (c) => {
  const pubkey = c.req.query('pubkey')

  if (!pubkey) {
    return c.json({ error: 'pubkey is required' }, 400)
  }

  const result = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE recipient_pubkey = ? AND read_at IS NULL`
  )
    .bind(pubkey)
    .first<{ count: number }>()

  return c.json({
    hasUnread: (result?.count ?? 0) > 0,
  })
})

// Aggregate notifications by type and target event
function aggregateNotifications(rows: NotificationRow[]): AggregatedNotification[] {
  const result: AggregatedNotification[] = []
  const stellaGroups = new Map<string, NotificationRow[]>()
  const repostGroups = new Map<string, NotificationRow[]>()

  for (const row of rows) {
    if (row.type === 'stella') {
      const key = row.target_event_id
      if (!stellaGroups.has(key)) {
        stellaGroups.set(key, [])
      }
      stellaGroups.get(key)!.push(row)
    } else if (row.type === 'repost') {
      const key = row.target_event_id
      if (!repostGroups.has(key)) {
        repostGroups.set(key, [])
      }
      repostGroups.get(key)!.push(row)
    } else {
      // Reply - no aggregation
      result.push({
        ids: [row.id],
        type: row.type,
        targetEventId: row.target_event_id,
        sourceEventId: row.source_event_id,
        actors: [{ pubkey: row.actor_pubkey }],
        createdAt: row.created_at,
        readAt: row.read_at,
      })
    }
  }

  // Aggregate stella groups
  for (const [targetEventId, group] of stellaGroups) {
    const latestCreatedAt = Math.max(...group.map((r) => r.created_at))
    // If any is unread, the whole group is unread
    const readAt = group.every((r) => r.read_at !== null) ? Math.max(...group.map((r) => r.read_at!)) : null

    result.push({
      ids: group.map((r) => r.id),
      type: 'stella',
      targetEventId,
      sourceEventId: null,
      actors: group.map((r) => ({
        pubkey: r.actor_pubkey,
        stellaCount: r.stella_count ?? undefined,
        stellaColor: r.stella_color ?? 'yellow',
      })),
      createdAt: latestCreatedAt,
      readAt,
    })
  }

  // Aggregate repost groups
  for (const [targetEventId, group] of repostGroups) {
    const latestCreatedAt = Math.max(...group.map((r) => r.created_at))
    const readAt = group.every((r) => r.read_at !== null) ? Math.max(...group.map((r) => r.read_at!)) : null

    result.push({
      ids: group.map((r) => r.id),
      type: 'repost',
      targetEventId,
      sourceEventId: null,
      actors: group.map((r) => ({ pubkey: r.actor_pubkey })),
      createdAt: latestCreatedAt,
      readAt,
    })
  }

  // Sort by latest created_at
  result.sort((a, b) => b.createdAt - a.createdAt)

  // Limit to ~20 rows
  return result.slice(0, 20)
}

export default notifications
