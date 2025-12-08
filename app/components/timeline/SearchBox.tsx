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
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  const placeholder =
    filterTags.length > 0
      ? `Search within ${filterTags.map((t) => '#' + t).join(filterMode === 'and' ? ' + ' : ' | ')}...`
      : 'Search posts...'

  return (
    <div class="search-box">
      <Icon name="Search" size={16} />
      <input
        type="text"
        class="search-input"
        value={searchQuery}
        placeholder={placeholder}
        onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
      />
      <button class="search-submit" onClick={onSearch} aria-label="Search">
        <Icon name="ArrowRight" size={16} />
      </button>
    </div>
  )
}
