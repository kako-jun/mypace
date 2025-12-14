import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import Button from './ui/Button'
import Toggle from './ui/Toggle'
import { buildSearchUrl, DEFAULT_SEARCH_FILTERS, saveFiltersToStorage } from '../lib/utils'
import { LANGUAGES } from '../lib/constants'
import type { SearchFilters } from '../types'

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

  // Local state initialized from filters
  const [mypaceOnly, setMypaceOnly] = useState(filters.mypace)
  const [okTagsInput, setOkTagsInput] = useState(filters.tags.join(', '))
  const [ngTagsInput, setNgTagsInput] = useState(filters.ngTags?.join(', ') || '')
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const [ngWordsInput, setNgWordsInput] = useState(filters.ngWords.join(', '))
  const [languageFilter, setLanguageFilter] = useState(filters.lang)

  // Update local state when filters change (URL change)
  useEffect(() => {
    setMypaceOnly(filters.mypace)
    setOkTagsInput(filters.tags.join(', '))
    setNgTagsInput(filters.ngTags?.join(', ') || '')
    setSearchQuery(filters.query)
    setNgWordsInput(filters.ngWords.join(', '))
    setLanguageFilter(filters.lang)
  }, [filters])

  // Track if form is dirty
  const isDirty =
    mypaceOnly !== filters.mypace ||
    okTagsInput !== filters.tags.join(', ') ||
    ngTagsInput !== (filters.ngTags?.join(', ') || '') ||
    searchQuery !== filters.query ||
    ngWordsInput !== filters.ngWords.join(', ') ||
    languageFilter !== filters.lang

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
      mypace: mypaceOnly,
      tags: parseInput(okTagsInput),
      ngTags: parseInput(ngTagsInput),
      query: searchQuery,
      ngWords: parseInput(ngWordsInput),
      mode: filters.mode,
      lang: languageFilter,
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
    setMypaceOnly(true)
    setOkTagsInput('')
    setNgTagsInput('')
    setSearchQuery('')
    setNgWordsInput('')
    setLanguageFilter('')

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

  return (
    <div className={`filter-panel ${isPopup ? 'filter-panel-popup' : 'filter-panel-embedded'}`}>
      {/* mypace toggle */}
      <div className="filter-mypace-row">
        <Toggle checked={mypaceOnly} onChange={setMypaceOnly} label="MY PACE" />
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

      {/* Language selector */}
      <div className="filter-options-row">
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
