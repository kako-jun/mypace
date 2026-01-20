import { Hono } from 'hono'
import type { Event } from 'nostr-tools'
import type { Bindings, NotificationType } from '../types'
import type { D1Database } from '@cloudflare/workers-types'
import { registerUserSerial } from './serial'
import { sendPushToUser } from '../services/web-push'
import {
  getUserUnlockedSupernovaIds,
  getStellaCounts,
  batchUnlockSupernovas,
  getTotalStellaCount,
} from '../services/stella'
import { MAX_NOTIFICATIONS, STELLA_COLORS, STELLA_THRESHOLDS } from '../constants'
import { getCurrentTimestamp } from '../utils'

const publish = new Hono<{ Bindings: Bindings }>()

// Record stella to D1
async function recordStella(
  db: D1Database,
  eventId: string,
  authorPubkey: string,
  reactorPubkey: string,
  stellaCount: number,
  stellaColor: string,
  reactionId: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_stella (event_id, author_pubkey, reactor_pubkey, stella_count, stella_color, reaction_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, reactor_pubkey, stella_color) DO UPDATE SET
         stella_count = excluded.stella_count,
         reaction_id = excluded.reaction_id,
         updated_at = excluded.updated_at`
    )
    .bind(eventId, authorPubkey, reactorPubkey, stellaCount, stellaColor, reactionId, getCurrentTimestamp())
    .run()
}

// Send push notification (fire and forget)
async function triggerPushNotification(
  db: D1Database,
  recipientPubkey: string,
  type: NotificationType,
  vapidPublicKey?: string,
  vapidPrivateKey?: string,
  vapidSubject?: string
): Promise<void> {
  // Skip if VAPID keys not configured
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return
  }

  try {
    await sendPushToUser(
      db,
      recipientPubkey,
      type,
      { publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
      vapidSubject
    )
  } catch (e) {
    console.error('Push notification error:', e)
  }
}

// Record notification to D1 and trigger push notification
async function recordNotification(
  db: D1Database,
  recipientPubkey: string,
  actorPubkey: string,
  type: 'stella' | 'reply' | 'repost',
  targetEventId: string,
  sourceEventId: string | null,
  stellaCount: number | null,
  stellaColor: string | null,
  vapidPublicKey?: string,
  vapidPrivateKey?: string,
  vapidSubject?: string
): Promise<void> {
  // Don't notify yourself
  if (recipientPubkey === actorPubkey) return

  const now = getCurrentTimestamp()
  let shouldPush = false

  if (type === 'stella') {
    // For stella, check if we should update or skip (only notify on increase)
    const existing = await db
      .prepare(
        `SELECT stella_count FROM notifications
         WHERE recipient_pubkey = ? AND actor_pubkey = ? AND type = 'stella' AND target_event_id = ?`
      )
      .bind(recipientPubkey, actorPubkey, targetEventId)
      .first<{ stella_count: number | null }>()

    if (existing) {
      // Only update if stella count increased
      if (stellaCount && existing.stella_count && stellaCount > existing.stella_count) {
        await db
          .prepare(
            `UPDATE notifications SET stella_count = ?, stella_color = ?, created_at = ?, read_at = NULL
             WHERE recipient_pubkey = ? AND actor_pubkey = ? AND type = 'stella' AND target_event_id = ?`
          )
          .bind(stellaCount, stellaColor, now, recipientPubkey, actorPubkey, targetEventId)
          .run()
        shouldPush = true
      }
      // If decreased or same, do nothing
      if (!shouldPush) return
    } else {
      shouldPush = true
    }
  }

  // For reply/repost, check if notification already exists (prevent duplicates)
  if (type !== 'stella' && sourceEventId) {
    const existingReplyRepost = await db
      .prepare(`SELECT id FROM notifications WHERE source_event_id = ?`)
      .bind(sourceEventId)
      .first()
    if (existingReplyRepost) return
    shouldPush = true
  } else if (type !== 'stella') {
    shouldPush = true
  }

  // Insert new notification (only if shouldPush is true for non-stella, or first stella)
  if (type !== 'stella' || shouldPush) {
    await db
      .prepare(
        `INSERT INTO notifications (recipient_pubkey, actor_pubkey, type, target_event_id, source_event_id, stella_count, stella_color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(recipientPubkey, actorPubkey, type, targetEventId, sourceEventId, stellaCount, stellaColor, now)
      .run()
  }

  // Cleanup old notifications if over limit
  await db
    .prepare(
      `DELETE FROM notifications
       WHERE recipient_pubkey = ?
         AND id NOT IN (
           SELECT id FROM notifications
           WHERE recipient_pubkey = ?
           ORDER BY created_at DESC
           LIMIT ?
         )`
    )
    .bind(recipientPubkey, recipientPubkey, MAX_NOTIFICATIONS)
    .run()

  // Trigger push notification (fire and forget)
  if (shouldPush) {
    triggerPushNotification(db, recipientPubkey, type, vapidPublicKey, vapidPrivateKey, vapidSubject)
  }
}

