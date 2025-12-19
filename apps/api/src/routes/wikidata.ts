import { Hono } from 'hono'
import type { Bindings } from '../types'

const wikidata = new Hono<{ Bindings: Bindings }>()

// GET /api/wikidata/search - Wikidata検索プロキシ
wikidata.get('/search', async (c) => {
  const query = c.req.query('q')
  const language = c.req.query('lang') || 'ja'

  if (!query || query.length < 1) {
    return c.json({ error: 'Query parameter required' }, 400)
  }

  try {
    const url = new URL('https://www.wikidata.org/w/api.php')
    url.searchParams.set('action', 'wbsearchentities')
    url.searchParams.set('search', query)
    url.searchParams.set('language', language)
    url.searchParams.set('uselang', language)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '10')
    url.searchParams.set('origin', '*')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'mypace-bot/1.0',
      },
    })

    if (!response.ok) {
      return c.json({ error: 'Wikidata API error' }, 502)
    }

    const data = (await response.json()) as {
      search: Array<{
        id: string
        label: string
        description?: string
        aliases?: string[]
      }>
    }

    // 結果を整形して返す
    const results = data.search.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description || '',
      aliases: item.aliases || [],
    }))

    return c.json({ results })
  } catch (e) {
    console.error('Wikidata search error:', e)
    return c.json({ error: 'Failed to search Wikidata' }, 500)
  }
})

export default wikidata
