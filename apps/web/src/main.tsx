import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

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

    // Reload after 1.5 seconds
    setTimeout(() => {
      // Trigger skipWaiting to activate new SW immediately
      updateSW(true)
      // Wait a bit for SW switch, then reload
      setTimeout(() => {
        window.location.reload()
      }, 100)
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
