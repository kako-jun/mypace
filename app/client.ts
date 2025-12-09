import { createClient } from 'honox/client'
import { getString } from './lib/utils/storage'
import { STORAGE_KEYS } from './lib/constants'

// Initialize theme immediately to prevent flash
const storedAppTheme = getString(STORAGE_KEYS.APP_THEME)
if (storedAppTheme) {
  document.documentElement.setAttribute('data-theme', storedAppTheme)
}

createClient()

// Note: View Transitions are handled by <meta name="view-transition" content="same-origin" />
// which enables cross-document (MPA) view transitions natively in supporting browsers.
// No additional JavaScript is needed for basic transitions.
