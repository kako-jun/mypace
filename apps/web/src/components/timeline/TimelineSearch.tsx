import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../ui'
import '../../styles/components/timeline-search.css'

interface TimelineSearchProps {
  onFiltersChange: (filters: { q: string; tags: string[] }) => void
}

export function TimelineSearch({ onFiltersChange }: TimelineSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read from URL
  const urlQuery = searchParams.get('q') || ''
  const urlTagsParam = searchParams.get('tags') || ''

  // Local input state
  const [queryInput, setQueryInput] = useState(urlQuery)
  const [tagsInput, setTagsInput] = useState(urlTagsParam)

  // Active state (what's actually being filtered)
  const [activeQuery, setActiveQuery] = useState(urlQuery)
  const [activeTags, setActiveTags] = useState(urlTagsParam)

  // Parse tags string to array (supports both + and , separators)
  const parseTags = useCallback((tagsStr: string): string[] => {
    if (!tagsStr) return []
    return tagsStr
      .split(/[+,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
  }, [])

  // Initialize from URL on mount
  useEffect(() => {
    setQueryInput(urlQuery)
    setTagsInput(urlTagsParam)
    setActiveQuery(urlQuery)
    setActiveTags(urlTagsParam)
    onFiltersChange({ q: urlQuery, tags: parseTags(urlTagsParam) })
  }, [urlQuery, urlTagsParam, onFiltersChange, parseTags])

  // Update URL helper
  const updateUrl = useCallback(
    (q: string, tags: string) => {
      const params = new URLSearchParams(searchParams)
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      if (tags) {
        params.set('tags', tags)
      } else {
        params.delete('tags')
      }
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedQuery = queryInput.trim()
    const trimmedTags = tagsInput.trim()
    setActiveQuery(trimmedQuery)
    setActiveTags(trimmedTags)
    updateUrl(trimmedQuery, trimmedTags)
    onFiltersChange({ q: trimmedQuery, tags: parseTags(trimmedTags) })
  }

  const handleClearQuery = () => {
    setQueryInput('')
    setActiveQuery('')
    updateUrl('', activeTags)
    onFiltersChange({ q: '', tags: parseTags(activeTags) })
  }

  const handleClearTags = () => {
    setTagsInput('')
    setActiveTags('')
    updateUrl(activeQuery, '')
    onFiltersChange({ q: activeQuery, tags: [] })
  }

  const handleClearAll = () => {
    setQueryInput('')
    setTagsInput('')
    setActiveQuery('')
    setActiveTags('')
    updateUrl('', '')
    onFiltersChange({ q: '', tags: [] })
  }

  const hasActiveFilters = activeQuery || activeTags

  return (
    <div className="timeline-search">
      <div className="timeline-search-card">
        <form onSubmit={handleSearch} className="timeline-search-form">
          <div className="timeline-search-row">
            <Icon name="Search" size={16} className="timeline-search-icon" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Keywords..."
              className="timeline-search-input"
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput('')}
                className="timeline-search-clear"
                aria-label="Clear input"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="timeline-search-row">
            <Icon name="Hash" size={16} className="timeline-search-icon" />
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags..."
              className="timeline-search-input"
            />
            {tagsInput && (
              <button
                type="button"
                onClick={() => setTagsInput('')}
                className="timeline-search-clear"
                aria-label="Clear input"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="timeline-search-actions">
            <button type="button" onClick={handleClearAll} className="timeline-search-btn timeline-search-btn-clear">
              Clear
            </button>
            <button type="submit" className="timeline-search-btn timeline-search-btn-apply">
              <Icon name="Check" size={16} />
              Apply
            </button>
          </div>
        </form>
        {hasActiveFilters && (
          <div className="timeline-search-active">
            {activeQuery && (
              <span className="timeline-search-chip">
                <Icon name="Search" size={12} />
                {activeQuery}
                <button onClick={handleClearQuery} className="timeline-search-chip-clear" aria-label="Clear search">
                  <Icon name="X" size={12} />
                </button>
              </span>
            )}
            {activeTags && (
              <span className="timeline-search-chip">
                <Icon name="Hash" size={12} />
                {activeTags}
                <button onClick={handleClearTags} className="timeline-search-chip-clear" aria-label="Clear tags">
                  <Icon name="X" size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
