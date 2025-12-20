import { Hono } from 'hono'
import type { Bindings } from '../types'

const wikidata = new Hono<{ Bindings: Bindings }>()

interface WikidataResult {
  id: string
  label: string
  description: string
  aliases: string[]
}

// エンティティ詳細を取得
async function getEntityDetails(ids: string[], language: string): Promise<Map<string, WikidataResult>> {
  if (ids.length === 0) return new Map()

  const url = new URL('https://www.wikidata.org/w/api.php')
  url.searchParams.set('action', 'wbgetentities')
  url.searchParams.set('ids', ids.join('|'))
  url.searchParams.set('props', 'labels|descriptions|aliases')
  url.searchParams.set('languages', language)
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'mypace-bot/1.0' },
  })

  if (!response.ok) return new Map()

  const data = (await response.json()) as {
    entities: Record<
      string,
      {
        id: string
        labels?: Record<string, { value: string }>
        descriptions?: Record<string, { value: string }>
        aliases?: Record<string, Array<{ value: string }>>
      }
    >
  }

  const results = new Map<string, WikidataResult>()
  for (const [id, entity] of Object.entries(data.entities)) {
    if (!entity.labels) continue
    results.set(id, {
      id,
      label: entity.labels[language]?.value || id,
      description: entity.descriptions?.[language]?.value || '',
      aliases: entity.aliases?.[language]?.map((a) => a.value) || [],
    })
  }
  return results
}

// GET /api/wikidata/search - Wikidata検索プロキシ
wikidata.get('/search', async (c) => {
  const query = c.req.query('q')
  const language = c.req.query('lang') || 'ja'

  if (!query || query.length < 1) {
    return c.json({ error: 'Query parameter required' }, 400)
  }

  try {
    // 1. 前方一致検索（wbsearchentities）
    const prefixUrl = new URL('https://www.wikidata.org/w/api.php')
    prefixUrl.searchParams.set('action', 'wbsearchentities')
    prefixUrl.searchParams.set('search', query)
    prefixUrl.searchParams.set('language', language)
    prefixUrl.searchParams.set('uselang', language)
    prefixUrl.searchParams.set('format', 'json')
    prefixUrl.searchParams.set('limit', '5')
    prefixUrl.searchParams.set('origin', '*')

    // 2. 全文検索（CirrusSearch）
    const fullTextUrl = new URL('https://www.wikidata.org/w/api.php')
    fullTextUrl.searchParams.set('action', 'query')
    fullTextUrl.searchParams.set('list', 'search')
    fullTextUrl.searchParams.set('srsearch', query)
    fullTextUrl.searchParams.set('srlimit', '10')
    fullTextUrl.searchParams.set('format', 'json')
    fullTextUrl.searchParams.set('origin', '*')

    const [prefixResponse, fullTextResponse] = await Promise.all([
      fetch(prefixUrl.toString(), { headers: { 'User-Agent': 'mypace-bot/1.0' } }),
      fetch(fullTextUrl.toString(), { headers: { 'User-Agent': 'mypace-bot/1.0' } }),
    ])

    const results: WikidataResult[] = []
    const seenIds = new Set<string>()

    // 前方一致結果を追加
    if (prefixResponse.ok) {
      const prefixData = (await prefixResponse.json()) as {
        search: Array<{ id: string; label: string; description?: string; aliases?: string[] }>
      }
      for (const item of prefixData.search) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id)
          results.push({
            id: item.id,
            label: item.label,
            description: item.description || '',
            aliases: item.aliases || [],
          })
        }
      }
    }

    // 全文検索結果を追加（エンティティ詳細を取得）
    if (fullTextResponse.ok) {
      const fullTextData = (await fullTextResponse.json()) as {
        query: { search: Array<{ title: string }> }
      }
      const newIds = fullTextData.query.search.map((s) => s.title).filter((id) => !seenIds.has(id))

      if (newIds.length > 0) {
        const details = await getEntityDetails(newIds, language)
        for (const id of newIds) {
          const detail = details.get(id)
          if (detail && !seenIds.has(id)) {
            seenIds.add(id)
            results.push(detail)
          }
        }
      }
    }

    return c.json({ results: results.slice(0, 10) })
  } catch (e) {
    console.error('Wikidata search error:', e)
    return c.json({ error: 'Failed to search Wikidata' }, 500)
  }
})

export default wikidata
