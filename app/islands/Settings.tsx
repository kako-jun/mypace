import { useState, useEffect } from 'hono/jsx'
import {
  getStoredSecretKey,
  getPublicKeyFromSecret,
  exportNsec,
  exportNpub,
  hasNip07,
  getNip07PublicKey,
} from '../lib/nostr/keys'
import { getCurrentPubkey, type Profile } from '../lib/nostr/events'
import { fetchUserProfile } from '../lib/nostr/relay'
import { getLocalProfile } from './ProfileSetup'
import {
  ProfileSection,
  ThemeSection,
  EditorSection,
  KeysSection,
  ShareSection
} from '../components/settings'

// Default colors (matches disabled background #f8f8f8)
const DEFAULT_COLORS = {
  topLeft: '#f8f8f8',
  topRight: '#f8f8f8',
  bottomLeft: '#f8f8f8',
  bottomRight: '#f8f8f8',
}

export interface ThemeColors {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

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

// Calculate relative luminance of a hex color
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Determine if color is dark (needs light text)
function isDarkColor(hex: string): boolean {
  return getLuminance(hex) < 0.4
}

export function applyThemeColors(colors: ThemeColors) {
  if (typeof document === 'undefined') return

  // Create radial gradients from each corner
  const gradient = `
    radial-gradient(ellipse at top left, ${colors.topLeft}dd 0%, transparent 50%),
    radial-gradient(ellipse at top right, ${colors.topRight}dd 0%, transparent 50%),
    radial-gradient(ellipse at bottom left, ${colors.bottomLeft}dd 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, ${colors.bottomRight}dd 0%, transparent 50%),
    linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)
  `
  document.documentElement.style.setProperty('--theme-gradient', gradient)

  // Set html background for overscroll (blend of diagonal corners)
  document.documentElement.style.background = `linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)`

  // Update theme-color meta tag for browser chrome
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', colors.topLeft)
  }

  // Set logo color based on top-left corner brightness
  const isTopLeftDark = isDarkColor(colors.topLeft)
  const logoColor = isTopLeftDark ? '#ffffff' : '#222222'
  const logoShadow = isTopLeftDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)'
  document.documentElement.style.setProperty('--logo-color', logoColor)
  document.documentElement.style.setProperty('--logo-shadow', logoShadow)

  // Set settings button color based on top-right corner brightness
  const settingsColor = isDarkColor(colors.topRight) ? '#cccccc' : '#888888'
  const settingsHoverColor = isDarkColor(colors.topRight) ? '#ffffff' : '#444444'
  document.documentElement.style.setProperty('--settings-color', settingsColor)
  document.documentElement.style.setProperty('--settings-hover-color', settingsHoverColor)

  document.body.classList.add('custom-theme')
}

export default function Settings() {
  const [open, setOpen] = useState(false)
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [usingNip07, setUsingNip07] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>('light')
  const [vimMode, setVimMode] = useState(false)

  // Disable body scroll when settings panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Load theme on mount (not just when settings panel opens)
  useEffect(() => {
    const storedColors = getStoredThemeColors()
    setThemeColors(storedColors)
    applyThemeColors(storedColors)

    // Load app theme (light/dark)
    const storedAppTheme = localStorage.getItem('mypace_app_theme') as 'light' | 'dark' | null
    if (storedAppTheme) {
      setAppTheme(storedAppTheme)
      document.documentElement.setAttribute('data-theme', storedAppTheme)
    }

    const storedVimMode = localStorage.getItem('mypace_vim_mode')
    if (storedVimMode === 'true') {
      setVimMode(true)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      // Load profile name and picture
      const localProfile = getLocalProfile()
      if (localProfile?.name || localProfile?.display_name) {
        setDisplayName(localProfile.name || localProfile.display_name || '')
        setPictureUrl(localProfile.picture || '')
      } else {
        // Try fetching from relay
        try {
          const pubkey = await getCurrentPubkey()
          const profileEvent = await fetchUserProfile(pubkey)
          if (profileEvent) {
            const profile = JSON.parse(profileEvent.content) as Profile
            setDisplayName(profile.name || profile.display_name || '')
            setPictureUrl(profile.picture || '')
          }
        } catch {}
      }

      if (hasNip07()) {
        const pubkey = await getNip07PublicKey()
        if (pubkey) {
          setUsingNip07(true)
          setNpub(exportNpub(pubkey))
          return
        }
      }

      const sk = getStoredSecretKey()
      if (sk) {
        setNsec(exportNsec(sk))
        setNpub(exportNpub(getPublicKeyFromSecret(sk)))
      }
    }
    if (open) init()
  }, [open])

  const handleColorChange = (corner: keyof ThemeColors, color: string) => {
    const newColors = { ...themeColors, [corner]: color }
    setThemeColors(newColors)
    // Apply and save immediately
    applyThemeColors(newColors)
    localStorage.setItem('mypace_theme_colors', JSON.stringify(newColors))
  }

  const handleAppThemeChange = (theme: 'light' | 'dark') => {
    setAppTheme(theme)
    localStorage.setItem('mypace_app_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  const handleVimModeChange = (enabled: boolean) => {
    setVimMode(enabled)
    localStorage.setItem('mypace_vim_mode', enabled.toString())
  }

  if (!open) {
    return (
      <button class="settings-toggle" onClick={() => setOpen(true)}>
        Settings
      </button>
    )
  }

  return (
    <>
      <div class="settings-backdrop" onClick={() => setOpen(false)} />
      <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h2>Settings</h2>
        </div>

        <ProfileSection
          displayName={displayName}
          pictureUrl={pictureUrl}
          onDisplayNameChange={setDisplayName}
          onPictureUrlChange={setPictureUrl}
        />

        <ThemeSection
          appTheme={appTheme}
          themeColors={themeColors}
          onAppThemeChange={handleAppThemeChange}
          onColorChange={handleColorChange}
        />

        <EditorSection
          vimMode={vimMode}
          onVimModeChange={handleVimModeChange}
        />

        <KeysSection
          nsec={nsec}
          npub={npub}
          usingNip07={usingNip07}
        />

        <ShareSection />
      </div>
    </>
  )
}
