import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { PostPage } from './pages/PostPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { TagPage } from './pages/TagPage'
import { PostModal } from './components/PostModal'
import { initializeNavigation } from './lib/utils'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  // Initialize router navigation utilities
  useEffect(() => {
    initializeNavigation(navigate, () => location)
  }, [navigate, location])

  // Check for background location (modal mode)
  const state = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/user/:pubkey" element={<ProfilePage />} />
          <Route path="/profile/:pubkey" element={<ProfilePage />} />
          <Route path="/tag/:tags" element={<TagPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>

      {/* Render modal when there's a background location */}
      {backgroundLocation && (
        <Routes>
          <Route path="/post/:id" element={<PostModal />} />
        </Routes>
      )}
    </>
  )
}
