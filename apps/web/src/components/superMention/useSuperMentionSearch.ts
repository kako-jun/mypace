import { useState, useEffect, useRef } from 'react'
import { searchWikidata, getSuperMentionSuggestions } from '../../lib/api'
import { TOP_CATEGORIES } from './categories'
import type { SuggestItem } from './types'

interface ParsedQuery {
  category: string | null
  search: string
}

function parseQuery(q: string): ParsedQuery {
  const parts = q.slice(1).split('/')
  if (parts.length >= 2 && parts[1]) {
    return { category: parts[0], search: parts.slice(1).join('/') }
  } else if (parts.length >= 1 && parts[0]) {
    const cat = TOP_CATEGORIES.find((c) => c.path === parts[0])
    if (cat && q.endsWith('/')) {
      return { category: parts[0], search: '' }
    }
    return { category: null, search: parts[0] }
  }
  return { category: null, search: '' }
}

interface UseSuperMentionSearchResult {
  showSuggest: boolean
  mentionStart: number
  items: SuggestItem[]
  loading: boolean
  currentCategory: string | null
}

export function useSuperMentionSearch(content: string, cursorPosition: number): UseSuperMentionSearchResult {
  const [showSuggest, setShowSuggest] = useState(false)
  const [mentionStart, setMentionStart] = useState(-1)
  const [items, setItems] = useState<SuggestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const beforeCursor = content.slice(0, cursorPosition)
    const match = beforeCursor.match(/@(\/[^\s]*)$/)

    if (match) {
      setShowSuggest(true)
      setMentionStart(cursorPosition - match[0].length)

      const { category, search } = parseQuery(match[1])
      setCurrentCategory(category)
      setSearchQuery(search)
    } else {
      setShowSuggest(false)
      setMentionStart(-1)
      setCurrentCategory(null)
      setSearchQuery('')
    }
  }, [content, cursorPosition])

  useEffect(() => {
    if (!showSuggest) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!currentCategory) {
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

    if (!searchQuery) {
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

    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const historyResults = await getSuperMentionSuggestions(`/${currentCategory}/${searchQuery}`, undefined, 5)
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

        const wikidataResults = await searchWikidata(searchQuery, 'ja')
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

        newItems.push({ type: 'custom', label: searchQuery })
        setItems(newItems)
      } catch {
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

  return { showSuggest, mentionStart, items, loading, currentCategory }
}
