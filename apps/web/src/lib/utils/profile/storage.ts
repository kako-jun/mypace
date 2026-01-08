import type { Profile } from '../../../types'
import { getCachedProfile, setCachedProfile, clearCachedProfile } from '../../storage'

export function getLocalProfile(): Profile | null {
  return getCachedProfile()
}

export function setLocalProfile(profile: Profile): void {
  setCachedProfile(profile)
}

export function removeLocalProfile(): void {
  clearCachedProfile()
}

export function hasLocalProfile(): boolean {
  const profile = getLocalProfile()
  return !!(profile?.name || profile?.display_name)
}
