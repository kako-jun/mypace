import { useState } from 'react'
import { Icon, Button, Input } from '../ui'
import { loadPresets, savePreset, deletePreset, MAX_PRESETS, formatNumber } from '../../lib/utils'
import type { SearchFilters, FilterPreset } from '../../types'

interface FilterPresetsProps {
  presets: FilterPreset[]
  selectedPresetId: string
  onPresetsChange: (presets: FilterPreset[]) => void
  onPresetSelect: (presetId: string) => void
  getCurrentFilters: () => SearchFilters
}

export function FilterPresets({
  presets,
  selectedPresetId,
  onPresetsChange,
  onPresetSelect,
  getCurrentFilters,
}: FilterPresetsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetError, setPresetError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const handleOpenSaveModal = () => {
    const currentPreset = presets.find((p) => p.id === selectedPresetId)
    setPresetName(currentPreset?.name || '')
    setPresetError('')
    setDeleteConfirm(false)
    setShowSaveModal(true)
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      setPresetError('Name is required')
      return
    }

    const result = savePreset(presetName, getCurrentFilters())
    if (!result) {
      setPresetError(`Maximum ${MAX_PRESETS} presets allowed`)
      return
    }

    onPresetsChange(loadPresets())
    onPresetSelect(result.id)
    setShowSaveModal(false)
  }

  const handleDeletePreset = () => {
    if (!selectedPresetId) return

    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    deletePreset(selectedPresetId)
    onPresetsChange(loadPresets())
    onPresetSelect('')
    setDeleteConfirm(false)
  }

  const handlePresetSelectWithReset = (presetId: string) => {
    setDeleteConfirm(false)
    onPresetSelect(presetId)
  }

  return (
    <>
      <div className="filter-preset-section">
        <select
          className="filter-preset-select"
          value={selectedPresetId}
          onChange={(e) => handlePresetSelectWithReset(e.target.value)}
        >
          <option value="">{formatNumber(presets.length)} presets</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <Button size="md" onClick={handleOpenSaveModal} title="Save as preset">
          <Icon name="Save" size={14} />
        </Button>
        <Button
          size="md"
          variant={deleteConfirm ? 'danger' : 'secondary'}
          onClick={handleDeletePreset}
          disabled={!selectedPresetId}
          title={deleteConfirm ? 'Click again to delete' : 'Delete preset'}
        >
          {deleteConfirm ? <Icon name="Check" size={14} /> : <Icon name="Trash2" size={14} />}
        </Button>
      </div>

      {showSaveModal && (
        <div className="filter-preset-modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="filter-preset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-preset-modal-header">Save Preset</div>
            <Input
              value={presetName}
              onChange={setPresetName}
              placeholder="Preset name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset()
                if (e.key === 'Escape') setShowSaveModal(false)
              }}
              className="filter-preset-modal-input"
            />
            {presetError && <div className="filter-preset-modal-error">{presetError}</div>}
            <div className="filter-preset-modal-actions">
              <Button size="md" onClick={() => setShowSaveModal(false)}>
                Cancel
              </Button>
              <Button size="md" variant="primary" onClick={handleSavePreset}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
