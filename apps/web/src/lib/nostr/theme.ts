import type { ThemeColors, Event } from '../../types'
import { getItem, getString } from '../utils/storage'
import { STORAGE_KEYS } from '../constants'
import { AURORA_TAG } from './constants'

// Theme background colors
const THEME_BG_COLORS = {
  light: '#f8f8f8',
  dark: '#282828',
}

// Get current app theme
function getCurrentTheme(): 'light' | 'dark' {
  if (typeof localStorage === 'undefined') return 'light'
  return (getString(STORAGE_KEYS.APP_THEME) as 'light' | 'dark') || 'light'
}

// Get fallback colors based on current theme
export function getThemeFallbackColors(): ThemeColors {
  const bg = THEME_BG_COLORS[getCurrentTheme()]
  return { topLeft: bg, topRight: bg, bottomLeft: bg, bottomRight: bg }
}

// Get stored theme colors from localStorage
export function getStoredThemeColors(): ThemeColors | null {
  return getItem<ThemeColors | null>(STORAGE_KEYS.THEME_COLORS, null)
}

// Extract theme colors from event tags
export function getEventThemeColors(event: Event): ThemeColors | null {
  const auroraTag = event.tags.find((tag) => tag[0] === AURORA_TAG)
  if (auroraTag && auroraTag.length >= 5) {
    return {
      topLeft: auroraTag[1],
      topRight: auroraTag[2],
      bottomLeft: auroraTag[3],
      bottomRight: auroraTag[4],
    }
  }
  return null
}

// Calculate relative luminance of a hex color
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Determine if color is dark
export function isDarkColor(hex: string): boolean {
  return getLuminance(hex) < 0.4
}

// Get theme card props (style and classes)
// When colors is null, uses current theme's background color as fallback
export function getThemeCardProps(colors: ThemeColors | null): {
  style: Record<string, string>
  className: string
} {
  // Use fallback colors if not provided
  const effectiveColors = colors || getThemeFallbackColors()

  const darkCount =
    (isDarkColor(effectiveColors.topLeft) ? 1 : 0) +
    (isDarkColor(effectiveColors.topRight) ? 1 : 0) +
    (isDarkColor(effectiveColors.bottomLeft) ? 1 : 0) +
    (isDarkColor(effectiveColors.bottomRight) ? 1 : 0)

  const avgDark = darkCount >= 2
  const textClass = avgDark ? 'light-text' : 'dark-text'
  const topLeftClass = isDarkColor(effectiveColors.topLeft) ? 'corner-tl-dark' : 'corner-tl-light'

  return {
    style: {
      background: `
        radial-gradient(ellipse at 0 0, ${effectiveColors.topLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at 100% 0, ${effectiveColors.topRight}cc 0%, transparent 50%),
        radial-gradient(ellipse at 0 100%, ${effectiveColors.bottomLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at 100% 100%, ${effectiveColors.bottomRight}cc 0%, transparent 50%),
        linear-gradient(135deg, ${effectiveColors.topLeft} 0%, ${effectiveColors.bottomRight} 100%)
      `.trim(),
    },
    className: `themed-card ${textClass} ${topLeftClass}`,
  }
}
