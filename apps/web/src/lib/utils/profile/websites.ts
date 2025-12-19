import type { Profile } from '../../../types'
import { detectServiceLabel } from './serviceDetection'

export interface ResolvedWebsite {
  url: string
  label: string
}

export function getWebsites(profile: Profile | null | undefined): ResolvedWebsite[] {
  if (!profile) return []
  if (profile.websites && profile.websites.length > 0) {
    return profile.websites.map((w) => ({
      url: w.url,
      label: w.label || detectServiceLabel(w.url),
    }))
  }
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
