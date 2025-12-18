import { nip19 } from 'nostr-tools'
import type { Profile, ProfileCache } from '../../types'
import { getItem, setItem, removeItem } from './storage'
import { STORAGE_KEYS } from '../constants'
import { t } from '../i18n'

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
