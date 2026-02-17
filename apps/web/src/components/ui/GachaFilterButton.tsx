import { useState, useCallback } from 'react'
import { FILTER_PRESETS, type FilterPreset } from '../../lib/constants/ui'
import '../../styles/components/gacha-filter-button.css'

interface GachaFilterButtonProps {
  activeFilter: FilterPreset | null
  onChange: (filter: FilterPreset | null) => void
  className?: string
}

export function GachaFilterButton({ activeFilter, onChange, className = '' }: GachaFilterButtonProps) {
  const [lastFilter, setLastFilter] = useState<string | null>(null)

  const handleClick = useCallback(() => {
    if (activeFilter) {
      onChange(null)
    } else {
      const candidates = FILTER_PRESETS.filter((p) => p.name !== lastFilter)
      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      setLastFilter(picked.name)
      onChange(picked)
    }
  }, [activeFilter, lastFilter, onChange])

  return (
    <button
      type="button"
      className={`gacha-filter-button ${activeFilter ? 'active' : ''} ${className}`.trim()}
      aria-pressed={!!activeFilter}
      onClick={handleClick}
      style={
        activeFilter
          ? { background: `linear-gradient(to bottom, var(--text-primary) 50%, ${activeFilter.color} 50%)` }
          : undefined
      }
    >
      {activeFilter ? activeFilter.name : 'Gacha'}
    </button>
  )
}
