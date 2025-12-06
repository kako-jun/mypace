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

export default function Settings() {
  const [open, setOpen] = useState(false)
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [usingNip07, setUsingNip07] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
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
      setNsec('')
      setNpub('')
      window.location.reload()
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
