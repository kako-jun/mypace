import type { D1Database } from '@cloudflare/workers-types'
import { getCurrentTimestamp } from '../utils'

// Types
export interface StellaColorCounts {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

export interface SupernovaRewards {
  reward_green: number
  reward_red: number
  reward_blue: number
  reward_purple: number
}

// Get stella counts by color for a user
export async function getStellaCounts(
  db: D1Database,
  pubkey: string,
  type: 'received' | 'given'
): Promise<StellaColorCounts> {
  const column = type === 'received' ? 'author_pubkey' : 'reactor_pubkey'

  const result = await db
    .prepare(
      `SELECT stella_color, COALESCE(SUM(stella_count), 0) as total
       FROM user_stella
       WHERE ${column} = ?
       GROUP BY stella_color`
    )
    .bind(pubkey)
    .all<{ stella_color: string; total: number }>()

  const counts: StellaColorCounts = { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 }
  for (const r of result.results || []) {
    if (r.stella_color in counts) {
      counts[r.stella_color as keyof StellaColorCounts] = r.total
    }
  }
  return counts
}

// Get both received and given stella counts in parallel
export async function getStellaCountsBoth(
  db: D1Database,
  pubkey: string
): Promise<{ received: StellaColorCounts; given: StellaColorCounts }> {
  const [received, given] = await Promise.all([
    getStellaCounts(db, pubkey, 'received'),
    getStellaCounts(db, pubkey, 'given'),
  ])
  return { received, given }
}

// Get user's unlocked supernova IDs
export async function getUserUnlockedSupernovaIds(db: D1Database, pubkey: string): Promise<Set<string>> {
  const result = await db
    .prepare(`SELECT supernova_id FROM user_supernovas WHERE pubkey = ?`)
    .bind(pubkey)
    .all<{ supernova_id: string }>()

  return new Set((result.results || []).map((r) => r.supernova_id))
}

// Add stella rewards to user balance (upsert)
export async function addStellaBalance(
  db: D1Database,
  pubkey: string,
  amounts: Partial<StellaColorCounts>,
  now?: number
): Promise<void> {
  const timestamp = now ?? getCurrentTimestamp()

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
    .bind(
      pubkey,
      amounts.yellow || 0,
      amounts.green || 0,
      amounts.red || 0,
      amounts.blue || 0,
      amounts.purple || 0,
      timestamp
    )
    .run()
}

// Unlock a supernova and grant rewards
export async function unlockSupernova(
  db: D1Database,
  pubkey: string,
  supernovaId: string,
  now?: number
): Promise<boolean> {
  const timestamp = now ?? getCurrentTimestamp()

  // Get supernova definition for rewards
  const def = await db
    .prepare(`SELECT reward_green, reward_red, reward_blue, reward_purple FROM supernova_definitions WHERE id = ?`)
    .bind(supernovaId)
    .first<SupernovaRewards>()

  if (!def) return false

  // Unlock the supernova
  await db
    .prepare(`INSERT OR IGNORE INTO user_supernovas (pubkey, supernova_id, unlocked_at) VALUES (?, ?, ?)`)
    .bind(pubkey, supernovaId, timestamp)
    .run()

  // Add rewards to user's stella balance
  const totalReward = def.reward_green + def.reward_red + def.reward_blue + def.reward_purple
  if (totalReward > 0) {
    await addStellaBalance(
      db,
      pubkey,
      {
        yellow: 0,
        green: def.reward_green,
        red: def.reward_red,
        blue: def.reward_blue,
        purple: def.reward_purple,
      },
      timestamp
    )
  }

  return true
}

// Get total stella count from color counts
export function getTotalStellaCount(counts: StellaColorCounts): number {
  return counts.yellow + counts.green + counts.red + counts.blue + counts.purple
}

// Batch unlock multiple supernovas and grant rewards (optimized to reduce N+1)
export async function batchUnlockSupernovas(
  db: D1Database,
  pubkey: string,
  supernovaIds: string[],
  now?: number
): Promise<number> {
  if (supernovaIds.length === 0) return 0

  const timestamp = now ?? getCurrentTimestamp()

  // Fetch all supernova definitions in one query
  const placeholders = supernovaIds.map(() => '?').join(',')
  const defs = await db
    .prepare(
      `SELECT id, reward_green, reward_red, reward_blue, reward_purple
       FROM supernova_definitions WHERE id IN (${placeholders})`
    )
    .bind(...supernovaIds)
    .all<{ id: string } & SupernovaRewards>()

  if (!defs.results || defs.results.length === 0) return 0

  // Build batch INSERT values for user_supernovas
  const insertValues: string[] = []
  const insertParams: (string | number)[] = []
  const aggregatedRewards: StellaColorCounts = { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 }

  for (const def of defs.results) {
    insertValues.push('(?, ?, ?)')
    insertParams.push(pubkey, def.id, timestamp)

    // Aggregate rewards
    aggregatedRewards.green += def.reward_green
    aggregatedRewards.red += def.reward_red
    aggregatedRewards.blue += def.reward_blue
    aggregatedRewards.purple += def.reward_purple
  }

  // Batch INSERT into user_supernovas (OR IGNORE handles duplicates)
  await db
    .prepare(
      `INSERT OR IGNORE INTO user_supernovas (pubkey, supernova_id, unlocked_at) VALUES ${insertValues.join(', ')}`
    )
    .bind(...insertParams)
    .run()

  // Add aggregated rewards in a single operation
  const totalReward =
    aggregatedRewards.yellow +
    aggregatedRewards.green +
    aggregatedRewards.red +
    aggregatedRewards.blue +
    aggregatedRewards.purple
  if (totalReward > 0) {
    await addStellaBalance(db, pubkey, aggregatedRewards, timestamp)
  }

  return defs.results.length
}
