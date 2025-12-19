import { Hono } from 'hono'
import type { Bindings } from '../types'

const ogp = new Hono<{ Bindings: Bindings }>()

// GET /api/ogp - OGPメタデータ取得
ogp.get('/', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.json({ error: 'URL is required' }, 400)
  }

  try {
    // Validate URL
    new URL(url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (+https://mypace.pages.dev)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch URL' }, 502)
    }

    const html = await response.text()

    // Extract OGP meta tags
    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
      const match = html.match(regex)
      if (match) return match[1]

      // Try reverse order (content before property)
      const reverseRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        'i'
      )
      const reverseMatch = html.match(reverseRegex)
      return reverseMatch?.[1]
    }

    const getTitle = (): string | undefined => {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      return titleMatch?.[1]
    }

    const title = getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle()
    const description =
      getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description')
    const image = getMetaContent('og:image') || getMetaContent('twitter:image')
    const siteName = getMetaContent('og:site_name')

    return c.json({
      title,
      description,
      image,
      siteName,
    })
  } catch (e) {
    console.error('OGP fetch error:', e)
    return c.json({ error: 'Failed to fetch OGP' }, 500)
  }
})

export default ogp
