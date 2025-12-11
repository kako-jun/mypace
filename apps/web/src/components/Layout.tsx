import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import { Settings } from './Settings'
import { getBoolean, setBoolean, getString, setString } from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS, LANGUAGES } from '../lib/constants'

export function Layout() {
  const navigate = useNavigate()
  const [mypaceOnly, setMypaceOnly] = useState(() => getBoolean(STORAGE_KEYS.MYPACE_ONLY, true))
  const [languageFilter, setLanguageFilter] = useState(() => getString(STORAGE_KEYS.LANGUAGE_FILTER) || '')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate('/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleMypaceToggle = () => {
    const newValue = !mypaceOnly
    setMypaceOnly(newValue)
    setBoolean(STORAGE_KEYS.MYPACE_ONLY, newValue)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED))
  }

  const handleLanguageSelect = (code: string) => {
    setLanguageFilter(code)
    setString(STORAGE_KEYS.LANGUAGE_FILTER, code)
    setShowLanguageMenu(false)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED))
  }

  const currentLanguageLabel = LANGUAGES.find((l) => l.code === languageFilter)?.label || 'All'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="header">
        <a href="/" className="logo" onClick={handleLogoClick}>
          <img src="/static/logo.webp" alt="MYPACE" className="logo-img" />
        </a>
        <div className="header-actions">
          <label className="mypace-switch" title={mypaceOnly ? 'Showing #mypace posts only' : 'Showing all posts'}>
            <input type="checkbox" checked={mypaceOnly} onChange={handleMypaceToggle} />
            <span className="switch-slider"></span>
            <span className="switch-label">mypace</span>
          </label>
          <div className="language-filter">
            <button
              className={`language-toggle ${languageFilter ? 'active' : ''}`}
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              title="Filter by language"
            >
              <Icon name="Globe" size={18} />
              {languageFilter && <span className="language-badge">{currentLanguageLabel}</span>}
            </button>
            {showLanguageMenu && (
              <div className="language-menu">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={`language-option ${languageFilter === lang.code ? 'active' : ''}`}
                    onClick={() => handleLanguageSelect(lang.code)}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="search-toggle" onClick={() => navigate('/search')} title="Search">
            <Icon name="Search" size={20} />
          </button>
          <Settings />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
