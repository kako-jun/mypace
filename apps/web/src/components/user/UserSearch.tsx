import { useState, useEffect } from 'react'
import { Icon } from '../ui'
import '../../styles/components/user-view.css'

interface UserSearchProps {
  pubkey: string
  onQueryChange: (query: string) => void
}

export function UserSearch({ pubkey, onQueryChange }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')

  // Reset search when user changes
  useEffect(() => {
    setSearchQuery('')
    setActiveQuery('')
    onQueryChange('')
  }, [pubkey, onQueryChange])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    setActiveQuery(trimmed)
    onQueryChange(trimmed)
  }

  const handleClear = () => {
    setSearchQuery('')
    setActiveQuery('')
    onQueryChange('')
  }

  return (
    <div className="user-search">
      <form onSubmit={handleSearch} className="user-search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search posts..."
          className="user-search-input"
        />
        <button type="submit" className="user-search-button" aria-label="Search">
          <Icon name="Search" size={16} />
        </button>
      </form>
      {activeQuery && (
        <div className="user-search-active">
          <span>Searching: &quot;{activeQuery}&quot;</span>
          <button onClick={handleClear} className="user-search-clear">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
