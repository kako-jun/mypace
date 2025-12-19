import { nip19 } from 'nostr-tools'
import type { Profile, ProfileCache } from '../../types'
import { getItem, setItem, removeItem } from './storage'
import { STORAGE_KEYS } from '../constants'
import { t } from '../i18n'

// Service label detection from URL
export function detectServiceLabel(url: string): string {
  const lowered = url.toLowerCase()
  if (lowered.includes('github.com')) return 'GitHub'
  if (lowered.includes('twitter.com') || lowered.includes('x.com')) return 'Twitter'
  if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'YouTube'
  if (lowered.includes('instagram.com')) return 'Instagram'
  if (lowered.includes('linkedin.com')) return 'LinkedIn'
  if (lowered.includes('facebook.com')) return 'Facebook'
  if (lowered.includes('qiita.com')) return 'Qiita'
  if (lowered.includes('zenn.dev')) return 'Zenn'
  if (lowered.includes('note.com')) return 'note'
  if (lowered.includes('bsky.app')) return 'Bluesky'
  if (lowered.includes('twitch.tv')) return 'Twitch'
  if (lowered.includes('discord.gg') || lowered.includes('discord.com')) return 'Discord'
  if (lowered.includes('reddit.com')) return 'Reddit'
  if (lowered.includes('medium.com')) return 'Medium'
  if (lowered.includes('substack.com')) return 'Substack'
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

// Get icon name for service
export function getWebsiteIcon(label: string): string {
  switch (label) {
    case 'GitHub':
      return 'Github'
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
    case 'Reddit':
      return 'MessageSquare'
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
