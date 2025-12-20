import { useState, useEffect, useCallback, useRef } from 'react'
import { searchWikidata, getSuperMentionSuggestions, saveSuperMentionLabel } from '../../lib/api'
import { SuggestItemView, type SuggestItem } from './index'

interface SuperMentionPopupProps {
  onSelect: (text: string) => void
  onClose: () => void
}

// Replace spaces with underscores for super mention labels
function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, '_')
}

export function SuperMentionPopup({ onSelect, onClose }: SuperMentionPopupProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SuggestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
            label: s.wikidataLabel || s.path,
            description: s.wikidataDescription || '',
            wikidataId: s.wikidataId || undefined,
          }))
          setItems(historyItems)
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
      return
    }

    // Search with query
    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const historyResults = await getSuperMentionSuggestions(query, undefined, 10)
        const newItems: SuggestItem[] = []

        for (const s of historyResults) {
          newItems.push({
            type: 'history',
            path: s.path,
            label: s.wikidataLabel || s.path,
            description: s.wikidataDescription || '',
            wikidataId: s.wikidataId || undefined,
          })
        }

        const wikidataResults = await searchWikidata(query, 'ja')
        const historyIds = new Set(historyResults.map((h) => h.wikidataId).filter(Boolean))
        for (const w of wikidataResults) {
          if (!historyIds.has(w.id)) {
            newItems.push({
              type: 'wikidata',
              id: w.id,
              label: w.label,
              description: w.description,
            })
          }
        }

        newItems.push({ type: 'custom', label: query })
        setItems(newItems)
      } catch {
        setItems([{ type: 'custom', label: query }])
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

  const handleSelect = useCallback(
    async (item: SuggestItem) => {
      let insertText: string
      let label: string
      let wikidataId: string | undefined
      let wikidataLabel: string | undefined
      let wikidataDescription: string | undefined

      switch (item.type) {
        case 'wikidata':
          label = normalizeLabel(item.label)
          insertText = `@@${label} `
          wikidataId = item.id
          wikidataLabel = item.label
          wikidataDescription = item.description
          break

        case 'history':
          label = normalizeLabel(item.label)
          insertText = `@@${label} `
          wikidataId = item.wikidataId
          wikidataLabel = item.label
          wikidataDescription = item.description
          break

        case 'custom':
          label = normalizeLabel(item.label)
          insertText = `@@${label} `
          break

        default:
          return
      }

      saveSuperMentionLabel(label, wikidataId, wikidataLabel, wikidataDescription).catch(() => {})

      onSelect(insertText)
      onClose()
    },
    [onSelect, onClose]
  )

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
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          if (items.length > 0) {
            handleSelect(items[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [items, selectedIndex, handleSelect, onClose]
  )

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="super-mention-popup-backdrop" onClick={handleBackdropClick}>
      <div className="super-mention-popup">
        <div className="super-mention-popup-header">
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
            />
          ))}
          {!loading && items.length === 0 && <div className="super-mention-suggest-empty">No results</div>}
        </div>
      </div>
    </div>
  )
}
