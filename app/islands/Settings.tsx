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
      setNsec(exportNsec(sk))
      setNpub(exportNpub(getPublicKeyFromSecret(sk)))
      setImportValue('')
      alert('Key imported successfully!')
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

  if (!open) {
    return (
      <button class="settings-toggle" onClick={() => setOpen(true)}>
        Settings
      </button>
    )
  }

  return (
    <div class="settings-panel">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-button" onClick={() => setOpen(false)}>x</button>
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
          <button onClick={handleSaveName} disabled={savingName || !displayName.trim()}>
            {savingName ? 'Saving...' : 'Update'}
          </button>
        </div>
        {nameError && <p class="error">{nameError}</p>}
        {nameSaved && <p class="success">Updated!</p>}
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
                  <code class="secret">{nsec.slice(0, 20)}...</code>
                  <button onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div class="settings-section">
            <h3>Import Key</h3>
            <p class="hint">Paste your nsec to use an existing identity</p>
            <input
              type="password"
              placeholder="nsec1..."
              value={importValue}
              onInput={(e) => setImportValue((e.target as HTMLInputElement).value)}
            />
            <button onClick={handleImport} disabled={!importValue.trim()}>
              Import
            </button>
            {error && <p class="error">{error}</p>}
          </div>

          <div class="settings-section danger">
            <h3>Danger Zone</h3>
            <button class="danger-button" onClick={handleClear}>
              Clear key from browser
            </button>
          </div>
        </>
      )}
    </div>
  )
}
