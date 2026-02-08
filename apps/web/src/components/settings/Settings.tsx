import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStoredSecretKey,
  getPublicKeyFromSecret,
  exportNsec,
  exportNpub,
  isNip07Enabled,
  getNip07PublicKey,
} from '../../lib/nostr/keys'
import '../../styles/components/settings.css'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { fetchUserProfile } from '../../lib/nostr/relay'
import { getLocalProfile, getUIThemeColors, getStoredAppTheme, applyThemeColors, DEFAULT_COLORS } from '../../lib/utils'
import { setThemeColors as saveThemeColors, setThemeMode, getThemeColors, getThemeMode } from '../../lib/storage'
import { CUSTOM_EVENTS } from '../../lib/constants'
import { Tabs, TextButton } from '../ui'
import {
  ProfileSection,
  ThemeSection,
  KeysSection,
  ShareSection,
  ExportSection,
  FilterSection,
  PushSection,
} from './index'
import { VisitorCounter } from './VisitorCounter'
import { VersionDisplay } from './VersionDisplay'
import { CloseButton } from '../ui'
import type { ThemeColors } from '../../types'

export function Settings() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'account' | 'about'>('settings')
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

  // Listen for open-settings event
  useEffect(() => {
    const handleOpenSettings = () => {
      setOpen(true)
      setActiveTab('account')
    }
    window.addEventListener('open-settings', handleOpenSettings)
    return () => window.removeEventListener('open-settings', handleOpenSettings)
  }, [])

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

      if (isNip07Enabled()) {
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

  const applyAndSaveColors = (colors: ThemeColors) => {
    setThemeColors(colors)
    applyThemeColors(colors)
    saveThemeColors(colors)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.THEME_COLORS_CHANGED))
  }

  const handleColorChange = (corner: keyof ThemeColors, color: string) => {
    const newColors = { ...themeColors, [corner]: color }
    applyAndSaveColors(newColors)
  }

  const handleColorsChange = (colors: ThemeColors) => {
    applyAndSaveColors(colors)
  }

  const handleAppThemeChange = (theme: 'light' | 'dark') => {
    setAppTheme(theme)
    setThemeMode(theme)
    document.documentElement.setAttribute('data-theme', theme)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.APP_THEME_CHANGED))
  }

  const handleImportRefresh = () => {
    // Re-read from storage and apply to UI
    const newColors = getThemeColors()
    setThemeColors(newColors)
    applyThemeColors(newColors)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.THEME_COLORS_CHANGED))

    const newTheme = getThemeMode()
    setAppTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.APP_THEME_CHANGED))
  }

  if (!open) {
    return (
      <TextButton className="settings-toggle" onClick={() => setOpen(true)}>
        SETTINGS
      </TextButton>
    )
  }

  return (
    <>
      <div className="settings-backdrop" onClick={() => setOpen(false)} />
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={() => setOpen(false)} size={24} />
        <Tabs
          tabs={[
            { value: 'settings' as const, label: 'Settings' },
            { value: 'account' as const, label: 'Account' },
            { value: 'about' as const, label: 'About' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          className="settings-tabs"
        />

        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          <ThemeSection
            appTheme={appTheme}
            themeColors={themeColors}
            onAppThemeChange={handleAppThemeChange}
            onColorChange={handleColorChange}
            onColorsChange={handleColorsChange}
          />

          <FilterSection onClose={() => setOpen(false)} />

          <PushSection />

          <ExportSection onImport={handleImportRefresh} />
        </div>

        <div style={{ display: activeTab === 'account' ? 'block' : 'none' }}>
          <ProfileSection displayName={displayName} pictureUrl={pictureUrl} onClose={() => setOpen(false)} />

          <KeysSection
            nsec={nsec}
            npub={npub}
            usingNip07={usingNip07}
            onNavigateUploadHistory={() => {
              setOpen(false)
              navigate('/upload-history')
            }}
            onNavigateInventory={() => {
              setOpen(false)
              navigate('/inventory')
            }}
          />
        </div>

        <div style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
          <ShareSection />
          <VisitorCounter />
          <VersionDisplay />
        </div>
      </div>
    </>
  )
}
