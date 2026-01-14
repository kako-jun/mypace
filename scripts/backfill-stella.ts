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

async function fetchAllReactions(): Promise<Event[]> {
  const pool = new SimplePool()
  const allEvents: Event[] = []
  let until: number | undefined = undefined
  const batchSize = 5000

  console.log('Fetching Kind 7 reactions from relays...')

  try {
    while (true) {
      const filter: { kinds: number[]; limit: number; until?: number } = {
        kinds: [7],
        limit: batchSize,
      }
      if (until) {
        filter.until = until
      }

      const events = await pool.querySync(RELAYS, filter)
      if (events.length === 0) break

      allEvents.push(...events)
      console.log(`  Fetched ${events.length} events (total: ${allEvents.length})`)

      // Get oldest event timestamp for next batch
      const oldest = Math.min(...events.map((e) => e.created_at))
      if (oldest === until) break // No more events
      until = oldest

      // Safety limit
      if (allEvents.length >= 100000) {
        console.log('  Reached safety limit of 100000 events')
        break
      }
    }
  } finally {
    pool.close(RELAYS)
  }

  return allEvents
}

function extractStellaRecords(events: Event[]): Map<string, StellaRecord> {
  // Key: `${eventId}:${reactorPubkey}`, Value: latest StellaRecord
  const recordMap = new Map<string, StellaRecord>()

  for (const event of events) {
    const tags = event.tags || []

    // Check for stella tag
    const stellaTag = tags.find((t) => t[0] === 'stella')
    if (!stellaTag || !stellaTag[1]) continue

    const stellaCount = parseInt(stellaTag[1], 10)
    if (isNaN(stellaCount) || stellaCount < 1 || stellaCount > 10) continue

    // Get target event ID and author pubkey
    const eTag = tags.find((t) => t[0] === 'e')
    const pTag = tags.find((t) => t[0] === 'p')
    if (!eTag || !eTag[1] || !pTag || !pTag[1]) continue

    const key = `${eTag[1]}:${event.pubkey}`
    const existing = recordMap.get(key)

    // Keep only the latest reaction (by created_at)
    if (!existing || event.created_at > existing.createdAt) {
      recordMap.set(key, {
        eventId: eTag[1],
        authorPubkey: pTag[1],
        reactorPubkey: event.pubkey,
        stellaCount,
        reactionId: event.id,
        createdAt: event.created_at,
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
    // Escape single quotes in IDs (though hex IDs shouldn't have them)
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

  // Fetch all reactions from relays
  const events = await fetchAllReactions()
  console.log(`\nTotal reactions fetched: ${events.length}`)

  // Extract stella records (keeping latest per user per post)
  const recordMap = extractStellaRecords(events)
  const records = Array.from(recordMap.values())
  console.log(`Stella records to insert: ${records.length}`)

  if (records.length === 0) {
    console.log('No stella records found. Exiting.')
    return
  }

  // Generate SQL
  const sql = generateSQL(records, clear)
  const sqlFile = '/tmp/backfill-stella.sql'

  // Write SQL to temp file
  const fs = await import('fs')
  fs.writeFileSync(sqlFile, sql)
  console.log(`\nSQL written to: ${sqlFile}`)

  // Execute via wrangler
  console.log('\nExecuting SQL via wrangler d1...')
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${sqlFile}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
    console.log('\n✅ Backfill completed successfully!')
  } catch (error) {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)
