import { Hono } from 'hono'
import type { Bindings } from '../types'
import {
  getStellaCountsBoth,
  getUserUnlockedSupernovaIds,
  batchUnlockSupernovas,
  getTotalStellaCount,
  type StellaColorCounts,
} from '../services/stella'
import { getCurrentTimestamp } from '../utils'

const supernovas = new Hono<{ Bindings: Bindings }>()

const PRIMAL_CACHE_URL = 'wss://cache1.primal.net/v1'
const PRIMAL_TIMEOUT_MS = 5000
const PRIMAL_STATS_KIND = 10000105

interface PrimalStats {
  note_count?: number
  long_form_note_count?: number
}

// Fetch post count from Primal cache
async function fetchPostCountFromPrimal(pubkey: string): Promise<number> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close()
      resolve(0)
    }, PRIMAL_TIMEOUT_MS)

    const ws = new WebSocket(PRIMAL_CACHE_URL)

    ws.addEventListener('open', () => {
      const req = JSON.stringify(['REQ', 'stats', { cache: ['user_profile', { pubkey }] }])
      ws.send(req)
    })

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string)
        if (Array.isArray(data) && data[0] === 'EVENT' && data[2]?.kind === PRIMAL_STATS_KIND) {
          const content = JSON.parse(data[2].content) as PrimalStats
          clearTimeout(timeout)
          ws.close()
          resolve((content.note_count || 0) + (content.long_form_note_count || 0))
        } else if (Array.isArray(data) && data[0] === 'EOSE') {
          clearTimeout(timeout)
          ws.close()
          resolve(0)
        }
      } catch {
        // Parse error, ignore
      }
    })

    ws.addEventListener('error', () => {
      clearTimeout(timeout)
      ws.close()
      resolve(0)
    })
  })
}

