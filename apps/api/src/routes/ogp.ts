import { Hono } from 'hono'
import type { Bindings } from '../types'
import { cleanupOgpCache } from '../services/cache'
import { CACHE_CLEANUP_PROBABILITY, CACHE_TTL_OGP, TIMEOUT_MS_FETCH, OGP_BATCH_LIMIT } from '../constants'
import { getCurrentTimestamp } from '../utils'

interface OgpData {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

const ogp = new Hono<{ Bindings: Bindings }>()

// OGPをHTMLから抽出する共通関数
function extractOgpFromHtml(html: string): OgpData {
  const getMetaContent = (property: string): string | undefined => {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
    const match = html.match(regex)
    if (match) return match[1]

    // Try reverse order (content before property)
    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i')
    const reverseMatch = html.match(reverseRegex)
    return reverseMatch?.[1]
  }

  const getTitle = (): string | undefined => {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return titleMatch?.[1]
  }

  return {
    title: getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle(),
    description:
      getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description'),
    image: getMetaContent('og:image') || getMetaContent('twitter:image'),
    siteName: getMetaContent('og:site_name'),
  }
}

// URLのバリデーション
function validateUrl(url: string): URL | null {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null
    }
    if (/[`<>{}|\\^~[\]]/.test(url)) {
      return null
    }
    const blockedDomains = ['example.com', 'example.org', 'example.net', 'localhost', '127.0.0.1']
    if (blockedDomains.some((d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d))) {
      return null
    }
    return parsedUrl
  } catch {
    return null
  }
}

// HTMLをcharsetを考慮してデコード
function decodeHtml(buffer: ArrayBuffer, contentType: string | null): string {
  // Content-Typeヘッダーからcharsetを取得
  let headerCharset: string | null = null
  if (contentType) {
    const match = contentType.match(/charset=([^\s;]+)/i)
    if (match) {
      headerCharset = match[1].toLowerCase().replace(/['"]/g, '')
    }
  }

  // ヘッダーでcharsetが指定されていてUTF-8でない場合は直接デコード
  if (headerCharset && headerCharset !== 'utf-8') {
    try {
      const decoder = new TextDecoder(headerCharset, { fatal: false, ignoreBOM: false })
      return decoder.decode(buffer)
    } catch {
      // デコーダーがサポートしていない場合はフォールバック
    }
  }

  // まずUTF-8として試す
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false })
  const html = utf8Decoder.decode(buffer)

  // HTMLからmeta charsetを検出
  const metaCharsetMatch = html.match(/<meta[^>]*charset=["']?([^"'\s>]+)/i)
  const metaHttpEquivMatch = html.match(
    /<meta[^>]*http-equiv=["']?Content-Type["']?[^>]*content=["'][^"']*charset=([^"'\s;]+)/i
  )
  const detectedCharset = (metaCharsetMatch?.[1] || metaHttpEquivMatch?.[1])?.toLowerCase()

  if (detectedCharset && detectedCharset !== 'utf-8') {
    try {
      // 検出されたcharsetで再デコード
      const decoder = new TextDecoder(detectedCharset, { fatal: false, ignoreBOM: false })
      return decoder.decode(buffer)
    } catch {
      // デコーダーがサポートしていない場合はUTF-8のまま
    }
  }

  return html
}

// 単一URLのOGP取得
async function fetchSingleOgp(url: string): Promise<OgpData | null> {
  if (!validateUrl(url)) return null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS_FETCH)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (+https://mypace.llll-ll.com)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) return null

    // charsetを検出してデコード
    const arrayBuffer = await response.arrayBuffer()
    const html = decodeHtml(arrayBuffer, response.headers.get('content-type'))
    return extractOgpFromHtml(html)
  } catch {
    return null
  }
}

// POST /api/ogp/by-urls - 複数URLのOGP一括取得
ogp.post('/by-urls', async (c) => {
  const disableCache = c.env.DISABLE_CACHE === '1'
  const { urls } = await c.req.json<{ urls: string[] }>()

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return c.json({})
  }

  // Limit batch size
  const limitedUrls = [...new Set(urls)].slice(0, OGP_BATCH_LIMIT)
  const db = c.env.DB
  const result: Record<string, OgpData> = {}

  // D1キャッシュから取得（DISABLE_CACHE=1 の場合はスキップ）
  const uncachedUrls: string[] = []
  if (!disableCache) {
    try {
      const placeholders = limitedUrls.map(() => '?').join(',')
      const now = getCurrentTimestamp()
      const cached = await db
        .prepare(
          `SELECT url, title, description, image, site_name FROM ogp_cache WHERE url IN (${placeholders}) AND expires_at > ?`
        )
        .bind(...limitedUrls, now)
        .all()

      const cachedUrls = new Set<string>()
      for (const row of cached.results || []) {
        const url = row.url as string
        cachedUrls.add(url)
        result[url] = {
          title: row.title as string | undefined,
          description: row.description as string | undefined,
          image: row.image as string | undefined,
          siteName: row.site_name as string | undefined,
        }
      }

      for (const url of limitedUrls) {
        if (!cachedUrls.has(url)) {
          uncachedUrls.push(url)
        }
      }
    } catch (e) {
      console.error('OGP cache read error:', e)
      uncachedUrls.push(...limitedUrls)
    }
  } else {
    uncachedUrls.push(...limitedUrls)
  }

  // 未キャッシュのURLを並列fetch
  if (uncachedUrls.length > 0) {
    const fetchPromises = uncachedUrls.map(async (url) => {
      const ogpData = await fetchSingleOgp(url)
      return { url, ogpData }
    })

    const fetchResults = await Promise.all(fetchPromises)
    const now = getCurrentTimestamp()
    const expiresAt = now + CACHE_TTL_OGP

    // バッチINSERTのためのデータ準備
    const cacheData: Array<{ url: string; ogpData: OgpData }> = []
    for (const { url, ogpData } of fetchResults) {
      if (ogpData && (ogpData.title || ogpData.description || ogpData.image)) {
        result[url] = ogpData
        cacheData.push({ url, ogpData })
      }
    }

    // バッチINSERTでキャッシュに保存（DISABLE_CACHE=1 の場合はスキップ）
    if (!disableCache && cacheData.length > 0) {
      const values: string[] = []
      const params: any[] = []

      for (const { url, ogpData } of cacheData) {
        values.push('(?, ?, ?, ?, ?, ?, ?)')
        params.push(
          url,
          ogpData.title || null,
          ogpData.description || null,
          ogpData.image || null,
          ogpData.siteName || null,
          now,
          expiresAt
        )
      }

      try {
        await db
          .prepare(
            `INSERT OR REPLACE INTO ogp_cache (url, title, description, image, site_name, created_at, expires_at) VALUES ${values.join(', ')}`
          )
          .bind(...params)
          .run()
      } catch (e) {
        console.error('OGP cache batch write error:', e)
      }
    }
  }

  // 1%の確率でOGPキャッシュをクリーンアップ（非同期、DISABLE_CACHE=1 の場合はスキップ）
  if (!disableCache && Math.random() < CACHE_CLEANUP_PROBABILITY) {
    c.executionCtx.waitUntil(cleanupOgpCache(db))
  }

  return c.json(result)
})

export default ogp
