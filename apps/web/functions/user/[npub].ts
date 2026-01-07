import { nip19 } from 'nostr-tools'
import type { PagesFunction } from '@cloudflare/workers-types'
import { generateHTML, truncate } from '../lib/ogp-template'

interface Profile {
  name?: string
  display_name?: string
  about?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string
}

// API endpoint for fetching profile
const API_BASE = 'https://api.mypace.llll-ll.com'

export const onRequest: PagesFunction = async (context) => {
  const { params } = context
  const npub = params.npub as string

  // If not a crawler, serve the normal SPA
  const userAgent = context.request.headers.get('User-Agent') || ''
  const isCrawler =
    /bot|crawler|spider|slurp|archiver|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slack|discord|telegram|line|skype|viber|kakao|preview|fetch|embed|card|link|meta|curl|wget|http|url|rakko|checker|validator|parser|scraper|analyzer|HeadlessChrome|Phantom|libwww|python|ruby|java|go-http|axios|node-fetch|got\//i.test(
      userAgent
    )

  if (!isCrawler) {
    // Let the SPA handle the routing
    return context.next()
  }

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
        return context.next()
      }
    } catch {
      return context.next()
    }

    // Fetch profile from API
    const profileResponse = await fetch(`${API_BASE}/api/profiles?pubkeys=${pubkey}`)
    if (!profileResponse.ok) {
      return context.next()
    }

    const { profiles } = (await profileResponse.json()) as { profiles: Record<string, Profile> }
    const profile = profiles[pubkey]

    if (!profile) {
      return context.next()
    }

    // Generate OGP metadata
    const displayName = profile.display_name || profile.name || 'Anonymous'
    const description = profile.about ? truncate(profile.about, 200) : 'MY PACE - マイペースでいいミディアムレアSNS'
    const image = profile.picture || profile.banner || 'https://mypace.llll-ll.com/static/ogp.webp'
    const url = `https://mypace.llll-ll.com/user/${npub}`

    const html = generateHTML({
      title: `${displayName} - MY PACE`,
      description,
      url,
      image,
      type: 'profile',
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    })
  } catch (error) {
    console.error('Error generating user OGP:', error)
    return context.next()
  }
}