// Check and unlock serial-related supernovas for a user
async function checkSerialSupernovas(db: D1Database, pubkey: string): Promise<void> {
  const now = getCurrentTimestamp()

  try {
    // Get user's serial number and unlocked supernovas in parallel
    const [serialResult, unlockedIds] = await Promise.all([
      db
        .prepare(`SELECT serial_number FROM user_serial WHERE pubkey = ?`)
        .bind(pubkey)
        .first<{ serial_number: number }>(),
      getUserUnlockedSupernovaIds(db, pubkey),
    ])

    if (!serialResult) return

    const serialNumber = serialResult.serial_number

    // Collect supernovas to unlock
    const toUnlock: string[] = []
    const serialSupernovas = [
      { id: 'serial_under_100', threshold: 100 },
      { id: 'serial_under_1000', threshold: 1000 },
    ]

    for (const supernova of serialSupernovas) {
      if (unlockedIds.has(supernova.id)) continue
      if (serialNumber > supernova.threshold) continue
      toUnlock.push(supernova.id)
    }

    // Batch unlock all at once
    if (toUnlock.length > 0) {
      await batchUnlockSupernovas(db, pubkey, toUnlock, now)
    }
  } catch (e) {
    console.error('Serial supernova check error:', e)
  }
}

// Check and unlock content-type supernovas for a user based on post tags
async function checkContentSupernovas(
  db: D1Database,
  pubkey: string,
  tags: string[][],
  content: string
): Promise<void> {
  const now = getCurrentTimestamp()

  try {
    // Get user's already unlocked supernovas
    const unlockedIds = await getUserUnlockedSupernovaIds(db, pubkey)

    // Collect supernovas to unlock
    const toUnlock: string[] = []

    // Check for teaser tag
    const hasTeaserTag = tags.some((t) => t[0] === 't' && t[1]?.toLowerCase() === 'teaser')
    if (hasTeaserTag && !unlockedIds.has('first_teaser')) {
      toUnlock.push('first_teaser')
    }

    // Check for super mention (q tag with super-mention marker)
    const hasSuperMention = tags.some((t) => t[0] === 'q')
    if (hasSuperMention && !unlockedIds.has('first_super_mention')) {
      toUnlock.push('first_super_mention')
    }

    // Check for image (imeta tag or image URL in content)
    const hasImetaTag = tags.some((t) => t[0] === 'imeta')
    const hasImageUrl = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(content)
    if ((hasImetaTag || hasImageUrl) && !unlockedIds.has('first_image')) {
      toUnlock.push('first_image')
    }

    // Check for voice memo (audio URL or voice tag)
    const hasVoiceTag = tags.some((t) => t[0] === 't' && t[1]?.toLowerCase() === 'voice')
    const hasAudioUrl = /\.(mp3|wav|ogg|m4a|webm)(\?|$)/i.test(content)
    if ((hasVoiceTag || hasAudioUrl) && !unlockedIds.has('first_voice')) {
      toUnlock.push('first_voice')
    }

    // Check for map/geo (g tag or geo: URL)
    const hasGeoTag = tags.some((t) => t[0] === 'g')
    const hasGeoUrl = /geo:/i.test(content)
    if ((hasGeoTag || hasGeoUrl) && !unlockedIds.has('first_map')) {
      toUnlock.push('first_map')
    }

    // Batch unlock all at once
    if (toUnlock.length > 0) {
      await batchUnlockSupernovas(db, pubkey, toUnlock, now)
    }
  } catch (e) {
    console.error('Content supernova check error:', e)
  }
}

// Check and unlock stella-related supernovas for a user (received stella by color)
async function checkStellaSupernovas(db: D1Database, pubkey: string): Promise<void> {
  const now = getCurrentTimestamp()
  const colors = STELLA_COLORS
  const thresholds = STELLA_THRESHOLDS

  try {
    // Get user's unlocked supernovas and received stella counts in parallel
    const [unlockedIds, received] = await Promise.all([
      getUserUnlockedSupernovaIds(db, pubkey),
      getStellaCounts(db, pubkey, 'received'),
    ])

    // Collect supernovas to unlock
    const toUnlock: string[] = []

    const totalStella = getTotalStellaCount(received)

    // Check first_received_stella
    if (!unlockedIds.has('first_received_stella') && totalStella > 0) {
      toUnlock.push('first_received_stella')
    }

    // Check color-specific received supernovas
    for (const color of colors) {
      for (const threshold of thresholds) {
        const id = `received_${color}_${threshold}`
        if (unlockedIds.has(id)) continue
        if (received[color] >= threshold) {
          toUnlock.push(id)
        }
      }
    }

    // Batch unlock all at once
    if (toUnlock.length > 0) {
      await batchUnlockSupernovas(db, pubkey, toUnlock, now)
    }
  } catch (e) {
    console.error('Stella supernova check error:', e)
  }
}

