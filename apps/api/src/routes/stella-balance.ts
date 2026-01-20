import { Hono } from 'hono'
import type { Bindings } from '../types'

const stellaBalance = new Hono<{ Bindings: Bindings }>()

interface StellaBalance {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

// GET /api/stella-balance/:pubkey - Get user's stella balance
stellaBalance.get('/:pubkey', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const db = c.env.DB

  try {
    const result = await db
      .prepare(
        `SELECT yellow, green, red, blue, purple, updated_at
         FROM user_stella_balance
         WHERE pubkey = ?`
      )
      .bind(pubkey)
      .first<StellaBalance & { updated_at: number }>()

    if (!result) {
      // Return default balance if user doesn't have a record yet
      return c.json({
        pubkey,
        balance: {
          yellow: 0,
          green: 0,
          red: 0,
          blue: 0,
          purple: 0,
        },
        updatedAt: null,
      })
    }

    return c.json({
      pubkey,
      balance: {
        yellow: result.yellow,
        green: result.green,
        red: result.red,
        blue: result.blue,
        purple: result.purple,
      },
      updatedAt: result.updated_at,
    })
  } catch (e) {
    console.error('Stella balance fetch error:', e)
    return c.json({ error: 'Failed to fetch stella balance' }, 500)
  }
})

// POST /api/stella-balance/send - Send stella (decrease sender's balance)
stellaBalance.post('/send', async (c) => {
  const body = await c.req.json<{
    senderPubkey: string
    amounts: Partial<StellaBalance>
  }>()

  const { senderPubkey, amounts } = body

  if (!senderPubkey || senderPubkey.length !== 64) {
    return c.json({ error: 'Invalid sender pubkey' }, 400)
  }

  if (!amounts || typeof amounts !== 'object') {
    return c.json({ error: 'Invalid amounts' }, 400)
  }

  const db = c.env.DB

  try {
    // Get current balance
    const currentBalance = await db
      .prepare(
        `SELECT yellow, green, red, blue, purple
         FROM user_stella_balance
         WHERE pubkey = ?`
      )
      .bind(senderPubkey)
      .first<StellaBalance>()

    if (!currentBalance) {
      return c.json({ error: 'Insufficient balance' }, 400)
    }

    // Check if user has enough balance for each color
    const colors: (keyof StellaBalance)[] = ['yellow', 'green', 'red', 'blue', 'purple']
    for (const color of colors) {
      const amountToSend = amounts[color] || 0
      if (amountToSend > 0 && currentBalance[color] < amountToSend) {
        return c.json({ error: `Insufficient ${color} stella balance` }, 400)
      }
    }

    // Calculate new balance
    const newBalance: StellaBalance = {
      yellow: currentBalance.yellow - (amounts.yellow || 0),
      green: currentBalance.green - (amounts.green || 0),
      red: currentBalance.red - (amounts.red || 0),
      blue: currentBalance.blue - (amounts.blue || 0),
      purple: currentBalance.purple - (amounts.purple || 0),
    }

    // Update balance
    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare(
        `UPDATE user_stella_balance
         SET yellow = ?, green = ?, red = ?, blue = ?, purple = ?, updated_at = ?
         WHERE pubkey = ?`
      )
      .bind(newBalance.yellow, newBalance.green, newBalance.red, newBalance.blue, newBalance.purple, now, senderPubkey)
      .run()

    return c.json({
      success: true,
      newBalance,
    })
  } catch (e) {
    console.error('Stella send error:', e)
    return c.json({ error: 'Failed to send stella' }, 500)
  }
})

// POST /api/stella-balance/add - Add stella to user's balance (for Supernova rewards)
stellaBalance.post('/add', async (c) => {
  const body = await c.req.json<{
    pubkey: string
    amounts: Partial<StellaBalance>
  }>()

  const { pubkey, amounts } = body

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  if (!amounts || typeof amounts !== 'object') {
    return c.json({ error: 'Invalid amounts' }, 400)
  }

  const db = c.env.DB
  const now = Math.floor(Date.now() / 1000)

  try {
    // Upsert balance
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
        now
      )
      .run()

    // Get updated balance
    const result = await db
      .prepare(
        `SELECT yellow, green, red, blue, purple
         FROM user_stella_balance
         WHERE pubkey = ?`
      )
      .bind(pubkey)
      .first<StellaBalance>()

    return c.json({
      success: true,
      newBalance: result,
    })
  } catch (e) {
    console.error('Stella add error:', e)
    return c.json({ error: 'Failed to add stella' }, 500)
  }
})

export default stellaBalance
