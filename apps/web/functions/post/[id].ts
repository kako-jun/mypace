import type { PagesFunction } from '@cloudflare/workers-types'

interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

interface Profile {
  name?: string
  display_name?: string
  picture?: string
}

interface Env {
  ASSETS: { fetch: typeof fetch }
}

// API endpoint for fetching events and profiles
const API_BASE = 'https://api.mypace.llll-ll.com'

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params } = context
  const eventId = params.id as string

  try {
    // Fetch event from API
    const eventResponse = await fetch(`${API_BASE}/api/events/${eventId}`)
    if (!eventResponse.ok) {
      return context.env.ASSETS.fetch(context.request)
    }

    const { event } = (await eventResponse.json()) as { event: NostrEvent }

    if (!event || !event.content) {
      return context.env.ASSETS.fetch(context.request)
    }

    // Fetch author profile
    const profileResponse = await fetch(`${API_BASE}/api/profiles?pubkeys=${event.pubkey}`)
    const profileData = profileResponse.ok
      ? ((await profileResponse.json()) as { profiles: Record<string, Profile> })
      : null
    const profile = profileData?.profiles[event.pubkey]

    // Extract image from content if exists
    const imageMatch = event.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i)
    const contentImage = imageMatch ? imageMatch[0] : null

    // Get the original index.html
    const assetResponse = await context.env.ASSETS.fetch(new Request('https://dummy/index.html'))
    let html = await assetResponse.text()

    // Generate OGP metadata
    const displayName = escapeHtml(profile?.display_name || profile?.name || 'Anonymous')
    const plainText = extractPlainText(event.content)
    const description = escapeHtml(plainText ? truncate(plainText, 200) : 'MY PACE - マイペースでいいミディアムレアSNS')
    const image = contentImage || profile?.picture || 'https://mypace.llll-ll.com/static/ogp.webp'
    const url = `https://mypace.llll-ll.com/post/${eventId}`

    // Replace OGP meta tags in HTML
    html = html
      // Title
      .replace(/<title>.*?<\/title>/, `<title>${displayName}の投稿 - MY PACE</title>`)
      .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
      // Canonical
      .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${url}" />`)
      // Open Graph
      .replace(/<meta property="og:type" content=".*?" \/>/, `<meta property="og:type" content="article" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${url}" />`)
      .replace(
        /<meta property="og:title" content=".*?" \/>/,
        `<meta property="og:title" content="${displayName}の投稿 - MY PACE" />`
      )
      .replace(
        /<meta property="og:description" content=".*?" \/>/,
        `<meta property="og:description" content="${description}" />`
      )
      .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${image}" />`)
      // Twitter Card
      .replace(/<meta name="twitter:url" content=".*?" \/>/, `<meta name="twitter:url" content="${url}" />`)
      .replace(
        /<meta name="twitter:title" content=".*?" \/>/,
        `<meta name="twitter:title" content="${displayName}の投稿 - MY PACE" />`
      )
      .replace(
        /<meta name="twitter:description" content=".*?" \/>/,
        `<meta name="twitter:description" content="${description}" />`
      )
      .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${image}" />`)

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('Error generating post OGP:', error)
    return context.env.ASSETS.fetch(context.request)
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

function extractPlainText(content: string): string {
  return content
    .replace(/nostr:(npub|note|nprofile|nevent)[a-z0-9]+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/#\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
