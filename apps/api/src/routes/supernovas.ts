import { Hono } from 'hono'
import type { Bindings } from '../types'

const supernovas = new Hono<{ Bindings: Bindings }>()

interface SupernovaDefinition {
  id: string
  name: string
  description: string
  category: 'single' | 'cumulative'
  threshold: number
  trophy_color: string
  reward_yellow: number
  reward_green: number
  reward_red: number
  reward_blue: number
  reward_purple: number
}

interface UserSupernova {
  supernova_id: string
  unlocked_at: number
}

// GET /api/supernovas/definitions - Get all supernova definitions
supernovas.get('/definitions', async (c) => {
  const db = c.env.DB

  try {
    const result = await db
      .prepare(
        `SELECT id, name, description, category, threshold, trophy_color,
                reward_yellow, reward_green, reward_red, reward_blue, reward_purple
         FROM supernova_definitions
         ORDER BY id`
      )
      .all<SupernovaDefinition>()

    return c.json({
      supernovas: result.results || [],
    })
  } catch (e) {
    console.error('Supernova definitions fetch error:', e)
    return c.json({ error: 'Failed to fetch supernova definitions' }, 500)
  }
})

// GET /api/supernovas/:pubkey - Get user's unlocked supernovas
supernovas.get('/:pubkey', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const db = c.env.DB

  try {
    // Get user's unlocked supernovas with definitions
    const result = await db
      .prepare(
        `SELECT sd.id, us.unlocked_at,
                sd.name, sd.description, sd.category, sd.threshold, sd.trophy_color,
                sd.reward_yellow, sd.reward_green, sd.reward_red, sd.reward_blue, sd.reward_purple
         FROM user_supernovas us
         JOIN supernova_definitions sd ON us.supernova_id = sd.id
         WHERE us.pubkey = ?
         ORDER BY us.unlocked_at DESC`
      )
      .bind(pubkey)
      .all<UserSupernova & SupernovaDefinition>()

    return c.json({
      pubkey,
      unlocked: result.results || [],
    })
  } catch (e) {
    console.error('User supernovas fetch error:', e)
    return c.json({ error: 'Failed to fetch user supernovas' }, 500)
  }
})

