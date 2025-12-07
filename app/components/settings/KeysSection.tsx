import { useState } from 'hono/jsx'
import { importNsec, saveSecretKey, clearSecretKey } from '../../lib/nostr/keys'
import { Button, Input } from '../ui'
import { copyToClipboard, removeItem, removeLocalProfile } from '../../lib/utils'
import { STORAGE_KEYS } from '../../lib/constants'
import { useTemporaryFlag } from '../../hooks'

interface KeysSectionProps {
  nsec: string
  npub: string
  usingNip07: boolean
}

export default function KeysSection({ nsec, npub, usingNip07 }: KeysSectionProps) {
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
      removeItem(STORAGE_KEYS.THEME_ENABLED)

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
      <div class="settings-section">
        <p class="info">Using NIP-07 extension</p>
        <div class="key-display">
          <label>Your npub:</label>
          <div class="npub-row">
            <code>{npub}</code>
            <div class="npub-row-buttons">
              <Button onClick={handleCopyNpub}>{npubCopied ? 'Copied!' : 'Copy'}</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div class="settings-section">
        <h3>Your Keys</h3>
        <div class="key-display">
          <label>npub (public):</label>
          <div class="npub-row">
            <code>{npub || 'Not generated yet'}</code>
            {npub && (
              <div class="npub-row-buttons">
                <Button onClick={handleCopyNpub}>{npubCopied ? 'Copied!' : 'Copy'}</Button>
              </div>
            )}
          </div>
        </div>
        {nsec && (
          <div class="key-display">
            <label>nsec (secret - keep safe!):</label>
            <div class="secret-row">
              <code class="secret">{showNsec ? nsec : '••••••••••••••••••••••••••••••••'}</code>
              <div class="secret-row-buttons">
                <Button onClick={() => setShowNsec(!showNsec)}>{showNsec ? 'Hide' : 'Show'}</Button>
                <Button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div class="settings-section">
        <h3>Import Key</h3>
        <p class="hint">Paste your nsec to use an existing identity</p>
        <div class="input-row">
          <Input type="password" placeholder="nsec1..." value={importValue} onChange={setImportValue} />
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
  )
}
