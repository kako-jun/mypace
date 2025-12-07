import { create } from 'zustand'
import type { ThemeColors } from '../types'
import { getItem, setItem, getString, setString, getBoolean, setBoolean } from '../lib/utils'
import { STORAGE_KEYS } from '../lib/constants'

// Default colors
export const DEFAULT_COLORS: ThemeColors = {
  topLeft: '#f8f8f8',
  topRight: '#f8f8f8',
  bottomLeft: '#f8f8f8',
  bottomRight: '#f8f8f8',
}

interface SettingsState {
  appTheme: 'light' | 'dark'
  themeColors: ThemeColors
  vimMode: boolean
  isOpen: boolean

  // Actions
  setAppTheme: (theme: 'light' | 'dark') => void
  setThemeColors: (colors: ThemeColors) => void
  setThemeColor: (corner: keyof ThemeColors, color: string) => void
  setVimMode: (enabled: boolean) => void
  setOpen: (open: boolean) => void
  loadFromStorage: () => void
  applyTheme: () => void
}

// Helper functions - use shared from nostr/theme
import { isDarkColor } from '../lib/nostr/theme'

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
  document.documentElement.style.background = `linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)`

  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', colors.topLeft)
  }

  const isTopLeftDark = isDarkColor(colors.topLeft)
  const logoColor = isTopLeftDark ? '#ffffff' : '#222222'
  const logoShadow = isTopLeftDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)'
  document.documentElement.style.setProperty('--logo-color', logoColor)
  document.documentElement.style.setProperty('--logo-shadow', logoShadow)

  const settingsColor = isDarkColor(colors.topRight) ? '#cccccc' : '#888888'
  const settingsHoverColor = isDarkColor(colors.topRight) ? '#ffffff' : '#444444'
  document.documentElement.style.setProperty('--settings-color', settingsColor)
  document.documentElement.style.setProperty('--settings-hover-color', settingsHoverColor)

  document.body.classList.add('custom-theme')
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appTheme: 'light',
  themeColors: DEFAULT_COLORS,
  vimMode: false,
  isOpen: false,

  setAppTheme: (theme) => {
    set({ appTheme: theme })
    setString(STORAGE_KEYS.APP_THEME, theme)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  },

  setThemeColors: (colors) => {
    set({ themeColors: colors })
    setItem(STORAGE_KEYS.THEME_COLORS, colors)
    applyThemeColors(colors)
  },

  setThemeColor: (corner, color) => {
    const newColors = { ...get().themeColors, [corner]: color }
    get().setThemeColors(newColors)
  },

  setVimMode: (enabled) => {
    set({ vimMode: enabled })
    setBoolean(STORAGE_KEYS.VIM_MODE, enabled)
  },

  setOpen: (open) => {
    set({ isOpen: open })
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },

  loadFromStorage: () => {
    // Load app theme
    const storedAppTheme = getStoredAppTheme()
    set({ appTheme: storedAppTheme })
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', storedAppTheme)
    }

    // Load theme colors
    const colors = getStoredThemeColors()
    set({ themeColors: colors })
    applyThemeColors(colors)

    // Load vim mode
    set({ vimMode: getStoredVimMode() })
  },

  applyTheme: () => {
    applyThemeColors(get().themeColors)
  }
}))

// Storage helpers
export function getStoredThemeColors(): ThemeColors {
  return getItem<ThemeColors>(STORAGE_KEYS.THEME_COLORS, DEFAULT_COLORS)
}

export function getStoredVimMode(): boolean {
  return getBoolean(STORAGE_KEYS.VIM_MODE)
}

export function getStoredAppTheme(): 'light' | 'dark' {
  return (getString(STORAGE_KEYS.APP_THEME) as 'light' | 'dark') || 'light'
}

export { applyThemeColors }