// POST /api/supernovas/check - Check and unlock supernovas for a user
supernovas.post('/check', async (c) => {
  const body = await c.req.json<{
    pubkey: string
    event?: string // Optional: specific event that triggered the check (e.g., 'first_post')
  }>()

  const { pubkey, event } = body

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const db = c.env.DB
  const now = Math.floor(Date.now() / 1000)

  try {
    // Get all supernova definitions
    const definitionsResult = await db
      .prepare(
        `SELECT id, name, description, category, threshold, trophy_color,
                reward_yellow, reward_green, reward_red, reward_blue, reward_purple
         FROM supernova_definitions`
      )
      .all<SupernovaDefinition>()

    const definitions = definitionsResult.results || []

    // Get user's already unlocked supernovas
    const unlockedResult = await db
      .prepare(`SELECT supernova_id FROM user_supernovas WHERE pubkey = ?`)
      .bind(pubkey)
      .all<{ supernova_id: string }>()

    const unlockedIds = new Set((unlockedResult.results || []).map((r) => r.supernova_id))

    // Get user stats for cumulative checks
    const [serialResult, stellaResult, postCountResult] = await Promise.all([
      db
        .prepare(`SELECT serial_number FROM user_serial WHERE pubkey = ?`)
        .bind(pubkey)
        .first<{ serial_number: number }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(stella_count), 0) as total
           FROM user_stella
           WHERE author_pubkey = ?`
        )
        .bind(pubkey)
        .first<{ total: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM user_serial
           WHERE pubkey = ?`
        )
        .bind(pubkey)
        .first<{ count: number }>(),
    ])

    const userStats = {
      serialNumber: serialResult?.serial_number || null,
      totalStella: stellaResult?.total || 0,
      postCount: postCountResult?.count || 0,
    }

    // Check each definition and unlock if conditions are met
    const newlyUnlocked: (SupernovaDefinition & { unlocked_at: number })[] = []

    for (const def of definitions) {
      // Skip if already unlocked
      if (unlockedIds.has(def.id)) continue

      let shouldUnlock = false

      // Check unlock conditions based on supernova ID
      switch (def.id) {
        case 'first_post':
          shouldUnlock = event === 'first_post' || userStats.postCount > 0
          break
        case 'first_stella':
          shouldUnlock = event === 'first_stella' || userStats.totalStella > 0
          break
        case 'serial_under_100':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 100
          break
        case 'serial_under_1000':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 1000
          break
        case 'stella_100':
          shouldUnlock = userStats.totalStella >= 100
          break
        case 'stella_1000':
          shouldUnlock = userStats.totalStella >= 1000
          break
        // Add more conditions as needed
        default:
          // For cumulative achievements, check threshold
          if (def.category === 'cumulative') {
            // Generic check based on threshold (can be extended)
            shouldUnlock = userStats.totalStella >= def.threshold
          }
      }

      if (shouldUnlock) {
        // Unlock the supernova
        await db
          .prepare(`INSERT OR IGNORE INTO user_supernovas (pubkey, supernova_id, unlocked_at) VALUES (?, ?, ?)`)
          .bind(pubkey, def.id, now)
          .run()

        // Add rewards to user's stella balance
        const totalReward = def.reward_yellow + def.reward_green + def.reward_red + def.reward_blue + def.reward_purple
        if (totalReward > 0) {
          await db
            .prepare(
              `INSERT INTO user_stella_balance (pubkey, yellow, green, red, blue, purple, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(pubkey) DO UPDATE SET
                 yellow = yellow + excluded.yellow,
                 green = green + excluded.green,
                 red = red + excluded.red,
                 blue = blue + excluded.blue,
                 purple = purple + excluded.purple,
                 updated_at = excluded.updated_at`
            )
            .bind(pubkey, def.reward_yellow, def.reward_green, def.reward_red, def.reward_blue, def.reward_purple, now)
            .run()
        }

        newlyUnlocked.push({ ...def, unlocked_at: now })
      }
    }

    return c.json({
      success: true,
      newlyUnlocked,
      totalUnlocked: unlockedIds.size + newlyUnlocked.length,
    })
  } catch (e) {
    console.error('Supernova check error:', e)
    return c.json({ error: 'Failed to check supernovas' }, 500)
  }
})

// POST /api/supernovas/seed - Seed initial supernova definitions (admin only)
supernovas.post('/seed', async (c) => {
  const db = c.env.DB

  const initialSupernovas: SupernovaDefinition[] = [
    {
      id: 'first_post',
      name: 'First Post',
      description: 'Posted your first message',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 10,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_stella',
      name: 'First Star',
      description: 'Received your first stella',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'serial_under_100',
      name: 'Early Bird',
      description: 'Joined within the first 100 users',
      category: 'single',
      threshold: 100,
      trophy_color: 'green',
      reward_yellow: 20,
      reward_green: 5,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'serial_under_1000',
      name: 'Pioneer',
      description: 'Joined within the first 1000 users',
      category: 'single',
      threshold: 1000,
      trophy_color: 'green',
      reward_yellow: 10,
      reward_green: 2,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'stella_100',
      name: 'Star Collector',
      description: 'Received 100 total stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 10,
      reward_red: 5,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'stella_1000',
      name: 'Constellation',
      description: 'Received 1000 total stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 10,
      reward_blue: 5,
      reward_purple: 1,
    },
  ]

  try {
    for (const supernova of initialSupernovas) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO supernova_definitions
           (id, name, description, category, threshold, trophy_color,
            reward_yellow, reward_green, reward_red, reward_blue, reward_purple)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          supernova.id,
          supernova.name,
          supernova.description,
          supernova.category,
          supernova.threshold,
          supernova.trophy_color,
          supernova.reward_yellow,
          supernova.reward_green,
          supernova.reward_red,
          supernova.reward_blue,
          supernova.reward_purple
        )
        .run()
    }

    return c.json({
      success: true,
      seeded: initialSupernovas.length,
    })
  } catch (e) {
    console.error('Supernova seed error:', e)
    return c.json({ error: 'Failed to seed supernovas' }, 500)
  }
})

export default supernovas
