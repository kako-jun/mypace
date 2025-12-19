import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import Button from '../ui/Button'
import { loadMuteList, addToMuteList, removeFromMuteList, type MuteEntry } from '../../lib/utils'

export function MuteListManager() {
  const [showPopup, setShowPopup] = useState(false)
  const [muteList, setMuteList] = useState<MuteEntry[]>([])
  const [muteInput, setMuteInput] = useState('')
  const [muteError, setMuteError] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)

  // Load mute list on mount
  useEffect(() => {
    setMuteList(loadMuteList())
  }, [])

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
    if (!muteInput.trim()) return

    const result = addToMuteList(muteInput)
    if (result) {
      setMuteList(loadMuteList())
      setMuteInput('')
      setMuteError('')
    } else {
      setMuteError('Invalid npub or already muted')
      setTimeout(() => setMuteError(''), 2000)
    }
  }

  const handleRemoveFromMuteList = (pubkey: string) => {
    removeFromMuteList(pubkey)
    setMuteList(loadMuteList())
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
        {muteList.length > 0 && <span className="mute-list-count">{muteList.length}</span>}
        <Icon name={showPopup ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>

      {showPopup && (
        <div className="mute-list-popup">
          <div className="mute-list-input-row">
            <input
              type="text"
              className="mute-list-input"
              value={muteInput}
              onChange={(e) => setMuteInput(e.target.value)}
              placeholder="npub1..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddToMuteList()
              }}
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
                  <button
                    type="button"
                    className="mute-list-remove-btn"
                    onClick={() => handleRemoveFromMuteList(entry.pubkey)}
                    title="Remove from mute list"
                  >
                    <Icon name="X" size={12} />
                  </button>
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
