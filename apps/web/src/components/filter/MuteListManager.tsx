import { useState, useEffect, useRef } from 'react'
import { Icon, Button, Input, CloseButton } from '../ui'
import { npubToHex, hexToNpub, formatNumber, type MuteEntry } from '../../lib/utils'

interface MuteListManagerProps {
  muteList: MuteEntry[]
  onMuteListChange: (list: MuteEntry[]) => void
}

export function MuteListManager({ muteList, onMuteListChange }: MuteListManagerProps) {
  const [showPopup, setShowPopup] = useState(false)
  const [muteInput, setMuteInput] = useState('')
  const [muteError, setMuteError] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false)
      }
    }
    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopup])

  const handleAddToMuteList = () => {
    const trimmed = muteInput.trim()
    if (!trimmed) return

    let pubkey: string
    let npub: string

    // Check if input is npub or hex
    if (trimmed.startsWith('npub1')) {
      const hex = npubToHex(trimmed)
      if (!hex) {
        setMuteError('Invalid npub')
        setTimeout(() => setMuteError(''), 2000)
        return
      }
      pubkey = hex
      npub = trimmed
    } else if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      pubkey = trimmed.toLowerCase()
      npub = hexToNpub(pubkey)
    } else {
      setMuteError('Invalid npub or hex pubkey')
      setTimeout(() => setMuteError(''), 2000)
      return
    }

    // Check if already muted
    if (muteList.some((entry) => entry.pubkey === pubkey)) {
      setMuteError('Already muted')
      setTimeout(() => setMuteError(''), 2000)
      return
    }

    const entry: MuteEntry = {
      npub,
      pubkey,
      addedAt: Date.now(),
    }

    onMuteListChange([...muteList, entry])
    setMuteInput('')
    setMuteError('')
  }

  const handleRemoveFromMuteList = (pubkey: string) => {
    onMuteListChange(muteList.filter((entry) => entry.pubkey !== pubkey))
  }

  return (
    <div className="mute-list-section" ref={popupRef}>
      <button
        type="button"
        className={`mute-list-btn ${muteList.length > 0 ? 'active' : ''}`}
        onClick={() => setShowPopup(!showPopup)}
      >
        <Icon name="UserX" size={14} />
        <span>Mute List</span>
        {muteList.length > 0 && <span className="mute-list-count">{formatNumber(muteList.length)}</span>}
        <Icon name={showPopup ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>

      {showPopup && (
        <div className="mute-list-popup">
          <div className="mute-list-input-row">
            <Input
              value={muteInput}
              onChange={setMuteInput}
              placeholder="npub1..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddToMuteList()
              }}
              className="mute-list-input"
            />
            <Button size="md" onClick={handleAddToMuteList}>
              <Icon name="Plus" size={14} />
            </Button>
          </div>
          {muteError && <div className="mute-list-error">{muteError}</div>}
          {muteList.length > 0 ? (
            <div className="mute-list-entries">
              {muteList.map((entry) => (
                <div key={entry.pubkey} className="mute-list-entry">
                  <span className="mute-list-npub" title={entry.npub}>
                    {entry.npub.slice(0, 12)}...{entry.npub.slice(-4)}
                  </span>
                  <CloseButton
                    onClick={() => handleRemoveFromMuteList(entry.pubkey)}
                    size={12}
                    className="mute-list-remove-btn"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mute-list-empty">No muted users</div>
          )}
        </div>
      )}
    </div>
  )
}
