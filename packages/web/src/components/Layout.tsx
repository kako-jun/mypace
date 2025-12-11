import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="header">
        <a href="/" className="logo">
          mypace
        </a>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
