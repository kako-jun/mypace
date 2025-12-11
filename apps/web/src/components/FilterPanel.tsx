import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import { getBoolean, setBoolean, getString, setString, buildSearchUrl } from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS, LANGUAGES } from '../lib/constants'
import type { FilterMode } from '../types'

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
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [mypaceOnly, setMypaceOnlyState] = useState(() => getBoolean(STORAGE_KEYS.MYPACE_ONLY, true))
  const [languageFilter, setLanguageFilterState] = useState(() => getString(STORAGE_KEYS.LANGUAGE_FILTER) || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isPopup && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isPopup])

  const handleMypaceToggle = () => {
    const newValue = !mypaceOnly
    setMypaceOnlyState(newValue)
    setBoolean(STORAGE_KEYS.MYPACE_ONLY, newValue)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED))
  }

  const handleLanguageSelect = (code: string) => {
    setLanguageFilterState(code)
    setString(STORAGE_KEYS.LANGUAGE_FILTER, code)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED))
  }

  const handleSearch = () => {
    if (onSearchQueryChange) {
      onSearchQueryChange(searchQuery)
    }
    const url = buildSearchUrl(searchQuery, filterTags, filterMode)
    navigate(url)
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape' && isPopup) {
      onClose?.()
    }
  }

  const currentLanguageLabel = LANGUAGES.find((l) => l.code === languageFilter)?.label || 'All'
  const hasActiveFilters = searchQuery || filterTags.length > 0 || languageFilter || !mypaceOnly

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      {/* Search input */}
      <div className="filter-search-row">
        <Icon name="Search" size={16} className="filter-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="filter-search-input"
          value={searchQuery}
          placeholder="Search posts..."
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="filter-search-submit" onClick={handleSearch} aria-label="Search">
          <Icon name="ArrowRight" size={16} />
        </button>
      </div>

      {/* Filter options row */}
      <div className="filter-options-row">
        {/* mypace only toggle */}
        <label
          className="filter-option mypace-option"
          title={mypaceOnly ? 'Showing #mypace posts only' : 'Showing all posts'}
        >
          <input type="checkbox" checked={mypaceOnly} onChange={handleMypaceToggle} />
          <span className="option-label">mypace only</span>
        </label>

        {/* Language selector */}
        <div className="filter-option language-option">
          <Icon name="Globe" size={14} />
          <select
            value={languageFilter}
            onChange={(e) => handleLanguageSelect(e.target.value)}
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
          {onClearTags && (
            <button className="filter-clear-btn" onClick={onClearTags}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Active filters summary (for popup) */}
      {isPopup && hasActiveFilters && (
        <div className="filter-summary">
          {mypaceOnly && <span className="filter-chip">mypace</span>}
          {languageFilter && <span className="filter-chip">{currentLanguageLabel}</span>}
        </div>
      )}
    </div>
  )
}
