import { Icon } from '../ui'
import type { FilterMode } from '../../types'

interface FilterBarProps {
  filterTags: string[]
  filterMode: FilterMode
  filterCopied: boolean
  onRemoveTag: (tag: string) => void
  onToggleMode: () => void
  onClearAll: () => void
  onShare: () => void
}

export default function FilterBar({
  filterTags,
  filterMode,
  filterCopied,
  onRemoveTag,
  onToggleMode,
  onClearAll,
  onShare,
}: FilterBarProps) {
  if (filterTags.length === 0) return null

  return (
    <div className="filter-bar">
      {filterTags.map((tag, index) => (
        <>
          {index > 0 && (
            <button
              className="filter-mode-toggle"
              onClick={onToggleMode}
              aria-label={`Toggle filter mode, currently ${filterMode.toUpperCase()}`}
            >
              {filterMode === 'and' ? 'AND' : 'OR'}
            </button>
          )}
          <span className="filter-tag">
            #{tag}
            <button className="filter-tag-remove" onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
              ×
            </button>
          </span>
        </>
      ))}
      <button className="filter-clear-all" onClick={onClearAll} aria-label="Clear all filters">
        Clear all
      </button>
      <button
        className={`filter-share ${filterCopied ? 'copied' : ''}`}
        onClick={onShare}
        title="Share"
        aria-label={filterCopied ? 'Link copied' : 'Share filter'}
      >
        {filterCopied ? <Icon name="Check" size={14} /> : <Icon name="Share2" size={14} />}
      </button>
    </div>
  )
}
