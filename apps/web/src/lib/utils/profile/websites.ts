import type { LoadableProfile } from '../../../types'
import { detectServiceLabel } from './serviceDetection'

export interface ResolvedWebsite {
  url: string
  label: string
}

export function getWebsites(profile: LoadableProfile): ResolvedWebsite[] {
  if (!profile) return []
  if (profile.websites && profile.websites.length > 0) {
    // Always use detectServiceLabel to get fresh label (e.g., "X" instead of old "Twitter")
    return profile.websites.map((w) => ({
      url: w.url,
      label: detectServiceLabel(w.url),
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
