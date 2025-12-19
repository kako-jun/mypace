import { nip19 } from 'nostr-tools'
import type { Profile, ProfileCache } from '../../types'
import { getItem, setItem, removeItem } from './storage'
import { STORAGE_KEYS } from '../constants'
import { t } from '../i18n'

// Service label detection from URL
export function detectServiceLabel(url: string): string {
  const lowered = url.toLowerCase()

  // Global services
  if (lowered.includes('github.com')) return 'GitHub'
  if (lowered.includes('twitter.com') || lowered.includes('x.com')) return 'Twitter'
  if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'YouTube'
  if (lowered.includes('instagram.com')) return 'Instagram'
  if (lowered.includes('linkedin.com')) return 'LinkedIn'
  if (lowered.includes('facebook.com')) return 'Facebook'
  if (lowered.includes('bsky.app')) return 'Bluesky'
  if (lowered.includes('twitch.tv')) return 'Twitch'
  if (lowered.includes('discord.gg') || lowered.includes('discord.com')) return 'Discord'
  if (lowered.includes('reddit.com')) return 'Reddit'
  if (lowered.includes('medium.com')) return 'Medium'
  if (lowered.includes('substack.com')) return 'Substack'
  if (lowered.includes('tiktok.com')) return 'TikTok'
  if (lowered.includes('threads.net')) return 'Threads'
  if (lowered.includes('mastodon.') || lowered.includes('mstdn.')) return 'Mastodon'
  if (lowered.includes('gitlab.com')) return 'GitLab'
  if (lowered.includes('bitbucket.org')) return 'Bitbucket'
  if (lowered.includes('stackoverflow.com')) return 'Stack Overflow'
  if (lowered.includes('dev.to')) return 'DEV'
  if (lowered.includes('hashnode.')) return 'Hashnode'
  if (lowered.includes('patreon.com')) return 'Patreon'
  if (lowered.includes('ko-fi.com')) return 'Ko-fi'
  if (lowered.includes('buymeacoffee.com')) return 'Buy Me a Coffee'
  if (lowered.includes('paypal.me') || lowered.includes('paypal.com')) return 'PayPal'
  if (lowered.includes('spotify.com')) return 'Spotify'
  if (lowered.includes('soundcloud.com')) return 'SoundCloud'
  if (lowered.includes('bandcamp.com')) return 'Bandcamp'
  if (lowered.includes('apple.com/music') || lowered.includes('music.apple.com')) return 'Apple Music'
  if (lowered.includes('dribbble.com')) return 'Dribbble'
  if (lowered.includes('behance.net')) return 'Behance'
  if (lowered.includes('figma.com')) return 'Figma'
  if (lowered.includes('codepen.io')) return 'CodePen'
  if (lowered.includes('producthunt.com')) return 'Product Hunt'
  if (lowered.includes('goodreads.com')) return 'Goodreads'
  if (lowered.includes('letterboxd.com')) return 'Letterboxd'
  if (lowered.includes('pinterest.com') || lowered.includes('pinterest.jp')) return 'Pinterest'
  if (lowered.includes('tumblr.com')) return 'Tumblr'
  if (lowered.includes('vimeo.com')) return 'Vimeo'
  if (lowered.includes('dailymotion.com')) return 'Dailymotion'
  if (lowered.includes('telegram.me') || lowered.includes('t.me')) return 'Telegram'
  if (lowered.includes('signal.org')) return 'Signal'
  if (lowered.includes('whatsapp.com')) return 'WhatsApp'
  if (lowered.includes('line.me')) return 'LINE'
  if (lowered.includes('wechat.com')) return 'WeChat'
  if (lowered.includes('snapchat.com')) return 'Snapchat'
  if (lowered.includes('steam')) return 'Steam'
  if (lowered.includes('itch.io')) return 'itch.io'
  if (lowered.includes('finalfantasyxiv.com')) return 'FF14'
  if (lowered.includes('playstation.com')) return 'PlayStation'
  if (lowered.includes('xbox.com')) return 'Xbox'
  if (lowered.includes('nintendo.')) return 'Nintendo'
  if (lowered.includes('gumroad.com')) return 'Gumroad'
  if (lowered.includes('notion.so') || lowered.includes('notion.site')) return 'Notion'
  if (lowered.includes('opensea.io')) return 'OpenSea'
  if (lowered.includes('amazon.')) return 'Amazon'
  if (lowered.includes('etsy.com')) return 'Etsy'

  // Japanese services
  if (lowered.includes('qiita.com')) return 'Qiita'
  if (lowered.includes('zenn.dev')) return 'Zenn'
  if (lowered.includes('note.com')) return 'note'
  if (lowered.includes('hatenablog.com') || lowered.includes('hatenadiary.')) return 'はてなブログ'
  if (lowered.includes('b.hatena.ne.jp')) return 'はてブ'
  if (lowered.includes('hatena.ne.jp')) return 'はてな'
  if (lowered.includes('pixiv.net')) return 'Pixiv'
  if (lowered.includes('fanbox.cc')) return 'FANBOX'
  if (lowered.includes('booth.pm')) return 'BOOTH'
  if (lowered.includes('nicovideo.jp') || lowered.includes('nico.ms')) return 'ニコニコ'
  if (lowered.includes('mixi.jp')) return 'mixi'
  if (lowered.includes('mixi2.us')) return 'mixi2'
  if (lowered.includes('ameblo.jp') || lowered.includes('ameba.jp')) return 'Ameba'
  if (lowered.includes('fc2.com')) return 'FC2'
  if (lowered.includes('livedoor.jp') || lowered.includes('blog.jp')) return 'livedoor'
  if (lowered.includes('cocolog-nifty.com')) return 'ココログ'
  if (lowered.includes('connpass.com')) return 'connpass'
  if (lowered.includes('doorkeeper.jp')) return 'Doorkeeper'
  if (lowered.includes('wantedly.com')) return 'Wantedly'
  if (lowered.includes('speakerdeck.com')) return 'Speaker Deck'
  if (lowered.includes('slideshare.net')) return 'SlideShare'
  if (lowered.includes('lit.link')) return 'lit.link'
  if (lowered.includes('linktr.ee')) return 'Linktree'
  if (lowered.includes('potofu.me')) return 'POTOFU'
  if (lowered.includes('suzuri.jp')) return 'SUZURI'
  if (lowered.includes('minne.com')) return 'minne'
  if (lowered.includes('creema.jp')) return 'Creema'
  if (lowered.includes('stores.jp')) return 'STORES'
  if (lowered.includes('base.shop') || lowered.includes('thebase.in')) return 'BASE'
  if (lowered.includes('mercari.com')) return 'メルカリ'
  if (lowered.includes('rakuten.co.jp')) return '楽天'
  if (lowered.includes('yahoo.co.jp')) return 'Yahoo! JAPAN'
  if (lowered.includes('showroom-live.com')) return 'SHOWROOM'
  if (lowered.includes('17live.jp') || lowered.includes('17.live')) return '17LIVE'
  if (lowered.includes('pococha.com')) return 'Pococha'
  if (lowered.includes('bilibili.com')) return 'bilibili'

  return 'Website'
}

