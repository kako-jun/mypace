import { Check, Pin, Search, PenLine } from 'lucide-react'
import type { SuggestItem } from './types'

interface SuggestItemProps {
  item: SuggestItem
  isSelected: boolean
  currentCategory: string | null
  onSelect: (item: SuggestItem) => void
  onHover: () => void
}

export function SuggestItemView({ item, isSelected, currentCategory, onSelect, onHover }: SuggestItemProps) {
  const baseClass = `super-mention-suggest-item ${isSelected ? 'selected' : ''}`

  switch (item.type) {
    case 'category': {
      const IconComponent = item.icon
      return (
        <button key={`cat-${item.path}`} className={baseClass} onClick={() => onSelect(item)} onMouseEnter={onHover}>
          <span className="super-mention-suggest-icon">{IconComponent && <IconComponent size={16} />}</span>
          <span className="super-mention-suggest-path">@/{item.path}/</span>
          <span className="super-mention-suggest-label">{item.label}</span>
        </button>
      )
    }

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
          className={baseClass}
          onClick={() => onSelect(item)}
          onMouseEnter={onHover}
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
        <button key="custom" className={baseClass} onClick={() => onSelect(item)} onMouseEnter={onHover}>
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
