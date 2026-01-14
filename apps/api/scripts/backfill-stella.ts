/**
 * Backfill stella records from Nostr relays to D1 database
 *
 * Usage:
 *   npx tsx scripts/backfill-stella.ts [--clear]
 *
 * Options:
 *   --clear  Clear all existing stella records before backfill
 */

import { SimplePool } from 'nostr-tools/pool'
import type { Event } from 'nostr-tools'
import { execSync } from 'child_process'

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
]

const DB_NAME = 'mypace-db'

interface StellaRecord {
  eventId: string
  authorPubkey: string
  reactorPubkey: string
  stellaCount: number
  reactionId: string
  createdAt: number
}

// Kind 1: Regular notes, Kind 42000: Sinov NPC posts
const MY_PACE_KINDS = [1, 42000]

async function fetchMyPacePosts(pool: SimplePool): Promise<Event[]> {
  const allPosts: Event[] = []
  let until: number | undefined = undefined
  const batchSize = 500

  console.log('Fetching MY PACE posts (Kind 1 and 42000)...')

  while (true) {
    const filter: { kinds: number[]; '#t': string[]; limit: number; until?: number } = {
      kinds: MY_PACE_KINDS,
      '#t': ['mypace'],
      limit: batchSize,
    }
    if (until) {
      filter.until = until
    }

    const posts = await pool.querySync(RELAYS, filter)
    if (posts.length === 0) break

    allPosts.push(...posts)
    console.log(`  Fetched ${posts.length} posts (total: ${allPosts.length})`)

    const oldest = Math.min(...posts.map((p) => p.created_at))
    if (oldest === until) break
    until = oldest

    if (allPosts.length >= 10000) {
      console.log('  Reached safety limit of 10000 posts')
      break
    }
  }

  return allPosts
}

async function fetchReactionsForPosts(pool: SimplePool, postIds: string[]): Promise<Event[]> {
  const allReactions: Event[] = []
  const batchSize = 100

  console.log(`\nFetching reactions for ${postIds.length} posts...`)

  for (let i = 0; i < postIds.length; i += batchSize) {
    const batch = postIds.slice(i, i + batchSize)
    const reactions = await pool.querySync(RELAYS, {
      kinds: [7],
      '#e': batch,
    })
    allReactions.push(...reactions)
    console.log(
      `  Batch ${Math.floor(i / batchSize) + 1}: ${reactions.length} reactions (total: ${allReactions.length})`
    )
  }

  return allReactions
}

function extractStellaRecords(reactions: Event[], postAuthors: Map<string, string>): Map<string, StellaRecord> {
  const recordMap = new Map<string, StellaRecord>()

  for (const reaction of reactions) {
    const tags = reaction.tags || []

    // Check for stella tag
    const stellaTag = tags.find((t) => t[0] === 'stella')
    if (!stellaTag || !stellaTag[1]) continue

    const stellaCount = parseInt(stellaTag[1], 10)
    if (isNaN(stellaCount) || stellaCount < 1 || stellaCount > 10) continue

    // Get target event ID
    const eTag = tags.find((t) => t[0] === 'e')
    if (!eTag || !eTag[1]) continue

    const eventId = eTag[1]
    const authorPubkey = postAuthors.get(eventId)
    if (!authorPubkey) continue

    const key = `${eventId}:${reaction.pubkey}`
    const existing = recordMap.get(key)

    // Keep only the latest reaction (by created_at)
    if (!existing || reaction.created_at > existing.createdAt) {
      recordMap.set(key, {
        eventId,
        authorPubkey,
        reactorPubkey: reaction.pubkey,
        stellaCount,
        reactionId: reaction.id,
        createdAt: reaction.created_at,
      })
    }
  }

  return recordMap
}

function generateSQL(records: StellaRecord[], clear: boolean): string {
  const lines: string[] = []

  if (clear) {
    lines.push('DELETE FROM user_stella;')
  }

  for (const record of records) {
    const now = Math.floor(Date.now() / 1000)
    const escape = (s: string) => s.replace(/'/g, "''")
    lines.push(
      `INSERT INTO user_stella (event_id, author_pubkey, reactor_pubkey, stella_count, reaction_id, updated_at) ` +
        `VALUES ('${escape(record.eventId)}', '${escape(record.authorPubkey)}', '${escape(record.reactorPubkey)}', ${record.stellaCount}, '${escape(record.reactionId)}', ${now}) ` +
        `ON CONFLICT (event_id, reactor_pubkey) DO UPDATE SET ` +
        `stella_count = excluded.stella_count, reaction_id = excluded.reaction_id, updated_at = excluded.updated_at;`
    )
  }

  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const clear = args.includes('--clear')

  console.log('=== Stella Backfill Script ===')
  console.log(`Clear existing data: ${clear}`)
  console.log('')

  const pool = new SimplePool()

  try {
    // Step 1: Fetch MY PACE posts
    const posts = await fetchMyPacePosts(pool)
    console.log(`\nTotal MY PACE posts: ${posts.length}`)

    if (posts.length === 0) {
      console.log('No MY PACE posts found. Exiting.')
      return
    }

    // Build post ID -> author pubkey map
    const postAuthors = new Map<string, string>()
    for (const post of posts) {
      postAuthors.set(post.id, post.pubkey)
    }

    // Step 2: Fetch reactions for these posts
    const postIds = posts.map((p) => p.id)
    const reactions = await fetchReactionsForPosts(pool, postIds)
    console.log(`\nTotal reactions fetched: ${reactions.length}`)

    // Step 3: Extract stella records
    const recordMap = extractStellaRecords(reactions, postAuthors)
    const records = Array.from(recordMap.values())
    console.log(`Stella records to insert: ${records.length}`)

    if (records.length === 0) {
      console.log('No stella records found. Exiting.')
      return
    }

    // Generate SQL
    const sql = generateSQL(records, clear)
    const sqlFile = '/tmp/backfill-stella.sql'

    const fs = await import('fs')
    fs.writeFileSync(sqlFile, sql)
    console.log(`\nSQL written to: ${sqlFile}`)

    // Execute via wrangler
    console.log('\nExecuting SQL via wrangler d1...')
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${sqlFile}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
    console.log('\n✅ Backfill completed successfully!')
  } catch (error) {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  } finally {
    pool.close(RELAYS)
  }
}

main().catch(console.error)
