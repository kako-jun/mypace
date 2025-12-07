import type { Profile } from '../nostr/events'
import { getItem, setItem, removeItem } from './storage'

const PROFILE_KEY = 'mypace_profile'

export function getLocalProfile(): Profile | null {
  return getItem<Profile | null>(PROFILE_KEY, null)
}

export function setLocalProfile(profile: Profile): void {
  setItem(PROFILE_KEY, profile)
}

export function removeLocalProfile(): void {
  removeItem(PROFILE_KEY)
}

export function hasLocalProfile(): boolean {
  const profile = getLocalProfile()
  return !!(profile?.name || profile?.display_name)
}
