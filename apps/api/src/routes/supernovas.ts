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
    const [serialResult, postCountResult, receivedByColor, givenByColor] = await Promise.all([
      db
        .prepare(`SELECT serial_number FROM user_serial WHERE pubkey = ?`)
        .bind(pubkey)
        .first<{ serial_number: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count
           FROM user_serial
           WHERE pubkey = ?`
        )
        .bind(pubkey)
        .first<{ count: number }>(),
      // Received stella by color
      db
        .prepare(
          `SELECT stella_color, COALESCE(SUM(stella_count), 0) as total
           FROM user_stella
           WHERE author_pubkey = ?
           GROUP BY stella_color`
        )
        .bind(pubkey)
        .all<{ stella_color: string; total: number }>(),
      // Given stella by color
      db
        .prepare(
          `SELECT stella_color, COALESCE(SUM(stella_count), 0) as total
           FROM user_stella
           WHERE reactor_pubkey = ?
           GROUP BY stella_color`
        )
        .bind(pubkey)
        .all<{ stella_color: string; total: number }>(),
    ])

    // Build color-specific stats
    const received: Record<string, number> = { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 }
    const given: Record<string, number> = { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 }
    for (const r of receivedByColor.results || []) {
      received[r.stella_color] = r.total
    }
    for (const g of givenByColor.results || []) {
      given[g.stella_color] = g.total
    }

    const userStats = {
      serialNumber: serialResult?.serial_number || null,
      totalStella: Object.values(received).reduce((a, b) => a + b, 0),
      totalGivenStella: Object.values(given).reduce((a, b) => a + b, 0),
      postCount: postCountResult?.count || 0,
      received,
      given,
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
        case 'first_received_stella':
          shouldUnlock = event === 'first_received_stella' || userStats.totalStella > 0
          break
        case 'first_given_stella':
          shouldUnlock = event === 'first_given_stella' || userStats.totalGivenStella > 0
          break
        case 'serial_under_100':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 100
          break
        case 'serial_under_1000':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 1000
          break
        default: {
          // Handle color-specific stella supernovas: received_{color}_{threshold} or given_{color}_{threshold}
          const receivedMatch = def.id.match(/^received_(yellow|green|red|blue|purple)_(\d+)$/)
          const givenMatch = def.id.match(/^given_(yellow|green|red|blue|purple)_(\d+)$/)
          if (receivedMatch) {
            const color = receivedMatch[1]
            const threshold = parseInt(receivedMatch[2], 10)
            shouldUnlock = userStats.received[color] >= threshold
          } else if (givenMatch) {
            const color = givenMatch[1]
            const threshold = parseInt(givenMatch[2], 10)
            shouldUnlock = userStats.given[color] >= threshold
          }
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
      id: 'first_received_stella',
      name: 'First Received Stella',
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
      id: 'first_given_stella',
      name: 'First Given Stella',
      description: 'Gave your first stella',
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
    // Content type supernovas
    {
      id: 'first_teaser',
      name: 'First Teaser',
      description: 'Posted with teaser tag',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_super_mention',
      name: 'First Super Mention',
      description: 'Used super mention',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_image',
      name: 'First Image',
      description: 'Posted your first image',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_voice',
      name: 'First Voice',
      description: 'Posted your first voice memo',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_map',
      name: 'First Map',
      description: 'Posted your first map location',
      category: 'single',
      threshold: 1,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Received Yellow Stella
    {
      id: 'received_yellow_10',
      name: 'Received Yellow 10',
      description: 'Received 10 yellow stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_yellow_100',
      name: 'Received Yellow 100',
      description: 'Received 100 yellow stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'yellow',
      reward_yellow: 10,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_yellow_1000',
      name: 'Received Yellow 1000',
      description: 'Received 1000 yellow stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'yellow',
      reward_yellow: 20,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Received Green Stella
    {
      id: 'received_green_10',
      name: 'Received Green 10',
      description: 'Received 10 green stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 5,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_green_100',
      name: 'Received Green 100',
      description: 'Received 100 green stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 10,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_green_1000',
      name: 'Received Green 1000',
      description: 'Received 1000 green stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 20,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Received Red Stella
    {
      id: 'received_red_10',
      name: 'Received Red 10',
      description: 'Received 10 red stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 5,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_red_100',
      name: 'Received Red 100',
      description: 'Received 100 red stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 10,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_red_1000',
      name: 'Received Red 1000',
      description: 'Received 1000 red stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 20,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Received Blue Stella
    {
      id: 'received_blue_10',
      name: 'Received Blue 10',
      description: 'Received 10 blue stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 5,
      reward_purple: 0,
    },
    {
      id: 'received_blue_100',
      name: 'Received Blue 100',
      description: 'Received 100 blue stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 10,
      reward_purple: 0,
    },
    {
      id: 'received_blue_1000',
      name: 'Received Blue 1000',
      description: 'Received 1000 blue stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 20,
      reward_purple: 0,
    },
    // Received Purple Stella
    {
      id: 'received_purple_10',
      name: 'Received Purple 10',
      description: 'Received 10 purple stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 5,
    },
    {
      id: 'received_purple_100',
      name: 'Received Purple 100',
      description: 'Received 100 purple stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 10,
    },
    {
      id: 'received_purple_1000',
      name: 'Received Purple 1000',
      description: 'Received 1000 purple stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 20,
    },
    // Given Yellow Stella
    {
      id: 'given_yellow_10',
      name: 'Given Yellow 10',
      description: 'Given 10 yellow stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'yellow',
      reward_yellow: 5,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_yellow_100',
      name: 'Given Yellow 100',
      description: 'Given 100 yellow stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'yellow',
      reward_yellow: 10,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_yellow_1000',
      name: 'Given Yellow 1000',
      description: 'Given 1000 yellow stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'yellow',
      reward_yellow: 20,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Given Green Stella
    {
      id: 'given_green_10',
      name: 'Given Green 10',
      description: 'Given 10 green stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 5,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_green_100',
      name: 'Given Green 100',
      description: 'Given 100 green stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 10,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_green_1000',
      name: 'Given Green 1000',
      description: 'Given 1000 green stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'green',
      reward_yellow: 0,
      reward_green: 20,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Given Red Stella
    {
      id: 'given_red_10',
      name: 'Given Red 10',
      description: 'Given 10 red stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 5,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_red_100',
      name: 'Given Red 100',
      description: 'Given 100 red stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 10,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_red_1000',
      name: 'Given Red 1000',
      description: 'Given 1000 red stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'red',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 20,
      reward_blue: 0,
      reward_purple: 0,
    },
    // Given Blue Stella
    {
      id: 'given_blue_10',
      name: 'Given Blue 10',
      description: 'Given 10 blue stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 5,
      reward_purple: 0,
    },
    {
      id: 'given_blue_100',
      name: 'Given Blue 100',
      description: 'Given 100 blue stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 10,
      reward_purple: 0,
    },
    {
      id: 'given_blue_1000',
      name: 'Given Blue 1000',
      description: 'Given 1000 blue stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'blue',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 20,
      reward_purple: 0,
    },
    // Given Purple Stella
    {
      id: 'given_purple_10',
      name: 'Given Purple 10',
      description: 'Given 10 purple stella',
      category: 'cumulative',
      threshold: 10,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 5,
    },
    {
      id: 'given_purple_100',
      name: 'Given Purple 100',
      description: 'Given 100 purple stella',
      category: 'cumulative',
      threshold: 100,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 10,
    },
    {
      id: 'given_purple_1000',
      name: 'Given Purple 1000',
      description: 'Given 1000 purple stella',
      category: 'cumulative',
      threshold: 1000,
      trophy_color: 'purple',
      reward_yellow: 0,
      reward_green: 0,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 20,
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
