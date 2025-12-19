import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen,
  Clapperboard,
  Gamepad2,
  Film,
  Music,
  Book,
  Code,
  MapPin,
  User,
  Lightbulb,
  Globe,
  Check,
  Pin,
  Search,
  PenLine,
} from 'lucide-react'
import { searchWikidata, getSuperMentionSuggestions, saveSuperMentionPath } from '../lib/api'

// Top-level categories for super mentions
const TOP_CATEGORIES = [
  { path: 'manga', label: '漫画', icon: BookOpen },
  { path: 'anime', label: 'アニメ', icon: Clapperboard },
  { path: 'game', label: 'ゲーム', icon: Gamepad2 },
  { path: 'movie', label: '映画', icon: Film },
  { path: 'music', label: '音楽', icon: Music },
  { path: 'book', label: '書籍', icon: Book },
  { path: 'tech', label: '技術', icon: Code },
  { path: 'place', label: '場所', icon: MapPin },
  { path: 'person', label: '人物', icon: User },
  { path: 'thing', label: '物・概念', icon: Lightbulb },
  { path: 'web', label: 'Web', icon: Globe },
]

interface SuperMentionSuggestProps {
  content: string
  cursorPosition: number
  onSelect: (text: string, replaceStart: number, replaceEnd: number) => void
  onClose: () => void
}

type LucideIcon = typeof BookOpen

type SuggestItem =
  | { type: 'category'; path: string; label: string; icon: LucideIcon }
  | { type: 'wikidata'; id: string; label: string; description: string }
  | { type: 'history'; path: string; label: string; description: string; wikidataId?: string }
  | { type: 'custom'; label: string }

