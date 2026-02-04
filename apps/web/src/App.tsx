import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, type Location } from 'react-router-dom'
import { Layout } from './components/layout'
import { HomePage } from './pages/HomePage'
import { PostPage } from './pages/PostPage'
import { UserPage } from './pages/UserPage'
import { MagazinePage } from './pages/MagazinePage'
import { SettingsPage } from './pages/SettingsPage'
import { UploadHistoryPage } from './pages/UploadHistoryPage'
import { InventoryPage } from './pages/InventoryPage'
import { EmbedPage } from './pages/EmbedPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PostModal } from './components/post'
import { CelebrationProvider } from './components/supernova'
import { initializeNavigation, applyThemeColors, getUIThemeColors } from './lib/utils'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  // Apply theme colors on app initialization
  useEffect(() => {
    applyThemeColors(getUIThemeColors())
  }, [])

  // Initialize router navigation utilities
  useEffect(() => {
    initializeNavigation(navigate, location)
  }, [navigate, location])

  // 訪問者カウントをインクリメント（非表示、1日1回制限あり）
  useEffect(() => {
    fetch('https://api.nostalgic.llll-ll.com/visit?action=increment&id=mypace-84d8f852').catch(() => {})
  }, [])

  // Check for background location (modal mode)
  const state = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <CelebrationProvider>
      <Routes location={backgroundLocation || location}>
        {/* Embed page - no Layout */}
        <Route path="/embed/:noteId" element={<EmbedPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/intent/post" element={<HomePage />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/user/:pubkey" element={<UserPage />} />
          <Route path="/user/:npub/magazine/:slug" element={<MagazinePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/upload-history" element={<UploadHistoryPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* Render modal when there's a background location */}
      {backgroundLocation && (
        <Routes location={location}>
          <Route path="/post/:id" element={<PostModal />} />
        </Routes>
      )}
    </CelebrationProvider>
  )
}
