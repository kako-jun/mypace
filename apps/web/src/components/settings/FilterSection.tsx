import { useState, useEffect } from 'react'
import { loadPresets, formatNumber } from '../../lib/utils'
import { CUSTOM_EVENTS } from '../../lib/constants'
import { SettingsSection } from '../ui'

interface FilterSectionProps {
  onClose?: () => void
}

export default function FilterSection({ onClose }: FilterSectionProps) {
  const [presetCount, setPresetCount] = useState(0)

  useEffect(() => {
    setPresetCount(loadPresets().length)
  }, [])

  const handleOpenFilter = () => {
    onClose?.()
    // Small delay to let settings panel close first
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_FILTER_PANEL))
    }, 100)
  }

  return (
    <SettingsSection title="Filters">
      <p className="filter-summary-text">{formatNumber(presetCount)} presets</p>
      <button className="profile-edit-link" onClick={handleOpenFilter}>
        Edit Filters →
      </button>
    </SettingsSection>
  )
}