// Check and unlock given-stella-related supernovas for a user (the reactor)
async function checkGivenStellaSupernovas(db: D1Database, pubkey: string): Promise<void> {
  const now = getCurrentTimestamp()
  const colors = STELLA_COLORS
  const thresholds = STELLA_THRESHOLDS

  try {
    // Get user's unlocked supernovas and given stella counts in parallel
    const [unlockedIds, given] = await Promise.all([
      getUserUnlockedSupernovaIds(db, pubkey),
      getStellaCounts(db, pubkey, 'given'),
    ])

    // Collect supernovas to unlock
    const toUnlock: string[] = []

    const totalGiven = getTotalStellaCount(given)

    // Check first_given_stella
    if (!unlockedIds.has('first_given_stella') && totalGiven > 0) {
      toUnlock.push('first_given_stella')
    }

    // Check color-specific given supernovas
    for (const color of colors) {
      for (const threshold of thresholds) {
        const id = `given_${color}_${threshold}`
        if (unlockedIds.has(id)) continue
        if (given[color] >= threshold) {
          toUnlock.push(id)
        }
      }
    }

    // Batch unlock all at once
    if (toUnlock.length > 0) {
      await batchUnlockSupernovas(db, pubkey, toUnlock, now)
    }
  } catch (e) {
    console.error('Given stella supernova check error:', e)
  }
}

