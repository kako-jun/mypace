/**
 * Delete Nostr events by publishing kind 5 deletion events
 *
 * Usage:
 *   pnpm exec tsx scripts/delete-events.ts <nsec> <event_id> [event_id2] [event_id3] ...
 *
 * Example:
 *   pnpm exec tsx scripts/delete-events.ts nsec1xxx... abc123... def456...
 *
 * Notes:
 *   - The nsec must correspond to the pubkey that created the events
 *   - Events can only be deleted by their original author
 *   - Deletion is a request to relays; some may ignore it
 *   - Supports HTTP_PROXY/HTTPS_PROXY environment variables
 */

import { finalizeEvent, nip19 } from 'nostr-tools'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

const API_BASE = process.env.API_BASE || 'https://api.mypace.llll-ll.com'

// Setup proxy if configured
const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

async function publishEvent(event: unknown): Promise<{ success: boolean; id: string; relays?: number }> {
  const res = await undiciFetch(`${API_BASE}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    dispatcher,
  })
  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error || 'Failed to publish event')
  }
  return res.json() as Promise<{ success: boolean; id: string; relays?: number }>
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: pnpm exec tsx scripts/delete-events.ts <nsec> <event_id> [event_id2] ...')
    console.error('')
    console.error('Arguments:')
    console.error('  nsec       - Your Nostr secret key (nsec1...)')
    console.error('  event_id   - Event ID(s) to delete (hex format)')
    console.error('')
    console.error('Environment:')
    console.error('  API_BASE     - API endpoint (default: https://api.mypace.llll-ll.com)')
    console.error('  HTTPS_PROXY  - Proxy URL for HTTPS requests')
    process.exit(1)
  }

  const [nsec, ...eventIds] = args

  // Validate and decode nsec
  if (!nsec.startsWith('nsec1')) {
    console.error('Error: nsec must start with "nsec1"')
    process.exit(1)
  }

  let secretKey: Uint8Array
  try {
    const decoded = nip19.decode(nsec)
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format')
    }
    secretKey = decoded.data as Uint8Array
  } catch (error) {
    console.error(`Error: Invalid nsec - ${error}`)
    process.exit(1)
  }

  // Validate event IDs (64 char hex)
  for (const id of eventIds) {
    if (!/^[0-9a-f]{64}$/i.test(id)) {
      console.error(`Error: Invalid event ID format: ${id}`)
      console.error('Event IDs must be 64-character hex strings')
      process.exit(1)
    }
  }

  console.log(`Deleting ${eventIds.length} event(s)...`)
  console.log(`Target events:`)
  for (const id of eventIds) {
    console.log(`  - ${id}`)
  }
  if (proxyUrl) {
    console.log(`Using proxy: ${proxyUrl}`)
  }
  console.log('')

  // Create kind 5 deletion event
  const template = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: eventIds.map((id) => ['e', id]),
    content: '',
  }

  const deleteEvent = finalizeEvent(template, secretKey)

  console.log(`Delete event ID: ${deleteEvent.id}`)
  console.log(`Publishing to ${API_BASE}...`)

  try {
    const result = await publishEvent(deleteEvent)
    console.log(`✓ Published successfully`)
    if (typeof result.relays === 'number') {
      console.log(`  Sent to ${result.relays} relay(s)`)
    }
  } catch (error) {
    console.error(`✗ Failed to publish: ${error}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