// Website with required label (returned by getWebsites)
export interface ResolvedWebsite {
  url: string
  label: string
}

// Get websites from profile with fallback
export function getWebsites(profile: Profile | null | undefined): ResolvedWebsite[] {
  if (!profile) return []
  // Use websites array if available
  if (profile.websites && profile.websites.length > 0) {
    return profile.websites.map((w) => ({
      url: w.url,
      label: w.label || detectServiceLabel(w.url),
    }))
  }
  // Fallback to single website
  if (profile.website) {
    return [
      {
        url: profile.website,
        label: detectServiceLabel(profile.website),
      },
    ]
  }
  return []
}

// Get icon name for service (lucide-react icons)
export function getWebsiteIcon(label: string): string {
  switch (label) {
    // Social / SNS
    case 'GitHub':
      return 'Github'
    case 'GitLab':
      return 'Gitlab'
    case 'Twitter':
      return 'Twitter'
    case 'YouTube':
      return 'Youtube'
    case 'Instagram':
      return 'Instagram'
    case 'LinkedIn':
      return 'Linkedin'
    case 'Facebook':
      return 'Facebook'
    case 'Twitch':
      return 'Twitch'
    case 'Discord':
      return 'MessageCircle'
    case 'Slack':
      return 'Slack'
    case 'Figma':
      return 'Figma'
    case 'Dribbble':
      return 'Dribbble'
    case 'CodePen':
      return 'Codepen'
    case 'Pinterest':
      return 'Pin'
    case 'Chrome Web Store':
      return 'Chrome'

    // Messaging
    case 'Telegram':
      return 'Send'
    case 'WhatsApp':
    case 'LINE':
    case 'Signal':
      return 'MessageCircle'
    case 'Reddit':
      return 'MessageSquare'

    // Music / Audio
    case 'Spotify':
    case 'Apple Music':
    case 'SoundCloud':
    case 'Bandcamp':
      return 'Music'

    // Video
    case 'Vimeo':
    case 'Dailymotion':
    case 'TikTok':
    case 'ニコニコ':
    case 'bilibili':
    case 'SHOWROOM':
    case '17LIVE':
    case 'Pococha':
      return 'Video'

    // Blog / Writing
    case 'Medium':
    case 'Substack':
    case 'DEV':
    case 'Hashnode':
    case 'Qiita':
    case 'Zenn':
    case 'note':
    case 'はてなブログ':
    case 'はてな':
    case 'Ameba':
    case 'FC2':
    case 'livedoor':
    case 'ココログ':
    case 'Tumblr':
      return 'FileText'

    // Bookmarks
    case 'はてブ':
      return 'Bookmark'

    // Art / Design
    case 'Behance':
    case 'Pixiv':
    case 'FANBOX':
      return 'Palette'

    // Shopping / Commerce
    case 'Amazon':
    case 'Etsy':
    case 'BOOTH':
    case 'SUZURI':
    case 'minne':
    case 'Creema':
    case 'STORES':
    case 'BASE':
    case 'Gumroad':
    case 'メルカリ':
    case '楽天':
      return 'ShoppingBag'

    // Donation / Support
    case 'Patreon':
    case 'Ko-fi':
    case 'Buy Me a Coffee':
      return 'Heart'

    // Payment
    case 'PayPal':
      return 'CreditCard'

    // Gaming
    case 'Steam':
    case 'itch.io':
    case 'FF14':
    case 'PlayStation':
    case 'Xbox':
    case 'Nintendo':
      return 'Gamepad2'

    // Events
    case 'connpass':
    case 'Doorkeeper':
      return 'Calendar'

    // Careers
    case 'Wantedly':
      return 'Briefcase'

    // Presentations
    case 'Speaker Deck':
    case 'SlideShare':
      return 'Presentation'

    // Link aggregators
    case 'lit.link':
    case 'Linktree':
    case 'POTOFU':
      return 'Link'

    // Productivity
    case 'Notion':
      return 'BookOpen'

    // Misc
    case 'Stack Overflow':
      return 'HelpCircle'
    case 'Product Hunt':
      return 'Rocket'
    case 'Goodreads':
    case 'Letterboxd':
      return 'BookOpen'
    case 'OpenSea':
      return 'Gem'
    case 'Mastodon':
    case 'Bluesky':
    case 'Threads':
      return 'AtSign'
    case 'Bitbucket':
      return 'GitBranch'
    case 'Yahoo! JAPAN':
      return 'Search'
    case 'mixi':
    case 'mixi2':
    case 'Snapchat':
    case 'WeChat':
      return 'Users'

    default:
      return 'Globe'
  }
}

