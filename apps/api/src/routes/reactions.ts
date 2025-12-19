import { Hono } from 'hono'
import type { Event } from 'nostr-tools'
import type { Bindings } from '../types'
import { RELAYS, STELLA_TAG } from '../constants'
import { SimplePool } from 'nostr-tools/pool'

const reactions = new Hono<{ Bindings: Bindings }>()

// Get stella count from reaction event tags
function getStellaCount(event: Event): number {
  const stellaTag = event.tags.find((t) => t[0] === STELLA_TAG)
  if (stellaTag && stellaTag[1]) {
    const count = parseInt(stellaTag[1], 10)
    return isNaN(count) ? 1 : count
  }
  return 1 // Default to 1 for reactions without stella tag
}

// GET /api/reactions/:eventId - リアクション取得
reactions.get('/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { kinds: [7], '#e': [eventId] })

    // Group reactions by pubkey, keeping only the newest one per user
    const reactorMap = new Map<string, { pubkey: string; stella: number; reactionId: string; createdAt: number }>()
    for (const e of events) {
      const existing = reactorMap.get(e.pubkey)
      // Keep the newest reaction for each user
      if (!existing || e.created_at > existing.createdAt) {
        reactorMap.set(e.pubkey, {
          pubkey: e.pubkey,
          stella: getStellaCount(e),
          reactionId: e.id,
          createdAt: e.created_at,
        })
      }
    }

    // Build list of reactors (sorted by newest first)
    const reactors = Array.from(reactorMap.values()).sort((a, b) => b.createdAt - a.createdAt)

    // Sum stella from deduplicated reactors
    const count = reactors.reduce((sum, r) => sum + r.stella, 0)

    // Find user's reaction
    let myStella = 0
    let myReactionId: string | null = null
    if (pubkey) {
      const myReaction = reactorMap.get(pubkey)
      if (myReaction) {
        myStella = myReaction.stella
        myReactionId = myReaction.reactionId
      }
    }

    return c.json({ count, myReaction: myStella > 0, myStella, myReactionId, reactors })
  } finally {
    pool.close(RELAYS)
  }
})

export default reactions
