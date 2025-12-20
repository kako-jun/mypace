import { useState, useEffect, useCallback, useRef } from 'react'
import { searchWikidata, getSuperMentionSuggestions, saveSuperMentionPath } from '../../lib/api'
import { TOP_CATEGORIES } from './categories'
import { SuggestItemView, type SuggestItem } from './index'

interface SuperMentionPopupProps {
  onSelect: (text: string) => void
  onClose: () => void
}

export function SuperMentionPopup({ onSelect, onClose }: SuperMentionPopupProps) {
  const [query, setQuery] = useState('')
  const [currentCategory, setCurrentCategory] = useState<string | null>(null)
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

    // Show categories if no category selected
    if (!currentCategory) {
      const filtered = TOP_CATEGORIES.filter((cat) => {
        if (!query) return true
        return cat.path.toLowerCase().includes(query.toLowerCase()) || cat.label.includes(query)
      }).map((cat) => ({
        type: 'category' as const,
        ...cat,
      }))
      setItems(filtered)
      setLoading(false)
      return
    }

    // Category selected, show history or search
    if (!query) {
      setLoading(true)
      getSuperMentionSuggestions('', currentCategory, 10)
        .then((suggestions) => {
          const historyItems: SuggestItem[] = suggestions.map((s) => ({
            type: 'history' as const,
            path: s.path,
            label: s.wikidataLabel || s.path.split('/').pop() || '',
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
        const historyResults = await getSuperMentionSuggestions(query, currentCategory, 5)
        const newItems: SuggestItem[] = []

        for (const s of historyResults) {
          newItems.push({
            type: 'history',
            path: s.path,
            label: s.wikidataLabel || s.path.split('/').pop() || '',
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
  }, [currentCategory, query])

  const handleSelect = useCallback(
    async (item: SuggestItem) => {
      let insertText: string
      let path: string | undefined
      let wikidataId: string | undefined
      let wikidataLabel: string | undefined
      let wikidataDescription: string | undefined

      switch (item.type) {
        case 'category':
          setCurrentCategory(item.path)
          setQuery('')
          inputRef.current?.focus()
          return

        case 'wikidata':
          path = `/${currentCategory}/${item.label}`
          insertText = `@${path} `
          wikidataId = item.id
          wikidataLabel = item.label
          wikidataDescription = item.description
          break

        case 'history':
          path = item.path
          insertText = `@${path} `
          wikidataId = item.wikidataId
          wikidataLabel = item.label
          wikidataDescription = item.description
          break

        case 'custom':
          path = `/${currentCategory}/${item.label}`
          insertText = `@${path} `
          break

        default:
          return
      }

      if (currentCategory && path) {
        saveSuperMentionPath(path, currentCategory, wikidataId, wikidataLabel, wikidataDescription).catch(() => {})
      }

      onSelect(insertText)
      onClose()
    },
    [currentCategory, onSelect, onClose]
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
        case 'Backspace':
          if (query === '' && currentCategory) {
            e.preventDefault()
            setCurrentCategory(null)
          }
          break
      }
    },
    [items, selectedIndex, handleSelect, onClose, query, currentCategory]
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
          <span className="super-mention-popup-prefix">@/</span>
          {currentCategory && (
            <button type="button" className="super-mention-popup-category" onClick={() => setCurrentCategory(null)}>
              {currentCategory}/
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            className="super-mention-popup-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentCategory ? '検索...' : 'カテゴリを選択...'}
          />
        </div>
        <div ref={containerRef} className="super-mention-popup-list">
          {loading && items.length === 0 && <div className="super-mention-suggest-loading">検索中...</div>}
          {items.map((item, index) => (
            <SuggestItemView
              key={
                item.type === 'category'
                  ? `cat-${item.path}`
                  : item.type === 'wikidata'
                    ? `wd-${item.id}`
                    : item.type === 'history'
                      ? `hist-${item.path}`
                      : 'custom'
              }
              item={item}
              isSelected={index === selectedIndex}
              currentCategory={currentCategory}
              onSelect={handleSelect}
              onHover={() => setSelectedIndex(index)}
            />
          ))}
          {!loading && items.length === 0 && currentCategory && (
            <div className="super-mention-suggest-empty">候補が見つかりません</div>
          )}
        </div>
      </div>
    </div>
  )
}
