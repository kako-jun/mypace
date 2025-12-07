import type { ThemeColors } from '../../types'
import { getItem, getString, getBoolean } from './storage'
import { STORAGE_KEYS } from '../constants'
import { isDarkColor } from '../nostr/theme'

// Default colors for UI
export const DEFAULT_COLORS: ThemeColors = {
  topLeft: '#f8f8f8',
  topRight: '#f8f8f8',
  bottomLeft: '#f8f8f8',
  bottomRight: '#f8f8f8',
}

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

// Get theme colors for UI display (always returns values, uses defaults if not stored)
export function getUIThemeColors(): ThemeColors {
  return getItem<ThemeColors>(STORAGE_KEYS.THEME_COLORS, DEFAULT_COLORS)
}

export function getStoredVimMode(): boolean {
  return getBoolean(STORAGE_KEYS.VIM_MODE)
}

export function getStoredAppTheme(): 'light' | 'dark' {
  return (getString(STORAGE_KEYS.APP_THEME) as 'light' | 'dark') || 'light'
}

export { applyThemeColors }
