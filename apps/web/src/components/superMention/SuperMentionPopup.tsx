import { useState, useEffect, useCallback, useRef } from 'react'
import { searchWikidata, getSuperMentionSuggestions, saveSuperMentionPath, deleteSuperMentionPath } from '../../lib/api'
import { SuggestItemView, type SuggestItem } from './index'
import { CloseButton, Portal } from '../ui'
import Button from '../ui/Button'

interface SuperMentionPopupProps {
  onSelect: (text: string) => void
  onClose: () => void
}

// Replace spaces with underscores for super mention paths
function normalizePath(path: string): string {
  return path.replace(/\s+/g, '_')
}

interface SelectedWikidata {
  id: string
  label: string
  description: string
}

export function SuperMentionPopup({ onSelect, onClose }: SuperMentionPopupProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SuggestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedWikidata, setSelectedWikidata] = useState<SelectedWikidata | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset selectedIndex when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [items.length])

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && items.length > 0) {
      const selected = containerRef.current.querySelector('.selected')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, items])

  // Parse query into keywords (space/comma separated for AND search)
  const parseKeywords = (q: string): string[] => {
    return q
      .split(/[\s,]+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0)
  }

  // Check if item matches all keywords (AND search)
  const matchesAllKeywords = (item: { path: string; description?: string }, keywords: string[]): boolean => {
    if (keywords.length === 0) return true
    const searchText = `${item.path} ${item.description || ''}`.toLowerCase()
    return keywords.every((kw) => searchText.includes(kw))
  }

  // Search logic
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // No query: show recent history
    if (!query) {
      setLoading(true)
      getSuperMentionSuggestions('', undefined, 20)
        .then((suggestions) => {
          const historyItems: SuggestItem[] = suggestions.map((s) => ({
            type: 'history' as const,
            path: s.path,
            description: s.wikidataDescription || '',
            wikidataId: s.wikidataId || undefined,
          }))
          setItems(historyItems)
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
      return
    }

    // Parse keywords for AND search
    const keywords = parseKeywords(query)
    const firstKeyword = keywords[0] || query

    // Search with query
    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Search using first keyword for API efficiency
        const historyResults = await getSuperMentionSuggestions(firstKeyword, undefined, 30)
        const newItems: SuggestItem[] = []

        // Filter history results by all keywords (AND)
        for (const s of historyResults) {
          const item = {
            path: s.path,
            description: s.wikidataDescription || '',
          }
          if (matchesAllKeywords(item, keywords)) {
            newItems.push({
              type: 'history',
              path: s.path,
              description: s.wikidataDescription || '',
              wikidataId: s.wikidataId || undefined,
            })
          }
        }

        // Search Wikidata and filter by all keywords (AND)
        const wikidataResults = await searchWikidata(firstKeyword, 'ja')
        const historyIds = new Set(historyResults.map((h) => h.wikidataId).filter(Boolean))
        for (const w of wikidataResults) {
          if (!historyIds.has(w.id)) {
            const item = { path: w.label, description: w.description }
            if (matchesAllKeywords(item, keywords)) {
              newItems.push({
                type: 'wikidata',
                id: w.id,
                path: w.label,
                description: w.description,
              })
            }
          }
        }

        newItems.push({ type: 'custom', path: query })
        setItems(newItems)
      } catch {
        setItems([{ type: 'custom', path: query }])
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  // When selecting an item, update the query and store wikidata info
  const handleSelect = useCallback((item: SuggestItem) => {
    const path = normalizePath(item.path)
    setQuery(path)

    if (item.type === 'wikidata') {
      setSelectedWikidata({
        id: item.id,
        label: item.path,
        description: item.description,
      })
    } else if (item.type === 'history' && item.wikidataId) {
      setSelectedWikidata({
        id: item.wikidataId,
        label: item.path,
        description: item.description,
      })
    }

    // Focus input for further editing
    inputRef.current?.focus()
  }, [])

  // Confirm and insert the super mention
  const handleConfirm = useCallback(() => {
    if (!query.trim()) return

    const path = normalizePath(query)
    const insertText = `@@${path}`

    // Check if selectedWikidata is still valid for the current path
    // (path should start with the wikidata label for derived paths like "ハンチョウ/20巻")
    let wikidataToSave: SelectedWikidata | null = null
    if (selectedWikidata) {
      const normalizedLabel = normalizePath(selectedWikidata.label).toLowerCase()
      const normalizedQuery = path.toLowerCase()
      if (normalizedQuery === normalizedLabel || normalizedQuery.startsWith(normalizedLabel + '/')) {
        wikidataToSave = selectedWikidata
      }
    }

    // If no valid selectedWikidata, try to find a matching Wikidata item from search results
    if (!wikidataToSave) {
      const normalizedQuery = path.toLowerCase()
      for (const item of items) {
        if (item.type === 'wikidata') {
          const normalizedLabel = normalizePath(item.path).toLowerCase()
          if (normalizedQuery === normalizedLabel || normalizedQuery.startsWith(normalizedLabel + '/')) {
            wikidataToSave = {
              id: item.id,
              label: item.path,
              description: item.description,
            }
            break
          }
        } else if (item.type === 'history' && item.wikidataId) {
          const normalizedLabel = item.path.toLowerCase()
          if (normalizedQuery === normalizedLabel || normalizedQuery.startsWith(normalizedLabel + '/')) {
            wikidataToSave = {
              id: item.wikidataId,
              label: item.path,
              description: item.description,
            }
            break
          }
        }
      }
    }

    saveSuperMentionPath(path, wikidataToSave?.id, wikidataToSave?.label, wikidataToSave?.description).catch(() => {})

    onSelect(insertText)
    onClose()
  }, [query, selectedWikidata, items, onSelect, onClose])

  const handleDelete = useCallback(async (item: SuggestItem) => {
    if (item.type !== 'history') return
    const success = await deleteSuperMentionPath(item.path)
    if (success) {
      setItems((prev) => prev.filter((i) => !(i.type === 'history' && i.path === item.path)))
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedIndex((i) => (i + 1) % items.length)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          }
          break
        case 'Tab':
          e.preventDefault()
          if (items.length > 0) {
            handleSelect(items[selectedIndex])
          }
          break
        case 'Enter':
          e.preventDefault()
          handleConfirm()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [items, selectedIndex, handleSelect, handleConfirm, onClose]
  )

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <Portal>
      <div className="super-mention-popup-backdrop" onClick={handleBackdropClick}>
        <div className="super-mention-popup">
          <div className="super-mention-popup-header">
            <h3>Super Mention</h3>
            <CloseButton onClick={onClose} size={20} />
          </div>
          <div className="super-mention-popup-search">
            <div className="super-mention-popup-input-group">
              <span className="super-mention-popup-prefix">@@</span>
              <input
                ref={inputRef}
                type="text"
                className="super-mention-popup-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
              />
            </div>
          </div>
          <div ref={containerRef} className="super-mention-popup-list">
            {loading && items.length === 0 && <div className="super-mention-suggest-loading">Searching...</div>}
            {items.map((item, index) => (
              <SuggestItemView
                key={
                  item.type === 'wikidata' ? `wd-${item.id}` : item.type === 'history' ? `hist-${item.path}` : 'custom'
                }
                item={item}
                isSelected={index === selectedIndex}
                onSelect={handleSelect}
                onHover={() => setSelectedIndex(index)}
                onDelete={item.type === 'history' ? handleDelete : undefined}
              />
            ))}
            {!loading && items.length === 0 && <div className="super-mention-suggest-empty">No results</div>}
          </div>
          <div className="super-mention-popup-footer">
            <Button size="md" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button size="md" variant="primary" onClick={handleConfirm} disabled={!query.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
