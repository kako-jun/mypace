import { Icon, Input } from '../ui'
import type { FilterMode } from '../../types'

interface SearchBoxProps {
  searchQuery: string
  filterTags: string[]
  filterMode: FilterMode
  onSearchChange: (query: string) => void
  onSearch: () => void
}

export default function SearchBox({ searchQuery, filterTags, filterMode, onSearchChange, onSearch }: SearchBoxProps) {
  const placeholder =
    filterTags.length > 0
      ? `Search within ${filterTags.map((t) => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')}...`
      : 'Search posts...'

  return (
    <div className="search-box">
      <Icon name="Search" size={16} className="search-icon" />
      <Input
        value={searchQuery}
        placeholder={placeholder}
        onChange={onSearchChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch()
        }}
        className="search-input"
      />
      <button className="search-submit" onClick={onSearch} aria-label="Search">
        <Icon name="ArrowRight" size={16} />
      </button>
    </div>
  )
}
