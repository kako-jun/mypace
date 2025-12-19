import { nip19 } from 'nostr-tools'
import type { Profile, ProfileCache } from '../../../types'
import { t } from '../../i18n'

function isValidPubkey(pubkey: string): boolean {
  return typeof pubkey === 'string' && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)
}

export function getDisplayName(profile: Profile | null | undefined, pubkey: string): string {
  if (profile?.display_name) return profile.display_name
  if (profile?.name) return profile.name
  if (profile === undefined) {
    if (isValidPubkey(pubkey)) {
      try {
        const npub = nip19.npubEncode(pubkey)
        return npub.slice(0, 12) + '...'
      } catch {}
    }
    return pubkey.slice(0, 8) + '...'
  }
  return t('anonymousName')
}

export function getAvatarUrl(profile: Profile | null | undefined): string | null {
  return profile?.picture || null
}

export function getDisplayNameFromCache(pubkey: string, profiles: ProfileCache): string {
  return getDisplayName(profiles[pubkey], pubkey)
}

export function getAvatarUrlFromCache(pubkey: string, profiles: ProfileCache): string | null {
  return getAvatarUrl(profiles[pubkey])
}
