import { useState, useEffect } from 'react'
import {
  getStoredSecretKey,
  getPublicKeyFromSecret,
  exportNsec,
  exportNpub,
  hasNip07,
  getNip07PublicKey,
} from '../lib/nostr/keys'
import { getCurrentPubkey } from '../lib/nostr/events'
import { fetchUserProfile } from '../lib/nostr/relay'
import {
  getLocalProfile,
  setItem,
  setString,
  getUIThemeColors,
  getStoredAppTheme,
  applyThemeColors,
  DEFAULT_COLORS,
} from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS } from '../lib/constants'
import { ProfileSection, ThemeSection, KeysSection, ShareSection } from '../components/settings'
import type { ThemeColors } from '../types'

export function Settings() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'about'>('settings')
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [usingNip07, setUsingNip07] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_COLORS)
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
    const storedColors = getUIThemeColors()
    setThemeColors(storedColors)
    applyThemeColors(storedColors)

    // Load app theme (light/dark)
    const storedAppTheme = getStoredAppTheme()
    setAppTheme(storedAppTheme)
    document.documentElement.setAttribute('data-theme', storedAppTheme)
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
          const profile = await fetchUserProfile(pubkey)
          if (profile) {
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
    setItem(STORAGE_KEYS.THEME_COLORS, newColors)
    // Notify other components
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.THEME_COLORS_CHANGED))
  }

  const handleAppThemeChange = (theme: 'light' | 'dark') => {
    setAppTheme(theme)
    setString(STORAGE_KEYS.APP_THEME, theme)
    document.documentElement.setAttribute('data-theme', theme)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.APP_THEME_CHANGED))
  }

  if (!open) {
    return (
      <button className="settings-toggle text-outlined text-outlined-button" onClick={() => setOpen(true)}>
        SETTINGS
      </button>
    )
  }

  return (
    <>
      <div className="settings-backdrop" onClick={() => setOpen(false)} />
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={() => setOpen(false)} aria-label="Close settings">
          ×
        </button>
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            SETTINGS
          </button>
          <button
            className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            ABOUT
          </button>
        </div>

        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
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

          <KeysSection nsec={nsec} npub={npub} usingNip07={usingNip07} />
        </div>

        <div style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
          <ShareSection />
        </div>
      </div>
    </>
  )
}