export function SuperMentionSuggest({ content, cursorPosition, onSelect, onClose }: SuperMentionSuggestProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSuggest, setShowSuggest] = useState(false)
  const [mentionStart, setMentionStart] = useState(-1)
  const [items, setItems] = useState<SuggestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse query to extract category and search term
  const parseQuery = (q: string): { category: string | null; search: string } => {
    // q starts with / (e.g., "/manga/ハンチョウ")
    const parts = q.slice(1).split('/') // Remove leading /, split by /
    if (parts.length >= 2 && parts[1]) {
      // Has category and search term (e.g., "manga", "ハンチョウ")
      return { category: parts[0], search: parts.slice(1).join('/') }
    } else if (parts.length >= 1 && parts[0]) {
      // Might be partial category or category with trailing /
      const cat = TOP_CATEGORIES.find((c) => c.path === parts[0])
      if (cat && q.endsWith('/')) {
        // Complete category with trailing slash
        return { category: parts[0], search: '' }
      }
      // Partial category name
      return { category: null, search: parts[0] }
    }
    return { category: null, search: '' }
  }

  // Detect @/ pattern before cursor
  useEffect(() => {
    const beforeCursor = content.slice(0, cursorPosition)
    const match = beforeCursor.match(/@(\/[^\s]*)$/)

    if (match) {
      setShowSuggest(true)
      setMentionStart(cursorPosition - match[0].length)

      const { category, search } = parseQuery(match[1])
      setCurrentCategory(category)
      setSearchQuery(search)
      setSelectedIndex(0)
    } else {
      setShowSuggest(false)
      setMentionStart(-1)
      setCurrentCategory(null)
      setSearchQuery('')
    }
  }, [content, cursorPosition])

  // Search for suggestions
  useEffect(() => {
    if (!showSuggest) return

    // Clear pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!currentCategory) {
      // Show category list filtered by search
      const filtered = TOP_CATEGORIES.filter((cat) => {
        if (!searchQuery) return true
        return cat.path.toLowerCase().startsWith(searchQuery.toLowerCase()) || cat.label.includes(searchQuery)
      }).map((cat) => ({
        type: 'category' as const,
        ...cat,
      }))
      setItems(filtered)
      setLoading(false)
      return
    }

    // Have category, search for items
    if (!searchQuery) {
      // Show popular items in this category from history
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

    // Debounce Wikidata search
    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // First, check history
        const historyResults = await getSuperMentionSuggestions(`/${currentCategory}/${searchQuery}`, undefined, 5)

        const newItems: SuggestItem[] = []

        // Add history items first
        for (const s of historyResults) {
          newItems.push({
            type: 'history',
            path: s.path,
            label: s.wikidataLabel || s.path.split('/').pop() || '',
            description: s.wikidataDescription || '',
            wikidataId: s.wikidataId || undefined,
          })
        }

        // Always search Wikidata to allow corrections
        // History items shown first, Wikidata candidates below
        const wikidataResults = await searchWikidata(searchQuery, 'ja')

        // Add Wikidata items (filter out those already in history by Q number)
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

        // Add custom option at the end
        newItems.push({
          type: 'custom',
          label: searchQuery,
        })

        setItems(newItems)
      } catch {
        // On error, just show custom option
        setItems([{ type: 'custom', label: searchQuery }])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [showSuggest, currentCategory, searchQuery])

  const handleSelect = useCallback(
    async (item: SuggestItem) => {
      let insertText: string
      let path: string
      let wikidataId: string | undefined
      let wikidataLabel: string | undefined
      let wikidataDescription: string | undefined

      switch (item.type) {
        case 'category':
          insertText = `@/${item.path}/`
          onSelect(insertText, mentionStart, cursorPosition)
          onClose()
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

      // Save path to DB (fire and forget)
      if (currentCategory && path) {
        saveSuperMentionPath(path, currentCategory, wikidataId, wikidataLabel, wikidataDescription).catch(() => {
          // Ignore errors
        })
      }

      onSelect(insertText, mentionStart, cursorPosition)
      onClose()
    },
    [mentionStart, cursorPosition, currentCategory, onSelect, onClose]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showSuggest || items.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + items.length) % items.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          handleSelect(items[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [showSuggest, items, selectedIndex, handleSelect, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selectedIndex when items change to prevent out-of-bounds
  useEffect(() => {
    if (items.length > 0 && selectedIndex >= items.length) {
      setSelectedIndex(0)
    }
  }, [items.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && items.length > 0) {
      const selected = containerRef.current.querySelector('.selected')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, items])

  if (!showSuggest) return null

  const renderItem = (item: SuggestItem, index: number) => {
    const isSelected = index === selectedIndex
    const IconComponent = item.type === 'category' ? item.icon : null

    switch (item.type) {
      case 'category':
        return (
          <button
            key={`cat-${item.path}`}
            className={`super-mention-suggest-item ${isSelected ? 'selected' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="super-mention-suggest-icon">{IconComponent && <IconComponent size={16} />}</span>
            <span className="super-mention-suggest-path">@/{item.path}/</span>
            <span className="super-mention-suggest-label">{item.label}</span>
          </button>
        )

      case 'wikidata':
        return (
          <button
            key={`wd-${item.id}`}
            className={`super-mention-suggest-item ${isSelected ? 'selected' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            title={`Wikidata: ${item.id}`}
          >
            <span className="super-mention-suggest-icon">
              <Search size={16} />
            </span>
            <span className="super-mention-suggest-path">{item.label}</span>
            <span className="super-mention-suggest-desc">
              {item.description}
              <span className="super-mention-q-badge">{item.id}</span>
            </span>
          </button>
        )

      case 'history':
        return (
          <button
            key={`hist-${item.path}`}
            className={`super-mention-suggest-item ${isSelected ? 'selected' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            title={item.wikidataId ? `Wikidata: ${item.wikidataId}` : undefined}
          >
            <span className="super-mention-suggest-icon">
              {item.wikidataId ? <Check size={16} /> : <Pin size={16} />}
            </span>
            <span className="super-mention-suggest-path">{item.label}</span>
            <span className="super-mention-suggest-desc">
              {item.description}
              {item.wikidataId && <span className="super-mention-q-badge">{item.wikidataId}</span>}
            </span>
          </button>
        )

      case 'custom':
        return (
          <button
            key="custom"
            className={`super-mention-suggest-item ${isSelected ? 'selected' : ''}`}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="super-mention-suggest-icon">
              <PenLine size={16} />
            </span>
            <span className="super-mention-suggest-path">
              @/{currentCategory}/{item.label}
            </span>
            <span className="super-mention-suggest-desc">新規作成</span>
          </button>
        )
    }
  }

  return (
    <div ref={containerRef} className="super-mention-suggest">
      {loading && items.length === 0 && <div className="super-mention-suggest-loading">検索中...</div>}
      {items.map((item, index) => renderItem(item, index))}
      {!loading && items.length === 0 && currentCategory && (
        <div className="super-mention-suggest-empty">候補が見つかりません</div>
      )}
    </div>
  )
}

export default SuperMentionSuggest
