import { Check, Pin, Search, PenLine } from 'lucide-react'
import type { SuggestItem } from './types'

interface SuggestItemProps {
  item: SuggestItem
  isSelected: boolean
  onSelect: (item: SuggestItem) => void
  onHover: () => void
}

function getWikipediaUrl(wikidataId: string): string {
  return `https://www.wikidata.org/wiki/Special:GoToLinkedPage/jawiki/${wikidataId}`
}

function WikidataQBadge({ id }: { id: string }) {
  return (
    <a
      href={getWikipediaUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      className="super-mention-q-badge super-mention-q-badge-link"
      onClick={(e) => e.stopPropagation()}
      title="Wikipediaで開く"
    >
      {id}
    </a>
  )
}

export function SuggestItemView({ item, isSelected, onSelect, onHover }: SuggestItemProps) {
  const baseClass = `super-mention-suggest-item ${isSelected ? 'selected' : ''}`

  switch (item.type) {
    case 'wikidata':
      return (
        <button
          key={`wd-${item.id}`}
          className={baseClass}
          onClick={() => onSelect(item)}
          onMouseEnter={onHover}
          title={`Wikidata: ${item.id}`}
        >
          <span className="super-mention-suggest-icon">
            <Search size={16} />
          </span>
          <span className="super-mention-suggest-content">
            <span className="super-mention-suggest-label">{item.label}</span>
            <WikidataQBadge id={item.id} />
            <span className="super-mention-suggest-desc">{item.description}</span>
          </span>
        </button>
      )

    case 'history':
      return (
        <button
          key={`hist-${item.path}`}
          className={baseClass}
          onClick={() => onSelect(item)}
          onMouseEnter={onHover}
          title={item.wikidataId ? `Wikidata: ${item.wikidataId}` : undefined}
        >
          <span className="super-mention-suggest-icon">
            {item.wikidataId ? <Check size={16} /> : <Pin size={16} />}
          </span>
          <span className="super-mention-suggest-content">
            <span className="super-mention-suggest-label">{item.label}</span>
            {item.wikidataId && <WikidataQBadge id={item.wikidataId} />}
            <span className="super-mention-suggest-desc">{item.description}</span>
          </span>
        </button>
      )

    case 'custom':
      return (
        <button key="custom" className={baseClass} onClick={() => onSelect(item)} onMouseEnter={onHover}>
          <span className="super-mention-suggest-icon">
            <PenLine size={16} />
          </span>
          <span className="super-mention-suggest-content">
            <span className="super-mention-suggest-label">{item.label}</span>
            <span className="super-mention-suggest-desc">Create new</span>
          </span>
        </button>
      )
  }
}
