// Router-based navigation utilities
// These functions are set up by the App component and use React Router's navigate

import type { NavigateFunction, Location } from 'react-router-dom'

let navigateFunc: NavigateFunction | null = null
let getCurrentLocation: (() => Location) | null = null

// Initialize navigation (called from App)
export function initializeNavigation(navigate: NavigateFunction, getLocation: () => Location) {
  navigateFunc = navigate
  getCurrentLocation = getLocation
}

// Navigate to post with background location (for modal)
export function navigateToPostModal(eventId: string) {
  const currentLocation = getCurrentLocation!()
  navigateFunc!(`/post/${eventId}`, { state: { backgroundLocation: currentLocation } })
}

// Navigate back (close modal)
export function navigateBack() {
  navigateFunc!(-1)
}

// Get navigate function for non-modal navigation
export function getNavigateFunction(): NavigateFunction {
  return navigateFunc!
}
