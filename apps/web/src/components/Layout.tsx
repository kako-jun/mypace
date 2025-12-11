import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import { Settings } from './Settings'
import { getBoolean, setBoolean } from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS } from '../lib/constants'

export function Layout() {
  const navigate = useNavigate()
  const [mypaceOnly, setMypaceOnly] = useState(() => getBoolean(STORAGE_KEYS.MYPACE_ONLY, true))

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="header">
        <a href="/" className="logo" onClick={handleLogoClick}>
          <img src="/static/logo.webp" alt="MYPACE" className="logo-img" />
        </a>
        <div className="header-actions">
          <button
            className={`mypace-toggle ${mypaceOnly ? 'active' : ''}`}
            onClick={handleMypaceToggle}
            title={mypaceOnly ? 'Showing #mypace posts only' : 'Showing all posts'}
          >
            <Icon name="Star" size={18} fill={mypaceOnly ? 'currentColor' : 'none'} />
          </button>
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
