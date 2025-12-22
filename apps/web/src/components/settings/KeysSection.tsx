import { useState } from 'react'
import { importNsec, saveSecretKey, clearSecretKey } from '../../lib/nostr/keys'
import { Button, Input, ErrorMessage, SettingsSection } from '../ui'
import { copyToClipboard, removeItem, removeLocalProfile } from '../../lib/utils'
import { STORAGE_KEYS } from '../../lib/constants'
import { useTemporaryFlag } from '../../hooks'

interface KeysSectionProps {
  nsec: string
  npub: string
  usingNip07: boolean
  onNavigateUploadHistory: () => void
}

export default function KeysSection({ nsec, npub, usingNip07, onNavigateUploadHistory }: KeysSectionProps) {
  const [showNsec, setShowNsec] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [copied, triggerCopied] = useTemporaryFlag()
  const [npubCopied, triggerNpubCopied] = useTemporaryFlag()
  const [error, setError] = useState('')

  const handleCopy = async () => {
    if (await copyToClipboard(nsec)) {
      triggerCopied()
    }
  }

  const handleCopyNpub = async () => {
    if (await copyToClipboard(npub)) {
      triggerNpubCopied()
    }
  }

  const handleImport = () => {
    setError('')
    try {
      const sk = importNsec(importValue.trim())
      saveSecretKey(sk)

      // Clear all settings for new identity
      removeLocalProfile()
      removeItem(STORAGE_KEYS.THEME_COLORS)

      // Reload to start fresh with new identity
      window.location.reload()
    } catch {
      setError('Invalid nsec format')
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure? This will delete your key from this browser.')) {
      clearSecretKey()
      removeLocalProfile()
      window.location.reload()
    }
  }

  if (usingNip07) {
    return (
      <>
        <SettingsSection>
          <p className="info">Using NIP-07 extension</p>
          <div className="key-display">
            <label>Your npub:</label>
            <div className="npub-row">
              <code>{npub}</code>
              <div className="npub-row-buttons">
                <Button size="md" onClick={handleCopyNpub}>
                  {npubCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Uploads">
          <button className="profile-edit-link" onClick={onNavigateUploadHistory}>
            Upload History
          </button>
        </SettingsSection>
      </>
    )
  }

  return (
    <>
      <SettingsSection title="Your Keys">
        <div className="key-display">
          <label>npub (public):</label>
          <div className="npub-row">
            <code>{npub || 'Not generated yet'}</code>
            {npub && (
              <div className="npub-row-buttons">
                <Button size="md" onClick={handleCopyNpub}>
                  {npubCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
        </div>
        {nsec && (
          <div className="key-display">
            <label>nsec (secret - keep safe!):</label>
            <div className="secret-row">
              <code className="secret">{showNsec ? nsec : '••••••••••••••••••••••••••••••••'}</code>
              <div className="secret-row-buttons">
                <Button size="md" onClick={() => setShowNsec(!showNsec)}>
                  {showNsec ? 'Hide' : 'Show'}
                </Button>
                <Button size="md" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Uploads">
        <button className="profile-edit-link" onClick={onNavigateUploadHistory}>
          Upload History
        </button>
      </SettingsSection>

      <SettingsSection title="Import Key">
        <p className="hint">Paste your nsec to use an existing identity</p>
        <div className="input-row">
          <Input type="password" placeholder="nsec1..." value={importValue} onChange={setImportValue} />
          <Button size="md" onClick={handleImport} disabled={!importValue.trim()}>
            Import
          </Button>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
      </SettingsSection>

      <SettingsSection title="Danger Zone" variant="danger">
        <Button size="md" onClick={handleClear} variant="danger">
          Clear key from browser
        </Button>
      </SettingsSection>
    </>
  )
}
