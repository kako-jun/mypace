import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import { buildSearchUrl, DEFAULT_SEARCH_FILTERS } from '../lib/utils'
import { LANGUAGES } from '../lib/constants'
import type { SearchFilters } from '../types'

interface FilterPanelProps {
  // Popup mode
  isPopup?: boolean
  onClose?: () => void
  // Current filter state
  filters?: SearchFilters
  // Callbacks for embedded mode
  onRemoveTag?: (tag: string) => void
  onToggleMode?: () => void
}

export function FilterPanel({
  isPopup = false,
  onClose,
  filters = DEFAULT_SEARCH_FILTERS,
  onRemoveTag,
  onToggleMode,
}: FilterPanelProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  // Local state initialized from filters
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const [ngWordsInput, setNgWordsInput] = useState(filters.ngWords.join(', '))
  const [mypaceOnly, setMypaceOnly] = useState(filters.mypace)
  const [languageFilter, setLanguageFilter] = useState(filters.lang)

  // Update local state when filters change (URL change)
  useEffect(() => {
    setSearchQuery(filters.query)
    setNgWordsInput(filters.ngWords.join(', '))
    setMypaceOnly(filters.mypace)
    setLanguageFilter(filters.lang)
  }, [filters])

  // Track if form is dirty
  const isDirty =
    searchQuery !== filters.query ||
    ngWordsInput !== filters.ngWords.join(', ') ||
    mypaceOnly !== filters.mypace ||
    languageFilter !== filters.lang

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

  // Apply filters - navigate to new URL
  const handleApply = () => {
    const newFilters: SearchFilters = {
      query: searchQuery,
      ngWords: parseNgWords(ngWordsInput),
      tags: filters.tags,
      mode: filters.mode,
      mypace: mypaceOnly,
      lang: languageFilter,
    }

    // Navigate to search URL with new filters
    const url = buildSearchUrl(newFilters)
    navigate(url)
    onClose?.()
  }

  // Clear all filters - navigate to /search with defaults
  const handleClear = () => {
    // Reset local state
    setSearchQuery('')
    setNgWordsInput('')
    setMypaceOnly(true)
    setLanguageFilter('')

    // Navigate to clean search page
    navigate('/search')
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
      {filters.tags.length > 0 && (
        <div className="filter-tags-row">
          {filters.tags.map((tag, index) => (
            <span key={tag} className="filter-tag-item">
              {index > 0 && onToggleMode && (
                <button className="filter-mode-btn" onClick={onToggleMode}>
                  {filters.mode === 'and' ? 'AND' : 'OR'}
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
