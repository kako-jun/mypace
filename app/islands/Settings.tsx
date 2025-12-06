import { useState, useEffect } from 'hono/jsx'
import {
  getStoredSecretKey,
  getPublicKeyFromSecret,
  exportNsec,
  exportNpub,
  importNsec,
  saveSecretKey,
  clearSecretKey,
  hasNip07,
  getNip07PublicKey,
} from '../lib/nostr/keys'
import { getCurrentPubkey, createProfileEvent, type Profile } from '../lib/nostr/events'
import { publishEvent, fetchUserProfile } from '../lib/nostr/relay'
import { getLocalProfile } from './ProfileSetup'
import Button from '../components/Button'

// Default colors (matches disabled background #f8f8f8)
const DEFAULT_COLORS = {
  topLeft: '#f8f8f8',
  topRight: '#f8f8f8',
  bottomLeft: '#f8f8f8',
  bottomRight: '#f8f8f8',
}

// Preset: FF7-inspired blue theme
const FF7_COLORS = {
  topLeft: '#0a1628',
  topRight: '#1a3a5c',
  bottomLeft: '#1a3a5c',
  bottomRight: '#0a1628',
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
  const logoColor = isDarkColor(colors.topLeft) ? '#ffffff' : '#222222'
  document.documentElement.style.setProperty('--logo-color', logoColor)

  // Set settings button color based on top-right corner brightness
  const settingsColor = isDarkColor(colors.topRight) ? '#cccccc' : '#888888'
  const settingsHoverColor = isDarkColor(colors.topRight) ? '#ffffff' : '#444444'
  document.documentElement.style.setProperty('--settings-color', settingsColor)
  document.documentElement.style.setProperty('--settings-hover-color', settingsHoverColor)

  document.body.classList.add('custom-theme')
}

export function clearThemeColors() {
  if (typeof document === 'undefined') return
  document.body.classList.remove('custom-theme')
  document.documentElement.style.removeProperty('--theme-gradient')
  document.documentElement.style.removeProperty('--logo-color')
  document.documentElement.style.removeProperty('--settings-color')
  document.documentElement.style.removeProperty('--settings-hover-color')
  document.documentElement.style.background = '#f8f8f8'

  // Reset theme-color meta tag
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', '#f8f8f8')
  }
}

