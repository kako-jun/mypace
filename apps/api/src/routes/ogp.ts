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
    const parsedUrl = new URL(url)

    // Only allow http/https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return c.json({ error: 'Invalid URL protocol' }, 400)
    }

    // Reject URLs with suspicious characters (backticks, etc.)
    if (/[`<>{}|\\^~[\]]/.test(url)) {
      return c.json({ error: 'Invalid URL characters' }, 400)
    }

    // Block reserved/test domains that don't serve real content
    const blockedDomains = ['example.com', 'example.org', 'example.net', 'localhost', '127.0.0.1']
    if (blockedDomains.some((d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d))) {
      return c.json({ error: 'Reserved domain' }, 400)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (+https://mypace.llll-ll.com)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

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
    if (e instanceof TypeError && e.message.includes('Invalid URL')) {
      return c.json({ error: 'Invalid URL format' }, 400)
    }
    if (e instanceof DOMException && e.name === 'AbortError') {
      return c.json({ error: 'Request timeout' }, 504)
    }
    console.error('OGP fetch error:', e)
    return c.json({ error: 'Failed to fetch OGP' }, 500)
  }
})

export default ogp