// Delete stella records and notifications when reaction or post is deleted
async function deleteStella(db: D1Database, eventIds: string[], pubkey: string): Promise<void> {
  if (eventIds.length === 0) return

  const placeholders = eventIds.map(() => '?').join(',')

  // Get stella records that will be deleted (for notification cleanup)
  const stellaRecords = await db
    .prepare(
      `SELECT event_id, reactor_pubkey FROM user_stella WHERE reaction_id IN (${placeholders}) AND reactor_pubkey = ?`
    )
    .bind(...eventIds, pubkey)
    .all<{ event_id: string; reactor_pubkey: string }>()

  // Delete if user is the reactor (deleting their reaction by reaction_id)
  await db
    .prepare(`DELETE FROM user_stella WHERE reaction_id IN (${placeholders}) AND reactor_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()

  // Batch delete corresponding stella notifications using IN clause
  if (stellaRecords.results && stellaRecords.results.length > 0) {
    const targetEventIds = stellaRecords.results.map((r) => r.event_id)
    const notifPlaceholders = targetEventIds.map(() => '?').join(',')
    await db
      .prepare(
        `DELETE FROM notifications WHERE actor_pubkey = ? AND type = 'stella' AND target_event_id IN (${notifPlaceholders})`
      )
      .bind(pubkey, ...targetEventIds)
      .run()
  }

  // Delete if user is the author (deleting their post by event_id)
  await db
    .prepare(`DELETE FROM user_stella WHERE event_id IN (${placeholders}) AND author_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()

  // Delete all notifications for deleted posts (where recipient is the author)
  await db
    .prepare(`DELETE FROM notifications WHERE target_event_id IN (${placeholders}) AND recipient_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()

  // Delete reply/repost notifications when the reply/repost is deleted
  // (source_event_id stores the reply/repost event ID)
  await db
    .prepare(`DELETE FROM notifications WHERE source_event_id IN (${placeholders}) AND actor_pubkey = ?`)
    .bind(...eventIds, pubkey)
    .run()
}

// POST /api/publish - イベントのD1記録（リレー送信はブラウザから直接行う）
publish.post('/', async (c) => {
  const body = await c.req.json<{ event: Event }>()
  const event = body.event

  if (!event || !event.id || !event.sig) {
    return c.json({ error: 'Invalid event: missing id or sig' }, 400)
  }

  const db = c.env.DB
  const tags = event.tags || []

  try {
    // #mypaceタグ付きのkind:1投稿なら通し番号を登録
    if (event.kind === 1) {
      const hasMypaceTag = tags.some((tag: string[]) => tag[0] === 't' && tag[1]?.toLowerCase() === 'mypace')
      if (hasMypaceTag) {
        try {
          await registerUserSerial(db, event.pubkey, event.id, event.created_at)
          // Check and unlock serial-related supernovas (fire-and-forget)
          checkSerialSupernovas(db, event.pubkey).catch(console.error)
        } catch (e) {
          console.error('Serial register error:', e)
        }
      }
      // Check and unlock content-type supernovas (fire-and-forget)
      checkContentSupernovas(db, event.pubkey, tags, event.content || '').catch(console.error)
    }

    // Kind 7 (リアクション) + stellaタグならD1に記録 + 通知
    if (event.kind === 7) {
      const stellaTags = tags.filter((t: string[]) => t[0] === 'stella' && t[1])
      if (stellaTags.length > 0) {
        const eTag = tags.find((t: string[]) => t[0] === 'e')
        const pTag = tags.find((t: string[]) => t[0] === 'p')
        if (eTag && eTag[1] && pTag && pTag[1]) {
          let notificationSent = false
          for (const stellaTag of stellaTags) {
            try {
              // Support both formats:
              // Old: ["stella", "count"]
              // New: ["stella", "color", "count"]
              const isColorFormat = stellaTag.length >= 3 && isNaN(parseInt(stellaTag[1], 10))
              const stellaCount = isColorFormat ? parseInt(stellaTag[2], 10) : parseInt(stellaTag[1], 10)
              const stellaColor = isColorFormat ? stellaTag[1] : 'yellow'
              if (!isNaN(stellaCount) && stellaCount >= 1 && stellaCount <= 10) {
                await recordStella(db, eTag[1], pTag[1], event.pubkey, stellaCount, stellaColor, event.id)
                // Record notification only once per reaction event
                if (!notificationSent) {
                  await recordNotification(
                    db,
                    pTag[1],
                    event.pubkey,
                    'stella',
                    eTag[1],
                    null,
                    stellaCount,
                    stellaColor,
                    c.env.VAPID_PUBLIC_KEY,
                    c.env.VAPID_PRIVATE_KEY,
                    c.env.VAPID_SUBJECT
                  )
                  notificationSent = true
                }
              }
            } catch (e) {
              console.error('Stella record error:', e)
            }
          }
          // Check and unlock stella-related supernovas for the author (fire-and-forget)
          checkStellaSupernovas(db, pTag[1]).catch(console.error)
          // Check and unlock given-stella-related supernovas for the reactor (fire-and-forget)
          checkGivenStellaSupernovas(db, event.pubkey).catch(console.error)
        }
      }
    }

    // Kind 1 (リプライ) なら通知を記録
    if (event.kind === 1) {
      const eTags = tags.filter((t: string[]) => t[0] === 'e')
      if (eTags.length > 0) {
        // This is a reply
        const pTags = tags.filter((t: string[]) => t[0] === 'p')
        const targetEventId = eTags[0][1]

        // Notify all mentioned users in parallel (independent operations)
        const validPTags = pTags.filter((pTag) => pTag[1])
        if (validPTags.length > 0) {
          await Promise.all(
            validPTags.map(async (pTag) => {
              try {
                await recordNotification(
                  db,
                  pTag[1],
                  event.pubkey,
                  'reply',
                  targetEventId,
                  event.id,
                  null,
                  null,
                  c.env.VAPID_PUBLIC_KEY,
                  c.env.VAPID_PRIVATE_KEY,
                  c.env.VAPID_SUBJECT
                )
              } catch (e) {
                console.error('Reply notification error:', e)
              }
            })
          )
        }
      }
    }

    // Kind 6 (リポスト) なら通知を記録
    if (event.kind === 6) {
      const eTag = tags.find((t: string[]) => t[0] === 'e')
      const pTag = tags.find((t: string[]) => t[0] === 'p')
      if (eTag && eTag[1] && pTag && pTag[1]) {
        try {
          await recordNotification(
            db,
            pTag[1],
            event.pubkey,
            'repost',
            eTag[1],
            event.id,
            null,
            null,
            c.env.VAPID_PUBLIC_KEY,
            c.env.VAPID_PRIVATE_KEY,
            c.env.VAPID_SUBJECT
          )
        } catch (e) {
          console.error('Repost notification error:', e)
        }
      }
    }

    // Kind 5 (削除) なら関連するステラ記録を削除
    if (event.kind === 5) {
      const eventIds = tags.filter((t: string[]) => t[0] === 'e').map((t: string[]) => t[1])
      if (eventIds.length > 0) {
        try {
          await deleteStella(db, eventIds, event.pubkey)
        } catch (e) {
          console.error('Stella delete error:', e)
        }
      }
    }

    return c.json({ success: true, id: event.id })
  } catch (e) {
    console.error('Publish record error:', e)
    return c.json({ error: `Failed to record: ${e instanceof Error ? e.message : 'Unknown error'}` }, 500)
  }
})

export default publish
