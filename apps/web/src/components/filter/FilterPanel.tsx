import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import Toggle from '../ui/Toggle'
import { CloseButton } from '../ui'
import {
  DEFAULT_SEARCH_FILTERS,
  saveFiltersToStorage,
  loadFiltersFromStorage,
  loadPresets,
  loadMuteList,
  saveMuteList,
  type MuteEntry,
} from '../../lib/utils'
import { FilterPresets } from './FilterPresets'
import { SmartFilter } from './SmartFilter'
import { MuteListManager } from './MuteListManager'
import { FilterFields } from './FilterFields'
import '../../styles/components/filter-panel.css'
import type { SearchFilters, FilterPreset } from '../../types'

interface FilterPanelProps {
  isPopup?: boolean
  onClose?: () => void
}

export function FilterPanel({ isPopup = false, onClose }: FilterPanelProps) {
  // Load saved filters from localStorage
  const savedFilters = loadFiltersFromStorage()
  const savedMuteList = loadMuteList()

  // Preset state
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')

  // Local state initialized from saved filters
  const [showSNS, setShowSNS] = useState(savedFilters.showSNS)
  const [showBlog, setShowBlog] = useState(savedFilters.showBlog)
  const [mypaceOnly, setMypaceOnly] = useState(savedFilters.mypace)
  const [ngTagsInput, setNgTagsInput] = useState(savedFilters.ngTags?.join(', ') || '')
  const [ngWordsInput, setNgWordsInput] = useState(savedFilters.ngWords.join(', '))
  const [languageFilter, setLanguageFilter] = useState(savedFilters.lang)
  const [hideAds, setHideAds] = useState(savedFilters.hideAds ?? true)
  const [hideNSFW, setHideNSFW] = useState(savedFilters.hideNSFW ?? true)
  const [hideNPC, setHideNPC] = useState(savedFilters.hideNPC ?? false)
  const [muteList, setMuteList] = useState<MuteEntry[]>(savedMuteList)

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Track if form is dirty (compare with saved values)
  const isDirty =
    showSNS !== savedFilters.showSNS ||
    showBlog !== savedFilters.showBlog ||
    mypaceOnly !== savedFilters.mypace ||
    ngTagsInput !== (savedFilters.ngTags?.join(', ') || '') ||
    ngWordsInput !== savedFilters.ngWords.join(', ') ||
    languageFilter !== savedFilters.lang ||
    hideAds !== (savedFilters.hideAds ?? true) ||
    hideNSFW !== (savedFilters.hideNSFW ?? true) ||
    hideNPC !== (savedFilters.hideNPC ?? false) ||
    JSON.stringify(muteList.map((m) => m.pubkey).sort()) !== JSON.stringify(savedMuteList.map((m) => m.pubkey).sort())

  // Parse input to array (space-separated, dedup while preserving order)
  const parseInput = (input: string): string[] => {
    // Convert fullwidth spaces to halfwidth before splitting
    const normalized = input.replace(/\u3000/g, ' ')
    const items = normalized
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
    // Remove duplicates while preserving order
    return Array.from(new Set(items))
  }

  // Get current form state as SearchFilters
  const getCurrentFilters = (): SearchFilters => ({
    showSNS,
    showBlog,
    mypace: mypaceOnly,
    ngTags: parseInput(ngTagsInput),
    ngWords: parseInput(ngWordsInput),
    lang: languageFilter,
    hideAds,
    hideNSFW,
    hideNPC,
  })

  // Apply filters
  const handleApply = () => {
    const newFilters = getCurrentFilters()
    saveFiltersToStorage(newFilters)
    saveMuteList(muteList)
    // Reload current page to apply new filters
    // This preserves the current URL (user page, home, etc.)
    window.location.reload()
  }

  // Clear all filters
  const handleClear = () => {
    setShowSNS(true)
    setShowBlog(true)
    setMypaceOnly(true)
    setNgTagsInput('')
    setNgWordsInput('')
    setLanguageFilter('')
    setHideAds(true)
    setHideNSFW(true)
    setHideNPC(false)
    setMuteList([])
    saveFiltersToStorage(DEFAULT_SEARCH_FILTERS)
    saveMuteList([])
    // Reload current page to apply cleared filters
    // This preserves the current URL (user page, home, etc.)
    window.location.reload()
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
    setNgTagsInput(f.ngTags?.join(', ') || '')
    setNgWordsInput(f.ngWords.join(', '))
    setLanguageFilter(f.lang)
    setHideAds(f.hideAds ?? true)
    setHideNSFW(f.hideNSFW ?? true)
    setHideNPC(f.hideNPC ?? false)
  }

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      {isPopup && onClose && (
        <div className="filter-panel-header">
          <CloseButton onClick={onClose} size={20} />
        </div>
      )}
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
          <div className={`filter-circuit-line filter-circuit-line-merge-top ${showSNS ? 'active' : ''}`} />
          <div className={`filter-circuit-line filter-circuit-line-merge-bottom ${showBlog ? 'active' : ''}`} />
        </div>
        <div className={`filter-circuit-node filter-circuit-mypace ${mypaceOnly ? 'active' : ''}`}>
          <span className="filter-circuit-label filter-circuit-label-mypace">
            <span>MY PACE</span>
            <span className="filter-circuit-label-only">Only</span>
          </span>
          <Toggle checked={mypaceOnly} onChange={setMypaceOnly} size="small" />
        </div>
        <div className={`filter-circuit-line filter-circuit-line-output ${showSNS || showBlog ? 'active' : ''}`} />
        <div className="filter-circuit-output">TL</div>
      </div>

      <SmartFilter
        hideAds={hideAds}
        hideNSFW={hideNSFW}
        hideNPC={hideNPC}
        languageFilter={languageFilter}
        onHideAdsChange={setHideAds}
        onHideNSFWChange={setHideNSFW}
        onHideNPCChange={setHideNPC}
        onLanguageChange={setLanguageFilter}
      />

      <MuteListManager muteList={muteList} onMuteListChange={setMuteList} />

      <FilterFields
        ngWordsInput={ngWordsInput}
        ngTagsInput={ngTagsInput}
        onNgWordsChange={setNgWordsInput}
        onNgTagsChange={setNgTagsInput}
        onKeyDown={handleKeyDown}
      />

      <div className="filter-actions">
        <Button size="md" variant="secondary" onClick={handleClear}>
          Clear
        </Button>
        <Button size="md" variant="primary" className={`btn-save ${isDirty ? 'is-dirty' : ''}`} onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}
