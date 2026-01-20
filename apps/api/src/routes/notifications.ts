import { Hono } from 'hono'
import type { Bindings, NotificationType } from '../types'
import { MAX_NOTIFICATIONS, AGGREGATED_NOTIFICATIONS_LIMIT } from '../constants'
import { getCurrentTimestamp } from '../utils'

const notifications = new Hono<{ Bindings: Bindings }>()

interface NotificationRow {
  id: number
  recipient_pubkey: string
  actor_pubkey: string
  type: NotificationType
  target_event_id: string
  source_event_id: string | null
  stella_count: number | null
  stella_color: string | null
  created_at: number
  read_at: number | null
}

interface StellaByColor {
  yellow?: number
  green?: number
  red?: number
  blue?: number
  purple?: number
}

interface AggregatedNotification {
  ids: number[]
  type: NotificationType
  targetEventId: string
  sourceEventId: string | null
  actors: Array<{
    pubkey: string
    stellaByColor?: StellaByColor
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

  // Collect stella notification keys for fetching from user_stella
  const stellaKeys = new Set<string>()
  const stellaEventIds = new Set<string>()
  for (const row of rows.results) {
    if (row.type === 'stella') {
      stellaKeys.add(`${row.target_event_id}:${row.actor_pubkey}`)
      stellaEventIds.add(row.target_event_id)
    }
  }

  // Fetch stella details from user_stella table using IN clause (more efficient)
  const stellaDetails = new Map<string, StellaByColor>()
  if (stellaEventIds.size > 0) {
    const eventIdArray = [...stellaEventIds]
    const placeholders = eventIdArray.map(() => '?').join(',')

    const stellaRows = await c.env.DB.prepare(
      `SELECT event_id, reactor_pubkey, stella_color, stella_count
       FROM user_stella
       WHERE event_id IN (${placeholders})`
    )
      .bind(...eventIdArray)
      .all<{ event_id: string; reactor_pubkey: string; stella_color: string; stella_count: number }>()

    if (stellaRows.results) {
      for (const row of stellaRows.results) {
        const key = `${row.event_id}:${row.reactor_pubkey}`
        // Only include if this key was in our notification list
        if (!stellaKeys.has(key)) continue
        if (!stellaDetails.has(key)) {
          stellaDetails.set(key, {})
        }
        const detail = stellaDetails.get(key)!
        const color = row.stella_color as keyof StellaByColor
        detail[color] = row.stella_count
      }
    }
  }

  // Aggregate notifications with stella details
  const aggregated = aggregateNotifications(rows.results, stellaDetails)

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

  const now = getCurrentTimestamp()
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

  const now = getCurrentTimestamp()

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
function aggregateNotifications(
  rows: NotificationRow[],
  stellaDetails: Map<string, StellaByColor>
): AggregatedNotification[] {
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

    // Get unique actors with their stella details
    const actorMap = new Map<string, StellaByColor>()
    for (const r of group) {
      const detailKey = `${targetEventId}:${r.actor_pubkey}`
      const detail = stellaDetails.get(detailKey)
      if (detail && Object.keys(detail).length > 0) {
        actorMap.set(r.actor_pubkey, detail)
      } else {
        // Fallback to notification data if user_stella not found
        const color = (r.stella_color || 'yellow') as keyof StellaByColor
        actorMap.set(r.actor_pubkey, { [color]: r.stella_count || 1 })
      }
    }

    result.push({
      ids: group.map((r) => r.id),
      type: 'stella',
      targetEventId,
      sourceEventId: null,
      actors: Array.from(actorMap.entries()).map(([pubkey, stellaByColor]) => ({
        pubkey,
        stellaByColor,
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

  // Limit aggregated results
  return result.slice(0, AGGREGATED_NOTIFICATIONS_LIMIT)
}

export default notifications
