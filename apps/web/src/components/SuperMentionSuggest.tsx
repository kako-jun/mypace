import { useState, useEffect, useCallback, useRef } from 'react'
import { saveSuperMentionPath } from '../lib/api'
import { useSuperMentionSearch, SuggestItemView, type SuggestItem } from './superMention'

interface SuperMentionSuggestProps {
  content: string
  cursorPosition: number
  onSelect: (text: string, replaceStart: number, replaceEnd: number) => void
  onClose: () => void
}

export function SuperMentionSuggest({ content, cursorPosition, onSelect, onClose }: SuperMentionSuggestProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { showSuggest, mentionStart, items, loading, currentCategory } = useSuperMentionSearch(content, cursorPosition)

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

  const handleSelect = useCallback(
    async (item: SuggestItem) => {
      let insertText: string
      let path: string | undefined
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

      if (currentCategory && path) {
        saveSuperMentionPath(path, currentCategory, wikidataId, wikidataLabel, wikidataDescription).catch(() => {})
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

  if (!showSuggest) return null

  return (
    <div ref={containerRef} className="super-mention-suggest">
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
  )
}

export default SuperMentionSuggest
