import type { PagesFunction } from '@cloudflare/workers-types'
import { generateHTML, truncate, extractPlainText } from '../lib/ogp-template'

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

// API endpoint for fetching events and profiles
const API_BASE = 'https://api.mypace.llll-ll.com'

export const onRequest: PagesFunction = async (context) => {
  const { params } = context
  const eventId = params.id as string

  // If not a crawler, serve the normal SPA
  const userAgent = context.request.headers.get('User-Agent') || ''
  const isCrawler =
    /bot|crawler|spider|slurp|archiver|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slack|discord|telegram|line|skype|viber|kakao|preview|fetch|embed|card|link|meta|curl|wget|http|url/i.test(
      userAgent
    )

  if (!isCrawler) {
    // Let the SPA handle the routing
    return context.next()
  }

  try {
    // Fetch event from API
    const eventResponse = await fetch(`${API_BASE}/api/events/${eventId}`)
    if (!eventResponse.ok) {
      return context.next()
    }

    const { event } = (await eventResponse.json()) as { event: NostrEvent }

    if (!event || event.kind !== 1) {
      // Only handle kind 1 (text notes)
      return context.next()
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

    // Generate OGP metadata
    const displayName = profile?.display_name || profile?.name || 'Anonymous'
    const plainText = extractPlainText(event.content)
    const description = plainText ? truncate(plainText, 200) : 'MY PACE - マイペースでいいミディアムレアSNS'
    const image = contentImage || profile?.picture || 'https://mypace.llll-ll.com/static/ogp.webp'
    const url = `https://mypace.llll-ll.com/post/${eventId}`

    const html = generateHTML({
      title: `${displayName}の投稿 - MY PACE`,
      description,
      url,
      image,
      type: 'article',
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    })
  } catch (error) {
    console.error('Error generating post OGP:', error)
    return context.next()
  }
}
