import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import {
  buildSearchUrl,
  DEFAULT_SEARCH_FILTERS,
  saveFiltersToStorage,
  loadPresets,
  savePreset,
  deletePreset,
  MAX_PRESETS,
} from '../lib/utils'
import { LANGUAGES } from '../lib/constants'
import type { SearchFilters, FilterPreset } from '../types'

interface FilterPanelProps {
  // Popup mode
  isPopup?: boolean
  onClose?: () => void
  // Current filter state
  filters?: SearchFilters
}

export function FilterPanel({ isPopup = false, onClose, filters = DEFAULT_SEARCH_FILTERS }: FilterPanelProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  // Preset state
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetError, setPresetError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Local state initialized from filters
  const [showSNS, setShowSNS] = useState(filters.showSNS)
  const [showBlog, setShowBlog] = useState(filters.showBlog)
  const [mypaceOnly, setMypaceOnly] = useState(filters.mypace)
  const [okTagsInput, setOkTagsInput] = useState(filters.tags.join(', '))
  const [ngTagsInput, setNgTagsInput] = useState(filters.ngTags?.join(', ') || '')
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const [ngWordsInput, setNgWordsInput] = useState(filters.ngWords.join(', '))
  const [languageFilter, setLanguageFilter] = useState(filters.lang)

  // Smart filter state
  const [showSmartPopup, setShowSmartPopup] = useState(false)
  const [hideAds, setHideAds] = useState(filters.hideAds ?? true)
  const [hideNSFW, setHideNSFW] = useState(filters.hideNSFW ?? true)
  const smartPopupRef = useRef<HTMLDivElement>(null)

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Update local state when filters change (URL change)
  useEffect(() => {
    setShowSNS(filters.showSNS)
    setShowBlog(filters.showBlog)
    setMypaceOnly(filters.mypace)
    setOkTagsInput(filters.tags.join(', '))
    setNgTagsInput(filters.ngTags?.join(', ') || '')
    setSearchQuery(filters.query)
    setNgWordsInput(filters.ngWords.join(', '))
    setLanguageFilter(filters.lang)
    setHideAds(filters.hideAds ?? true)
    setHideNSFW(filters.hideNSFW ?? true)
    setSelectedPresetId('') // Clear selection when filters change externally
  }, [filters])

  // Close smart popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (smartPopupRef.current && !smartPopupRef.current.contains(e.target as Node)) {
        setShowSmartPopup(false)
      }
    }
    if (showSmartPopup) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSmartPopup])

  // Track if form is dirty
  const isDirty =
    showSNS !== filters.showSNS ||
    showBlog !== filters.showBlog ||
    mypaceOnly !== filters.mypace ||
    okTagsInput !== filters.tags.join(', ') ||
    ngTagsInput !== (filters.ngTags?.join(', ') || '') ||
    searchQuery !== filters.query ||
    ngWordsInput !== filters.ngWords.join(', ') ||
    languageFilter !== filters.lang ||
    hideAds !== (filters.hideAds ?? true) ||
    hideNSFW !== (filters.hideNSFW ?? true)

  // Count active smart filters
  const smartFilterCount = [hideAds, hideNSFW, languageFilter !== ''].filter(Boolean).length

  useEffect(() => {
    if (isPopup && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isPopup])

  // Parse input to array (split by whitespace or comma)
  const parseInput = (input: string): string[] => {
    return input
      .split(/[\s,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  }

  // Apply filters - save to localStorage and navigate to URL
  const handleApply = () => {
    const newFilters: SearchFilters = {
      showSNS,
      showBlog,
      mypace: mypaceOnly,
      tags: parseInput(okTagsInput),
      ngTags: parseInput(ngTagsInput),
      query: searchQuery,
      ngWords: parseInput(ngWordsInput),
      mode: filters.mode,
      lang: languageFilter,
      hideAds,
      hideNSFW,
    }

    // Save to localStorage for next visit
    saveFiltersToStorage(newFilters)

    // Navigate to search URL with new filters
    const url = buildSearchUrl(newFilters)
    navigate(url)
    onClose?.()
  }

  // Clear all filters - save defaults and navigate to home
  const handleClear = () => {
    // Reset local state
    setShowSNS(true)
    setShowBlog(true)
    setMypaceOnly(true)
    setOkTagsInput('')
    setNgTagsInput('')
    setSearchQuery('')
    setNgWordsInput('')
    setLanguageFilter('')
    setHideAds(true)
    setHideNSFW(true)

    // Save defaults to localStorage
    saveFiltersToStorage(DEFAULT_SEARCH_FILTERS)

    // Navigate to clean home page
    navigate('/')
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply()
    }
    if (e.key === 'Escape' && isPopup) {
      onClose?.()
    }
  }

  // Get current form state as SearchFilters
  const getCurrentFilters = (): SearchFilters => ({
    showSNS,
    showBlog,
    mypace: mypaceOnly,
    tags: parseInput(okTagsInput),
    ngTags: parseInput(ngTagsInput),
    query: searchQuery,
    ngWords: parseInput(ngWordsInput),
    mode: filters.mode,
    lang: languageFilter,
    hideAds,
    hideNSFW,
  })

  // Apply preset to form
  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (!presetId) return

    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    const f = preset.filters
    setShowSNS(f.showSNS)
    setShowBlog(f.showBlog)
    setMypaceOnly(f.mypace)
    setOkTagsInput(f.tags.join(', '))
    setNgTagsInput(f.ngTags?.join(', ') || '')
    setSearchQuery(f.query)
    setNgWordsInput(f.ngWords.join(', '))
    setLanguageFilter(f.lang)
    setHideAds(f.hideAds ?? true)
    setHideNSFW(f.hideNSFW ?? true)
  }

  // Open save modal
  const handleOpenSaveModal = () => {
    // Pre-fill with current preset name if selected
    const currentPreset = presets.find((p) => p.id === selectedPresetId)
    setPresetName(currentPreset?.name || '')
    setPresetError('')
    setDeleteConfirm(false)
    setShowSaveModal(true)
  }

  // Save preset
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

    setPresets(loadPresets())
    setSelectedPresetId(result.id)
    setShowSaveModal(false)
  }

  // Delete preset (two-click: first confirms, second deletes)
  const handleDeletePreset = () => {
    if (!selectedPresetId) return

    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    deletePreset(selectedPresetId)
    setPresets(loadPresets())
    setSelectedPresetId('')
    setDeleteConfirm(false)
  }

  // Reset delete confirm when selection changes
  const handlePresetSelectWithReset = (presetId: string) => {
    setDeleteConfirm(false)
    handlePresetSelect(presetId)
  }

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      {/* Preset section */}
      <div className="filter-preset-section">
        <select
          className="filter-preset-select"
          value={selectedPresetId}
          onChange={(e) => handlePresetSelectWithReset(e.target.value)}
        >
          <option value="">Preset({presets.length})</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="filter-preset-btn filter-preset-save"
          onClick={handleOpenSaveModal}
          title="Save as preset"
        >
          <Icon name="Save" size={14} />
        </button>
        <button
          type="button"
          className={`filter-preset-btn filter-preset-delete ${deleteConfirm ? 'confirm' : ''}`}
          onClick={handleDeletePreset}
          disabled={!selectedPresetId}
          title={deleteConfirm ? 'Click again to delete' : 'Delete preset'}
        >
          {deleteConfirm ? <Icon name="Check" size={14} /> : <Icon name="Trash2" size={14} />}
        </button>
      </div>

      {/* Save preset modal */}
      {showSaveModal && (
        <div className="filter-preset-modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="filter-preset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-preset-modal-header">Save Preset</div>
            <input
              type="text"
              className="filter-preset-modal-input"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset()
                if (e.key === 'Escape') setShowSaveModal(false)
              }}
            />
            {presetError && <div className="filter-preset-modal-error">{presetError}</div>}
            <div className="filter-preset-modal-actions">
              <Button onClick={() => setShowSaveModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSavePreset}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Kind filter - circuit diagram style */}
      <div className="filter-circuit">
        <div className="filter-circuit-source">Nostr</div>
        <div className="filter-circuit-branch">
          <div className={`filter-circuit-line filter-circuit-line-top ${showSNS ? 'active' : ''}`} />
          <div className={`filter-circuit-line filter-circuit-line-bottom ${showBlog ? 'active' : ''}`} />
        </div>
        <div className="filter-circuit-nodes">
          <div className={`filter-circuit-node ${showSNS ? 'active' : ''}`}>
            <span className="filter-circuit-label">SNS</span>
            <Toggle checked={showSNS} onChange={setShowSNS} size="small" />
          </div>
          <div className={`filter-circuit-node ${showBlog ? 'active' : ''}`}>
            <span className="filter-circuit-label">Blog</span>
            <Toggle checked={showBlog} onChange={setShowBlog} size="small" />
          </div>
        </div>
        <div className="filter-circuit-merge">
          <div className={`filter-circuit-line filter-circuit-line-merge ${showSNS || showBlog ? 'active' : ''}`} />
        </div>
        <div className={`filter-circuit-node filter-circuit-mypace ${mypaceOnly ? 'active' : ''}`}>
          <span className="filter-circuit-label">MY PACE</span>
          <Toggle checked={mypaceOnly} onChange={setMypaceOnly} size="small" />
        </div>
        <div className={`filter-circuit-line filter-circuit-line-output ${showSNS || showBlog ? 'active' : ''}`} />
        <div className="filter-circuit-output">TL</div>
      </div>

      {/* Smart Filter section */}
      <div className="smart-filter-section" ref={smartPopupRef}>
        <button
          type="button"
          className={`smart-filter-btn ${smartFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowSmartPopup(!showSmartPopup)}
        >
          <Icon name="Sparkles" size={14} />
          <span>Smart Filter</span>
          {smartFilterCount > 0 && <span className="smart-filter-count">{smartFilterCount}</span>}
          <Icon name={showSmartPopup ? 'ChevronUp' : 'ChevronDown'} size={14} />
        </button>

        {showSmartPopup && (
          <div className="smart-filter-popup">
            <div className="smart-filter-item">
              <Toggle checked={hideAds} onChange={setHideAds} size="small" />
              <Icon name="Banknote" size={14} />
              <span className="smart-filter-label">Hide Ads</span>
            </div>
            <div className="smart-filter-item">
              <Toggle checked={hideNSFW} onChange={setHideNSFW} size="small" />
              <Icon name="EyeOff" size={14} />
              <span className="smart-filter-label">Hide NSFW</span>
            </div>
            <div className="smart-filter-divider" />
            <div className="smart-filter-item">
              <Icon name="Globe" size={14} />
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
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

      {/* OK group */}
      <div className="filter-group filter-group-ok">
        <span className="filter-group-label">OK</span>
        <div className="filter-group-inputs">
          {/* OK word input */}
          <div className="filter-search-row">
            <Icon name="Search" size={16} className="filter-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="filter-search-input"
              value={searchQuery}
              placeholder="Keyword..."
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* OK tags input */}
          <div className="filter-search-row">
            <Icon name="Hash" size={16} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={okTagsInput}
              placeholder="Tags..."
              onChange={(e) => setOkTagsInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {okTagsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => setOkTagsInput('')}
                aria-label="Clear OK tags"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NG group */}
      <div className="filter-group filter-group-ng">
        <span className="filter-group-label filter-group-label-ng">NG</span>
        <div className="filter-group-inputs">
          {/* NG word input */}
          <div className="filter-search-row">
            <Icon name="Ban" size={16} className="filter-search-icon filter-ng-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={ngWordsInput}
              placeholder="Keywords..."
              onChange={(e) => setNgWordsInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {ngWordsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => setNgWordsInput('')}
                aria-label="Clear NG words"
              >
                ×
              </button>
            )}
          </div>

          {/* NG tags input */}
          <div className="filter-search-row">
            <Icon name="Hash" size={16} className="filter-search-icon filter-ng-icon" />
            <input
              type="text"
              className="filter-search-input"
              value={ngTagsInput}
              placeholder="Tags..."
              onChange={(e) => setNgTagsInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {ngTagsInput && (
              <button
                type="button"
                className="filter-input-clear"
                onClick={() => setNgTagsInput('')}
                aria-label="Clear NG tags"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="filter-actions">
        <Button onClick={handleClear}>Clear</Button>
        <Button variant="primary" className={`btn-save ${isDirty ? 'is-dirty' : ''}`} onClick={handleApply}>
          Save
        </Button>
      </div>
    </div>
  )
}
