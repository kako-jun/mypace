import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Clear update flag on fresh load (prevents infinite loop)
const SW_UPDATE_KEY = 'sw-updating'
const isUpdating = sessionStorage.getItem(SW_UPDATE_KEY)
if (isUpdating) {
  sessionStorage.removeItem(SW_UPDATE_KEY)
  console.log('SW update completed')
}

// Register Service Worker with update handling
const updateSW = registerSW({
  immediate: true,
  onRegistered(swRegistration) {
    if (swRegistration) {
      // Check for updates on registration
      swRegistration.update().catch((error) => {
        console.log('SW update check skipped:', error?.message || 'offline')
      })
    }
  },
  onNeedRefresh() {
    // Skip if we just reloaded for an update
    if (sessionStorage.getItem(SW_UPDATE_KEY)) {
      console.log('SW update already in progress, skipping')
      return
    }

    // New version detected - show overlay and reload
    console.log('New version available, reloading...')

    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `

    const message = document.createElement('div')
    message.style.cssText = `
      color: white;
      font-size: 0.9rem;
      text-align: center;
      padding: 1.5rem 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      backdrop-filter: blur(10px);
    `
    message.textContent = 'New version available. Restarting...'

    overlay.appendChild(message)
    document.body.appendChild(overlay)

    // Set flag to prevent loop
    sessionStorage.setItem(SW_UPDATE_KEY, '1')

    // Reload after 1.5 seconds
    setTimeout(async () => {
      try {
        // Trigger skipWaiting and wait for activation
        await updateSW(true)
      } catch (e) {
        console.error('SW update failed:', e)
        sessionStorage.removeItem(SW_UPDATE_KEY)
      }
      // Reload after SW is activated
      window.location.reload()
    }, 1500)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
