import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { Settings } from '../settings'
import { FilterPanel } from '../filter'
import { loadFiltersFromStorage, getMutedPubkeys } from '../../lib/utils'
import { CUSTOM_EVENTS } from '../../lib/constants'
import { getStoredThemeColors, isDarkColor } from '../../lib/nostr/theme'

export function Layout() {
  const navigate = useNavigate()
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [headerCornerClass, setHeaderCornerClass] = useState('')
  const [starAnimationPhase, setStarAnimationPhase] = useState<'initial' | 'normal'>('initial')
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  // Check if any filters are active (based on localStorage, not URL)
  // Note: mypace=true is the default, so we only highlight when filters differ from defaults
  const checkActiveFilters = useCallback(() => {
    const filters = loadFiltersFromStorage()
    const mutedPubkeys = getMutedPubkeys()
    return (
      filters.ngWords.length > 0 ||
      (filters.ngTags?.length ?? 0) > 0 ||
      !filters.showSNS ||
      !filters.showBlog ||
      filters.mypace || // Highlight when mypace is ON (filtering to MY PACE posts only)
      filters.hideNPC ||
      filters.lang !== '' ||
      mutedPubkeys.length > 0
    )
  }, [])

  const [hasActiveFilters, setHasActiveFilters] = useState(checkActiveFilters)

  // Update hasActiveFilters when filters change
  useEffect(() => {
    const updateFilters = () => setHasActiveFilters(checkActiveFilters())

    window.addEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, updateFilters)
    window.addEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, updateFilters)
    window.addEventListener(CUSTOM_EVENTS.NG_WORDS_CHANGED, updateFilters)
    window.addEventListener('storage', updateFilters)

    return () => {
      window.removeEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, updateFilters)
      window.removeEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, updateFilters)
      window.removeEventListener(CUSTOM_EVENTS.NG_WORDS_CHANGED, updateFilters)
      window.removeEventListener('storage', updateFilters)
    }
  }, [checkActiveFilters])

  // Check theme colors for top-right corner
  useEffect(() => {
    const checkThemeColors = () => {
      const colors = getStoredThemeColors()
      if (colors?.topRight) {
        setHeaderCornerClass(isDarkColor(colors.topRight) ? 'corner-tr-dark' : 'corner-tr-light')
      } else {
        setHeaderCornerClass('')
      }
    }
    checkThemeColors()

    window.addEventListener(CUSTOM_EVENTS.THEME_COLORS_CHANGED, checkThemeColors)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.THEME_COLORS_CHANGED, checkThemeColors)
    }
  }, [])

  // Star animation: first spin after 2s, then every 42s
  useEffect(() => {
    const timer = setTimeout(() => {
      setStarAnimationPhase('normal')
    }, 2500) // 2s delay + 0.5s for spin animation
    return () => clearTimeout(timer)
  }, [])

  // Listen for open filter panel event (from Settings)
  useEffect(() => {
    const handleOpenFilterPanel = () => setShowFilterPanel(true)
    window.addEventListener(CUSTOM_EVENTS.OPEN_FILTER_PANEL, handleOpenFilterPanel)
    return () => window.removeEventListener(CUSTOM_EVENTS.OPEN_FILTER_PANEL, handleOpenFilterPanel)
  }, [])

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showFilterPanel &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        setShowFilterPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterPanel])

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate('/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.LOGO_CLICKED))
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="header">
        <a href="/" className="logo" onClick={handleLogoClick}>
          <img src="/static/logo-text.webp" alt="MY PACE" className="logo-img" />
          <img
            src="/static/star.webp"
            alt=""
            className={`logo-star ${starAnimationPhase === 'initial' ? 'logo-star-initial' : ''}`}
          />
        </a>
        <div className={`header-actions ${headerCornerClass}`}>
          <div className="filter-button-container">
            <button
              ref={filterButtonRef}
              className={`icon-button filter-toggle ${showFilterPanel ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              aria-label="Filter posts"
            >
              <Icon name="Filter" size={18} />
            </button>
            {showFilterPanel && (
              <div ref={filterPanelRef} className="filter-panel-wrapper">
                <FilterPanel isPopup={true} onClose={() => setShowFilterPanel(false)} />
              </div>
            )}
          </div>
          <Settings />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
