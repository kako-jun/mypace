import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import { Settings } from './Settings'
import { FilterPanel } from './FilterPanel'
import { getBoolean, getString } from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS } from '../lib/constants'

export function Layout() {
  const navigate = useNavigate()
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [hasActiveFilters, setHasActiveFilters] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  // Check for active filters
  useEffect(() => {
    const checkFilters = () => {
      const mypaceOnly = getBoolean(STORAGE_KEYS.MYPACE_ONLY, true)
      const languageFilter = getString(STORAGE_KEYS.LANGUAGE_FILTER) || ''
      // Consider filter "active" if not default (mypaceOnly=true, language=all)
      setHasActiveFilters(!mypaceOnly || !!languageFilter)
    }
    checkFilters()

    window.addEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, checkFilters)
    window.addEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, checkFilters)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, checkFilters)
      window.removeEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, checkFilters)
    }
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
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="header">
        <a href="/" className="logo" onClick={handleLogoClick}>
          <img src="/static/logo.webp" alt="MYPACE" className="logo-img" />
        </a>
        <div className="header-actions">
          <div className="filter-button-container">
            <button
              ref={filterButtonRef}
              className={`icon-button filter-toggle ${showFilterPanel ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              title="Filter posts"
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
