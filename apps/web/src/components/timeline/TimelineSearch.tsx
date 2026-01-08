import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../ui'
import '../../styles/components/timeline-search.css'

interface TimelineSearchProps {
  onFiltersChange: (filters: { q: string[]; tags: string[] }) => void
}

export function TimelineSearch({ onFiltersChange }: TimelineSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read from URL (stored as comma-separated)
  const urlQueryParam = searchParams.get('q') || ''
  const urlTagsParam = searchParams.get('tags') || ''

  // Local input state (user-facing, space-separated)
  const [queryInput, setQueryInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // Active state (what's actually being filtered, space-separated)
  const [activeQuery, setActiveQuery] = useState('')
  const [activeTags, setActiveTags] = useState('')

  // Parse space-separated string to array
  const parseInput = useCallback((input: string): string[] => {
    if (!input) return []
    return input
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean) // Remove empty strings
  }, [])

  // Initialize from URL on mount
  useEffect(() => {
    // Parse + separated from URL (Google-style, special chars auto-encoded)
    const qArray = urlQueryParam ? urlQueryParam.split('+').map(decodeURIComponent).filter(Boolean) : []
    const tagsArray = urlTagsParam ? urlTagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
    const queryDisplay = qArray.join(' ')
    const tagsDisplay = tagsArray.join(' ')
    setQueryInput(queryDisplay)
    setTagsInput(tagsDisplay)
    setActiveQuery(queryDisplay)
    setActiveTags(tagsDisplay)
    onFiltersChange({ q: qArray, tags: tagsArray })
  }, [urlQueryParam, urlTagsParam, onFiltersChange])

  // Update URL helper - store as + separated (Google-style)
  const updateUrl = useCallback(
    (qArray: string[], tagsArray: string[]) => {
      const params = new URLSearchParams(searchParams)
      if (qArray.length > 0) {
        params.set('q', qArray.map(encodeURIComponent).join('+'))
      } else {
        params.delete('q')
      }
      if (tagsArray.length > 0) {
        params.set('tags', tagsArray.map(encodeURIComponent).join('+'))
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
    const parsedQuery = parseInput(trimmedQuery)
    const parsedTags = parseInput(trimmedTags)
    setActiveQuery(trimmedQuery)
    setActiveTags(trimmedTags)
    updateUrl(parsedQuery, parsedTags)
    onFiltersChange({ q: parsedQuery, tags: parsedTags })
  }

  const handleClearQuery = () => {
    setQueryInput('')
    setActiveQuery('')
    updateUrl([], parseInput(activeTags))
    onFiltersChange({ q: [], tags: parseInput(activeTags) })
  }

  const handleClearTags = () => {
    setTagsInput('')
    setActiveTags('')
    updateUrl(parseInput(activeQuery), [])
    onFiltersChange({ q: parseInput(activeQuery), tags: [] })
  }

  const handleClearAll = () => {
    setQueryInput('')
    setTagsInput('')
    setActiveQuery('')
    setActiveTags('')
    updateUrl([], [])
    onFiltersChange({ q: [], tags: [] })
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
