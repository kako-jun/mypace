import { Hono } from 'hono'
import type { Bindings } from '../types'

const tweet = new Hono<{ Bindings: Bindings }>()

// GET /api/tweet/:id - ツイートデータ取得（react-tweet用）
tweet.get('/:id', async (c) => {
  const tweetId = c.req.param('id')

  if (!tweetId || !/^\d+$/.test(tweetId)) {
    return c.json({ error: 'Invalid tweet ID' }, 400)
  }

  try {
    // Twitter Syndication API
    const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`, {
      headers: {
        'User-Agent': 'mypace-bot/1.0',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Tweet not found' }, 404)
      }
      return c.json({ error: 'Failed to fetch tweet' }, 502)
    }

    const data = await response.json()
    return c.json(data)
  } catch (e) {
    console.error('Tweet fetch error:', e)
    return c.json({ error: 'Failed to fetch tweet' }, 500)
  }
})

export default tweet
