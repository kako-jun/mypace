import { nip19 } from 'nostr-tools'
import type { PagesFunction } from '@cloudflare/workers-types'

interface Profile {
  name?: string
  display_name?: string
  about?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string
}

interface Env {
  ASSETS: { fetch: typeof fetch }
}

// API endpoint for fetching profile
const API_BASE = 'https://api.mypace.llll-ll.com'

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params } = context
  const npub = params.npub as string

  try {
    // Decode npub to hex pubkey
    let pubkey: string
    try {
      const decoded = nip19.decode(npub)
      if (decoded.type === 'npub') {
        pubkey = decoded.data
      } else if (decoded.type === 'nprofile') {
        pubkey = decoded.data.pubkey
      } else {
        // Invalid format, serve static index.html
        return context.env.ASSETS.fetch(context.request)
      }
    } catch {
      // Decode error, serve static index.html
      return context.env.ASSETS.fetch(context.request)
    }

    // Fetch profile from API
    const profileResponse = await fetch(`${API_BASE}/api/profiles?pubkeys=${pubkey}`)
    if (!profileResponse.ok) {
      return context.env.ASSETS.fetch(context.request)
    }

    const { profiles } = (await profileResponse.json()) as { profiles: Record<string, Profile> }
    const profile = profiles[pubkey]

    if (!profile) {
      return context.env.ASSETS.fetch(context.request)
    }

    // Get the original index.html
    const assetResponse = await context.env.ASSETS.fetch(new Request('https://dummy/index.html'))
    let html = await assetResponse.text()

    // Generate OGP metadata
    const displayName = escapeHtml(profile.display_name || profile.name || 'Anonymous')
    const description = escapeHtml(
      profile.about ? truncate(profile.about, 200) : 'MY PACE - マイペースでいいミディアムレアSNS'
    )
    const image = profile.picture || profile.banner || 'https://mypace.llll-ll.com/static/ogp.webp'
    const url = `https://mypace.llll-ll.com/user/${npub}`

    // Replace OGP meta tags in HTML
    html = html
      // Title
      .replace(/<title>.*?<\/title>/, `<title>${displayName} - MY PACE</title>`)
      .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
      // Canonical
      .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${url}" />`)
      // Open Graph
      .replace(/<meta property="og:type" content=".*?" \/>/, `<meta property="og:type" content="profile" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${url}" />`)
      .replace(
        /<meta property="og:title" content=".*?" \/>/,
        `<meta property="og:title" content="${displayName} - MY PACE" />`
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
        `<meta name="twitter:title" content="${displayName} - MY PACE" />`
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
    console.error('Error generating user OGP:', error)
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
