import { useState, useRef, useEffect, useMemo } from 'react'
import {
  importNsec,
  hasNip07,
  enableNip07,
  disableNip07,
  getAllKeys,
  getActiveIndex,
  addKey,
  switchKey,
  removeKeyByIndex,
} from '../../lib/nostr/keys'
import { fetchProfiles } from '../../lib/nostr/relay'
import { Button, ErrorMessage, SettingsSection } from '../ui'
import { copyToClipboard, removeLocalProfile } from '../../lib/utils'
import { useTemporaryFlag } from '../../hooks'
import type { Profile } from '../../types'

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
  const [inputValue, setInputValue] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, triggerCopied] = useTemporaryFlag()
  const [npubCopied, triggerNpubCopied] = useTemporaryFlag()
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [keyProfiles, setKeyProfiles] = useState<Record<string, Profile | null>>({})
  const fetchedPubkeysRef = useRef<Set<string>>(new Set())

  const [comboFocused, setComboFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const importingRef = useRef(false)

  const nip07Available = hasNip07()
  // Memoize: getAllKeys() runs getPublicKey + nip19 encoding per key
  const keys = useMemo(() => getAllKeys(), [nsec]) // nsec changes on key switch/import
  const activeIndex = getActiveIndex()
  const hasKeys = keys.length > 0

  // Auto-focus input when switching to input mode
  useEffect(() => {
    if (comboFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [comboFocused])

  // Fetch profiles for all keys when dropdown opens
  useEffect(() => {
    if (!dropdownOpen || keys.length < 1) return
    const missing = keys.map((k) => k.pubkey).filter((pk) => !fetchedPubkeysRef.current.has(pk))
    if (missing.length === 0) return
    missing.forEach((pk) => fetchedPubkeysRef.current.add(pk))
    fetchProfiles(missing)
      .then((profiles) => {
        setKeyProfiles((prev) => ({ ...prev, ...profiles }))
      })
      .catch(() => {
        // Allow retry on next dropdown open
        missing.forEach((pk) => fetchedPubkeysRef.current.delete(pk))
      })
  }, [dropdownOpen, keys])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [dropdownOpen])

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

  const handleImport = async () => {
    if (importingRef.current) return
    importingRef.current = true
    setError('')
    try {
      const sk = importNsec(inputValue.trim())
      disableNip07()
      // addKey handles dedup: if same key exists, just switches to it
      await addKey(sk)
      removeLocalProfile()
      setInputValue('')
      window.location.reload()
    } catch {
      setError('Invalid nsec format')
      importingRef.current = false
    }
  }

  const handleSwitch = (index: number) => {
    if (index === activeIndex) {
      setDropdownOpen(false)
      return
    }
    switchKey(index)
    removeLocalProfile()
    setDropdownOpen(false)
    window.location.reload()
  }

  const handleRemoveKeyByIndex = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (index === activeIndex) {
      if (keys.length <= 1) {
        if (!confirm('Are you sure? This will delete your key from this browser.')) return
      } else {
        if (!confirm('Remove this active key? You will be switched to another key.')) return
      }
    } else {
      if (!confirm('Remove this key from the list?')) return
    }
    removeKeyByIndex(index)
    removeLocalProfile()
    window.location.reload()
  }

  const handleRemoveActiveKey = () => {
    if (keys.length <= 1) {
      if (!confirm('Are you sure? This will delete your key from this browser.')) return
    } else {
      if (!confirm('Remove this key from the list? Your other keys will remain.')) return
    }
    removeKeyByIndex(activeIndex)
    removeLocalProfile()
    window.location.reload()
  }

  const handleComboFieldClick = () => {
    if (hasKeys) {
      setDropdownOpen(!dropdownOpen)
    }
  }

  const handleInputFocus = () => {
    setComboFocused(true)
  }

  const handleInputBlur = () => {
    setComboFocused(false)
  }

  const handleEnableNip07 = () => {
    if (
      confirm(
        'Enable NIP-07?\n\nThis will delete the active secret key from this browser. Other saved keys will remain. Make sure you have backed it up first!'
      )
    ) {
      enableNip07()
      removeLocalProfile()
      window.location.reload()
    }
  }

  const shortenNpub = (n: string) => {
    if (n.length <= 20) return n
    return `${n.slice(0, 12)}...${n.slice(-8)}`
  }

  return (
    <>
      <SettingsSection title="Your Keys">
        {/* nsec: unified combo (display + input + dropdown) */}
        {!usingNip07 && (
          <div className="key-display">
            <label>nsec (secret - keep safe!):</label>
            <div className="secret-row">
              <div className="nsec-combo" ref={dropdownRef}>
                <div className="nsec-combo-field">
                  {comboFocused || !hasKeys ? (
                    <input
                      ref={inputRef}
                      type="password"
                      autoComplete="off"
                      className="nsec-combo-input"
                      placeholder={hasKeys ? 'nsec1... to add' : 'nsec1... to import'}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inputValue.trim()) handleImport()
                      }}
                    />
                  ) : (
                    <code className="secret nsec-combo-display" onClick={() => setComboFocused(true)}>
                      {showNsec ? nsec : '••••••••••••••••••••••••••••••••'}
                    </code>
                  )}
                  {hasKeys && (
                    <span
                      className={`nsec-combo-chevron ${dropdownOpen ? 'open' : ''}`}
                      onClick={handleComboFieldClick}
                    >
                      &#9662;
                    </span>
                  )}
                </div>
                {dropdownOpen && hasKeys && (
                  <div className="nsec-combo-dropdown">
                    {keys.map((key, i) => {
                      const profile = keyProfiles[key.pubkey]
                      const rawName = profile?.display_name || profile?.name || ''
                      const displayName = rawName.length > 30 ? rawName.slice(0, 30) + '…' : rawName
                      return (
                        <div
                          key={key.npub}
                          className={`nsec-combo-option ${i === activeIndex ? 'active' : ''}`}
                          onClick={() => handleSwitch(i)}
                        >
                          <span className="nsec-combo-npub">
                            {shortenNpub(key.npub)}
                            {displayName && <span className="nsec-combo-name">{displayName}</span>}
                          </span>
                          <span className="nsec-combo-actions">
                            {i === activeIndex && <span className="nsec-combo-check">&#10003;</span>}
                            <button
                              className="nsec-combo-remove"
                              onClick={(e) => handleRemoveKeyByIndex(i, e)}
                              title="Remove this key"
                            >
                              &#10005;
                            </button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {hasKeys && (
                <div className="secret-row-buttons">
                  <Button size="md" onClick={() => setShowNsec(!showNsec)}>
                    {showNsec ? 'Hide' : 'Show'}
                  </Button>
                  <Button size="md" onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              )}
              {(comboFocused || !hasKeys) && inputValue.trim() && (
                <Button size="md" onClick={handleImport}>
                  Add
                </Button>
              )}
            </div>
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}

        {/* npub: below nsec */}
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

        {usingNip07 && <p className="hint">Using NIP-07 extension (secret key managed by extension)</p>}
      </SettingsSection>

      {/* NIP-07 toggle - only when extension is available */}
      {nip07Available && (
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
          <Button size="md" onClick={handleRemoveActiveKey} variant="danger">
            {keys.length > 1 ? 'Remove this key' : 'Clear key from browser'}
          </Button>
        </SettingsSection>
      )}
    </>
  )
}
