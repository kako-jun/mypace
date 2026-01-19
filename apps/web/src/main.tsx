import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Prevent SW update loop using timestamp
const SW_UPDATE_KEY = 'sw-update-time'
const COOLDOWN_MS = 10000 // 10 seconds cooldown after update

function shouldSkipUpdate(): boolean {
  const lastUpdate = sessionStorage.getItem(SW_UPDATE_KEY)
  if (!lastUpdate) return false
  const elapsed = Date.now() - parseInt(lastUpdate, 10)
  return elapsed < COOLDOWN_MS
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
    // Skip if we recently updated (within cooldown period)
    if (shouldSkipUpdate()) {
      console.log('SW update skipped (cooldown)')
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

    // Record update timestamp
    sessionStorage.setItem(SW_UPDATE_KEY, Date.now().toString())

    // Wait for new SW to take control, then reload
    const reloadOnControllerChange = () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }

    // Reload after 1.5 seconds
    setTimeout(async () => {
      try {
        // Set up listener before triggering update
        reloadOnControllerChange()
        // Trigger skipWaiting - this will cause controllerchange event
        await updateSW(true)
        // Fallback: if controllerchange doesn't fire within 2s, reload anyway
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } catch (e) {
        console.error('SW update failed:', e)
        window.location.reload()
      }
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
