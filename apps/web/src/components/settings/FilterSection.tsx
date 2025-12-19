import { useState, useEffect } from 'react'
import { Icon } from '../ui/Icon'
import { loadPresets, loadMuteList } from '../../lib/utils'
import { CUSTOM_EVENTS } from '../../lib/constants'

interface FilterSectionProps {
  onClose?: () => void
}

export default function FilterSection({ onClose }: FilterSectionProps) {
  const [presetCount, setPresetCount] = useState(0)
  const [muteCount, setMuteCount] = useState(0)

  useEffect(() => {
    setPresetCount(loadPresets().length)
    setMuteCount(loadMuteList().length)
  }, [])

  const handleOpenFilter = () => {
    onClose?.()
    // Small delay to let settings panel close first
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_FILTER_PANEL))
    }, 100)
  }

  return (
    <div className="settings-section">
      <h3>Filters</h3>
      <div className="filter-summary-row">
        <div className="filter-summary-item">
          <Icon name="Bookmark" size={16} />
          <span>{presetCount} presets</span>
        </div>
        <div className="filter-summary-item">
          <Icon name="UserX" size={16} />
          <span>{muteCount} muted</span>
        </div>
      </div>
      <button className="profile-edit-link" onClick={handleOpenFilter}>
        Edit Filters →
      </button>
    </div>
  )
}