export function getLocalProfile(): Profile | null {
  return getItem<Profile | null>(STORAGE_KEYS.PROFILE, null)
}

export function setLocalProfile(profile: Profile): void {
  setItem(STORAGE_KEYS.PROFILE, profile)
}

export function removeLocalProfile(): void {
  removeItem(STORAGE_KEYS.PROFILE)
}

export function hasLocalProfile(): boolean {
  const profile = getLocalProfile()
  return !!(profile?.name || profile?.display_name)
}

// Validate hex string length (pubkeys should be 64 chars)
function isValidPubkey(pubkey: string): boolean {
  return typeof pubkey === 'string' && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)
}

// Get display name from profile
// - undefined: still loading, show short npub
// - null: confirmed no profile, show anonymous name
// - Profile: show display_name or name
export function getDisplayName(profile: Profile | null | undefined, pubkey: string): string {
  if (profile?.display_name) return profile.display_name
  if (profile?.name) return profile.name
  // Still loading - show short npub
  if (profile === undefined) {
    // Validate pubkey before encoding
    if (isValidPubkey(pubkey)) {
      try {
        const npub = nip19.npubEncode(pubkey)
        return npub.slice(0, 12) + '...'
      } catch {
        // Fall through to anonymous name
      }
    }
    // Invalid pubkey - show truncated hex
    return pubkey.slice(0, 8) + '...'
  }
  // Confirmed no profile - show anonymous name
  return t('anonymousName')
}

// Get avatar URL from profile
export function getAvatarUrl(profile: Profile | null | undefined): string | null {
  return profile?.picture || null
}

// Helper to get display name from cache
export function getDisplayNameFromCache(pubkey: string, profiles: ProfileCache): string {
  return getDisplayName(profiles[pubkey], pubkey)
}

// Helper to get avatar URL from cache
export function getAvatarUrlFromCache(pubkey: string, profiles: ProfileCache): string | null {
  return getAvatarUrl(profiles[pubkey])
}

// Verify NIP-05 identifier
export async function verifyNip05(nip05: string, pubkey: string): Promise<boolean> {
  try {
    // Parse nip05: user@domain or _@domain
    const match = nip05.match(/^([^@]+)@(.+)$/)
    if (!match) return false

    const [, name, domain] = match
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false

    const data = await res.json()
    const expectedPubkey = data?.names?.[name]

    return expectedPubkey === pubkey
  } catch {
    return false
  }
}
