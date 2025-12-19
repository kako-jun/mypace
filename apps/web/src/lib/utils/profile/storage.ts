import type { Profile } from '../../../types'
import { getItem, setItem, removeItem } from '../storage'
import { STORAGE_KEYS } from '../../constants'

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
