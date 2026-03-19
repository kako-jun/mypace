import type { PagesFunction } from '@cloudflare/workers-types'

interface SitemapEvent {
  event_id: string
  created_at: number
}

const API_BASE = 'https://api.mypace.llll-ll.com'
const SITE_URL = 'https://mypace.llll-ll.com'

export const onRequest: PagesFunction = async () => {
  // Static pages
  const staticPages = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/settings`, changefreq: 'monthly', priority: '0.3' },
  ]

  // Fetch dynamic post events from API
  let events: SitemapEvent[] = []
  try {
    const response = await fetch(`${API_BASE}/api/sitemap/events`)
    if (response.ok) {
      const data = (await response.json()) as { events: SitemapEvent[] }
      events = data.events || []
    }
  } catch (e) {
    console.error('Sitemap fetch error:', e)
  }

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Static pages
  for (const page of staticPages) {
    xml += '  <url>\n'
    xml += `    <loc>${page.loc}</loc>\n`
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`
    xml += `    <priority>${page.priority}</priority>\n`
    xml += '  </url>\n'
  }

  // Dynamic post pages
  for (const event of events) {
    const lastmod = new Date(event.created_at * 1000).toISOString().split('T')[0]
    xml += '  <url>\n'
    xml += `    <loc>${SITE_URL}/post/${event.event_id}</loc>\n`
    xml += `    <lastmod>${lastmod}</lastmod>\n`
    xml += `    <changefreq>monthly</changefreq>\n`
    xml += `    <priority>0.7</priority>\n`
    xml += '  </url>\n'
  }

  xml += '</urlset>\n'

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
