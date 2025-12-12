import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import { getBoolean, setBoolean, getString, setString, buildSearchUrl } from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS, LANGUAGES } from '../lib/constants'
import type { FilterMode } from '../types'

// Helper to get/set NG words array
function getNgWords(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.NG_WORDS)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setNgWords(words: string[]): void {
  localStorage.setItem(STORAGE_KEYS.NG_WORDS, JSON.stringify(words))
}

interface FilterPanelProps {
  // Popup mode
  isPopup?: boolean
  onClose?: () => void
  // Current filter state (for embedded mode)
  initialSearchQuery?: string
  filterTags?: string[]
  filterMode?: FilterMode
  // Callbacks for embedded mode
  onSearchQueryChange?: (query: string) => void
  onRemoveTag?: (tag: string) => void
  onToggleMode?: () => void
  onClearTags?: () => void
}

export function FilterPanel({
  isPopup = false,
  onClose,
  initialSearchQuery = '',
  filterTags = [],
  filterMode = 'and',
  onSearchQueryChange,
  onRemoveTag,
  onToggleMode,
  onClearTags,
}: FilterPanelProps) {
  const navigate = useNavigate()
  // Local state (not saved until Apply)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [mypaceOnly, setMypaceOnly] = useState(() => getBoolean(STORAGE_KEYS.MYPACE_ONLY, true))
  const [languageFilter, setLanguageFilter] = useState(() => getString(STORAGE_KEYS.LANGUAGE_FILTER) || '')
  const [ngWordsInput, setNgWordsInput] = useState(() => getNgWords().join(', '))
  const inputRef = useRef<HTMLInputElement>(null)

  // Track initial values for dirty detection
  const initialMypaceOnly = getBoolean(STORAGE_KEYS.MYPACE_ONLY, true)
  const initialLanguageFilter = getString(STORAGE_KEYS.LANGUAGE_FILTER) || ''
  const initialNgWords = getNgWords().join(', ')
  const isDirty =
    searchQuery !== initialSearchQuery ||
    mypaceOnly !== initialMypaceOnly ||
    languageFilter !== initialLanguageFilter ||
    ngWordsInput !== initialNgWords

  useEffect(() => {
    if (isPopup && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isPopup])

  // Parse NG words input to array
  const parseNgWords = (input: string): string[] => {
    return input
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  }

  // Apply filters - save to storage and navigate
  const handleApply = () => {
    // Save settings to storage
    setBoolean(STORAGE_KEYS.MYPACE_ONLY, mypaceOnly)
    setString(STORAGE_KEYS.LANGUAGE_FILTER, languageFilter)
    setNgWords(parseNgWords(ngWordsInput))

    // Notify filter changes
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED))
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED))
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.NG_WORDS_CHANGED))

    if (onSearchQueryChange) {
      onSearchQueryChange(searchQuery)
    }

    // Navigate to search URL or home
    if (searchQuery || filterTags.length > 0) {
      const url = buildSearchUrl(searchQuery, filterTags, filterMode)
      navigate(url)
    } else {
      navigate('/')
    }

    onClose?.()
  }

  // Clear all filters - reset to defaults
  const handleClear = () => {
    // Reset to defaults
    setMypaceOnly(true)
    setLanguageFilter('')
    setSearchQuery('')
    setNgWordsInput('')

    // Save defaults to storage
    setBoolean(STORAGE_KEYS.MYPACE_ONLY, true)
    setString(STORAGE_KEYS.LANGUAGE_FILTER, '')
    setNgWords([])

    // Clear tags if callback exists
    onClearTags?.()

    // Notify filter changes
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED))
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED))
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.NG_WORDS_CHANGED))

    // Navigate to home
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

  const currentLanguageLabel = LANGUAGES.find((l) => l.code === languageFilter)?.label || 'All'
  const currentNgWords = parseNgWords(ngWordsInput)

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      {/* OK word input (include) */}
      <div className="filter-search-row">
        <Icon name="Search" size={16} className="filter-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="filter-search-input"
          value={searchQuery}
          placeholder="OK word..."
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* NG word input (exclude) */}
      <div className="filter-search-row filter-ng-row">
        <Icon name="Ban" size={16} className="filter-search-icon filter-ng-icon" />
        <input
          type="text"
          className="filter-search-input"
          value={ngWordsInput}
          placeholder="NG word..."
          onChange={(e) => setNgWordsInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Filter options row */}
      <div className="filter-options-row">
        {/* mypace toggle */}
        <div className="filter-option mypace-option">
          <Toggle checked={mypaceOnly} onChange={setMypaceOnly} label="MY PACE" />
        </div>

        {/* Language selector */}
        <div className="filter-option language-option">
          <Icon name="Globe" size={14} />
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="language-select"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tag filters (if any) */}
      {filterTags.length > 0 && (
        <div className="filter-tags-row">
          {filterTags.map((tag, index) => (
            <span key={tag} className="filter-tag-item">
              {index > 0 && onToggleMode && (
                <button className="filter-mode-btn" onClick={onToggleMode}>
                  {filterMode === 'and' ? 'AND' : 'OR'}
                </button>
              )}
              <span className="filter-tag">
                #{tag}
                {onRemoveTag && (
                  <button
                    className="filter-tag-remove"
                    onClick={() => onRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                )}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Active filters summary (for popup) */}
      {isPopup && (mypaceOnly || languageFilter || currentNgWords.length > 0) && (
        <div className="filter-summary">
          {mypaceOnly && <span className="filter-chip">mypace</span>}
          {languageFilter && <span className="filter-chip">{currentLanguageLabel}</span>}
          {currentNgWords.length > 0 && <span className="filter-chip filter-chip-ng">NG: {currentNgWords.length}</span>}
        </div>
      )}

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
