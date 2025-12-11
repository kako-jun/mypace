import { Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './ui/Icon'
import { Settings } from './Settings'

export function Layout() {
  const navigate = useNavigate()

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
