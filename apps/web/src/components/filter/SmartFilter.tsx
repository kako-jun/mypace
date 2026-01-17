import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import Toggle from '../ui/Toggle'
import { LANGUAGES } from '../../lib/constants'
import { formatNumber } from '../../lib/utils'

interface SmartFilterProps {
  hideAds: boolean
  hideNSFW: boolean
  hideNPC: boolean
  languageFilter: string
  onHideAdsChange: (value: boolean) => void
  onHideNSFWChange: (value: boolean) => void
  onHideNPCChange: (value: boolean) => void
  onLanguageChange: (value: string) => void
}

export function SmartFilter({
  hideAds,
  hideNSFW,
  hideNPC,
  languageFilter,
  onHideAdsChange,
  onHideNSFWChange,
  onHideNPCChange,
  onLanguageChange,
}: SmartFilterProps) {
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Count active smart filters
  const smartFilterCount = [hideAds, hideNSFW, hideNPC, languageFilter !== ''].filter(Boolean).length

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

  return (
    <div className="smart-filter-section" ref={popupRef}>
      <button
        type="button"
        className={`smart-filter-btn ${smartFilterCount > 0 ? 'active' : ''}`}
        onClick={() => setShowPopup(!showPopup)}
      >
        <Icon name="Sparkles" size={14} />
        <span>Smart Filter</span>
        {smartFilterCount > 0 && <span className="smart-filter-count">{formatNumber(smartFilterCount)}</span>}
        <Icon name={showPopup ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>

      {showPopup && (
        <div className="smart-filter-popup">
          <div className="smart-filter-item" onClick={() => onHideAdsChange(!hideAds)}>
            <Toggle checked={hideAds} onChange={onHideAdsChange} size="small" />
            <Icon name="Banknote" size={14} />
            <span className="smart-filter-label">Hide Ads</span>
          </div>
          <div className="smart-filter-item" onClick={() => onHideNSFWChange(!hideNSFW)}>
            <Toggle checked={hideNSFW} onChange={onHideNSFWChange} size="small" />
            <Icon name="EyeOff" size={14} />
            <span className="smart-filter-label">Hide NSFW</span>
          </div>
          <div className="smart-filter-item" onClick={() => onHideNPCChange(!hideNPC)}>
            <Toggle checked={hideNPC} onChange={onHideNPCChange} size="small" />
            <Icon name="Bot" size={14} />
            <span className="smart-filter-label">Hide NPC</span>
          </div>
          <div className="smart-filter-divider" />
          <div className="smart-filter-item">
            <Icon name="Globe" size={14} />
            <select
              value={languageFilter}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="smart-filter-select"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