export default function Settings() {
  const [open, setOpen] = useState(false)
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [usingNip07, setUsingNip07] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [themeEnabled, setThemeEnabled] = useState(false)
  const [showNsec, setShowNsec] = useState(false)
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>('light')

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
    const isEnabled = localStorage.getItem('mypace_theme_enabled') === 'true'
    setThemeColors(storedColors)
    setThemeEnabled(isEnabled)
    if (isEnabled) {
      applyThemeColors(storedColors)
    }

    // Load app theme (light/dark)
    const storedAppTheme = localStorage.getItem('mypace_app_theme') as 'light' | 'dark' | null
    if (storedAppTheme) {
      setAppTheme(storedAppTheme)
      document.documentElement.setAttribute('data-theme', storedAppTheme)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      // Load profile name
      const localProfile = getLocalProfile()
      if (localProfile?.name || localProfile?.display_name) {
        setDisplayName(localProfile.name || localProfile.display_name || '')
      } else {
        // Try fetching from relay
        try {
          const pubkey = await getCurrentPubkey()
          const profileEvent = await fetchUserProfile(pubkey)
          if (profileEvent) {
            const profile = JSON.parse(profileEvent.content) as Profile
            setDisplayName(profile.name || profile.display_name || '')
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(nsec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImport = () => {
    setError('')
    try {
      const sk = importNsec(importValue.trim())
      saveSecretKey(sk)

      // Clear all settings for new identity
      localStorage.removeItem('mypace_profile')
      localStorage.removeItem('mypace_theme_colors')
      localStorage.removeItem('mypace_theme_enabled')

      setNsec(exportNsec(sk))
      setNpub(exportNpub(getPublicKeyFromSecret(sk)))
      setImportValue('')

      // Reload to start fresh with new identity
      window.location.reload()
    } catch {
      setError('Invalid nsec format')
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure? This will delete your key from this browser.')) {
      clearSecretKey()
      localStorage.removeItem('mypace_profile')
      setNsec('')
      setNpub('')
      window.location.reload()
    }
  }

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setNameError('Name is required')
      return
    }

    setSavingName(true)
    setNameError('')

    try {
      const localProfile = getLocalProfile()
      const profile: Profile = {
        ...localProfile,
        name: displayName.trim(),
        display_name: displayName.trim(),
      }
      const event = await createProfileEvent(profile)
      await publishEvent(event)

      localStorage.setItem('mypace_profile', JSON.stringify(profile))
      window.dispatchEvent(new CustomEvent('profileupdated'))
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingName(false)
    }
  }

  const handleColorChange = (corner: keyof ThemeColors, color: string) => {
    const newColors = { ...themeColors, [corner]: color }
    setThemeColors(newColors)
    // Apply and save immediately
    if (themeEnabled) {
      applyThemeColors(newColors)
      localStorage.setItem('mypace_theme_colors', JSON.stringify(newColors))
    }
  }

  const handleThemeToggle = () => {
    const newEnabled = !themeEnabled
    setThemeEnabled(newEnabled)
    localStorage.setItem('mypace_theme_enabled', String(newEnabled))
    if (newEnabled) {
      applyThemeColors(themeColors)
      localStorage.setItem('mypace_theme_colors', JSON.stringify(themeColors))
    } else {
      clearThemeColors()
    }
  }

  const handleAppThemeChange = (theme: 'light' | 'dark') => {
    setAppTheme(theme)
    localStorage.setItem('mypace_app_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
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

      <div class="settings-section">
        <h3>Profile</h3>
        <div class="profile-form">
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            maxLength={50}
          />
          <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}>
            {savingName ? 'Saving...' : 'Update'}
          </Button>
        </div>
        {nameError && <p class="error">{nameError}</p>}
        {nameSaved && <p class="success">Updated!</p>}
      </div>

      <div class="settings-section">
        <h3>App Theme</h3>
        <div class="theme-switcher">
          <Button
            onClick={() => handleAppThemeChange('light')}
            variant={appTheme === 'light' ? 'primary' : 'secondary'}
          >
            Light
          </Button>
          <Button
            onClick={() => handleAppThemeChange('dark')}
            variant={appTheme === 'dark' ? 'primary' : 'secondary'}
          >
            Dark
          </Button>
        </div>
      </div>

      <div class="settings-section">
        <h3>Window Color</h3>
        <p class="hint">Customize background with 4-corner gradient</p>

        <div class="theme-preview" style={{
          background: themeEnabled
            ? `radial-gradient(ellipse at top left, ${themeColors.topLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at top right, ${themeColors.topRight}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom left, ${themeColors.bottomLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom right, ${themeColors.bottomRight}dd 0%, transparent 50%),
               linear-gradient(135deg, ${themeColors.topLeft} 0%, ${themeColors.bottomRight} 100%)`
            : '#f8f8f8'
        }}>
          <div class="color-picker-grid">
            <div class="color-picker-corner top-left">
              <input
                type="color"
                value={themeColors.topLeft}
                onInput={(e) => handleColorChange('topLeft', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="color-picker-corner top-right">
              <input
                type="color"
                value={themeColors.topRight}
                onInput={(e) => handleColorChange('topRight', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="color-picker-corner bottom-left">
              <input
                type="color"
                value={themeColors.bottomLeft}
                onInput={(e) => handleColorChange('bottomLeft', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="color-picker-corner bottom-right">
              <input
                type="color"
                value={themeColors.bottomRight}
                onInput={(e) => handleColorChange('bottomRight', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        </div>

        <div class="theme-actions">
          <label class="theme-toggle-label">
            <input
              type="checkbox"
              checked={themeEnabled}
              onChange={handleThemeToggle}
            />
            Enable
          </label>
        </div>
      </div>

      {usingNip07 ? (
        <div class="settings-section">
          <p class="info">Using NIP-07 extension</p>
          <div class="key-display">
            <label>Your npub:</label>
            <code>{npub}</code>
          </div>
        </div>
      ) : (
        <>
          <div class="settings-section">
            <h3>Your Keys</h3>
            <div class="key-display">
              <label>npub (public):</label>
              <code>{npub || 'Not generated yet'}</code>
            </div>
            {nsec && (
              <div class="key-display">
                <label>nsec (secret - keep safe!):</label>
                <div class="secret-row">
                  <code class="secret">{showNsec ? nsec : '••••••••••••••••••••••••••••••••'}</code>
                  <div class="secret-row-buttons">
                    <Button onClick={() => setShowNsec(!showNsec)}>
                      {showNsec ? 'Hide' : 'Show'}
                    </Button>
                    <Button onClick={handleCopy}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div class="settings-section">
            <h3>Import Key</h3>
            <p class="hint">Paste your nsec to use an existing identity</p>
            <div class="input-row">
              <input
                type="password"
                placeholder="nsec1..."
                value={importValue}
                onInput={(e) => setImportValue((e.target as HTMLInputElement).value)}
              />
              <Button onClick={handleImport} disabled={!importValue.trim()}>
                Import
              </Button>
            </div>
            {error && <p class="error">{error}</p>}
          </div>

          <div class="settings-section danger">
            <h3>Danger Zone</h3>
            <Button onClick={handleClear} variant="danger">
              Clear key from browser
            </Button>
          </div>
        </>
      )}

      <div class="settings-footer">
        <a href="https://github.com/kako-jun/mypace" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
      </div>
    </>
  )
}