interface SupernovaDefinition {
  id: string
  name: string
  description: string
  category: 'single' | 'cumulative'
  threshold: number
  supernova_color: string
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
        `SELECT id, name, description, category, threshold, supernova_color,
                reward_green, reward_red, reward_blue, reward_purple
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

// GET /api/supernovas/stats/:pubkey - Get user's stella stats for progress display
supernovas.get('/stats/:pubkey', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    const { received, given } = await getStellaCountsBoth(c.env.DB, pubkey)
    return c.json({ pubkey, received, given })
  } catch (e) {
    console.error('User stats fetch error:', e)
    return c.json({ error: 'Failed to fetch user stats' }, 500)
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
                sd.name, sd.description, sd.category, sd.threshold, sd.supernova_color,
                sd.reward_green, sd.reward_red, sd.reward_blue, sd.reward_purple
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
  const now = getCurrentTimestamp()

  try {
    // Get all supernova definitions
    const definitionsResult = await db
      .prepare(
        `SELECT id, name, description, category, threshold, supernova_color,
                reward_green, reward_red, reward_blue, reward_purple
         FROM supernova_definitions`
      )
      .all<SupernovaDefinition>()

    const definitions = definitionsResult.results || []

    // Get user's already unlocked supernovas and stella stats in parallel
    const [unlockedIds, stellaCounts, serialResult, postCount] = await Promise.all([
      getUserUnlockedSupernovaIds(db, pubkey),
      getStellaCountsBoth(db, pubkey),
      db
        .prepare(`SELECT serial_number FROM user_serial WHERE pubkey = ?`)
        .bind(pubkey)
        .first<{ serial_number: number }>(),
      fetchPostCountFromPrimal(pubkey),
    ])

    const { received, given } = stellaCounts
    const userStats = {
      serialNumber: serialResult?.serial_number || null,
      totalStella: getTotalStellaCount(received),
      totalGivenStella: getTotalStellaCount(given),
      postCount,
      supernovaCount: unlockedIds.size,
      received,
      given,
    }

    // Check each definition and collect supernovas to unlock
    const toUnlock: SupernovaDefinition[] = []

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
        case 'penguin_100':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 100
          break
        case 'penguin_250':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 250
          break
        case 'penguin_500':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 500
          break
        case 'penguin_1000':
          shouldUnlock = userStats.serialNumber !== null && userStats.serialNumber <= 1000
          break
        case 'first_supernova':
          // Unlock if user already has any supernova or is about to unlock one
          shouldUnlock = userStats.supernovaCount > 0 || toUnlock.length > 0
          break
        default: {
          // Handle pattern-based supernovas
          const receivedMatch = def.id.match(/^received_(green|red|blue|purple)_(\d+)$/)
          const givenMatch = def.id.match(/^given_(green|red|blue|purple)_(\d+)$/)
          const postsMatch = def.id.match(/^posts_(\d+)$/)
          const supernovaMatch = def.id.match(/^supernova_(\d+)$/)
          if (receivedMatch) {
            const color = receivedMatch[1] as keyof StellaColorCounts
            const threshold = parseInt(receivedMatch[2], 10)
            shouldUnlock = userStats.received[color] >= threshold
          } else if (givenMatch) {
            const color = givenMatch[1] as keyof StellaColorCounts
            const threshold = parseInt(givenMatch[2], 10)
            shouldUnlock = userStats.given[color] >= threshold
          } else if (postsMatch) {
            const threshold = parseInt(postsMatch[1], 10)
            shouldUnlock = userStats.postCount >= threshold
          } else if (supernovaMatch) {
            // Meta supernova: unlocked N supernovas
            const threshold = parseInt(supernovaMatch[1], 10)
            // Include current batch being unlocked in count
            shouldUnlock = userStats.supernovaCount + toUnlock.length >= threshold
          }
        }
      }

      if (shouldUnlock) {
        toUnlock.push(def)
      }
    }

    // Batch unlock all supernovas at once
    const newlyUnlocked: (SupernovaDefinition & { unlocked_at: number })[] = []
    if (toUnlock.length > 0) {
      await batchUnlockSupernovas(
        db,
        pubkey,
        toUnlock.map((d) => d.id),
        now
      )
      for (const def of toUnlock) {
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

  // Reward rules:
  // Reward rules (×10 per color tier):
  // - green supernova: green 1
  // - red supernova: green 10, red 1
  // - blue supernova: green 100, red 10, blue 1
  // - purple supernova: green 1000, red 100, blue 10, purple 1

  const initialSupernovas: SupernovaDefinition[] = [
    // === Single achievements (green, tier 1) ===
    {
      id: 'first_post',
      name: 'First Post',
      description: 'Posted your first message',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
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
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_teaser',
      name: 'First Teaser',
      description: 'Posted with teaser tag',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_url',
      name: 'First URL',
      description: 'Posted with a URL',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_table',
      name: 'First Table',
      description: 'Used markdown table',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_list',
      name: 'First List',
      description: 'Used markdown list',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_reply',
      name: 'First Reply',
      description: 'Replied to a post',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_repost',
      name: 'First Repost',
      description: 'Reposted a post',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_supernova',
      name: 'First Supernova',
      description: 'Unlocked your first supernova',
      category: 'single',
      threshold: 1,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    // === Serial series (green→green→red→blue) 1000→500→250→100 ===
    {
      id: 'penguin_1000',
      name: 'Penguin 1000',
      description: 'Joined within the first 1000 users',
      category: 'single',
      threshold: 1000,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'penguin_500',
      name: 'Penguin 500',
      description: 'Joined within the first 500 users',
      category: 'single',
      threshold: 500,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'penguin_250',
      name: 'Penguin 250',
      description: 'Joined within the first 250 users',
      category: 'single',
      threshold: 250,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'penguin_100',
      name: 'Penguin 100',
      description: 'Joined within the first 100 users',
      category: 'single',
      threshold: 100,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    // === Long post series (green→green→red→blue→purple) ===
    {
      id: 'first_long_post',
      name: 'First Long Post',
      description: 'Posted 281+ characters',
      category: 'single',
      threshold: 281,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_1000_chars',
      name: 'First 1000 Chars',
      description: 'Posted 1000+ characters',
      category: 'single',
      threshold: 1000,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_2000_chars',
      name: 'First 2000 Chars',
      description: 'Posted 2000+ characters',
      category: 'single',
      threshold: 2000,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'first_4000_chars',
      name: 'First 4000 Chars',
      description: 'Posted 4000+ characters',
      category: 'single',
      threshold: 4000,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    // === Posts count series (green→green→red→blue) ===
    {
      id: 'posts_10',
      name: 'Posts 10',
      description: 'Posted 10 times',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'posts_100',
      name: 'Posts 100',
      description: 'Posted 100 times',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'green',
      reward_green: 1,
      reward_red: 0,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'posts_1000',
      name: 'Posts 1000',
      description: 'Posted 1000 times',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    // === Supernova count series (green→red→blue→purple) ===
    {
      id: 'supernova_10',
      name: 'Supernova 10',
      description: 'Unlocked 10 supernovas',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'supernova_25',
      name: 'Supernova 25',
      description: 'Unlocked 25 supernovas',
      category: 'cumulative',
      threshold: 25,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'supernova_50',
      name: 'Supernova 50',
      description: 'Unlocked 50 supernovas',
      category: 'cumulative',
      threshold: 50,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    // === Received Green Stella series (green→green→red→blue) ===
    {
      id: 'received_green_10',
      name: 'Received Green 10',
      description: 'Received 10 green stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    // === Received Red Stella series (red→red→blue) ===
    {
      id: 'received_red_10',
      name: 'Received Red 10',
      description: 'Received 10 red stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_red_100',
      name: 'Received Red 100',
      description: 'Received 100 red stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'received_red_1000',
      name: 'Received Red 1000',
      description: 'Received 1000 red stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    // === Received Blue Stella series (blue→blue→purple) ===
    {
      id: 'received_blue_10',
      name: 'Received Blue 10',
      description: 'Received 10 blue stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'received_blue_100',
      name: 'Received Blue 100',
      description: 'Received 100 blue stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'received_blue_1000',
      name: 'Received Blue 1000',
      description: 'Received 1000 blue stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    // === Received Purple Stella series (purple→purple→purple) ===
    {
      id: 'received_purple_10',
      name: 'Received Purple 10',
      description: 'Received 10 purple stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    {
      id: 'received_purple_100',
      name: 'Received Purple 100',
      description: 'Received 100 purple stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    {
      id: 'received_purple_1000',
      name: 'Received Purple 1000',
      description: 'Received 1000 purple stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    // === Given Green Stella series (green→green→red) ===
    {
      id: 'given_green_10',
      name: 'Given Green 10',
      description: 'Given 10 green stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'green',
      reward_green: 1,
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
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    // === Given Red Stella series (red→red→blue) ===
    {
      id: 'given_red_10',
      name: 'Given Red 10',
      description: 'Given 10 red stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_red_100',
      name: 'Given Red 100',
      description: 'Given 100 red stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'red',
      reward_green: 10,
      reward_red: 1,
      reward_blue: 0,
      reward_purple: 0,
    },
    {
      id: 'given_red_1000',
      name: 'Given Red 1000',
      description: 'Given 1000 red stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    // === Given Blue Stella series (blue→blue→purple) ===
    {
      id: 'given_blue_10',
      name: 'Given Blue 10',
      description: 'Given 10 blue stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'given_blue_100',
      name: 'Given Blue 100',
      description: 'Given 100 blue stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'blue',
      reward_green: 100,
      reward_red: 10,
      reward_blue: 1,
      reward_purple: 0,
    },
    {
      id: 'given_blue_1000',
      name: 'Given Blue 1000',
      description: 'Given 1000 blue stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    // === Given Purple Stella series (purple→purple→purple) ===
    {
      id: 'given_purple_10',
      name: 'Given Purple 10',
      description: 'Given 10 purple stella',
      category: 'cumulative',
      threshold: 10,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    {
      id: 'given_purple_100',
      name: 'Given Purple 100',
      description: 'Given 100 purple stella',
      category: 'cumulative',
      threshold: 100,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
    {
      id: 'given_purple_1000',
      name: 'Given Purple 1000',
      description: 'Given 1000 purple stella',
      category: 'cumulative',
      threshold: 1000,
      supernova_color: 'purple',
      reward_green: 1000,
      reward_red: 100,
      reward_blue: 10,
      reward_purple: 1,
    },
  ]

  try {
    // Use db.batch() for atomic inserts
    const statements = initialSupernovas.map((supernova) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO supernova_definitions
           (id, name, description, category, threshold, supernova_color,
            reward_green, reward_red, reward_blue, reward_purple)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          supernova.id,
          supernova.name,
          supernova.description,
          supernova.category,
          supernova.threshold,
          supernova.supernova_color,
          supernova.reward_green,
          supernova.reward_red,
          supernova.reward_blue,
          supernova.reward_purple
        )
    )

    await db.batch(statements)

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
