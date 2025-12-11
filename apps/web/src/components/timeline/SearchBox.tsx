import { Icon } from '../ui'
import type { FilterMode } from '../../types'

interface SearchBoxProps {
  searchQuery: string
  filterTags: string[]
  filterMode: FilterMode
  onSearchChange: (query: string) => void
  onSearch: () => void
}

export default function SearchBox({ searchQuery, filterTags, filterMode, onSearchChange, onSearch }: SearchBoxProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  const placeholder =
    filterTags.length > 0
      ? `Search within ${filterTags.map((t) => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')}...`
      : 'Search posts...'

  return (
    <div className="search-box">
      <Icon name="Search" size={16} className="search-icon" />
      <input
        type="text"
        className="search-input"
        value={searchQuery}
        placeholder={placeholder}
        onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
      />
      <button className="search-submit" onClick={onSearch} aria-label="Search">
        <Icon name="ArrowRight" size={16} />
      </button>
    </div>
  )
}
