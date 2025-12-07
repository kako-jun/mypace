import type { ThemeColors } from '../../types'
import type { Event } from 'nostr-tools'
import { getItem, getBoolean } from '../utils/storage'
import { STORAGE_KEYS, THEME_TAG } from '../constants'

// Get stored theme colors from localStorage
export function getStoredThemeColors(): ThemeColors | null {
  const enabled = getBoolean(STORAGE_KEYS.THEME_ENABLED)
  if (!enabled) return null
  return getItem<ThemeColors | null>(STORAGE_KEYS.THEME_COLORS, null)
}

// Extract theme colors from event tags
export function getEventThemeColors(event: Event): ThemeColors | null {
  const themeTag = event.tags.find(tag => tag[0] === THEME_TAG)
  if (themeTag && themeTag.length >= 5) {
    return {
      topLeft: themeTag[1],
      topRight: themeTag[2],
      bottomLeft: themeTag[3],
      bottomRight: themeTag[4],
    }
  }
  return null
}

// Calculate relative luminance of a hex color
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Determine if color is dark
export function isDarkColor(hex: string): boolean {
  return getLuminance(hex) < 0.4
}

// Get theme card props (style and classes)
export function getThemeCardProps(colors: ThemeColors | null): {
  style: Record<string, string>
  className: string
} {
  if (!colors) {
    return { style: {}, className: '' }
  }

  const darkCount =
    (isDarkColor(colors.topLeft) ? 1 : 0) +
    (isDarkColor(colors.topRight) ? 1 : 0) +
    (isDarkColor(colors.bottomLeft) ? 1 : 0) +
    (isDarkColor(colors.bottomRight) ? 1 : 0)

  const avgDark = darkCount >= 2
  const textClass = avgDark ? 'light-text' : 'dark-text'

  return {
    style: {
      background: `
        radial-gradient(ellipse at top left, ${colors.topLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at top right, ${colors.topRight}cc 0%, transparent 50%),
        radial-gradient(ellipse at bottom left, ${colors.bottomLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, ${colors.bottomRight}cc 0%, transparent 50%),
        linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)
      `.trim()
    },
    className: `themed-card ${textClass}`
  }
}
