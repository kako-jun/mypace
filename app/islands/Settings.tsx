import { useState, useEffect } from 'hono/jsx'
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
  setBoolean,
  parseProfile,
  getUIThemeColors,
  getStoredVimMode,
  getStoredAppTheme,
  applyThemeColors,
  DEFAULT_COLORS,
} from '../lib/utils'
import { STORAGE_KEYS } from '../lib/constants'
import { ProfileSection, ThemeSection, EditorSection, KeysSection, ShareSection } from '../components/settings'
import type { ThemeColors } from '../types'

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
    const storedColors = getUIThemeColors()
    setThemeColors(storedColors)
    applyThemeColors(storedColors)

    // Load app theme (light/dark)
    const storedAppTheme = getStoredAppTheme()
    setAppTheme(storedAppTheme)
    document.documentElement.setAttribute('data-theme', storedAppTheme)

    setVimMode(getStoredVimMode())
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
            const profile = parseProfile(profileEvent.content)
            if (profile) {
              setDisplayName(profile.name || profile.display_name || '')
              setPictureUrl(profile.picture || '')
            }
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
  }

  const handleAppThemeChange = (theme: 'light' | 'dark') => {
    setAppTheme(theme)
    setString(STORAGE_KEYS.APP_THEME, theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  const handleVimModeChange = (enabled: boolean) => {
    setVimMode(enabled)
    setBoolean(STORAGE_KEYS.VIM_MODE, enabled)
  }

  if (!open) {
    return (
      <button class="settings-toggle text-outlined" onClick={() => setOpen(true)}>
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

        <EditorSection vimMode={vimMode} onVimModeChange={handleVimModeChange} />

        <KeysSection nsec={nsec} npub={npub} usingNip07={usingNip07} />

        <ShareSection />
      </div>
    </>
  )
}
