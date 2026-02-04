import { useState } from 'react'
import { importNsec, saveSecretKey, clearSecretKey, hasNip07, enableNip07, disableNip07, isNip07Missing } from '../../lib/nostr/keys'
import { Button, Input, ErrorMessage, SettingsSection } from '../ui'
import { copyToClipboard, removeLocalProfile } from '../../lib/utils'
import { resetThemeColors } from '../../lib/storage'
import { useTemporaryFlag } from '../../hooks'

interface KeysSectionProps {
  nsec: string
  npub: string
  usingNip07: boolean
  onNavigateUploadHistory: () => void
  onNavigateInventory: () => void
}

export default function KeysSection({
  nsec,
  npub,
  usingNip07,
  onNavigateUploadHistory,
  onNavigateInventory,
}: KeysSectionProps) {
  const [showNsec, setShowNsec] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [copied, triggerCopied] = useTemporaryFlag()
  const [npubCopied, triggerNpubCopied] = useTemporaryFlag()
  const [error, setError] = useState('')

  const nip07Available = hasNip07()
  const nip07Missing = isNip07Missing()

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

      // Disable NIP-07 mode when importing nsec
      disableNip07()
      saveSecretKey(sk)

      // Clear all settings for new identity
      removeLocalProfile()
      resetThemeColors()

      // Reload to start fresh with new identity
      window.location.reload()
    } catch {
      setError('Invalid nsec format')
    }
  }

  const handleEnableNip07 = () => {
    if (
      confirm(
        'Enable NIP-07?\n\nThis will delete your secret key from this browser. Make sure you have backed it up first!'
      )
    ) {
      enableNip07()
      removeLocalProfile()
      window.location.reload()
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure? This will delete your key from this browser.')) {
      clearSecretKey()
      removeLocalProfile()
      window.location.reload()
    }
  }

  return (
    <>
      {/* Your Keys - always show npub, show nsec only when not using NIP-07 */}
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
        {!usingNip07 && nsec && (
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
        {usingNip07 && <p className="hint">Using NIP-07 extension (secret key managed by extension)</p>}
      </SettingsSection>

      {/* Warning when NIP-07 was enabled but extension is missing */}
      {nip07Missing && (
        <SettingsSection title="Extension Missing" variant="danger">
          <p className="hint">
            NIP-07 extension was enabled but is no longer detected. Please reinstall the extension or import your
            secret key below.
          </p>
        </SettingsSection>
      )}

      {/* Authentication Method - only show when NIP-07 extension is available */}
      {nip07Available ? (
        <SettingsSection title="Authentication Method">
          <div className="auth-method-options">
            <label className="auth-method-option">
              <input
                type="radio"
                name="authMethod"
                checked={!usingNip07}
                onChange={() => {
                  /* handled by import */
                }}
                readOnly
              />
              <span>Secret key (nsec)</span>
            </label>
            {!usingNip07 && (
              <div className="auth-method-content">
                <p className="hint">Paste your nsec to use an existing identity</p>
                <div className="input-row">
                  <Input type="password" placeholder="nsec1..." value={importValue} onChange={setImportValue} />
                  <Button size="md" onClick={handleImport} disabled={!importValue.trim()}>
                    Import
                  </Button>
                </div>
                <ErrorMessage>{error}</ErrorMessage>
              </div>
            )}

            <label className="auth-method-option">
              <input type="radio" name="authMethod" checked={usingNip07} onChange={handleEnableNip07} />
              <span>NIP-07 extension</span>
            </label>
            {usingNip07 && (
              <div className="auth-method-content">
                <p className="hint connected">Connected: {npub}</p>
              </div>
            )}
          </div>
        </SettingsSection>
      ) : (
        /* No NIP-07 extension - show simple import UI */
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
      )}

      <SettingsSection title="Uploads">
        <button className="profile-edit-link" onClick={onNavigateUploadHistory}>
          Upload History →
        </button>
      </SettingsSection>

      <SettingsSection title="Inventory">
        <button className="profile-edit-link" onClick={onNavigateInventory}>
          Color Stella & Supernovas →
        </button>
      </SettingsSection>

      {/* Danger Zone - only show when not using NIP-07 */}
      {!usingNip07 && (
        <SettingsSection title="Danger Zone" variant="danger">
          <Button size="md" onClick={handleClear} variant="danger">
            Clear key from browser
          </Button>
        </SettingsSection>
      )}
    </>
  )
}
