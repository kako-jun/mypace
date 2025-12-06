import { create } from 'zustand'
import type { ThemeColors } from '../types'

// Default colors
const DEFAULT_COLORS: ThemeColors = {
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

// Helper functions
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function isDarkColor(hex: string): boolean {
  return getLuminance(hex) < 0.4
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mypace_app_theme', theme)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  },

  setThemeColors: (colors) => {
    set({ themeColors: colors })
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mypace_theme_colors', JSON.stringify(colors))
    }
    applyThemeColors(colors)
  },

  setThemeColor: (corner, color) => {
    const newColors = { ...get().themeColors, [corner]: color }
    get().setThemeColors(newColors)
  },

  setVimMode: (enabled) => {
    set({ vimMode: enabled })
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mypace_vim_mode', enabled.toString())
    }
  },

  setOpen: (open) => {
    set({ isOpen: open })
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },

  loadFromStorage: () => {
    if (typeof localStorage === 'undefined') return

    // Load app theme
    const storedAppTheme = localStorage.getItem('mypace_app_theme') as 'light' | 'dark' | null
    if (storedAppTheme) {
      set({ appTheme: storedAppTheme })
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', storedAppTheme)
      }
    }

    // Load theme colors
    const storedColors = localStorage.getItem('mypace_theme_colors')
    if (storedColors) {
      try {
        const colors = JSON.parse(storedColors) as ThemeColors
        set({ themeColors: colors })
        applyThemeColors(colors)
      } catch {
        applyThemeColors(DEFAULT_COLORS)
      }
    } else {
      applyThemeColors(DEFAULT_COLORS)
    }

    // Load vim mode
    const storedVimMode = localStorage.getItem('mypace_vim_mode')
    if (storedVimMode === 'true') {
      set({ vimMode: true })
    }
  },

  applyTheme: () => {
    applyThemeColors(get().themeColors)
  }
}))

// Export helper for legacy code
export function getStoredThemeColors(): ThemeColors {
  if (typeof window === 'undefined') return DEFAULT_COLORS
  const stored = localStorage.getItem('mypace_theme_colors')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return DEFAULT_COLORS
    }
  }
  return DEFAULT_COLORS
}

export function getStoredVimMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mypace_vim_mode') === 'true'
}

export function getStoredAppTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('mypace_app_theme') as 'light' | 'dark' | null
  return stored || 'light'
}

export { applyThemeColors, DEFAULT_COLORS }
