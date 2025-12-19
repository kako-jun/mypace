import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import { buildSearchUrl, DEFAULT_SEARCH_FILTERS, saveFiltersToStorage, loadPresets } from '../lib/utils'
import { FilterPresets } from './filter/FilterPresets'
import { SmartFilter } from './filter/SmartFilter'
import { MuteListManager } from './filter/MuteListManager'
import { FilterFields } from './filter/FilterFields'
import type { SearchFilters, FilterPreset } from '../types'

interface FilterPanelProps {
  isPopup?: boolean
  onClose?: () => void
  filters?: SearchFilters
}

export function FilterPanel({ isPopup = false, onClose, filters = DEFAULT_SEARCH_FILTERS }: FilterPanelProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  // Preset state
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')

  // Local state initialized from filters
  const [showSNS, setShowSNS] = useState(filters.showSNS)
  const [showBlog, setShowBlog] = useState(filters.showBlog)
  const [mypaceOnly, setMypaceOnly] = useState(filters.mypace)
  const [okTagsInput, setOkTagsInput] = useState(filters.tags.join(', '))
  const [ngTagsInput, setNgTagsInput] = useState(filters.ngTags?.join(', ') || '')
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const [ngWordsInput, setNgWordsInput] = useState(filters.ngWords.join(', '))
  const [languageFilter, setLanguageFilter] = useState(filters.lang)
  const [hideAds, setHideAds] = useState(filters.hideAds ?? true)
  const [hideNSFW, setHideNSFW] = useState(filters.hideNSFW ?? true)

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
    setSelectedPresetId('')
  }, [filters])

  useEffect(() => {
    if (isPopup && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isPopup])

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

  // Parse input to array
  const parseInput = (input: string): string[] => {
    return input
      .split(/[\s,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
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

  // Apply filters
  const handleApply = () => {
    const newFilters = getCurrentFilters()
    saveFiltersToStorage(newFilters)
    navigate(buildSearchUrl(newFilters))
    onClose?.()
  }

  // Clear all filters
  const handleClear = () => {
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
    saveFiltersToStorage(DEFAULT_SEARCH_FILTERS)
    navigate('/')
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApply()
    if (e.key === 'Escape' && isPopup) onClose?.()
  }

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

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      <FilterPresets
        presets={presets}
        selectedPresetId={selectedPresetId}
        onPresetsChange={setPresets}
        onPresetSelect={handlePresetSelect}
        getCurrentFilters={getCurrentFilters}
      />

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

      <SmartFilter
        hideAds={hideAds}
        hideNSFW={hideNSFW}
        languageFilter={languageFilter}
        onHideAdsChange={setHideAds}
        onHideNSFWChange={setHideNSFW}
        onLanguageChange={setLanguageFilter}
      />

      <MuteListManager />

      <FilterFields
        searchQuery={searchQuery}
        okTagsInput={okTagsInput}
        ngWordsInput={ngWordsInput}
        ngTagsInput={ngTagsInput}
        onSearchQueryChange={setSearchQuery}
        onOkTagsChange={setOkTagsInput}
        onNgWordsChange={setNgWordsInput}
        onNgTagsChange={setNgTagsInput}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
      />

      <div className="filter-actions">
        <Button size="md" variant="secondary" onClick={handleClear}>
          Clear
        </Button>
        <Button size="md" variant="primary" className={`btn-save ${isDirty ? 'is-dirty' : ''}`} onClick={handleApply}>
          Save
        </Button>
      </div>
    </div>
  )
}
