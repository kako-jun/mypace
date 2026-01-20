import type { ThemeColors } from '../../types'
import { getThemeColors, getThemeMode, getVimMode } from '../storage'
import { isDarkColor } from '../nostr/theme'
import { DEFAULT_COLORS } from '../constants'

export { DEFAULT_COLORS }

function applyThemeColors(colors: ThemeColors) {
  if (typeof document === 'undefined') return

  const gradient = `
    radial-gradient(ellipse at top left, ${colors.topLeft}dd 0%, transparent 50%),
    radial-gradient(ellipse at top right, ${colors.topRight}dd 0%, transparent 50%),
    radial-gradient(ellipse at bottom left, ${colors.bottomLeft}dd 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, ${colors.bottomRight}dd 0%, transparent 50%),
    linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)
  `
  document.documentElement.style.setProperty('--theme-gradient', gradient)
  document.documentElement.style.setProperty('--theme-top-left', colors.topLeft)
  document.documentElement.style.setProperty('--theme-top-right', colors.topRight)
  document.documentElement.style.setProperty('--theme-bottom-left', colors.bottomLeft)
  document.documentElement.style.setProperty('--theme-bottom-right', colors.bottomRight)
  document.documentElement.style.background = `linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)`

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', colors.topLeft)
  }

  const isTopLeftDark = isDarkColor(colors.topLeft)
  const logoColor = isTopLeftDark ? '#ffffff' : '#222222'
  const logoShadow = isTopLeftDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)'
  const logoFilter = isTopLeftDark ? 'brightness(0) invert(1) opacity(0.6)' : 'brightness(0) opacity(0.5)'
  const logoHoverFilter = isTopLeftDark ? 'brightness(0) invert(1) opacity(1)' : 'brightness(0) opacity(1)'
  document.documentElement.style.setProperty('--logo-color', logoColor)
  document.documentElement.style.setProperty('--logo-shadow', logoShadow)
  document.documentElement.style.setProperty('--logo-filter', logoFilter)
  document.documentElement.style.setProperty('--logo-hover-filter', logoHoverFilter)

  const settingsColor = isDarkColor(colors.topRight) ? '#cccccc' : '#888888'
  const settingsHoverColor = isDarkColor(colors.topRight) ? '#ffffff' : '#444444'
  document.documentElement.style.setProperty('--settings-color', settingsColor)
  document.documentElement.style.setProperty('--settings-hover-color', settingsHoverColor)

  document.body.classList.add('custom-theme')

  // Dispatch custom event for Logo component
  window.dispatchEvent(new CustomEvent('themeColorsChanged'))
}

// Get theme colors for UI display
export function getUIThemeColors(): ThemeColors {
  return getThemeColors()
}

export function getStoredVimMode(): boolean {
  return getVimMode()
}

export function getStoredAppTheme(): 'light' | 'dark' {
  return getThemeMode()
}

export { applyThemeColors }
